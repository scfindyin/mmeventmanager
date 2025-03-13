import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create a Supabase client with the service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Create the admin client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  console.log(`PUT /api/events/${params.id} - Starting`)

  try {
    const id = params.id
    const eventData = await request.json()

    console.log(`Updating event ${id} with data:`, eventData)

    // Update the event using the admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin.from("events").update(eventData).eq("id", id).select().single()

    if (error) {
      console.error("Error updating event:", error)

      // Check if it's a missing column error
      if (
        error.message &&
        error.message.includes("column") &&
        (error.message.includes("start_time") || error.message.includes("end_time"))
      ) {
        // Remove the problematic fields and try again
        const { start_time, end_time, ...safeEventData } = eventData

        console.log("Retrying without time fields:", safeEventData)

        const { data: retryData, error: retryError } = await supabaseAdmin
          .from("events")
          .update(safeEventData)
          .eq("id", id)
          .select()
          .single()

        if (retryError) {
          console.error("Error in retry update:", retryError)
          return NextResponse.json({ error: retryError.message }, { status: 400 })
        }

        console.log("Update successful after retry:", retryData)
        return NextResponse.json({ data: retryData })
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log("Update successful:", data)
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("Error in update event API:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    console.log(`Deleting event ${id}`)

    // Delete the event using the admin client (bypasses RLS)
    const { error } = await supabaseAdmin.from("events").delete().eq("id", id)

    if (error) {
      console.error("Error deleting event:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in delete event API:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Fetch the event using the admin client (bypasses RLS)
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", id)
      .single()

    if (eventError) {
      console.error("Error fetching event:", eventError)
      return NextResponse.json({ error: eventError.message }, { status: 400 })
    }

    // Fetch agenda items for this event
    const { data: agendaItems, error: itemsError } = await supabaseAdmin
      .from("agenda_items")
      .select("*")
      .eq("event_id", id)
      .order("order_position")

    if (itemsError) {
      console.error("Error fetching agenda items:", itemsError)
      return NextResponse.json({ error: itemsError.message }, { status: 400 })
    }

    // Fetch attendees for this event
    const { data: attendees, error: attendeesError } = await supabaseAdmin
      .from("attendees")
      .select("*")
      .eq("event_id", id)

    if (attendeesError) {
      console.error("Error fetching attendees:", attendeesError)
      return NextResponse.json({ error: attendeesError.message }, { status: 400 })
    }

    // Format the response to match the Event type
    const formattedEvent = {
      ...event,
      startDate: event.start_date,
      endDate: event.end_date,
      hoursOfOperation: event.hours_of_operation || {},
      agendaItems: agendaItems.map(item => ({
        id: item.id,
        event_id: item.event_id,
        topic: item.topic,
        durationMinutes: item.duration_minutes,
        dayIndex: item.day_index,
        order: item.order_position,
        startTime: item.start_time || "",
        endTime: item.end_time || "",
        subItems: item.sub_items || []
      })),
      attendees: attendees || []
    }

    return NextResponse.json({ data: formattedEvent })
  } catch (error: any) {
    console.error("Error in get event API:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 })
  }
}

