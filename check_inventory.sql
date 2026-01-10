-- Check products with inventory records, specifically shoes with stock > 0

-- First, show all products that have inventory records
SELECT DISTINCT p.id, p.name, p.primary_category, p.is_active
FROM products p
JOIN inventory i ON p.id = i.product_id
ORDER BY p.primary_category, p.name;

-- Then, specifically shoes with stock > 0
SELECT p.id, p.name, p.primary_category, i.size, i.stock
FROM products p
JOIN inventory i ON p.id = i.product_id
WHERE p.primary_category = 'shoes' AND i.stock > 0
ORDER BY p.name, i.size;