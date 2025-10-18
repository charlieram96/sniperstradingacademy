"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Trash2, Calendar, ExternalLink, Shield, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface AcademyClass {
  id: string
  title: string
  description: string | null
  meeting_link: string
  scheduled_at: string
  created_at: string
  updated_at: string
}

interface FormData {
  title: string
  description: string
  meeting_link: string
  scheduled_at: string
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<AcademyClass[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingClass, setEditingClass] = useState<AcademyClass | null>(null)
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    meeting_link: "",
    scheduled_at: ""
  })

  useEffect(() => {
    checkAdminStatus()
    fetchClasses()
  }, [])

  async function checkAdminStatus() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      setIsAdmin(userData?.role === "admin")
    }
  }

  async function fetchClasses() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("academy_classes")
      .select("*")
      .order("scheduled_at", { ascending: true })

    if (!error && data) {
      setClasses(data)
    }
    setLoading(false)
  }

  function openAddForm() {
    setEditingClass(null)
    setFormData({
      title: "",
      description: "",
      meeting_link: "",
      scheduled_at: ""
    })
    setShowForm(true)
  }

  function openEditForm(classItem: AcademyClass) {
    setEditingClass(classItem)
    setFormData({
      title: classItem.title,
      description: classItem.description || "",
      meeting_link: classItem.meeting_link,
      scheduled_at: new Date(classItem.scheduled_at).toISOString().slice(0, 16)
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()

    if (editingClass) {
      // Update existing class
      const { error } = await supabase
        .from("academy_classes")
        .update({
          title: formData.title,
          description: formData.description,
          meeting_link: formData.meeting_link,
          scheduled_at: new Date(formData.scheduled_at).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", editingClass.id)

      if (error) {
        alert("Error updating class: " + error.message)
        return
      }
    } else {
      // Create new class
      const { error } = await supabase
        .from("academy_classes")
        .insert({
          title: formData.title,
          description: formData.description,
          meeting_link: formData.meeting_link,
          scheduled_at: new Date(formData.scheduled_at).toISOString()
        })

      if (error) {
        alert("Error creating class: " + error.message)
        return
      }
    }

    setShowForm(false)
    fetchClasses()
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this class?")) {
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from("academy_classes")
      .delete()
      .eq("id", id)

    if (error) {
      alert("Error deleting class: " + error.message)
      return
    }

    fetchClasses()
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to access this page.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Admin Panel - Academy Classes</h1>
        </div>
        <p className="text-muted-foreground">Manage Trading Academy class schedule</p>
      </div>

      <div className="mb-6">
        <Button onClick={openAddForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add New Class
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingClass ? "Edit Class" : "Add New Class"}</CardTitle>
            <CardDescription>
              {editingClass ? "Update class details" : "Create a new Trading Academy class"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Class Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g., Options Fundamentals"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of what will be covered"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="meeting_link">Meeting Link (Zoom/Google Meet)</Label>
                <Input
                  id="meeting_link"
                  type="url"
                  value={formData.meeting_link}
                  onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                  required
                  placeholder="https://zoom.us/j/..."
                />
              </div>

              <div>
                <Label htmlFor="scheduled_at">Scheduled Date & Time (EST)</Label>
                <Input
                  id="scheduled_at"
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingClass ? "Update Class" : "Create Class"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Academy Classes ({classes.length})</CardTitle>
          <CardDescription>All scheduled Trading Academy classes</CardDescription>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No classes scheduled yet</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Click the Add New Class button to create your first class
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {classes.map((classItem) => {
                const scheduledDate = new Date(classItem.scheduled_at)
                const isPast = scheduledDate < new Date()

                return (
                  <div
                    key={classItem.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{classItem.title}</h3>
                        {isPast ? (
                          <Badge variant="outline" className="text-xs">Past</Badge>
                        ) : (
                          <Badge className="bg-green-500 text-white text-xs">Upcoming</Badge>
                        )}
                      </div>
                      {classItem.description && (
                        <p className="text-sm text-muted-foreground mb-2">{classItem.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {scheduledDate.toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: "America/New_York"
                          })} EST
                        </div>
                        <a
                          href={classItem.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Meeting Link
                        </a>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditForm(classItem)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(classItem.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
