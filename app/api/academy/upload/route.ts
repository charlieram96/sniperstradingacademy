import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

    // Parse form data
    const formData = await req.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as string // "video" or "pdf"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!type || !["video", "pdf"].includes(type)) {
      return NextResponse.json({ error: "Invalid type. Must be 'video' or 'pdf'" }, { status: 400 })
    }

    // Validate file type
    if (type === "video") {
      if (!file.type.startsWith("video/")) {
        return NextResponse.json({ error: "File must be a video" }, { status: 400 })
      }
    } else if (type === "pdf") {
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const fileName = `${timestamp}_${sanitizedFileName}`

    // Select bucket based on type
    const bucket = type === "video" ? "academy-videos" : "academy-pdfs"

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error("Upload error:", uploadError)
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(fileName)

    // Get file size in MB
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: fileName,
      fileSize: `${fileSizeMB} MB`,
      type: type
    })
  } catch (error) {
    console.error("File upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Remove file from storage
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
    const fileUrl = searchParams.get("url")
    const type = searchParams.get("type")

    if (!fileUrl || !type) {
      return NextResponse.json({ error: "File URL and type required" }, { status: 400 })
    }

    // Extract filename from URL
    const fileName = fileUrl.split("/").pop()
    if (!fileName) {
      return NextResponse.json({ error: "Invalid file URL" }, { status: 400 })
    }

    // Select bucket based on type
    const bucket = type === "video" ? "academy-videos" : "academy-pdfs"

    // Delete from storage
    const { error: deleteError } = await supabase
      .storage
      .from(bucket)
      .remove([fileName])

    if (deleteError) {
      console.error("Delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("File deletion error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
