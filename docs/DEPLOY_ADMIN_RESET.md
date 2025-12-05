Deploying the admin reset serverless function
===========================================

You can deploy the admin-reset logic as a secure serverless function. The repository includes two deployment options:

- Supabase Edge Function (recommended for this project)
- Vercel / Netlify serverless (alternative)

1) Supabase Edge Function (recommended)
---------------------------------------

Files: `supabase/functions/admin-reset/index.ts`

Prerequisites:
- supabase CLI installed and authenticated
- Your Supabase project configured with a `service_role` key available as an environment secret for the function

Deploy steps (example):

1. Move into the repo and deploy the function:

```bash
# Login and select project if needed
supabase login
supabase link --project-ref <your-project-ref>

# Deploy the function from repo root
supabase functions deploy admin-reset --project-ref <your-project-ref>
```

2. Configure the function's environment secrets (in Supabase dashboard or via CLI):

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<your_service_role_key>" --project-ref <your-project-ref>
supabase secrets set SUPABASE_URL="https://<your-project>.supabase.co" --project-ref <your-project-ref>
```

3. The function will be available at:

https://<project>.functions.supabase.co/admin-reset

4. Update the admin UI in production to point to this function URL. The client uses the configuration `window.ADMIN_API_URL` (set it globally, or via site settings) to call the serverless endpoint. Example:

```html
<script>
  // set runtime variable on production admin page
  window.ADMIN_API_URL = 'https://<project>.functions.supabase.co/admin-reset';
</script>
```

Security notes:
- The function must only accept calls from authenticated admin users. In our implementation the function validates the caller by using the admin's session token (supabase /auth/v1/user) and checks the admin email `hello@ace1.in`.
- The SUPABASE_SERVICE_ROLE_KEY must only be stored in secure server environment (Supabase function secrets, Vercel environment secrets, or similar) and must not be present in client code.

2) Vercel / Netlify serverless
------------------------------
If you prefer to host a serverless endpoint on Vercel or Netlify, you can use the `server/index.js` file as a basis (Node + Express). Deploy the `server` folder as a serverless function (Vercel style) and add the same environment variables as secrets:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Make sure to restrict the function to authenticated admin sessions (the function verifies the session token similarly to the Edge Function) and place the service_role key in server-only environment settings.

---

If you'd like, I can:
- Deploy the function to your Supabase project for you if you provide access and the project ref, or
- Prepare a Vercel function and an example `vercel.json` for you to deploy, or
- Update the production admin page to set the final `window.ADMIN_API_URL` automatically from your site settings table.

Continuous deployment via GitHub Actions
--------------------------------------

This repo includes a GitHub Actions workflow `.github/workflows/deploy-admin-reset.yml` which deploys the `admin-reset` function to Supabase when code is pushed to `main` (or manually triggered).

Required GitHub secrets for the workflow to succeed:
- SUPABASE_ACCESS_TOKEN — a personal access token for the supabase CLI (used to authenticate the CLI; set it in your repo secrets)
- SUPABASE_PROJECT_REF — your Supabase project ref (example: abcd1234)
- SUPABASE_SERVICE_ROLE_KEY — the Supabase service_role key (used to set function secrets) — store this in GitHub secrets and it will be set into the function during deployment

Optional secret:
- ALLOW_PRODUCTION_DEPLOY — set to 'true' to allow automatic deploys from pushes to `main`; otherwise run the workflow manually with `workflow_dispatch`.

Email notifications (optional)
-----------------------------
If you want the function to notify users after their password is reset, add SendGrid (or another provider) secrets to GitHub and the function will be configured during deployment:

- SENDGRID_API_KEY — your SendGrid API key
- SENDGRID_FROM — the from address to use when sending notifications (example: no-reply@yourdomain.com)

If these are set, the function will attempt to send a short notification email to the target user after the reset.

Notes:
- The workflow deploys using `npx supabase functions deploy admin-reset --use-api` (no Docker required) and attempts to set the service_role key as a function secret.
- After deployment, update your production admin page to set `window.ADMIN_API_URL` to the function's URL (or set `window.SUPABASE_FUNCTIONS_URL` to the functions host).

