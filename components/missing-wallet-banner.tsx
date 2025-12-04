"use client"

import { Wallet } from "lucide-react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface MissingWalletBannerProps {
  payoutWalletAddress: string | null
  bypassSubscription?: boolean
  isAdmin?: boolean
}

export function MissingWalletBanner({
  payoutWalletAddress,
  bypassSubscription = false,
  isAdmin = false,
}: MissingWalletBannerProps) {
  // Admins and bypassed subscription users don't need the warning
  const shouldShow = !payoutWalletAddress && !bypassSubscription && !isAdmin

  useEffect(() => {
    // Set CSS variable for banner height
    if (shouldShow) {
      document.documentElement.style.setProperty('--wallet-banner-height', '60px')
    } else {
      document.documentElement.style.setProperty('--wallet-banner-height', '0px')
    }

    return () => {
      document.documentElement.style.setProperty('--wallet-banner-height', '0px')
    }
  }, [shouldShow])

  // Don't render if wallet is configured or user is exempt
  if (!shouldShow) {
    return null
  }

  return (
    <div
      className="fixed left-0 right-0 z-[54] bg-amber-600 text-white shadow-lg"
      style={{
        height: '60px',
        top: 'calc(var(--banner-height, 0px) + var(--inactive-banner-height, 0px))'
      }}
    >
      <div className="h-full flex items-center justify-between px-4 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Wallet className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium truncate">
            Set up your payout wallet to receive earnings. You won&apos;t be able to receive commissions without a configured wallet.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <Link href="/finance">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-amber-600 hover:bg-amber-50"
            >
              <Wallet className="h-4 w-4 mr-1" />
              Set Up Wallet
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
