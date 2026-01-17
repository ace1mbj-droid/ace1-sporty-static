-- Tighten public visibility rules for products now that is_locked/status exist
-- Public should only see active, not deleted, not locked, and available products.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND policyname='anon_view_active_products'
  ) THEN
    DROP POLICY anon_view_active_products ON public.products;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND policyname='auth_view_products'
  ) THEN
    DROP POLICY auth_view_products ON public.products;
  END IF;
END $$;

CREATE POLICY anon_view_active_products
  ON public.products
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND deleted_at IS NULL
    AND is_locked = false
    AND status = 'available'
  );

CREATE POLICY auth_view_products
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN security.is_admin() THEN true
      ELSE (
        is_active = true
        AND deleted_at IS NULL
        AND is_locked = false
        AND status = 'available'
      )
    END
  );
;
