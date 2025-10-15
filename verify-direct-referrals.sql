-- ============================================
-- VERIFICATION: Direct Referral System
-- ============================================
-- Run this to verify the direct referral system is working correctly
-- ============================================

-- ============================================
-- TEST 1: Check if direct_referrals_count column exists
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 1: Check direct_referrals_count column exists' as test_name;
SELECT '========================================' as divider;

SELECT
    column_name,
    data_type,
    column_default,
    CASE
        WHEN column_name = 'direct_referrals_count' THEN '✓ Column exists'
        ELSE '✗ Column not found'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name = 'direct_referrals_count';

-- If column doesn't exist
SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'direct_referrals_count'
        )
        THEN '✗ direct_referrals_count column NOT FOUND - Deploy supabase-activation-schema.sql'
        ELSE '✓ Column exists'
    END as column_check;

-- ============================================
-- TEST 2: Check if update_direct_referrals_count trigger exists
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 2: Check trigger exists' as test_name;
SELECT '========================================' as divider;

SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    CASE
        WHEN trigger_name = 'trigger_update_direct_referrals' THEN '✓ Trigger exists'
        ELSE '? Unknown trigger'
    END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table = 'referrals'
AND trigger_name LIKE '%direct_referral%'
ORDER BY trigger_name;

-- If trigger doesn't exist
SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            AND event_object_table = 'referrals'
            AND trigger_name = 'trigger_update_direct_referrals'
        )
        THEN '✗ Trigger NOT FOUND - Deploy supabase-activation-schema.sql'
        ELSE '✓ Trigger exists'
    END as trigger_check;

-- ============================================
-- TEST 3: Check if referrals table has correct columns
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 3: Check referrals table columns' as test_name;
SELECT '========================================' as divider;

SELECT
    column_name,
    data_type,
    CASE
        WHEN column_name IN ('id', 'referrer_id', 'referred_id', 'status', 'initial_payment_status', 'created_at')
        THEN '✓ Required column'
        ELSE 'Additional column'
    END as required_status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'referrals'
ORDER BY
    CASE column_name
        WHEN 'id' THEN 1
        WHEN 'referrer_id' THEN 2
        WHEN 'referred_id' THEN 3
        WHEN 'status' THEN 4
        WHEN 'initial_payment_status' THEN 5
        WHEN 'created_at' THEN 6
        ELSE 99
    END;

-- ============================================
-- TEST 4: Compare stored count vs actual count
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 4: Verify direct_referrals_count accuracy' as test_name;
SELECT '========================================' as divider;

WITH actual_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as actual_active_referrals,
        COUNT(*) as total_referrals
    FROM referrals
    GROUP BY referrer_id
),
comparison AS (
    SELECT
        u.id,
        u.name,
        u.email,
        COALESCE(u.direct_referrals_count, 0) as stored_count,
        COALESCE(ac.actual_active_referrals, 0) as actual_count,
        COALESCE(ac.total_referrals, 0) as total_referrals,
        COALESCE(u.direct_referrals_count, 0) - COALESCE(ac.actual_active_referrals, 0) as difference
    FROM users u
    LEFT JOIN actual_counts ac ON ac.referrer_id = u.id
    WHERE ac.referrer_id IS NOT NULL OR u.direct_referrals_count > 0
)
SELECT
    CASE
        WHEN COUNT(*) FILTER (WHERE difference != 0) = 0
        THEN '✓ PASS - All counts match'
        ELSE '✗ FAIL - Found ' || COUNT(*) FILTER (WHERE difference != 0) || ' users with mismatched counts'
    END as test_result,
    COUNT(*) FILTER (WHERE difference != 0) as mismatched_count,
    COUNT(*) as total_users_with_referrals
FROM comparison;

-- Show users with mismatched counts
SELECT
    'Users with mismatched counts:' as info
WHERE EXISTS (
    WITH actual_counts AS (
        SELECT
            referrer_id,
            COUNT(*) FILTER (WHERE status = 'active') as actual_active_referrals
        FROM referrals
        GROUP BY referrer_id
    )
    SELECT 1
    FROM users u
    LEFT JOIN actual_counts ac ON ac.referrer_id = u.id
    WHERE COALESCE(u.direct_referrals_count, 0) != COALESCE(ac.actual_active_referrals, 0)
);

