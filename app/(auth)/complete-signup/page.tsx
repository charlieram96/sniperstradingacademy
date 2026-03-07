"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, Shield } from "lucide-react"
import Image from "next/image"
import { MFAEnrollment } from "@/components/mfa/mfa-enrollment"
import { useTranslation } from "@/components/language-provider"

interface ReferrerInfo {
  id: string
  name: string
  email: string
  referralCode: string
}

export default function CompleteSignupPage() {
  const router = useRouter()
  const { t } = useTranslation()
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
          setError(t("auth.completeSignup.selectReferralCode"))
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
          // This happens automatically via the crypto payment webhook handler
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
        setError(t("auth.completeSignup.failedCompleteSignup"))
        setIsProcessing(false)
        setTimeout(() => router.push("/register"), 2000)
      }
    }

    completeSignup()
  }, [router])

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0F1629]/80 via-[#162044]/80 to-[#1A2550]/80 p-12 flex-col justify-between">
        <div className="flex items-center space-x-3">
          <Image src="/gold-logo.svg" alt="Trading Hub" width={48} height={48} className="w-12 h-12" />
          <span className="font-bold text-2xl text-white">{t("common.brandName")}</span>
        </div>

        <div className="space-y-6 text-white">
          <h1 className="text-4xl font-bold leading-tight">
            {t("auth.completeSignup.sideTitle")}
          </h1>
          <p className="text-lg text-white/90">
            {t("auth.completeSignup.sideDesc")}
          </p>
        </div>

        <div className="text-sm text-white/60">
          {t("common.copyright", { year: "2024" })}
        </div>
      </div>

      {/* Right Side - Status */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center space-x-3">
              <Image src="/gold-logo.svg" alt="Trading Hub" width={40} height={40} className="w-10 h-10" />
              <span className="font-bold text-xl text-foreground">{t("common.brandName")}</span>
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
              <Card className="border-border-subtle">
                <CardHeader className="space-y-1 pb-4">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-bold text-center">
                    {t("auth.completeSignup.secureAccount")}
                  </CardTitle>
                  <CardDescription className="text-base text-center">
                    {t("auth.completeSignup.secureAccountDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-surface-2 rounded-lg">
                    <p className="text-sm font-medium mb-2">{t("auth.completeSignup.why2FA")}</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• {t("auth.completeSignup.protect2FA")}</li>
                      <li>• {t("auth.completeSignup.setup2FATime")}</li>
                      <li>• {t("auth.completeSignup.setup2FABestPractice")}</li>
                    </ul>
                  </div>

                  <Button
                    onClick={() => setShowMFAEnrollment(true)}
                    className="w-full"
                    size="lg"
                  >
                    {t("auth.completeSignup.setup2FAButton")}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => router.push("/dashboard")}
                    className="w-full"
                  >
                    {t("auth.completeSignup.skipForNow")}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    {t("auth.completeSignup.enable2FALater")}
                  </p>
                </CardContent>
              </Card>
            )
          ) : (
            // Processing/Success/Error Screen
            <Card className="border-border-subtle">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-3xl font-bold text-center">
                  {success ? t("auth.completeSignup.allSet") : isProcessing ? t("auth.completeSignup.completingSetup") : "Error"}
                </CardTitle>
                <CardDescription className="text-base text-center">
                  {success
                    ? t("auth.completeSignup.accountReady")
                    : isProcessing
                    ? t("auth.completeSignup.pleaseWait")
                    : error || t("auth.completeSignup.somethingWentWrong")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                {success ? (
                  <CheckCircle className="h-16 w-16 text-[#D4A853] animate-pulse" />
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
