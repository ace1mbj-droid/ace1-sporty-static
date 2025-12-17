-- Ensure admin user hello@ace1.in has proper access
-- This migration ensures the user exists in user_roles and updates security.is_admin() function

-- Step 1: Insert/Update hello@ace1.in in user_roles table with is_admin=true
-- Get the user_id from auth.users
DO $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Get the UUID for hello@ace1.in from auth.users
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'hello@ace1.in'
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- Insert or update user_roles entry
        INSERT INTO public.user_roles (user_id, is_admin)
        VALUES (v_user_id, true)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            is_admin = true;
            
        RAISE NOTICE 'Admin user % added/updated in user_roles', v_user_id;
    ELSE
        RAISE WARNING 'User hello@ace1.in not found in auth.users - cannot add to user_roles';
    END IF;
END $$;

-- Step 2: Update security.is_admin() function with better logic
-- This checks user_roles first, then falls back to users.role, then checks email
CREATE OR REPLACE FUNCTION security.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION security.is_admin() TO anon, authenticated, service_role;

-- Also update the UUID version
CREATE OR REPLACE FUNCTION security.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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
GRANT EXECUTE ON FUNCTION security.is_admin(uuid) TO anon, authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION security.is_admin() IS 'Returns true if current user is admin (checks user_roles.is_admin, users.role, or email=hello@ace1.in)';
COMMENT ON FUNCTION security.is_admin(uuid) IS 'Returns true if given user is admin (checks user_roles.is_admin, users.role, or email=hello@ace1.in)';
