-- ============================================
-- VERIFICATION: is_active Fix
-- ============================================
-- Run this after deploying the fix to verify everything works correctly
-- ============================================

-- ============================================
-- TEST 1: Verify default value is FALSE
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 1: Check is_active default value' as test_name;
SELECT '========================================' as divider;

SELECT
    column_name,
    column_default,
    data_type,
    CASE
        WHEN column_default = 'false' THEN '✓ CORRECT - New users will start INACTIVE'
        WHEN column_default = 'true' THEN '✗ WRONG - Still set to TRUE, run fix-is-active-default.sql'
        ELSE '? UNKNOWN - Default is: ' || COALESCE(column_default, 'NULL')
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name = 'is_active';

-- ============================================
-- TEST 2: Check no active users without payment
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 2: Active users must have paid $500' as test_name;
SELECT '========================================' as divider;

SELECT
    CASE
        WHEN COUNT(*) = 0
        THEN '✓ PASS - No active users without initial payment'
        ELSE '✗ FAIL - Found ' || COUNT(*) || ' active users who haven''t paid $500'
    END as test_result,
    COUNT(*) as violating_users_count
FROM users
WHERE is_active = TRUE
AND (initial_payment_completed IS NULL OR initial_payment_completed = FALSE);

-- If test fails, list the violating users
SELECT
    'Violating users (active but no payment):' as info
WHERE EXISTS (
    SELECT 1 FROM users
    WHERE is_active = TRUE
    AND (initial_payment_completed IS NULL OR initial_payment_completed = FALSE)
);

SELECT
    name,
    email,
    is_active,
    initial_payment_completed,
    created_at
FROM users
WHERE is_active = TRUE
AND (initial_payment_completed IS NULL OR initial_payment_completed = FALSE)
LIMIT 20;

-- ============================================
-- TEST 3: Check grace period logic
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 3: Active users must be in grace period OR have subscription' as test_name;
SELECT '========================================' as divider;

SELECT
    CASE
        WHEN COUNT(*) = 0
        THEN '✓ PASS - All active users either in grace period or have subscription'
        ELSE '⚠ WARNING - Found ' || COUNT(*) || ' active users past grace period without subscription'
    END as test_result,
    COUNT(*) as users_past_grace_no_sub
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.is_active = TRUE
AND u.initial_payment_completed = TRUE
AND u.initial_payment_date < NOW() - INTERVAL '30 days'
AND (s.status IS NULL OR s.status != 'active');

-- If test fails or has warnings, list those users
SELECT
    'Users past grace period without subscription:' as info
WHERE EXISTS (
    SELECT 1 FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    WHERE u.is_active = TRUE
    AND u.initial_payment_completed = TRUE
    AND u.initial_payment_date < NOW() - INTERVAL '30 days'
    AND (s.status IS NULL OR s.status != 'active')
);

SELECT
    u.name,
    u.email,
    u.is_active,
    u.initial_payment_date,
    EXTRACT(DAY FROM NOW() - u.initial_payment_date) as days_since_payment,
    s.status as subscription_status,
    'Should be deactivated by daily cron' as action_needed
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.is_active = TRUE
AND u.initial_payment_completed = TRUE
AND u.initial_payment_date < NOW() - INTERVAL '30 days'
AND (s.status IS NULL OR s.status != 'active')
LIMIT 20;

-- ============================================
-- TEST 4: User distribution summary
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 4: User distribution by active status' as test_name;
SELECT '========================================' as divider;

SELECT
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_users,
    COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_users,
    COUNT(*) as total_users,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE is_active = TRUE) / NULLIF(COUNT(*), 0),
        1
    ) as active_percentage
FROM users;

-- ============================================
-- TEST 5: Breakdown of active users
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 5: Active users breakdown' as test_name;
SELECT '========================================' as divider;

SELECT
    'In Grace Period (< 30 days since $500)' as category,
    COUNT(*) as user_count
FROM users u
WHERE u.is_active = TRUE
AND u.initial_payment_completed = TRUE
AND u.initial_payment_date >= NOW() - INTERVAL '30 days'

UNION ALL

SELECT
    'Has Active Subscription' as category,
    COUNT(*) as user_count
FROM users u
INNER JOIN subscriptions s ON s.user_id = u.id
WHERE u.is_active = TRUE
AND s.status = 'active'

UNION ALL

SELECT
    'ERROR: No payment and no subscription' as category,
    COUNT(*) as user_count
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.is_active = TRUE
AND (u.initial_payment_completed IS NULL OR u.initial_payment_completed = FALSE)
AND (s.status IS NULL OR s.status != 'active');

-- ============================================
-- TEST 6: Breakdown of inactive users
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 6: Inactive users breakdown' as test_name;
SELECT '========================================' as divider;

SELECT
    'Never Paid' as category,
    COUNT(*) as user_count
FROM users
WHERE is_active = FALSE
AND (initial_payment_completed IS NULL OR initial_payment_completed = FALSE)

UNION ALL

SELECT
    'Grace Period Expired, No Subscription' as category,
    COUNT(*) as user_count
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.is_active = FALSE
AND u.initial_payment_completed = TRUE
AND u.initial_payment_date < NOW() - INTERVAL '30 days'
AND (s.status IS NULL OR s.status != 'active')

UNION ALL

SELECT
    'Subscription Cancelled/Expired' as category,
    COUNT(*) as user_count
