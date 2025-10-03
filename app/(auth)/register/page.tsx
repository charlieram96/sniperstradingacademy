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
import { Loader2, Search, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react"
import Image from "next/image"

interface ReferrerInfo {
  id: string
  name: string
  email: string
  referralCode: string
}

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlReferralCode = searchParams.get("ref")

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
      setError("Please enter a referral code")
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
        setError(data.error || "Invalid referral code")
      }
    } catch (err) {
      console.error("Error validating referral code:", err)
      setError("Failed to validate referral code")
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
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      setIsLoading(false)
      return
    }

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string
    const name = formData.get("name") as string

    const supabase = createClient()

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            referral_code: confirmedReferrer?.referralCode,
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
          // Normal referral flow
          // Update user with referrer
          await supabase
            .from("users")
            .update({ referred_by: confirmedReferrer.id })
            .eq("id", authData.user.id)

          // Create referral record
          await supabase
            .from("referrals")
            .insert({
              referrer_id: confirmedReferrer.id,
              referred_id: authData.user.id,
              status: "pending",
            })
        }

        // Assign network position (works for both bypass and normal referrals)
        try {
          const positionResponse = await fetch("/api/network/assign-position", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: authData.user.id,
              referrerId: isBypassCode ? null : confirmedReferrer.id,
            }),
          })

          if (!positionResponse.ok) {
            console.error("Failed to assign network position")
          }
        } catch (err) {
          console.error("Error assigning network position:", err)
          // Don't block signup if position assignment fails
        }
      } else if (authData.user && !confirmedReferrer) {
        // No referrer - this might be the principal user
        try {
          const positionResponse = await fetch("/api/network/assign-position", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: authData.user.id,
              referrerId: null,
            }),
          })

          if (!positionResponse.ok) {
            console.error("Failed to assign network position")
          }
        } catch (err) {
          console.error("Error assigning network position:", err)
        }
      }

      router.push("/login?message=Check your email to confirm your account")
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Step 1: Referral Code Selection
  if (step === 1) {
    return (
      <div className="min-h-screen flex">
        {/* Left Side - Visual */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 flex-col justify-between">
          <NavigationLink href="/" className="flex items-center space-x-3">
            <Image src="/gold-logo.svg" alt="Trading Hub" width={48} height={48} className="w-12 h-12" />
            <span className="font-bold text-2xl text-white">Trading Hub</span>
          </NavigationLink>

          <div className="space-y-6 text-white">
            <h1 className="text-4xl font-bold leading-tight">
              Join the most successful trading network
            </h1>
            <p className="text-lg text-white/90">
              Learn from expert traders, earn commissions, and build your financial future.
            </p>
            <div className="space-y-3 pt-8">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6" />
                <span>Expert-led trading courses</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6" />
                <span>Earn $250 per referral + 10% residual</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6" />
                <span>Live trading sessions daily</span>
              </div>
            </div>
          </div>

          <div className="text-sm text-white/60">
            © 2024 Trading Hub. All rights reserved.
          </div>
        </div>

        {/* Right Side - Referral Form */}
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden mb-8 text-center">
              <NavigationLink href="/" className="inline-flex items-center space-x-3">
                <Image src="/gold-logo.svg" alt="Trading Hub" width={40} height={40} className="w-10 h-10" />
                <span className="font-bold text-xl text-foreground">Trading Hub</span>
              </NavigationLink>
            </div>

            <Card className="border-0 shadow-lg">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-3xl font-bold">Welcome!</CardTitle>
                <CardDescription className="text-base">
                  Who referred you to Trading Hub?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Referral Code Input */}
                <div className="space-y-3">
                  <Label htmlFor="referralCode">Referral Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="referralCode"
                      value={referralCodeInput}
                      onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                      placeholder="Enter referral code"
                      className="flex-1 uppercase"
                      disabled={searchingCode}
                    />
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
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter the referral code from the person who invited you
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Referrer Preview */}
                {referrerInfo && (
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-muted/30">
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
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button
                        type="button"
                        onClick={handleConfirmReferrer}
                        className="w-full"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Continue with Email Signup
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
                            setError("Failed to sign in with Google")
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
                        Continue with Google
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
                        Change Referral Code
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
          <CardFooter className="flex-col space-y-4">
            <p className="text-sm text-center w-full text-muted-foreground">
              Already have an account?{" "}
              <NavigationLink href="/login" className="font-semibold text-primary hover:underline">
                Sign in
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
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 flex-col justify-between">
        <NavigationLink href="/" className="flex items-center space-x-3">
          <Image src="/gold-logo.svg" alt="Trading Hub" width={48} height={48} className="w-12 h-12" />
          <span className="font-bold text-2xl text-white">Trading Hub</span>
        </NavigationLink>

        <div className="space-y-6 text-white">
          <h1 className="text-4xl font-bold leading-tight">
            Start your journey to financial freedom
          </h1>
          <p className="text-lg text-white/90">
            Create your account and unlock access to expert trading courses, live sessions, and unlimited earning potential.
          </p>
          <div className="space-y-3 pt-8">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6" />
              <span>Earn $250 per referral</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6" />
              <span>10% monthly residual income</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6" />
              <span>30-day money-back guarantee</span>
            </div>
          </div>
        </div>

        <div className="text-sm text-white/60">
          © 2024 Trading Hub. All rights reserved.
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <NavigationLink href="/" className="inline-flex items-center space-x-3">
              <Image src="/gold-logo.svg" alt="Trading Hub" width={40} height={40} className="w-10 h-10" />
              <span className="font-bold text-xl text-foreground">Trading Hub</span>
            </NavigationLink>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-3xl font-bold">Create an account</CardTitle>
              <CardDescription className="text-base">
                Join the trading network and start earning commissions
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
                  <p className="text-sm font-medium">Referred by {confirmedReferrer.name}</p>
                  <p className="text-xs text-muted-foreground">Code: {confirmedReferrer.referralCode}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleChangeReferrer}
                  className="text-xs"
                >
                  Change
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="trader@example.com"
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
                Must be at least 8 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
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
                <p className="text-xs text-red-600">
                  Passwords do not match
                </p>
              )}
            </div>
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
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
                  Creating account...
                </>
              ) : (
                "Create account"
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
                  Or continue with
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
            Continue with Google
          </Button>

          <p className="mt-4 text-xs text-center text-muted-foreground">
            By creating an account, you agree to our{" "}
            <NavigationLink href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </NavigationLink>{" "}
            and{" "}
            <NavigationLink href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </NavigationLink>
          </p>
        </CardContent>
        <CardFooter className="flex-col space-y-4">
          <p className="text-sm text-center w-full text-muted-foreground">
            Already have an account?{" "}
            <NavigationLink href="/login" className="font-semibold text-primary hover:underline">
              Sign in
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