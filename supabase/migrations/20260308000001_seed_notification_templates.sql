-- Seed notification_templates with SMS templates for new notification types
-- and email fallback templates for types without React Email components

-- SMS templates for new notification types
INSERT INTO notification_templates (template_key, template_name, description, channel, subject_template, body_template, variables, is_active, version)
VALUES
  ('sms_welcome', 'Welcome SMS', 'Welcome message for new users', 'sms', NULL,
   'Welcome to Snipers Trading Academy, {{userName}}! Complete your $499 activation payment to unlock the full platform. Visit your dashboard to get started.',
   '{"userName": "User display name"}'::jsonb, true, 1),

  ('sms_network_join', 'Network Join SMS', 'Someone joined the user''s network', 'sms', NULL,
   '{{newMemberName}} just joined your Snipers Trading Academy network at level {{depth}}! Your team is growing. View your network in the dashboard.',
   '{"newMemberName": "New member name", "depth": "Network depth level"}'::jsonb, true, 1),

  ('sms_account_inactive', 'Account Inactive SMS', 'Account deactivated due to missed payment', 'sms', NULL,
   'Your Snipers Trading Academy account has been deactivated ({{daysOverdue}} days overdue). Update your payment method to reactivate: {{reactivateUrl}}',
   '{"daysOverdue": "Days overdue", "reactivateUrl": "Reactivation URL"}'::jsonb, true, 1),

  ('sms_account_reactivated', 'Account Reactivated SMS', 'Account reactivated after payment', 'sms', NULL,
   'Welcome back to Snipers Trading Academy! Your account is active again. Commission earnings have resumed.',
   '{}'::jsonb, true, 1),

  ('sms_payment_succeeded', 'Payment Succeeded SMS', 'Subscription payment confirmed', 'sms', NULL,
   'Snipers Trading Academy: Your payment of ${{amount}} has been confirmed. Your account remains active.',
   '{"amount": "Payment amount"}'::jsonb, true, 1),

  ('sms_volume_update', 'Volume Update SMS', 'Sniper volume milestone reached', 'sms', NULL,
   'Congrats! Your Snipers Trading Academy sniper volume reached ${{newVolume}} for {{month}}. Higher volume = higher commissions!',
   '{"newVolume": "New volume amount", "month": "Month period"}'::jsonb, true, 1),

  ('sms_monthly_commission', 'Monthly Commission SMS', 'Monthly commission notification', 'sms', NULL,
   'Your Snipers Trading Academy commission for {{month}} is ready: ${{amount}}. View details in your dashboard.',
   '{"month": "Commission period", "amount": "Commission amount"}'::jsonb, true, 1),

  ('sms_structure_milestone', 'Structure Milestone SMS', 'Structure milestone achieved', 'sms', NULL,
   'Congrats! You reached structure {{structureNumber}} on Snipers Trading Academy with {{activeMembers}} active members. New commission rate: {{newRate}}%!',
   '{"structureNumber": "Structure number", "activeMembers": "Active member count", "newRate": "New commission rate"}'::jsonb, true, 1)

ON CONFLICT (template_key, channel) DO NOTHING;

-- Email subject templates for new notification types (used by direct-send.ts for subject lines)
INSERT INTO notification_templates (template_key, template_name, description, channel, subject_template, body_template, variables, is_active, version)
VALUES
  ('email_welcome', 'Welcome Email', 'Welcome email for new users', 'email',
   'Welcome to Snipers Trading Academy, {{userName}}!',
   'Welcome to Snipers Trading Academy! Complete your $499 activation payment to unlock the full platform.',
   '{"userName": "User display name"}'::jsonb, true, 1),

  ('email_network_join', 'Network Join Email', 'Someone joined the user''s network', 'email',
   '{{newMemberName}} joined your network!',
   '{{newMemberName}} has joined your network at level {{depth}}.',
   '{"newMemberName": "New member name", "depth": "Network depth level"}'::jsonb, true, 1),

  ('email_account_inactive', 'Account Inactive Email', 'Account deactivated notification', 'email',
   'Your Snipers Trading Academy account has been deactivated',
   'Your account has been deactivated because your payment is {{daysOverdue}} days overdue.',
   '{"daysOverdue": "Days overdue"}'::jsonb, true, 1),

  ('email_account_reactivated', 'Account Reactivated Email', 'Account reactivated notification', 'email',
   'Welcome back! Your account is active again',
   'Your Snipers Trading Academy account has been reactivated.',
   '{}'::jsonb, true, 1),

  ('email_payment_succeeded', 'Payment Succeeded Email', 'Payment confirmed notification', 'email',
   'Payment of ${{amount}} confirmed',
   'Your subscription payment of ${{amount}} has been successfully processed.',
   '{"amount": "Payment amount"}'::jsonb, true, 1),

  ('email_volume_update', 'Volume Update Email', 'Volume milestone notification', 'email',
   'Your sniper volume reached a new milestone!',
   'Your sniper volume for {{month}} has reached ${{newVolume}}.',
   '{"newVolume": "New volume amount", "month": "Month period"}'::jsonb, true, 1)

ON CONFLICT (template_key, channel) DO NOTHING;
