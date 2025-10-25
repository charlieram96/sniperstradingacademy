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

export default function AcademyPage() {
  const [academyClasses, setAcademyClasses] = useState<AcademyClass[]>([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [progressLoading, setProgressLoading] = useState(true)

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

  // Mock data - replace with actual API calls
  const [modules, setModules] = useState<Module[]>([
    {
      id: "module-1",
      number: 1,
      title: "Introduction",
      description: "Get started with options trading fundamentals",
      lessons: [
        {
          id: "1-1",
          title: "Welcome",
          type: "video",
          duration: "2:13",
          url: "https://faduoctunhntejvbhwqm.supabase.co/storage/v1/object/public/academy-videos/module-1/module-1-1.mp4",
          completed: false
        },
        {
          id: "1-2",
          title: "Snipers Trading Academy Philosophy",
          type: "video",
          duration: "2:41",
          url: "https://faduoctunhntejvbhwqm.supabase.co/storage/v1/object/public/academy-videos/module-1/module-1-2.mp4",
          completed: false
        }
      ]
    },
    {
      id: "module-2",
      number: 2,
      title: "Fundamentals",
      description: "Master the core concepts of options trading",
      lessons: [
        {
          id: "2-1",
          title: "Understanding Calls and Puts",
          type: "video",
          duration: "20 min",
          completed: false
        },
        {
          id: "2-2",
          title: "Options Pricing Basics",
          type: "video",
          duration: "18 min",
          completed: false
        },
        {
          id: "2-3",
          title: "The Greeks Explained",
          type: "video",
          duration: "25 min",
          completed: false
        },
        {
          id: "2-4",
          title: "Options Trading Glossary",
          type: "pdf",
          size: "1.2 MB",
          completed: false
        },
        {
          id: "2-5",
          title: "Market Basics Workbook",
          type: "pdf",
          size: "2.5 MB",
          completed: false
        }
      ]
    },
    {
      id: "module-3",
      number: 3,
      title: "Strategy",
      description: "Learn proven trading strategies and techniques",
      lessons: [
        {
          id: "3-1",
          title: "Covered Calls Strategy",
          type: "video",
          duration: "22 min",
          completed: false
        },
        {
          id: "3-2",
          title: "Protective Puts",
          type: "video",
          duration: "18 min",
          completed: false
        },
        {
          id: "3-3",
          title: "Spreads and Combinations",
          type: "video",
          duration: "30 min",
          completed: false
        },
        {
          id: "3-4",
          title: "Strategy Selection Framework",
          type: "pdf",
          size: "3.1 MB",
          completed: false
        },
        {
          id: "3-5",
          title: "Advanced Strategies Guide",
          type: "pdf",
          size: "4.2 MB",
          completed: false
        }
      ]
    },
    {
      id: "module-4",
      number: 4,
      title: "Tools",
      description: "Master the tools and platforms for successful trading",
      lessons: [
        {
          id: "4-1",
          title: "Trading Platform Setup",
          type: "video",
          duration: "16 min",
          completed: false
        },
        {
          id: "4-2",
          title: "Chart Analysis Tools",
          type: "video",
          duration: "24 min",
          completed: false
        },
        {
          id: "4-3",
          title: "Options Calculator Usage",
          type: "video",
          duration: "14 min",
          completed: false
        },
        {
          id: "4-4",
          title: "Trading Plan Template",
          type: "pdf",
          size: "850 KB",
          completed: false
        },
        {
          id: "4-5",
          title: "Risk Management Spreadsheet",
          type: "pdf",
          size: "1.8 MB",
          completed: false
        }
      ]
    },
    {
      id: "module-5",
      number: 5,
      title: "Tutorials",
      description: "Step-by-step guides for real trading scenarios",
      lessons: [
        {
          id: "5-1",
          title: "Placing Your First Trade",
          type: "video",
          duration: "20 min",
          completed: false
        },
        {
          id: "5-2",
          title: "Reading Market Data",
          type: "video",
          duration: "18 min",
          completed: false
        },
        {
          id: "5-3",
          title: "Managing Open Positions",
          type: "video",
          duration: "22 min",
          completed: false
        },
        {
          id: "5-4",
          title: "Closing and Rolling Trades",
          type: "video",
          duration: "16 min",
          completed: false
        }
      ]
    },
    {
      id: "module-6",
      number: 6,
      title: "Resources",
      description: "Additional materials and reference guides",
      lessons: [
        {
          id: "6-1",
          title: "Market Analysis Techniques",
          type: "video",
          duration: "28 min",
          completed: false
        },
        {
          id: "6-2",
          title: "Advanced Chart Patterns",
          type: "video",
          duration: "26 min",
          completed: false
        },
        {
          id: "6-3",
          title: "Risk Management Handbook",
          type: "pdf",
          size: "5.1 MB",
          completed: false
        },
        {
          id: "6-4",
          title: "Technical Indicators Guide",
          type: "pdf",
          size: "3.8 MB",
          completed: false
        },
        {
          id: "6-5",
          title: "Options Trading Cheat Sheet",
          type: "pdf",
          size: "1.5 MB",
          completed: false
        }
      ]
    }
  ])

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

      {/* Course Modules */}
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
