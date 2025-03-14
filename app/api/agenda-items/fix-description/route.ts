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

export async function POST(request: Request) {
  console.log(`POST /api/agenda-items/fix-description - Starting`)

  try {
    // Get request body and dump it to logs for debugging
    let requestBody
    try {
      requestBody = await request.json()
      console.log('📥 Request body received:', JSON.stringify(requestBody, null, 2))
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json({ 
        error: 'Failed to parse request body', 
        details: String(parseError)
      }, { status: 400 })
    }
    
    const { 
      itemId, 
      description,
      topic, 
      durationMinutes,
      dayIndex,
      orderPosition,
      startTime,
      endTime,
      fullUpdate = false, 
      useDirectSql = true 
    } = requestBody

    if (!itemId) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 })
    }

    // Dump key parameters for debugging
    console.log(`Updating agenda item ${itemId}:`, { 
      description, 
      topic,
      durationMinutes,
      dayIndex,
      orderPosition,
      startTime,
      endTime,
      fullUpdate,
      useDirectSql
    })

    try {
      // First, verify we can fetch the item
      const { data: existingItem, error: fetchError } = await supabaseAdmin
        .from("agenda_items")
        .select("*")
        .eq("id", itemId)
        .single()

      if (fetchError) {
        console.error("Error finding item to update:", fetchError)
        return NextResponse.json({ 
          error: `Item not found: ${fetchError.message}`,
          details: fetchError
        }, { status: 404 })
      }

      console.log("Found item to update:", existingItem)

      // Format strings for SQL - escape single quotes
      const escapedDescription = (description || "").replace(/'/g, "''")
      const escapedTopic = (topic || "").replace(/'/g, "''")
      const escapedStartTime = (startTime || "").replace(/'/g, "''")
      const escapedEndTime = (endTime || "").replace(/'/g, "''")
      
      let data, error: any = null

      // Create the update data object
      const updateData = fullUpdate 
        ? { 
            description, 
            topic, 
            duration_minutes: durationMinutes,
            day_index: dayIndex,
            order_position: orderPosition,
            start_time: startTime,
            end_time: endTime 
          } 
        : { description }

      // Simply use a direct update - most reliable
      console.log("Using direct admin update with data:", updateData)
      
      // Direct update using the admin client
      const updateResult = await supabaseAdmin
        .from("agenda_items")
        .update(updateData)
        .eq("id", itemId)
        .select()

      console.log("Update result:", updateResult)

      if (updateResult.error) {
        console.error("Update failed:", updateResult.error)
        return NextResponse.json({ 
          error: `Update failed: ${updateResult.error.message}`,
          details: updateResult.error
        }, { status: 400 })
      }

      // Fetch the updated item to verify
      const { data: updatedItem, error: verifyError } = await supabaseAdmin
        .from("agenda_items")
        .select("*")
        .eq("id", itemId)
        .single()

      if (verifyError) {
        console.error("Error verifying update:", verifyError)
        return NextResponse.json({ 
          error: `Error verifying update: ${verifyError.message}`,
          details: verifyError
        }, { status: 400 })
      }

      console.log("Updated item verified:", updatedItem)

      return NextResponse.json({ 
        success: true, 
        id: updatedItem.id,
        description: updatedItem.description,
        topic: updatedItem.topic,
        duration_minutes: updatedItem.duration_minutes,
        day_index: updatedItem.day_index,
        order_position: updatedItem.order_position,
        start_time: updatedItem.start_time,
        end_time: updatedItem.end_time,
        message: `Item "${updatedItem.topic}" updated successfully` 
      })
    } catch (operationError: any) {
      console.error("Error performing update operation:", operationError)
      return NextResponse.json({ 
        error: `Operation failed: ${operationError?.message || "Unknown error"}`,
        stack: operationError?.stack,
        details: operationError
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Critical error in fix-description API:", error)
    return NextResponse.json({ 
      error: `Critical error: ${error?.message || "Unknown error"}`,
      stack: error?.stack
    }, { status: 500 })
  }
}