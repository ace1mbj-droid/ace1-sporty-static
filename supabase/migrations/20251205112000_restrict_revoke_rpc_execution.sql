-- Migration: restrict revoke RPC execution to service_role only

-- Revoke EXECUTE from public/anonymous/authenticated roles for known overloads
REVOKE EXECUTE ON FUNCTION public.revoke_session_by_token(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_session_by_token(text, text, text, text, text) FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.revoke_sessions_for_email(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_sessions_for_email(text, text, text, text, text) FROM public, anon, authenticated;

-- Grant EXECUTE only to the service_role
GRANT EXECUTE ON FUNCTION public.revoke_session_by_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_session_by_token(text, text, text, text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.revoke_sessions_for_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_sessions_for_email(text, text, text, text, text) TO service_role;

-- Ensure other accidental default privileges are cleared
REVOKE ALL ON FUNCTION public.revoke_session_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_session_by_token(text, text, text, text, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.revoke_sessions_for_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_sessions_for_email(text, text, text, text, text) FROM PUBLIC;
