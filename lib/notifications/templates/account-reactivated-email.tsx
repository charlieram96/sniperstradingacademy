/**
 * ACCOUNT REACTIVATED EMAIL TEMPLATE
 *
 * Sent when a user's account becomes active again after payment
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

interface AccountReactivatedEmailProps {
  userName?: string
  dashboardUrl?: string
}

export const AccountReactivatedEmail = ({
  userName = 'Member',
  dashboardUrl = 'https://sniperstradingacademy.com/dashboard'
}: AccountReactivatedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome back! Your account is active again</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Heading style={h1}>Snipers Trading Academy</Heading>
          </Section>

          {/* Success Icon */}
          <Section style={iconSection}>
            <Text style={successIcon}>✅</Text>
          </Section>

          {/* Main Content */}
          <Heading style={h2}>Welcome Back!</Heading>

          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            Great news! Your account has been reactivated and you&apos;re back in action. All your benefits have been restored:
          </Text>

          {/* Success Box */}
          <Section style={successBox}>
            <Text style={successTitle}>Account Restored</Text>
            <Text style={successText}>
              • Commission earnings resumed
              <br />
              • Network position fully active
              <br />
              • You&apos;re counted as active for your upline again
            </Text>
          </Section>

          <Text style={text}>
            Your team missed you! Get back to building your network and growing your earnings.
          </Text>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={dashboardUrl}>
              Go to Dashboard
            </Button>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              <Link href={`${dashboardUrl}/notifications`} style={link}>
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

export default AccountReactivatedEmail

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

const successIcon = {
  fontSize: '64px',
  margin: '0'
}

const h2 = {
  color: '#059669',
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

const successBox = {
  backgroundColor: '#f0fdf4',
  border: '2px solid #10b981',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '24px'
}

const successTitle = {
  color: '#059669',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0 0 12px 0'
}

const successText = {
  color: '#065f46',
  fontSize: '15px',
  lineHeight: '1.8',
  margin: '0'
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0'
}

const button = {
  backgroundColor: '#059669',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px'
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
