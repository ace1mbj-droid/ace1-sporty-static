# Changelog

All notable changes to this project will be documented in this file.

## 2026-01-16 — ci/improve-ftp-deploy
- Replace external FTP deploy action with an `lftp`-based deploy; add a non-fatal FTP health-check with retries/backoff and improved logging for diagnostics.

	- Removed third-party FTP deploy action due to persistent FTP connection timeouts and incompatibility with our FTP server. Migrated to lftp-based deploy for reliability and better error handling.

## 2026-01-16 — ci/improve-ftp-deploy
- Replace external FTP deploy action with an `lftp`-based deploy; add a non-fatal FTP health-check with retries/backoff and improved logging for diagnostics.

	- Removed third-party FTP deploy action due to persistent FTP connection timeouts and incompatibility with our FTP server. Migrated to lftp-based deploy for reliability and better error handling.
## 2025-12-05 — v2025.12.05-prod-migration
- Convert `active_products` table to read-only `active_products` view; hardened revoke RPCs, product_changes audit and RLS, E2E fixes, verified and deployed.
