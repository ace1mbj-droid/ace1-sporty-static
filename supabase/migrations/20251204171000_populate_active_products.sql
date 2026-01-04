-- Migration: populate active_products from existing products

DO $$
DECLARE
    has_show_on_index boolean;
    has_deleted_at boolean;
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

    IF has_show_on_index AND has_deleted_at THEN
        EXECUTE $sql$
            INSERT INTO public.active_products (id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, show_on_index, deleted_at, created_at)
            SELECT id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, COALESCE(show_on_index, true), deleted_at, created_at
            FROM public.products
            WHERE deleted_at IS NULL AND is_active = true AND COALESCE(show_on_index, true) = true
            ON CONFLICT (id) DO UPDATE
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
        $sql$;
    ELSIF has_show_on_index AND NOT has_deleted_at THEN
        EXECUTE $sql$
            INSERT INTO public.active_products (id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, show_on_index, deleted_at, created_at)
            SELECT id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, COALESCE(show_on_index, true), NULL::timestamptz, created_at
            FROM public.products
            WHERE is_active = true AND COALESCE(show_on_index, true) = true
            ON CONFLICT (id) DO UPDATE
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
        $sql$;
    ELSIF NOT has_show_on_index AND has_deleted_at THEN
        EXECUTE $sql$
            INSERT INTO public.active_products (id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, show_on_index, deleted_at, created_at)
            SELECT id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, true, deleted_at, created_at
            FROM public.products
            WHERE deleted_at IS NULL AND is_active = true
            ON CONFLICT (id) DO UPDATE
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
        $sql$;
    ELSE
        EXECUTE $sql$
            INSERT INTO public.active_products (id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, show_on_index, deleted_at, created_at)
            SELECT id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, true, NULL::timestamptz, created_at
            FROM public.products
            WHERE is_active = true
            ON CONFLICT (id) DO UPDATE
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
        $sql$;
    END IF;
END $$;
