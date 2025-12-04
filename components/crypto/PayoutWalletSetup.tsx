"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Wallet, CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react"

interface PayoutWalletSetupProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
  isModal?: boolean
  showAsCard?: boolean
}

interface WalletStatus {
  payoutWalletAddress: string | null
  isConfigured: boolean
  pendingCommissions: {
    total: string
    count: number
  }
}

export default function PayoutWalletSetup({
  open,
  onOpenChange,
  onSuccess,
  isModal = true,
  showAsCard = false,
}: PayoutWalletSetupProps) {
  const [walletAddress, setWalletAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null)

  // Fetch current wallet status
  useEffect(() => {
    const fetchWalletStatus = async () => {
      try {
        const response = await fetch("/api/user/payout-wallet")
        const data = await response.json()

        if (data.success && data.data) {
          setWalletStatus(data.data)
          if (data.data.payoutWalletAddress) {
            setWalletAddress(data.data.payoutWalletAddress)
          }
        }
      } catch (err) {
        console.error("Failed to fetch wallet status:", err)
      } finally {
        setFetching(false)
      }
    }

    fetchWalletStatus()
  }, [])

  // Validate Ethereum address format
  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const handleSave = async () => {
    setError(null)

    if (!walletAddress) {
      setError("Please enter your wallet address")
      return
    }

    if (!isValidAddress(walletAddress)) {
      setError("Invalid wallet address format. Must be a valid Polygon address (0x...)")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/user/payout-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || "Failed to save wallet address")
      } else {
        setSuccess(true)
        setWalletStatus({
          ...walletStatus,
          payoutWalletAddress: walletAddress,
          isConfigured: true,
        } as WalletStatus)

        if (onSuccess) {
          onSuccess()
        }

        if (onOpenChange && isModal) {
          setTimeout(() => onOpenChange(false), 1500)
        }
      }
    } catch (err) {
      setError("Failed to save wallet address. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <div className="space-y-6">
      {/* Info section */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex gap-3">
          <Wallet className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1 text-blue-400">Why do you need to set a payout wallet?</p>
            <ul className="list-disc list-inside space-y-1 text-blue-300">
              <li>Receive your direct referral bonuses ($249.50 per referral)</li>
              <li>Receive your monthly residual commissions</li>
              <li>Payments are made in USDC on the Polygon network</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Current wallet status */}
      {walletStatus?.isConfigured && walletStatus.payoutWalletAddress && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-green-400 font-medium">Wallet configured</p>
            <p className="text-xs text-green-300 font-mono truncate">
              {walletStatus.payoutWalletAddress}
            </p>
          </div>
        </div>
      )}

      {/* Pending commissions */}
      {walletStatus?.pendingCommissions && walletStatus.pendingCommissions.count > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <span className="text-sm text-amber-300">
            You have ${walletStatus.pendingCommissions.total} in pending commissions ({walletStatus.pendingCommissions.count} payouts)
          </span>
        </div>
      )}

      {/* Wallet input */}
      <div className="space-y-2">
        <Label htmlFor="payoutWallet">Your Polygon Wallet Address</Label>
        <Input
          id="payoutWallet"
          placeholder="0x..."
          value={walletAddress}
          onChange={(e) => {
            setWalletAddress(e.target.value)
            setError(null)
            setSuccess(false)
          }}
          className="font-mono"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Enter your personal wallet address (MetaMask, Coinbase Wallet, etc.) on the Polygon network.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span className="text-sm text-green-300">Payout wallet saved successfully!</span>
        </div>
      )}

      {/* Help link */}
      <div className="text-xs text-muted-foreground">
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Don&apos;t have a wallet? Get MetaMask
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={loading || !walletAddress}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : walletStatus?.isConfigured ? (
          "Update Payout Wallet"
        ) : (
          "Save Payout Wallet"
        )}
      </Button>
    </div>
  )

  // Loading state
  if (fetching) {
    return isModal ? null : (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Render as card (for settings page)
  if (showAsCard) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Payout Wallet</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Set your personal wallet address to receive commissions and bonuses in USDC.
        </p>
        {content}
      </div>
    )
  }

  // Render as modal
  if (isModal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Set Your Payout Wallet
            </DialogTitle>
            <DialogDescription>
              Before you can make payments or receive commissions, you need to set up your payout wallet address.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return content
}
