-- Fix Supabase Security Linter Errors
-- 1. Fix SECURITY DEFINER view
-- 2. Enable RLS on site_settings table
-- 3. Enable RLS on users table (custom user profiles)
-- 4. Enable RLS on security_logs table

-- ============================================================================
-- ISSUE 1: Fix active_products view (remove SECURITY DEFINER)
-- ============================================================================

-- Drop and recreate view WITHOUT security definer
DROP VIEW IF EXISTS active_products;

-- Create view with SECURITY INVOKER (default - uses querying user's permissions)
CREATE VIEW active_products 
WITH (security_invoker = true) AS
SELECT * FROM products
WHERE deleted_at IS NULL AND is_active = true;

-- Grant permissions
GRANT SELECT ON active_products TO anon, authenticated;

-- ============================================================================
-- ISSUE 2: Create and secure users table (custom user profiles)
-- ============================================================================

-- Create users table if it doesn't exist (for custom user profiles, not auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    phone TEXT,
    address JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on users table
DO $$ 
BEGIN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'RLS already enabled on users';
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;

-- Users can view their own profile
CREATE POLICY "users_select_own"
ON public.users FOR SELECT
USING (auth_user_id = (SELECT auth.uid()));

-- Users can insert their own profile
CREATE POLICY "users_insert_own"
ON public.users FOR INSERT
WITH CHECK (auth_user_id = (SELECT auth.uid()));

-- Users can update their own profile
CREATE POLICY "users_update_own"
ON public.users FOR UPDATE
USING (auth_user_id = (SELECT auth.uid()));

-- Admins can view all users
CREATE POLICY "users_select_admin"
ON public.users FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = (SELECT auth.uid()) AND ur.is_admin = true
    )
);

-- ============================================================================
-- ISSUE 3: Create and secure site_settings table
-- ============================================================================

-- Create site_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_title TEXT,
    site_description TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    instagram_url TEXT,
    maintenance_mode BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on site_settings table
DO $$ 
BEGIN
    ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'RLS already enabled on site_settings';
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "site_settings_select_all" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_update_admin" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_insert_admin" ON public.site_settings;

-- Everyone can read site settings
CREATE POLICY "site_settings_select_all"
ON public.site_settings FOR SELECT
USING (true);

-- Only admins can update site settings
CREATE POLICY "site_settings_update_admin"
ON public.site_settings FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = (SELECT auth.uid()) AND ur.is_admin = true
    )
);

-- Only admins can insert site settings
CREATE POLICY "site_settings_insert_admin"
ON public.site_settings FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = (SELECT auth.uid()) AND ur.is_admin = true
    )
);

-- ============================================================================
-- ISSUE 4: Create and secure security_logs table
-- ============================================================================

-- Create security_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event TEXT NOT NULL,
    details JSONB,
    user_agent TEXT,
    ip_address TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on timestamp for faster queries
CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp 
ON public.security_logs(timestamp DESC);

-- Enable RLS on security_logs table
DO $$ 
BEGIN
    ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'RLS already enabled on security_logs';
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "security_logs_select_admin" ON public.security_logs;
DROP POLICY IF EXISTS "security_logs_insert_all" ON public.security_logs;
DROP POLICY IF EXISTS "security_logs_delete_admin" ON public.security_logs;

-- Only admins can view security logs
CREATE POLICY "security_logs_select_admin"
ON public.security_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = (SELECT auth.uid()) AND ur.is_admin = true
    )
);

-- Anyone can insert security logs (for security event tracking)
CREATE POLICY "security_logs_insert_all"
ON public.security_logs FOR INSERT
WITH CHECK (true);

-- Only admins can delete old logs
CREATE POLICY "security_logs_delete_admin"
ON public.security_logs FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = (SELECT auth.uid()) AND ur.is_admin = true
    )
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify active_products view doesn't use SECURITY DEFINER
-- SELECT 
--     schemaname, 
--     viewname,
--     definition
-- FROM pg_views
-- WHERE viewname = 'active_products';

-- Check RLS is enabled on all tables
-- SELECT 
--     schemaname, 
--     tablename, 
--     rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('users', 'site_settings', 'security_logs')
-- ORDER BY tablename;

-- Check policies exist
-- SELECT 
--     schemaname,
--     tablename,
--     policyname,
--     permissive,
--     roles,
--     cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('users', 'site_settings', 'security_logs')
-- ORDER BY tablename, policyname;
