"use client"

import { useState } from "react"
import { NavigationLink } from "@/components/navigation-link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Lock, Eye, EyeOff, CheckCircle } from "lucide-react"
import Image from "next/image"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError("")

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    // Validate password length
    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()

      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setError(error.message)
      } else {
        // Success - redirect to login
        router.push("/login?message=Password reset successfully. Please login with your new password.")
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
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
            Create a new password
          </h1>
          <p className="text-lg text-white/90">
            Choose a strong password to keep your Trading Hub account secure.
          </p>
          <div className="space-y-3 pt-8">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6" />
              <span>At least 8 characters long</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6" />
              <span>Mix of letters and numbers</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6" />
              <span>Avoid common words</span>
            </div>
          </div>
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
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-center">Reset your password</CardTitle>
              <CardDescription className="text-base text-center">
                Enter your new password below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
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
                    Must be at least 8 characters long
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
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
                  disabled={isLoading || password !== confirmPassword || !password || !confirmPassword}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting password...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex-col space-y-4">
              <p className="text-sm text-center w-full text-muted-foreground">
                Remember your password?{" "}
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
