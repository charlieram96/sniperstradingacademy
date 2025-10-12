-- ============================================
-- DAILY SUBSCRIPTION STATUS SYNC
-- ============================================
-- This replaces the old date-based active status checking.
-- Instead, it syncs is_active with Stripe subscription status.
--
-- Active status is now determined by:
-- - User has active Stripe subscription (status = 'active')
-- - NOT by payment dates (Stripe handles billing automatically)
-- ============================================

-- Drop old version
DROP FUNCTION IF EXISTS public.update_all_active_statuses();

-- ============================================
-- 1. SYNC ACTIVE STATUS WITH SUBSCRIPTIONS
-- ============================================
-- Compares users.is_active with subscriptions.status
-- Updates is_active and increments/decrements active_network_count

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
    ancestors_updated INTEGER;
BEGIN
    -- Process all users with network positions
    FOR user_record IN
        SELECT
            u.id,
            u.network_position_id,
            u.is_active as current_is_active,
            s.status as subscription_status
        FROM public.users u
        LEFT JOIN public.subscriptions s ON s.user_id = u.id AND s.status IN ('active', 'past_due', 'canceled', 'unpaid')
        WHERE u.network_position_id IS NOT NULL
        ORDER BY u.network_level, u.network_position
    LOOP
        total_users := total_users + 1;

        -- Determine if user should be active based on subscription status
        -- Active = has subscription with status 'active'
        DECLARE
            should_be_active BOOLEAN;
        BEGIN
            should_be_active := (user_record.subscription_status = 'active');

            -- Case 1: User BECAME INACTIVE (had active subscription, now doesn't)
            IF user_record.current_is_active AND NOT should_be_active THEN
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

                    RAISE NOTICE 'User % became inactive (subscription: %) - decremented active_network_count for % ancestors',
                        user_record.id, COALESCE(user_record.subscription_status, 'none'), ancestors_updated;

                    became_inactive := became_inactive + 1;
                EXCEPTION WHEN OTHERS THEN
                    RAISE WARNING 'Failed to decrement active count for user %: %',
                        user_record.id, SQLERRM;
                END;

            -- Case 2: User BECAME ACTIVE (didn't have active subscription, now does)
            ELSIF NOT user_record.current_is_active AND should_be_active THEN
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

                    RAISE NOTICE 'User % became active (subscription: active) - incremented active_network_count for % ancestors',
                        user_record.id, ancestors_updated;

                    became_active := became_active + 1;
                EXCEPTION WHEN OTHERS THEN
                    RAISE WARNING 'Failed to increment active count for user %: %',
                        user_record.id, SQLERRM;
                END;

            -- Case 3: Status unchanged - just ensure is_active matches
            ELSE
                UPDATE public.users
                SET is_active = should_be_active
                WHERE id = user_record.id
                AND is_active != should_be_active; -- Only update if different
            END IF;
        END;
    END LOOP;

    RETURN QUERY SELECT
        became_inactive,
        became_active,
        total_users;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. PREVIEW SUBSCRIPTION STATUS CHANGES
-- ============================================
-- Shows which users will have their active status changed

CREATE OR REPLACE FUNCTION public.preview_active_status_changes()
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    currently_active BOOLEAN,
    will_be_active BOOLEAN,
    subscription_status TEXT,
    status_change TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.email,
        u.is_active,
        (s.status = 'active') as will_be_active,
        COALESCE(s.status, 'no_subscription') as subscription_status,
        CASE
            WHEN u.is_active AND NOT (s.status = 'active')
                THEN 'Will become INACTIVE'
            WHEN NOT u.is_active AND (s.status = 'active')
                THEN 'Will become ACTIVE'
            ELSE 'No change'
        END as status_change
    FROM public.users u
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    WHERE u.network_position_id IS NOT NULL
    ORDER BY
        CASE
            WHEN u.is_active != (s.status = 'active')
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
    'Daily cron job: Syncs is_active status with Stripe subscription status. Increments/decrements active_network_count when status changes. Run daily.';

COMMENT ON FUNCTION public.preview_active_status_changes() IS
    'Preview which users will have their active status changed based on subscription status. Use before running daily cron.';

-- ============================================
-- CRON JOB SETUP
-- ============================================
-- The cron job is already scheduled, but here's the command again:

/*
-- Daily execution at 2:00 AM UTC
SELECT cron.schedule(
    'daily-active-status-update',
    '0 2 * * *',
    $$SELECT public.update_all_active_statuses()$$
);
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Preview changes before running:
-- SELECT * FROM public.preview_active_status_changes()
-- WHERE status_change != 'No change';

-- Run the update manually:
-- SELECT * FROM public.update_all_active_statuses();

-- Check active users:
-- SELECT
--   COUNT(*) FILTER (WHERE is_active = TRUE) as active_users,
--   COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_users,
--   COUNT(*) as total_users
-- FROM public.users
-- WHERE network_position_id IS NOT NULL;

-- Check users with subscriptions:
-- SELECT
--   u.id,
--   u.email,
--   u.is_active,
--   s.status as subscription_status,
--   s.current_period_end
-- FROM public.users u
-- LEFT JOIN public.subscriptions s ON s.user_id = u.id
-- WHERE u.network_position_id IS NOT NULL
-- ORDER BY u.network_level, u.network_position
-- LIMIT 20;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Daily subscription sync function updated! Now uses Stripe subscription status instead of payment dates.' as message;
