-- ============================================
-- NETWORK POSITION SYSTEM FOR GLOBAL TERNARY TREE MLM
-- ============================================
-- This schema implements a global ternary tree structure where:
-- - Each user has exactly 3 child slots
-- - Positions are calculated using: (parent_position - 1) × 3 + {1, 2, 3}
-- - Network Position IDs follow format: L{level:3}P{position:10}
-- - Placement uses breadth-first search within referrer's subtree

-- NOTE: If you already have direct_referral_slots column or member_slots table,
-- run supabase-network-position-cleanup.sql AFTER this migration.

-- ============================================
-- PART 1: SCHEMA UPDATES
-- ============================================

-- Add network position columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS network_position_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS network_level INTEGER,
ADD COLUMN IF NOT EXISTS network_position BIGINT,
ADD COLUMN IF NOT EXISTS tree_parent_network_position_id TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS inactive_since TIMESTAMP WITH TIME ZONE;

-- Create vacant positions table
CREATE TABLE IF NOT EXISTS public.vacant_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_position_id TEXT NOT NULL UNIQUE,
    network_level INTEGER NOT NULL,
    network_position BIGINT NOT NULL,
    vacated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    previous_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- PART 2: UTILITY FUNCTIONS
-- ============================================

-- Function to parse network position ID into (level, position)
CREATE OR REPLACE FUNCTION public.parse_network_position_id(position_id TEXT)
RETURNS TABLE(level INTEGER, pos BIGINT) AS $$
BEGIN
    RETURN QUERY SELECT
        SUBSTRING(position_id FROM 2 FOR 3)::INTEGER as level,
        SUBSTRING(position_id FROM 6)::BIGINT as pos;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to format network position ID
