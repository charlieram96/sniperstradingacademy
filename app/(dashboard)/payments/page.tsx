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
  Clock,
  Lock,
  Unlock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wallet,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  CreditCard
} from "lucide-react"
import { PaymentScheduleSelector } from "@/components/payment-schedule-selector"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TransFiWidget } from "@/components/crypto/TransFiWidget"
import QRCode from "qrcode"

interface PaymentIntent {
  id: string
  intent_type: string
  amount_usdc: string
  status: string
  user_wallet_address: string
  expires_at: string
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
  const [payments, setPayments] = useState<Array<{
    id: string
    amount: number
    status: string
    created_at: string
  }>>([])
  const [commissions, setCommissions] = useState<Array<{
    id: string
    amount: number
    status: string
    created_at: string
    referred?: {
      name: string | null
      email: string
    }
  }>>([])
  const [payouts, setPayouts] = useState<Array<{
    id: string
    amount: number
    currency: string
    arrival_date: number
    status: string
    type: string
    created: number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [currentIntent, setCurrentIntent] = useState<PaymentIntent | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expiryCountdown, setExpiryCountdown] = useState<number>(0)
  const [checkingPayment, setCheckingPayment] = useState(false)

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

      // Get user data
      const { data: userData } = await supabase
        .from("users")
        .select("initial_payment_completed, bypass_subscription")
        .eq("id", userId)
        .single()

      if (userData) {
        setInitialPaymentCompleted(userData.initial_payment_completed || false)
        setBypassSubscription(userData.bypass_subscription || false)
      }

      // Get subscription
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .single()

      setSubscription(sub)

      // Get payments
      const { data: paymentData } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10)

      if (paymentData) {
        setPayments(paymentData)
      }

      // Get commissions earned
      const { data: commissionData } = await supabase
        .from("commissions")
        .select(`
          *,
          referred:referred_id (
            name,
            email
          )
        `)
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false })
        .limit(10)

      if (commissionData) {
        setCommissions(commissionData)
      }

      // Get USDC payouts (crypto withdrawals)
      const { data: usdcPayouts } = await supabase
        .from("usdc_transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("transaction_type", "withdrawal")
        .order("created_at", { ascending: false })
        .limit(10)

      if (usdcPayouts) {
        // Map to payout format for display
        const mappedPayouts = usdcPayouts.map((tx: { id: string; amount: number; status: string; created_at: string }) => ({
          id: tx.id,
          amount: tx.amount * 100, // Convert to cents for formatCurrency
          currency: 'USDC',
          arrival_date: new Date(tx.created_at).getTime() / 1000,
          status: tx.status,
          type: 'crypto',
          created: new Date(tx.created_at).getTime() / 1000
        }))
        setPayouts(mappedPayouts)
      }

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
    setProcessingInitial(true)

    try {
      const response = await fetch("/api/crypto/payments/create-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ intentType: "initial_unlock" }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("Payment intent error:", error)
        alert(error.error || "Failed to create payment intent")
        return
      }

      const data = await response.json()

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

  // Create payment intent for subscription
  async function handleSubscribe() {
    setSubscribing(true)

    try {
      const intentType = paymentSchedule === 'weekly' ? 'weekly_subscription' : 'monthly_subscription'

      const response = await fetch("/api/crypto/payments/create-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ intentType }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("Payment intent error:", error)
        alert(error.error || "Failed to create payment intent")
        return
      }

      const data = await response.json()

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

      {/* Payment History */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Your recent payments</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No payments yet</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="font-medium">{formatCurrency(payment.amount * 100)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    payment.status === "succeeded" || payment.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {payment.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commissions Earned */}
      <Card>
        <CardHeader>
          <CardTitle>Commissions Earned</CardTitle>
          <CardDescription>Your earnings from referrals</CardDescription>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No commissions earned yet</p>
          ) : (
            <div className="space-y-3">
              {commissions.map((commission) => (
                <div key={commission.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="font-medium">{formatCurrency(commission.amount * 100)}</p>
                    <p className="text-sm text-muted-foreground">
                      From {commission.referred?.name || commission.referred?.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(commission.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    commission.status === "paid"
                      ? "bg-green-100 text-green-800"
                      : commission.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    <Clock className="h-3 w-3 mr-1" />
                    {commission.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>Your USDC withdrawals</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No payouts yet</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Earn commissions and withdraw your USDC to an external wallet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      payout.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : payout.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <ArrowDownToLine className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">
                        ${(payout.amount / 100).toFixed(2)} {payout.currency}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payout.created * 1000).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      payout.status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : payout.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {payout.status === 'confirmed' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {payout.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                      {payout.status === 'processing' && <ArrowUpFromLine className="h-3 w-3 mr-1" />}
                      {payout.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or pay with card
                      </span>
                    </div>
                  </div>

                  {/* TransFi Widget */}
                  <TransFiWidget
                    walletAddress={currentIntent.user_wallet_address}
                    amount={currentIntent.amount_usdc}
                    intentId={currentIntent.id}
                    email={userEmail || undefined}
                    onSuccess={() => {
                      window.location.reload()
                    }}
                    onError={(error) => {
                      console.error('TransFi error:', error)
                    }}
                  />
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
