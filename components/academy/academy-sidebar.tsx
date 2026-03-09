"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, Circle, PlayCircle, FileText, ChevronDown, BookOpen, X, Clock, ExternalLink } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { staggerContainer, staggerItem, sidebarMobileRight, sidebarOverlay } from "@/lib/motion"

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

interface AcademySidebarProps {
  modules: Module[]
  selectedLesson: { moduleId: string; lesson: Lesson } | null
  onSelectLesson: (moduleId: string, lesson: Lesson) => void
  totalLessons: number
  completedLessons: number
  overallProgress: number
}

function ProgressRing({ progress, size = 64, strokeWidth = 4 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--gold-400)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  )
}

export function AcademySidebar({
  modules,
  selectedLesson,
  onSelectLesson,
  totalLessons,
  completedLessons,
  overallProgress,
}: AcademySidebarProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => {
    // Auto-expand the module containing the selected lesson
    if (selectedLesson) return new Set([selectedLesson.moduleId])
    return new Set(modules.length > 0 ? [modules[0].id] : [])
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  const getModuleProgress = (mod: Module) => {
    const completed = mod.lessons.filter(l => l.completed).length
    return { completed, total: mod.lessons.length }
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Progress summary - sticky top */}
      <div className="p-5 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <ProgressRing progress={overallProgress} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gold-400">{Math.round(overallProgress)}%</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {completedLessons} of {totalLessons} lessons
            </p>
            <p className="text-xs text-muted-foreground">complete</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-gold-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Module list */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-3">
          {modules.map((mod) => {
            const { completed, total } = getModuleProgress(mod)
            const isExpanded = expandedModules.has(mod.id)

            return (
              <div key={mod.id} className="mb-1">
                {/* Module header */}
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left group"
                >
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${
                    completed === total && total > 0
                      ? "bg-gold-400/15 text-gold-400"
                      : "bg-white/[0.06] text-foreground-tertiary"
                  }`}>
                    {completed === total && total > 0 ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      mod.number
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{mod.title}</p>
                    <p className="text-xs text-muted-foreground">{completed}/{total}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-foreground-quaternary transition-transform duration-200 flex-shrink-0 ${
                    isExpanded ? "rotate-180" : ""
                  }`} />
                </button>

                {/* Lessons */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                        className="pl-4 pr-1 pb-2"
                      >
                        {mod.lessons.map((lesson) => {
                          const isSelected = selectedLesson?.lesson.id === lesson.id
                          return (
                            <motion.button
                              key={lesson.id}
                              variants={staggerItem}
                              onClick={() => {
                                onSelectLesson(mod.id, lesson)
                                setMobileOpen(false)
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-sm ${
                                isSelected
                                  ? "bg-gold-400/10 border-l-2 border-gold-400"
                                  : "hover:bg-white/[0.04] border-l-2 border-transparent"
                              }`}
                            >
                              <div className="flex-shrink-0">
                                {lesson.completed ? (
                                  <CheckCircle className="h-4 w-4 text-gold-400" />
                                ) : (
                                  <Circle className="h-4 w-4 text-foreground-quaternary" />
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                {lesson.type === "video" ? (
                                  <PlayCircle className="h-3.5 w-3.5 text-foreground-tertiary" />
                                ) : lesson.type === "link" ? (
                                  <ExternalLink className="h-3.5 w-3.5 text-foreground-tertiary" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5 text-foreground-tertiary" />
                                )}
                              </div>
                              <span className={`flex-1 truncate ${
                                isSelected ? "text-gold-400 font-medium" : "text-foreground-secondary"
                              }`}>
                                {lesson.title}
                              </span>
                              <span className="text-xs text-foreground-quaternary flex-shrink-0 flex items-center gap-1">
                                {lesson.type === "video" && lesson.duration && (
                                  <>
                                    <Clock className="h-3 w-3" />
                                    {lesson.duration}
                                  </>
                                )}
                                {lesson.type === "pdf" && lesson.size}
                              </span>
                            </motion.button>
                          )
                        })}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[380px] flex-shrink-0 sticky top-0 self-start mt-[40px] h-[calc(100vh-220px)] border border-border-subtle bg-surface-1/60 rounded-xl flex-col overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-gold-400 text-primary-foreground shadow-[var(--shadow-gold-lg)] flex items-center justify-center hover:bg-gold-500 transition-colors"
      >
        <BookOpen className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              variants={sidebarOverlay}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/60"
            />
            <motion.aside
              variants={sidebarMobileRight}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="lg:hidden fixed right-0 top-0 bottom-0 z-50 w-[380px] bg-surface-0 border-l border-border-subtle flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                <h2 className="text-sm font-semibold text-foreground">Course Content</h2>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="text-foreground-tertiary hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
