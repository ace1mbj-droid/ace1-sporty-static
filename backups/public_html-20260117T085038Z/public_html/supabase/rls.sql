-- Enable RLS and policies for orders, order_items, payments

alter table if exists orders enable row level security;
alter table if exists order_items enable row level security;
alter table if exists payments enable row level security;

-- allow users to select their own orders
drop policy if exists select_own_orders on orders;
create policy select_own_orders on orders
  for select using (auth.uid() = user_id);

-- allow insert: user can create orders for themselves
drop policy if exists insert_orders_user on orders;
create policy insert_orders_user on orders
  for insert with check (auth.uid() = user_id);

-- allow user to update limited fields (e.g., cancel)
drop policy if exists update_own_orders on orders;
create policy update_own_orders on orders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- order_items: users can read items of their own orders
drop policy if exists select_order_items_own on order_items;
create policy select_order_items_own on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

-- products public read
alter table if exists products enable row level security;
drop policy if exists public_select_products on products;
create policy public_select_products on products
  for select using (true);

-- allow read access to product_images
alter table if exists product_images enable row level security;
drop policy if exists public_select_product_images on product_images;
create policy public_select_product_images on product_images
  for select using (true);

-- Admin-only operations should be routed through Edge Functions using service_role
