-- Disable RLS on user_roles to prevent recursive policy evaluation
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Ensure authenticated and service_role have CRUD access for admin checks
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO service_role;
