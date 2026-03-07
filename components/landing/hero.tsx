"use client"

import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  ArrowRight,
  Rocket,
  BookOpen,
  Video,
  UserCheck,
} from "lucide-react"
import { staggerContainer, staggerItem } from "@/lib/motion"

export function Hero() {
  const { scrollY } = useScroll()
  const parallaxY1 = useTransform(scrollY, [0, 800], [0, 240])
  const parallaxY2 = useTransform(scrollY, [0, 800], [0, 180])
  const parallaxY3 = useTransform(scrollY, [0, 800], [0, 300])
  const scrollIndicatorOpacity = useTransform(scrollY, [0, 200], [1, 0])

  return (
    <section className="relative min-h-screen flex items-center px-4 overflow-hidden">
      {/* Parallax Background Glows */}
      <motion.div
        style={{ y: parallaxY1 }}
        className="absolute w-[600px] h-[600px] bg-gold-400/10 rounded-full blur-[150px] pointer-events-none top-[10%] left-[15%]"
        aria-hidden
      />
      <motion.div
        style={{ y: parallaxY2 }}
        className="absolute w-[500px] h-[500px] bg-gold-300/8 rounded-full blur-[150px] pointer-events-none bottom-[20%] right-[10%]"
        aria-hidden
      />
      <motion.div
        style={{ y: parallaxY3 }}
        className="absolute w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none top-[50%] right-[30%]"
        aria-hidden
      />

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
            <span className="text-sm font-medium text-gold-200/80">
              Master Options Trading - Start Today
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-6xl md:text-8xl xl:text-9xl font-bold mb-8 leading-tight"
          >
            <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Learn to Trade
            </span>
            <br />
            <span className="relative bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">
              Like a Sniper
              <span className="absolute inset-0 animate-shimmer bg-clip-text text-transparent pointer-events-none" />
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="text-xl md:text-2xl text-foreground-tertiary mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Join the elite. Master professional options trading strategies and
            earn passive income through our comprehensive education platform.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-20"
          >
            <Link href="/register">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button size="lg" className="gap-2 text-lg px-10 py-7 relative overflow-hidden group">
                  <span className="relative z-10">Start Your Journey</span>
                  <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </Link>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button size="lg" variant="premium" className="gap-2 text-lg px-10 py-7">
                <Rocket className="h-5 w-5" />
                View Demo
              </Button>
            </motion.div>
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
                <div className="text-4xl font-bold bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-foreground-tertiary font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        style={{ opacity: scrollIndicatorOpacity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce"
      >
        <div className="w-6 h-10 rounded-full border-2 border-gold-400/20 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-gold-400/60 rounded-full animate-pulse" />
        </div>
      </motion.div>
    </section>
  )
}
