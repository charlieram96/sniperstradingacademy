"use client"

import { motion } from "framer-motion"
import { Calendar, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { slideInFromRight } from "@/lib/motion"

interface AcademyClass {
  id: string
  title: string
  description: string | null
  meeting_link: string
  scheduled_at: string
  is_live: boolean
}

interface LiveClassCardProps {
  classes: AcademyClass[]
}

function ClassCard({ cls }: { cls: AcademyClass }) {
  const scheduledDate = new Date(cls.scheduled_at)
  const isLive = cls.is_live
  const day = scheduledDate.toLocaleString("en-US", {
    day: "numeric",
    timeZone: "America/New_York",
  })
  const month = scheduledDate.toLocaleString("en-US", {
    month: "short",
    timeZone: "America/New_York",
  })
  const formattedDate = scheduledDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  })

  // app-signatures §02 .class row: horizontal date-column / body / CTA.
  // Live state = red-tinted gradient + red border (no gold left strip).
  return (
    <div
      className={`flex items-center gap-3.5 rounded-xl border p-3.5 ${
        isLive
          ? "border-red/30 bg-gradient-to-r from-red/[0.06] to-transparent"
          : "border-border bg-surface-1"
      }`}
    >
      {/* Date column */}
      <div className="flex-shrink-0 flex flex-col items-center text-center pr-3.5 border-r border-border">
        <span className="font-mono text-xl font-semibold leading-none tabular-nums text-foreground">{day}</span>
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground-tertiary mt-1">{month}</span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-foreground truncate">{cls.title}</h4>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground tabular-nums mt-1">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{formattedDate} EST</span>
        </div>
        <div className="mt-2">
          {isLive ? (
            <Badge variant="live">Live</Badge>
          ) : (
            <Badge variant="secondary">Upcoming</Badge>
          )}
        </div>
      </div>

      {/* CTA */}
      <a href={cls.meeting_link} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
        <Button size="sm">
          <ExternalLink className="h-3 w-3 mr-1.5" />
          Join Class
        </Button>
      </a>
    </div>
  )
}

export function LiveClassCard({ classes }: LiveClassCardProps) {
  if (classes.length === 0) return null

  // Show every class an admin has toggled live, so two or more can run at once.
  // If none are toggled live, fall back to the soonest upcoming class as a preview.
  const liveClasses = classes.filter((c) => c.is_live)
  const toShow = liveClasses.length > 0 ? liveClasses : [classes[0]]

  return (
    <motion.div
      variants={slideInFromRight}
      initial="hidden"
      animate="visible"
      className="w-full sm:w-[380px] flex-shrink-0 flex flex-col gap-2"
    >
      {toShow.map((cls) => (
        <ClassCard key={cls.id} cls={cls} />
      ))}
    </motion.div>
  )
}
