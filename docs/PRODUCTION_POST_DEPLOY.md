# Post-deploy checklist — Production

This document lists recommended steps and commands to follow after running a production deploy.

1) Rotate production keys (critical)
   - Immediately rotate any temporary or short-lived keys you used during the deploy, especially service_role keys.
   - For Supabase: rotate the service_role key from the Supabase console (Project -> Settings -> API -> Service key), then update repository secrets:
     - SUPABASE_SERVICE_ROLE_KEY_PROD
     - SUPABASE_DB_URL_PROD (if password rotates)
     - SUPABASE_URL_PROD and SUPABASE_PROJECT_REF_PROD rarely change but re-check.
   - How to update repo secrets (fast via gh CLI):
     ```bash
     # run locally -- do NOT paste secret values into chat
     gh secret set SUPABASE_SERVICE_ROLE_KEY_PROD --repo ace1mbj-droid/ace1-sporty-static --body "$(cat /path/to/new_service_role_key)"
     gh secret set SUPABASE_DB_URL_PROD --repo ace1mbj-droid/ace1-sporty-static --body "$(cat /path/to/new_db_url)"
     ```

2) Verify deployments (already done)
   - The `verify-production-schema.yml` workflow has been run and completed (checking schema + policy). If you need to re-run on an internal runner, register a self-hosted runner and run with `runner=self-hosted`.

3) Health checks / monitoring
   - A simple health-check workflow can be used to keep watch over the public site or a dedicated health endpoint. See `.github/workflows/prod-health-check.yml` (manual + cron).
   - For extra safety, wire health-check alerts into your incident channel (Slack / Ops) or use an external monitoring service (Datadog, NewRelic, UptimeRobot).

4) Logs & quick health verification
   - Review application logs (and RDS / Postgres logs) for the first 30–60 min after deploy.
   - Confirm page load times & API latencies are within expected bounds.

5) Cleanup & tidy PRs
   - Close or merge any stale PRs that are no longer relevant.
   - Delete long-lived feature branches that were merged (we already deleted the feature branch created for this migration).

6) Rollback steps (rare/last resort)
   - If urgent rollback needed, revert the migration commit(s) using MCP or your DB admin, or use the rollback instructions in the PR. For the active_products migration, reverting can be done by renaming the view/table back and restoring the sync table if required.

7) Post-deploy security
   - Rotate keys used for CI, ensure only short-lived keys are used in CI where possible.
   - Document the key rotation in your security/audit log.
