# Fix Admin Password Bcrypt Error

## Problem
The admin user's password hash is using an incompatible PBKDF2 format (`$pbkdf2$`) instead of the bcrypt format (`$2a$`, `$2b$`) that Supabase Auth requires. This causes the error:

```
crypto/bcrypt: bcrypt algorithm version 'p' requested is newer than current version '2'
```

## Solution

### Option 1: Use Password Reset Flow (Recommended)

This is the safest method and works immediately without any additional setup.

1. **Clear the invalid password hash:**
   ```bash
   supabase db query --file sql/fix_admin_password_hash.sql
   ```

2. **Reset your password:**
   - Go to https://ace1.in/forgot-password.html
   - Enter: `hello@ace1.in`
   - Check your email for the reset link
   - Click the link and set a new password
   - The new password will be properly hashed with bcrypt

### Option 2: Use Admin API Script

This method requires the service role key and creates/updates the admin user programmatically.

1. **Install @supabase/supabase-js (if not already installed):**
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Get your service role key:**
   - Go to https://supabase.com/dashboard/project/vorqavsuqcjnkjzwkyzr/settings/api
   - Copy the **service_role** key (NOT the anon key)

3. **Run the admin creation script:**
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
   ADMIN_PASSWORD=your-secure-password \
   node scripts/create-admin-user.js
   ```

   Replace `your-secure-password` with a strong password (min 8 characters, letters + numbers).

## Verification

After fixing the password, test login:
- Go to https://ace1.in/login.html
- Email: `hello@ace1.in`
- Password: (the one you just set)

## Why This Happened

The `seed_admin.sql` file was setting `encrypted_password` with a PBKDF2 hash instead of bcrypt:

```sql
-- BAD (old code):
admin_password_hash text := '$pbkdf2$100000104547e4d4628d37adb7db69328c80069b352104545f0ce6c9ffcbdd898f28b17cda733d5cd577a31e1e6ba44117e9fd12cc841dba';
```

**Important Notes:**
- Never pre-hash passwords before sending to Supabase Auth
- Always use `supabase.auth.signUp()` or `supabase.auth.admin.createUser()` with plain-text passwords
- Supabase Auth handles bcrypt hashing internally
- The `password-hasher.js` file should NOT be used for Supabase Auth passwords

## Future Prevention

When creating users in Supabase Auth:
1. Use `supabase.auth.signUp({ email, password })` for regular users
2. Use `supabase.auth.admin.createUser({ email, password })` for admin users
3. Always provide **plain-text passwords** - Supabase handles the bcrypt hashing

## Related Files
- `sql/fix_admin_password_hash.sql` - SQL migration to clear invalid hash
- `scripts/create-admin-user.js` - Node.js script to create admin with proper bcrypt
- `js/password-hasher.js` - **DO NOT USE** for Supabase Auth (legacy only)
