"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { AlertCircle } from "lucide-react"

export function GlobalBanner() {
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBanner() {
      const supabase = createClient()
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", "global_banner")
        .single()

      if (data?.setting_value) {
        setBanner(data.setting_value)
      }
    }

    fetchBanner()
  }, [])

  // Set CSS variable for banner height so other components can adjust
  useEffect(() => {
    const height = banner ? "48px" : "0px"
    document.documentElement.style.setProperty("--banner-height", height)
  }, [banner])

  return (
    <div className={`fixed top-0 left-0 right-0 z-[60] w-full transition-all duration-200 ${
      banner
        ? "h-12 bg-card backdrop-blur-sm border-b border-border"
        : "h-0"
    }`}>
      {banner && (
        <div className="h-full px-4 flex items-center justify-center">
          <div className="max-w-7xl w-full mx-auto flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-sm text-foreground text-center">{banner}</p>
          </div>
        </div>
      )}
    </div>
  )
}
