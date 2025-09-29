-- ============================================
-- UNIQUE URL SLUG SCHEMA UPDATE
-- ============================================
-- Run this in Supabase SQL Editor to add unique URL slugs for members

-- Add unique URL slug column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS url_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS custom_message TEXT,
ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_clicks INTEGER DEFAULT 0;

-- Create index for faster slug lookups
CREATE INDEX IF NOT EXISTS idx_users_url_slug ON public.users(url_slug);

-- Function to generate unique slug from user ID or name
CREATE OR REPLACE FUNCTION generate_unique_slug(
    p_user_id UUID,
    p_name TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_base_slug TEXT;
    v_slug TEXT;
    v_counter INTEGER := 0;
    v_exists BOOLEAN;
BEGIN
    -- Generate base slug from name or user ID
    IF p_name IS NOT NULL AND p_name != '' THEN
        -- Clean name: lowercase, replace spaces with hyphens, remove special chars
        v_base_slug := lower(regexp_replace(regexp_replace(p_name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
        -- Remove multiple hyphens
        v_base_slug := regexp_replace(v_base_slug, '-+', '-', 'g');
        -- Trim hyphens from ends
        v_base_slug := trim(both '-' from v_base_slug);
    ELSE
        -- Use first 8 characters of UUID
        v_base_slug := 'member-' || substring(p_user_id::TEXT, 1, 8);
    END IF;
    
    -- Ensure slug is not empty
    IF v_base_slug = '' OR v_base_slug IS NULL THEN
        v_base_slug := 'member-' || substring(p_user_id::TEXT, 1, 8);
    END IF;
    
    v_slug := v_base_slug;
    
    -- Check if slug exists and append number if needed
    LOOP
        SELECT EXISTS(
            SELECT 1 FROM public.users 
            WHERE url_slug = v_slug AND id != p_user_id
        ) INTO v_exists;
        
        EXIT WHEN NOT v_exists;
        
        v_counter := v_counter + 1;
        v_slug := v_base_slug || '-' || v_counter;
    END LOOP;
    
    RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to update user's URL slug
CREATE OR REPLACE FUNCTION update_user_slug(
    p_user_id UUID,
    p_desired_slug TEXT
) RETURNS TEXT AS $$
DECLARE
    v_clean_slug TEXT;
    v_exists BOOLEAN;
BEGIN
    -- Clean the desired slug
    v_clean_slug := lower(regexp_replace(regexp_replace(p_desired_slug, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
    v_clean_slug := regexp_replace(v_clean_slug, '-+', '-', 'g');
    v_clean_slug := trim(both '-' from v_clean_slug);
    
    -- Check minimum length
    IF length(v_clean_slug) < 3 THEN
        RAISE EXCEPTION 'Slug must be at least 3 characters long';
    END IF;
    
    -- Check if slug is available
    SELECT EXISTS(
        SELECT 1 FROM public.users 
        WHERE url_slug = v_clean_slug AND id != p_user_id
    ) INTO v_exists;
    
    IF v_exists THEN
        RAISE EXCEPTION 'This URL is already taken';
    END IF;
    
    -- Update the user's slug
    UPDATE public.users
    SET url_slug = v_clean_slug,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_user_id;
    
    RETURN v_clean_slug;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically generate slug for new users
CREATE OR REPLACE FUNCTION auto_generate_slug() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.url_slug IS NULL THEN
        NEW.url_slug := generate_unique_slug(NEW.id, NEW.name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new user registrations
DROP TRIGGER IF EXISTS trigger_auto_generate_slug ON public.users;
CREATE TRIGGER trigger_auto_generate_slug
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION auto_generate_slug();

-- Update existing users with slugs if they don't have one
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, name FROM public.users WHERE url_slug IS NULL
    LOOP
        UPDATE public.users 
        SET url_slug = generate_unique_slug(r.id, r.name)
        WHERE id = r.id;
    END LOOP;
END $$;

-- Table to track referral link visits
CREATE TABLE IF NOT EXISTS public.referral_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    visitor_ip TEXT,
    visitor_user_agent TEXT,
    referrer_url TEXT,
    visited_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    converted BOOLEAN DEFAULT FALSE,
    converted_user_id UUID REFERENCES public.users(id)
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_referral_visits_user_id ON public.referral_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_visits_visited_at ON public.referral_visits(visited_at);

-- Function to track referral visit
CREATE OR REPLACE FUNCTION track_referral_visit(
    p_user_id UUID,
    p_visitor_ip TEXT DEFAULT NULL,
    p_visitor_user_agent TEXT DEFAULT NULL,
    p_referrer_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_visit_id UUID;
BEGIN
    -- Insert visit record
    INSERT INTO public.referral_visits (
        user_id,
        visitor_ip,
        visitor_user_agent,
        referrer_url
    ) VALUES (
        p_user_id,
        p_visitor_ip,
        p_visitor_user_agent,
        p_referrer_url
    ) RETURNING id INTO v_visit_id;
    
    -- Increment profile views counter
    UPDATE public.users
    SET profile_views = profile_views + 1
    WHERE id = p_user_id;
    
    RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql;

-- View to get member's public profile data
CREATE OR REPLACE VIEW public.member_public_profile AS
SELECT 
    u.id,
    u.name,
    u.url_slug,
    u.custom_message,
    u.profile_views,
    u.referral_code,
    u.created_at,
    COUNT(DISTINCT r.referred_id) as total_referrals,
    COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.referred_id END) as active_referrals
FROM public.users u
LEFT JOIN public.referrals r ON r.referrer_id = u.id
GROUP BY u.id, u.name, u.url_slug, u.custom_message, u.profile_views, u.referral_code, u.created_at;

-- Grant permissions
GRANT SELECT ON public.member_public_profile TO anon;
GRANT ALL ON public.referral_visits TO authenticated;
GRANT EXECUTE ON FUNCTION track_referral_visit TO anon;
GRANT EXECUTE ON FUNCTION generate_unique_slug TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_slug TO authenticated;