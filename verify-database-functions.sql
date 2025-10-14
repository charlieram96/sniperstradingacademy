-- ============================================
-- VERIFY DATABASE FUNCTIONS
-- ============================================
-- Run this to check what functions are deployed
-- ============================================

-- Check for get_tree_children function
SELECT
    'get_tree_children' as function_name,
    CASE
        WHEN COUNT(*) > 0 THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM pg_proc
WHERE proname = 'get_tree_children';

-- Check for assign_network_position function
SELECT
    'assign_network_position' as function_name,
    CASE
        WHEN COUNT(*) > 0 THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM pg_proc
WHERE proname = 'assign_network_position';

-- Check for increment_upchain_total_count function
SELECT
    'increment_upchain_total_count' as function_name,
    CASE
        WHEN COUNT(*) > 0 THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM pg_proc
WHERE proname = 'increment_upchain_total_count';

-- Check for increment_upchain_active_count function
SELECT
    'increment_upchain_active_count' as function_name,
    CASE
        WHEN COUNT(*) > 0 THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM pg_proc
WHERE proname = 'increment_upchain_active_count';

-- Check for helper functions
SELECT
    'calculate_child_positions' as function_name,
    CASE
        WHEN COUNT(*) > 0 THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM pg_proc
WHERE proname = 'calculate_child_positions';

SELECT
    'format_network_position_id' as function_name,
    CASE
        WHEN COUNT(*) > 0 THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM pg_proc
WHERE proname = 'format_network_position_id';

-- ============================================
-- FIND ORPHANED USERS (no network position)
-- ============================================
SELECT
    id,
    name,
    email,
    created_at,
    referred_by,
    network_position_id
FROM users
WHERE network_position_id IS NULL
ORDER BY created_at DESC;

-- ============================================
-- CHECK NETWORK COUNTS
-- ============================================
SELECT
    id,
    name,
    email,
    network_position_id,
    total_network_count,
    active_network_count
FROM users
WHERE network_position_id IS NOT NULL
ORDER BY network_level, network_position;
