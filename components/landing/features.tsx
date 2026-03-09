"use client"

import { useCallback } from "react"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Brain,
  BarChart3,
  Target,
  Users,
  Shield,
  Zap,
} from "lucide-react"
import { fadeInUp, staggerContainer, staggerItem, viewportOnce } from "@/lib/motion"
import { useTranslation } from "@/components/language-provider"

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    e.currentTarget.style.transform = `perspective(800px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) translateY(-4px)`
  }, [])

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) translateY(0px)"
  }, [])

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-transform duration-200 ${className ?? ""}`}
      style={{ willChange: "transform" }}
    >
      {children}
    </div>
  )
}

export function Features() {
  const { t } = useTranslation()

  const mediumFeatures = [
    {
      icon: BarChart3,
      title: t("landing.features.liveSessions"),
      description: t("landing.features.liveSessionsDesc"),
    },
    {
      icon: Target,
      title: t("landing.features.riskFree"),
      description: t("landing.features.riskFreeDesc"),
    },
  ]

  const smallFeatures = [
    {
      icon: Users,
      title: t("landing.features.community"),
      description: t("landing.features.communityDesc"),
    },
    {
      icon: Shield,
      title: t("landing.features.riskManagement"),
      description: t("landing.features.riskManagementDesc"),
    },
    {
      icon: Zap,
      title: t("landing.features.psychology"),
      description: t("landing.features.psychologyDesc"),
    },
  ]

  return (
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
          <Badge className="mb-4">{t("landing.features.badge")}</Badge>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {t("landing.features.heading")}
          </h2>
          <p className="text-xl text-foreground-tertiary max-w-3xl mx-auto">
            {t("landing.features.subheading")}
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
          <TiltCard>
            <Card variant="interactive" className="p-8 md:p-10 gradient-border">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-20 h-20 rounded-[16px] bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center flex-shrink-0 group-hover:shadow-[var(--shadow-gold-sm)] transition-shadow">
                  <Brain className="h-10 w-10 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {t("landing.features.expertCurriculum")}
                  </h3>
                  <p className="text-foreground-secondary text-lg leading-relaxed">
                    {t("landing.features.expertCurriculumDesc")}
                  </p>
                </div>
              </div>
            </Card>
          </TiltCard>
        </motion.div>

        {/* Medium features (2-col) */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto mb-6"
        >
          {mediumFeatures.map((feature) => (
            <motion.div key={feature.title} variants={staggerItem}>
              <TiltCard className="h-full">
                <Card variant="interactive" className="h-full group">
                  <CardHeader>
                    <div className="w-14 h-14 rounded-[12px] bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center mb-4 group-hover:shadow-[var(--shadow-gold-sm)] transition-shadow">
                      <feature.icon className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-xl text-foreground">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground-secondary leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </TiltCard>
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
          {smallFeatures.map((feature) => (
            <motion.div key={feature.title} variants={staggerItem}>
              <TiltCard className="h-full">
                <Card variant="interactive" className="h-full group">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-[8px] bg-gold-400/10 flex items-center justify-center mb-3 group-hover:shadow-[var(--shadow-gold-sm)] transition-shadow">
                      <feature.icon className="h-6 w-6 text-gold-400" />
                    </div>
                    <CardTitle className="text-lg text-foreground">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground-secondary text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
