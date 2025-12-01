-- =============================================
-- USDC-on-Polygon Payment System Schema
-- Migration: Add crypto wallet infrastructure
-- =============================================

-- User wallet mapping (custodial Coinbase Server Wallets)
CREATE TABLE IF NOT EXISTS crypto_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coinbase_wallet_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT UNIQUE NOT NULL,
  network TEXT NOT NULL DEFAULT 'polygon',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_backup_shown_at TIMESTAMPTZ,
  is_exported BOOLEAN DEFAULT false,
  exported_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'migrated')),

  -- Indexes for performance
  CONSTRAINT unique_user_wallet UNIQUE (user_id, network)
);

CREATE INDEX idx_crypto_wallets_user_id ON crypto_wallets(user_id);
CREATE INDEX idx_crypto_wallets_address ON crypto_wallets(wallet_address);
CREATE INDEX idx_crypto_wallets_status ON crypto_wallets(status);

-- USDC transaction records (all on-chain movements)
CREATE TABLE IF NOT EXISTS usdc_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN (
      'payment_in',           -- User pays platform
      'payout',              -- Platform pays user commission
      'withdrawal',          -- User withdraws to external wallet
      'refund',              -- Platform refunds user
      'transfer_internal',   -- Internal platform transfer
      'on_ramp'             -- TransFi purchase deposit
    )
  ),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount NUMERIC(20,6) NOT NULL CHECK (amount > 0),
  gas_fee_matic NUMERIC(20,18), -- Actual MATIC spent on gas
  gas_fee_usdc_equivalent NUMERIC(20,6), -- USD equivalent at time of tx
  polygon_tx_hash TEXT UNIQUE,
  block_number BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'confirmed', 'failed', 'cancelled')
  ),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Foreign keys
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  related_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  related_commission_id UUID REFERENCES commissions(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usdc_tx_user_id ON usdc_transactions(user_id);
CREATE INDEX idx_usdc_tx_type ON usdc_transactions(transaction_type);
CREATE INDEX idx_usdc_tx_status ON usdc_transactions(status);
CREATE INDEX idx_usdc_tx_hash ON usdc_transactions(polygon_tx_hash);
CREATE INDEX idx_usdc_tx_created_at ON usdc_transactions(created_at DESC);
CREATE INDEX idx_usdc_tx_payment_id ON usdc_transactions(related_payment_id) WHERE related_payment_id IS NOT NULL;
CREATE INDEX idx_usdc_tx_commission_id ON usdc_transactions(related_commission_id) WHERE related_commission_id IS NOT NULL;

-- Payment intents (before blockchain execution)
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent_type TEXT NOT NULL CHECK (
    intent_type IN (
      'initial_unlock',      -- $499 initial payment
      'monthly_subscription', -- $199 monthly
      'weekly_subscription'  -- $49.75 weekly
    )
  ),
  amount_usdc NUMERIC(20,6) NOT NULL CHECK (amount_usdc > 0),
  status TEXT NOT NULL DEFAULT 'created' CHECK (
    status IN (
      'created',           -- Intent created, awaiting user action
      'awaiting_funds',    -- User initiated, monitoring wallet
      'processing',        -- Funds detected, processing transfer
      'completed',         -- Successfully processed
      'expired',          -- Timeout reached
      'cancelled'         -- User/admin cancelled
    )
  ),

  -- Monitoring
  user_wallet_address TEXT NOT NULL,
  platform_wallet_address TEXT NOT NULL,
  funds_detected_at TIMESTAMPTZ,

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,

  -- Related records
  usdc_transaction_id UUID REFERENCES usdc_transactions(id) ON DELETE SET NULL,
  on_ramp_session_id TEXT, -- TransFi session ID if applicable

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_intents_user_id ON payment_intents(user_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_expires_at ON payment_intents(expires_at);
CREATE INDEX idx_payment_intents_created_at ON payment_intents(created_at DESC);

-- Payout batches (for admin review and approval)
CREATE TABLE IF NOT EXISTS payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT NOT NULL,
  batch_type TEXT NOT NULL CHECK (
    batch_type IN ('direct_bonuses', 'monthly_residual', 'manual', 'mixed')
  ),
  total_amount_usdc NUMERIC(20,6) NOT NULL CHECK (total_amount_usdc >= 0),
  total_payouts INTEGER NOT NULL CHECK (total_payouts >= 0),
  estimated_gas_matic NUMERIC(20,18),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'processing', 'completed', 'failed', 'cancelled')
  ),

  -- Processing info
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Results
  successful_payouts INTEGER DEFAULT 0,
  failed_payouts INTEGER DEFAULT 0,
  total_gas_spent_matic NUMERIC(20,18),
  total_gas_spent_usdc NUMERIC(20,6),

  -- Metadata
  commission_ids UUID[] DEFAULT '{}', -- Array of commission IDs in this batch
  error_log JSONB DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payout_batches_status ON payout_batches(status);
