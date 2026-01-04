-- Fix log_product_deletion function to use price_cents instead of price
-- The products table has price_cents column, not price

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
            'price_cents', OLD.price_cents,
            'operation', TG_OP
        )
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;;
