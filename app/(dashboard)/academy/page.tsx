"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  PlayCircle,
  FileText,
  CheckCircle,
  Circle,
  Download,
  Clock,
  BookOpen
} from "lucide-react"

interface Lesson {
  id: string
  title: string
  type: "video" | "pdf"
  duration?: string
  size?: string
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
          title: "Welcome to the Academy",
          type: "video",
          duration: "8 min",
          completed: true
        },
        {
          id: "1-2",
          title: "What is Options Trading?",
          type: "video",
          duration: "15 min",
          completed: true
        },
        {
          id: "1-3",
          title: "Platform Overview",
          type: "video",
          duration: "12 min",
          completed: false
        },
        {
          id: "1-4",
          title: "Setting Your Goals",
          type: "video",
          duration: "10 min",
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

  const toggleLessonComplete = (moduleId: string, lessonId: string) => {
    setModules(prevModules =>
      prevModules.map(module => {
        if (module.id === moduleId) {
          return {
            ...module,
            lessons: module.lessons.map(lesson =>
              lesson.id === lessonId ? { ...lesson, completed: !lesson.completed } : lesson
            )
          }
        }
        return module
      })
    )
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
                    <div className="space-y-2 pt-4 pl-14">
                      {module.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent transition-colors duration-200"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              onClick={() => toggleLessonComplete(module.id, lesson.id)}
                              className="flex-shrink-0"
                            >
                              {lesson.completed ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground" />
                              )}
                            </button>
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
                          <Button size="sm" variant="outline" className="ml-4">
                            {lesson.type === "video" ? (
                              <>
                                <PlayCircle className="h-4 w-4 mr-1" />
                                Watch
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </>
                            )}
                          </Button>
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