WITH actual_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as actual_active_referrals,
        COUNT(*) as total_referrals
    FROM referrals
    GROUP BY referrer_id
)
SELECT
    u.name,
    u.email,
    COALESCE(u.direct_referrals_count, 0) as stored_count,
    COALESCE(ac.actual_active_referrals, 0) as actual_count,
    COALESCE(u.direct_referrals_count, 0) - COALESCE(ac.actual_active_referrals, 0) as difference,
    COALESCE(ac.total_referrals, 0) as total_referrals,
    '❌ NEEDS FIX' as action
FROM users u
LEFT JOIN actual_counts ac ON ac.referrer_id = u.id
WHERE COALESCE(u.direct_referrals_count, 0) != COALESCE(ac.actual_active_referrals, 0)
LIMIT 20;

-- ============================================
-- TEST 5: Referral status breakdown
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 5: Referral status breakdown' as test_name;
SELECT '========================================' as divider;

SELECT
    status,
    COUNT(*) as count,
    CASE status
        WHEN 'pending' THEN 'Signed up, not paid yet'
        WHEN 'active' THEN 'Paid $500, should count toward referrer'
        ELSE 'Unknown status'
    END as meaning
FROM referrals
GROUP BY status
ORDER BY
    CASE status
        WHEN 'active' THEN 1
        WHEN 'pending' THEN 2
        ELSE 99
    END;

-- ============================================
-- TEST 6: Sample active referrals
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 6: Sample active referrals (first 10)' as test_name;
SELECT '========================================' as divider;

SELECT
    referrer.name as referrer_name,
    referrer.email as referrer_email,
    referred.name as referred_name,
    referred.email as referred_email,
    r.status,
    r.initial_payment_status,
    r.created_at,
    CASE
        WHEN r.status = 'active' THEN '✓ Counts toward direct_referrals_count'
        ELSE '- Does not count yet'
    END as counts_status
FROM referrals r
JOIN users referrer ON referrer.id = r.referrer_id
JOIN users referred ON referred.id = r.referred_id
ORDER BY r.created_at DESC
LIMIT 10;

-- ============================================
-- TEST 7: Users with most direct referrals
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 7: Top referrers' as test_name;
SELECT '========================================' as divider;

WITH actual_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as active_referrals,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_referrals,
        COUNT(*) as total_referrals
    FROM referrals
    GROUP BY referrer_id
)
SELECT
    u.name,
    u.email,
    COALESCE(u.direct_referrals_count, 0) as stored_count,
    COALESCE(ac.active_referrals, 0) as actual_active,
    COALESCE(ac.pending_referrals, 0) as pending,
    COALESCE(ac.total_referrals, 0) as total,
    CASE
        WHEN COALESCE(u.direct_referrals_count, 0) = COALESCE(ac.active_referrals, 0)
        THEN '✓ Match'
        ELSE '✗ Mismatch'
    END as count_status
FROM users u
INNER JOIN actual_counts ac ON ac.referrer_id = u.id
ORDER BY ac.active_referrals DESC
LIMIT 10;

-- ============================================
-- TEST 8: Users with no referrals but count > 0
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 8: Phantom counts (count > 0 but no referrals)' as test_name;
SELECT '========================================' as divider;

SELECT
    CASE
        WHEN COUNT(*) = 0
        THEN '✓ PASS - No phantom counts found'
        ELSE '✗ FAIL - Found ' || COUNT(*) || ' users with count but no referrals'
    END as test_result,
    COUNT(*) as phantom_count
FROM users u
WHERE u.direct_referrals_count > 0
AND NOT EXISTS (
    SELECT 1 FROM referrals r
    WHERE r.referrer_id = u.id
);

-- Show phantom count users
SELECT
    u.name,
    u.email,
    u.direct_referrals_count,
    '❌ Has count but no referral records' as issue
FROM users u
WHERE u.direct_referrals_count > 0
AND NOT EXISTS (
    SELECT 1 FROM referrals r
    WHERE r.referrer_id = u.id
)
LIMIT 10;

