"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export function MFAChallenge() {
  const router = useRouter()
  const [verifyCode, setVerifyCode] = useState("")
  const [error, setError] = useState("")
  const [factorId, setFactorId] = useState("")
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    // Get the first TOTP factor for the user
    const loadFactor = async () => {
      try {
        const supabase = createClient()
        const factors = await supabase.auth.mfa.listFactors()

        if (factors.error) {
          setError(factors.error.message)
          setLoading(false)
          return
        }

        const totpFactor = factors.data.totp[0]
        if (!totpFactor) {
          setError("No 2FA method found for your account")
          setLoading(false)
          return
        }

        setFactorId(totpFactor.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load 2FA settings")
      } finally {
        setLoading(false)
      }
    }

    loadFactor()
  }, [])

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setError("Please enter a valid 6-digit code")
      return
    }

    setVerifying(true)
    setError("")

    try {
      const supabase = createClient()

      // Create challenge
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      if (challenge.error) {
        setError(challenge.error.message)
        setVerifying(false)
        return
      }

      const challengeId = challenge.data.id

      // Verify the code
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: verifyCode,
      })

      if (verify.error) {
        setError(verify.error.message)
        setVerifyCode("") // Clear the code on error
        setVerifying(false)
        return
      }

      // Success! The session will be upgraded automatically
      // Redirect to dashboard
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
      setVerifyCode("")
    } finally {
      setVerifying(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && verifyCode.length === 6 && !verifying) {
      handleVerify()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="mfa-code">Verification Code</Label>
            <Input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              onKeyPress={handleKeyPress}
              placeholder="000000"
              disabled={verifying}
              className="text-center text-2xl tracking-widest font-mono"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Open your authenticator app and enter the code shown
            </p>
          </div>

          <Button
            onClick={handleVerify}
            disabled={verifying || verifyCode.length !== 6}
            className="w-full"
          >
            {verifying ? "Verifying..." : "Verify"}
          </Button>

          <div className="text-center">
            <a
              href="/login"
              className="text-sm text-muted-foreground hover:text-primary underline"
            >
              Back to login
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