CREATE INDEX idx_payout_batches_created_at ON payout_batches(created_at DESC);
CREATE INDEX idx_payout_batches_type ON payout_batches(batch_type);

-- Gas usage tracking (for accounting and optimization)
CREATE TABLE IF NOT EXISTS gas_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES usdc_transactions(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,

  -- Gas metrics
  gas_limit BIGINT,
  gas_used BIGINT NOT NULL,
  gas_price_gwei NUMERIC(20,9) NOT NULL,
  max_fee_per_gas_gwei NUMERIC(20,9),
  max_priority_fee_gwei NUMERIC(20,9),

  -- Costs
  matic_spent NUMERIC(20,18) NOT NULL,
  usdc_equivalent NUMERIC(20,6), -- Convert MATIC to USD at time of tx
  matic_price_usd NUMERIC(20,6), -- MATIC price at time of tx

  -- Blockchain data
  polygon_tx_hash TEXT NOT NULL,
  block_number BIGINT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gas_usage_tx_id ON gas_usage_log(transaction_id);
CREATE INDEX idx_gas_usage_tx_type ON gas_usage_log(transaction_type);
CREATE INDEX idx_gas_usage_created_at ON gas_usage_log(created_at DESC);

-- Platform treasury snapshots (daily balance tracking)
CREATE TABLE IF NOT EXISTS treasury_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Platform balances
  usdc_balance NUMERIC(20,6) NOT NULL CHECK (usdc_balance >= 0),
  matic_balance NUMERIC(20,18) NOT NULL CHECK (matic_balance >= 0),

  -- User balances (total in all custodial wallets)
  total_user_wallets_usdc NUMERIC(20,6) NOT NULL DEFAULT 0,

  -- Liabilities (pending payouts)
  pending_commissions_usdc NUMERIC(20,6) NOT NULL DEFAULT 0,
  pending_payouts_usdc NUMERIC(20,6) NOT NULL DEFAULT 0,

  -- Net position
  platform_net_balance NUMERIC(20,6),

  -- Pricing data
  matic_price_usd NUMERIC(20,6),
  usdc_price_usd NUMERIC(20,6) DEFAULT 1.00,

  -- Metadata
  total_active_wallets INTEGER DEFAULT 0,
  snapshot_type TEXT DEFAULT 'daily' CHECK (snapshot_type IN ('daily', 'monthly', 'manual')),

  -- Timestamp
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_treasury_snapshots_at ON treasury_snapshots(snapshot_at DESC);
CREATE INDEX idx_treasury_snapshots_type ON treasury_snapshots(snapshot_type);

-- External wallet addresses (whitelist for withdrawals)
CREATE TABLE IF NOT EXISTS external_wallet_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  wallet_label TEXT, -- User-provided label (e.g., "My MetaMask", "Binance")
  network TEXT NOT NULL DEFAULT 'polygon',
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,

  -- Usage tracking
  first_used_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  total_withdrawals INTEGER DEFAULT 0,
  total_amount_withdrawn NUMERIC(20,6) DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'flagged')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_external_wallet UNIQUE (user_id, wallet_address, network)
);

CREATE INDEX idx_external_wallets_user_id ON external_wallet_addresses(user_id);
CREATE INDEX idx_external_wallets_status ON external_wallet_addresses(status);

-- TransFi on-ramp sessions (track purchases)
CREATE TABLE IF NOT EXISTS on_ramp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'transfi',

  -- Session details
  provider_session_id TEXT UNIQUE,
  provider_order_id TEXT,

  -- Amounts
  fiat_amount NUMERIC(20,2),
  fiat_currency TEXT, -- USD, EUR, etc.
  crypto_amount NUMERIC(20,6), -- USDC amount
  fee_amount NUMERIC(20,2),

  -- Destination
  destination_wallet_address TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (
    status IN (
      'initiated',      -- Widget opened
      'pending',        -- Payment processing
      'completed',      -- USDC received
      'failed',        -- Payment failed
      'cancelled',     -- User cancelled
      'expired'        -- Session expired
    )
  ),

  -- Blockchain confirmation
  deposit_tx_hash TEXT,
  deposit_confirmed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_on_ramp_user_id ON on_ramp_sessions(user_id);
CREATE INDEX idx_on_ramp_provider_session ON on_ramp_sessions(provider_session_id);
CREATE INDEX idx_on_ramp_status ON on_ramp_sessions(status);
CREATE INDEX idx_on_ramp_created_at ON on_ramp_sessions(created_at DESC);

-- =============================================
-- UPDATE EXISTING TABLES
-- =============================================

