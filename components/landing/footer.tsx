"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { fadeInUp, viewportOnce } from "@/lib/motion"
import { useTranslation } from "@/components/language-provider"

export function Footer() {
  const { t } = useTranslation()
  return (
    <motion.footer
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className="border-t border-border-subtle py-12 px-4"
    >
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <Image
                src="/gold-logo.svg"
                alt="Snipers Trading Academy"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="font-bold bg-gradient-to-r from-gold-200 to-gold-400 bg-clip-text text-transparent">
                {t("common.academyName")}
              </span>
            </Link>
            <p className="text-sm text-foreground-quaternary mb-4">
              {t("landing.footer.tagline")}
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="w-8 h-8 rounded-[6px] bg-surface-2 border border-border flex items-center justify-center text-foreground-quaternary hover:text-gold-300 hover:border-border-accent transition-colors"
                aria-label="Twitter"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-[6px] bg-surface-2 border border-border flex items-center justify-center text-foreground-quaternary hover:text-gold-300 hover:border-border-accent transition-colors"
                aria-label="Discord"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-[6px] bg-surface-2 border border-border flex items-center justify-center text-foreground-quaternary hover:text-gold-300 hover:border-border-accent transition-colors"
                aria-label="YouTube"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-foreground">{t("landing.footer.academyHeading")}</h4>
            <ul className="space-y-2 text-sm text-foreground-quaternary">
              <li>
                <Link href="#" className="hover:text-gold-300 transition-colors">{t("landing.footer.courses")}</Link>
              </li>
              <li>
                <Link href="#" className="hover:text-gold-300 transition-colors">{t("landing.footer.resources")}</Link>
              </li>
              <li>
                <Link href="#" className="hover:text-gold-300 transition-colors">{t("landing.footer.community")}</Link>
              </li>
              <li>
                <Link href="#" className="hover:text-gold-300 transition-colors">{t("landing.footer.blog")}</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-foreground">{t("landing.footer.supportHeading")}</h4>
            <ul className="space-y-2 text-sm text-foreground-quaternary">
              <li>
                <Link href="#" className="hover:text-gold-300 transition-colors">{t("landing.footer.helpCenter")}</Link>
              </li>
              <li>
                <a href="mailto:support@sniperstradingacademy.com" className="hover:text-gold-300 transition-colors">
                  {t("landing.footer.contactSupport")}
                </a>
              </li>
              <li>
                <Link href="#faq" className="hover:text-gold-300 transition-colors">{t("landing.footer.faq")}</Link>
              </li>
            </ul>
            <p className="text-[11px] text-foreground-quaternary mt-3">
              support@sniperstradingacademy.com
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-foreground">{t("landing.footer.legalHeading")}</h4>
            <ul className="space-y-2 text-sm text-foreground-quaternary">
              <li>
                <Link href="#" className="hover:text-gold-300 transition-colors">{t("landing.footer.privacy")}</Link>
              </li>
              <li>
                <Link href="#" className="hover:text-gold-300 transition-colors">{t("landing.footer.terms")}</Link>
              </li>
              <li>
                <Link href="#" className="hover:text-gold-300 transition-colors">{t("landing.footer.riskDisclosure")}</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border-subtle text-center text-sm text-foreground-quaternary">
          <p>{t("common.copyrightSnipers", { year: new Date().getFullYear().toString() })}</p>
          <p className="mt-2 text-[11px]">
            {t("landing.footer.riskWarning")}
          </p>
        </div>
      </div>
    </motion.footer>
  )
}
