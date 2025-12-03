Admin setup & password reset (safe)
=================================

This document explains how to create or reset an admin user safely using the repository tools (no UI required).

Prerequisites
-------------
- A Supabase project with the `users` table used by the app
- A SUPABASE_SERVICE_ROLE_KEY available locally or in CI (do not store this key in public places)

Quick steps — create / reset the admin user
-----------------------------------------
1. Set environment variables locally (recommended):

   - SUPABASE_PROJECT_REF or SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - (optional) ADMIN_EMAIL (default: admin@ace1.in)
   - (optional) ADMIN_PASSWORD (default: admin123) — choose a strong password

2. Run the helper script from the repository root:

   ```bash
   # Example — set env vars and run
   export SUPABASE_SERVICE_ROLE_KEY="sbp_xxx..."
   export SUPABASE_PROJECT_REF="your-project-ref"
   export ADMIN_EMAIL="admin@ace1.in"
   export ADMIN_PASSWORD="choose-a-strong-password"
   node scripts/create_admin.js
   ```

What the script does
---------------------
- Uses the service-role Supabase client (scripts/supabase-admin.js) to upsert a user with role 'admin'.
- Hashes the password using PBKDF2 (100,000 iterations) and stores the hash in `users.password_hash` using the same format the frontend expects (`$pbkdf2$iterations$salt$hash`).

Security notes
--------------
- The service-role key is powerful: run this script locally or in a secure CI environment and avoid committing the key into source control.
- Choose a strong admin password and rotate the service-role key if it ever leaks.

Next steps
----------
- After the script finishes, open `admin-login.html` and login with the admin credentials. The UI will allow admin-only actions from the admin panel.
- If you'd rather not run the script, you can use the `templates/ghosty/admin-password-migration.html` page to generate a secure hash and update the user via Supabase SQL editor.
