import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validate as isUUID } from 'uuid'

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
  console.log(`POST /api/agenda-items/create - Starting`)

  try {
    // Get request body
    let requestBody
    try {
      requestBody = await request.json()
      console.log('Request body received:', JSON.stringify(requestBody, null, 2))
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json({ 
        error: 'Failed to parse request body', 
        details: String(parseError)
      }, { status: 400 })
    }
    
    const { item, triggerFullRecalculation = false } = requestBody

    if (!item || !item.id || !item.event_id || !item.topic) {
      return NextResponse.json({ 
        error: "Required fields missing", 
        requiredFields: ["id", "event_id", "topic"],
        receivedItem: item 
      }, { status: 400 })
    }

    // Validate the UUID format
    if (!isUUID(item.id)) {
      console.error(`Invalid UUID format: ${item.id}`)
      return NextResponse.json({
        error: "Invalid UUID format for item ID",
        receivedId: item.id,
        suggestion: "Ensure you're using a valid UUID v4 format for new items"
      }, { status: 400 })
    }

    // Validate fields
    if (typeof item.topic !== 'string' || item.topic.trim() === '') {
      return NextResponse.json({ 
        error: "Topic is required", 
        receivedTopic: item.topic 
      }, { status: 400 })
    }

    if (typeof item.duration_minutes !== 'number' || item.duration_minutes <= 0) {
      return NextResponse.json({ 
        error: "Duration must be a positive number", 
        receivedDuration: item.duration_minutes 
      }, { status: 400 })
    }

    // Normalize any fields that might be undefined
    const normalizedItem = {
      id: item.id,
      event_id: item.event_id,
      topic: item.topic,
      description: item.description || "",
      duration_minutes: item.duration_minutes,
      day_index: item.day_index,
      order_position: item.order_position || 0,
      start_time: item.start_time || "09:00",
      end_time: item.end_time || "09:30"
    };

    console.log("Normalized item data:", normalizedItem);

    // Check if the item already exists
    const { data: existingItem, error: fetchError } = await supabaseAdmin
      .from("agenda_items")
      .select("*")
      .eq("id", normalizedItem.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Error checking for existing item:", fetchError);
      return NextResponse.json({ 
        error: "Error checking for existing item", 
        details: fetchError 
      }, { status: 500 });
    }

    let result;
    
    if (existingItem) {
      // Update existing item
      console.log("Updating existing item:", normalizedItem.id);
      result = await supabaseAdmin
        .from("agenda_items")
        .update(normalizedItem)
        .eq("id", normalizedItem.id)
        .select();
    } else {
      // Insert new item
      console.log("Inserting new item:", normalizedItem.id);
      result = await supabaseAdmin
        .from("agenda_items")
        .insert(normalizedItem)
        .select();
    }

    if (result.error) {
      console.error("Error saving item:", result.error);
      return NextResponse.json({ 
        error: "Failed to save agenda item", 
        details: result.error 
      }, { status: 500 });
    }

    console.log("Item saved successfully:", result.data);

    // We need to check time restrictions for all days in the event
    // First, get the event details to know about time restrictions and days
    const { data: eventData, error: eventError } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", normalizedItem.event_id)
      .single();

    if (eventError) {
      console.error("Error fetching event data:", eventError);
      // Continue with basic time recalculation for just this day
    }

    // Check if we need to respect time restrictions
    const adhereToTimeRestrictions = eventData?.adhere_to_time_restrictions !== false || triggerFullRecalculation;
    
    // Recalculate times for all items in this event, starting with the current day
    // but potentially cascading to future days
    if (adhereToTimeRestrictions) {
      try {
        // Get all days for this event
        const { data: allItems, error: allItemsError } = await supabaseAdmin
          .from("agenda_items")
          .select("*")
          .eq("event_id", normalizedItem.event_id)
          .order("day_index", { ascending: true })
          .order("order_position", { ascending: true });
          
        if (allItemsError) {
          console.error("Error fetching all items:", allItemsError);
          // Fall back to just recalculating the current day
        } else if (allItems && allItems.length > 0) {
          // Group items by day for processing
          const itemsByDay: Record<number, any[]> = {};
          allItems.forEach(item => {
            if (!itemsByDay[item.day_index]) {
              itemsByDay[item.day_index] = [];
            }
            itemsByDay[item.day_index].push(item);
          });
          
          // Get the start and end dates of the event
          const startDate = eventData?.start_date ? new Date(eventData.start_date) : null;
          const endDate = eventData?.end_date ? new Date(eventData.end_date) : null;
          
          if (startDate && endDate) {
            // Calculate the number of days in the event
            const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            
            // Perform multiple passes of optimization if triggered by a full recalculation
            const optimizationPasses = triggerFullRecalculation ? 3 : 1;
            
            for (let pass = 0; pass < optimizationPasses; pass++) {
              console.log(`Starting optimization pass ${pass + 1} of ${optimizationPasses}`);
              
              // First pass: Forward movement (items exceeding day limits move to next day)
              // Process each day in order
              for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
                if (!itemsByDay[dayIndex]) {
                  // No items for this day, skip
                  continue;
                }
                
                // Sort the items for this day
                const dayItems = itemsByDay[dayIndex].sort((a: any, b: any) => a.order_position - b.order_position);
                
                // Default time boundaries
                const defaultStartTime = "09:00";
                const defaultEndTime = "17:00";
                
                // Get time boundaries for this day if available
                const dayDate = new Date(startDate);
                dayDate.setDate(startDate.getDate() + dayIndex);
                const dateStr = dayDate.toISOString().split('T')[0]; // YYYY-MM-DD format
                
                const dayStartTime = eventData?.hours_of_operation?.[dateStr]?.start_time || defaultStartTime;
                const dayEndTime = eventData?.hours_of_operation?.[dateStr]?.end_time || defaultEndTime;
                
                // Parse end time to minutes since midnight
                const [endHours, endMinutes] = dayEndTime.split(":").map(Number);
                const dayEndMinutes = endHours * 60 + endMinutes;
                
                // Start processing from the first item
                let currentTime = dayStartTime;
                let itemsToMoveToNextDay: any[] = [];
                
                for (const item of dayItems) {
                  // Reset the processed flag for each pass
                  item.processed_for_move = false;
                  
                  // Update start time
                  const startTime = currentTime;
                  
                  // Calculate end time based on duration
                  const [hours, minutes] = startTime.split(":").map(Number);
                  const totalMinutes = hours * 60 + minutes + item.duration_minutes;
                  const newHours = Math.floor(totalMinutes / 60);
                  const newMinutes = totalMinutes % 60;
                  const endTime = `${newHours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`;
                  
                  // Check if this item would exceed the day's end time
                  const endTimeMinutes = newHours * 60 + newMinutes;
                  
                  if (endTimeMinutes > dayEndMinutes && dayIndex < dayCount - 1) {
                    // This item would exceed the day's end time and there's a next day
                    // Move it to the next day
                    itemsToMoveToNextDay.push({
                      ...item,
                      day_index: dayIndex + 1,
                      processed_for_move: true
                    });
                    
                    console.log(`Pass ${pass + 1}: Item ${item.id} exceeds day ${dayIndex} time limit, moved to day ${dayIndex + 1}`);
                    
                    // Don't update this item in the current day
                    continue;
                  }
                  
                  // Update the item with calculated times
                  await supabaseAdmin
                    .from("agenda_items")
                    .update({
                      start_time: startTime,
                      end_time: endTime
                    })
                    .eq("id", item.id);
                  
                  // Set the next item's start time
                  currentTime = endTime;
                }
                
                // If we have items to move to the next day
                if (itemsToMoveToNextDay.length > 0) {
                  // Process the next day's items
                  for (const item of itemsToMoveToNextDay) {
                    // Get current items in the target day
                    const nextDayItems = itemsByDay[item.day_index] || [];
                    
                    // Find the lowest order position to insert at the beginning
                    const lowestOrder = nextDayItems.length > 0 
                      ? Math.min(...nextDayItems.map((i: any) => i.order_position)) - 10
                      : 0;
                    
                    // Update the item with the new day index and order position
                    await supabaseAdmin
                      .from("agenda_items")
                      .update({
                        day_index: item.day_index,
                        order_position: lowestOrder
                      })
                      .eq("id", item.id);
                    
                    // Add to the next day's items for processing in the next iteration
                    if (!itemsByDay[item.day_index]) {
                      itemsByDay[item.day_index] = [];
                    }
                    itemsByDay[item.day_index].push({
                      ...item,
                      order_position: lowestOrder
                    });
                    
                    // Remove from current day
                    itemsByDay[dayIndex] = itemsByDay[dayIndex].filter((i: any) => i.id !== item.id);
                  }
                }
              }
              
              // Second pass: Backward movement
              // Check for items at the beginning of each day that would fit at the end of the previous day
              for (let dayIndex = dayCount - 1; dayIndex > 0; dayIndex--) {
                // Skip if there are no items for this day
                if (!itemsByDay[dayIndex] || itemsByDay[dayIndex].length === 0) {
                  continue;
                }
                
                // Skip if there are no items for the previous day
                if (!itemsByDay[dayIndex - 1] || itemsByDay[dayIndex - 1].length === 0) {
                  continue;
                }
                
                // Sort items for current day by order position
                const currentDayItems = [...itemsByDay[dayIndex]].sort((a: any, b: any) => a.order_position - b.order_position);
                
                // Skip items that were already processed in this pass
                const unprocessedItems = currentDayItems.filter(item => !item.processed_for_move);
                
                if (unprocessedItems.length === 0) {
                  continue;
                }
                
                // Sort items for previous day by order position
                const prevDayItems = [...itemsByDay[dayIndex - 1]].sort((a: any, b: any) => a.order_position - b.order_position);
                
                // Calculate available time at the end of the previous day
                const prevDayDate = new Date(startDate);
                prevDayDate.setDate(startDate.getDate() + (dayIndex - 1));
                const prevDateStr = prevDayDate.toISOString().split('T')[0];
                
                const prevDayEndTime = eventData?.hours_of_operation?.[prevDateStr]?.end_time || "17:00";
                const [prevEndHours, prevEndMinutes] = prevDayEndTime.split(":").map(Number);
                const prevDayEndMinutes = prevEndHours * 60 + prevEndMinutes;
                
                // If previous day has items, find the last item's end time
                let availableStartTime: string;
                let availableStartMinutes: number;
                
                if (prevDayItems.length > 0) {
                  const lastPrevItem = prevDayItems[prevDayItems.length - 1];
                  availableStartTime = lastPrevItem.end_time;
                  const [availStartHours, availStartMinutes] = availableStartTime.split(":").map(Number);
                  availableStartMinutes = availStartHours * 60 + availStartMinutes;
                } else {
                  // If no items in previous day, use the day's start time
                  const prevDayStartTime = eventData?.hours_of_operation?.[prevDateStr]?.start_time || "09:00";
                  availableStartTime = prevDayStartTime;
                  const [availStartHours, availStartMinutes] = availableStartTime.split(":").map(Number);
                  availableStartMinutes = availStartHours * 60 + availStartMinutes;
                }
                
                // Calculate available minutes in the previous day
                const availableMinutes = prevDayEndMinutes - availableStartMinutes;
                
                if (availableMinutes <= 0) {
                  // No time available in previous day
                  continue;
                }
                
                console.log(`Pass ${pass + 1}: Day ${dayIndex} has ${unprocessedItems.length} items, previous day has ${availableMinutes} minutes available`);
                
                // Check if first items from the current day would fit in the previous day
                let itemsToMoveToPrevDay: any[] = [];
                let remainingAvailableMinutes = availableMinutes;
                
                // Process items from the current day in order
                for (let i = 0; i < unprocessedItems.length; i++) {
                  const item = unprocessedItems[i];
                  
                  // Check if this item would fit in the remaining time
                  if (item.duration_minutes <= remainingAvailableMinutes) {
                    // This item would fit in the previous day
                    itemsToMoveToPrevDay.push(item);
                    remainingAvailableMinutes -= item.duration_minutes;
                    item.processed_for_move = true;
                  } else {
                    // This item and subsequent items won't fit, stop processing
                    break;
                  }
                }
                
                // Move eligible items to the previous day
                if (itemsToMoveToPrevDay.length > 0) {
                  console.log(`Pass ${pass + 1}: Found ${itemsToMoveToPrevDay.length} items from day ${dayIndex} that can fit at the end of day ${dayIndex - 1}`);
                  
                  for (const item of itemsToMoveToPrevDay) {
                    // Find the highest order position in the previous day to add after it
                    const highestOrder = prevDayItems.length > 0
                      ? Math.max(...prevDayItems.map((i: any) => i.order_position)) + 10
                      : 0;
                    
                    // Update the item with the new day index and order position
                    await supabaseAdmin
                      .from("agenda_items")
                      .update({
                        day_index: dayIndex - 1,
                        order_position: highestOrder
                      })
                      .eq("id", item.id);
                    
                    console.log(`Pass ${pass + 1}: Moved item ${item.id} from day ${dayIndex} to the end of day ${dayIndex - 1} at position ${highestOrder}`);
                    
                    // Update itemsByDay collections to reflect this change
                    // Remove from current day
                    itemsByDay[dayIndex] = itemsByDay[dayIndex].filter((i: any) => i.id !== item.id);
                    
                    // Add to previous day
                    item.day_index = dayIndex - 1;
                    item.order_position = highestOrder;
                    prevDayItems.push(item);
                    
                    itemsByDay[dayIndex - 1] = prevDayItems;
                  }
                }
              }
            }
            
            // After all optimization passes, do a final pass to recalculate all times correctly
            for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
              if (!itemsByDay[dayIndex] || itemsByDay[dayIndex].length === 0) {
                continue;
              }
              
              // Get the day's time boundaries
              const dayDate = new Date(startDate);
              dayDate.setDate(startDate.getDate() + dayIndex);
              const dateStr = dayDate.toISOString().split('T')[0];
              
              const dayStartTime = eventData?.hours_of_operation?.[dateStr]?.start_time || "09:00";
              
              // Sort the items for this day by order position
              const sortedItems = [...itemsByDay[dayIndex]].sort((a: any, b: any) => a.order_position - b.order_position);
              
              // Reset current time for this day
              let currentTime = dayStartTime;
              
              // Recalculate times for all items in this day
              for (const item of sortedItems) {
                // Update start time
                const startTime = currentTime;
                
                // Calculate end time based on duration
                const [hours, minutes] = startTime.split(":").map(Number);
                const totalMinutes = hours * 60 + minutes + item.duration_minutes;
                const newHours = Math.floor(totalMinutes / 60);
                const newMinutes = totalMinutes % 60;
                const endTime = `${newHours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`;
                
                // Update the item with the final calculated times
                await supabaseAdmin
                  .from("agenda_items")
                  .update({
                    start_time: startTime,
                    end_time: endTime
                  })
                  .eq("id", item.id);
                
                // Set the next item's start time
                currentTime = endTime;
              }
            }
            
            console.log("All times recalculated with bidirectional movement handling");
          } else {
            // Fall back to just recalculating the current day
            recalculateCurrentDayTimes(normalizedItem, allItems);
          }
        }
      } catch (recalcError) {
        console.error("Error in advanced time recalculation:", recalcError);
        // Fall back to basic time recalculation
        recalculateBasicTimes(normalizedItem);
      }
    } else {
      // No time restrictions, just do basic recalculation
      recalculateBasicTimes(normalizedItem);
    }

    return NextResponse.json({ 
      success: true, 
      item: result.data[0],
      message: `Agenda item saved successfully` 
    });
  } catch (error: any) {
    console.error("Critical error in agenda item creation:", error);
    return NextResponse.json({ 
      error: `Critical error: ${error?.message || "Unknown error"}`,
      stack: error?.stack
    }, { status: 500 });
  }
}

