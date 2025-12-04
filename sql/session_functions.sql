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
  -- attempt server-side IP capture if p_ip omitted
  DECLARE
    _headers jsonb := NULL;
    _resolved_ip text := NULL;
  BEGIN
    IF p_ip IS NULL THEN
      BEGIN
        _headers := current_setting('request.headers', true)::jsonb;
      EXCEPTION WHEN OTHERS THEN
        _headers := NULL;
      END;

      _resolved_ip := COALESCE(
        NULLIF(trim(split_part(COALESCE(_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
        NULLIF(trim(_headers ->> 'x-real-ip'), ''),
        current_setting('request.header.x-real-ip', true),
        (CASE WHEN inet_client_addr() IS NOT NULL THEN inet_client_addr()::text ELSE NULL END)
      );
    ELSE
      _resolved_ip := p_ip;
    END IF;
  END;

  -- log candidate sessions
  INSERT INTO public.session_revocations(token, user_id, revoked_by, reason, ip_address, user_agent)
  SELECT s.token, s.user_id, COALESCE(p_revoked_by, current_setting('jwt.claims.sub', true), current_user), p_reason, _resolved_ip, p_user_agent
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

  -- resolve client IP when p_ip is not passed
  DECLARE
    _headers jsonb := NULL;
    _resolved_ip text := NULL;
  BEGIN
    IF p_ip IS NULL THEN
      BEGIN
        _headers := current_setting('request.headers', true)::jsonb;
      EXCEPTION WHEN OTHERS THEN
        _headers := NULL;
      END;

      _resolved_ip := COALESCE(
        NULLIF(trim(split_part(COALESCE(_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
        NULLIF(trim(_headers ->> 'x-real-ip'), ''),
        current_setting('request.header.x-real-ip', true),
        (CASE WHEN inet_client_addr() IS NOT NULL THEN inet_client_addr()::text ELSE NULL END)
      );
    ELSE
      _resolved_ip := p_ip;
    END IF;
  END;

  INSERT INTO public.session_revocations(token, user_id, revoked_by, reason, ip_address, user_agent)
  SELECT s.token, s.user_id, COALESCE(p_revoked_by, current_setting('jwt.claims.sub', true), current_user), p_reason, _resolved_ip, p_user_agent
  FROM public.sessions s
  WHERE s.user_id = uid;

  DELETE FROM public.sessions WHERE user_id = uid;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN COALESCE(deleted_count, 0);
END;
$$;

COMMENT ON FUNCTION public.revoke_sessions_for_email(text) IS 'Delete all sessions for a public.users account identified by email; returns number of rows deleted.';

-- Make sure execution of revoke RPCs is restricted in local env too (deny public/anon/authenticated)
REVOKE EXECUTE ON FUNCTION public.revoke_session_by_token(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_session_by_token(text, text, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_session_by_token(text, text, text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.revoke_sessions_for_email(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_sessions_for_email(text, text, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_sessions_for_email(text, text, text, text, text) TO service_role;

-- Note: SECURITY DEFINER functions should be executed carefully. These functions do not change any passwords.
