# Auth Email Branding (Supabase)

This project uses Supabase Auth for signup/confirmation and password recovery emails.

If you are seeing an email like:

- Subject: "Confirm your signup"
- Body: "You're receiving this email because you signed up for an application powered by Supabase"

…that text comes from the **Supabase Auth Email Templates** (and the sender name/address comes from **SMTP settings**), not from this repo’s HTML/JS.

## 1) Change the email content (template)

In Supabase Dashboard:

1. Go to **Authentication → Templates**
2. Select **Confirm signup**
3. Replace the subject/body with your branded version.

If you have **zero DNS access**, this is the main thing you can (and should) do.

### Recommended template (Confirm signup)

**Subject**

Confirm your ACE#1 account

**HTML body**

```html
<h2>Confirm your ACE#1 account</h2>
<p>Hi {{ .Email }},</p>
<p>Thanks for signing up. Please confirm your email address to activate your account:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
<p>If you didn’t create this account, you can ignore this email.</p>
<hr>
<p>Need help? Contact us at <a href="mailto:hello@ace1.in">hello@ace1.in</a></p>
```

Notes:
- `{{ .ConfirmationURL }}` is the verification link provided by Supabase.
- You can personalize with metadata via `{{ .Data }}` if you store it in `auth.users.user_metadata`.

Copy/paste versions for all common templates live in:
- [docs/email-templates/confirm-signup.html](docs/email-templates/confirm-signup.html)
- [docs/email-templates/reset-password.html](docs/email-templates/reset-password.html)
- [docs/email-templates/magic-link.html](docs/email-templates/magic-link.html)
- [docs/email-templates/change-email.html](docs/email-templates/change-email.html)
- [docs/email-templates/invite-user.html](docs/email-templates/invite-user.html)

## 2) Change the sender to hello@ace1.in (SMTP)

If your “From” shows Supabase branding, configure **Custom SMTP**.

If you do not have access to DNS records for `ace1.in` (for example no registrar/DNS access), you can still update the **template content** and often the **sender name**, but you cannot reliably change the **From email address** to `hello@ace1.in`.

### No-DNS option: make it look like ACE#1 anyway

With zero DNS access, do this:

1. Supabase Dashboard → **Authentication → Templates**
2. Replace the default template bodies to remove the Supabase footer/branding.
3. Add your own footer, e.g. “Need help? hello@ace1.in”.

If Supabase exposes a **Sender name** field for default sending in your project, set it to `ACE#1`. If it doesn’t, include “ACE#1” in the subject and in the email footer.

In Supabase Dashboard:

1. Go to **Authentication → Settings → Email / SMTP** (naming varies slightly)
2. Enable **Custom SMTP**
3. Configure your provider (SendGrid/Mailgun/Postmark/Resend/etc)
4. Set:
   - **From email**: `hello@ace1.in`
   - **From name**: `ACE#1` (or your preferred brand name)

Deliverability requirements (done in your domain DNS/provider):
- Add **SPF** record for the SMTP provider
- Add **DKIM** record(s) for the SMTP provider
- Recommended: add **DMARC**

Without proper SPF/DKIM, many inboxes will show warnings or rewrite the sender.

## 3) Optional: Manage templates via API

Supabase supports updating auth mailer subjects/templates via the Management API.
See: https://supabase.com/docs/guides/auth/auth-email-templates

This is useful for keeping templates consistent across environments.

## 4) Gotchas

- If your email provider enables link tracking, it can break `{{ .ConfirmationURL }}`. Disable link tracking.
- Some providers (notably Microsoft Safe Links) may prefetch links and consume the token. If you hit this, consider OTP (`{{ .Token }}`) or a two-step confirmation page.
