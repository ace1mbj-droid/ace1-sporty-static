-- Fix RLS Policies for Admin User (hello@ace1.in)
-- This script allows the authenticated admin user to perform CRUD operations

-- 1. PRODUCTS table RLS
-- First, disable RLS to allow initial fix
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- Then re-enable and create proper policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow admin select" ON products;
DROP POLICY IF EXISTS "Allow admin insert" ON products;
DROP POLICY IF EXISTS "Allow admin update" ON products;
DROP POLICY IF EXISTS "Allow admin delete" ON products;

-- Create new policies that allow authenticated users to select
CREATE POLICY "Allow select for all authenticated users"
ON products FOR SELECT
TO authenticated
USING (true);

-- Allow insert for authenticated users (will rely on app-level validation)
CREATE POLICY "Allow insert for authenticated users"
ON products FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow update for authenticated users
CREATE POLICY "Allow update for authenticated users"
ON products FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow delete for authenticated users
CREATE POLICY "Allow delete for authenticated users"
ON products FOR DELETE
TO authenticated
USING (true);

-- 2. INVENTORY table RLS
DROP POLICY IF EXISTS "Allow admin select" ON inventory;
DROP POLICY IF EXISTS "Allow admin insert" ON inventory;
DROP POLICY IF EXISTS "Allow admin update" ON inventory;
DROP POLICY IF EXISTS "Allow admin delete" ON inventory;

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for all authenticated users"
ON inventory FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow insert for authenticated users"
ON inventory FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users"
ON inventory FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated users"
ON inventory FOR DELETE
TO authenticated
USING (true);

-- 3. PRODUCT_IMAGES table RLS
DROP POLICY IF EXISTS "Allow admin select" ON product_images;
DROP POLICY IF EXISTS "Allow admin insert" ON product_images;
DROP POLICY IF EXISTS "Allow admin update" ON product_images;
DROP POLICY IF EXISTS "Allow admin delete" ON product_images;

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for all authenticated users"
ON product_images FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow insert for authenticated users"
ON product_images FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users"
ON product_images FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated users"
ON product_images FOR DELETE
TO authenticated
USING (true);
