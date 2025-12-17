-- Test queries to verify admin access works
-- Run these in Supabase SQL Editor while logged in as hello@ace1.in

-- 1. Check current user auth status
SELECT 
    auth.uid() as my_user_id,
    auth.email() as my_email;

-- 2. Check if current user is in user_roles with admin
SELECT 
    user_id,
    is_admin
FROM public.user_roles
WHERE user_id = auth.uid();

-- 3. Test the EXISTS check that RLS policies use
SELECT 
    EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE user_id = auth.uid() 
        AND is_admin = true
    ) as should_have_admin_access;

-- 4. Try to select from orders (should work if RLS is correct)
SELECT COUNT(*) as order_count FROM public.orders;

-- 5. Check RLS policies on orders table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY policyname;

-- 6. Verify user exists in all three tables with same UUID
SELECT 
    'auth.users' as table_name,
    id,
    email
FROM auth.users
WHERE email = 'hello@ace1.in'
UNION ALL
SELECT 
    'public.users' as table_name,
    id,
    email
FROM public.users
WHERE email = 'hello@ace1.in'
UNION ALL
SELECT 
    'public.user_roles' as table_name,
    user_id as id,
    'N/A' as email
FROM public.user_roles ur
JOIN public.users u ON u.id = ur.user_id
WHERE u.email = 'hello@ace1.in';
