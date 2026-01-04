-- Add missing product availability fields expected by frontend + edge functions
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS stock_quantity integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_status_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_status_check
      CHECK (status IN ('available', 'unavailable', 'draft'));
  END IF;
END $$;

-- RLS: cart_items currently has RLS enabled but no policies
-- Allow authenticated users to manage items in their own carts (shopping_carts.user_id = auth.uid())
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cart_items' AND policyname='cart_items_select_own'
  ) THEN
    CREATE POLICY cart_items_select_own
      ON public.cart_items
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.shopping_carts sc
          WHERE sc.id = cart_items.cart_id
            AND sc.user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cart_items' AND policyname='cart_items_insert_own'
  ) THEN
    CREATE POLICY cart_items_insert_own
      ON public.cart_items
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.shopping_carts sc
          WHERE sc.id = cart_items.cart_id
            AND sc.user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cart_items' AND policyname='cart_items_update_own'
  ) THEN
    CREATE POLICY cart_items_update_own
      ON public.cart_items
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.shopping_carts sc
          WHERE sc.id = cart_items.cart_id
            AND sc.user_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.shopping_carts sc
          WHERE sc.id = cart_items.cart_id
            AND sc.user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cart_items' AND policyname='cart_items_delete_own'
  ) THEN
    CREATE POLICY cart_items_delete_own
      ON public.cart_items
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.shopping_carts sc
          WHERE sc.id = cart_items.cart_id
            AND sc.user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

-- Security hardening: lock down SECURITY DEFINER function search_path
DO $$
BEGIN
  IF to_regprocedure('public._ensure_cart_for_session(text)') IS NOT NULL THEN
    ALTER FUNCTION public._ensure_cart_for_session(text)
      SET search_path = public, extensions;
  END IF;
END $$;

-- Performance: add covering indexes for foreign keys flagged by advisor
DO $$
BEGIN
  IF to_regclass('public.cart_items') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx ON public.cart_items (cart_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS cart_items_product_id_idx ON public.cart_items (product_id)';
  END IF;

  IF to_regclass('public.categories') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories (parent_id)';
  END IF;

  IF to_regclass('public.inventory') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS inventory_product_id_idx ON public.inventory (product_id)';
  END IF;

  IF to_regclass('public.order_items') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON public.order_items (product_id)';
  END IF;

  IF to_regclass('public.orders') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'coupon_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS orders_coupon_id_idx ON public.orders (coupon_id)';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_method_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS orders_shipping_method_id_idx ON public.orders (shipping_method_id)';
    END IF;
  END IF;

  IF to_regclass('public.page_views') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'page_views' AND column_name = 'user_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS page_views_user_id_idx ON public.page_views (user_id)';
    END IF;
  END IF;

  IF to_regclass('public.payments') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'order_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS payments_order_id_idx ON public.payments (order_id)';
    END IF;
  END IF;

  IF to_regclass('public.product_deletion_audit') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'product_deletion_audit' AND column_name = 'deleted_by'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS product_deletion_audit_deleted_by_idx ON public.product_deletion_audit (deleted_by)';
    END IF;
  END IF;

  IF to_regclass('public.product_images') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS product_images_product_id_idx ON public.product_images (product_id)';
  END IF;
END $$;
