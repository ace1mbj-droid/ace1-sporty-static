-- Refactor products table RLS to use security.is_admin()
-- Keep existing public SELECT policies intact

-- Drop existing admin-oriented policies if present
DROP POLICY IF EXISTS "products_select_admin" ON products;
DROP POLICY IF EXISTS "products_insert_admin" ON products;
DROP POLICY IF EXISTS "products_update_admin" ON products;
DROP POLICY IF EXISTS "products_delete_admin" ON products;
-- Recreate admin policies using the centralized helper
CREATE POLICY "products_select_admin"
ON products FOR SELECT
USING (security.is_admin());
CREATE POLICY "products_insert_admin"
ON products FOR INSERT
WITH CHECK (security.is_admin());
CREATE POLICY "products_update_admin"
ON products FOR UPDATE
USING (security.is_admin())
WITH CHECK (security.is_admin());
CREATE POLICY "products_delete_admin"
ON products FOR DELETE
USING (security.is_admin());
