import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowRight, 
  Users, 
  DollarSign, 
  Shield, 
  Zap,
  BarChart3,
  Network,
  Sparkles,
  CheckCircle,
  ChevronRight
} from "lucide-react"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="border-b backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image src="/logo.svg" alt="Snipers Trading Academy" width={32} height={32} />
            <span className="font-bold text-xl">Snipers Trading Academy</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 md:py-32">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <Badge variant="outline" className="mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            3-Wide, 6-Level Deep MLM Structure
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent animate-fade-in">
            Build Your Trading Empire
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl animate-fade-in-up animation-delay-200">
            Join the elite trading academy. Build your team with up to <span className="font-semibold text-foreground">3 direct referrals</span>, 
            grow 6 levels deep, and earn <span className="font-semibold text-foreground">10% commission</span> from your entire team pool.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-12 animate-fade-in-up animation-delay-400">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Start Earning Today <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 md:gap-16 animate-fade-in-up animation-delay-600">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">$500</div>
              <div className="text-sm text-muted-foreground">Initial Payment</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">10%</div>
              <div className="text-sm text-muted-foreground">Commission</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">1,092</div>
              <div className="text-sm text-muted-foreground">Max Team Size</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our platform provides all the tools and features you need to build a thriving trading network.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-stagger-in">
          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:shadow-xl animate-fade-in-up">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Passive Income Stream</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Earn 10% commission from your entire team pool. 
                With up to 1,092 members paying $200/month, earn up to $21,840 monthly.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:shadow-xl animate-fade-in-up">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Network className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Multi-Level Network</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Each member can have 3 direct referrals, growing up to 6 levels deep. 
                That&apos;s a potential team of 3 + 9 + 27 + 81 + 243 + 729 members.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:shadow-xl animate-fade-in-up">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Real-Time Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Track your earnings, network growth, and member activity with comprehensive 
                dashboard analytics and insights.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:shadow-xl animate-fade-in-up">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Secure Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                All transactions are processed securely through Stripe. 
                Your financial data is protected with bank-level encryption.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:shadow-xl animate-fade-in-up">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Instant Activation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Pay $500 once to unlock your 3 referral slots. 
                Start earning commissions as soon as your team members join.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:shadow-xl animate-fade-in-up">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Community Access</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Connect with successful traders, share strategies, 
                and learn from the collective knowledge of the network.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Start Earning in 3 Simple Steps
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes and begin building your trading network today.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    1
                  </div>
                </div>
                <div className="flex-grow">
                  <h3 className="text-xl font-semibold mb-2">Create Your Account</h3>
                  <p className="text-muted-foreground">
                    Sign up and pay the one-time $500 membership fee to unlock your 3 referral slots. 
                    Then subscribe for $200/month to maintain your membership.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    2
                  </div>
                </div>
                <div className="flex-grow">
                  <h3 className="text-xl font-semibold mb-2">Share Your Referral Link</h3>
                  <p className="text-muted-foreground">
                    Get your unique referral code and share it with other traders. 
                    Each signup through your link becomes part of your network.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    3
                  </div>
                </div>
                <div className="flex-grow">
                  <h3 className="text-xl font-semibold mb-2">Earn Monthly Commissions</h3>
                  <p className="text-muted-foreground">
                    Receive 10% of your entire team pool (up to 6 levels deep). 
                    With a full team, earn up to $21,840 per month automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            One plan, unlimited potential
          </p>
        </div>

        <div className="max-w-lg mx-auto">
          <Card className="border-2 border-primary relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-sm rounded-bl-lg">
              POPULAR
            </div>
            <CardHeader className="text-center pb-8">
              <CardTitle className="text-2xl mb-2">Snipers Academy Membership</CardTitle>
              <div className="space-y-2">
                <div>
                  <div className="text-3xl font-bold">$500</div>
                  <CardDescription className="text-xs">One-time membership fee</CardDescription>
                </div>
                <div className="text-sm">+</div>
                <div>
                  <div className="text-3xl font-bold">$200</div>
                  <CardDescription className="text-xs">Monthly subscription</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  "3 direct referral slots",
                  "Build team up to 6 levels deep",
                  "10% commission from entire team pool",
                  "Up to 1,092 team members",
                  "Potential $21,840 monthly earnings",
                  "Real-time team analytics",
                  "Automated commission payments",
                  "Stripe Connect integration"
                ].map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <Link href="/register" className="block">
                  <Button className="w-full" size="lg">
                    Get Started Now
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                <p className="text-xs text-center text-muted-foreground">
                  Cancel anytime. No hidden fees.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Build Your Trading Empire?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands of traders who are already earning passive income through our referral network.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="gap-2">
                Start Your Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="bg-transparent text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10">
                Sign In to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Image src="/logo.svg" alt="Snipers Trading Academy" width={32} height={32} />
                <span className="font-bold text-xl">Snipers Trading Academy</span>
              </div>
              <p className="text-sm text-muted-foreground">
                The premier network for options traders to connect and earn.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
                <li><Link href="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground">About</Link></li>
                <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
                <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
                <li><Link href="/cookies" className="hover:text-foreground">Cookies</Link></li>
              </ul>
            </div>
          </div>
          
          <Separator className="my-8" />
          
          <div className="text-center text-sm text-muted-foreground">
            © 2024 Snipers Trading Academy. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}