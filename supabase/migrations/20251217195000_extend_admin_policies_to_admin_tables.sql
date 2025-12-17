-- Extend admin policies to admin-only tables using security.is_admin()

-- site_settings: admin modify (leave any existing public read policy as-is)
DROP POLICY IF EXISTS "site_settings_update_admin" ON site_settings;
DROP POLICY IF EXISTS "site_settings_insert_admin" ON site_settings;
DROP POLICY IF EXISTS "site_settings_delete_admin" ON site_settings;
CREATE POLICY "site_settings_update_admin" ON site_settings FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin());
CREATE POLICY "site_settings_insert_admin" ON site_settings FOR INSERT WITH CHECK (security.is_admin());
CREATE POLICY "site_settings_delete_admin" ON site_settings FOR DELETE USING (security.is_admin());

-- security_logs: admin-only
DROP POLICY IF EXISTS "security_logs_select_admin" ON security_logs;
DROP POLICY IF EXISTS "security_logs_insert_admin" ON security_logs;
DROP POLICY IF EXISTS "security_logs_update_admin" ON security_logs;
DROP POLICY IF EXISTS "security_logs_delete_admin" ON security_logs;
CREATE POLICY "security_logs_select_admin" ON security_logs FOR SELECT USING (security.is_admin());
CREATE POLICY "security_logs_insert_admin" ON security_logs FOR INSERT WITH CHECK (security.is_admin());
CREATE POLICY "security_logs_update_admin" ON security_logs FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin());
CREATE POLICY "security_logs_delete_admin" ON security_logs FOR DELETE USING (security.is_admin());

-- product_deletion_audit: admin
DROP POLICY IF EXISTS "product_deletion_audit_select_admin" ON product_deletion_audit;
DROP POLICY IF EXISTS "product_deletion_audit_insert_admin" ON product_deletion_audit;
CREATE POLICY "product_deletion_audit_select_admin" ON product_deletion_audit FOR SELECT USING (security.is_admin());
CREATE POLICY "product_deletion_audit_insert_admin" ON product_deletion_audit FOR INSERT WITH CHECK (security.is_admin());

-- product_changes: admin
DROP POLICY IF EXISTS "product_changes_select_admin" ON product_changes;
DROP POLICY IF EXISTS "product_changes_insert_admin" ON product_changes;
CREATE POLICY "product_changes_select_admin" ON product_changes FOR SELECT USING (security.is_admin());
CREATE POLICY "product_changes_insert_admin" ON product_changes FOR INSERT WITH CHECK (security.is_admin());

-- session_revocations: admin
DROP POLICY IF EXISTS "session_revocations_select_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_insert_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_update_admin" ON session_revocations;
DROP POLICY IF EXISTS "session_revocations_delete_admin" ON session_revocations;
CREATE POLICY "session_revocations_select_admin" ON session_revocations FOR SELECT USING (security.is_admin());
CREATE POLICY "session_revocations_insert_admin" ON session_revocations FOR INSERT WITH CHECK (security.is_admin());
CREATE POLICY "session_revocations_update_admin" ON session_revocations FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin());
CREATE POLICY "session_revocations_delete_admin" ON session_revocations FOR DELETE USING (security.is_admin());

-- sessions: admin read/update/delete (optional)
DROP POLICY IF EXISTS "sessions_select_admin" ON sessions;
DROP POLICY IF EXISTS "sessions_update_admin" ON sessions;
DROP POLICY IF EXISTS "sessions_delete_admin" ON sessions;
CREATE POLICY "sessions_select_admin" ON sessions FOR SELECT USING (security.is_admin());
CREATE POLICY "sessions_update_admin" ON sessions FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin());
CREATE POLICY "sessions_delete_admin" ON sessions FOR DELETE USING (security.is_admin());
