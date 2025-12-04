-- Optimize RLS Policies for ACE#1 Database
-- Fixes: 1) Auth RLS InitPlan warnings, 2) Multiple permissive policies
-- This script drops all existing policies and recreates them with optimizations

-- ============================================================================
-- STEP 1: Drop all existing RLS policies to clean up duplicates
-- ============================================================================

-- Drop policies on payments table
DROP POLICY IF EXISTS "Users can view their own payment" ON public.payments;
DROP POLICY IF EXISTS "System can insert payments" ON public.payments;
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_system" ON public.payments;

-- Drop policies on user_roles table
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_admin" ON public.user_roles;

-- Drop policies on orders table
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "select_own_orders" ON public.orders;
DROP POLICY IF EXISTS "insert_orders_user" ON public.orders;
DROP POLICY IF EXISTS "update_own_orders" ON public.orders;
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_select_admin" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;

-- Drop policies on order_items table
DROP POLICY IF EXISTS "Users can view their order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can create order items" ON public.order_items;
DROP POLICY IF EXISTS "select_order_items_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_authenticated" ON public.order_items;

-- Drop policies on products table
DROP POLICY IF EXISTS "Everyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
DROP POLICY IF EXISTS "Only admin can insert products" ON public.products;
DROP POLICY IF EXISTS "Only admin can update products" ON public.products;
DROP POLICY IF EXISTS "Only admin can delete products" ON public.products;
DROP POLICY IF EXISTS "Admin can insert products" ON public.products;
DROP POLICY IF EXISTS "Admin can update products" ON public.products;
DROP POLICY IF EXISTS "Admin can delete products" ON public.products;
DROP POLICY IF EXISTS "Allow select for all" ON public.products;
DROP POLICY IF EXISTS "Allow insert for all" ON public.products;
DROP POLICY IF EXISTS "Allow update for all" ON public.products;
DROP POLICY IF EXISTS "Allow delete for all" ON public.products;
DROP POLICY IF EXISTS "public_select_products" ON public.products;
DROP POLICY IF EXISTS "products_select_active" ON public.products;
DROP POLICY IF EXISTS "products_select_admin" ON public.products;
DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
DROP POLICY IF EXISTS "products_update_admin" ON public.products;
DROP POLICY IF EXISTS "products_delete_admin" ON public.products;

-- Drop policies on inventory table
DROP POLICY IF EXISTS "Everyone can view inventory" ON public.inventory;
DROP POLICY IF EXISTS "Only admin can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Only admin can update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admin can manage inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow select for all" ON public.inventory;
DROP POLICY IF EXISTS "Allow insert for all" ON public.inventory;
DROP POLICY IF EXISTS "Allow update for all" ON public.inventory;
DROP POLICY IF EXISTS "Allow delete for all" ON public.inventory;
DROP POLICY IF EXISTS "replace_with_policy_name" ON public.inventory;
DROP POLICY IF EXISTS "inventory_select_all" ON public.inventory;
DROP POLICY IF EXISTS "inventory_insert_admin" ON public.inventory;
DROP POLICY IF EXISTS "inventory_update_admin" ON public.inventory;
DROP POLICY IF EXISTS "inventory_delete_admin" ON public.inventory;

-- Drop policies on product_images table
DROP POLICY IF EXISTS "Everyone can view product images" ON public.product_images;
DROP POLICY IF EXISTS "Only admin can insert product images" ON public.product_images;
DROP POLICY IF EXISTS "Only admin can update product images" ON public.product_images;
DROP POLICY IF EXISTS "Only admin can delete product images" ON public.product_images;
DROP POLICY IF EXISTS "Admin can manage product images" ON public.product_images;
DROP POLICY IF EXISTS "Allow select for all" ON public.product_images;
DROP POLICY IF EXISTS "Allow insert for all" ON public.product_images;
DROP POLICY IF EXISTS "Allow update for all" ON public.product_images;
DROP POLICY IF EXISTS "Allow delete for all" ON public.product_images;
DROP POLICY IF EXISTS "public_select_product_images" ON public.product_images;
DROP POLICY IF EXISTS "product_images_select_all" ON public.product_images;
DROP POLICY IF EXISTS "product_images_insert_admin" ON public.product_images;
DROP POLICY IF EXISTS "product_images_update_admin" ON public.product_images;
DROP POLICY IF EXISTS "product_images_delete_admin" ON public.product_images;

-- Drop policies on sessions table (if exists)
DROP POLICY IF EXISTS "Allow all session operations" ON public.sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "sessions_select_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_delete_own" ON public.sessions;

-- ============================================================================
-- STEP 2: Create optimized RLS policies with (select auth.uid())
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. PAYMENTS TABLE
-- -----------------------------------------------------------------------------
CREATE POLICY "payments_select_own"
ON public.payments FOR SELECT
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "payments_insert_system"
ON public.payments FOR INSERT
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. USER_ROLES TABLE
-- -----------------------------------------------------------------------------
CREATE POLICY "user_roles_select_own"
ON public.user_roles FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "user_roles_select_admin"
ON public.user_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

CREATE POLICY "user_roles_update_admin"
ON public.user_roles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

-- -----------------------------------------------------------------------------
-- 3. ORDERS TABLE
-- -----------------------------------------------------------------------------
CREATE POLICY "orders_select_own"
ON public.orders FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "orders_select_admin"
ON public.orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

CREATE POLICY "orders_insert_own"
ON public.orders FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "orders_update_own"
ON public.orders FOR UPDATE
USING ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 4. ORDER_ITEMS TABLE
-- -----------------------------------------------------------------------------
CREATE POLICY "order_items_select_own"
ON public.order_items FOR SELECT
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "order_items_insert_authenticated"
ON public.order_items FOR INSERT
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 5. PRODUCTS TABLE
-- -----------------------------------------------------------------------------
CREATE POLICY "products_select_active"
ON public.products FOR SELECT
USING (is_active = true);

CREATE POLICY "products_select_admin"
ON public.products FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

CREATE POLICY "products_insert_admin"
ON public.products FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

CREATE POLICY "products_update_admin"
ON public.products FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

CREATE POLICY "products_delete_admin"
ON public.products FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

-- -----------------------------------------------------------------------------
-- 6. INVENTORY TABLE
-- -----------------------------------------------------------------------------
CREATE POLICY "inventory_select_all"
ON public.inventory FOR SELECT
USING (true);

CREATE POLICY "inventory_insert_admin"
ON public.inventory FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

CREATE POLICY "inventory_update_admin"
ON public.inventory FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

CREATE POLICY "inventory_delete_admin"
ON public.inventory FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

-- -----------------------------------------------------------------------------
-- 7. PRODUCT_IMAGES TABLE
-- -----------------------------------------------------------------------------
CREATE POLICY "product_images_select_all"
ON public.product_images FOR SELECT
USING (true);

CREATE POLICY "product_images_insert_admin"
ON public.product_images FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

CREATE POLICY "product_images_update_admin"
ON public.product_images FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

CREATE POLICY "product_images_delete_admin"
ON public.product_images FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
  )
);

-- -----------------------------------------------------------------------------
-- 8. SESSIONS TABLE
-- -----------------------------------------------------------------------------
CREATE POLICY "sessions_select_own"
ON public.sessions FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "sessions_insert_own"
ON public.sessions FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "sessions_update_own"
ON public.sessions FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "sessions_delete_own"
ON public.sessions FOR DELETE
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to verify policies are correctly set:
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
