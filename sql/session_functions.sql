-- Helper functions for session management (no password changes)
-- 1) Revoke a single session by token
CREATE OR REPLACE FUNCTION public.revoke_session_by_token(
  t text,
  p_revoked_by text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- log candidate sessions
  INSERT INTO public.session_revocations(token, user_id, revoked_by, reason, ip_address, user_agent)
  SELECT s.token, s.user_id, COALESCE(p_revoked_by, current_setting('jwt.claims.sub', true), current_user), p_reason, p_ip, p_user_agent
  FROM public.sessions s
  WHERE s.token = t;

  DELETE FROM public.sessions WHERE token = t;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN COALESCE(deleted_count, 0);
END;
$$;

COMMENT ON FUNCTION public.revoke_session_by_token(text, text, text, text, text) IS 'Delete a session row by token; requires service_role and logs revocation with optional ip/user_agent. Returns number removed.';
$$;

COMMENT ON FUNCTION public.revoke_session_by_token(text) IS 'Delete a session row by token (admin-only).';

-- 2) Revoke all sessions for a user by email (safe admin operation)
CREATE OR REPLACE FUNCTION public.revoke_sessions_for_email(
  p_email text,
  p_revoked_by text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid uuid;
  deleted_count int := 0;
BEGIN
  -- use the parameter p_email to avoid ambiguity with table column names
  SELECT id INTO uid FROM public.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF uid IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.session_revocations(token, user_id, revoked_by, reason, ip_address, user_agent)
  SELECT s.token, s.user_id, COALESCE(p_revoked_by, current_setting('jwt.claims.sub', true), current_user), p_reason, p_ip, p_user_agent
  FROM public.sessions s
  WHERE s.user_id = uid;

  DELETE FROM public.sessions WHERE user_id = uid;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN COALESCE(deleted_count, 0);
END;
$$;

COMMENT ON FUNCTION public.revoke_sessions_for_email(text) IS 'Delete all sessions for a public.users account identified by email; returns number of rows deleted.';

-- Note: SECURITY DEFINER functions should be executed carefully. These functions do not change any passwords.
