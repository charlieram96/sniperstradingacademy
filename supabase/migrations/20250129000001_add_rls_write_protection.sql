-- =============================================
-- RLS Write Protection Migration
-- Adds INSERT/UPDATE/DELETE protection to crypto tables
-- =============================================

-- =============================================
-- crypto_wallets - Only system can write
-- =============================================

-- Prevent direct INSERT (only service role can insert)
CREATE POLICY "System only can insert crypto wallets"
ON crypto_wallets FOR INSERT
WITH CHECK (false);

-- Prevent direct UPDATE (only service role can update)
CREATE POLICY "System only can update crypto wallets"
ON crypto_wallets FOR UPDATE
USING (false)
WITH CHECK (false);

-- Prevent direct DELETE
CREATE POLICY "Prevent crypto wallet deletion"
ON crypto_wallets FOR DELETE
USING (false);

-- =============================================
-- usdc_transactions - Only system can write
-- =============================================

-- Prevent direct INSERT
CREATE POLICY "System only can insert USDC transactions"
ON usdc_transactions FOR INSERT
WITH CHECK (false);

-- Prevent direct UPDATE
CREATE POLICY "System only can update USDC transactions"
ON usdc_transactions FOR UPDATE
USING (false)
WITH CHECK (false);

-- Prevent direct DELETE
CREATE POLICY "Prevent USDC transaction deletion"
ON usdc_transactions FOR DELETE
USING (false);

-- =============================================
-- payment_intents - Only system can write
-- =============================================

-- Prevent direct INSERT (users create via API)
CREATE POLICY "System only can insert payment intents"
ON payment_intents FOR INSERT
WITH CHECK (false);

-- Prevent direct UPDATE
CREATE POLICY "System only can update payment intents"
ON payment_intents FOR UPDATE
USING (false)
WITH CHECK (false);

-- Prevent direct DELETE
CREATE POLICY "Prevent payment intent deletion"
ON payment_intents FOR DELETE
USING (false);

-- =============================================
-- payout_batches - Admin policies exist, add deletion protection
-- =============================================

-- Prevent direct DELETE (can only be cancelled via status update)
CREATE POLICY "Prevent payout batch deletion"
ON payout_batches FOR DELETE
USING (false);

-- =============================================
-- gas_usage_log - Only system can write
-- =============================================

-- Admin can view gas usage logs
CREATE POLICY "Admins can view gas usage logs"
ON gas_usage_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Prevent direct INSERT
CREATE POLICY "System only can insert gas usage logs"
ON gas_usage_log FOR INSERT
WITH CHECK (false);

-- Prevent direct UPDATE
CREATE POLICY "System only can update gas usage logs"
ON gas_usage_log FOR UPDATE
USING (false)
WITH CHECK (false);

-- Prevent direct DELETE
CREATE POLICY "Prevent gas usage log deletion"
ON gas_usage_log FOR DELETE
USING (false);

-- =============================================
-- treasury_snapshots - Only system can write
-- =============================================

-- Prevent direct INSERT
CREATE POLICY "System only can insert treasury snapshots"
ON treasury_snapshots FOR INSERT
WITH CHECK (false);

-- Prevent direct UPDATE
CREATE POLICY "System only can update treasury snapshots"
ON treasury_snapshots FOR UPDATE
USING (false)
WITH CHECK (false);

-- Prevent direct DELETE
CREATE POLICY "Prevent treasury snapshot deletion"
ON treasury_snapshots FOR DELETE
USING (false);

-- =============================================
-- on_ramp_sessions - Only system can insert, users can view own
-- =============================================

-- Prevent direct INSERT
CREATE POLICY "System only can insert on-ramp sessions"
ON on_ramp_sessions FOR INSERT
WITH CHECK (false);

-- Prevent direct UPDATE
CREATE POLICY "System only can update on-ramp sessions"
ON on_ramp_sessions FOR UPDATE
USING (false)
WITH CHECK (false);

-- Prevent direct DELETE
CREATE POLICY "Prevent on-ramp session deletion"
ON on_ramp_sessions FOR DELETE
USING (false);

-- =============================================
-- external_wallet_addresses - Users can only delete own
-- =============================================

CREATE POLICY "Users can delete own external wallets"
ON external_wallet_addresses FOR DELETE
USING (auth.uid() = user_id);

-- =============================================
-- Add unique partial index to prevent duplicate active intents
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_payment_intent
ON payment_intents (user_id, intent_type)
WHERE status IN ('created', 'awaiting_funds', 'processing');

-- =============================================
-- Add function for atomic payment intent status update
-- Prevents race conditions
-- =============================================

CREATE OR REPLACE FUNCTION update_payment_intent_status_atomic(
  p_intent_id UUID,
  p_from_status TEXT[],
  p_to_status TEXT
)
RETURNS payment_intents AS $$
DECLARE
  v_intent payment_intents;
BEGIN
  UPDATE payment_intents
  SET status = p_to_status,
      updated_at = NOW()
  WHERE id = p_intent_id
    AND status = ANY(p_from_status)
  RETURNING * INTO v_intent;

  RETURN v_intent;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Add audit log table for sensitive operations
-- =============================================

CREATE TABLE IF NOT EXISTS crypto_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'wallet_created',
      'wallet_exported',
      'transaction_initiated',
      'transaction_confirmed',
      'transaction_failed',
      'payout_approved',
      'payout_executed',
      'withdrawal_requested',
      'withdrawal_completed',
      'admin_action'
    )
  ),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT, -- 'wallet', 'transaction', 'payout_batch', etc.
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON crypto_audit_log(user_id);
CREATE INDEX idx_audit_log_event_type ON crypto_audit_log(event_type);
CREATE INDEX idx_audit_log_created_at ON crypto_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_entity ON crypto_audit_log(entity_type, entity_id);

-- Enable RLS on audit log
ALTER TABLE crypto_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON crypto_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Prevent any client writes to audit log
CREATE POLICY "System only can insert audit logs"
ON crypto_audit_log FOR INSERT
WITH CHECK (false);

CREATE POLICY "Prevent audit log modification"
ON crypto_audit_log FOR UPDATE
USING (false);

CREATE POLICY "Prevent audit log deletion"
ON crypto_audit_log FOR DELETE
USING (false);

COMMENT ON TABLE crypto_audit_log IS 'Immutable audit trail for all crypto operations';

-- =============================================
-- Add wallet_data_encrypted column for Coinbase SDK
-- =============================================

ALTER TABLE crypto_wallets
ADD COLUMN IF NOT EXISTS wallet_data_encrypted TEXT;

COMMENT ON COLUMN crypto_wallets.wallet_data_encrypted IS 'Encrypted Coinbase wallet seed data for recovery';
