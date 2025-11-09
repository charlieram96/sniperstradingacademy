/**
 * ADMIN ANNOUNCEMENT EMAIL TEMPLATE
 *
 * Sent when superadmins send manual messages to users
 * Supports custom subject and message
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr
} from '@react-email/components'
import * as React from 'react'

interface AdminAnnouncementEmailProps {
  userName?: string
  subject?: string
  message?: string
  senderName?: string
}

export const AdminAnnouncementEmail = ({
  userName = 'Member',
  subject = 'Message from Admin',
  message = 'This is an important announcement from the Trading Hub team.',
  senderName = 'Trading Hub Team'
}: AdminAnnouncementEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Heading style={h1}>Trading Hub</Heading>
          </Section>

          {/* Subject */}
          <Section style={section}>
            <Heading style={h2}>{subject}</Heading>
          </Section>

          {/* Greeting */}
          <Section style={section}>
            <Text style={text}>Hi {userName},</Text>
          </Section>

          {/* Message */}
          <Section style={section}>
            <Text style={messageText}>{message}</Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This message was sent by {senderName}.
            </Text>
            <Text style={footerText}>
              If you have any questions, please contact our support team.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default AdminAnnouncementEmail

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
  padding: '32px 40px',
  backgroundColor: '#1a1a1a'
}

const h1 = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
  textAlign: 'center' as const
}

const h2 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
  marginBottom: '16px'
}

const section = {
  padding: '24px 40px'
}

const text = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
  marginBottom: '16px'
}

const messageText = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0',
  whiteSpace: 'pre-wrap' as const
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0'
}

const footer = {
  padding: '0 40px',
  marginTop: '24px'
}

const footerText = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
  marginBottom: '8px'
}
