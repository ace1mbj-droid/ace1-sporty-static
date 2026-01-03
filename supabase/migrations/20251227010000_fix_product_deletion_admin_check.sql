-- Product Deletion Safeguards for ACE#1 Database
-- Prevents accidental product deletion and ensures data integrity

-- ============================================================================
-- STEP 1: Add inventory DELETE policy (if not exists)
-- ============================================================================

-- Allow admins to delete inventory when removing products
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'inventory' 
        AND policyname = 'inventory_delete_admin'
    ) THEN
        EXECUTE 'CREATE POLICY "inventory_delete_admin"
        ON public.inventory FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
          )
        )';
        RAISE NOTICE 'Created inventory_delete_admin policy';
    ELSE
        RAISE NOTICE 'Policy inventory_delete_admin already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Add soft delete column to products (if not exists)
-- ============================================================================

-- Add deleted_at column for soft deletes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.products 
        ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        
        -- Add index for faster queries
        CREATE INDEX idx_products_deleted_at ON public.products(deleted_at) 
        WHERE deleted_at IS NULL;
        
        RAISE NOTICE 'Added deleted_at column to products table';
    ELSE
        RAISE NOTICE 'Column deleted_at already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Create function to check for orders before deletion
-- ============================================================================

CREATE OR REPLACE FUNCTION check_product_has_orders(p_product_id UUID)
RETURNS TABLE(has_orders BOOLEAN, order_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) > 0 as has_orders,
        COUNT(*) as order_count
    FROM order_items oi
    WHERE oi.product_id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================================================
-- STEP 4: Create safe product deletion function (soft delete)
-- ============================================================================

CREATE OR REPLACE FUNCTION soft_delete_product(p_product_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
    v_has_orders BOOLEAN;
    v_order_count BIGINT;
    v_is_admin BOOLEAN;
BEGIN
    -- Check if user is admin using the security.is_admin() function
    SELECT security.is_admin() INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RETURN QUERY SELECT false, 'Only administrators can delete products';
        RETURN;
    END IF;
    
    -- Check if product exists
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id) THEN
        RETURN QUERY SELECT false, 'Product not found';
        RETURN;
    END IF;
    
    -- Check for existing orders
    SELECT * INTO v_has_orders, v_order_count 
    FROM check_product_has_orders(p_product_id);
    
    IF v_has_orders THEN
        -- Soft delete only (preserve for order history)
        UPDATE products 
        SET 
            deleted_at = NOW(),
            is_active = false
        WHERE id = p_product_id;
        
        RETURN QUERY SELECT true, 
            format('Product soft-deleted (has %s orders). Data preserved for order history.', v_order_count);
    ELSE
        -- Can safely mark as deleted (still soft delete for safety)
        UPDATE products 
        SET 
            deleted_at = NOW(),
            is_active = false
        WHERE id = p_product_id;
        
        RETURN QUERY SELECT true, 
            'Product marked as deleted. You can permanently remove it later if needed.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================================================
-- STEP 5: Create hard delete function (only for products without orders)
-- ============================================================================

CREATE OR REPLACE FUNCTION hard_delete_product(p_product_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
    v_has_orders BOOLEAN;
    v_order_count BIGINT;
    v_is_admin BOOLEAN;
BEGIN
    -- Check if user is admin using the security.is_admin() function
    SELECT security.is_admin() INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RETURN QUERY SELECT false, 'Only administrators can delete products';
        RETURN;
    END IF;
    
    -- Check for existing orders
    SELECT * INTO v_has_orders, v_order_count 
    FROM check_product_has_orders(p_product_id);
    
    IF v_has_orders THEN
        RETURN QUERY SELECT false, 
            format('Cannot hard delete: Product has %s orders. Use soft delete instead.', v_order_count);
        RETURN;
    END IF;
    
    -- Delete related records (cascading manually for safety)
    DELETE FROM inventory WHERE product_id = p_product_id;
    DELETE FROM product_images WHERE product_id = p_product_id;
    DELETE FROM products WHERE id = p_product_id;
    
    RETURN QUERY SELECT true, 'Product and all related data permanently deleted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================================================
-- STEP 6: Create view for active products only (excludes soft-deleted)
-- ============================================================================

-- Only create view if active_products doesn't exist as a table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'active_products' AND table_type = 'BASE TABLE'
    ) THEN
        CREATE OR REPLACE VIEW active_products AS
        SELECT * FROM products
        WHERE deleted_at IS NULL AND is_active = true;
        
        -- Grant permissions
        GRANT SELECT ON active_products TO anon, authenticated;
    END IF;
