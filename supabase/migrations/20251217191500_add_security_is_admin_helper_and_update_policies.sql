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

-- Recreate active_products policies to use helper
DROP POLICY IF EXISTS "active_products_select_admin" ON active_products;
DROP POLICY IF EXISTS "active_products_insert_admin" ON active_products;
DROP POLICY IF EXISTS "active_products_update_admin" ON active_products;
DROP POLICY IF EXISTS "active_products_delete_admin" ON active_products;

CREATE POLICY "active_products_select_admin"
ON active_products FOR SELECT
USING (security.is_admin());

CREATE POLICY "active_products_insert_admin"
ON active_products FOR INSERT
WITH CHECK (security.is_admin());

CREATE POLICY "active_products_update_admin"
ON active_products FOR UPDATE
USING (security.is_admin())
WITH CHECK (security.is_admin());

CREATE POLICY "active_products_delete_admin"
ON active_products FOR DELETE
USING (security.is_admin());
