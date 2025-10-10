-- ============================================
-- MONTHLY CRON JOB FUNCTIONS
-- ============================================
-- Functions to run on the 1st of each month for:
-- 1. Archiving sniper volumes
-- 2. Creating commission/payout records
-- 3. Resetting volumes for new month
--
-- Execution order:
-- 1. archive_monthly_volumes() - saves current month data
-- 2. create_monthly_commissions() - creates payout records
-- 3. reset_monthly_volumes() - resets to $0 for new month
--
-- Payouts are processed around the 7th of the month using
-- the sniper_volume_previous_month and archived data.
-- ============================================

-- ============================================
-- 1. Archive Monthly Volumes
-- ============================================
-- Saves current month's sniper volume data to history table
-- and copies it to sniper_volume_previous_month column
-- Run on 1st of month BEFORE creating commissions

CREATE OR REPLACE FUNCTION public.archive_monthly_volumes()
RETURNS TABLE(
    archived_count INTEGER,
    total_sniper_volume DECIMAL(10,2),
    total_earnings DECIMAL(10,2)
) AS $$
DECLARE
    archived_count INTEGER := 0;
    current_period TEXT;
    total_volume DECIMAL(10,2) := 0;
    total_earn DECIMAL(10,2) := 0;
BEGIN
    -- Get previous month period (YYYY-MM format)
    current_period := TO_CHAR(NOW() - INTERVAL '1 month', 'YYYY-MM');

    -- Copy current to previous column
    UPDATE public.users
    SET sniper_volume_previous_month = sniper_volume_current_month
    WHERE network_position_id IS NOT NULL;

    -- Insert into history table
    INSERT INTO public.sniper_volume_history (
        user_id,
        month_period,
        sniper_volume,
        active_network_count,
        total_network_count,
        commission_rate,
        structure_number,
        gross_earnings,
        capped_earnings,
        can_withdraw
    )
    SELECT
        id,
        current_period,
        sniper_volume_current_month,
        active_network_count,
        total_network_count,
        current_commission_rate,
        current_structure_number,
        sniper_volume_current_month * current_commission_rate as gross,
        public.calculate_capped_earnings(sniper_volume_current_month, current_commission_rate) as capped,
        public.is_user_active(id) as can_withdraw
    FROM public.users
    WHERE network_position_id IS NOT NULL;

    GET DIAGNOSTICS archived_count = ROW_COUNT;

    -- Calculate totals
    SELECT
        COALESCE(SUM(sniper_volume_current_month), 0),
        COALESCE(SUM(public.calculate_capped_earnings(sniper_volume_current_month, current_commission_rate)), 0)
    INTO total_volume, total_earn
    FROM public.users
    WHERE network_position_id IS NOT NULL;

    RETURN QUERY SELECT archived_count, total_volume, total_earn;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Create Monthly Commissions
-- ============================================
-- Creates commission/payout records for all active users
-- Run AFTER archiving, BEFORE resetting
-- Only creates commissions for ACTIVE users (paid within 33 days)

CREATE OR REPLACE FUNCTION public.create_monthly_commissions()
RETURNS TABLE(
    commission_count INTEGER,
    total_payout_amount DECIMAL(10,2),
    ineligible_count INTEGER
) AS $$
DECLARE
    commission_count INTEGER := 0;
    ineligible_count INTEGER := 0;
    total_payout DECIMAL(10,2) := 0;
    user_record RECORD;
    earnings DECIMAL(10,2);
    withdrawal_check RECORD;
BEGIN
    FOR user_record IN
        SELECT
            id,
            sniper_volume_previous_month,
            current_commission_rate,
            current_structure_number
        FROM public.users
        WHERE network_position_id IS NOT NULL
        AND sniper_volume_previous_month > 0
    LOOP
        -- Check withdrawal eligibility
        SELECT * INTO withdrawal_check
        FROM public.can_withdraw(user_record.id);

        IF withdrawal_check.can_withdraw THEN
            -- Calculate capped earnings
            earnings := public.calculate_capped_earnings(
                user_record.sniper_volume_previous_month,
                user_record.current_commission_rate
            );

            IF earnings > 0 THEN
                -- Create commission record
                INSERT INTO public.commissions (
                    referrer_id,
                    referred_id,
                    amount,
                    status,
                    created_at
                ) VALUES (
                    user_record.id,
                    user_record.id,
                    earnings,
                    'pending',
                    NOW()
                );

                commission_count := commission_count + 1;
                total_payout := total_payout + earnings;
            END IF;
        ELSE
            -- User not eligible to withdraw
            ineligible_count := ineligible_count + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT commission_count, total_payout, ineligible_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Reset Monthly Volumes
-- ============================================
-- Resets sniper_volume_current_month to $0 for all users
-- Run AFTER archiving and creating commissions
-- This starts the new month with clean slate

CREATE OR REPLACE FUNCTION public.reset_monthly_volumes()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER;
BEGIN
    UPDATE public.users
    SET sniper_volume_current_month = 0
    WHERE network_position_id IS NOT NULL;

    GET DIAGNOSTICS reset_count = ROW_COUNT;
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Combined Monthly Processing
-- ============================================
-- Runs all three steps in correct order
-- Call this single function from cron job on 1st of month

