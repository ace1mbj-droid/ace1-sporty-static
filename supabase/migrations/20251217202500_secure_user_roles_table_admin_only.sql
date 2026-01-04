-- Enable RLS and add admin-only policies to user_roles table

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- Drop any existing policies
DROP POLICY IF EXISTS "user_roles_select_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_admin" ON public.user_roles;
-- Admin-only SELECT
CREATE POLICY "user_roles_select_admin" ON public.user_roles FOR SELECT
USING (security.is_admin());
-- Admin-only INSERT
CREATE POLICY "user_roles_insert_admin" ON public.user_roles FOR INSERT
WITH CHECK (security.is_admin());
-- Admin-only UPDATE
CREATE POLICY "user_roles_update_admin" ON public.user_roles FOR UPDATE
USING (security.is_admin())
WITH CHECK (security.is_admin());
-- Admin-only DELETE
CREATE POLICY "user_roles_delete_admin" ON public.user_roles FOR DELETE
USING (security.is_admin());
