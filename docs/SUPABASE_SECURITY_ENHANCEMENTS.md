# Supabase Security Enhancements

## 1. Enable Leaked Password Protection

⚠️ **Note: This is a paid feature on Supabase Pro plan** - Not available on the free tier.

Supabase Auth can check passwords against HaveIBeenPwned.org database to prevent users from using compromised passwords.

### What It Does:
- ✅ Prevents users from using passwords that appear in data breaches
- ✅ Checks against HaveIBeenPwned.org (privacy-preserving with k-anonymity)
- ✅ Shows helpful error messages to users about weak/compromised passwords
- ✅ Improves account security automatically

**Alternative for Free Tier:**
- Implement client-side password strength validation
- Display password requirements clearly during registration
- Encourage users to use password managers

---

## 2. Fix Function Search Path

Some custom functions in your database need to have an immutable search_path for security, or should be removed if unused.

### Current Status:
- ✅ `cleanup_expired_sessions` - Fixed
- ⚠️ `function_name` - Appears to be a placeholder/test function

### How to Fix:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy-paste contents of `sql/fix_function_search_path.sql`
3. Run the SQL

This will remove the unused `function_name` function. If it's actually being used, the script includes an alternative to fix the search_path instead.

This prevents SQL injection attacks through search_path manipulation.

---

## Current Security Status

| Item | Status | Action |
|------|--------|--------|
| RLS Enabled | ✅ | All 7 tables secured |
| Leaked Password Protection | ⚠️ | Paid feature (Pro plan required) |
| Function Search Path | ⚠️ | Run SQL fix script |
| SECURITY.md | ✅ | Documented |
| Supabase Policies | ✅ | Implemented |

---

## References

- [Leaked Password Protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Function Search Path Security](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
