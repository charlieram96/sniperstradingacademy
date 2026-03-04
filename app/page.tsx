"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
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
import { fadeInUp, staggerContainer, staggerItem, viewportOnce } from "@/lib/motion"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Fixed Navigation */}
      <nav className="fixed top-0 z-50 w-full bg-background/80 backdrop-blur-xl border-b border-white/[0.06]">
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
              <span className="text-xl font-bold bg-gradient-to-r from-gold-200 to-gold-400 bg-clip-text text-transparent">Snipers Trading Academy</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="#features">
                <Button variant="ghost" className="text-foreground-tertiary hover:text-gold-300 transition-colors">Features</Button>
              </Link>
              <Link href="#curriculum">
                <Button variant="ghost" className="text-foreground-tertiary hover:text-gold-300 transition-colors">Curriculum</Button>
              </Link>
              <Link href="#pricing">
                <Button variant="ghost" className="text-foreground-tertiary hover:text-gold-300 transition-colors">Pricing</Button>
              </Link>
              <Link href="/login">
                <Button variant="premium">Login</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center px-4 overflow-hidden">
        {/* Animated Background Glows */}
        <div className="absolute w-[600px] h-[600px] bg-gold-400/10 rounded-full blur-[150px] pointer-events-none top-[10%] left-[15%]" style={{ animation: "glow-move-1 20s ease-in-out infinite" }} />
        <div className="absolute w-[500px] h-[500px] bg-gold-300/8 rounded-full blur-[150px] pointer-events-none bottom-[20%] right-[10%]" style={{ animation: "glow-move-2 25s ease-in-out infinite" }} />
        <div className="absolute w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none top-[50%] right-[30%]" style={{ animation: "glow-move-3 30s ease-in-out infinite" }} />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(212,175,55,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.015)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="container mx-auto text-center relative pt-20">
          <div className="max-w-5xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-6 py-2 bg-gold-400/5 rounded-full border border-gold-400/10 mb-8"
            >
              <Sparkles className="h-4 w-4 text-gold-300/80" />
              <span className="text-sm font-medium text-gold-200/80">Master Options Trading - Start Today</span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-6xl md:text-8xl font-bold mb-8 leading-tight"
            >
              <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                Learn to Trade
              </span>
              <br />
              <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">
                Like a Sniper
              </span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="text-xl md:text-2xl text-foreground-tertiary mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              Join the elite. Master professional options trading strategies and earn passive income through our comprehensive education platform.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-20"
            >
              <Link href="/register">
                <Button size="lg" className="gap-2 text-lg px-10 py-7 relative overflow-hidden group">
                  <span className="relative z-10">Start Your Journey</span>
                  <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button size="lg" variant="premium" className="gap-2 text-lg px-10 py-7">
                <Rocket className="h-5 w-5" />
                View Demo
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
            >
              {[
                { icon: BookOpen, value: "6+", label: "Modules" },
                { icon: Video, value: "3", label: "Weekly Classes" },
                { icon: UserCheck, value: "1-on-1", label: "Mentorship" },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  variants={staggerItem}
                  className="group p-6 rounded-[12px] bg-surface-1 border border-border hover:border-border-accent hover:shadow-[var(--shadow-gold-sm)] transition-all duration-200"
                >
                  <div className="flex items-center justify-center mb-3">
                    <stat.icon className="h-8 w-8 text-gold-400/60" />
                  </div>
                  <div className="text-4xl font-bold bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent mb-2">{stat.value}</div>
                  <div className="text-foreground-tertiary font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-gold-400/20 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-gold-400/60 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold-800/3 to-transparent" />

        <div className="container mx-auto relative">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="text-center mb-16"
          >
            <Badge className="mb-4">FEATURES</Badge>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Everything You Need
            </h2>
            <p className="text-xl text-foreground-tertiary max-w-3xl mx-auto">
              Professional-grade tools and education to transform you into a profitable trader.
            </p>
          </motion.div>

          {/* Hero feature (full-width) */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="max-w-6xl mx-auto mb-6"
          >
            <Card variant="interactive" className="p-8 md:p-10">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-20 h-20 rounded-[16px] bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center flex-shrink-0">
                  <Brain className="h-10 w-10 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Expert Curriculum</h3>
                  <p className="text-foreground-secondary text-lg leading-relaxed">
                    Structured learning path from fundamentals to advanced strategies designed by professional traders with over 20 years of combined market experience.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Medium features (2-col) */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto mb-6"
          >
            {[
              {
                icon: BarChart3,
                title: "Live Trading Sessions",
                description: "Watch professionals analyze markets in real-time and learn to spot high-probability setups.",
              },
              {
                icon: Target,
                title: "Risk-Free Practice",
                description: "Master strategies using our paper trading simulator before risking real capital.",
              },
            ].map((feature) => (
              <motion.div key={feature.title} variants={staggerItem}>
                <Card variant="interactive" className="h-full">
                  <CardHeader>
                    <div className="w-14 h-14 rounded-[12px] bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center mb-4">
                      <feature.icon className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-xl text-foreground">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground-secondary leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Small features (3-col) */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto"
          >
            {[
              { icon: Users, title: "Elite Community", description: "Network with successful traders and share insights." },
              { icon: Shield, title: "Risk Management", description: "Professional capital protection techniques." },
              { icon: Zap, title: "Trading Psychology", description: "Develop mental discipline for precision trading." },
            ].map((feature) => (
              <motion.div key={feature.title} variants={staggerItem}>
                <Card variant="interactive" className="h-full">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-[8px] bg-gold-400/10 flex items-center justify-center mb-3">
                      <feature.icon className="h-6 w-6 text-gold-400" />
                    </div>
                    <CardTitle className="text-lg text-foreground">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground-secondary text-sm leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* What You'll Learn Section */}
      <section id="curriculum" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
            >
              <Badge className="mb-4">CURRICULUM</Badge>
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
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    viewport={viewportOnce}
                    className="flex items-start gap-4 group"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-400 flex items-center justify-center mt-0.5 group-hover:shadow-[var(--shadow-gold-sm)] transition-all">
                      <CheckCircle className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-foreground mb-1">{item.title}</h4>
                      <p className="text-foreground-tertiary">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={viewportOnce}
              className="relative"
            >
              <div className="aspect-video bg-surface-1 rounded-[20px] flex items-center justify-center border border-border relative overflow-hidden group">
                <div className="absolute inset-0 flex items-end justify-center p-8 opacity-20">
                  <svg viewBox="0 0 400 200" className="w-full h-full">
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#D4A853" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#D4A853" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,150 Q50,140 100,100 T200,80 T300,40 T400,60" fill="none" stroke="#D4A853" strokeWidth="3" />
                    <path d="M0,150 Q50,140 100,100 T200,80 T300,40 T400,60 L400,200 L0,200 Z" fill="url(#chartGradient)" />
                  </svg>
                </div>
                <LineChart className="h-32 w-32 text-gold-400/40 z-10 group-hover:scale-110 transition-transform" />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-gradient-to-br from-gold-400 to-gold-500 rounded-[12px] p-6 shadow-[var(--shadow-gold-lg)] border border-gold-300/20">
                <Trophy className="h-10 w-10 mb-2 text-primary-foreground" />
                <p className="font-bold text-lg text-primary-foreground">Certification</p>
                <p className="text-sm text-gold-800">Upon completion</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-gold-800/3 via-transparent to-gold-800/3" />

        <div className="container mx-auto relative">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="text-center mb-16"
          >
            <Badge className="mb-4">PRICING</Badge>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Invest in Your Future
            </h2>
            <p className="text-xl text-foreground-tertiary">
              One membership. Complete access. Unlimited potential.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={viewportOnce}
            className="max-w-lg mx-auto"
          >
            <Card variant="highlighted" className="relative overflow-hidden border-2 border-border-accent">
              {/* Glow Effect */}
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-400/8 rounded-full blur-3xl" />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold-500/5 rounded-full blur-3xl" />

              <div className="relative">
                <CardHeader>
                  <div className="text-center pt-6">
                    <Badge className="mb-4">MOST POPULAR</Badge>
                    <h3 className="text-3xl font-bold mb-3 text-foreground">Full Access</h3>
                    <p className="text-lg text-foreground-secondary mb-8">
                      Everything you need to become a professional trader
                    </p>
                    <div className="space-y-4">
                      <div>
                        <span className="text-6xl font-bold bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent">$499</span>
                        <span className="text-foreground-tertiary text-lg"> one-time</span>
                      </div>
                      <div className="text-2xl">
                        <span className="font-semibold text-foreground-quaternary">+</span>
                      </div>
                      <div>
                        <span className="text-6xl font-bold bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent">$199</span>
                        <span className="text-foreground-tertiary text-lg">/month</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="bg-gold-400/8 rounded-[8px] p-4 border border-border-accent">
                      <p className="text-gold-300 font-semibold text-center">+ Earn passive income through referrals</p>
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
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gold-400 flex items-center justify-center mt-0.5">
                            <CheckCircle className="h-3 w-3 text-primary-foreground" />
                          </div>
                          <span className="text-foreground-secondary">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link href="/register">
                    <Button className="w-full mt-8 h-14 text-lg group" size="lg">
                      Start Trading Today
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <p className="text-center text-sm text-foreground-quaternary mt-4 flex items-center justify-center gap-2">
                    <Lock className="h-3 w-3" />
                    Cancel your monthly subscription anytime
                  </p>
                </CardContent>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold-400/5 via-transparent to-transparent" />

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="container mx-auto max-w-4xl text-center relative"
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Ready to Transform Your Future?
          </h2>
          <p className="text-xl text-foreground-tertiary mb-10 max-w-2xl mx-auto">
            Join thousands of traders who&apos;ve mastered the markets with Snipers Trading Academy.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 text-lg px-10 py-7">
                Get Started Now
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-foreground-quaternary mt-8">
            $499 activation + $199/month - Cancel anytime
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <Link href="/" className="flex items-center space-x-2 mb-4">
                <Image src="/gold-logo.svg" alt="Snipers Trading Academy" width={32} height={32} className="w-8 h-8" />
                <span className="font-bold bg-gradient-to-r from-gold-200 to-gold-400 bg-clip-text text-transparent">Snipers Trading</span>
              </Link>
              <p className="text-sm text-foreground-quaternary">Elite options trading education.</p>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-foreground">Academy</h4>
              <ul className="space-y-2 text-sm text-foreground-quaternary">
                <li><Link href="#" className="hover:text-gold-300 transition-colors">Courses</Link></li>
                <li><Link href="#" className="hover:text-gold-300 transition-colors">Resources</Link></li>
                <li><Link href="#" className="hover:text-gold-300 transition-colors">Community</Link></li>
                <li><Link href="#" className="hover:text-gold-300 transition-colors">Blog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-foreground">Support</h4>
              <ul className="space-y-2 text-sm text-foreground-quaternary">
                <li><Link href="#" className="hover:text-gold-300 transition-colors">Help Center</Link></li>
                <li><a href="mailto:support@sniperstradingacademy.com" className="hover:text-gold-300 transition-colors">Contact Support</a></li>
                <li><Link href="#" className="hover:text-gold-300 transition-colors">FAQ</Link></li>
              </ul>
              <p className="text-[11px] text-foreground-quaternary mt-3">support@sniperstradingacademy.com</p>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-foreground">Legal</h4>
              <ul className="space-y-2 text-sm text-foreground-quaternary">
                <li><Link href="#" className="hover:text-gold-300 transition-colors">Privacy</Link></li>
                <li><Link href="#" className="hover:text-gold-300 transition-colors">Terms</Link></li>
                <li><Link href="#" className="hover:text-gold-300 transition-colors">Risk Disclosure</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border-subtle text-center text-sm text-foreground-quaternary">
            <p>&copy; 2024 Snipers Trading Academy. All rights reserved.</p>
            <p className="mt-2 text-[11px]">Trading involves risk. Past performance is not indicative of future results.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
