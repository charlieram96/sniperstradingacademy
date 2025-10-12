-- ============================================
-- VERIFICATION: Round-Robin Referral Distribution
-- ============================================
-- Queries to verify the round-robin system is working correctly
-- ============================================

-- ============================================
-- 1. CHECK SCHEMA
-- ============================================

-- Verify last_referral_branch column exists
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name = 'last_referral_branch';

-- Expected: 1 row, type integer, default 1

-- ============================================
-- 2. VIEW CURRENT BRANCH DISTRIBUTION
-- ============================================

-- Show all users with their last_referral_branch value
SELECT
    email,
    network_position_id,
    network_level,
    last_referral_branch
FROM public.users
WHERE network_position_id IS NOT NULL
ORDER BY network_level, network_position;

-- ============================================
-- 3. CHECK BRANCH DISTRIBUTION FOR EACH USER
-- ============================================

-- For each user with direct children, show how many in each branch
WITH direct_children AS (
    SELECT
        parent.id as parent_id,
        parent.email as parent_email,
        parent.network_position_id as parent_position,
        parent.last_referral_branch,
        child.id as child_id,
        child.network_position_id as child_position,
        -- Determine which branch the child is in (1, 2, or 3)
        CASE
            WHEN (child.network_position - 1) % 3 = 0 THEN 1  -- Branch 1
            WHEN (child.network_position - 1) % 3 = 1 THEN 2  -- Branch 2
            WHEN (child.network_position - 1) % 3 = 2 THEN 3  -- Branch 3
        END as child_branch
    FROM public.users parent
    JOIN public.users child ON child.tree_parent_network_position_id = parent.network_position_id
    WHERE parent.network_position_id IS NOT NULL
)
SELECT
    parent_email,
    parent_position,
    last_referral_branch,
    COUNT(*) FILTER (WHERE child_branch = 1) as branch_1_count,
    COUNT(*) FILTER (WHERE child_branch = 2) as branch_2_count,
    COUNT(*) FILTER (WHERE child_branch = 3) as branch_3_count,
    COUNT(*) as total_direct_children
FROM direct_children
GROUP BY parent_id, parent_email, parent_position, last_referral_branch
ORDER BY parent_position;

-- Expected: Counts should be relatively even across branches

-- ============================================
-- 4. VIEW ENTIRE SUBTREE FOR A USER
-- ============================================

-- Show all users in a specific user's subtree organized by branch
-- Replace 'L000P0000000001' with the position you want to check

WITH RECURSIVE subtree AS (
    -- Start with the root position you want to check
    SELECT
        id,
        email,
        network_position_id,
        network_level,
        network_position,
        tree_parent_network_position_id,
        network_position_id as root_position,
        'ROOT' as branch_path,
        0 as depth
    FROM public.users
    WHERE network_position_id = 'L000P0000000001'

    UNION ALL

    SELECT
        u.id,
        u.email,
        u.network_position_id,
        u.network_level,
        u.network_position,
        u.tree_parent_network_position_id,
        s.root_position,
        s.branch_path || ' → ' ||
            CASE
                WHEN (u.network_position - 1) % 3 = 0 THEN '1'
                WHEN (u.network_position - 1) % 3 = 1 THEN '2'
                WHEN (u.network_position - 1) % 3 = 2 THEN '3'
            END,
        s.depth + 1
    FROM public.users u
    JOIN subtree s ON u.tree_parent_network_position_id = s.network_position_id
    WHERE s.depth < 5  -- Limit depth to prevent huge results
)
SELECT
    email,
    network_position_id,
    network_level,
    branch_path,
    depth
FROM subtree
ORDER BY network_level, network_position;

-- ============================================
-- 5. TEST ROUND-ROBIN ASSIGNMENT
-- ============================================

-- This query shows what would happen for next 3 assignments
-- Replace 'referrer-id' with actual UUID

SELECT
    'Next assignment #' || n as assignment,
    ((SELECT last_referral_branch FROM public.users WHERE id = 'referrer-id-here') + n - 1) % 3 + 1 as target_branch,
    slot.*
FROM generate_series(1, 3) as n
CROSS JOIN LATERAL (
    SELECT *
    FROM public.find_available_slot(
        (SELECT network_position_id FROM public.users WHERE id = 'referrer-id-here'),
        100,
        ((SELECT last_referral_branch FROM public.users WHERE id = 'referrer-id-here') + n - 1) % 3 + 1
    )
) as slot;

