-- Check wishlists table and RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'wishlists';

-- Check if wishlists table exists and its structure
\d public.wishlists

-- Check all tables with RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;