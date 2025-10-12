-- ============================================
-- UPDATED DAILY SUBSCRIPTION STATUS SYNC
-- ============================================
-- This handles TWO phases of active status:
--
-- PHASE 1 (30-day grace after $500):
--   - User pays $500 → is_active = TRUE immediately
--   - User has 30 days to subscribe
--   - If 30 days pass with no subscription → is_active = FALSE
--
-- PHASE 2 (Subscription-based):
--   - User subscribes → is_active follows subscription.status
--   - subscription.status = 'active' → is_active = TRUE
--   - subscription.status = 'past_due', 'canceled' → is_active = FALSE
--   - Stripe handles monthly/weekly billing with 3-day grace (33 days total)
-- ============================================

-- Drop old versions
DROP FUNCTION IF EXISTS public.update_all_active_statuses();
DROP FUNCTION IF EXISTS public.preview_active_status_changes();

-- ============================================
-- MAIN FUNCTION: Update Active Statuses
-- ============================================

CREATE OR REPLACE FUNCTION public.update_all_active_statuses()
RETURNS TABLE(
    newly_inactive_count INTEGER,
    newly_active_count INTEGER,
    grace_period_expired_count INTEGER,
    total_checked INTEGER
) AS $$
DECLARE
    user_record RECORD;
    total_users INTEGER := 0;
    became_inactive INTEGER := 0;
    became_active INTEGER := 0;
    grace_expired INTEGER := 0;
    ancestors_updated INTEGER;
