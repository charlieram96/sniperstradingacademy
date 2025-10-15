-- ============================================
-- PRE-CHECK: Referral System Schema
-- ============================================
-- Safe to run even if schema not deployed
-- Tells you exactly what's missing
-- ============================================

SELECT '========================================' as divider;
SELECT 'REFERRAL SYSTEM SCHEMA CHECK' as title;
SELECT '========================================' as divider;

-- ============================================
-- CHECK 1: direct_referrals_count column
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'direct_referrals_count'
    ) THEN
        RAISE NOTICE '✓ direct_referrals_count column exists in users table';
    ELSE
        RAISE WARNING '✗ direct_referrals_count column MISSING in users table';
        RAISE NOTICE '  → Deploy supabase-activation-schema.sql to add this column';
    END IF;
END $$;

-- ============================================
-- CHECK 2: update_direct_referrals_count trigger
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        AND event_object_table = 'referrals'
        AND trigger_name = 'trigger_update_direct_referrals'
    ) THEN
        RAISE NOTICE '✓ trigger_update_direct_referrals exists on referrals table';
    ELSE
        RAISE WARNING '✗ trigger_update_direct_referrals MISSING on referrals table';
        RAISE NOTICE '  → Deploy supabase-activation-schema.sql to add this trigger';
    END IF;
END $$;

-- ============================================
-- CHECK 3: update_direct_referrals_count function
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'update_direct_referrals_count'
    ) THEN
        RAISE NOTICE '✓ update_direct_referrals_count() function exists';
    ELSE
        RAISE WARNING '✗ update_direct_referrals_count() function MISSING';
        RAISE NOTICE '  → Deploy supabase-activation-schema.sql to add this function';
    END IF;
END $$;

-- ============================================
-- CHECK 4: referrals table exists
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'referrals'
    ) THEN
        RAISE NOTICE '✓ referrals table exists';
    ELSE
        RAISE WARNING '✗ referrals table MISSING';
        RAISE NOTICE '  → Create referrals table before deploying activation schema';
    END IF;
END $$;

-- ============================================
-- CHECK 5: referrals table has required columns
-- ============================================
DO $$
DECLARE
    missing_cols TEXT[];
    col TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'referrals'
    ) THEN
        -- Check for required columns
        SELECT ARRAY_AGG(required_col)
        INTO missing_cols
        FROM (
            SELECT unnest(ARRAY['id', 'referrer_id', 'referred_id', 'status', 'initial_payment_status', 'created_at']) AS required_col
        ) required
        WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'referrals'
            AND column_name = required_col
        );

        IF missing_cols IS NULL OR array_length(missing_cols, 1) = 0 THEN
            RAISE NOTICE '✓ All required columns exist in referrals table';
        ELSE
            RAISE WARNING '✗ Missing columns in referrals table: %', array_to_string(missing_cols, ', ');
            RAISE NOTICE '  → Add missing columns to referrals table';
        END IF;
    END IF;
END $$;

-- ============================================
-- SUMMARY
-- ============================================
SELECT '========================================' as divider;
SELECT 'SUMMARY' as section;
SELECT '========================================' as divider;

DO $$
DECLARE
    has_column BOOLEAN;
    has_trigger BOOLEAN;
    has_function BOOLEAN;
    has_table BOOLEAN;
    all_good BOOLEAN;
BEGIN
    -- Check column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'direct_referrals_count'
    ) INTO has_column;

    -- Check trigger
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        AND event_object_table = 'referrals'
        AND trigger_name = 'trigger_update_direct_referrals'
    ) INTO has_trigger;

    -- Check function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'update_direct_referrals_count'
    ) INTO has_function;

    -- Check table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'referrals'
    ) INTO has_table;

    all_good := has_column AND has_trigger AND has_function AND has_table;

    IF all_good THEN
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✓✓✓ ALL CHECKS PASSED ✓✓✓';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'Referral system schema is fully deployed!';
        RAISE NOTICE '';
        RAISE NOTICE 'Next steps:';
        RAISE NOTICE '1. Run verify-direct-referrals.sql to check data integrity';
        RAISE NOTICE '2. Run fix-referral-counts.sql to sync existing counts';
        RAISE NOTICE '3. Test by creating a new referral';
    ELSE
        RAISE WARNING '';
        RAISE WARNING '========================================';
        RAISE WARNING '✗✗✗ SCHEMA INCOMPLETE ✗✗✗';
        RAISE WARNING '========================================';
        RAISE WARNING 'Referral counting will NOT work until schema is deployed.';
        RAISE WARNING '';
        RAISE WARNING 'TO FIX:';
        RAISE WARNING '1. Open Supabase SQL Editor';
        RAISE WARNING '2. Run supabase-activation-schema.sql';
        RAISE WARNING '3. Re-run this check script';
        RAISE WARNING '4. Run fix-referral-counts.sql to backfill counts';
        RAISE WARNING '';
        RAISE WARNING 'Missing components:';
        IF NOT has_table THEN
            RAISE WARNING '  ✗ referrals table';
        END IF;
        IF NOT has_column THEN
            RAISE WARNING '  ✗ direct_referrals_count column';
        END IF;
        IF NOT has_function THEN
            RAISE WARNING '  ✗ update_direct_referrals_count() function';
        END IF;
        IF NOT has_trigger THEN
            RAISE WARNING '  ✗ trigger_update_direct_referrals trigger';
        END IF;
    END IF;
END $$;
