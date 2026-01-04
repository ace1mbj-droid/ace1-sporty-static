-- Drop ALL conflicting/redundant policies
DROP POLICY IF EXISTS "public_select_products" ON products;
DROP POLICY IF EXISTS "products_select_active" ON products;
DROP POLICY IF EXISTS "products_select_admin" ON products;
DROP POLICY IF EXISTS "anon_select_active_products" ON products;
DROP POLICY IF EXISTS "auth_select_active_products" ON products;
DROP POLICY IF EXISTS "products_insert_admin" ON products;
DROP POLICY IF EXISTS "products_update_admin" ON products;
DROP POLICY IF EXISTS "products_delete_admin" ON products;
DROP POLICY IF EXISTS "admin_insert_products" ON products;
DROP POLICY IF EXISTS "admin_update_products" ON products;
DROP POLICY IF EXISTS "admin_delete_products" ON products;

-- Create clean, non-conflicting policies

-- 1. Anonymous users: only active, non-deleted products
CREATE POLICY "anon_view_active_products" ON products
FOR SELECT TO anon
USING (is_active = true AND deleted_at IS NULL);

-- 2. Authenticated users: admins see all, others see only active non-deleted
CREATE POLICY "auth_view_products" ON products
FOR SELECT TO authenticated
USING (
    CASE 
        WHEN (auth.jwt() ->> 'user_role') = 'admin' THEN true
        ELSE (is_active = true AND deleted_at IS NULL)
    END
);

-- 3. Admin INSERT
CREATE POLICY "admin_insert_products" ON products
FOR INSERT TO authenticated
WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

-- 4. Admin UPDATE
CREATE POLICY "admin_update_products" ON products
FOR UPDATE TO authenticated
USING ((auth.jwt() ->> 'user_role') = 'admin')
WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

-- 5. Admin DELETE
CREATE POLICY "admin_delete_products" ON products
FOR DELETE TO authenticated
USING ((auth.jwt() ->> 'user_role') = 'admin');;
