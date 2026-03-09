"use client"

import { useTranslation } from "@/components/language-provider"
import { Button } from "@/components/ui/button"

export function LanguageToggle() {
  const { locale, setLocale } = useTranslation()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === "en" ? "es" : "en")}
      className="h-8 px-2 text-xs font-semibold tracking-wide text-foreground-tertiary hover:text-gold-300"
    >
      {locale === "en" ? "ES" : "EN"}
    </Button>
  )
}
