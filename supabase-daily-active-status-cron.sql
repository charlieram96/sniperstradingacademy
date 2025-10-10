-- ============================================
-- DAILY ACTIVE STATUS CRON JOB
-- ============================================
-- This function should be run DAILY to:
-- 1. Check for users who became inactive (33+ days without payment)
-- 2. Check for users who became active again (were inactive, now paid)
-- 3. Update is_active flag and inactive_since timestamp
-- 4. Increment/decrement active_network_count for ancestors
-- ============================================

CREATE OR REPLACE FUNCTION public.update_all_active_statuses()
RETURNS TABLE(
    newly_inactive_count INTEGER,
    newly_active_count INTEGER,
    total_checked INTEGER
) AS $$
DECLARE
    user_record RECORD;
    total_users INTEGER := 0;
    became_inactive INTEGER := 0;
    became_active INTEGER := 0;
    was_active BOOLEAN;
    is_now_active BOOLEAN;
    ancestors_updated INTEGER;
BEGIN
    -- Process all users with network positions
    FOR user_record IN
        SELECT
            id,
            network_position_id,
            is_active as current_is_active,
            last_payment_date,
            inactive_since
        FROM public.users
        WHERE network_position_id IS NOT NULL
        ORDER BY network_level, network_position
    LOOP
        total_users := total_users + 1;
        was_active := user_record.current_is_active;

        -- Determine new active status based on last_payment_date
        -- Active = paid within last 33 days (monthly: 30 + 3 grace)
        -- Note: For weekly users, this could be adjusted, but 33 days works for both
        is_now_active := (
            user_record.last_payment_date IS NOT NULL
            AND user_record.last_payment_date >= NOW() - INTERVAL '33 days'
        );

        -- Case 1: User BECAME INACTIVE (was active, now inactive)
        IF was_active AND NOT is_now_active THEN
            -- Update user status
            UPDATE public.users
            SET
                is_active = FALSE,
                inactive_since = COALESCE(inactive_since, NOW())
            WHERE id = user_record.id;

            -- Decrement active count for all ancestors
            BEGIN
                SELECT public.decrement_upchain_active_count(user_record.id)
                INTO ancestors_updated;

                RAISE NOTICE 'User % became inactive - decremented active_network_count for % ancestors',
                    user_record.id, ancestors_updated;

                became_inactive := became_inactive + 1;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Failed to decrement active count for user %: %',
                    user_record.id, SQLERRM;
            END;

        -- Case 2: User BECAME ACTIVE (was inactive, now active)
        ELSIF NOT was_active AND is_now_active THEN
            -- Update user status
            UPDATE public.users
            SET
                is_active = TRUE,
                inactive_since = NULL
            WHERE id = user_record.id;

            -- Increment active count for all ancestors
            BEGIN
                SELECT public.increment_upchain_active_count(user_record.id)
                INTO ancestors_updated;

                RAISE NOTICE 'User % became active - incremented active_network_count for % ancestors',
                    user_record.id, ancestors_updated;

                became_active := became_active + 1;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Failed to increment active count for user %: %',
                    user_record.id, SQLERRM;
            END;

        -- Case 3: Status unchanged - just update the flag in case it was manually changed
        ELSE
            UPDATE public.users
            SET is_active = is_now_active
            WHERE id = user_record.id
            AND is_active != is_now_active; -- Only update if different
        END IF;
    END LOOP;

    RETURN QUERY SELECT
        became_inactive,
        became_active,
        total_users;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER: Check which users will become inactive
-- ============================================
-- Use this to preview which users will be marked inactive before running the cron

CREATE OR REPLACE FUNCTION public.preview_active_status_changes()
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    currently_active BOOLEAN,
    will_be_active BOOLEAN,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    days_since_payment INTEGER,
    status_change TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.email,
        u.is_active,
        (u.last_payment_date IS NOT NULL AND u.last_payment_date >= NOW() - INTERVAL '33 days') as will_be_active,
        u.last_payment_date,
        CASE
            WHEN u.last_payment_date IS NULL THEN NULL
            ELSE EXTRACT(DAY FROM NOW() - u.last_payment_date)::INTEGER
        END as days_since_payment,
        CASE
            WHEN u.is_active AND NOT (u.last_payment_date IS NOT NULL AND u.last_payment_date >= NOW() - INTERVAL '33 days')
                THEN 'Will become INACTIVE'
            WHEN NOT u.is_active AND (u.last_payment_date IS NOT NULL AND u.last_payment_date >= NOW() - INTERVAL '33 days')
                THEN 'Will become ACTIVE'
            ELSE 'No change'
        END as status_change
    FROM public.users u
    WHERE u.network_position_id IS NOT NULL
    ORDER BY
        CASE
            WHEN u.is_active != (u.last_payment_date IS NOT NULL AND u.last_payment_date >= NOW() - INTERVAL '33 days')
                THEN 0
            ELSE 1
        END,
        u.network_level,
        u.network_position;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.update_all_active_statuses() IS
    'Daily cron job: Updates is_active status for all users and increments/decrements active_network_count for ancestors when status changes. Run this once per day.';

COMMENT ON FUNCTION public.preview_active_status_changes() IS
    'Preview which users will have their active status changed. Use this to check before running the daily cron job.';

-- ============================================
-- SETUP CRON JOB (via pg_cron extension)
-- ============================================
-- Run this in Supabase SQL Editor to set up daily execution:

/*
-- Install pg_cron if not already installed
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily execution at 2:00 AM UTC
SELECT cron.schedule(
    'daily-active-status-update',
    '0 2 * * *',
    $$SELECT public.update_all_active_statuses()$$
);

-- To check scheduled jobs:
SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('daily-active-status-update');
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Preview changes before running:
-- SELECT * FROM public.preview_active_status_changes()
-- WHERE status_change != 'No change';

-- Run the update manually:
-- SELECT * FROM public.update_all_active_statuses();

-- Check results:
-- SELECT
--   COUNT(*) FILTER (WHERE is_active = TRUE) as active_users,
--   COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_users,
--   COUNT(*) as total_users
-- FROM public.users
-- WHERE network_position_id IS NOT NULL;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Daily active status cron job created! Set up pg_cron schedule to run automatically.' as message;
