"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Download, Plus, Info, Home, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase, type Event, type AgendaItem } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { AgendaItemList } from "@/components/agenda-item-list"
import { AgendaItemForm } from "@/components/agenda-item-form"
import Image from "next/image"
import { ErrorDialog } from "@/components/error-dialog"
import { getErrorMessage } from "@/lib/error-utils"
import { v4 as uuidv4 } from 'uuid'
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { printTypeInfo, ensureNumber } from "@/lib/debug-utils"
import { recalculateAgendaTimes } from "@/lib/agenda-recalculation"
import { AgendaPdfDownload } from "@/components/agenda-pdf"

interface AgendaManagerProps {
  eventId: string
}

export function AgendaManager({ eventId }: AgendaManagerProps) {
  const [event, setEvent] = useState<Event | null>(null)
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showItemForm, setShowItemForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const [managerError, setManagerError] = useState<Error | string | null>(null)
  const [adhereToTimeRestrictions, setAdhereToTimeRestrictions] = useState(true)
  const [totalDays, setTotalDays] = useState<number | undefined>(undefined)
  const [lastChangedItemId, setLastChangedItemId] = useState<string | null>(null)
  const [eventEndTime, setEventEndTime] = useState<string>("")
  const [eventStartTime, setEventStartTime] = useState<string>("")
  const [eventStartDate, setEventStartDate] = useState<string>("")
  const previousItems = useRef<AgendaItem[]>([])

  useEffect(() => {
    fetchEventAndAgenda()
  }, [eventId])

  async function fetchEventAndAgenda() {
    try {
      console.log("fetchEventAndAgenda: Starting to fetch event data");
      setIsLoading(true)

      // Fetch event details from the API
      const response = await fetch(`/api/events/${eventId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch event')
      }
      const { data: eventData } = await response.json()
      
      if (!eventData) {
        throw new Error('No event data received')
      }

      console.log("fetchEventAndAgenda: Received event data:", {
        eventId: eventData.id,
        title: eventData.title,
        agendaItemsCount: eventData.agendaItems?.length || 0
      });
      
      // Extract the event end time - require it to exist
      if (eventData.endTime || eventData.end_time) {
        const endTime = eventData.endTime || eventData.end_time;
        console.log(`Event end time: ${endTime}`);
        setEventEndTime(endTime);
      } else {
        console.error("ERROR: No event end time found in database. This is required.");
        throw new Error("Event end time is required but not found in database");
      }
      
      // Extract the event start time - require it to exist
      if (eventData.startTime || eventData.start_time) {
        const startTime = eventData.startTime || eventData.start_time;
        console.log(`Event start time: ${startTime}`);
        setEventStartTime(startTime);
      } else {
        console.error("ERROR: No event start time found in database. This is required.");
        throw new Error("Event start time is required but not found in database");
      }
      
      // Calculate total days if we have start and end dates
      if ((eventData.startDate && eventData.endDate) || (eventData.start_date && eventData.end_date)) {
        // Try both camelCase and snake_case properties (API might be inconsistent)
        const startDateStr = eventData.startDate || eventData.start_date;
        const endDateStr = eventData.endDate || eventData.end_date;
        
        if (startDateStr && endDateStr) {
          const startDate = new Date(startDateStr);
          const endDate = new Date(endDateStr);
          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
          setTotalDays(diffDays);
          setEventStartDate(startDateStr);
          console.log(`Total days calculated: ${diffDays}`);
        } else {
          // If we still can't get valid dates, default to 3 days
          console.log("Could not calculate days from dates, using default of 3");
          setTotalDays(3);
        }
      } else {
        // Default to 3 days if no date information is available
        console.log("No date information available, using default of 3 days");
        setTotalDays(3);
      }
      
      if (eventData.agendaItems) {
        // Log the day indexes of all items to see if they match what we expect
        const dayIndices = eventData.agendaItems.map((item: AgendaItem) => item.dayIndex);
        console.log("fetchEventAndAgenda: Day indices in loaded data:", 
          [...new Set(dayIndices)].sort(), 
          "Item count by day:", 
          dayIndices.reduce((acc: Record<number, number>, dayIndex: number) => {
            acc[dayIndex] = (acc[dayIndex] || 0) + 1;
            return acc;
          }, {})
        );
      }

      setEvent(eventData)
      setAgendaItems(eventData.agendaItems || [])
      console.log("fetchEventAndAgenda: Updated state with new data");
      
      // No longer update adhereToTimeRestrictions from event settings
      // Always keep it true for the red border warning behavior
      // setAdhereToTimeRestrictions(eventData.adhereToTimeRestrictions !== false)
    } catch (error: any) {
      console.error("Error loading event:", error)
      setManagerError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
      console.log("fetchEventAndAgenda: Finished loading");
    }
  }

  function calculateAgendaTimes(items: AgendaItem[]): AgendaItem[] {
    if (items.length === 0) return items
    
    if (!eventStartTime) {
      console.error("ERROR: Cannot calculate agenda times without a valid event start time");
      throw new Error("Event start time is required for time calculations");
    }

    // Group items by day
    const itemsByDay: Record<number, AgendaItem[]> = {}
    items.forEach((item) => {
      if (!itemsByDay[item.dayIndex]) {
        itemsByDay[item.dayIndex] = []
      }
      itemsByDay[item.dayIndex].push(item)
    })

    const updatedItems: AgendaItem[] = []

    // Process each day's items
    Object.keys(itemsByDay).forEach((dayIndexStr) => {
      const dayIndex = Number.parseInt(dayIndexStr)
      // Make sure to sort by the integer order value
      const dayItems = itemsByDay[dayIndex].sort((a, b) => a.order - b.order)

      let currentTime = eventStartTime // Use event start time

      dayItems.forEach((item) => {
        // Set the start time for this item
        const startTime = currentTime

        // Calculate the end time based on duration
        const endTime = addMinutesToTime(startTime, item.durationMinutes)

        // Add the updated item to the result
        updatedItems.push({
          ...item,
          startTime,
          endTime,
        })

        // Update current time for the next item
        currentTime = endTime
      })
    })

    return updatedItems
  }

  function addMinutesToTime(timeStr: string, minutes: number): string {
    const [hours, mins] = timeStr.split(":").map(Number)
    const totalMinutes = hours * 60 + mins + minutes

    const newHours = Math.floor(totalMinutes / 60)
    const newMins = totalMinutes % 60

    return `${newHours.toString().padStart(2, "0")}:${newMins.toString().padStart(2, "0")}`
  }

  function handleAddItem() {
    setSelectedItem(null)
    setShowItemForm(true)
  }

  function handleAddItemAtPosition(dayIndex: number, afterOrder: number) {
    // Create a template for a new item to be inserted at the position
    // We'll start with a default duration of 30 mins
    let orderValue = afterOrder;
    
    // Special case: Position is 0 or -1000, it's from the day header
    // Calculate a position at the beginning of the day
    if (afterOrder === -1000 || afterOrder === 0) {
      console.log(`Adding at beginning of day ${dayIndex} with requested position: ${afterOrder}`);
      // Get items in this day, if any
      const dayItems = agendaItems
        .filter(i => i.dayIndex === dayIndex)
        .sort((a, b) => a.order - b.order);
        
      if (dayItems.length > 0) {
        // Set position before the first item
        orderValue = dayItems[0].order - 1000;
        console.log(`Setting position to ${orderValue} to be before first item with position ${dayItems[0].order}`);
      } else {
        // No items, set to 0
        orderValue = 0;
        console.log(`No items in day ${dayIndex}, setting position to 0`);
      }
    }
    
    const newItem: AgendaItem = {
      id: `temp-${Date.now()}`,
      event_id: eventId,
      topic: "",
      description: "",
      durationMinutes: 30,
      dayIndex: dayIndex,
      order: orderValue, // Use the calculated position
      startTime: "",
      endTime: ""
    };
    
    console.log(`Creating new agenda item at position: ${orderValue} for day: ${dayIndex}`);
    
    // Set this as the selected item and show the form
    setSelectedItem(newItem);
    setShowItemForm(true);
  }

  function handleEditItem(item: AgendaItem) {
    // Simply set selected item and show form - no scroll handling needed
    setSelectedItem(item);
    setShowItemForm(true);
  }

  function handleFormClose() {
    setShowItemForm(false);
    setSelectedItem(null);
  }

  const handleReorderItems = async (items: AgendaItem[], skipRefresh: boolean = false) => {
    console.log("handleReorderItems called");
    
    // Find the moved item by comparing with previous items
    const movedItem = items.find((item, index) => {
      const prevItem = previousItems.current[index];
      return prevItem && (item.dayIndex !== prevItem.dayIndex || item.order !== prevItem.order);
    });

    if (movedItem) {
      const prevItem = previousItems.current.find((item: AgendaItem) => item.id === movedItem.id);
      
      if (prevItem && prevItem.dayIndex === movedItem.dayIndex) {
        console.log("Item moved within the same day, setting for scroll:", movedItem.id);
        setLastChangedItemId(movedItem.id);
      }
    }
    
    // Normalize all item positions to ensure consistent ordering
    // Create a copy of the items array we can modify
    let normalizedItems = [...items];
    
    // Group items by day
    const allDayIndices = new Set(normalizedItems.map(item => item.dayIndex));
    
    // Normalize each day's items
    allDayIndices.forEach(dayIndex => {
      // Get items for this day and sort by order
      const dayItems = normalizedItems
        .filter(item => item.dayIndex === dayIndex)
        .sort((a, b) => a.order - b.order);
        
      // Assign evenly spaced order values (0, 1000, 2000, etc.)
      dayItems.forEach((item, index) => {
        const normalizedOrder = index * 1000;
        
        // Find and update the item directly in the items array
        const itemIndex = normalizedItems.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
          normalizedItems[itemIndex].order = normalizedOrder;
        }
      });
    });

    // Recalculate all item times based on the normalized positions
    const recalculatedItems = await recalculateAgendaTimes(
      normalizedItems,
      eventStartTime
    );

    // Update state first for immediate UI feedback
    setAgendaItems(recalculatedItems);
    previousItems.current = recalculatedItems;

    // Always update the database unless explicitly told to skip
    if (!skipRefresh) {
      console.log("Updating all item positions in database...");
      try {
        // Make batch database update with all items
        const response = await fetch(`/api/events/${eventId}/items/batch-order`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            movedItemId: movedItem?.id || null,
            items: recalculatedItems.map(item => ({
              id: item.id,
              event_id: item.event_id,
              topic: item.topic || "Untitled Item",
              description: item.description || "",
              duration_minutes: item.durationMinutes,
              day_index: item.dayIndex,
              order_position: item.order,
              start_time: item.startTime || "00:00", 
              end_time: item.endTime || "00:00",
              is_filler: item.is_filler || false
            }))
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || 'Failed to update item order';
          console.error("Batch update error details:", errorData);
          throw new Error(errorMessage);
        }

        console.log("Batch order update successful");
      } catch (error) {
        console.error("Error updating order:", error);
        toast({
          title: "Error",
          description: "Failed to update item order. Please try again.",
          variant: "destructive",
        });
      }
    }

    // Clear scroll target after a delay
    if (movedItem) {
      setTimeout(() => {
        setLastChangedItemId(null);
      }, 1000);
    }
  };

  async function handleSaveItem(item: AgendaItem) {
    try {
      console.log("handleSaveItem called with:", item);
      
      // Check if this is a new item with a temp ID
      const isNewItem = !item.id || item.id === '' || item.id.startsWith('temp-');
      
      // For existing items, check if the day has changed
      let dayHasChanged = false;
      if (!isNewItem) {
        const existingItem = agendaItems.find(i => i.id === item.id);
        if (existingItem && existingItem.dayIndex !== item.dayIndex) {
          console.log(`Item day changed from ${existingItem.dayIndex} to ${item.dayIndex} - will need full recalculation`);
          dayHasChanged = true;
        }
      }
      
      // Generate a proper UUID for new items
      const itemId = isNewItem ? uuidv4() : item.id;
      
      // Create a modified item with the proper ID
      const modifiedItem = {
        ...item,
        id: itemId
      };
      
      // Format to DB style for logging
      const itemForLogging = {
        id: itemId,
        topic: modifiedItem.topic,
        day_index: modifiedItem.dayIndex,
        duration_minutes: modifiedItem.durationMinutes,
        order_position: modifiedItem.order
      };
      
      console.log(`Processing item: ${isNewItem ? 'NEW' : 'EXISTING'} -`, itemForLogging);
      
      // If order is -1, place at the end of the day
      let orderPosition = modifiedItem.order;
      
      if (orderPosition === -1) {
        console.log(`Order position is -1, will place at the end of day ${modifiedItem.dayIndex}`);
        
        // Get all existing items for this day to determine the last position
        const existingItems = agendaItems
          .filter(i => i.dayIndex === modifiedItem.dayIndex)
          .sort((a, b) => b.order - a.order); // Sort in descending order
          
        console.log(`Found ${existingItems.length} existing items in day ${modifiedItem.dayIndex}`);
        
        if (existingItems.length > 0) {
          // Get the highest order and add 10
          const currentMax = typeof existingItems[0].order === 'number' 
            ? existingItems[0].order 
            : 0;
          orderPosition = currentMax + 10; // Place at the end with increment of 10
        } else {
          orderPosition = 0; // First item in the day
        }
        
        console.log(`Item will be placed at the end of day ${modifiedItem.dayIndex} with position ${orderPosition}`);
      } else {
        console.log(`Using specified order position: ${orderPosition}`);
      }
      
      // Ensure dayIndex is a number
      const dayIndex = ensureNumber(modifiedItem.dayIndex, 0);
      
      printTypeInfo("handleSaveItem dayIndex", dayIndex);
      
      if (!eventStartTime) {
        throw new Error("Cannot save item: Event start time is required");
      }
      
      // Create the full array of updated items with the new/updated item included
      let updatedItems: AgendaItem[];
      
      if (isNewItem) {
        // For new items, add to the current items list
        updatedItems = [...agendaItems, { 
          ...modifiedItem, 
          startTime: eventStartTime,
          endTime: addMinutesToTime(eventStartTime, modifiedItem.durationMinutes),
          order: orderPosition 
        }];
      } else {
        // For existing items, update the item in the list
        updatedItems = agendaItems.map(existingItem => 
          existingItem.id === itemId 
            ? {
                ...modifiedItem,
                startTime: existingItem.startTime, // Preserve existing times for now
                endTime: existingItem.endTime,
                order: orderPosition
              }
            : existingItem
        );
      }
      
      // Normalize all item positions to ensure consistent ordering
      // Group items by day
      const allDayIndices = new Set(updatedItems.map(item => item.dayIndex));
      
      // Normalize each day's items
      allDayIndices.forEach(dayIndex => {
        // Get items for this day and sort by order
        const dayItems = updatedItems
          .filter(item => item.dayIndex === dayIndex)
          .sort((a, b) => a.order - b.order);
          
        // Assign evenly spaced order values (0, 1000, 2000, etc.)
        dayItems.forEach((item, index) => {
          const normalizedOrder = index * 1000;
          
          // Find and update the item directly in the items array
          const itemIndex = updatedItems.findIndex(i => i.id === item.id);
          if (itemIndex !== -1) {
            updatedItems[itemIndex].order = normalizedOrder;
          }
        });
      });
      
      // Recalculate all item times based on the normalized positions
      const recalculatedItems = await recalculateAgendaTimes(
        updatedItems,
        eventStartTime
      );
      
      // First update UI with locally recalculated times
      setAgendaItems(recalculatedItems);
      
      // Store the ID of the item we just saved so we can scroll to it
      setLastChangedItemId(itemId);
      
      // Close the form without waiting for database update
      setShowItemForm(false);
      setSelectedItem(null);
      
      // Then update database in background (optimistic update)
      try {
        // Single batch update for all items including the new/edited one
        const batchResponse = await fetch(`/api/events/${eventId}/items/batch-order`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            movedItemId: itemId,
            items: recalculatedItems.map(item => ({
              id: item.id,
              event_id: item.event_id,
              topic: item.topic || "Untitled Item",
              description: item.description || "",
              duration_minutes: item.durationMinutes,
              day_index: item.dayIndex,
              order_position: item.order,
              start_time: item.startTime || "00:00",
              end_time: item.endTime || "00:00",
              is_filler: item.is_filler || false
            }))
          }),
        });
        
        if (!batchResponse.ok) {
          const errorData = await batchResponse.json().catch(() => ({}));
          const errorMessage = errorData.error || 'Failed to update items';
          console.error("Batch update error details:", errorData);
          throw new Error(errorMessage);
        }
        
        console.log("Database batch update successful");
      } catch (error) {
        console.error("Error saving item to database:", error);
        toast({
          title: "Error",
          description: "Changes saved locally but failed to update the database. Please refresh the page.",
          variant: "destructive",
        });
      }
      
      return true; // Return success to the caller
    } catch (error: any) {
      console.error("Error saving agenda item:", error);
      
      // Ensure we have a meaningful error message
      let errorMessage = "Unknown error saving agenda item";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      setManagerError(errorMessage);
      return false; // Return failure to the caller
    }
  }

  async function handleTimeRestrictionChange(value: boolean) {
    try {
      setAdhereToTimeRestrictions(value)
      
      // Update the event in the database
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adhereToTimeRestrictions: value
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update time restriction preference')
      }
      
      toast({
        title: value ? "Time restrictions enabled" : "Time restrictions disabled",
        description: value ? "Items exceeding time boundaries will be highlighted with a red border." : "No time boundary warnings will be shown."
      })
    } catch (error: any) {
      console.error("Error updating time restriction:", error)
      setManagerError(getErrorMessage(error))
      
      // Revert the state if the API call fails
      setAdhereToTimeRestrictions(!value)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Back button instead of breadcrumb */}
      <div className="py-3">
        <Link href="/" className="flex items-center text-sm hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          <span>Back to Events</span>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div className="mr-8">
          {/* Smaller event title with no logo */}
          <h1 className="text-2xl font-bold tracking-tight">{isLoading ? "Loading..." : event?.title}</h1>
          {event?.subtitle && <p className="text-muted-foreground">{event.subtitle}</p>}
        </div>
        <div className="flex gap-2">
          <ThemeToggle />
          {event && (
            <AgendaPdfDownload event={event} agendaItems={agendaItems}>
              <Button>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </AgendaPdfDownload>
          )}
        </div>
      </div>

      {/* Time Restrictions Checkbox - HIDDEN BUT PRESERVED FOR FUTURE USE */}
      <div className="hidden flex items-center p-5 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 mt-4 mb-4 shadow-sm">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <Checkbox 
              id="adhere-to-time" 
              checked={adhereToTimeRestrictions}
              onCheckedChange={handleTimeRestrictionChange}
              className="h-5 w-5"
            />
            <label 
              htmlFor="adhere-to-time" 
              className="text-base font-medium cursor-pointer"
            >
              Adhere to time restrictions
            </label>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-8">
            Controls whether agenda items must fit within the event's daily time boundaries.
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-2 h-7 w-7">
                <Info className="h-5 w-5" />
                <span className="sr-only">More info</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p>When enabled, agenda items are automatically organized to fit within each day's time limits. Items that exceed a day's limit will move to the next day, and items at the start of a day will move to the previous day if there's available time. On the final day, items that exceed time limits will be highlighted with a red border.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Always render AgendaItemList - it remains in the DOM */}
      <AgendaItemList
        items={agendaItems}
        isLoading={isLoading}
        onEdit={handleEditItem}
        onReorder={handleReorderItems}
        onAddAtPosition={handleAddItemAtPosition}
        adhereToTimeRestrictions={adhereToTimeRestrictions}
        totalDays={totalDays}
        scrollToItemId={lastChangedItemId}
        onItemScrolled={() => setLastChangedItemId(null)}
        eventEndTime={eventEndTime}
        eventStartTime={eventStartTime}
        eventStartDate={eventStartDate}
      />
      
      {/* Always render AgendaItemForm, but conditionally show it */}
      {/* The form component itself handles open/closed state */}
      <AgendaItemForm 
        eventId={eventId} 
        item={selectedItem} 
        onClose={() => handleFormClose()}
        onSave={handleSaveItem}
        adhereToTimeRestrictions={adhereToTimeRestrictions}
        isOpen={showItemForm} // New prop to control visibility
      />
      
      <ErrorDialog title="Agenda Manager Error" error={managerError} onClose={() => setManagerError(null)} />
    </div>
  )
}

