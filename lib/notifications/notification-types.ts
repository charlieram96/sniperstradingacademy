/**
 * NOTIFICATION SYSTEM TYPES
 *
 * Comprehensive type definitions for the notification system
 * supporting email, SMS, and WhatsApp channels with compliance
 * and delivery tracking.
 */

// =====================================================
// NOTIFICATION CHANNELS
// =====================================================

export type NotificationChannel = 'email' | 'sms' | 'whatsapp'

export type NotificationProvider = 'twilio' | 'sendgrid'

// =====================================================
// NOTIFICATION TYPES (EVENT-BASED)
// =====================================================

export type NotificationType =
  | 'referral_signup'           // Someone signs up with user's referral code
  | 'network_join'              // Someone joins user's network
  | 'direct_bonus'              // User earns $249.50 direct referral bonus
  | 'monthly_commission'        // Monthly residual commission calculated
  | 'payout_processed'          // Payout transferred to bank account
  | 'payout_failed'             // Payout failed (action required)
  | 'payment_failed'            // Subscription payment failed
  | 'payment_succeeded'         // Subscription payment succeeded
  | 'structure_milestone'       // Commission structure level reached
  | 'volume_update'             // Sniper volume increased
  | 'account_inactive'          // Account became inactive (33 days)
  | 'account_reactivated'       // Account reactivated
  | 'admin_announcement'        // Admin mass notification
  | 'welcome'                   // Welcome email after signup

// =====================================================
// NOTIFICATION STATUS
// =====================================================

export type NotificationStatus =
  | 'queued'         // In queue, waiting to be sent
  | 'sent'           // Sent to provider (Twilio/SendGrid)
  | 'delivered'      // Confirmed delivered by provider
  | 'failed'         // Failed to send
  | 'bounced'        // Email bounced (hard or soft)
  | 'complaint'      // User marked as spam
  | 'unsubscribed'   // User unsubscribed
  | 'deferred'       // Deferred due to quiet hours

// =====================================================
// NOTIFICATION PREFERENCES
// =====================================================

export interface NotificationPreferences {
  email: {
    referral_signups: boolean
    network_joins: boolean
    direct_bonus: boolean
    monthly_commission: boolean
    payouts: boolean
    volume_updates: boolean
    structure_milestones: boolean
    payment_failed: boolean
    account_inactive: boolean
    enabled: boolean  // Master toggle for all email notifications
  }
  sms: {
    referral_signups: boolean
    network_joins: boolean
    direct_bonus: boolean
    monthly_commission: boolean
    payouts: boolean
    volume_updates: boolean
    structure_milestones: boolean
    payment_failed: boolean
    account_inactive: boolean
    enabled: boolean  // Master toggle for all SMS notifications
  }
  quiet_hours: {
    enabled: boolean
    start: string  // "22:00" (10 PM)
    end: string    // "08:00" (8 AM)
  }
}

// =====================================================
// SMS CONSENT (TCPA COMPLIANCE)
// =====================================================

export interface SMSConsent {
  id: string
  user_id: string
  phone_number: string
  opted_in: boolean
  consent_timestamp: string | null
  consent_source: 'web' | 'admin' | 'double-opt-in' | 'api'
  consent_ip_address: string | null
  consent_user_agent: string | null
  opt_out_timestamp: string | null
  opt_out_source: 'user' | 'stop_command' | 'admin' | 'auto_disabled' | null
  verification_code: string | null
  verification_sent_at: string | null
  verified_at: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

// =====================================================
// NOTIFICATION LOG (DELIVERY TRACKING)
// =====================================================

export interface NotificationLog {
  id: string
  user_id: string | null
  notification_type: NotificationType
  channel: NotificationChannel
  status: NotificationStatus
  idempotency_key: string

  // Message content
  subject: string | null
  message: string
  metadata: Record<string, unknown>

  // Provider tracking
  provider: NotificationProvider
  provider_id: string | null  // Twilio Message SID or SendGrid Message ID
  provider_status: string | null

  // Error tracking
  error_message: string | null
  error_code: string | null

  // Retry logic
  retry_count: number
  max_retries: number
  last_retry_at: string | null
  next_retry_at: string | null

  // Timestamps
  queued_at: string
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
  updated_at: string
}

// =====================================================
// DELIVERY HEALTH
// =====================================================

export interface NotificationHealth {
  id: string
  user_id: string
  channel: NotificationChannel

  // Error counts
  hard_bounce_count: number
  soft_bounce_count: number
  complaint_count: number
  unsubscribe_count: number
  carrier_error_count: number
  delivery_failure_count: number

  // Last error timestamps
  last_hard_bounce: string | null
  last_soft_bounce: string | null
  last_complaint: string | null
  last_unsubscribe: string | null
  last_carrier_error: string | null
  last_delivery_failure: string | null

  // Success metrics
  total_sent: number
  total_delivered: number
  delivery_rate: number | null  // Percentage

  // Channel status
  channel_disabled: boolean
  disabled_reason: string | null
  disabled_at: string | null
  re_enable_requested: boolean
  re_enable_requested_at: string | null

