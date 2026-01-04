-- Fix soft_delete_product to remove updated_at and ensure admin check
CREATE OR REPLACE FUNCTION soft_delete_product(p_product_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
    v_has_orders BOOLEAN;
    v_order_count BIGINT;
    v_is_admin BOOLEAN;
BEGIN
    -- Admin check
    SELECT security.is_admin() INTO v_is_admin;
    IF NOT v_is_admin THEN
        RETURN QUERY SELECT false, 'Only administrators can delete products';
        RETURN;
    END IF;

    -- Product exists
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id) THEN
        RETURN QUERY SELECT false, 'Product not found';
        RETURN;
    END IF;

    -- Order check
    SELECT * INTO v_has_orders, v_order_count FROM check_product_has_orders(p_product_id);

    -- Soft delete
    UPDATE products
    SET deleted_at = NOW(),
        is_active = false
    WHERE id = p_product_id;

    IF v_has_orders THEN
        RETURN QUERY SELECT true, format('Product soft-deleted (has %s orders). Data preserved for order history.', v_order_count);
    ELSE
        RETURN QUERY SELECT true, 'Product marked as deleted. You can permanently remove it later if needed.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Fix log_product_deletion to use price_cents instead of price
CREATE OR REPLACE FUNCTION log_product_deletion()
RETURNS TRIGGER AS $$
DECLARE
    v_order_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_order_count FROM order_items WHERE product_id = OLD.id;

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
            'price_cents', OLD.price_cents,
            'operation', TG_OP
        )
    );

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;;
