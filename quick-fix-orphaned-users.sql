-- ============================================
-- QUICK FIX: Assign Positions to Orphaned Users
-- ============================================
-- Run this AFTER deploying all database functions
-- ============================================

-- ============================================
-- STEP 1: Find orphaned users
-- ============================================
DO $$
DECLARE
    orphan RECORD;
    position_result TEXT;
    orphan_count INTEGER := 0;
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'FINDING ORPHANED USERS...';
    RAISE NOTICE '==========================================';

    -- Find all users without network positions
    FOR orphan IN
        SELECT
            id,
            name,
            email,
            referred_by,
            created_at
        FROM users
        WHERE network_position_id IS NULL
        ORDER BY created_at ASC
    LOOP
        orphan_count := orphan_count + 1;

        RAISE NOTICE '';
        RAISE NOTICE 'Orphaned User #%:', orphan_count;
        RAISE NOTICE '  User ID: %', orphan.id;
        RAISE NOTICE '  Name: %', orphan.name;
        RAISE NOTICE '  Email: %', orphan.email;
        RAISE NOTICE '  Referred By: %', COALESCE(orphan.referred_by::TEXT, 'NULL (ROOT USER?)');
        RAISE NOTICE '  Created: %', orphan.created_at;

        -- Try to assign position
        BEGIN
            IF orphan.referred_by IS NULL THEN
                -- This might be a root user (should be rare)
                RAISE NOTICE '  ⚠ WARNING: No referrer! This user cannot be assigned a position automatically.';
                RAISE NOTICE '  Action: Manually investigate this user.';
            ELSE
                -- Normal referral - assign position
                position_result := public.assign_network_position(orphan.id, orphan.referred_by);
                RAISE NOTICE '  ✓ SUCCESS: Assigned position %', position_result;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ✗ ERROR: %', SQLERRM;
            RAISE NOTICE '  Action: Check if referrer has a position, or contact admin.';
        END;
    END LOOP;

    IF orphan_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '✓ No orphaned users found! All users have network positions.';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '==========================================';
        RAISE NOTICE 'SUMMARY: Found % orphaned user(s)', orphan_count;
        RAISE NOTICE '==========================================';
    END IF;
END $$;

-- ============================================
-- STEP 2: Verify the fix
-- ============================================
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ SUCCESS: All users have network positions!'
        ELSE '✗ WARNING: ' || COUNT(*) || ' user(s) still without positions'
    END as verification_result
FROM users
WHERE network_position_id IS NULL;

-- ============================================
-- STEP 3: Show all users with their positions
-- ============================================
SELECT
    'USER POSITIONS:' as info;

SELECT
    u.name,
    u.email,
    u.network_position_id,
    u.network_level,
    u.total_network_count,
    u.active_network_count,
    (SELECT COUNT(*) FROM users u2 WHERE u2.referred_by = u.id) as direct_referrals,
    (SELECT COUNT(*) FROM users u2 WHERE u2.tree_parent_network_position_id = u.network_position_id) as tree_children
FROM users u
WHERE u.network_position_id IS NOT NULL
ORDER BY u.network_level, u.network_position;

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- If a user still doesn't have a position, check:

-- 1. Does their referrer have a position?
-- SELECT id, name, email, network_position_id
-- FROM users
-- WHERE id = '<referrer-id>';

-- 2. Is the referrer's tree full (first 6 levels)?
-- SELECT * FROM public.find_available_slot('<referrer-position-id>', 6);

-- 3. Manual assignment (if needed):
-- SELECT public.assign_network_position('<user-id>', '<referrer-id>');
