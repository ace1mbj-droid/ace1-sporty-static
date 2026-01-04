-- Simplify RLS policies to only check user_roles table (no users table access)
-- This completely eliminates circular dependency

-- 1. USERS table - only check user_roles, no email fallback that would query users
DROP POLICY IF EXISTS "users_select_self_or_admin" ON users;
CREATE POLICY "users_select_self_or_admin" 
ON users FOR SELECT 
USING (
  auth.uid() = id 
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
DROP POLICY IF EXISTS "users_update_admin" ON users;
CREATE POLICY "users_update_admin" 
ON users FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
-- 2. ORDERS table - only check user_roles
DROP POLICY IF EXISTS "orders_select_own" ON orders;
DROP POLICY IF EXISTS "orders_select_admin" ON orders;
CREATE POLICY "orders_select_own" 
ON orders FOR SELECT 
USING (auth.uid() = user_id);
CREATE POLICY "orders_select_admin" 
ON orders FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin" 
ON orders FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
-- 3. SESSION_REVOCATIONS table - only check user_roles
DROP POLICY IF EXISTS "session_revocations_select_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_insert_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_update_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_delete_admin" ON session_revocations;
CREATE POLICY "session_revocations_select_admin" 
ON session_revocations FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
CREATE POLICY "session_revocations_insert_admin" 
ON session_revocations FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
CREATE POLICY "session_revocations_update_admin" 
ON session_revocations FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
CREATE POLICY "session_revocations_delete_admin" 
ON session_revocations FOR DELETE 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
-- 4. Ensure USER_ROLES table has public read access (required for the checks above to work)
DROP POLICY IF EXISTS "user_roles_select_public" ON user_roles;
CREATE POLICY "user_roles_select_public" 
ON user_roles FOR SELECT 
USING (true);
-- Anyone can read user_roles to check admin status;
