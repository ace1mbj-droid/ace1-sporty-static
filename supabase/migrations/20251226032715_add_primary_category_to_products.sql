-- Add primary_category column to products table
-- Allows categorization of products into 'shoes' and 'clothing' for better organization
-- This enables separate admin sections and filtering on product pages

-- Add column if it doesn't exist
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

        RAISE NOTICE 'Added primary_category column to products table';
    ELSE
        RAISE NOTICE 'Column primary_category already exists';
    END IF;
END $$;

-- Create index for faster queries filtering by primary category
CREATE INDEX IF NOT EXISTS idx_products_primary_category
ON public.products(primary_category)
WHERE primary_category IS NOT NULL;

-- Create composite index for active products by primary category
CREATE INDEX IF NOT EXISTS idx_products_active_primary_category
ON public.products(is_active, primary_category)
WHERE is_active = true AND primary_category IS NOT NULL;

-- Update existing products to have appropriate primary_category based on their category
-- This is a one-time data migration for existing products
UPDATE public.products
SET primary_category = CASE
    WHEN LOWER(category) LIKE '%shoe%' OR LOWER(category) LIKE '%sneaker%' OR LOWER(category) LIKE '%boot%' THEN 'shoes'
    WHEN LOWER(category) LIKE '%cloth%' OR LOWER(category) LIKE '%shirt%' OR LOWER(category) LIKE '%pant%' OR LOWER(category) LIKE '%jacket%' THEN 'clothing'
    ELSE NULL
END
WHERE primary_category IS NULL;

-- Verification query - check the column exists and has proper constraints
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'products'
AND column_name = 'primary_category';