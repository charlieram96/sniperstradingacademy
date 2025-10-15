-- ============================================
-- CLEANUP: Referral Schema - Remove Duplicates
-- ============================================
-- Fixes schema inconsistencies:
-- 1. Removes account_active (duplicate of is_active)
-- 2. Removes accumulated_residual (not needed - sniper volume resets monthly)
-- 3. Adds active_direct_referrals_count (for qualification)
-- ============================================

-- ============================================
-- STEP 0: Drop old view that depends on account_active
-- ============================================

-- Drop the view first (it will be recreated with correct columns later)
DO $$
BEGIN
    DROP VIEW IF EXISTS public.user_qualification_status CASCADE;
    RAISE NOTICE '✓ Dropped old user_qualification_status view';
END $$;

-- ============================================
-- STEP 1: Remove duplicate active column
-- ============================================

-- Check if account_active exists before dropping
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'account_active'
    ) THEN
        RAISE NOTICE 'Dropping duplicate column: account_active';
        ALTER TABLE public.users DROP COLUMN account_active;
        RAISE NOTICE '✓ account_active column removed';
    ELSE
        RAISE NOTICE 'account_active column does not exist - skipping';
    END IF;
END $$;

-- ============================================
-- STEP 2: Remove accumulated_residual column
-- ============================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'accumulated_residual'
    ) THEN
        RAISE NOTICE 'Dropping unnecessary column: accumulated_residual';
        ALTER TABLE public.users DROP COLUMN accumulated_residual;
        RAISE NOTICE '✓ accumulated_residual column removed';
    ELSE
        RAISE NOTICE 'accumulated_residual column does not exist - skipping';
    END IF;
END $$;

-- ============================================
-- STEP 3: Remove related indexes
-- ============================================

DO $$
BEGIN
    DROP INDEX IF EXISTS public.idx_users_account_active;
    RAISE NOTICE '✓ Removed idx_users_account_active index if it existed';
END $$;

-- ============================================
-- STEP 4: Add active_direct_referrals_count
-- ============================================

-- Add column for tracking ACTIVE direct referrals (is_active = TRUE)
DO $$
BEGIN
    ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS active_direct_referrals_count INTEGER DEFAULT 0;

    COMMENT ON COLUMN public.users.active_direct_referrals_count IS
        'Count of direct referrals who are CURRENTLY ACTIVE (is_active = TRUE). Used for qualification - need 3 active referrals to qualify for structure payouts.';

    COMMENT ON COLUMN public.users.direct_referrals_count IS
        'Count of direct referrals who paid $500 (referral status = "active"). Different from active_direct_referrals_count - a user can pay $500 but later become inactive.';

    RAISE NOTICE '✓ Added active_direct_referrals_count column';
END $$;

-- ============================================
-- STEP 5: Create index for new column
-- ============================================

DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_users_active_direct_referrals
        ON public.users(active_direct_referrals_count) WHERE active_direct_referrals_count > 0;

    RAISE NOTICE '✓ Created index on active_direct_referrals_count';
END $$;

-- ============================================
-- STEP 6: Update check_qualification_status function
-- ============================================

-- This function now checks active_direct_referrals_count instead of direct_referrals_count
CREATE OR REPLACE FUNCTION check_qualification_status(
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_active_direct_referrals INTEGER;
    v_qualified BOOLEAN;
BEGIN
    -- Get current qualification status
    SELECT
        active_direct_referrals_count,
        qualified_at IS NOT NULL
    INTO
        v_active_direct_referrals,
        v_qualified
    FROM public.users
    WHERE id = p_user_id;

    -- If already qualified, return true
    IF v_qualified THEN
        RETURN TRUE;
    END IF;

    -- Check if user has 3 or more ACTIVE direct referrals
    IF v_active_direct_referrals >= 3 THEN
        UPDATE public.users
        SET qualified_at = TIMEZONE('utc', NOW())
        WHERE id = p_user_id;

        RAISE NOTICE 'User % qualified with % active direct referrals', p_user_id, v_active_direct_referrals;
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    RAISE NOTICE '✓ Updated check_qualification_status() to use active_direct_referrals_count';
END $$;

-- ============================================
-- STEP 7: Update user_qualification_status view
-- ============================================

CREATE OR REPLACE VIEW public.user_qualification_status AS
SELECT
    u.id,
    u.name,
    u.email,
    u.activated_at,
    u.qualified_at,
    u.direct_referrals_count,
    u.active_direct_referrals_count,
    u.is_active,
    u.monthly_payment_due_date,
    CASE
        WHEN u.qualified_at IS NOT NULL THEN 'qualified'
        WHEN u.active_direct_referrals_count >= 3 THEN 'should_be_qualified'
        WHEN u.activated_at IS NOT NULL THEN 'pending'
        ELSE 'not_activated'
    END as qualification_status,
    CASE
        WHEN u.monthly_payment_due_date IS NOT NULL THEN
            EXTRACT(EPOCH FROM (u.monthly_payment_due_date - TIMEZONE('utc', NOW())))::INTEGER
        ELSE NULL
    END as seconds_until_payment_due
FROM public.users u;

DO $$
BEGIN
    RAISE NOTICE '✓ Updated user_qualification_status view to include both referral counts';
END $$;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓✓✓ SCHEMA CLEANUP COMPLETE ✓✓✓';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '  ✓ Removed account_active (duplicate)';
    RAISE NOTICE '  ✓ Removed accumulated_residual (not needed)';
    RAISE NOTICE '  ✓ Added active_direct_referrals_count';
    RAISE NOTICE '  ✓ Updated check_qualification_status()';
    RAISE NOTICE '  ✓ Updated user_qualification_status view';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Run supabase-active-referrals-trigger.sql';
    RAISE NOTICE '  2. Run migrate-referral-counts.sql to backfill counts';
    RAISE NOTICE '  3. Test qualification with 3 active referrals';
END $$;
