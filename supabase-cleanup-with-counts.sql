-- ============================================
-- UPDATED cleanup_inactive_users FUNCTION
-- ============================================
-- This version decrements network counts before vacating positions
-- Run this AFTER running supabase-incremental-network-counts.sql
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_inactive_users()
RETURNS TABLE(removed_count INTEGER, positions_vacated TEXT[]) AS $$
DECLARE
    inactive_user RECORD;
    removed INTEGER := 0;
    vacated_positions TEXT[] := ARRAY[]::TEXT[];
    was_active BOOLEAN;
    total_decremented INTEGER;
    active_decremented INTEGER;
BEGIN
    -- Find users who have been inactive for more than 90 days
    FOR inactive_user IN
        SELECT id, network_position_id, network_level, network_position, is_active
        FROM public.users
        WHERE inactive_since IS NOT NULL
        AND inactive_since < (NOW() - INTERVAL '90 days')
        AND network_position_id IS NOT NULL
    LOOP
        -- Store whether user was active
        was_active := inactive_user.is_active;

        -- 🆕 DECREMENT NETWORK COUNTS BEFORE VACATING POSITION
        BEGIN
            -- Always decrement total count (user leaving the tree)
            SELECT public.decrement_upchain_total_count(inactive_user.id)
            INTO total_decremented;

            RAISE NOTICE 'User % removed - decremented total_network_count for % ancestors',
                inactive_user.id, total_decremented;

            -- If user was still active, also decrement active count
            IF was_active THEN
                SELECT public.decrement_upchain_active_count(inactive_user.id)
                INTO active_decremented;

                RAISE NOTICE 'User was active - also decremented active_network_count for % ancestors',
                    active_decremented;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue with cleanup
            RAISE WARNING 'Failed to decrement counts for user %: %',
                inactive_user.id, SQLERRM;
        END;

        -- Add position to vacant_positions table
        INSERT INTO public.vacant_positions (
            network_position_id,
            network_level,
            network_position,
            previous_user_id
        ) VALUES (
            inactive_user.network_position_id,
            inactive_user.network_level,
            inactive_user.network_position,
            inactive_user.id
        );

        -- Remove network position from user (they lose their spot)
        UPDATE public.users
        SET
            network_position_id = NULL,
            network_level = NULL,
            network_position = NULL,
            tree_parent_network_position_id = NULL,
            is_active = FALSE
        WHERE id = inactive_user.id;

        removed := removed + 1;
        vacated_positions := array_append(vacated_positions, inactive_user.network_position_id);
    END LOOP;

    RETURN QUERY SELECT removed, vacated_positions;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENT
-- ============================================

COMMENT ON FUNCTION public.cleanup_inactive_users() IS
    'Removes users inactive 90+ days. Decrements both total_network_count and active_network_count (if applicable) for all ancestors before vacating position.';

-- ============================================
-- VERIFICATION
-- ============================================
-- Test cleanup (this should be run via cron job monthly):
-- SELECT * FROM public.cleanup_inactive_users();
-- Should return count of removed users and their position IDs

-- Verify counts decreased:
-- SELECT id, email, total_network_count, active_network_count
-- FROM public.users
-- WHERE network_position_id IS NOT NULL
-- ORDER BY network_level, network_position
-- LIMIT 10;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'cleanup_inactive_users updated with automatic count decrementing!' as message;