-- ============================================
-- 6. BRANCH BALANCE REPORT
-- ============================================

-- Overall balance across all branches in the network
WITH branch_positions AS (
    SELECT
        network_level,
        CASE
            WHEN (network_position - 1) % 3 = 0 THEN 1
            WHEN (network_position - 1) % 3 = 1 THEN 2
            WHEN (network_position - 1) % 3 = 2 THEN 3
        END as branch,
        COUNT(*) as users_in_branch
    FROM public.users
    WHERE network_position_id IS NOT NULL
    AND network_level > 0  -- Exclude root
    GROUP BY network_level, branch
)
SELECT
    network_level,
    SUM(CASE WHEN branch = 1 THEN users_in_branch ELSE 0 END) as branch_1,
    SUM(CASE WHEN branch = 2 THEN users_in_branch ELSE 0 END) as branch_2,
    SUM(CASE WHEN branch = 3 THEN users_in_branch ELSE 0 END) as branch_3,
    SUM(users_in_branch) as total,
    -- Calculate standard deviation to measure balance
    STDDEV(users_in_branch) as balance_stddev
FROM branch_positions
GROUP BY network_level
ORDER BY network_level;

-- Lower stddev = better balance

-- ============================================
-- 7. SIMULATE ASSIGNMENTS
-- ============================================

-- Test function to create test users and watch round-robin in action
-- RUN THIS IN A TRANSACTION SO YOU CAN ROLLBACK

/*
BEGIN;

DO $$
DECLARE
    referrer_id UUID := (SELECT id FROM public.users WHERE email = 'sniperstacademy@gmail.com');
    new_user_id UUID;
    assigned_position TEXT;
    i INTEGER;
BEGIN
    FOR i IN 1..9 LOOP
        -- Create test user
        new_user_id := gen_random_uuid();

        INSERT INTO public.users (id, email, name, referred_by)
        VALUES (
            new_user_id,
            'roundrobin_test_' || i || '@example.com',
            'RR Test ' || i,
            referrer_id
        );

        -- Assign position
        assigned_position := public.assign_network_position(new_user_id, referrer_id);

        -- Show result
        RAISE NOTICE 'User %: Assigned to %', i, assigned_position;

        -- Show referrer's updated last_referral_branch
        RAISE NOTICE 'Referrer last_referral_branch now: %',
            (SELECT last_referral_branch FROM public.users WHERE id = referrer_id);
    END LOOP;

    -- Show final distribution
    RAISE NOTICE '===== Final Distribution =====';
END $$;

-- View the test assignments
SELECT
    email,
    network_position_id,
    network_level,
    network_position,
    CASE
        WHEN (network_position - 1) % 3 = 0 THEN 'Branch 1'
        WHEN (network_position - 1) % 3 = 1 THEN 'Branch 2'
        WHEN (network_position - 1) % 3 = 2 THEN 'Branch 3'
    END as branch
FROM public.users
WHERE email LIKE 'roundrobin_test_%'
ORDER BY network_level, network_position;

-- If satisfied, COMMIT. Otherwise, ROLLBACK.
ROLLBACK;
-- COMMIT;
*/

-- ============================================
-- 8. CHECK FOR ISSUES
-- ============================================

-- Find users with invalid last_referral_branch values
SELECT
    email,
    network_position_id,
    last_referral_branch
FROM public.users
WHERE network_position_id IS NOT NULL
AND (last_referral_branch IS NULL OR last_referral_branch NOT IN (1, 2, 3));

-- Expected: 0 rows

-- Find users with children in wrong branch order
-- (May indicate assignment happened before round-robin was enabled)
WITH child_branches AS (
    SELECT
        parent.id as parent_id,
        parent.email as parent_email,
        parent.last_referral_branch,
        child.network_position_id as child_position,
        child.created_at,
        CASE
            WHEN (child.network_position - 1) % 3 = 0 THEN 1
            WHEN (child.network_position - 1) % 3 = 1 THEN 2
            WHEN (child.network_position - 1) % 3 = 2 THEN 3
        END as child_branch,
        ROW_NUMBER() OVER (PARTITION BY parent.id ORDER BY child.created_at) as assignment_order
    FROM public.users parent
    JOIN public.users child ON child.tree_parent_network_position_id = parent.network_position_id
)
SELECT *
FROM child_branches
ORDER BY parent_id, assignment_order;

-- ============================================
-- SUCCESS
-- ============================================
SELECT '✅ Round-robin verification queries ready!' as message;
