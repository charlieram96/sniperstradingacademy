"use client"

import { LoadingProvider } from "@/components/loading-provider"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LoadingProvider>
      {children}
    </LoadingProvider>
  )
}