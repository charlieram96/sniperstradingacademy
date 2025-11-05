import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - List lessons (optionally filtered by module_id)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const moduleId = searchParams.get("module_id")

    let query = supabase
      .from("academy_lessons")
      .select("*, academy_modules(number, title)")
      .order("module_id", { ascending: true })
      .order("lesson_id", { ascending: true })

    // Filter by module if provided
    if (moduleId) {
      query = query.eq("module_id", moduleId)
    }

    const { data: lessons, error } = await query

    if (error) {
      console.error("Error fetching lessons:", error)
      return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 })
    }

    return NextResponse.json({ lessons })
  } catch (error) {
    console.error("Lessons API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create new lesson
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is superadmin
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (userData?.role !== "superadmin") {
      return NextResponse.json({ error: "Access denied. Superadmin only." }, { status: 403 })
    }

    const body = await req.json()
    const { lesson_id, module_id, title, type, video_url, pdf_url, duration, file_size, is_published } = body

    if (!lesson_id || !module_id || !title || !type) {
      return NextResponse.json(
        { error: "Missing required fields: lesson_id, module_id, title, type" },
        { status: 400 }
      )
    }

    if (!["video", "pdf"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be 'video' or 'pdf'" },
        { status: 400 }
      )
    }

    // Get the next display_order for this module
    const { data: existingLessons } = await supabase
      .from("academy_lessons")
      .select("display_order")
      .eq("module_id", module_id)
      .order("display_order", { ascending: false })
      .limit(1)

    const nextDisplayOrder = existingLessons && existingLessons.length > 0
      ? existingLessons[0].display_order + 1
      : 1

    // Insert new lesson
    const { data: lesson, error: insertError } = await supabase
      .from("academy_lessons")
      .insert({
        lesson_id,
        module_id,
        title,
        type,
        display_order: nextDisplayOrder,
        video_url: video_url || null,
        pdf_url: pdf_url || null,
        duration: duration || null,
        file_size: file_size || null,
        is_published: is_published || false
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating lesson:", insertError)
      return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 })
    }

    return NextResponse.json({ lesson }, { status: 201 })
  } catch (error) {
    console.error("Lesson creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update existing lesson
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is superadmin
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (userData?.role !== "superadmin") {
      return NextResponse.json({ error: "Access denied. Superadmin only." }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Lesson ID is required" }, { status: 400 })
    }

    // Update lesson
    const { data: lesson, error: updateError } = await supabase
      .from("academy_lessons")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating lesson:", updateError)
      return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 })
    }

    return NextResponse.json({ lesson })
  } catch (error) {
    console.error("Lesson update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete lesson
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is superadmin
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (userData?.role !== "superadmin") {
      return NextResponse.json({ error: "Access denied. Superadmin only." }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Lesson ID is required" }, { status: 400 })
    }

    // Delete lesson
    const { error: deleteError } = await supabase
      .from("academy_lessons")
      .delete()
      .eq("id", id)

    if (deleteError) {
      console.error("Error deleting lesson:", deleteError)
      return NextResponse.json({ error: "Failed to delete lesson" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Lesson deletion error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
