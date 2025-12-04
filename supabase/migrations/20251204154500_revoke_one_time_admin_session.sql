-- Recorded migration: revoke the one-time admin session token
-- This migration is idempotent and safe: it deletes the temporary token if present.

DELETE FROM public.sessions WHERE token = 'token_admin_mK2q7MVg7CwWYNF7Uu2izpzR';

-- Returns 0 when no matching token remains
SELECT count(*) AS remaining FROM public.sessions WHERE token = 'token_admin_mK2q7MVg7CwWYNF7Uu2izpzR';
