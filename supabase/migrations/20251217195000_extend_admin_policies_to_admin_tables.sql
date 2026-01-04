-- Extend admin policies to admin-only tables using security.is_admin()

DO $$
BEGIN
	-- site_settings: admin modify (leave any existing public read policy as-is)
	IF to_regclass('public.site_settings') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "site_settings_update_admin" ON public.site_settings';
		EXECUTE 'DROP POLICY IF EXISTS "site_settings_insert_admin" ON public.site_settings';
		EXECUTE 'DROP POLICY IF EXISTS "site_settings_delete_admin" ON public.site_settings';
		EXECUTE 'CREATE POLICY "site_settings_update_admin" ON public.site_settings FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin())';
		EXECUTE 'CREATE POLICY "site_settings_insert_admin" ON public.site_settings FOR INSERT WITH CHECK (security.is_admin())';
		EXECUTE 'CREATE POLICY "site_settings_delete_admin" ON public.site_settings FOR DELETE USING (security.is_admin())';
	END IF;

	-- security_logs: admin-only
	IF to_regclass('public.security_logs') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "security_logs_select_admin" ON public.security_logs';
		EXECUTE 'DROP POLICY IF EXISTS "security_logs_insert_admin" ON public.security_logs';
		EXECUTE 'DROP POLICY IF EXISTS "security_logs_update_admin" ON public.security_logs';
		EXECUTE 'DROP POLICY IF EXISTS "security_logs_delete_admin" ON public.security_logs';
		EXECUTE 'CREATE POLICY "security_logs_select_admin" ON public.security_logs FOR SELECT USING (security.is_admin())';
		EXECUTE 'CREATE POLICY "security_logs_insert_admin" ON public.security_logs FOR INSERT WITH CHECK (security.is_admin())';
		EXECUTE 'CREATE POLICY "security_logs_update_admin" ON public.security_logs FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin())';
		EXECUTE 'CREATE POLICY "security_logs_delete_admin" ON public.security_logs FOR DELETE USING (security.is_admin())';
	END IF;

	-- product_deletion_audit: admin
	IF to_regclass('public.product_deletion_audit') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "product_deletion_audit_select_admin" ON public.product_deletion_audit';
		EXECUTE 'DROP POLICY IF EXISTS "product_deletion_audit_insert_admin" ON public.product_deletion_audit';
		EXECUTE 'CREATE POLICY "product_deletion_audit_select_admin" ON public.product_deletion_audit FOR SELECT USING (security.is_admin())';
		EXECUTE 'CREATE POLICY "product_deletion_audit_insert_admin" ON public.product_deletion_audit FOR INSERT WITH CHECK (security.is_admin())';
	END IF;

	-- product_changes: admin
	IF to_regclass('public.product_changes') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "product_changes_select_admin" ON public.product_changes';
		EXECUTE 'DROP POLICY IF EXISTS "product_changes_insert_admin" ON public.product_changes';
		EXECUTE 'CREATE POLICY "product_changes_select_admin" ON public.product_changes FOR SELECT USING (security.is_admin())';
		EXECUTE 'CREATE POLICY "product_changes_insert_admin" ON public.product_changes FOR INSERT WITH CHECK (security.is_admin())';
	END IF;

	-- session_revocations: admin
	IF to_regclass('public.session_revocations') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "session_revocations_select_admin" ON public.session_revocations';
		EXECUTE 'DROP POLICY IF EXISTS "session_revocations_insert_admin" ON public.session_revocations';
		EXECUTE 'DROP POLICY IF EXISTS "session_revocations_update_admin" ON public.session_revocations';
		EXECUTE 'DROP POLICY IF EXISTS "session_revocations_delete_admin" ON public.session_revocations';
		EXECUTE 'CREATE POLICY "session_revocations_select_admin" ON public.session_revocations FOR SELECT USING (security.is_admin())';
		EXECUTE 'CREATE POLICY "session_revocations_insert_admin" ON public.session_revocations FOR INSERT WITH CHECK (security.is_admin())';
		EXECUTE 'CREATE POLICY "session_revocations_update_admin" ON public.session_revocations FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin())';
		EXECUTE 'CREATE POLICY "session_revocations_delete_admin" ON public.session_revocations FOR DELETE USING (security.is_admin())';
	END IF;

	-- sessions: admin read/update/delete (optional)
	IF to_regclass('public.sessions') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "sessions_select_admin" ON public.sessions';
		EXECUTE 'DROP POLICY IF EXISTS "sessions_update_admin" ON public.sessions';
		EXECUTE 'DROP POLICY IF EXISTS "sessions_delete_admin" ON public.sessions';
		EXECUTE 'CREATE POLICY "sessions_select_admin" ON public.sessions FOR SELECT USING (security.is_admin())';
		EXECUTE 'CREATE POLICY "sessions_update_admin" ON public.sessions FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin())';
		EXECUTE 'CREATE POLICY "sessions_delete_admin" ON public.sessions FOR DELETE USING (security.is_admin())';
	END IF;
END $$;
