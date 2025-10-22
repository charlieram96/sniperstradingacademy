"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { User, Lock, CheckCircle, Mail, Calendar, Hash, Eye, EyeOff, Heart, LifeBuoy, Copy } from "lucide-react"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<{
    id: string
    email?: string
    email_confirmed_at?: string
    user_metadata?: { name?: string }
    created_at: string
  } | null>(null)
  const [userData, setUserData] = useState<{
    referral_code?: string
    role?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // Form states
  const [name, setName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Notification states
  const [nameSuccess, setNameSuccess] = useState("")
  const [nameError, setNameError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")
  const [passwordError, setPasswordError] = useState("")

  // Beneficiary states
  const [beneficiaryEnabled, setBeneficiaryEnabled] = useState(false)
  const [beneficiaryFullName, setBeneficiaryFullName] = useState("")
  const [beneficiaryEmail, setBeneficiaryEmail] = useState("")
  const [beneficiaryPhone, setBeneficiaryPhone] = useState("")
  const [beneficiaryAddress, setBeneficiaryAddress] = useState("")
  const [beneficiaryRelationship, setBeneficiaryRelationship] = useState("")
  const [beneficiarySuccess, setBeneficiarySuccess] = useState("")
  const [beneficiaryError, setBeneficiaryError] = useState("")
  const [beneficiaryUpdating, setBeneficiaryUpdating] = useState(false)

  // Support states
  const [supportCopied, setSupportCopied] = useState(false)

  const fetchUserData = useCallback(async () => {
    const supabase = createClient()

    // Get auth user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    // Get user data from database
    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single()

    setUser(user)
    setUserData(userData)
    setName(user.user_metadata?.name || "")

    // Load beneficiary details if they exist
    if (userData?.beneficiary_details) {
      const details = userData.beneficiary_details
      setBeneficiaryEnabled(details.enabled || false)
      setBeneficiaryFullName(details.fullName || "")
      setBeneficiaryEmail(details.email || "")
      setBeneficiaryPhone(details.phone || "")
      setBeneficiaryAddress(details.address || "")
      setBeneficiaryRelationship(details.relationship || "")
    }

    setLoading(false)
  }, [router])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  async function updateName(e: React.FormEvent) {
    e.preventDefault()
    setUpdating(true)
    setNameError("")
    setNameSuccess("")

    try {
      const supabase = createClient()

      // Update auth metadata
      const { error } = await supabase.auth.updateUser({
        data: { name }
      })

      if (error) {
        setNameError(error.message)
      } else {
        setNameSuccess("Name updated successfully!")
        setTimeout(() => setNameSuccess(""), 3000)
        await fetchUserData()
      }
    } catch {
      setNameError("Failed to update name. Please try again.")
    } finally {
      setUpdating(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setChangingPassword(true)
    setPasswordError("")
    setPasswordSuccess("")

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match")
      setChangingPassword(false)
      return
    }

    // Validate password length
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long")
      setChangingPassword(false)
      return
    }

    try {
      const supabase = createClient()

      // Supabase requires re-authentication for password change
      // First, verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      })

      if (signInError) {
        setPasswordError("Current password is incorrect")
        setChangingPassword(false)
        return
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        setPasswordError(error.message)
      } else {
        setPasswordSuccess("Password changed successfully!")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setTimeout(() => setPasswordSuccess(""), 3000)
      }
    } catch {
      setPasswordError("Failed to change password. Please try again.")
    } finally {
      setChangingPassword(false)
    }
  }

  async function updateBeneficiary(e: React.FormEvent) {
    e.preventDefault()
    setBeneficiaryUpdating(true)
    setBeneficiaryError("")
    setBeneficiarySuccess("")

    try {
      const supabase = createClient()

      const beneficiaryDetails = {
        enabled: beneficiaryEnabled,
        fullName: beneficiaryFullName,
        email: beneficiaryEmail,
        phone: beneficiaryPhone,
        address: beneficiaryAddress,
        relationship: beneficiaryRelationship
      }

      const { error } = await supabase
        .from("users")
        .update({ beneficiary_details: beneficiaryDetails })
        .eq("id", user?.id)

      if (error) {
        setBeneficiaryError(error.message)
      } else {
        setBeneficiarySuccess("Beneficiary information updated successfully!")
        setTimeout(() => setBeneficiarySuccess(""), 3000)
        await fetchUserData()
      }
    } catch {
      setBeneficiaryError("Failed to update beneficiary information. Please try again.")
    } finally {
      setBeneficiaryUpdating(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setSupportCopied(true)
    setTimeout(() => setSupportCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={updateName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  disabled={updating}
                  className="max-w-md"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="max-w-md bg-muted"
                  />
                  {user?.email_confirmed_at && (
                    <div className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="h-4 w-4" />
                      <span>Verified</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              {nameSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {nameSuccess}
                  </p>
                </div>
              )}

              {nameError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{nameError}</p>
                </div>
              )}

              <Button type="submit" disabled={updating || name === user?.user_metadata?.name}>
                {updating ? "Updating..." : "Update Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              Account Details
            </CardTitle>
            <CardDescription>
              View your account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Member Since</span>
                </div>
                <p className="text-sm font-medium">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                  }) : "N/A"}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  <span>Referral Code</span>
                </div>
                <p className="text-sm font-medium font-mono">
                  {userData?.referral_code || "N/A"}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>Email Verified</span>
                </div>
                <p className="text-sm font-medium">
                  {user?.email_confirmed_at ? "Yes" : "No"}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Account Type</span>
                </div>
                <p className="text-sm font-medium capitalize">
                  {userData?.role || "User"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Password & Security
            </CardTitle>
            <CardDescription>
              Change your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    disabled={changingPassword}
                    className="max-w-md pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={changingPassword}
                    className="max-w-md pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters long
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={changingPassword}
                    className="max-w-md pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {passwordSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {passwordSuccess}
                  </p>
                </div>
              )}

              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{passwordError}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {changingPassword ? "Changing Password..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Beneficiary Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Beneficiary Information
            </CardTitle>
            <CardDescription>
              Set up beneficiary details in case of account member passing away
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={updateBeneficiary} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="beneficiary-toggle">Add Beneficiary</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable to add beneficiary details to your account
                  </p>
                </div>
                <Switch
                  id="beneficiary-toggle"
                  checked={beneficiaryEnabled}
                  onCheckedChange={setBeneficiaryEnabled}
                />
              </div>

              {beneficiaryEnabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="beneficiary-name">Full Name</Label>
                    <Input
                      id="beneficiary-name"
                      type="text"
                      value={beneficiaryFullName}
                      onChange={(e) => setBeneficiaryFullName(e.target.value)}
                      placeholder="Beneficiary's full name"
                      disabled={beneficiaryUpdating}
                      className="max-w-md"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="beneficiary-email">Email Address</Label>
                    <Input
                      id="beneficiary-email"
                      type="email"
                      value={beneficiaryEmail}
                      onChange={(e) => setBeneficiaryEmail(e.target.value)}
                      placeholder="beneficiary@example.com"
                      disabled={beneficiaryUpdating}
                      className="max-w-md"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="beneficiary-phone">Telephone Number</Label>
                    <Input
                      id="beneficiary-phone"
                      type="tel"
                      value={beneficiaryPhone}
                      onChange={(e) => setBeneficiaryPhone(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      disabled={beneficiaryUpdating}
                      className="max-w-md"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="beneficiary-address">Address</Label>
                    <Textarea
                      id="beneficiary-address"
                      value={beneficiaryAddress}
                      onChange={(e) => setBeneficiaryAddress(e.target.value)}
                      placeholder="Street address, City, State, ZIP"
                      disabled={beneficiaryUpdating}
                      className="max-w-md"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="beneficiary-relationship">Relationship to You</Label>
                    <Input
                      id="beneficiary-relationship"
                      type="text"
                      value={beneficiaryRelationship}
                      onChange={(e) => setBeneficiaryRelationship(e.target.value)}
                      placeholder="e.g., Spouse, Child, Sibling, Parent"
                      disabled={beneficiaryUpdating}
                      className="max-w-md"
                    />
                  </div>
                </>
              )}

              {beneficiarySuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {beneficiarySuccess}
                  </p>
                </div>
              )}

              {beneficiaryError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{beneficiaryError}</p>
                </div>
              )}

              <Button type="submit" disabled={beneficiaryUpdating}>
                {beneficiaryUpdating ? "Saving..." : "Save Beneficiary Information"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Support & Help */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary" />
              Support & Help
            </CardTitle>
            <CardDescription>
              Reach out to us for any questions, concerns, feature requests, or problems
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Support Email</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="email"
                  value="support@sniperstradingacademy.com"
                  disabled
                  className="max-w-md bg-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard("support@sniperstradingacademy.com")}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {supportCopied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Our support team typically responds within 24 hours
              </p>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">How can we help?</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Technical issues or bugs</li>
                <li>• Account questions</li>
                <li>• Feature requests</li>
                <li>• Payment concerns</li>
                <li>• General inquiries</li>
              </ul>
            </div>

            <a href="mailto:support@sniperstradingacademy.com">
              <Button className="w-full md:w-auto">
                <Mail className="h-4 w-4 mr-2" />
                Email Support
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
