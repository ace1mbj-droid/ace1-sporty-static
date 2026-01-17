-- Enable RLS on user_roles table and create security policies
-- This fixes the security vulnerability where user roles were publicly accessible
-- Also fixes infinite recursion issue in policies

-- Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create a security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid AND is_admin = true
  );
$$;

-- Allow users to read their own role
CREATE POLICY "Users can view own role" ON user_roles
FOR SELECT USING (auth.uid() = user_id);

-- Allow service role to manage all roles (for admin operations)
CREATE POLICY "Service role can manage all roles" ON user_roles
FOR ALL USING (auth.role() = 'service_role');

-- Allow admins to view all roles (using security definer function)
CREATE POLICY "Admins can view all roles" ON user_roles
FOR SELECT USING (public.is_admin());

-- Allow admins to update roles (using security definer function)
CREATE POLICY "Admins can update roles" ON user_roles
FOR UPDATE USING (public.is_admin());

-- Allow admins to insert roles (using security definer function)
CREATE POLICY "Admins can insert roles" ON user_roles
FOR INSERT WITH CHECK (public.is_admin());
