"use client"

import { Navbar } from "@/components/landing/navbar"
import { Hero } from "@/components/landing/hero"
import { SocialProof } from "@/components/landing/social-proof"
import { Features } from "@/components/landing/features"
import { Curriculum } from "@/components/landing/curriculum"
import { Pricing } from "@/components/landing/pricing"
import { FAQ } from "@/components/landing/faq"
import { CTA } from "@/components/landing/cta"
import { Footer } from "@/components/landing/footer"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <Hero />
      <SocialProof />
      <Features />
      <Curriculum />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  )
}
