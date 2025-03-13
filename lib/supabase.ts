import { createClient } from "@supabase/supabase-js"
import type { Event, AgendaItem, SubItem, Attendee } from "./types"

// Access the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable")
}

if (!supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable")
}

// Create a singleton instance
let supabaseInstance: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance

  supabaseInstance = createClient(supabaseUrl || "", supabaseKey || "", {
    db: {
      schema: "public",
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: {
        "x-application-name": "event-agenda-manager",
      },
    },
  })

  return supabaseInstance
}

// Export the singleton instance
export const supabase = getSupabaseClient()

export type Database = {
  public: {
    Tables: {
      events: {
        Row: Event
        Insert: Omit<Event, "id" | "created_at">
        Update: Partial<Omit<Event, "id" | "created_at">>
      }
      agenda_items: {
        Row: AgendaItem
        Insert: Omit<AgendaItem, "id">
        Update: Partial<Omit<AgendaItem, "id">>
      }
      sub_items: {
        Row: SubItem
        Insert: Omit<SubItem, "id">
        Update: Partial<Omit<SubItem, "id">>
      }
      attendees: {
        Row: Attendee
        Insert: Omit<Attendee, "id">
        Update: Partial<Omit<Attendee, "id">>
      }
    }
  }
}

// Export types from types.ts
export type { Event, AgendaItem, SubItem, Attendee } from "./types"

