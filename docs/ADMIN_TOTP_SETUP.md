# Admin TOTP (2FA) — Removed

Two-factor authentication (TOTP/email codes) has been fully removed from this project as of December 2025.

- Admin login no longer requires or supports a 2FA code.
- Any previous references to `/admin-totp.html` or verification endpoints have been deprecated.

## Alternatives

If you need strong account protection, use unique passwords and secure credential storage, and enable multi-factor on your Supabase account itself.

This document remains for historical reference only.

—

—

—

## Notes

Admin TOTP endpoints and storage were retired; the server no longer exposes these routes.

—

—

## Security Notes

- Use unique, strong passwords and change them periodically.
- Protect admin credentials with secure storage (password manager).
- Enable MFA on your Supabase account for console access.

## Technical Details

The prior TOTP storage table and server endpoints have been decommissioned.

