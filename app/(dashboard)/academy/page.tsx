"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { motion } from "framer-motion"
import { fadeInUp } from "@/lib/motion"
import { PageHeader } from "@/components/page-header"
import { useTranslation } from "@/components/language-provider"
import { AcademySidebar } from "@/components/academy/academy-sidebar"
import { LessonContent } from "@/components/academy/lesson-content"
import { LiveClassCard } from "@/components/academy/live-class-card"

interface AcademyClass {
  id: string
  title: string
  description: string | null
  meeting_link: string
  scheduled_at: string
  is_live: boolean
}

interface Lesson {
  id: string
  title: string
  type: "video" | "pdf" | "link"
  duration?: string
  size?: string
  url?: string
  completed: boolean
  allowInactiveUsers?: boolean
}

interface Module {
  id: string
  number: number
  title: string
  description: string
  lessons: Lesson[]
  allowInactiveUsers: boolean
}

interface DBModule {
  id: string
  number: number
  title: string
  description: string | null
  display_order: number
  is_published: boolean
  allow_inactive_users: boolean
}

interface DBLesson {
  id: string
  lesson_id: string
  module_id: string
  title: string
  type: 'video' | 'pdf' | 'link'
  video_url: string | null
  pdf_url: string | null
  link_url: string | null
  duration: string | null
  file_size: string | null
  display_order: number
  is_published: boolean
  allow_inactive_users: boolean
}

