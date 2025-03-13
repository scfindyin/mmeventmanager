import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create a Supabase client with the service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Generate a unique filename
    const fileExt = file.name.split(".").pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
    const filePath = `logos/${fileName}`

    console.log(`Uploading file to event-assets/${filePath}`)

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // First, ensure the bucket exists and is public
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets()
      const eventAssetsBucket = buckets?.find((bucket) => bucket.name === "event-assets")

      if (!eventAssetsBucket) {
        await supabaseAdmin.storage.createBucket("event-assets", {
          public: true,
          fileSizeLimit: 1024 * 1024 * 2, // 2MB
        })
      } else if (!eventAssetsBucket.public) {
        await supabaseAdmin.storage.updateBucket("event-assets", {
          public: true,
        })
      }
    } catch (error) {
      console.error("Error checking/creating bucket:", error)
    }

    // Upload the file using the admin client
    const { data, error } = await supabaseAdmin.storage.from("event-assets").upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    })

    if (error) {
      console.error("Error uploading file:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Get the public URL - construct it manually to ensure correct format
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/event-assets/${filePath}`

    console.log("Generated public URL:", publicUrl)

    return NextResponse.json({
      success: true,
      path: data?.path,
      publicUrl,
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

// Configure the route to handle large files
export const config = {
  api: {
    bodyParser: false,
  },
}

