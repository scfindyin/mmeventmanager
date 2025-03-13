import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  try {
    // Check if the bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const eventAssetsBucket = buckets?.find((bucket) => bucket.name === "event-assets")

    if (!eventAssetsBucket) {
      // Create the bucket if it doesn't exist
      const { error: createError } = await supabaseAdmin.storage.createBucket("event-assets", {
        public: true, // Make the bucket public
      })

      if (createError) {
        return NextResponse.json({
          success: false,
          error: createError.message,
        })
      }
    } else {
      // Update the bucket to be public
      const { error: updateError } = await supabaseAdmin.storage.updateBucket("event-assets", {
        public: true,
      })

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: updateError.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: "Storage bucket configured successfully",
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "An unexpected error occurred",
    })
  }
}

