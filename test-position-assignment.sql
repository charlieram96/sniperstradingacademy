-- ============================================
-- TEST POSITION ASSIGNMENT AFTER FIX
-- ============================================
-- Creates testuser8 to verify no more duplicate assignments

DO $$
DECLARE
    new_user_id UUID;
    assigned_position TEXT;
    principal_user_id UUID;
BEGIN
    -- Get principal user (snipers academy)
    SELECT id INTO principal_user_id
    FROM public.users
    WHERE email = 'sniperstacademy@gmail.com';

    IF principal_user_id IS NULL THEN
        RAISE EXCEPTION 'Principal user not found';
    END IF;

    -- Create auth user
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        aud,
        role
    )
    VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'testuser8@example.com',
        crypt('password123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
    )
    RETURNING id INTO new_user_id;

    RAISE NOTICE 'Created auth user: %', new_user_id;

    -- Update public.users record
    UPDATE public.users
    SET
        referred_by = principal_user_id,
        initial_payment_completed = true,
        last_payment_date = NOW()
    WHERE id = new_user_id;

    RAISE NOTICE 'Updated public.users with referrer and payment info';

    -- Assign network position
    SELECT public.assign_network_position(new_user_id, principal_user_id)
    INTO assigned_position;

    RAISE NOTICE 'Position assigned: %', assigned_position;
    RAISE NOTICE 'Expected: L002P0000000003 or higher (NOT L001P0000000002)';

    -- Verify the assignment
    SELECT
        email,
        network_position_id,
        network_level,
        network_position,
        tree_parent_network_position_id
    FROM public.users
    WHERE id = new_user_id;

    RAISE NOTICE 'Test user 8 created successfully!';
END $$;

-- View all test users and their positions
SELECT
    email,
    network_level,
    network_position,
    network_position_id,
    tree_parent_network_position_id,
    created_at
FROM public.users
WHERE email LIKE 'testuser%'
ORDER BY created_at;
