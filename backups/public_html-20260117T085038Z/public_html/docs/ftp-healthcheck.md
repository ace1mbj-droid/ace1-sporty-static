FTP health-check + temporary .htaccess test
========================================

What this does
---------------
This repository contains manual and autorun GitHub Actions workflows that perform safe, reversible host-level diagnostics:

- OPTION: temporarily rename /.htaccess to a timestamped backup
- HEAD + GET checks of the configured site URL before and after the rename (HTTP status & key headers)
- list / entries with permissions to confirm index.html presence
- restore .htaccess back to the original name when finished
- optional chained permissions normalization (dirs 755, files 644)

Why use this
------------
When an FTP deploy successfully places your static files on the host (index.html present) but the public site returns 403, .htaccess may be blocking public access. This test checks if removing/renaming .htaccess changes the HTTP response.

How to run (manual workflow)
----------------------------
FTP health-check is integrated into the main deploy workflow. To run a health check:

1. In the GitHub UI, open the Actions tab for this repository.
2. Find "Build & FTP Deploy" workflow.
3. Click "Run workflow" (manually dispatch).
4. The workflow includes automatic FTP health-check after deployment.

Outputs you'll get
------------------
- FTP connection test results
- File listing verification
- HTTP status checks

How to interpret results
------------------------
- If FTP connection succeeds but site returns 403: Check .htaccess rules with your host
- If FTP connection fails: Verify FTP credentials and server details
- If files are listed but site doesn't load: Check file permissions and server configuration

Safety & guarantees
--------------------
- The workflow uses the repo's FTP secrets: FTP_HOST, FTP_USER, FTP_PASSWORD
- No files are modified during health-check operations
- Health-check runs after successful FTP deployment

Next steps after a run
----------------------
- Reply with the run logs and status codes (or paste them here) and I will analyze the outcome and propose the next remediation steps.

Related workflows
-----------------
- `.github/workflows/deploy.yml` — Main deployment workflow with integrated FTP health-check
- `.github/workflows/ftp_deploy_only.yml` — Manual FTP-only deployment
