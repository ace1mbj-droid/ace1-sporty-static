-- Add admin_api_url to site_settings
-- Idempotent: adds the column only if it doesn't already exist.
BEGIN;

-- Add the column to store the function URL (nullable, text)
ALTER TABLE IF EXISTS public.site_settings
ADD COLUMN IF NOT EXISTS admin_api_url text;

-- No default value — CI will upsert the value when functions deploy.

COMMIT;
