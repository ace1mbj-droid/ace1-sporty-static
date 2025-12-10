AddDO $$
DECLARE
	admin_profile_id uuid;
	admin_auth_id uuid;
	admin_session_token text := COALESCE(current_setting('ace1.admin_session_token', true), 'token_admin_' || replace(gen_random_uuid()::text, '-', ''));
	admin_password_hash text := COALESCE(
		current_setting('ace1.admin_password_hash', true),
		'$pbkdf2$100000104547e4d4628d37adb7db69328c80069b352104545f0ce6c9ffcbdd898f28b17cda733d5cd577a31e1e6ba44117e9fd12cc841dba'
	);
BEGIN
	INSERT INTO public.users (id, email, password_hash, first_name, last_name, role)
	VALUES ('CFAF8ADD-B381-4F0A-882A-2C3DF801A4FD', 'hello@ace1.in', admin_password_hash, 'Site', 'Admin', 'admin')
	ON CONFLICT (email) DO UPDATE
		SET first_name = EXCLUDED.first_name,
			last_name = EXCLUDED.last_name,
			role = EXCLUDED.role
	RETURNING id INTO admin_profile_id;

	SELECT id INTO admin_auth_id
	FROM auth.users
	WHERE lower(email) = 'hello@ace1.in'
	LIMIT 1;

	IF admin_auth_id IS NULL THEN
		INSERT INTO auth.users (
			id,
			instance_id,
			aud,
			role,
			email,
			encrypted_password,
			email_confirmed_at,
			raw_app_meta_data,
			raw_user_meta_data,
			is_sso_user,
			is_anonymous,
			created_at,
			updated_at
		)
		VALUES (
			gen_random_uuid(),
			'00000000-0000-0000-0000-000000000000',
			'authenticated',
			'authenticated',
			'hello@ace1.in',
			admin_password_hash,
			now(),
			'{"provider":"email","providers":["email"]}',
			'{}',
			false,
			false,
			now(),
			now()
		)
		RETURNING id INTO admin_auth_id;
	END IF;

	INSERT INTO public.sessions (user_id, token, expires_at)
	VALUES (admin_profile_id, admin_session_token, now() + interval '30 days')
	ON CONFLICT (token) DO UPDATE
		SET user_id = EXCLUDED.user_id,
			expires_at = EXCLUDED.expires_at
	RETURNING token INTO admin_session_token;

	INSERT INTO public.user_roles (user_id, is_admin)
	VALUES (admin_auth_id, true)
	ON CONFLICT (user_id) DO UPDATE SET is_admin = EXCLUDED.is_admin;
END $$;

-- Verify rows
SELECT 'user' AS type, id, email FROM public.users WHERE lower(email) = 'hello@ace1.in';
SELECT 'session' AS type, id, user_id, token, expires_at FROM public.sessions WHERE user_id = (
	SELECT id FROM public.users WHERE lower(email) = 'hello@ace1.in' LIMIT 1
) ORDER BY expires_at DESC LIMIT 1;
SELECT 'user_role' AS type, user_id, is_admin FROM public.user_roles WHERE user_id = (
	SELECT id FROM auth.users WHERE lower(email) = 'hello@ace1.in' LIMIT 1
);
