import { supabase } from "@/lib/supabase";
import { recalculateAgendaTimes } from "@/lib/agenda-recalculation";
import type { AgendaItem } from "@/lib/types";

interface DatabaseItem {
  id: string;
  event_id: string;
  topic: string;
  description?: string;
  duration_minutes: number;
  day_index: number;
  order_position: number;
  start_time: string;
  end_time: string;
  is_filler?: boolean;
  [key: string]: unknown; // Add index signature for database compatibility
}

export async function POST(request: Request) {
  try {
    console.log("API: Starting request processing");
    const { item, allItemUpdates, eventStartTime } = await request.json();
    
    // Log detailed request information
    console.log("API: Received batch update request:", {
      itemId: item?.id,
      totalUpdates: allItemUpdates?.length,
      eventStartTime
    });
    
    if (!eventStartTime) {
      console.error("API: Missing required eventStartTime");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required field: eventStartTime" 
        }),
        { status: 400 }
      );
    }

    if (!item || !item.event_id) {
      console.log("API: Missing required fields");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required fields: item and event_id" 
        }),
        { status: 400 }
      );
    }

    // Process batch updates (allItemUpdates contains all items to update)
    if (allItemUpdates && Array.isArray(allItemUpdates) && allItemUpdates.length > 0) {
      console.log(`API: Processing batch update for ${allItemUpdates.length} items`);
      
      // Prepare database items with all required fields
      const databaseItems = allItemUpdates.map(item => ({
        id: item.id,
        event_id: item.event_id,
        topic: item.topic || "Untitled Item",
        description: item.description || "",
        duration_minutes: item.duration_minutes,
        day_index: item.day_index,
        order_position: item.order_position,
        start_time: item.start_time || "00:00",
        end_time: item.end_time || "00:00",
        is_filler: item.is_filler || false
      }));
      
      // Perform batch upsert
      const { data, error } = await supabase
        .from("agenda_items")
        .upsert(databaseItems, { onConflict: "id" })
        .select();
        
      if (error) {
        console.error("API: Error in batch update:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500 }
        );
      }

      console.log(`API: Successfully updated ${databaseItems.length} items`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          items: data,
          message: `Updated ${databaseItems.length} items` 
        })
      );
    }

    // First, update the main item
    console.log("API: Updating main item:", { id: item.id, dayIndex: item.day_index });
    const { error: updateError } = await supabase
      .from("agenda_items")
      .upsert([item]);

    if (updateError) {
      console.error("Database error updating item:", updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to update item",
          details: updateError 
        }),
        { status: 500 }
      );
    }

    // Always fetch all items after any update
    const { data: updatedItems, error: fetchError } = await supabase
      .from("agenda_items")
      .select("*")
      .eq("event_id", item.event_id)
      .order("day_index", { ascending: true })
      .order("order_position", { ascending: true });

    if (fetchError) {
      console.error("Database error fetching updated items:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to fetch updated items",
          details: fetchError 
        }),
        { status: 500 }
      );
    }

    // Type assertion since we know the shape of the data
    const typedItems = (updatedItems as unknown) as DatabaseItem[];

    // Always recalculate times for all items (use local recalculation)
    const recalculatedItems = await recalculateAgendaTimes(typedItems, eventStartTime, undefined, false);

    // Convert DatabaseItems back for database update with proper typing
    const dbItems = recalculatedItems.map(item => ({
      id: item.id,
      event_id: item.event_id,
      topic: item.topic,
      description: item.description || "",
      duration_minutes: item.durationMinutes,
      day_index: item.dayIndex,
      order_position: item.order,
      start_time: item.startTime,
      end_time: item.endTime,
      is_filler: item.is_filler || false
    }));

    // Log the items being updated for debugging
    console.log("API: Updating items with recalculated times:", {
      count: dbItems.length,
      firstItem: dbItems[0],
      lastItem: dbItems[dbItems.length - 1]
    });

    // Update the database with recalculated times
    const { error: recalcError } = await supabase
      .from("agenda_items")
      .upsert(dbItems, {
        onConflict: 'id'
      });

    if (recalcError) {
      console.error("Database error updating recalculated times:", {
        error: recalcError,
        itemCount: dbItems.length,
        sample: dbItems[0]
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to update recalculated times",
          details: recalcError 
        }),
        { status: 500 }
      );
    }

    // Return success with recalculated items
    return new Response(
      JSON.stringify({
        success: true,
        items: recalculatedItems,
        message: "Items updated with recalculated times"
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error("API error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Internal server error",
        details: error 
      }),
      { status: 500 }
    );
  }
} 