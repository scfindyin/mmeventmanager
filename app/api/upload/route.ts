import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const bucket = formData.get("bucket") as string
    const path = formData.get("path") as string

    if (!file || !bucket || !path) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log(`Uploading file to ${bucket}/${path}`)

    // Upload the file using the admin client
    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, file, {
      upsert: true,
    })

    if (error) {
      console.error("Error uploading file:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Get the public URL
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)

    return NextResponse.json({
      success: true,
      publicUrl: data.publicUrl,
    })
  } catch (error: any) {
    console.error("Error in upload API:", error)
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}

// Need to configure the route to handle large files
export const config = {
  api: {
    bodyParser: false,
  },
}