// Helper function to recalculate times for just the current day
async function recalculateCurrentDayTimes(item: any, allItems: any[]) {
  // Filter to just this day's items
  const dayItems = allItems.filter(i => i.day_index === item.day_index);
  
  // Sort by order position
  const sortedItems = [...dayItems].sort((a, b) => a.order_position - b.order_position);
  
  // Start at default time
  let currentTime = "09:00";
  
  // Update each item
  for (const dayItem of sortedItems) {
    // Update start time
    const startTime = currentTime;
    
    // Calculate end time based on duration
    const [hours, minutes] = startTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + dayItem.duration_minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    const endTime = `${newHours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`;
    
    // Update the item
    const updateResult = await supabaseAdmin
      .from("agenda_items")
      .update({
        start_time: startTime,
        end_time: endTime
      })
      .eq("id", dayItem.id);
    
    if (updateResult.error) {
      console.error("Error updating time for item:", dayItem.id, updateResult.error);
    }
    
    // Set the next item's start time
    currentTime = endTime;
  }
  
  console.log("Basic time recalculation completed for current day");
}

// Basic time recalculation for just the current day with no overflow handling
async function recalculateBasicTimes(normalizedItem: any) {
  const { data: allDayItems, error: fetchAllError } = await supabaseAdmin
    .from("agenda_items")
    .select("*")
    .eq("event_id", normalizedItem.event_id)
    .eq("day_index", normalizedItem.day_index)
    .order("order_position", { ascending: true });

  if (fetchAllError) {
    console.error("Error fetching all day items:", fetchAllError);
    return;
  }

  // Recalculate times
  if (allDayItems && allDayItems.length > 0) {
    try {
      // Ensure items are properly sorted by order_position
      const sortedItems = [...allDayItems].sort((a, b) => a.order_position - b.order_position);
      let currentTime = "09:00"; // Default start time

      for (const item of sortedItems) {
        // Update start time
        const startTime = currentTime;
        
        // Calculate end time based on duration
        const [hours, minutes] = startTime.split(":").map(Number);
        const totalMinutes = hours * 60 + minutes + item.duration_minutes;
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        const endTime = `${newHours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`;
        
        // Update the item
        const updateResult = await supabaseAdmin
          .from("agenda_items")
          .update({
            start_time: startTime,
            end_time: endTime
          })
          .eq("id", item.id);
        
        if (updateResult.error) {
          console.error("Error updating time for item:", item.id, updateResult.error);
        }
        
        // Set the next item's start time
        currentTime = endTime;
      }
      
      console.log("All times recalculated successfully");
    } catch (recalcError) {
      console.error("Error recalculating times:", recalcError);
    }
  }
} 