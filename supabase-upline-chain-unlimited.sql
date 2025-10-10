-- ============================================
-- FIX: get_upline_chain() - REMOVE 6-LEVEL LIMIT
-- ============================================
-- This function walks up the tree from a starting position
-- to the root (level 0), returning ALL ancestors.
--
-- CRITICAL FIX: Removed the 6-level limit. Now goes all the
-- way to root so that ALL ancestors benefit from payments.
-- ============================================

-- Drop old version first (may have different implementation)
DROP FUNCTION IF EXISTS public.get_upline_chain(TEXT);

CREATE OR REPLACE FUNCTION public.get_upline_chain(start_position_id TEXT)
RETURNS TABLE(
    network_position_id TEXT,
    network_level INTEGER,
    network_position BIGINT,
    user_id UUID
) AS $$
DECLARE
    current_pos_id TEXT;
    current_level INTEGER;
    current_position BIGINT;
BEGIN
    current_pos_id := start_position_id;

    -- Walk up the tree to root (NO LEVEL LIMIT)
    LOOP
        -- Get current position details
        SELECT p.level, p.pos INTO current_level, current_position
        FROM public.parse_network_position_id(current_pos_id) p;

        -- Return user if exists at this position
        RETURN QUERY
        SELECT
            u.network_position_id,
            u.network_level,
            u.network_position,
            u.id
        FROM public.users u
        WHERE u.network_position_id = current_pos_id;

        -- ONLY stop at root (level 0) - NO 6-LEVEL LIMIT
        IF current_level = 0 THEN
            EXIT;
        END IF;

        -- Move to parent position
        current_position := public.get_parent_position(current_position);
        current_level := current_level - 1;
        current_pos_id := public.format_network_position_id(current_level, current_position);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Test with a deep user (e.g., level 10) to verify it goes to root
-- SELECT * FROM public.get_upline_chain('L010P0000059050');
-- Should return all ancestors from level 10 down to level 0

COMMENT ON FUNCTION public.get_upline_chain(TEXT) IS
    'Returns ALL ancestors from starting position to root (level 0). No depth limit. Used for distributing sniper volume on payments.';
