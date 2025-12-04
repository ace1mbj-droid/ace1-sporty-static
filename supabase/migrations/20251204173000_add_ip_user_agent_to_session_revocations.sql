-- Migration: add ip_address and user_agent columns and update revoke functions to log them

ALTER TABLE IF EXISTS public.session_revocations
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text;

-- Update revoke_session_by_token to accept and log ip/user_agent
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
DECLARE
  _deleted int := 0;
  _caller_role text := COALESCE(current_setting('jwt.claims.role', true), current_setting('role', true), current_user);
BEGIN
  IF _caller_role <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied: revoke_session_by_token requires service_role (caller=%).', _caller_role;
  END IF;

  -- log candidate sessions with ip & user agent
  INSERT INTO public.session_revocations(token, user_id, revoked_by, reason, ip_address, user_agent)
  SELECT s.token, s.user_id, COALESCE(p_revoked_by, current_setting('jwt.claims.sub', true), current_user), p_reason, p_ip, p_user_agent
  FROM public.sessions s
  WHERE s.token = t;

  DELETE FROM public.sessions WHERE token = t;
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  RETURN COALESCE(_deleted, 0);
END;
$$;

COMMENT ON FUNCTION public.revoke_session_by_token(text, text, text, text, text) IS 'Delete a session row by token; requires service_role and logs the revocation with optional ip/user_agent. Returns number deleted.';

-- Update revoke_sessions_for_email to accept and log ip/user_agent
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
  _caller_role text := COALESCE(current_setting('jwt.claims.role', true), current_setting('role', true), current_user);
BEGIN
  IF _caller_role <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied: revoke_sessions_for_email requires service_role (caller=%).', _caller_role;
  END IF;

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

COMMENT ON FUNCTION public.revoke_sessions_for_email(text, text, text, text, text) IS 'Delete all sessions for a public.users account by email; requires service_role and logs the revocations with optional ip & user agent. Returns number deleted.';
