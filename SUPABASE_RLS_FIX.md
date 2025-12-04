# Supabase RLS Security Fix

## Overview

Your Supabase database has **Row Level Security (RLS) disabled** on 5 critical tables:
- `payments` - Payment information
- `user_roles` - User role assignments
- `site_settings` - Site configuration
- `users` - User accounts
- `security_logs` - Security audit trail

This is a **critical security vulnerability** that could allow unauthorized access to sensitive data.

## Impact

Without RLS:
- ❌ Any authenticated user could access all payments data
- ❌ Any user could see and modify other users' roles
- ❌ Site settings could be modified by anyone
- ❌ Any user could view all other users' data
- ❌ Security logs could be accessed by unauthorized users

## Solution

A migration script has been created: `sql/enable_rls_security.sql`

### Steps to Apply:

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Click "SQL Editor" in the sidebar

2. **Open the SQL Script**
   - Copy the contents of `sql/enable_rls_security.sql`
   - Paste into the SQL Editor

3. **Run the SQL**
   - Click "Run" or press Cmd+Enter
   - Wait for confirmation that all statements executed successfully

4. **Verify**
   - Go to "Authentication" → "Policies"
   - Confirm all 5 tables have policies enabled

### What Each Policy Does:

**Payments Table:**
- Users can only view/insert their own payments
- Admin can see all payments

**User Roles Table:**
- Users can only view their own role
- Admin can see all user roles
- Only admin can modify

**Site Settings Table:**
- Public can read settings (needed for site to function)
- Only admin can update/insert/delete

**Users Table:**
- Users can only view/update their own profile
- Admin can view and update all users

**Security Logs Table:**
- Only admin can view logs
- System can insert logs automatically
- No deletion allowed (audit trail integrity)

## Testing

After applying RLS, test that:

1. ✅ Public content still loads (homepage, products)
2. ✅ Admin can access admin dashboard
3. ✅ Regular users can only see their own orders/profile
4. ✅ Product upload/management still works for admin

## Additional Security Recommendations

1. **Enable 2FA** on your Supabase account
2. **Restrict API Key Access** - Use Row Level Security instead of relying on API keys
3. **Audit Logs** - Review security_logs table regularly
4. **Backup** - Enable automated backups in Supabase settings
5. **Monitor** - Set up alerts for unauthorized access attempts

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Linter Guide](https://supabase.com/docs/guides/database/database-linter)
- [Security Best Practices](https://supabase.com/docs/guides/platform/security)
