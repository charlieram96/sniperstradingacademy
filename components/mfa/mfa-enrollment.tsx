"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, AlertCircle } from "lucide-react"

interface MFAEnrollmentProps {
  onEnrolled: () => void
  onCancelled?: () => void
}

export function MFAEnrollment({ onEnrolled, onCancelled }: MFAEnrollmentProps) {
  const [factorId, setFactorId] = useState("")
  const [qrCode, setQrCode] = useState("") // SVG QR code
  const [secret, setSecret] = useState("") // Plain text secret for manual entry
  const [verifyCode, setVerifyCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    // Start enrollment when component mounts
    const startEnrollment = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
        })

        if (error) {
          setError(error.message)
          setLoading(false)
          return
        }

        if (data) {
          setFactorId(data.id)
          setQrCode(data.totp.qr_code)
          setSecret(data.totp.secret)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start enrollment")
      } finally {
        setLoading(false)
      }
    }

    startEnrollment()
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
        setVerifying(false)
        return
      }

      // Success!
      onEnrolled()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Setting up 2FA...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Set Up Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Scan the QR code with your authenticator app (Google Authenticator, 1Password, Authy, etc.)
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

        {qrCode && (
          <div className="space-y-4">
            {/* QR Code */}
            <div className="flex flex-col items-center space-y-2">
              <div className="p-4 bg-white rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="2FA QR Code"
                  className="w-48 h-48"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-md">
                Scan this QR code with your authenticator app
              </p>
            </div>

            {/* Manual Entry Secret */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Can&apos;t scan? Enter this secret manually:
              </Label>
              <div className="p-2 bg-muted rounded font-mono text-sm break-all">
                {secret}
              </div>
            </div>

            {/* Verification Code Input */}
            <div className="space-y-2">
              <Label htmlFor="verify-code">
                Enter 6-digit code from your app
              </Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                disabled={verifying}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleVerify}
                disabled={verifying || verifyCode.length !== 6}
                className="flex-1"
              >
                {verifying ? "Verifying..." : "Enable 2FA"}
              </Button>
              {onCancelled && (
                <Button
                  variant="outline"
                  onClick={onCancelled}
                  disabled={verifying}
                >
                  Cancel
                </Button>
              )}
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-600">
                <strong>Important:</strong> Make sure to save this secret in a secure location or add a backup device.
                You&apos;ll need it to access your account if you lose your primary authenticator.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
