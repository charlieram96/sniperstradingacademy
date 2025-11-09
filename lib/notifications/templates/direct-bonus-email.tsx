/**
 * DIRECT BONUS EMAIL TEMPLATE
 *
 * Sent when user earns a $249.50 direct referral bonus
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

interface DirectBonusEmailProps {
  userName?: string
  referredName?: string
  amount?: number
  dashboardUrl?: string
}

export const DirectBonusEmail = ({
  userName = 'Member',
  referredName = 'New Member',
  amount = 249.50,
  dashboardUrl = 'https://tradinghub.com/dashboard'
}: DirectBonusEmailProps) => {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)

  return (
    <Html>
      <Head />
      <Preview>💰 You earned {formattedAmount}!</Preview>
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
          <Heading style={h2}>You Earned a Direct Bonus!</Heading>

          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            Congratulations! {referredName} just completed their initial payment and activated their account. Your direct referral bonus has been credited to your account!
          </Text>

          {/* Amount Box */}
          <Section style={amountBox}>
            <Text style={amountLabel}>Direct Referral Bonus</Text>
            <Text style={amountValue}>{formattedAmount}</Text>
            <Text style={statusText}>✓ Pending Payout</Text>
          </Section>

          <Text style={text}>
            This bonus is now in <strong>pending status</strong> and will be paid out to your connected bank account on the <strong>15th of next month</strong> during our regular payout cycle.
          </Text>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={`${dashboardUrl}/finance`}>
              View Your Earnings
            </Button>
          </Section>

          {/* Info Section */}
          <Section style={infoBox}>
            <Text style={infoTitle}>What Happens Next?</Text>
            <Text style={infoText}>
              <strong>Now:</strong> Your ${formattedAmount} bonus is pending
              <br />
              <strong>15th of next month:</strong> Payout processed to your bank
              <br />
              <strong>2-7 business days later:</strong> Funds arrive in your account
            </Text>
          </Section>

          <Text style={text}>
            Keep growing your network! Each new referral who activates their account earns you another ${formattedAmount}.
          </Text>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              <Link href={`${dashboardUrl}/finance`} style={link}>
                View earnings
              </Link>
              {' · '}
              <Link href={`${dashboardUrl}/team`} style={link}>
                View your team
              </Link>
              {' · '}
              <Link href={`${dashboardUrl}/notifications`} style={link}>
                Manage notifications
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

export default DirectBonusEmail

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
  fontSize: '48px',
  fontWeight: '700',
  margin: '0'
}

const statusText = {
  color: '#059669',
  fontSize: '14px',
  margin: '12px 0 0 0',
  fontWeight: '600'
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
