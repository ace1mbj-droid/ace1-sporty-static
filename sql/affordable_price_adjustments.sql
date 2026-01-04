-- Adjust overly high sneaker prices to align with an affordable positioning.
--
-- IMPORTANT:
-- 1) This site reads prices from products.price_cents (rupees * 100).
-- 2) Edit the target values below before running in production.
-- 3) Run in a transaction and validate with a SELECT first.

-- Preview affected products (common high price points mentioned)
SELECT id, name, price_cents
FROM products
WHERE price_cents IN (799900, 850000)
ORDER BY price_cents DESC, name;

-- Choose your new pricing (edit these):
-- Example: 299900 = ₹2,999.00
-- Example: 349900 = ₹3,499.00
--
-- UPDATE products
-- SET price_cents = CASE price_cents
--   WHEN 850000 THEN 349900
--   WHEN 799900 THEN 299900
--   ELSE price_cents
-- END
-- WHERE price_cents IN (799900, 850000);

-- Verify
-- SELECT id, name, price_cents FROM products WHERE price_cents IN (299900, 349900) ORDER BY price_cents DESC, name;
