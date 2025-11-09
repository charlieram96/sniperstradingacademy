'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Bell, BellOff, Mail, MessageSquare, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'

// Common timezones for the select
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (MT - No DST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' }
]

interface NotificationPreferences {
  email: {
    enabled: boolean
    referral_signups: boolean
    network_joins: boolean
    direct_bonus: boolean
    monthly_commission: boolean
    payouts: boolean
    volume_updates: boolean
    structure_milestones: boolean
    payment_failed: boolean
    account_inactive: boolean
  }
  sms: {
    enabled: boolean
    referral_signups: boolean
    network_joins: boolean
    direct_bonus: boolean
    monthly_commission: boolean
    payouts: boolean
    volume_updates: boolean
    structure_milestones: boolean
    payment_failed: boolean
    account_inactive: boolean
  }
  quiet_hours: {
    enabled: boolean
    start: string
    end: string
  }
}

interface SMSConsent {
  opted_in: boolean
  is_verified: boolean
  phone_number: string
}

interface NotificationHealth {
  email_bounces: number
  email_complaints: number
  sms_failures: number
  email_disabled: boolean
  sms_disabled: boolean
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [smsConsent, setSmsConsent] = useState<SMSConsent | null>(null)
  const [notificationHealth, setNotificationHealth] = useState<NotificationHealth | null>(null)

