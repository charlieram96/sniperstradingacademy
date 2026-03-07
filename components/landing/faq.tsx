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

const faqItems = [
  {
    question: "What trading experience do I need?",
    answer:
      "No prior trading experience is required. Our curriculum starts with the fundamentals and progressively builds to advanced strategies. Whether you're a complete beginner or have some experience, our structured learning path will meet you where you are.",
  },
  {
    question: "How are the live sessions structured?",
    answer:
      "We hold 3 live trading sessions per week where our instructors analyze markets in real-time, walk through trade setups, and answer your questions. Sessions are recorded so you can review them anytime. Each session typically runs 60-90 minutes.",
  },
  {
    question: "What is the refund policy?",
    answer:
      "We offer a 14-day money-back guarantee on the activation fee. If you're not satisfied with the program within the first 14 days, contact our support team for a full refund. Monthly subscriptions can be cancelled at any time.",
  },
  {
    question: "Do I get 1-on-1 mentorship?",
    answer:
      "Yes! Every member gets access to 1-on-1 mentorship sessions with our experienced traders. You can book sessions to review your trades, discuss strategies, and get personalized feedback on your trading plan.",
  },
  {
    question: "What markets do you cover?",
    answer:
      "Our primary focus is on US equity options, but we also cover futures, forex, and cryptocurrency markets. The strategies and risk management principles we teach are applicable across all markets.",
  },
  {
    question: "How long until I see results?",
    answer:
      "Results vary based on dedication and practice. Most students start seeing improvement in their trading decisions within 4-6 weeks. We recommend committing at least 3 months to fully internalize the strategies and develop consistent habits.",
  },
]

export function FAQ() {
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
            <Badge className="mb-4">FAQ</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Questions?{" "}
              <br className="hidden lg:block" />
              We&apos;ve Got Answers
            </h2>
            <p className="text-foreground-tertiary text-lg">
              Everything you need to know about Snipers Trading Academy. Can&apos;t
              find what you&apos;re looking for? Reach out to our support team.
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
