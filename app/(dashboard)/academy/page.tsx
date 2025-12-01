"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import {
  PlayCircle,
  FileText,
  CheckCircle,
  Circle,
  Download,
  Clock,
  BookOpen,
  Calendar,
  ExternalLink
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

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
  type: "video" | "pdf"
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
  type: 'video' | 'pdf'
  video_url: string | null
  pdf_url: string | null
  duration: string | null
  file_size: string | null
  display_order: number
  is_published: boolean
}

export default function AcademyPage() {
  const [academyClasses, setAcademyClasses] = useState<AcademyClass[]>([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [progressLoading, setProgressLoading] = useState(true)
  const [modules, setModules] = useState<Module[]>([])
  const [modulesLoading, setModulesLoading] = useState(true)

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
              url: lesson.type === 'pdf' ? lesson.pdf_url || undefined : lesson.video_url || undefined,
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

  // Calculate overall progress
  const totalLessons = modules.reduce((acc, module) => acc + module.lessons.length, 0)
  const completedLessons = modules.reduce(
    (acc, module) => acc + module.lessons.filter(lesson => lesson.completed).length,
    0
  )
  const completedModules = modules.filter(module =>
    module.lessons.every(lesson => lesson.completed)
  ).length
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

  const getModuleProgress = (module: Module) => {
    const completed = module.lessons.filter(lesson => lesson.completed).length
    const total = module.lessons.length
    return { completed, total, percentage: total > 0 ? (completed / total) * 100 : 0 }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Trading Academy</h1>
        <p className="text-muted-foreground mt-2">
          Master options trading with our comprehensive 6-module course
        </p>
      </div>

      {/* Live Classes Schedule */}
      {!classesLoading && academyClasses.length > 0 && (
        <Card className="mb-8 border-green-500/20 bg-gradient-to-r from-green-500/5 to-green-600/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" />
              Live Trading Classes Schedule
            </CardTitle>
            <CardDescription>
              Join our upcoming live sessions to learn directly from expert traders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {academyClasses.map((classItem, index) => {
                const isFirst = index === 0
                const scheduledDate = new Date(classItem.scheduled_at)
                const formattedDate = scheduledDate.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/New_York"
                })

                return (
                  <div
                    key={classItem.id}
                    className={`p-4 rounded-lg border-2 ${
                      isFirst
                        ? "bg-green-500/20 border-green-500"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={isFirst ? "bg-green-500 text-white" : "bg-muted"}>
                        {isFirst ? "Next Class" : "Upcoming"}
                      </Badge>
                      <PlayCircle className={`h-5 w-5 ${isFirst ? "text-green-600" : "text-muted-foreground"}`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{classItem.title}</h3>
                    {classItem.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {classItem.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formattedDate} EST</span>
                    </div>
                    <a href={classItem.meeting_link} target="_blank" rel="noopener noreferrer" className="block">
                      <Button
                        size="sm"
                        className={`w-full ${
                          isFirst
                            ? "bg-green-600 hover:bg-green-700"
                            : ""
                        }`}
                        variant={isFirst ? "default" : "outline"}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {isFirst ? "Join Class" : "View Details"}
                      </Button>
                    </a>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Progress Card */}
      <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Your Course Progress</CardTitle>
              <CardDescription>
                Keep learning to unlock your full trading potential
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">
                {Math.round(overallProgress)}%
              </div>
              <p className="text-sm text-muted-foreground">Complete</p> 
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={overallProgress} className="h-3 mb-4" />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-foreground">{completedModules}/6</div>
              <p className="text-sm text-muted-foreground">Modules Completed</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{completedLessons}/{totalLessons}</div>
              <p className="text-sm text-muted-foreground">Lessons Completed</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {modules.reduce((acc, m) => acc + m.lessons.filter(l => l.type === "video").length, 0)}
              </div>
              <p className="text-sm text-muted-foreground">Video Lessons</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Course Module */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Course Curriculum
          </CardTitle>
          <CardDescription>
            Click on any module to view lessons and track your progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {modules.map((module) => {
              const progress = getModuleProgress(module)
              const isModuleComplete = progress.completed === progress.total

              return (
                <AccordionItem key={module.id} value={module.id} className="border-b">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          isModuleComplete
                            ? "bg-green-500/10 text-green-500"
                            : "bg-primary/10 text-primary"
                        }`}>
                          {isModuleComplete ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <span className="font-bold">{module.number}</span>
                          )}
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-base">
                            Module {module.number}: {module.title}
                          </div>
                          <div className="text-sm text-muted-foreground font-normal">
                            {module.description}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {progress.completed}/{progress.total} lessons
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Math.round(progress.percentage)}% complete
                          </div>
                        </div>
                        <Progress value={progress.percentage} className="w-20 h-2" />
                      </div>
                    </div>
                  </AccordionTrigger> 
                  <AccordionContent>
                    <div className="space-y-4 pt-4 pl-14">
                      {module.lessons.map((lesson) => (
                        <div key={lesson.id} className="space-y-3">
                          <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent-hover transition-colors duration-200">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="flex-shrink-0">
                                {lesson.completed ? (
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                  <Circle className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-1">
                                {lesson.type === "video" ? (
                                  <PlayCircle className="h-4 w-4 text-primary" />
                                ) : (
                                  <FileText className="h-4 w-4 text-red-500" />
                                )}
                                <span className={`font-medium ${
                                  lesson.completed ? "text-muted-foreground line-through" : "text-foreground"
                                }`}>
                                  {lesson.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {lesson.type === "video" ? (
                                  <>
                                    <Clock className="h-3 w-3" />
                                    <span>{lesson.duration}</span>
                                  </>
                                ) : (
                                  <span>{lesson.size}</span>
                                )}
                              </div>
                            </div>
                            {lesson.type === "pdf" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-4"
                                onClick={() => {
                                  if (lesson.url) {
                                    window.open(lesson.url, '_blank')
                                    if (!lesson.completed) {
                                      markLessonComplete(module.id, lesson.id)
                                    }
                                  }
                                }}
                                disabled={!lesson.url}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            )}
                          </div>
                          {lesson.type === "video" && lesson.url && (
                            <div className="rounded-lg overflow-hidden border border-border bg-black">
                              <video
                                controls
                                className="w-full"
                                style={{ maxHeight: '500px' }}
                                preload="metadata"
                                onPlay={() => !lesson.completed && markLessonComplete(module.id, lesson.id)}
                              >
                                <source src={lesson.url} type="video/mp4" />
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
