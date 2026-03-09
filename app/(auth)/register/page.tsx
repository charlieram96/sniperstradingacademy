"use client"

import { useState, useEffect, Suspense } from "react"
import { NavigationLink } from "@/components/navigation-link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Loader2, Search, CheckCircle, XCircle, Eye, EyeOff, Mail, RefreshCw } from "lucide-react"
import Image from "next/image"
import { useTranslation } from "@/components/language-provider"

interface ReferrerInfo {
  id: string
  name: string
  email: string
  referralCode: string
}

function RegisterForm() {
  const router = useRouter()
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const urlReferralCode = searchParams.get("ref")
  const isLockedReferral = !!urlReferralCode // Locked if coming from referral link

  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [referralCodeInput, setReferralCodeInput] = useState("")
  const [referrerInfo, setReferrerInfo] = useState<ReferrerInfo | null>(null)
  const [confirmedReferrer, setConfirmedReferrer] = useState<ReferrerInfo | null>(null)
  const [searchingCode, setSearchingCode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [waitingForVerification, setWaitingForVerification] = useState(false)
  const [userEmail, setUserEmail] = useState("")

  // Check for error messages in URL (from OAuth redirect)
  useEffect(() => {
    const errorParam = searchParams.get("error")
    const messageParam = searchParams.get("message")

    if (errorParam === "account_not_found") {
      setError(messageParam || t("auth.register.accountNotFound"))
    } else if (errorParam === "incomplete_signup") {
      setError(messageParam || t("auth.register.incompleteSignup"))
    }
  }, [searchParams])

  // Load referral code on mount
  useEffect(() => {
    async function loadReferral() {
      if (urlReferralCode) {
        // If referral code is in URL, validate it
        await validateReferralCode(urlReferralCode)
      } else {
        // Load default referral code (user #1)
        await loadDefaultReferral()
      }
    }
    loadReferral()
  }, [urlReferralCode])

  // Listen for email verification
  useEffect(() => {
    if (!waitingForVerification) return

    const supabase = createClient()

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session?.user?.email_confirmed_at)

      // When user confirms email, they'll be automatically signed in
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        console.log('Email verified! Redirecting to dashboard...')
        router.push('/dashboard')
      }
    })

    // Cleanup listener on unmount
    return () => {
      authListener?.subscription?.unsubscribe()
    }
  }, [waitingForVerification, router])

  async function loadDefaultReferral() {
    try {
      const response = await fetch("/api/referral/default")
      const data = await response.json()

      if (response.ok && data.user) {
        setReferrerInfo(data.user)
        setReferralCodeInput(data.user.referralCode)
      }
    } catch (err) {
      console.error("Error loading default referral:", err)
    }
  }

  async function validateReferralCode(code: string) {
    if (!code.trim()) {
      setError(t("auth.register.enterReferralCode"))
      return
    }

    setSearchingCode(true)
    setError("")

    try {
      const response = await fetch("/api/referral/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: code }),
      })

      const data = await response.json()

      if (response.ok && data.valid) {
        if (data.bypass) {
          // Bypass code - create a special referrer object for principal user
          setReferrerInfo({
            id: "", // Empty ID for bypass
            name: "Principal User",
            email: "You will be the first user (root/principal)",
            referralCode: code.toUpperCase()
          })
        } else {
          setReferrerInfo(data.user)
        }
        setError("")
      } else {
        setReferrerInfo(null)
        setError(data.error || t("auth.register.invalidReferralCode"))
      }
    } catch (err) {
      console.error("Error validating referral code:", err)
      setError(t("auth.register.failedValidateReferral"))
      setReferrerInfo(null)
    } finally {
      setSearchingCode(false)
    }
  }

  function handleSearchCode() {
    validateReferralCode(referralCodeInput)
  }

  function handleConfirmReferrer() {
    if (referrerInfo) {
      setConfirmedReferrer(referrerInfo)
      setStep(2)
    }
  }

  function handleChangeReferrer() {
    setReferrerInfo(null)
    setConfirmedReferrer(null)
    setReferralCodeInput("")
    setStep(1)
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError("")

    // Validate password confirmation
    if (password !== confirmPassword) {
      setError(t("auth.register.passwordsDoNotMatch"))
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setError(t("auth.register.passwordTooShort"))
      setIsLoading(false)
      return
    }

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string
    const name = formData.get("name") as string

    const supabase = createClient()

    try {
      // Sign up the user
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${redirectUrl}/auth/callback?next=/dashboard`,
          data: {
            name,
            referred_by: confirmedReferrer?.id,  // Pass ID for trigger to set referred_by
          },
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (authData.user && confirmedReferrer) {
        // Check if this is a bypass code (principal user)
        const isBypassCode = !confirmedReferrer.id || confirmedReferrer.id === ""

        if (!isBypassCode) {
          // Create referral record (referred_by is set by trigger from metadata)
          const { error: referralError } = await supabase
            .from("referrals")
            .insert({
              referrer_id: confirmedReferrer.id,
              referred_id: authData.user.id,
              status: "pending",
            })

          if (referralError) {
            console.error("❌ Error creating referral record:", referralError)
            console.error(`   Failed to create referral: referrer=${confirmedReferrer.id}, referred=${authData.user.id}`)
          } else {
            console.log("✅ Referral record created successfully")
            console.log(`   Referrer: ${confirmedReferrer.id} → Referred: ${authData.user.id}`)
          }
        }

        // Note: Network position will be assigned when user pays $500 initial payment
        // This happens automatically via the crypto payment webhook handler
      }

      // Instead of redirecting to login, show verification waiting screen
      setUserEmail(email)
      setWaitingForVerification(true)
      setIsLoading(false)
    } catch {
      setError(t("auth.register.errorOccurred"))
      setIsLoading(false)
    }
  }

  async function handleResendEmail() {
    if (!userEmail) return

    setIsLoading(true)
    try {
      const supabase = createClient()
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
        options: {
          emailRedirectTo: `${redirectUrl}/auth/callback?next=/dashboard`,
        }
      })

      if (error) {
        setError(error.message)
      } else {
        setError("")
        // Show success message briefly
        alert("Verification email resent! Please check your inbox.")
      }
    } catch {
      setError(t("auth.register.resendFailed"))
    } finally {
      setIsLoading(false)
    }
  }

  // Waiting for Email Verification Screen
  if (waitingForVerification) {
    return (
      <div className="min-h-screen flex">
        {/* Left Side - Visual */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0F1629]/80 via-[#162044]/80 to-[#1A2550]/80 p-12 flex-col justify-between">
          <NavigationLink href="/" className="flex items-center space-x-3">
            <Image src="/gold-logo.svg" alt="Trading Hub" width={48} height={48} className="w-12 h-12" />
            <span className="font-bold text-2xl text-white">{t("common.brandName")}</span>
          </NavigationLink>

          <div className="space-y-6 text-white">
            <h1 className="text-4xl font-bold leading-tight">
              {t("auth.register.verifySideTitle")}
            </h1>
            <p className="text-lg text-white/90">
              {t("auth.register.verifySideDesc")}
            </p>
          </div>

          <div className="text-sm text-white/60">
            {t("common.copyright", { year: "2024" })}
          </div>
        </div>

        {/* Right Side - Verification Message */}
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden mb-8 text-center">
              <NavigationLink href="/" className="inline-flex items-center space-x-3">
                <Image src="/gold-logo.svg" alt="Trading Hub" width={40} height={40} className="w-10 h-10" />
                <span className="font-bold text-xl text-foreground">{t("common.brandName")}</span>
              </NavigationLink>
            </div>

            <Card className="border-border-subtle">
              <CardHeader className="space-y-1 pb-4">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold text-center">
                  {t("auth.register.checkEmail")}
                </CardTitle>
                <CardDescription className="text-base text-center">
                  {t("auth.register.verificationSent")}
                </CardDescription>
                <p className="text-center font-medium text-foreground">{userEmail}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-surface-2 rounded-lg space-y-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t("auth.register.clickVerification")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("auth.register.clickVerificationDesc")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Loader2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0 animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t("auth.register.waitingForVerification")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("auth.register.autoRedirect")}
                      </p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground text-center">
                    {t("auth.register.didntReceiveEmail")}
                  </p>
                  <Button
                    onClick={handleResendEmail}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("auth.register.sending")}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {t("auth.register.resendVerification")}
                      </>
                    )}
                  </Button>
                </div>

                <div className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    {t("auth.register.checkSpam")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Step 1: Referral Code Selection
  if (step === 1) {
    return (
      <div className="min-h-screen flex">
        {/* Left Side - Visual */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0F1629]/80 via-[#162044]/80 to-[#1A2550]/80 p-12 flex-col justify-between">
          <NavigationLink href="/" className="flex items-center space-x-3">
            <Image src="/gold-logo.svg" alt="Trading Hub" width={48} height={48} className="w-12 h-12" />
            <span className="font-bold text-2xl text-white">{t("common.brandName")}</span>
          </NavigationLink>

          <div className="space-y-6 text-white">
            <h1 className="text-4xl font-bold leading-tight">
              {t("auth.register.step1SideTitle")}
            </h1>
            <p className="text-lg text-white/90">
              {t("auth.register.step1SideDesc")}
            </p>
            <div className="space-y-3 pt-8">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6" />
                <span>{t("auth.register.featureExpertCourses")}</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6" />
                <span>{t("auth.register.featureEarnReferral")}</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6" />
                <span>{t("auth.register.featureLiveSessions")}</span>
              </div>
            </div>
          </div>

          <div className="text-sm text-white/60">
            {t("common.copyright", { year: "2024" })}
          </div>
        </div>

        {/* Right Side - Referral Form */}
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden mb-8 text-center">
              <NavigationLink href="/" className="inline-flex items-center space-x-3">
                <Image src="/gold-logo.svg" alt="Trading Hub" width={40} height={40} className="w-10 h-10" />
                <span className="font-bold text-xl text-foreground">{t("common.brandName")}</span>
              </NavigationLink>
            </div>

            <Card className="border-border-subtle">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-3xl font-bold">{t("auth.register.step1Title")}</CardTitle>
                <CardDescription className="text-base">
                  {t("auth.register.step1Subtitle")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Locked Referral Indicator */}
                {isLockedReferral && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-primary">
                        {t("auth.register.referredByLink")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Referral Code Input */}
                <div className="space-y-3">
                  <Label htmlFor="referralCode">{t("auth.register.referralCode")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="referralCode"
                      value={referralCodeInput}
                      onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                      placeholder={t("auth.register.referralCodePlaceholder")}
                      className="flex-1 uppercase"
                      disabled={searchingCode || isLockedReferral}
                      readOnly={isLockedReferral}
                    />
                    {!isLockedReferral && (
                      <Button
                        type="button"
                        onClick={handleSearchCode}
                        disabled={searchingCode || !referralCodeInput.trim()}
                        size="icon"
                      >
                        {searchingCode ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isLockedReferral
                      ? t("auth.register.referralCodeLockedHint")
                      : t("auth.register.referralCodeHint")
                    }
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 p-3 text-sm text-red-400 bg-red-500/10 rounded-md">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Referrer Preview */}
                {referrerInfo && (
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-surface-2">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarFallback className="text-lg font-semibold bg-primary text-primary-foreground">
                            {getInitials(referrerInfo.name || "??")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{referrerInfo.name}</h3>
                          <p className="text-sm text-muted-foreground">{referrerInfo.email}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">
                              Code: {referrerInfo.referralCode}
                            </Badge>
                          </div>
                        </div>
                        <CheckCircle className="h-6 w-6 text-[#D4A853]" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button
                        type="button"
                        onClick={handleConfirmReferrer}
                        className="w-full"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t("auth.register.continueWithEmail")}
                      </Button>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <Separator />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            Or
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11"
                        onClick={async () => {
                          if (!referrerInfo) return

                          // Store referral info in localStorage for Google OAuth
                          localStorage.setItem('pending_referral', JSON.stringify(referrerInfo))

                          const supabase = createClient()
                          const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
                          const { error } = await supabase.auth.signInWithOAuth({
                            provider: 'google',
                            options: {
                              redirectTo: `${redirectUrl}/auth/callback?next=/complete-signup`,
                            },
                          })

                          if (error) {
                            setError(t("auth.register.errorOccurred"))
                          }
                        }}
                      >
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                        {t("auth.register.continueWithGoogle")}
                      </Button>

                      <Button
                        type="button"
                        onClick={() => {
                          setReferrerInfo(null)
                          setReferralCodeInput("")
                          setError("")
                        }}
                        variant="ghost"
                        size="sm"
                        className="w-full"
                      >
                        {t("auth.register.changeReferralCode")}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
          <CardFooter className="flex-col space-y-4">
            <p className="text-sm text-center w-full text-muted-foreground">
              {t("auth.register.alreadyHaveAccount")}{" "}
              <NavigationLink href="/login" className="font-semibold text-primary hover:underline">
                {t("auth.register.signIn")}
              </NavigationLink>
            </p>
          </CardFooter>
        </Card>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Registration Form
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0F1629]/80 via-[#162044]/80 to-[#1A2550]/80 p-12 flex-col justify-between">
        <NavigationLink href="/" className="flex items-center space-x-3">
          <Image src="/gold-logo.svg" alt="Trading Hub" width={48} height={48} className="w-12 h-12" />
          <span className="font-bold text-2xl text-white">{t("common.brandName")}</span>
        </NavigationLink>

        <div className="space-y-6 text-white">
          <h1 className="text-4xl font-bold leading-tight">
            {t("auth.register.step2SideTitle")}
          </h1>
          <p className="text-lg text-white/90">
            {t("auth.register.step2SideDesc")}
          </p>
          <div className="space-y-3 pt-8">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6" />
              <span>{t("auth.register.featureEarnPerReferral")}</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6" />
              <span>{t("auth.register.featureResidualIncome")}</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6" />
              <span>{t("auth.register.featureMoneyBack")}</span>
            </div>
          </div>
        </div>

        <div className="text-sm text-white/60">
          {t("common.copyright", { year: "2024" })}
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <NavigationLink href="/" className="inline-flex items-center space-x-3">
              <Image src="/gold-logo.svg" alt="Trading Hub" width={40} height={40} className="w-10 h-10" />
              <span className="font-bold text-xl text-foreground">{t("common.brandName")}</span>
            </NavigationLink>
          </div>

          <Card className="border-border-subtle">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-3xl font-bold">{t("auth.register.step2Title")}</CardTitle>
              <CardDescription className="text-base">
                {t("auth.register.step2Subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
          {confirmedReferrer && (
            <div className="mb-4">
              <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
                    {getInitials(confirmedReferrer.name || "??")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t("auth.register.referredBy", { name: confirmedReferrer.name })}</p>
                  <p className="text-xs text-muted-foreground">
                    Code: {confirmedReferrer.referralCode}
                    {isLockedReferral && <span className="ml-2 text-primary">• {t("auth.register.lockedByInvitation")}</span>}
                  </p>
                </div>
                {!isLockedReferral && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleChangeReferrer}
                    className="text-xs"
                  >
                    Change
                  </Button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.register.fullName")}</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder={t("auth.register.namePlaceholder")}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.register.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t("auth.register.emailPlaceholder")}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.register.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={isLoading}
                  className="h-11 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("auth.register.passwordMinLength")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.register.confirmPassword")}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={isLoading}
                  className="h-11 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400">
                  {t("auth.register.passwordsDoNotMatch")}
                </p>
              )}
            </div>
            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-500/10 rounded-md">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-11"
              disabled={isLoading || password !== confirmPassword}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("auth.register.creatingAccount")}
                </>
              ) : (
                t("auth.register.createAccount")
              )}
            </Button>
          </form>

          <div className="my-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t("auth.register.orContinueWith")}
                </span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            disabled={isLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t("auth.register.continueWithGoogle")}
          </Button>

          <p className="mt-4 text-xs text-center text-muted-foreground">
            {t("auth.register.termsAgreement")}{" "}
            <NavigationLink href="/terms" className="underline hover:text-foreground">
              {t("auth.register.termsOfService")}
            </NavigationLink>{" "}
            {t("auth.register.and")}{" "}
            <NavigationLink href="/privacy" className="underline hover:text-foreground">
              {t("auth.register.privacyPolicy")}
            </NavigationLink>
          </p>
        </CardContent>
        <CardFooter className="flex-col space-y-4">
          <p className="text-sm text-center w-full text-muted-foreground">
            {t("auth.register.alreadyHaveAccount")}{" "}
            <NavigationLink href="/login" className="font-semibold text-primary hover:underline">
              {t("auth.register.signIn")}
            </NavigationLink>
          </p>
        </CardFooter>
      </Card>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}