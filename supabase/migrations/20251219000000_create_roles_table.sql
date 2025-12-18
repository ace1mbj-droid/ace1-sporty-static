-- Create roles table for role definitions
-- This table stores role templates that can be assigned to users

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage roles
CREATE POLICY "Admins can manage roles" ON public.roles
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND is_admin = true
    )
);

-- Insert default roles
INSERT INTO public.roles (name, description, permissions) VALUES
('owner', 'Full system access with all permissions', '{"products": true, "orders": true, "customers": true, "analytics": true, "settings": true, "users": true}'),
('manager', 'Management access for daily operations', '{"products": true, "orders": true, "customers": true, "analytics": true, "settings": false, "users": false}'),
('editor', 'Content editing access for products', '{"products": true, "orders": false, "customers": false, "analytics": false, "settings": false, "users": false}')
ON CONFLICT (name) DO NOTHING;