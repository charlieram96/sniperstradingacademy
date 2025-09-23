-- MLM System Schema Updates for Snipers Trading Academy
-- 3-wide, 6-level deep structure with $500 initial, $200 monthly

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing views and tables if needed (for clean migration)
DROP VIEW IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.member_slots CASCADE;
DROP TABLE IF EXISTS public.team_pools CASCADE;

-- Users table (extends Supabase auth.users)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS membership_status TEXT DEFAULT 'locked' CHECK (membership_status IN ('locked', 'unlocked')),
ADD COLUMN IF NOT EXISTS initial_payment_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS direct_referral_slots INTEGER DEFAULT 0 CHECK (direct_referral_slots >= 0 AND direct_referral_slots <= 3),
ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
ADD COLUMN IF NOT EXISTS initial_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_team_pool DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_commission DECIMAL(10,2) DEFAULT 0;

-- Member slots table (tracks 3 available slots per user)
CREATE TABLE public.member_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    slot_number INTEGER NOT NULL CHECK (slot_number IN (1, 2, 3)),
    filled_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    filled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, slot_number),
    UNIQUE(filled_by_user_id) -- Each user can only fill one slot
);

-- Update referrals table with level tracking
ALTER TABLE public.referrals 
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1 CHECK (level >= 1 AND level <= 6),
ADD COLUMN IF NOT EXISTS initial_payment_status TEXT DEFAULT 'pending' CHECK (initial_payment_status IN ('pending', 'completed', 'failed'));

-- Team pools table for tracking monthly contributions
CREATE TABLE public.team_pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 6),
    monthly_contribution DECIMAL(10,2) DEFAULT 200.00,
    is_active BOOLEAN DEFAULT FALSE,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(owner_id, member_id)
);

-- Update payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'monthly' CHECK (payment_type IN ('initial', 'monthly', 'commission'));

-- Update subscriptions table for $200 monthly
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS monthly_amount DECIMAL(10,2) DEFAULT 200.00;

-- Create hierarchical team view (6 levels deep, 3 wide)
CREATE OR REPLACE VIEW public.team_hierarchy AS
WITH RECURSIVE team_tree AS (
    -- Level 1: Direct referrals (max 3)
    SELECT 
        r.referrer_id as team_owner_id,
        r.referred_id as member_id,
        u.membership_status,
        s.status as subscription_status,
        1 as level,
        ARRAY[r.referrer_id] as path,
        r.created_at
    FROM public.referrals r
    JOIN public.users u ON u.id = r.referred_id
    LEFT JOIN public.subscriptions s ON s.user_id = r.referred_id AND s.status = 'active'
    WHERE r.status = 'active' 
    AND r.initial_payment_status = 'completed'
    
    UNION ALL
    
    -- Levels 2-6: Referrals of referrals
    SELECT 
        tt.team_owner_id,
        r.referred_id as member_id,
        u.membership_status,
        s.status as subscription_status,
        tt.level + 1 as level,
        tt.path || r.referrer_id as path,
        r.created_at
    FROM team_tree tt
    JOIN public.referrals r ON r.referrer_id = tt.member_id
    JOIN public.users u ON u.id = r.referred_id
    LEFT JOIN public.subscriptions s ON s.user_id = r.referred_id AND s.status = 'active'
    WHERE r.status = 'active'
    AND r.initial_payment_status = 'completed'
    AND NOT r.referred_id = ANY(tt.path) -- Prevent cycles
    AND tt.level < 6 -- Max 6 levels deep
)
SELECT 
    team_owner_id,
    member_id,
    membership_status,
    subscription_status,
    level,
    path,
    created_at
FROM team_tree;

-- Function to calculate team pool for a user
CREATE OR REPLACE FUNCTION public.calculate_team_pool(user_id UUID)
RETURNS TABLE(
    total_pool DECIMAL(10,2),
    active_members INTEGER,
    commission DECIMAL(10,2)
) AS $$
DECLARE
    pool_amount DECIMAL(10,2);
    member_count INTEGER;
