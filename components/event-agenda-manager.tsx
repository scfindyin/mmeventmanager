"use client"

import { useState, useEffect } from "react"
import { EventDetails } from "./event-details"
import { AgendaTimeline } from "./agenda-timeline"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Printer, Download, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { generatePDF } from "@/lib/pdf-generator"
import type { Event } from "@/types/event"
import { fetchEventData, saveEventData } from "@/lib/supabase-client"

export function EventAgendaManager() {
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true)
        // Fetch the first event or create a new one if none exists
        const eventData = await fetchEventData()
        setEvent(eventData)
      } catch (error) {
        console.error("Error loading event data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [])

  const handleEventUpdate = async (updatedEvent: Event) => {
    setEvent(updatedEvent)
    await saveEventData(updatedEvent)
  }

  const handleGeneratePDF = async () => {
    if (event) {
      await generatePDF(event)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (!event) {
    return <div>Error loading event data</div>
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="Event Manager Logo" className="h-10 w-auto" />
          <h1 className="text-2xl font-bold">Event Agenda Manager</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="outline" onClick={handleGeneratePDF} className="gap-2">
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Button onClick={handleGeneratePDF} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="timeline">Agenda Timeline</TabsTrigger>
          <TabsTrigger value="details">Event Details</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="mt-0">
          <AgendaTimeline event={event} onEventUpdate={handleEventUpdate} />
        </TabsContent>
        <TabsContent value="details" className="mt-0">
          <EventDetails event={event} onEventUpdate={handleEventUpdate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