CREATE OR REPLACE FUNCTION public.process_monthly_volumes()
RETURNS TABLE(
    step TEXT,
    success BOOLEAN,
    count INTEGER,
    amount DECIMAL(10,2),
    message TEXT
) AS $$
DECLARE
    archive_result RECORD;
    commission_result RECORD;
    reset_result INTEGER;
BEGIN
    -- Step 1: Archive
    BEGIN
        SELECT * INTO archive_result FROM public.archive_monthly_volumes();
        RETURN QUERY SELECT
            'Archive'::TEXT,
            TRUE,
            archive_result.archived_count,
            archive_result.total_sniper_volume,
            'Archived ' || archive_result.archived_count || ' user volumes';
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'Archive'::TEXT,
            FALSE,
            0,
            0.00,
            'Archive failed: ' || SQLERRM;
        RETURN;
    END;

    -- Step 2: Create Commissions
    BEGIN
        SELECT * INTO commission_result FROM public.create_monthly_commissions();
        RETURN QUERY SELECT
            'Commissions'::TEXT,
            TRUE,
            commission_result.commission_count,
            commission_result.total_payout_amount,
            'Created ' || commission_result.commission_count || ' commissions, ' ||
            commission_result.ineligible_count || ' ineligible';
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'Commissions'::TEXT,
            FALSE,
            0,
            0.00,
            'Commission creation failed: ' || SQLERRM;
        RETURN;
    END;

    -- Step 3: Reset
    BEGIN
        reset_result := public.reset_monthly_volumes();
        RETURN QUERY SELECT
            'Reset'::TEXT,
            TRUE,
            reset_result,
            0.00,
            'Reset ' || reset_result || ' user volumes to $0';
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'Reset'::TEXT,
            FALSE,
            0,
            0.00,
            'Reset failed: ' || SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Get Monthly Stats
-- ============================================
-- Returns statistics for a specific month
-- Useful for reports and analytics

CREATE OR REPLACE FUNCTION public.get_monthly_stats(p_month_period TEXT)
RETURNS TABLE(
    total_users INTEGER,
    users_with_volume INTEGER,
    users_eligible INTEGER,
    total_volume DECIMAL(10,2),
    total_earnings DECIMAL(10,2),
    avg_volume DECIMAL(10,2),
    avg_earnings DECIMAL(10,2),
    max_volume DECIMAL(10,2),
    max_earnings DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_users,
        COUNT(*) FILTER (WHERE sniper_volume > 0)::INTEGER as users_with_volume,
        COUNT(*) FILTER (WHERE can_withdraw)::INTEGER as users_eligible,
        COALESCE(SUM(sniper_volume), 0) as total_volume,
        COALESCE(SUM(capped_earnings), 0) as total_earnings,
        COALESCE(AVG(sniper_volume), 0) as avg_volume,
        COALESCE(AVG(capped_earnings), 0) as avg_earnings,
        COALESCE(MAX(sniper_volume), 0) as max_volume,
        COALESCE(MAX(capped_earnings), 0) as max_earnings
    FROM public.sniper_volume_history
    WHERE month_period = p_month_period;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.archive_monthly_volumes() IS
    'Archives current month sniper volumes to history table and previous_month column. Run on 1st of month.';

COMMENT ON FUNCTION public.create_monthly_commissions() IS
    'Creates commission records for active users based on previous month volume. Run after archiving.';

COMMENT ON FUNCTION public.reset_monthly_volumes() IS
    'Resets all sniper_volume_current_month to $0 for new month. Run after creating commissions.';

COMMENT ON FUNCTION public.process_monthly_volumes() IS
    'Runs all monthly processing steps in correct order. Call this from cron job on 1st of month.';

COMMENT ON FUNCTION public.get_monthly_stats(TEXT) IS
    'Returns statistics for a specific month period (YYYY-MM). Useful for reports and dashboards.';

-- ============================================
-- CRON JOB SETUP INSTRUCTIONS
-- ============================================
-- In Supabase Dashboard > Database > Cron Jobs:
--
-- Job 1: Monthly Volume Processing (1st of month at 00:01 UTC)
-- SELECT * FROM public.process_monthly_volumes();
-- Cron: 1 0 1 * *
--
-- Job 2: Daily Active Status Update (every day at 00:00 UTC)
-- SELECT public.update_all_active_statuses();
-- Cron: 0 0 * * *
--
-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run monthly processing manually (for testing)
-- SELECT * FROM public.process_monthly_volumes();

-- Check last month's stats
-- SELECT * FROM public.get_monthly_stats(TO_CHAR(NOW() - INTERVAL '1 month', 'YYYY-MM'));

-- See recent archives
-- SELECT * FROM public.sniper_volume_history
-- ORDER BY created_at DESC LIMIT 10;

-- Check pending commissions
-- SELECT * FROM public.commissions
-- WHERE status = 'pending'
-- ORDER BY created_at DESC;