BEGIN
    -- Count active members with paid subscriptions
    SELECT 
        COUNT(*) * 200.00,
        COUNT(*)
    INTO pool_amount, member_count
    FROM public.team_hierarchy
    WHERE team_owner_id = user_id
    AND subscription_status = 'active';
    
    -- Return pool, count, and 10% commission
    RETURN QUERY SELECT 
        COALESCE(pool_amount, 0.00),
        COALESCE(member_count, 0),
        COALESCE(pool_amount * 0.10, 0.00);
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can add more referrals
CREATE OR REPLACE FUNCTION public.can_add_referral(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_referrals INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO current_referrals
    FROM public.member_slots
    WHERE user_id = $1
    AND filled_by_user_id IS NOT NULL;
    
    RETURN current_referrals < 3;
END;
$$ LANGUAGE plpgsql;

-- Function to handle initial payment completion
CREATE OR REPLACE FUNCTION public.complete_initial_payment(
    p_user_id UUID,
    p_payment_intent_id TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Update user status
    UPDATE public.users
    SET 
        membership_status = 'unlocked',
        initial_payment_completed = TRUE,
        initial_payment_date = TIMEZONE('utc', NOW()),
        direct_referral_slots = 3
    WHERE id = p_user_id;
    
    -- Create 3 member slots
    INSERT INTO public.member_slots (user_id, slot_number)
    VALUES 
        (p_user_id, 1),
        (p_user_id, 2),
        (p_user_id, 3)
    ON CONFLICT DO NOTHING;
    
    -- Update referral status if user was referred
    UPDATE public.referrals
    SET initial_payment_status = 'completed'
    WHERE referred_id = p_user_id;
    
    -- Record payment
    INSERT INTO public.payments (
        user_id,
        stripe_payment_intent_id,
        amount,
        payment_type,
        status
    ) VALUES (
        p_user_id,
        p_payment_intent_id,
        500.00,
        'initial',
        'succeeded'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to process monthly commission distribution
CREATE OR REPLACE FUNCTION public.distribute_monthly_commissions()
RETURNS VOID AS $$
DECLARE
    user_record RECORD;
    pool_result RECORD;
BEGIN
    -- For each active user with unlocked membership
    FOR user_record IN 
        SELECT id FROM public.users 
        WHERE membership_status = 'unlocked'
    LOOP
        -- Calculate their team pool
        SELECT * INTO pool_result
        FROM public.calculate_team_pool(user_record.id);
        
        -- Update their monthly commission
        UPDATE public.users
        SET 
            total_team_pool = pool_result.total_pool,
            monthly_commission = pool_result.commission
        WHERE id = user_record.id;
        
        -- Create commission record if there's a commission to pay
        IF pool_result.commission > 0 THEN
            INSERT INTO public.commissions (
                referrer_id,
                referred_id,
                amount,
                status
            ) VALUES (
                user_record.id,
                user_record.id, -- Self-reference for pool commission
                pool_result.commission,
                'pending'
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_member_slots_user_id ON public.member_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_member_slots_filled_by ON public.member_slots(filled_by_user_id);
CREATE INDEX IF NOT EXISTS idx_team_pools_owner_id ON public.team_pools(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_pools_member_id ON public.team_pools(member_id);
CREATE INDEX IF NOT EXISTS idx_users_membership_status ON public.users(membership_status);
CREATE INDEX IF NOT EXISTS idx_referrals_level ON public.referrals(level);

-- Row Level Security for new tables
ALTER TABLE public.member_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_pools ENABLE ROW LEVEL SECURITY;

-- RLS Policies for member_slots
CREATE POLICY "Users can view their own slots" ON public.member_slots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view slots they fill" ON public.member_slots
    FOR SELECT USING (auth.uid() = filled_by_user_id);

-- RLS Policies for team_pools
CREATE POLICY "Users can view their team pools" ON public.team_pools
    FOR SELECT USING (auth.uid() = owner_id);

-- Trigger to enforce 3-referral limit
CREATE OR REPLACE FUNCTION public.enforce_referral_limit()
RETURNS TRIGGER AS $$
DECLARE
    referral_count INTEGER;
BEGIN
    -- Count existing active referrals
    SELECT COUNT(*)
    INTO referral_count
    FROM public.referrals
    WHERE referrer_id = NEW.referrer_id
    AND status = 'active';
    
    IF referral_count >= 3 THEN
        RAISE EXCEPTION 'User has reached maximum of 3 direct referrals';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_referral_limit
    BEFORE INSERT ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_referral_limit();

-- Function to assign referral to slot
CREATE OR REPLACE FUNCTION public.assign_referral_to_slot(
    p_referrer_id UUID,
    p_referred_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    assigned_slot INTEGER;
BEGIN
    -- Find first available slot
    SELECT slot_number
    INTO assigned_slot
    FROM public.member_slots
    WHERE user_id = p_referrer_id
    AND filled_by_user_id IS NULL
    ORDER BY slot_number
    LIMIT 1;
    
    IF assigned_slot IS NOT NULL THEN
        -- Fill the slot
        UPDATE public.member_slots
        SET 
            filled_by_user_id = p_referred_id,
            filled_at = TIMEZONE('utc', NOW())
        WHERE user_id = p_referrer_id
        AND slot_number = assigned_slot;
    END IF;
    
    RETURN assigned_slot;
END;
$$ LANGUAGE plpgsql;