-- Fix the log_product_deletion function - it must return NEW for UPDATE to proceed
CREATE OR REPLACE FUNCTION log_product_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_count BIGINT;
BEGIN
    -- For DELETE, use OLD
    IF TG_OP = 'DELETE' THEN
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
            'hard',
            v_order_count > 0,
            v_order_count,
            jsonb_build_object(
                'sku', OLD.sku,
                'category', OLD.category,
                'price_cents', OLD.price_cents,
                'operation', TG_OP
            )
        );
        
        RETURN OLD; -- For DELETE, return OLD
    END IF;
    
    -- For UPDATE (soft delete), only log if deleted_at is being set
    IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        SELECT COUNT(*) INTO v_order_count FROM order_items WHERE product_id = NEW.id;

        INSERT INTO product_deletion_audit (
            product_id,
            product_name,
            deleted_by,
            deletion_type,
            had_orders,
            order_count,
            metadata
        ) VALUES (
            NEW.id,
            NEW.name,
            auth.uid(),
            'soft',
            v_order_count > 0,
            v_order_count,
            jsonb_build_object(
                'sku', NEW.sku,
                'category', NEW.category,
                'price_cents', NEW.price_cents,
                'operation', TG_OP
            )
        );
    END IF;
    
    RETURN NEW; -- For UPDATE, MUST return NEW for the update to proceed
END;
$$;;
