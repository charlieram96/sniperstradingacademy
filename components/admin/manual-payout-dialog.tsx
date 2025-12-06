"use client"

import { useState } from "react"
import { DollarSign, AlertCircle } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { UserSearchCombobox, PayoutUser } from "./user-search-combobox"
import { Card } from "@/components/ui/card"

interface ManualPayoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: PayoutUser[]
  onSuccess: () => void
}

const MAX_AMOUNT = 2000

export function ManualPayoutDialog({
  open,
  onOpenChange,
  users,
  onSuccess
}: ManualPayoutDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")

  const amountNumber = parseFloat(amount) || 0
  const selectedUser = users.find(u => u.id === selectedUserId)

  const isValidAmount = amountNumber > 0 && amountNumber <= MAX_AMOUNT
  const canSubmit = selectedUserId && isValidAmount && description.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/payouts/create-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          amount: amountNumber,
          description: description.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create manual payout")
      }

      // Success
      onSuccess()
      resetForm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedUserId("")
    setAmount("")
    setDescription("")
    setError("")
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!loading) {
      if (!newOpen) {
        resetForm()
      }
      onOpenChange(newOpen)
    }
  }

  // Truncate wallet address for display
  const truncateAddress = (address: string | null) => {
    if (!address) return "Not set"
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Manual Payout</DialogTitle>
          <DialogDescription>
            Create an immediate USDC payout to a user on Polygon network.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Selection */}
          <div className="space-y-2">
            <Label htmlFor="user">Select User</Label>
            <UserSearchCombobox
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              users={users}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Only users with payout wallet addresses are shown
            </p>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount (USDC)
              <span className="text-muted-foreground ml-2 font-normal">
                Max: ${MAX_AMOUNT.toLocaleString()}
              </span>
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                min="0"
                max={MAX_AMOUNT}
                step="0.01"
                disabled={loading}
              />
            </div>
            {amount && !isValidAmount && (
              <p className="text-xs text-destructive">
                Amount must be between $0.01 and ${MAX_AMOUNT.toLocaleString()}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description / Note</Label>
            <Textarea
              id="description"
              placeholder="Explain the reason for this manual payout..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={3}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Required for audit purposes
            </p>
          </div>

          {/* Preview */}
          {isValidAmount && selectedUser && (
            <Card className="p-4 bg-muted/50">
              <p className="text-sm font-medium mb-2">Transfer Preview</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipient:</span>
                  <span className="font-medium">{selectedUser.name || selectedUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wallet:</span>
                  <code className="text-xs bg-background px-1.5 py-0.5 rounded">
                    {truncateAddress(selectedUser.payout_wallet_address)}
                  </code>
                </div>
                <div className="border-t pt-1 mt-1 flex justify-between">
                  <span className="font-medium">Amount:</span>
                  <span className="font-bold text-green-600">${amountNumber.toFixed(2)} USDC</span>
                </div>
              </div>
            </Card>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? "Processing..." : "Create & Process Payout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
