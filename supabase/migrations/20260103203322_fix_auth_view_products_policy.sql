-- Drop the broken policy
DROP POLICY IF EXISTS "auth_view_products" ON products;

-- Recreate with proper admin check using security.is_admin() function
CREATE POLICY "auth_view_products" ON products
FOR SELECT TO authenticated
USING (
    CASE 
        WHEN security.is_admin() THEN true
        ELSE (is_active = true AND deleted_at IS NULL)
    END
);;
