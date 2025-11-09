/**
 * REFERRAL SIGNUP EMAIL TEMPLATE
 *
 * Sent when someone signs up using the user's referral code
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

interface ReferralSignupEmailProps {
  userName?: string
  referredName?: string
  referredEmail?: string
  referralCode?: string
  dashboardUrl?: string
}

export const ReferralSignupEmail = ({
  userName = 'Member',
  referredName = 'New Member',
  referredEmail = 'newmember@example.com',
  referralCode = 'YOUR-CODE',
  dashboardUrl = 'https://tradinghub.com/dashboard'
}: ReferralSignupEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>🎉 {referredName} just joined your network!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Heading style={h1}>Trading Hub</Heading>
          </Section>

          {/* Success Icon */}
          <Section style={iconSection}>
            <Text style={successIcon}>🎉</Text>
          </Section>

          {/* Main Content */}
          <Heading style={h2}>New Referral Joined!</Heading>

          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            Great news! Someone just signed up using your referral code and has been added to your network.
          </Text>

          {/* Info Box */}
          <Section style={infoBox}>
            <Text style={infoLabel}>New Member</Text>
            <Text style={infoValue}>{referredName}</Text>
            <Text style={infoEmail}>{referredEmail}</Text>
            <Text style={infoCode}>
              Referral Code: <strong>{referralCode}</strong>
            </Text>
          </Section>

          <Text style={text}>
            When {referredName} completes their initial $499 payment, you&apos;ll automatically receive a <strong>$249.50 direct referral bonus</strong>. We&apos;ll notify you as soon as that happens!
          </Text>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={`${dashboardUrl}/team`}>
              View Your Team
            </Button>
          </Section>

          {/* Tips Section */}
          <Section style={tipsBox}>
            <Text style={tipsTitle}>💡 Help Them Get Started</Text>
            <Text style={tipsText}>
              • Reach out to welcome them to the network
              <br />
              • Share tips on how to activate their account
              <br />
              • Guide them through the initial payment process
              <br />
              • Encourage them to start building their own team
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              <Link href={`${dashboardUrl}/referrals`} style={link}>
                View all your referrals
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

export default ReferralSignupEmail

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

const infoBox = {
  backgroundColor: '#eff6ff',
  border: '2px solid #3b82f6',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '24px',
  textAlign: 'center' as const
}

const infoLabel = {
  color: '#1e40af',
  fontSize: '12px',
  fontWeight: '600',
  margin: '0 0 8px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px'
}

const infoValue = {
  color: '#1e3a8a',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0'
}

const infoEmail = {
  color: '#3b82f6',
  fontSize: '14px',
  margin: '4px 0 16px 0'
}

const infoCode = {
  color: '#1e40af',
  fontSize: '14px',
  margin: '0',
  padding: '12px',
  backgroundColor: '#dbeafe',
  borderRadius: '4px'
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

const tipsBox = {
  backgroundColor: '#fef3c7',
  borderLeft: '4px solid #f59e0b',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '20px'
}

const tipsTitle = {
  color: '#92400e',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0'
}

const tipsText = {
  color: '#78350f',
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
