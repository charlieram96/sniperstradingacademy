"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  GraduationCap,
  Plus,
  Edit,
  Trash2,
  Video,
  FileText,
  Eye,
  EyeOff,
  Loader2,
  Info
} from "lucide-react"

interface Module {
  id: string
  number: number
  title: string
  description: string | null
  display_order: number
  is_published: boolean
  created_at: string
}

interface Lesson {
  id: string
  lesson_id: string
  module_id: string
  title: string
  type: "video" | "pdf"
  video_url: string | null
  pdf_url: string | null
  duration: string | null
  file_size: string | null
  is_published: boolean
  academy_modules?: {
    number: number
    title: string
  }
}

export default function AcademyManagerPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  // Dialog states
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false)
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)

  // Form states
  const [moduleForm, setModuleForm] = useState({
    number: "",
    title: "",
    description: "",
    display_order: "",
    is_published: false
  })

  const [lessonForm, setLessonForm] = useState({
    lesson_id: "",
    module_id: "",
    title: "",
    type: "video" as "video" | "pdf",
    video_url: "",
    pdf_url: "",
    duration: "",
    file_size: "",
    is_published: false
  })

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [fileSizeError, setFileSizeError] = useState<string | null>(null)

  // Fetch data
  const fetchModules = async () => {
    try {
      const response = await fetch("/api/academy/modules")
      if (response.ok) {
        const data = await response.json()
        setModules(data.modules || [])
      }
    } catch (error) {
      console.error("Error fetching modules:", error)
    }
  }

  const fetchLessons = async () => {
    try {
      const response = await fetch("/api/academy/lessons")
      if (response.ok) {
        const data = await response.json()
        setLessons(data.lessons || [])
      }
    } catch (error) {
      console.error("Error fetching lessons:", error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchModules(), fetchLessons()])
      setLoading(false)
    }
    loadData()
  }, [])

  // Module handlers
  const openModuleDialog = (module?: Module) => {
    if (module) {
      setEditingModule(module)
      setModuleForm({
        number: module.number.toString(),
        title: module.title,
        description: module.description || "",
        display_order: module.display_order.toString(),
        is_published: module.is_published
      })
    } else {
      setEditingModule(null)
      setModuleForm({
        number: "",
        title: "",
        description: "",
        display_order: (modules.length + 1).toString(),
        is_published: true
      })
    }
    setModuleDialogOpen(true)
  }

  const handleModuleSubmit = async () => {
    try {
      const body = {
        number: parseInt(moduleForm.number),
        title: moduleForm.title,
        description: moduleForm.description,
        display_order: parseInt(moduleForm.display_order),
        is_published: true
      }

      let response
      if (editingModule) {
        response = await fetch("/api/academy/modules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingModule.id, ...body })
        })
      } else {
        response = await fetch("/api/academy/modules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      }

      if (response.ok) {
        await fetchModules()
        setModuleDialogOpen(false)
      }
    } catch (error) {
      console.error("Error saving module:", error)
    }
  }

  const handleModuleDelete = async (moduleId: string) => {
    if (!confirm("Are you sure you want to delete this module? All associated lessons will also be deleted.")) {
      return
    }

    try {
      const response = await fetch(`/api/academy/modules?id=${moduleId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        await fetchModules()
        await fetchLessons()
      }
    } catch (error) {
      console.error("Error deleting module:", error)
    }
  }

  // Lesson handlers
  const openLessonDialog = (moduleId?: string, lesson?: Lesson) => {
    if (lesson) {
      setEditingLesson(lesson)
      setLessonForm({
        lesson_id: lesson.lesson_id,
        module_id: lesson.module_id,
        title: lesson.title,
        type: lesson.type,
        video_url: lesson.video_url || "",
        pdf_url: lesson.pdf_url || "",
        duration: lesson.duration || "",
        file_size: lesson.file_size || "",
        is_published: lesson.is_published
      })
    } else {
      setEditingLesson(null)
      setLessonForm({
        lesson_id: "",
        module_id: moduleId || "",
        title: "",
        type: "video",
        video_url: "",
        pdf_url: "",
        duration: "",
        file_size: "",
        is_published: true
      })
    }
    setUploadFile(null)
    setFileSizeError(null)
    setLessonDialogOpen(true)
  }

  const handleFileUpload = async () => {
    if (!uploadFile) return null

    setUploading(true)
    try {
      // Step 1: Get signed upload URL from API
      const urlResponse = await fetch("/api/academy/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: uploadFile.name,
          fileType: uploadFile.type,
          type: lessonForm.type
        })
      })

      if (!urlResponse.ok) {
        const errorData = await urlResponse.json()
        alert(errorData.error || "Failed to get upload URL")
        return null
      }

      const { uploadUrl, publicUrl } = await urlResponse.json()

      // Step 2: Upload file directly to Supabase Storage
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": uploadFile.type,
          "x-upsert": "false"
        },
        body: uploadFile
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error("Direct upload failed:", errorText)
        alert("File upload to storage failed")
        return null
      }

      // Step 3: Return the public URL (same format as old API)
      const fileSizeMB = (uploadFile.size / (1024 * 1024)).toFixed(2)
      return {
        url: publicUrl,
        fileSize: `${fileSizeMB} MB`
      }

    } catch (error) {
      console.error("Error uploading file:", error)
      alert("Error uploading file. Please try again.")
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleLessonSubmit = async () => {
    try {
      let fileData = null
      if (uploadFile) {
        fileData = await handleFileUpload()
        if (!fileData) {
          alert("File upload failed")
          return
        }
      }

      const body = {
        lesson_id: lessonForm.lesson_id,
        module_id: lessonForm.module_id,
        title: lessonForm.title,
        type: lessonForm.type,
        video_url: lessonForm.type === "video" ? (fileData?.url || lessonForm.video_url) : null,
        pdf_url: lessonForm.type === "pdf" ? (fileData?.url || lessonForm.pdf_url) : null,
        duration: lessonForm.duration || null,
        file_size: fileData?.fileSize || lessonForm.file_size || null,
        is_published: true
      }

      let response
      if (editingLesson) {
        response = await fetch("/api/academy/lessons", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingLesson.id, ...body })
        })
      } else {
        response = await fetch("/api/academy/lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      }

      if (response.ok) {
        await fetchLessons()
        setLessonDialogOpen(false)
      }
    } catch (error) {
      console.error("Error saving lesson:", error)
    }
  }

  const handleLessonDelete = async (lessonId: string) => {
    if (!confirm("Are you sure you want to delete this lesson?")) {
      return
    }

    try {
      const response = await fetch(`/api/academy/lessons?id=${lessonId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        await fetchLessons()
      }
    } catch (error) {
      console.error("Error deleting lesson:", error)
    }
  }

  const getLessonsForModule = (moduleId: string) => {
    return lessons.filter(l => l.module_id === moduleId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="h-8 w-8" />
            Academy Manager
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage academy modules, lessons, videos, and PDFs
          </p>
        </div>
        <Button onClick={() => openModuleDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Module
        </Button>
      </div>

      {/* Modules List */}
      <Accordion type="multiple" className="space-y-4">
        {modules.map((module) => (
          <AccordionItem key={module.id} value={module.id} className="border rounded-lg">
            <Card>
              <AccordionTrigger className="hover:no-underline px-6 py-4">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-muted-foreground">
                      {module.number}
                    </span>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold">{module.title}</h3>
                      {module.description && (
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={module.is_published ? "default" : "secondary"}>
                      {module.is_published ? (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          Published
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Draft
                        </>
                      )}
                    </Badge>
                    <Badge variant="outline">
                      {getLessonsForModule(module.id).length} lessons
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 space-y-4">
                  {/* Module Actions */}
                  <div className="flex gap-2 pb-4 border-b">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openModuleDialog(module)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Module
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openLessonDialog(module.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Lesson
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleModuleDelete(module.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Module
                    </Button>
                  </div>

                  {/* Lessons List */}
                  {getLessonsForModule(module.id).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No lessons yet. Click &quot;Add Lesson&quot; to create one.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {getLessonsForModule(module.id).map((lesson) => (
                        <Card key={lesson.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {lesson.type === "video" ? (
                                  <Video className="h-5 w-5 text-blue-500" />
                                ) : (
                                  <FileText className="h-5 w-5 text-red-500" />
                                )}
                                <div>
                                  <h4 className="font-medium">{lesson.title}</h4>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{lesson.lesson_id}</span>
                                    {lesson.duration && <span>• {lesson.duration}</span>}
                                    {lesson.file_size && <span>• {lesson.file_size}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={lesson.is_published ? "default" : "secondary"}>
                                  {lesson.is_published ? "Published" : "Draft"}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openLessonDialog(undefined, lesson)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleLessonDelete(lesson.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>

      {modules.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No modules yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating your first academy module
            </p>
            <Button onClick={() => openModuleDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Module
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingModule ? "Edit Module" : "Add New Module"}</DialogTitle>
            <DialogDescription>
              {editingModule ? "Update module information" : "Create a new academy module"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="module-number">Module Number</Label>
              <Input
                id="module-number"
                type="number"
                value={moduleForm.number}
                onChange={(e) => setModuleForm({ ...moduleForm, number: e.target.value })}
                placeholder="1"
              />
            </div>
            <div>
              <Label htmlFor="module-title">Title</Label>
              <Input
                id="module-title"
                value={moduleForm.title}
                onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                placeholder="Introduction to Trading"
              />
            </div>
            <div>
              <Label htmlFor="module-description">Description</Label>
              <Textarea
                id="module-description"
                value={moduleForm.description}
                onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                placeholder="Learn the basics..."
              />
            </div>
            <div>
              <Label htmlFor="module-order">Display Order</Label>
              <Input
                id="module-order"
                type="number"
                value={moduleForm.display_order}
                onChange={(e) => setModuleForm({ ...moduleForm, display_order: e.target.value })}
                placeholder="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleModuleSubmit}>
              {editingModule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLesson ? "Edit Lesson" : "Add New Lesson"}</DialogTitle>
            <DialogDescription>
              {editingLesson ? "Update lesson information and files" : "Create a new lesson with video or PDF"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="lesson-id">Lesson ID</Label>
              <Input
                id="lesson-id"
                value={lessonForm.lesson_id}
                onChange={(e) => setLessonForm({ ...lessonForm, lesson_id: e.target.value })}
                placeholder="1.1"
              />
            </div>
            <div>
              <Label htmlFor="lesson-module">Module</Label>
              <Select
                value={lessonForm.module_id}
                onValueChange={(value) => setLessonForm({ ...lessonForm, module_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      Module {module.number}: {module.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lesson-title">Title</Label>
              <Input
                id="lesson-title"
                value={lessonForm.title}
                onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                placeholder="Getting Started"
              />
            </div>
            <div>
              <Label htmlFor="lesson-type">Type</Label>
              <Select
                value={lessonForm.type}
                onValueChange={(value: "video" | "pdf") => setLessonForm({ ...lessonForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lesson-file">Upload File</Label>
              <Input
                id="lesson-file"
                type="file"
                accept={lessonForm.type === "video" ? "video/*" : "application/pdf"}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setUploadFile(file)

                  // Validate file size (1 GB limit)
                  const MAX_SIZE_MB = 1024
                  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

                  if (file && file.size > MAX_SIZE_BYTES) {
                    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
                    setFileSizeError(`File too large: ${fileSizeMB} MB / ${MAX_SIZE_MB} MB max`)
                  } else {
                    setFileSizeError(null)
                  }
                }}
              />
              {uploadFile && (
                <div className="mt-1 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Selected: {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                  {fileSizeError && (
                    <p className="text-sm text-red-500">{fileSizeError}</p>
                  )}
                </div>
              )}
              {uploadFile && !fileSizeError && (
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-1.5">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Large files may take several minutes to upload. Please don&apos;t close this window during upload.</span>
                  </p>
                </div>
              )}
            </div>
            {lessonForm.type === "video" && (
              <div>
                <Label htmlFor="lesson-duration">Duration</Label>
                <Input
                  id="lesson-duration"
                  value={lessonForm.duration}
                  onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value })}
                  placeholder="15:30"
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-3">
            {uploading && (
              <div className="w-full p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-200 text-center">
                  Please wait, this may take several minutes for large files...
                </p>
              </div>
            )}
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={() => setLessonDialogOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button onClick={handleLessonSubmit} disabled={uploading || !!fileSizeError}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading file to storage...
                  </>
                ) : (
                  editingLesson ? "Update" : "Create"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
