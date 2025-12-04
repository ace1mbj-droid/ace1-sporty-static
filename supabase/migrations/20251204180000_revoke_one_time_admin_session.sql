-- Migration: revoke one-time admin session token
-- This migration deletes the temporary admin session token that was used for testing.
-- Idempotent: safe to run multiple times.

BEGIN;

-- Delete by token string (idempotent)
DELETE FROM public.sessions
WHERE token = 'token_admin_mK2q7MVg7CwWYNF7Uu2izpzR';

COMMIT;

-- Verify manually with:
-- SELECT count(*) FROM public.sessions WHERE token = 'token_admin_mK2q7MVg7CwWYNF7Uu2izpzR';
