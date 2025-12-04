-- Add show_on_index column to products table
-- Allows admins to control whether products appear on the homepage/index

-- Add column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'show_on_index'
    ) THEN
        ALTER TABLE public.products 
        ADD COLUMN show_on_index BOOLEAN DEFAULT true;
        
        RAISE NOTICE 'Added show_on_index column to products table';
    ELSE
        RAISE NOTICE 'Column show_on_index already exists';
    END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_show_on_index 
ON public.products(show_on_index) 
WHERE show_on_index = true;

-- Update active_products view to respect show_on_index
DROP VIEW IF EXISTS active_products;

CREATE OR REPLACE VIEW active_products AS
SELECT * FROM products
WHERE deleted_at IS NULL 
  AND is_active = true
  AND show_on_index = true;

-- Grant permissions on view
GRANT SELECT ON active_products TO anon, authenticated;

-- Verification query
SELECT 
    column_name, 
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'products' 
  AND column_name = 'show_on_index';
