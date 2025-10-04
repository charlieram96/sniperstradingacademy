-- ============================================
-- DIAGNOSTIC AND FIX SCRIPT FOR REFERRAL CODES
-- ============================================
-- Run these queries one by one to diagnose and fix the issue
-- ============================================

-- STEP 1: Check current user data
-- Replace 'your-email@example.com' with your actual email
SELECT
    id,
    email,
    name,
    referral_code,
    url_slug,
    network_position_id,
    created_at
FROM public.users
WHERE email = 'your-email@example.com';

-- STEP 2: Count users without referral codes
SELECT COUNT(*) as users_missing_referral_code
FROM public.users
WHERE referral_code IS NULL OR referral_code = '';

-- STEP 3: List all users with missing referral codes
SELECT id, email, name, created_at
FROM public.users
WHERE referral_code IS NULL OR referral_code = ''
ORDER BY created_at DESC;

-- STEP 4: Generate referral code for a specific user
-- Replace 'USER_ID_HERE' with the actual user ID from STEP 1
DO $$
DECLARE
    new_code TEXT;
    target_user_id UUID := 'USER_ID_HERE'; -- Replace this
BEGIN
    -- Generate unique code
    new_code := UPPER(substring(md5(random()::text || target_user_id::text), 1, 8));

    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.users WHERE referral_code = new_code) LOOP
        new_code := UPPER(substring(md5(random()::text || target_user_id::text || random()::text), 1, 8));
    END LOOP;

    -- Update user
    UPDATE public.users
    SET referral_code = new_code
    WHERE id = target_user_id;

    RAISE NOTICE 'Generated referral code % for user %', new_code, target_user_id;
END $$;

-- STEP 5: Fix ALL users missing referral codes at once
DO $$
DECLARE
    user_record RECORD;
    new_code TEXT;
BEGIN
    FOR user_record IN
        SELECT id FROM public.users WHERE referral_code IS NULL OR referral_code = ''
    LOOP
        -- Generate unique code for each user
        new_code := UPPER(substring(md5(random()::text || user_record.id::text), 1, 8));

        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM public.users WHERE referral_code = new_code) LOOP
            new_code := UPPER(substring(md5(random()::text || user_record.id::text || random()::text), 1, 8));
        END LOOP;

        -- Update user
        UPDATE public.users
        SET referral_code = new_code
        WHERE id = user_record.id;

        RAISE NOTICE 'Generated code % for user %', new_code, user_record.id;
    END LOOP;
END $$;

-- STEP 6: Verify all users now have referral codes
SELECT
    COUNT(*) as total_users,
    COUNT(referral_code) as users_with_codes,
    COUNT(*) - COUNT(referral_code) as users_without_codes
FROM public.users;

-- STEP 7: Check your specific user again (replace email)
SELECT
    id,
    email,
    referral_code,
    url_slug,
    network_position_id
FROM public.users
WHERE email = 'your-email@example.com';
