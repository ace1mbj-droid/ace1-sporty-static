-- ================================================
-- FIX ADMIN PASSWORD HASH - bcrypt compatibility
-- ================================================
-- This migration fixes the admin user's encrypted_password
-- to use proper bcrypt format instead of PBKDF2
--
-- IMPORTANT: After running this, you MUST reset the admin
-- password using the password reset flow or Supabase dashboard

DO $$
DECLARE
    admin_auth_id uuid;
    admin_email text := 'hello@ace1.in';
BEGIN
    -- Find the admin user in auth.users
    SELECT id INTO admin_auth_id
    FROM auth.users
    WHERE lower(email) = lower(admin_email)
    LIMIT 1;

    IF admin_auth_id IS NOT NULL THEN
        -- Clear the invalid password hash
        -- This forces the user to reset their password
        UPDATE auth.users 
        SET 
            encrypted_password = NULL,
            email_confirmed_at = now(),  -- Ensure email is confirmed
            confirmed_at = now()
        WHERE id = admin_auth_id;

        RAISE NOTICE 'Admin user password cleared. Admin MUST reset password via forgot-password flow.';
        RAISE NOTICE 'Go to: https://ace1.in/forgot-password.html and enter: %', admin_email;
    ELSE
        RAISE NOTICE 'Admin user not found with email: %', admin_email;
    END IF;
END $$;

-- Verify the fix
SELECT 
    'Admin user status' as info,
    id,
    email,
    email_confirmed_at IS NOT NULL as email_confirmed,
    encrypted_password IS NULL as needs_password_reset,
    created_at
FROM auth.users
WHERE lower(email) = 'hello@ace1.in';
