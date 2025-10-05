-- ============================================
-- TREE CHILDREN FUNCTION
-- ============================================
-- This function returns the 3 direct tree positions
-- below a user (their tree children), not to be confused
-- with their direct referrals.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_tree_children(p_user_id UUID)
RETURNS TABLE(
    child_id UUID,
    child_name TEXT,
    child_email TEXT,
    child_position_id TEXT,
    child_slot_number INTEGER,
    is_filled BOOLEAN,
    is_direct_referral BOOLEAN
) AS $$
DECLARE
    user_position_id TEXT;
    user_level INTEGER;
    user_position BIGINT;
    child_positions BIGINT[];
    child_pos BIGINT;
    slot_num INTEGER := 1;
    child_pos_id TEXT;
    child_user RECORD;
BEGIN
    -- Get user's position
    SELECT network_position_id, network_level, network_position
    INTO user_position_id, user_level, user_position
    FROM public.users
    WHERE id = p_user_id;

    IF user_position_id IS NULL THEN
        RETURN;
    END IF;

    -- Calculate the 3 child positions
    child_positions := public.calculate_child_positions(user_position);

    -- For each of the 3 child positions
    FOREACH child_pos IN ARRAY child_positions LOOP
        child_pos_id := public.format_network_position_id(user_level + 1, child_pos);

        -- Check if position is filled
        SELECT
            u.id,
            u.name,
            u.email,
            u.network_position_id,
            (u.referred_by = p_user_id) as is_direct_ref
        INTO child_user
        FROM public.users u
        WHERE u.network_position_id = child_pos_id;

        IF FOUND THEN
            -- Position is filled
            RETURN QUERY SELECT
                child_user.id,
                child_user.name,
                child_user.email,
                child_pos_id,
                slot_num,
                TRUE,
                child_user.is_direct_ref;
        ELSE
            -- Position is empty
            RETURN QUERY SELECT
                NULL::UUID,
                'Empty Slot'::TEXT,
                NULL::TEXT,
                child_pos_id,
                slot_num,
                FALSE,
                FALSE;
        END IF;

        slot_num := slot_num + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTION: Check if tree is full
-- ============================================
CREATE OR REPLACE FUNCTION public.is_tree_full(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    filled_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO filled_count
    FROM public.get_tree_children(p_user_id)
    WHERE is_filled = TRUE;

    RETURN filled_count = 3;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Test getting tree children for a user
-- SELECT * FROM public.get_tree_children('user-id-here');

-- Check if user's tree is full
-- SELECT public.is_tree_full('user-id-here');
