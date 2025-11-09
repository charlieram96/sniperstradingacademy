/**
 * TWILIO SMS SERVICE
 *
 * Handles SMS sending via Twilio with compliance features:
 * - STOP/UNSTOP/HELP command handling
 * - Delivery status tracking
 * - Carrier error handling
 * - International SMS support
 */

import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

if (!accountSid || !authToken) {
  console.warn('Twilio credentials not configured. SMS service will not work.')
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null

export interface SendSMSParams {
  to: string
  message: string
  statusCallback?: string  // Webhook URL for delivery status
}

export interface SendSMSResult {
  success: boolean
  messageSid?: string
  error?: string
  errorCode?: string
}

/**
 * Send an SMS via Twilio
 *
 * @param params SMS parameters
 * @returns SendSMSResult with success status and message SID
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  if (!client) {
    return {
      success: false,
      error: 'Twilio client not initialized. Check environment variables.',
      errorCode: 'TWILIO_NOT_CONFIGURED'
    }
  }

  try {
    // Validate phone number format
    if (!isValidPhoneNumber(params.to)) {
      return {
        success: false,
        error: 'Invalid phone number format. Must include country code (e.g., +1234567890)',
        errorCode: 'INVALID_PHONE_NUMBER'
      }
    }

    // Truncate message if too long (SMS limit is 1600 chars for concatenated messages)
    const message = params.message.length > 1600
      ? params.message.substring(0, 1597) + '...'
      : params.message

    const messageParams: {
      to: string
      body: string
      from?: string
      messagingServiceSid?: string
      statusCallback?: string
    } = {
      to: params.to,
      body: message
    }

    // Use Messaging Service SID if available (recommended for production)
    if (messagingServiceSid) {
      messageParams.messagingServiceSid = messagingServiceSid
    } else if (twilioPhoneNumber) {
      messageParams.from = twilioPhoneNumber
    } else {
      return {
        success: false,
        error: 'No Twilio phone number or messaging service configured',
        errorCode: 'NO_SENDER_CONFIGURED'
      }
    }

    // Add status callback webhook if provided
    if (params.statusCallback) {
      messageParams.statusCallback = params.statusCallback
    }

    const twilioMessage = await client.messages.create(messageParams)

    return {
      success: true,
      messageSid: twilioMessage.sid
    }
  } catch (error) {
    console.error('Error sending SMS:', error)

    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      return {
        success: false,
        error: String(error.message),
        errorCode: String(error.code)
      }
    }

    return {
      success: false,
      error: 'Unknown error sending SMS',
      errorCode: 'UNKNOWN_ERROR'
    }
  }
}

/**
 * Validate phone number format
 *
 * Must be in E.164 format: +[country code][number]
 * Example: +14155552671
 *
 * @param phoneNumber Phone number to validate
 * @returns True if valid
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  // E.164 format: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/
  return e164Regex.test(phoneNumber)
}

/**
 * Format phone number to E.164 format
 *
 * @param phoneNumber Phone number (can be various formats)
 * @param defaultCountryCode Default country code if not provided (e.g., '1' for US)
 * @returns Formatted phone number or null if invalid
 */
export function formatPhoneNumber(
  phoneNumber: string,
  defaultCountryCode: string = '1'
): string | null {
  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '')

  // If already has country code
  if (phoneNumber.startsWith('+')) {
    return isValidPhoneNumber(phoneNumber) ? phoneNumber : null
  }

  // Add default country code if missing
  let formatted: string
  if (digitsOnly.length === 10 && defaultCountryCode === '1') {
    // US/Canada number without country code
    formatted = `+1${digitsOnly}`
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // US/Canada number with country code but no +
    formatted = `+${digitsOnly}`
  } else {
    // Assume it needs the default country code
    formatted = `+${defaultCountryCode}${digitsOnly}`
  }

  return isValidPhoneNumber(formatted) ? formatted : null
}

/**
 * Get SMS delivery status from Twilio
 *
 * @param messageSid Twilio Message SID
 * @returns Message status
 */
export async function getSMSStatus(messageSid: string): Promise<{
  status: string
  errorCode?: string
  errorMessage?: string
} | null> {
  if (!client) {
    return null
  }

  try {
    const message = await client.messages(messageSid).fetch()

    return {
      status: message.status,
      errorCode: message.errorCode ? String(message.errorCode) : undefined,
      errorMessage: message.errorMessage || undefined
    }
  } catch (error) {
    console.error('Error fetching SMS status:', error)
    return null
  }
}

/**
 * Check if a country code is supported for SMS delivery
 *
 * Some countries have restricted SMS delivery or require pre-registration
 *
 * @param countryCode ISO country code (e.g., 'US', 'GB', 'CN')
 * @returns Object with support status and any restrictions
 */
export function checkCountrySMSSupport(countryCode: string): {
  supported: boolean
  restrictions?: string
  alternativeChannel?: 'whatsapp' | 'email'
} {
  // Countries with known SMS restrictions
  const restrictedCountries: Record<string, { restrictions: string; alternative: 'whatsapp' | 'email' }> = {
    'CN': { restrictions: 'SMS delivery unreliable in China', alternative: 'whatsapp' },
    'CU': { restrictions: 'SMS not available in Cuba', alternative: 'email' },
    'IR': { restrictions: 'SMS not available in Iran', alternative: 'email' },
    'KP': { restrictions: 'SMS not available in North Korea', alternative: 'email' },
    'SD': { restrictions: 'SMS not available in Sudan', alternative: 'email' },
    'SY': { restrictions: 'SMS not available in Syria', alternative: 'email' }
  }

  const restriction = restrictedCountries[countryCode.toUpperCase()]

  if (restriction) {
    return {
      supported: false,
      restrictions: restriction.restrictions,
      alternativeChannel: restriction.alternative
    }
  }

  return { supported: true }
}

/**
 * Detect country code from phone number
 *
 * @param phoneNumber Phone number in E.164 format
 * @returns Country calling code (e.g., '1' for US/Canada, '44' for UK)
 */
export function getCountryCodeFromPhone(phoneNumber: string): string | null {
  if (!phoneNumber.startsWith('+')) {
    return null
  }

  // Extract country code (1-3 digits after +)
  const match = phoneNumber.match(/^\+(\d{1,3})/)
  return match ? match[1] : null
}

/**
 * Template variable replacement for SMS messages
 *
 * Replaces {{variableName}} with actual values
 *
 * @param template Message template with {{variables}}
 * @param variables Key-value pairs for replacement
 * @returns Formatted message
 */
export function formatSMSTemplate(
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
 * STOP command response (required by TCPA)
 */
export const STOP_RESPONSE = 'You have been unsubscribed from SMS notifications. Reply START to opt back in. Msg&data rates may apply.'

/**
 * START/UNSTOP command response
 */
export const START_RESPONSE = 'You have been resubscribed to SMS notifications. Reply STOP to opt out. Msg&data rates may apply.'

/**
 * HELP command response
 */
export const HELP_RESPONSE = 'Trading Hub SMS notifications. Reply STOP to unsubscribe or START to resubscribe. For support, visit your account dashboard. Msg&data rates may apply.'
