## Admin server-side reset (overview)

We've added a small server helper (non-public) to perform admin-only resets of other users. It uses the Supabase service_role key to update a user's password and revoke their sessions.

Files:
- `server/index.js` — small Express server exposing POST `/api/admin/reset-user-password`
- `server/.env.example` — environment example

How it works:
- Admin calls this endpoint from the admin UI (client must be signed-in as the admin user) and includes their session token in the Authorization header.
- The server verifies the admin session by calling Supabase's `/auth/v1/user` and checks the admin email (default policy: `hello@ace1.in`).
- If verified, the server uses the SUPABASE_SERVICE_ROLE_KEY to update the user's password via Supabase admin API and clears sessions for the user.

Audit logging & notifications:
- The function will record every admin-initiated reset in `password_reset_logs` (a new DB table); it records admin id/email, target id/email, IP and user-agent.
- Optionally, it can send a notification email to the target user after the reset when `SENDGRID_API_KEY` and `SENDGRID_FROM` secrets are configured for the function.

Security notes:
- Deploy this server behind your private network or as a protected serverless function (do NOT embed the service_role key in client code).
- The admin's client must be able to reach this server (same origin or proxy) for the admin UI to call it securely.
Admin password reset options
===========================

This project exposes a few safe ways to change or reset an admin password.

1) Change while logged in
  - Navigate to: `admin.html` (or `user-profile.html`) and use the Change Password form.
  - You must enter the current password.

2) Forgot current password (Send reset link)
  - On the Admin Dashboard, open the Password Manager panel (element id `password-change-container`).
  - Click the **Send Reset Email** button — this triggers Supabase's password reset email to the admin account (uses `supabase.auth.resetPasswordForEmail`).
  - Use the email link to set a new password and then sign in.

3) Supabase Studio (manual admin reset)
  - Go to your Supabase dashboard → Auth → Users, find `hello@ace1.in`, and use the UI to set a new password.

4) Server-side reset (advanced)
  - For automated resets of other users, build a secure server-side endpoint using your service_role key that hashes the password with the app's PBKDF2 settings and updates `users.password_hash`, then clears sessions.

Security notes
--------------
- Never store or expose `service_role` in client-side code.
- Prefer Supabase's reset-email flow or Studio for interactive admin resets.
- After any reset, invalidate sessions so old tokens stop working.
