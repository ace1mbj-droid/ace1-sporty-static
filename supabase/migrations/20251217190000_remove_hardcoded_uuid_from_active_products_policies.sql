-- Remove UUID-based admin checks and use user_roles instead
DROP POLICY IF EXISTS "active_products_select_admin" ON active_products;
DROP POLICY IF EXISTS "active_products_insert_admin" ON active_products;
DROP POLICY IF EXISTS "active_products_update_admin" ON active_products;
DROP POLICY IF EXISTS "active_products_delete_admin" ON active_products;

-- Recreate admin policies using user_roles
CREATE POLICY "active_products_select_admin"
ON active_products FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_admin = true
  )
);

CREATE POLICY "active_products_insert_admin"
ON active_products FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_admin = true
  )
);

CREATE POLICY "active_products_update_admin"
ON active_products FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_admin = true
  )
);

CREATE POLICY "active_products_delete_admin"
ON active_products FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_admin = true
  )
);