export default function AcademyPage() {
  const { t } = useTranslation()
  const [academyClasses, setAcademyClasses] = useState<AcademyClass[]>([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [progressLoading, setProgressLoading] = useState(true)
  const [modules, setModules] = useState<Module[]>([])
  const [modulesLoading, setModulesLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState<{ moduleId: string; lesson: Lesson } | null>(null)
  // Whether the current user has an active subscription. Defaults to true so active
  // users never see a lock flash; inactive users get the real value once it resolves.
  const [isUserActive, setIsUserActive] = useState(true)

  // Fetch the current user's active status (drives module locking for inactive users)
  useEffect(() => {
    async function fetchActiveStatus() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: userData } = await supabase
          .from("users")
          .select("is_active, bypass_subscription")
          .eq("id", user.id)
          .single()
        setIsUserActive(!!(userData?.is_active || userData?.bypass_subscription))
      } catch (error) {
        console.error("Error fetching user active status:", error)
      }
    }
    fetchActiveStatus()
  }, [])

  // Fetch academy classes
  useEffect(() => {
    async function fetchClasses() {
      try {
        const supabase = createClient()
        const { data: classes, error } = await supabase
          .from("academy_classes")
          .select("*")
          .order("scheduled_at", { ascending: true })

        if (!error && classes) {
          setAcademyClasses(classes)
        }
      } catch (error) {
        console.error('Error fetching academy classes:', error)
      } finally {
        setClassesLoading(false)
      }
    }

    fetchClasses()
  }, [])

  // Fetch modules and lessons
  useEffect(() => {
    async function fetchModulesAndLessons() {
      try {
        // Fetch modules
        const modulesResponse = await fetch('/api/academy/modules')
        if (!modulesResponse.ok) throw new Error('Failed to fetch modules')
        const { modules: modulesData } = await modulesResponse.json()

        // Fetch lessons
        const lessonsResponse = await fetch('/api/academy/lessons')
        if (!lessonsResponse.ok) throw new Error('Failed to fetch lessons')
        const { lessons: lessonsData } = await lessonsResponse.json()

        // Group lessons by module
        const modulesWithLessons: Module[] = modulesData.map((mod: DBModule) => ({
          id: mod.id,
          number: mod.number,
          title: mod.title,
          description: mod.description || '',
          allowInactiveUsers: mod.allow_inactive_users ?? false,
          lessons: lessonsData
            .filter((lesson: DBLesson) => lesson.module_id === mod.id)
            .map((lesson: DBLesson) => ({
              id: lesson.id,
              title: lesson.title,
              type: lesson.type,
              duration: lesson.duration || undefined,
              size: lesson.file_size || undefined,
              url: lesson.type === 'link' ? lesson.link_url || undefined : lesson.type === 'pdf' ? lesson.pdf_url || undefined : lesson.video_url || undefined,
              completed: false, // Will be updated by progress fetch
              allowInactiveUsers: lesson.allow_inactive_users ?? false
            }))
        }))

        setModules(modulesWithLessons)
      } catch (error) {
        console.error('Error fetching modules and lessons:', error)
      } finally {
        setModulesLoading(false)
      }
    }

    fetchModulesAndLessons()
  }, [])

  // Fetch user's academy progress
  useEffect(() => {
    async function fetchProgress() {
      try {
        const response = await fetch('/api/academy/progress')
        if (response.ok) {
          const { progress } = await response.json()

          // Update modules with completed lessons
          if (progress && progress.length > 0) {
            const completedLessonIds = new Set(
              progress.map((p: { lesson_id: string }) => p.lesson_id)
            )

            setModules(prevModules =>
              prevModules.map(module => ({
                ...module,
                lessons: module.lessons.map(lesson => ({
                  ...lesson,
                  completed: completedLessonIds.has(lesson.id)
                }))
              }))
            )
          }
        }
      } catch (error) {
        console.error('Error fetching academy progress:', error)
      } finally {
        setProgressLoading(false)
      }
    }

    fetchProgress()
  }, [])

  // Per-lesson locking for inactive users. A module is accessible if the user is
  // active OR the module is flagged for inactive users. Within an inaccessible
  // module, a lesson can still be opened if it is individually flagged. A module is
  // "fully locked" only when every one of its lessons is locked.
  const displayModules = useMemo(
    () => modules.map(m => {
      const moduleAccessible = isUserActive || m.allowInactiveUsers
      const lessons = m.lessons.map(l => ({
        ...l,
        locked: !moduleAccessible && !l.allowInactiveUsers,
      }))
      return { ...m, lessons, locked: lessons.length > 0 && lessons.every(l => l.locked) }
    }),
    [modules, isUserActive]
  )

  // Auto-select first incomplete unlocked lesson on mount
  useEffect(() => {
    if (modulesLoading || progressLoading || selectedLesson || displayModules.length === 0) return

    for (const mod of displayModules) {
      const incompleteLesson = mod.lessons.find(l => !l.locked && !l.completed)
      if (incompleteLesson) {
        setSelectedLesson({ moduleId: mod.id, lesson: incompleteLesson })
        return
      }
    }
    // All complete — select the first unlocked lesson
    for (const mod of displayModules) {
      const firstUnlocked = mod.lessons.find(l => !l.locked)
      if (firstUnlocked) {
        setSelectedLesson({ moduleId: mod.id, lesson: firstUnlocked })
        return
      }
    }
  }, [modulesLoading, progressLoading, displayModules, selectedLesson])

  // Calculate overall progress over accessible (unlocked) lessons only
  const unlockedLessons = displayModules.flatMap(m => m.lessons).filter(l => !l.locked)
  const totalLessons = unlockedLessons.length
  const completedLessons = unlockedLessons.filter(lesson => lesson.completed).length
  const overallProgress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0

  const markLessonComplete = async (moduleId: string, lessonId: string) => {
    // Optimistically update UI
    setModules(prevModules =>
      prevModules.map(module => {
        if (module.id === moduleId) {
          return {
            ...module,
            lessons: module.lessons.map(lesson =>
              lesson.id === lessonId ? { ...lesson, completed: true } : lesson
            )
          }
        }
        return module
      })
    )

    // Also update selectedLesson if it matches
    setSelectedLesson(prev => {
      if (prev && prev.lesson.id === lessonId) {
        return { ...prev, lesson: { ...prev.lesson, completed: true } }
      }
      return prev
    })

    // Save to database
    try {
      await fetch('/api/academy/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId })
      })
    } catch (error) {
      console.error('Error saving lesson progress:', error)
    }
  }

  const handleSelectLesson = (moduleId: string, lesson: Lesson) => {
    // Locked lessons cannot be opened by inactive users
    const mod = displayModules.find(m => m.id === moduleId)
    const latestLesson = mod?.lessons.find(l => l.id === lesson.id)
    if (!latestLesson || latestLesson.locked) return
    setSelectedLesson({ moduleId, lesson: latestLesson })
  }

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <PageHeader
          title={t("academy.title")}
          description={t("academy.description")}
          className="flex-1 min-w-0 !border-b-0 !pb-0 !mb-0"
        />
        {!classesLoading && <LiveClassCard classes={academyClasses} />}
      </div>

      {/* Two-panel body */}
      <div className="flex gap-0 -mt-4" style={{ minHeight: 'calc(100vh - 180px)' }}>
        <LessonContent
          modules={displayModules}
          selectedLesson={selectedLesson}
          onSelectLesson={handleSelectLesson}
          markLessonComplete={markLessonComplete}
        />
        <AcademySidebar
          modules={displayModules}
          selectedLesson={selectedLesson}
          onSelectLesson={handleSelectLesson}
          totalLessons={totalLessons}
          completedLessons={completedLessons}
          overallProgress={overallProgress}
        />
      </div>
    </motion.div>
  )
}
