-- ============================================
-- FIX ORPHANED USERS
-- ============================================
-- This script assigns network positions to users
-- who were created but never got a position assigned
-- ============================================

-- BEFORE running this, you MUST:
-- 1. Run supabase-tree-children-function.sql
-- 2. Run supabase-assign-position-with-count.sql (or the current assign function)
-- 3. Run verify-database-functions.sql to confirm functions exist

-- ============================================
-- STEP 1: Find orphaned users
-- ============================================
SELECT
    'ORPHANED USERS (no network position):' as info;

SELECT
    id,
    name,
    email,
    created_at,
    referred_by
FROM users
WHERE network_position_id IS NULL
ORDER BY created_at ASC;

-- ============================================
-- STEP 2: Assign positions to orphaned users
-- ============================================
-- For each orphaned user, run this manually:
-- Replace <user-id> and <referrer-id> with actual values

-- Example for a user with a referrer:
-- SELECT public.assign_network_position('<user-id>', '<referrer-id>');

-- Example for a user without a referrer (shouldn't happen unless they're root):
-- SELECT public.assign_network_position('<user-id>', NULL);

-- ============================================
-- STEP 3: Verify the fix
-- ============================================
-- After running the assignments above, verify:
SELECT
    'VERIFICATION - All users should have positions now:' as info;

SELECT
    COUNT(*) as users_without_position
FROM users
WHERE network_position_id IS NULL;

-- Should return 0

-- ============================================
-- STEP 4: Check network counts were updated
-- ============================================
SELECT
    'NETWORK COUNTS CHECK:' as info;

SELECT
    u.name,
    u.network_position_id,
    u.total_network_count,
    u.active_network_count,
    (
        SELECT COUNT(*)
        FROM users u2
        WHERE u2.tree_parent_network_position_id = u.network_position_id
    ) as direct_children_count
FROM users u
WHERE u.network_position_id IS NOT NULL
ORDER BY u.network_level, u.network_position;
