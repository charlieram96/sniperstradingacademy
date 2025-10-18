"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function GlobalBanner() {
  const [banner, setBanner] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

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

  if (!banner || dismissed) {
    return null
  }

  return (
    <div className="w-full bg-primary/10 border-b border-primary/20 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <AlertCircle className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-sm text-foreground">{banner}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
