-- =============================================
-- Payment Edge Cases & BIGINT Conversion
-- Migration: Handle underpay/overpay/late + BIGINT amounts
-- =============================================

-- =============================================
-- 1. CONVERT AMOUNTS TO BIGINT (smallest units)
-- USDC has 6 decimals, so 1 USDC = 1000000
-- =============================================

-- Add new BIGINT columns
ALTER TABLE deposit_addresses ADD COLUMN IF NOT EXISTS expected_amount_wei BIGINT;
ALTER TABLE deposit_addresses ADD COLUMN IF NOT EXISTS received_amount_wei BIGINT;

-- Migrate existing data (multiply by 1e6 to convert to smallest units)
UPDATE deposit_addresses SET
  expected_amount_wei = COALESCE((expected_amount * 1000000)::BIGINT, 0),
  received_amount_wei = COALESCE((received_amount * 1000000)::BIGINT, 0)
WHERE expected_amount_wei IS NULL;

-- Set NOT NULL constraints
ALTER TABLE deposit_addresses ALTER COLUMN expected_amount_wei SET NOT NULL;
ALTER TABLE deposit_addresses ALTER COLUMN expected_amount_wei SET DEFAULT 0;
ALTER TABLE deposit_addresses ALTER COLUMN received_amount_wei SET DEFAULT 0;

-- Drop old NUMERIC columns
ALTER TABLE deposit_addresses DROP COLUMN IF EXISTS expected_amount;
ALTER TABLE deposit_addresses DROP COLUMN IF EXISTS received_amount;

-- Rename new columns to original names
ALTER TABLE deposit_addresses RENAME COLUMN expected_amount_wei TO expected_amount;
ALTER TABLE deposit_addresses RENAME COLUMN received_amount_wei TO received_amount;

-- Add comments
COMMENT ON COLUMN deposit_addresses.expected_amount IS 'Expected payment amount in smallest units (1 USDC = 1000000)';
COMMENT ON COLUMN deposit_addresses.received_amount IS 'Received payment amount in smallest units (1 USDC = 1000000)';

-- =============================================
-- 2. ADD EDGE CASE FLAGS
-- =============================================

-- Underpayment tracking
ALTER TABLE deposit_addresses ADD COLUMN IF NOT EXISTS is_underpaid BOOLEAN DEFAULT false;
ALTER TABLE deposit_addresses ADD COLUMN IF NOT EXISTS shortfall_amount BIGINT DEFAULT 0;

COMMENT ON COLUMN deposit_addresses.is_underpaid IS 'True if partial payment received but below expected amount';
COMMENT ON COLUMN deposit_addresses.shortfall_amount IS 'Amount still needed in smallest units (expected - received)';

-- Overpayment tracking
ALTER TABLE deposit_addresses ADD COLUMN IF NOT EXISTS is_overpaid BOOLEAN DEFAULT false;
ALTER TABLE deposit_addresses ADD COLUMN IF NOT EXISTS overpayment_amount BIGINT DEFAULT 0;

COMMENT ON COLUMN deposit_addresses.is_overpaid IS 'True if payment exceeded expected amount';
COMMENT ON COLUMN deposit_addresses.overpayment_amount IS 'Amount overpaid in smallest units (received - expected)';

-- Late payment tracking
ALTER TABLE deposit_addresses ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false;

COMMENT ON COLUMN deposit_addresses.is_late IS 'True if payment arrived after expires_at';

-- Admin review flag
ALTER TABLE deposit_addresses ADD COLUMN IF NOT EXISTS requires_admin_review BOOLEAN DEFAULT false;

COMMENT ON COLUMN deposit_addresses.requires_admin_review IS 'True if admin must review (overpayment, refund needed, etc.)';

-- =============================================
-- 3. ADD BLOCK TRACKING FOR EVENT SCANNING
-- =============================================

-- Add last scanned block to treasury_settings
INSERT INTO treasury_settings (setting_key, setting_value)
VALUES ('last_scanned_block', '0')
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- 4. CREATE INDEXES FOR EDGE CASE QUERIES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_deposit_addresses_underpaid
ON deposit_addresses(is_underpaid) WHERE is_underpaid = true;

