-- Check and setup admin user for product deletion
-- This script checks if hello@ace1.in exists and sets them as admin

DO $$
DECLARE
    v_user_id uuid;
    v_exists boolean;
BEGIN
    -- Check if user exists
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'hello@ace1.in'
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User hello@ace1.in not found in auth.users. Please create the user first.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found user ID: %', v_user_id;

    -- Ensure user is in public.users table
    INSERT INTO public.users (id, email, role, created_at)
    VALUES (v_user_id, 'hello@ace1.in', 'admin', NOW())
    ON CONFLICT (id) DO UPDATE SET role = 'admin';

    -- Set as admin in user_roles
    INSERT INTO public.user_roles (user_id, is_admin)
    VALUES (v_user_id, true)
    ON CONFLICT (user_id) DO UPDATE SET is_admin = true;

    RAISE NOTICE 'Admin setup complete for hello@ace1.in';
END $$;