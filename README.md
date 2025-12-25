# Shoes — Sporty Bold Starter (Static)

This repo is a simple static starter for Shoes (health & fitness shoes) built with the Sporty Bold template.

Features
- Sporty visual theme optimized for high-impact seasonal marketing.
- Product grid backed by `data/products.json` (use it to add/edit products).
- Client-side cart & Stripe mock demo checkout (no server required).
- Quick-start instructions for local dev.

Quick start
1. Serve locally (macOS zsh):

```bash
# From workspace root
cd /Users/jai_das13/Development/ACE#1/ace1-sporty-static
python3 -m http.server 8000
# open http://localhost:8000
```

2. Add or edit products in `data/products.json`.

3. For a real Stripe integration you will need a server to create sessions; the current demo uses `scripts/stripe-mock.js` which simulates success in test mode.

Supabase integration & server-side flow
-------------------------------------

1. SQL & RLS
	- Open Supabase Studio > SQL Editor and paste the SQL schema from `supabase/schema.sql`.
	- Apply RLS policies from `supabase/rls.sql` (enable row-level security and add policies).

2. Edge Functions
	- The Edge Functions skeletons are in `supabase/functions`:
	- `create-order` — creates DB order with service role, calls Razorpay server API and inserts a `payments` record. NOTE: This function now performs server-side product validation and will reject orders containing:
		- products with `is_locked = true` (locked/unavailable)
		- products with insufficient `stock_quantity` for the requested quantity
		- products whose `status` is not 'available'
		This prevents clients from bypassing availability rules and keeps inventory consistent.
	  - `webhook-razorpay` — receives webhook events and updates `payments` and `orders`.
	- Set env vars in Supabase Functions config: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RZ_KEY`, `RZ_SECRET`.

3. Frontend
	- To have the frontend call the `create-order` Edge Function, set the global variable `window.__SHOES_EDGE_CREATE_ORDER__` to the Edge endpoint URL in `index.html`.
	- The frontend will attempt to call the Edge Function and open Razorpay checkout flow if using Razorpay.

4. GitHub Actions (FTP Deploy & Health-check)
	- `.github/workflows/deploy.yml` — Main deployment workflow with FTP upload and health-check
	- `.github/workflows/ftp_deploy_only.yml` — Manual FTP-only deployment for testing

5. Testing & next steps
	- Set up Razorpay webhook to point to your `webhook-razorpay` function URL.
	- Demo checkout uses `scripts/stripe-mock.js` without server. If you want to use the server flow, configure `window.__SHOES_EDGE_CREATE_ORDER__`.

Security notes
--------------
- Never store the Supabase service role key in your frontend or GitHub secrets. Use the Supabase Functions environment for secrets.
- For admin create/update product functionality, use Edge Functions protected by an `is_admin` claim or the `user_roles` table added to the schema.

Notes
- Product images are pulled from Unsplash for placeholder purposes.
- If you want GA or Plausible tracking, I can add them.

Next steps I can do for you
- Add real Stripe checkout backend (Node/Express example) or integrate with Checkout Sessions.
- Add an interactive product detail modal or product pages.
- Convert to a Vite + React + Tailwind starter for componentization.

Automated Supabase + FTP deployment
----------------------------------

I added an automated GitHub Actions workflow that:

- applies your DB schema & RLS policies
- deploys Supabase Edge Functions found in `supabase/functions`
- sets secure Razorpay secrets in Supabase
- uploads built static assets to an FTP/SFTP host

Files to review:
- `.github/workflows/deploy_supabase_and_ftp.yml` — runs on push to `main` and performs the entire infra + FTP deploy.
- `scripts/deploy_supabase.sh` — local script to run the same steps yourself (needs environment variables set).

GitHub secrets to set (FTPS-only)
- `SUPABASE_ACCESS_TOKEN` — personal supabase CLI token
- `SUPABASE_PROJECT_REF` — the Supabase project ref id
- `SUPABASE_DB_URL` — postgres connection string with privileges to run SQL (service role preferred)
 - `SUPABASE_KEY` — optional server/project key for trusted server code (keep secret)
 - `SUPABASE_SERVICE_ROLE_KEY` — service-role key used by CI and server-side scripts for admin actions. Store this in CI secrets or a secure environment and avoid exposing it in frontend code.
 - New helper script: `scripts/create_admin.js` — uses `SUPABASE_SERVICE_ROLE_KEY` to create or update an `admin` user with a PBKDF2 hashed password. See `docs/admin-setup.md` for usage.
- `RZ_KEY` and `RZ_SECRET` — Razorpay keys
- `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` — FTP credentials (FTPS implicit TLS, port 990)
- `SITE_DOMAIN` — e.g., `ace1.in` (used by deploy+verify health-check)

Example local deploy command:

```bash
SUPABASE_ACCESS_TOKEN=abc SUPABASE_PROJECT_REF=xyz SUPABASE_DB_URL=postgres://... RZ_KEY=... RZ_SECRET=... ./scripts/deploy_supabase.sh
```

Advanced options:
 - Replace direct `psql` schema execution with Supabase migrations (recommended) and call `supabase db push` in CI.

CI migrations and secure DB access
---------------------------------

I added a migration under `supabase/migrations/20251121090000_init_schema.sql` so you can track schema changes with Supabase migrations.

To apply migrations from CI the recommended approach is:

- Use the Supabase CLI in CI to push migrations: `npx supabase db push --linked --yes`. This workflow already attempts this in `.github/workflows/deploy_supabase_and_ftp.yml`.

- Important: pushing migrations safely from CI requires the runner to have access to the project's database. There are three ways to get secure DB access from CI:

	1) Self-hosted runner (recommended for production migrations): run the workflow on a self-hosted runner inside your network (or with a secure route/VPN to the DB). This runner has predictable network access and avoids exposing credentials broadly.

	2) Allowlist GitHub Actions egress IPs (difficult): you can configure your DB firewall to allow GitHub's IP ranges, but these change and are harder to maintain; it's usually not the best option for production.

	3) Use a secure automation host or operator: run migrations from an operations host you control (CI job can create a short-lived ticket and a separate automated job will pull migration artifacts and apply them from a trusted host).

- Notes on tokens/keys:
	- `SUPABASE_ACCESS_TOKEN` (CI secret) is used by the Supabase CLI to authenticate. Use a dedicated token limited to the necessary projects.
	- Avoid putting `SERVICE_ROLE_KEY` in public/shared CI secrets. If you must, ensure the secret is scoped and stored securely and that the workflow checks expected constraints.

Rotate / revoke keys & purging history (recommended if secrets leaked)
---------------------------------------------------------------

If you discover a leaked service_role key, DB connection string, or other secrets in repository files or local temp artifacts, rotate them immediately. Below are recommended steps and example commands.

1. Rotate Supabase service_role key (in Supabase dashboard):

	- Supabase Console → Settings → API → Generate new SERVICE_ROLE key
	- Replace keys in your CI Secrets (e.g., SUPABASE_SERVICE_ROLE_KEY_STAGING / SUPABASE_SERVICE_ROLE_KEY)
	- Revoke any previous keys if the platform supports revocation

2. Rotate DB credentials (if DB URL leaked):

	- Create a new DB user + password with the same or stricter privileges, then update SUPABASE_DB_URL in CI secrets and any hosts that use it.

3. Purge repository history (only if secrets were committed)

	- Use git-filter-repo or BFG on a local mirror and force-push the cleaned repo. This rewrites history and will require all collaborators to re-clone.

	Example with git-filter-repo (recommended):

	```bash
	# Create a mirror clone
	git clone --mirror git@github.com:<owner>/ace1-sporty-static.git repo.git
	cd repo.git

	# Remove the path(s) that contain secrets (example: supabase/.temp)
	git filter-repo --path supabase/.temp --invert-paths

	git push --force --all
	git push --force --tags
	```

	IMPORTANT: coordinate with your team before rewriting history — everyone will need to re-clone after this.

MCP staging workflow (new)
-------------------------

I added a staging-only MCP workflow at `.github/workflows/mcp-staging-deploy.yml`. It is intentionally scoped to the `staging` branch and `workflow_dispatch` so it doesn't run automatically on `main`.

Required GitHub Secrets for the staging workflow (add these to the repository or org secrets):

 - `SUPABASE_PROJECT_REF_STAGING` — staging project ref id
 - `SUPABASE_URL_STAGING` — staging SUPABASE_URL (https://<project>.supabase.co)
 - `SUPABASE_SERVICE_ROLE_KEY_STAGING` — service role key for staging (keep this secret and rotate if leaked)

Use these staging-specific secrets so production credentials are never used accidentally by the staging workflow.

If you want, I can: convert the rest of the DB DDL into smaller migration files, add a `supabase/migrations/` best-practices note, or show how to wire up a self-hosted runner (I can add a quick GitHub Actions instructions snippet for that). 

CI deploy trigger: small doc update to kick off GitHub Actions workflow (automated by assistant) — 2025-11-21
- Use `supabase secrets` to manage function environment variables; these are mounted into Edge Functions securely.

Preview deploy usage
--------------------
Preview has been removed. Use `FTPS Deploy + Verify (manual)` to publish to `/` and run the health-check.

Health-check & permissions normalization
---------------------------------------
- Use `FTP health-check + temporary .htaccess test (manual)` to diagnose 403 issues; it will list remote files and perform HEAD/GET checks and optional `.htaccess` rename/restore.
- `FTP health-check autorun (push)` runs on every push to `main`.
- If 403 persists, run `FTP permissions normalize (manual)` to set directories to 755 and files to 644, or rely on the chained normalization.

GitHub & Supabase: Full setup from scratch
----------------------------------------

1) Create GitHub repo & push code

	# UI (recommended) — create a new repo on GitHub, then push this project. Or via CLI:

	```bash
	# With GitHub CLI installed (https://cli.github.com/)
	gh repo create ace1-sporty-static --public
	git init
	git add .
	git commit -m "Initial commit"
	git branch -M main
	git remote add origin git@github.com:<you>/ace1-sporty-static.git
	git push -u origin main
	```

2) Add GitHub Secrets (CI & infra)

	- Quick: use `gh` to set secrets (replace placeholders):

	```bash
	export GITHUB_REPO="<owner/ace1-sporty-static>"
	export SUPABASE_ACCESS_TOKEN="<from supabase settings>"
	export SUPABASE_PROJECT_REF="<your project ref>"
	export SUPABASE_DB_URL="postgres://user:pass@host:port/postgres"
	export RZ_KEY="<razorpay key_id>"
	export RZ_SECRET="<razorpay key_secret>"
	export FTP_HOST="<ftp.host.net>"
	export FTP_USER="<ftpuser>"
	export FTP_PASSWORD="<ftppassword>"

	./scripts/setup_github_secrets.sh
	```

3) Create a Supabase project

	- Go to https://app.supabase.com — create new project. Save `SUPABASE_URL` and `ANON_KEY` for frontend use and `SERVICE_ROLE_KEY` in a safe place for admin/Edge functions.

4) Run schema & RLS (choose CLI or UI)

	- UI: in Supabase Studio > SQL -> run `supabase/schema.sql` and `supabase/rls.sql`.
	- CLI: create `SUPABASE_DB_URL` and run:

	```bash
	psql "${SUPABASE_DB_URL}" -f supabase/schema.sql
	psql "${SUPABASE_DB_URL}" -f supabase/rls.sql
	```

5) Create storage buckets

	- In Supabase Storage > Create bucket `product-images` and configure public access or signed URLs.

6) Deploy Supabase Edge Functions

	- Install supabase CLI (`npm i -g supabase`), login: `supabase login --token <token>`.
	- Link project: `supabase link --project-ref <your-ref>`.
	- Deploy: `supabase functions deploy create-order` and `supabase functions deploy webhook-razorpay`.
	- Set env vars for functions via `supabase secrets set RZ_KEY=<...> RZ_SECRET=<...>`.

7) Configure Razorpay & webhooks

	- In Razorpay settings, add webhook URL: `https://<YOUR_SUPABASE_FUNCTION_URL>/webhook-razorpay`.
	- Use the Razorpay dashboard to test `payment.captured` test events.

8) Deploy frontend via GitHub Actions

	- Push to `main` and GitHub Actions workflow `.github/workflows/deploy_supabase_and_ftp.yml` will run and deploy both Supabase parts and static site to FTP.

9) Smoke tests & verify

	- Check Supabase functions > Deployment history
	- Visit FTP-hosted domain to verify site
	- Checkout flow: if using `EDGE_CREATE_ORDER` it will call the Edge function. Test with demo users.

If you want, I can also: create a migration folder and replace `psql` usage with `supabase db push` in the CI workflow (recommended). Reply `migrations please` and I’ll scaffold the migration folder for you.
