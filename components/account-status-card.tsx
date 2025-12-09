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
  Calendar,
  Wallet
} from "lucide-react"
import Link from "next/link"

interface AccountStatusCardProps {
  accountActive: boolean
  monthlyPaymentDueDate: Date | null
  lastPaymentDate: Date | null
  paymentSchedule?: 'weekly' | 'monthly'
  bypassSubscription?: boolean
  payoutWalletAddress?: string | null
  onPayNow?: () => void
}

export function AccountStatusCard({
  accountActive,
  monthlyPaymentDueDate,
  lastPaymentDate,
  paymentSchedule = 'monthly',
  bypassSubscription = false,
  payoutWalletAddress = null,
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
    // Bypassed users always show green/active status
    if (bypassSubscription) return "bg-green-500/10 text-green-500 border-green-500/20"
    if (!accountActive) return "bg-red-500/10 text-red-500 border-red-500/20"
    if (isOverdue) return "bg-red-500/10 text-red-500 border-red-500/20"
    if (daysUntilDue <= 3) return "bg-amber-500/10 text-amber-500 border-amber-500/20"
    if (daysUntilDue <= 7) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    return "bg-green-500/10 text-green-500 border-green-500/20"
  }

  const getStatusIcon = () => {
    // Bypassed users always show checkmark
    if (bypassSubscription) return <CheckCircle className="h-5 w-5 text-green-500" />
    if (!accountActive) return <XCircle className="h-5 w-5 text-red-500" />
    if (isOverdue) return <AlertTriangle className="h-5 w-5 text-red-500" />
    if (daysUntilDue <= 7) return <AlertTriangle className="h-5 w-5 text-amber-500" />
    return <CheckCircle className="h-5 w-5 text-green-500" />
  }

  const getStatusText = () => {
    // Bypassed users always show active
    if (bypassSubscription) return "Account Active"
    if (!accountActive) return "Account Inactive"
    if (isOverdue) return "Payment Overdue"
    if (daysUntilDue <= 3) return "Payment Due Soon"
    if (daysUntilDue <= 7) return "Payment Coming Up"
    return "Account Active"
  }

  // Calculate days since last payment and inactivity details
  const getInactivityDetails = () => {
    if (!lastPaymentDate) {
      return {
        daysSincePayment: null,
        daysOverdueBy: null,
        inactiveSince: null,
        reason: "no_payment"
      }
    }

    const lastPayment = new Date(lastPaymentDate)
    const now = new Date()
    const daysSince = Math.floor((now.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24))
    const ACTIVE_THRESHOLD = 33 // 30 days + 3 day grace
    const daysOverdueBy = Math.max(0, daysSince - ACTIVE_THRESHOLD)

    // Calculate when they became inactive
    const inactiveSince = new Date(lastPayment)
    inactiveSince.setDate(inactiveSince.getDate() + ACTIVE_THRESHOLD)

    return {
      daysSincePayment: daysSince,
      daysOverdueBy,
      inactiveSince: daysOverdueBy > 0 ? inactiveSince : null,
      reason: daysOverdueBy > 0 ? "subscription_lapsed" : "active"
    }
  }

  const inactivityDetails = getInactivityDetails()

  const getStatusDescription = () => {
    // Bypassed users see a simple active message
    if (bypassSubscription) {
      return "Your account has administrative subscription bypass. No subscription payments required."
    }
    if (!accountActive && inactivityDetails.reason === "no_payment") {
      return "Your account is inactive because you haven't completed any subscription payments yet. Make your first payment to activate your account."
    }
    if (!accountActive && inactivityDetails.reason === "subscription_lapsed") {
      const daysOverdue = inactivityDetails.daysOverdueBy || 0
      if (daysOverdue === 1) {
        return "Your subscription payment is 1 day overdue. Your account became inactive yesterday. Pay now to reactivate."
      }
      return `Your subscription payment is ${daysOverdue} days overdue. Your account has been inactive since ${inactivityDetails.inactiveSince?.toLocaleDateString()}. Pay now to reactivate and resume earning.`
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {!bypassSubscription && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>{paymentSchedule === 'weekly' ? 'Weekly' : 'Monthly'} Subscription</span>
              </div>
              <p className="text-2xl font-bold">${paymentSchedule === 'weekly' ? '49.75' : '3'}</p>
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

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span>Payout Wallet</span>
            </div>
            {payoutWalletAddress ? (
              <>
                <p className="text-lg font-semibold text-green-600">
                  Configured
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {payoutWalletAddress.slice(0, 6)}...{payoutWalletAddress.slice(-4)}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-amber-600">
                  Not Set
                </p>
                <Link href="/finance" className="text-xs text-amber-600 hover:underline">
                  Set up wallet
                </Link>
              </>
            )}
          </div>
        </div>

        {!bypassSubscription && (!accountActive || isOverdue || daysUntilDue <= 7) && (
          <div className="pt-2">
            <Button
              onClick={onPayNow}
              className="w-full"
              variant={!accountActive || isOverdue ? "destructive" : "default"}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {!accountActive || isOverdue ? "Pay Now to Reactivate" : "View Payment Page"}
            </Button>
          </div>
        )}

        {!bypassSubscription && !accountActive && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-3">
            {/* Reason for inactivity */}
            <div>
              <p className="text-sm text-red-600 font-semibold flex items-center gap-2">
                <span className="text-base">Why is my account inactive?</span>
              </p>
              <p className="text-sm text-red-500 mt-1">
                {inactivityDetails.reason === "no_payment" ? (
                  "You haven't made any subscription payments yet. Complete your first payment to activate your account."
                ) : inactivityDetails.reason === "subscription_lapsed" ? (
                  <>
                    Your last payment was <strong>{inactivityDetails.daysSincePayment} days ago</strong>.
                    Subscriptions require payment every 30 days (with a 3-day grace period).
                    {inactivityDetails.inactiveSince && (
                      <> Your account became inactive on <strong>{inactivityDetails.inactiveSince.toLocaleDateString()}</strong>.</>
                    )}
                  </>
                ) : (
                  "Your subscription has lapsed. Please make a payment to reactivate."
                )}
              </p>
            </div>

            {/* Consequences */}
            <div>
              <p className="text-sm text-red-500 font-medium">
                While inactive, you will:
              </p>
              <ul className="text-xs text-red-500/80 mt-1 space-y-1 list-disc list-inside">
                <li>Not receive monthly residual payouts</li>
                <li>Not earn commissions from your team&apos;s activity</li>
                <li>Have your team building progress paused</li>
                <li>Miss out on direct referral bonuses</li>
              </ul>
            </div>

            {/* How to fix */}
            <div className="pt-1 border-t border-red-500/20">
              <p className="text-xs text-red-500">
                <strong>To reactivate:</strong> Make your subscription payment of ${paymentSchedule === 'weekly' ? '49.75' : '3'} {paymentSchedule === 'weekly' ? 'weekly' : 'monthly'}.
              </p>
            </div>
          </div>
        )}

        {/* Missing wallet warning */}
        {!payoutWalletAddress && !bypassSubscription && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-3">
            <div>
              <p className="text-sm text-amber-600 font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span>Payout Wallet Required</span>
              </p>
              <p className="text-sm text-amber-500 mt-1">
                You haven&apos;t configured a payout wallet yet. Without a wallet, you won&apos;t be able to receive any commission payouts.
              </p>
            </div>

            <div>
              <p className="text-sm text-amber-500 font-medium">
                Without a payout wallet:
              </p>
              <ul className="text-xs text-amber-500/80 mt-1 space-y-1 list-disc list-inside">
                <li>You cannot receive monthly residual payouts</li>
                <li>Direct referral bonuses cannot be sent to you</li>
                <li>All earned commissions will be pending until wallet is set</li>
              </ul>
            </div>

            <div className="pt-1 border-t border-amber-500/20">
              <Link href="/finance">
                <Button variant="outline" size="sm" className="border-amber-500 text-amber-600 hover:bg-amber-50">
                  <Wallet className="h-4 w-4 mr-2" />
                  Set Up Payout Wallet
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}