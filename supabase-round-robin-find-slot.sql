-- ============================================
-- ROUND-ROBIN: find_available_slot_in_branch()
-- ============================================
-- Updated version that searches only within a specific branch
-- Used for round-robin distribution of referrals
-- ============================================

-- Drop old version first
DROP FUNCTION IF EXISTS public.find_available_slot_in_branch(TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.find_available_slot_in_branch(
    referrer_position_id TEXT,
    p_target_branch INTEGER,  -- 1, 2, or 3
    max_depth INTEGER DEFAULT 100
)
RETURNS TABLE(
    available_level INTEGER,
    available_position BIGINT,
    parent_position_id TEXT,
    relative_level INTEGER,
    target_branch INTEGER
) AS $$
DECLARE
    ref_level INTEGER;
    ref_position BIGINT;
    branch_root_level INTEGER;
    branch_root_position BIGINT;
    branch_root_position_id TEXT;
    current_level INTEGER;
    positions_at_level BIGINT[];
    pos BIGINT;
    parent_pos BIGINT;
    i INTEGER;
    start_pos BIGINT;
    end_pos BIGINT;
    positions_count BIGINT;
BEGIN
    -- Validate target branch
    IF p_target_branch NOT IN (1, 2, 3) THEN
        RAISE EXCEPTION 'target_branch must be 1, 2, or 3. Got: %', p_target_branch;
    END IF;

    -- Parse referrer's position
    SELECT p.level, p.pos INTO ref_level, ref_position
    FROM public.parse_network_position_id(referrer_position_id) p;

    -- Calculate the root of the target branch
    -- Branch 1: (ref_position - 1) * 3 + 1
    -- Branch 2: (ref_position - 1) * 3 + 2
    -- Branch 3: (ref_position - 1) * 3 + 3
    branch_root_level := ref_level + 1;
    branch_root_position := (ref_position - 1) * 3 + p_target_branch;
    branch_root_position_id := public.format_network_position_id(branch_root_level, branch_root_position);

    -- First check: Is the branch root itself available?
    IF NOT public.is_position_occupied(branch_root_level, branch_root_position) THEN
        RETURN QUERY SELECT
            branch_root_level,
            branch_root_position,
            referrer_position_id,  -- Parent is the original referrer
            1::INTEGER,  -- Relative level 1
            p_target_branch;
        RETURN;
    END IF;

    -- Search within the branch's subtree (breadth-first)
    -- Start at relative depth 1 within the branch (level 2 from original referrer)
    FOR i IN 1..(max_depth - 1) LOOP
        current_level := branch_root_level + i;

        -- Calculate all positions in this branch's subtree at this depth
        positions_count := POWER(3, i)::BIGINT;
        start_pos := (branch_root_position - 1) * positions_count + 1;
        end_pos := start_pos + positions_count - 1;

        -- Build array of positions at this level
        positions_at_level := ARRAY[]::BIGINT[];
        FOR pos IN start_pos..end_pos LOOP
            positions_at_level := array_append(positions_at_level, pos);
        END LOOP;

        -- Check each position to find first available
        FOREACH pos IN ARRAY positions_at_level LOOP
            IF NOT public.is_position_occupied(current_level, pos) THEN
                -- Found available slot - determine parent
                parent_pos := public.get_parent_position(pos);

                RETURN QUERY SELECT
                    current_level,
                    pos,
                    public.format_network_position_id(current_level - 1, parent_pos),
                    i + 1,  -- Relative level from original referrer
                    p_target_branch;
                RETURN;
            END IF;
        END LOOP;
    END LOOP;

    -- No slot found within max_depth in this branch
    -- Return NULL (caller should handle fallback to next branch)
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FALLBACK: find_available_slot (with round-robin)
-- ============================================
-- Updated main function that tries each branch in order
-- starting from the target branch

DROP FUNCTION IF EXISTS public.find_available_slot(TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.find_available_slot(
    referrer_position_id TEXT,
    max_depth INTEGER DEFAULT 100,
    p_start_branch INTEGER DEFAULT 1  -- Which branch to try first
)
RETURNS TABLE(
    available_level INTEGER,
    available_position BIGINT,
    parent_position_id TEXT,
    relative_level INTEGER,
    assigned_branch INTEGER
) AS $$
DECLARE
    branch_result RECORD;
    branch_to_try INTEGER;
    branches_tried INTEGER := 0;
BEGIN
    -- Try branches in rotation starting from p_start_branch
    WHILE branches_tried < 3 LOOP
        -- Calculate which branch to try: 1, 2, or 3
        branch_to_try := ((p_start_branch - 1 + branches_tried) % 3) + 1;

        -- Try to find slot in this branch
        SELECT * INTO branch_result
        FROM public.find_available_slot_in_branch(
            referrer_position_id,
            branch_to_try,
            max_depth
        );

        -- If found, return it
        IF branch_result IS NOT NULL THEN
            RETURN QUERY SELECT
                branch_result.available_level,
                branch_result.available_position,
                branch_result.parent_position_id,
                branch_result.relative_level,
                branch_to_try;
            RETURN;
        END IF;

        branches_tried := branches_tried + 1;
    END LOOP;

    -- No slot found in any branch (network is full up to max_depth)
    RAISE NOTICE 'No available slots in any of the 3 branches for % within depth %', referrer_position_id, max_depth;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.find_available_slot_in_branch(TEXT, INTEGER, INTEGER) IS
    'Finds first available position within a specific branch (1, 2, or 3). Used for round-robin referral distribution. Returns NULL if branch is full.';

COMMENT ON FUNCTION public.find_available_slot(TEXT, INTEGER, INTEGER) IS
    'Finds first available position starting from specified branch. Tries branches in rotation if target branch is full. Supports round-robin distribution.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Test finding slot in specific branch
-- SELECT * FROM public.find_available_slot_in_branch('L000P0000000001', 1, 100);

-- Test with round-robin (starting from branch 2)
-- SELECT * FROM public.find_available_slot('L000P0000000001', 100, 2);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Round-robin find_available_slot functions created successfully!' as message;
