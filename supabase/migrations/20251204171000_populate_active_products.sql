-- Migration: populate active_products from existing products

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
