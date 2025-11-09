/**
 * MONTHLY COMMISSION EMAIL TEMPLATE
 *
 * Sent when monthly residual commissions are processed
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

interface MonthlyCommissionEmailProps {
  userName?: string
  amount?: number
  month?: string
  dashboardUrl?: string
}

export const MonthlyCommissionEmail = ({
  userName = 'Member',
  amount = 149.50,
  month = 'November 2025',
  dashboardUrl = 'https://tradinghub.com/dashboard'
}: MonthlyCommissionEmailProps) => {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)

  return (
    <Html>
      <Head />
      <Preview>Your {month} commission of {formattedAmount} is ready!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Heading style={h1}>Trading Hub</Heading>
          </Section>

          {/* Success Icon */}
          <Section style={iconSection}>
            <Text style={successIcon}>💰</Text>
          </Section>

          {/* Main Content */}
          <Heading style={h2}>Monthly Commission Earned!</Heading>

          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            Great news! Your monthly residual commission for <strong>{month}</strong> has been calculated and is ready for payout.
          </Text>

          {/* Amount Box */}
          <Section style={amountBox}>
            <Text style={amountLabel}>Commission Amount</Text>
            <Text style={amountValue}>{formattedAmount}</Text>
          </Section>

          <Text style={text}>
            This commission comes from the ongoing activity of your network. Your residual income is a result of the relationships you&apos;ve built and the value you&apos;ve created.
          </Text>

          {/* Info Section */}
          <Section style={infoBox}>
            <Text style={infoTitle}>📅 Payment Timeline</Text>
            <Text style={infoText}>
              <strong>Processed:</strong> Now
              <br />
              <strong>Transfer initiated:</strong> Within 24 hours
              <br />
              <strong>Expected arrival:</strong> 2-5 business days
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={dashboardUrl}>
              View Dashboard
            </Button>
          </Section>

          <Text style={text}>
            Your commission will be transferred to your connected bank account. You can track all your earnings and payouts in your dashboard.
          </Text>

          {/* Tips Section */}
          <Section style={tipsBox}>
            <Text style={tipsTitle}>💡 Keep Growing</Text>
            <Text style={tipsText}>
              • Your residual income grows as your network expands
              <br />
              • Share your referral link to add more members
              <br />
              • Engaged members create more sustainable income
              <br />
              • Check your team dashboard for growth insights
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Need help? <Link href={`${dashboardUrl}/../settings`} style={link}>Contact Support</Link>
            </Text>
            <Text style={footerText}>
              <Link href={`${dashboardUrl}/../notifications`} style={link}>
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

export default MonthlyCommissionEmail

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

const amountBox = {
  backgroundColor: '#f0fdf4',
  border: '2px solid #059669',
  borderRadius: '12px',
  margin: '32px 20px',
  padding: '32px',
  textAlign: 'center' as const
}

const amountLabel = {
  color: '#065f46',
  fontSize: '14px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px 0'
}

const amountValue = {
  color: '#059669',
  fontSize: '48px',
  fontWeight: '700',
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

const tipsBox = {
  backgroundColor: '#fefce8',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '20px'
}

const tipsTitle = {
  color: '#854d0e',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0'
}

const tipsText = {
  color: '#713f12',
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
