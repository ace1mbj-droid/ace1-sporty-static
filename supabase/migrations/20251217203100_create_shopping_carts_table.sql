-- Create shopping_carts table to move from localStorage
-- This tracks temporary cart items before checkout

CREATE TABLE IF NOT EXISTS public.shopping_carts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT, -- For anonymous users
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    size TEXT, -- Optional size selection
    added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
-- Add RLS policies
ALTER TABLE public.shopping_carts ENABLE ROW LEVEL SECURITY;
-- Users can see their own cart
CREATE POLICY "shopping_carts_select_self" ON public.shopping_carts FOR SELECT
USING (auth.uid() = user_id OR session_id = current_setting('app.session_id', true));
-- Users can add to their own cart
CREATE POLICY "shopping_carts_insert_self" ON public.shopping_carts FOR INSERT
WITH CHECK (auth.uid() = user_id OR session_id = current_setting('app.session_id', true));
-- Users can update their own cart
CREATE POLICY "shopping_carts_update_self" ON public.shopping_carts FOR UPDATE
USING (auth.uid() = user_id OR session_id = current_setting('app.session_id', true))
WITH CHECK (auth.uid() = user_id OR session_id = current_setting('app.session_id', true));
-- Users can delete from their own cart or admins can delete any
CREATE POLICY "shopping_carts_delete_self_or_admin" ON public.shopping_carts FOR DELETE
USING (auth.uid() = user_id OR session_id = current_setting('app.session_id', true) OR security.is_admin());
-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_shopping_carts_user_id ON public.shopping_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_session_id ON public.shopping_carts(session_id);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_product_id ON public.shopping_carts(product_id);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_updated_at ON public.shopping_carts(updated_at DESC);
