# Admin TOTP (2FA) Setup Guide

## Quick Access

**For admins already logged in:**
1. Go to Admin Panel (`/admin.html`)
2. Click **"TOTP Setup"** button in the top navbar (between "View Site" and "Logout")
3. OR visit directly: `/admin-totp.html`

**For new/resetting admins:**
1. Visit `/admin-login.html`
2. At the bottom of the login form, click **"Manage 2FA/TOTP Setup"**
3. This takes you to `/admin-totp.html` where you can set up your secret

## Step-by-Step TOTP Setup

### 1. Access the TOTP Page
- Navigate to `/admin-totp.html` (after logging in, or from the login page footer link)

### 2. Scan the QR Code
- Open your authenticator app:
  - **Google Authenticator** (Android/iOS)
  - **Microsoft Authenticator** (Android/iOS)
  - **Authy** (Android/iOS/Web)
  - **1Password**, **Bitwarden**, etc.
- Select "Scan QR Code" or "Add Account"
- Point your camera at the QR code displayed on the page
- The app will save your TOTP secret

### 3. Copy Your Secret
- On the TOTP setup page, click **"Copy Secret"** button
- Save this 32-character base32 string in a secure location (password manager, backup)
- **Keep this secret confidential** — anyone with it can generate valid 2FA codes

### 4. Test Your Authenticator
- Your authenticator app will show a 6-digit code that changes every 30 seconds
- The next time you log in to `/admin-login.html`, enter this code in the **"2FA Code"** field
- If correct, you'll be granted admin access

### 5. Rotate Your Secret (Optional)
- If you suspect your secret is compromised, click **"Rotate Secret"** on `/admin-totp.html`
- This generates a new secret and invalidates the old one immediately
- Your authenticator app will stop working until you re-scan the new QR code

## Troubleshooting

### "Supabase not available" Error
- Ensure your server is running and Supabase is properly configured
- Check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in the server `.env`

### Code Not Matching
- Ensure your device time is synced (TOTP is time-based)
- Try the previous or next code if the current one just expired
- Check that you're using the correct authenticator app instance (not a test code)

### Lost Authenticator?
- Contact your system administrator
- As a fallback, the `ADMIN_TOTP_SECRET` environment variable can be used for emergency access (if configured)
- Alternatively, reset via the admin reset password endpoint

## Security Notes

- **Never share your TOTP secret** — it's equivalent to your 2FA code generator
- **Backup your secret** — if you lose access to your authenticator app, you'll need this to regain access
- **Rotate periodically** — use the "Rotate Secret" button to generate a fresh one every 90 days
- **Session expires** — your admin session will eventually time out; you'll be asked to log in again with 2FA

## Technical Details

- **Algorithm:** TOTP (RFC 6238)
- **Time Step:** 30 seconds
- **Code Length:** 6 digits
- **Storage:** Supabase `admin_totp_secrets` table (RLS enforced)
- **Server Endpoints:**
  - `GET /api/admin/totp/active` — fetch active secret + QR
  - `POST /api/admin/totp/rotate` — generate new secret

