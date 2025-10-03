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
-- VERIFICATION QUERIES (run these to check if fixes worked)
-- ============================================

-- Check if all users have referral codes
-- SELECT id, email, referral_code FROM public.users WHERE referral_code IS NULL;

-- Check referral policies
-- SELECT * FROM pg_policies WHERE tablename = 'referrals';

-- Check users policies
-- SELECT * FROM pg_policies WHERE tablename = 'users';
