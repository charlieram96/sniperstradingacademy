"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { CreditCard, CheckCircle, XCircle, Clock } from "lucide-react"

export default function PaymentsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [subscription, setSubscription] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)

  const success = searchParams.get("success")
  const canceled = searchParams.get("canceled")

  useEffect(() => {
    if (session?.user?.id) {
      fetchPaymentData()
    }
  }, [session])

  async function fetchPaymentData() {
    const supabase = createClient()
    
    // Get subscription
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", session?.user?.id)
      .eq("status", "active")
      .single()
    
    setSubscription(sub)

    // Get payments
    const { data: paymentData } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", session?.user?.id)
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
      .eq("referrer_id", session?.user?.id)
      .order("created_at", { ascending: false })
      .limit(10)

    if (commissionData) {
      setCommissions(commissionData)
    }

    setLoading(false)
  }

  async function handleSubscribe() {
    setSubscribing(true)
    
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
      })
      
      const data = await response.json()
      
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Subscribe error:", error)
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
              <p className="text-gray-600 mb-4">
                Subscribe to start earning 10% commission from your referrals
              </p>
              <Button onClick={handleSubscribe} disabled={subscribing}>
                <CreditCard className="h-4 w-4 mr-2" />
                {subscribing ? "Processing..." : "Subscribe for $200/month"}
              </Button>
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