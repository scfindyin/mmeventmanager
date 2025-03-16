import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    const { movedItemId, items } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid items data" }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Database client not available" }, { status: 500 });
    }

    console.log(`Updating ${items.length} items in event ${eventId}, moved item: ${movedItemId}`);

    // Validate items before upserting
    for (const item of items) {
      if (!item.id) {
        return NextResponse.json({ 
          error: "All items must have an id",
          invalidItem: item 
        }, { status: 400 });
      }
    }

    // Process each item to ensure proper format for database
    const formattedItems = items.map(item => ({
      id: item.id,
      event_id: eventId,
      topic: item.topic || item.event_id || "Untitled Item",
      description: item.description || "",
      duration_minutes: item.duration_minutes,
      day_index: item.day_index,
      order_position: item.order_position,
      start_time: item.start_time || "00:00",
      end_time: item.end_time || "00:00",
      updated_at: new Date().toISOString()
    }));

    // Use a single UPSERT operation with all the items
    const { data, error } = await supabaseAdmin
      .from("agenda_items")
      .upsert(
        formattedItems,
        { 
          onConflict: 'id',
          ignoreDuplicates: false 
        }
      )
      .select();

    if (error) {
      console.error("Error updating batch order:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Items updated successfully",
      data
    });
  } catch (error: any) {
    console.error("Error in batch-order API:", error);
    return NextResponse.json(
      { 
        error: error.message || "An unexpected error occurred", 
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined 
      },
      { status: 500 }
    );
  }
} 