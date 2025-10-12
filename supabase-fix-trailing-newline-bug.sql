-- ============================================
-- FIX: Trailing Newline Bug in Network Position IDs
-- ============================================
-- Problem: Manual position assignments included trailing newlines,
-- causing is_position_occupied() to incorrectly return FALSE.
--
-- This script:
-- 1. Cleans up existing data
-- 2. Updates functions to always trim position IDs
-- 3. Adds validation to prevent future issues
-- ============================================

-- ============================================
-- 1. CLEAN EXISTING DATA
-- ============================================

-- Fix all position IDs with trailing whitespace
UPDATE public.users
SET
    network_position_id = trim(network_position_id),
    tree_parent_network_position_id = trim(tree_parent_network_position_id)
WHERE network_position_id IS NOT NULL
AND (
    network_position_id != trim(network_position_id)
    OR tree_parent_network_position_id != trim(tree_parent_network_position_id)
);

-- Report what was cleaned
DO $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO cleaned_count
    FROM public.users
    WHERE network_position_id IS NOT NULL
    AND length(network_position_id) = 15; -- Correct length

    RAISE NOTICE 'Cleaned network position IDs. % positions now have correct length.', cleaned_count;
END $$;

-- ============================================
-- 2. ADD VALIDATION TO format_network_position_id
-- ============================================

CREATE OR REPLACE FUNCTION public.format_network_position_id(p_level INTEGER, p_position BIGINT)
RETURNS TEXT AS $$
BEGIN
    -- Always return trimmed result (shouldn't have whitespace, but defensive)
    RETURN trim('L' || LPAD(p_level::TEXT, 3, '0') || 'P' || LPAD(p_position::TEXT, 10, '0'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 3. UPDATE assign_network_position TO TRIM
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
    ELSE
        -- Get referrer's position (trim it!)
        IF p_referrer_id IS NULL THEN
            RAISE EXCEPTION 'Referrer is required for non-root users';
        END IF;

        SELECT trim(network_position_id) INTO referrer_pos_id
        FROM public.users
        WHERE id = p_referrer_id;

        IF referrer_pos_id IS NULL OR referrer_pos_id = '' THEN
            RAISE EXCEPTION 'Referrer % does not have a network position', p_referrer_id;
        END IF;

        -- Find available slot in referrer's subtree
        SELECT * INTO slot_info
        FROM public.find_available_slot(referrer_pos_id, 6)
        LIMIT 1;

        IF slot_info IS NULL THEN
            RAISE EXCEPTION 'No available slots in referrer structure (first 6 levels full)';
        END IF;

        new_level := slot_info.available_level;
        new_position := slot_info.available_position;
        parent_pos_id := trim(slot_info.parent_position_id);
        new_position_id := trim(public.format_network_position_id(new_level, new_position));

        -- DEFENSIVE CHECK: Verify position is truly empty
        SELECT public.is_position_occupied(new_level, new_position)
        INTO position_already_occupied;

        IF position_already_occupied THEN
            RAISE EXCEPTION 'BUG: find_available_slot returned occupied position %! (Level %, Position %)',
                new_position_id, new_level, new_position;
        END IF;
    END IF;

    -- ALWAYS TRIM before storing
    new_position_id := trim(new_position_id);
    parent_pos_id := trim(parent_pos_id);

    -- Validate length (should always be 15 characters)
    IF length(new_position_id) != 15 THEN
        RAISE EXCEPTION 'Invalid position ID length: % (expected 15, got %)', new_position_id, length(new_position_id);
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
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Position assigned but count update failed: %', SQLERRM;
    END;

    RETURN new_position_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. UPDATE is_position_occupied TO TRIM
-- ============================================

CREATE OR REPLACE FUNCTION public.is_position_occupied(p_level INTEGER, p_position BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    position_id TEXT;
    user_count INTEGER;
BEGIN
    position_id := trim(public.format_network_position_id(p_level, p_position));

    -- Count users at this position (also trim the stored values in comparison)
    SELECT COUNT(*)
    INTO user_count
    FROM public.users
    WHERE trim(network_position_id) = position_id
    AND network_position_id IS NOT NULL;

    IF user_count > 1 THEN
        RAISE WARNING 'DUPLICATE POSITION: % has % users!', position_id, user_count;
    END IF;

    RETURN user_count > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. VERIFY ALL POSITIONS ARE CLEAN
-- ============================================

-- Check for any remaining bad data
DO $$
DECLARE
    bad_positions INTEGER;
    bad_record RECORD;
BEGIN
    SELECT COUNT(*)
    INTO bad_positions
    FROM public.users
    WHERE network_position_id IS NOT NULL
    AND (
        length(network_position_id) != 15
        OR network_position_id != trim(network_position_id)
    );

    IF bad_positions > 0 THEN
        RAISE WARNING 'Found % positions with incorrect length or whitespace!', bad_positions;

        RAISE NOTICE 'Bad positions:';
        FOR bad_record IN
            SELECT email, network_position_id, length(network_position_id) as len
            FROM public.users
            WHERE network_position_id IS NOT NULL
            AND (
                length(network_position_id) != 15
                OR network_position_id != trim(network_position_id)
            )
        LOOP
            RAISE NOTICE '  %: % (length %)', bad_record.email, bad_record.network_position_id, bad_record.len;
        END LOOP;
    ELSE
        RAISE NOTICE 'All position IDs are clean (length 15, no whitespace).';
    END IF;
END $$;

-- ============================================
-- 6. TEST THE FIX
-- ============================================

-- Test is_position_occupied with jorge's position
SELECT
    email,
    'Position 2 occupied?' as test,
    public.is_position_occupied(1, 2) as result,
    'Should be TRUE' as expected
FROM public.users
WHERE email = 'jorgemasterext@hotmail.com';

-- Test find_available_slot
SELECT
    'Next available slot' as test,
    available_level,
    available_position,
    parent_position_id,
    'Should be L002P0000000003 or similar' as expected
FROM public.find_available_slot('L000P0000000001', 6);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.format_network_position_id(INTEGER, BIGINT) IS
    'Formats network position ID as L###P##########. Always returns trimmed result.';

COMMENT ON FUNCTION public.is_position_occupied(INTEGER, BIGINT) IS
    'Checks if position is occupied. Trims both stored and checked values to handle legacy data.';

COMMENT ON FUNCTION public.assign_network_position(UUID, UUID) IS
    'Assigns network position with validation. Always trims position IDs and validates length = 15.';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Trailing newline bug fixed! All position IDs cleaned and functions updated.' as message;
