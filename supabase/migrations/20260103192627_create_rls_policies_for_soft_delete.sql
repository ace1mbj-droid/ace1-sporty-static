
-- Enable RLS on products table if not already enabled
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "anon_select_active_products" ON public.products;
DROP POLICY IF EXISTS "auth_select_active_products" ON public.products;
DROP POLICY IF EXISTS "admin_select_all_products" ON public.products;

-- Policy for public/anon users: only see active, non-deleted products
CREATE POLICY "anon_select_active_products" ON public.products
    FOR SELECT
    TO anon
    USING (
        is_active = true 
        AND deleted_at IS NULL
    );

-- Policy for authenticated users (customers): only see active, non-deleted products
CREATE POLICY "auth_select_active_products" ON public.products
    FOR SELECT
    TO authenticated
    USING (
        CASE 
            -- If user is admin (has admin role), show all products
            WHEN auth.jwt() ->> 'user_role' = 'admin' THEN true
            -- Otherwise, only show active non-deleted products
            ELSE (is_active = true AND deleted_at IS NULL)
        END
    );

-- Policy for insert (admin only)
CREATE POLICY "admin_insert_products" ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.jwt() ->> 'user_role' = 'admin'
    );

-- Policy for update (admin only)
CREATE POLICY "admin_update_products" ON public.products
    FOR UPDATE
    TO authenticated
    USING (
        auth.jwt() ->> 'user_role' = 'admin'
    )
    WITH CHECK (
        auth.jwt() ->> 'user_role' = 'admin'
    );

-- Policy for delete (admin only, but soft delete via updated trigger)
CREATE POLICY "admin_delete_products" ON public.products
    FOR DELETE
    TO authenticated
    USING (
        auth.jwt() ->> 'user_role' = 'admin'
    );
;
