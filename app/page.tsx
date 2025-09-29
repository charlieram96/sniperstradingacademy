import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  BookOpen, 
  Target,
  Shield,
  ChartBar,
  Users,
  Zap,
  CheckCircle,
  ArrowRight,
  Play,
  Brain,
  GraduationCap,
  LineChart,
  Trophy
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Fixed Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Snipers Trading Academy</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="#features">
                <Button variant="ghost">Features</Button>
              </Link>
              <Link href="#curriculum">
                <Button variant="ghost">Curriculum</Button>
              </Link>
              <Link href="#pricing">
                <Button variant="ghost">Pricing</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline">Login</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Master Options Trading in 90 Days</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Learn to Trade Options Like a Professional
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of successful traders who&apos;ve transformed their financial future through our comprehensive options trading education platform.
            </p>
            
            <div className="flex gap-4 justify-center mb-12">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Start Learning Today
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-2">
                <Play className="h-4 w-4" />
                Watch Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
              <div>
                <div className="text-4xl font-bold text-primary">10,000+</div>
                <div className="text-muted-foreground">Active Students</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary">87%</div>
                <div className="text-muted-foreground">Success Rate</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary">4.9/5</div>
                <div className="text-muted-foreground">Student Rating</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our comprehensive platform provides all the tools and education you need to become a profitable options trader.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader>
                <BookOpen className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Structured Learning Path</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Follow our proven curriculum from basics to advanced strategies. Each module builds on the previous one for optimal learning.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader>
                <ChartBar className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Live Market Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Watch experienced traders analyze real markets in real-time. Learn to spot opportunities as they happen.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader>
                <Target className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Practice Trading</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Use our paper trading simulator to practice strategies risk-free before trading with real capital.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader>
                <Users className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Community Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Join a community of like-minded traders. Share insights, ask questions, and learn from others&apos; experiences.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader>
                <Shield className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Risk Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Master essential risk management techniques to protect your capital and maximize long-term profitability.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader>
                <Brain className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Trading Psychology</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Develop the mental discipline and emotional control needed to execute your trading plan consistently.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What You&apos;ll Learn Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                What You&apos;ll Learn
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Options Fundamentals</h4>
                    <p className="text-sm text-muted-foreground">Master calls, puts, and how options are priced</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Technical Analysis</h4>
                    <p className="text-sm text-muted-foreground">Read charts and identify high-probability setups</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Strategy Development</h4>
                    <p className="text-sm text-muted-foreground">Build and test your own profitable trading strategies</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Risk Management</h4>
                    <p className="text-sm text-muted-foreground">Protect your capital with professional risk controls</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Portfolio Management</h4>
                    <p className="text-sm text-muted-foreground">Diversify and manage multiple positions effectively</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <LineChart className="h-32 w-32 text-muted-foreground" />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-primary text-primary-foreground rounded-lg p-4 shadow-lg">
                <Trophy className="h-8 w-8 mb-2" />
                <p className="font-semibold">Certification</p>
                <p className="text-sm opacity-90">Upon completion</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Curriculum Section */}
      <section id="curriculum" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Comprehensive Curriculum
            </h2>
            <p className="text-xl text-muted-foreground">
              From fundamentals to advanced strategies, we cover everything.
            </p>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-primary">Module 1:</span> Options Fundamentals
                    </CardTitle>
                    <CardDescription>4 weeks • 12 lessons • Beginner</CardDescription>
                  </div>
                  <GraduationCap className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Understanding calls and puts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Option pricing and Greeks</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Reading option chains</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Basic option strategies</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-primary">Module 2:</span> Trading Strategies
                    </CardTitle>
                    <CardDescription>4 weeks • 16 lessons • Intermediate</CardDescription>
                  </div>
                  <ChartBar className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Covered calls and cash-secured puts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Vertical, horizontal, and diagonal spreads</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Iron condors and butterflies</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Earnings and event-based strategies</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-primary">Module 3:</span> Advanced Techniques
                    </CardTitle>
                    <CardDescription>4 weeks • 14 lessons • Advanced</CardDescription>
                  </div>
                  <Trophy className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Volatility trading strategies</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Portfolio management and hedging</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Market maker strategies</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Algorithmic and systematic trading</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-muted-foreground">
              One membership, complete access to everything
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <Card className="border-primary shadow-xl">
              <CardHeader>
                <div className="text-center">
                  <CardTitle className="text-2xl mb-2">Full Access Membership</CardTitle>
                  <CardDescription className="text-base">
                    Unlock your trading potential with complete academy access
                  </CardDescription>
                  <div className="pt-6 space-y-2">
                    <div>
                      <span className="text-4xl font-bold">$500</span>
                      <span className="text-muted-foreground"> one-time activation</span>
                    </div>
                    <div className="text-xl">
                      <span className="font-semibold">+</span>
                    </div>
                    <div>
                      <span className="text-4xl font-bold">$200</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center pb-4">
                    <Badge className="bg-primary/10 text-primary">Everything Included</Badge>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                      <span>Full access to all video lessons and courses</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                      <span>Live daily trading sessions with experts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                      <span>1-on-1 mentorship sessions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                      <span>Advanced trading tools and scanners</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                      <span>Private Discord community access</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                      <span>Weekly strategy workshops</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                      <span>Trade alerts and market analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                      <span>Certification upon course completion</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                      <span>Priority support and assistance</span>
                    </li>
                  </ul>
                </div>
                <Link href="/register">
                  <Button className="w-full mt-8" size="lg">
                    Get Started Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Cancel your monthly subscription anytime
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Start Your Trading Journey?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of successful traders who started their journey with us.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Get Started Now
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline">
              Schedule a Demo
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            No credit card required • 7-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
                <span className="font-bold">Snipers Trading Academy</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your path to professional options trading success.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Academy</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-primary transition-colors">Courses</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Resources</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Community</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Blog</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-primary transition-colors">Help Center</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Contact Us</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">FAQ</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Status</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Risk Disclosure</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Refund Policy</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© 2024 Snipers Trading Academy. All rights reserved.</p>
            <p className="mt-2 text-xs">
              Trading options involves risk and is not suitable for all investors. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}