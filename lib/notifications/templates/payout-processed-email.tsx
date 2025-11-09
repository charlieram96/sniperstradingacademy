/**
 * PAYOUT PROCESSED EMAIL TEMPLATE
 *
 * Sent when a commission payout is successfully transferred to user's bank account
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

interface PayoutProcessedEmailProps {
  userName?: string
  amount?: number
  commissionType?: string
  arrivalDate?: string
  dashboardUrl?: string
}

export const PayoutProcessedEmail = ({
  userName = 'Member',
  amount = 249.50,
  commissionType = 'Direct Bonus',
  arrivalDate = '2-7 business days',
  dashboardUrl = 'https://tradinghub.com/dashboard'
}: PayoutProcessedEmailProps) => {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)

  return (
    <Html>
      <Head />
      <Preview>Your ${formattedAmount} payout is on the way!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Heading style={h1}>Trading Hub</Heading>
          </Section>

          {/* Success Icon */}
          <Section style={iconSection}>
            <Text style={successIcon}>✅</Text>
          </Section>

          {/* Main Content */}
          <Heading style={h2}>Payout Processed!</Heading>

          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            Great news! Your commission payout has been successfully transferred to your connected bank account.
          </Text>

          {/* Amount Box */}
          <Section style={amountBox}>
            <Text style={amountLabel}>Amount</Text>
            <Text style={amountValue}>{formattedAmount}</Text>
            <Text style={commissionTypeText}>{commissionType}</Text>
          </Section>

          <Text style={text}>
            Your payout should arrive in your bank account within {arrivalDate}.
            The exact timing depends on your bank&apos;s processing schedule.
          </Text>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={dashboardUrl}>
              View Your Dashboard
            </Button>
          </Section>

          {/* Info Section */}
          <Section style={infoBox}>
            <Text style={infoTitle}>What&apos;s Next?</Text>
            <Text style={infoText}>
              • Check your bank account in 2-7 business days
              <br />
              • View your payout history in the Finance page
              <br />
              • Continue growing your network to earn more
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Questions about your payout?{' '}
              <Link href={`${dashboardUrl}/settings`} style={link}>
                Contact Support
              </Link>
            </Text>
            <Text style={footerText}>
              You&apos;re receiving this email because a payout was processed on your Trading Hub account.
              <br />
              <Link href={`${dashboardUrl}/notifications`} style={link}>
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

export default PayoutProcessedEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif'
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

const successIcon = {
  fontSize: '64px',
  margin: '0'
}

const h2 = {
  color: '#1f2937',
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

const amountBox = {
  backgroundColor: '#f0fdf4',
  border: '2px solid #10b981',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '24px',
  textAlign: 'center' as const
}

const amountLabel = {
  color: '#059669',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px'
}

const amountValue = {
  color: '#047857',
  fontSize: '36px',
  fontWeight: '700',
  margin: '0'
}

const commissionTypeText = {
  color: '#059669',
  fontSize: '14px',
  margin: '8px 0 0 0'
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0'
}

const button = {
  backgroundColor: '#3b82f6',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px'
}

const infoBox = {
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '20px'
}

const infoTitle = {
  color: '#1f2937',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0'
}

const infoText = {
  color: '#4b5563',
  fontSize: '14px',
  lineHeight: '1.6',
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
