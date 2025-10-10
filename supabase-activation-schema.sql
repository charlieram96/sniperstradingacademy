-- ============================================
-- ACTIVATION AND QUALIFICATION TRACKING SCHEMA
-- ============================================
-- Run this in Supabase SQL Editor to add activation tracking

-- Add new columns to users table for activation and qualification tracking
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS qualification_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS monthly_payment_due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS accumulated_residual DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS account_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS direct_referrals_count INTEGER DEFAULT 0;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_account_active ON public.users(account_active);
CREATE INDEX IF NOT EXISTS idx_users_qualification_deadline ON public.users(qualification_deadline);

-- Function to handle initial activation ($500 payment)
-- UPDATED: Removed 365-day qualification period requirement
CREATE OR REPLACE FUNCTION handle_account_activation(
    p_user_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE public.users
    SET
        activated_at = TIMEZONE('utc', NOW()),
        monthly_payment_due_date = TIMEZONE('utc', NOW()) + INTERVAL '30 days',
        account_active = TRUE,
        membership_status = 'unlocked',
        initial_payment_completed = TRUE,
        initial_payment_date = TIMEZONE('utc', NOW())
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check and update qualification status
-- UPDATED: Removed 365-day deadline logic - no more forfeiture
CREATE OR REPLACE FUNCTION check_qualification_status(
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_direct_referrals INTEGER;
    v_qualified BOOLEAN;
BEGIN
    -- Get current qualification status
    SELECT
        direct_referrals_count,
        qualified_at IS NOT NULL
    INTO
        v_direct_referrals,
        v_qualified
    FROM public.users
    WHERE id = p_user_id;

    -- If already qualified, return true
    IF v_qualified THEN
        RETURN TRUE;
    END IF;

    -- Check if user has 3 or more direct referrals
    IF v_direct_referrals >= 3 THEN
        UPDATE public.users
        SET qualified_at = TIMEZONE('utc', NOW())
        WHERE id = p_user_id;
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to accumulate residual income (called when not yet qualified)
CREATE OR REPLACE FUNCTION accumulate_residual(
    p_user_id UUID,
    p_amount DECIMAL(10,2)
) RETURNS VOID AS $$
DECLARE
    v_qualified BOOLEAN;
BEGIN
    -- Check if user is qualified
    SELECT qualified_at IS NOT NULL
    INTO v_qualified
    FROM public.users
    WHERE id = p_user_id;
    
    -- If not qualified, accumulate the residual
    IF NOT v_qualified THEN
        UPDATE public.users
        SET accumulated_residual = accumulated_residual + p_amount
        WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to handle monthly payment
CREATE OR REPLACE FUNCTION handle_monthly_payment(
    p_user_id UUID,
    p_payment_successful BOOLEAN
) RETURNS VOID AS $$
BEGIN
    IF p_payment_successful THEN
        UPDATE public.users
        SET 
            account_active = TRUE,
            last_payment_date = TIMEZONE('utc', NOW()),
            monthly_payment_due_date = TIMEZONE('utc', NOW()) + INTERVAL '30 days'
        WHERE id = p_user_id;
    ELSE
        UPDATE public.users
        SET account_active = FALSE
        WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update direct referrals count
CREATE OR REPLACE FUNCTION update_direct_referrals_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND OLD.status != 'active') THEN
        UPDATE public.users
        SET direct_referrals_count = (
            SELECT COUNT(*)
            FROM public.referrals
            WHERE referrer_id = NEW.referrer_id
            AND status = 'active'
        )
        WHERE id = NEW.referrer_id;
        
        -- Check if qualification status changed
        PERFORM check_qualification_status(NEW.referrer_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating direct referrals count
DROP TRIGGER IF EXISTS trigger_update_direct_referrals ON public.referrals;
CREATE TRIGGER trigger_update_direct_referrals
AFTER INSERT OR UPDATE ON public.referrals
FOR EACH ROW
EXECUTE FUNCTION update_direct_referrals_count();

-- View to get user qualification status
-- UPDATED: Removed deadline tracking - no more 365-day expiration
CREATE OR REPLACE VIEW public.user_qualification_status AS
SELECT
    u.id,
    u.name,
    u.email,
    u.activated_at,
    u.qualified_at,
    u.direct_referrals_count,
    u.accumulated_residual,
    u.account_active,
    u.monthly_payment_due_date,
    CASE
        WHEN u.qualified_at IS NOT NULL THEN 'qualified'
        WHEN u.activated_at IS NOT NULL THEN 'pending'
        ELSE 'not_activated'
    END as qualification_status,
    CASE
        WHEN u.monthly_payment_due_date IS NOT NULL THEN
            EXTRACT(EPOCH FROM (u.monthly_payment_due_date - TIMEZONE('utc', NOW())))::INTEGER
        ELSE NULL
    END as seconds_until_payment_due
FROM public.users u;

-- Grant permissions
GRANT ALL ON public.user_qualification_status TO authenticated;
GRANT EXECUTE ON FUNCTION handle_account_activation TO authenticated;
GRANT EXECUTE ON FUNCTION check_qualification_status TO authenticated;
GRANT EXECUTE ON FUNCTION accumulate_residual TO authenticated;
GRANT EXECUTE ON FUNCTION handle_monthly_payment TO authenticated;