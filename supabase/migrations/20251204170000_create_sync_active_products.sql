-- Migration: create active_products sync table + triggers + publication

-- 1) Create active_products table mirroring the shape of the products view
-- Drop any existing VIEW named active_products so we can create the backing TABLE
DROP VIEW IF EXISTS public.active_products;

CREATE TABLE IF NOT EXISTS public.active_products (
  id uuid PRIMARY KEY,
  sku text,
  name text NOT NULL,
  short_desc text,
  long_desc text,
  price_cents int NOT NULL,
  currency text DEFAULT 'INR',
  category text,
  is_active boolean DEFAULT true,
  show_on_index boolean DEFAULT true,
  deleted_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2) Sync function: keeps active_products in sync with products
CREATE OR REPLACE FUNCTION public.sync_active_products()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- only maintain active_products for current active, not-deleted, show_on_index products
    IF NEW.deleted_at IS NULL AND NEW.is_active = true AND COALESCE(NEW.show_on_index, true) = true THEN
      INSERT INTO public.active_products (
        id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, show_on_index, deleted_at, created_at
      ) VALUES (
        NEW.id, NEW.sku, NEW.name, NEW.short_desc, NEW.long_desc, NEW.price_cents, NEW.currency, NEW.category, NEW.is_active, COALESCE(NEW.show_on_index, true), NEW.deleted_at, NEW.created_at
      ) ON CONFLICT (id) DO UPDATE
      SET sku = EXCLUDED.sku,
          name = EXCLUDED.name,
          short_desc = EXCLUDED.short_desc,
          long_desc = EXCLUDED.long_desc,
          price_cents = EXCLUDED.price_cents,
          currency = EXCLUDED.currency,
          category = EXCLUDED.category,
          is_active = EXCLUDED.is_active,
          show_on_index = EXCLUDED.show_on_index,
          deleted_at = EXCLUDED.deleted_at,
          created_at = COALESCE(EXCLUDED.created_at, public.active_products.created_at);
    ELSE
      -- if not active/visible, remove from active_products
      DELETE FROM public.active_products WHERE id = NEW.id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.active_products WHERE id = OLD.id;
  END IF;

  RETURN NULL; -- AFTER trigger
END;
$$;

-- 3) Attach trigger to products table
DROP TRIGGER IF EXISTS products_sync_active_after ON public.products;
CREATE TRIGGER products_sync_active_after
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_active_products();

-- 4) Add active_products to the realtime publication so it becomes available to Realtime
DO $$
BEGIN
  -- safe add: only attempt if publication exists and the relation is not already part of it
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public' AND c.relname = 'active_products'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.active_products';
    END IF;
  END IF;
END$$;

-- 5) Grant select to anon/authenticated for parity with the view
GRANT SELECT ON public.active_products TO anon, authenticated;
