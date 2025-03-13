"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Download, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase, type Event, type AgendaItem } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { AgendaItemList } from "@/components/agenda-item-list"
import { AgendaItemForm } from "@/components/agenda-item-form"
import { generatePDF } from "@/lib/pdf-generator"
import Image from "next/image"
import { ErrorDialog } from "@/components/error-dialog"
import { getErrorMessage } from "@/lib/error-utils"

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

  function handleEditItem(item: AgendaItem) {
    setSelectedItem(item)
    setShowItemForm(true)
  }

  function handleFormClose() {
    setShowItemForm(false)
    fetchEventAndAgenda()
  }

  async function handleReorderItems(reorderedItems: AgendaItem[]) {
    try {
      // Update positions in the database
      for (const item of reorderedItems) {
        await supabase
          .from("agenda_items")
          .update({
            order_position: item.order,
            day_index: item.dayIndex,
          })
          .eq("id", item.id)
      }

      // Recalculate times and update the UI
      const calculatedItems = calculateAgendaTimes(reorderedItems)
      setAgendaItems(calculatedItems)

      // Update times in the database
      for (const item of calculatedItems) {
        await supabase
          .from("agenda_items")
          .update({
            start_time: item.startTime,
            end_time: item.endTime,
          })
          .eq("id", item.id)
      }

      toast({
        title: "Agenda updated",
        description: "The agenda items have been reordered and times recalculated.",
      })
    } catch (error: any) {
      console.error("Error updating agenda:", error)
      setManagerError(getErrorMessage(error))
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
      // Update or create the item in the database
      const { error } = await supabase
        .from("agenda_items")
        .upsert({
          id: item.id,
          event_id: eventId,
          topic: item.topic,
          duration_minutes: item.durationMinutes,
          day_index: item.dayIndex,
          order_position: item.order,
          start_time: item.startTime,
          end_time: item.endTime,
          sub_items: item.subItems
        })

      if (error) throw error

      // Refresh the agenda items
      fetchEventAndAgenda()
      
      toast({
        title: item.id.startsWith('temp-') ? "Item added" : "Item updated",
        description: "The agenda item has been saved successfully.",
      })
    } catch (error: any) {
      console.error("Error saving agenda item:", error)
      setManagerError(getErrorMessage(error))
    }
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
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

      {showItemForm ? (
        <AgendaItemForm 
          eventId={eventId} 
          item={selectedItem} 
          onClose={handleFormClose}
          onSave={handleSaveItem}
        />
      ) : (
        <AgendaItemList
          items={agendaItems}
          isLoading={isLoading}
          onEdit={handleEditItem}
          onReorder={handleReorderItems}
        />
      )}
      <ErrorDialog title="Agenda Manager Error" error={managerError} onClose={() => setManagerError(null)} />
    </div>
  )
}

