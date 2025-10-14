-- ============================================
-- UPDATED assign_network_position FUNCTION
-- ============================================
-- This version uses UNLIMITED DEPTH (max_depth=100)
-- and includes automatic network count incrementing.
--
-- IMPORTANT: Run cleanup-duplicate-functions.sql BEFORE this!
-- Then run supabase-find-slot-unlimited.sql BEFORE this!
-- ============================================

CREATE OR REPLACE FUNCTION public.assign_network_position(
    p_user_id UUID,
    p_referrer_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    new_position_id TEXT;
    new_level INTEGER;
    new_position BIGINT;
    parent_pos_id TEXT;
    referrer_pos_id TEXT;
    slot_info RECORD;
    ancestors_updated INTEGER;
BEGIN
    -- Check if this is the first user (principal user)
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE network_position_id IS NOT NULL) THEN
        -- This is the root user
        new_position_id := 'L000P0000000001';
        new_level := 0;
        new_position := 1;
        parent_pos_id := NULL;
    ELSE
        -- Get referrer's position
        IF p_referrer_id IS NULL THEN
            RAISE EXCEPTION 'Referrer is required for non-root users';
        END IF;

        SELECT network_position_id INTO referrer_pos_id
        FROM public.users
        WHERE id = p_referrer_id;

        IF referrer_pos_id IS NULL THEN
            RAISE EXCEPTION 'Referrer does not have a network position';
        END IF;

        -- Find available slot in referrer's subtree
        -- UPDATED: Changed from max_depth=6 to max_depth=100 for unlimited growth
        SELECT * INTO slot_info
        FROM public.find_available_slot(referrer_pos_id, 100)
        LIMIT 1;

        IF slot_info IS NULL THEN
            RAISE EXCEPTION 'No available slots in referrer structure (first 100 levels full)';
        END IF;

        new_level := slot_info.available_level;
        new_position := slot_info.available_position;
        parent_pos_id := slot_info.parent_position_id;
        new_position_id := public.format_network_position_id(new_level, new_position);
    END IF;

    -- Update user with network position
    UPDATE public.users
    SET
        network_position_id = new_position_id,
        network_level = new_level,
        network_position = new_position,
        tree_parent_network_position_id = parent_pos_id
    WHERE id = p_user_id;

    -- 🆕 INCREMENT TOTAL NETWORK COUNT FOR ALL ANCESTORS
    -- This walks up the upchain and adds +1 to each ancestor's total_network_count
    BEGIN
        SELECT public.increment_upchain_total_count(p_user_id) INTO ancestors_updated;
        RAISE NOTICE 'Network position assigned: %. Updated % ancestors total count.', new_position_id, ancestors_updated;
    EXCEPTION WHEN OTHERS THEN
        -- Don't fail the position assignment if count update fails
        RAISE WARNING 'Position assigned but count update failed: %', SQLERRM;
    END;

    RETURN new_position_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENT
-- ============================================

COMMENT ON FUNCTION public.assign_network_position(UUID, UUID) IS
    'Assigns network position using breadth-first search with UNLIMITED DEPTH (max 100 levels). Automatically increments total_network_count for all ancestors.';

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this, verify by assigning a test user:
-- SELECT public.assign_network_position('new-user-uuid', 'referrer-uuid');
-- Then check that all ancestors have total_network_count incremented by 1

-- ============================================
-- DEPENDENCIES
-- ============================================
-- This function requires:
-- 1. public.find_available_slot(TEXT, INTEGER) - unlimited version
-- 2. public.increment_upchain_total_count(UUID) - from incremental-network-counts
-- 3. public.format_network_position_id(INTEGER, BIGINT) - from network-position-schema
--
-- Make sure to run these SQL files in order:
-- 1. supabase-network-position-schema.sql (base functions)
-- 2. supabase-upline-chain-unlimited.sql (unlimited upline)
-- 3. supabase-incremental-network-counts.sql (count functions)
-- 4. cleanup-duplicate-functions.sql (cleanup)
-- 5. supabase-find-slot-unlimited.sql (correct find_available_slot)
-- 6. THIS FILE (supabase-assign-position-unlimited.sql)

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'assign_network_position updated with UNLIMITED DEPTH (100 levels) and automatic count incrementing!' as message;
