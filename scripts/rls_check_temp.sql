select schemaname, tablename, policyname, cmd, coalesce(with_check::text, '') as with_check, coalesce(using::text, '') as using
from pg_policies
where tablename = any(ARRAY['csrf_tokens','order_items','page_views','payments','security_logs','sessions','site_settings']);