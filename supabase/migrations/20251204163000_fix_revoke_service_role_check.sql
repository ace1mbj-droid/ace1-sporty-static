-- Migration: adjust role checks so service_role callers are allowed

-- Recreate revoke_session_by_token to tolerate different session role settings
CREATE OR REPLACE FUNCTION public.revoke_session_by_token(
  t text,
  p_revoked_by text DEFAULT NULL,
  p_reason text DEFAULT NULL
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

  INSERT INTO public.session_revocations(token, user_id, revoked_by, reason)
  SELECT s.token, s.user_id, COALESCE(p_revoked_by, current_setting('jwt.claims.sub', true), current_user), p_reason
  FROM public.sessions s
  WHERE s.token = t
  RETURNING 1 INTO _deleted;

  DELETE FROM public.sessions WHERE token = t;

  RETURN COALESCE(_deleted, 0);
END;
$$;

COMMENT ON FUNCTION public.revoke_session_by_token(text, text, text) IS 'Delete a session row by token; requires service_role and logs the revocation. Returns 1 when a row was logged/deleted or 0 otherwise.';

-- Recreate revoke_sessions_for_email with the same caller check
CREATE OR REPLACE FUNCTION public.revoke_sessions_for_email(
  p_email text,
  p_revoked_by text DEFAULT NULL,
  p_reason text DEFAULT NULL
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

  INSERT INTO public.session_revocations(token, user_id, revoked_by, reason)
  SELECT s.token, s.user_id, COALESCE(p_revoked_by, current_setting('jwt.claims.sub', true), current_user), p_reason
  FROM public.sessions s
  WHERE s.user_id = uid;

  DELETE FROM public.sessions WHERE user_id = uid RETURNING 1 INTO deleted_count;

  RETURN COALESCE(deleted_count, 0);
END;
$$;

COMMENT ON FUNCTION public.revoke_sessions_for_email(text, text, text) IS 'Delete all sessions for a public.users account by email; requires service_role and logs the revocations. Returns number of rows deleted.';
