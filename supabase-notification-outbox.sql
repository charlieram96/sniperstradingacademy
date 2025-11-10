/**
 * NOTIFICATION OUTBOX SCHEMA
 *
 * DB Outbox pattern for reliable notification delivery.
 * Works with Vercel cron to process queued notifications.
 *
 * Key features:
 * - Atomic batch claiming with SKIP LOCKED
 * - Exponential backoff retry logic
 * - Worker leasing to prevent duplicate processing
 * - Idempotency to prevent duplicate sends
 * - Scheduled delivery for quiet hours
 *
 * Run this migration in Supabase SQL Editor or via CLI.
 */

-- Create enum for notification status
CREATE TYPE notification_status AS ENUM ('pending', 'claimed', 'processed', 'failed');

-- Main outbox table
CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Notification details
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  data JSONB NOT NULL,

  -- Scheduling
  scheduled_at TIMESTAMPTZ, -- NULL = send immediately, set for quiet hours

  -- Worker leasing (prevents duplicate processing)
  status notification_status NOT NULL DEFAULT 'pending',
  claimed_at TIMESTAMPTZ,
  claimed_by TEXT, -- worker instance ID (e.g., 'cron-iad1')
  lease_expires_at TIMESTAMPTZ,

  -- Idempotency (prevents duplicate notifications)
  idempotency_key TEXT NOT NULL UNIQUE,

  -- Retry logic with exponential backoff
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ, -- When to retry after failure

  -- Error tracking
  last_error TEXT,
  last_error_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL INDEX: For claiming pending notifications
-- This index makes the claim query fast (SKIP LOCKED)
CREATE INDEX idx_outbox_claimable ON notification_outbox (created_at)
WHERE status = 'pending'
  AND (scheduled_at IS NULL OR scheduled_at <= NOW())
  AND (next_retry_at IS NULL OR next_retry_at <= NOW());

-- Index for cleanup queries (delete old processed records)
CREATE INDEX idx_outbox_cleanup ON notification_outbox (status, updated_at);

-- Index for monitoring queries (dashboard, admin views)
CREATE INDEX idx_outbox_status ON notification_outbox (status, created_at DESC);

-- Index for user-specific queries
CREATE INDEX idx_outbox_user ON notification_outbox (user_id, created_at DESC);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_outbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_outbox_updated_at
BEFORE UPDATE ON notification_outbox
FOR EACH ROW
EXECUTE FUNCTION update_notification_outbox_updated_at();

-- Add unique index to notification_logs for idempotency (if not exists)
-- This prevents duplicate sends at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_logs_idempotency
ON notification_logs(idempotency_key);

/**
 * ATOMIC BATCH CLAIM FUNCTION
 *
 * Claims a batch of pending notifications atomically using SKIP LOCKED.
 * This prevents race conditions when multiple cron workers run simultaneously.
 *
 * Parameters:
 *   p_batch_size - Number of notifications to claim (recommend 200-300)
 *   p_worker_id - Identifier for this worker instance
 *   p_lease_seconds - How long to hold the lease (recommend 60 seconds)
 *
 * Returns:
 *   Array of claimed notification records
 *
 * Usage:
 *   SELECT * FROM claim_notification_batch(250, 'cron-iad1', 60);
 */
CREATE OR REPLACE FUNCTION claim_notification_batch(
  p_batch_size INTEGER,
  p_worker_id TEXT,
  p_lease_seconds INTEGER
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  notification_type TEXT,
  channel TEXT,
  data JSONB,
  idempotency_key TEXT,
  retry_count INTEGER,
  max_retries INTEGER,
  scheduled_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  UPDATE notification_outbox
  SET
    status = 'claimed',
    claimed_at = NOW(),
    claimed_by = p_worker_id,
    lease_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
    updated_at = NOW()
  WHERE notification_outbox.id IN (
    SELECT notification_outbox.id
    FROM notification_outbox
    WHERE notification_outbox.status = 'pending'
      AND (notification_outbox.scheduled_at IS NULL OR notification_outbox.scheduled_at <= NOW())
      AND (notification_outbox.next_retry_at IS NULL OR notification_outbox.next_retry_at <= NOW())
    ORDER BY notification_outbox.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    notification_outbox.id,
    notification_outbox.user_id,
    notification_outbox.notification_type,
    notification_outbox.channel,
    notification_outbox.data,
    notification_outbox.idempotency_key,
    notification_outbox.retry_count,
    notification_outbox.max_retries,
    notification_outbox.scheduled_at;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_outbox TO service_role;
GRANT EXECUTE ON FUNCTION claim_notification_batch TO authenticated;
GRANT EXECUTE ON FUNCTION claim_notification_batch TO service_role;

-- Enable RLS (Row Level Security)
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own notifications in outbox
CREATE POLICY "Users can view their own notifications"
ON notification_outbox
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only service role can insert/update/delete (cron jobs use service role)
CREATE POLICY "Service role can manage all notifications"
ON notification_outbox
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE notification_outbox IS 'Outbox pattern for reliable notification delivery via Vercel cron';
COMMENT ON COLUMN notification_outbox.status IS 'pending = ready to send, claimed = being processed, processed = sent, failed = permanent failure';
COMMENT ON COLUMN notification_outbox.scheduled_at IS 'When to send (NULL = ASAP, future = scheduled/quiet hours)';
COMMENT ON COLUMN notification_outbox.lease_expires_at IS 'Worker lease expiration (prevents stuck jobs)';
COMMENT ON COLUMN notification_outbox.idempotency_key IS 'SHA-256 hash to prevent duplicate notifications';
COMMENT ON COLUMN notification_outbox.next_retry_at IS 'When to retry after failure (exponential backoff)';
COMMENT ON FUNCTION claim_notification_batch IS 'Atomically claims batch of notifications with SKIP LOCKED';
