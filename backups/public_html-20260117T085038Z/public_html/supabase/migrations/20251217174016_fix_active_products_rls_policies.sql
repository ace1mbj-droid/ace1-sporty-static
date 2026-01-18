DO $$
DECLARE
  rel_kind char;
BEGIN
  SELECT c.relkind INTO rel_kind
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'active_products';

  -- Only tables can have RLS policies. If active_products is a view (as intended), skip.
  IF rel_kind = 'r' THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.active_products';
    EXECUTE 'DROP POLICY IF EXISTS "active_products_select_public" ON public.active_products';
    EXECUTE 'DROP POLICY IF EXISTS "active_products_select_admin" ON public.active_products';
    EXECUTE 'DROP POLICY IF EXISTS "active_products_insert_admin" ON public.active_products';
    EXECUTE 'DROP POLICY IF EXISTS "active_products_update_admin" ON public.active_products';
    EXECUTE 'DROP POLICY IF EXISTS "active_products_delete_admin" ON public.active_products';

    EXECUTE 'CREATE POLICY "active_products_select_public" ON public.active_products FOR SELECT USING (true)';
    EXECUTE $p1$
      CREATE POLICY "active_products_select_admin" ON public.active_products FOR SELECT
      USING (
        (select auth.uid()) = '36e39a39-64f2-4b84-a1b9-4c1b1a36e92b'::uuid
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
          AND ur.is_admin = true
        )
      )
    $p1$;
    EXECUTE $p2$
      CREATE POLICY "active_products_insert_admin" ON public.active_products FOR INSERT
      WITH CHECK (
        (select auth.uid()) = '36e39a39-64f2-4b84-a1b9-4c1b1a36e92b'::uuid
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
          AND ur.is_admin = true
        )
      )
    $p2$;
    EXECUTE $p3$
      CREATE POLICY "active_products_update_admin" ON public.active_products FOR UPDATE
      USING (
        (select auth.uid()) = '36e39a39-64f2-4b84-a1b9-4c1b1a36e92b'::uuid
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
          AND ur.is_admin = true
        )
      )
      WITH CHECK (
        (select auth.uid()) = '36e39a39-64f2-4b84-a1b9-4c1b1a36e92b'::uuid
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
          AND ur.is_admin = true
        )
      )
    $p3$;
    EXECUTE $p4$
      CREATE POLICY "active_products_delete_admin" ON public.active_products FOR DELETE
      USING (
        (select auth.uid()) = '36e39a39-64f2-4b84-a1b9-4c1b1a36e92b'::uuid
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
          AND ur.is_admin = true
        )
      )
    $p4$;
  END IF;
END $$;
