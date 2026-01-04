-- Fix soft_delete_product function to remove updated_at reference
-- The products table doesn't have an updated_at column

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
SET search_path = public, pg_temp;;
