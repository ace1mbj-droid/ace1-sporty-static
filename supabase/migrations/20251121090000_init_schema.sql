-- Migration: initial schema for ACE#1
-- Generated from supabase/schema.sql on 2025-11-21

-- products
CREATE TABLE products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sku text,
  name text NOT NULL,
  short_desc text,
  long_desc text,
  price_cents int NOT NULL,
  currency text DEFAULT 'INR',
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- product images
CREATE TABLE product_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  storage_path text,
  alt text,
  position int DEFAULT 1
);

-- inventory (size variants)
CREATE TABLE inventory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  size text,
  stock int DEFAULT 0
);

-- orders
CREATE TABLE orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  status text DEFAULT 'pending',
  total_cents int NOT NULL,
  currency text DEFAULT 'INR',
  shipping_address jsonb,
  created_at timestamptz DEFAULT now()
);

-- order items
CREATE TABLE order_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  size text,
  qty int,
  price_cents int
);

-- payments
CREATE TABLE payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES orders(id),
  provider text,
  provider_order_id text,
  status text,
  amount_cents int,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Optional user_roles table for admin flag
CREATE TABLE user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean DEFAULT false
);
