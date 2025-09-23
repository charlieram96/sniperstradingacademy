"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, Check, Share2, Users } from "lucide-react"
import { isTestUser, mockReferrals } from "@/lib/mock-data"

export default function ReferralsPage() {
  const { data: session } = useSession()
  const [referralCode, setReferralCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [referrals, setReferrals] = useState<Array<{
    id: string
    status: string
    created_at: string
    referred: {
      name: string
      email: string
      created_at: string
    }
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchReferralData() {
      if (!session?.user?.id) return
      
      // Use mock data for test user
      if (isTestUser(session.user.id)) {
        setReferralCode("DEMO1234")
        setReferrals(mockReferrals)
        setLoading(false)
        return
      }

      const supabase = createClient()
      
      // Get user's referral code
      const { data: user } = await supabase
        .from("users")
        .select("referral_code")
        .eq("id", session.user.id)
        .single()
      
      if (user) {
        setReferralCode(user.referral_code)
      }

      // Get referrals
      const { data: referralData } = await supabase
        .from("referrals")
        .select(`
          *,
          referred:referred_id (
            name,
            email,
            created_at
          )
        `)
        .eq("referrer_id", session.user.id)
        .order("created_at", { ascending: false })

      if (referralData) {
        setReferrals(referralData)
      }

      setLoading(false)
    }
    
    fetchReferralData()
  }, [session])

  const referralLink = `${window.location.origin}/register?ref=${referralCode}`

  async function copyToClipboard() {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareReferralLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Trading Hub",
          text: "Join the Trading Hub network and start earning commissions!",
          url: referralLink,
        })
      } catch (err) {
        console.error("Error sharing:", err)
      }
    } else {
      copyToClipboard()
    }
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
        <h1 className="text-3xl font-bold text-gray-900">Referrals</h1>
        <p className="text-gray-600 mt-2">Share your referral link and earn 10% commission</p>
      </div>

      {/* Referral Link Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
          <CardDescription>
            Share this link with others. You&apos;ll earn 10% commission on their monthly payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={referralLink}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="icon"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button onClick={shareReferralLink}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Your referral code:</strong> <span className="font-mono">{referralCode}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referrals</CardTitle>
          <CardDescription>
            People who joined using your referral link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No referrals yet</p>
              <p className="text-sm mt-2">Share your link to start earning commissions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{referral.referred?.name || "Unknown"}</p>
                    <p className="text-sm text-gray-600">{referral.referred?.email}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Joined {new Date(referral.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      referral.status === "active" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {referral.status}
                    </span>
                    {referral.status === "active" && (
                      <p className="text-sm text-green-600 font-medium mt-1">
                        +$20/month
                      </p>
                    )}
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