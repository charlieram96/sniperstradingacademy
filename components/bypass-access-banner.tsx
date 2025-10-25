"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Unlock, CreditCard, Crown, Info } from "lucide-react"

interface BypassAccessBannerProps {
  bypassInitialPayment?: boolean
  bypassSubscription?: boolean
  premiumBypass?: boolean
  dismissed?: boolean
  onDismiss?: () => void
}

export function BypassAccessBanner({
  bypassInitialPayment = false,
  bypassSubscription = false,
  premiumBypass = false,
  dismissed = false,
  onDismiss,
}: BypassAccessBannerProps) {
  // Don't show banner if dismissed or no bypasses are active
  const hasAnyBypass = bypassInitialPayment || bypassSubscription || premiumBypass
  if (!hasAnyBypass || dismissed) return null

  return (
    <Card className="border-blue-500/20 bg-blue-500/5 mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-blue-700 dark:text-blue-400 font-semibold">
            Bypass Access Granted
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-blue-600 dark:text-blue-300">
          You have been granted special bypass access for the following:
        </p>
        <div className="flex flex-wrap gap-2">
          {bypassInitialPayment && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
              <Unlock className="h-3 w-3 mr-1" />
              Initial Payment ($499)
            </Badge>
          )}
          {bypassSubscription && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">
              <CreditCard className="h-3 w-3 mr-1" />
              Monthly Subscription ($199)
            </Badge>
          )}
          {premiumBypass && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
              <Crown className="h-3 w-3 mr-1" />
              Premium Access (All Payments)
            </Badge>
          )}
        </div>
        <p className="text-xs text-blue-600/80 dark:text-blue-300/80">
          These bypasses grant you free access without payment requirements.
          You can access all platform features and earn commissions without paying fees.
        </p>
        {onDismiss && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={onDismiss}
              className="bg-white dark:bg-white text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-50 border-blue-200"
            >
              I understand
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
