FTP health-check + temporary .htaccess test
========================================

What this does
---------------
This repository contains manual and autorun GitHub Actions workflows that perform safe, reversible host-level diagnostics:

- OPTION: temporarily rename /public_html/.htaccess to a timestamped backup
- HEAD + GET checks of the configured site URL before and after the rename (HTTP status & key headers)
- list /public_html entries with permissions to confirm index.html presence
- restore .htaccess back to the original name when finished
- optional chained permissions normalization (dirs 755, files 644)

Why use this
------------
When an FTP deploy successfully places your static files on the host (index.html present) but the public site returns 403, .htaccess may be blocking public access. This test checks if removing/renaming .htaccess changes the HTTP response.

How to run (manual workflow)
----------------------------
1. In the GitHub UI, open the Actions tab for this repository.
2. Find "FTP health-check + temporary .htaccess test (manual)".
3. Click "Run workflow" (manually dispatch) and set:
   - domain: https://ace1.in (or any domain you want to test)
   - run_rename: true (will perform the rename+restore); set false for dry-run health-check only.
   - use_ftps: true (recommended; falls back to plain ftp if false)
4. Start the job. Wait until it completes.

Outputs you'll get
------------------
- INITIAL_STATUS  — HTTP status code before any change
- AFTER_RENAME_STATUS — HTTP status code right after the .htaccess rename
- Final status — after restore

How to interpret results
------------------------
- If INITIAL_STATUS is 403 and AFTER_RENAME_STATUS is 200 (or another non-403): .htaccess was likely blocking access — review the .htaccess rules with your host.
- If both INITIAL_STATUS and AFTER_RENAME_STATUS stay 403: the restriction is likely server-level (e.g., hosting panel domain mapping, virtualhost, or platform firewall) — you'll need host logs or panel access.
 - Also check GET status outputs (ROOT_GET_STATUS, INDEX_GET_STATUS). Some hosts block HEAD while GET is fine; GET status 200 indicates origin is serving content.

Safety & guarantees
--------------------
- The workflow makes a timestamped backup (e.g., .htaccess.bak-20251121T120000Z) and restores it automatically.
- The workflow uses the repo's FTP secrets: FTP_HOST, FTP_USER, FTP_PASSWORD. It will not modify any files other than the single /public_html/.htaccess (rename + restore).
- The `FTP health-check autorun (push)` variant runs automatically on pushes to `main` with the default domain; a chained workflow can normalize permissions after a successful run.

Next steps after a run
----------------------
- Reply with the run logs and status codes (or paste them here) and I will analyze the outcome and propose the next remediation steps.

Related workflows
-----------------
- `.github/workflows/ftp_healthcheck_htaccess_test.yml` — manual health-check and .htaccess rename/restore.
- `.github/workflows/ftp_healthcheck_autorun.yml` — autorun health-check on push to `main`.
- `.github/workflows/chain_normalize_on_healthcheck.yml` — automatically normalize permissions (dirs 755, files 644) after autorun health-check completes.
- `.github/workflows/ftp_permissions_normalize.yml` — run permissions normalization manually for any remote directory.
