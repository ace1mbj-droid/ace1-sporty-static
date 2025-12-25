-- Migration: remove migrated columns from shopping_carts

ALTER TABLE shopping_carts DROP COLUMN IF EXISTS product_id;
ALTER TABLE shopping_carts DROP COLUMN IF EXISTS quantity;
ALTER TABLE shopping_carts DROP COLUMN IF EXISTS size;