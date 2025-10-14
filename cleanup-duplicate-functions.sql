-- ============================================
-- CLEANUP: Remove Duplicate Functions
-- ============================================
-- This script drops ALL versions of find_available_slot
-- and related functions to fix the "function not unique" error.
--
-- Run this BEFORE deploying the correct version.
-- ============================================

-- ============================================
-- STEP 1: Drop all find_available_slot versions
-- ============================================

-- Drop 2-parameter version (unlimited depth)
DROP FUNCTION IF EXISTS public.find_available_slot(TEXT, INTEGER) CASCADE;

-- Drop 3-parameter version (round-robin)
DROP FUNCTION IF EXISTS public.find_available_slot(TEXT, INTEGER, INTEGER) CASCADE;

-- Drop optimized version if exists
DROP FUNCTION IF EXISTS public.find_available_slot_optimized(TEXT, INTEGER) CASCADE;

-- Drop branch-specific version if exists
DROP FUNCTION IF EXISTS public.find_available_slot_in_branch(TEXT, INTEGER, INTEGER) CASCADE;

-- Drop count version if exists
DROP FUNCTION IF EXISTS public.count_available_slots(TEXT, INTEGER) CASCADE;

-- ============================================
-- STEP 2: Verify cleanup
-- ============================================

-- Check if any find_available_slot functions still exist
SELECT
    proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname LIKE '%find_available_slot%'
ORDER BY proname;

-- If the query above returns no rows, cleanup was successful!

-- ============================================
-- NOTES
-- ============================================
-- After running this cleanup, you must deploy the correct version:
-- 1. Run: supabase-find-slot-unlimited.sql
-- 2. Run: supabase-assign-position-unlimited.sql (updated version)
--
-- DO NOT run supabase-round-robin-find-slot.sql unless you need
-- round-robin distribution (advanced feature).
-- ============================================

SELECT 'Duplicate functions dropped successfully! Now deploy the correct version.' as message;
