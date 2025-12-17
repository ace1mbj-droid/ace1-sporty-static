-- Add admin override policies on public.users using security.is_admin()
-- NOTE: Existing permissive policies remain; consider a follow-up to restrict public access.

DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;

CREATE POLICY "users_select_admin" ON public.users FOR SELECT USING (security.is_admin());
CREATE POLICY "users_update_admin" ON public.users FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin());
CREATE POLICY "users_delete_admin" ON public.users FOR DELETE USING (security.is_admin());
