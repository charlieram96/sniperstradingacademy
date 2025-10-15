-- ============================================
-- FIX: is_active Default Value
-- ============================================
-- Changes the default value of is_active from TRUE to FALSE
-- so that new users start inactive and only become active
-- after paying the $500 initial payment.
-- ============================================

-- ============================================
-- STEP 1: Change the default value
-- ============================================

-- Change default from TRUE to FALSE
ALTER TABLE public.users
ALTER COLUMN is_active SET DEFAULT FALSE;

-- ============================================
-- STEP 2: Fix existing users who shouldn't be active
-- ============================================

-- Set is_active = FALSE for users who:
-- 1. Haven't paid $500 (initial_payment_completed = FALSE or NULL)
-- 2. Don't have an active subscription
-- 3. Are currently marked as active

DO $$
DECLARE
    users_deactivated INTEGER := 0;
    user_record RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FIXING EXISTING USERS WHO SHOULD NOT BE ACTIVE';
    RAISE NOTICE '========================================';

    -- Find and fix users who shouldn't be active
    FOR user_record IN
        SELECT
            u.id,
            u.name,
            u.email,
            u.is_active,
            u.initial_payment_completed,
            u.initial_payment_date,
            s.status as subscription_status
        FROM users u
        LEFT JOIN subscriptions s ON s.user_id = u.id
        WHERE u.is_active = TRUE
        AND (
            -- No initial payment
            (u.initial_payment_completed IS NULL OR u.initial_payment_completed = FALSE)
            OR
            -- Initial payment but grace period expired and no subscription
            (
                u.initial_payment_completed = TRUE
                AND u.initial_payment_date < NOW() - INTERVAL '30 days'
                AND (s.status IS NULL OR s.status != 'active')
            )
        )
    LOOP
        -- Deactivate this user
        UPDATE users
        SET is_active = FALSE
        WHERE id = user_record.id;

        users_deactivated := users_deactivated + 1;

        RAISE NOTICE 'Deactivated user: % (%) - Reason: %',
            user_record.name,
            user_record.email,
            CASE
                WHEN user_record.initial_payment_completed IS NULL OR user_record.initial_payment_completed = FALSE
                THEN 'No initial payment'
                ELSE 'Grace period expired, no subscription'
            END;

        -- Decrement active_network_count for ancestors
        IF user_record.id IS NOT NULL THEN
            BEGIN
                PERFORM public.decrement_upchain_active_count(user_record.id);
                RAISE NOTICE '  → Decremented active_network_count for ancestors';
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '  → Failed to decrement active_network_count: %', SQLERRM;
            END;
        END IF;
    END LOOP;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'SUMMARY: Deactivated % users', users_deactivated;
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 3: Verify the fix
-- ============================================

SELECT '========================================' as divider;
SELECT 'VERIFICATION - Default Value' as test_name;
SELECT '========================================' as divider;

-- Check the new default
SELECT
    column_name,
    column_default,
    CASE
        WHEN column_default = 'false' THEN '✓ CORRECT - New users will start INACTIVE'
        WHEN column_default = 'true' THEN '✗ WRONG - Still set to TRUE'
        ELSE '? UNKNOWN - ' || column_default
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name = 'is_active';

SELECT '========================================' as divider;
SELECT 'VERIFICATION - User Active Status' as test_name;
SELECT '========================================' as divider;

-- Show active users (should only be those who paid $500)
SELECT
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_users,
    COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_users,
    COUNT(*) as total_users
FROM users;

-- Detail of active users (should all have paid $500)
SELECT
    'Active users breakdown:' as info;

SELECT
    name,
    email,
    is_active,
    initial_payment_completed,
    initial_payment_date,
    CASE
        WHEN initial_payment_date >= NOW() - INTERVAL '30 days' THEN 'In grace period'
        ELSE 'Past grace period (needs subscription)'
    END as status
FROM users
WHERE is_active = TRUE
ORDER BY created_at DESC
LIMIT 20;

-- Detail of inactive users (should be those who haven't paid)
SELECT
    'Inactive users (should have no initial payment):' as info;

SELECT
    name,
    email,
    is_active,
    initial_payment_completed,
    initial_payment_date
FROM users
WHERE is_active = FALSE
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- STEP 4: Expected Results Summary
-- ============================================

SELECT '========================================' as divider;
SELECT 'EXPECTED RESULTS' as section;
SELECT '========================================' as divider;

SELECT
    CASE
        WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_active') = 'false'
        THEN '✓ Default is FALSE - New users will start inactive'
        ELSE '✗ Default is not FALSE - Check migration'
    END as default_check;

SELECT
    CASE
        WHEN COUNT(*) = 0
        THEN '✓ No active users without initial payment'
        ELSE '✗ Found ' || COUNT(*) || ' active users without payment - Review manually'
    END as payment_check
FROM users
WHERE is_active = TRUE
AND (initial_payment_completed IS NULL OR initial_payment_completed = FALSE);

SELECT
    CASE
        WHEN COUNT(*) = 0
        THEN '✓ No active users past grace period without subscription'
        ELSE '⚠ Found ' || COUNT(*) || ' active users past grace period - May need daily sync'
    END as grace_period_check
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.is_active = TRUE
AND u.initial_payment_completed = TRUE
AND u.initial_payment_date < NOW() - INTERVAL '30 days'
AND (s.status IS NULL OR s.status != 'active');

-- ============================================
-- NOTES
-- ============================================
-- After running this migration:
-- 1. New users will start with is_active = FALSE
-- 2. Users only become active after $500 payment
-- 3. Users stay active for 30 days (grace period)
-- 4. After 30 days, need active subscription to stay active
--
-- NEXT STEPS:
-- 1. Deploy supabase-updated-daily-subscription-sync.sql as a daily cron job
--    This handles the grace period expiration logic automatically
-- 2. Test with a new signup (should be inactive until payment)
-- 3. Monitor existing users for any that should be active but aren't
-- ============================================

SELECT 'is_active default changed to FALSE! New users will start inactive.' as message;
