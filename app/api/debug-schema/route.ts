import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  try {
    // Get table information
    const { data: tableInfo, error: tableError } = await supabaseAdmin.rpc("get_table_info", {
      table_name: "events",
    })

    if (tableError) {
      return NextResponse.json({
        success: false,
        error: tableError.message,
      })
    }

    // Check storage buckets
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()

    if (bucketsError) {
      return NextResponse.json({
        success: false,
        error: bucketsError.message,
      })
    }

    // Try to create the event-assets bucket if it doesn't exist
    let bucketCreated = false
    if (!buckets.some((b) => b.name === "event-assets")) {
      const { error: createError } = await supabaseAdmin.storage.createBucket("event-assets", {
        public: true,
      })

      bucketCreated = !createError
    }

    return NextResponse.json({
      success: true,
      tableInfo,
      buckets,
      bucketCreated,
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "An unexpected error occurred",
    })
  }
}

