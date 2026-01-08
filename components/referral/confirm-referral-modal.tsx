"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, CheckCircle2, Loader2, UserPlus } from "lucide-react"

interface ConfirmReferralModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmed: () => void
  userId: string
}

export function ConfirmReferralModal({
  open,
  onOpenChange,
  onConfirmed,
  userId,
}: ConfirmReferralModalProps) {
  const [referralCode, setReferralCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [validatedReferrer, setValidatedReferrer] = useState<{
    name: string
    email: string
  } | null>(null)

  const handleContinueWithoutReferral = () => {
    // Set localStorage flag so modal doesn't show again
    localStorage.setItem("referral_confirmed", "true")
    onConfirmed()
    onOpenChange(false)
  }

  const handleValidateCode = async () => {
    if (!referralCode.trim()) {
      setError("Please enter a referral code")
      return
    }

    setIsLoading(true)
    setError("")
    setValidatedReferrer(null)

    try {
      const response = await fetch("/api/referral/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: referralCode.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Invalid referral code")
        return
      }

      if (data.bypass) {
        setError("This code is reserved for system use")
        return
      }

      setValidatedReferrer({
        name: data.user.name || "Unknown",
        email: data.user.email,
      })
    } catch (err) {
      setError("Failed to validate code. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateReferral = async () => {
    if (!referralCode.trim()) {
      setError("Please enter a referral code")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/referral/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: referralCode.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to update referral")
        return
      }

      setSuccess(true)
      // Set localStorage flag so modal doesn't show again
      localStorage.setItem("referral_confirmed", "true")

      // Close after brief success message
      setTimeout(() => {
        onConfirmed()
        onOpenChange(false)
      }, 1500)
    } catch (err) {
      setError("Failed to update referral. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      if (validatedReferrer) {
        handleUpdateReferral()
      } else {
        handleValidateCode()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Confirm Your Referral
          </DialogTitle>
          <DialogDescription>
            Your account was created without a referral code. If someone referred
            you to the platform, enter their code below.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 flex flex-col items-center gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-center font-medium">Referral updated successfully!</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="referralCode">Referral Code (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="referralCode"
                    placeholder="Enter referral code"
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value.toUpperCase())
                      setValidatedReferrer(null)
                      setError("")
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    className="uppercase"
                  />
                  {!validatedReferrer && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleValidateCode}
                      disabled={isLoading || !referralCode.trim()}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Check"
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {validatedReferrer && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Valid referral code!</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Referred by: <span className="font-medium">{validatedReferrer.name}</span>
                  </p>
                </div>
              )}

              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <p>
                  If you don&apos;t have a referral code, you can continue without one.
                  Your account will be linked to the platform directly.
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleContinueWithoutReferral}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Continue Without Referral
              </Button>
              {validatedReferrer ? (
                <Button
                  onClick={handleUpdateReferral}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    "Confirm Referral"
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleValidateCode}
                  disabled={isLoading || !referralCode.trim()}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Validating...
                    </>
                  ) : (
                    "Validate Code"
                  )}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
