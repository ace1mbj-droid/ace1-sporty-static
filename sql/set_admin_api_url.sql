-- Set the admin API URL for server-side admin actions (password reset, etc.)
-- This has been applied to production database on 2025-12-17

UPDATE site_settings 
SET 
    admin_api_url = 'https://vorqavsuqcjnkjzwkyzr.supabase.co/functions/v1/admin-reset',
    updated_at = NOW()
WHERE id = 1;

-- Example URLs (choose one and replace YOUR_DEPLOYMENT_URL):
-- Vercel: https://your-project.vercel.app/api/admin-reset
-- Netlify: https://your-site.netlify.app/.netlify/functions/admin-reset
-- Supabase Edge Functions: https://vorqavsuqcjnkjzwkyzr.supabase.co/functions/v1/admin-reset
-- Custom server: https://your-domain.com/api/admin/reset-user-password

-- Verify the update
SELECT id, admin_api_url, updated_at FROM site_settings WHERE id = 1;
