"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect } from "react"
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
  Lock,
  BookOpen,
  Video,
  UserCheck
} from "lucide-react"

// Hook to handle scroll reveal animations
function useScrollReveal() {
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "0px",
      threshold: 0.1,
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed")
        }
      })
    }, observerOptions)

    const elements = document.querySelectorAll(".scroll-reveal, .scroll-reveal-scale, .scroll-reveal-left, .scroll-reveal-right")
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])
}

export default function HomePage() {
  useScrollReveal()

  return (
    <div className="min-h-screen bg-black overflow-x-hidden">
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
              <span className="text-xl font-bold bg-gradient-to-r from-amber-200/90 to-amber-400/90 bg-clip-text text-transparent">Snipers Trading Academy</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="#features">
                <Button variant="ghost" className="text-gray-400 hover:text-amber-300 transition-colors">Features</Button>
              </Link>
              <Link href="#curriculum">
                <Button variant="ghost" className="text-gray-400 hover:text-amber-300 transition-colors">Curriculum</Button>
              </Link>
              <Link href="#pricing">
                <Button variant="ghost" className="text-gray-400 hover:text-amber-300 transition-colors">Pricing</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="border-amber-400/30 text-amber-300 hover:bg-amber-400/10 hover:border-amber-400/50">Login</Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-semibold shadow-lg shadow-amber-500/20">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center px-4 overflow-hidden">
        {/* Animated Background Glows */}
        <div className="absolute w-[600px] h-[600px] bg-amber-200 rounded-full blur-[150px] pointer-events-none top-[10%] left-[15%]" style={{ animation: "glow-move-1 20s ease-in-out infinite" }} />
        <div className="absolute w-[500px] h-[500px] bg-amber-300 rounded-full blur-[150px] pointer-events-none bottom-[20%] right-[10%]" style={{ animation: "glow-move-2 25s ease-in-out infinite" }} />
        <div className="absolute w-[400px] h-[400px] bg-amber-200 rounded-full blur-[120px] pointer-events-none top-[50%] right-[30%]" style={{ animation: "glow-move-3 30s ease-in-out infinite" }} />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(212,175,55,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="container mx-auto text-center relative pt-20">
          <div className="max-w-5xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-6 py-2 bg-amber-400/5 backdrop-blur-sm rounded-full border border-amber-400/10 mb-8 opacity-0 animate-[fade-in-up_0.6s_ease-out_0.1s_forwards]">
              <Sparkles className="h-4 w-4 text-amber-300/80" />
              <span className="text-sm font-medium text-amber-200/80">Master Options Trading - Start Today</span>
            </div>

            {/* Heading */}
            <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-tight opacity-0 animate-[fade-in-up_0.6s_ease-out_0.2s_forwards]">
              <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                Learn to Trade
              </span>
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                Like a Sniper
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed opacity-0 animate-[fade-in-up_0.6s_ease-out_0.35s_forwards]">
              Join the elite. Master professional options trading strategies and earn passive income through our comprehensive education platform.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20 opacity-0 animate-[fade-in-up_0.6s_ease-out_0.5s_forwards]">
              <Link href="/register">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-semibold shadow-xl shadow-amber-500/20 text-lg px-10 py-7 relative overflow-hidden group">
                  <span className="relative z-10">Start Your Journey</span>
                  <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-2 border-2 border-amber-400/20 hover:border-amber-400/40 hover:bg-amber-400/5 text-lg px-10 py-7 text-amber-300">
                <Rocket className="h-5 w-5" />
                View Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto opacity-0 animate-[fade-in-up_0.6s_ease-out_0.65s_forwards]">
              <div className="group p-6 rounded-2xl transition-all">
                <div className="flex items-center justify-center mb-3">
                  <BookOpen className="h-8 w-8 text-amber-300/70" />
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-amber-300 to-amber-400 bg-clip-text text-transparent mb-2">6+</div>
                <div className="text-gray-500 font-medium">Modules</div>
              </div>
              <div className="group p-6 rounded-2xl transition-all">
                <div className="flex items-center justify-center mb-3">
                  <Video className="h-8 w-8 text-amber-300/70" />
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-amber-300 to-amber-400 bg-clip-text text-transparent mb-2">3</div>
                <div className="text-gray-500 font-medium">Weekly Classes</div>
              </div>
              <div className="group p-6 rounded-2xl transition-all">
                <div className="flex items-center justify-center mb-3">
                  <UserCheck className="h-8 w-8 text-amber-300/70" />
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-amber-300 to-amber-400 bg-clip-text text-transparent mb-2">1-on-1</div>
                <div className="text-gray-500 font-medium">Mentorship</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-amber-400/20 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-amber-400/60 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/3 to-transparent" />

        <div className="container mx-auto relative">
          <div className="text-center mb-16 scroll-reveal">
            <Badge className="mb-4 bg-amber-900/30 text-amber-300/80 border-amber-700/50">FEATURES</Badge>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Everything You Need
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Professional-grade tools and education to transform you into a profitable trader.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto stagger-children">
            {[
              {
                icon: Brain,
                title: "Expert Curriculum",
                description: "Structured learning path from fundamentals to advanced strategies designed by professional traders.",
                gradient: "from-amber-400 to-amber-500"
              },
              {
                icon: BarChart3,
                title: "Live Trading Sessions",
                description: "Watch professionals analyze markets in real-time and learn to spot high-probability setups.",
                gradient: "from-amber-400 to-amber-500"
              },
              {
                icon: Target,
                title: "Risk-Free Practice",
                description: "Master strategies using our paper trading simulator before risking real capital.",
                gradient: "from-amber-400 to-amber-500"
              },
              {
                icon: Users,
                title: "Elite Community",
                description: "Network with successful traders, share insights, and accelerate your learning.",
                gradient: "from-amber-400 to-amber-500"
              },
              {
                icon: Shield,
                title: "Risk Management",
                description: "Learn professional risk controls to protect your capital and maximize long-term gains.",
                gradient: "from-amber-400 to-amber-500"
              },
              {
                icon: Zap,
                title: "Trading Psychology",
                description: "Develop the mental discipline required to execute your strategy with precision.",
                gradient: "from-amber-400 to-amber-500"
              }
            ].map((feature, index) => (
              <Card key={index} className="scroll-reveal bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm hover:border-amber-400/30 transition-all duration-500 hover:-translate-y-2 group" style={{ transitionDelay: `${index * 100}ms` }}>
                <CardHeader>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-amber-400/15 transition-all duration-300`}>
                    <feature.icon className="h-7 w-7 text-black" />
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
      <section id="curriculum" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="scroll-reveal-left">
              <Badge className="mb-4 bg-amber-900/30 text-amber-300/80 border-amber-700/50">CURRICULUM</Badge>
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
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-center mt-0.5 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-amber-400/20 transition-all">
                      <CheckCircle className="h-4 w-4 text-black" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-white mb-1">{item.title}</h4>
                      <p className="text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative scroll-reveal-right">
              <div className="aspect-video bg-gradient-to-br from-amber-950/20 to-transparent rounded-3xl flex items-center justify-center border border-amber-400/10 backdrop-blur-sm relative overflow-hidden group">
                {/* Chart illustration */}
                <div className="absolute inset-0 flex items-end justify-center p-8 opacity-20">
                  <svg viewBox="0 0 400 200" className="w-full h-full">
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#D4A853" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#D4A853" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,150 Q50,140 100,100 T200,80 T300,40 T400,60"
                      fill="none"
                      stroke="#D4A853"
                      strokeWidth="3"
                    />
                    <path
                      d="M0,150 Q50,140 100,100 T200,80 T300,40 T400,60 L400,200 L0,200 Z"
                      fill="url(#chartGradient)"
                    />
                  </svg>
                </div>
                <LineChart className="h-32 w-32 text-amber-400/60 z-10 group-hover:scale-110 transition-transform" />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl p-6 shadow-2xl border border-amber-300/20">
                <Trophy className="h-10 w-10 mb-2 text-black" />
                <p className="font-bold text-lg text-black">Certification</p>
                <p className="text-sm text-amber-900/80">Upon completion</p>
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-4 -left-4 w-24 h-24 border border-amber-400/10 rounded-full" />
              <div className="absolute -bottom-8 -left-8 w-16 h-16 bg-amber-400/5 rounded-full blur-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/3 via-transparent to-amber-950/3" />

        <div className="container mx-auto relative">
          <div className="text-center mb-16 scroll-reveal">
            <Badge className="mb-4 bg-amber-900/30 text-amber-300/80 border-amber-700/50">PRICING</Badge>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Invest in Your Future
            </h2>
            <p className="text-xl text-gray-400">
              One membership. Complete access. Unlimited potential.
            </p>
          </div>

          <div className="max-w-lg mx-auto scroll-reveal-scale">
            <Card className="bg-gradient-to-br from-white/10 to-white/[0.02] border-2 border-amber-400/20 backdrop-blur-sm relative overflow-hidden">
              {/* Glow Effect */}
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />

              <div className="relative">
                <CardHeader>
                  <div className="text-center pt-6">
                    <Badge className="mb-4 bg-amber-900/40 text-amber-300/80 border-amber-700/50">MOST POPULAR</Badge>
                    <h3 className="text-3xl font-bold mb-3 text-white">Full Access</h3>
                    <p className="text-lg text-gray-400 mb-8">
                      Everything you need to become a professional trader
                    </p>
                    <div className="space-y-4">
                      <div>
                        <span className="text-6xl font-bold bg-gradient-to-r from-amber-300 to-amber-400 bg-clip-text text-transparent">$499</span>
                        <span className="text-gray-400 text-lg"> one-time</span>
                      </div>
                      <div className="text-2xl">
                        <span className="font-semibold text-gray-500">+</span>
                      </div>
                      <div>
                        <span className="text-6xl font-bold bg-gradient-to-r from-amber-300 to-amber-400 bg-clip-text text-transparent">$199</span>
                        <span className="text-gray-400 text-lg">/month</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="bg-amber-900/20 rounded-xl p-4 border border-amber-700/30">
                      <p className="text-amber-300/80 font-semibold text-center">+ Earn passive income through referrals</p>
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
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-center mt-0.5">
                            <CheckCircle className="h-3 w-3 text-black" />
                          </div>
                          <span className="text-gray-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link href="/register">
                    <Button className="w-full mt-8 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-semibold shadow-xl shadow-amber-400/20 h-14 text-lg group" size="lg">
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
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.08),transparent_70%)]" />

        <div className="container mx-auto max-w-4xl text-center relative scroll-reveal">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Ready to Transform Your Future?
          </h2>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Join thousands of traders who&apos;ve mastered the markets with Snipers Trading Academy.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-semibold shadow-xl shadow-amber-400/20 text-lg px-10 py-7">
                Get Started Now
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-8">
            $499 activation + $199/month - Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-4">
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
                <span className="font-bold bg-gradient-to-r from-amber-200/80 to-amber-400/80 bg-clip-text text-transparent">Snipers Trading</span>
              </Link>
              <p className="text-sm text-gray-500">
                Elite options trading education.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-white">Academy</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="#" className="hover:text-amber-300/80 transition-colors">Courses</Link></li>
                <li><Link href="#" className="hover:text-amber-300/80 transition-colors">Resources</Link></li>
                <li><Link href="#" className="hover:text-amber-300/80 transition-colors">Community</Link></li>
                <li><Link href="#" className="hover:text-amber-300/80 transition-colors">Blog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-white">Support</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="#" className="hover:text-amber-300/80 transition-colors">Help Center</Link></li>
                <li>
                  <a href="mailto:support@sniperstradingacademy.com" className="hover:text-amber-300/80 transition-colors">
                    Contact Support
                  </a>
                </li>
                <li><Link href="#" className="hover:text-amber-300/80 transition-colors">FAQ</Link></li>
              </ul>
              <p className="text-xs text-gray-600 mt-3">
                support@sniperstradingacademy.com
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-white">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="#" className="hover:text-amber-300/80 transition-colors">Privacy</Link></li>
                <li><Link href="#" className="hover:text-amber-300/80 transition-colors">Terms</Link></li>
                <li><Link href="#" className="hover:text-amber-300/80 transition-colors">Risk Disclosure</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/5 text-center text-sm text-gray-500">
            <p>&copy; 2024 Snipers Trading Academy. All rights reserved.</p>
            <p className="mt-2 text-xs">
              Trading involves risk. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
