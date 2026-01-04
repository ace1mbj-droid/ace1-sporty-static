-- Fix user_roles table RLS to prevent infinite recursion
-- The table MUST allow public read access so other policies can check admin status

-- Drop ALL existing policies on user_roles
DROP POLICY IF EXISTS "user_roles_select_public" ON user_roles;
DROP POLICY IF EXISTS "user_roles_select_admin" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert_admin" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update_admin" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete_admin" ON user_roles;
-- SELECT: Everyone can read user_roles (required for admin checks)
-- This MUST be public to avoid infinite recursion in other policies
CREATE POLICY "user_roles_select_all" 
ON user_roles FOR SELECT 
USING (true);
-- INSERT: Only allow if inserting user's own record, or via service role
-- Cannot check is_admin here as it would cause recursion
CREATE POLICY "user_roles_insert_self_only" 
ON user_roles FOR INSERT 
WITH CHECK (auth.uid() = user_id);
-- UPDATE: Only the user themselves or service role
CREATE POLICY "user_roles_update_self_only" 
ON user_roles FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
-- DELETE: Only the user themselves or service role
CREATE POLICY "user_roles_delete_self_only" 
ON user_roles FOR DELETE 
USING (auth.uid() = user_id);
-- Note: Admins should use service role key for managing user_roles
-- Regular users can only manage their own role entry;
