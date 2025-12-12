import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Generate a signed upload URL for direct client uploads to Supabase Storage
 * This bypasses Vercel's 4.5 MB body size limit
 */
export async function POST(req: NextRequest) {
  try {
    // Use regular client for authentication check
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

    // Use service role client for storage operations (bypasses RLS)
    const serviceSupabase = createServiceRoleClient()

    const { fileName, fileType, type } = await req.json()

    if (!fileName || !fileType || !type) {
      return NextResponse.json(
        { error: "fileName, fileType, and type are required" },
        { status: 400 }
      )
    }

    if (!["video", "pdf"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be 'video' or 'pdf'" },
        { status: 400 }
      )
    }

    // Validate file type
    if (type === "video" && !fileType.startsWith("video/")) {
      return NextResponse.json({ error: "File must be a video" }, { status: 400 })
    }

    if (type === "pdf" && fileType !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
    const uniqueFileName = `${timestamp}_${sanitizedFileName}`

    // Select bucket
    const bucket = type === "video" ? "academy-videos" : "academy-pdfs"

    // Create signed upload URL (valid for 5 minutes)
    const { data, error } = await serviceSupabase
      .storage
      .from(bucket)
      .createSignedUploadUrl(uniqueFileName)

    if (error) {
      console.error("Error creating signed URL:", error)
      return NextResponse.json(
        { error: "Failed to create upload URL" },
        { status: 500 }
      )
    }

    // Get the public URL for the file (will be available after upload)
    const { data: { publicUrl } } = serviceSupabase
      .storage
      .from(bucket)
      .getPublicUrl(uniqueFileName)

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      publicUrl,
      fileName: uniqueFileName
    })

  } catch (error) {
    console.error("Error in upload-url route:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
