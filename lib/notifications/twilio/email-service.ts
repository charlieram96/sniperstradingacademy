/**
 * TWILIO EMAIL SERVICE (SendGrid)
 *
 * Handles email sending via SendGrid (owned by Twilio)
 * Supports:
 * - Transactional emails with templates
 * - HTML and plain text versions
 * - Bounce and complaint tracking
 * - Delivery status webhooks
 */

import sgMail from '@sendgrid/mail'

const sendGridApiKey = process.env.TWILIO_SENDGRID_API_KEY
const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'notifications@tradinghub.com'
const fromName = process.env.SENDGRID_FROM_NAME || 'Trading Hub'

if (!sendGridApiKey) {
  console.warn('SendGrid API key not configured. Email service will not work.')
} else {
  sgMail.setApiKey(sendGridApiKey)
}

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string  // Plain text version (auto-generated if not provided)
  replyTo?: string
  trackingSettings?: {
    clickTracking?: boolean
    openTracking?: boolean
  }
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
  errorCode?: string
}

/**
 * Send an email via SendGrid
 *
 * @param params Email parameters
 * @returns SendEmailResult with success status and message ID
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!sendGridApiKey) {
    return {
      success: false,
      error: 'SendGrid API key not configured. Check environment variables.',
      errorCode: 'SENDGRID_NOT_CONFIGURED'
    }
  }

  try {
    // Validate email address
    if (!isValidEmail(params.to)) {
      return {
        success: false,
        error: 'Invalid email address format',
        errorCode: 'INVALID_EMAIL'
      }
    }

    const msg = {
      to: params.to,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: params.subject,
      html: params.html,
      text: params.text || stripHtmlTags(params.html),
      replyTo: params.replyTo,
      trackingSettings: {
        clickTracking: {
          enable: params.trackingSettings?.clickTracking ?? true
        },
        openTracking: {
          enable: params.trackingSettings?.openTracking ?? true
        }
      },
      // Add custom args for tracking (will appear in webhooks)
      customArgs: {
        source: 'notification-system',
        timestamp: new Date().toISOString()
      }
    }

    const [response] = await sgMail.send(msg)

    return {
      success: true,
      messageId: response.headers['x-message-id'] as string
    }
  } catch (error) {
    console.error('Error sending email:', error)

    if (error && typeof error === 'object' && 'code' in error && 'response' in error) {
      const sgError = error as { code: number; response?: { body?: { errors?: Array<{ message: string }> } } }
      return {
        success: false,
        error: sgError.response?.body?.errors?.[0]?.message || 'SendGrid error',
        errorCode: String(sgError.code)
      }
    }

    return {
      success: false,
      error: 'Unknown error sending email',
      errorCode: 'UNKNOWN_ERROR'
    }
  }
}

/**
 * Send bulk emails (for campaigns)
 *
 * SendGrid recommends sending max 1000 emails per API call
 *
 * @param emails Array of email parameters
 * @returns Array of results
 */
export async function sendBulkEmails(
  emails: SendEmailParams[]
): Promise<SendEmailResult[]> {
  if (!sendGridApiKey) {
    return emails.map(() => ({
      success: false,
      error: 'SendGrid API key not configured',
      errorCode: 'SENDGRID_NOT_CONFIGURED'
    }))
  }

  // SendGrid supports batch sending
  const messages = emails.map(email => ({
    to: email.to,
    from: {
      email: fromEmail,
      name: fromName
    },
    subject: email.subject,
    html: email.html,
    text: email.text || stripHtmlTags(email.html),
    replyTo: email.replyTo,
    trackingSettings: {
      clickTracking: {
        enable: email.trackingSettings?.clickTracking ?? true
      },
      openTracking: {
        enable: email.trackingSettings?.openTracking ?? true
      }
    }
  }))

  try {
    await sgMail.send(messages)

    return emails.map(() => ({
      success: true
    }))
  } catch (error) {
    console.error('Error sending bulk emails:', error)

    // If batch fails, return error for all
    return emails.map(() => ({
      success: false,
      error: 'Bulk send failed',
      errorCode: 'BULK_SEND_ERROR'
    }))
  }
}

/**
 * Validate email address format
 *
 * @param email Email address to validate
 * @returns True if valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Strip HTML tags for plain text version
 *
 * @param html HTML content
 * @returns Plain text content
 */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>.*<\/style>/gm, '')
    .replace(/<script[^>]*>.*<\/script>/gm, '')
    .replace(/<[^>]+>/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/**
 * Template variable replacement for email content
 *
 * Replaces {{variableName}} with actual values
 *
 * @param template Email template with {{variables}}
 * @param variables Key-value pairs for replacement
 * @returns Formatted content
 */
export function formatEmailTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  let formatted = template

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    formatted = formatted.replace(new RegExp(placeholder, 'g'), String(value))
  })

  return formatted
}

/**
 * Create unsubscribe link
 *
 * @param userId User ID
 * @param baseUrl Base URL of the application
 * @returns Unsubscribe URL
 */
export function createUnsubscribeLink(userId: string, baseUrl: string): string {
  return `${baseUrl}/notifications?unsubscribe=${userId}`
}

/**
 * Add unsubscribe footer to email HTML
 *
 * Required by CAN-SPAM Act
 *
 * @param html Original HTML content
 * @param unsubscribeUrl Unsubscribe URL
 * @returns HTML with unsubscribe footer
 */
export function addUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  const footer = `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
      <p>
        You're receiving this email because you have an account with Trading Hub.<br>
        <a href="${unsubscribeUrl}" style="color: #3b82f6; text-decoration: underline;">Manage notification preferences</a>
      </p>
      <p style="margin-top: 10px;">
        Trading Hub<br>
        &copy; ${new Date().getFullYear()} All rights reserved.
      </p>
    </div>
  `

  // Insert footer before closing body tag, or append if no body tag
  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`)
  }

  return html + footer
}

/**
 * Check if email domain is valid (not a disposable email)
 *
 * @param email Email address
 * @returns True if domain is valid
 */
export function isValidEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()

  if (!domain) {
    return false
  }

  // List of common disposable email domains to block
  const disposableDomains = [
    'tempmail.com',
    'throwaway.email',
    'guerrillamail.com',
    'mailinator.com',
    '10minutemail.com',
    'yopmail.com'
  ]

  return !disposableDomains.includes(domain)
}