CREATE INDEX IF NOT EXISTS idx_deposit_addresses_overpaid
ON deposit_addresses(is_overpaid) WHERE is_overpaid = true;

CREATE INDEX IF NOT EXISTS idx_deposit_addresses_late
ON deposit_addresses(is_late) WHERE is_late = true;

CREATE INDEX IF NOT EXISTS idx_deposit_addresses_review
ON deposit_addresses(requires_admin_review) WHERE requires_admin_review = true;

-- =============================================
-- 5. HELPER FUNCTIONS
-- =============================================

-- Get addresses that need admin review
CREATE OR REPLACE FUNCTION get_addresses_needing_review()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  deposit_address TEXT,
  expected_amount BIGINT,
  received_amount BIGINT,
  overpayment_amount BIGINT,
  is_overpaid BOOLEAN,
  is_late BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    da.id,
    da.user_id,
    da.deposit_address,
    da.expected_amount,
    da.received_amount,
    da.overpayment_amount,
    da.is_overpaid,
    da.is_late,
    da.created_at
  FROM deposit_addresses da
  WHERE da.requires_admin_review = true
  ORDER BY da.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_addresses_needing_review IS 'Returns deposit addresses that require admin review (overpayments, etc.)';

-- Get expired addresses that might have late payments
CREATE OR REPLACE FUNCTION get_expired_addresses_for_late_check()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  payment_intent_id UUID,
  deposit_address TEXT,
  expected_amount BIGINT,
  received_amount BIGINT,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    da.id,
    da.user_id,
    da.payment_intent_id,
    da.deposit_address,
    da.expected_amount,
    da.received_amount,
    da.expires_at
  FROM deposit_addresses da
  WHERE da.status = 'expired'
  AND da.is_late = false
  AND da.received_amount < da.expected_amount
  ORDER BY da.expires_at DESC
  LIMIT 50;  -- Limit to avoid scanning too many
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_expired_addresses_for_late_check IS 'Returns recently expired addresses to check for late payments';

-- Update last scanned block
CREATE OR REPLACE FUNCTION update_last_scanned_block(p_block_number BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE treasury_settings
  SET setting_value = p_block_number::TEXT,
      updated_at = NOW()
  WHERE setting_key = 'last_scanned_block';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_last_scanned_block IS 'Updates the last scanned block number for event scanning';

-- Get last scanned block
CREATE OR REPLACE FUNCTION get_last_scanned_block()
RETURNS BIGINT AS $$
DECLARE
  v_block BIGINT;
BEGIN
  SELECT setting_value::BIGINT INTO v_block
  FROM treasury_settings
  WHERE setting_key = 'last_scanned_block';

  RETURN COALESCE(v_block, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_last_scanned_block IS 'Returns the last scanned block number for event scanning';

-- =============================================
-- 6. UPDATE PAYMENT_INTENTS FOR BIGINT TOO
-- =============================================

-- Add BIGINT column for amount
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS amount_wei BIGINT;

-- Migrate existing data
UPDATE payment_intents SET
  amount_wei = COALESCE((amount_usdc::NUMERIC * 1000000)::BIGINT, 0)
WHERE amount_wei IS NULL;

-- Note: Keep amount_usdc for backwards compatibility, but use amount_wei for new logic

COMMENT ON COLUMN payment_intents.amount_wei IS 'Payment amount in smallest units (1 USDC = 1000000)';

-- =============================================
-- 7. SUMMARY LOG
-- =============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration complete: Payment Edge Cases';
  RAISE NOTICE '- Converted expected_amount and received_amount to BIGINT';
  RAISE NOTICE '- Added is_underpaid, shortfall_amount columns';
  RAISE NOTICE '- Added is_overpaid, overpayment_amount columns';
  RAISE NOTICE '- Added is_late column';
  RAISE NOTICE '- Added requires_admin_review column';
  RAISE NOTICE '- Added last_scanned_block to treasury_settings';
  RAISE NOTICE '- Created helper functions for edge case queries';
END $$;
