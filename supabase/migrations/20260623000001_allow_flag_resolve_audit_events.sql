-- The flagged-reviews resolve endpoint (app/api/admin/flagged-reviews/resolve)
-- writes audit-log events when an admin dismisses a flag or deactivates a user,
-- but the crypto_audit_log event_type CHECK constraint did not include
-- 'review_flag_dismissed' or 'review_flag_deactivated' — so those inserts
-- silently failed (the insert error is only console.error'd, not surfaced) and
-- no audit row was ever written for either action. Add the two event types so
-- the audit trail actually records flag dismissals and deactivations.

ALTER TABLE public.crypto_audit_log
  DROP CONSTRAINT IF EXISTS crypto_audit_log_event_type_check;

ALTER TABLE public.crypto_audit_log
  ADD CONSTRAINT crypto_audit_log_event_type_check CHECK (event_type = ANY (ARRAY[
    'wallet_created', 'wallet_exported', 'transaction_initiated', 'transaction_confirmed',
    'transaction_failed', 'payout_approved', 'payout_executed', 'withdrawal_requested',
    'withdrawal_completed', 'admin_action', 'deposit_detected_webhook', 'deposit_detected_cron',
    'deposit_partial_webhook', 'deposit_underpaid_cron', 'deposit_swept', 'deposit_sweep_failed',
    'sweep_cron_completed', 'manual_sweep_success', 'manual_sweep_failed', 'manual_sweep_batch_completed',
    'deposit_address_created', 'permanent_deposit_address_created', 'alchemy_registration_failed',
    'alchemy_registration_recovered', 'deposit_anomaly_skipped', 'volume_distribution_failure',
    'overpayment_resolved', 'payout_wallet_settings_updated', 'sweep_identify_completed',
    'sweep_fund_completed', 'sweep_execute_completed', 'sweep_verify_completed', 'manual_payout_executed',
    'account_flagged_for_review', 'payment_review_check_skipped', 'payment_review_check_completed',
    'review_flag_dismissed', 'review_flag_deactivated'
  ]::text[]));