  created_at: string
  updated_at: string
}

// =====================================================
// NOTIFICATION CAMPAIGNS (ADMIN MASS SEND)
// =====================================================

export type CampaignStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sending'
  | 'completed'
  | 'cancelled'
  | 'failed'

export interface NotificationCampaign {
  id: string
  campaign_name: string
  campaign_description: string | null
  channel: NotificationChannel

  // Creator and approver
  created_by: string
  approved_by: string | null

  // Targeting
  target_filter: Record<string, unknown> | null
  excluded_users: string[]

  // Message content
  subject: string | null
  message: string
  template_id: string | null

  // Status workflow
  status: CampaignStatus

  // Canary send (gradual rollout)
  canary_enabled: boolean
  canary_percentage: number
  canary_completed: boolean
  canary_success_threshold: number
  canary_sent_count: number
  canary_delivered_count: number
  canary_failed_count: number

  // Campaign metrics
  total_recipients: number | null
  sent_count: number
  delivered_count: number
  failed_count: number
  bounced_count: number

  // Rate limiting
  send_rate_per_minute: number

  // Timestamps
  created_at: string
  approved_at: string | null
  sending_started_at: string | null
  canary_completed_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  updated_at: string
}

// =====================================================
// CAMPAIGN RECIPIENT
// =====================================================

export interface CampaignRecipient {
  id: string
  campaign_id: string
  user_id: string
  notification_log_id: string | null
  is_canary: boolean
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped'
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
}

// =====================================================
// INBOUND SMS MESSAGE (STOP/UNSTOP/HELP)
// =====================================================

export interface InboundSMSMessage {
  id: string
  message_sid: string
  from_number: string
  to_number: string
  body: string
  user_id: string | null
  command_detected: 'STOP' | 'UNSTOP' | 'START' | 'HELP' | null
  processed: boolean
  processing_error: string | null
  response_sent: boolean
  response_message: string | null
  response_sid: string | null
  media_urls: string[]
  num_media: number
  created_at: string
  processed_at: string | null
}

// =====================================================
// NOTIFICATION TEMPLATE
// =====================================================

export interface NotificationTemplate {
  id: string
  template_key: string
  template_name: string
  description: string | null
  channel: NotificationChannel
  subject_template: string | null
  body_template: string
  html_template: string | null
  variables: Record<string, string>
  is_active: boolean
  created_by: string | null
  last_modified_by: string | null
  version: number
  created_at: string
  updated_at: string
}

// =====================================================
// SEND NOTIFICATION PARAMETERS
// =====================================================

export interface SendNotificationParams {
  userId: string
  type: NotificationType
  channel?: NotificationChannel[]  // Defaults to both email and SMS if enabled
  data: Record<string, unknown>    // Event-specific data for template variables
  forceSkipQuietHours?: boolean   // Override quiet hours (for critical notifications)
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}

// =====================================================
// NOTIFICATION RESULT
// =====================================================

export interface NotificationResult {
  success: boolean
  notificationId?: string
  error?: string
  status: NotificationStatus
  channel: NotificationChannel
  providerId?: string
  deferredUntil?: string  // ISO timestamp if deferred due to quiet hours
}

// =====================================================
// QUIET HOURS CHECK RESULT
// =====================================================

export interface QuietHoursCheckResult {
  inQuietHours: boolean
  deferUntil: Date | null  // When to send if currently in quiet hours
  userTimezone: string
  currentUserTime: Date
}

// =====================================================
// DELIVERY HEALTH UPDATE
// =====================================================

export interface DeliveryHealthUpdate {
  userId: string
  channel: NotificationChannel
  event: 'hard_bounce' | 'soft_bounce' | 'complaint' | 'unsubscribe' | 'carrier_error' | 'delivery_failure' | 'delivered'
  metadata?: Record<string, unknown>
}

// =====================================================
// CAMPAIGN TARGET FILTER
// =====================================================

export interface CampaignTargetFilter {
  role?: 'user' | 'admin' | 'superadmin'
  membership_status?: string[]  // ['unlocked', 'active']
  is_active?: boolean
  initial_payment_completed?: boolean
  min_direct_referrals?: number
  min_network_size?: number
  structure_number?: number[]
  created_after?: string  // ISO date
  created_before?: string
}

// =====================================================
// SEND CAMPAIGN PARAMETERS
// =====================================================

export interface SendCampaignParams {
  campaignId: string
  senderId: string  // Admin user ID
  skipApproval?: boolean  // Only for superadmin
  testMode?: boolean  // Send to sender only for testing
}

// =====================================================
// TWILIO WEBHOOK EVENTS
// =====================================================

export interface TwilioSMSStatusWebhook {
  MessageSid: string
  MessageStatus: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered'
  To: string
  From: string
  ErrorCode?: string
  ErrorMessage?: string
}

export interface TwilioInboundSMSWebhook {
  MessageSid: string
  From: string
  To: string
  Body: string
  NumMedia: string
  MediaUrl0?: string
}

export interface SendGridEmailEventWebhook {
  email: string
  event: 'delivered' | 'bounce' | 'dropped' | 'spam_report' | 'unsubscribe' | 'open' | 'click'
  sg_message_id: string
  timestamp: number
  reason?: string
  bounce_classification?: 'soft' | 'hard'
}
