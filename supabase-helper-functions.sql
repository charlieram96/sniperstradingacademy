-- ============================================
-- HELPER FUNCTIONS FOR SNIPER VOLUME SYSTEM
-- ============================================
-- Utility functions for calculating commission rates,
-- checking user status, and updating network counts.
-- ============================================

-- ============================================
-- 1. Calculate Commission Rate
-- ============================================
-- Returns commission rate (0.10 to 0.16) based on active network count
-- Structure completion thresholds:
-- - Structure 1: 0-1,091 members = 10%
-- - Structure 2: 1,092-2,183 members = 11%
-- - Structure 3: 2,184-3,275 members = 12%
-- - Structure 4: 3,276-4,367 members = 13%
-- - Structure 5: 4,368-5,459 members = 14%
-- - Structure 6: 5,460-6,551 members = 15%
-- - Structure 7+: 6,552+ members = 16% (max)

CREATE OR REPLACE FUNCTION public.calculate_commission_rate(active_count INTEGER)
RETURNS DECIMAL(5,4) AS $$
BEGIN
    IF active_count >= 6552 THEN RETURN 0.16;
    ELSIF active_count >= 5460 THEN RETURN 0.15;
    ELSIF active_count >= 4368 THEN RETURN 0.14;
    ELSIF active_count >= 3276 THEN RETURN 0.13;
    ELSIF active_count >= 2184 THEN RETURN 0.12;
    ELSIF active_count >= 1092 THEN RETURN 0.11;
    ELSE RETURN 0.10;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 2. Calculate Structure Number
-- ============================================
-- Returns which structure the user is currently in (1-7+)

