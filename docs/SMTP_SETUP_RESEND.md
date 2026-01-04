# SMTP Setup (Resend) for Supabase Auth

Goal: have Supabase Auth emails (Confirm signup / Reset password / Magic link) send **from `hello@ace1.in`** instead of Supabase branding.

Important: this cannot be done purely in code. You must configure SMTP in the Supabase Dashboard and verify your domain in the email provider.

## Why Resend

Resend is usually the fastest path to “working SMTP + good deliverability” with a simple dashboard.

## Steps

### 1) Create a Resend account

- Sign up at https://resend.com

### 2) Add and verify your domain (`ace1.in`)

- In Resend: **Domains → Add domain → `ace1.in`**
- Resend will show DNS records to add (these vary per account):
  - DKIM (one or more `CNAME` records)
  - SPF (`TXT` record, often `v=spf1 include:... ~all`)
  - Recommended: DMARC (`TXT` at `_dmarc.ace1.in`)

Add those DNS records in your DNS provider (Cloudflare/GoDaddy/Namecheap/etc), then wait until Resend shows “Verified”.

### 3) Create SMTP credentials in Resend

- In Resend: **SMTP** / **API Keys** (UI may vary)
- Create SMTP credentials (host/port/username/password)

### 4) Configure Supabase to use your SMTP

In Supabase Dashboard:

- Go to **Authentication → Settings → Email / SMTP**
- Enable **Custom SMTP**
- Set:
  - **SMTP Host**: (from Resend)
  - **SMTP Port**: 587 (typical for STARTTLS)
  - **SMTP User**: (from Resend)
  - **SMTP Password**: (from Resend)
  - **From email**: `hello@ace1.in`
  - **From name**: `ACE#1`

### 5) Update Supabase email templates

- Go to **Authentication → Templates**
- Update **Confirm signup** to remove Supabase branding.
- Use the template in [docs/AUTH_EMAIL_BRANDING.md](docs/AUTH_EMAIL_BRANDING.md)

## Troubleshooting

- If emails go to spam: confirm SPF + DKIM are verified in Resend.
- If verification links break: disable “link tracking” in the email provider.
- If some inboxes show warnings: add DMARC and ensure From matches the verified domain.
