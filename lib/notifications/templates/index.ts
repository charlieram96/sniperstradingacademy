/**
 * TEMPLATE REGISTRY
 *
 * Maps notification types to their React Email components.
 * Used by direct-send.ts to render branded HTML emails
 * instead of plain-text DB templates.
 */

import type { NotificationType } from '../notification-types'

import { ReferralSignupEmail } from './referral-signup-email'
import { DirectBonusEmail } from './direct-bonus-email'
import { MonthlyCommissionEmail } from './monthly-commission-email'
import { PayoutProcessedEmail } from './payout-processed-email'
import { PayoutFailedEmail } from './payout-failed-email'
import { PaymentFailedEmail } from './payment-failed-email'
import { StructureMilestoneEmail } from './structure-milestone-email'
import { AdminAnnouncementEmail } from './admin-announcement-email'
import { WelcomeEmail } from './welcome-email'
import { NetworkJoinEmail } from './network-join-email'
import { AccountInactiveEmail } from './account-inactive-email'
import { AccountReactivatedEmail } from './account-reactivated-email'
import { PaymentSucceededEmail } from './payment-succeeded-email'
import { VolumeUpdateEmail } from './volume-update-email'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactEmailComponent = React.ComponentType<any>

export const templateRegistry: Partial<Record<NotificationType, ReactEmailComponent>> = {
  referral_signup: ReferralSignupEmail,
  direct_bonus: DirectBonusEmail,
  monthly_commission: MonthlyCommissionEmail,
  payout_processed: PayoutProcessedEmail,
  payout_failed: PayoutFailedEmail,
  payment_failed: PaymentFailedEmail,
  structure_milestone: StructureMilestoneEmail,
  admin_announcement: AdminAnnouncementEmail,
  welcome: WelcomeEmail,
  network_join: NetworkJoinEmail,
  account_inactive: AccountInactiveEmail,
  account_reactivated: AccountReactivatedEmail,
  payment_succeeded: PaymentSucceededEmail,
  volume_update: VolumeUpdateEmail,
}

export function getEmailTemplate(type: NotificationType): ReactEmailComponent | null {
  return templateRegistry[type] || null
}