END $$;

-- ============================================================================
-- STEP 7: Add audit trigger for product deletions
-- ============================================================================

-- Create audit log table if not exists
CREATE TABLE IF NOT EXISTS product_deletion_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    product_name TEXT,
    deleted_by UUID REFERENCES auth.users(id),
    deletion_type TEXT CHECK (deletion_type IN ('soft', 'hard')),
    had_orders BOOLEAN,
    order_count BIGINT,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Enable RLS on audit table (safe if already enabled)
DO $$ 
BEGIN
    ALTER TABLE product_deletion_audit ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'RLS already enabled on product_deletion_audit';
END $$;

-- Drop existing audit policy if exists
DROP POLICY IF EXISTS "audit_select_admin" ON product_deletion_audit;

-- Only admins can view audit logs
CREATE POLICY "audit_select_admin"
ON product_deletion_audit FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

-- Create trigger function to log deletions
CREATE OR REPLACE FUNCTION log_product_deletion()
RETURNS TRIGGER AS $$
DECLARE
    v_order_count BIGINT;
BEGIN
    -- Count orders for this product
    SELECT COUNT(*) INTO v_order_count
    FROM order_items
    WHERE product_id = OLD.id;
    
    -- Log the deletion
    INSERT INTO product_deletion_audit (
        product_id,
        product_name,
        deleted_by,
        deletion_type,
        had_orders,
        order_count,
        metadata
    ) VALUES (
        OLD.id,
        OLD.name,
        auth.uid(),
        CASE WHEN TG_OP = 'UPDATE' THEN 'soft' ELSE 'hard' END,
        v_order_count > 0,
        v_order_count,
        jsonb_build_object(
            'sku', OLD.sku,
            'category', OLD.category,
            'price', OLD.price,
            'operation', TG_OP
        )
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Create trigger on products table
DROP TRIGGER IF EXISTS product_deletion_audit_trigger ON products;
CREATE TRIGGER product_deletion_audit_trigger
    BEFORE DELETE ON products
    FOR EACH ROW
    EXECUTE FUNCTION log_product_deletion();

-- Also log soft deletes (when deleted_at is set)
DROP TRIGGER IF EXISTS product_soft_delete_audit_trigger ON products;
CREATE TRIGGER product_soft_delete_audit_trigger
    BEFORE UPDATE ON products
    FOR EACH ROW
    WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
    EXECUTE FUNCTION log_product_deletion();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test soft delete function
-- SELECT * FROM soft_delete_product('product-uuid-here');

-- Test hard delete function (only works if no orders)
-- SELECT * FROM hard_delete_product('product-uuid-here');

-- Check products with orders
-- SELECT 
--     p.id,
--     p.name,
--     p.sku,
--     r.has_orders,
--     r.order_count
-- FROM products p
-- CROSS JOIN LATERAL check_product_has_orders(p.id) r
-- WHERE r.has_orders = true;

-- View deletion audit log
-- SELECT 
--     pda.*,
--     u.email as deleted_by_email
-- FROM product_deletion_audit pda
-- LEFT JOIN auth.users u ON u.id = pda.deleted_by
-- ORDER BY deleted_at DESC;

-- View all functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name LIKE '%product%';

-- Check deleted_at column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'deleted_at';
