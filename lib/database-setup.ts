import { supabase } from "./supabase"

export async function checkDatabaseSetup() {
  try {
    // Check if the tables exist
    let eventsError = null
    let agendaItemsError = null
    let subItemsError = null
    let attendeesError = null

    try {
      const { error } = await supabase.from("events").select("id").limit(1)
      eventsError = error
    } catch (error) {
      eventsError = { message: error instanceof Error ? error.message : String(error) }
    }

    try {
      const { error } = await supabase.from("agenda_items").select("id").limit(1)
      agendaItemsError = error
    } catch (error) {
      agendaItemsError = { message: error instanceof Error ? error.message : String(error) }
    }

    try {
      const { error } = await supabase.from("sub_items").select("id").limit(1)
      subItemsError = error
    } catch (error) {
      subItemsError = { message: error instanceof Error ? error.message : String(error) }
    }

    try {
      const { error } = await supabase.from("attendees").select("id").limit(1)
      attendeesError = error
    } catch (error) {
      attendeesError = { message: error instanceof Error ? error.message : String(error) }
    }

    // Check if storage bucket exists
    let buckets = []
    let bucketsError = null

    try {
      const { data, error } = await supabase.storage.listBuckets()
      buckets = data || []
      bucketsError = error
    } catch (error) {
      bucketsError = { message: error instanceof Error ? error.message : String(error) }
    }

    const hasEventAssetsBucket = buckets.some((bucket) => bucket.name === "event-assets")

    return {
      tablesExist: !eventsError && !agendaItemsError && !subItemsError && !attendeesError,
      bucketExists: hasEventAssetsBucket,
      errors: {
        events: eventsError?.message,
        agendaItems: agendaItemsError?.message,
        subItems: subItemsError?.message,
        attendees: attendeesError?.message,
        buckets: bucketsError?.message,
      },
    }
  } catch (error) {
    console.error("Error checking database setup:", error)
    return {
      tablesExist: false,
      bucketExists: false,
      errors: {
        general: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

export async function setupDatabase() {
  try {
    // Create events table
    try {
      const { error } = await supabase.from("_sql_queries").insert({
        name: "create_events_table",
        query: `
      CREATE TABLE IF NOT EXISTS public.events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title TEXT NOT NULL,
        subtitle TEXT,
        notes TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        start_time TEXT,
        end_time TEXT,
        logo_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
      })

      if (error) {
        console.error("Error creating events table:", error)
      }
    } catch (error) {
      console.error("Error creating events table:", error)
    }

    // Create agenda_items table
    try {
      const { error } = await supabase.from("_sql_queries").insert({
        name: "create_agenda_items_table",
        query: `
          CREATE TABLE IF NOT EXISTS public.agenda_items (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
            topic TEXT NOT NULL,
            description TEXT,
            duration_minutes INTEGER NOT NULL,
            day_index INTEGER NOT NULL,
            order_position INTEGER NOT NULL,
            start_time TEXT,
            end_time TEXT
          );
        `,
      })

      if (error) {
        console.error("Error creating agenda_items table:", error)
      }
    } catch (error) {
      console.error("Error creating agenda_items table:", error)
    }

    // Create sub_items table
    try {
      const { error } = await supabase.from("_sql_queries").insert({
        name: "create_sub_items_table",
        query: `
          CREATE TABLE IF NOT EXISTS public.sub_items (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            agenda_item_id UUID REFERENCES public.agenda_items(id) ON DELETE CASCADE NOT NULL,
            content TEXT NOT NULL,
            position INTEGER NOT NULL
          );
        `,
      })

      if (error) {
        console.error("Error creating sub_items table:", error)
      }
    } catch (error) {
      console.error("Error creating sub_items table:", error)
    }

    // Create attendees table
    try {
      const { error } = await supabase.from("_sql_queries").insert({
        name: "create_attendees_table",
        query: `
          CREATE TABLE IF NOT EXISTS public.attendees (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
            name TEXT NOT NULL,
            email TEXT
          );
        `,
      })

      if (error) {
        console.error("Error creating attendees table:", error)
      }
    } catch (error) {
      console.error("Error creating attendees table:", error)
    }

    // Check if tables were created successfully
    const setupCheck = await checkDatabaseSetup()

    return {
      success: setupCheck.tablesExist,
      error: !setupCheck.tablesExist ? "Failed to create all required tables" : undefined,
    }
  } catch (error) {
    console.error("Error setting up database:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

