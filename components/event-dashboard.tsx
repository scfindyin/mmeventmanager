"use client"

import { useState, useEffect } from "react"
import { Plus, Trash, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { ErrorDialog } from "@/components/error-dialog"
import { getErrorMessage } from "@/lib/error-utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { EventForm } from "@/components/event-form"
import { EventList } from "@/components/event-list"
import { supabase } from "@/lib/supabase"
import type { Event } from "@/lib/types"

export function EventDashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("events")
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const { toast } = useToast()
  const [dashboardError, setDashboardError] = useState<Error | string | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    setIsLoading(true)
    setDashboardError(null)
    
    try {
      const response = await fetch("/api/events/list")
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch events")
      }
      
      const data = await response.json()
      console.log("Fetched events:", data.data)
      setEvents(data.data || [])
    } catch (error: any) {
      console.error("Error fetching events:", error)
      setDashboardError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function handleCreateEvent() {
    setSelectedEvent(null)
    setActiveTab("create")
  }

  function handleEditEvent(event: Event) {
    setSelectedEvent(event)
    setActiveTab("create")
  }

  async function handleCloneEvent(event: Event) {
    try {
      // Clone the event using the API to bypass RLS
      const response = await fetch("/api/events/clone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventId: event.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to clone event")
      }

      toast({
        title: "Event cloned",
        description: "The event has been cloned successfully.",
      })

      fetchEvents()
    } catch (error: any) {
      console.error("Error cloning event:", error)
      setDashboardError(getErrorMessage(error))
    }
  }

  async function handleDeleteEvent(id: string) {
    try {
      // Delete using the API to bypass RLS
      const response = await fetch(`/api/events/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete event")
      }

      toast({
        title: "Event deleted",
        description: "The event has been successfully deleted.",
      })

      fetchEvents()
    } catch (error: any) {
      console.error("Error deleting event:", error)
      setDashboardError(getErrorMessage(error))
    }
  }

  function handleFormClose() {
    // First set the tab back to events
    setActiveTab("events")

    // Then fetch the events to refresh the list
    setTimeout(() => {
      fetchEvents()
    }, 100)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Event Agenda Manager</h1>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
            <p>Loading events...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Event Agenda Manager</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button onClick={handleCreateEvent}>
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        </div>
      </div>

      {activeTab === "events" ? (
        <EventList
          events={events}
          isLoading={isLoading}
          onEdit={handleEditEvent}
          onClone={handleCloneEvent}
          onDelete={handleDeleteEvent}
        />
      ) : (
        <div>
          <Button
            variant="outline"
            onClick={() => {
              fetchEvents()
              setActiveTab("events")
            }}
            className="mb-4"
          >
            ← Back to Events
          </Button>
          <EventForm event={selectedEvent} onClose={handleFormClose} />
        </div>
      )}
      <ErrorDialog title="Dashboard Error" error={dashboardError} onClose={() => setDashboardError(null)} />
    </div>
  )
}

