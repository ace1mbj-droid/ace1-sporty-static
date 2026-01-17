-- Fix users table RLS policies to avoid circular dependency
-- Replace security.is_admin() calls with direct EXISTS checks

DROP POLICY IF EXISTS "users_select_self_or_admin" ON users;
DROP POLICY IF EXISTS "users_insert_self_or_admin" ON users;
DROP POLICY IF EXISTS "users_update_self_or_admin" ON users;
DROP POLICY IF EXISTS "users_delete_admin_only" ON users;
DROP POLICY IF EXISTS "users_update_admin" ON users;
-- SELECT: self or admin (direct check)
CREATE POLICY "users_select_self_or_admin" 
ON users FOR SELECT 
USING (
  auth.uid() = id 
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
-- INSERT: users can create their own record (auth.uid() = id)
CREATE POLICY "users_insert_self" 
ON users FOR INSERT 
WITH CHECK (auth.uid() = id);
-- INSERT: admins can create any user
CREATE POLICY "users_insert_admin"
ON users FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
-- UPDATE: self or admin (direct check)
CREATE POLICY "users_update_self_or_admin" 
ON users FOR UPDATE 
USING (
  auth.uid() = id 
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
)
WITH CHECK (
  auth.uid() = id 
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
-- DELETE: admin only (direct check)
CREATE POLICY "users_delete_admin_only" 
ON users FOR DELETE 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true)
);
