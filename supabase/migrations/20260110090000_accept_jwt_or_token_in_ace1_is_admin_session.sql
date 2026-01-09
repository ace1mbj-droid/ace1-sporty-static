-- Migration: Allow admin session check to match either session token OR JWT token
-- This makes admin header-based auth work when callers set Authorization: Bearer <jwt>

CREATE OR REPLACE FUNCTION public.ace1_is_admin_session()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    session_token text;
    admin_email text;
BEGIN
    session_token := public.ace1_session_token();
    IF session_token IS NULL THEN
        RETURN false;
    END IF;

    SELECT u.email
    INTO admin_email
    FROM public.sessions s
    JOIN public.users u ON u.id = s.user_id
    WHERE (s.token = session_token OR s.jwt_token = session_token)
      AND s.expires_at > now()
    LIMIT 1;

    RETURN admin_email IS NOT NULL AND lower(admin_email) = 'hello@ace1.in';
END;
$$;

COMMENT ON FUNCTION public.ace1_is_admin_session() IS 'Verifies ace1-session or Authorization header maps to a non-expired session owned by hello@ace1.in (checks either s.token or s.jwt_token).';

GRANT EXECUTE ON FUNCTION public.ace1_is_admin_session() TO anon, authenticated, service_role;