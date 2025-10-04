-- ============================================
-- USER CREATION FIXES
-- ============================================
-- This migration fixes:
-- 1. Referral codes not being generated on user creation
-- 2. Backfills missing referral codes for existing users
-- ============================================

-- ============================================
-- FIX 1: Update handle_new_user trigger to properly generate referral codes
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_referral_code TEXT;
BEGIN
    -- Generate a unique referral code
    new_referral_code := UPPER(substring(md5(random()::text || NEW.id::text), 1, 8));

    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.users WHERE referral_code = new_referral_code) LOOP
        new_referral_code := UPPER(substring(md5(random()::text || NEW.id::text || random()::text), 1, 8));
    END LOOP;

    -- Insert user with generated referral code
    INSERT INTO public.users (id, email, name, referral_code)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'name',
        new_referral_code
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        referral_code = COALESCE(public.users.referral_code, EXCLUDED.referral_code);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIX 2: Backfill missing referral codes for existing users
-- ============================================
DO $$
DECLARE
    user_record RECORD;
    new_code TEXT;
BEGIN
    FOR user_record IN
        SELECT id FROM public.users WHERE referral_code IS NULL OR referral_code = ''
    LOOP
        -- Generate unique code for each user
        new_code := UPPER(substring(md5(random()::text || user_record.id::text), 1, 8));

        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM public.users WHERE referral_code = new_code) LOOP
            new_code := UPPER(substring(md5(random()::text || user_record.id::text || random()::text), 1, 8));
        END LOOP;

        -- Update user
        UPDATE public.users
        SET referral_code = new_code
        WHERE id = user_record.id;
    END LOOP;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if all users have referral codes
-- SELECT id, email, referral_code, network_position_id FROM public.users ORDER BY created_at DESC;

-- Count users without referral codes (should be 0)
-- SELECT COUNT(*) as users_without_codes FROM public.users WHERE referral_code IS NULL OR referral_code = '';

-- Count users without network positions
-- SELECT COUNT(*) as users_without_position FROM public.users WHERE network_position_id IS NULL;
