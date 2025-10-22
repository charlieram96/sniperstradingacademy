"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CheckCircle, AlertCircle, Smartphone, Trash2 } from "lucide-react"

interface Factor {
  id: string
  friendly_name?: string
  factor_type: "totp" | "phone"
  status: "verified" | "unverified"
  created_at: string
}

interface MFAFactorsListProps {
  onFactorsChange: () => void
}

export function MFAFactorsList({ onFactorsChange }: MFAFactorsListProps) {
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [unenrolling, setUnenrolling] = useState(false)
  const [factorToRemove, setFactorToRemove] = useState<string | null>(null)

  const loadFactors = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.listFactors()

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Combine TOTP and phone factors
      const allFactors = [...data.totp, ...data.phone] as Factor[]
      setFactors(allFactors)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load 2FA methods")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFactors()
  }, [])

  const handleUnenroll = async (factorId: string) => {
    setUnenrolling(true)
    setError("")
    setSuccess("")

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.unenroll({ factorId })

      if (error) {
        setError(error.message)
        setUnenrolling(false)
        return
      }

      setSuccess("2FA method removed successfully")
      setTimeout(() => setSuccess(""), 3000)

      // Reload factors list
      await loadFactors()
      onFactorsChange()

      // Need to manually refresh the session to downgrade from aal2 to aal1
      await supabase.auth.refreshSession()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove 2FA method")
    } finally {
      setUnenrolling(false)
      setFactorToRemove(null)
    }
  }

  if (loading) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        Loading 2FA methods...
      </div>
    )
  }

  if (factors.length === 0) {
    return (
      <div className="text-center p-6 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          No 2FA methods enabled yet
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {success}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {factors.map((factor) => (
          <div
            key={factor.id}
            className="flex items-center justify-between p-4 border rounded-lg bg-background"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {factor.friendly_name || "Authenticator App"}
                  </p>
                  {factor.status === "verified" ? (
                    <Badge variant="default" className="bg-green-600">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Unverified</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {factor.factor_type === "totp" ? "Time-based code" : "SMS/Phone"}
                  {" • "}
                  Added {new Date(factor.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFactorToRemove(factor.id)}
              disabled={unenrolling}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-xs text-blue-600">
          <strong>Tip:</strong> Add a backup authenticator on a different device
          to ensure you don&apos;t lose access to your account.
        </p>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={factorToRemove !== null}
        onOpenChange={(open) => !open && setFactorToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove 2FA Method?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this two-factor authentication method?
              Your account will be less secure without 2FA enabled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unenrolling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => factorToRemove && handleUnenroll(factorToRemove)}
              disabled={unenrolling}
              className="bg-red-600 hover:bg-red-700"
            >
              {unenrolling ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
