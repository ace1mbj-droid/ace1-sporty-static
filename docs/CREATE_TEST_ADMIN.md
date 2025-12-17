# Create Test Admin User

Since I don't have access to the service role key, please create a test admin user manually:

## Option 1: Via Supabase Dashboard (Easiest)

1. Go to https://supabase.com/dashboard/project/vorqavsuqcjnkjzwkyzr/auth/users
2. Click "Add User" button
3. Enter:
   - Email: `test-admin@ace1.in`
   - Password: `TestAdmin123!`
   - Auto Confirm: Yes
4. Click "Create User"
5. Note the User ID (UUID)

Then run this SQL in the SQL Editor:

```sql
-- Replace YOUR_USER_ID with the UUID from step 5
DO $$
DECLARE
    v_user_id uuid := 'YOUR_USER_ID'; -- Replace with actual UUID
BEGIN
    -- Add to public.users
    INSERT INTO public.users (id, email, role, created_at)
    VALUES (v_user_id, 'test-admin@ace1.in', 'admin', NOW())
    ON CONFLICT (id) DO UPDATE SET role = 'admin';

    -- Add to user_roles
    INSERT INTO public.user_roles (user_id, is_admin)
    VALUES (v_user_id, true)
    ON CONFLICT (user_id) DO UPDATE SET is_admin = true;
    
    RAISE NOTICE 'Test admin setup complete!';
END $$;
```

## Option 2: Via Script (if you have service role key)

```bash
SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/create-test-admin.js
```

## Current Issue Analysis

Based on the console errors you're seeing, the 500 errors are still happening for:
- `orders` table
- `users` table  
- `session_revocations` table

This suggests the RLS policies still can't access the `user_roles` table properly, or the user doesn't have an entry in `user_roles`.

Let me check if there's an issue with the user_roles RLS policy...
