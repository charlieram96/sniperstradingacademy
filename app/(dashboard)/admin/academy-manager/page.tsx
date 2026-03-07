"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  Video,
  FileText,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Info,
  X,
  Check,
  BookOpen,
  Link2,
  ChevronDown,
  Upload,
} from "lucide-react"
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/motion"

// ─── Types ───────────────────────────────────────────────────────────────────

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
  type: "video" | "pdf" | "link"
  video_url: string | null
  pdf_url: string | null
  link_url: string | null
  duration: string | null
  file_size: string | null
  is_published: boolean
  academy_modules?: {
    number: number
    title: string
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AcademyManagerPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  // Inline editing states
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editModuleForm, setEditModuleForm] = useState({ number: "", title: "", description: "", display_order: "" })
  const [addingModule, setAddingModule] = useState(false)
  const [newModuleForm, setNewModuleForm] = useState({ number: "", title: "", description: "", display_order: "" })

  // Lesson inline editing
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [editLessonForm, setEditLessonForm] = useState({
    lesson_id: "", title: "", type: "video" as "video" | "pdf" | "link",
    video_url: "", pdf_url: "", link_url: "", duration: "", file_size: ""
  })
  const [addingLessonModuleId, setAddingLessonModuleId] = useState<string | null>(null)
  const [newLessonForm, setNewLessonForm] = useState({
    lesson_id: "", module_id: "", title: "", type: "video" as "video" | "pdf" | "link",
    video_url: "", pdf_url: "", link_url: "", duration: "", file_size: ""
  })

  // File upload
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [fileSizeError, setFileSizeError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Expanded modules
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ type: "module" | "lesson"; id: string; title: string } | null>(null)

  // ─── Data fetching ─────────────────────────────────────────────────────────

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

  const getLessonsForModule = (moduleId: string) => lessons.filter(l => l.module_id === moduleId)

  // ─── Module handlers ───────────────────────────────────────────────────────

  const startEditModule = (mod: Module) => {
    setEditingModuleId(mod.id)
    setEditModuleForm({
      number: mod.number.toString(),
      title: mod.title,
      description: mod.description || "",
      display_order: mod.display_order.toString(),
    })
  }

  const cancelEditModule = () => {
    setEditingModuleId(null)
  }

  const saveEditModule = async () => {
    if (!editingModuleId) return
    try {
      const response = await fetch("/api/academy/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingModuleId,
          number: parseInt(editModuleForm.number),
          title: editModuleForm.title,
          description: editModuleForm.description,
          display_order: parseInt(editModuleForm.display_order),
          is_published: true,
        }),
      })
      if (response.ok) {
        await fetchModules()
        setEditingModuleId(null)
      }
    } catch (error) {
      console.error("Error saving module:", error)
    }
  }

  const startAddModule = () => {
    setAddingModule(true)
    setNewModuleForm({
      number: (modules.length + 1).toString(),
      title: "",
      description: "",
      display_order: (modules.length + 1).toString(),
    })
  }

  const cancelAddModule = () => {
    setAddingModule(false)
  }

  const saveNewModule = async () => {
    try {
      const response = await fetch("/api/academy/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: parseInt(newModuleForm.number),
          title: newModuleForm.title,
          description: newModuleForm.description,
          display_order: parseInt(newModuleForm.display_order),
          is_published: true,
        }),
      })
      if (response.ok) {
        await fetchModules()
        setAddingModule(false)
      }
    } catch (error) {
      console.error("Error creating module:", error)
    }
  }

  const confirmDeleteModule = async () => {
    if (!deleteDialog || deleteDialog.type !== "module") return
    try {
      const response = await fetch(`/api/academy/modules?id=${deleteDialog.id}`, { method: "DELETE" })
      if (response.ok) {
        await fetchModules()
        await fetchLessons()
      }
    } catch (error) {
      console.error("Error deleting module:", error)
    }
    setDeleteDialog(null)
  }

  // ─── Lesson handlers ──────────────────────────────────────────────────────

  const startEditLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id)
    setEditLessonForm({
      lesson_id: lesson.lesson_id,
      title: lesson.title,
      type: lesson.type,
      video_url: lesson.video_url || "",
      pdf_url: lesson.pdf_url || "",
      link_url: lesson.link_url || "",
      duration: lesson.duration || "",
      file_size: lesson.file_size || "",
    })
    setUploadFile(null)
    setFileSizeError(null)
  }

  const cancelEditLesson = () => {
    setEditingLessonId(null)
    setUploadFile(null)
    setFileSizeError(null)
  }

  const handleFileUpload = async (type: "video" | "pdf") => {
    if (!uploadFile) return null
    setUploading(true)
    try {
      const urlResponse = await fetch("/api/academy/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: uploadFile.name, fileType: uploadFile.type, type }),
      })
      if (!urlResponse.ok) {
        const errorData = await urlResponse.json()
        alert(errorData.error || "Failed to get upload URL")
        return null
      }
      const { uploadUrl, publicUrl } = await urlResponse.json()
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": uploadFile.type, "x-upsert": "false" },
        body: uploadFile,
      })
      if (!uploadResponse.ok) {
        alert("File upload to storage failed")
        return null
      }
      const fileSizeMB = (uploadFile.size / (1024 * 1024)).toFixed(2)
      return { url: publicUrl, fileSize: `${fileSizeMB} MB` }
    } catch (error) {
      console.error("Error uploading file:", error)
      alert("Error uploading file. Please try again.")
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setUploadFile(file)
    const MAX_SIZE_BYTES = 1024 * 1024 * 1024
    if (file && file.size > MAX_SIZE_BYTES) {
      setFileSizeError(`File too large: ${(file.size / (1024 * 1024)).toFixed(2)} MB / 1024 MB max`)
    } else {
      setFileSizeError(null)
    }
  }

  const saveEditLesson = async () => {
    if (!editingLessonId) return
    try {
      let fileData = null
      if (uploadFile && (editLessonForm.type === "video" || editLessonForm.type === "pdf")) {
        fileData = await handleFileUpload(editLessonForm.type)
        if (!fileData) return
      }

      const body: Record<string, unknown> = {
        id: editingLessonId,
        lesson_id: editLessonForm.lesson_id,
        title: editLessonForm.title,
        type: editLessonForm.type,
        duration: editLessonForm.duration || null,
        file_size: fileData?.fileSize || editLessonForm.file_size || null,
        is_published: true,
      }

      if (editLessonForm.type === "video") {
        body.video_url = fileData?.url || editLessonForm.video_url || null
        body.pdf_url = null
        body.link_url = null
      } else if (editLessonForm.type === "pdf") {
        body.pdf_url = fileData?.url || editLessonForm.pdf_url || null
        body.video_url = null
        body.link_url = null
      } else {
        body.link_url = editLessonForm.link_url || null
        body.video_url = null
        body.pdf_url = null
      }

      const response = await fetch("/api/academy/lessons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        await fetchLessons()
        setEditingLessonId(null)
        setUploadFile(null)
        setFileSizeError(null)
      }
    } catch (error) {
      console.error("Error saving lesson:", error)
    }
  }

  const startAddLesson = (moduleId: string) => {
    setAddingLessonModuleId(moduleId)
    setNewLessonForm({
      lesson_id: "", module_id: moduleId, title: "", type: "video",
      video_url: "", pdf_url: "", link_url: "", duration: "", file_size: "",
    })
    setUploadFile(null)
    setFileSizeError(null)
  }

  const cancelAddLesson = () => {
    setAddingLessonModuleId(null)
    setUploadFile(null)
    setFileSizeError(null)
  }

  const saveNewLesson = async () => {
    try {
      let fileData = null
      if (uploadFile && (newLessonForm.type === "video" || newLessonForm.type === "pdf")) {
        fileData = await handleFileUpload(newLessonForm.type)
        if (!fileData) return
      }

      const body: Record<string, unknown> = {
        lesson_id: newLessonForm.lesson_id,
        module_id: newLessonForm.module_id,
        title: newLessonForm.title,
        type: newLessonForm.type,
        duration: newLessonForm.duration || null,
        file_size: fileData?.fileSize || newLessonForm.file_size || null,
        is_published: true,
      }

      if (newLessonForm.type === "video") {
        body.video_url = fileData?.url || newLessonForm.video_url || null
        body.pdf_url = null
        body.link_url = null
      } else if (newLessonForm.type === "pdf") {
        body.pdf_url = fileData?.url || newLessonForm.pdf_url || null
        body.video_url = null
        body.link_url = null
      } else {
        body.link_url = newLessonForm.link_url || null
        body.video_url = null
        body.pdf_url = null
      }

      const response = await fetch("/api/academy/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        await fetchLessons()
        setAddingLessonModuleId(null)
        setUploadFile(null)
        setFileSizeError(null)
      }
    } catch (error) {
      console.error("Error creating lesson:", error)
    }
  }

  const confirmDeleteLesson = async () => {
    if (!deleteDialog || deleteDialog.type !== "lesson") return
    try {
      const response = await fetch(`/api/academy/lessons?id=${deleteDialog.id}`, { method: "DELETE" })
      if (response.ok) await fetchLessons()
    } catch (error) {
      console.error("Error deleting lesson:", error)
    }
    setDeleteDialog(null)
  }

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const videoCount = lessons.filter(l => l.type === "video").length
  const pdfCount = lessons.filter(l => l.type === "pdf").length
  const linkCount = lessons.filter(l => l.type === "link").length

  // ─── Render helpers ────────────────────────────────────────────────────────

  const typeIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-4 w-4" />
      case "pdf": return <FileText className="h-4 w-4" />
      case "link": return <Link2 className="h-4 w-4" />
      default: return null
    }
  }

  const typeColor = (type: string) => {
    switch (type) {
      case "video": return "bg-blue-500/15 text-blue-400"
      case "pdf": return "bg-red-500/15 text-red-400"
      case "link": return "bg-emerald-500/15 text-emerald-400"
      default: return "bg-white/10 text-foreground"
    }
  }

  const fileUploadSection = (
    currentType: "video" | "pdf" | "link",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  ) => {
    if (currentType === "link") return null
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Upload File</label>
        <input
          ref={fileInputRef}
          type="file"
          accept={currentType === "video" ? "video/*" : "application/pdf"}
          onChange={(e) => { onChange(e); handleFileChange(e) }}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gold-400/10 file:text-gold-400 hover:file:bg-gold-400/20 file:cursor-pointer file:transition-colors"
        />
        {uploadFile && (
          <p className="text-xs text-muted-foreground">
            {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        )}
        {fileSizeError && <p className="text-xs text-red-400">{fileSizeError}</p>}
        {uploadFile && !fileSizeError && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Info className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-300">Large files may take several minutes to upload.</p>
          </div>
        )}
      </div>
    )
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
          <p className="text-sm text-muted-foreground">Loading academy data...</p>
        </div>
      </div>
    )
  }

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-gold-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Academy Manager</h1>
            <p className="text-sm text-muted-foreground">Manage modules, lessons, and content</p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          { label: "Modules", value: modules.length, icon: BookOpen, accent: "text-gold-400 bg-gold-400/10" },
          { label: "Videos", value: videoCount, icon: Video, accent: "text-blue-400 bg-blue-500/10" },
          { label: "PDFs", value: pdfCount, icon: FileText, accent: "text-red-400 bg-red-500/10" },
          { label: "Links", value: linkCount, icon: ExternalLink, accent: "text-emerald-400 bg-emerald-500/10" },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={staggerItem}
            className="bg-surface-1 border border-border-subtle rounded-xl p-4 flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.accent}`}>
              <stat.icon className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Module Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {modules.map((mod) => {
          const moduleLessons = getLessonsForModule(mod.id)
          const isEditing = editingModuleId === mod.id
          const isExpanded = expandedModules.has(mod.id)

          return (
            <motion.div
              key={mod.id}
              variants={staggerItem}
              className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden"
            >
              {/* Module Header */}
              {isEditing ? (
                <div className="p-5 space-y-4 border-l-2 border-gold-400">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gold-400 uppercase tracking-wider">Editing Module</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={cancelEditModule} className="h-8 px-3 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" onClick={saveEditModule} className="h-8 px-3 bg-gold-400 hover:bg-gold-500 text-primary-foreground">
                        <Check className="h-3.5 w-3.5 mr-1" /> Save
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Module #</label>
                      <Input
                        type="number"
                        value={editModuleForm.number}
                        onChange={(e) => setEditModuleForm({ ...editModuleForm, number: e.target.value })}
                        className="mt-1 bg-surface-0 border-border"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Display Order</label>
                      <Input
                        type="number"
                        value={editModuleForm.display_order}
                        onChange={(e) => setEditModuleForm({ ...editModuleForm, display_order: e.target.value })}
                        className="mt-1 bg-surface-0 border-border"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</label>
                    <Input
                      value={editModuleForm.title}
                      onChange={(e) => setEditModuleForm({ ...editModuleForm, title: e.target.value })}
                      className="mt-1 bg-surface-0 border-border"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                    <Textarea
                      value={editModuleForm.description}
                      onChange={(e) => setEditModuleForm({ ...editModuleForm, description: e.target.value })}
                      className="mt-1 bg-surface-0 border-border resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => toggleModule(mod.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center text-gold-400 font-bold text-sm flex-shrink-0">
                      {mod.number}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{mod.title}</h3>
                      {mod.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{mod.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={mod.is_published ? "default" : "secondary"} className="text-xs">
                      {mod.is_published ? <><Eye className="h-3 w-3 mr-1" />Published</> : <><EyeOff className="h-3 w-3 mr-1" />Draft</>}
                    </Badge>
                    <Badge variant="outline" className="text-xs tabular-nums">
                      {moduleLessons.length} lesson{moduleLessons.length !== 1 ? "s" : ""}
                    </Badge>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => startEditModule(mod)}
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteDialog({ type: "module", id: mod.id, title: mod.title })}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>
              )}

              {/* Expanded Lessons */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border-subtle px-5 pb-5 pt-4 space-y-2">
                      {/* Lesson list */}
                      {moduleLessons.map((lesson) => {
                        const isEditingThis = editingLessonId === lesson.id

                        if (isEditingThis) {
                          return (
                            <div key={lesson.id} className="rounded-xl border border-gold-400/30 bg-surface-0 p-4 space-y-3 border-l-2 border-l-gold-400">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-gold-400 uppercase tracking-wider">Editing Lesson</p>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="ghost" onClick={cancelEditLesson} disabled={uploading} className="h-7 px-2 text-xs text-muted-foreground">
                                    <X className="h-3 w-3 mr-1" /> Cancel
                                  </Button>
                                  <Button size="sm" onClick={saveEditLesson} disabled={uploading || !!fileSizeError} className="h-7 px-2 text-xs bg-gold-400 hover:bg-gold-500 text-primary-foreground">
                                    {uploading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Uploading...</> : <><Check className="h-3 w-3 mr-1" />Save</>}
                                  </Button>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lesson ID</label>
                                  <Input value={editLessonForm.lesson_id} onChange={(e) => setEditLessonForm({ ...editLessonForm, lesson_id: e.target.value })} className="mt-1 h-8 text-sm bg-surface-1 border-border" placeholder="1.1" />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</label>
                                  <Input value={editLessonForm.title} onChange={(e) => setEditLessonForm({ ...editLessonForm, title: e.target.value })} className="mt-1 h-8 text-sm bg-surface-1 border-border" />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</label>
                                  <Select value={editLessonForm.type} onValueChange={(v: "video" | "pdf" | "link") => setEditLessonForm({ ...editLessonForm, type: v })}>
                                    <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="video">Video</SelectItem>
                                      <SelectItem value="pdf">PDF</SelectItem>
                                      <SelectItem value="link">Link</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              {editLessonForm.type === "link" ? (
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">URL</label>
                                  <Input value={editLessonForm.link_url} onChange={(e) => setEditLessonForm({ ...editLessonForm, link_url: e.target.value })} className="mt-1 h-8 text-sm bg-surface-1 border-border" placeholder="https://..." />
                                </div>
                              ) : (
                                <>
                                  {fileUploadSection(editLessonForm.type, handleFileChange)}
                                  {editLessonForm.type === "video" && (
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</label>
                                      <Input value={editLessonForm.duration} onChange={(e) => setEditLessonForm({ ...editLessonForm, duration: e.target.value })} className="mt-1 h-8 text-sm bg-surface-1 border-border" placeholder="15:30" />
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )
                        }

                        return (
                          <div
                            key={lesson.id}
                            className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-0 border border-border-subtle hover:border-border transition-colors"
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColor(lesson.type)}`}>
                              {typeIcon(lesson.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{lesson.title}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{lesson.lesson_id}</span>
                                {lesson.duration && <span>· {lesson.duration}</span>}
                                {lesson.file_size && <span>· {lesson.file_size}</span>}
                                {lesson.type === "link" && lesson.link_url && (
                                  <span className="truncate max-w-[200px]">· {lesson.link_url}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEditLesson(lesson)}
                                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteDialog({ type: "lesson", id: lesson.id, title: lesson.title })}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {moduleLessons.length === 0 && !addingLessonModuleId && (
                        <p className="text-sm text-muted-foreground text-center py-4">No lessons yet</p>
                      )}

                      {/* Add Lesson inline form */}
                      {addingLessonModuleId === mod.id ? (
                        <div className="rounded-xl border border-dashed border-gold-400/30 bg-surface-0 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-gold-400 uppercase tracking-wider">New Lesson</p>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="ghost" onClick={cancelAddLesson} disabled={uploading} className="h-7 px-2 text-xs text-muted-foreground">
                                <X className="h-3 w-3 mr-1" /> Cancel
                              </Button>
                              <Button size="sm" onClick={saveNewLesson} disabled={uploading || !!fileSizeError} className="h-7 px-2 text-xs bg-gold-400 hover:bg-gold-500 text-primary-foreground">
                                {uploading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Uploading...</> : <><Check className="h-3 w-3 mr-1" />Create</>}
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lesson ID</label>
                              <Input value={newLessonForm.lesson_id} onChange={(e) => setNewLessonForm({ ...newLessonForm, lesson_id: e.target.value })} className="mt-1 h-8 text-sm bg-surface-1 border-border" placeholder="1.1" />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</label>
                              <Input value={newLessonForm.title} onChange={(e) => setNewLessonForm({ ...newLessonForm, title: e.target.value })} className="mt-1 h-8 text-sm bg-surface-1 border-border" placeholder="Getting Started" />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</label>
                              <Select value={newLessonForm.type} onValueChange={(v: "video" | "pdf" | "link") => setNewLessonForm({ ...newLessonForm, type: v })}>
                                <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="video">Video</SelectItem>
                                  <SelectItem value="pdf">PDF</SelectItem>
                                  <SelectItem value="link">Link</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {newLessonForm.type === "link" ? (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">URL</label>
                              <Input value={newLessonForm.link_url} onChange={(e) => setNewLessonForm({ ...newLessonForm, link_url: e.target.value })} className="mt-1 h-8 text-sm bg-surface-1 border-border" placeholder="https://..." />
                            </div>
                          ) : (
                            <>
                              {fileUploadSection(newLessonForm.type, handleFileChange)}
                              {newLessonForm.type === "video" && (
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</label>
                                  <Input value={newLessonForm.duration} onChange={(e) => setNewLessonForm({ ...newLessonForm, duration: e.target.value })} className="mt-1 h-8 text-sm bg-surface-1 border-border" placeholder="15:30" />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => startAddLesson(mod.id)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border-subtle hover:border-gold-400/30 hover:bg-gold-400/5 text-muted-foreground hover:text-gold-400 transition-all text-sm"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Lesson
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}

        {/* Add Module Card */}
        {addingModule ? (
          <motion.div variants={staggerItem} className="bg-surface-1 border border-dashed border-gold-400/30 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gold-400 uppercase tracking-wider">New Module</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={cancelAddModule} className="h-8 px-3 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={saveNewModule} className="h-8 px-3 bg-gold-400 hover:bg-gold-500 text-primary-foreground">
                  <Check className="h-3.5 w-3.5 mr-1" /> Create
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Module #</label>
                <Input
                  type="number"
                  value={newModuleForm.number}
                  onChange={(e) => setNewModuleForm({ ...newModuleForm, number: e.target.value })}
                  className="mt-1 bg-surface-0 border-border"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Display Order</label>
                <Input
                  type="number"
                  value={newModuleForm.display_order}
                  onChange={(e) => setNewModuleForm({ ...newModuleForm, display_order: e.target.value })}
                  className="mt-1 bg-surface-0 border-border"
                  placeholder="1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</label>
              <Input
                value={newModuleForm.title}
                onChange={(e) => setNewModuleForm({ ...newModuleForm, title: e.target.value })}
                className="mt-1 bg-surface-0 border-border"
                placeholder="Introduction to Trading"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
              <Textarea
                value={newModuleForm.description}
                onChange={(e) => setNewModuleForm({ ...newModuleForm, description: e.target.value })}
                className="mt-1 bg-surface-0 border-border resize-none"
                rows={2}
                placeholder="Learn the basics..."
              />
            </div>
          </motion.div>
        ) : (
          <motion.button
            variants={staggerItem}
            onClick={startAddModule}
            className="w-full flex items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-border-subtle hover:border-gold-400/30 hover:bg-gold-400/5 text-muted-foreground hover:text-gold-400 transition-all"
          >
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">Add Module</span>
          </motion.button>
        )}

        {modules.length === 0 && !addingModule && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gold-400/10 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-8 w-8 text-gold-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No modules yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Get started by creating your first academy module</p>
            <Button onClick={startAddModule} className="bg-gold-400 hover:bg-gold-500 text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" /> Create First Module
            </Button>
          </div>
        )}
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deleteDialog?.type === "module" ? "Module" : "Lesson"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteDialog?.title}</span>?
              {deleteDialog?.type === "module" && " All associated lessons will also be deleted."}
              {" "}This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={deleteDialog?.type === "module" ? confirmDeleteModule : confirmDeleteLesson}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
