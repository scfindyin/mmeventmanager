import { createClient } from "@supabase/supabase-js"
import type { Event } from "@/types/event"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

const supabase = createClient(supabaseUrl, supabaseKey)

// Default event data for initial setup
const defaultEvent: Event = {
  id: "1",
  title: "Sample Event",
  subtitle: "Planning Session",
  notes: "This is a sample event to demonstrate the agenda management functionality.",
  startDate: new Date().toISOString(),
  endDate: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(),
  hoursOfOperation: {
    [new Date().toISOString().split("T")[0]]: {
      startTime: "09:00",
      endTime: "17:00",
    },
    [new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split("T")[0]]: {
      startTime: "09:00",
      endTime: "17:00",
    },
    [new Date(new Date().setDate(new Date().getDate() + 2)).toISOString().split("T")[0]]: {
      startTime: "09:00",
      endTime: "17:00",
    },
  },
  attendees: [
    { id: "1", name: "John Doe", email: "john@example.com" },
    { id: "2", name: "Jane Smith", email: "jane@example.com" },
  ],
  agendaItems: [
    {
      id: "1",
      topic: "Welcome and Introduction",
      durationMinutes: 30,
      subItems: ["Team introductions", "Overview of agenda"],
      day: new Date().toISOString().split("T")[0],
      order: 0,
      startTime: "",
      endTime: "",
    },
    {
      id: "2",
      topic: "Project Status Update",
      durationMinutes: 60,
      subItems: ["Current progress", "Blockers", "Next steps"],
      day: new Date().toISOString().split("T")[0],
      order: 1,
      startTime: "",
      endTime: "",
    },
  ],
}

// Function to fetch event data
export async function fetchEventData(): Promise<Event> {
  try {
    // Check if we have any events in the database
    const { data, error } = await supabase.from("events").select("*").limit(1).single()

    if (error) {
      console.error("Error fetching event:", error)

      // If there's an error (like no events exist), create a default event
      if (error.code === "PGRST116") {
        return await createDefaultEvent()
      }

      throw error
    }

    return data as Event
  } catch (error) {
    console.error("Error in fetchEventData:", error)
    return await createDefaultEvent()
  }
}

// Function to create a default event if none exists
async function createDefaultEvent(): Promise<Event> {
  try {
    // If Supabase is properly configured, save the default event
    if (supabaseUrl && supabaseKey) {
      const { data, error } = await supabase.from("events").insert(defaultEvent).select().single()

      if (error) {
        console.error("Error creating default event:", error)
        return defaultEvent
      }

      return data as Event
    } else {
      // If Supabase is not configured, just return the default event
      console.warn("Supabase not configured, using mock data")
      return defaultEvent
    }
  } catch (error) {
    console.error("Error in createDefaultEvent:", error)
    return defaultEvent
  }
}

// Function to save event data
export async function saveEventData(event: Event): Promise<void> {
  try {
    // If Supabase is properly configured, save the event
    if (supabaseUrl && supabaseKey) {
      const { error } = await supabase.from("events").upsert(event)

      if (error) {
        console.error("Error saving event:", error)
        throw error
      }
    } else {
      // If Supabase is not configured, just log a warning
      console.warn("Supabase not configured, changes will not be saved")
    }
  } catch (error) {
    console.error("Error in saveEventData:", error)
    throw error
  }
}

