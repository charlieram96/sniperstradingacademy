/**
 * VOLUME UPDATE EMAIL TEMPLATE
 *
 * Sent when user's sniper volume reaches a milestone threshold
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

interface VolumeUpdateEmailProps {
  userName?: string
  newVolume?: number
  month?: string
  dashboardUrl?: string
}

export const VolumeUpdateEmail = ({
  userName = 'Member',
  newVolume = 5000,
  month = 'March 2026',
  dashboardUrl = 'https://sniperstradingacademy.com/dashboard'
}: VolumeUpdateEmailProps) => {
  const formattedVolume = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(newVolume)

  return (
    <Html>
      <Head />
      <Preview>Your sniper volume reached {formattedVolume}!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Heading style={h1}>Snipers Trading Academy</Heading>
          </Section>

          {/* Icon */}
          <Section style={iconSection}>
            <Text style={trophyIcon}>📈</Text>
          </Section>

          {/* Main Content */}
          <Heading style={h2}>Volume Milestone Reached!</Heading>

          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            Congratulations! Your sniper volume for <strong>{month}</strong> has reached a new milestone.
          </Text>

          {/* Volume Box */}
          <Section style={volumeBox}>
            <Text style={volumeLabel}>Current Sniper Volume</Text>
            <Text style={volumeValue}>{formattedVolume}</Text>
          </Section>

          <Text style={text}>
            Higher volume means higher commission rates! Keep building your network to increase your monthly earnings even further.
          </Text>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={dashboardUrl}>
              View Dashboard
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

export default VolumeUpdateEmail

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

const trophyIcon = {
  fontSize: '64px',
  margin: '0'
}

const h2 = {
  color: '#7c3aed',
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

const volumeBox = {
  backgroundColor: '#f5f3ff',
  border: '2px solid #7c3aed',
  borderRadius: '12px',
  margin: '32px 20px',
  padding: '32px',
  textAlign: 'center' as const
}

const volumeLabel = {
  color: '#5b21b6',
  fontSize: '14px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px 0'
}

const volumeValue = {
  color: '#7c3aed',
  fontSize: '48px',
  fontWeight: '700',
  margin: '0'
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0'
}

const button = {
  backgroundColor: '#7c3aed',
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
