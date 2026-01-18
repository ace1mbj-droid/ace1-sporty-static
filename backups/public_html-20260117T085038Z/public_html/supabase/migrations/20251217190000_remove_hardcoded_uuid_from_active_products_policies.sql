DO $$
DECLARE
  rel_kind char;
BEGIN
  SELECT c.relkind INTO rel_kind
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'active_products';

  -- active_products is expected to be a view in this project; policies only apply to tables.
  IF rel_kind = 'r' THEN
    EXECUTE 'DROP POLICY IF EXISTS "active_products_select_admin" ON public.active_products';
    EXECUTE 'DROP POLICY IF EXISTS "active_products_insert_admin" ON public.active_products';
    EXECUTE 'DROP POLICY IF EXISTS "active_products_update_admin" ON public.active_products';
    EXECUTE 'DROP POLICY IF EXISTS "active_products_delete_admin" ON public.active_products';

    EXECUTE $p1$
      CREATE POLICY "active_products_select_admin" ON public.active_products FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
            AND ur.is_admin = true
        )
      )
    $p1$;
    EXECUTE $p2$
      CREATE POLICY "active_products_insert_admin" ON public.active_products FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
            AND ur.is_admin = true
        )
      )
    $p2$;
    EXECUTE $p3$
      CREATE POLICY "active_products_update_admin" ON public.active_products FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
            AND ur.is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
            AND ur.is_admin = true
        )
      )
    $p3$;
    EXECUTE $p4$
      CREATE POLICY "active_products_delete_admin" ON public.active_products FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
            AND ur.is_admin = true
        )
      )
    $p4$;
  END IF;
END $$;
