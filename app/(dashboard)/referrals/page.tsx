"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check, Share2, Users, Globe, Link2, Edit } from "lucide-react"
import { motion } from "framer-motion"
import { isTestUser, mockReferrals } from "@/lib/mock-data"
import { PageHeader } from "@/components/page-header"
import { useTranslation } from "@/components/language-provider"

export default function ReferralsPage() {
  const { t } = useTranslation()
  const [userId, setUserId] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [referredBy, setReferredBy] = useState<{
    name: string
    email: string
    referral_code: string
  } | null>(null)
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
        setReferrals(mockReferrals)
        setLoading(false)
        return
      }

      const supabase = createClient()

      // Get user's referral code and referred_by ID
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("referral_code, referred_by")
        .eq("id", userId)
        .single()

      if (userError) {
        console.error("Error fetching user data:", userError)
      }

      console.log("User data from database:", user)

      if (user) {
        setReferralCode(user.referral_code || "")

        // Fetch referrer info if user has a referrer
        if (user.referred_by) {
          const { data: referrer } = await supabase
            .from("users")
            .select("name, email, referral_code")
            .eq("id", user.referred_by)
            .single()

          if (referrer) {
            setReferredBy(referrer)
          }
        }
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
  const memberPageUrl = typeof window !== 'undefined' && referralCode
    ? `${window.location.origin}/ref/${referralCode}`
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
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t("referrals.title")}
        description={t("referrals.description")}
      />

      {/* Referrer + Links side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 mb-8">

      {/* Who Referred Me Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("referrals.yourReferrer")}</CardTitle>
          <CardDescription>
            The person who invited you to Snipers Trading Academy
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referredBy ? (
            <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
              <div>
                <p className="font-medium text-lg">{referredBy.name}</p>
                <p className="text-sm text-muted-foreground">{referredBy.email}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Referral Code: <span className="font-mono">{referredBy.referral_code}</span>
                </p>
              </div>
              <Badge variant="secondary">{t("referrals.yourSponsor")}</Badge>
            </div>
          ) : (
            <div className="p-4 bg-surface-2 rounded-lg">
              <p className="text-sm text-muted-foreground">Loading referrer information...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral Links Card - wider column */}
      <Card>
        <CardHeader>
          <CardTitle>{t("referrals.yourReferralLinks")}</CardTitle>
          <CardDescription>
            Share your personalized links to earn $250 per referral + 10% monthly residual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="direct" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="direct">{t("referrals.directLink")}</TabsTrigger>
              <TabsTrigger value="landing">{t("referrals.landingPage")}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="direct" className="space-y-4">
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4" />
                  {t("referrals.quickSignupLink")}
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
                      <Check className="h-4 w-4 text-[#D4A853]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button onClick={() => shareReferralLink(referralLink)}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("referrals.directLinkDesc")}
                </p>
              </div>

              <div className="p-4 bg-surface-2 rounded-lg">
                <p className="text-sm">
                  <strong>Your referral code:</strong> <span className="font-mono">{referralCode || "Loading..."}</span>
                </p>
                {!referralCode && (
                  <p className="text-xs text-red-500 mt-1">
                    Unable to load referral code. Please refresh the page.
                  </p>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="landing" className="space-y-4">
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4" />
                  {t("referrals.personalLandingPage")}
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
                      <Check className="h-4 w-4 text-[#D4A853]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button onClick={() => shareReferralLink(memberPageUrl)}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("referrals.landingPageDesc")}
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
                    {t("referrals.previewPage")}
                  </Button>
                </a>
                <Button variant="outline" className="w-full" disabled>
                  <Edit className="h-4 w-4 mr-2" />
                  {t("referrals.customizeUrl")}
                </Button>
              </div>

              <div className="p-4 bg-surface-2 rounded-lg">
                <p className="text-sm">
                  <strong>Your custom URL:</strong> <span className="font-mono">/ref/{referralCode}</span>
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      </div>{/* end Referrer + Links grid */}

      {/* Referrals List - full width */}
      <Card>
        <CardHeader>
          <CardTitle>{t("referrals.yourReferrals")}</CardTitle>
          <CardDescription>
            {t("referrals.referralsListDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">{t("referrals.noReferrals")}</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                {t("referrals.shareToEarn")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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