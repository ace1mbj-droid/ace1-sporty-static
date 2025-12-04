-- Verification Script: Check RLS Policy Optimization
-- Run this after applying optimize_rls_policies.sql

-- 1. List all current RLS policies (should see clean naming)
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as action,
  CASE 
    WHEN roles = '{anon}' THEN 'anonymous'
    WHEN roles = '{authenticated}' THEN 'authenticated'
    ELSE array_to_string(roles, ', ')
  END as applies_to
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- 2. Count policies per table (should be reasonable numbers)
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 3. Verify RLS is enabled on all critical tables
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('payments', 'user_roles', 'orders', 'order_items', 
                    'products', 'inventory', 'product_images', 'sessions')
ORDER BY tablename;

-- 4. Check for any remaining duplicate policy names
SELECT 
  tablename,
  policyname,
  COUNT(*) as count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, policyname
HAVING COUNT(*) > 1;

-- Expected Results:
-- Query 1: Should show 27 policies with clean names (e.g., orders_select_own, sessions_select_own)
-- Query 2: payments=2, user_roles=3, orders=4, order_items=2, products=5, inventory=3, product_images=4, sessions=4
-- Query 3: All tables should show rls_enabled = true
-- Query 4: Should return 0 rows (no duplicates)
