-- ============================================
-- VERIFICATION: Function Duplicate Fix
-- ============================================
-- Run this after deploying the fix to verify everything works
-- ============================================

-- ============================================
-- TEST 1: Check only ONE version of find_available_slot exists
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 1: Verify NO duplicate functions' as test_name;
SELECT '========================================' as divider;

SELECT
    proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    CASE
        WHEN pg_get_function_arguments(p.oid) = 'referrer_position_id text, max_depth integer DEFAULT 100'
        THEN '✓ CORRECT VERSION'
        ELSE '✗ UNEXPECTED VERSION - Review deployment'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname = 'find_available_slot'
ORDER BY proname;

-- Expected: EXACTLY ONE row with status '✓ CORRECT VERSION'
-- If you see multiple rows: Run cleanup-duplicate-functions.sql again

-- ============================================
-- TEST 2: Check all required functions exist
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 2: Verify all required functions exist' as test_name;
SELECT '========================================' as divider;

SELECT
    CASE
        WHEN COUNT(*) FILTER (WHERE proname = 'find_available_slot') = 1 THEN '✓'
        ELSE '✗'
    END || ' find_available_slot' as function_check
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'

UNION ALL

SELECT
    CASE
        WHEN COUNT(*) FILTER (WHERE proname = 'assign_network_position') >= 1 THEN '✓'
        ELSE '✗'
    END || ' assign_network_position'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'

UNION ALL

SELECT
    CASE
        WHEN COUNT(*) FILTER (WHERE proname = 'get_tree_children') >= 1 THEN '✓'
        ELSE '✗'
    END || ' get_tree_children'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'

UNION ALL

SELECT
    CASE
        WHEN COUNT(*) FILTER (WHERE proname = 'increment_upchain_total_count') >= 1 THEN '✓'
        ELSE '✗'
    END || ' increment_upchain_total_count'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'

UNION ALL

SELECT
    CASE
        WHEN COUNT(*) FILTER (WHERE proname = 'increment_upchain_active_count') >= 1 THEN '✓'
        ELSE '✗'
    END || ' increment_upchain_active_count'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'

UNION ALL

SELECT
    CASE
        WHEN COUNT(*) FILTER (WHERE proname = 'format_network_position_id') >= 1 THEN '✓'
        ELSE '✗'
    END || ' format_network_position_id'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'

UNION ALL

SELECT
    CASE
        WHEN COUNT(*) FILTER (WHERE proname = 'get_upline_chain') >= 1 THEN '✓'
        ELSE '✗'
    END || ' get_upline_chain'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';

-- All should show '✓'
-- If any show '✗', deploy the missing function

-- ============================================
-- TEST 3: Test find_available_slot directly
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 3: Test find_available_slot execution' as test_name;
SELECT '========================================' as divider;

-- Get the root user's position to test with
DO $$
DECLARE
    root_position_id TEXT;
    test_result RECORD;
BEGIN
    -- Find root user
    SELECT network_position_id INTO root_position_id
    FROM users
    WHERE network_level = 0
    LIMIT 1;

    IF root_position_id IS NULL THEN
        RAISE NOTICE '✗ No root user found - create a user first';
        RETURN;
    END IF;

    RAISE NOTICE '✓ Root user found: %', root_position_id;

    -- Test find_available_slot
    BEGIN
        SELECT * INTO test_result
        FROM public.find_available_slot(root_position_id, 100);

        IF test_result IS NOT NULL THEN
            RAISE NOTICE '✓ find_available_slot works! Next available: Level %, Position %',
                test_result.available_level,
                test_result.available_position;
        ELSE
            RAISE NOTICE '⚠ No available slots found (network might be full, which is unlikely)';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ find_available_slot failed: %', SQLERRM;
    END;
END $$;

-- ============================================
-- TEST 4: Check for orphaned users
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 4: Check for orphaned users' as test_name;
SELECT '========================================' as divider;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ No orphaned users'
        ELSE '✗ ' || COUNT(*) || ' users without network_position_id - Run quick-fix-orphaned-users.sql'
    END as orphan_check,
    COUNT(*) as orphan_count
FROM users
WHERE network_position_id IS NULL;

-- If orphan_count > 0, list them:
SELECT
    '  User: ' || name || ' (' || email || ')' as orphaned_user_details
FROM users
WHERE network_position_id IS NULL
LIMIT 10;

-- ============================================
-- TEST 5: Verify network counts are working
-- ============================================
SELECT '========================================' as divider;
SELECT 'TEST 5: Check network count consistency' as test_name;
SELECT '========================================' as divider;

SELECT
    u.name,
    u.network_position_id,
    u.total_network_count as stored_count,
    (
        SELECT COUNT(*)
        FROM users u2
        WHERE u2.network_level > u.network_level
        AND u2.network_position >= (u.network_position - 1) * POWER(3, u2.network_level - u.network_level)::BIGINT + 1
        AND u2.network_position <= (u.network_position - 1) * POWER(3, u2.network_level - u.network_level)::BIGINT + POWER(3, u2.network_level - u.network_level)::BIGINT
        AND u2.network_position_id IS NOT NULL
    ) as actual_count,
    CASE
        WHEN u.total_network_count = (
            SELECT COUNT(*)
            FROM users u2
            WHERE u2.network_level > u.network_level
            AND u2.network_position >= (u.network_position - 1) * POWER(3, u2.network_level - u.network_level)::BIGINT + 1
            AND u2.network_position <= (u.network_position - 1) * POWER(3, u2.network_level - u.network_level)::BIGINT + POWER(3, u2.network_level - u.network_level)::BIGINT
            AND u2.network_position_id IS NOT NULL
        ) THEN '✓ Match'
        ELSE '✗ Mismatch - Run sync_all_network_counts()'
    END as count_status
FROM users u
WHERE u.network_position_id IS NOT NULL
ORDER BY u.network_level, u.network_position
LIMIT 10;

-- ============================================
-- SUMMARY
-- ============================================
SELECT '========================================' as divider;
SELECT 'SUMMARY' as section;
SELECT '========================================' as divider;

SELECT
    '✓ Functions deployed correctly' as status
WHERE EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND proname = 'find_available_slot'
    HAVING COUNT(*) = 1
);

SELECT
    '✓ No orphaned users' as status
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE network_position_id IS NULL
);

SELECT
    '✓ All tests passed - System ready!' as final_status
WHERE EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND proname = 'find_available_slot'
    HAVING COUNT(*) = 1
)
AND NOT EXISTS (
    SELECT 1 FROM users WHERE network_position_id IS NULL
);

-- ============================================
-- NEXT STEPS
-- ============================================
SELECT '========================================' as divider;
SELECT 'If all tests passed:' as next_steps_title;
SELECT '1. Try creating a test user via your app signup' as step_1;
SELECT '2. Verify they get network_position_id automatically' as step_2;
SELECT '3. Monitor server logs for any errors' as step_3;
SELECT '' as blank;
SELECT 'If any tests failed:' as failure_title;
SELECT '1. Review FUNCTION-DUPLICATE-FIX-GUIDE.md' as fix_step_1;
SELECT '2. Ensure you ran scripts in the correct order' as fix_step_2;
SELECT '3. Check server logs for specific error messages' as fix_step_3;
