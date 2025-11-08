"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock,
  CreditCard,
  Calendar
} from "lucide-react"

interface AccountStatusCardProps {
  accountActive: boolean
  monthlyPaymentDueDate: Date | null
  lastPaymentDate: Date | null
  paymentSchedule?: 'weekly' | 'monthly'
  bypassSubscription?: boolean
  onPayNow?: () => void
}

export function AccountStatusCard({
  accountActive,
  monthlyPaymentDueDate,
  lastPaymentDate,
  paymentSchedule = 'monthly',
  bypassSubscription = false,
  onPayNow
}: AccountStatusCardProps) {
  const [timeUntilDue, setTimeUntilDue] = useState<string>("")
  const [isOverdue, setIsOverdue] = useState(false)
  const [daysUntilDue, setDaysUntilDue] = useState<number>(0)

  useEffect(() => {
    const updateCountdown = () => {
      if (!monthlyPaymentDueDate) {
        setTimeUntilDue("No payment scheduled")
        return
      }

      const now = new Date()
      const dueDate = new Date(monthlyPaymentDueDate)
      const diff = dueDate.getTime() - now.getTime()

      if (diff <= 0) {
        setIsOverdue(true)
        const overdueDays = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24))
        setTimeUntilDue(`${overdueDays} days overdue`)
        setDaysUntilDue(-overdueDays)
      } else {
        setIsOverdue(false)
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        
        setDaysUntilDue(days)
        
        if (days > 0) {
          setTimeUntilDue(`${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`)
        } else if (hours > 0) {
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
          setTimeUntilDue(`${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`)
        } else {
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
          setTimeUntilDue(`${minutes} minute${minutes !== 1 ? 's' : ''}`)
        }
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [monthlyPaymentDueDate])

  const getStatusColor = () => {
    if (!accountActive) return "bg-red-500/10 text-red-500 border-red-500/20"
    if (isOverdue) return "bg-red-500/10 text-red-500 border-red-500/20"
    if (daysUntilDue <= 3) return "bg-amber-500/10 text-amber-500 border-amber-500/20"
    if (daysUntilDue <= 7) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    return "bg-green-500/10 text-green-500 border-green-500/20"
  }

  const getStatusIcon = () => {
    if (!accountActive) return <XCircle className="h-5 w-5 text-red-500" />
    if (isOverdue) return <AlertTriangle className="h-5 w-5 text-red-500" />
    if (daysUntilDue <= 7) return <AlertTriangle className="h-5 w-5 text-amber-500" />
    return <CheckCircle className="h-5 w-5 text-green-500" />
  }

  const getStatusText = () => {
    if (!accountActive) return "Account Inactive"
    if (isOverdue) return "Payment Overdue"
    if (daysUntilDue <= 3) return "Payment Due Soon"
    if (daysUntilDue <= 7) return "Payment Coming Up"
    return "Account Active"
  }

  const getStatusDescription = () => {
    if (!accountActive && isOverdue) {
      const interval = paymentSchedule === 'weekly' ? 'weekly' : 'monthly'
      return `Your ${interval} payment is overdue. Pay now to reactivate your account and receive residual income.`
    }
    if (!accountActive) {
      return "Your account is inactive. Activate it to start earning and receiving payouts."
    }
    if (isOverdue) {
      const amount = paymentSchedule === 'weekly' ? '$49.75 weekly' : '$199 monthly'
      return `Your ${amount} payment is overdue. Your account will be deactivated if not paid.`
    }
    if (daysUntilDue <= 3) {
      const interval = paymentSchedule === 'weekly' ? 'weekly' : 'monthly'
      return `Your ${interval} payment is due very soon. Ensure your payment method is up to date.`
    }
    return "Your account is in good standing. Keep your subscription active to receive residual payouts."
  }

  return (
    <Card className={`border-2 ${getStatusColor()}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle className="text-xl">{getStatusText()}</CardTitle>
          </div>
          <Badge 
            variant={accountActive ? "default" : "destructive"}
            className={accountActive ? "bg-green-500" : ""}
          >
            {accountActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <CardDescription className="text-base mt-2">
          {getStatusDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!bypassSubscription && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>{paymentSchedule === 'weekly' ? 'Weekly' : 'Monthly'} Subscription</span>
              </div>
              <p className="text-2xl font-bold">${paymentSchedule === 'weekly' ? '49.75' : '199'}</p>
              <p className="text-xs text-muted-foreground">Due {paymentSchedule === 'weekly' ? 'weekly' : 'monthly'}</p>
            </div>
          )}

          {bypassSubscription && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>Subscription Status</span>
              </div>
              <p className="text-2xl font-bold">Bypassed</p>
              <p className="text-xs text-muted-foreground">Administrative access</p>
            </div>
          )}
          
          {!bypassSubscription && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Next Payment</span>
              </div>
              <p className="text-lg font-semibold">
                {timeUntilDue}
              </p>
              {monthlyPaymentDueDate && (
                <p className="text-xs text-muted-foreground">
                  {new Date(monthlyPaymentDueDate).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {bypassSubscription && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4" />
                <span>Subscription</span>
              </div>
              <p className="text-lg font-semibold">
                Bypassed
              </p>
              <p className="text-xs text-muted-foreground">
                No payment required
              </p>
            </div>
          )}
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Last Payment</span>
            </div>
            <p className="text-lg font-semibold">
              {lastPaymentDate ? 
                new Date(lastPaymentDate).toLocaleDateString() : 
                "No payment yet"
              }
            </p>
            {lastPaymentDate && (
              <p className="text-xs text-muted-foreground">
                {Math.floor((Date.now() - new Date(lastPaymentDate).getTime()) / (1000 * 60 * 60 * 24))} days ago
              </p>
            )}
          </div>
        </div>

        {(!accountActive || isOverdue || daysUntilDue <= 7) && (
          <div className="pt-2">
            <Button 
              onClick={onPayNow}
              className="w-full"
              variant={!accountActive || isOverdue ? "destructive" : "default"}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {!accountActive || isOverdue ? "Pay Now to Reactivate" : "Update Payment Method"}
            </Button>
          </div>
        )}

        {!accountActive && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-500 font-medium">
              ⚠️ While your account is inactive:
            </p>
            <ul className="text-xs text-red-500/80 mt-1 space-y-1 list-disc list-inside">
              <li>You will not receive monthly residual payouts</li>
              <li>Your accumulated residual is on hold</li>
              <li>Your team building progress is paused</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}