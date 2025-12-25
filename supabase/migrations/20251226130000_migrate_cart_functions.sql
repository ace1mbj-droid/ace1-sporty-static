-- Migration: Migrate session-based cart functions to use cart_items

-- Helper: ensure a shopping_carts row exists for the session and return cart id
CREATE OR REPLACE FUNCTION public._ensure_cart_for_session(p_session_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cart_id UUID;
BEGIN
  SELECT id INTO v_cart_id FROM shopping_carts WHERE session_id = p_session_id LIMIT 1;
  IF v_cart_id IS NULL THEN
    INSERT INTO shopping_carts (session_id) VALUES (p_session_id) RETURNING id INTO v_cart_id;
  END IF;
  RETURN v_cart_id;
END;
$$;

-- get_cart_by_session(session_id)
CREATE OR REPLACE FUNCTION public.get_cart_by_session(p_session_id TEXT)
RETURNS TABLE(id UUID, product_id UUID, quantity INTEGER, size TEXT, added_at timestamptz)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT ci.id, ci.product_id, ci.quantity, ci.size, ci.added_at
  FROM cart_items ci
  JOIN shopping_carts sc ON sc.id = ci.cart_id
  WHERE sc.session_id = p_session_id AND sc.user_id IS NULL;
END;
$$;

-- add_to_cart_by_session(session_id, product_id, quantity, size)
CREATE OR REPLACE FUNCTION public.add_to_cart_by_session(p_session_id TEXT, p_product_id UUID, p_quantity INTEGER, p_size TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_cart_id UUID := public._ensure_cart_for_session(p_session_id);
  v_id UUID;
  v_existing_quantity INTEGER;
BEGIN
  SELECT id, quantity INTO v_id, v_existing_quantity
  FROM cart_items
  WHERE cart_id = v_cart_id
    AND product_id = p_product_id
    AND (size = p_size OR (size IS NULL AND p_size IS NULL))
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE cart_items SET quantity = v_existing_quantity + p_quantity, updated_at = now() WHERE id = v_id;
    RETURN v_id;
  ELSE
    INSERT INTO cart_items (cart_id, product_id, quantity, size) VALUES (v_cart_id, p_product_id, p_quantity, p_size) RETURNING id INTO v_id;
    RETURN v_id;
  END IF;
END;
$$;

-- update_cart_item_by_session(session_id, product_id, quantity, size)
CREATE OR REPLACE FUNCTION public.update_cart_item_by_session(p_session_id TEXT, p_product_id UUID, p_quantity INTEGER, p_size TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_cart_id UUID := (SELECT id FROM shopping_carts WHERE session_id = p_session_id LIMIT 1);
BEGIN
  IF v_cart_id IS NULL THEN RETURN FALSE; END IF;
  IF p_quantity <= 0 THEN
    DELETE FROM cart_items WHERE cart_id = v_cart_id AND product_id = p_product_id AND (size = p_size OR (size IS NULL AND p_size IS NULL));
  ELSE
    UPDATE cart_items SET quantity = p_quantity, updated_at = now() WHERE cart_id = v_cart_id AND product_id = p_product_id AND (size = p_size OR (size IS NULL AND p_size IS NULL));
  END IF;
  RETURN FOUND;
END;
$$;

-- remove_from_cart_by_session(session_id, product_id, size)
CREATE OR REPLACE FUNCTION public.remove_from_cart_by_session(p_session_id TEXT, p_product_id UUID, p_size TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_cart_id UUID := (SELECT id FROM shopping_carts WHERE session_id = p_session_id LIMIT 1);
BEGIN
  IF v_cart_id IS NULL THEN RETURN FALSE; END IF;
  DELETE FROM cart_items WHERE cart_id = v_cart_id AND product_id = p_product_id AND (size = p_size OR (size IS NULL AND p_size IS NULL));
  RETURN FOUND;
END;
$$;

-- clear_cart_by_session(session_id)
CREATE OR REPLACE FUNCTION public.clear_cart_by_session(p_session_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_cart_id UUID := (SELECT id FROM shopping_carts WHERE session_id = p_session_id LIMIT 1);
BEGIN
  IF v_cart_id IS NULL THEN RETURN FALSE; END IF;
  DELETE FROM cart_items WHERE cart_id = v_cart_id;
  RETURN TRUE;
END;
$$;

-- merge_session_cart_to_user(session_id, user_id)
CREATE OR REPLACE FUNCTION public.merge_session_cart_to_user(p_session_id TEXT, p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER := 0;
  v_cart_id UUID := (SELECT id FROM shopping_carts WHERE session_id = p_session_id LIMIT 1);
  v_row RECORD;
BEGIN
  IF v_cart_id IS NULL THEN RETURN 0; END IF;

  FOR v_row IN SELECT product_id, quantity, size FROM cart_items WHERE cart_id = v_cart_id LOOP
    INSERT INTO shopping_carts (user_id, product_id, quantity, size) VALUES (p_user_id, v_row.product_id, v_row.quantity, v_row.size)
    ON CONFLICT (user_id, product_id, size) DO UPDATE SET quantity = shopping_carts.quantity + EXCLUDED.quantity, updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  DELETE FROM cart_items WHERE cart_id = v_cart_id;
  DELETE FROM shopping_carts WHERE id = v_cart_id AND user_id IS NULL;

  RETURN v_count;
END;
$$;

-- Grant execute to authenticated and anon users where appropriate
GRANT EXECUTE ON FUNCTION public.get_cart_by_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_cart_by_session(TEXT, UUID, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_cart_item_by_session(TEXT, UUID, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_from_cart_by_session(TEXT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_cart_by_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_session_cart_to_user(TEXT, UUID) TO authenticated;
