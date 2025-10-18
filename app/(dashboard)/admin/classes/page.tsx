"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Save, X, PlayCircle, Shield, CheckCircle, Bell } from "lucide-react"
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

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<AcademyClass[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editData, setEditData] = useState<{ title: string; description: string; meeting_link: string; scheduled_at: string } | null>(null)
  const [banner, setBanner] = useState("")
  const [editingBanner, setEditingBanner] = useState(false)
  const [bannerText, setBannerText] = useState("")

  useEffect(() => {
    checkAdminStatus()
    fetchClasses()
    fetchBanner()
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

      setIsAdmin(userData?.role === "admin" || userData?.role === "superadmin")
    }
    setLoading(false)
  }

  async function fetchClasses() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("academy_classes")
      .select("*")
      .order("scheduled_at", { ascending: true })
      .limit(3)

    if (!error && data) {
      setClasses(data)
    }
  }

  async function fetchBanner() {
    const supabase = createClient()
    const { data } = await supabase
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "global_banner")
      .single()

    if (data?.setting_value) {
      setBanner(data.setting_value)
    }
  }

  function startEdit(index: number, classItem: AcademyClass) {
    setEditingIndex(index)
    setEditData({
      title: classItem.title,
      description: classItem.description || "",
      meeting_link: classItem.meeting_link,
      scheduled_at: new Date(classItem.scheduled_at).toISOString().slice(0, 16)
    })
  }

  async function saveEdit(classItem: AcademyClass) {
    if (!editData) return

    const supabase = createClient()
    const { error } = await supabase
      .from("academy_classes")
      .update({
        title: editData.title,
        description: editData.description,
        meeting_link: editData.meeting_link,
        scheduled_at: new Date(editData.scheduled_at).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", classItem.id)

    if (error) {
      alert("Error updating class: " + error.message)
      return
    }

    setEditingIndex(null)
    setEditData(null)
    fetchClasses()
  }

  function cancelEdit() {
    setEditingIndex(null)
    setEditData(null)
  }

  async function markComplete(classItem: AcademyClass) {
    if (!confirm("Mark this class as complete? It will be removed from the schedule.")) {
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from("academy_classes")
      .delete()
      .eq("id", classItem.id)

    if (error) {
      alert("Error marking class complete: " + error.message)
      return
    }

    fetchClasses()
  }

  async function createEmptyClass() {
    const supabase = createClient()

    // Create a placeholder class 30 days from now
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const { error } = await supabase
      .from("academy_classes")
      .insert({
        title: "New Class",
        description: "Description for new class",
        meeting_link: "https://zoom.us/j/example",
        scheduled_at: futureDate.toISOString()
      })

    if (error) {
      alert("Error creating class: " + error.message)
      return
    }

    fetchClasses()
  }

  async function saveBanner() {
    const supabase = createClient()
    const { error } = await supabase
      .from("site_settings")
      .update({
        setting_value: bannerText || null,
        updated_at: new Date().toISOString()
      })
      .eq("setting_key", "global_banner")

    if (error) {
      alert("Error saving banner: " + error.message)
      return
    }

    setBanner(bannerText)
    setEditingBanner(false)
  }

  function startBannerEdit() {
    setBannerText(banner)
    setEditingBanner(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Ensure we always have exactly 3 boxes
  const displayClasses = [...classes]
  while (displayClasses.length < 3) {
    displayClasses.push({
      id: `empty-${displayClasses.length}`,
      title: "",
      description: "",
      meeting_link: "",
      scheduled_at: "",
      created_at: "",
      updated_at: ""
    })
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
        </div>
        <p className="text-muted-foreground">Manage Trading Academy schedule and site settings</p>
      </div>

      {/* Banner Management */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Global Banner
              </CardTitle>
              <CardDescription>Set a banner message visible to all users at the top of the page</CardDescription>
            </div>
            {!editingBanner && (
              <Button onClick={startBannerEdit} variant="outline">
                <Pencil className="h-4 w-4 mr-2" />
                Edit Banner
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingBanner ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="banner">Banner Text (leave empty to hide banner)</Label>
                <Textarea
                  id="banner"
                  value={bannerText}
                  onChange={(e) => setBannerText(e.target.value)}
                  placeholder="Enter banner message (e.g., 'System maintenance scheduled for Dec 25th')"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveBanner}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Banner
                </Button>
                <Button variant="outline" onClick={() => setEditingBanner(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {banner ? (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm">{banner}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No banner set. Click Edit Banner to add one.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Academy Classes - 3 Boxes */}
      <Card>
        <CardHeader>
          <CardTitle>Trading Academy Schedule</CardTitle>
          <CardDescription>Next 3 upcoming classes - Edit inline or mark first class as complete</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayClasses.slice(0, 3).map((classItem, index) => {
              const isEditing = editingIndex === index
              const isEmpty = !classItem.title || classItem.id.startsWith('empty-')
              const isFirst = index === 0 && !isEmpty

              return (
                <div
                  key={classItem.id}
                  className={`p-4 rounded-lg border-2 ${
                    isFirst
                      ? "bg-green-500/20 border-green-500"
                      : "border-border"
                  }`}
                >
                  {isEditing && editData ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Title</Label>
                        <Input
                          value={editData.title}
                          onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={editData.description}
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          rows={2}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Meeting Link</Label>
                        <Input
                          value={editData.meeting_link}
                          onChange={(e) => setEditData({ ...editData, meeting_link: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Date & Time</Label>
                        <Input
                          type="datetime-local"
                          value={editData.scheduled_at}
                          onChange={(e) => setEditData({ ...editData, scheduled_at: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(classItem)}>
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : isEmpty ? (
                    <div className="text-center py-8">
                      <PlayCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-3">No class scheduled</p>
                      <Button size="sm" onClick={createEmptyClass}>
                        Add Class
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={isFirst ? "bg-green-500 text-white" : ""}>
                          {isFirst ? "Next Class" : "Upcoming"}
                        </Badge>
                        <PlayCircle className={`h-5 w-5 ${isFirst ? "text-green-600" : "text-muted-foreground"}`} />
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{classItem.title}</h3>
                      {classItem.description && (
                        <p className="text-sm text-muted-foreground mb-3">{classItem.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mb-3">
                        {new Date(classItem.scheduled_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "America/New_York"
                        })} EST
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => startEdit(index, classItem)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        {isFirst && (
                          <Button
                            size="sm"
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => markComplete(classItem)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
