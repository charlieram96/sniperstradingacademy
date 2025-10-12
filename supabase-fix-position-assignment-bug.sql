-- ============================================
-- FIX: Position Assignment Duplicate Bug
-- ============================================
-- This fixes the issue where find_available_slot() returns
-- occupied positions, causing duplicate position assignments.
--
-- Changes:
-- 1. Added validation in assign_network_position()
-- 2. Added logging to find_available_slot()
-- 3. Added explicit occupied check before assignment
-- ============================================

-- ============================================
-- 1. IMPROVED find_available_slot WITH LOGGING
-- ============================================

CREATE OR REPLACE FUNCTION public.find_available_slot(
    referrer_position_id TEXT,
    max_depth INTEGER DEFAULT 6
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
    child_positions BIGINT[];
    i INTEGER;
    is_occupied BOOLEAN;
BEGIN
    -- Parse referrer's position
    SELECT p.level, p.pos INTO ref_level, ref_position
    FROM public.parse_network_position_id(referrer_position_id) p;

    RAISE NOTICE 'Finding slot under % (level %, pos %)', referrer_position_id, ref_level, ref_position;

    -- Search level by level (breadth-first)
    FOR i IN 1..max_depth LOOP
        current_level := ref_level + i;

        -- Get all possible positions at this level relative to referrer
        IF i = 1 THEN
            -- Level 1: 3 positions directly under referrer
            positions_at_level := public.calculate_child_positions(ref_position);
            RAISE NOTICE 'Level % (relative depth %): checking positions %', current_level, i, positions_at_level;
        ELSE
            -- For deeper levels, calculate the range of positions in subtree
            positions_at_level := ARRAY[]::BIGINT[];

            DECLARE
                start_pos BIGINT;
                end_pos BIGINT;
                positions_count BIGINT;
            BEGIN
                positions_count := POWER(3, i)::BIGINT;
                start_pos := (ref_position - 1) * positions_count + 1;
                end_pos := start_pos + positions_count - 1;

                -- Build array of all positions at this level
                FOR pos IN start_pos..end_pos LOOP
                    positions_at_level := array_append(positions_at_level, pos);
                END LOOP;

                RAISE NOTICE 'Level % (relative depth %): checking % positions (%-%)' , current_level, i, positions_count, start_pos, end_pos;
            END;
        END IF;

        -- Check each position to find first available
        FOREACH pos IN ARRAY positions_at_level LOOP
            -- Explicitly check if position is occupied
            is_occupied := public.is_position_occupied(current_level, pos);

            RAISE NOTICE '  Checking L%P% ... %',
                LPAD(current_level::TEXT, 3, '0'),
                LPAD(pos::TEXT, 10, '0'),
                CASE WHEN is_occupied THEN 'OCCUPIED' ELSE 'AVAILABLE' END;

            IF NOT is_occupied THEN
                -- Found available slot - determine parent
                parent_pos := public.get_parent_position(pos);

                RAISE NOTICE 'Found available slot: L%P% (parent: L%P%)',
                    LPAD(current_level::TEXT, 3, '0'),
                    LPAD(pos::TEXT, 10, '0'),
                    LPAD((current_level - 1)::TEXT, 3, '0'),
                    LPAD(parent_pos::TEXT, 10, '0');

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
    RAISE WARNING 'No available slot found within % levels of %', max_depth, referrer_position_id;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. IMPROVED assign_network_position WITH VALIDATION
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
    position_already_occupied BOOLEAN;
BEGIN
    -- Check if this is the first user (principal user)
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE network_position_id IS NOT NULL) THEN
        -- This is the root user
        new_position_id := 'L000P0000000001';
        new_level := 0;
        new_position := 1;
        parent_pos_id := NULL;

        RAISE NOTICE 'Assigning ROOT position to user %', p_user_id;
    ELSE
        -- Get referrer's position
        IF p_referrer_id IS NULL THEN
            RAISE EXCEPTION 'Referrer is required for non-root users';
        END IF;

        SELECT network_position_id INTO referrer_pos_id
        FROM public.users
        WHERE id = p_referrer_id;

        IF referrer_pos_id IS NULL THEN
            RAISE EXCEPTION 'Referrer % does not have a network position', p_referrer_id;
        END IF;

        RAISE NOTICE 'Finding position for user % under referrer % (%)', p_user_id, p_referrer_id, referrer_pos_id;

        -- Find available slot in referrer's subtree
        SELECT * INTO slot_info
        FROM public.find_available_slot(referrer_pos_id, 6)
        LIMIT 1;

        IF slot_info IS NULL THEN
            RAISE EXCEPTION 'No available slots in referrer structure (first 6 levels full)';
        END IF;

        new_level := slot_info.available_level;
        new_position := slot_info.available_position;
        parent_pos_id := slot_info.parent_position_id;
        new_position_id := public.format_network_position_id(new_level, new_position);

        -- DEFENSIVE CHECK: Verify position is truly empty
        SELECT public.is_position_occupied(new_level, new_position)
        INTO position_already_occupied;

        IF position_already_occupied THEN
            RAISE EXCEPTION 'BUG DETECTED: find_available_slot returned occupied position %! Level %, Position %',
                new_position_id, new_level, new_position;
        END IF;

        RAISE NOTICE 'Assigning position % to user %', new_position_id, p_user_id;
    END IF;

    -- Update user with network position
    UPDATE public.users
    SET
        network_position_id = new_position_id,
        network_level = new_level,
        network_position = new_position,
        tree_parent_network_position_id = parent_pos_id
    WHERE id = p_user_id;

    -- Increment total network count for all ancestors
    BEGIN
        SELECT public.increment_upchain_total_count(p_user_id) INTO ancestors_updated;
        RAISE NOTICE 'Position % assigned successfully. Updated % ancestors total_network_count.',
            new_position_id, ancestors_updated;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Position assigned but count update failed: %', SQLERRM;
    END;

    RETURN new_position_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. VERIFY NO DUPLICATES
