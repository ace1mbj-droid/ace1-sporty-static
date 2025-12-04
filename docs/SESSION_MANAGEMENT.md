# Session management & revocation helpers

This document shows how to call the revocation RPCs and how the audit logging works.

The database provides two helper functions (RPCs) to remove sessions and log revocations:

- revoke_session_by_token(t text, p_revoked_by text DEFAULT NULL, p_reason text DEFAULT NULL, p_ip text DEFAULT NULL, p_user_agent text DEFAULT NULL)
- revoke_sessions_for_email(p_email text, p_revoked_by text DEFAULT NULL, p_reason text DEFAULT NULL, p_ip text DEFAULT NULL, p_user_agent text DEFAULT NULL)

Both functions require the caller to be the `service_role` (they are meant to be executed by server-side code or the CLI with the service key) and return the number of sessions removed.

When a revocation runs the matching sessions are inserted into `public.session_revocations` with these columns:
- token, user_id, revoked_by, reason, ip_address, user_agent, revoked_at

Example: call the RPC using curl and the `service_role` key (replace $SERVICE_ROLE):

```bash
curl -s -X POST "https://<your-proj>.supabase.co/rest/v1/rpc/revoke_session_by_token" \
  -H "apikey: $SERVICE_ROLE" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"t":"token_admin_abc123","p_revoked_by":"admin@yourcompany.com","p_reason":"one-time access cleanup","p_ip":"203.0.113.10","p_user_agent":"cli/1.0"}'
```

Example (revoke all sessions by email):

```bash
curl -s -X POST "https://<your-proj>.supabase.co/rest/v1/rpc/revoke_sessions_for_email" \
  -H "apikey: $SERVICE_ROLE" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"p_email":"hello@ace1.in","p_revoked_by":"ops@example.com","p_reason":"incident response","p_ip":"203.0.113.5","p_user_agent":"ops-tool/0.4"}'
```

If you call the RPC without `p_ip` or `p_user_agent`, the columns will be null — they are optional.
