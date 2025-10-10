-- ============================================
-- FIX: distribute_to_upline() - REAL-TIME SNIPER VOLUME UPDATE
-- ============================================
-- This function is called when a user pays their $199 monthly subscription.
-- It increments the sniper_volume_current_month for ALL ancestors.
--
-- CRITICAL CHANGES:
-- 1. Changed from RETURNS TABLE to RETURNS INTEGER (count of distributions)
-- 2. Now UPDATEs sniper_volume_current_month instead of just returning data
-- 3. Uses fixed get_upline_chain() that goes to root (no 6-level limit)
-- 4. Excludes the paying user from receiving their own payment
-- ============================================

-- Drop old version first (may have different return type)
DROP FUNCTION IF EXISTS public.distribute_to_upline(UUID, DECIMAL);

CREATE OR REPLACE FUNCTION public.distribute_to_upline(
    p_user_id UUID,
    p_amount DECIMAL(10,2) DEFAULT 199.00
)
RETURNS INTEGER AS $$
DECLARE
    user_position_id TEXT;
    upline_member RECORD;
    distribution_count INTEGER := 0;
BEGIN
    -- Get the paying user's network position
    SELECT network_position_id INTO user_position_id
    FROM public.users
    WHERE id = p_user_id;

    -- If user has no network position, nothing to distribute
    IF user_position_id IS NULL THEN
        RETURN 0;
    END IF;

    -- For each ancestor (excluding the paying user themselves)
    FOR upline_member IN
        SELECT user_id
        FROM public.get_upline_chain(user_position_id)
        WHERE user_id != p_user_id
    LOOP
        -- Increment their sniper volume for current month
        UPDATE public.users
        SET sniper_volume_current_month = sniper_volume_current_month + p_amount
        WHERE id = upline_member.user_id;

        distribution_count := distribution_count + 1;
    END LOOP;

    RETURN distribution_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ALTERNATIVE: Batch Update Version (More Efficient)
-- ============================================
-- This version uses a single UPDATE with subquery for better performance
-- Use this if you have thousands of users and need optimal performance

-- Drop old version if exists
DROP FUNCTION IF EXISTS public.distribute_to_upline_batch(UUID, DECIMAL);

CREATE OR REPLACE FUNCTION public.distribute_to_upline_batch(
    p_user_id UUID,
    p_amount DECIMAL(10,2) DEFAULT 199.00
)
RETURNS INTEGER AS $$
DECLARE
    user_position_id TEXT;
    distribution_count INTEGER;
BEGIN
    -- Get the paying user's network position
    SELECT network_position_id INTO user_position_id
    FROM public.users
    WHERE id = p_user_id;

    IF user_position_id IS NULL THEN
        RETURN 0;
    END IF;

    -- Single UPDATE statement that increments all ancestors at once
    WITH ancestors AS (
        SELECT user_id
        FROM public.get_upline_chain(user_position_id)
        WHERE user_id != p_user_id
    )
    UPDATE public.users
    SET sniper_volume_current_month = sniper_volume_current_month + p_amount
    WHERE id IN (SELECT user_id FROM ancestors);

    -- Get count of affected rows
    GET DIAGNOSTICS distribution_count = ROW_COUNT;

    RETURN distribution_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.distribute_to_upline(UUID, DECIMAL) IS
    'Increments sniper_volume_current_month for ALL ancestors when user pays $199. Returns count of ancestors who received the distribution. Called by Stripe webhook on invoice.payment_succeeded.';

COMMENT ON FUNCTION public.distribute_to_upline_batch(UUID, DECIMAL) IS
    'Batch version of distribute_to_upline. Uses single UPDATE for better performance with large networks. Recommended for production use.';

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Test distributing $199 from a user
-- SELECT public.distribute_to_upline('user-uuid-here', 199.00);
-- Should return count of ancestors (e.g., if user is at level 5, returns 5)

-- Check sniper volumes increased
-- SELECT id, name, sniper_volume_current_month
-- FROM users
-- WHERE sniper_volume_current_month > 0
-- ORDER BY network_level;