-- ============================================
-- TEST 9: Users with referrals but count = 0
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 9: Missing counts (has active referrals but count = 0)' as test_name;
SELECT '========================================' as divider;

WITH active_referrers AS (
    SELECT DISTINCT referrer_id
    FROM referrals
    WHERE status = 'active'
)
SELECT
    CASE
        WHEN COUNT(*) = 0
        THEN '✓ PASS - All active referrers have correct counts'
        ELSE '✗ FAIL - Found ' || COUNT(*) || ' users with active referrals but count = 0'
    END as test_result,
    COUNT(*) as missing_count
FROM users u
INNER JOIN active_referrers ar ON ar.referrer_id = u.id
WHERE COALESCE(u.direct_referrals_count, 0) = 0;

-- Show users with missing counts
WITH active_referrers AS (
    SELECT
        referrer_id,
        COUNT(*) as active_count
    FROM referrals
    WHERE status = 'active'
    GROUP BY referrer_id
)
SELECT
    u.name,
    u.email,
    COALESCE(u.direct_referrals_count, 0) as stored_count,
    ar.active_count,
    '❌ Should have count = ' || ar.active_count as issue
FROM users u
INNER JOIN active_referrers ar ON ar.referrer_id = u.id
WHERE COALESCE(u.direct_referrals_count, 0) = 0
LIMIT 10;

-- ============================================
-- SUMMARY & FINAL RESULTS
-- ============================================
SELECT '========================================' as divider;
SELECT 'SUMMARY' as section;
SELECT '========================================' as divider;

SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'direct_referrals_count'
        )
        THEN '✓'
        ELSE '✗'
    END || ' direct_referrals_count column exists' as check_1;

SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            AND event_object_table = 'referrals'
            AND trigger_name = 'trigger_update_direct_referrals'
        )
        THEN '✓'
        ELSE '✗'
    END || ' Trigger exists' as check_2;

WITH actual_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as actual_active_referrals
    FROM referrals
    GROUP BY referrer_id
)
SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1
            FROM users u
            LEFT JOIN actual_counts ac ON ac.referrer_id = u.id
            WHERE COALESCE(u.direct_referrals_count, 0) != COALESCE(ac.actual_active_referrals, 0)
        )
        THEN '✓'
        ELSE '✗'
    END || ' All counts match actual referrals' as check_3;

-- ============================================
-- FIX SCRIPT (if counts are mismatched)
-- ============================================
SELECT '========================================' as divider;
SELECT 'FIX SCRIPT - Run if counts are mismatched' as section;
SELECT '========================================' as divider;

SELECT '
-- Run this to fix mismatched counts:
UPDATE users u
SET direct_referrals_count = (
    SELECT COUNT(*)
    FROM referrals r
    WHERE r.referrer_id = u.id
    AND r.status = ''active''
)
WHERE EXISTS (
    SELECT 1 FROM referrals r
    WHERE r.referrer_id = u.id
);

-- Set to 0 for users with no referrals
UPDATE users
SET direct_referrals_count = 0
WHERE direct_referrals_count IS NULL
OR (
    direct_referrals_count > 0
    AND NOT EXISTS (
        SELECT 1 FROM referrals r
        WHERE r.referrer_id = users.id
    )
);
' as fix_script;

-- ============================================
-- NEXT STEPS
-- ============================================
SELECT '========================================' as divider;
SELECT 'NEXT STEPS' as section;
SELECT '========================================' as divider;

SELECT
    'If all checks show ✓:' as success_case,
    '1. Test by creating a new user with a referral' as step_1,
    '2. Check server logs for referral creation message' as step_2,
    '3. Process $500 payment for the new user' as step_3,
    '4. Verify referrer''s direct_referrals_count increments' as step_4;

SELECT
    'If any checks show ✗:' as failure_case,
    '1. Deploy supabase-activation-schema.sql if column/trigger missing' as step_1,
    '2. Run the fix script above if counts are mismatched' as step_2,
    '3. Check server logs when creating referrals' as step_3,
    '4. Verify trigger is firing after updates' as step_4;
