-- ============================================
-- FIX: Sync direct_referrals_count with Reality
-- ============================================
-- Run this AFTER deploying supabase-activation-schema.sql
-- This will:
-- 1. Calculate actual count of active referrals for each user
-- 2. Update direct_referrals_count to match reality
-- 3. Show before/after counts
-- ============================================

-- First, verify schema is deployed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'direct_referrals_count'
    ) THEN
        RAISE EXCEPTION 'direct_referrals_count column does not exist! Deploy supabase-activation-schema.sql first';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'referrals'
    ) THEN
        RAISE EXCEPTION 'referrals table does not exist! Create referrals table first';
    END IF;
END $$;

-- ============================================
-- STEP 1: Show current state (before fix)
-- ============================================
SELECT '========================================' as divider;
SELECT 'BEFORE FIX: Current State' as section;
SELECT '========================================' as divider;

WITH actual_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as actual_active_referrals,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_referrals,
        COUNT(*) as total_referrals
    FROM referrals
    GROUP BY referrer_id
)
SELECT
    u.name,
    u.email,
    COALESCE(u.direct_referrals_count, 0) as current_stored_count,
    COALESCE(ac.actual_active_referrals, 0) as actual_active_count,
    COALESCE(ac.pending_referrals, 0) as pending_count,
    COALESCE(u.direct_referrals_count, 0) - COALESCE(ac.actual_active_referrals, 0) as difference,
    CASE
        WHEN COALESCE(u.direct_referrals_count, 0) = COALESCE(ac.actual_active_referrals, 0)
        THEN '✓ Match'
        ELSE '✗ Needs Fix'
    END as status
FROM users u
LEFT JOIN actual_counts ac ON ac.referrer_id = u.id
WHERE ac.referrer_id IS NOT NULL OR u.direct_referrals_count > 0
ORDER BY ac.actual_active_referrals DESC NULLS LAST
LIMIT 20;

-- ============================================
-- STEP 2: Count users that need fixing
-- ============================================
SELECT '========================================' as divider;
SELECT 'Users that need fixing' as section;
SELECT '========================================' as divider;

WITH actual_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as actual_active_referrals
    FROM referrals
    GROUP BY referrer_id
)
SELECT
    COUNT(*) FILTER (
        WHERE COALESCE(u.direct_referrals_count, 0) != COALESCE(ac.actual_active_referrals, 0)
    ) as users_needing_fix,
    COUNT(*) as total_users_with_referrals,
    COUNT(*) FILTER (
        WHERE COALESCE(u.direct_referrals_count, 0) = COALESCE(ac.actual_active_referrals, 0)
    ) as users_already_correct
FROM users u
LEFT JOIN actual_counts ac ON ac.referrer_id = u.id
WHERE ac.referrer_id IS NOT NULL OR u.direct_referrals_count > 0;

-- ============================================
-- STEP 3: Apply the fix
-- ============================================
SELECT '========================================' as divider;
SELECT 'APPLYING FIX...' as section;
SELECT '========================================' as divider;

-- Update users who have referrals
UPDATE users u
SET direct_referrals_count = (
    SELECT COUNT(*)
    FROM referrals r
    WHERE r.referrer_id = u.id
    AND r.status = 'active'
)
WHERE EXISTS (
    SELECT 1 FROM referrals r
    WHERE r.referrer_id = u.id
);

-- Set to 0 for users with no referrals but have a count
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

SELECT 'Fix applied!' as status;

-- ============================================
-- STEP 4: Show results (after fix)
-- ============================================
SELECT '========================================' as divider;
SELECT 'AFTER FIX: Updated State' as section;
SELECT '========================================' as divider;

WITH actual_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as actual_active_referrals,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_referrals,
        COUNT(*) as total_referrals
    FROM referrals
    GROUP BY referrer_id
)
SELECT
    u.name,
    u.email,
    COALESCE(u.direct_referrals_count, 0) as updated_stored_count,
    COALESCE(ac.actual_active_referrals, 0) as actual_active_count,
    COALESCE(ac.pending_referrals, 0) as pending_count,
    COALESCE(u.direct_referrals_count, 0) - COALESCE(ac.actual_active_referrals, 0) as difference,
    CASE
        WHEN COALESCE(u.direct_referrals_count, 0) = COALESCE(ac.actual_active_referrals, 0)
        THEN '✓ Correct'
        ELSE '✗ Still Wrong'
    END as status
