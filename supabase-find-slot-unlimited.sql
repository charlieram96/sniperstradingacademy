-- ============================================
-- FIX: find_available_slot() - UNLIMITED DEPTH
-- ============================================
-- Searches for an available position in the network tree
-- using breadth-first search (shallowest level first).
--
-- CRITICAL CHANGE: Increased max_depth from 6 to 100
-- This allows unlimited network depth while maintaining
-- a safety limit to prevent infinite loops.
-- ============================================

-- Drop old version first
DROP FUNCTION IF EXISTS public.find_available_slot(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.find_available_slot(
    referrer_position_id TEXT,
    max_depth INTEGER DEFAULT 100  -- Increased from 6 to 100
)
RETURNS TABLE(
    available_level INTEGER,
    available_position BIGINT,
    parent_position_id TEXT,
    relative_level INTEGER
) AS $$
DECLARE
    ref_level INTEGER;
    ref_position BIGINT;
    current_level INTEGER;
    positions_at_level BIGINT[];
    pos BIGINT;
    parent_pos BIGINT;
    i INTEGER;
BEGIN
    -- Parse referrer's position
    SELECT p.level, p.pos INTO ref_level, ref_position
    FROM public.parse_network_position_id(referrer_position_id) p;

    -- Search level by level (breadth-first search)
    FOR i IN 1..max_depth LOOP
        current_level := ref_level + i;

        -- Calculate positions at this level
        IF i = 1 THEN
            -- Level 1: 3 positions directly under referrer
            positions_at_level := public.calculate_child_positions(ref_position);
        ELSE
            -- For deeper levels, calculate all positions in referrer's subtree
            DECLARE
                start_pos BIGINT;
                end_pos BIGINT;
                positions_count BIGINT;
            BEGIN
                positions_count := POWER(3, i)::BIGINT;
                start_pos := (ref_position - 1) * positions_count + 1;
                end_pos := start_pos + positions_count - 1;

                -- Build array of all positions at this level
                positions_at_level := ARRAY[]::BIGINT[];
                FOR pos IN start_pos..end_pos LOOP
                    positions_at_level := array_append(positions_at_level, pos);
                END LOOP;
            END;
        END IF;

        -- Check each position to find first available
        FOREACH pos IN ARRAY positions_at_level LOOP
            IF NOT public.is_position_occupied(current_level, pos) THEN
                -- Found available slot - determine parent
                parent_pos := public.get_parent_position(pos);

                RETURN QUERY SELECT
                    current_level,
                    pos,
                    public.format_network_position_id(current_level - 1, parent_pos),
                    i;
                RETURN;
            END IF;
        END LOOP;
    END LOOP;

    -- No slot found within max_depth
    -- This should be very rare with max_depth=100
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- OPTIMIZED VERSION (For Large Networks)
-- ============================================
-- This version uses a set-based approach instead of looping
-- through individual positions, making it faster for large networks

CREATE OR REPLACE FUNCTION public.find_available_slot_optimized(
    referrer_position_id TEXT,
    max_depth INTEGER DEFAULT 100
)
RETURNS TABLE(
    available_level INTEGER,
    available_position BIGINT,
    parent_position_id TEXT,
    relative_level INTEGER
) AS $$
DECLARE
    ref_level INTEGER;
    ref_position BIGINT;
    current_level INTEGER;
    i INTEGER;
    start_pos BIGINT;
    end_pos BIGINT;
    positions_count BIGINT;
    first_available RECORD;
BEGIN
    SELECT p.level, p.pos INTO ref_level, ref_position
    FROM public.parse_network_position_id(referrer_position_id) p;

    -- Search level by level
    FOR i IN 1..max_depth LOOP
        current_level := ref_level + i;
        positions_count := POWER(3, i)::BIGINT;
        start_pos := (ref_position - 1) * positions_count + 1;
        end_pos := start_pos + positions_count - 1;

        -- Find first position in range that's not occupied
        SELECT
            pos_num,
            public.get_parent_position(pos_num) as parent_pos
        INTO first_available
        FROM generate_series(start_pos, end_pos) as pos_num
        WHERE NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE network_position_id = public.format_network_position_id(current_level, pos_num)
        )
        LIMIT 1;

        -- If found, return it
        IF first_available IS NOT NULL THEN
            RETURN QUERY SELECT
                current_level,
                first_available.pos_num,
                public.format_network_position_id(current_level - 1, first_available.parent_pos),
                i;
            RETURN;
        END IF;
    END LOOP;

    -- No slot found
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER: Count Available Slots at Level
-- ============================================
-- Returns how many empty positions exist at each level
-- Useful for analytics and monitoring network growth

CREATE OR REPLACE FUNCTION public.count_available_slots(
    referrer_position_id TEXT,
    max_depth INTEGER DEFAULT 20
)
RETURNS TABLE(
    relative_level INTEGER,
    absolute_level INTEGER,
    total_positions BIGINT,
    occupied_positions BIGINT,
    available_positions BIGINT
) AS $$
DECLARE
    ref_level INTEGER;
    ref_position BIGINT;
    i INTEGER;
    start_pos BIGINT;
    end_pos BIGINT;
    positions_count BIGINT;
    occupied BIGINT;
BEGIN
    SELECT p.level, p.pos INTO ref_level, ref_position
    FROM public.parse_network_position_id(referrer_position_id) p;

    FOR i IN 1..max_depth LOOP
        positions_count := POWER(3, i)::BIGINT;
        start_pos := (ref_position - 1) * positions_count + 1;
        end_pos := start_pos + positions_count - 1;

        -- Count how many are occupied
        SELECT COUNT(*) INTO occupied
        FROM public.users
        WHERE network_level = ref_level + i
        AND network_position >= start_pos
        AND network_position <= end_pos;

        RETURN QUERY SELECT
            i,
            ref_level + i,
            positions_count,
            occupied,
            positions_count - occupied;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.find_available_slot(TEXT, INTEGER) IS
    'Finds first available position in network using breadth-first search. max_depth increased to 100 for unlimited network growth. Returns shallowest available slot.';

COMMENT ON FUNCTION public.find_available_slot_optimized(TEXT, INTEGER) IS
    'Optimized version using set-based queries. Recommended for networks with thousands of members. Faster than looping approach.';

COMMENT ON FUNCTION public.count_available_slots(TEXT, INTEGER) IS
    'Returns statistics about available positions at each level. Useful for monitoring network capacity and growth patterns.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Find next available slot for a user
-- SELECT * FROM public.find_available_slot('L000P0000000001', 100);

-- Use optimized version
-- SELECT * FROM public.find_available_slot_optimized('L000P0000000001', 100);

-- Check capacity at each level
-- SELECT * FROM public.count_available_slots('L000P0000000001', 10);
