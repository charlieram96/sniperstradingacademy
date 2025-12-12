import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - List all modules
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch modules ordered by display_order
    const { data: modules, error } = await supabase
      .from("academy_modules")
      .select("*")
      .order("display_order", { ascending: true })

    if (error) {
      console.error("Error fetching modules:", error)
      return NextResponse.json({ error: "Failed to fetch modules" }, { status: 500 })
    }

    return NextResponse.json({ modules })
  } catch (error) {
    console.error("Modules API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create new module
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

    if (userData?.role !== "superadmin" && userData?.role !== "superadmin+") {
      return NextResponse.json({ error: "Access denied. Superadmin only." }, { status: 403 })
    }

    const body = await req.json()
    const { number, title, description, display_order, is_published } = body

    if (!number || !title || display_order === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: number, title, display_order" },
        { status: 400 }
      )
    }

    // Insert new module
    const { data: module, error: insertError } = await supabase
      .from("academy_modules")
      .insert({
        number,
        title,
        description: description || null,
        display_order,
        is_published: is_published || false
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating module:", insertError)
      return NextResponse.json({ error: "Failed to create module" }, { status: 500 })
    }

    return NextResponse.json({ module }, { status: 201 })
  } catch (error) {
    console.error("Module creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update existing module
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

    if (userData?.role !== "superadmin" && userData?.role !== "superadmin+") {
      return NextResponse.json({ error: "Access denied. Superadmin only." }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Module ID is required" }, { status: 400 })
    }

    // Update module
    const { data: module, error: updateError } = await supabase
      .from("academy_modules")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating module:", updateError)
      return NextResponse.json({ error: "Failed to update module" }, { status: 500 })
    }

    return NextResponse.json({ module })
  } catch (error) {
    console.error("Module update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete module
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

    if (userData?.role !== "superadmin" && userData?.role !== "superadmin+") {
      return NextResponse.json({ error: "Access denied. Superadmin only." }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Module ID is required" }, { status: 400 })
    }

    // Delete module (cascade will delete associated lessons)
    const { error: deleteError } = await supabase
      .from("academy_modules")
      .delete()
      .eq("id", id)

    if (deleteError) {
      console.error("Error deleting module:", deleteError)
      return NextResponse.json({ error: "Failed to delete module" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Module deletion error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
