-- Fix circular dependency in RLS policies
-- Problem: security.is_admin() reads from users table, but users table RLS policy calls security.is_admin()
-- Solution: Use direct checks in RLS policies to avoid the circular dependency

-- 1. Fix USERS table - check user_roles and email directly without calling security.is_admin()
DROP POLICY IF EXISTS "users_select_admin" ON users;
DROP POLICY IF EXISTS "users_select_self_or_admin" ON users;
-- Users can see themselves, OR they're in user_roles with is_admin=true, OR email is hello@ace1.in
CREATE POLICY "users_select_self_or_admin" 
ON users FOR SELECT 
USING (
  (select auth.uid()) = id 
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND is_admin = true)
  OR email = 'hello@ace1.in'
);
DROP POLICY IF EXISTS "users_update_admin" ON users;
CREATE POLICY "users_update_admin" 
ON users FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND is_admin = true)
  OR email = 'hello@ace1.in'
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND is_admin = true)
  OR (SELECT email FROM users WHERE id = (select auth.uid())) = 'hello@ace1.in'
);
-- 2. Fix ORDERS table - use direct check instead of security.is_admin()
DROP POLICY IF EXISTS "orders_select_own" ON orders;
DROP POLICY IF EXISTS "orders_select_admin" ON orders;
CREATE POLICY "orders_select_own" 
ON orders FOR SELECT 
USING ((select auth.uid()) = user_id);
CREATE POLICY "orders_select_admin" 
ON orders FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND is_admin = true)
  OR (SELECT email FROM users WHERE id = (select auth.uid())) = 'hello@ace1.in'
);
DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin" 
ON orders FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND is_admin = true)
  OR (SELECT email FROM users WHERE id = (select auth.uid())) = 'hello@ace1.in'
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND is_admin = true)
  OR (SELECT email FROM users WHERE id = (select auth.uid())) = 'hello@ace1.in'
);
-- 3. Fix SESSION_REVOCATIONS table - use direct check
DROP POLICY IF EXISTS "session_revocations_select_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_insert_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_update_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_delete_admin" ON session_revocations;
CREATE POLICY "session_revocations_select_admin" 
ON session_revocations FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND is_admin = true)
  OR (SELECT email FROM users WHERE id = (select auth.uid())) = 'hello@ace1.in'
);
CREATE POLICY "session_revocations_insert_admin" 
ON session_revocations FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND is_admin = true)
  OR (SELECT email FROM users WHERE id = (select auth.uid())) = 'hello@ace1.in'
);
CREATE POLICY "session_revocations_update_admin" 
ON session_revocations FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND is_admin = true)
  OR (SELECT email FROM users WHERE id = (select auth.uid())) = 'hello@ace1.in'
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND is_admin = true)
  OR (SELECT email FROM users WHERE id = (select auth.uid())) = 'hello@ace1.in'
);
CREATE POLICY "session_revocations_delete_admin" 
ON session_revocations FOR DELETE 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND is_admin = true)
  OR (SELECT email FROM users WHERE id = (select auth.uid())) = 'hello@ace1.in'
);
