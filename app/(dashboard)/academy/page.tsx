"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { 
  PlayCircle, 
  FileText, 
  Calendar, 
  Clock, 
  Video,
  BookOpen,
  Search,
  Download,
  Users,
  ExternalLink
} from "lucide-react"

interface ClassSchedule {
  id: string
  title: string
  instructor: string
  date: string
  time: string
  topic: string
  level: "Beginner" | "Intermediate" | "Advanced"
  zoomLink?: string
}

interface Resource {
  id: string
  title: string
  type: "video" | "pdf" | "article"
  category: string
  duration?: string
  size?: string
  url: string
}

export default function AcademyPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Mock data - replace with actual API calls
  const upcomingClasses: ClassSchedule[] = [
    {
      id: "1",
      title: "Options Trading Fundamentals",
      instructor: "John Smith",
      date: "2024-02-01",
      time: "6:00 PM EST",
      topic: "Understanding calls and puts",
      level: "Beginner",
      zoomLink: "https://zoom.us/j/123456789"
    },
    {
      id: "2",
      title: "Advanced Chart Analysis",
      instructor: "Sarah Johnson",
      date: "2024-02-03",
      time: "7:00 PM EST",
      topic: "Technical indicators and patterns",
      level: "Advanced",
      zoomLink: "https://zoom.us/j/987654321"
    },
    {
      id: "3",
      title: "Risk Management Strategies",
      instructor: "Mike Davis",
      date: "2024-02-05",
      time: "6:30 PM EST",
      topic: "Position sizing and stop losses",
      level: "Intermediate",
      zoomLink: "https://zoom.us/j/456789123"
    }
  ]

  const resources: Resource[] = [
    {
      id: "1",
      title: "Introduction to Options Trading",
      type: "video",
      category: "Beginner",
      duration: "45 min",
      url: "#"
    },
    {
      id: "2",
      title: "Trading Plan Template",
      type: "pdf",
      category: "Tools",
      size: "2.3 MB",
      url: "#"
    },
    {
      id: "3",
      title: "Market Analysis Techniques",
      type: "video",
      category: "Intermediate",
      duration: "1h 20min",
      url: "#"
    },
    {
      id: "4",
      title: "Options Greeks Explained",
      type: "article",
      category: "Advanced",
      url: "#"
    },
    {
      id: "5",
      title: "Risk Management Handbook",
      type: "pdf",
      category: "Essential",
      size: "5.1 MB",
      url: "#"
    }
  ]

  const categories = ["all", "Beginner", "Intermediate", "Advanced", "Tools", "Essential"]

  const nextClass = upcomingClasses[0] // Get the next upcoming class

  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || resource.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Beginner":
        return "bg-primary/10 text-primary"
      case "Intermediate":
        return "bg-amber-500/10 text-amber-400"
      case "Advanced":
        return "bg-destructive/10 text-destructive"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Trading Academy</h1>
        <p className="text-muted-foreground mt-2">
          Master options trading with our comprehensive education resources
        </p>
      </div>

      {/* Next Class Highlight */}
      {nextClass && (
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-foreground">Next Class</CardTitle>
              </div>
              <Badge className={getLevelColor(nextClass.level)}>
                {nextClass.level}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {nextClass.title}
                </h3>
                <p className="text-muted-foreground mb-1">Topic: {nextClass.topic}</p>
                <p className="text-muted-foreground mb-1">Instructor: {nextClass.instructor}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(nextClass.date).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {nextClass.time}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end">
                {nextClass.zoomLink && (
                  <Button>
                    <Video className="h-4 w-4 mr-2" />
                    Join Class
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="resources" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="schedule">Class Schedule</TabsTrigger>
          <TabsTrigger value="progress">My Progress</TabsTrigger>
        </TabsList>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          {/* Resources Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResources.map(resource => (
              <Card key={resource.id} className="hover:shadow-md transition-all duration-200 hover:border-primary/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {resource.type === "video" && <PlayCircle className="h-5 w-5 text-primary" />}
                      {resource.type === "pdf" && <FileText className="h-5 w-5 text-destructive" />}
                      {resource.type === "article" && <BookOpen className="h-5 w-5 text-primary" />}
                      <Badge variant="outline">{resource.category}</Badge>
                    </div>
                  </div>
                  <CardTitle className="text-lg mt-2">{resource.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {resource.duration || resource.size || "Article"}
                    </span>
                    <Button size="sm" variant="outline">
                      {resource.type === "pdf" ? (
                        <>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4 mr-1" />
                          {resource.type === "video" ? "Watch" : "Read"}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Class Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Class Schedule</CardTitle>
              <CardDescription>
                Live trading classes with expert instructors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingClasses.map(classItem => (
                  <div key={classItem.id} className="border border-border rounded-lg p-4 hover:bg-accent transition-colors duration-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{classItem.title}</h3>
                          <Badge className={getLevelColor(classItem.level)}>
                            {classItem.level}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mb-2">{classItem.topic}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {classItem.instructor}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(classItem.date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {classItem.time}
                          </span>
                        </div>
                      </div>
                      {classItem.zoomLink && (
                        <Button variant="outline" size="sm">
                          <Video className="h-4 w-4 mr-2" />
                          Join
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Learning Progress</CardTitle>
              <CardDescription>
                Track your course completion and achievements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Beginner Course</span>
                    <span className="text-sm text-muted-foreground">75% Complete</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: "75%" }}></div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Intermediate Course</span>
                    <span className="text-sm text-muted-foreground">30% Complete</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: "30%" }}></div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Advanced Course</span>
                    <span className="text-sm text-muted-foreground">Not Started</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: "0%" }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}