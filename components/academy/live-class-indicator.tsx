"use client"

import { useState, useEffect } from "react"
import { GraduationCap, Calendar, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createClient } from "@/lib/supabase/client"

interface AcademyClass {
  id: string
  title: string
  meeting_link: string
  scheduled_at: string
}

export function LiveClassIndicator() {
  const [nextClass, setNextClass] = useState<AcademyClass | null>(null)

  useEffect(() => {
    async function fetchNextClass() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("academy_classes")
          .select("id, title, meeting_link, scheduled_at")
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .single()

        if (!error && data) {
          setNextClass(data)
        }
      } catch {
        // No upcoming classes
      }
    }
    fetchNextClass()
  }, [])

  if (!nextClass) return null

  const scheduledDate = new Date(nextClass.scheduled_at)
  const formattedDate = scheduledDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <GraduationCap className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-gold-400 animate-gentle-pulse" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-gentle-pulse" />
              <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Upcoming</span>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">{nextClass.title}</h4>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Calendar className="h-3 w-3" />
              <span>{formattedDate} EST</span>
            </div>
          </div>
          <a href={nextClass.meeting_link} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="w-full bg-gold-400 hover:bg-gold-500 text-primary-foreground h-8 text-xs">
              <ExternalLink className="h-3 w-3 mr-1.5" />
              Join Class
            </Button>
          </a>
        </div>
      </PopoverContent>
    </Popover>
  )
}
