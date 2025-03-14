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
  console.log(`POST /api/agenda-items/direct-test - Starting`)

  try {
    const requestBody = await request.json()
    console.log('📥 Direct test request body:', JSON.stringify(requestBody, null, 2))
    
    const { itemId, description } = requestBody

    if (!itemId) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 })
    }

    // First, fetch the item to see its current state
    const { data: originalItem, error: fetchError } = await supabaseAdmin
      .from("agenda_items")
      .select("*")
      .eq("id", itemId)
      .single()

    if (fetchError) {
      console.error("Error fetching item for testing:", fetchError)
      return NextResponse.json({ 
        error: `Error fetching item: ${fetchError.message}`,
        errorDetails: fetchError
      }, { status: 400 })
    }

    console.log("Original item state:", originalItem)

    // Try a simple direct update
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from("agenda_items")
      .update({ description: description || "Test update" })
      .eq("id", itemId)
      .select()

    console.log("Update attempt result:", {
      data: updateResult,
      error: updateError
    })

    if (updateError) {
      return NextResponse.json({ 
        error: `Update failed: ${updateError.message}`,
        errorDetails: updateError
      }, { status: 400 })
    }

    // Verify the update
    const { data: updatedItem, error: verifyError } = await supabaseAdmin
      .from("agenda_items")
      .select("*")
      .eq("id", itemId)
      .single()

    if (verifyError) {
      return NextResponse.json({ 
        error: `Error verifying update: ${verifyError.message}`,
        errorDetails: verifyError
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      originalItem,
      updateResult,
      updatedItem,
      message: "Direct test complete"
    })
  } catch (error: any) {
    console.error("Error in direct test:", error)
    return NextResponse.json({ 
      error: `Unexpected error: ${error?.message || "Unknown error"}`,
      stack: error?.stack
    }, { status: 500 })
  }
} 