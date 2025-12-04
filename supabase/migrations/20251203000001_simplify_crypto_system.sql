-- =============================================
-- Simplify Crypto Payment System
-- Migration: Treasury-based deposit addresses & user payout wallets
-- =============================================

-- =============================================
-- 1. CREATE TREASURY SETTINGS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS treasury_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE treasury_settings ENABLE ROW LEVEL SECURITY;

-- Only superadmins can view/manage treasury settings
CREATE POLICY "Superadmins can manage treasury settings"
ON treasury_settings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'superadmin'
  )
);

COMMENT ON TABLE treasury_settings IS 'Admin-configurable treasury wallet settings for the simplified crypto system';

-- Insert initial settings with placeholder values
INSERT INTO treasury_settings (setting_key, setting_value) VALUES
  ('treasury_wallet_address', ''),
  ('master_wallet_xpub', ''),
  ('current_derivation_index', '0')
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- 2. CREATE DEPOSIT ADDRESSES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
  deposit_address TEXT UNIQUE NOT NULL,
  derivation_index INTEGER UNIQUE NOT NULL,
  derivation_path TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('initial_unlock', 'monthly_subscription', 'weekly_subscription')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
  expected_amount NUMERIC(20,6) NOT NULL,
  received_amount NUMERIC(20,6) DEFAULT 0,
  received_tx_hash TEXT,
  received_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deposit_addresses_user_id ON deposit_addresses(user_id);
CREATE INDEX idx_deposit_addresses_status ON deposit_addresses(status);
CREATE INDEX idx_deposit_addresses_address ON deposit_addresses(deposit_address);
CREATE INDEX idx_deposit_addresses_expires ON deposit_addresses(expires_at) WHERE status = 'active';
CREATE INDEX idx_deposit_addresses_intent ON deposit_addresses(payment_intent_id) WHERE payment_intent_id IS NOT NULL;

-- Enable RLS
ALTER TABLE deposit_addresses ENABLE ROW LEVEL SECURITY;

-- Users can view their own deposit addresses
CREATE POLICY "Users can view own deposit addresses"
ON deposit_addresses FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all deposit addresses
CREATE POLICY "Admins can view all deposit addresses"
ON deposit_addresses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_deposit_addresses_updated_at
BEFORE UPDATE ON deposit_addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE deposit_addresses IS 'Unique deposit addresses derived from treasury HD wallet for payment tracking';

-- =============================================
-- 3. MODIFY USERS TABLE - ADD PAYOUT WALLET
-- =============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_wallet_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_wallet_set_at TIMESTAMPTZ;

CREATE INDEX idx_users_payout_wallet ON users(payout_wallet_address) WHERE payout_wallet_address IS NOT NULL;

COMMENT ON COLUMN users.payout_wallet_address IS 'User-provided Polygon wallet address for receiving commissions and bonuses';
COMMENT ON COLUMN users.payout_wallet_set_at IS 'Timestamp when user set their payout wallet address';

-- =============================================
-- 4. MODIFY PAYMENT_INTENTS TABLE
-- =============================================

-- Add deposit_address_id reference
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS deposit_address_id UUID REFERENCES deposit_addresses(id) ON DELETE SET NULL;

CREATE INDEX idx_payment_intents_deposit_address ON payment_intents(deposit_address_id) WHERE deposit_address_id IS NOT NULL;

-- Drop on_ramp_session_id column (TransFi removed)
ALTER TABLE payment_intents DROP COLUMN IF EXISTS on_ramp_session_id;

COMMENT ON COLUMN payment_intents.deposit_address_id IS 'Reference to the unique deposit address for this payment';

-- =============================================
-- 5. MARK CRYPTO_WALLETS AS LEGACY
-- =============================================

ALTER TABLE crypto_wallets ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT false;

-- Mark all existing wallets as legacy
UPDATE crypto_wallets SET is_legacy = true WHERE is_legacy IS NULL OR is_legacy = false;

COMMENT ON COLUMN crypto_wallets.is_legacy IS 'Marks wallets from the old per-user custodial system (deprecated)';

-- =============================================
-- 6. DROP ON_RAMP_SESSIONS TABLE (TransFi removed)
-- =============================================

-- First drop the trigger
DROP TRIGGER IF EXISTS update_on_ramp_sessions_updated_at ON on_ramp_sessions;

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view own on-ramp sessions" ON on_ramp_sessions;

-- Drop the table
DROP TABLE IF EXISTS on_ramp_sessions;

-- =============================================
-- 7. HELPER FUNCTIONS
-- =============================================

-- Function to get and increment derivation index atomically
CREATE OR REPLACE FUNCTION get_next_derivation_index()
RETURNS INTEGER AS $$
DECLARE
  v_current_index INTEGER;
  v_next_index INTEGER;
BEGIN
  -- Get current index and lock the row
  SELECT setting_value::INTEGER INTO v_current_index
  FROM treasury_settings
  WHERE setting_key = 'current_derivation_index'
  FOR UPDATE;

  -- Calculate next index
  v_next_index := COALESCE(v_current_index, 0) + 1;

  -- Update to next index
  UPDATE treasury_settings
  SET setting_value = v_next_index::TEXT,
      updated_at = NOW()
  WHERE setting_key = 'current_derivation_index';

  RETURN v_next_index;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_derivation_index IS 'Atomically gets and increments the HD wallet derivation index for generating unique deposit addresses';

-- Function to mark deposit addresses as expired
CREATE OR REPLACE FUNCTION expire_old_deposit_addresses()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE deposit_addresses
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'active'
  AND expires_at < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_old_deposit_addresses IS 'Marks deposit addresses past their expiration as expired';

-- Function to check if user has payout wallet configured
CREATE OR REPLACE FUNCTION user_has_payout_wallet(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
    AND payout_wallet_address IS NOT NULL
    AND payout_wallet_address != ''
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION user_has_payout_wallet IS 'Checks if a user has configured their payout wallet address';

-- =============================================
-- 8. UPDATE TRANSACTION TYPES
-- =============================================

-- Add 'deposit' transaction type if not exists (for incoming payments to deposit addresses)
-- Note: The existing CHECK constraint needs to be updated
ALTER TABLE usdc_transactions DROP CONSTRAINT IF EXISTS usdc_transactions_transaction_type_check;

ALTER TABLE usdc_transactions ADD CONSTRAINT usdc_transactions_transaction_type_check
CHECK (
  transaction_type IN (
    'payment_in',           -- User pays platform (legacy - kept for backwards compat)
    'deposit',              -- User deposits to unique address (new)
    'payout',               -- Platform pays user commission
    'withdrawal',           -- User withdraws to external wallet (legacy)
    'refund',               -- Platform refunds user
    'transfer_internal'     -- Internal platform transfer
  )
);

COMMENT ON TABLE usdc_transactions IS 'All USDC movements on Polygon blockchain (updated for simplified crypto system)';

-- =============================================
-- 9. SUMMARY LOG
-- =============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration complete: Simplified Crypto System';
  RAISE NOTICE '- Created treasury_settings table';
  RAISE NOTICE '- Created deposit_addresses table';
  RAISE NOTICE '- Added payout_wallet_address to users table';
  RAISE NOTICE '- Added deposit_address_id to payment_intents table';
  RAISE NOTICE '- Marked crypto_wallets as legacy';
  RAISE NOTICE '- Dropped on_ramp_sessions table';
  RAISE NOTICE '- Added helper functions for derivation index and expiration';
END $$;
