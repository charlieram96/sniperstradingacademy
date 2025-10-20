-- Add columns to commissions table for payout tracking
-- Run this in Supabase SQL Editor

ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add index for faster queries on pending payouts
CREATE INDEX IF NOT EXISTS idx_commissions_status_type
ON commissions(status, commission_type)
WHERE status = 'pending';

-- Add index for commission type filtering
CREATE INDEX IF NOT EXISTS idx_commissions_type
ON commissions(commission_type);

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'commissions'
AND column_name IN ('stripe_transfer_id', 'error_message', 'processed_at', 'retry_count');
