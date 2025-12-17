-- COMPREHENSIVE FIX: Remove ALL user_roles policies and recreate without recursion
-- This migration explicitly drops every possible policy name and starts fresh

-- Disable RLS temporarily to ensure clean slate
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Drop every possible policy that might exist
DROP POLICY IF EXISTS "user_roles_select_all" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_select_public" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_select_admin" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_insert_admin" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_insert_self_only" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_update_admin" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_update_self_only" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_delete_admin" ON user_roles CASCADE;
DROP POLICY IF EXISTS "user_roles_delete_self_only" ON user_roles CASCADE;

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create ONLY the public read policy
-- This is CRITICAL - other tables need to read this to check admin status
CREATE POLICY "user_roles_read_all" 
ON user_roles FOR SELECT 
TO authenticated, anon
USING (true);

-- For write operations, use service role key only
-- No RLS policies for INSERT/UPDATE/DELETE = service_role only

COMMENT ON TABLE user_roles IS 'Admin role tracking. SELECT is public (required for RLS checks). Modifications require service_role key.';
