-- Refactor multiple tables to use security.is_admin() for admin actions

-- product_images
DROP POLICY IF EXISTS "product_images_select_admin" ON product_images;
DROP POLICY IF EXISTS "product_images_insert_admin" ON product_images;
DROP POLICY IF EXISTS "product_images_update_admin" ON product_images;
DROP POLICY IF EXISTS "product_images_delete_admin" ON product_images;
CREATE POLICY "product_images_select_admin" ON product_images FOR SELECT USING (security.is_admin());
CREATE POLICY "product_images_insert_admin" ON product_images FOR INSERT WITH CHECK (security.is_admin());
CREATE POLICY "product_images_update_admin" ON product_images FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin());
CREATE POLICY "product_images_delete_admin" ON product_images FOR DELETE USING (security.is_admin());
-- inventory
DROP POLICY IF EXISTS "inventory_select_admin" ON inventory;
DROP POLICY IF EXISTS "inventory_insert_admin" ON inventory;
DROP POLICY IF EXISTS "inventory_update_admin" ON inventory;
DROP POLICY IF EXISTS "inventory_delete_admin" ON inventory;
CREATE POLICY "inventory_select_admin" ON inventory FOR SELECT USING (security.is_admin());
CREATE POLICY "inventory_insert_admin" ON inventory FOR INSERT WITH CHECK (security.is_admin());
CREATE POLICY "inventory_update_admin" ON inventory FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin());
CREATE POLICY "inventory_delete_admin" ON inventory FOR DELETE USING (security.is_admin());
-- orders
DROP POLICY IF EXISTS "orders_select_admin" ON orders;
DROP POLICY IF EXISTS "orders_update_admin" ON orders;
DROP POLICY IF EXISTS "orders_delete_admin" ON orders;
CREATE POLICY "orders_select_admin" ON orders FOR SELECT USING (security.is_admin());
CREATE POLICY "orders_update_admin" ON orders FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin());
CREATE POLICY "orders_delete_admin" ON orders FOR DELETE USING (security.is_admin());
-- order_items
DROP POLICY IF EXISTS "order_items_select_admin" ON order_items;
DROP POLICY IF EXISTS "order_items_update_admin" ON order_items;
DROP POLICY IF EXISTS "order_items_delete_admin" ON order_items;
CREATE POLICY "order_items_select_admin" ON order_items FOR SELECT USING (security.is_admin());
CREATE POLICY "order_items_update_admin" ON order_items FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin());
CREATE POLICY "order_items_delete_admin" ON order_items FOR DELETE USING (security.is_admin());
-- payments
DROP POLICY IF EXISTS "payments_select_admin" ON payments;
DROP POLICY IF EXISTS "payments_insert_admin" ON payments;
DROP POLICY IF EXISTS "payments_update_admin" ON payments;
DROP POLICY IF EXISTS "payments_delete_admin" ON payments;
CREATE POLICY "payments_select_admin" ON payments FOR SELECT USING (security.is_admin());
CREATE POLICY "payments_insert_admin" ON payments FOR INSERT WITH CHECK (security.is_admin());
CREATE POLICY "payments_update_admin" ON payments FOR UPDATE USING (security.is_admin()) WITH CHECK (security.is_admin());
CREATE POLICY "payments_delete_admin" ON payments FOR DELETE USING (security.is_admin());
