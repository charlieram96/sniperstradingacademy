-- ============================================
-- VERIFICATION: Two-Phase Active Status Logic
-- ============================================
-- This verifies the new active status system works correctly
-- ============================================

-- ============================================
-- 1. CHECK INITIAL PAYMENT DATE COLUMN EXISTS
-- ============================================

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name = 'initial_payment_date';

-- Expected: 1 row showing the column exists

-- ============================================
-- 2. VIEW ALL USERS WITH ACTIVE STATUS BREAKDOWN
-- ============================================

SELECT
    u.email,
    u.is_active,
    u.initial_payment_completed,
    u.initial_payment_date,
    CASE
        WHEN u.initial_payment_date IS NOT NULL
        THEN EXTRACT(DAY FROM NOW() - u.initial_payment_date)::INTEGER
        ELSE NULL
    END as days_since_initial_payment,
    s.status as subscription_status,
    -- Is user in 30-day grace period?
    (
        u.initial_payment_completed = TRUE
        AND s.status IS NULL
        AND u.initial_payment_date IS NOT NULL
        AND u.initial_payment_date >= NOW() - INTERVAL '30 days'
    ) as in_grace_period,
    -- Should user be active?
    (
        (s.status = 'active')
        OR
        (
            u.initial_payment_completed = TRUE
            AND s.status IS NULL
            AND u.initial_payment_date IS NOT NULL
            AND u.initial_payment_date >= NOW() - INTERVAL '30 days'
        )
    ) as should_be_active,
    -- Does current status match expected?
    (
        u.is_active = (
            (s.status = 'active')
            OR
            (
                u.initial_payment_completed = TRUE
                AND s.status IS NULL
                AND u.initial_payment_date IS NOT NULL
                AND u.initial_payment_date >= NOW() - INTERVAL '30 days'
            )
        )
    ) as status_matches
FROM public.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE u.network_position_id IS NOT NULL
ORDER BY u.network_level, u.network_position;

-- Expected: All users show status_matches = TRUE

-- ============================================
-- 3. PREVIEW WHAT DAILY CRON WILL DO
-- ============================================

SELECT * FROM public.preview_active_status_changes()
WHERE status_change != 'No change';

-- Expected: Shows users whose status will change when cron runs

-- ============================================
-- 4. CHECK USERS IN GRACE PERIOD
-- ============================================

SELECT
    email,
    initial_payment_date,
    EXTRACT(DAY FROM NOW() - initial_payment_date)::INTEGER as days_since_payment,
    CASE
        WHEN EXTRACT(DAY FROM NOW() - initial_payment_date)::INTEGER <= 30
        THEN '✅ Within grace period'
        ELSE '❌ Grace period expired'
    END as grace_status,
    is_active,
    (SELECT status FROM public.subscriptions WHERE user_id = u.id LIMIT 1) as subscription_status
FROM public.users u
WHERE initial_payment_completed = TRUE
AND network_position_id IS NOT NULL
ORDER BY initial_payment_date DESC;

-- Expected: Users within 30 days should be active (if no subscription)

-- ============================================
-- 5. CHECK USERS WITH SUBSCRIPTIONS
-- ============================================

SELECT
    u.email,
    u.is_active,
    s.status as subscription_status,
    s.current_period_end,
    (u.is_active = (s.status = 'active')) as matches
FROM public.users u
JOIN public.subscriptions s ON s.user_id = u.id
WHERE u.network_position_id IS NOT NULL
ORDER BY s.created_at DESC;

-- Expected: All rows show matches = TRUE

-- ============================================
-- 6. ACTIVE COUNT ACCURACY CHECK
-- ============================================

-- This checks if active_network_count matches reality
-- (Only for top-level users, full tree scan would be slow)

WITH actual_active AS (
    SELECT
        parent.id,
        parent.email,
        COUNT(*) FILTER (
            WHERE (
                child_sub.status = 'active'
                OR
                (
                    child.initial_payment_completed = TRUE
                    AND child_sub.status IS NULL
                    AND child.initial_payment_date IS NOT NULL
                    AND child.initial_payment_date >= NOW() - INTERVAL '30 days'
                )
            )
        ) as calculated_active_count
    FROM public.users parent
    LEFT JOIN public.users child ON (
        child.network_level > parent.network_level
        AND child.network_position >= (parent.network_position - 1) * POWER(3, child.network_level - parent.network_level)::BIGINT + 1
        AND child.network_position <= (parent.network_position) * POWER(3, child.network_level - parent.network_level)::BIGINT
    )
    LEFT JOIN public.subscriptions child_sub ON child_sub.user_id = child.id
    WHERE parent.network_position_id IS NOT NULL
    GROUP BY parent.id, parent.email
)
SELECT
    u.email,
    u.network_level,
    u.active_network_count as stored_count,
    a.calculated_active_count,
    (u.active_network_count = a.calculated_active_count) as matches
FROM public.users u
JOIN actual_active a ON a.id = u.id
WHERE u.network_level <= 2  -- Only check first 2 levels (slow query for deep trees)
ORDER BY u.network_level, u.network_position;

-- Expected: All rows show matches = TRUE

-- ============================================
-- 7. SUMMARY STATISTICS
-- ============================================

SELECT
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_users,
    COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_users,
    COUNT(*) FILTER (
        WHERE initial_payment_completed = TRUE
        AND subscription_status IS NULL
        AND initial_payment_date >= NOW() - INTERVAL '30 days'
    ) as in_grace_period,
    COUNT(*) FILTER (WHERE subscription_status = 'active') as with_active_subscription
FROM (
    SELECT
        u.is_active,
        u.initial_payment_completed,
        u.initial_payment_date,
        s.status as subscription_status
    FROM public.users u
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    WHERE u.network_position_id IS NOT NULL
) stats;

-- ============================================
-- 8. TEST CASES TO VERIFY
-- ============================================

-- Test Case 1: User paid $500, no subscription, within 30 days
-- Expected: is_active = TRUE

SELECT
    'Test Case 1' as test,
    email,
    is_active,
    'Should be TRUE (in grace period)' as expected
FROM public.users
WHERE initial_payment_completed = TRUE
AND initial_payment_date >= NOW() - INTERVAL '30 days'
AND (SELECT COUNT(*) FROM public.subscriptions WHERE user_id = users.id) = 0
LIMIT 1;

-- Test Case 2: User paid $500, no subscription, >30 days ago
-- Expected: is_active = FALSE

SELECT
    'Test Case 2' as test,
    email,
    is_active,
    'Should be FALSE (grace period expired)' as expected
FROM public.users
WHERE initial_payment_completed = TRUE
AND initial_payment_date < NOW() - INTERVAL '30 days'
AND (SELECT COUNT(*) FROM public.subscriptions WHERE user_id = users.id) = 0
LIMIT 1;

-- Test Case 3: User has active subscription
-- Expected: is_active = TRUE

SELECT
    'Test Case 3' as test,
    u.email,
    u.is_active,
    'Should be TRUE (active subscription)' as expected
FROM public.users u
JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.status = 'active'
LIMIT 1;

-- Test Case 4: User has inactive subscription
-- Expected: is_active = FALSE

SELECT
    'Test Case 4' as test,
    u.email,
    u.is_active,
    'Should be FALSE (inactive subscription)' as expected
FROM public.users u
JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.status IN ('past_due', 'canceled', 'unpaid')
LIMIT 1;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT '✅ Two-phase active status verification complete!' as message;
