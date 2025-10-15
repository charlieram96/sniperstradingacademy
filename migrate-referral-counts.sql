-- ============================================
-- MIGRATION: Backfill Referral Counts
-- ============================================
-- Calculates and updates:
-- 1. direct_referrals_count - users who paid $500 (referral status = "active")
-- 2. active_direct_referrals_count - users currently active (is_active = TRUE)
-- ============================================

-- Verify schema is ready
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'direct_referrals_count'
    ) THEN
        RAISE EXCEPTION 'direct_referrals_count column missing! Run supabase-activation-schema.sql first';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'active_direct_referrals_count'
    ) THEN
        RAISE EXCEPTION 'active_direct_referrals_count column missing! Run supabase-cleanup-referral-schema.sql first';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'referrals'
    ) THEN
        RAISE EXCEPTION 'referrals table missing! Create referrals table first';
    END IF;
END $$;

-- ============================================
-- STEP 1: Show current state (before migration)
-- ============================================
SELECT '========================================' as divider;
SELECT 'BEFORE MIGRATION: Current State' as section;
SELECT '========================================' as divider;

WITH referral_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as paid_count
    FROM referrals
    GROUP BY referrer_id
),
active_counts AS (
    SELECT
        referred_by as referrer_id,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active_count
    FROM users
    WHERE referred_by IS NOT NULL
    GROUP BY referred_by
)
SELECT
    u.name,
    u.email,
    COALESCE(u.direct_referrals_count, 0) as current_paid_count,
    COALESCE(rc.paid_count, 0) as should_be_paid_count,
    COALESCE(u.active_direct_referrals_count, 0) as current_active_count,
    COALESCE(ac.active_count, 0) as should_be_active_count,
    CASE
        WHEN COALESCE(u.direct_referrals_count, 0) = COALESCE(rc.paid_count, 0)
         AND COALESCE(u.active_direct_referrals_count, 0) = COALESCE(ac.active_count, 0)
        THEN '✓ Correct'
        ELSE '✗ Needs Fix'
    END as status
FROM users u
LEFT JOIN referral_counts rc ON rc.referrer_id = u.id
LEFT JOIN active_counts ac ON ac.referrer_id = u.id
WHERE rc.referrer_id IS NOT NULL OR ac.referrer_id IS NOT NULL OR u.direct_referrals_count > 0 OR u.active_direct_referrals_count > 0
ORDER BY COALESCE(rc.paid_count, 0) + COALESCE(ac.active_count, 0) DESC
LIMIT 20;

-- ============================================
-- STEP 2: Count users needing migration
-- ============================================
SELECT '========================================' as divider;
SELECT 'Migration Statistics' as section;
SELECT '========================================' as divider;

WITH referral_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as paid_count
    FROM referrals
    GROUP BY referrer_id
),
active_counts AS (
    SELECT
        referred_by as referrer_id,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active_count
    FROM users
    WHERE referred_by IS NOT NULL
    GROUP BY referred_by
)
SELECT
    COUNT(*) FILTER (
        WHERE COALESCE(u.direct_referrals_count, 0) != COALESCE(rc.paid_count, 0)
           OR COALESCE(u.active_direct_referrals_count, 0) != COALESCE(ac.active_count, 0)
    ) as users_needing_fix,
    COUNT(*) as total_users_with_referrals,
    COUNT(*) FILTER (
        WHERE COALESCE(u.direct_referrals_count, 0) = COALESCE(rc.paid_count, 0)
         AND COALESCE(u.active_direct_referrals_count, 0) = COALESCE(ac.active_count, 0)
    ) as users_already_correct
FROM users u
LEFT JOIN referral_counts rc ON rc.referrer_id = u.id
LEFT JOIN active_counts ac ON ac.referrer_id = u.id
WHERE rc.referrer_id IS NOT NULL OR ac.referrer_id IS NOT NULL OR u.direct_referrals_count > 0 OR u.active_direct_referrals_count > 0;

-- ============================================
-- STEP 3: Apply the migration
-- ============================================
SELECT '========================================' as divider;
SELECT 'APPLYING MIGRATION...' as section;
SELECT '========================================' as divider;

-- Update direct_referrals_count (users who paid $500 - referral status = "active")
UPDATE users u
SET direct_referrals_count = (
    SELECT COUNT(*)
    FROM referrals r
    WHERE r.referrer_id = u.id
    AND r.status = 'active'
);

SELECT 'Updated direct_referrals_count for all users' as step_1;

-- Update active_direct_referrals_count (users currently active - is_active = TRUE)
UPDATE users u
SET active_direct_referrals_count = (
    SELECT COUNT(*)
    FROM users referred
    WHERE referred.referred_by = u.id
    AND referred.is_active = TRUE
);

SELECT 'Updated active_direct_referrals_count for all users' as step_2;

-- Update qualification status for users with 3+ active referrals
UPDATE users
SET qualified_at = TIMEZONE('utc', NOW())
WHERE active_direct_referrals_count >= 3
AND qualified_at IS NULL;

SELECT 'Updated qualification status for eligible users' as step_3;

-- ============================================
-- STEP 4: Show results (after migration)
-- ============================================
SELECT '========================================' as divider;
SELECT 'AFTER MIGRATION: Updated State' as section;
SELECT '========================================' as divider;

