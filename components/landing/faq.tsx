"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { fadeInUp, fadeInRight, viewportOnce } from "@/lib/motion"
import { useTranslation } from "@/components/language-provider"

export function FAQ() {
  const { t } = useTranslation()

  const faqItems = [
    { question: t("landing.faq.q1"), answer: t("landing.faq.a1") },
    { question: t("landing.faq.q2"), answer: t("landing.faq.a2") },
    { question: t("landing.faq.q3"), answer: t("landing.faq.a3") },
    { question: t("landing.faq.q4"), answer: t("landing.faq.a4") },
    { question: t("landing.faq.q5"), answer: t("landing.faq.a5") },
    { question: t("landing.faq.q6"), answer: t("landing.faq.a6") },
  ]
  return (
    <section id="faq" className="py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
          {/* Left column - sticky title */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="lg:col-span-2 lg:sticky lg:top-32 lg:self-start"
          >
            <Badge className="mb-4">{t("landing.faq.badge")}</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              {t("landing.faq.heading")}{" "}
              <br className="hidden lg:block" />
              {t("landing.faq.headingLine2")}
            </h2>
            <p className="text-foreground-tertiary text-lg">
              {t("landing.faq.subheading")}
            </p>
          </motion.div>

          {/* Right column - accordion */}
          <motion.div
            variants={fadeInRight}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="lg:col-span-3"
          >
            <div className="bg-surface-1 rounded-[16px] border border-border p-6">
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-base text-foreground">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-foreground-secondary leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
