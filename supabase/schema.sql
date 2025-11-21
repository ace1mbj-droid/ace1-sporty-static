-- Supabase schema for ACE#1

-- products
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  sku text,
  name text not null,
  short_desc text,
  long_desc text,
  price_cents int not null,
  currency text default 'INR',
  category text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- product images
create table if not exists product_images (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references products(id) on delete cascade,
  storage_path text,
  alt text,
  position int default 1
);

-- inventory (size variants)
create table if not exists inventory (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references products(id) on delete cascade,
  size text,
  stock int default 0
);

-- orders
create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
  status text default 'pending',
  total_cents int not null,
  currency text default 'INR',
  shipping_address jsonb,
  created_at timestamptz default now()
);

-- order items
create table if not exists order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  size text,
  qty int,
  price_cents int
);

-- payments
create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references orders(id),
  provider text,
  provider_order_id text,
  status text,
  amount_cents int,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Optional user_roles table for admin flag
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean default false
);
