-- Sync hello@ace1.in from auth.users to public.users
-- The user exists in auth.users and user_roles, but not in public.users

DO $$
DECLARE
    v_auth_user_id uuid;
    v_email text := 'hello@ace1.in';
    v_public_user_id uuid;
BEGIN
    -- Get user ID from auth.users
    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE email = v_email
    LIMIT 1;

    -- Get user ID from public.users
    SELECT id INTO v_public_user_id
    FROM public.users
    WHERE email = v_email
    LIMIT 1;

    IF v_auth_user_id IS NULL THEN
        RAISE WARNING 'User % not found in auth.users', v_email;
    ELSIF v_public_user_id IS NULL THEN
        -- User doesn't exist in public.users, create it
        INSERT INTO public.users (id, email, role, created_at)
        VALUES (v_auth_user_id, v_email, 'admin', NOW());
        RAISE NOTICE 'Created public.users entry for % with ID %', v_email, v_auth_user_id;
    ELSIF v_auth_user_id != v_public_user_id THEN
        -- UUID mismatch! Fix by updating public.users to use auth UUID
        RAISE NOTICE 'UUID mismatch: auth=%, public=%', v_auth_user_id, v_public_user_id;
        
        -- Update user_roles to point to auth UUID
        UPDATE public.user_roles 
        SET user_id = v_auth_user_id 
        WHERE user_id = v_public_user_id;
        
        -- Delete old public.users entry
        DELETE FROM public.users WHERE id = v_public_user_id;
        
        -- Create new entry with auth UUID
        INSERT INTO public.users (id, email, role, created_at)
        VALUES (v_auth_user_id, v_email, 'admin', NOW());
        
        RAISE NOTICE 'Fixed UUID mismatch for %', v_email;
    ELSE
        -- UUIDs match, just ensure admin role
        UPDATE public.users SET role = 'admin' WHERE id = v_auth_user_id;
        RAISE NOTICE 'Updated % to admin role', v_email;
    END IF;
END $$;
