import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  CheckCircle,
  ArrowRight,
  Trophy,
  Target,
  Zap,
  Star,
  ChartBar,
  BookOpen
} from "lucide-react"

export default async function MemberLandingPage({ 
  params 
}: { 
  params: { slug: string } 
}) {
  // Handle demo/test cases
  if (params.slug === "demo-trader") {
    const demoMember = {
      id: "demo-user",
      name: "Demo Trader",
      url_slug: "demo-trader",
      custom_message: "I've been trading with Snipers Academy for 6 months and the results have been incredible! Join me and let's grow together.",
      profile_views: 1234,
      referral_code: "DEMO1234",
      created_at: new Date().toISOString(),
      total_referrals: 12,
      active_referrals: 8
    }
    
    return renderPage(demoMember)
  }

  const supabase = await createClient()
  
  // Get member data by URL slug
  const { data: member, error } = await supabase
    .from("member_public_profile")
    .select("*")
    .eq("url_slug", params.slug)
    .single()

  if (error || !member) {
    notFound()
  }

  // Track visit (in production, you'd also get IP and user agent from headers)
  try {
    await supabase.rpc("track_referral_visit", {
      p_user_id: member.id
    })
  } catch (e) {
    // Silently fail if tracking doesn't work
    console.error("Failed to track visit:", e)
  }

  return renderPage(member)
}

interface MemberProfile {
  id: string
  name: string
  url_slug: string
  custom_message?: string
  profile_views: number
  referral_code: string
  created_at: string
  total_referrals?: number
  active_referrals?: number
}

function renderPage(member: MemberProfile) {

  const features = [
    {
      icon: BookOpen,
      title: "Expert-Led Courses",
      description: "Learn from professional traders with proven track records"
    },
    {
      icon: ChartBar,
      title: "Live Trading Sessions",
      description: "Watch real-time trades and learn decision-making processes"
    },
    {
      icon: Users,
      title: "Community Support",
      description: "Join a network of traders sharing strategies and insights"
    },
    {
      icon: Trophy,
      title: "Earn While You Learn",
      description: "Build passive income through our referral program"
    }
  ]

  const benefits = [
    "Comprehensive options trading curriculum",
    "Daily live trading sessions",
    "1-on-1 mentorship opportunities",
    "Advanced trading tools and scanners",
    "Private Discord community",
    "Weekly strategy workshops",
    "Real-time trade alerts",
    "Professional certification"
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Image
                src="/gold-logo.svg"
                alt="Snipers Trading Academy"
                width={160}
                height={40}
                className="h-10 w-auto"
              />
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="outline">Login</Button>
              </Link>
              <Link href={`/register?ref=${member.referral_code}`}>
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          {member.name && (
            <Badge className="mb-4" variant="outline">
              Referred by {member.name}
            </Badge>
          )}
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Master Options Trading
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of successful traders who are earning consistent profits 
            with our proven strategies and expert guidance.
          </p>

          {member.custom_message && (
            <Card className="mb-8 max-w-2xl mx-auto border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <p className="text-lg italic">&ldquo;{member.custom_message}&rdquo;</p>
                <p className="text-sm text-muted-foreground mt-2">- {member.name}</p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href={`/register?ref=${member.referral_code}`}>
              <Button size="lg" className="w-full sm:w-auto">
                Start Your Journey
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              <BookOpen className="mr-2 h-5 w-5" />
              View Curriculum
            </Button>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>30-Day Money Back</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>10,000+ Students</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>4.9/5 Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose Snipers Academy?
            </h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to become a profitable trader
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-2" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Investment Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Your Investment in Success
            </h2>
            <p className="text-xl text-muted-foreground">
              Join today and start your trading journey
            </p>
          </div>

          <Card className="border-primary shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Full Academy Access</CardTitle>
              <CardDescription className="text-lg">
                Everything you need to succeed in options trading
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-2">
                <div>
                  <span className="text-4xl font-bold">$500</span>
                  <span className="text-muted-foreground"> one-time activation</span>
                </div>
                <div className="text-xl">+</div>
                <div>
                  <span className="text-4xl font-bold">$200</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="bg-primary/10 rounded-lg p-4">
                <p className="font-semibold text-center mb-2">
                  🎯 Special Referral Bonus
                </p>
                <p className="text-sm text-center text-muted-foreground">
                  Earn $250 for each person you refer + 10% monthly residual income
                </p>
              </div>

              <Link href={`/register?ref=${member.referral_code}`}>
                <Button size="lg" className="w-full">
                  Claim Your Spot Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>

              <p className="text-center text-sm text-muted-foreground">
                30-day money-back guarantee • Cancel anytime
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Urgency Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle className="text-2xl">Limited Time Opportunity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg">
                The markets are moving fast. Every day you wait is money left on the table.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Target className="h-8 w-8 text-primary" />
                <p className="font-semibold">
                  Join {member.active_referrals && member.active_referrals > 0 ? `${member.active_referrals} others` : 'now'} 
                  who&apos;ve already started their journey with {member.name || 'this member'}
                </p>
              </div>
              <Link href={`/register?ref=${member.referral_code}`}>
                <Button size="lg" className="mt-4">
                  Start Trading Today
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <Image
                src="/gold-logo.svg"
                alt="Snipers Trading Academy"
                width={120}
                height={30}
                className="h-8 w-auto opacity-80"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              © 2024 Snipers Trading Academy. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary">
                Terms
              </Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary">
                Privacy
              </Link>
              <Link href="/contact" className="text-sm text-muted-foreground hover:text-primary">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}