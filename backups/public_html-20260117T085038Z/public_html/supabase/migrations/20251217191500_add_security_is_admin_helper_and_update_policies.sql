-- Create security schema and is_admin helpers
create schema if not exists security;
-- Ensure roles can call functions in this schema
grant usage on schema security to anon, authenticated, service_role;
create or replace function security.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = uid
      and ur.is_admin = true
  );
$$;
create or replace function security.is_admin()
returns boolean
language sql
stable
as $$
  select security.is_admin(auth.uid());
$$;
grant execute on function security.is_admin(uuid) to anon, authenticated, service_role;
grant execute on function security.is_admin() to anon, authenticated, service_role;
DO $$
DECLARE
  rel_kind char;
BEGIN
  SELECT c.relkind INTO rel_kind
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'active_products';

  -- Policies only apply to tables; skip if active_products is a view.
  IF rel_kind = 'r' THEN
    EXECUTE 'DROP POLICY IF EXISTS "active_products_select_admin" ON public.active_products';
    EXECUTE 'DROP POLICY IF EXISTS "active_products_insert_admin" ON public.active_products';
    EXECUTE 'DROP POLICY IF EXISTS "active_products_update_admin" ON public.active_products';
    EXECUTE 'DROP POLICY IF EXISTS "active_products_delete_admin" ON public.active_products';

    EXECUTE 'CREATE POLICY "active_products_select_admin" ON public.active_products FOR SELECT USING (security.is_admin())';
    EXECUTE 'CREATE POLICY "active_products_insert_admin" ON public.active_products FOR INSERT WITH CHECK (security.is_admin())';
    EXECUTE 'CREATE POLICY "active_products_update_admin" ON public.active_products FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin())';
    EXECUTE 'CREATE POLICY "active_products_delete_admin" ON public.active_products FOR DELETE USING (security.is_admin())';
  END IF;
END $$;
