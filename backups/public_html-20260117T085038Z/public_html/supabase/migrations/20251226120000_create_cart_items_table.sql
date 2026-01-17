-- Migration: create cart_items table to support multi-product shopping carts

CREATE TABLE IF NOT EXISTS cart_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id uuid REFERENCES shopping_carts(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    quantity integer NOT NULL DEFAULT 1,
    size text,
    added_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
-- NOTE: previous schema used product_id/quantity/size on shopping_carts; those columns were dropped in a follow-up migration.;
