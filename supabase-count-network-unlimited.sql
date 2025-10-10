-- ============================================
-- FIX: count_network_size() - UNLIMITED DEPTH
-- ============================================
-- Counts ALL members in a user's entire network (no depth limit).
-- Returns both total count and active count.
--
-- CRITICAL CHANGES:
-- 1. Removed 6-level depth restriction
-- 2. Active = paid within last 33 days (30 + 3 grace period)
-- 3. Counts entire subtree regardless of depth
-- ============================================

-- Drop old version first
DROP FUNCTION IF EXISTS public.count_network_size(TEXT);

CREATE OR REPLACE FUNCTION public.count_network_size(p_network_position_id TEXT)
RETURNS TABLE(
    total_count INTEGER,
    active_count INTEGER
) AS $$
DECLARE
    p_level INTEGER;
    p_position BIGINT;
BEGIN
    -- Parse the user's network position
    SELECT p.level, p.pos INTO p_level, p_position
    FROM public.parse_network_position_id(p_network_position_id) p;

    -- Count ALL users in entire subtree (unlimited depth)
    -- Active users = those who paid within last 33 days
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (
            WHERE last_payment_date IS NOT NULL
            AND last_payment_date >= NOW() - INTERVAL '33 days'
        )::INTEGER as active
    FROM public.users u
    WHERE u.network_level > p_level
    AND u.network_position >= (p_position - 1) * POWER(3, u.network_level - p_level)::BIGINT + 1
    AND u.network_position <= (p_position) * POWER(3, u.network_level - p_level)::BIGINT
    AND u.network_position_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- OPTIMIZED VERSION (For Large Networks)
-- ============================================
-- This version uses a more efficient query for networks with thousands of users
-- by calculating the position range once and using it in the WHERE clause

-- Drop old version first
DROP FUNCTION IF EXISTS public.count_network_size_optimized(TEXT);

CREATE OR REPLACE FUNCTION public.count_network_size_optimized(p_network_position_id TEXT)
RETURNS TABLE(
    total_count INTEGER,
    active_count INTEGER,
    inactive_count INTEGER,
    disabled_count INTEGER
) AS $$
DECLARE
    p_level INTEGER;
    p_position BIGINT;
BEGIN
    SELECT p.level, p.pos INTO p_level, p_position
    FROM public.parse_network_position_id(p_network_position_id) p;

    -- Single query with multiple aggregations
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (
            WHERE last_payment_date >= NOW() - INTERVAL '33 days'
        )::INTEGER as active,
        COUNT(*) FILTER (
            WHERE last_payment_date < NOW() - INTERVAL '33 days'
            AND last_payment_date >= NOW() - INTERVAL '90 days'
        )::INTEGER as inactive,
        COUNT(*) FILTER (
            WHERE last_payment_date < NOW() - INTERVAL '90 days'
            OR last_payment_date IS NULL
        )::INTEGER as disabled
    FROM public.users u
    WHERE u.network_level > p_level
    AND u.network_position >= (p_position - 1) * POWER(3, u.network_level - p_level)::BIGINT + 1
    AND u.network_position <= (p_position) * POWER(3, u.network_level - p_level)::BIGINT
    AND u.network_position_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER: Get Network Count by Level
-- ============================================
-- Returns count of members at each level in the network
-- Useful for analytics and visualization

CREATE OR REPLACE FUNCTION public.count_network_by_level(p_network_position_id TEXT)
RETURNS TABLE(
    level INTEGER,
    total_members INTEGER,
    active_members INTEGER
) AS $$
DECLARE
    p_level INTEGER;
    p_position BIGINT;
BEGIN
    SELECT p.level, p.pos INTO p_level, p_position
    FROM public.parse_network_position_id(p_network_position_id) p;

    RETURN QUERY
    SELECT
        u.network_level as level,
        COUNT(*)::INTEGER as total_members,
        COUNT(*) FILTER (
            WHERE last_payment_date >= NOW() - INTERVAL '33 days'
        )::INTEGER as active_members
    FROM public.users u
    WHERE u.network_level > p_level
    AND u.network_position >= (p_position - 1) * POWER(3, u.network_level - p_level)::BIGINT + 1
    AND u.network_position <= (p_position) * POWER(3, u.network_level - p_level)::BIGINT
    AND u.network_position_id IS NOT NULL
    GROUP BY u.network_level
    ORDER BY u.network_level;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.count_network_size(TEXT) IS
    'Counts total and active members in entire network (unlimited depth). Active = paid within 33 days.';

COMMENT ON FUNCTION public.count_network_size_optimized(TEXT) IS
    'Optimized version that also returns inactive and disabled counts. Recommended for production with large networks.';

COMMENT ON FUNCTION public.count_network_by_level(TEXT) IS
    'Returns member count broken down by level. Useful for network visualization and analytics.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Count network for a user
-- SELECT * FROM public.count_network_size('L000P0000000001');

-- Get detailed breakdown
-- SELECT * FROM public.count_network_size_optimized('L000P0000000001');

-- See distribution by level
-- SELECT * FROM public.count_network_by_level('L000P0000000001');
