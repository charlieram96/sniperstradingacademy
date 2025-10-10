-- ============================================
-- INCREMENTAL NETWORK COUNTING FUNCTIONS
-- ============================================
-- This replaces expensive scan-based counting with efficient
-- event-driven incremental updates that walk the upchain.
--
-- Performance: O(depth) instead of O(subtree_size)
-- Example: Updating 10 ancestors is 100x faster than scanning 1000+ descendants
-- ============================================

-- ============================================
-- 1. INCREMENT TOTAL NETWORK COUNT
-- ============================================
-- Called when: User gets network position assigned
-- Effect: Adds +1 to total_network_count for all ancestors

CREATE OR REPLACE FUNCTION public.increment_upchain_total_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    user_position_id TEXT;
    ancestor RECORD;
    update_count INTEGER := 0;
BEGIN
    -- Get user's network position
    SELECT network_position_id INTO user_position_id
    FROM public.users
    WHERE id = p_user_id;

    -- If no position assigned yet, nothing to do
    IF user_position_id IS NULL THEN
        RETURN 0;
    END IF;

    -- Walk up the entire chain and increment total count for each ancestor
    FOR ancestor IN
        SELECT user_id
        FROM public.get_upline_chain(user_position_id)
        WHERE user_id != p_user_id
    LOOP
        UPDATE public.users
        SET total_network_count = total_network_count + 1
        WHERE id = ancestor.user_id;

        update_count := update_count + 1;
    END LOOP;

    RETURN update_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. DECREMENT TOTAL NETWORK COUNT
-- ============================================
-- Called when: User position is vacated (90+ days inactive)
-- Effect: Subtracts -1 from total_network_count for all ancestors

CREATE OR REPLACE FUNCTION public.decrement_upchain_total_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    user_position_id TEXT;
    ancestor RECORD;
    update_count INTEGER := 0;
BEGIN
    -- Get user's network position (before it's vacated)
    SELECT network_position_id INTO user_position_id
    FROM public.users
    WHERE id = p_user_id;

    -- If no position, nothing to do
    IF user_position_id IS NULL THEN
        RETURN 0;
    END IF;

    -- Walk up the chain and decrement total count for each ancestor
    FOR ancestor IN
        SELECT user_id
        FROM public.get_upline_chain(user_position_id)
        WHERE user_id != p_user_id
    LOOP
        UPDATE public.users
        SET total_network_count = GREATEST(0, total_network_count - 1)
        WHERE id = ancestor.user_id;

        update_count := update_count + 1;
    END LOOP;

    RETURN update_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. INCREMENT ACTIVE NETWORK COUNT
-- ============================================
-- Called when: User becomes active (pays subscription)
-- Effect: Adds +1 to active_network_count for all ancestors

CREATE OR REPLACE FUNCTION public.increment_upchain_active_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    user_position_id TEXT;
    ancestor RECORD;
    update_count INTEGER := 0;
BEGIN
    -- Get user's network position
    SELECT network_position_id INTO user_position_id
    FROM public.users
    WHERE id = p_user_id;

    -- If no position assigned yet, nothing to do
    IF user_position_id IS NULL THEN
        RETURN 0;
    END IF;

    -- Walk up the chain and increment active count for each ancestor
    FOR ancestor IN
        SELECT user_id
        FROM public.get_upline_chain(user_position_id)
        WHERE user_id != p_user_id
    LOOP
        UPDATE public.users
        SET active_network_count = active_network_count + 1
        WHERE id = ancestor.user_id;

        update_count := update_count + 1;
    END LOOP;

    RETURN update_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. DECREMENT ACTIVE NETWORK COUNT
-- ============================================
-- Called when: User becomes inactive (33+ days without payment)
-- Effect: Subtracts -1 from active_network_count for all ancestors

CREATE OR REPLACE FUNCTION public.decrement_upchain_active_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    user_position_id TEXT;
    ancestor RECORD;
    update_count INTEGER := 0;
BEGIN
    -- Get user's network position
    SELECT network_position_id INTO user_position_id
    FROM public.users
    WHERE id = p_user_id;

    -- If no position, nothing to do
    IF user_position_id IS NULL THEN
        RETURN 0;
    END IF;

    -- Walk up the chain and decrement active count for each ancestor
    FOR ancestor IN
        SELECT user_id
        FROM public.get_upline_chain(user_position_id)
        WHERE user_id != p_user_id
    LOOP
        UPDATE public.users
        SET active_network_count = GREATEST(0, active_network_count - 1)
        WHERE id = ancestor.user_id;

        update_count := update_count + 1;
    END LOOP;

    RETURN update_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. SYNC COUNTS FOR SINGLE USER (FALLBACK)
-- ============================================
-- This is the old scan-based approach, kept as a fallback
-- for manual corrections or one-time sync operations.
-- Don't call this on every payment - use incremental functions instead!

