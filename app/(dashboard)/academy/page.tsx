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
}

interface Lesson {
  id: string
  title: string
  type: "video" | "pdf" | "link"
  duration?: string
  size?: string
  url?: string
  completed: boolean
}

interface Module {
  id: string
  number: number
  title: string
  description: string
  lessons: Lesson[]
}

interface DBModule {
  id: string
  number: number
  title: string
  description: string | null
  display_order: number
  is_published: boolean
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
}

export default function AcademyPage() {
  const { t } = useTranslation()
  const [academyClasses, setAcademyClasses] = useState<AcademyClass[]>([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [progressLoading, setProgressLoading] = useState(true)
  const [modules, setModules] = useState<Module[]>([])
  const [modulesLoading, setModulesLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState<{ moduleId: string; lesson: Lesson } | null>(null)

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
          lessons: lessonsData
            .filter((lesson: DBLesson) => lesson.module_id === mod.id)
            .map((lesson: DBLesson) => ({
              id: lesson.id,
              title: lesson.title,
              type: lesson.type,
              duration: lesson.duration || undefined,
              size: lesson.file_size || undefined,
              url: lesson.type === 'link' ? lesson.link_url || undefined : lesson.type === 'pdf' ? lesson.pdf_url || undefined : lesson.video_url || undefined,
              completed: false // Will be updated by progress fetch
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

  // Auto-select first incomplete lesson on mount
  useEffect(() => {
    if (modulesLoading || progressLoading || selectedLesson || modules.length === 0) return

    for (const mod of modules) {
      const incompleteLesson = mod.lessons.find(l => !l.completed)
      if (incompleteLesson) {
        setSelectedLesson({ moduleId: mod.id, lesson: incompleteLesson })
        return
      }
    }
    // All complete — select the first lesson
    if (modules[0]?.lessons[0]) {
      setSelectedLesson({ moduleId: modules[0].id, lesson: modules[0].lessons[0] })
    }
  }, [modulesLoading, progressLoading, modules, selectedLesson])

  // Calculate overall progress
  const totalLessons = modules.reduce((acc, module) => acc + module.lessons.length, 0)
  const completedLessons = modules.reduce(
    (acc, module) => acc + module.lessons.filter(lesson => lesson.completed).length,
    0
  )
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
    // Get the latest lesson state from modules
    const mod = modules.find(m => m.id === moduleId)
    const latestLesson = mod?.lessons.find(l => l.id === lesson.id)
    setSelectedLesson({ moduleId, lesson: latestLesson || lesson })
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
          modules={modules}
          selectedLesson={selectedLesson}
          onSelectLesson={handleSelectLesson}
          markLessonComplete={markLessonComplete}
        />
        <AcademySidebar
          modules={modules}
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