CREATE OR REPLACE FUNCTION public.calculate_structure_number(active_count INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN LEAST(FLOOR(active_count / 1092.0)::INTEGER + 1, 7);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 3. Check if User is Active
-- ============================================
-- Active = paid within last 33 days (30 + 3 day grace period)

CREATE OR REPLACE FUNCTION public.is_user_active(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    last_pay_date TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT last_payment_date INTO last_pay_date
    FROM public.users
    WHERE id = p_user_id;

    IF last_pay_date IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN last_pay_date >= (NOW() - INTERVAL '33 days');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Check if User is Disabled
-- ============================================
-- Disabled = haven't paid in 90+ days
-- Disabled users keep their position but:
-- - Still receive sniper volume
-- - Cannot withdraw/receive payouts
-- - Don't count toward ancestors' structure completion

CREATE OR REPLACE FUNCTION public.is_user_disabled(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    last_pay_date TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT last_payment_date INTO last_pay_date
    FROM public.users
    WHERE id = p_user_id;

    IF last_pay_date IS NULL THEN
        RETURN TRUE; -- Never paid = disabled
    END IF;

    RETURN last_pay_date < (NOW() - INTERVAL '90 days');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Update User's Network Counts
-- ============================================
-- Updates denormalized network count columns for a user
-- Should be called after a payment in their network

CREATE OR REPLACE FUNCTION public.update_network_counts(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    user_pos_id TEXT;
    counts RECORD;
    comm_rate DECIMAL(5,4);
    struct_num INTEGER;
BEGIN
    -- Get user's network position
    SELECT network_position_id INTO user_pos_id
    FROM public.users
    WHERE id = p_user_id;

    IF user_pos_id IS NULL THEN
        RETURN;
    END IF;

    -- Get network counts
    SELECT * INTO counts
    FROM public.count_network_size(user_pos_id);

    -- Calculate commission rate and structure number
    comm_rate := public.calculate_commission_rate(counts.active_count);
    struct_num := public.calculate_structure_number(counts.active_count);

    -- Update user record with denormalized data
    UPDATE public.users
    SET
        total_network_count = counts.total_count,
        active_network_count = counts.active_count,
        current_commission_rate = comm_rate,
        current_structure_number = struct_num
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Update Active Status for User
-- ============================================
-- Updates is_active flag based on last_payment_date

CREATE OR REPLACE FUNCTION public.update_active_status(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users
    SET is_active = (
        last_payment_date IS NOT NULL
        AND last_payment_date >= NOW() - INTERVAL '33 days'
    )
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Batch Update All Users' Active Status
-- ============================================
-- Run this daily via cron to update active status for all users

CREATE OR REPLACE FUNCTION public.update_all_active_statuses()
RETURNS INTEGER AS $$
DECLARE
    update_count INTEGER;
BEGIN
    UPDATE public.users
    SET is_active = (
        last_payment_date IS NOT NULL
        AND last_payment_date >= NOW() - INTERVAL '33 days'
    );

    GET DIAGNOSTICS update_count = ROW_COUNT;
    RETURN update_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Calculate Required Direct Referrals
-- ============================================
-- Returns how many direct referrals needed to withdraw from a structure
-- Structure 1 = 3, Structure 2 = 6, Structure 3 = 9, etc.

CREATE OR REPLACE FUNCTION public.calculate_required_referrals(structure_number INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN structure_number * 3;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 9. Check Withdrawal Eligibility
-- ============================================
-- Returns whether user can withdraw based on:
-- - Active status (paid within 33 days)
-- - Direct referral count meets requirement

CREATE OR REPLACE FUNCTION public.can_withdraw(p_user_id UUID)
RETURNS TABLE(
    can_withdraw BOOLEAN,
    reason TEXT,
    required_referrals INTEGER,
    current_referrals INTEGER,
    deficit INTEGER
) AS $$
DECLARE
    is_active BOOLEAN;
    struct_num INTEGER;
    required INTEGER;
    direct_refs INTEGER;
BEGIN
    -- Get user data
    SELECT
        public.is_user_active(p_user_id),
        current_structure_number
    INTO is_active, struct_num
    FROM public.users
    WHERE id = p_user_id;

    -- Count direct referrals
    SELECT COUNT(*) INTO direct_refs
    FROM public.users
    WHERE referred_by = p_user_id;

    -- Calculate required referrals
    required := public.calculate_required_referrals(struct_num);

    -- Determine if can withdraw
    RETURN QUERY SELECT
        is_active AND direct_refs >= required,
        CASE
            WHEN NOT is_active THEN 'Account not active (must pay within 33 days)'
            WHEN direct_refs < required THEN 'Need ' || (required - direct_refs)::TEXT || ' more direct referrals'
            ELSE 'Eligible to withdraw'
        END,
        required,
        direct_refs,
        GREATEST(0, required - direct_refs);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. Calculate Capped Earnings
-- ============================================
-- Returns earnings capped at max volume (6,552 × $199)

CREATE OR REPLACE FUNCTION public.calculate_capped_earnings(
    sniper_volume DECIMAL(10,2),
    commission_rate DECIMAL(5,4)
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    max_volume DECIMAL(10,2) := 6552 * 199;
    capped_volume DECIMAL(10,2);
BEGIN
    capped_volume := LEAST(sniper_volume, max_volume);
    RETURN capped_volume * commission_rate;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.calculate_commission_rate(INTEGER) IS
    'Returns commission rate (0.10-0.16) based on active network count. Structure-based progressive commission.';

COMMENT ON FUNCTION public.calculate_structure_number(INTEGER) IS
    'Returns structure number (1-7+) based on active network count. 1092 members per structure.';

COMMENT ON FUNCTION public.is_user_active(UUID) IS
    'Returns TRUE if user paid within last 33 days (30 + 3 grace). Active users can receive payouts.';

COMMENT ON FUNCTION public.is_user_disabled(UUID) IS
    'Returns TRUE if user hasn''t paid in 90+ days. Disabled users keep position but can''t withdraw.';

COMMENT ON FUNCTION public.update_network_counts(UUID) IS
    'Updates denormalized network count columns. Call after payment or network change.';

COMMENT ON FUNCTION public.update_active_status(UUID) IS
    'Updates is_active flag based on last_payment_date. Called after payment.';

COMMENT ON FUNCTION public.update_all_active_statuses() IS
    'Batch updates all users'' active status. Run daily via cron job.';

COMMENT ON FUNCTION public.calculate_required_referrals(INTEGER) IS
    'Returns required direct referrals for withdrawal. Structure N requires 3×N referrals.';

COMMENT ON FUNCTION public.can_withdraw(UUID) IS
    'Checks if user can withdraw earnings. Returns eligibility status and requirements.';

COMMENT ON FUNCTION public.calculate_capped_earnings(DECIMAL, DECIMAL) IS
    'Calculates earnings capped at max volume (6,552 × $199). Used for monthly payouts.';
