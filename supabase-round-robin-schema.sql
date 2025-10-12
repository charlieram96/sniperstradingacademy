-- ============================================
-- ROUND-ROBIN REFERRAL DISTRIBUTION
-- ============================================
-- Adds column to track which branch received the last referral
-- Ensures even distribution across 3 child branches
-- ============================================

-- Add last_referral_branch column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_referral_branch INTEGER DEFAULT 1
CHECK (last_referral_branch IN (1, 2, 3));

-- Create index for queries
CREATE INDEX IF NOT EXISTS idx_users_last_referral_branch
ON public.users(last_referral_branch)
WHERE network_position_id IS NOT NULL;

-- Backfill existing users with default value 1
UPDATE public.users
SET last_referral_branch = 1
WHERE last_referral_branch IS NULL
AND network_position_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.users.last_referral_branch IS
    'Tracks which child branch (1, 2, or 3) received the last referral. Used for round-robin distribution to ensure even spreading across all 3 branches.';

-- ============================================
-- VERIFICATION
-- ============================================

-- Check column was added
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name = 'last_referral_branch';

-- Check all users have valid values
SELECT
    email,
    network_position_id,
    last_referral_branch
FROM public.users
WHERE network_position_id IS NOT NULL
ORDER BY network_level, network_position
LIMIT 20;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'last_referral_branch column added successfully! Ready for round-robin distribution.' as message;
