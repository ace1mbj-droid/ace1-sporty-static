# Supabase Security Enhancements

## 1. Enable Leaked Password Protection

Supabase Auth can check passwords against HaveIBeenPwned.org database to prevent users from using compromised passwords.

### How to Enable:

1. Go to **Supabase Dashboard** → Your Project
2. Click **Authentication** in the left sidebar
3. Go to **Policies** tab
4. Look for **Password Strength & Leaked Password Protection**
5. Toggle **Enable Password Strength & Leaked Password Protection** to ON

### What It Does:
- ✅ Prevents users from using passwords that appear in data breaches
- ✅ Checks against HaveIBeenPwned.org (privacy-preserving with k-anonymity)
- ✅ Shows helpful error messages to users about weak/compromised passwords
- ✅ Improves account security automatically

---

## 2. Fix Function Search Path

Some custom functions in your database need to have an immutable search_path for security.

### How to Fix:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy-paste contents of `sql/fix_function_search_path.sql`
3. Run the SQL

This prevents SQL injection attacks through search_path manipulation.

---

## Current Security Status

| Item | Status | Action |
|------|--------|--------|
| RLS Enabled | ✅ | All 7 tables secured |
| Leaked Password Protection | ⚠️ | Enable in Auth settings |
| Function Search Path | ⚠️ | Run SQL fix script |
| SECURITY.md | ✅ | Documented |
| Supabase Policies | ✅ | Implemented |

---

## References

- [Leaked Password Protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Function Search Path Security](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
