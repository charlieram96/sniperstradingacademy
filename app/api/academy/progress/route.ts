import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - Fetch user's academy progress
export async function GET() {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Fetch user's progress
    const { data: progress, error: progressError } = await supabase
      .from("academy_progress")
      .select("lesson_id, completed, completed_at")
      .eq("user_id", user.id)

    if (progressError) {
      console.error("Error fetching academy progress:", progressError)
      return NextResponse.json(
        { error: "Failed to fetch progress" },
        { status: 500 }
      )
    }

    return NextResponse.json({ progress: progress || [] })
  } catch (error) {
    console.error("Exception fetching academy progress:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST - Mark lesson as complete
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { lessonId } = body

    if (!lessonId) {
      return NextResponse.json(
        { error: "lessonId is required" },
        { status: 400 }
      )
    }

    // Upsert progress record (insert or update if exists)
    const { error: upsertError } = await supabase
      .from("academy_progress")
      .upsert({
        user_id: user.id,
        lesson_id: lessonId,
        completed: true,
        completed_at: new Date().toISOString()
      }, {
        onConflict: "user_id,lesson_id"
      })

    if (upsertError) {
      console.error("Error saving academy progress:", upsertError)
      return NextResponse.json(
        { error: "Failed to save progress" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Exception saving academy progress:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
