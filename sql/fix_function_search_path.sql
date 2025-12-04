-- Fix Function Search Path Mutable warnings
-- Set immutable search_path for security
-- Run this in Supabase SQL Editor

-- 1. Fix cleanup_expired_sessions function
ALTER FUNCTION public.cleanup_expired_sessions()
SET search_path = public;

-- 2. Fix function_name function (if it exists)
-- ALTER FUNCTION public.function_name()
-- SET search_path = public;

-- Note: The search_path = public setting makes the function behavior predictable
-- and prevents SQL injection via search_path manipulation
