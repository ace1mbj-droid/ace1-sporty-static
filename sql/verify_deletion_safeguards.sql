-- Verification queries for product deletion safeguards
-- Run these in Supabase SQL Editor to check if everything was applied correctly

-- ============================================================================
-- 1. Check if all functions exist
-- ============================================================================
SELECT 
    routine_name as function_name,
    routine_type,
    security_type,
    routine_definition LIKE '%search_path%' as has_search_path
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'check_product_has_orders',
    'soft_delete_product',
    'hard_delete_product',
    'log_product_deletion'
  )
ORDER BY routine_name;

-- Expected: 4 functions, all with security_type = 'DEFINER', has_search_path = true

-- ============================================================================
-- 2. Check if deleted_at column exists
-- ============================================================================
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'products' 
  AND column_name = 'deleted_at';

-- Expected: 1 row showing deleted_at | timestamp with time zone | YES

-- ============================================================================
-- 3. Check if product_deletion_audit table exists
-- ============================================================================
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'product_deletion_audit'
ORDER BY ordinal_position;

-- Expected: 9 columns (id, product_id, product_name, deleted_by, deletion_type, had_orders, order_count, deleted_at, metadata)

-- ============================================================================
-- 4. Check RLS is enabled on audit table
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'product_deletion_audit';

-- Expected: rls_enabled = true

-- ============================================================================
-- 5. Check if audit policy exists
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'product_deletion_audit';

-- Expected: 1 policy named 'audit_select_admin' for SELECT

-- ============================================================================
-- 6. Check if triggers exist
-- ============================================================================
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'products'
  AND trigger_name LIKE '%audit%'
ORDER BY trigger_name;

-- Expected: 2 triggers (product_deletion_audit_trigger, product_soft_delete_audit_trigger)

-- ============================================================================
-- 7. Check if active_products view exists
-- ============================================================================
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'active_products';

-- Expected: 1 row with view definition

-- ============================================================================
-- 8. Check if inventory_delete_admin policy exists
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'inventory'
  AND policyname = 'inventory_delete_admin';

-- Expected: 1 row showing the DELETE policy

-- ============================================================================
-- 9. Test check_product_has_orders function (safe to run)
-- ============================================================================
-- This tests the function without actually modifying data
-- Replace 'test-uuid' with a real product ID from your database
-- SELECT * FROM check_product_has_orders('test-uuid');

-- ============================================================================
-- 10. Summary check - count all components
-- ============================================================================
SELECT 
    'Functions' as component,
    COUNT(*) as count
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('check_product_has_orders', 'soft_delete_product', 'hard_delete_product', 'log_product_deletion')
UNION ALL
SELECT 
    'Audit Table Columns' as component,
    COUNT(*) as count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'product_deletion_audit'
UNION ALL
SELECT 
    'Triggers' as component,
    COUNT(*) as count
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'products'
  AND trigger_name LIKE '%audit%'
UNION ALL
SELECT 
    'Audit Policies' as component,
    COUNT(*) as count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'product_deletion_audit'
UNION ALL
SELECT 
    'Active Products View' as component,
    COUNT(*) as count
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'active_products';

-- Expected totals:
-- Functions: 4
-- Audit Table Columns: 9
-- Triggers: 2
-- Audit Policies: 1
-- Active Products View: 1
