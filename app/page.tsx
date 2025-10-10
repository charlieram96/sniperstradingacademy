import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Target,
  Shield,
  Users,
  Zap,
  CheckCircle,
  ArrowRight,
  Brain,
  LineChart,
  Trophy,
  Sparkles,
  BarChart3,
  Rocket,
  Lock
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Fixed Navigation */}
      <nav className="fixed top-0 z-50 w-full">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/gold-logo.svg"
                alt="Snipers Trading Academy"
                width={40}
                height={40}
                className="w-10 h-10"
              />
              <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Snipers Trading Academy</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="#features">
                <Button variant="ghost" className="text-gray-400 hover:text-white">Features</Button>
              </Link>
              <Link href="#curriculum">
                <Button variant="ghost" className="text-gray-400 hover:text-white">Curriculum</Button>
              </Link>
              <Link href="#pricing">
                <Button variant="ghost" className="text-gray-400 hover:text-white">Pricing</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="border-gray-800 text-gray-300 hover:bg-white/5">Login</Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/30">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center px-4 overflow-hidden">
        {/* Animated Background - Moving Red Glows */}
        <div
          className="absolute w-[800px] h-[800px] bg-red-600 rounded-full blur-[120px] pointer-events-none opacity-[0.003]"
          style={{
            top: '10%',
            left: '20%',
            animation: 'float-slow 30s ease-in-out infinite, pulse-glow 8s ease-in-out infinite'
          }}
        />
        <div
          className="absolute w-[700px] h-[700px] bg-red-700 rounded-full blur-[120px] pointer-events-none opacity-[0.002]"
          style={{
            bottom: '10%',
            right: '20%',
            animation: 'float-slower 40s ease-in-out infinite, pulse-glow 8s ease-in-out infinite'
          }}
        />
        <div
          className="absolute w-[600px] h-[600px] bg-red-500 rounded-full blur-[120px] pointer-events-none opacity-[0.002]"
          style={{
            top: '40%',
            right: '10%',
            animation: 'float-slow 30s ease-in-out infinite',
            animationDelay: '5s'
          }}
        />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="container mx-auto text-center relative">
          <div className="max-w-5xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-6 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 mb-8 animate-fade-in-up">
              <Sparkles className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-gray-300">Master Options Trading • Start Today</span>
            </div>

            {/* Heading */}
            <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-tight animate-fade-in-up animation-delay-200">
              <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                Learn to Trade
              </span>
              <br />
              <span className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent">
                Like a Sniper
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-up animation-delay-400">
              Join the elite. Master professional options trading strategies and earn passive income through our comprehensive education platform.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in-up animation-delay-600">
              <Link href="/register">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-xl shadow-red-500/30 text-lg px-10 py-7 relative overflow-hidden group">
                  <span className="relative z-10">Start Your Journey</span>
                  <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-800 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-2 border-2 border-white hover:border-red-600 hover:bg-white/5 text-lg px-10 py-7 text-white">
                <Rocket className="h-5 w-5" />
                View Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-4xl mx-auto animate-fade-in-up animation-delay-800">
              <div className="group">
                <div className="text-5xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent mb-2">10,000+</div>
                <div className="text-gray-500 font-medium">Active Traders</div>
              </div>
              <div className="group">
                <div className="text-5xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent mb-2">$2.4M+</div>
                <div className="text-gray-500 font-medium">Monthly Volume</div>
              </div>
              <div className="group">
                <div className="text-5xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent mb-2">87%</div>
                <div className="text-gray-500 font-medium">Success Rate</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-950/5 to-transparent" />

        <div className="container mx-auto relative">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-red-950/50 text-red-400 border-red-900">FEATURES</Badge>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Everything You Need
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Professional-grade tools and education to transform you into a profitable trader.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: Brain,
                title: "Expert Curriculum",
                description: "Structured learning path from fundamentals to advanced strategies designed by professional traders.",
                gradient: "from-red-500 to-red-600"
              },
              {
                icon: BarChart3,
                title: "Live Trading Sessions",
                description: "Watch professionals analyze markets in real-time and learn to spot high-probability setups.",
                gradient: "from-red-600 to-red-700"
              },
              {
                icon: Target,
                title: "Risk-Free Practice",
                description: "Master strategies using our paper trading simulator before risking real capital.",
                gradient: "from-red-700 to-red-800"
              },
              {
                icon: Users,
                title: "Elite Community",
                description: "Network with successful traders, share insights, and accelerate your learning.",
                gradient: "from-red-500 to-orange-600"
              },
              {
                icon: Shield,
                title: "Risk Management",
                description: "Learn professional risk controls to protect your capital and maximize long-term gains.",
                gradient: "from-red-600 to-rose-600"
              },
              {
                icon: Zap,
                title: "Trading Psychology",
                description: "Develop the mental discipline required to execute your strategy with precision.",
                gradient: "from-red-700 to-pink-600"
              }
            ].map((feature, index) => (
              <Card key={index} className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm hover:border-red-500/50 transition-all duration-300 hover:-translate-y-1 group">
                <CardHeader>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What You'll Learn Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-4 bg-red-950/50 text-red-400 border-red-900">CURRICULUM</Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Master the Markets
              </h2>
              <div className="space-y-6">
                {[
                  { title: "Options Fundamentals", desc: "Calls, puts, Greeks, and pricing strategies" },
                  { title: "Technical Analysis", desc: "Chart patterns and high-probability setups" },
                  { title: "Strategy Development", desc: "Build profitable trading systems" },
                  { title: "Risk Management", desc: "Professional capital protection techniques" },
                  { title: "Portfolio Management", desc: "Diversification and position sizing" }
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-4 group">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-center mt-0.5 group-hover:scale-110 transition-transform">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-white mb-1">{item.title}</h4>
                      <p className="text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-red-950/20 to-transparent rounded-3xl flex items-center justify-center border border-white/10 backdrop-blur-sm relative overflow-hidden group">
                <LineChart className="h-32 w-32 text-red-500 z-10 group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-6 shadow-2xl border border-red-500/20">
                <Trophy className="h-10 w-10 mb-2 text-white" />
                <p className="font-bold text-lg text-white">Certification</p>
                <p className="text-sm text-red-100">Upon completion</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/5 via-transparent to-red-950/5" />

        <div className="container mx-auto relative">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-red-950/50 text-red-400 border-red-900">PRICING</Badge>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Invest in Your Future
            </h2>
            <p className="text-xl text-gray-400">
              One membership. Complete access. Unlimited potential.
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <Card className="bg-gradient-to-br from-white/10 to-white/[0.02] border-2 border-red-500/30 backdrop-blur-sm relative overflow-hidden">
              {/* Glow Effect */}
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-600/20 rounded-full blur-3xl" />

              <div className="relative">
                <CardHeader>
                  <div className="text-center pt-6">
                    <Badge className="mb-4 bg-red-950 text-red-400 border-red-800">MOST POPULAR</Badge>
                    <h3 className="text-3xl font-bold mb-3 text-white">Full Access</h3>
                    <p className="text-lg text-gray-400 mb-8">
                      Everything you need to become a professional trader
                    </p>
                    <div className="space-y-4">
                      <div>
                        <span className="text-6xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">$500</span>
                        <span className="text-gray-400 text-lg"> one-time</span>
                      </div>
                      <div className="text-2xl">
                        <span className="font-semibold text-gray-500">+</span>
                      </div>
                      <div>
                        <span className="text-6xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">$199</span>
                        <span className="text-gray-400 text-lg">/month</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="bg-red-950/30 rounded-xl p-4 border border-red-900/50">
                      <p className="text-red-400 font-semibold text-center">+ Earn passive income through referrals</p>
                    </div>

                    <ul className="space-y-4">
                      {[
                        "Complete video course library",
                        "Live daily trading sessions",
                        "1-on-1 mentorship",
                        "Advanced trading tools",
                        "Private Discord community",
                        "Weekly strategy workshops",
                        "Real-time trade alerts",
                        "Certification program",
                        "Priority support"
                      ].map((item, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-center mt-0.5">
                            <CheckCircle className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-gray-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link href="/register">
                    <Button className="w-full mt-8 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-xl shadow-red-500/30 h-14 text-lg group" size="lg">
                      Start Trading Today
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <p className="text-center text-sm text-gray-500 mt-4 flex items-center justify-center gap-2">
                    <Lock className="h-3 w-3" />
                    Cancel your monthly subscription anytime
                  </p>
                </CardContent>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 via-red-700/10 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.15),transparent_70%)]" />

        <div className="container mx-auto max-w-4xl text-center relative">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Ready to Transform Your Future?
          </h2>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Join thousands of traders who&apos;ve mastered the markets with Snipers Trading Academy.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-xl shadow-red-500/30 text-lg px-10 py-7">
                Get Started Now
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-8">
            $500 activation + $199/month • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <Link href="/" className="flex items-center space-x-2 mb-4">
                <Image
                  src="/gold-logo.svg"
                  alt="Snipers Trading Academy"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
                <span className="font-bold text-white">Snipers Trading</span>
              </Link>
              <p className="text-sm text-gray-500">
                Elite options trading education.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-white">Academy</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="#" className="hover:text-red-500 transition-colors">Courses</Link></li>
                <li><Link href="#" className="hover:text-red-500 transition-colors">Resources</Link></li>
                <li><Link href="#" className="hover:text-red-500 transition-colors">Community</Link></li>
                <li><Link href="#" className="hover:text-red-500 transition-colors">Blog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-white">Support</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="#" className="hover:text-red-500 transition-colors">Help Center</Link></li>
                <li><Link href="#" className="hover:text-red-500 transition-colors">Contact</Link></li>
                <li><Link href="#" className="hover:text-red-500 transition-colors">FAQ</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-white">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="#" className="hover:text-red-500 transition-colors">Privacy</Link></li>
                <li><Link href="#" className="hover:text-red-500 transition-colors">Terms</Link></li>
                <li><Link href="#" className="hover:text-red-500 transition-colors">Risk Disclosure</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10 text-center text-sm text-gray-500">
            <p>© 2024 Snipers Trading Academy. All rights reserved.</p>
            <p className="mt-2 text-xs">
              Trading involves risk. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
