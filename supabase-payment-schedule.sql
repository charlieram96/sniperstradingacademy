-- ============================================
-- PAYMENT SCHEDULE SCHEMA
-- ============================================
-- Add support for weekly and monthly payment schedules
-- Run this in Supabase SQL Editor

-- Add payment_schedule column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS payment_schedule VARCHAR(10) DEFAULT 'monthly'
  CHECK (payment_schedule IN ('weekly', 'monthly'));

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_payment_schedule ON public.users(payment_schedule);

-- Update is_user_active() function to handle different payment schedules
CREATE OR REPLACE FUNCTION public.is_user_active(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_last_payment TIMESTAMP WITH TIME ZONE;
    v_schedule VARCHAR(10);
    v_threshold INTERVAL;
BEGIN
    SELECT last_payment_date, COALESCE(payment_schedule, 'monthly')
    INTO v_last_payment, v_schedule
    FROM public.users
    WHERE id = p_user_id;

    IF v_last_payment IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Weekly: 10 days grace (7 + 3), Monthly: 33 days grace (30 + 3)
    v_threshold := CASE
        WHEN v_schedule = 'weekly' THEN INTERVAL '10 days'
        ELSE INTERVAL '33 days'
    END;

    RETURN v_last_payment >= (TIMEZONE('utc', NOW()) - v_threshold);
END;
$$ LANGUAGE plpgsql;

-- Update is_user_disabled() function to handle different payment schedules
CREATE OR REPLACE FUNCTION public.is_user_disabled(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_last_payment TIMESTAMP WITH TIME ZONE;
    v_schedule VARCHAR(10);
    v_threshold INTERVAL;
BEGIN
    SELECT last_payment_date, COALESCE(payment_schedule, 'monthly')
    INTO v_last_payment, v_schedule
    FROM public.users
    WHERE id = p_user_id;

    IF v_last_payment IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Weekly: 90 days (roughly 13 weeks), Monthly: 90 days (3 months)
    v_threshold := INTERVAL '90 days';

    RETURN v_last_payment < (TIMEZONE('utc', NOW()) - v_threshold);
END;
$$ LANGUAGE plpgsql;

-- Update update_active_status() function to use the schedule-aware is_user_active()
CREATE OR REPLACE FUNCTION public.update_active_status(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users
    SET is_active = public.is_user_active(p_user_id)
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.is_user_active TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_disabled TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_active_status TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.users.payment_schedule IS
    'Payment schedule preference: weekly ($49.75/week) or monthly ($199/month). Affects active status grace periods.';

COMMENT ON FUNCTION public.is_user_active(UUID) IS
    'Checks if user is active based on payment schedule. Weekly: 10 days grace, Monthly: 33 days grace.';

COMMENT ON FUNCTION public.is_user_disabled(UUID) IS
    'Checks if user is disabled (90+ days without payment) regardless of schedule.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Check payment schedule distribution
-- SELECT payment_schedule, COUNT(*) FROM public.users GROUP BY payment_schedule;

-- Check active users by schedule
-- SELECT payment_schedule, COUNT(*)
-- FROM public.users
-- WHERE public.is_user_active(id)
-- GROUP BY payment_schedule;
