-- Debug: Test if security.is_admin() function works for current session
-- Run this in Supabase SQL Editor while logged in as hello@ace1.in

-- 1. Check current auth user
SELECT 
    auth.uid() as current_user_id,
    auth.email() as current_email;

-- 2. Test security.is_admin() function
SELECT security.is_admin() as is_admin_result;

-- 3. Check user_roles entry for current user
SELECT ur.user_id, ur.is_admin, u.email
FROM public.user_roles ur
JOIN public.users u ON u.id = ur.user_id
WHERE ur.user_id = auth.uid();

-- 4. Check users table for current user
SELECT id, email, role
FROM public.users
WHERE id = auth.uid();

-- 5. Manually test the COALESCE logic
SELECT 
    auth.uid() as current_user,
    (SELECT ur.is_admin FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1) as from_user_roles,
    (SELECT (u.role = 'admin') FROM public.users u WHERE u.id = auth.uid() LIMIT 1) as from_users_role,
    (SELECT (u.email = 'hello@ace1.in') FROM public.users u WHERE u.id = auth.uid() LIMIT 1) as from_email_check;
