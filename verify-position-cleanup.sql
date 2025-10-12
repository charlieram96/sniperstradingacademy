-- ============================================
-- VERIFICATION QUERIES AFTER TRAILING NEWLINE FIX
-- ============================================
-- Run these queries to verify the cleanup worked

-- 1. Check all positions now have correct length (should all be 15)
SELECT
    email,
    network_position_id,
    length(network_position_id) as len,
    tree_parent_network_position_id,
    length(tree_parent_network_position_id) as parent_len
FROM public.users
WHERE network_position_id IS NOT NULL
ORDER BY network_level, network_position;

-- Expected: All len = 15, no whitespace

-- 2. Verify is_position_occupied now works correctly for jorge's position
SELECT
    'Jorge position check' as test,
    public.is_position_occupied(1, 2) as result,
    'Should be TRUE' as expected;

-- Expected: result = TRUE

-- 3. Check find_available_slot returns correct next position
SELECT
    'Next available slot' as test,
    available_level,
    available_position,
    parent_position_id,
    'Should be L002P0000000003 or higher (NOT L001P0000000002)' as expected
FROM public.find_available_slot('L000P0000000001', 6);

-- Expected: available_level = 2, available_position = 3 (or higher)

-- 4. Verify no duplicate positions exist
SELECT
    network_position_id,
    COUNT(*) as user_count,
    array_agg(email ORDER BY created_at) as emails
FROM public.users
WHERE network_position_id IS NOT NULL
GROUP BY network_position_id
HAVING COUNT(*) > 1;

-- Expected: 0 rows (no duplicates)

-- 5. View cleaned network structure
SELECT
    network_level,
    network_position,
    network_position_id,
    email,
    tree_parent_network_position_id
FROM public.users
WHERE network_position_id IS NOT NULL
ORDER BY network_level, network_position;

-- Expected: All position IDs clean, jorge at L001P0000000002, no duplicates
