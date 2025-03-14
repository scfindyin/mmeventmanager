import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create a Supabase client with the service role key (bypasses RLS)
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
    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }

    // Get the original event
    const { data: event, error: eventError } = await supabaseAdmin.from("events").select("*").eq("id", eventId).single()

    if (eventError) {
      console.error("Error fetching event to clone:", eventError)
      return NextResponse.json({ error: eventError.message }, { status: 400 })
    }

    // Clone the event
    const { data: newEvent, error: insertError } = await supabaseAdmin
      .from("events")
      .insert({
        title: `${event.title} (Copy)`,
        subtitle: event.subtitle,
        notes: event.notes,
        start_date: event.start_date,
        end_date: event.end_date,
        logo_url: event.logo_url,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating cloned event:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    // Get all agenda items for the original event
    const { data: agendaItems, error: agendaError } = await supabaseAdmin
      .from("agenda_items")
      .select("*")
      .eq("event_id", eventId)
      .order("position")

    if (agendaError) {
      console.error("Error fetching agenda items to clone:", agendaError)
      return NextResponse.json({ error: agendaError.message }, { status: 400 })
    }

    // Clone all agenda items
    if (agendaItems && agendaItems.length > 0) {
      const newAgendaItems = agendaItems.map((item) => ({
        event_id: newEvent.id,
        topic: item.topic,
        description: item.description,
        duration_minutes: item.duration_minutes,
        day_index: item.day_index,
        order_position: item.order_position,
        start_time: item.start_time,
        end_time: item.end_time,
      }))

      const { error: insertItemsError } = await supabaseAdmin.from("agenda_items").insert(newAgendaItems)

      if (insertItemsError) {
        console.error("Error creating cloned agenda items:", insertItemsError)
        return NextResponse.json({ error: insertItemsError.message }, { status: 400 })
      }

      // For each original agenda item, get its sub-items and clone them
      for (let i = 0; i < agendaItems.length; i++) {
        const originalItem = agendaItems[i]

        // Get the ID of the newly created agenda item
        const { data: newItem, error: newItemError } = await supabaseAdmin
          .from("agenda_items")
          .select("id")
          .eq("event_id", newEvent.id)
          .eq("position", originalItem.position)
          .single()

        if (newItemError) continue

        // Get sub-items for the original agenda item
        const { data: subItems, error: subItemsError } = await supabaseAdmin
          .from("sub_items")
          .select("*")
          .eq("agenda_item_id", originalItem.id)
          .order("position")

        if (subItemsError || !subItems || subItems.length === 0) continue

        // Clone the sub-items
        const newSubItems = subItems.map((subItem) => ({
          agenda_item_id: newItem.id,
          content: subItem.content,
          position: subItem.position,
        }))

        await supabaseAdmin.from("sub_items").insert(newSubItems)
      }
    }

    // Get all attendees for the original event
    const { data: attendees, error: attendeesError } = await supabaseAdmin
      .from("attendees")
      .select("*")
      .eq("event_id", eventId)

    if (!attendeesError && attendees && attendees.length > 0) {
      const newAttendees = attendees.map((attendee) => ({
        event_id: newEvent.id,
        name: attendee.name,
        email: attendee.email,
      }))

      await supabaseAdmin.from("attendees").insert(newAttendees)
    }

    return NextResponse.json({ success: true, data: newEvent })
  } catch (error) {
    console.error("Error in clone event API:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

