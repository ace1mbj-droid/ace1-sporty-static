-- Verify Supabase schema + functions for session revocations and product auditing
-- Run in Supabase SQL Editor or via psql using a service_role client

-- 1) session_revocations table columns
SELECT column_name, data_type, ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'session_revocations'
ORDER BY ordinal_position;

-- 2) functions exist and contain expected signatures
SELECT oid::regprocedure AS signature, pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname IN ('revoke_session_by_token', 'revoke_sessions_for_email')
ORDER BY proname;

-- 3) execute privilege checks for the revoke functions
-- Expect service_role to have EXECUTE and anon/authenticated not to
SELECT has_function_privilege('anon', 'public.revoke_session_by_token(text, text, text, text, text)', 'EXECUTE') AS anon_exec;
SELECT has_function_privilege('authenticated', 'public.revoke_session_by_token(text, text, text, text, text)', 'EXECUTE') AS auth_exec;
SELECT has_function_privilege('service_role', 'public.revoke_session_by_token(text, text, text, text, text)', 'EXECUTE') AS service_exec;

-- 4) product_changes table & RLS policy
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'product_changes'
ORDER BY ordinal_position;

SELECT policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'product_changes';

-- 5) active_products view existence
SELECT table_name, view_definition FROM information_schema.views WHERE table_schema = 'public' AND table_name='active_products';

-- 6) products soft delete column
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'deleted_at';

-- 7) functions for safe delete
SELECT oid::regprocedure AS signature
FROM pg_proc
WHERE proname IN ('soft_delete_product', 'hard_delete_product', 'check_product_has_orders');

-- 8) Quick audit queries: recent revocations and product changes (use service role)
-- SELECT * FROM public.session_revocations ORDER BY revoked_at DESC LIMIT 10;
-- SELECT * FROM public.product_changes ORDER BY change_time DESC LIMIT 10;

-- NOTES:
-- * Run with a service-role connection (Supabase SQL editor or service-key) to see the results and avoid RLS blocking queries.
-- * If any checks fail, paste the specific output here and I will help interpret and suggest fixes.
