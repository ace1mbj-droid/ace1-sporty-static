-- Drop existing policy on active_products
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON active_products;

-- Add comprehensive RLS policies for active_products
-- SELECT: Public can read active products, admin can read all
CREATE POLICY "active_products_select_public"
ON active_products FOR SELECT
USING (true);

-- SELECT: Admin can read all products (active or not)
CREATE POLICY "active_products_select_admin"
ON active_products FOR SELECT
USING (
  auth.uid() = '36e39a39-64f2-4b84-a1b9-4c1b1a36e92b'::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.is_admin = true
  )
);

-- INSERT: Admin only
CREATE POLICY "active_products_insert_admin"
ON active_products FOR INSERT
WITH CHECK (
  auth.uid() = '36e39a39-64f2-4b84-a1b9-4c1b1a36e92b'::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.is_admin = true
  )
);

-- UPDATE: Admin only
CREATE POLICY "active_products_update_admin"
ON active_products FOR UPDATE
USING (
  auth.uid() = '36e39a39-64f2-4b84-a1b9-4c1b1a36e92b'::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.is_admin = true
  )
)
WITH CHECK (
  auth.uid() = '36e39a39-64f2-4b84-a1b9-4c1b1a36e92b'::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.is_admin = true
  )
);

-- DELETE: Admin only
CREATE POLICY "active_products_delete_admin"
ON active_products FOR DELETE
USING (
  auth.uid() = '36e39a39-64f2-4b84-a1b9-4c1b1a36e92b'::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.is_admin = true
  )
);
