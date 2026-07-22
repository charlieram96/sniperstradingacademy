"use client"

import { useState, useEffect } from "react"
import { GraduationCap, Calendar, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createClient } from "@/lib/supabase/client"
import { computeIsActive } from "@/lib/user-status"

interface AcademyClass {
  id: string
  title: string
  meeting_link: string
  scheduled_at: string
}

export function LiveClassIndicator() {
  const [classes, setClasses] = useState<AcademyClass[]>([])
  const [label, setLabel] = useState<"Live" | "Upcoming">("Upcoming")

  useEffect(() => {
    async function fetchClasses() {
      try {
        const supabase = createClient()

        // Classes are only shown to active users (admins always count as active).
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: userData } = await supabase
          .from("users")
          .select("initial_payment_completed, bypass_initial_payment, is_active, bypass_subscription, role")
          .eq("id", user.id)
          .single()
        const isAdmin = ["admin", "superadmin", "superadmin+"].includes(userData?.role || "")
        if (!computeIsActive(userData) && !isAdmin) return

        // Prefer classes an admin has toggled live; fall back to the next upcoming.
        const { data: live } = await supabase
          .from("academy_classes")
          .select("id, title, meeting_link, scheduled_at")
          .eq("is_live", true)
          .order("scheduled_at", { ascending: true })

        if (live && live.length > 0) {
          setClasses(live)
          setLabel("Live")
          return
        }

        const { data: upcoming } = await supabase
          .from("academy_classes")
          .select("id, title, meeting_link, scheduled_at")
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(1)

        if (upcoming) {
          setClasses(upcoming)
          setLabel("Upcoming")
        }
      } catch {
        // No classes
      }
    }
    fetchClasses()
  }, [])

  if (classes.length === 0) return null

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
            <Badge variant="live">{label}</Badge>
          </div>
          {classes.map((cls, index) => {
            const scheduledDate = new Date(cls.scheduled_at)
            const formattedDate = scheduledDate.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "America/New_York",
            })
            return (
              <div key={cls.id} className={index > 0 ? "pt-3 border-t border-border-subtle" : ""}>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{cls.title}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formattedDate} EST</span>
                  </div>
                </div>
                <a href={cls.meeting_link} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="w-full mt-2">
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    Join Class
                  </Button>
                </a>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
