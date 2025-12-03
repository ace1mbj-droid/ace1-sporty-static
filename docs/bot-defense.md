# Bot Defense Integration (hCaptcha + Supabase Edge)

This project now performs full hCaptcha verification before any sensitive workflows (login, register, admin login, contact form, password reset). Use this guide to configure and deploy the Supabase Edge Function plus the required environment variables.

## 1. Required Secrets

Add the following secrets/variables wherever you deploy Supabase Edge Functions (Supabase Dashboard → Project Settings → Functions → Environment Variables or your CI workflow):

| Key | Description |
| --- | --- |
| `HCAPTCHA_SECRET_KEY` | hCaptcha secret key (never commit this). |
| `HCAPTCHA_SITE_KEY` | Public site key (optional, used for validation telemetry). |
| `BOT_ALLOWED_ORIGINS` | Comma-separated list of allowed origins (e.g. `https://ace1.in,https://www.ace1.in`). Leave blank to allow all origins during development. |
| `SUPABASE_PROJECT_REF` | Already used by other functions; required for CI deployment. |
| `SUPABASE_ACCESS_TOKEN` | Already used by other functions; required for CI deployment. |

## 2. Deploy the Edge Function

The new function lives at `supabase/functions/verify-hcaptcha` and exposes `POST /functions/v1/verify-hcaptcha`.

```
cd ace1-sporty-static
supabase functions deploy verify-hcaptcha --project-ref <PROJECT_REF>
```

For local testing:

```
supabase functions serve verify-hcaptcha --env-file supabase/.env.local
```

The CLI will watch for changes to `index.ts` and reload automatically.

## 3. Frontend Expectations

- `js/hcaptcha-config.js` now sets `window.HCAPTCHA_VERIFY_ENDPOINT` to the Supabase Functions URL derived from `SUPABASE_CONFIG.url`. Override it if you proxy through a different domain.
- `js/bot-defense.js` exposes `window.verifyHCaptchaWithServer(token, { action })` and is automatically included on every protected page.
- Forms marked with `data-requires-hcaptcha="true"` block submission until the widget is solved **and** the server-side check returns success.

## 4. Rollout Checklist

1. Update `HCAPTCHA_SITE_KEY` in `js/hcaptcha-config.js` if the key changes.
2. Provision `HCAPTCHA_SECRET_KEY` and (optionally) `BOT_ALLOWED_ORIGINS` in Supabase.
3. Deploy `verify-hcaptcha` using the Supabase CLI or CI workflow.
4. Smoke test each page (login, register, admin login, contact, forgot password) to ensure the widget renders and the verification request returns HTTP 200.
5. Monitor Supabase Edge Function logs for any `verify-hcaptcha` warnings/errors to fine-tune allowed origins or hCaptcha site settings.

## 5. Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| Frontend error “Verification service unavailable” | `window.HCAPTCHA_VERIFY_ENDPOINT` empty or unreachable. | Confirm `SUPABASE_CONFIG.url` and deploy the Edge Function. |
| Function returns 403 “Origin not allowed” | Request origin not listed in `BOT_ALLOWED_ORIGINS`. | Update the env var with the deployed hostname(s). |
| hCaptcha always fails | Secret key invalid or site key mismatch. | Verify the keys in the hCaptcha dashboard and redeploy env variables. |

With these steps, bots must defeat the server-side hCaptcha challenge before any sensitive action succeeds.
