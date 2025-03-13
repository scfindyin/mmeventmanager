"use client"

import { useState, useEffect } from "react"
import { Plus, AlertTriangle, Database, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { EventList } from "@/components/event-list"
import { EventForm } from "@/components/event-form"
import { supabase } from "@/lib/supabase"
import type { Event } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { checkDatabaseSetup, setupDatabase } from "@/lib/database-setup"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ErrorDialog } from "@/components/error-dialog"
import { getErrorMessage } from "@/lib/error-utils"

export function EventDashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("events")
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [databaseStatus, setDatabaseStatus] = useState<{
    checked: boolean
    tablesExist: boolean
    bucketExists: boolean
    errors: Record<string, string | undefined>
    isSettingUp: boolean
    setupError?: string
  }>({
    checked: false,
    tablesExist: false,
    bucketExists: false,
    errors: {},
    isSettingUp: false,
  })
  const { toast } = useToast()
  const [dashboardError, setDashboardError] = useState<Error | string | null>(null)

  useEffect(() => {
    checkDatabase()
  }, [])

  async function checkDatabase() {
    setIsLoading(true)
    const status = await checkDatabaseSetup()
    setDatabaseStatus({
      ...status,
      checked: true,
      isSettingUp: false,
    })

    if (status.tablesExist) {
      fetchEvents()
    } else {
      setIsLoading(false)
    }
  }

  async function handleSetupDatabase() {
    setDatabaseStatus((prev) => ({ ...prev, isSettingUp: true }))

    try {
      const result = await setupDatabase()

      if (result.success) {
        toast({
          title: "Database setup complete",
          description: "The database tables have been created successfully.",
        })
        checkDatabase()
      } else {
        setDatabaseStatus((prev) => ({
          ...prev,
          isSettingUp: false,
          setupError: result.error,
        }))

        toast({
          title: "Database setup failed",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setDatabaseStatus((prev) => ({
        ...prev,
        isSettingUp: false,
        setupError: errorMessage,
      }))

      toast({
        title: "Database setup failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  async function fetchEvents() {
    try {
      setIsLoading(true)

      // Try to fetch events directly first
      let data: Event[] = []
      let error: any = null

      try {
        const result = await supabase.from("events").select("*").order("created_at", { ascending: false })
        // Safe type assertion
        if (result.data) {
          data = result.data as unknown as Event[];
        }
        error = result.error
      } catch (err) {
        error = err
      }

      // If there's an RLS error, try the API route
      if (error && (error.message?.includes("row-level security") || error.message?.includes("permission denied"))) {
        try {
          const response = await fetch("/api/events/list")
          if (!response.ok) {
            throw new Error("Failed to fetch events from API")
          }
          const result = await response.json()
          // Safe type assertion
          if (result.data) {
            data = result.data as unknown as Event[];
          }
        } catch (apiError) {
          console.error("Error fetching events from API:", apiError)
          throw apiError
        }
      } else if (error) {
        throw error
      }

      console.log("Fetched events:", data)
      setEvents(data)
    } catch (error: any) {
      console.error("Error fetching events:", error)

      // Set the error for the dialog instead of showing a toast
      setDashboardError(getErrorMessage(error))

      // If we get a "relation does not exist" error after checking that tables exist,
      // there might be a connection issue or the tables were dropped
      if (error.message?.includes("does not exist") && databaseStatus.tablesExist) {
        checkDatabase()
      }
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

  // If we haven't checked the database yet, show loading
  if (!databaseStatus.checked) {
    return (
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Event Agenda Manager</h1>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
            <p>Checking database setup...</p>
          </div>
        </div>
      </div>
    )
  }

  // If tables don't exist, show setup screen
  if (!databaseStatus.tablesExist) {
    return (
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Event Agenda Manager</h1>
          <ThemeToggle />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              Database Setup Required
            </CardTitle>
            <CardDescription>
              The application requires database tables to be created before it can be used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="automatic">
              <TabsList className="mb-4">
                <TabsTrigger value="automatic">Automatic Setup</TabsTrigger>
                <TabsTrigger value="manual">Manual Setup</TabsTrigger>
              </TabsList>

              <TabsContent value="automatic">
                <div className="space-y-4">
                  <p>
                    Click the button below to automatically create the required database tables. This requires that your
                    Supabase user has permission to create tables.
                  </p>

                  {databaseStatus.setupError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Setup Error</AlertTitle>
                      <AlertDescription>{databaseStatus.setupError}</AlertDescription>
                    </Alert>
                  )}

                  <Button onClick={handleSetupDatabase} disabled={databaseStatus.isSettingUp} className="w-full">
                    {databaseStatus.isSettingUp ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Setting up database...
                      </>
                    ) : (
                      <>
                        <Database className="mr-2 h-4 w-4" />
                        Create Database Tables
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="manual">
                <div className="space-y-4">
                  <p>
                    If automatic setup doesn't work, you can manually create the required tables. Copy the SQL below and
                    run it in the Supabase SQL Editor.
                  </p>

                  <div className="bg-muted p-4 rounded-md">
                    <pre className="text-xs overflow-auto whitespace-pre-wrap">
                      {`-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT,
  notes TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agenda_items table
CREATE TABLE IF NOT EXISTS public.agenda_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  duration INTEGER NOT NULL,
  day_index INTEGER NOT NULL,
  position INTEGER NOT NULL,
  start_time TEXT,
  end_time TEXT
);

-- Create sub_items table
CREATE TABLE IF NOT EXISTS public.sub_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agenda_item_id UUID REFERENCES public.agenda_items(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  position INTEGER NOT NULL
);

-- Create attendees table
CREATE TABLE IF NOT EXISTS public.attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT
);

-- Disable RLS on all tables
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees DISABLE ROW LEVEL SECURITY;`}
                    </pre>
                  </div>

                  <p>After running the SQL, you'll also need to create a storage bucket:</p>

                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Go to the Storage section in your Supabase dashboard</li>
                    <li>Create a new bucket named "event-assets"</li>
                    <li>Set the appropriate permissions (public or authenticated access)</li>
                  </ol>

                  <Button onClick={checkDatabase} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Check Database Setup
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center text-muted-foreground text-sm">
          <p>
            Having trouble? Make sure your Supabase connection is properly configured and that you have the necessary
            permissions to create tables.
          </p>
        </div>
      </div>
    )
  }

  // Normal application flow
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

