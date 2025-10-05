-- ============================================
-- FIX ORPHANED USERS SCRIPT
-- ============================================
-- This script attempts to assign network positions
-- to users who don't have them
-- ============================================

-- IMPORTANT: Review the orphaned users first using detect-orphaned-users.sql
-- before running this script!

-- Fix users without positions
DO $$
DECLARE
    orphaned_user RECORD;
    position_id TEXT;
    success_count INTEGER := 0;
    failure_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting orphaned user position assignment...';

    FOR orphaned_user IN
        SELECT id, email, referred_by, created_at
        FROM public.users
        WHERE network_position_id IS NULL
        ORDER BY created_at ASC
    LOOP
        BEGIN
            -- Try to assign position
            position_id := public.assign_network_position(
                orphaned_user.id,
                orphaned_user.referred_by
            );

            success_count := success_count + 1;
            RAISE NOTICE '[SUCCESS] Assigned position % to user % (%)',
                position_id, orphaned_user.email, orphaned_user.id;

        EXCEPTION WHEN OTHERS THEN
            failure_count := failure_count + 1;
            RAISE NOTICE '[FAILED] Could not assign position to user % (%): %',
                orphaned_user.email, orphaned_user.id, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '===== SUMMARY =====';
    RAISE NOTICE 'Successfully assigned: %', success_count;
    RAISE NOTICE 'Failed to assign: %', failure_count;
    RAISE NOTICE 'Total processed: %', success_count + failure_count;
END $$;

-- Verify the fix
SELECT
    'Before Fix - Orphaned Count' as status,
    COUNT(*) as count
FROM public.users
WHERE network_position_id IS NULL
UNION ALL
SELECT
    'After Fix - Should be 0 or lower',
    COUNT(*)
FROM public.users
WHERE network_position_id IS NULL;

-- Show any remaining orphaned users
SELECT
    id,
    email,
    name,
    referred_by,
    created_at,
    'Still orphaned after fix attempt' as note
FROM public.users
WHERE network_position_id IS NULL
ORDER BY created_at DESC;
