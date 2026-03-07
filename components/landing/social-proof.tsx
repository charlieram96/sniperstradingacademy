"use client"

import { motion } from "framer-motion"
import { staggerContainerSlow, staggerItem, viewportOnce } from "@/lib/motion"
import { useTranslation } from "@/components/language-provider"

export function SocialProof() {
  const { t } = useTranslation()

  const stats = [
    { value: "500+", label: t("landing.socialProof.activeTraders") },
    { value: "3", label: t("landing.socialProof.liveSessions") },
    { value: "95%", label: t("landing.socialProof.satisfaction") },
    { value: "24/7", label: t("landing.socialProof.communityAccess") },
  ]
  return (
    <section className="border-t border-border-subtle py-12 px-4">
      <div className="container mx-auto">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5 }}
          className="text-center text-xs font-medium uppercase tracking-widest text-foreground-quaternary mb-8"
        >
          {t("landing.socialProof.trusted")}
        </motion.p>
        <motion.div
          variants={staggerContainerSlow}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={staggerItem}
              className="text-center"
            >
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-foreground-quaternary">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
