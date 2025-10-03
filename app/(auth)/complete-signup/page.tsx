"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle } from "lucide-react"
import Image from "next/image"

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

  useEffect(() => {
    async function completeSignup() {
      try {
        const supabase = createClient()

        // Get current Supabase session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        // If not authenticated, redirect to register
        if (sessionError || !session) {
          router.push("/register")
          return
        }

        const userEmail = session.user.email
        if (!userEmail) {
          throw new Error("No user email found")
        }

        // Check if user already exists in database and has a referral
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, referred_by")
          .eq("email", userEmail)
          .single()

        // If user already has a referral, redirect to dashboard
        if (existingUser?.referred_by) {
          localStorage.removeItem('pending_referral')
          router.push("/dashboard")
          return
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
            await supabase
              .from("users")
              .update({ referred_by: referrerInfo.id })
              .eq("id", existingUser.id)

            // Create referral record
            await supabase
              .from("referrals")
              .insert({
                referrer_id: referrerInfo.id,
                referred_id: existingUser.id,
                status: "pending",
              })
          }

          // Assign network position (works for both bypass and normal referrals)
          try {
            const positionResponse = await fetch("/api/network/assign-position", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: existingUser.id,
                referrerId: isBypassCode ? null : referrerInfo.id,
              }),
            })

            if (!positionResponse.ok) {
              console.error("Failed to assign network position")
            }
          } catch (err) {
            console.error("Error assigning network position:", err)
            // Don't block signup if position assignment fails
          }
        } else {
          // This shouldn't happen, but handle it anyway
          // The user should have been created by the database trigger
          console.error("User not found in database after OAuth")
        }

        // Clear localStorage
        localStorage.removeItem('pending_referral')

        setSuccess(true)
        setTimeout(() => {
          router.push("/dashboard")
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

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-3xl font-bold text-center">
                {success ? "All Set!" : isProcessing ? "Completing Setup..." : "Error"}
              </CardTitle>
              <CardDescription className="text-base text-center">
                {success
                  ? "Your account is ready. Redirecting to dashboard..."
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
        </div>
      </div>
    </div>
  )
}
