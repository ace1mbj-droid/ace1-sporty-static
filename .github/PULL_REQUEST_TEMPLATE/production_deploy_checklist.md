<!-- Production PR checklist template: use this for migration/deploy PRs targeting production -->
## Production deployment checklist 🔒

Before merging, ensure each of the following boxes is verified and checked by the PR author or an assigned reviewer.

- [ ] Confirm all tests pass in CI (unit, integration, E2E where applicable).
- [ ] Run `supabase/snippets/verify_schema.sql` against staging and confirm green (use verify-staging-schema.yml).
- [ ] Confirm the `verify-production-schema.yml` workflow can reach the production DB (run as self-hosted or GitHub-runner depending on networking). Use `SUPABASE_DB_URL_PROD` for verification.
- [ ] Validate no destructive changes (migration renames or creates views; confirm data is preserved/backed up if needed).
- [ ] Add a short maintenance window schedule and confirm stakeholders are aware (if needed).
- [ ] Confirm GitHub 'production' environment requires reviewers and that approved reviewer(s) are present.
- [ ] Ensure production secrets are in repo settings and are short-lived or rotated after use:
  - SUPABASE_PROJECT_REF_PROD
  - SUPABASE_URL_PROD
  - SUPABASE_SERVICE_ROLE_KEY_PROD
  - SUPABASE_DB_URL_PROD (for verification)
- [ ] Final manual verification: run `verify-production-schema` and check the verification output carefully.

Post-merge steps (follow quickly after deploy):
- [ ] Monitor application and DB for anomalies for 30-60 minutes.
- [ ] Rotate production service-role keys per policy and record rotation in audit.
- [ ] If rollback needed, follow the rollback steps outlined in the PR description.

Notes:
- This template is intended for changes that affect production DB schema, critical data migrations, or anything requiring a gated deploy.
