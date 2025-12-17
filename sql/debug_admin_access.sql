-- Test query to verify security.is_admin() function and check admin user status
-- Run this in Supabase SQL Editor

-- 1. Check the current function definition
SELECT 
    pg_get_functiondef(pg_proc.oid) AS function_definition
FROM pg_proc
JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
WHERE pg_namespace.nspname = 'security' 
    AND pg_proc.proname = 'is_admin'
    AND pg_proc.proargtypes = ''::oidvector;  -- No arguments version

-- 2. Check if hello@ace1.in exists in users table and their role
SELECT id, email, role, created_at 
FROM public.users 
WHERE email = 'hello@ace1.in';

-- 3. Check if hello@ace1.in exists in user_roles table
SELECT ur.user_id, ur.is_admin, u.email
FROM public.user_roles ur
JOIN public.users u ON u.id = ur.user_id
WHERE u.email = 'hello@ace1.in';

-- 4. Check auth.users for hello@ace1.in
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
WHERE email = 'hello@ace1.in';
