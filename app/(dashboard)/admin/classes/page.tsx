"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Save, X, PlayCircle, Shield, CheckCircle, Bell, Calendar as CalendarIcon, AlertTriangle, Trash2, Plus, AlertCircle, Info, Megaphone, Sparkles, Star, Zap, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"

interface AcademyClass {
  id: string
  title: string
  description: string | null
  meeting_link: string
  scheduled_at: string
  created_at: string
  updated_at: string
}

interface EditData {
  title: string
  description: string
  meeting_link: string
  scheduledDate: Date
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<AcademyClass[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editData, setEditData] = useState<EditData | null>(null)
  const [banner, setBanner] = useState("")
  const [editingBanner, setEditingBanner] = useState(false)
  const [bannerText, setBannerText] = useState("")
  const [bannerColor, setBannerColor] = useState("green")
  const [bannerIcon, setBannerIcon] = useState("AlertCircle")
  const [classToComplete, setClassToComplete] = useState<AcademyClass | null>(null)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [classToDelete, setClassToDelete] = useState<AcademyClass | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [openCalendarIndex, setOpenCalendarIndex] = useState<number | null>(null)

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

      setIsAdmin(userData?.role === "admin" || userData?.role === "superadmin" || userData?.role === "superadmin+")
    }
    setLoading(false)
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
  }

  async function fetchBanner() {
    const supabase = createClient()
    const { data } = await supabase
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "global_banner")
      .single()

    if (data?.setting_value) {
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(data.setting_value)
        setBanner(parsed.text || "")
        setBannerColor(parsed.color || "green")
        setBannerIcon(parsed.icon || "AlertCircle")
      } catch {
        // Plain text - use defaults
        setBanner(data.setting_value)
        setBannerColor("green")
        setBannerIcon("AlertCircle")
      }
    }
  }

  function startEdit(index: number, classItem: AcademyClass) {
    setEditingIndex(index)
    const scheduledDate = new Date(classItem.scheduled_at)
    setEditData({
      title: classItem.title,
      description: classItem.description || "",
      meeting_link: classItem.meeting_link,
      scheduledDate: scheduledDate
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
        scheduled_at: editData.scheduledDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", classItem.id)

    if (error) {
      alert("Error updating class: " + error.message)
      return
    }

    setEditingIndex(null)
    setEditData(null)
    setOpenCalendarIndex(null)
    fetchClasses()
  }

  function cancelEdit() {
    setEditingIndex(null)
    setEditData(null)
    setOpenCalendarIndex(null)
  }

  function openCompleteDialog(classItem: AcademyClass) {
    setClassToComplete(classItem)
    setShowCompleteDialog(true)
  }

  async function confirmMarkComplete() {
    if (!classToComplete) return

    const supabase = createClient()
    const { error } = await supabase
      .from("academy_classes")
      .delete()
      .eq("id", classToComplete.id)

    if (error) {
      alert("Error marking class complete: " + error.message)
      return
    }

    setShowCompleteDialog(false)
    setClassToComplete(null)
    await fetchClasses()
  }

  function cancelComplete() {
    setShowCompleteDialog(false)
    setClassToComplete(null)
  }

  function openDeleteDialog(classItem: AcademyClass) {
    setClassToDelete(classItem)
    setShowDeleteDialog(true)
  }

  async function confirmDeleteClass() {
    if (!classToDelete) return

    const supabase = createClient()
    const { error } = await supabase
      .from("academy_classes")
      .delete()
      .eq("id", classToDelete.id)

    if (error) {
      alert("Error deleting class: " + error.message)
      return
    }

    setShowDeleteDialog(false)
    setClassToDelete(null)
    await fetchClasses()
  }

  function cancelDelete() {
    setShowDeleteDialog(false)
    setClassToDelete(null)
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

    // Create JSON config
    const bannerConfig = bannerText ? JSON.stringify({
      text: bannerText,
      color: bannerColor,
      icon: bannerIcon
    }) : null

    const { error } = await supabase
      .from("site_settings")
      .update({
        setting_value: bannerConfig,
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
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bannerColor">Banner Color</Label>
                  <Select value={bannerColor} onValueChange={setBannerColor}>
                    <SelectTrigger id="bannerColor" className="mt-2">
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-green-600"></div>
                          <span>Green</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="red">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-red-600"></div>
                          <span>Red</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="purple">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-gradient-to-r from-purple-600 to-purple-700"></div>
                          <span>Purple</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="gray">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-gray-700"></div>
                          <span>Gray</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="black">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-black border border-gray-600"></div>
                          <span>Black</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="bannerIcon">Banner Icon</Label>
                  <Select value={bannerIcon} onValueChange={setBannerIcon}>
                    <SelectTrigger id="bannerIcon" className="mt-2">
                      <SelectValue placeholder="Select icon" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AlertCircle">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Alert Circle</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Info">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          <span>Info</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Bell">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          <span>Bell</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="AlertTriangle">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Alert Triangle</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Megaphone">
                        <div className="flex items-center gap-2">
                          <Megaphone className="h-4 w-4" />
                          <span>Megaphone</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Sparkles">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          <span>Sparkles</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Star">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4" />
                          <span>Star</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Zap">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          <span>Zap</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Clock">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>Clock</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="CheckCircle">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>Check Circle</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Live Preview */}
              {bannerText && (
                <div>
                  <Label>Preview</Label>
                  <div className={`mt-2 p-3 rounded-lg border flex items-center justify-center gap-2 ${
                    bannerColor === "green" ? "bg-green-600 border-green-700" :
                    bannerColor === "red" ? "bg-red-600 border-red-700" :
                    bannerColor === "purple" ? "bg-gradient-to-r from-purple-600 to-purple-700 border-purple-800" :
                    bannerColor === "gray" ? "bg-gray-700 border-gray-800" :
                    "bg-black border-gray-900"
                  }`}>
                    {bannerIcon === "AlertCircle" && <AlertCircle className="h-4 w-4 text-white" />}
                    {bannerIcon === "Info" && <Info className="h-4 w-4 text-white" />}
                    {bannerIcon === "Bell" && <Bell className="h-4 w-4 text-white" />}
                    {bannerIcon === "AlertTriangle" && <AlertTriangle className="h-4 w-4 text-white" />}
                    {bannerIcon === "Megaphone" && <Megaphone className="h-4 w-4 text-white" />}
                    {bannerIcon === "Sparkles" && <Sparkles className="h-4 w-4 text-white" />}
                    {bannerIcon === "Star" && <Star className="h-4 w-4 text-white" />}
                    {bannerIcon === "Zap" && <Zap className="h-4 w-4 text-white" />}
                    {bannerIcon === "Clock" && <Clock className="h-4 w-4 text-white" />}
                    {bannerIcon === "CheckCircle" && <CheckCircle className="h-4 w-4 text-white" />}
                    <p className="text-sm text-white text-center">{bannerText}</p>
                  </div>
                </div>
              )}

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
                <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                  bannerColor === "green" ? "bg-green-600 border-green-700" :
                  bannerColor === "red" ? "bg-red-600 border-red-700" :
                  bannerColor === "purple" ? "bg-gradient-to-r from-purple-600 to-purple-700 border-purple-800" :
                  bannerColor === "gray" ? "bg-gray-700 border-gray-800" :
                  "bg-black border-gray-900"
                }`}>
                  {bannerIcon === "AlertCircle" && <AlertCircle className="h-4 w-4 text-white" />}
                  {bannerIcon === "Info" && <Info className="h-4 w-4 text-white" />}
                  {bannerIcon === "Bell" && <Bell className="h-4 w-4 text-white" />}
                  {bannerIcon === "AlertTriangle" && <AlertTriangle className="h-4 w-4 text-white" />}
                  {bannerIcon === "Megaphone" && <Megaphone className="h-4 w-4 text-white" />}
                  {bannerIcon === "Sparkles" && <Sparkles className="h-4 w-4 text-white" />}
                  {bannerIcon === "Star" && <Star className="h-4 w-4 text-white" />}
                  {bannerIcon === "Zap" && <Zap className="h-4 w-4 text-white" />}
                  {bannerIcon === "Clock" && <Clock className="h-4 w-4 text-white" />}
                  {bannerIcon === "CheckCircle" && <CheckCircle className="h-4 w-4 text-white" />}
                  <p className="text-sm text-white">{banner}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No banner set. Click Edit Banner to add one.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Academy Classes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Trading Academy Schedule</CardTitle>
              <CardDescription>Upcoming classes - Edit inline or mark first class as complete</CardDescription>
            </div>
            <Button onClick={createEmptyClass} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Class
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <PlayCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground mb-4">No classes scheduled yet</p>
              <Button onClick={createEmptyClass} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Class
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((classItem, index) => {
                const isEditing = editingIndex === index
                const isFirst = index === 0

                return (
                  <div
                    key={classItem.id}
                    className={`p-5 rounded-lg border-2 min-h-[320px] flex flex-col ${
                      isFirst
                        ? "bg-green-500/10 border-green-500 shadow-sm shadow-green-500/20"
                        : "border-border bg-card"
                    }`}
                  >
                  {isEditing && editData ? (
                    <div className="space-y-4 flex-1 flex flex-col">
                      <div>
                        <Label className="text-xs font-semibold text-foreground">Title</Label>
                        <Input
                          value={editData.title}
                          onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                          className="mt-1.5"
                          placeholder="Class title"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-foreground">Description</Label>
                        <Textarea
                          value={editData.description}
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          rows={2}
                          className="mt-1.5"
                          placeholder="Brief description"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-foreground">Meeting Link</Label>
                        <Input
                          value={editData.meeting_link}
                          onChange={(e) => setEditData({ ...editData, meeting_link: e.target.value })}
                          className="mt-1.5"
                          placeholder="https://zoom.us/j/..."
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-2">
                          <CalendarIcon className="h-3 w-3" />
                          Scheduled Date & Time (EST)
                        </Label>
                        <Popover open={openCalendarIndex === index} onOpenChange={(open) => setOpenCalendarIndex(open ? index : null)}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(editData.scheduledDate, "PPP 'at' p")} EST
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={editData.scheduledDate}
                              onSelect={(date) => {
                                if (date) {
                                  const newDate = new Date(date)
                                  newDate.setHours(editData.scheduledDate.getHours())
                                  newDate.setMinutes(editData.scheduledDate.getMinutes())
                                  setEditData({ ...editData, scheduledDate: newDate })
                                }
                              }}
                              initialFocus
                            />
                            <div className="p-3 border-t">
                              <Label className="text-xs font-semibold mb-2 block">Time (EST)</Label>
                              <div className="flex gap-2">
                                <Select
                                  value={editData.scheduledDate.getHours().toString()}
                                  onValueChange={(value) => {
                                    const newDate = new Date(editData.scheduledDate)
                                    newDate.setHours(parseInt(value))
                                    setEditData({ ...editData, scheduledDate: newDate })
                                  }}
                                >
                                  <SelectTrigger className="w-[70px]">
                                    <SelectValue placeholder="Hour" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 24 }, (_, i) => (
                                      <SelectItem key={i} value={i.toString()}>
                                        {i.toString().padStart(2, '0')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="flex items-center">:</span>
                                <Select
                                  value={editData.scheduledDate.getMinutes().toString()}
                                  onValueChange={(value) => {
                                    const newDate = new Date(editData.scheduledDate)
                                    newDate.setMinutes(parseInt(value))
                                    setEditData({ ...editData, scheduledDate: newDate })
                                  }}
                                >
                                  <SelectTrigger className="w-[70px]">
                                    <SelectValue placeholder="Min" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 60 }, (_, i) => (
                                      <SelectItem key={i} value={i.toString()}>
                                        {i.toString().padStart(2, '0')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="mt-auto pt-2">
                        <div className="flex flex-col gap-2">
                          <Button size="sm" onClick={() => saveEdit(classItem)} className="w-full">
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                            Save Changes
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} className="w-full">
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={isFirst ? "bg-green-500 text-white" : "bg-muted"}>
                          {isFirst ? "Next Class" : "Upcoming"}
                        </Badge>
                        <PlayCircle className={`h-5 w-5 ${isFirst ? "text-green-600" : "text-muted-foreground"}`} />
                      </div>
                      <h3 className="font-semibold text-lg mb-2 text-foreground">{classItem.title}</h3>
                      {classItem.description && (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{classItem.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        <span>
                          {new Date(classItem.scheduled_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: "America/New_York"
                          })} EST
                        </span>
                      </div>
                      <div className="mt-auto">
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => startEdit(index, classItem)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Edit Class
                          </Button>
                          {isFirst && (
                            <Button
                              size="sm"
                              className="w-full bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => openCompleteDialog(classItem)}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                              Mark Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full"
                            onClick={() => openDeleteDialog(classItem)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Delete Class
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Mark Complete
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this class as complete? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {classToComplete && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="font-semibold mb-1">{classToComplete.title}</div>
              {classToComplete.description && (
                <div className="text-sm text-muted-foreground mb-2">{classToComplete.description}</div>
              )}
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {new Date(classToComplete.scheduled_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/New_York"
                })} EST
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelComplete}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={confirmMarkComplete}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirm Delete Class
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this class? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {classToDelete && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="font-semibold mb-1">{classToDelete.title}</div>
              {classToDelete.description && (
                <div className="text-sm text-muted-foreground mb-2">{classToDelete.description}</div>
              )}
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {new Date(classToDelete.scheduled_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/New_York"
                })} EST
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteClass}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
