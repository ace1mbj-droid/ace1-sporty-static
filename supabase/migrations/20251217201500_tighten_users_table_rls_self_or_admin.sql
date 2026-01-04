-- Tighten users table RLS: self-or-admin access with admin-only delete

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "users_select_all" ON public.users;
DROP POLICY IF EXISTS "users_insert_public" ON public.users;
DROP POLICY IF EXISTS "users_update_all" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
-- SELECT: self or admin
CREATE POLICY "users_select_self_or_admin" ON public.users FOR SELECT
USING (auth.uid() = id OR security.is_admin());
-- INSERT: authenticated users can register (for themselves) or admin can create
CREATE POLICY "users_insert_self_or_admin" ON public.users FOR INSERT
WITH CHECK (auth.uid() = id OR security.is_admin());
-- UPDATE: self or admin
CREATE POLICY "users_update_self_or_admin" ON public.users FOR UPDATE
USING (auth.uid() = id OR security.is_admin())
WITH CHECK (auth.uid() = id OR security.is_admin());
-- DELETE: admin only
CREATE POLICY "users_delete_admin_only" ON public.users FOR DELETE
USING (security.is_admin());
