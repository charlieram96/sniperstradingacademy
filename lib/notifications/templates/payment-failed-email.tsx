/**
 * PAYMENT FAILED EMAIL TEMPLATE
 *
 * Sent when subscription payment fails (critical notification)
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

interface PaymentFailedEmailProps {
  userName?: string
  amount?: number
  paymentUrl?: string
}

export const PaymentFailedEmail = ({
  userName = 'Member',
  amount = 199,
  paymentUrl = 'https://tradinghub.com/payments'
}: PaymentFailedEmailProps) => {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)

  return (
    <Html>
      <Head />
      <Preview>⚠️ Payment failed - Action required to keep your account active</Preview>
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
          <Heading style={h2}>Payment Failed</Heading>

          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            We were unable to process your subscription payment of <strong>{formattedAmount}</strong>. Your account will remain active for the next <strong>33 days</strong>, but action is required to avoid service interruption.
          </Text>

          {/* Alert Box */}
          <Section style={alertBox}>
            <Text style={alertTitle}>⏰ Action Required</Text>
            <Text style={alertText}>
              Please update your payment method within 33 days to keep your account active and maintain your position in the network.
            </Text>
          </Section>

          <Text style={text}>
            <strong>Common reasons for payment failure:</strong>
          </Text>

          <Section style={reasonsList}>
            <Text style={reasonItem}>• Insufficient funds in your account</Text>
            <Text style={reasonItem}>• Expired or invalid credit card</Text>
            <Text style={reasonItem}>• Card limit reached</Text>
            <Text style={reasonItem}>• Bank declined the transaction</Text>
          </Section>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={paymentUrl}>
              Update Payment Method
            </Button>
          </Section>

          {/* Info Section */}
          <Section style={infoBox}>
            <Text style={infoTitle}>What Happens Next?</Text>
            <Text style={infoText}>
              <strong>Now - Day 33:</strong> Your account remains active
              <br />
              <strong>After Day 33:</strong> Account becomes inactive
              <br />
              <strong>After Inactive:</strong> Commission earnings paused until reactivation
            </Text>
          </Section>

          <Text style={text}>
            To avoid any interruption to your earnings and maintain your network position, please update your payment method as soon as possible.
          </Text>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Need help? <Link href={`${paymentUrl}/../settings`} style={link}>Contact Support</Link>
            </Text>
            <Text style={footerText}>
              <Link href={`${paymentUrl}/../notifications`} style={link}>
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

export default PaymentFailedEmail

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
  color: '#dc2626',
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

const alertBox = {
  backgroundColor: '#fef2f2',
  border: '2px solid #ef4444',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '24px',
  textAlign: 'center' as const
}

const alertTitle = {
  color: '#dc2626',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0 0 12px 0'
}

const alertText = {
  color: '#991b1b',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0'
}

const reasonsList = {
  margin: '16px 40px'
}

const reasonItem = {
  color: '#4b5563',
  fontSize: '15px',
  lineHeight: '1.8',
  margin: '4px 0'
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0'
}

const button = {
  backgroundColor: '#dc2626',
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
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '20px'
}

const infoTitle = {
  color: '#92400e',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0'
}

const infoText = {
  color: '#78350f',
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
