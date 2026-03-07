"use client"

import { motion } from "framer-motion"
import { Calendar, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { slideInFromRight } from "@/lib/motion"

interface AcademyClass {
  id: string
  title: string
  description: string | null
  meeting_link: string
  scheduled_at: string
}

interface LiveClassCardProps {
  classes: AcademyClass[]
}

export function LiveClassCard({ classes }: LiveClassCardProps) {
  if (classes.length === 0) return null

  const nextClass = classes[0]
  const scheduledDate = new Date(nextClass.scheduled_at)
  const formattedDate = scheduledDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  })

  return (
    <motion.div
      variants={slideInFromRight}
      initial="hidden"
      animate="visible"
      className="w-full sm:w-[380px] flex-shrink-0"
    >
      <div className="rounded-xl border border-border bg-surface-1 p-3 relative overflow-hidden">
        {/* Gold gradient left border */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-gold-400 to-gold-600" />

        {/* LIVE badge - only shown when class time has arrived */}
        {scheduledDate <= new Date() && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-gentle-pulse" />
            <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Live</span>
          </div>
        )}

        <div className="pl-3">
          <h3 className="text-sm font-semibold text-foreground mb-1 truncate">{nextClass.title}</h3>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Calendar className="h-3 w-3" />
            <span>{formattedDate} EST</span>
          </div>

          <a href={nextClass.meeting_link} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="w-full bg-gold-400 hover:bg-gold-500 text-primary-foreground h-8 text-xs">
              <ExternalLink className="h-3 w-3 mr-1.5" />
              Join Class
            </Button>
          </a>
        </div>
      </div>
    </motion.div>
  )
}
