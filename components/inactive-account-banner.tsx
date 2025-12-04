"use client"

import { AlertTriangle, CreditCard, X } from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// 33 days = 30 day subscription + 3 day grace period
const ACTIVE_THRESHOLD_DAYS = 33

interface InactiveAccountBannerProps {
  lastPaymentDate: string | null
  bypassSubscription?: boolean
  isAdmin?: boolean
}

export function InactiveAccountBanner({
  lastPaymentDate,
  bypassSubscription = false,
  isAdmin = false,
}: InactiveAccountBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [inactivityInfo, setInactivityInfo] = useState<{
    isInactive: boolean
    daysSincePayment: number
    daysOverdue: number
    inactiveSince: Date | null
  } | null>(null)

  useEffect(() => {
    // Admins and bypassed users are always active
    if (bypassSubscription || isAdmin) {
      setInactivityInfo({ isInactive: false, daysSincePayment: 0, daysOverdue: 0, inactiveSince: null })
      return
    }

    // Never paid - they're inactive
    if (!lastPaymentDate) {
      setInactivityInfo({
        isInactive: true,
        daysSincePayment: 0,
        daysOverdue: ACTIVE_THRESHOLD_DAYS,
        inactiveSince: null
      })
      return
    }

    const lastPayment = new Date(lastPaymentDate)
    const now = new Date()
    const daysSincePayment = Math.floor((now.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24))
    const isInactive = daysSincePayment > ACTIVE_THRESHOLD_DAYS
    const daysOverdue = Math.max(0, daysSincePayment - ACTIVE_THRESHOLD_DAYS)

    // Calculate when they became inactive (last payment + 33 days)
    const inactiveSince = new Date(lastPayment)
    inactiveSince.setDate(inactiveSince.getDate() + ACTIVE_THRESHOLD_DAYS)

    setInactivityInfo({
      isInactive,
      daysSincePayment,
      daysOverdue,
      inactiveSince: isInactive ? inactiveSince : null,
    })

    // Set CSS variable for banner height
    if (isInactive && !dismissed) {
      document.documentElement.style.setProperty('--inactive-banner-height', '60px')
    } else {
      document.documentElement.style.setProperty('--inactive-banner-height', '0px')
    }

    return () => {
      document.documentElement.style.setProperty('--inactive-banner-height', '0px')
    }
  }, [lastPaymentDate, bypassSubscription, isAdmin, dismissed])

  // Don't render if not inactive or dismissed
  if (!inactivityInfo?.isInactive || dismissed) {
    return null
  }

  const getMessage = () => {
    if (!lastPaymentDate) {
      return "Your account is inactive. Complete your first payment to activate your account and start earning."
    }

    if (inactivityInfo.daysOverdue === 1) {
      return `Your account became inactive yesterday. Pay now to reactivate and continue earning.`
    }

    if (inactivityInfo.daysOverdue <= 7) {
      return `Your account has been inactive for ${inactivityInfo.daysOverdue} days. Pay now to reactivate and continue earning.`
    }

    return `Your account has been inactive for ${inactivityInfo.daysOverdue} days (since ${inactivityInfo.inactiveSince?.toLocaleDateString()}). Pay now to reactivate.`
  }

  return (
    <div
      className="fixed left-0 right-0 z-[55] bg-red-600 text-white shadow-lg"
      style={{ height: '60px', top: 'var(--banner-height, 0px)' }}
    >
      <div className="h-full flex items-center justify-between px-4 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium truncate">
            {getMessage()}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <Link href="/payments">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-red-600 hover:bg-red-50"
            >
              <CreditCard className="h-4 w-4 mr-1" />
              Pay Now
            </Button>
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-red-700 rounded transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
