"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check, Share2, Users, Globe, Link2, Edit } from "lucide-react"
import { isTestUser, mockReferrals } from "@/lib/mock-data"

export default function ReferralsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState("")
  const [urlSlug, setUrlSlug] = useState("")
  const [copied, setCopied] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
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
    async function fetchReferralData() {
      if (!userId) return

      // Use mock data for test user
      if (isTestUser(userId)) {
        setReferralCode("DEMO1234")
        setUrlSlug("demo-trader")
        setReferrals(mockReferrals)
        setLoading(false)
        return
      }

      const supabase = createClient()
      
      // Get user's referral code and URL slug
      const { data: user } = await supabase
        .from("users")
        .select("referral_code, url_slug")
        .eq("id", userId)
        .single()
      
      if (user) {
        setReferralCode(user.referral_code)
        setUrlSlug(user.url_slug || "")
      }
      
      // Get referrals
      const { data: referralsData } = await supabase
        .from("referrals")
        .select(`
          id,
          status,
          created_at,
          referred:referred_id (
            name,
            email,
            created_at
          )
        `)
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false })
      
      if (referralsData) {
        // @ts-expect-error - Supabase types
        setReferrals(referralsData)
      }
      
      setLoading(false)
    }

    fetchReferralData()
  }, [userId])

  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/register?ref=${referralCode}`
    : ''
  const memberPageUrl = typeof window !== 'undefined' && urlSlug
    ? `${window.location.origin}/ref/${urlSlug}`
    : ''

  async function copyToClipboard(text: string, type: 'link' | 'url' = 'link') {
    await navigator.clipboard.writeText(text)
    if (type === 'link') {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    }
  }

  async function shareReferralLink(url: string = referralLink) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Snipers Trading Academy",
          text: "Master options trading with expert guidance and earn while you learn!",
          url: url,
        })
      } catch (err) {
        console.error("Error sharing:", err)
      }
    } else {
      copyToClipboard(url, url === memberPageUrl ? 'url' : 'link')
    }
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
        <h1 className="text-3xl font-bold text-foreground">Referrals</h1>
        <p className="text-muted-foreground mt-2">Share your referral link and earn 10% commission</p>
      </div>

      {/* Referral Links Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Referral Links</CardTitle>
          <CardDescription>
            Share your personalized links to earn $250 per referral + 10% monthly residual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="direct" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="direct">Direct Link</TabsTrigger>
              <TabsTrigger value="landing">Landing Page</TabsTrigger>
            </TabsList>
            
            <TabsContent value="direct" className="space-y-4">
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4" />
                  Quick Signup Link
                </label>
                <div className="flex gap-2">
                  <Input
                    value={referralLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={() => copyToClipboard(referralLink, 'link')}
                    variant="outline"
                    size="icon"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button onClick={() => shareReferralLink(referralLink)}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Direct link to registration with your referral code
                </p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  <strong>Your referral code:</strong> <span className="font-mono">{referralCode}</span>
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="landing" className="space-y-4">
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4" />
                  Your Personal Landing Page
                </label>
                <div className="flex gap-2">
                  <Input
                    value={memberPageUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={() => copyToClipboard(memberPageUrl, 'url')}
                    variant="outline"
                    size="icon"
                  >
                    {copiedUrl ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button onClick={() => shareReferralLink(memberPageUrl)}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Professional landing page with your personal branding
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <a 
                  href={memberPageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full">
                    <Globe className="h-4 w-4 mr-2" />
                    Preview Your Page
                  </Button>
                </a>
                <Button variant="outline" className="w-full" disabled>
                  <Edit className="h-4 w-4 mr-2" />
                  Customize URL (Coming Soon)
                </Button>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  <strong>Your custom URL:</strong> <span className="font-mono">/ref/{urlSlug}</span>
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referrals</CardTitle>
          <CardDescription>
            People who have signed up using your referral link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No referrals yet</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Share your referral link to start earning commissions
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {referrals.map((referral) => (
                <div key={referral.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{referral.referred.name}</p>
                    <p className="text-sm text-muted-foreground">{referral.referred.email}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Joined {new Date(referral.referred.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={referral.status === 'active' ? 'default' : 'secondary'}>
                    {referral.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}