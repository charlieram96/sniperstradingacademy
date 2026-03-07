"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { CheckCircle, ArrowRight, Lock } from "lucide-react"
import { fadeInUp, staggerContainerSlow, staggerItem, viewportOnce } from "@/lib/motion"

function AnimatedPrice({ target, prefix = "$" }: { target: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-60px" })
  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) => Math.round(v))

  useEffect(() => {
    if (isInView) {
      animate(count, target, { duration: 1.2, ease: "easeOut" })
    }
  }, [isInView, target, count])

  useEffect(() => {
    const unsubscribe = rounded.on("change", (v) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${v}`
      }
    })
    return unsubscribe
  }, [rounded, prefix])

  return <span ref={ref}>{prefix}0</span>
}

const features = [
  "Complete video course library",
  "Live daily trading sessions",
  "1-on-1 mentorship",
  "Advanced trading tools",
  "Private Discord community",
  "Weekly strategy workshops",
  "Real-time trade alerts",
  "Certification program",
  "Priority support",
]

export function Pricing() {
  return (
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
          <Card variant="highlighted" className="relative overflow-hidden border-2 border-border-accent gradient-border">
            {/* Glow Effect */}
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-400/8 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold-500/5 rounded-full blur-3xl" />

            <div className="relative">
              <CardHeader>
                <div className="text-center pt-6">
                  <Badge className="mb-4 animate-gentle-pulse">MOST POPULAR</Badge>
                  <h3 className="text-3xl font-bold mb-3 text-foreground">
                    Full Access
                  </h3>
                  <p className="text-lg text-foreground-secondary mb-8">
                    Everything you need to become a professional trader
                  </p>
                  <div className="space-y-4">
                    <div>
                      <span className="text-6xl font-bold bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent">
                        <AnimatedPrice target={499} />
                      </span>
                      <span className="text-foreground-tertiary text-lg">
                        {" "}one-time
                      </span>
                    </div>
                    <div className="text-2xl">
                      <span className="font-semibold text-foreground-quaternary">+</span>
                    </div>
                    <div>
                      <span className="text-6xl font-bold bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent">
                        <AnimatedPrice target={199} />
                      </span>
                      <span className="text-foreground-tertiary text-lg">
                        /month
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="bg-gold-400/8 rounded-[8px] p-4 border border-border-accent">
                    <p className="text-gold-300 font-semibold text-center">
                      + Earn passive income through referrals
                    </p>
                  </div>

                  <motion.ul
                    variants={staggerContainerSlow}
                    initial="hidden"
                    whileInView="visible"
                    viewport={viewportOnce}
                    className="space-y-4"
                  >
                    {features.map((item, index) => (
                      <motion.li
                        key={index}
                        variants={staggerItem}
                        className="flex items-start gap-3"
                      >
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gold-400 flex items-center justify-center mt-0.5">
                          <CheckCircle className="h-3 w-3 text-primary-foreground" />
                        </div>
                        <span className="text-foreground-secondary">{item}</span>
                      </motion.li>
                    ))}
                  </motion.ul>
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
  )
}
