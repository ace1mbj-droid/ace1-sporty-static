-- Tighten public products visibility to enforce availability constraints at the DB boundary.

-- Anonymous users: only active, not deleted, not locked, available
drop policy if exists anon_view_active_products on public.products;
create policy anon_view_active_products
on public.products
for select
to anon
using (
  is_active = true
  and deleted_at is null
  and is_locked = false
  and status = 'available'::text
);

-- Authenticated users: admins see all; everyone else sees only public-eligible products
drop policy if exists auth_view_products on public.products;
create policy auth_view_products
on public.products
for select
to authenticated
using (
  case
    when security.is_admin() then true
    else (
      is_active = true
      and deleted_at is null
      and is_locked = false
      and status = 'available'::text
    )
  end
);
