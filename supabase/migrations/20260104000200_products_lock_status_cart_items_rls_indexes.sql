-- Adds product availability fields, fixes cart_items RLS policies,
-- hardens SECURITY DEFINER function search_path, and creates missing FK indexes.

-- 1) Products: add missing availability columns
alter table public.products
  add column if not exists is_locked boolean not null default false,
  add column if not exists status text not null default 'available',
  add column if not exists stock_quantity integer;

-- Backfill in case rows existed before NOT NULL constraints.
update public.products set is_locked = false where is_locked is null;
update public.products set status = 'available' where status is null;

-- Add status constraint (matches production)
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'products'
      and c.conname = 'products_status_check'
  ) then
    alter table public.products
      add constraint products_status_check
      check (status = any (array['available'::text, 'unavailable'::text, 'draft'::text]));
  end if;
end
$$;

-- 2) cart_items: ensure RLS policies exist
alter table public.cart_items enable row level security;

drop policy if exists cart_items_select_own on public.cart_items;
create policy cart_items_select_own
on public.cart_items
for select
to authenticated
using (
  exists (
    select 1
    from shopping_carts sc
    where sc.id = cart_items.cart_id
      and sc.user_id = (select auth.uid() as uid)
  )
);

drop policy if exists cart_items_insert_own on public.cart_items;
create policy cart_items_insert_own
on public.cart_items
for insert
to authenticated
with check (
  exists (
    select 1
    from shopping_carts sc
    where sc.id = cart_items.cart_id
      and sc.user_id = (select auth.uid() as uid)
  )
);

drop policy if exists cart_items_update_own on public.cart_items;
create policy cart_items_update_own
on public.cart_items
for update
to authenticated
using (
  exists (
    select 1
    from shopping_carts sc
    where sc.id = cart_items.cart_id
      and sc.user_id = (select auth.uid() as uid)
  )
)
with check (
  exists (
    select 1
    from shopping_carts sc
    where sc.id = cart_items.cart_id
      and sc.user_id = (select auth.uid() as uid)
  )
);

drop policy if exists cart_items_delete_own on public.cart_items;
create policy cart_items_delete_own
on public.cart_items
for delete
to authenticated
using (
  exists (
    select 1
    from shopping_carts sc
    where sc.id = cart_items.cart_id
      and sc.user_id = (select auth.uid() as uid)
  )
);

-- 3) Harden SECURITY DEFINER function search_path (matches production)
alter function public._ensure_cart_for_session(text)
  set search_path = 'public', 'extensions';

-- 4) FK-covering indexes (matches production)
create index if not exists cart_items_cart_id_idx on public.cart_items (cart_id);
create index if not exists cart_items_product_id_idx on public.cart_items (product_id);
create index if not exists categories_parent_id_idx on public.categories (parent_id);
create index if not exists inventory_product_id_idx on public.inventory (product_id);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);
create index if not exists orders_coupon_id_idx on public.orders (coupon_id);
create index if not exists orders_shipping_method_id_idx on public.orders (shipping_method_id);
create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
create index if not exists page_views_page_url_idx on public.page_views (page_url);
create index if not exists page_views_user_id_idx on public.page_views (user_id);
create index if not exists page_views_visitor_id_idx on public.page_views (visitor_id);
create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists product_images_product_id_idx on public.product_images (product_id);
create index if not exists product_deletion_audit_deleted_by_idx on public.product_deletion_audit (deleted_by);
