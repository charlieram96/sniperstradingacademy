-- ============================================
-- CREATE TEST USER
-- ============================================
-- Quick script to add test users to your network
-- Edit the variables below, then run in Supabase SQL Editor
-- ============================================

-- ============================================
-- OPTION 1: CREATE SINGLE TEST USER
-- ============================================

DO $$
DECLARE
    -- 🔧 EDIT THESE VARIABLES
    test_email TEXT := 'testuser9@example.com';  -- Change this!
    test_password TEXT := 'password123';
    referrer_email TEXT := 'sniperstacademy@gmail.com';  -- Who is referring this user

    -- Internal variables (don't edit)
    new_user_id UUID;
    referrer_id UUID;
    assigned_position TEXT;
    assigned_branch INTEGER;
BEGIN
    -- Get referrer's ID
    SELECT id INTO referrer_id
    FROM public.users
    WHERE email = referrer_email;

    IF referrer_id IS NULL THEN
        RAISE EXCEPTION 'Referrer with email % not found', referrer_email;
    END IF;

    -- Create user in auth.users table
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        aud,
        role,
        confirmation_token,
        recovery_token
    )
    VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        test_email,
        crypt(test_password, gen_salt('bf')),
        NOW(),  -- Email confirmed immediately for test users
        NOW(),
        NOW(),
        'authenticated',
        'authenticated',
        '',
        ''
    )
    RETURNING id INTO new_user_id;

    RAISE NOTICE '✅ Created auth user: %', new_user_id;

    -- Update public.users record (created via trigger)
    UPDATE public.users
    SET
        name = split_part(test_email, '@', 1),  -- Use email username as name
        referred_by = referrer_id,
        initial_payment_completed = true,
        initial_payment_date = NOW(),
        last_payment_date = NOW(),
        is_active = true  -- Active immediately for test users
    WHERE id = new_user_id;

    RAISE NOTICE '✅ Updated public.users record';

    -- Assign network position (uses round-robin distribution!)
    assigned_position := public.assign_network_position(new_user_id, referrer_id);

    RAISE NOTICE '✅ Position assigned: %', assigned_position;

    -- Get assigned branch
    SELECT last_referral_branch INTO assigned_branch
    FROM public.users
    WHERE id = referrer_id;

    -- Display summary
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE '  TEST USER CREATED SUCCESSFULLY';
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE 'User ID:  %', new_user_id;
    RAISE NOTICE 'Email:    %', test_email;
    RAISE NOTICE 'Password: %', test_password;
    RAISE NOTICE 'Position: %', assigned_position;
    RAISE NOTICE 'Branch:   %', assigned_branch;
    RAISE NOTICE 'Referred by: %', referrer_email;
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now login with these credentials!';

END $$;

-- ============================================
-- OPTION 2: CREATE MULTIPLE TEST USERS
-- ============================================

/*
DO $$
DECLARE
    -- 🔧 EDIT THESE VARIABLES
    base_email TEXT := 'testuser';  -- Will create testuser9@example.com, testuser10@example.com, etc.
    domain TEXT := 'example.com';
    test_password TEXT := 'password123';
    referrer_email TEXT := 'sniperstacademy@gmail.com';
    start_number INTEGER := 9;  -- Start from testuser9
    count INTEGER := 6;  -- Create 6 users (9, 10, 11, 12, 13, 14)

    -- Internal variables
    new_user_id UUID;
    referrer_id UUID;
    assigned_position TEXT;
    current_email TEXT;
    i INTEGER;
BEGIN
    -- Get referrer
    SELECT id INTO referrer_id
    FROM public.users
    WHERE email = referrer_email;

    IF referrer_id IS NULL THEN
        RAISE EXCEPTION 'Referrer with email % not found', referrer_email;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE '  CREATING % TEST USERS', count;
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE '';

    FOR i IN start_number..(start_number + count - 1) LOOP
        current_email := base_email || i || '@' || domain;

        BEGIN
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
                role,
                confirmation_token,
                recovery_token
            )
            VALUES (
                gen_random_uuid(),
                '00000000-0000-0000-0000-000000000000',
                current_email,
                crypt(test_password, gen_salt('bf')),
                NOW(),
                NOW(),
                NOW(),
                'authenticated',
                'authenticated',
                '',
                ''
            )
            RETURNING id INTO new_user_id;

            -- Update public.users
            UPDATE public.users
            SET
                name = base_email || i,
                referred_by = referrer_id,
                initial_payment_completed = true,
                initial_payment_date = NOW(),
                last_payment_date = NOW(),
                is_active = true
            WHERE id = new_user_id;

            -- Assign position
            assigned_position := public.assign_network_position(new_user_id, referrer_id);

            RAISE NOTICE 'User %: % → %',
                i - start_number + 1,
                current_email,
                assigned_position;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to create user %: %', current_email, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE '  COMPLETED';
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE 'Password for all users: %', test_password;
    RAISE NOTICE '';

END $$;
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- View all test users
SELECT
    email,
    network_position_id,
    network_level,
    network_position,
    CASE
        WHEN (network_position - 1) % 3 = 0 THEN 'Branch 1'
        WHEN (network_position - 1) % 3 = 1 THEN 'Branch 2'
        WHEN (network_position - 1) % 3 = 2 THEN 'Branch 3'
    END as branch,
    created_at
FROM public.users
WHERE email LIKE 'testuser%'
ORDER BY created_at DESC
LIMIT 20;

-- Check referrer's last branch
SELECT
    email,
    network_position_id,
    last_referral_branch,
    (SELECT COUNT(*) FROM public.users WHERE referred_by = users.id) as total_referrals
FROM public.users
WHERE email = 'sniperstacademy@gmail.com';

-- Check branch distribution
SELECT
    COUNT(*) FILTER (WHERE (network_position - 1) % 3 = 0) as branch_1,
    COUNT(*) FILTER (WHERE (network_position - 1) % 3 = 1) as branch_2,
    COUNT(*) FILTER (WHERE (network_position - 1) % 3 = 2) as branch_3,
    COUNT(*) as total
FROM public.users
WHERE tree_parent_network_position_id = 'L000P0000000001';  -- Direct children of root

-- ============================================
-- CLEANUP (Optional)
-- ============================================

/*
-- Delete all test users (use with caution!)
DELETE FROM auth.users WHERE email LIKE 'testuser%@example.com';
DELETE FROM public.users WHERE email LIKE 'testuser%@example.com';
*/
