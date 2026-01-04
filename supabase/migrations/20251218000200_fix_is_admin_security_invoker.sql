-- Fix security.is_admin() to use SECURITY INVOKER instead of DEFINER
-- SECURITY DEFINER doesn't have proper access to auth.uid() in RLS context

-- Recreate the no-argument version with SECURITY INVOKER
CREATE OR REPLACE FUNCTION security.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER  -- Changed from DEFINER to INVOKER
AS $$
  SELECT COALESCE(
    -- Check user_roles table first
    (
      SELECT ur.is_admin 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      LIMIT 1
    ),
    -- Fall back to users.role column
    (
      SELECT (u.role = 'admin')
      FROM public.users u
      WHERE u.id = auth.uid()
      LIMIT 1
    ),
    -- Special case: hello@ace1.in is always admin
    (
      SELECT (u.email = 'hello@ace1.in')
      FROM public.users u
      WHERE u.id = auth.uid()
      LIMIT 1
    ),
    false
  );
$$;
-- Recreate the UUID version with SECURITY INVOKER
CREATE OR REPLACE FUNCTION security.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER  -- Changed from DEFINER to INVOKER
AS $$
  SELECT COALESCE(
    -- Check user_roles table first
    (
      SELECT ur.is_admin 
      FROM public.user_roles ur 
      WHERE ur.user_id = uid
      LIMIT 1
    ),
    -- Fall back to users.role column
    (
      SELECT (u.role = 'admin')
      FROM public.users u
      WHERE u.id = uid
      LIMIT 1
    ),
    -- Special case: hello@ace1.in is always admin
    (
      SELECT (u.email = 'hello@ace1.in')
      FROM public.users u
      WHERE u.id = uid
      LIMIT 1
    ),
    false
  );
$$;
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION security.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION security.is_admin(uuid) TO anon, authenticated, service_role;
-- Add comments
COMMENT ON FUNCTION security.is_admin() IS 'Returns true if current user is admin (checks user_roles.is_admin, users.role, or email=hello@ace1.in) - SECURITY INVOKER';
COMMENT ON FUNCTION security.is_admin(uuid) IS 'Returns true if given user is admin (checks user_roles.is_admin, users.role, or email=hello@ace1.in) - SECURITY INVOKER';
