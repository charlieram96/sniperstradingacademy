"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import { getTranslation, type Locale, type TranslationKey } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"

interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en"
  const stored = localStorage.getItem("preferred_language")
  if (stored === "en" || stored === "es") return stored
  return "en"
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  // On mount: sync with user_metadata if authenticated
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.preferred_language) {
        const metaLang = user.user_metadata.preferred_language as string
        if ((metaLang === "en" || metaLang === "es") && metaLang !== locale) {
          setLocaleState(metaLang)
          localStorage.setItem("preferred_language", metaLang)
        }
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Set document lang attribute
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem("preferred_language", newLocale)

    // Persist to user_metadata for logged-in users (fire-and-forget)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.auth.updateUser({ data: { preferred_language: newLocale } })
      }
    })
  }, [])

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      getTranslation(locale, key, params),
    [locale]
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider")
  }
  return context
}
