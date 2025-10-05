-- ============================================
-- REFERRAL SYSTEM FIXES
-- ============================================
-- This migration fixes:
-- 1. Blank referral codes for existing users
-- 2. Missing INSERT policies on referrals table
-- 3. Missing INSERT policy on users table

-- ============================================
-- FIX 1: Update handle_new_user trigger to generate referral codes on conflict
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name')
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        referral_code = COALESCE(public.users.referral_code, substring(md5(random()::text || public.users.id::text), 1, 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIX 2: Add INSERT policies for referrals table
-- ============================================

-- Allow users to create referrals where they are the referred user (during signup)
CREATE POLICY "Users can create referral when signing up" ON public.referrals
    FOR INSERT
    WITH CHECK (auth.uid() = referred_id);

-- ============================================
-- FIX 3: Add INSERT policy for users table
-- ============================================

-- Allow user insertion during signup (for OAuth flow)
CREATE POLICY "Allow user insertion during signup" ON public.users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================
-- FIX 4: Update existing users with missing referral codes
-- ============================================

-- Generate referral codes for any users that don't have one
UPDATE public.users
SET referral_code = substring(md5(random()::text || id::text), 1, 8)
WHERE referral_code IS NULL;

-- ============================================
-- FIX 5: Add policy for anonymous users to validate referral codes
-- ============================================

-- Allow anyone to read user data for referral validation (limited fields returned by API)
CREATE POLICY "Anyone can validate referral codes" ON public.users
    FOR SELECT
    USING (true);

-- ============================================
-- FIX 6: Update get_tree_children function
-- ============================================
-- This replaces the existing get_tree_children_positions
-- with the correct structure needed by the API
-- ============================================

DROP FUNCTION IF EXISTS public.get_tree_children_positions(UUID);
DROP FUNCTION IF EXISTS public.get_tree_children(UUID);

CREATE OR REPLACE FUNCTION public.get_tree_children(p_user_id UUID)
RETURNS TABLE(
    child_id UUID,
    child_name TEXT,
    child_email TEXT,
    child_position_id TEXT,
    child_slot_number INTEGER,
    is_filled BOOLEAN,
    is_direct_referral BOOLEAN
) AS $$
DECLARE
    user_position_id TEXT;
    user_level INTEGER;
    user_position BIGINT;
    child_positions BIGINT[];
    child_pos BIGINT;
    slot_num INTEGER := 1;
    child_pos_id TEXT;
    child_user RECORD;
BEGIN
    -- Get user's position
    SELECT network_position_id, network_level, network_position
    INTO user_position_id, user_level, user_position
    FROM public.users
    WHERE id = p_user_id;

    IF user_position_id IS NULL THEN
        RETURN;
    END IF;

    -- Calculate the 3 child positions
    child_positions := public.calculate_child_positions(user_position);

    -- For each of the 3 child positions
    FOREACH child_pos IN ARRAY child_positions LOOP
        child_pos_id := public.format_network_position_id(user_level + 1, child_pos);

        -- Check if position is filled
        SELECT
            u.id,
            u.name,
            u.email,
            u.network_position_id,
            (u.referred_by = p_user_id) as is_direct_ref
        INTO child_user
        FROM public.users u
        WHERE u.network_position_id = child_pos_id;

        IF FOUND THEN
            -- Position is filled
            RETURN QUERY SELECT
                child_user.id,
                child_user.name,
                child_user.email,
                child_pos_id,
                slot_num,
                TRUE,
                child_user.is_direct_ref;
        ELSE
            -- Position is empty
            RETURN QUERY SELECT
                NULL::UUID,
                'Empty Slot'::TEXT,
                NULL::TEXT,
                child_pos_id,
                slot_num,
                FALSE,
                FALSE;
        END IF;

        slot_num := slot_num + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTION: Check if tree is full
-- ============================================
CREATE OR REPLACE FUNCTION public.is_tree_full(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    filled_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO filled_count
    FROM public.get_tree_children(p_user_id)
    WHERE is_filled = TRUE;

    RETURN filled_count = 3;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION QUERIES (run these to check if fixes worked)
-- ============================================

-- Check if all users have referral codes
-- SELECT id, email, referral_code FROM public.users WHERE referral_code IS NULL;

-- Check referral policies
-- SELECT * FROM pg_policies WHERE tablename = 'referrals';

-- Check users policies
-- SELECT * FROM pg_policies WHERE tablename = 'users';

-- Test tree children function
-- SELECT * FROM public.get_tree_children('your-user-id');
