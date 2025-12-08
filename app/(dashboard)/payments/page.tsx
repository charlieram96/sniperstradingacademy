"use client"

import { useState, useEffect, Suspense, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import {
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  Wallet,
  Copy,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Bookmark,
} from "lucide-react"
import { PaymentScheduleSelector } from "@/components/payment-schedule-selector"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UnifiedTransactionHistory } from "@/components/crypto/UnifiedTransactionHistory"
import PayoutWalletSetup from "@/components/crypto/PayoutWalletSetup"
import QRCode from "qrcode"

interface PaymentInfo {
  depositAddress: string
  amountUSDC: string
  paymentType: 'initial_unlock' | 'subscription'
}

interface PaymentStatus {
  status: string
  depositAddress: string | null
  walletBalance: string
  requiredAmount: string | null
  fundsDetected: boolean
  paymentType: 'initial_unlock' | 'subscription' | 'none'
  partialAmount: string | null
  shortfall: string | null
}

function PaymentsContent() {
  const [userId, setUserId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const [initialPaymentCompleted, setInitialPaymentCompleted] = useState(false)
  const [bypassInitialPayment, setBypassInitialPayment] = useState(false)
  const [bypassSubscription, setBypassSubscription] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [processingInitial, setProcessingInitial] = useState(false)
  const [paymentSchedule, setPaymentSchedule] = useState<"weekly" | "monthly">("monthly")
  const [subscription, setSubscription] = useState<{
    id: string
    status: string
    next_billing_date: string
    created_at: string
    payment_schedule: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [checkingPayment, setCheckingPayment] = useState(false)

  // Payout wallet state
  const [walletSetupOpen, setWalletSetupOpen] = useState(false)
  const [hasPayoutWallet, setHasPayoutWallet] = useState(false)
  const [pendingPaymentType, setPendingPaymentType] = useState<string | null>(null)

  const success = searchParams.get("success")
  const canceled = searchParams.get("canceled")

  // Fetch user on mount
  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUser()
  }, [])

  // Fetch payment data when user is available
  useEffect(() => {
    async function fetchPaymentData() {
      if (!userId) return

      const supabase = createClient()

      // Get user data including payout wallet
      const { data: userData } = await supabase
        .from("users")
        .select("initial_payment_completed, bypass_initial_payment, bypass_subscription, payout_wallet_address, is_active")
        .eq("id", userId)
        .single()

      if (userData) {
        setInitialPaymentCompleted(userData.initial_payment_completed || false)
        setBypassInitialPayment(userData.bypass_initial_payment || false)
        setBypassSubscription(userData.bypass_subscription || false)
        setHasPayoutWallet(!!userData.payout_wallet_address)
        setIsActive(userData.is_active || false)
      }

      // Get subscription
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .single()

      if (sub) {
        setSubscription(sub)
        setPaymentSchedule(sub.payment_schedule === 'weekly' ? 'weekly' : 'monthly')
      }

      setLoading(false)
    }

    fetchPaymentData()
  }, [userId])

  // Generate QR code when deposit address changes
  useEffect(() => {
    async function generateQR() {
      const address = paymentInfo?.depositAddress || paymentStatus?.depositAddress
      if (address) {
        try {
          const url = await QRCode.toDataURL(address, {
            width: 200,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          })
          setQrCodeUrl(url)
        } catch (err) {
          console.error('Failed to generate QR code:', err)
        }
      }
    }
    generateQR()
  }, [paymentInfo?.depositAddress, paymentStatus?.depositAddress])

  // Check payment status
  const checkPaymentStatus = useCallback(async () => {
    setCheckingPayment(true)
    try {
      const response = await fetch('/api/crypto/payments/check-status')
      const data = await response.json()

      if (data.success) {
        setPaymentStatus(data)

        // If payment was detected and processed, close modal and refresh
        if (data.status === 'paid' || (data.fundsDetected && data.paymentType !== 'none')) {
          setPaymentModalOpen(false)
          setPaymentInfo(null)
          window.location.reload()
        }
      }
    } catch (error) {
      console.error('Error checking payment status:', error)
    } finally {
      setCheckingPayment(false)
    }
  }, [])

  // Auto-poll when modal is open
  useEffect(() => {
    if (!paymentModalOpen) return

    // Initial check
    checkPaymentStatus()

    const interval = setInterval(checkPaymentStatus, 15000) // Every 15 seconds
    return () => clearInterval(interval)
  }, [paymentModalOpen, checkPaymentStatus])

  // Get user's deposit address for payment
  async function initiatePayment(paymentType: 'initial_unlock' | 'subscription') {
    // Check if user has payout wallet set
    if (!hasPayoutWallet) {
      setPendingPaymentType(paymentType)
      setWalletSetupOpen(true)
      return
    }

    if (paymentType === 'initial_unlock') {
      setProcessingInitial(true)
    } else {
      setSubscribing(true)
    }

    try {
      const response = await fetch("/api/crypto/payments/create-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("Payment intent error:", data)
        if (data.code === "PAYOUT_WALLET_REQUIRED") {
          setPendingPaymentType(paymentType)
          setWalletSetupOpen(true)
          return
        }
        alert(data.error || "Failed to get deposit address")
        return
      }

      if (data.success && data.depositAddress) {
        setPaymentInfo({
          depositAddress: data.depositAddress,
          amountUSDC: data.amountUSDC,
          paymentType: data.paymentType,
        })
        setPaymentModalOpen(true)
      }
    } catch (error) {
      console.error("Payment error:", error)
      alert("Failed to start payment. Please try again.")
    } finally {
      setProcessingInitial(false)
      setSubscribing(false)
    }
  }

  // Handle wallet setup success
  function handleWalletSetupSuccess() {
    setHasPayoutWallet(true)
    setWalletSetupOpen(false)

    // If there was a pending payment, start it now
    if (pendingPaymentType) {
      const type = pendingPaymentType as 'initial_unlock' | 'subscription'
      setPendingPaymentType(null)
      setTimeout(() => initiatePayment(type), 500)
    }
  }

  // Copy deposit address
  function handleCopyAddress() {
    const address = paymentInfo?.depositAddress || paymentStatus?.depositAddress
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleCancelSubscription() {
    if (!confirm("Are you sure you want to cancel your subscription?")) {
      return
    }
    alert("Subscription cancellation will be implemented soon")
  }

  // Determine if user needs to pay
  const needsInitialPayment = !initialPaymentCompleted && !bypassInitialPayment
  const needsSubscription = (initialPaymentCompleted || bypassInitialPayment) && !bypassSubscription

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const currentAmount = paymentInfo?.amountUSDC || paymentStatus?.requiredAmount
  const currentAddress = paymentInfo?.depositAddress || paymentStatus?.depositAddress
  const currentPaymentType = paymentInfo?.paymentType || paymentStatus?.paymentType

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground mt-2">Manage your subscription and view payment history</p>
      </div>

      {/* Activation Required Banner */}
      {needsInitialPayment && (
        <Card className="mb-6 border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-red-600 dark:text-red-400" />
              <div>
                <CardTitle className="text-red-900 dark:text-red-200">Account Locked - Activation Required</CardTitle>
                <CardDescription className="text-red-700 dark:text-red-300 mt-1">
                  Complete the initial payment below to activate your account and unlock all platform features.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-300">
                <strong>Important:</strong> Until you complete the $499 activation payment, your account will remain locked and:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                <li>Your referral code will not work (referrals cannot sign up using your code)</li>
                <li>You cannot access the Trading Academy or other platform features</li>
                <li>You cannot view team statistics or earn commissions</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success/Cancel Messages */}
      {success && (
        <Card className="mb-6 border-green-500/20 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              Payment Successful!
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your payment has been confirmed. You can start earning commissions from referrals.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canceled && (
        <Card className="mb-6 border-yellow-500/20 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center">
              <XCircle className="h-5 w-5 mr-2 text-yellow-500" />
              Payment Canceled
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your payment process was canceled. You can try again anytime.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Initial Membership Payment */}
      {needsInitialPayment && (
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle className="text-foreground">Unlock Your Membership</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              One-time payment to unlock your 3 referral slots and start building your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-2xl font-bold text-foreground">{formatCurrency(49900)}</p>
              <p className="text-sm text-muted-foreground">One-time membership fee (USDC)</p>
            </div>
            <Button
              onClick={() => initiatePayment('initial_unlock')}
              disabled={processingInitial}
              size="lg"
            >
              {processingInitial ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Getting Deposit Address...
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Unlock Membership
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Subscription Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Subscription Status</CardTitle>
          <CardDescription>
            Monthly subscription for Trading Hub network access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscription && isActive ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold">
                    {subscription.payment_schedule === 'weekly' ? '$49.75/week' : '$199/month'}
                  </p>
                  <p className="text-sm text-muted-foreground">Trading Hub Premium</p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
              <div className="space-y-2 text-sm">
                {!bypassSubscription && subscription.next_billing_date && (
                  <p>
                    <span className="text-muted-foreground">Next billing date:</span>{" "}
                    {new Date(subscription.next_billing_date).toLocaleDateString()}
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">Member since:</span>{" "}
                  {new Date(subscription.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="mt-4">
                <Button variant="outline" onClick={handleCancelSubscription}>
                  Cancel Subscription
                </Button>
              </div>
            </div>
          ) : bypassSubscription ? (
            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border-2 border-green-200 dark:border-green-900">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <p className="font-semibold text-green-900 dark:text-green-300">
                  Subscription Bypass Active
                </p>
              </div>
              <p className="text-sm text-green-700 dark:text-green-400">
                You have been granted subscription bypass. You do not need to pay the monthly subscription fee.
              </p>
            </div>
          ) : (
            <div>
              {needsInitialPayment ? (
                <div>
                  <p className="text-yellow-600 mb-4">
                    Complete the initial membership payment first before subscribing
                  </p>
                  <Button disabled className="opacity-50">
                    <Lock className="h-4 w-4 mr-2" />
                    Subscription Locked
                  </Button>
                </div>
              ) : needsSubscription ? (
                <div className="space-y-6">
                  <PaymentScheduleSelector
                    value={paymentSchedule}
                    onChange={setPaymentSchedule}
                  />
                  <Button
                    onClick={() => initiatePayment('subscription')}
                    disabled={subscribing}
                    size="lg"
                    className="w-full"
                  >
                    {subscribing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Getting Deposit Address...
                      </>
                    ) : (
                      <>
                        <Wallet className="h-4 w-4 mr-2" />
                        Subscribe {paymentSchedule === 'weekly' ? '$49.75/week' : '$199/month'}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="font-medium text-green-900 dark:text-green-300">All payments up to date</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unified Transaction History */}
      <div className="mb-8">
        <UnifiedTransactionHistory limit={50} showFilters={true} showTitle={true} />
      </div>

      {/* Payment Modal - Simplified for Permanent Addresses */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Complete Your Payment
            </DialogTitle>
            <DialogDescription>
              Pay ${currentAmount} USDC to complete your {currentPaymentType === 'initial_unlock' ? 'membership activation' : 'subscription'}
            </DialogDescription>
          </DialogHeader>

          {currentAddress && (
            <div className="space-y-6">
              {/* Permanent Address Notice */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                <Bookmark className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This is your permanent deposit address. Save it for future payments.
                </p>
              </div>

              {/* Funds Detected Status */}
              {paymentStatus?.fundsDetected && (
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                  <Loader2 className="h-5 w-5 text-green-600 animate-spin" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-200">Payment Detected!</p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Processing your payment now...
                    </p>
                  </div>
                </div>
              )}

              {/* Partial Payment Status */}
              {paymentStatus?.status === 'partial_payment' && paymentStatus.partialAmount && (
                <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-orange-900 dark:text-orange-200">Partial Payment Received</p>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      We received ${paymentStatus.partialAmount} USDC.
                      Please send an additional{' '}
                      <strong>${paymentStatus.shortfall} USDC</strong>{' '}
                      to complete your payment.
                    </p>
                  </div>
                </div>
              )}

              {/* QR Code and Address */}
              {!paymentStatus?.fundsDetected && (
                <>
                  <div className="flex flex-col items-center gap-4">
                    {qrCodeUrl && (
                      <div className="p-4 bg-white rounded-lg border">
                        <img src={qrCodeUrl} alt="Payment QR Code" className="w-48 h-48" />
                      </div>
                    )}

                    <div className="text-center w-full">
                      <p className="text-sm text-muted-foreground mb-2">
                        Send USDC (Polygon) to this address:
                      </p>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <code className="text-xs font-mono break-all flex-1">
                          {currentAddress}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyAddress}
                          className="shrink-0"
                        >
                          {copied ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Amount Info */}
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="text-xl font-bold">${currentAmount} USDC</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Send this amount on the Polygon network
                    </p>
                  </div>

                  {/* Balance Info */}
                  {paymentStatus && paymentStatus.walletBalance !== '0' && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Current Balance</span>
                        <span className="font-medium">${paymentStatus.walletBalance} USDC</span>
                      </div>
                    </div>
                  )}

                  {/* Important note */}
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Important:</strong> Make sure you are sending USDC on the Polygon network.
                      Sending on other networks (Ethereum, etc.) may result in loss of funds.
                    </p>
                  </div>
                </>
              )}

              {/* Manual Check Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={checkPaymentStatus}
                disabled={checkingPayment}
              >
                {checkingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check Payment Status
                  </>
                )}
              </Button>

              {/* Help Text */}
              <div className="text-center text-xs text-muted-foreground">
                <p>
                  Need help?{' '}
                  <a href="mailto:support@sniperstradingacademy.com" className="text-primary hover:underline">
                    Contact Support
                  </a>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payout Wallet Setup Modal */}
      <PayoutWalletSetup
        open={walletSetupOpen}
        onOpenChange={setWalletSetupOpen}
        onSuccess={handleWalletSetupSuccess}
      />
    </div>
  )
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading payment data...</div>
      </div>
    }>
      <PaymentsContent />
    </Suspense>
  )
}
