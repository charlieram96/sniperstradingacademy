"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { CreditCard, CheckCircle, XCircle, Clock, Lock, Unlock, ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react"

function PaymentsContent() {
  const [userId, setUserId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const [initialPaymentCompleted, setInitialPaymentCompleted] = useState(false)
  const [processingInitial, setProcessingInitial] = useState(false)
  const [subscription, setSubscription] = useState<{
    id: string
    status: string
    current_period_end: string
    cancel_at_period_end: boolean
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

  const success = searchParams.get("success")
  const canceled = searchParams.get("canceled")

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

  useEffect(() => {
    async function fetchPaymentData() {
      if (!userId) return

      const supabase = createClient()
      
      // Get user data
      const { data: userData } = await supabase
        .from("users")
        .select("initial_payment_completed")
        .eq("id", userId)
        .single()
      
      if (userData) {
        setInitialPaymentCompleted(userData.initial_payment_completed || false)
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

      // Get payouts from Stripe Connect
      try {
        const response = await fetch('/api/stripe/connect/payouts')
        if (response.ok) {
          const payoutsData = await response.json()
          if (payoutsData.payouts) {
            setPayouts(payoutsData.payouts)
          }
        }
      } catch (error) {
        console.error('Error fetching payouts:', error)
      }

      setLoading(false)
    }

    fetchPaymentData()
  }, [userId])

  async function handleInitialPayment() {
    setProcessingInitial(true)
    
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentType: "initial" }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        console.error("Checkout error:", error)
        alert(error.error || "Failed to create checkout session")
        return
      }
      
      const data = await response.json()
      
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Initial payment error:", error)
      alert("Failed to start checkout. Please try again.")
    } finally {
      setProcessingInitial(false)
    }
  }

  async function handleSubscribe() {
    setSubscribing(true)
    
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentType: "subscription" }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        console.error("Checkout error:", error)
        alert(error.error || "Failed to create checkout session")
        return
      }
      
      const data = await response.json()
      
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Subscribe error:", error)
      alert("Failed to start checkout. Please try again.")
    } finally {
      setSubscribing(false)
    }
  }

  async function handleCancelSubscription() {
    if (!confirm("Are you sure you want to cancel your subscription?")) {
      return
    }

    // Implement subscription cancellation
    alert("Subscription cancellation will be implemented with Stripe customer portal")
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

      {/* Success/Cancel Messages */}
      {success && (
        <Card className="mb-6 border-green-500/20 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              Subscription Activated!
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your subscription is now active. You can start earning commissions from referrals.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canceled && (
        <Card className="mb-6 border-yellow-500/20 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center">
              <XCircle className="h-5 w-5 mr-2 text-yellow-500" />
              Subscription Canceled
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your subscription process was canceled. You can try again anytime.
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
              <p className="text-2xl font-bold text-foreground">{formatCurrency(50000)}</p>
              <p className="text-sm text-muted-foreground">One-time membership fee</p>
            </div>
            <Button 
              onClick={handleInitialPayment} 
              disabled={processingInitial}
            >
              <Unlock className="h-4 w-4 mr-2" />
              {processingInitial ? "Processing..." : "Unlock Membership"}
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
                  <p className="text-2xl font-bold">{formatCurrency(20000)}/month</p>
                  <p className="text-sm text-muted-foreground">Trading Hub Premium</p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Next billing date:</span>{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
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
                <div>
                  <p className="text-muted-foreground mb-4">
                    Subscribe to start earning 10% commission from your referrals
                  </p>
                  <Button onClick={handleSubscribe} disabled={subscribing}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    {subscribing ? "Processing..." : "Subscribe for $200/month"}
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
                    payment.status === "succeeded" 
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
          <CardDescription>Your commission payouts to bank account</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No payouts yet</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Connect your bank account to start receiving automatic monthly payouts
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      payout.status === 'paid' 
                        ? 'bg-green-100 text-green-700' 
                        : payout.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <ArrowDownToLine className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {formatCurrency(payout.amount)} {payout.currency.toUpperCase()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Arrival: {new Date(payout.arrival_date * 1000).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      payout.status === 'paid' 
                        ? 'bg-green-100 text-green-800' 
                        : payout.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : payout.status === 'in_transit'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {payout.status === 'paid' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {payout.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                      {payout.status === 'in_transit' && <ArrowUpFromLine className="h-3 w-3 mr-1" />}
                      {payout.status}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(payout.created * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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