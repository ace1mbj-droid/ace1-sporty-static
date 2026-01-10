SELECT name, price_cents, stock_quantity
FROM products
WHERE is_active = true AND deleted_at IS NULL AND stock_quantity > 0 AND price_cents IS NOT NULL
ORDER BY name;