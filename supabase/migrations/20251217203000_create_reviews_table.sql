-- Create reviews table to move from localStorage

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT NOT NULL,
    comment TEXT,
    verified_purchase BOOLEAN DEFAULT false,
    helpful_count INTEGER DEFAULT 0,
    unhelpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
-- Add RLS policies
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
-- Allow anyone to read reviews
CREATE POLICY "reviews_select_public" ON public.reviews FOR SELECT
USING (true);
-- Authenticated users can create reviews
CREATE POLICY "reviews_insert_authenticated" ON public.reviews FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);
-- Users can update their own reviews
CREATE POLICY "reviews_update_self" ON public.reviews FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);
-- Users can delete their own reviews or admins can delete any
CREATE POLICY "reviews_delete_self_or_admin" ON public.reviews FOR DELETE
USING ((select auth.uid()) = user_id OR security.is_admin());
-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);
