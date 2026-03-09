"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { spring } from "@/lib/motion"
import { LanguageToggle } from "@/components/language-toggle"
import { useTranslation } from "@/components/language-provider"
import type { TranslationKey } from "@/lib/i18n"

export function Navbar() {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 50)
  })

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  const navLinks = [
    { href: "#features", labelKey: "landing.navbar.features" as TranslationKey },
    { href: "#curriculum", labelKey: "landing.navbar.curriculum" as TranslationKey },
    { href: "#pricing", labelKey: "landing.navbar.pricing" as TranslationKey },
    { href: "#faq", labelKey: "landing.navbar.faq" as TranslationKey },
  ]

  return (
    <>
      <nav
        className={`fixed top-0 z-50 w-full transition-colors duration-300 ${
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-white/[0.06]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
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
              <span className="text-xl font-bold bg-gradient-to-r from-gold-200 to-gold-400 bg-clip-text text-transparent">
                {t("common.academyName")}
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button variant="ghost" className="text-foreground-tertiary hover:text-gold-300 transition-colors">
                    {t(link.labelKey)}
                  </Button>
                </Link>
              ))}
              <LanguageToggle />
              <Link href="/login">
                <Button variant="premium">{t("landing.navbar.login")}</Button>
              </Link>
              <Link href="/register">
                <Button>{t("landing.navbar.getStarted")}</Button>
              </Link>
            </div>
            <button
              className="md:hidden p-2 text-foreground-tertiary hover:text-gold-300 transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={spring.smooth}
              className="fixed top-0 right-0 z-[70] h-full w-[280px] bg-surface-1 border-l border-border p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <span className="text-lg font-bold bg-gradient-to-r from-gold-200 to-gold-400 bg-clip-text text-transparent">
                  {t("nav.menu")}
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 text-foreground-tertiary hover:text-gold-300 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3 rounded-[8px] text-foreground-secondary hover:text-gold-300 hover:bg-gold-400/5 transition-colors font-medium"
                  >
                    {t(link.labelKey)}
                  </Link>
                ))}
              </div>
              <div className="mt-auto flex flex-col gap-3">
                <div className="flex justify-center mb-2">
                  <LanguageToggle />
                </div>
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="premium" className="w-full">{t("landing.navbar.login")}</Button>
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full">{t("landing.navbar.getStarted")}</Button>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
