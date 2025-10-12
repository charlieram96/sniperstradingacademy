-- ============================================
-- ADD initial_payment_date COLUMN
-- ============================================
-- Tracks when user paid their $500 initial payment
-- Used for 30-day grace period before requiring subscription
-- ============================================

-- Add column if it doesn't exist
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS initial_payment_date TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_initial_payment_date
ON public.users(initial_payment_date)
WHERE initial_payment_date IS NOT NULL;

-- Backfill for existing users
-- Set initial_payment_date = created_at for users who already paid initial
UPDATE public.users
SET initial_payment_date = created_at
WHERE initial_payment_completed = true
AND initial_payment_date IS NULL;

-- Add comment
COMMENT ON COLUMN public.users.initial_payment_date IS
    'Date when user paid $500 initial payment. Used to track 30-day grace period before requiring subscription.';

-- ============================================
-- VERIFICATION
-- ============================================

-- Check users with initial payment
SELECT
    email,
    initial_payment_completed,
    initial_payment_date,
    created_at,
    is_active
FROM public.users
WHERE initial_payment_completed = true
ORDER BY created_at;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'initial_payment_date column added successfully!' as message;
