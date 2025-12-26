-- Update clothing products
-- Replace the WHERE condition with actual criteria, e.g., based on product names

-- Example: Update products with names containing 'shirt', 'pants', etc.
UPDATE products 
SET primary_category = 'clothing' 
WHERE LOWER(name) LIKE '%shirt%' 
   OR LOWER(name) LIKE '%pants%' 
   OR LOWER(name) LIKE '%jacket%' 
   OR LOWER(name) LIKE '%hoodie%';

-- Example: Update products with names containing 'shoe', 'sneaker', etc.
UPDATE products 
SET primary_category = 'shoes' 
WHERE LOWER(name) LIKE '%shoe%' 
   OR LOWER(name) LIKE '%sneaker%' 
   OR LOWER(name) LIKE '%boot%';

-- Check current categories
SELECT primary_category, COUNT(*) 
FROM products 
GROUP BY primary_category;

-- List all products to identify which are clothing/shoes
SELECT id, name, primary_category 
FROM products 
ORDER BY name;
