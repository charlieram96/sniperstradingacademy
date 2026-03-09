"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Unlock, CreditCard, Users, Info } from "lucide-react"
import { useTranslation } from "@/components/language-provider"

interface BypassAccessBannerProps {
  bypassInitialPayment?: boolean
  bypassSubscription?: boolean
  bypassDirectReferrals?: number // Changed from boolean to number (0-18)
  dismissed?: boolean
  onDismiss?: () => void
}

export function BypassAccessBanner({
  bypassInitialPayment = false,
  bypassSubscription = false,
  bypassDirectReferrals = 0,
  dismissed = false,
  onDismiss,
}: BypassAccessBannerProps) {
  const { t } = useTranslation()
  // Don't show banner if dismissed or no bypasses are active
  const hasAnyBypass = bypassInitialPayment || bypassSubscription || (bypassDirectReferrals > 0)
  if (!hasAnyBypass || dismissed) return null

  return (
    <Card className="border-blue-500/20 bg-blue-500/5 mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-blue-700 dark:text-blue-400 font-semibold">
            {t("banners.bypassAccess.title")}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-blue-600 dark:text-blue-300">
          {t("banners.bypassAccess.description")}
        </p>
        <div className="flex flex-wrap gap-2">
          {bypassInitialPayment && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
              <Unlock className="h-3 w-3 mr-1" />
              {t("banners.bypassAccess.initialPayment")}
            </Badge>
          )}
          {bypassSubscription && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">
              <CreditCard className="h-3 w-3 mr-1" />
              {t("banners.bypassAccess.monthlySubscription")}
            </Badge>
          )}
          {bypassDirectReferrals > 0 && (
            <Badge variant="secondary" className="bg-[#D4A853]/10 text-[#C49B3E] dark:bg-[#D4A853]/10 dark:text-[#D4A853]">
              <Users className="h-3 w-3 mr-1" />
              {t("banners.bypassAccess.directReferralsBypassed", { count: bypassDirectReferrals, plural: bypassDirectReferrals !== 1 ? "s" : "" })}
            </Badge>
          )}
        </div>
        <p className="text-xs text-blue-600/80 dark:text-blue-300/80">
          {t("banners.bypassAccess.bypassNote")}
        </p>
        {onDismiss && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={onDismiss}
              className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20"
            >
              {t("banners.bypassAccess.iUnderstand")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
