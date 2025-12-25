-- Manual SQL to update existing products with primary_category
-- Run this in the Supabase SQL Editor if the migration didn't apply

-- First, ensure the primary_category column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'products'
        AND column_name = 'primary_category'
    ) THEN
        ALTER TABLE public.products
        ADD COLUMN primary_category TEXT CHECK (primary_category IN ('shoes', 'clothing'));
        RAISE NOTICE 'Added primary_category column';
    END IF;
END $$;

-- Update existing products based on their name and category
UPDATE public.products
SET primary_category = CASE
    WHEN LOWER(name) LIKE '%shoe%' OR LOWER(name) LIKE '%sneaker%' OR LOWER(name) LIKE '%boot%' OR LOWER(name) LIKE '%sandal%'
         OR LOWER(category) LIKE '%shoe%' OR LOWER(category) LIKE '%sneaker%' OR LOWER(category) LIKE '%boot%' THEN 'shoes'
    WHEN LOWER(name) LIKE '%shirt%' OR LOWER(name) LIKE '%pant%' OR LOWER(name) LIKE '%jacket%' OR LOWER(name) LIKE '%hoodie%'
         OR LOWER(name) LIKE '%t-shirt%' OR LOWER(name) LIKE '%sweater%' OR LOWER(name) LIKE '%short%'
         OR LOWER(category) LIKE '%cloth%' OR LOWER(category) LIKE '%shirt%' OR LOWER(category) LIKE '%pant%' THEN 'clothing'
    ELSE 'shoes' -- Default to shoes if can't determine
END
WHERE primary_category IS NULL;

-- Check the results
SELECT primary_category, COUNT(*) as count
FROM public.products
GROUP BY primary_category;