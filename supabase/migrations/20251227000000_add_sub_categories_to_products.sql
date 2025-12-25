-- Migration: Add sub_category and sub_sub_category to products for hierarchical categories

ALTER TABLE products ADD COLUMN sub_category TEXT;
ALTER TABLE products ADD COLUMN sub_sub_category TEXT;

-- Update existing products if needed
-- UPDATE products SET sub_category = 'some' WHERE ... but leave for manual

COMMENT ON COLUMN products.sub_category IS 'Sub-category under primary_category';
COMMENT ON COLUMN products.sub_sub_category IS 'Sub-sub-category under sub_category';
