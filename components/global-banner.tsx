"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  AlertCircle,
  Info,
  Bell,
  AlertTriangle,
  Megaphone,
  Sparkles,
  Star,
  Zap,
  Clock,
  CheckCircle,
  LucideIcon
} from "lucide-react"

interface BannerConfig {
  text: string
  color?: string
  icon?: string
}

// Icon mapping
const ICON_MAP: Record<string, LucideIcon> = {
  AlertCircle,
  Info,
  Bell,
  AlertTriangle,
  Megaphone,
  Sparkles,
  Star,
  Zap,
  Clock,
  CheckCircle
}

// Color styling mapping (all with white text)
const COLOR_MAP: Record<string, string> = {
  green: "bg-green-600 border-green-700",
  red: "bg-red-600 border-red-700",
  purple: "bg-gradient-to-r from-purple-600 to-purple-700 border-purple-800",
  gray: "bg-gray-700 border-gray-800",
  black: "bg-black border-gray-900"
}

export function GlobalBanner() {
  const [bannerConfig, setBannerConfig] = useState<BannerConfig | null>(null)

  useEffect(() => {
    async function fetchBanner() {
      const supabase = createClient()
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", "global_banner")
        .single()

      if (data?.setting_value) {
        // Try to parse as JSON, fallback to plain text for backward compatibility
        try {
          const parsed = JSON.parse(data.setting_value)
          setBannerConfig(parsed)
        } catch {
          // Plain text - use defaults
          setBannerConfig({
            text: data.setting_value,
            color: "green",
            icon: "AlertCircle"
          })
        }
      }
    }

    fetchBanner()
  }, [])

  // Set CSS variable for banner height so other components can adjust
  useEffect(() => {
    const height = bannerConfig?.text ? "48px" : "0px"
    document.documentElement.style.setProperty("--banner-height", height)
  }, [bannerConfig])

  if (!bannerConfig?.text) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] w-full h-0 transition-all duration-200" />
    )
  }

  const IconComponent = ICON_MAP[bannerConfig.icon || "AlertCircle"] || AlertCircle
  const colorClasses = COLOR_MAP[bannerConfig.color || "green"] || COLOR_MAP.green

  return (
    <div className={`fixed top-0 left-0 right-0 z-[60] w-full h-12 transition-all duration-200 ${colorClasses} border-b`}>
      <div className="h-full px-4 flex items-center justify-center">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-center gap-2">
          <IconComponent className="h-4 w-4 text-white flex-shrink-0" />
          <p className="text-sm text-white text-center">{bannerConfig.text}</p>
        </div>
      </div>
    </div>
  )
}