BEGIN
    -- Process all users with network positions
    FOR user_record IN
        SELECT
            u.id,
            u.network_position_id,
            u.is_active as current_is_active,
            u.initial_payment_completed,
            u.initial_payment_date,
            s.status as subscription_status
        FROM public.users u
        LEFT JOIN public.subscriptions s ON s.user_id = u.id AND s.status IN ('active', 'past_due', 'canceled', 'unpaid')
        WHERE u.network_position_id IS NOT NULL
        ORDER BY u.network_level, u.network_position
    LOOP
        total_users := total_users + 1;

        -- Determine if user should be active
        DECLARE
            should_be_active BOOLEAN;
            grace_period_active BOOLEAN;
        BEGIN
            -- Check if user is in 30-day grace period (paid $500 but hasn't subscribed)
            grace_period_active := (
                user_record.initial_payment_completed = TRUE
                AND user_record.subscription_status IS NULL
                AND user_record.initial_payment_date IS NOT NULL
                AND user_record.initial_payment_date >= NOW() - INTERVAL '30 days'
            );

            -- User should be active if:
            -- 1. They have an active subscription, OR
            -- 2. They're in the 30-day grace period after initial payment
            should_be_active := (user_record.subscription_status = 'active') OR grace_period_active;

            -- CASE 1: User BECAME INACTIVE
            -- (had active status, now doesn't)
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

                    -- Check if this was due to grace period expiration
                    IF user_record.subscription_status IS NULL THEN
                        RAISE NOTICE 'User % grace period expired (30 days since $500 payment) - decremented active_network_count for % ancestors',
                            user_record.id, ancestors_updated;
                        grace_expired := grace_expired + 1;
                    ELSE
                        RAISE NOTICE 'User % became inactive (subscription: %) - decremented active_network_count for % ancestors',
                            user_record.id, COALESCE(user_record.subscription_status, 'none'), ancestors_updated;
                        became_inactive := became_inactive + 1;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    RAISE WARNING 'Failed to decrement active count for user %: %',
                        user_record.id, SQLERRM;
                END;

            -- CASE 2: User BECAME ACTIVE
            -- (didn't have active status, now does)
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

                    IF grace_period_active THEN
                        RAISE NOTICE 'User % became active (within 30-day grace period) - incremented active_network_count for % ancestors',
                            user_record.id, ancestors_updated;
                    ELSE
                        RAISE NOTICE 'User % became active (subscription: active) - incremented active_network_count for % ancestors',
                            user_record.id, ancestors_updated;
                    END IF;

                    became_active := became_active + 1;
                EXCEPTION WHEN OTHERS THEN
                    RAISE WARNING 'Failed to increment active count for user %: %',
                        user_record.id, SQLERRM;
                END;

            -- CASE 3: Status unchanged - just ensure is_active matches
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
        grace_expired,
        total_users;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PREVIEW FUNCTION: Show What Will Change
-- ============================================

CREATE OR REPLACE FUNCTION public.preview_active_status_changes()
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    currently_active BOOLEAN,
    will_be_active BOOLEAN,
    subscription_status TEXT,
    days_since_initial_payment INTEGER,
    in_grace_period BOOLEAN,
    status_change TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.email,
        u.is_active,
        -- Will be active if: has active subscription OR in 30-day grace period
        (
            (s.status = 'active')
            OR
            (
                u.initial_payment_completed = TRUE
                AND s.status IS NULL
                AND u.initial_payment_date IS NOT NULL
                AND u.initial_payment_date >= NOW() - INTERVAL '30 days'
            )
        ) as will_be_active,
        COALESCE(s.status, 'no_subscription') as subscription_status,
        CASE
            WHEN u.initial_payment_date IS NOT NULL
            THEN EXTRACT(DAY FROM NOW() - u.initial_payment_date)::INTEGER
            ELSE NULL
        END as days_since_initial_payment,
        (
            u.initial_payment_completed = TRUE
            AND s.status IS NULL
            AND u.initial_payment_date IS NOT NULL
            AND u.initial_payment_date >= NOW() - INTERVAL '30 days'
        ) as in_grace_period,
        CASE
            WHEN u.is_active AND NOT (
                (s.status = 'active')
                OR
                (
                    u.initial_payment_completed = TRUE
                    AND s.status IS NULL
                    AND u.initial_payment_date IS NOT NULL
                    AND u.initial_payment_date >= NOW() - INTERVAL '30 days'
                )
            )
                THEN 'Will become INACTIVE'
            WHEN NOT u.is_active AND (
                (s.status = 'active')
                OR
                (
                    u.initial_payment_completed = TRUE
                    AND s.status IS NULL
                    AND u.initial_payment_date IS NOT NULL
                    AND u.initial_payment_date >= NOW() - INTERVAL '30 days'
                )
            )
                THEN 'Will become ACTIVE'
            ELSE 'No change'
        END as status_change
    FROM public.users u
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    WHERE u.network_position_id IS NOT NULL
    ORDER BY
        CASE
            WHEN u.is_active != (
                (s.status = 'active')
                OR
                (
                    u.initial_payment_completed = TRUE
                    AND s.status IS NULL
                    AND u.initial_payment_date IS NOT NULL
                    AND u.initial_payment_date >= NOW() - INTERVAL '30 days'
                )
            )
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
    'Daily cron job: Syncs is_active status with Stripe subscriptions AND 30-day grace period. Phase 1: User active for 30 days after $500 payment. Phase 2: User active based on subscription status. Increments/decrements active_network_count when status changes. Run daily.';

COMMENT ON FUNCTION public.preview_active_status_changes() IS
    'Preview which users will have their active status changed. Shows subscription status, days since initial payment, and grace period status. Use before running daily cron.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Preview changes before running:
-- SELECT * FROM public.preview_active_status_changes()
-- WHERE status_change != 'No change';

-- Run the update manually:
-- SELECT * FROM public.update_all_active_statuses();

-- Check users in grace period:
-- SELECT
--   email,
--   initial_payment_date,
--   EXTRACT(DAY FROM NOW() - initial_payment_date)::INTEGER as days_since_payment,
--   is_active,
--   (SELECT status FROM public.subscriptions WHERE user_id = u.id LIMIT 1) as sub_status
-- FROM public.users u
-- WHERE initial_payment_completed = TRUE
--   AND initial_payment_date >= NOW() - INTERVAL '30 days'
--   AND network_position_id IS NOT NULL;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Daily subscription sync updated! Now handles 30-day grace period after $500 payment.' as message;