-- ============================================

-- Check for duplicate positions
DO $$
DECLARE
    duplicate_count INTEGER;
    duplicate_record RECORD;
BEGIN
    SELECT COUNT(*)
    INTO duplicate_count
    FROM (
        SELECT network_position_id, COUNT(*) as cnt
        FROM public.users
        WHERE network_position_id IS NOT NULL
        GROUP BY network_position_id
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE WARNING 'Found % duplicate position(s)!', duplicate_count;

        RAISE NOTICE 'Duplicate positions:';
        FOR duplicate_record IN
            SELECT
                network_position_id,
                array_agg(email ORDER BY created_at) as emails,
                COUNT(*) as user_count
            FROM public.users
            WHERE network_position_id IS NOT NULL
            GROUP BY network_position_id
            HAVING COUNT(*) > 1
        LOOP
            RAISE NOTICE '  Position %: % users - %',
                duplicate_record.network_position_id,
                duplicate_record.user_count,
                duplicate_record.emails;
        END LOOP;
    ELSE
        RAISE NOTICE 'No duplicate positions found. All positions are unique.';
    END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.find_available_slot(TEXT, INTEGER) IS
    'Finds first available position in referrer subtree using breadth-first search. Now includes detailed logging for debugging.';

COMMENT ON FUNCTION public.assign_network_position(UUID, UUID) IS
    'Assigns network position with validation. Raises exception if find_available_slot returns occupied position (bug detection).';

-- ============================================
-- VERIFICATION
-- ============================================

-- Test the improved function
-- SELECT * FROM public.find_available_slot('L000P0000000001', 6);

-- Should now show detailed logging:
-- NOTICE: Finding slot under L000P0000000001 (level 0, pos 1)
-- NOTICE: Level 1 (relative depth 1): checking positions {1,2,3}
-- NOTICE:   Checking L001P0000000001 ... OCCUPIED
-- NOTICE:   Checking L001P0000000002 ... OCCUPIED
-- NOTICE:   Checking L001P0000000003 ... OCCUPIED
-- NOTICE: Level 2 (relative depth 2): checking 9 positions (1-9)
-- NOTICE:   Checking L002P0000000001 ... OCCUPIED
-- NOTICE:   Checking L002P0000000002 ... OCCUPIED (if testuser7 is there)
-- NOTICE:   Checking L002P0000000003 ... AVAILABLE
-- NOTICE: Found available slot: L002P0000000003

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Position assignment functions updated with validation and logging!' as message;
