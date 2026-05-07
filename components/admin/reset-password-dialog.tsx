"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { Copy, Check, Loader2, KeyRound, Mail, AlertTriangle } from "lucide-react"

type Method = "send_link" | "temporary_password"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetUser: {
    id: string
    email: string | null
    name: string | null
  }
}

export function ResetPasswordDialog({ open, onOpenChange, targetUser }: Props) {
  const { toast } = useToast()
  const [method, setMethod] = useState<Method>("send_link")
  const [submitting, setSubmitting] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [notificationSent, setNotificationSent] = useState<boolean | null>(null)

  useEffect(() => {
    if (!open) {
      // Reset internal state when closed
      setMethod("send_link")
      setSubmitting(false)
      setTempPassword(null)
      setCopied(false)
      setNotificationSent(null)
    }
  }, [open])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: targetUser.id, method }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast({
          title: "Reset failed",
          description: data?.error || "Unknown error",
          variant: "destructive",
        })
        setSubmitting(false)
        return
      }

      if (method === "send_link") {
        toast({
          title: "Reset email sent",
          description: data.message,
        })
        onOpenChange(false)
      } else {
        // temporary_password — show password, do NOT close dialog
        setTempPassword(data.tempPassword)
        setNotificationSent(data.notification_email_sent ?? null)
      }
    } catch (err) {
      console.error(err)
      toast({
        title: "Reset failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function copyTempPassword() {
    if (!tempPassword) return
    try {
      await navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: "Copy failed",
        description: "Select the password and copy manually.",
        variant: "destructive",
      })
    }
  }

  const targetLabel = targetUser.name || targetUser.email || targetUser.id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            For <span className="font-medium text-foreground">{targetLabel}</span>
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-500">Shown once</p>
                <p className="text-xs text-muted-foreground">
                  Copy this temporary password and share it with the user securely.
                  It will not be shown again. The user will be required to change it on next login.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="temp-password">Temporary password</Label>
              <div className="flex gap-2">
                <Input
                  id="temp-password"
                  readOnly
                  value={tempPassword}
                  className="font-mono"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button type="button" variant="outline" onClick={copyTempPassword}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {notificationSent === false && (
              <p className="text-xs text-amber-500">
                Note: the notification email could not be delivered, but the password was set successfully.
              </p>
            )}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <RadioGroup
              value={method}
              onValueChange={(v) => setMethod(v as Method)}
              className="space-y-3"
            >
              <label
                htmlFor="method-send-link"
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent"
              >
                <RadioGroupItem id="method-send-link" value="send_link" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4" />
                    Send recovery email
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Emails the user a one-time link to choose a new password.
                  </p>
                </div>
              </label>
              <label
                htmlFor="method-temp-password"
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent"
              >
                <RadioGroupItem id="method-temp-password" value="temporary_password" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <KeyRound className="h-4 w-4" />
                    Generate temporary password
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sets a temporary password (shown to you once). User is forced to change it on next login.
                  </p>
                </div>
              </label>
            </RadioGroup>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Working...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
