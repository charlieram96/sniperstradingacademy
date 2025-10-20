"use client"

import { useState } from "react"
import { NavigationLink } from "@/components/navigation-link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react"
import Image from "next/image"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const supabase = createClient()
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectUrl}/auth/callback?next=/reset-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
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
              Check your email
            </h1>
            <p className="text-lg text-white/90">
              We&apos;ve sent you instructions to reset your password. Click the link in the email to continue.
            </p>
          </div>

          <div className="text-sm text-white/60">
            © 2024 Trading Hub. All rights reserved.
          </div>
        </div>

        {/* Right Side - Success Message */}
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
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold text-center">
                  Check your email
                </CardTitle>
                <CardDescription className="text-base text-center">
                  We sent a password reset link to
                </CardDescription>
                <p className="text-center font-medium text-foreground">{email}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Click the link in your email</p>
                      <p className="text-xs text-muted-foreground">
                        Open your email and click the password reset link to continue
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 text-center space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Didn&apos;t receive the email? Check your spam folder or try again.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSuccess(false)
                      setEmail("")
                    }}
                  >
                    Try another email
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="flex-col space-y-4">
                <NavigationLink
                  href="/login"
                  className="text-sm text-center w-full text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </NavigationLink>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    )
  }

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
            Forgot your password?
          </h1>
          <p className="text-lg text-white/90">
            No worries! Enter your email address and we&apos;ll send you instructions to reset your password.
          </p>
        </div>

        <div className="text-sm text-white/60">
          © 2024 Trading Hub. All rights reserved.
        </div>
      </div>

      {/* Right Side - Form */}
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
              <CardTitle className="text-3xl font-bold">Reset password</CardTitle>
              <CardDescription className="text-base">
                Enter your email address and we&apos;ll send you a link to reset your password
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="trader@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11"
                  />
                </div>

                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send reset link
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex-col space-y-4">
              <NavigationLink
                href="/login"
                className="text-sm text-center w-full text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </NavigationLink>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
