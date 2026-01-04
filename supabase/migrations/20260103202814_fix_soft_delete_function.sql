-- Drop the old function and recreate with SECURITY DEFINER
DROP FUNCTION IF EXISTS soft_delete_product(uuid);

-- Recreate with SECURITY DEFINER so it can bypass RLS
CREATE OR REPLACE FUNCTION soft_delete_product(p_product_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER -- This is critical - allows the function to bypass RLS
SET search_path = public
AS $$
DECLARE
    v_has_orders BOOLEAN;
    v_order_count BIGINT;
    v_is_admin BOOLEAN;
BEGIN
    -- Admin check - use the security schema function
    SELECT security.is_admin() INTO v_is_admin;
    IF NOT v_is_admin THEN
        RETURN QUERY SELECT false::BOOLEAN, 'Only administrators can delete products'::TEXT;
        RETURN;
    END IF;

    -- Product exists check
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id) THEN
        RETURN QUERY SELECT false::BOOLEAN, 'Product not found'::TEXT;
        RETURN;
    END IF;

    -- Order check
    SELECT * INTO v_has_orders, v_order_count FROM check_product_has_orders(p_product_id);

    -- Perform soft delete
    UPDATE products
    SET deleted_at = NOW(),
        is_active = false
    WHERE id = p_product_id;

    IF v_has_orders THEN
        RETURN QUERY SELECT true::BOOLEAN, format('Product soft-deleted (has %s orders). Data preserved for order history.', v_order_count)::TEXT;
    ELSE
        RETURN QUERY SELECT true::BOOLEAN, 'Product marked as deleted. You can permanently remove it later if needed.'::TEXT;
    END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION soft_delete_product(uuid) TO authenticated;;
