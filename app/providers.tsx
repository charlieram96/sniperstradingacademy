"use client"

import { LoadingProvider } from "@/components/loading-provider"
import { LanguageProvider } from "@/components/language-provider"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <LoadingProvider>
        {children}
      </LoadingProvider>
    </LanguageProvider>
  )
}