-- Migration: Ensure RLS policy for products and active_products view
-- Ensures only active, non-deleted products are returned to public/anonymous users

-- Enable RLS on products (idempotent)
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
-- Drop/recreate the policy (Postgres does not support CREATE POLICY IF NOT EXISTS)
-- Build the predicate defensively in case products.deleted_at does not exist in older schemas.
DO $$
DECLARE
  has_deleted_at boolean;
  policy_sql text;
  view_sql text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'deleted_at'
  ) INTO has_deleted_at;

  EXECUTE 'DROP POLICY IF EXISTS "public_view_active_products" ON public.products';

  policy_sql :=
    'CREATE POLICY "public_view_active_products" ON public.products FOR SELECT USING ('
    'COALESCE(is_active, false) = true'
    || CASE WHEN has_deleted_at THEN ' AND deleted_at IS NULL' ELSE '' END
    || ')';
  EXECUTE policy_sql;

  -- Ensure active_products view matches the same predicate
  EXECUTE 'DROP VIEW IF EXISTS public.active_products';
  view_sql :=
    'CREATE OR REPLACE VIEW public.active_products AS '
    'SELECT * FROM public.products '
    'WHERE COALESCE(is_active, false) = true'
    || CASE WHEN has_deleted_at THEN ' AND deleted_at IS NULL' ELSE '' END
    || ';';
  EXECUTE view_sql;
END$$;
-- Keep admin access as-is (admins via user_roles or ace1-session remain able to view all products)

-- Grant SELECT on the view to anon/authenticated (idempotent)
GRANT SELECT ON public.active_products TO anon, authenticated;
-- Add a short description for auditing
COMMENT ON VIEW public.active_products IS 'Read-only view exposing currently active (non-deleted) products to public roles';
