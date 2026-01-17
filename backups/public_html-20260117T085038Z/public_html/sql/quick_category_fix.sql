-- Update first 6 products to clothing (assuming they are clothing items)
UPDATE products SET primary_category = 'clothing' WHERE id IN (
    SELECT id FROM products ORDER BY id LIMIT 6
);

-- Update remaining to shoes
UPDATE products SET primary_category = 'shoes' WHERE primary_category IS NULL OR primary_category != 'clothing';

-- Verify
SELECT primary_category, COUNT(*) FROM products GROUP BY primary_category;