CREATE OR REPLACE FUNCTION public.format_network_position_id(p_level INTEGER, p_position BIGINT)
RETURNS TEXT AS $$
BEGIN
    RETURN 'L' || LPAD(p_level::TEXT, 3, '0') || 'P' || LPAD(p_position::TEXT, 10, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate child positions for a given parent position
CREATE OR REPLACE FUNCTION public.calculate_child_positions(parent_position BIGINT)
RETURNS BIGINT[] AS $$
BEGIN
    RETURN ARRAY[
        (parent_position - 1) * 3 + 1,
        (parent_position - 1) * 3 + 2,
        (parent_position - 1) * 3 + 3
    ];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get parent position from child position
CREATE OR REPLACE FUNCTION public.get_parent_position(child_position BIGINT)
RETURNS BIGINT AS $$
BEGIN
    RETURN ((child_position - 1) / 3) + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if a position is occupied
CREATE OR REPLACE FUNCTION public.is_position_occupied(p_level INTEGER, p_position BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    position_id TEXT;
    exists_flag BOOLEAN;
BEGIN
    position_id := public.format_network_position_id(p_level, p_position);

    SELECT EXISTS(
        SELECT 1 FROM public.users
        WHERE network_position_id = position_id
    ) INTO exists_flag;

    RETURN exists_flag;
END;
$$ LANGUAGE plpgsql;

-- Function to find available slot using breadth-first search
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
BEGIN
    -- Parse referrer's position
    SELECT p.level, p.pos INTO ref_level, ref_position
    FROM public.parse_network_position_id(referrer_position_id) p;

    -- Search level by level (breadth-first)
    FOR i IN 1..max_depth LOOP
        current_level := ref_level + i;

        -- Get all possible positions at this level relative to referrer
        -- This is a simplified approach - we check all positions in the referrer's subtree
        IF i = 1 THEN
            -- Level 1: 3 positions directly under referrer
            positions_at_level := public.calculate_child_positions(ref_position);
        ELSE
            -- For deeper levels, we need to check all positions in the subtree
            -- We'll use a different approach: check each parent position from previous level
            positions_at_level := ARRAY[]::BIGINT[];

            -- Calculate the range of positions at this level
            -- For a ternary tree, positions at level L below position P span:
            -- Start: (P-1) * 3^L + 1
            -- End: (P-1) * 3^L + 3^L
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
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to get all positions in upline chain (for commission distribution)
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

    -- Walk up the tree until we reach the root
    LOOP
        -- Get current position details
        SELECT p.level, p.pos INTO current_level, current_position
        FROM public.parse_network_position_id(current_pos_id) p;

        -- Return current user if exists
        RETURN QUERY
        SELECT
            u.network_position_id,
            u.network_level,
            u.network_position,
            u.id
        FROM public.users u
        WHERE u.network_position_id = current_pos_id;

        -- Stop at root (level 0)
        IF current_level = 0 THEN
            EXIT;
        END IF;

        -- Move to parent
        current_position := public.get_parent_position(current_position);
        current_level := current_level - 1;
        current_pos_id := public.format_network_position_id(current_level, current_position);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to count direct referrals
CREATE OR REPLACE FUNCTION public.count_direct_referrals(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    referral_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO referral_count
    FROM public.users
    WHERE referred_by = p_user_id
    AND is_active = TRUE;

    RETURN COALESCE(referral_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to count total network size
CREATE OR REPLACE FUNCTION public.count_network_size(p_network_position_id TEXT)
RETURNS TABLE(
    total_count INTEGER,
    active_count INTEGER,
    structure_count INTEGER
) AS $$
DECLARE
    p_level INTEGER;
    p_position BIGINT;
    total INTEGER;
    active INTEGER;
    structures INTEGER;
BEGIN
    -- Parse position
    SELECT p.level, p.pos INTO p_level, p_position
    FROM public.parse_network_position_id(p_network_position_id) p;

    -- Count all users in subtree (this is a simplified version)
    -- In production, you'd want to optimize this with better indexing
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE is_active = TRUE)
    INTO total, active
    FROM public.users
    WHERE network_level > p_level
    AND network_position >= (p_position - 1) * POWER(3, network_level - p_level)::BIGINT + 1
    AND network_position <= (p_position - 1) * POWER(3, network_level - p_level)::BIGINT + POWER(3, network_level - p_level)::BIGINT;

    -- Calculate completed structures (1092 per structure)
    structures := COALESCE(total, 0) / 1092;

    RETURN QUERY SELECT
        COALESCE(total, 0),
        COALESCE(active, 0),
        structures;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 3: USER PLACEMENT FUNCTION
-- ============================================

-- Function to assign network position to new user
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
    END IF;

    -- Update user with network position
    UPDATE public.users
    SET
        network_position_id = new_position_id,
        network_level = new_level,
        network_position = new_position,
        tree_parent_network_position_id = parent_pos_id
    WHERE id = p_user_id;

    RETURN new_position_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 4: INACTIVE USER CLEANUP
-- ============================================

-- Function to check and remove inactive users (90+ days)
CREATE OR REPLACE FUNCTION public.cleanup_inactive_users()
RETURNS TABLE(removed_count INTEGER, positions_vacated TEXT[]) AS $$
DECLARE
    inactive_user RECORD;
    removed INTEGER := 0;
    vacated_positions TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Find users who have been inactive for more than 90 days
    FOR inactive_user IN
        SELECT id, network_position_id, network_level, network_position
        FROM public.users
        WHERE inactive_since IS NOT NULL
        AND inactive_since < (NOW() - INTERVAL '90 days')
        AND network_position_id IS NOT NULL
    LOOP
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
            tree_parent_network_position_id = NULL
        WHERE id = inactive_user.id;

        removed := removed + 1;
        vacated_positions := array_append(vacated_positions, inactive_user.network_position_id);
    END LOOP;

    RETURN QUERY SELECT removed, vacated_positions;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 5: INDEXES FOR PERFORMANCE
-- ============================================

-- Indexes on users table
CREATE INDEX IF NOT EXISTS idx_users_network_position_id ON public.users(network_position_id);
CREATE INDEX IF NOT EXISTS idx_users_network_level ON public.users(network_level);
CREATE INDEX IF NOT EXISTS idx_users_network_position ON public.users(network_position);
CREATE INDEX IF NOT EXISTS idx_users_tree_parent ON public.users(tree_parent_network_position_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_level_position ON public.users(network_level, network_position);

-- Indexes on vacant_positions table
CREATE INDEX IF NOT EXISTS idx_vacant_positions_level ON public.vacant_positions(network_level);
CREATE INDEX IF NOT EXISTS idx_vacant_positions_position ON public.vacant_positions(network_position);

-- ============================================
-- PART 6: ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on vacant_positions
ALTER TABLE public.vacant_positions ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view vacant positions (for debugging/admin)
CREATE POLICY "Users can view vacant positions" ON public.vacant_positions
    FOR SELECT USING (true);

-- ============================================
-- PART 7: COMMISSION CALCULATION FUNCTIONS
-- ============================================

-- Function to calculate monthly earnings for a user based on their network
CREATE OR REPLACE FUNCTION public.calculate_user_monthly_earnings(p_user_id UUID)
RETURNS TABLE(
    total_network_size INTEGER,
    active_network_size INTEGER,
    direct_referrals INTEGER,
    completed_structures INTEGER,
    total_contribution DECIMAL(10,2),
    commission_rate DECIMAL(5,2),
    gross_earnings DECIMAL(10,2),
    can_withdraw BOOLEAN,
    required_referrals INTEGER
) AS $$
DECLARE
    user_position_id TEXT;
    network_stats RECORD;
    direct_ref_count INTEGER;
    structures INTEGER;
    rate DECIMAL(5,2);
    contribution DECIMAL(10,2);
    earnings DECIMAL(10,2);
    can_wd BOOLEAN;
    required_refs INTEGER;
BEGIN
    -- Get user's network position
    SELECT network_position_id INTO user_position_id
    FROM public.users
    WHERE id = p_user_id;

    IF user_position_id IS NULL THEN
        RAISE EXCEPTION 'User has no network position';
    END IF;

    -- Get network size stats
    SELECT * INTO network_stats
    FROM public.count_network_size(user_position_id)
    LIMIT 1;

    -- Get direct referrals count
    SELECT count_direct_referrals INTO direct_ref_count
    FROM public.count_direct_referrals(p_user_id);

    -- Calculate structures (1092 per structure)
    structures := COALESCE(network_stats.total_count, 0) / 1092;

    -- Calculate commission rate (10% base + 1% per additional structure, max 16%)
    rate := LEAST(0.10 + (structures * 0.01), 0.16);

    -- Calculate total contribution from active members
    contribution := COALESCE(network_stats.active_count, 0) * 199.00;

    -- Calculate gross earnings
    earnings := contribution * rate;

    -- Check if can withdraw (need 3 direct referrals per completed structure)
    required_refs := (structures + 1) * 3;
    can_wd := direct_ref_count >= required_refs;

    RETURN QUERY SELECT
        COALESCE(network_stats.total_count, 0),
        COALESCE(network_stats.active_count, 0),
        direct_ref_count,
        structures,
        contribution,
        rate,
        earnings,
        can_wd,
        required_refs;
END;
$$ LANGUAGE plpgsql;

-- Function to distribute monthly commissions to upline
-- This function is called when a user pays their monthly subscription
CREATE OR REPLACE FUNCTION public.distribute_to_upline(
    p_user_id UUID,
    p_amount DECIMAL(10,2) DEFAULT 199.00
)
RETURNS TABLE(
    beneficiary_id UUID,
    beneficiary_position_id TEXT,
    contribution_amount DECIMAL(10,2)
) AS $$
DECLARE
    user_position_id TEXT;
    upline_member RECORD;
BEGIN
    -- Get user's network position
    SELECT network_position_id INTO user_position_id
    FROM public.users
    WHERE id = p_user_id;

    IF user_position_id IS NULL THEN
        RETURN;
    END IF;

    -- For each member in upline chain, record contribution
    FOR upline_member IN
        SELECT * FROM public.get_upline_chain(user_position_id)
    LOOP
        -- Skip the user themselves (first in chain)
        IF upline_member.user_id != p_user_id THEN
            RETURN QUERY SELECT
                upline_member.user_id,
                upline_member.network_position_id,
                p_amount;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get all users who contribute to a given user's earnings
CREATE OR REPLACE FUNCTION public.get_downline_contributors(p_user_id UUID)
RETURNS TABLE(
    contributor_id UUID,
    contributor_name TEXT,
    contributor_position_id TEXT,
    is_active BOOLEAN,
    contribution_amount DECIMAL(10,2)
) AS $$
DECLARE
    user_position_id TEXT;
    user_level INTEGER;
    user_position BIGINT;
    max_depth INTEGER;
BEGIN
    -- Get user's network position
    SELECT network_position_id, network_level, network_position
    INTO user_position_id, user_level, user_position
    FROM public.users
    WHERE id = p_user_id;

    IF user_position_id IS NULL THEN
        RETURN;
    END IF;

    -- For now, we'll query all users in the subtree
    -- This is a simplified version - in production you'd optimize this
    max_depth := user_level + 6; -- Up to 6 levels deep

    RETURN QUERY
    SELECT
        u.id,
        u.name,
        u.network_position_id,
        u.is_active,
        CASE WHEN u.is_active THEN 199.00 ELSE 0.00 END as contribution
    FROM public.users u
    WHERE u.network_level > user_level
    AND u.network_level <= max_depth
    AND u.network_position >= (user_position - 1) * POWER(3, u.network_level - user_level)::BIGINT + 1
    AND u.network_position <= (user_position - 1) * POWER(3, u.network_level - user_level)::BIGINT + POWER(3, u.network_level - user_level)::BIGINT
    AND u.network_position_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION QUERIES (comment these out for production)
-- ============================================

-- Test the position calculation
-- SELECT public.format_network_position_id(5, 190);
-- SELECT * FROM public.parse_network_position_id('L005P0000000190');
-- SELECT public.calculate_child_positions(190);

-- Test finding available slots
-- SELECT * FROM public.find_available_slot('L000P0000000001', 6);

-- Test upline chain
-- SELECT * FROM public.get_upline_chain('L003P0000000015');

-- Test earnings calculation
-- SELECT * FROM public.calculate_user_monthly_earnings('user-uuid-here');

-- Test downline contributors
-- SELECT * FROM public.get_downline_contributors('user-uuid-here');