  // SMS opt-in flow
  const [showSmsOptIn, setShowSmsOptIn] = useState(false)
  const [smsPhone, setSmsPhone] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [showVerification, setShowVerification] = useState(false)
  const [smsLoading, setSmsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchPreferences()
  }, [])

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/notifications/preferences')
      const data = await response.json()

      if (response.ok) {
        setPreferences(data.preferences)
        setPhoneNumber(data.phoneNumber || '')
        setTimezone(data.timezone || 'America/New_York')
        setSmsConsent(data.smsConsent)
        setNotificationHealth(data.health)
      }
    } catch (error) {
      console.error('Error fetching preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const updatePreferences = async () => {
    if (!preferences) return

    setSaving(true)
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences, timezone })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Preferences updated successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: 'Failed to update preferences' })
      }
    } catch (error) {
      console.error('Error updating preferences:', error)
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setSaving(false)
    }
  }

  const handleSmsOptIn = async () => {
    setSmsLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/notifications/opt-in-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: smsPhone })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: data.message })
        setShowVerification(true)
        setShowSmsOptIn(false)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send verification code' })
      }
    } catch (error) {
      console.error('Error opting in to SMS:', error)
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setSmsLoading(false)
    }
  }

  const handleVerifySms = async () => {
    setSmsLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/notifications/verify-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: data.message })
        setShowVerification(false)
        setVerificationCode('')
        // Refresh preferences to show updated SMS status
        fetchPreferences()
      } else {
        setMessage({ type: 'error', text: data.error || 'Invalid verification code' })
      }
    } catch (error) {
      console.error('Error verifying SMS:', error)
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setSmsLoading(false)
    }
  }

  const toggleEmailChannel = () => {
    if (!preferences) return
    setPreferences({
      ...preferences,
      email: { ...preferences.email, enabled: !preferences.email.enabled }
    })
  }

  const toggleSmsChannel = () => {
    if (!preferences) return
    setPreferences({
      ...preferences,
      sms: { ...preferences.sms, enabled: !preferences.sms.enabled }
    })
  }

  const toggleEmailNotification = (type: keyof Omit<NotificationPreferences['email'], 'enabled'>) => {
    if (!preferences) return
    setPreferences({
      ...preferences,
      email: {
        ...preferences.email,
        [type]: !preferences.email[type]
      }
    })
  }

  const toggleSmsNotification = (type: keyof Omit<NotificationPreferences['sms'], 'enabled'>) => {
    if (!preferences) return
    setPreferences({
      ...preferences,
      sms: {
        ...preferences.sms,
        [type]: !preferences.sms[type]
      }
    })
  }

  const toggleQuietHours = () => {
    if (!preferences) return
    setPreferences({
      ...preferences,
      quiet_hours: {
        ...preferences.quiet_hours,
        enabled: !preferences.quiet_hours.enabled
      }
    })
  }

  const updateQuietHoursTime = (field: 'start' | 'end', value: string) => {
    if (!preferences) return
    setPreferences({
      ...preferences,
      quiet_hours: {
        ...preferences.quiet_hours,
        [field]: value
      }
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const notificationTypes = [
    { id: 'referral_signups', label: 'Referral Signups', description: 'When someone uses your referral code' },
    { id: 'direct_bonus', label: 'Direct Bonuses', description: 'When you earn a $249.50 direct bonus' },
    { id: 'monthly_commission', label: 'Monthly Commissions', description: 'Monthly residual commission notifications' },
    { id: 'payouts', label: 'Payouts', description: 'When your commission is paid out' },
    { id: 'payment_failed', label: 'Payment Failures', description: 'When your subscription payment fails' },
    { id: 'structure_milestones', label: 'Network Milestones', description: 'When you achieve network goals' }
  ]

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Notification Preferences</h1>
        <p className="text-muted-foreground">
          Manage how you receive notifications about your account activity
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Notification Health Status */}
      {notificationHealth && (notificationHealth.email_disabled || notificationHealth.sms_disabled) && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-900">Notification Health Alert</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-yellow-800">
            {notificationHealth.email_disabled && (
              <p className="mb-2">
                ⚠️ Email notifications have been automatically disabled due to bounces or complaints.
                Please verify your email address in settings.
              </p>
            )}
            {notificationHealth.sms_disabled && (
              <p>
                ⚠️ SMS notifications have been automatically disabled due to delivery failures.
                Please update your phone number.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Channel Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Channel */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-base font-medium">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
            </div>
            <Switch
              checked={preferences?.email.enabled || false}
              onCheckedChange={toggleEmailChannel}
              disabled={notificationHealth?.email_disabled}
            />
          </div>

          <Separator />

          {/* SMS Channel */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-base font-medium">SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via text message
                  </p>
                </div>
              </div>
              {smsConsent?.is_verified ? (
                <Switch
                  checked={preferences?.sms.enabled || false}
                  onCheckedChange={toggleSmsChannel}
                  disabled={notificationHealth?.sms_disabled}
                />
              ) : (
                <Badge variant="outline">Not Set Up</Badge>
              )}
            </div>

            {/* SMS Opt-in Section */}
            {!smsConsent?.is_verified && (
              <div className="ml-8 p-4 bg-muted rounded-lg">
                {!showSmsOptIn && !showVerification && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">
                      SMS notifications are not enabled. You&apos;ll need to verify your phone number to receive text notifications.
                    </p>
                    <Button
                      onClick={() => setShowSmsOptIn(true)}
                      variant="outline"
                      size="sm"
                    >
                      Enable SMS Notifications
                    </Button>
                  </div>
                )}

                {showSmsOptIn && (
                  <div className="space-y-3">
                    <Label htmlFor="sms-phone">Phone Number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="sms-phone"
                        type="tel"
                        placeholder="+1234567890"
                        value={smsPhone}
                        onChange={(e) => setSmsPhone(e.target.value)}
                        disabled={smsLoading}
                      />
                      <Button
                        onClick={handleSmsOptIn}
                        disabled={smsLoading || !smsPhone}
                      >
                        {smsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Code'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      By providing your phone number, you consent to receive SMS notifications from Trading Hub.
                      Message and data rates may apply. Reply STOP to opt out.
                    </p>
                  </div>
                )}

                {showVerification && (
                  <div className="space-y-3">
                    <Label htmlFor="verification-code">Verification Code</Label>
                    <p className="text-sm text-muted-foreground">
                      Enter the 6-digit code sent to your phone
                    </p>
                    <div className="flex gap-2">
                      <Input
                        id="verification-code"
                        type="text"
                        placeholder="123456"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        disabled={smsLoading}
                        maxLength={6}
                      />
                      <Button
                        onClick={handleVerifySms}
                        disabled={smsLoading || verificationCode.length !== 6}
                      >
                        {smsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {smsConsent?.is_verified && (
              <div className="ml-8 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-900">
                  SMS verified for {phoneNumber.slice(-4) ? `•••• ${phoneNumber.slice(-4)}` : 'your phone'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>
            Choose which events trigger notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {notificationTypes.map((type) => (
              <div key={type.id} className="border rounded-lg p-4">
                <div className="mb-3">
                  <h4 className="font-medium">{type.label}</h4>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={preferences?.email[type.id as keyof Omit<NotificationPreferences['email'], 'enabled'>] || false}
                      onCheckedChange={() => toggleEmailNotification(type.id as keyof Omit<NotificationPreferences['email'], 'enabled'>)}
                      disabled={!preferences?.email.enabled || notificationHealth?.email_disabled}
                    />
                    <Label className="text-sm">Email</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={preferences?.sms[type.id as keyof Omit<NotificationPreferences['sms'], 'enabled'>] || false}
                      onCheckedChange={() => toggleSmsNotification(type.id as keyof Omit<NotificationPreferences['sms'], 'enabled'>)}
                      disabled={!preferences?.sms.enabled || !smsConsent?.is_verified || notificationHealth?.sms_disabled}
                    />
                    <Label className="text-sm">SMS</Label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Pause notifications during specific hours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet-hours-toggle">Enable Quiet Hours</Label>
            <Switch
              id="quiet-hours-toggle"
              checked={preferences?.quiet_hours.enabled || false}
              onCheckedChange={toggleQuietHours}
            />
          </div>

          {preferences?.quiet_hours.enabled && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quiet-start">Start Time</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={preferences.quiet_hours.start}
                    onChange={(e) => updateQuietHoursTime('start', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="quiet-end">End Time</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={preferences.quiet_hours.end}
                    onChange={(e) => updateQuietHoursTime('end', e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Notifications will be delayed until quiet hours end
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Timezone</CardTitle>
          <CardDescription>
            Set your timezone for quiet hours and notification scheduling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => fetchPreferences()}
          disabled={saving}
        >
          Reset
        </Button>
        <Button
          onClick={updatePreferences}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </Button>
      </div>

      {/* Notification Health Details */}
      {notificationHealth && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Delivery Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Email Bounces</p>
                <p className="font-medium">{notificationHealth.email_bounces}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email Complaints</p>
                <p className="font-medium">{notificationHealth.email_complaints}</p>
              </div>
              <div>
                <p className="text-muted-foreground">SMS Failures</p>
                <p className="font-medium">{notificationHealth.sms_failures}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  {!notificationHealth.email_disabled && !notificationHealth.sms_disabled ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-green-600 font-medium">Healthy</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span className="text-yellow-600 font-medium">Issues Detected</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
