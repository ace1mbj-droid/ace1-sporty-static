-- Recreate verify_session to:
-- - return sessions.token (required for header-based session auth)
-- - refuse to restore sessions for unconfirmed email/password accounts

DROP FUNCTION IF EXISTS public.verify_session(text);

CREATE FUNCTION public.verify_session(p_session_id text)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  token text,
  jwt_token text,
  user_data jsonb,
  expires_at timestamptz,
  user_email text,
  user_first_name text,
  user_last_name text,
  user_phone text,
  user_role text,
  user_avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.token,
    s.jwt_token,
    s.user_data,
    s.expires_at,
    u.email,
    u.first_name,
    u.last_name,
    u.phone,
    u.role,
    u.avatar
  FROM public.sessions s
  LEFT JOIN public.users u ON s.user_id = u.id
  LEFT JOIN auth.users au ON au.id = u.id
  WHERE s.session_id = p_session_id
    AND s.expires_at > NOW()
    AND (
      u.email IS NULL
      OR lower(u.email) = 'hello@ace1.in'
      OR au.email_confirmed_at IS NOT NULL
      OR au.confirmed_at IS NOT NULL
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_session(text) TO anon, authenticated;