CREATE OR REPLACE FUNCTION public.sync_network_counts(p_user_id UUID)
RETURNS TABLE(
    total_before INTEGER,
    active_before INTEGER,
    total_after INTEGER,
    active_after INTEGER
) AS $$
DECLARE
    user_pos_id TEXT;
    counts RECORD;
    old_total INTEGER;
    old_active INTEGER;
BEGIN
    -- Get current values
    SELECT total_network_count, active_network_count
    INTO old_total, old_active
    FROM public.users
    WHERE id = p_user_id;

    -- Get user's network position
    SELECT network_position_id INTO user_pos_id
    FROM public.users
    WHERE id = p_user_id;

    IF user_pos_id IS NULL THEN
        RETURN QUERY SELECT old_total, old_active, old_total, old_active;
        RETURN;
    END IF;

    -- Scan and count (expensive!)
    SELECT * INTO counts
    FROM public.count_network_size(user_pos_id);

    -- Update with scanned values
    UPDATE public.users
    SET
        total_network_count = counts.total_count,
        active_network_count = counts.active_count
    WHERE id = p_user_id;

    RETURN QUERY SELECT
        old_total,
        old_active,
        counts.total_count,
        counts.active_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. BATCH SYNC ALL USERS (ADMIN ONLY)
-- ============================================
-- Recalculates all network counts by scanning.
-- Use ONLY for one-time corrections or initial migration.
-- This is SLOW for large networks!

CREATE OR REPLACE FUNCTION public.sync_all_network_counts()
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    total_before INTEGER,
    active_before INTEGER,
    total_after INTEGER,
    active_after INTEGER,
    changed BOOLEAN
) AS $$
DECLARE
    user_record RECORD;
    sync_result RECORD;
BEGIN
    FOR user_record IN
        SELECT id, email, total_network_count, active_network_count
        FROM public.users
        WHERE network_position_id IS NOT NULL
        ORDER BY network_level, network_position
    LOOP
        -- Sync this user's counts
        SELECT * INTO sync_result
        FROM public.sync_network_counts(user_record.id)
        LIMIT 1;

        RETURN QUERY SELECT
            user_record.id,
            user_record.email,
            sync_result.total_before,
            sync_result.active_before,
            sync_result.total_after,
            sync_result.active_after,
            (sync_result.total_before != sync_result.total_after OR
             sync_result.active_before != sync_result.active_after);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES (Already exist, but included for reference)
-- ============================================
-- These indexes optimize the upchain walk and count queries:
-- - idx_users_network_position_id
-- - idx_users_network_level
-- - idx_users_is_active
-- - idx_users_last_payment

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.increment_upchain_total_count(UUID) IS
    'Increments total_network_count +1 for all ancestors. Called when user gets network position. O(depth) performance.';

COMMENT ON FUNCTION public.decrement_upchain_total_count(UUID) IS
    'Decrements total_network_count -1 for all ancestors. Called when user position is vacated (90+ days). O(depth) performance.';

COMMENT ON FUNCTION public.increment_upchain_active_count(UUID) IS
    'Increments active_network_count +1 for all ancestors. Called when user becomes active (pays subscription). O(depth) performance.';

COMMENT ON FUNCTION public.decrement_upchain_active_count(UUID) IS
    'Decrements active_network_count -1 for all ancestors. Called when user becomes inactive (33+ days without payment). O(depth) performance.';

COMMENT ON FUNCTION public.sync_network_counts(UUID) IS
    'Scans subtree and corrects counts for single user. SLOW - use only for manual corrections. O(subtree_size) performance.';

COMMENT ON FUNCTION public.sync_all_network_counts() IS
    'Recalculates all network counts by scanning. VERY SLOW - use only for initial migration or fixing data issues.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Test incrementing counts for a user
-- SELECT public.increment_upchain_total_count('user-uuid-here');
-- SELECT public.increment_upchain_active_count('user-uuid-here');

-- Test decrementing counts
-- SELECT public.decrement_upchain_active_count('user-uuid-here');
-- SELECT public.decrement_upchain_total_count('user-uuid-here');

-- Compare incremental vs scan for accuracy (should match)
-- SELECT
--   u.id,
--   u.total_network_count as current_total,
--   u.active_network_count as current_active,
--   n.total_count as scanned_total,
--   n.active_count as scanned_active,
--   (u.total_network_count = n.total_count) as total_matches,
--   (u.active_network_count = n.active_count) as active_matches
-- FROM public.users u
-- CROSS JOIN LATERAL public.count_network_size(u.network_position_id) n
-- WHERE u.network_position_id IS NOT NULL
-- LIMIT 10;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Incremental network counting functions created! Ready for event-based updates.' as message;
