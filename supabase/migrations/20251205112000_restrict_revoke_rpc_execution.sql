-- Migration: restrict revoke RPC execution to service_role only

-- Revoke EXECUTE from public/anonymous/authenticated roles for known overloads
DO $$
BEGIN
	IF to_regprocedure('public.revoke_session_by_token(text)') IS NOT NULL THEN
		EXECUTE 'REVOKE EXECUTE ON FUNCTION public.revoke_session_by_token(text) FROM public, anon, authenticated';
		EXECUTE 'GRANT EXECUTE ON FUNCTION public.revoke_session_by_token(text) TO service_role';
		EXECUTE 'REVOKE ALL ON FUNCTION public.revoke_session_by_token(text) FROM PUBLIC';
	END IF;

	IF to_regprocedure('public.revoke_session_by_token(text,text,text,text,text)') IS NOT NULL THEN
		EXECUTE 'REVOKE EXECUTE ON FUNCTION public.revoke_session_by_token(text, text, text, text, text) FROM public, anon, authenticated';
		EXECUTE 'GRANT EXECUTE ON FUNCTION public.revoke_session_by_token(text, text, text, text, text) TO service_role';
		EXECUTE 'REVOKE ALL ON FUNCTION public.revoke_session_by_token(text, text, text, text, text) FROM PUBLIC';
	END IF;

	IF to_regprocedure('public.revoke_sessions_for_email(text)') IS NOT NULL THEN
		EXECUTE 'REVOKE EXECUTE ON FUNCTION public.revoke_sessions_for_email(text) FROM public, anon, authenticated';
		EXECUTE 'GRANT EXECUTE ON FUNCTION public.revoke_sessions_for_email(text) TO service_role';
		EXECUTE 'REVOKE ALL ON FUNCTION public.revoke_sessions_for_email(text) FROM PUBLIC';
	END IF;

	IF to_regprocedure('public.revoke_sessions_for_email(text,text,text,text,text)') IS NOT NULL THEN
		EXECUTE 'REVOKE EXECUTE ON FUNCTION public.revoke_sessions_for_email(text, text, text, text, text) FROM public, anon, authenticated';
		EXECUTE 'GRANT EXECUTE ON FUNCTION public.revoke_sessions_for_email(text, text, text, text, text) TO service_role';
		EXECUTE 'REVOKE ALL ON FUNCTION public.revoke_sessions_for_email(text, text, text, text, text) FROM PUBLIC';
	END IF;
END $$;
