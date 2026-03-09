"use client"

import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Download, GraduationCap, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fadeInUp } from "@/lib/motion"
import { VideoPlayer } from "./video-player"

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

interface LessonContentProps {
  modules: Module[]
  selectedLesson: { moduleId: string; lesson: Lesson } | null
  onSelectLesson: (moduleId: string, lesson: Lesson) => void
  markLessonComplete: (moduleId: string, lessonId: string) => void
}

export function LessonContent({
  modules,
  selectedLesson,
  onSelectLesson,
  markLessonComplete,
}: LessonContentProps) {
  // Flatten all lessons for prev/next navigation
  const flatLessons = useMemo(() => {
    return modules.flatMap(mod =>
      mod.lessons.map(lesson => ({ moduleId: mod.id, moduleName: mod.title, moduleNumber: mod.number, lesson }))
    )
  }, [modules])

  const currentIndex = selectedLesson
    ? flatLessons.findIndex(fl => fl.lesson.id === selectedLesson.lesson.id)
    : -1

  const prevLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null
  const nextLesson = currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null

  const currentModule = selectedLesson
    ? modules.find(m => m.id === selectedLesson.moduleId)
    : null

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <AnimatePresence mode="wait">
        {!selectedLesson ? (
          <motion.div
            key="empty"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6"
          >
            <div className="w-20 h-20 rounded-2xl bg-gold-400/10 flex items-center justify-center mb-6 animate-gentle-pulse">
              <GraduationCap className="h-10 w-10 text-gold-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Select a lesson</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose a lesson from the sidebar to start learning. Your progress is saved automatically.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={selectedLesson.lesson.id}
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="p-6 lg:p-10"
          >
            {/* Breadcrumb */}
            <div className="rounded-xl bg-surface-1 border border-border-subtle p-4 mb-6">
              <p className="text-xs text-muted-foreground">
                Module {currentModule?.number}: {currentModule?.title}
              </p>
              <h1 className="text-xl lg:text-2xl font-semibold text-foreground mt-1">
                {selectedLesson.lesson.title}
              </h1>
            </div>

            {/* Video lesson */}
            {selectedLesson.lesson.type === "video" && selectedLesson.lesson.url && (
              <VideoPlayer
                src={selectedLesson.lesson.url}
                title={selectedLesson.lesson.title}
                lessonId={selectedLesson.lesson.id}
                moduleId={selectedLesson.moduleId}
                isCompleted={selectedLesson.lesson.completed}
                onMarkComplete={() => markLessonComplete(selectedLesson.moduleId, selectedLesson.lesson.id)}
                onEnded={() => {
                  if (nextLesson) onSelectLesson(nextLesson.moduleId, nextLesson.lesson)
                }}
              />
            )}

            {/* PDF lesson */}
            {selectedLesson.lesson.type === "pdf" && (
              <div className="rounded-xl border border-border bg-surface-1 p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {selectedLesson.lesson.title}
                  </h3>
                  {selectedLesson.lesson.size && (
                    <p className="text-sm text-muted-foreground mb-6">{selectedLesson.lesson.size}</p>
                  )}
                  <Button
                    className="bg-gold-400 hover:bg-gold-500 text-primary-foreground"
                    onClick={() => {
                      if (selectedLesson.lesson.url) {
                        window.open(selectedLesson.lesson.url, "_blank")
                        if (!selectedLesson.lesson.completed) {
                          markLessonComplete(selectedLesson.moduleId, selectedLesson.lesson.id)
                        }
                      }
                    }}
                    disabled={!selectedLesson.lesson.url}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </div>
            )}

            {/* Link lesson */}
            {selectedLesson.lesson.type === "link" && (
              <div className="rounded-xl border border-border bg-surface-1 p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                    <ExternalLink className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {selectedLesson.lesson.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">This lesson links to an external resource.</p>
                  <Button
                    className="bg-gold-400 hover:bg-gold-500 text-primary-foreground"
                    onClick={() => {
                      if (selectedLesson.lesson.url) {
                        window.open(selectedLesson.lesson.url, "_blank")
                        if (!selectedLesson.lesson.completed) {
                          markLessonComplete(selectedLesson.moduleId, selectedLesson.lesson.id)
                        }
                      }
                    }}
                    disabled={!selectedLesson.lesson.url}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Link
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              {prevLesson ? (
                <button
                  onClick={() => onSelectLesson(prevLesson.moduleId, prevLesson.lesson)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border-subtle bg-surface-0 hover:bg-surface-1 hover:border-gold-400/30 transition-all duration-200 group text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-gold-400/10 flex items-center justify-center flex-shrink-0 transition-colors">
                    <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-gold-400 group-hover:-translate-x-0.5 transition-all" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">Previous</p>
                    <p className="text-sm font-medium text-foreground truncate">{prevLesson.lesson.title}</p>
                  </div>
                </button>
              ) : <div />}
              {nextLesson ? (
                <button
                  onClick={() => onSelectLesson(nextLesson.moduleId, nextLesson.lesson)}
                  className="flex items-center justify-end gap-3 px-4 py-3 rounded-xl border border-border-subtle bg-surface-0 hover:bg-surface-1 hover:border-gold-400/30 transition-all duration-200 group text-right"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">Next</p>
                    <p className="text-sm font-medium text-foreground truncate">{nextLesson.lesson.title}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-gold-400/10 flex items-center justify-center flex-shrink-0 transition-colors">
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-gold-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ) : <div />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
