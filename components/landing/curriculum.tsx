"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, LineChart, Trophy } from "lucide-react"
import { fadeInUp, pathDraw, viewportOnce } from "@/lib/motion"
import { useTranslation } from "@/components/language-provider"

export function Curriculum() {
  const { t } = useTranslation()

  const steps = [
    { title: t("landing.curriculum.step1Title"), desc: t("landing.curriculum.step1Desc") },
    { title: t("landing.curriculum.step2Title"), desc: t("landing.curriculum.step2Desc") },
    { title: t("landing.curriculum.step3Title"), desc: t("landing.curriculum.step3Desc") },
    { title: t("landing.curriculum.step4Title"), desc: t("landing.curriculum.step4Desc") },
    { title: t("landing.curriculum.step5Title"), desc: t("landing.curriculum.step5Desc") },
  ]
  return (
    <section id="curriculum" className="py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            <Badge className="mb-4">{t("landing.curriculum.badge")}</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              {t("landing.curriculum.heading")}
            </h2>
            <div className="space-y-6">
              {steps.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  viewport={viewportOnce}
                  className="flex items-start gap-4 group"
                >
                  <span className="text-gold-400/30 font-mono text-sm font-bold mt-1 w-6 flex-shrink-0">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-400 flex items-center justify-center mt-0.5 group-hover:shadow-[var(--shadow-gold-sm)] transition-all">
                    <CheckCircle className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-foreground mb-1">
                      {item.title}
                    </h4>
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
                  <motion.path
                    d="M0,150 Q50,140 100,100 T200,80 T300,40 T400,60"
                    fill="none"
                    stroke="#D4A853"
                    strokeWidth="3"
                    variants={pathDraw}
                    initial="hidden"
                    whileInView="visible"
                    viewport={viewportOnce}
                  />
                  <path
                    d="M0,150 Q50,140 100,100 T200,80 T300,40 T400,60 L400,200 L0,200 Z"
                    fill="url(#chartGradient)"
                  />
                </svg>
              </div>
              <LineChart className="h-32 w-32 text-gold-400/40 z-10 group-hover:scale-110 transition-transform" />
            </div>
            <div className="absolute -bottom-6 -right-6 bg-gradient-to-br from-gold-400 to-gold-500 rounded-[12px] p-6 shadow-[var(--shadow-gold-lg)] border border-gold-300/20 animate-float">
              <Trophy className="h-10 w-10 mb-2 text-primary-foreground" />
              <p className="font-bold text-lg text-primary-foreground">
                {t("landing.curriculum.certification")}
              </p>
              <p className="text-sm text-gold-800">{t("landing.curriculum.uponCompletion")}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