-- Add crypto wallet reference to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS crypto_wallet_id UUID REFERENCES crypto_wallets(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS requires_kyc_update BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_completed_crypto BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_completed_crypto_at TIMESTAMPTZ;

CREATE INDEX idx_users_crypto_wallet ON users(crypto_wallet_id) WHERE crypto_wallet_id IS NOT NULL;

-- Add USDC transaction reference to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS usdc_transaction_id UUID REFERENCES usdc_transactions(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL;

CREATE INDEX idx_payments_usdc_tx ON payments(usdc_transaction_id) WHERE usdc_transaction_id IS NOT NULL;

-- Add USDC transaction reference to commissions table
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS usdc_transaction_id UUID REFERENCES usdc_transactions(id) ON DELETE SET NULL;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS payout_batch_id UUID REFERENCES payout_batches(id) ON DELETE SET NULL;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS net_amount_usdc NUMERIC(20,6); -- Amount after gas fees (if applicable)

CREATE INDEX idx_commissions_usdc_tx ON commissions(usdc_transaction_id) WHERE usdc_transaction_id IS NOT NULL;
CREATE INDEX idx_commissions_batch ON commissions(payout_batch_id) WHERE payout_batch_id IS NOT NULL;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to get user's wallet balance (mock - will be replaced by actual blockchain query)
CREATE OR REPLACE FUNCTION get_user_wallet_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_wallet_address TEXT;
BEGIN
  SELECT wallet_address INTO v_wallet_address
  FROM crypto_wallets
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  IF v_wallet_address IS NULL THEN
    RETURN 0;
  END IF;

  -- This will be replaced by actual blockchain query via API
  -- For now, return 0 as placeholder
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total pending commission balance for user
CREATE OR REPLACE FUNCTION get_pending_commission_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(amount)
     FROM commissions
     WHERE referrer_id = p_user_id
     AND status = 'pending'),
    0
  );
END;
$$ LANGUAGE plpgsql;

-- Function to mark payment intent as expired (called by cron)
CREATE OR REPLACE FUNCTION expire_old_payment_intents()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE payment_intents
  SET status = 'expired',
      updated_at = NOW()
  WHERE status IN ('created', 'awaiting_funds')
  AND expires_at < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on new tables
ALTER TABLE crypto_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE usdc_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE gas_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_wallet_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_ramp_sessions ENABLE ROW LEVEL SECURITY;

-- Crypto wallets: Users can view own wallet
CREATE POLICY "Users can view own crypto wallet"
ON crypto_wallets FOR SELECT
USING (auth.uid() = user_id);

-- USDC transactions: Users can view own transactions
CREATE POLICY "Users can view own USDC transactions"
ON usdc_transactions FOR SELECT
USING (auth.uid() = user_id);

-- Payment intents: Users can view own payment intents
CREATE POLICY "Users can view own payment intents"
ON payment_intents FOR SELECT
USING (auth.uid() = user_id);

-- External wallet addresses: Users can manage own addresses
CREATE POLICY "Users can view own external wallets"
ON external_wallet_addresses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own external wallets"
ON external_wallet_addresses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own external wallets"
ON external_wallet_addresses FOR UPDATE
USING (auth.uid() = user_id);

-- On-ramp sessions: Users can view own sessions
CREATE POLICY "Users can view own on-ramp sessions"
ON on_ramp_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Admin policies (all tables)
CREATE POLICY "Admins can view all crypto wallets"
ON crypto_wallets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admins can view all USDC transactions"
ON usdc_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admins can manage payout batches"
ON payout_batches FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admins can view treasury snapshots"
ON treasury_snapshots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  )
);

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usdc_transactions_updated_at
BEFORE UPDATE ON usdc_transactions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_intents_updated_at
BEFORE UPDATE ON payment_intents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_batches_updated_at
BEFORE UPDATE ON payout_batches
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_external_wallets_updated_at
BEFORE UPDATE ON external_wallet_addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_on_ramp_sessions_updated_at
BEFORE UPDATE ON on_ramp_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE crypto_wallets IS 'User custodial wallets managed by Coinbase Server Wallet v2';
COMMENT ON TABLE usdc_transactions IS 'All USDC movements on Polygon blockchain';
COMMENT ON TABLE payment_intents IS 'Pre-blockchain payment requests awaiting user action';
COMMENT ON TABLE payout_batches IS 'Admin-reviewed batches of commission payouts';
COMMENT ON TABLE gas_usage_log IS 'Gas fee tracking for all blockchain transactions';
COMMENT ON TABLE treasury_snapshots IS 'Daily snapshots of platform treasury balances';
COMMENT ON TABLE external_wallet_addresses IS 'User-registered external wallets for withdrawals';
COMMENT ON TABLE on_ramp_sessions IS 'TransFi on-ramp purchase sessions';
