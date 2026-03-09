"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { scaleFadeIn, viewportOnce } from "@/lib/motion"
import { useTranslation } from "@/components/language-provider"

export function CTA() {
  const { t } = useTranslation()
  return (
    <section className="relative py-24 px-4 overflow-hidden">
      <div className="container mx-auto max-w-4xl relative">
        <motion.div
          variants={scaleFadeIn}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="bg-surface-1 rounded-[24px] border border-border-accent p-12 md:p-16 relative overflow-hidden text-center"
        >
          {/* Internal glow orb */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gold-400/8 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              {t("landing.cta.heading")}
            </h2>
            <p className="text-xl text-foreground-tertiary mb-10 max-w-2xl mx-auto">
              {t("landing.cta.subheading")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button size="lg" className="gap-2 text-lg px-10 py-7">
                    {t("landing.cta.button")}
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
            </div>
            <p className="text-sm text-foreground-quaternary mt-8">
              {t("landing.cta.priceNote")}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
