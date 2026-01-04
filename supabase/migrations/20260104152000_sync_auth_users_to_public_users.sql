-- Sync auth.users into public.users so the admin UI can list all users.
--
-- Rationale:
-- - Supabase Auth identities live in auth.users.
-- - The site/admin UI lists users from public.users.
-- - Without a sync, people can log in via Auth but not appear in public.users.

-- Helper to extract non-empty text from JSONB.
CREATE OR REPLACE FUNCTION public._jsonb_text(j jsonb, key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(TRIM(BOTH FROM (j ->> key)), '');
$$;

-- Trigger function: upsert profile rows keyed by auth.users.id.
CREATE OR REPLACE FUNCTION public.handle_auth_user_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_first text;
  v_last text;
  v_avatar text;
  v_phone text;
BEGIN
  v_full_name := COALESCE(
    public._jsonb_text(NEW.raw_user_meta_data, 'full_name'),
    public._jsonb_text(NEW.raw_user_meta_data, 'name'),
    ''
  );

  v_first := COALESCE(
    public._jsonb_text(NEW.raw_user_meta_data, 'first_name'),
    public._jsonb_text(NEW.raw_user_meta_data, 'given_name'),
    NULLIF(split_part(v_full_name, ' ', 1), ''),
    ''
  );

  v_last := COALESCE(
    public._jsonb_text(NEW.raw_user_meta_data, 'last_name'),
    public._jsonb_text(NEW.raw_user_meta_data, 'family_name'),
    NULLIF(trim(both from regexp_replace(v_full_name, '^\s*[^\s]+\s*', '')), ''),
    ''
  );

  v_avatar := COALESCE(
    public._jsonb_text(NEW.raw_user_meta_data, 'avatar_url'),
    public._jsonb_text(NEW.raw_user_meta_data, 'picture'),
    public._jsonb_text(NEW.raw_user_meta_data, 'avatar'),
    NULL
  );

  v_phone := COALESCE(
    NULLIF(NEW.phone, ''),
    public._jsonb_text(NEW.raw_user_meta_data, 'phone'),
    NULL
  );

  INSERT INTO public.users (id, email, first_name, last_name, phone, avatar, role, created_at, last_login)
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    v_first,
    v_last,
    v_phone,
    v_avatar,
    CASE WHEN LOWER(NEW.email) = 'hello@ace1.in' THEN 'admin' ELSE 'customer' END,
    COALESCE(NEW.created_at, NOW()),
    NULL
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.users.first_name),
    last_name  = COALESCE(NULLIF(EXCLUDED.last_name, ''),  public.users.last_name),
    phone      = COALESCE(EXCLUDED.phone, public.users.phone),
    avatar     = COALESCE(EXCLUDED.avatar, public.users.avatar),
    role       = CASE WHEN EXCLUDED.email = 'hello@ace1.in' THEN 'admin' ELSE public.users.role END;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_sync_auth_users_to_public_users'
  ) THEN
    CREATE TRIGGER trg_sync_auth_users_to_public_users
    AFTER INSERT OR UPDATE OF email, raw_user_meta_data, phone
    ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_auth_user_upsert();
  END IF;
END $$;

-- Backfill existing auth.users into public.users
INSERT INTO public.users (id, email, first_name, last_name, phone, avatar, role, created_at)
SELECT
  au.id,
  LOWER(au.email),
  COALESCE(public._jsonb_text(au.raw_user_meta_data, 'first_name'), public._jsonb_text(au.raw_user_meta_data, 'given_name'), ''),
  COALESCE(public._jsonb_text(au.raw_user_meta_data, 'last_name'),  public._jsonb_text(au.raw_user_meta_data, 'family_name'), ''),
  COALESCE(NULLIF(au.phone, ''), public._jsonb_text(au.raw_user_meta_data, 'phone')),
  COALESCE(public._jsonb_text(au.raw_user_meta_data, 'avatar_url'), public._jsonb_text(au.raw_user_meta_data, 'picture')),
  CASE WHEN LOWER(au.email) = 'hello@ace1.in' THEN 'admin' ELSE 'customer' END,
  COALESCE(au.created_at, NOW())
FROM auth.users au
WHERE au.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;
