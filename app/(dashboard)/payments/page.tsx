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
  QrCode,
  AlertTriangle,
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

interface PaymentIntent {
  id: string
  intent_type: string
  amount_usdc: string
  status: string
  user_wallet_address: string
  expires_at: string
  deposit_addresses?: {
    is_underpaid?: boolean
    shortfall_amount?: number
    received_amount?: number
    expected_amount?: number
    is_late?: boolean
  }
}

function PaymentsContent() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const [initialPaymentCompleted, setInitialPaymentCompleted] = useState(false)
  const [bypassSubscription, setBypassSubscription] = useState(false)
  const [processingInitial, setProcessingInitial] = useState(false)
  const [paymentSchedule, setPaymentSchedule] = useState<"weekly" | "monthly">("monthly")
  const [subscription, setSubscription] = useState<{
    id: string
    status: string
    current_period_end: string
    created_at: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [currentIntent, setCurrentIntent] = useState<PaymentIntent | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expiryCountdown, setExpiryCountdown] = useState<number>(0)
  const [checkingPayment, setCheckingPayment] = useState(false)

  // Payout wallet state
  const [walletSetupOpen, setWalletSetupOpen] = useState(false)
  const [hasPayoutWallet, setHasPayoutWallet] = useState(false)
  const [pendingPaymentType, setPendingPaymentType] = useState<string | null>(null)

  const success = searchParams.get("success")
  const canceled = searchParams.get("canceled")
  const intentId = searchParams.get("intentId")

  // Fetch user on mount
  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setUserEmail(user.email || null)
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
        .select("initial_payment_completed, bypass_subscription, payout_wallet_address")
        .eq("id", userId)
        .single()

      if (userData) {
        setInitialPaymentCompleted(userData.initial_payment_completed || false)
        setBypassSubscription(userData.bypass_subscription || false)
        setHasPayoutWallet(!!userData.payout_wallet_address)
      }

      // Get subscription
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .single()

      setSubscription(sub)

      setLoading(false)
    }

    fetchPaymentData()
  }, [userId])

  // Generate QR code when wallet address changes
  useEffect(() => {
    async function generateQR() {
      if (currentIntent?.user_wallet_address) {
        try {
          const url = await QRCode.toDataURL(currentIntent.user_wallet_address, {
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
  }, [currentIntent?.user_wallet_address])

  // Countdown timer for payment expiry
  useEffect(() => {
    if (!currentIntent?.expires_at) return

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((new Date(currentIntent.expires_at).getTime() - Date.now()) / 1000))
      setExpiryCountdown(remaining)

      if (remaining === 0) {
        setPaymentModalOpen(false)
        setCurrentIntent(null)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [currentIntent?.expires_at])

  // Poll for payment status
  const checkPaymentStatus = useCallback(async () => {
    if (!currentIntent?.id) return

    setCheckingPayment(true)
    try {
      const response = await fetch(`/api/crypto/payments/check-status?intentId=${currentIntent.id}`)
      const data = await response.json()

      if (data.success && data.intent) {
        if (data.intent.status === 'completed') {
          setPaymentModalOpen(false)
          setCurrentIntent(null)
          // Refresh page data
          window.location.reload()
        } else if (data.intent.status === 'processing') {
          // Keep modal open, show processing state
          setCurrentIntent(prev => prev ? { ...prev, status: 'processing' } : null)
        }
      }
    } catch (error) {
      console.error('Error checking payment status:', error)
    } finally {
      setCheckingPayment(false)
    }
  }, [currentIntent?.id])

  // Auto-poll when modal is open
  useEffect(() => {
    if (!paymentModalOpen || !currentIntent) return

    const interval = setInterval(checkPaymentStatus, 10000) // Every 10 seconds
    return () => clearInterval(interval)
  }, [paymentModalOpen, currentIntent, checkPaymentStatus])

  // Check for pending intent on page load (from redirect)
  useEffect(() => {
    async function checkPendingIntent() {
      if (!intentId || !userId) return

      try {
        const response = await fetch(`/api/crypto/payments/check-status?intentId=${intentId}`)
        const data = await response.json()

        if (data.success && data.intent && data.intent.status !== 'completed') {
          setCurrentIntent(data.intent)
          setPaymentModalOpen(true)
        }
      } catch (error) {
        console.error('Error checking intent:', error)
      }
    }

    checkPendingIntent()
  }, [intentId, userId])

  // Create payment intent for initial unlock
  async function handleInitialPayment() {
    // Check if user has payout wallet set
    if (!hasPayoutWallet) {
      setPendingPaymentType("initial_unlock")
      setWalletSetupOpen(true)
      return
    }

    setProcessingInitial(true)

    try {
      const response = await fetch("/api/crypto/payments/create-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ intentType: "initial_unlock" }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("Payment intent error:", data)
        // Check if it's a payout wallet required error
        if (data.code === "PAYOUT_WALLET_REQUIRED") {
          setPendingPaymentType("initial_unlock")
          setWalletSetupOpen(true)
          return
        }
        alert(data.error || "Failed to create payment intent")
        return
      }

      if (data.success && data.intent) {
        setCurrentIntent(data.intent)
        setPaymentModalOpen(true)
      }
    } catch (error) {
      console.error("Initial payment error:", error)
      alert("Failed to start payment. Please try again.")
    } finally {
      setProcessingInitial(false)
    }
  }

  // Handle wallet setup success
  function handleWalletSetupSuccess() {
    setHasPayoutWallet(true)
    setWalletSetupOpen(false)

    // If there was a pending payment, start it now
    if (pendingPaymentType === "initial_unlock") {
      setPendingPaymentType(null)
      setTimeout(() => handleInitialPayment(), 500)
    } else if (pendingPaymentType) {
      setPendingPaymentType(null)
      setTimeout(() => handleSubscribe(), 500)
    }
  }

  // Create payment intent for subscription
  async function handleSubscribe() {
    const intentType = paymentSchedule === 'weekly' ? 'weekly_subscription' : 'monthly_subscription'

    // Check if user has payout wallet set
    if (!hasPayoutWallet) {
      setPendingPaymentType(intentType)
      setWalletSetupOpen(true)
      return
    }

    setSubscribing(true)

    try {
      const response = await fetch("/api/crypto/payments/create-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ intentType }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("Payment intent error:", data)
        // Check if it's a payout wallet required error
        if (data.code === "PAYOUT_WALLET_REQUIRED") {
          setPendingPaymentType(intentType)
          setWalletSetupOpen(true)
          return
        }
        alert(data.error || "Failed to create payment intent")
        return
      }

      if (data.success && data.intent) {
        setCurrentIntent(data.intent)
        setPaymentModalOpen(true)
      }
    } catch (error) {
      console.error("Subscribe error:", error)
      alert("Failed to start payment. Please try again.")
    } finally {
      setSubscribing(false)
    }
  }

  // Copy wallet address
  function handleCopyAddress() {
    if (currentIntent?.user_wallet_address) {
      navigator.clipboard.writeText(currentIntent.user_wallet_address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Format countdown time
  function formatCountdown(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  async function handleCancelSubscription() {
    if (!confirm("Are you sure you want to cancel your subscription?")) {
      return
    }
    // TODO: Implement subscription cancellation
    alert("Subscription cancellation will be implemented soon")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground mt-2">Manage your subscription and view payment history</p>
      </div>

      {/* Activation Required Banner */}
      {!initialPaymentCompleted && (
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
      {!initialPaymentCompleted && (
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
              onClick={handleInitialPayment}
              disabled={processingInitial}
              size="lg"
            >
              {processingInitial ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Payment...
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
          {subscription ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(19900)}/month</p>
                  <p className="text-sm text-muted-foreground">Trading Hub Premium</p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
              <div className="space-y-2 text-sm">
                {!bypassSubscription && (
                  <p>
                    <span className="text-muted-foreground">Next billing date:</span>{" "}
                    {new Date(subscription.current_period_end).toLocaleDateString()}
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
              {!initialPaymentCompleted ? (
                <div>
                  <p className="text-yellow-600 mb-4">
                    Complete the initial membership payment first before subscribing
                  </p>
                  <Button disabled className="opacity-50">
                    <Lock className="h-4 w-4 mr-2" />
                    Subscription Locked
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <PaymentScheduleSelector
                    value={paymentSchedule}
                    onChange={setPaymentSchedule}
                  />
                  <Button
                    onClick={handleSubscribe}
                    disabled={subscribing}
                    size="lg"
                    className="w-full"
                  >
                    {subscribing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Payment...
                      </>
                    ) : (
                      <>
                        <Wallet className="h-4 w-4 mr-2" />
                        Subscribe {paymentSchedule === 'weekly' ? '$49.75/week' : '$199/month'}
                      </>
                    )}
                  </Button>
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

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Complete Your Payment
            </DialogTitle>
            <DialogDescription>
              Pay ${currentIntent?.amount_usdc} USDC to complete your {currentIntent?.intent_type === 'initial_unlock' ? 'membership activation' : 'subscription'}
            </DialogDescription>
          </DialogHeader>

          {currentIntent && (
            <div className="space-y-6">
              {/* Countdown Timer */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Time remaining</span>
                <span className={`font-mono font-bold ${expiryCountdown < 300 ? 'text-red-500' : 'text-foreground'}`}>
                  {formatCountdown(expiryCountdown)}
                </span>
              </div>

              {/* Status */}
              {currentIntent.status === 'processing' && (
                <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                  <Loader2 className="h-5 w-5 text-yellow-600 animate-spin" />
                  <div>
                    <p className="font-medium text-yellow-900 dark:text-yellow-200">Payment Processing</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      We detected your payment and are confirming it...
                    </p>
                  </div>
                </div>
              )}

              {/* Underpaid Status */}
              {currentIntent.deposit_addresses?.is_underpaid && (
                <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-orange-900 dark:text-orange-200">Partial Payment Received</p>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      We received ${((currentIntent.deposit_addresses.received_amount || 0) / 1000000).toFixed(2)} USDC,
                      but you still need to send an additional{' '}
                      <strong>${((currentIntent.deposit_addresses.shortfall_amount || 0) / 1000000).toFixed(2)} USDC</strong>{' '}
                      to the same address below.
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                      Please send the remaining amount to complete your payment.
                    </p>
                  </div>
                </div>
              )}

              {/* Late Payment Notice */}
              {currentIntent.deposit_addresses?.is_late && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-200">Late Payment Accepted</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Your payment arrived after the deadline but has been accepted and is being processed.
                    </p>
                  </div>
                </div>
              )}

              {/* QR Code and Address */}
              {currentIntent.status !== 'processing' && (
                <>
                  <div className="flex flex-col items-center gap-4">
                    {qrCodeUrl && (
                      <div className="p-4 bg-white rounded-lg border">
                        <img src={qrCodeUrl} alt="Payment QR Code" className="w-48 h-48" />
                      </div>
                    )}

                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Send USDC (Polygon) to this address:
                      </p>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <code className="text-xs font-mono break-all flex-1">
                          {currentIntent.user_wallet_address}
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
                      <span className="text-xl font-bold">${currentIntent.amount_usdc} USDC</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Send exactly this amount on the Polygon network
                    </p>
                  </div>

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
                    <QrCode className="h-4 w-4 mr-2" />
                    I&apos;ve Sent the Payment
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
