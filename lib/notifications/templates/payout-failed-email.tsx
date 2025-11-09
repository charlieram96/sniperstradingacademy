/**
 * PAYOUT FAILED EMAIL TEMPLATE
 *
 * Sent when a commission payout fails to process
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text
} from '@react-email/components'
import * as React from 'react'

interface PayoutFailedEmailProps {
  userName?: string
  amount?: number
  reason?: string
  settingsUrl?: string
}

export const PayoutFailedEmail = ({
  userName = 'Member',
  amount = 149.50,
  reason = 'Bank account not verified',
  settingsUrl = 'https://tradinghub.com/settings'
}: PayoutFailedEmailProps) => {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)

  return (
    <Html>
      <Head />
      <Preview>Action required: Commission payout of {formattedAmount} needs attention</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Heading style={h1}>Trading Hub</Heading>
          </Section>

          {/* Warning Icon */}
          <Section style={iconSection}>
            <Text style={warningIcon}>⚠️</Text>
          </Section>

          {/* Main Content */}
          <Heading style={h2}>Commission Payout Needs Attention</Heading>

          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            We attempted to process your commission payout of <strong>{formattedAmount}</strong>, but encountered an issue that needs your attention.
          </Text>

          {/* Error Box */}
          <Section style={errorBox}>
            <Text style={errorTitle}>⚠️ Issue Detected</Text>
            <Text style={errorText}>
              {reason}
            </Text>
          </Section>

          <Text style={text}>
            <strong>Common reasons and solutions:</strong>
          </Text>

          <Section style={reasonsList}>
            <Text style={reasonItem}>
              <strong>• Bank account not verified:</strong> Complete your Stripe Express onboarding to verify your bank account details.
            </Text>
            <Text style={reasonItem}>
              <strong>• No Stripe Connect account:</strong> Connect your bank account through your settings to receive payouts.
            </Text>
            <Text style={reasonItem}>
              <strong>• Account restrictions:</strong> Check your Stripe Express dashboard for any pending requirements or restrictions.
            </Text>
            <Text style={reasonItem}>
              <strong>• Invalid banking information:</strong> Update your bank account details in your Stripe Express account.
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={settingsUrl}>
              Update Payment Settings
            </Button>
          </Section>

          {/* Info Section */}
          <Section style={infoBox}>
            <Text style={infoTitle}>What Happens Next?</Text>
            <Text style={infoText}>
              <strong>Your commission is safe:</strong> The funds are held securely
              <br />
              <strong>Fix the issue:</strong> Update your payment settings
              <br />
              <strong>Automatic retry:</strong> We&apos;ll retry the payout once the issue is resolved
              <br />
              <strong>Need help?</strong> Contact our support team for assistance
            </Text>
          </Section>

          <Text style={text}>
            Your earned commission of {formattedAmount} is waiting for you. Please take a moment to resolve this issue so we can complete your payout.
          </Text>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Need help? <Link href={`${settingsUrl}/../support`} style={link}>Contact Support</Link>
            </Text>
            <Text style={footerText}>
              <Link href={`${settingsUrl}/../notifications`} style={link}>
                Manage notification preferences
              </Link>
            </Text>
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} Trading Hub. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default PayoutFailedEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif'
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px'
}

const logoSection = {
  padding: '32px 20px'
}

const h1 = {
  color: '#1f2937',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0',
  textAlign: 'center' as const
}

const iconSection = {
  textAlign: 'center' as const,
  padding: '20px 0'
}

const warningIcon = {
  fontSize: '64px',
  margin: '0'
}

const h2 = {
  color: '#d97706',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '20px 0',
  textAlign: 'center' as const
}

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '16px 20px'
}

const errorBox = {
  backgroundColor: '#fef3c7',
  border: '2px solid #f59e0b',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '24px',
  textAlign: 'center' as const
}

const errorTitle = {
  color: '#92400e',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0 0 12px 0'
}

const errorText = {
  color: '#78350f',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0'
}

const reasonsList = {
  margin: '16px 20px'
}

const reasonItem = {
  color: '#4b5563',
  fontSize: '15px',
  lineHeight: '1.8',
  margin: '12px 0',
  paddingLeft: '8px'
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0'
}

const button = {
  backgroundColor: '#f59e0b',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 36px'
}

const infoBox = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '20px'
}

const infoTitle = {
  color: '#1e40af',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0'
}

const infoText = {
  color: '#1e3a8a',
  fontSize: '14px',
  lineHeight: '1.8',
  margin: '0'
}

const footer = {
  borderTop: '1px solid #e5e7eb',
  margin: '32px 20px 0',
  padding: '20px 0 0'
}

const footerText = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '1.6',
  margin: '8px 0',
  textAlign: 'center' as const
}

const footerCopyright = {
  color: '#9ca3af',
  fontSize: '12px',
  margin: '16px 0 0 0',
  textAlign: 'center' as const
}

const link = {
  color: '#3b82f6',
  textDecoration: 'underline'
}
