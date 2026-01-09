-- Update admin_api_url to point to admin-save function for server-side admin operations
UPDATE site_settings
SET admin_api_url = 'https://vorqavsuqcjnkjzwkyzr.supabase.co/functions/v1/admin-save'
WHERE id = 1;

-- Verify the update
SELECT id, admin_api_url, updated_at FROM site_settings WHERE id = 1;