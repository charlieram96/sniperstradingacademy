-- =====================================================
-- NOTIFICATION SYSTEM DATABASE MIGRATION
-- =====================================================
-- This migration adds comprehensive notification support
-- with email, SMS, WhatsApp capabilities, compliance
-- tracking, delivery health monitoring, and admin tools.
-- =====================================================

-- =====================================================
-- 1. ADD NOTIFICATION FIELDS TO USERS TABLE
-- =====================================================

-- Add phone number for SMS notifications
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add timezone for quiet hours enforcement
ALTER TABLE users
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Add notification preferences JSONB
ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email": {
    "referral_signups": true,
    "network_joins": true,
    "direct_bonus": true,
    "monthly_commission": true,
    "payouts": true,
    "volume_updates": true,
    "structure_milestones": true,
    "payment_failed": true,
    "account_inactive": true,
    "enabled": true
  },
  "sms": {
    "referral_signups": false,
    "network_joins": false,
    "direct_bonus": false,
    "monthly_commission": false,
    "payouts": false,
    "volume_updates": false,
    "structure_milestones": false,
    "payment_failed": false,
    "account_inactive": false,
    "enabled": false
  },
  "quiet_hours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00"
  }
}'::jsonb;

-- =====================================================
-- 2. SMS CONSENT TRACKING (TCPA COMPLIANCE)
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  opted_in BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMP WITH TIME ZONE,
  consent_source TEXT, -- 'web', 'admin', 'double-opt-in', 'api'
  consent_ip_address TEXT,
  consent_user_agent TEXT,
  opt_out_timestamp TIMESTAMP WITH TIME ZONE,
  opt_out_source TEXT, -- 'user', 'stop_command', 'admin', 'auto_disabled'
  verification_code TEXT,
  verification_sent_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_sms_consent_user_id ON sms_consent(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_consent_phone ON sms_consent(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_consent_opted_in ON sms_consent(opted_in);

-- =====================================================
-- 3. NOTIFICATION LOGS (DELIVERY TRACKING)
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL, -- 'referral_signup', 'direct_bonus', 'payout_processed', etc.
  channel TEXT NOT NULL, -- 'email', 'sms', 'whatsapp'
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'sent', 'delivered', 'failed', 'bounced', 'complaint', 'unsubscribed'
  idempotency_key TEXT UNIQUE NOT NULL,

  -- Message details
  subject TEXT,
  message TEXT,
  metadata JSONB, -- Event-specific data

  -- Provider tracking
  provider TEXT, -- 'twilio', 'sendgrid'
  provider_id TEXT, -- Twilio Message SID or SendGrid Message ID
  provider_status TEXT, -- Provider-specific status

  -- Error tracking
  error_message TEXT,
  error_code TEXT,

  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_channel ON notification_logs(channel);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_idempotency ON notification_logs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_notification_logs_provider_id ON notification_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);

-- =====================================================
-- 4. DELIVERY HEALTH TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'email', 'sms', 'whatsapp'

  -- Error counts
  hard_bounce_count INTEGER DEFAULT 0,
  soft_bounce_count INTEGER DEFAULT 0,
  complaint_count INTEGER DEFAULT 0,
  unsubscribe_count INTEGER DEFAULT 0,
  carrier_error_count INTEGER DEFAULT 0,
  delivery_failure_count INTEGER DEFAULT 0,

  -- Last error timestamps
  last_hard_bounce TIMESTAMP WITH TIME ZONE,
  last_soft_bounce TIMESTAMP WITH TIME ZONE,
  last_complaint TIMESTAMP WITH TIME ZONE,
  last_unsubscribe TIMESTAMP WITH TIME ZONE,
  last_carrier_error TIMESTAMP WITH TIME ZONE,
  last_delivery_failure TIMESTAMP WITH TIME ZONE,

  -- Success metrics
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  delivery_rate NUMERIC(5,2), -- Percentage

  -- Channel status
  channel_disabled BOOLEAN DEFAULT false,
  disabled_reason TEXT,
  disabled_at TIMESTAMP WITH TIME ZONE,
  re_enable_requested BOOLEAN DEFAULT false,
  re_enable_requested_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_health_user_id ON notification_health(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_health_channel ON notification_health(channel);
CREATE INDEX IF NOT EXISTS idx_notification_health_disabled ON notification_health(channel_disabled);

-- =====================================================
-- 5. NOTIFICATION CAMPAIGNS (ADMIN MASS SEND)
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Campaign metadata
  campaign_name TEXT NOT NULL,
  campaign_description TEXT,
  channel TEXT NOT NULL, -- 'email', 'sms', 'whatsapp'

  -- Creator and approver
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),

  -- Targeting
  target_filter JSONB, -- {"role": "user", "status": "active", "membership_status": "unlocked"}
  excluded_users UUID[], -- Array of user IDs to exclude

  -- Message content
  subject TEXT,
  message TEXT,
  template_id TEXT, -- Reference to email template if using one

  -- Status workflow
  status TEXT DEFAULT 'draft', -- 'draft', 'pending_approval', 'approved', 'sending', 'completed', 'cancelled', 'failed'

  -- Canary send (gradual rollout)
  canary_enabled BOOLEAN DEFAULT true,
  canary_percentage INTEGER DEFAULT 1, -- Start with 1% of recipients
  canary_completed BOOLEAN DEFAULT false,
  canary_success_threshold NUMERIC(5,2) DEFAULT 95.0, -- 95% delivery rate to proceed
  canary_sent_count INTEGER DEFAULT 0,
  canary_delivered_count INTEGER DEFAULT 0,
  canary_failed_count INTEGER DEFAULT 0,

  -- Campaign metrics
  total_recipients INTEGER,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,

  -- Rate limiting
  send_rate_per_minute INTEGER DEFAULT 100, -- Max sends per minute

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  sending_started_at TIMESTAMP WITH TIME ZONE,
  canary_completed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON notification_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON notification_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_campaigns_channel ON notification_campaigns(channel);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON notification_campaigns(created_at DESC);

-- =====================================================
-- 6. CAMPAIGN RECIPIENTS (TRACKING)
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_log_id UUID REFERENCES notification_logs(id),

  -- Recipient group
  is_canary BOOLEAN DEFAULT false, -- Part of canary batch

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'skipped'

  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON notification_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_user_id ON notification_campaign_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON notification_campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_canary ON notification_campaign_recipients(is_canary);

-- =====================================================
-- 7. INBOUND SMS MESSAGES (STOP/UNSTOP/HELP)
-- =====================================================

CREATE TABLE IF NOT EXISTS inbound_sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Twilio data
  message_sid TEXT UNIQUE NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,

  -- User association
  user_id UUID REFERENCES users(id),

  -- Command detection
  command_detected TEXT, -- 'STOP', 'UNSTOP', 'START', 'HELP'
  processed BOOLEAN DEFAULT false,
  processing_error TEXT,

  -- Response
  response_sent BOOLEAN DEFAULT false,
  response_message TEXT,
  response_sid TEXT,

  -- Metadata
  media_urls TEXT[], -- MMS attachments
  num_media INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_inbound_sms_from ON inbound_sms_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_inbound_sms_user_id ON inbound_sms_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_inbound_sms_command ON inbound_sms_messages(command_detected);
CREATE INDEX IF NOT EXISTS idx_inbound_sms_processed ON inbound_sms_messages(processed);

-- =====================================================
-- 8. NOTIFICATION TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template identification
  template_key TEXT UNIQUE NOT NULL, -- 'referral_signup', 'direct_bonus', etc.
  template_name TEXT NOT NULL,
  description TEXT,

  -- Template content
  channel TEXT NOT NULL, -- 'email', 'sms', 'whatsapp'
  subject_template TEXT, -- For email, with variable placeholders like {{userName}}
  body_template TEXT NOT NULL, -- Message body with placeholders
  html_template TEXT, -- For email HTML version

  -- Template variables
  variables JSONB, -- {"userName": "string", "amount": "number"}

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_by UUID REFERENCES users(id),
  last_modified_by UUID REFERENCES users(id),
  version INTEGER DEFAULT 1,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_key ON notification_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON notification_templates(channel);

-- =====================================================
-- 9. FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_sms_consent_updated_at BEFORE UPDATE ON sms_consent
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_logs_updated_at BEFORE UPDATE ON notification_logs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_health_updated_at BEFORE UPDATE ON notification_health
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_campaigns_updated_at BEFORE UPDATE ON notification_campaigns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate delivery rate
CREATE OR REPLACE FUNCTION calculate_delivery_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_sent > 0 THEN
    NEW.delivery_rate = (NEW.total_delivered::NUMERIC / NEW.total_sent::NUMERIC) * 100;
  ELSE
    NEW.delivery_rate = 0;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_health_delivery_rate BEFORE UPDATE ON notification_health
FOR EACH ROW EXECUTE FUNCTION calculate_delivery_rate();

-- Function to auto-disable channel on hard bounce/complaint
CREATE OR REPLACE FUNCTION auto_disable_channel_on_error()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-disable on hard bounce
  IF NEW.hard_bounce_count > OLD.hard_bounce_count AND NEW.hard_bounce_count >= 1 THEN
    NEW.channel_disabled = true;
    NEW.disabled_reason = 'Hard bounce detected';
    NEW.disabled_at = NOW();
  END IF;

  -- Auto-disable on complaint
  IF NEW.complaint_count > OLD.complaint_count AND NEW.complaint_count >= 1 THEN
    NEW.channel_disabled = true;
    NEW.disabled_reason = 'Complaint received';
    NEW.disabled_at = NOW();
  END IF;

  -- Auto-disable after 3 soft bounces in 7 days
  IF NEW.soft_bounce_count >= 3 AND
     NEW.last_soft_bounce > NOW() - INTERVAL '7 days' THEN
    NEW.channel_disabled = true;
    NEW.disabled_reason = 'Multiple soft bounces (3 in 7 days)';
    NEW.disabled_at = NOW();
  END IF;

  -- Auto-disable after 5 carrier errors
  IF NEW.carrier_error_count >= 5 THEN
    NEW.channel_disabled = true;
    NEW.disabled_reason = 'Repeated carrier errors';
    NEW.disabled_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER auto_disable_notification_channel BEFORE UPDATE ON notification_health
FOR EACH ROW EXECUTE FUNCTION auto_disable_channel_on_error();

-- =====================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE sms_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- SMS Consent: Users can view/update their own consent
CREATE POLICY "Users can view own sms consent" ON sms_consent
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sms consent" ON sms_consent
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sms consent" ON sms_consent
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Notification Logs: Users can view their own logs
CREATE POLICY "Users can view own notification logs" ON notification_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all notification logs" ON notification_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Notification Health: Users can view their own health
CREATE POLICY "Users can view own notification health" ON notification_health
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all notification health" ON notification_health
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Campaigns: Only admins can view/manage
CREATE POLICY "Admins can view campaigns" ON notification_campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can create campaigns" ON notification_campaigns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Templates: Admins only
CREATE POLICY "Admins can manage templates" ON notification_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- =====================================================
-- 11. SEED DEFAULT NOTIFICATION TEMPLATES
-- =====================================================

-- SMS Templates
INSERT INTO notification_templates (template_key, template_name, channel, body_template, variables, description) VALUES
  ('sms_referral_signup', 'Referral Signup SMS', 'sms', '🎉 {{referredName}} just joined using your referral code! Welcome them to the network.', '{"referredName": "string"}', 'Notify user when someone signs up with their referral code'),
  ('sms_direct_bonus', 'Direct Bonus Earned SMS', 'sms', '💰 You earned ${{amount}}! {{referredName}} completed their initial payment. Check your Finance page.', '{"amount": "number", "referredName": "string"}', 'Notify user when they earn a direct referral bonus'),
  ('sms_payout_processed', 'Payout Processed SMS', 'sms', '✅ Your ${{amount}} payout has been transferred to your bank account. It should arrive in 2-7 business days.', '{"amount": "number"}', 'Notify user when payout is processed'),
  ('sms_payout_failed', 'Payout Failed SMS', 'sms', '❌ Your ${{amount}} payout failed. Please update your Stripe Connect account at {{dashboardUrl}}', '{"amount": "number", "dashboardUrl": "string"}', 'Notify user when payout fails'),
  ('sms_payment_failed', 'Payment Failed SMS', 'sms', '⚠️ Your subscription payment of ${{amount}} failed. Update your payment method to keep your account active: {{paymentUrl}}', '{"amount": "number", "paymentUrl": "string"}', 'Notify user when subscription payment fails')
ON CONFLICT (template_key) DO NOTHING;

-- Email templates will be React Email components, so we don't seed HTML here
INSERT INTO notification_templates (template_key, template_name, channel, subject_template, body_template, variables, description) VALUES
  ('email_referral_signup', 'Referral Signup Email', 'email', 'New Referral: {{referredName}} Joined!', 'Congratulations! {{referredName}} ({{referredEmail}}) just signed up using your referral code {{referralCode}}. They have been placed in your network.', '{"referredName": "string", "referredEmail": "string", "referralCode": "string"}', 'Notify user when someone signs up with their referral code'),
  ('email_direct_bonus', 'Direct Bonus Email', 'email', 'You Earned ${{amount}}!', '{{referredName}} has completed their initial payment and activated their account. Your ${{amount}} direct referral bonus is now pending and will be paid out on the 15th of next month.', '{"referredName": "string", "amount": "number"}', 'Notify user when they earn a direct referral bonus'),
  ('email_monthly_commission', 'Monthly Commission Email', 'email', 'Your {{month}} Commission: ${{amount}}', 'Great news! Your residual commission for {{month}} is ${{amount}}. This is based on {{memberCount}} active members in your network generating ${{totalVolume}} in sniper volume at your {{commissionRate}}% commission rate.', '{"month": "string", "amount": "number", "memberCount": "number", "totalVolume": "number", "commissionRate": "number"}', 'Notify user of their calculated monthly commission'),
  ('email_payout_processed', 'Payout Processed Email', 'email', 'Your ${{amount}} Payout is On The Way', 'Your {{commissionType}} payout of ${{amount}} has been successfully transferred to your connected bank account. You should see it in 2-7 business days.', '{"amount": "number", "commissionType": "string"}', 'Notify user when payout is processed'),
  ('email_structure_milestone', 'Structure Milestone Email', 'email', 'Congratulations! Structure {{structureNumber}} Unlocked', 'Amazing achievement! You have reached Structure {{structureNumber}} with {{activeMembers}} active members in your network. Your commission rate has increased to {{newRate}}%. Maximum monthly commission: ${{maxCommission}}.', '{"structureNumber": "number", "activeMembers": "number", "newRate": "number", "maxCommission": "number"}', 'Notify user when they reach a new structure milestone')
ON CONFLICT (template_key) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Run this migration using:
-- psql -h <host> -U <user> -d <database> -f supabase-notifications-schema.sql
--
-- Or via Supabase Dashboard:
-- Database > SQL Editor > New query > Paste and run
-- =====================================================