FROM users u
LEFT JOIN actual_counts ac ON ac.referrer_id = u.id
WHERE ac.referrer_id IS NOT NULL OR u.direct_referrals_count > 0
ORDER BY ac.actual_active_referrals DESC NULLS LAST
LIMIT 20;

-- ============================================
-- STEP 5: Verify fix was successful
-- ============================================
SELECT '========================================' as divider;
SELECT 'VERIFICATION' as section;
SELECT '========================================' as divider;

WITH actual_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as actual_active_referrals
    FROM referrals
    GROUP BY referrer_id
)
SELECT
    CASE
        WHEN COUNT(*) FILTER (
            WHERE COALESCE(u.direct_referrals_count, 0) != COALESCE(ac.actual_active_referrals, 0)
        ) = 0
        THEN '✓✓✓ SUCCESS - All counts are now correct!'
        ELSE '✗✗✗ FAILED - ' || COUNT(*) FILTER (
            WHERE COALESCE(u.direct_referrals_count, 0) != COALESCE(ac.actual_active_referrals, 0)
        ) || ' users still have incorrect counts'
    END as result,
    COUNT(*) FILTER (
        WHERE COALESCE(u.direct_referrals_count, 0) = COALESCE(ac.actual_active_referrals, 0)
    ) as correct_count,
    COUNT(*) FILTER (
        WHERE COALESCE(u.direct_referrals_count, 0) != COALESCE(ac.actual_active_referrals, 0)
    ) as incorrect_count,
    COUNT(*) as total_users_with_referrals
FROM users u
LEFT JOIN actual_counts ac ON ac.referrer_id = u.id
WHERE ac.referrer_id IS NOT NULL OR u.direct_referrals_count > 0;

-- ============================================
-- SUMMARY
-- ============================================
SELECT '========================================' as divider;
SELECT 'SUMMARY' as section;
SELECT '========================================' as divider;

DO $$
DECLARE
    total_users INTEGER;
    total_referrals INTEGER;
    total_active_referrals INTEGER;
    total_pending_referrals INTEGER;
BEGIN
    -- Get counts
    SELECT
        COUNT(DISTINCT referrer_id),
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'active'),
        COUNT(*) FILTER (WHERE status = 'pending')
    INTO total_users, total_referrals, total_active_referrals, total_pending_referrals
    FROM referrals;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'REFERRAL SYSTEM STATISTICS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Users with referrals: %', total_users;
    RAISE NOTICE 'Total referrals: %', total_referrals;
    RAISE NOTICE '  Active (paid $500): %', total_active_referrals;
    RAISE NOTICE '  Pending (not paid): %', total_pending_referrals;
    RAISE NOTICE '';
    RAISE NOTICE 'All direct_referrals_count values have been synced!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test by having a pending user pay $500';
    RAISE NOTICE '2. Check server logs for count update message';
    RAISE NOTICE '3. Run verify-direct-referrals.sql periodically';
END $$;

-- ============================================
-- OPTIONAL: Show top referrers
-- ============================================
SELECT '========================================' as divider;
SELECT 'TOP REFERRERS (by active referrals)' as section;
SELECT '========================================' as divider;

WITH actual_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as active_referrals,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_referrals
    FROM referrals
    GROUP BY referrer_id
)
SELECT
    u.name,
    u.email,
    u.direct_referrals_count as stored_count,
    ac.active_referrals,
    ac.pending_referrals,
    '✓' as verified
FROM users u
INNER JOIN actual_counts ac ON ac.referrer_id = u.id
WHERE ac.active_referrals > 0
ORDER BY ac.active_referrals DESC, ac.pending_referrals DESC
LIMIT 10;
