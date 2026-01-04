-- Enable RLS on critical public tables for security
-- Based on ACE#1 schema: products, inventory, orders, payments, user_roles
-- Run this in Supabase SQL Editor

-- 1. Enable RLS on payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view/insert their own payments (via order relationship)
CREATE POLICY "Users can view their own payment"
ON public.payments FOR SELECT
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE orders.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert payments"
ON public.payments FOR INSERT
WITH CHECK (true);

-- 2. Enable RLS on user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own role
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Admin can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

-- Only admin can update roles
CREATE POLICY "Only admin can update roles"
ON public.user_roles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

-- 3. Enable RLS on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view their own orders"
ON public.orders FOR SELECT
USING (auth.uid() = user_id);

-- Admin can view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

-- Authenticated users can create orders
CREATE POLICY "Authenticated users can create orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own orders
CREATE POLICY "Users can update their own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = user_id);

-- 4. Enable RLS on order_items table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Users can view items in their orders
CREATE POLICY "Users can view their order items"
ON public.order_items FOR SELECT
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE user_id = auth.uid()
  )
);

-- Authenticated users can insert order items
CREATE POLICY "Authenticated users can create order items"
ON public.order_items FOR INSERT
WITH CHECK (true);

-- 5. Enable RLS on products table (public read, admin write)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Everyone can view active products
CREATE POLICY "Everyone can view active products"
ON public.products FOR SELECT
USING (is_active = true);

-- Admin can view all products
CREATE POLICY "Admins can view all products"
ON public.products FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

-- Only admin can manage products
CREATE POLICY "Only admin can insert products"
ON public.products FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

CREATE POLICY "Only admin can update products"
ON public.products FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

CREATE POLICY "Only admin can delete products"
ON public.products FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

-- 6. Enable RLS on inventory table
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Everyone can view inventory
CREATE POLICY "Everyone can view inventory"
ON public.inventory FOR SELECT
USING (true);

-- Only admin can manage inventory
CREATE POLICY "Only admin can insert inventory"
ON public.inventory FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

CREATE POLICY "Only admin can update inventory"
ON public.inventory FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

-- 7. Enable RLS on product_images table
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Everyone can view product images
CREATE POLICY "Everyone can view product images"
ON public.product_images FOR SELECT
USING (true);

-- Only admin can manage product images
CREATE POLICY "Only admin can insert product images"
ON public.product_images FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

CREATE POLICY "Only admin can update product images"
ON public.product_images FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

CREATE POLICY "Only admin can delete product images"
ON public.product_images FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);
