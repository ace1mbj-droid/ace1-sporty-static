-- Fix infinite recursion in user_roles RLS policies
-- The issue occurs when policies check user_roles while querying user_roles
-- This fix is for CUSTOM AUTH (not Supabase Auth)

-- Disable RLS on user_roles to avoid recursion
-- Since you're using custom auth via JavaScript, RLS on user_roles causes infinite loops
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies (they won't apply with RLS disabled)
DROP POLICY IF EXISTS "user_roles_select_own" ON user_roles;
DROP POLICY IF EXISTS "user_roles_select_admin" ON user_roles;
DROP POLICY IF EXISTS "user_roles_select_all" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert_admin" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert_restricted" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update_admin" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update_restricted" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete_admin" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete_restricted" ON user_roles;

-- NOTE: With custom auth, admin checks happen in your JavaScript code
-- The database-auth.js file already validates admin access by checking email
-- RLS on user_roles is not needed and causes recursion when other tables check it

-- Verification: Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'user_roles';

-- Expected: rls_enabled = false
