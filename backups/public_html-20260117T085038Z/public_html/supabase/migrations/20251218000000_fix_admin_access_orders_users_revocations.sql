-- Fix admin access to orders, users, and session_revocations tables
-- Issue: RLS policies preventing admin from viewing these tables

-- 1. USERS TABLE - Add admin SELECT policy
-- Current issue: admin can't view all users, only self
DROP POLICY IF EXISTS "users_select_admin" ON users;
CREATE POLICY "users_select_admin" 
ON users FOR SELECT 
USING (
  security.is_admin() OR (select auth.uid()) = id
);
-- Also ensure admin can update users
DROP POLICY IF EXISTS "users_update_admin" ON users;
CREATE POLICY "users_update_admin" 
ON users FOR UPDATE 
USING (security.is_admin())
WITH CHECK (security.is_admin());
-- 2. ORDERS TABLE - Ensure admin policies are active
-- Re-create to make sure they work
DROP POLICY IF EXISTS "orders_select_own" ON orders;
DROP POLICY IF EXISTS "orders_select_admin" ON orders;
-- Users can see their own orders
CREATE POLICY "orders_select_own" 
ON orders FOR SELECT 
USING ((select auth.uid()) = user_id);
-- Admins can see all orders
CREATE POLICY "orders_select_admin" 
ON orders FOR SELECT 
USING (security.is_admin());
-- Admin can update any order
DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin" 
ON orders FOR UPDATE 
USING (security.is_admin())
WITH CHECK (security.is_admin());
-- 3. SESSION_REVOCATIONS TABLE - Ensure admin access
-- Re-create policies to ensure they work
DROP POLICY IF EXISTS "session_revocations_select_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_insert_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_update_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_delete_admin" ON session_revocations;
CREATE POLICY "session_revocations_select_admin" 
ON session_revocations FOR SELECT 
USING (security.is_admin());
CREATE POLICY "session_revocations_insert_admin" 
ON session_revocations FOR INSERT 
WITH CHECK (security.is_admin());
CREATE POLICY "session_revocations_update_admin" 
ON session_revocations FOR UPDATE 
USING (security.is_admin())
WITH CHECK (security.is_admin());
CREATE POLICY "session_revocations_delete_admin" 
ON session_revocations FOR DELETE 
USING (security.is_admin());
-- 4. Verify the security.is_admin() function works correctly
-- Check if it's looking at the right email
CREATE OR REPLACE FUNCTION security.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Check both user_roles table and email (hello@ace1.in is always admin)
  SELECT COALESCE(
    (
      SELECT ur.is_admin 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      LIMIT 1
    ),
    (
      SELECT u.role = 'admin' OR u.email = 'hello@ace1.in'
      FROM public.users u
      WHERE u.id = auth.uid()
      LIMIT 1
    ),
    false
  );
$$;
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION security.is_admin() TO anon, authenticated, service_role;
-- Add comment
COMMENT ON FUNCTION security.is_admin() IS 'Returns true if current user is admin (checks user_roles.is_admin or users.role=admin or email=hello@ace1.in)';
