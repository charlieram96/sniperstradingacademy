"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, Shield } from "lucide-react"
import Image from "next/image"
import { MFAEnrollment } from "@/components/mfa/mfa-enrollment"

interface ReferrerInfo {
  id: string
  name: string
  email: string
  referralCode: string
}

export default function CompleteSignupPage() {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [showMFAPrompt, setShowMFAPrompt] = useState(false)
  const [showMFAEnrollment, setShowMFAEnrollment] = useState(false)

  useEffect(() => {
    async function completeSignup() {
      try {
        const supabase = createClient()

        // Get current authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        // If not authenticated, redirect to register
        if (userError || !user) {
          router.push("/register")
          return
        }

        const userEmail = user.email
        if (!userEmail) {
          throw new Error("No user email found")
        }

        // Check if user already exists in database
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, referred_by")
          .eq("email", userEmail)
          .single()

        // Root user ID - the default set by database trigger
        const ROOT_USER_ID = 'b10f0367-0471-4eab-9d15-db68b1ac4556'

        // Check if referral record already exists (signup already completed)
        // But exclude root referrals - those need to be fixed
        const { data: existingReferral } = await supabase
          .from("referrals")
          .select("id, referrer_id")
          .eq("referred_id", existingUser?.id)
          .single()

        // If referral record exists and is NOT to root user, signup is complete
        if (existingReferral && existingReferral.referrer_id !== ROOT_USER_ID) {
          console.log("✅ Valid referral already exists, redirecting to dashboard")
          localStorage.removeItem('pending_referral')
          router.push("/dashboard")
          return
        }

        // If user has root referral, we need to fix it
        if (existingReferral && existingReferral.referrer_id === ROOT_USER_ID) {
          console.log("⚠️ Root referral detected, will update with correct referrer")
        }

        // Get pending referral from localStorage
        const pendingReferralStr = localStorage.getItem('pending_referral')

        // If no pending referral in localStorage, redirect back to register to select one
        if (!pendingReferralStr) {
          setError("Please select a referral code to complete your signup.")
          setIsProcessing(false)
          setTimeout(() => router.push("/register"), 2000)
          return
        }

        const referrerInfo: ReferrerInfo = JSON.parse(pendingReferralStr)

        // Check if this is a bypass code (principal user)
        const isBypassCode = !referrerInfo.id || referrerInfo.id === ""

        // Update user with referral information
        if (existingUser) {
          if (!isBypassCode) {
            // Normal referral flow - update user with referrer
            const { error: updateError } = await supabase
              .from("users")
              .update({ referred_by: referrerInfo.id })
              .eq("id", existingUser.id)

            if (updateError) {
              console.error("❌ Error updating user referred_by:", updateError)
              throw new Error("Failed to update referrer")
            }

            console.log(`✅ Updated user referred_by to: ${referrerInfo.id}`)

            // If root referral exists, delete it first
            if (existingReferral && existingReferral.referrer_id === ROOT_USER_ID) {
              const { error: deleteError } = await supabase
                .from("referrals")
                .delete()
                .eq("id", existingReferral.id)

              if (deleteError) {
                console.error("❌ Error deleting root referral:", deleteError)
              } else {
                console.log("✅ Deleted incorrect root referral")
              }
            }

            // Create new referral record (or recreate if we deleted root one)
            const { error: referralError } = await supabase
              .from("referrals")
              .insert({
                referrer_id: referrerInfo.id,
                referred_id: existingUser.id,
                status: "pending",
              })

            if (referralError) {
              console.error("❌ Error creating referral record:", referralError)
              console.error(`   Failed to create referral: referrer=${referrerInfo.id}, referred=${existingUser.id}`)
            } else {
              console.log("✅ Referral record created successfully")
              console.log(`   Referrer: ${referrerInfo.id} → Referred: ${existingUser.id}`)
            }
          }

          // Note: Network position will be assigned when user pays $500 initial payment
          // This happens automatically via the Stripe webhook handler
        } else {
          // This shouldn't happen, but handle it anyway
          // The user should have been created by the database trigger
          console.error("User not found in database after OAuth")
        }

        // Clear localStorage
        localStorage.removeItem('pending_referral')

        setSuccess(true)
        setIsProcessing(false)

        // Show MFA prompt after a brief delay
        setTimeout(() => {
          setShowMFAPrompt(true)
        }, 1500)

      } catch (err) {
        console.error("Error completing signup:", err)
        setError("Failed to complete signup. Please try again.")
        setIsProcessing(false)
        setTimeout(() => router.push("/register"), 2000)
      }
    }

    completeSignup()
  }, [router])

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 flex-col justify-between">
        <div className="flex items-center space-x-3">
          <Image src="/gold-logo.svg" alt="Trading Hub" width={48} height={48} className="w-12 h-12" />
          <span className="font-bold text-2xl text-white">Trading Hub</span>
        </div>

        <div className="space-y-6 text-white">
          <h1 className="text-4xl font-bold leading-tight">
            Welcome to Trading Hub!
          </h1>
          <p className="text-lg text-white/90">
            We&apos;re completing your account setup. This will only take a moment.
          </p>
        </div>

        <div className="text-sm text-white/60">
          © 2024 Trading Hub. All rights reserved.
        </div>
      </div>

      {/* Right Side - Status */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center space-x-3">
              <Image src="/gold-logo.svg" alt="Trading Hub" width={40} height={40} className="w-10 h-10" />
              <span className="font-bold text-xl text-foreground">Trading Hub</span>
            </div>
          </div>

          {showMFAPrompt ? (
            showMFAEnrollment ? (
              // MFA Enrollment Screen
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowMFAEnrollment(false)
                      setShowMFAPrompt(true)
                    }}
                    className="text-sm"
                  >
                    ← Back
                  </Button>
                </div>
                <MFAEnrollment
                  onEnrolled={() => {
                    router.push("/dashboard")
                  }}
                  onCancelled={() => {
                    setShowMFAEnrollment(false)
                    setShowMFAPrompt(true)
                  }}
                />
              </div>
            ) : (
              // MFA Prompt Screen
              <Card className="border-0 shadow-lg">
                <CardHeader className="space-y-1 pb-4">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-bold text-center">
                    Secure Your Account
                  </CardTitle>
                  <CardDescription className="text-base text-center">
                    Enable two-factor authentication to add an extra layer of security to your account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-2">Why enable 2FA?</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Protect your account from unauthorized access</li>
                      <li>• Takes only 1 minute to set up</li>
                      <li>• Industry-standard security best practice</li>
                    </ul>
                  </div>

                  <Button
                    onClick={() => setShowMFAEnrollment(true)}
                    className="w-full"
                    size="lg"
                  >
                    Set Up 2FA Now
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => router.push("/dashboard")}
                    className="w-full"
                  >
                    Skip for Now
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    You can always enable 2FA later in your settings
                  </p>
                </CardContent>
              </Card>
            )
          ) : (
            // Processing/Success/Error Screen
            <Card className="border-0 shadow-lg">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-3xl font-bold text-center">
                  {success ? "All Set!" : isProcessing ? "Completing Setup..." : "Error"}
                </CardTitle>
                <CardDescription className="text-base text-center">
                  {success
                    ? "Your account is ready!"
                    : isProcessing
                    ? "Please wait while we finalize your account"
                    : error || "Something went wrong"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                {success ? (
                  <CheckCircle className="h-16 w-16 text-green-600 animate-pulse" />
                ) : (
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
