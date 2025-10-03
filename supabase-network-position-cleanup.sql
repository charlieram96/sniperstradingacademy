-- ============================================
-- CLEANUP MIGRATION: Remove Redundant Old MLM Schema
-- ============================================
-- Run this AFTER running supabase-network-position-schema.sql
-- This removes the old member_slots table and direct_referral_slots column
-- that are now redundant with the network position system

-- ============================================
-- PART 1: Drop Redundant Columns and Tables
-- ============================================

-- Drop redundant column from users table
ALTER TABLE public.users DROP COLUMN IF EXISTS direct_referral_slots;

-- Drop member_slots table (replaced by calculated tree positions)
DROP TABLE IF EXISTS public.member_slots CASCADE;

-- ============================================
-- PART 2: Add Helper Functions for Tree Children
-- ============================================

-- Function to get tree children position IDs
CREATE OR REPLACE FUNCTION public.get_tree_children_positions(p_user_id UUID)
RETURNS TABLE(
    child_position_id TEXT,
    child_number INTEGER,
    is_filled BOOLEAN,
    occupant_user_id UUID,
    occupant_name TEXT
) AS $$
DECLARE
    user_position_id TEXT;
    user_level INTEGER;
    user_position BIGINT;
    child_positions BIGINT[];
    child_level INTEGER;
    i INTEGER;
    child_pos_id TEXT;
BEGIN
    -- Get user's network position
    SELECT network_position_id, network_level, network_position
    INTO user_position_id, user_level, user_position
    FROM public.users
    WHERE id = p_user_id;

    IF user_position_id IS NULL THEN
        RETURN;
    END IF;

    -- Calculate the 3 child positions
    child_positions := public.calculate_child_positions(user_position);
    child_level := user_level + 1;

    -- Check each of the 3 positions
    FOR i IN 1..3 LOOP
        child_pos_id := public.format_network_position_id(child_level, child_positions[i]);

        RETURN QUERY
        SELECT
            child_pos_id,
            i,
            EXISTS(SELECT 1 FROM public.users WHERE network_position_id = child_pos_id),
            u.id,
            u.name
        FROM public.users u
        WHERE u.network_position_id = child_pos_id
        UNION ALL
        SELECT
            child_pos_id,
            i,
            FALSE,
            NULL::UUID,
            NULL::TEXT
        WHERE NOT EXISTS(SELECT 1 FROM public.users WHERE network_position_id = child_pos_id)
        LIMIT 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to check if tree is full (all 3 children positions occupied)
CREATE OR REPLACE FUNCTION public.tree_is_full(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    filled_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO filled_count
    FROM public.get_tree_children_positions(p_user_id)
    WHERE is_filled = TRUE;

    RETURN COALESCE(filled_count, 0) >= 3;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify columns are dropped
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'direct_referral_slots'
    ) THEN
        RAISE NOTICE 'WARNING: direct_referral_slots column still exists!';
    ELSE
        RAISE NOTICE 'SUCCESS: direct_referral_slots column has been dropped';
    END IF;
END $$;

-- Verify table is dropped
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'member_slots'
    ) THEN
        RAISE NOTICE 'WARNING: member_slots table still exists!';
    ELSE
        RAISE NOTICE 'SUCCESS: member_slots table has been dropped';
    END IF;
END $$;

-- Test the new functions (replace user-uuid-here with an actual user ID)
-- SELECT * FROM public.get_tree_children_positions('user-uuid-here');
-- SELECT public.tree_is_full('user-uuid-here');
