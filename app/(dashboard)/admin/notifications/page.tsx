'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell, Loader2, CheckCircle2, AlertCircle, Send, User } from 'lucide-react'

interface GlobalSetting {
  id: string
  notification_type: string
  enabled: boolean
  disabled_reason: string | null
  disabled_by: string | null
  disabled_at: string | null
  disabled_by_user: { id: string; name: string; email: string } | null
  last_modified_by: string | null
  last_modified_at: string | null
}

interface UserOption {
  id: string
  name: string
  email: string
}

// Group notification types by category
const NOTIFICATION_CATEGORIES = {
  financial: {
    label: 'Financial',
    types: ['direct_bonus', 'monthly_commission', 'payout_processed', 'payout_failed', 'payment_failed', 'payment_succeeded']
  },
  network: {
    label: 'Network',
    types: ['referral_signup', 'network_join', 'structure_milestone', 'volume_update']
  },
  account: {
    label: 'Account',
    types: ['account_inactive', 'account_reactivated', 'welcome']
  },
  admin: {
    label: 'Admin',
    types: ['admin_announcement']
  }
}

// Human-readable labels
const NOTIFICATION_LABELS: Record<string, string> = {
  referral_signup: 'Referral Signups',
  network_join: 'Network Joins',
  direct_bonus: 'Direct Bonuses',
  monthly_commission: 'Monthly Commissions',
  payout_processed: 'Payout Success',
  payout_failed: 'Payout Failures',
  payment_failed: 'Payment Failures',
  payment_succeeded: 'Payment Success',
  structure_milestone: 'Network Milestones',
  volume_update: 'Volume Updates',
  account_inactive: 'Account Inactive Warnings',
  account_reactivated: 'Account Reactivations',
  admin_announcement: 'Admin Announcements',
  welcome: 'Welcome Messages'
}

export default function AdminNotificationsPage() {
  const [settings, setSettings] = useState<GlobalSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Manual messaging state
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([])
  const [subject, setSubject] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email'])
  const [sending, setSending] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/notifications/global-settings')
      const data = await response.json()

      if (response.ok) {
        setSettings(data.settings)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to fetch settings' })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setLoading(false)
    }
  }

  const toggleSetting = async (type: string, currentlyEnabled: boolean, reason?: string) => {
    setUpdating(type)
    try {
      const response = await fetch(`/api/admin/notifications/global-settings/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !currentlyEnabled,
          reason: !currentlyEnabled ? undefined : reason
        })
      })

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `${NOTIFICATION_LABELS[type]} ${!currentlyEnabled ? 'enabled' : 'disabled'} successfully`
        })
        setTimeout(() => setMessage(null), 3000)
        fetchSettings()
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to update setting' })
      }
    } catch (error) {
      console.error('Error updating setting:', error)
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setUpdating(null)
    }
  }

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setUserOptions([])
      return
    }

    setSearchLoading(true)
    try {
      const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()

      if (response.ok) {
        setUserOptions(data.users || [])
      }
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  const addUser = (user: UserOption) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user])
    }
    setSearchQuery('')
    setUserOptions([])
  }

  const removeUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId))
  }

  const sendManualMessage = async () => {
    if (selectedUsers.length === 0 || !messageBody.trim()) return

    setSending(true)
    try {
      const response = await fetch('/api/admin/notifications/send-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedUsers.map(u => u.id),
          subject: subject.trim() || 'Message from Admin',
          message: messageBody.trim(),
          channels: selectedChannels
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `Message sent to ${data.sent} user${data.sent !== 1 ? 's' : ''}${data.failed > 0 ? `, ${data.failed} failed` : ''}`
        })
        setTimeout(() => setMessage(null), 5000)
        // Reset form
        setSelectedUsers([])
        setSubject('')
        setMessageBody('')
        setShowManualDialog(false)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send message' })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const stats = {
    total: settings.length,
    enabled: settings.filter(s => s.enabled).length,
    disabled: settings.filter(s => !s.enabled).length
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Global Notification Control</h1>
          <p className="text-muted-foreground">
            Manage system-wide notification toggles and send manual messages
          </p>
        </div>
        <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
          <DialogTrigger asChild>
            <Button>
              <Send className="mr-2 h-4 w-4" />
              Send Manual Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Send Manual Message</DialogTitle>
              <DialogDescription>
                Send a custom message to selected users via email and/or SMS
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* User Search */}
              <div>
                <Label htmlFor="user-search">Select Users</Label>
                <Input
                  id="user-search"
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    searchUsers(e.target.value)
                  }}
                  disabled={sending}
                />
                {searchLoading && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Searching...
                  </div>
                )}
                {userOptions.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                    {userOptions.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => addUser(user)}
                        className="w-full text-left p-2 hover:bg-muted flex items-center gap-2"
                      >
                        <User className="h-4 w-4" />
                        <div>
                          <div className="text-sm font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <div>
                  <Label>Selected ({selectedUsers.length})</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
                        {user.name}
                        <button
                          onClick={() => removeUser(user.id)}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Channels */}
              <div>
                <Label>Channels</Label>
                <div className="mt-2 flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes('email')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChannels([...selectedChannels, 'email'])
                        } else {
                          setSelectedChannels(selectedChannels.filter(c => c !== 'email'))
                        }
                      }}
                    />
                    <span className="text-sm">Email</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes('sms')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChannels([...selectedChannels, 'sms'])
                        } else {
                          setSelectedChannels(selectedChannels.filter(c => c !== 'sms'))
                        }
                      }}
                    />
                    <span className="text-sm">SMS</span>
                  </label>
                </div>
              </div>

              {/* Subject */}
              <div>
                <Label htmlFor="subject">Subject (Email only)</Label>
                <Input
                  id="subject"
                  type="text"
                  placeholder="Message from Admin"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sending}
                />
              </div>

              {/* Message */}
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Enter your message here..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  disabled={sending}
                  rows={6}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowManualDialog(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                onClick={sendManualMessage}
                disabled={sending || selectedUsers.length === 0 || !messageBody.trim() || selectedChannels.length === 0}
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send to {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Enabled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disabled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.disabled}</div>
          </CardContent>
        </Card>
      </div>

      {/* Global Toggles */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Global Notification Toggles</CardTitle>
          </div>
          <CardDescription>
            Enable or disable notification types system-wide. This overrides individual user preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.entries(NOTIFICATION_CATEGORIES).map(([categoryKey, category]) => {
            const categorySettings = settings.filter(s => category.types.includes(s.notification_type))

            if (categorySettings.length === 0) return null

            return (
              <div key={categoryKey} className="mb-6 last:mb-0">
                <h3 className="text-lg font-semibold mb-3">{category.label}</h3>
                <div className="space-y-3">
                  {categorySettings.map((setting) => (
                    <div key={setting.notification_type} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Label className="text-base font-medium">
                              {NOTIFICATION_LABELS[setting.notification_type] || setting.notification_type}
                            </Label>
                            {setting.enabled ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Enabled
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                Disabled
                              </Badge>
                            )}
                          </div>
                          {!setting.enabled && setting.disabled_by_user && (
                            <p className="text-sm text-muted-foreground">
                              Disabled by {setting.disabled_by_user.name} on {new Date(setting.disabled_at!).toLocaleString()}
                              {setting.disabled_reason && ` - ${setting.disabled_reason}`}
                            </p>
                          )}
                        </div>
                        <Switch
                          checked={setting.enabled}
                          onCheckedChange={() => toggleSetting(setting.notification_type, setting.enabled)}
                          disabled={updating === setting.notification_type}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {categoryKey !== 'admin' && <Separator className="mt-6" />}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
