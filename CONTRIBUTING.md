# Contributing

Thanks for contributing to ACE#1!

Please follow these guidelines so CI and reviewers can process your PR quickly.

Database / Migrations
---------------------
- If you modify SQL files under `sql/`, `supabase/functions/` or `supabase/schema.sql`, you must include a migration in `supabase/migrations/` that implements the same change. Keep migrations scoped and focused.
- The project has a PR check which will fail the PR if schema or function changes are not accompanied by migration files.
- Never commit database dumps, backups, or full snapshots to the repository. Those must stay out of version control and be stored in secure backup systems.

Security & secrets
------------------
- Do not commit credentials, API keys, service role keys, or SSH secrets into the repo. Use CI/GitHub Secrets for workflows and environment-specific vaults for servers.
- The repository CI will reject files that look like dumps/backups and protects revocation RPCs by requiring service-role use.

Pull Request process
--------------------
- Open a PR and ensure your branch runs all checks.
- Keep PRs small and focused; include test coverage where applicable.

If you have any questions about migrations or the release flow, ping the maintainers (hello@ace1.in).
