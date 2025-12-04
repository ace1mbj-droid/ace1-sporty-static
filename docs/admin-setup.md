Admin setup & password reset
============================

Use this doc any time you need to create or reset the `hello@ace1.in` administrator without going through the UI.

Current default
---------------
- The seeding script (`sql/seed_admin.sql`) now ships with a secure PBKDF2 hash that corresponds to the temporary password **TempAdmin#4821**. This is meant to get into the dashboard quickly—change it immediately.

Generate a new hash (no backend access needed)
----------------------------------------------
NOTE: The local HTML helper (`admin-password-migration.html`) is intentionally removed from the repository for security after one-off use. You can still generate a compatible PBKDF2 hash locally — two options:

- In the browser (local): open any page in your working tree that loads `js/password-hasher.js`, open DevTools Console and run:

```js
// Example in browser console — DO THIS LOCALLY
await window.passwordHasher.hashPassword('your-new-password-here');
```

- With Node.js (local, non-network):

```js
// run from repository root (Node installed)
node -e "const crypto=require('crypto'); const pw='YourNewStrongPass'; const iterations=100000; const salt=crypto.randomBytes(16).toString('hex'); const hash=crypto.pbkdf2Sync(pw, Buffer.from(salt,'hex'), iterations, 32, 'sha256').toString('hex'); console.log(`$pbkdf2$${iterations}$${salt}$${hash}`);
```

Copy the hash from either method and apply it with SQL (below). Never paste your password or the hash on a public server or in public chat.

Apply the hash in Supabase
--------------------------
**Option A – run a one-off UPDATE**

```sql
UPDATE public.users
SET password_hash = '<paste hash here>'
WHERE lower(email) = 'hello@ace1.in';
```

**Option B – run the seed script with an override** (useful when rebuilding environments):

```sql
SET ace1.admin_password_hash = '<paste hash here>';
\i sql/seed_admin.sql
RESET ace1.admin_password_hash;
```

Both options also ensure the `sessions` and `user_roles` helpers point at the same admin account. Option B recreates the session token defined inside the seed file.

Security notes
--------------
- Run the HTML tool and SQL statements locally or over MCP/VPN only. Do not deploy `admin-password-migration.html` to production hosting.
- Store the new password in a secure vault and rotate it periodically. Delete any temporary copies of the hash once it has been applied.

Next steps
----------
- Visit `admin-login.html`, sign in with the updated password, and verify you can load protected data.
- If you rely on the header-based flow, set the `ace1-session` header to the seeded token (`token_admin_1764844118`) or create a fresh session from the admin UI after logging in.
