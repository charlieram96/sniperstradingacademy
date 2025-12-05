-- Migration: Add payout wallet settings to treasury_settings table
-- This allows the payout hot wallet to be configured via admin UI instead of env vars

-- Insert payout wallet settings rows
INSERT INTO treasury_settings (setting_key, setting_value, created_at, updated_at)
VALUES
  ('payout_wallet_address', '', NOW(), NOW()),
  ('payout_wallet_private_key', '', NOW(), NOW())
ON CONFLICT (setting_key) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE treasury_settings IS 'Admin-configurable wallet settings including treasury (receiving) and payout (sending) wallets';
