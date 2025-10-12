-- ============================================
-- UPDATED can_withdraw FUNCTION
-- ============================================
-- Now includes Stripe Connect account check
-- User can withdraw if ALL of these are true:
-- 1. Active account (has active Stripe subscription)
-- 2. 3+ direct referrals
-- 3. Stripe Connect account set up
-- ============================================

DROP FUNCTION IF EXISTS public.can_withdraw(UUID);

CREATE OR REPLACE FUNCTION public.can_withdraw(p_user_id UUID)
RETURNS TABLE(
    can_withdraw BOOLEAN,
    reason TEXT,
    required_referrals INTEGER,
    current_referrals INTEGER,
    deficit INTEGER,
    has_active_account BOOLEAN,
    has_enough_referrals BOOLEAN,
    has_connect_account BOOLEAN
) AS $$
DECLARE
    user_is_active BOOLEAN;
    struct_num INTEGER;
    required INTEGER;
    direct_refs INTEGER;
    has_connect BOOLEAN;
BEGIN
    -- Get user data
    SELECT
        u.is_active,
        u.current_structure_number,
        (u.stripe_connect_account_id IS NOT NULL) as has_stripe_connect
    INTO user_is_active, struct_num, has_connect
    FROM public.users u
    WHERE u.id = p_user_id;

    -- Count direct referrals
    SELECT COUNT(*) INTO direct_refs
    FROM public.users
    WHERE referred_by = p_user_id;

    -- Calculate required referrals (3 per structure)
    required := public.calculate_required_referrals(COALESCE(struct_num, 1));

    -- Determine withdrawal eligibility and reason
    DECLARE
        can_withdraw_result BOOLEAN;
        reason_text TEXT;
    BEGIN
        can_withdraw_result := user_is_active AND direct_refs >= required AND has_connect;

        reason_text := CASE
            -- Check all conditions and provide specific reason
            WHEN NOT user_is_active THEN 'Account not active (need active Stripe subscription)'
            WHEN direct_refs < required THEN 'Need ' || (required - direct_refs)::TEXT || ' more direct referrals (currently have ' || direct_refs || '/' || required || ')'
            WHEN NOT has_connect THEN 'Stripe Connect account not set up (required for payouts)'
            ELSE 'Eligible to withdraw'
        END;

        RETURN QUERY SELECT
            can_withdraw_result,
            reason_text,
            required,
            direct_refs,
            GREATEST(0, required - direct_refs),
            user_is_active,
            direct_refs >= required,
            has_connect;
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER: Check if Stripe Connect is Complete
-- ============================================
-- Stripe Connect requires onboarding to be completed
-- This function checks if the account is fully set up

CREATE OR REPLACE FUNCTION public.is_stripe_connect_complete(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    connect_account_id TEXT;
BEGIN
    SELECT stripe_connect_account_id INTO connect_account_id
    FROM public.users
    WHERE id = p_user_id;

    -- For now, just check if account ID exists
    -- In production, you might want to verify with Stripe API
    -- that the account has completed onboarding
    RETURN connect_account_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.can_withdraw(UUID) IS
    'Checks if user can withdraw earnings. Requires: (1) active account, (2) required direct referrals for structure, (3) Stripe Connect account set up.';

COMMENT ON FUNCTION public.is_stripe_connect_complete(UUID) IS
    'Returns TRUE if user has Stripe Connect account set up. Used for payout eligibility.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check your own withdrawal eligibility:
-- SELECT * FROM public.can_withdraw('your-user-id-here');

-- Find users who can withdraw:
-- SELECT
--   u.id,
--   u.email,
--   w.*
-- FROM public.users u
-- CROSS JOIN LATERAL public.can_withdraw(u.id) w
-- WHERE u.network_position_id IS NOT NULL
--   AND w.can_withdraw = TRUE
-- LIMIT 10;

-- Find users blocked from withdrawal and why:
-- SELECT
--   u.id,
--   u.email,
--   w.reason,
--   w.has_active_account,
--   w.has_enough_referrals,
--   w.has_connect_account,
--   w.current_referrals,
--   w.required_referrals
-- FROM public.users u
-- CROSS JOIN LATERAL public.can_withdraw(u.id) w
-- WHERE u.network_position_id IS NOT NULL
--   AND w.can_withdraw = FALSE
-- ORDER BY u.network_level, u.network_position
-- LIMIT 20;

-- Count users by withdrawal status:
-- SELECT
--   COUNT(*) FILTER (WHERE w.can_withdraw = TRUE) as can_withdraw,
--   COUNT(*) FILTER (WHERE NOT w.has_active_account) as not_active,
--   COUNT(*) FILTER (WHERE NOT w.has_enough_referrals) as not_enough_referrals,
--   COUNT(*) FILTER (WHERE NOT w.has_connect_account) as no_connect_account,
--   COUNT(*) as total
-- FROM public.users u
-- CROSS JOIN LATERAL public.can_withdraw(u.id) w
-- WHERE u.network_position_id IS NOT NULL;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'can_withdraw function updated! Now includes Stripe Connect account check.' as message;
