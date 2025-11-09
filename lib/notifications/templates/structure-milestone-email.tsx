/**
 * STRUCTURE MILESTONE EMAIL TEMPLATE
 *
 * Sent when user achieves a network structure milestone
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

interface StructureMilestoneEmailProps {
  userName?: string
  milestoneName?: string
  leftLegCount?: number
  rightLegCount?: number
  totalNetworkCount?: number
  dashboardUrl?: string
}

export const StructureMilestoneEmail = ({
  userName = 'Member',
  milestoneName = 'Balanced Builder',
  leftLegCount = 10,
  rightLegCount = 10,
  totalNetworkCount = 25,
  dashboardUrl = 'https://tradinghub.com/dashboard'
}: StructureMilestoneEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Congratulations! You&apos;ve achieved the {milestoneName} milestone!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Heading style={h1}>Trading Hub</Heading>
          </Section>

          {/* Trophy Icon */}
          <Section style={iconSection}>
            <Text style={trophyIcon}>🏆</Text>
          </Section>

          {/* Main Content */}
          <Heading style={h2}>Milestone Achieved!</Heading>

          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            Congratulations! You&apos;ve just reached a significant milestone in building your Trading Hub network: <strong>{milestoneName}</strong>
          </Text>

          {/* Milestone Box */}
          <Section style={milestoneBox}>
            <Text style={milestoneTitle}>🎯 {milestoneName}</Text>
            <Section style={statsGrid}>
              <Section style={statItem}>
                <Text style={statValue}>{leftLegCount}</Text>
                <Text style={statLabel}>Left Leg</Text>
              </Section>
              <Section style={statDivider}>
                <Text style={statDividerText}>⚡</Text>
              </Section>
              <Section style={statItem}>
                <Text style={statValue}>{rightLegCount}</Text>
                <Text style={statLabel}>Right Leg</Text>
              </Section>
            </Section>
            <Text style={totalNetworkText}>
              Total Network: {totalNetworkCount} members
            </Text>
          </Section>

          <Text style={text}>
            This achievement demonstrates your commitment to building a balanced and sustainable network. Your structure is growing stronger!
          </Text>

          {/* Benefits Section */}
          <Section style={benefitsBox}>
            <Text style={benefitsTitle}>🌟 Why This Matters</Text>
            <Text style={benefitsText}>
              • <strong>Balanced growth</strong> maximizes your residual income potential
              <br />
              • <strong>Stronger foundation</strong> for long-term sustainable earnings
              <br />
              • <strong>Leadership development</strong> across both legs of your network
              <br />
              • <strong>Increased stability</strong> as your team continues to grow
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={`${dashboardUrl}/team`}>
              View Your Team
            </Button>
          </Section>

          {/* Next Steps */}
          <Section style={nextStepsBox}>
            <Text style={nextStepsTitle}>🚀 Keep Growing</Text>
            <Text style={nextStepsText}>
              <strong>Share your referral link:</strong> Keep building your network
              <br />
              <strong>Support your team:</strong> Help your members achieve their goals
              <br />
              <strong>Stay engaged:</strong> Regular activity leads to better results
              <br />
              <strong>Track your progress:</strong> Watch your structure develop in real-time
            </Text>
          </Section>

          <Text style={text}>
            Your success is inspiring! Keep up the great work and continue building your Trading Hub empire.
          </Text>

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

export default StructureMilestoneEmail

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

const milestoneBox = {
  backgroundColor: '#f5f3ff',
  border: '2px solid #7c3aed',
  borderRadius: '12px',
  margin: '32px 20px',
  padding: '32px 24px',
  textAlign: 'center' as const
}

const milestoneTitle = {
  color: '#5b21b6',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 24px 0'
}

const statsGrid = {
  display: 'flex' as const,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  gap: '24px',
  margin: '24px 0'
}

const statItem = {
  flex: '1',
  textAlign: 'center' as const
}

const statValue = {
  color: '#7c3aed',
  fontSize: '48px',
  fontWeight: '700',
  margin: '0',
  lineHeight: '1'
}

const statLabel = {
  color: '#6b21a8',
  fontSize: '14px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '8px 0 0 0'
}

const statDivider = {
  textAlign: 'center' as const,
  padding: '0 12px'
}

const statDividerText = {
  color: '#a78bfa',
  fontSize: '32px',
  margin: '0'
}

const totalNetworkText = {
  color: '#5b21b6',
  fontSize: '16px',
  fontWeight: '600',
  margin: '20px 0 0 0',
  paddingTop: '20px',
  borderTop: '1px solid #ddd6fe'
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

const benefitsBox = {
  backgroundColor: '#ecfdf5',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '20px'
}

const benefitsTitle = {
  color: '#065f46',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0'
}

const benefitsText = {
  color: '#064e3b',
  fontSize: '14px',
  lineHeight: '1.8',
  margin: '0'
}

const nextStepsBox = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  margin: '32px 20px',
  padding: '20px'
}

const nextStepsTitle = {
  color: '#92400e',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0'
}

const nextStepsText = {
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
