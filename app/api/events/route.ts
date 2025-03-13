import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: Request) {
  console.log("POST /api/events - Starting")

  try {
    const eventData = await request.json()
    console.log("Event data received:", eventData)

    // Log environment variables (without exposing the actual values)
    console.log("Environment check:", {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    })

    // Try to insert with detailed error logging
    const { data, error } = await supabaseAdmin.from("events").insert(eventData).select().single()

    if (error) {
      console.error("Supabase error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log("Event created successfully:", data)
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("Unexpected error in POST /api/events:", error)
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  console.log("PUT /api/events - Starting")

  try {
    const { id, ...eventData } = await request.json()
    console.log(`Updating event ${id} with data:`, eventData)

    if (!id) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.from("events").update(eventData).eq("id", id).select().single()

    if (error) {
      console.error("Supabase error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log("Event updated successfully:", data)
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("Unexpected error in PUT /api/events:", error)
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

