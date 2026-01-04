-- Migration: Convert existing public.active_products table into a read-only view
-- Preserves current data by renaming the current table to active_products_sync
-- Updates the sync trigger/function and realtime publication to use the sync table

BEGIN;
-- 1) If active_products is an ordinary table, rename it to active_products_sync to preserve the data
DO $$
DECLARE
  rel_kind char;
BEGIN
  SELECT c.relkind INTO rel_kind
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'active_products';

  -- 'r' = ordinary table, 'v' = view
  IF FOUND AND rel_kind = 'r' THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c2 JOIN pg_namespace n2 ON c2.relnamespace = n2.oid
      WHERE n2.nspname = 'public' AND c2.relname = 'active_products_sync'
    ) THEN
      EXECUTE 'ALTER TABLE public.active_products RENAME TO active_products_sync';
    ELSE
      -- if a sync target already exists, avoid clobbering it; pick a timestamped backup name
      EXECUTE format('ALTER TABLE public.active_products RENAME TO active_products_sync_%s', to_char(now(), 'YYYYMMDD_HH24MISS'));
    END IF;
  END IF;
END$$;
-- 2) Ensure sync table exists with the expected shape so the sync function / trigger remain safe
-- If active_products_sync exists (because the repository intentionally created it), do nothing. Otherwise create it as an empty table shaped like the products selection.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'active_products_sync'
  ) THEN
    -- create minimal sync table matching the expected columns
    EXECUTE 'CREATE TABLE public.active_products_sync (id uuid PRIMARY KEY, sku text, name text NOT NULL, short_desc text, long_desc text, price_cents int NOT NULL, currency text DEFAULT ''INR'', category text, is_active boolean DEFAULT true, show_on_index boolean DEFAULT true, deleted_at timestamptz DEFAULT NULL, created_at timestamptz DEFAULT now())';
  END IF;
END$$;
-- 3) Replace sync function so it targets active_products_sync (idempotent)
CREATE OR REPLACE FUNCTION public.sync_active_products()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  new_json jsonb;
  v_deleted_at timestamptz;
  v_show_on_index boolean := true;
  v_is_active boolean := true;
  v_created_at timestamptz := now();
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    new_json := to_jsonb(NEW);
    IF new_json ? 'deleted_at' THEN
      v_deleted_at := NULLIF(new_json->>'deleted_at', '')::timestamptz;
    END IF;
    IF new_json ? 'show_on_index' THEN
      v_show_on_index := COALESCE(NULLIF(new_json->>'show_on_index', '')::boolean, true);
    END IF;
    IF new_json ? 'is_active' THEN
      v_is_active := COALESCE(NULLIF(new_json->>'is_active', '')::boolean, true);
    END IF;
    IF new_json ? 'created_at' THEN
      v_created_at := NULLIF(new_json->>'created_at', '')::timestamptz;
    END IF;

    IF v_deleted_at IS NULL AND v_is_active = true AND v_show_on_index = true THEN
      INSERT INTO public.active_products_sync (
        id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, show_on_index, deleted_at, created_at
      ) VALUES (
        NEW.id, NEW.sku, NEW.name, NEW.short_desc, NEW.long_desc, NEW.price_cents, NEW.currency, NEW.category, v_is_active, v_show_on_index, v_deleted_at, v_created_at
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
          created_at = COALESCE(EXCLUDED.created_at, public.active_products_sync.created_at);

    ELSE
      DELETE FROM public.active_products_sync WHERE id = NEW.id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.active_products_sync WHERE id = OLD.id;
  END IF;

  RETURN NULL;
END;
$$;
-- 4) Attach the trigger to products table (idempotent)
DROP TRIGGER IF EXISTS products_sync_active_after ON public.products;
CREATE TRIGGER products_sync_active_after
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_active_products();
-- 5) Ensure publication contains the sync table (if supabase_realtime is used)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public' AND c.relname = 'active_products_sync'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.active_products_sync';
    END IF;

    -- if publication still references the old name (unlikely after rename), drop it
    IF EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public' AND c.relname = 'active_products'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.active_products';
    END IF;
  END IF;
END$$;
-- 6) Create the canonical view that apps expect
-- The underlying products schema can vary over time. Build the view defensively so shadow DB apply works.
DO $$
DECLARE
  has_show_on_index boolean;
  has_deleted_at boolean;
  view_sql text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'show_on_index'
  ) INTO has_show_on_index;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'deleted_at'
  ) INTO has_deleted_at;

  view_sql :=
    'CREATE OR REPLACE VIEW public.active_products AS '
    'SELECT id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, '
    || CASE WHEN has_show_on_index THEN 'COALESCE(show_on_index, true) AS show_on_index, ' ELSE 'true AS show_on_index, ' END
    || CASE WHEN has_deleted_at THEN 'deleted_at, ' ELSE 'NULL::timestamptz AS deleted_at, ' END
    || 'created_at '
    'FROM public.products '
    'WHERE is_active = true'
    || CASE WHEN has_deleted_at THEN ' AND deleted_at IS NULL' ELSE '' END
    || CASE WHEN has_show_on_index THEN ' AND COALESCE(show_on_index, true) = true' ELSE '' END
    || ';';

  EXECUTE view_sql;
END $$;
GRANT SELECT ON public.active_products TO anon, authenticated;
COMMIT;
