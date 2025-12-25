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
  show_on_index boolean default true,
  deleted_at timestamptz,
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
  payment_status text default 'pending',
  total_cents int not null,
  currency text default 'INR',
  shipping_address jsonb,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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

-- shopping carts
create table if not exists shopping_carts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  session_id text,
  product_id uuid not null references products(id),
  quantity integer not null default 1 check (quantity > 0),
  size text,
  added_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- reviews
create table if not exists reviews (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references products(id),
  user_id uuid not null references auth.users(id),
  user_email text not null,
  user_name text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  title text not null,
  comment text,
  verified_purchase boolean default false,
  helpful_count integer default 0,
  unhelpful_count integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- users table (public view of auth.users)
create table if not exists users (
  id uuid references auth.users(id) primary key,
  email text,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz default now()
);

-- user roles for admin permissions
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean default false
);

-- site settings
create table if not exists site_settings (
  id integer primary key default 1 check (id = 1),
  site_name text default 'ACE#1',
  site_description text,
  contact_email text,
  support_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- security logs
create table if not exists security_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  action text not null,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- session revocations
create table if not exists session_revocations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  session_id text,
  reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- product changes history
create table if not exists product_changes (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references products(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null, -- 'created', 'updated', 'deleted'
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

-- password reset logs
create table if not exists password_reset_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  email text not null,
  token_hash text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

-- application settings
create table if not exists application_settings (
  id integer primary key default 1 check (id = 1),
  app_version text,
  last_cache_version_update timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
