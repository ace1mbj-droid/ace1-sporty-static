# Fix Supabase Security Linter Errors

**Date**: December 4, 2025  
**Status**: Ready to Deploy

## 🚨 Issues Found

Supabase Database Linter detected **4 critical security errors**:

### 1. `active_products` View with SECURITY DEFINER (ERROR)
- **Issue**: View executes with creator's permissions instead of querying user
- **Risk**: Privilege escalation - users could bypass RLS policies
- **Fix**: Recreate view with `SECURITY INVOKER` (default)

### 2. `site_settings` Table Missing RLS (ERROR)
- **Issue**: RLS not enabled on public table
- **Risk**: Any user could read/modify site settings
- **Fix**: Enable RLS + add admin-only policies

### 3. `users` Table Missing RLS (ERROR)
- **Issue**: RLS not enabled on custom user profiles table
- **Risk**: Users could read/modify other users' data
- **Fix**: Enable RLS + add user-scoped policies

### 4. `security_logs` Table Missing RLS (ERROR)
- **Issue**: RLS not enabled on security audit logs
- **Risk**: Any user could read/delete security logs
- **Fix**: Enable RLS + add admin-only policies

---

## ✅ Quick Fix (5 minutes)

### Apply Database Security Fixes

**Run in Supabase SQL Editor**:

1. Open: https://supabase.com/dashboard/project/_/sql
2. Copy contents of: `sql/fix_security_issues.sql`
3. Paste and click **Run**

Expected output:
```
✅ Recreated active_products view (SECURITY INVOKER)
✅ Created/secured users table with RLS
✅ Created/secured site_settings table with RLS
✅ Created/secured security_logs table with RLS
✅ All policies created
```

---

## 🔍 What Changed

### active_products View
**Before**:
```sql
CREATE VIEW active_products AS
SELECT * FROM products
WHERE deleted_at IS NULL AND is_active = true;
-- Defaults to SECURITY DEFINER on some Postgres versions
```

**After**:
```sql
CREATE VIEW active_products 
WITH (security_invoker = true) AS
SELECT * FROM products
WHERE deleted_at IS NULL AND is_active = true;
-- Explicitly uses SECURITY INVOKER (querying user's permissions)
```

### users Table (Custom Profiles)
```sql
-- Table structure
CREATE TABLE public.users (
    id UUID PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id),
    email TEXT,
    full_name TEXT,
    phone TEXT,
    address JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- RLS Policies
✅ users_select_own - Users can view their own profile
✅ users_insert_own - Users can create their own profile
✅ users_update_own - Users can update their own profile
✅ users_select_admin - Admins can view all users
```

### site_settings Table
```sql
-- Table structure
CREATE TABLE public.site_settings (
    id UUID PRIMARY KEY,
    site_title TEXT,
    site_description TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    instagram_url TEXT,
    maintenance_mode BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- RLS Policies
✅ site_settings_select_all - Everyone can read settings
✅ site_settings_update_admin - Only admins can update
✅ site_settings_insert_admin - Only admins can insert
```

### security_logs Table
```sql
-- Table structure
CREATE TABLE public.security_logs (
    id UUID PRIMARY KEY,
    event TEXT,
    details JSONB,
    user_agent TEXT,
    ip_address TEXT,
    user_id UUID,
    timestamp TIMESTAMPTZ
);

-- RLS Policies
✅ security_logs_select_admin - Only admins can view logs
✅ security_logs_insert_all - Anyone can insert (for tracking)
✅ security_logs_delete_admin - Only admins can delete
```

---

## 🧪 Verification

After running the SQL script, verify all issues are fixed:

### 1. Check View Security Mode
```sql
SELECT 
    schemaname, 
    viewname,
    definition
FROM pg_views
WHERE viewname = 'active_products';
```

Should show view definition without SECURITY DEFINER mention.

### 2. Check RLS Status
```sql
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'site_settings', 'security_logs')
ORDER BY tablename;
```

All should show `rowsecurity = true`.

### 3. Check Policies
```sql
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'site_settings', 'security_logs')
ORDER BY tablename, policyname;
```

Should show 10 policies total:
- **users**: 4 policies (select_own, insert_own, update_own, select_admin)
- **site_settings**: 3 policies (select_all, update_admin, insert_admin)
- **security_logs**: 3 policies (select_admin, insert_all, delete_admin)

### 4. Re-run Supabase Linter
1. Go to: https://supabase.com/dashboard/project/_/database/linter
2. Click **Run Linter**
3. All 4 errors should be resolved ✅

---

## 📊 Security Impact

| Table/View | Before | After |
|------------|--------|-------|
| `active_products` | ⚠️ SECURITY DEFINER | ✅ SECURITY INVOKER |
| `users` | ❌ No RLS | ✅ RLS + 4 policies |
| `site_settings` | ❌ No RLS | ✅ RLS + 3 policies |
| `security_logs` | ❌ No RLS | ✅ RLS + 3 policies |

**Total Policies Added**: 10  
**Security Risk Level**: Critical → **None** ✅

---

## 🔒 Policy Logic

### users Table
- **SELECT**: Users can only see their own profile OR admins see all
- **INSERT**: Users can only create their own profile
- **UPDATE**: Users can only update their own profile
- **DELETE**: Not allowed (use soft delete)

### site_settings Table
- **SELECT**: Public read access (anyone can view)
- **INSERT/UPDATE**: Admin-only (requires `user_roles.is_admin = true`)
- **DELETE**: Not allowed (use update to disable)

### security_logs Table
- **SELECT**: Admin-only (requires `user_roles.is_admin = true`)
- **INSERT**: Public write (allows security event tracking)
- **DELETE**: Admin-only (for log maintenance)

---

## 🎯 Best Practices

### For Views
✅ **DO**: Use `WITH (security_invoker = true)` explicitly  
❌ **DON'T**: Rely on default SECURITY DEFINER behavior

### For Public Tables
✅ **DO**: Always enable RLS on tables in public schema  
✅ **DO**: Add restrictive policies (deny by default)  
❌ **DON'T**: Leave tables without RLS in public schema

### For Admin Tables
✅ **DO**: Verify admin status using `user_roles.is_admin`  
✅ **DO**: Use `(select auth.uid())` for performance  
❌ **DON'T**: Trust client-side admin checks

---

## 📞 Support

**Security Issues**: hello@ace1.in  
**Documentation**: See RLS_OPTIMIZATION_GUIDE.md

---

**ACE#1 Security Team** | December 4, 2025
