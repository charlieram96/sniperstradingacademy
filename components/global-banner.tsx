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

  if (!banner) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] w-full bg-primary/10 border-b border-primary/20 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-primary flex-shrink-0" />
        <p className="text-sm text-foreground">{banner}</p>
      </div>
    </div>
  )
}
