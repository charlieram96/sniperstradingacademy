/**
 * NETWORK JOIN EMAIL TEMPLATE
 *
 * Sent when someone joins the user's network (deeper than direct referral)
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

interface NetworkJoinEmailProps {
  userName?: string
  newMemberName?: string
  depth?: number
  dashboardUrl?: string
}

export const NetworkJoinEmail = ({
  userName = 'Member',
  newMemberName = 'New Member',
  depth = 2,
  dashboardUrl = 'https://sniperstradingacademy.com/dashboard'
}: NetworkJoinEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>👥 {newMemberName} joined your network!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Heading style={h1}>Snipers Trading Academy</Heading>
          </Section>

          {/* Icon */}
          <Section style={iconSection}>
            <Text style={successIcon}>👥</Text>
          </Section>

          {/* Main Content */}
          <Heading style={h2}>Your Network is Growing!</Heading>

          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            Great news! <strong>{newMemberName}</strong> has joined your network at level {depth}. Your team is expanding and your earning potential is increasing!
          </Text>

          {/* Info Box */}
          <Section style={infoBox}>
            <Text style={infoLabel}>New Network Member</Text>
            <Text style={infoValue}>{newMemberName}</Text>
            <Text style={depthText}>Level {depth} in your network</Text>
          </Section>

          <Text style={text}>
            As your network grows, so does your monthly residual commission. Every active member in your network contributes to your sniper volume.
          </Text>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={`${dashboardUrl}/team`}>
              View Your Network
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

export default NetworkJoinEmail

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

const depthText = {
  color: '#3b82f6',
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