WITH referral_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as paid_count
    FROM referrals
    GROUP BY referrer_id
),
active_counts AS (
    SELECT
        referred_by as referrer_id,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active_count
    FROM users
    WHERE referred_by IS NOT NULL
    GROUP BY referred_by
)
SELECT
    u.name,
    u.email,
    u.direct_referrals_count as paid_count,
    u.active_direct_referrals_count as active_count,
    CASE
        WHEN u.qualified_at IS NOT NULL THEN 'Qualified'
        WHEN u.active_direct_referrals_count >= 3 THEN 'Should be qualified'
        ELSE 'Not qualified'
    END as qualification_status,
    u.qualified_at,
    CASE
        WHEN u.direct_referrals_count = COALESCE(rc.paid_count, 0)
         AND u.active_direct_referrals_count = COALESCE(ac.active_count, 0)
        THEN '✓ Correct'
        ELSE '✗ Still Wrong'
    END as verification
FROM users u
LEFT JOIN referral_counts rc ON rc.referrer_id = u.id
LEFT JOIN active_counts ac ON ac.referrer_id = u.id
WHERE rc.referrer_id IS NOT NULL OR ac.referrer_id IS NOT NULL OR u.direct_referrals_count > 0 OR u.active_direct_referrals_count > 0
ORDER BY u.active_direct_referrals_count DESC, u.direct_referrals_count DESC
LIMIT 20;

-- ============================================
-- STEP 5: Verify migration was successful
-- ============================================
SELECT '========================================' as divider;
SELECT 'VERIFICATION' as section;
SELECT '========================================' as divider;

WITH referral_counts AS (
    SELECT
        referrer_id,
        COUNT(*) FILTER (WHERE status = 'active') as paid_count
    FROM referrals
    GROUP BY referrer_id
),
active_counts AS (
    SELECT
        referred_by as referrer_id,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active_count
    FROM users
    WHERE referred_by IS NOT NULL
    GROUP BY referred_by
)
SELECT
    CASE
        WHEN COUNT(*) FILTER (
            WHERE u.direct_referrals_count != COALESCE(rc.paid_count, 0)
               OR u.active_direct_referrals_count != COALESCE(ac.active_count, 0)
        ) = 0
        THEN '✓✓✓ SUCCESS - All counts are correct!'
        ELSE '✗✗✗ FAILED - ' || COUNT(*) FILTER (
            WHERE u.direct_referrals_count != COALESCE(rc.paid_count, 0)
               OR u.active_direct_referrals_count != COALESCE(ac.active_count, 0)
        ) || ' users still have incorrect counts'
    END as result,
    COUNT(*) FILTER (
        WHERE u.direct_referrals_count = COALESCE(rc.paid_count, 0)
         AND u.active_direct_referrals_count = COALESCE(ac.active_count, 0)
    ) as correct_count,
    COUNT(*) FILTER (
        WHERE u.direct_referrals_count != COALESCE(rc.paid_count, 0)
           OR u.active_direct_referrals_count != COALESCE(ac.active_count, 0)
    ) as incorrect_count,
    COUNT(*) as total_users
FROM users u
LEFT JOIN referral_counts rc ON rc.referrer_id = u.id
LEFT JOIN active_counts ac ON ac.referrer_id = u.id
WHERE rc.referrer_id IS NOT NULL OR ac.referrer_id IS NOT NULL OR u.direct_referrals_count > 0 OR u.active_direct_referrals_count > 0;

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
    total_paid_referrals INTEGER;
    total_active_referrals INTEGER;
    total_qualified INTEGER;
BEGIN
    -- Get user counts
    SELECT
        COUNT(DISTINCT referrer_id),
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'active')
    INTO total_users, total_referrals, total_paid_referrals
    FROM referrals;

    -- Get active referred users
    SELECT COUNT(*)
    INTO total_active_referrals
    FROM users
    WHERE referred_by IS NOT NULL
    AND is_active = TRUE;

    -- Get qualified users
    SELECT COUNT(*)
    INTO total_qualified
    FROM users
    WHERE qualified_at IS NOT NULL;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'REFERRAL SYSTEM STATISTICS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Users with referrals: %', total_users;
    RAISE NOTICE '';
    RAISE NOTICE 'Total referrals created: %', total_referrals;
    RAISE NOTICE '  Paid $500 (status=active): %', total_paid_referrals;
    RAISE NOTICE '  Currently active (is_active=TRUE): %', total_active_referrals;
    RAISE NOTICE '';
    RAISE NOTICE 'Qualified users (3+ active referrals): %', total_qualified;
    RAISE NOTICE '';
    RAISE NOTICE 'Both counts have been migrated successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'How counts work:';
    RAISE NOTICE '  direct_referrals_count = users who paid $500 once';
    RAISE NOTICE '  active_direct_referrals_count = users currently active';
    RAISE NOTICE '  Qualification requires: active_direct_referrals_count >= 3';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Test by activating/deactivating a user';
    RAISE NOTICE '  2. Check referrer''s active_direct_referrals_count changes';
    RAISE NOTICE '  3. Verify qualification at 3 active referrals';
END $$;

-- ============================================
-- SHOW QUALIFIED USERS
-- ============================================
SELECT '========================================' as divider;
SELECT 'QUALIFIED USERS' as section;
SELECT '========================================' as divider;

SELECT
    u.name,
    u.email,
    u.direct_referrals_count as total_paid,
    u.active_direct_referrals_count as currently_active,
    u.qualified_at,
    '✓ Can receive structure payouts' as status
FROM users u
WHERE u.qualified_at IS NOT NULL
ORDER BY u.active_direct_referrals_count DESC, u.qualified_at ASC
LIMIT 10;
