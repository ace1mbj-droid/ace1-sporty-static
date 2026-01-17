-- Enable header-based admin access for ACE#1 admin panel
-- Run after optimize_rls_policies.sql so the drop/create statements below succeed.

-- ============================================================================
-- 1. Helper functions for custom session headers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ace1_session_token()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    headers jsonb;
BEGIN
    BEGIN
        headers := current_setting('request.headers', true)::jsonb;
    EXCEPTION WHEN others THEN
        RETURN NULL;
    END;

    RETURN nullif(headers ->> 'ace1-session', '');
END;
$$;

COMMENT ON FUNCTION public.ace1_session_token()
IS 'Extracts the ace1-session header (if present) for use inside policies.';

GRANT EXECUTE ON FUNCTION public.ace1_session_token() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ace1_is_admin_session()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    session_token text;
    admin_email text;
BEGIN
    session_token := public.ace1_session_token();
    IF session_token IS NULL THEN
        RETURN false;
    END IF;

    SELECT u.email
    INTO admin_email
    FROM public.sessions s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.token = session_token
      AND s.expires_at > now()
    LIMIT 1;

    RETURN admin_email IS NOT NULL AND lower(admin_email) = 'hello@ace1.in';
END;
$$;

COMMENT ON FUNCTION public.ace1_is_admin_session()
IS 'Verifies ace1-session header maps to a non-expired session owned by hello@ace1.in.';

GRANT EXECUTE ON FUNCTION public.ace1_is_admin_session() TO anon, authenticated, service_role;

-- PRODUCTS -------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select_admin" ON public.products;
CREATE POLICY "products_select_admin"
ON public.products FOR SELECT
USING (
    public.ace1_is_admin_session() OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
);

DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
CREATE POLICY "products_insert_admin"
ON public.products FOR INSERT
WITH CHECK (
    public.ace1_is_admin_session() OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
);

DROP POLICY IF EXISTS "products_update_admin" ON public.products;
CREATE POLICY "products_update_admin"
ON public.products FOR UPDATE
USING (
    public.ace1_is_admin_session() OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
);

DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
CREATE POLICY "products_delete_admin"
ON public.products FOR DELETE
USING (
    public.ace1_is_admin_session() OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
);

-- INVENTORY ------------------------------------------------------------------
DROP POLICY IF EXISTS "inventory_insert_admin" ON public.inventory;
CREATE POLICY "inventory_insert_admin"
ON public.inventory FOR INSERT
WITH CHECK (
    public.ace1_is_admin_session() OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
);

DROP POLICY IF EXISTS "inventory_update_admin" ON public.inventory;
CREATE POLICY "inventory_update_admin"
ON public.inventory FOR UPDATE
USING (
    public.ace1_is_admin_session() OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
);

DROP POLICY IF EXISTS "inventory_delete_admin" ON public.inventory;
CREATE POLICY "inventory_delete_admin"
ON public.inventory FOR DELETE
USING (
    public.ace1_is_admin_session() OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
);

-- PRODUCT IMAGES --------------------------------------------------------------
DROP POLICY IF EXISTS "product_images_insert_admin" ON public.product_images;
CREATE POLICY "product_images_insert_admin"
ON public.product_images FOR INSERT
WITH CHECK (
    public.ace1_is_admin_session() OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
);

DROP POLICY IF EXISTS "product_images_update_admin" ON public.product_images;
CREATE POLICY "product_images_update_admin"
ON public.product_images FOR UPDATE
USING (
    public.ace1_is_admin_session() OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
);

DROP POLICY IF EXISTS "product_images_delete_admin" ON public.product_images;
CREATE POLICY "product_images_delete_admin"
ON public.product_images FOR DELETE
USING (
    public.ace1_is_admin_session() OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
);

-- ORDERS ---------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_select_admin" ON public.orders;
CREATE POLICY "orders_select_admin"
ON public.orders FOR SELECT
USING (
    public.ace1_is_admin_session() OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
);

-- (Optional) extend to updates if future workflows need it:
-- DROP POLICY IF EXISTS "orders_update_admin" ON public.orders;
-- CREATE POLICY "orders_update_admin"
-- ON public.orders FOR UPDATE
-- USING (
--     public.ace1_is_admin_session() OR EXISTS (
--         SELECT 1 FROM public.user_roles ur
--         WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
--     )
-- );

-- SESSIONS -------------------------------------------------------------------
DROP POLICY IF EXISTS "sessions_select_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_delete_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_select_token" ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert_public" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update_token" ON public.sessions;
DROP POLICY IF EXISTS "sessions_delete_token" ON public.sessions;

CREATE POLICY "sessions_select_token"
ON public.sessions FOR SELECT
USING (
    public.ace1_session_token() IS NOT NULL
    AND token = public.ace1_session_token()
);

CREATE POLICY "sessions_insert_public"
ON public.sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "sessions_update_token"
ON public.sessions FOR UPDATE
USING (
    public.ace1_session_token() IS NOT NULL
    AND token = public.ace1_session_token()
)
WITH CHECK (
    public.ace1_session_token() IS NOT NULL
    AND token = public.ace1_session_token()
);

CREATE POLICY "sessions_delete_token"
ON public.sessions FOR DELETE
USING (
    public.ace1_session_token() IS NOT NULL
    AND token = public.ace1_session_token()
);

-- ============================================================================
-- 3. Verification helper queries
-- ============================================================================
-- SELECT policyname, tablename FROM pg_policies WHERE policyname ILIKE '%admin%' ORDER BY tablename;
-- SELECT public.ace1_is_admin_session(); -- returns false in SQL editor (no headers) which is expected.
