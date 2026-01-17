-- Allow the admin UI to remove duplicate/old site_settings rows safely.
-- Keeps behavior consistent with existing "app logic handles admin check" approach.

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.site_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to delete rows (used by admin cleanup action)
DROP POLICY IF EXISTS "site_settings_delete_authenticated" ON public.site_settings;
CREATE POLICY "site_settings_delete_authenticated"
ON public.site_settings
FOR DELETE
TO authenticated
USING (true);
