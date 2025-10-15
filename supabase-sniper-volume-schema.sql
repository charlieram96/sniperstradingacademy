-- ============================================
-- SNIPER VOLUME SCHEMA UPDATES
-- ============================================
-- This adds real-time sniper volume tracking to support:
-- - Unlimited network depth
-- - Real-time volume increments on payment
-- - Monthly archiving for payouts
-- - Active/inactive user tracking
-- ============================================

-- Add sniper volume and network count columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS sniper_volume_current_month DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sniper_volume_previous_month DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_network_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_network_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_structure_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_commission_rate DECIMAL(5,4) DEFAULT 0.10;

-- Update is_active to be calculated based on last_payment_date
-- Active = paid within last 33 days (30 + 3 day grace period)
-- IMPORTANT: Users start INACTIVE (FALSE) and become active only after $500 payment
ALTER TABLE public.users
ALTER COLUMN is_active SET DEFAULT FALSE;

-- Create monthly sniper volume history table for archiving
CREATE TABLE IF NOT EXISTS public.sniper_volume_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    month_period TEXT NOT NULL, -- Format: 'YYYY-MM'
    sniper_volume DECIMAL(10,2) NOT NULL,
    active_network_count INTEGER NOT NULL,
    total_network_count INTEGER NOT NULL,
    commission_rate DECIMAL(5,4) NOT NULL,
    structure_number INTEGER NOT NULL,
    gross_earnings DECIMAL(10,2) NOT NULL,
    capped_earnings DECIMAL(10,2) NOT NULL, -- Capped at 6552 × $199
    can_withdraw BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Sniper volume history indexes
CREATE INDEX IF NOT EXISTS idx_sniper_history_user_period
    ON public.sniper_volume_history(user_id, month_period);
CREATE INDEX IF NOT EXISTS idx_sniper_history_period
    ON public.sniper_volume_history(month_period);
CREATE INDEX IF NOT EXISTS idx_sniper_history_user_created
    ON public.sniper_volume_history(user_id, created_at DESC);

-- Users table indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_active_network
    ON public.users(active_network_count) WHERE network_position_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_sniper_volume
    ON public.users(sniper_volume_current_month) WHERE sniper_volume_current_month > 0;
CREATE INDEX IF NOT EXISTS idx_users_last_payment
    ON public.users(last_payment_date) WHERE last_payment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_commission_rate
    ON public.users(current_commission_rate);

-- Composite index for active user queries
CREATE INDEX IF NOT EXISTS idx_users_active_payment
    ON public.users(is_active, last_payment_date) WHERE network_position_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on sniper_volume_history
ALTER TABLE public.sniper_volume_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sniper volume history
CREATE POLICY "Users can view own sniper volume history"
    ON public.sniper_volume_history
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can insert/update (for cron jobs)
CREATE POLICY "Service role can manage sniper volume history"
    ON public.sniper_volume_history
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN public.users.sniper_volume_current_month IS
    'Real-time accumulated sniper volume for current month. Incremented when downline members pay. Reset to $0 on 1st of each month.';

COMMENT ON COLUMN public.users.sniper_volume_previous_month IS
    'Previous month sniper volume. Used for calculating payouts on ~7th of month. Archived before reset.';

COMMENT ON COLUMN public.users.active_network_count IS
    'Count of active members (paid within 33 days) in entire network (unlimited depth). Updated real-time.';

COMMENT ON COLUMN public.users.total_network_count IS
    'Total count of all members in network, regardless of payment status. Includes inactive/disabled.';

COMMENT ON COLUMN public.users.current_structure_number IS
    'Current structure number (1-7+) based on active_network_count. Structure N = floor(active_count / 1092) + 1';

COMMENT ON COLUMN public.users.current_commission_rate IS
    'Current commission rate (0.10 to 0.16) based on structure completion. Auto-updated when structure changes.';

COMMENT ON TABLE public.sniper_volume_history IS
    'Monthly archive of sniper volume and earnings. Created on 1st of month for previous month. Used for payout calculations on ~7th.';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Sniper volume schema updates complete! Users table updated with real-time tracking columns.' as message;
