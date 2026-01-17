-- Migration: revoke the one-time admin session token
-- This file deletes the temporary admin token the user requested removed.
-- Safe & idempotent: uses the helper function if present, and falls back to a direct DELETE.

-- One-time token created earlier by the assistant during testing
-- Replace this value if the token differs.
\n-- Try the helper function first (will succeed if function exists and return int count)
SELECT COALESCE(revoke_session_by_token('token_admin_mK2q7MVg7CwWYNF7Uu2izpzR'), 0) AS revoked_count;

-- As a fallback, directly delete any sessions with that token (idempotent)
DELETE FROM public.sessions WHERE token = 'token_admin_mK2q7MVg7CwWYNF7Uu2izpzR';

-- Verify the token is gone (returns 0 rows if successful)
SELECT * FROM public.sessions WHERE token = 'token_admin_mK2q7MVg7CwWYNF7Uu2izpzR';
