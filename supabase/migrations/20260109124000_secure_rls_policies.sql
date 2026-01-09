-- Migration: Tighten permissive RLS policies flagged by the security linter
-- Fixes for: csrf_tokens, order_items, page_views, payments, security_logs, sessions, site_settings

-- ==========================================================================
-- CSRF TOKENS: restrict insert to authenticated users and verify session ownership
-- ==========================================================================
DROP POLICY IF EXISTS insert_csrf_tokens ON public.csrf_tokens;
CREATE POLICY insert_csrf_tokens
  ON public.csrf_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    -- allow inserts only for authenticated sessions that match the session_id OR service role
    (session_id IS NOT NULL AND session_id::uuid IN (SELECT id FROM public.sessions WHERE user_id = (select auth.uid())))
  );

-- ==========================================================================
-- ORDER ITEMS: ensure inserted items belong to an order owned by the current user
-- ==========================================================================
DROP POLICY IF EXISTS order_items_insert_authenticated ON public.order_items;
CREATE POLICY order_items_insert_authenticated
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = (select auth.uid())
    )
  );

-- ==========================================================================
-- PAGE VIEWS: allow anonymous page views (user_id IS NULL) or authenticated inserts owned by the user
-- ==========================================================================
DROP POLICY IF EXISTS page_views_insert ON public.page_views;
CREATE POLICY page_views_insert
  ON public.page_views FOR INSERT
  TO public
  WITH CHECK (
    (user_id IS NULL) OR (user_id = (select auth.uid()))
  );

-- ==========================================================================
-- PAYMENTS: restrict payment creation to supabase_auth_admin (server-side / backend only)
-- ==========================================================================
DROP POLICY IF EXISTS payments_insert_system ON public.payments;
CREATE POLICY payments_insert_system
  ON public.payments FOR INSERT
  TO supabase_auth_admin
  WITH CHECK (true);

-- ==========================================================================
-- SECURITY LOGS: don't allow public deletes or anonymous inserts
-- ==========================================================================
DROP POLICY IF EXISTS security_logs_delete_all ON public.security_logs;
CREATE POLICY security_logs_delete_all
  ON public.security_logs FOR DELETE
  TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS security_logs_insert_all ON public.security_logs;
CREATE POLICY security_logs_insert_all
  ON public.security_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    -- allow inserts that are for the authenticated user or inserts performed by an admin helper
    (user_id IS NULL) OR (user_id = (select auth.uid())) OR security.is_admin()
  );

-- ==========================================================================
-- SESSIONS: restrict session inserts so they must be tied to the creating user or validated by token
-- ==========================================================================
DROP POLICY IF EXISTS sessions_insert_public ON public.sessions;
CREATE POLICY sessions_insert_public
  ON public.sessions FOR INSERT
  TO public
  WITH CHECK (
    -- allow if server-issued token matches OR user creates a session for themselves
    ((public.ace1_session_token() IS NOT NULL AND token = public.ace1_session_token()))
    OR (user_id = (select auth.uid()))
  );

-- ==========================================================================
-- SITE SETTINGS: restrict create/update to admin users only
-- ==========================================================================
DROP POLICY IF EXISTS site_settings_update_all ON public.site_settings;
CREATE POLICY site_settings_update_all
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (
    public.ace1_is_admin_session() OR (
      EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
      )
    )
  );

DROP POLICY IF EXISTS site_settings_insert_all ON public.site_settings;
CREATE POLICY site_settings_insert_all
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.ace1_is_admin_session() OR (
      EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
      )
    )
  );

-- ==========================================================================
-- Sanity: ensure RLS is enabled on affected tables
-- ==========================================================================
DO $$
BEGIN
  ALTER TABLE public.csrf_tokens ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS may already be enabled on csrf_tokens';
END$$;

DO $$
BEGIN
  ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS may already be enabled on order_items';
END$$;

DO $$
BEGIN
  ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS may already be enabled on page_views';
END$$;

DO $$
BEGIN
  ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS may already be enabled on payments';
END$$;

DO $$
BEGIN
  ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS may already be enabled on security_logs';
END$$;

DO $$
BEGIN
  ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS may already be enabled on sessions';
END$$;

DO $$
BEGIN
  ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS may already be enabled on site_settings';
END$$;

COMMENT ON POLICY insert_csrf_tokens ON public.csrf_tokens IS 'Restrict CSRF token inserts to authenticated sessions (session_id must belong to creating user)';
COMMENT ON POLICY order_items_insert_authenticated ON public.order_items IS 'Only allow inserting items on orders that belong to the authenticated user';
COMMENT ON POLICY page_views_insert ON public.page_views IS 'Allow anonymous page views (user_id NULL) or authenticated user inserts for their own user_id';
COMMENT ON POLICY payments_insert_system ON public.payments IS 'Only the supabase_auth_admin role (server) may insert payments';
COMMENT ON POLICY security_logs_insert_all ON public.security_logs IS 'Authenticated users may create their own security logs; deletion restricted to admin';
COMMENT ON POLICY sessions_insert_public ON public.sessions IS 'Session insert must be validated by server token or be created by the owning user';
COMMENT ON POLICY site_settings_update_all ON public.site_settings IS 'Site settings can be modified only by admin users';
COMMENT ON POLICY site_settings_insert_all ON public.site_settings IS 'Site settings can be created only by admin users';
