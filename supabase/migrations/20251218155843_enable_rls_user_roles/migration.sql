-- Enable RLS on user_roles table and create security policies
-- This fixes the security vulnerability where user roles were publicly accessible

-- Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own role
CREATE POLICY "Users can view own role" ON user_roles
FOR SELECT USING (auth.uid() = user_id);

-- Allow admins to read all roles
CREATE POLICY "Admins can view all roles" ON user_roles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

-- Allow service role to manage all roles (for admin operations)
CREATE POLICY "Service role can manage all roles" ON user_roles
FOR ALL USING (auth.role() = 'service_role');

-- Allow admins to update roles
CREATE POLICY "Admins can update roles" ON user_roles
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);

-- Allow admins to insert roles
CREATE POLICY "Admins can insert roles" ON user_roles
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_admin = true
  )
);
