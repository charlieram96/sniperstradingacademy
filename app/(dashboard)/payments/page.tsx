"use client"

import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { CreditCard, CheckCircle, XCircle, Clock, Lock, Unlock } from "lucide-react"

function PaymentsContent() {
  const { data: session } = useSession()
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
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)

  const success = searchParams.get("success")
  const canceled = searchParams.get("canceled")

  useEffect(() => {
    async function fetchPaymentData() {
      if (!session?.user?.id) return
      
      const supabase = createClient()
      
      // Get user data
      const { data: userData } = await supabase
        .from("users")
        .select("initial_payment_completed")
        .eq("id", session.user.id)
        .single()
      
      if (userData) {
        setInitialPaymentCompleted(userData.initial_payment_completed || false)
      }
      
      // Get subscription
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .single()
      
      setSubscription(sub)

      // Get payments
      const { data: paymentData } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", session.user.id)
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
        .eq("referrer_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(10)

      if (commissionData) {
        setCommissions(commissionData)
      }

      setLoading(false)
    }
    
    fetchPaymentData()
  }, [session])

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
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-600 mt-2">Manage your subscription and view payment history</p>
      </div>

      {/* Success/Cancel Messages */}
      {success && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Subscription Activated!
            </CardTitle>
            <CardDescription className="text-green-700">
              Your subscription is now active. You can start earning commissions from referrals.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canceled && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-900 flex items-center">
              <XCircle className="h-5 w-5 mr-2" />
              Subscription Canceled
            </CardTitle>
            <CardDescription className="text-yellow-700">
              Your subscription process was canceled. You can try again anytime.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Initial Membership Payment */}
      {!initialPaymentCompleted && (
        <Card className="mb-8 border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-900">Unlock Your Membership</CardTitle>
            </div>
            <CardDescription className="text-red-700">
              One-time payment to unlock your 3 referral slots and start building your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-2xl font-bold text-red-900">{formatCurrency(50000)}</p>
              <p className="text-sm text-red-700">One-time membership fee</p>
            </div>
            <Button 
              onClick={handleInitialPayment} 
              disabled={processingInitial}
              className="bg-red-600 hover:bg-red-700"
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
                  <p className="text-sm text-gray-600">Trading Hub Premium</p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-600">Next billing date:</span>{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
                <p>
                  <span className="text-gray-600">Member since:</span>{" "}
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
                  <p className="text-gray-600 mb-4">
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
            <p className="text-gray-500 text-center py-4">No payments yet</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="font-medium">{formatCurrency(payment.amount * 100)}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    payment.status === "succeeded" 
                      ? "bg-green-100 text-green-800" 
                      : "bg-gray-100 text-gray-800"
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
            <p className="text-gray-500 text-center py-4">No commissions earned yet</p>
          ) : (
            <div className="space-y-3">
              {commissions.map((commission) => (
                <div key={commission.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="font-medium">{formatCurrency(commission.amount * 100)}</p>
                    <p className="text-sm text-gray-600">
                      From {commission.referred?.name || commission.referred?.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(commission.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    commission.status === "paid" 
                      ? "bg-green-100 text-green-800" 
                      : commission.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
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
    </div>
  )
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading payment data...</div>
      </div>
    }>
      <PaymentsContent />
    </Suspense>
  )
}