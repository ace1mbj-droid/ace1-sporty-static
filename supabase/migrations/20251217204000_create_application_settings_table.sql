-- Create application_settings table for storing app-level metadata
-- This replaces need for localStorage version tracking

CREATE TABLE IF NOT EXISTS public.application_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    app_version TEXT,
    last_cache_version_update TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
-- RLS Policy: Everyone can read settings, only admins can update
ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_select_public" ON public.application_settings FOR SELECT
USING (true);
CREATE POLICY "app_settings_update_admin" ON public.application_settings FOR UPDATE
USING (security.is_admin())
WITH CHECK (security.is_admin());
-- Insert default row
INSERT INTO public.application_settings (id, app_version) 
VALUES (1, 'v1.0') 
ON CONFLICT (id) DO NOTHING;
