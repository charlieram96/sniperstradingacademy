"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import {
  CalendarIcon,
  CalendarClock,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetUser: {
    id: string
    name: string | null
    email: string | null
    next_payment_due_date: string | null
    payment_schedule: "weekly" | "monthly" | null
  }
  onSuccess?: () => void
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime())
  d.setDate(d.getDate() + days)
  return d
}

function addOneMonth(base: Date): Date {
  // Same day next month, capped at day 28 to avoid month-end edge cases
  // (mirrors getInitialAnchorDate / calculateNextDueDate in lib/treasury/treasury-service.ts)
  const day = Math.min(base.getDate(), 28)
  const nextMonth = base.getMonth() + 1
  const year = base.getFullYear() + (nextMonth > 11 ? 1 : 0)
  const month = nextMonth % 12
  return new Date(year, month, day)
}

function formatDate(d: Date | null): string {
  if (!d) return "—"
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function SkipPaymentDialog({ open, onOpenChange, targetUser, onSuccess }: Props) {
  const { toast } = useToast()
  const [chosenDate, setChosenDate] = useState<Date | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const currentNextDue = useMemo(
    () => (targetUser.next_payment_due_date ? new Date(targetUser.next_payment_due_date) : null),
    [targetUser.next_payment_due_date]
  )

  // Use the user's current next-due as the base for presets, or now if missing/past.
  const presetBase = useMemo(() => {
    const now = new Date()
    if (!currentNextDue || currentNextDue.getTime() < now.getTime()) return now
    return currentNextDue
  }, [currentNextDue])

  useEffect(() => {
    if (!open) {
      setChosenDate(null)
      setSubmitting(false)
      setCalendarOpen(false)
    }
  }, [open])

  const isFuture = chosenDate ? chosenDate.getTime() > Date.now() : false
  const targetLabel = targetUser.name || targetUser.email || targetUser.id

  async function handleSubmit() {
    if (!chosenDate || !isFuture) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/users/skip-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: targetUser.id,
          next_payment_due_date: chosenDate.toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: "Skip payment failed",
          description: data?.error || "Unknown error",
          variant: "destructive",
        })
        setSubmitting(false)
        return
      }
      toast({
        title: "Payment skipped",
        description: `${targetLabel}'s next due date is now ${formatDate(chosenDate)}.`,
      })
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast({
        title: "Skip payment failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  function applyPreset(kind: "week" | "month") {
    const next = kind === "week" ? addDays(presetBase, 7) : addOneMonth(presetBase)
    setChosenDate(next)
  }

  // Disable past dates in the calendar.
  const disabledMatcher = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date.getTime() < today.getTime()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Skip Payment
          </DialogTitle>
          <DialogDescription>
            For <span className="font-medium text-foreground">{targetLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current next due</span>
              <span className="font-medium">{formatDate(currentNextDue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Schedule</span>
              <span className="font-medium capitalize">
                {targetUser.payment_schedule || "—"}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Pick a new next due date</p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => applyPreset("week")}
                disabled={submitting}
              >
                +1 week
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyPreset("month")}
                disabled={submitting}
              >
                +1 month
              </Button>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    className="justify-center"
                  >
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    Custom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={chosenDate ?? undefined}
                    onSelect={(d) => {
                      if (d) {
                        setChosenDate(d)
                        setCalendarOpen(false)
                      }
                    }}
                    disabled={disabledMatcher}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div
            className={cn(
              "rounded-lg border p-3 flex items-center justify-between text-sm",
              chosenDate && isFuture && "border-primary/40 bg-primary/5"
            )}
          >
            <span className="text-muted-foreground">New next due</span>
            <span className="font-medium">{formatDate(chosenDate)}</span>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              This treats the user as if they paid for the current period. They will
              be marked active and the next-due date set to your selection. No
              payment, commission, or transaction record is created.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !chosenDate || !isFuture}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Working...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
