import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Generate a unique filename
    const fileExt = file.name.split(".").pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `logos/${fileName}`

    console.log(`Uploading file to event-assets/${filePath}`)

    // First, ensure the bucket exists
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets()
      if (!buckets.some((b) => b.name === "event-assets")) {
        await supabaseAdmin.storage.createBucket("event-assets", {
          public: true,
        })
        console.log("Created event-assets bucket")
      }
    } catch (bucketError) {
      console.error("Error checking/creating bucket:", bucketError)
    }

    // Upload the file using the admin client
    const { data, error } = await supabaseAdmin.storage.from("event-assets").upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    })

    if (error) {
      console.error("Error uploading file:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Get the public URL
    const { data: urlData } = supabaseAdmin.storage.from("event-assets").getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      path: data?.path,
      publicUrl: urlData.publicUrl,
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

