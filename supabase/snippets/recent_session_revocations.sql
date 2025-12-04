-- Saved snippet: Recent session revocations
-- Purpose: Quickly inspect recent session revocations (audit table `public.session_revocations`).
-- Usage: Paste into Supabase SQL editor and click Save snippet (or run immediately).

-- 1) Most recent revocations (latest 200)
SELECT
  sr.id,
  sr.revoked_at,
  sr.revoked_by,
  sr.reason,
  sr.token,
  sr.user_id,
  COALESCE(u.email, '<unknown>') AS user_email
FROM public.session_revocations sr
LEFT JOIN public.users u ON u.id = sr.user_id
ORDER BY sr.revoked_at DESC
LIMIT 200;

-- 2) Example: revocations in the last 7 days
-- Uncomment and run the block below if you want a windowed view
--
-- SELECT
--   sr.id,
--   sr.revoked_at,
--   sr.revoked_by,
--   sr.reason,
--   sr.token,
--   sr.user_id,
--   COALESCE(u.email, '<unknown>') AS user_email
-- FROM public.session_revocations sr
-- LEFT JOIN public.users u ON u.id = sr.user_id
-- WHERE sr.revoked_at >= now() - interval '7 days'
-- ORDER BY sr.revoked_at DESC;
