-- Migration: Ensure RLS policy for products and active_products view
-- Ensures only active, non-deleted products are returned to public/anonymous users

-- Enable RLS on products (idempotent)
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;

-- Drop any existing policy with the same name and recreate with a clear predicate
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_view_active_products' AND tablename = 'products') THEN
    EXECUTE 'DROP POLICY IF EXISTS "public_view_active_products" ON public.products';
  END IF;
END$$;

-- Policy: allow anyone to select rows which are active and not soft-deleted
CREATE POLICY IF NOT EXISTS "public_view_active_products"
  ON public.products
  FOR SELECT
  USING (
    COALESCE(is_active, false) = true
    AND (deleted_at IS NULL)
  );

-- Keep admin access as-is (admins via user_roles or ace1-session remain able to view all products)

-- Ensure active_products view is a simple non-security-definer view using the same predicate
DROP VIEW IF EXISTS public.active_products;
CREATE OR REPLACE VIEW public.active_products AS
SELECT * FROM public.products
WHERE COALESCE(is_active, false) = true AND deleted_at IS NULL;

-- Grant SELECT on the view to anon/authenticated (idempotent)
GRANT SELECT ON public.active_products TO anon, authenticated;

-- Add a short description for auditing
COMMENT ON VIEW public.active_products IS 'Read-only view exposing currently active (non-deleted) products to public roles';
