-- Fix Function Search Path Mutable warnings
-- Set immutable search_path for security OR remove unused functions
-- Run this in Supabase SQL Editor

-- 1. Fix cleanup_expired_sessions function (COMPLETED ✅)
-- ALTER FUNCTION public.cleanup_expired_sessions()
-- SET search_path = public;

-- 2. Remove placeholder function_name (appears to be a test function)
DROP FUNCTION IF EXISTS public.function_name();

-- If function_name is actually used, fix it instead with:
-- ALTER FUNCTION public.function_name()
-- SET search_path = public;

-- Note: The search_path = public setting makes the function behavior predictable
-- and prevents SQL injection via search_path manipulation
