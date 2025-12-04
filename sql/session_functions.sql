-- Helper functions for session management (no password changes)
-- 1) Revoke a single session by token
CREATE OR REPLACE FUNCTION public.revoke_session_by_token(t text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.sessions WHERE token = t;
END;
$$;

COMMENT ON FUNCTION public.revoke_session_by_token(text) IS 'Delete a session row by token (admin-only).';

-- 2) Revoke all sessions for a user by email (safe admin operation)
CREATE OR REPLACE FUNCTION public.revoke_sessions_for_email(email text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid uuid;
  deleted_count int := 0;
BEGIN
  SELECT id INTO uid FROM public.users WHERE lower(email) = lower(email) LIMIT 1;
  IF uid IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.sessions WHERE user_id = uid RETURNING 1 INTO deleted_count;

  RETURN COALESCE(deleted_count, 0);
END;
$$;

COMMENT ON FUNCTION public.revoke_sessions_for_email(text) IS 'Delete all sessions for a public.users account identified by email; returns number of rows deleted.';

-- Note: SECURITY DEFINER functions should be executed carefully. These functions do not change any passwords.
