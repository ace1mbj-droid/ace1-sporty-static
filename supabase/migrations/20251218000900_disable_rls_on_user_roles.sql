-- FINAL FIX: Completely disable RLS on user_roles table
-- The table only contains user_id and is_admin flag - no sensitive data
-- Making it fully accessible eliminates all recursion issues

-- Drop all policies
DROP POLICY IF EXISTS "user_roles_read_all" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_select_all" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_select_public" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_select_admin" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_insert_admin" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_insert_self_only" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_update_admin" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_update_self_only" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_delete_admin" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_delete_self_only" ON user_roles CASCADE;
-- Disable RLS completely
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
-- Grant read access to authenticated users
GRANT SELECT ON user_roles TO authenticated, anon;
-- Keep write access restricted to service_role only (default)
REVOKE INSERT, UPDATE, DELETE ON user_roles FROM authenticated, anon;
COMMENT ON TABLE user_roles IS 'Admin role flags. RLS disabled - publicly readable. Modifications require service_role key.';
