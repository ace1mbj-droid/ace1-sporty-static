-- Allow 'accessories' as a valid primary_category value
-- The original migration only allowed ('shoes', 'clothing')
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find and drop the existing CHECK constraint on primary_category
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'products'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%primary_category%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

ALTER TABLE public.products
ADD CONSTRAINT products_primary_category_check 
CHECK (primary_category IN ('shoes', 'clothing', 'accessories'));
