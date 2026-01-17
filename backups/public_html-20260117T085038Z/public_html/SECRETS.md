Secrets storage (DO NOT STORE SENSITIVE DATA IN THIS FILE)

- **GitHub Actions secrets**: stored in the repository `ace1mbj-droid/ace1-sporty-static` (set 2026-01-16).
- **Supabase project secrets**: stored in project ref `vorqavsuqcjnkjzwkyzr` (set 2026-01-16).
- **Vercel**: not linked from this workspace; env vars pending.
- **Netlify**: CLI not installed here; env vars pending.

Security notes
- No plaintext credentials or passwords are stored in this repository.
- Rotate credentials immediately after provisioning to CI/CD and hosting platforms.
- Limit secret scopes, grant least privilege, and enable 2FA on all accounts.
- Verify secret access by checking CI job logs and platform dashboards (do not print secrets in logs).

Verification commands (run locally; require authenticated CLIs)
```bash
# GitHub
gh secret list --repo ace1mbj-droid/ace1-sporty-static

# Supabase
supabase secrets list --project-ref vorqavsuqcjnkjzwkyzr

# Vercel (after linking)
vercel env ls

# Netlify (after installing and auth)
netlify env:list
```

If you want, I can help link Vercel or install Netlify CLI and add the remaining env vars.
