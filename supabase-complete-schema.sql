-- ============================================
-- COMPLETE SCHEMA FOR SNIPERS TRADING ACADEMY
-- ============================================
-- Run this entire file in Supabase SQL Editor
-- This creates all tables, functions, and triggers needed for the MLM system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PART 1: BASE TABLES
-- ============================================

-- Drop existing objects for clean installation (comment these out if updating)
DROP VIEW IF EXISTS public.team_hierarchy CASCADE;
DROP VIEW IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.team_pools CASCADE;
DROP TABLE IF EXISTS public.member_slots CASCADE;
DROP TABLE IF EXISTS public.commissions CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    stripe_customer_id TEXT UNIQUE,
    stripe_connect_account_id TEXT,
    referred_by UUID REFERENCES public.users(id),
    referral_code TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 8),
    -- MLM specific columns
    membership_status TEXT DEFAULT 'locked' CHECK (membership_status IN ('locked', 'unlocked')),
    initial_payment_completed BOOLEAN DEFAULT FALSE,
    initial_payment_date TIMESTAMP WITH TIME ZONE,
    direct_referral_slots INTEGER DEFAULT 0 CHECK (direct_referral_slots >= 0 AND direct_referral_slots <= 3),
    total_team_pool DECIMAL(10,2) DEFAULT 0,
    monthly_commission DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Subscriptions table
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    stripe_price_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid')),
    monthly_amount DECIMAL(10,2) DEFAULT 200.00,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Referrals table (for tracking direct referrals)
CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    commission_rate DECIMAL(5,2) DEFAULT 10.00,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
    level INTEGER DEFAULT 1 CHECK (level >= 1 AND level <= 6),
    initial_payment_status TEXT DEFAULT 'pending' CHECK (initial_payment_status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(referrer_id, referred_id)
);

-- Payments table
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    stripe_payment_intent_id TEXT UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL,
    payment_type TEXT DEFAULT 'monthly' CHECK (payment_type IN ('initial', 'monthly', 'commission')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Commissions table
CREATE TABLE public.commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- PART 2: MLM SPECIFIC TABLES
-- ============================================

-- Member slots table (tracks 3 available slots per user)
CREATE TABLE public.member_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    slot_number INTEGER NOT NULL CHECK (slot_number IN (1, 2, 3)),
    filled_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    filled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, slot_number),
    UNIQUE(filled_by_user_id)
);

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

-- ============================================
-- PART 3: VIEWS
-- ============================================

-- Hierarchical team view (6 levels deep, 3 wide)
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
    AND NOT r.referred_id = ANY(tt.path)
    AND tt.level < 6
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

-- Legacy view for backward compatibility
CREATE OR REPLACE VIEW public.group_members AS
SELECT 
    team_owner_id as group_owner_id,
    member_id,
    level,
    path
FROM public.team_hierarchy;

-- ============================================
-- PART 4: FUNCTIONS
-- ============================================

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
    SELECT 
        COUNT(*) * 200.00,
        COUNT(*)
    INTO pool_amount, member_count
    FROM public.team_hierarchy
    WHERE team_owner_id = user_id
    AND subscription_status = 'active';
    
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

-- Function to assign referral to slot
CREATE OR REPLACE FUNCTION public.assign_referral_to_slot(
    p_referrer_id UUID,
    p_referred_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    assigned_slot INTEGER;
BEGIN
    SELECT slot_number
    INTO assigned_slot
    FROM public.member_slots
    WHERE user_id = p_referrer_id
    AND filled_by_user_id IS NULL
    ORDER BY slot_number
    LIMIT 1;
    
    IF assigned_slot IS NOT NULL THEN
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

-- Function to distribute monthly commissions
CREATE OR REPLACE FUNCTION public.distribute_monthly_commissions()
RETURNS VOID AS $$
DECLARE
    user_record RECORD;
    pool_result RECORD;
BEGIN
    FOR user_record IN 
        SELECT id FROM public.users 
        WHERE membership_status = 'unlocked'
    LOOP
        SELECT * INTO pool_result
        FROM public.calculate_team_pool(user_record.id);
        
        UPDATE public.users
        SET 
            total_team_pool = pool_result.total_pool,
            monthly_commission = pool_result.commission
        WHERE id = user_record.id;
        
        IF pool_result.commission > 0 THEN
            INSERT INTO public.commissions (
                referrer_id,
                referred_id,
                amount,
                status
            ) VALUES (
                user_record.id,
                user_record.id,
                pool_result.commission,
                'pending'
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 5: TRIGGERS
-- ============================================

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Triggers for updating timestamps
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- Trigger to enforce 3-referral limit
CREATE OR REPLACE FUNCTION public.enforce_referral_limit()
RETURNS TRIGGER AS $$
DECLARE
    referral_count INTEGER;
BEGIN
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

-- ============================================
-- PART 6: INDEXES
-- ============================================

CREATE INDEX idx_users_referred_by ON public.users(referred_by);
CREATE INDEX idx_users_stripe_customer_id ON public.users(stripe_customer_id);
CREATE INDEX idx_users_membership_status ON public.users(membership_status);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referred_id ON public.referrals(referred_id);
CREATE INDEX idx_referrals_level ON public.referrals(level);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_commissions_referrer_id ON public.commissions(referrer_id);
CREATE INDEX idx_member_slots_user_id ON public.member_slots(user_id);
CREATE INDEX idx_member_slots_filled_by ON public.member_slots(filled_by_user_id);
CREATE INDEX idx_team_pools_owner_id ON public.team_pools(owner_id);
CREATE INDEX idx_team_pools_member_id ON public.team_pools(member_id);

-- ============================================
-- PART 7: ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_pools ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can read their team members" ON public.users
    FOR SELECT USING (
        id IN (
            SELECT member_id FROM public.team_hierarchy 
            WHERE team_owner_id = auth.uid()
        )
    );

-- Subscriptions policies
CREATE POLICY "Users can read own subscriptions" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Referrals policies
CREATE POLICY "Users can read own referrals" ON public.referrals
    FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "Users can read where they are referred" ON public.referrals
    FOR SELECT USING (auth.uid() = referred_id);

-- Payments policies
CREATE POLICY "Users can read own payments" ON public.payments
    FOR SELECT USING (auth.uid() = user_id);

-- Commissions policies
CREATE POLICY "Users can read own commissions" ON public.commissions
    FOR SELECT USING (auth.uid() = referrer_id);

-- Member slots policies
CREATE POLICY "Users can view their own slots" ON public.member_slots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view slots they fill" ON public.member_slots
    FOR SELECT USING (auth.uid() = filled_by_user_id);

-- Team pools policies
CREATE POLICY "Users can view their team pools" ON public.team_pools
    FOR SELECT USING (auth.uid() = owner_id);

-- ============================================
-- PART 8: INITIAL DATA (Optional)
-- ============================================

-- You can add test data here if needed
-- INSERT INTO public.users (id, email, name) VALUES ...

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- If you see this query complete successfully, your database is ready!
SELECT 'Database setup complete! MLM system ready for Snipers Trading Academy.' as message;