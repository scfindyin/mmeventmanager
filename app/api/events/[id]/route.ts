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
  // Properly await params.id before using it
  const { id } = await Promise.resolve(params);
  console.log(`PUT /api/events/${id} - Starting`)

  try {
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
    // Properly await params.id before using it
    const { id } = await Promise.resolve(params);

    console.log(`DELETE API: Attempting to delete event ${id}`);

    // Delete the event using the admin client (bypasses RLS)
    console.log(`DELETE API: Executing Supabase delete operation for event ${id}`);
    const { error, data } = await supabaseAdmin.from("events").delete().eq("id", id);

    if (error) {
      console.error("DELETE API: Error deleting event from database:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log(`DELETE API: Successfully deleted event ${id}`, data);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE API: Caught exception in delete event handler:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params);
    
    // Fetch the event
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", id)
      .single()

    if (eventError || !event) {
      console.error("Error fetching event:", eventError)
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Fetch the agenda items
    const { data: agendaItems, error: itemsError } = await supabaseAdmin
      .from("agenda_items")
      .select("*")
      .eq("event_id", id)
      .order("day_index", { ascending: true })
      .order("order_position", { ascending: true })

    if (itemsError) {
      console.error("Error fetching agenda items:", itemsError)
      return NextResponse.json({ error: "Failed to fetch agenda items" }, { status: 500 })
    }

    // Transform snake_case DB fields to camelCase for frontend
    const transformedAgendaItems = agendaItems.map((item) => ({
      id: item.id,
      event_id: item.event_id,
      topic: item.topic,
      description: item.description || "",
      durationMinutes: item.duration_minutes,
      dayIndex: item.day_index,
      order: item.order_position,
      startTime: item.start_time || "",
      endTime: item.end_time || "",
      is_filler: item.is_filler || false
    }))

    // Combined response
    const responseData = {
      ...event,
      agendaItems: transformedAgendaItems,
      adhereToTimeRestrictions: event.adhere_to_time_restrictions !== false // default to true if null
    }

    return NextResponse.json({ data: responseData })
  } catch (error) {
    console.error("Error in GET /api/events/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json()
    // Properly await params.id before using it
    const { id } = await Promise.resolve(params);

    // Validate if there's anything to update
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No update data provided" }, { status: 400 })
    }

    // Prepare the update data
    const updateData: any = {}

    // Map fields from request
    if (data.title !== undefined) updateData.title = data.title
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.start_date !== undefined) updateData.start_date = data.start_date
    if (data.end_date !== undefined) updateData.end_date = data.end_date
    if (data.start_time !== undefined) updateData.start_time = data.start_time
    if (data.end_time !== undefined) updateData.end_time = data.end_time
    if (data.is_filler !== undefined) updateData.is_filler = data.is_filler
    if (data.logo_url !== undefined) updateData.logo_url = data.logo_url
    if (data.adhereToTimeRestrictions !== undefined) updateData.adhere_to_time_restrictions = data.adhereToTimeRestrictions

    // Update the event
    const { error } = await supabaseAdmin
      .from("events")
      .update(updateData)
      .eq("id", id)

    if (error) {
      console.error("Error updating event:", error)
      return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in PATCH /api/events/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

