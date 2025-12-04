-- Simplified RLS Policies - Allow all operations
-- This assumes app-level validation (checking that only hello@ace1.in can access admin)

-- 1. PRODUCTS table - Allow all authenticated AND anon access
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for all authenticated users" ON products;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON products;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON products;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON products;

-- Allow SELECT for everyone
CREATE POLICY "Allow select for all"
ON products FOR SELECT
USING (true);

-- Allow INSERT for everyone (app validates who is admin)
CREATE POLICY "Allow insert for all"
ON products FOR INSERT
WITH CHECK (true);

-- Allow UPDATE for everyone
CREATE POLICY "Allow update for all"
ON products FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow DELETE for everyone
CREATE POLICY "Allow delete for all"
ON products FOR DELETE
USING (true);

-- 2. INVENTORY table
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for all authenticated users" ON inventory;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON inventory;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON inventory;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON inventory;

CREATE POLICY "Allow select for all"
ON inventory FOR SELECT
USING (true);

CREATE POLICY "Allow insert for all"
ON inventory FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update for all"
ON inventory FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete for all"
ON inventory FOR DELETE
USING (true);

-- 3. PRODUCT_IMAGES table
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for all authenticated users" ON product_images;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON product_images;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON product_images;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON product_images;

CREATE POLICY "Allow select for all"
ON product_images FOR SELECT
USING (true);

CREATE POLICY "Allow insert for all"
ON product_images FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update for all"
ON product_images FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete for all"
ON product_images FOR DELETE
USING (true);
