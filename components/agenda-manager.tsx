"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Download, Plus, Info, Home, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase, type Event, type AgendaItem } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { AgendaItemList } from "@/components/agenda-item-list"
import { AgendaItemForm } from "@/components/agenda-item-form"
import { generatePDF } from "@/lib/pdf-generator"
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

  useEffect(() => {
    fetchEventAndAgenda()
  }, [eventId])

  async function fetchEventAndAgenda() {
    try {
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

      setEvent(eventData)
      setAgendaItems(eventData.agendaItems || [])
      
      // No longer update adhereToTimeRestrictions from event settings
      // Always keep it true for the red border warning behavior
      // setAdhereToTimeRestrictions(eventData.adhereToTimeRestrictions !== false)
    } catch (error: any) {
      console.error("Error loading event:", error)
      setManagerError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function calculateAgendaTimes(items: AgendaItem[]): AgendaItem[] {
    if (items.length === 0) return items

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

      let currentTime = "09:00" // Default start time

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
    const newItem: AgendaItem = {
      id: `temp-${Date.now()}`,
      event_id: eventId,
      topic: "",
      description: "",
      durationMinutes: 30,
      dayIndex: dayIndex,
      order: afterOrder, // Use the calculated position directly
      startTime: "",
      endTime: ""
    };
    
    console.log(`Creating new agenda item at position: ${afterOrder} for day: ${dayIndex}`);
    
    // Set this as the selected item and show the form
    setSelectedItem(newItem);
    setShowItemForm(true);
  }

  function handleEditItem(item: AgendaItem) {
    setSelectedItem(item)
    setShowItemForm(true)
  }

  function handleFormClose() {
    setShowItemForm(false)
    setSelectedItem(null)
    fetchEventAndAgenda()
  }

  async function handleReorderItems(reorderedItems: AgendaItem[]) {
    try {
      // First update the positions in the database
      const updatePromises = reorderedItems.map(item => {
        return supabase
          .from("agenda_items")
          .update({
            order_position: item.order,
            day_index: item.dayIndex,
          })
          .eq("id", item.id);
      });
      
      await Promise.all(updatePromises);
      
      // Get all unique day indices from the reordered items
      const dayIndices = [...new Set(reorderedItems.map(item => item.dayIndex))];
      
      // Recalculate times for each affected day separately
      for (const dayIndex of dayIndices) {
        await recalculateTimesForDay(dayIndex);
      }
      
      // Refresh agenda items from the server to get the updated times and positions
      await fetchEventAndAgenda();
      
      toast({
        title: "Agenda updated",
        description: "The agenda items have been reordered and times recalculated.",
      });
    } catch (error: any) {
      console.error("Error updating agenda:", error);
      setManagerError(getErrorMessage(error));
    }
  }

  async function handleGeneratePDF() {
    if (!event) return

    try {
      await generatePDF(event, agendaItems)
      toast({
        title: "PDF Generated",
        description: "Your agenda PDF has been generated and downloaded.",
      })
    } catch (error: any) {
      console.error("Error generating PDF:", error)
      setManagerError(getErrorMessage(error))
    }
  }

  async function handleSaveItem(item: AgendaItem) {
    try {
      // Check if this is a new item with a temp ID
      const isNewItem = !item.id || item.id === '' || item.id.startsWith('temp-');
      
      // Generate a proper UUID for new items
      const itemId = isNewItem ? uuidv4() : item.id;
      
      // Create a modified item with the proper ID
      const modifiedItem = {
        ...item,
        id: itemId
      };
      
      console.log("Saving agenda item:", {
        id: itemId,
        isNewItem,
        eventId,
        topic: modifiedItem.topic,
        description: modifiedItem.description,
        durationMinutes: modifiedItem.durationMinutes,
        dayIndex: modifiedItem.dayIndex,
        order: modifiedItem.order
      });
      
      // Determine the order position
      let orderPosition = modifiedItem.order;
      
      // SIMPLIFIED ORDERING LOGIC:
      // 1. If order is -1, place at the end of the day
      // 2. If it's a new item with no specific order, place at the end of the day
      // 3. Otherwise, use the specified order position
      
      // If order is -1 (end of day) or it's a new item without explicit position
      if (orderPosition === -1 || (isNewItem && !orderPosition)) {
        console.log("Placing item at the end of day", modifiedItem.dayIndex);
        
        // Find the highest order position for this day
        const { data: existingItems } = await supabase
          .from("agenda_items")
          .select("order_position")
          .eq("event_id", eventId)
          .eq("day_index", modifiedItem.dayIndex)
          .order("order_position", { ascending: false })
          .limit(1);
        
        if (existingItems && existingItems.length > 0) {
          const currentMax = typeof existingItems[0].order_position === 'number' 
            ? existingItems[0].order_position 
            : 0;
          orderPosition = currentMax + 10; // Place at the end with increment of 10
        } else {
          orderPosition = 0; // First item in the day
        }
        
        console.log(`Item will be placed at the end of day ${modifiedItem.dayIndex} with position ${orderPosition}`);
      } else {
        console.log(`Using specified order position: ${orderPosition}`);
      }
      
      // Prepare the item data - ensure we use the proper UUID
      const itemData = {
        id: itemId, // Always use the UUID we generated above
        event_id: eventId,
        topic: modifiedItem.topic,
        description: modifiedItem.description || "", 
        duration_minutes: modifiedItem.durationMinutes,
        day_index: modifiedItem.dayIndex,
        order_position: orderPosition,
        start_time: modifiedItem.startTime || "09:00",
        end_time: modifiedItem.endTime || "09:30",
      };
      
      console.log("Item data for upsert:", itemData);
      
      // Try inserting with a custom fetch call to get better error messages
      const response = await fetch('/api/agenda-items/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          item: itemData,
          triggerFullRecalculation: false, // Don't do full recalculation to avoid moving items
          respectDayAssignments: true // New parameter to ensure items stay on assigned days
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${JSON.stringify(errorData)}`);
      }
      
      // After saving, manually recalculate times for the specific day without moving items
      await recalculateTimesForDay(modifiedItem.dayIndex);
      
      await fetchEventAndAgenda(); // Refresh all items from the server
      
      toast({
        title: isNewItem ? "Item added" : "Item updated",
        description: "The agenda item has been saved successfully.",
      });
      
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
  
  // Helper function to recalculate times for a specific day without moving items
  async function recalculateTimesForDay(dayIndex: number) {
    try {
      // Get all items for this day
      const dayItems = agendaItems.filter(item => item.dayIndex === dayIndex)
        .sort((a, b) => a.order - b.order);
      
      if (dayItems.length === 0) return;
      
      // Get the first item to use as a reference
      const firstItem = dayItems[0];
      
      // Call the API to recalculate times for this day only
      const response = await fetch('/api/agenda-items/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          item: {
            id: firstItem.id,
            event_id: firstItem.event_id,
            topic: firstItem.topic,
            description: firstItem.description || "",
            duration_minutes: firstItem.durationMinutes,
            day_index: dayIndex,
            order_position: firstItem.order,
            start_time: firstItem.startTime,
            end_time: firstItem.endTime
          },
          triggerFullRecalculation: false,
          recalculateDayOnly: dayIndex, // Only recalculate this specific day
          respectDayAssignments: true // Ensure items stay on assigned days
        }),
      });
      
      if (!response.ok) {
        console.error("Error recalculating times for day:", await response.json());
      }
    } catch (error) {
      console.error("Failed to recalculate times for day:", error);
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
    <div className="container mx-auto max-w-7xl space-y-6">
      {/* Breadcrumb navigation */}
      <nav className="flex items-center py-3 px-4 bg-muted/50 rounded-lg mb-2">
        <ol className="flex items-center space-x-2">
          <li>
            <Link href="/" className="flex items-center text-sm hover:text-primary transition-colors">
              <Home className="h-4 w-4 mr-1.5" />
              <span>Home</span>
            </Link>
          </li>
          <li className="flex items-center">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />
            <Link href="/events" className="text-sm hover:text-primary transition-colors">
              Events
            </Link>
          </li>
          <li className="flex items-center">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />
            <Link href={`/events/${eventId}`} className="text-sm hover:text-primary transition-colors truncate max-w-[200px]" title={event?.title || "Loading..."}>
              {isLoading ? "Loading..." : event?.title}
            </Link>
          </li>
          <li className="flex items-center">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />
            <span className="text-sm font-medium text-primary">
              Agenda
            </span>
          </li>
        </ol>
      </nav>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4">
            {event?.logo_url && (
              <div className="relative w-16 h-16">
                <Image src={event.logo_url || "/placeholder.svg"} alt={event.title} fill className="object-contain" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{isLoading ? "Loading..." : event?.title}</h1>
              {event?.subtitle && <p className="text-muted-foreground">{event.subtitle}</p>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <ThemeToggle />
          <Button variant="outline" onClick={handleGeneratePDF}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button onClick={handleAddItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
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

      {showItemForm ? (
        <AgendaItemForm 
          eventId={eventId} 
          item={selectedItem} 
          onClose={handleFormClose}
          onSave={handleSaveItem}
          adhereToTimeRestrictions={adhereToTimeRestrictions}
        />
      ) : (
        <AgendaItemList
          items={agendaItems}
          isLoading={isLoading}
          onEdit={handleEditItem}
          onReorder={handleReorderItems}
          onAddAtPosition={handleAddItemAtPosition}
          adhereToTimeRestrictions={adhereToTimeRestrictions}
        />
      )}
      <ErrorDialog title="Agenda Manager Error" error={managerError} onClose={() => setManagerError(null)} />
    </div>
  )
}

