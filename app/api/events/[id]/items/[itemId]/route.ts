import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function DELETE(
  request: Request,
  { params }: { params: { id: string, itemId: string } }
) {
  try {
    const eventId = params.id;
    const itemId = params.itemId;

    console.log(`API: Attempting to delete item ${itemId} from event ${eventId}`);

    if (!supabaseAdmin) {
      console.error("API: Database client not available");
      return NextResponse.json({ error: "Database client not available" }, { status: 500 });
    }

    // First check if the item exists
    const { data: existingItem, error: fetchError } = await supabaseAdmin
      .from("agenda_items")
      .select("id, event_id")
      .eq("id", itemId)
      .eq("event_id", eventId)
      .single();

    if (fetchError) {
      console.error("API: Error fetching item:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    if (!existingItem) {
      console.error(`API: Item ${itemId} not found in event ${eventId}`);
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Delete the item
    const { error: deleteError } = await supabaseAdmin
      .from("agenda_items")
      .delete()
      .eq("id", itemId)
      .eq("event_id", eventId);

    if (deleteError) {
      console.error("API: Error deleting item:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    console.log(`API: Successfully deleted item ${itemId} from event ${eventId}`);
    return NextResponse.json({ 
      success: true, 
      message: "Item deleted successfully",
      itemId
    });
  } catch (error: any) {
    console.error("API: Error in delete item API:", error);
    return NextResponse.json(
      { 
        error: error.message || "An unexpected error occurred", 
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined 
      },
      { status: 500 }
    );
  }
} 