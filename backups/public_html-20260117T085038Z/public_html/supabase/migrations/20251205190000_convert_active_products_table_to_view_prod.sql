-- Production migration: Convert public.active_products table into a read-only view
-- This is idempotent and safe to run on production. It preserves the current
-- table data by renaming it to active_products_sync and ensures triggers,
-- publications, and the canonical `active_products` view exist.

BEGIN;
-- 1) If active_products exists as an ordinary table, rename it to active_products_sync
DO $$
DECLARE
  rel_kind char;
BEGIN
  SELECT c.relkind INTO rel_kind
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'active_products';

  IF FOUND AND rel_kind = 'r' THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c2 JOIN pg_namespace n2 ON c2.relnamespace = n2.oid
      WHERE n2.nspname = 'public' AND c2.relname = 'active_products_sync'
    ) THEN
      EXECUTE 'ALTER TABLE public.active_products RENAME TO active_products_sync';
    ELSE
      EXECUTE format('ALTER TABLE public.active_products RENAME TO active_products_sync_%s', to_char(now(), 'YYYYMMDD_HH24MISS'));
    END IF;
  END IF;
END$$;
-- 2) Ensure sync table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'active_products_sync'
  ) THEN
    EXECUTE 'CREATE TABLE public.active_products_sync (id uuid PRIMARY KEY, sku text, name text NOT NULL, short_desc text, long_desc text, price_cents int NOT NULL, currency text DEFAULT ''INR'', category text, is_active boolean DEFAULT true, show_on_index boolean DEFAULT true, deleted_at timestamptz DEFAULT NULL, created_at timestamptz DEFAULT now())';
  END IF;
END$$;
-- 3) Sync function (idempotent)
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
-- 4) Ensure trigger is attached
DROP TRIGGER IF EXISTS products_sync_active_after ON public.products;
CREATE TRIGGER products_sync_active_after
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_active_products();
-- 5) Ensure publication contains the sync table (supabase_realtime)
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
-- 6) Create view
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
    'CREATE VIEW public.active_products AS '
    'SELECT id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, '
    || CASE WHEN has_show_on_index THEN 'COALESCE(show_on_index, true) AS show_on_index, ' ELSE 'true AS show_on_index, ' END
    || CASE WHEN has_deleted_at THEN 'deleted_at, ' ELSE 'NULL::timestamptz AS deleted_at, ' END
    || 'created_at '
    'FROM public.products '
    'WHERE is_active = true'
    || CASE WHEN has_deleted_at THEN ' AND deleted_at IS NULL' ELSE '' END
    || CASE WHEN has_show_on_index THEN ' AND COALESCE(show_on_index, true) = true' ELSE '' END
    || ';';

  EXECUTE 'DROP VIEW IF EXISTS public.active_products';
  EXECUTE view_sql;
END $$;
GRANT SELECT ON public.active_products TO anon, authenticated;
COMMIT;
