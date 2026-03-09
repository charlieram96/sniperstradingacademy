/**
 * ACCOUNT INACTIVE EMAIL TEMPLATE
 *
 * Sent when a user's account is deactivated due to missed payment
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

interface AccountInactiveEmailProps {
  userName?: string
  daysOverdue?: number
  reactivateUrl?: string
}

export const AccountInactiveEmail = ({
  userName = 'Member',
  daysOverdue = 3,
  reactivateUrl = 'https://sniperstradingacademy.com/payments'
}: AccountInactiveEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your Snipers Trading Academy account has been deactivated</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Heading style={h1}>Snipers Trading Academy</Heading>
          </Section>

          {/* Warning Icon */}
          <Section style={iconSection}>
            <Text style={warningIcon}>⚠️</Text>
          </Section>

          {/* Main Content */}
          <Heading style={h2}>Account Deactivated</Heading>

          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            Your account has been deactivated because your subscription payment is {daysOverdue} days overdue. While your account is inactive:
          </Text>

          {/* Alert Box */}
          <Section style={alertBox}>
            <Text style={alertTitle}>What&apos;s Affected</Text>
            <Text style={alertText}>
              • Commission earnings are paused
              <br />
              • Your network position is preserved
              <br />
              • You are not counted as active for your upline
            </Text>
          </Section>

          <Text style={text}>
            The good news is that your network position and history are saved. You can reactivate your account at any time by updating your payment method.
          </Text>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={reactivateUrl}>
              Reactivate My Account
            </Button>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Questions? <Link href="https://sniperstradingacademy.com/settings" style={link}>Contact Support</Link>
            </Text>
            <Text style={footerText}>
              <Link href="https://sniperstradingacademy.com/notifications" style={link}>
                Manage notification preferences
              </Link>
            </Text>
            <Text style={footerCopyright}>
              &copy; {new Date().getFullYear()} Snipers Trading Academy. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default AccountInactiveEmail

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
  padding: '24px'
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
  lineHeight: '1.8',
  margin: '0'
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