FROM users u
INNER JOIN subscriptions s ON s.user_id = u.id
WHERE u.is_active = FALSE
AND u.initial_payment_completed = TRUE
AND s.status != 'active';

-- ============================================
-- TEST 7: Sample active users (should all have valid reason)
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 7: Sample active users (first 10)' as test_name;
SELECT '========================================' as divider;

SELECT
    u.name,
    u.email,
    u.is_active,
    u.initial_payment_date,
    EXTRACT(DAY FROM NOW() - u.initial_payment_date) as days_since_payment,
    s.status as subscription_status,
    CASE
        WHEN u.initial_payment_date >= NOW() - INTERVAL '30 days'
        THEN '✓ In grace period'
        WHEN s.status = 'active'
        THEN '✓ Has subscription'
        ELSE '✗ SHOULD NOT BE ACTIVE'
    END as active_reason
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.is_active = TRUE
ORDER BY u.created_at DESC
LIMIT 10;

-- ============================================
-- TEST 8: Sample inactive users (first 10)
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 8: Sample inactive users (first 10)' as test_name;
SELECT '========================================' as divider;

SELECT
    u.name,
    u.email,
    u.is_active,
    u.initial_payment_completed,
    u.initial_payment_date,
    s.status as subscription_status,
    CASE
        WHEN u.initial_payment_completed IS NULL OR u.initial_payment_completed = FALSE
        THEN '✓ Never paid'
        WHEN u.initial_payment_date < NOW() - INTERVAL '30 days' AND (s.status IS NULL OR s.status != 'active')
        THEN '✓ Grace expired, no sub'
        WHEN s.status IS NOT NULL AND s.status != 'active'
        THEN '✓ Subscription ended'
        ELSE 'Unknown reason'
    END as inactive_reason
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.is_active = FALSE
ORDER BY u.created_at DESC
LIMIT 10;

-- ============================================
-- TEST 9: Check daily sync function exists
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 9: Verify daily sync function exists' as test_name;
SELECT '========================================' as divider;

SELECT
    proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    CASE
        WHEN proname = 'daily_subscription_sync' THEN '✓ Function exists'
        ELSE '? Unexpected function'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname LIKE '%daily%subscription%sync%'
ORDER BY proname;

-- If function doesn't exist
SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND proname = 'daily_subscription_sync'
        )
        THEN '✗ daily_subscription_sync function NOT FOUND - Deploy supabase-updated-daily-subscription-sync.sql'
        ELSE '✓ Function exists'
    END as function_check;

-- ============================================
-- TEST 10: Check cron job is scheduled (if pg_cron is enabled)
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 10: Check cron job scheduled' as test_name;
SELECT '========================================' as divider;

-- Try to check cron.job table (may fail if pg_cron not enabled)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'cron' AND tablename = 'job') THEN
        RAISE NOTICE 'Checking cron jobs...';
        PERFORM * FROM cron.job WHERE jobname = 'daily-subscription-sync';

        IF NOT FOUND THEN
            RAISE WARNING '✗ Cron job NOT SCHEDULED - Set up daily cron job for daily_subscription_sync()';
        ELSE
            RAISE NOTICE '✓ Cron job is scheduled';
        END IF;
    ELSE
        RAISE NOTICE '⚠ pg_cron extension not enabled or cron.job table not accessible';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠ Could not check cron jobs: %', SQLERRM;
END $$;

-- ============================================
-- SUMMARY & FINAL RESULTS
-- ============================================
SELECT '========================================' as divider;
SELECT 'SUMMARY' as section;
SELECT '========================================' as divider;

SELECT
    CASE
        WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_active') = 'false'
        THEN '✓'
        ELSE '✗'
    END || ' Default is FALSE' as check_1;

SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM users
            WHERE is_active = TRUE
            AND (initial_payment_completed IS NULL OR initial_payment_completed = FALSE)
        )
        THEN '✓'
        ELSE '✗'
    END || ' No active users without payment' as check_2;

SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM users u
            LEFT JOIN subscriptions s ON s.user_id = u.id
            WHERE u.is_active = TRUE
            AND u.initial_payment_completed = TRUE
            AND u.initial_payment_date < NOW() - INTERVAL '30 days'
            AND (s.status IS NULL OR s.status != 'active')
        )
        THEN '✓'
        ELSE '⚠'
    END || ' No users past grace without subscription' as check_3;

SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND proname = 'daily_subscription_sync'
        )
        THEN '✓'
        ELSE '✗'
    END || ' Daily sync function exists' as check_4;

-- ============================================
-- NEXT STEPS
-- ============================================
SELECT '========================================' as divider;
SELECT 'NEXT STEPS' as section;
SELECT '========================================' as divider;

SELECT
    'If all checks show ✓:' as success_case,
    '1. Create a test user and verify is_active = FALSE before payment' as step_1,
    '2. Make $500 payment and verify is_active = TRUE after payment' as step_2,
    '3. Monitor daily cron job to ensure grace periods are handled' as step_3;

SELECT
    'If any checks show ✗:' as failure_case,
    '1. Review IS-ACTIVE-FIX-DEPLOYMENT-GUIDE.md' as step_1,
    '2. Run fix-is-active-default.sql if default is wrong' as step_2,
    '3. Deploy supabase-updated-daily-subscription-sync.sql if function missing' as step_3,
    '4. Set up cron job if not scheduled' as step_4;
