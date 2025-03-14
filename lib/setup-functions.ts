import { supabase } from "./supabase"
import { supabaseAdmin } from "./supabase-admin"

export async function createSetupFunctions() {
  try {
    // First check if the tables already exist - if they do, we don't need to do anything
    try {
      const { error: eventsError } = await supabase.from("events").select("id").limit(1)
      if (!eventsError) {
        console.log("Tables already exist, skipping setup")
        return { success: true }
      }
    } catch (error) {
      // Table doesn't exist, continue with setup
      console.log("Events table doesn't exist, will try to create tables")
    }

    console.log("Creating tables directly")

    // Try direct SQL using the admin client if available
    try {
      await createTablesWithDirectSQL()
      return { success: true }
    } catch (error) {
      console.error("Error creating tables with direct SQL:", error)
      
      // Fall back to our original approach
      try {
        await createTablesWithRPC()
        return { success: true }
      } catch (fallbackError) {
        console.error("Error creating tables with RPC:", fallbackError)
        return { 
          success: false, 
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }
      }
    }
  } catch (error) {
    console.error("Error in createSetupFunctions:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function createTablesWithDirectSQL() {
  // Use the admin client to run SQL directly
  if (!supabaseAdmin) {
    throw new Error("Admin client not available, cannot create tables with direct SQL")
  }

  // Create the tables directly with SQL
  await supabaseAdmin.rpc('exec', { 
    query: `
      -- First create the UUID extension if it doesn't exist
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Create events table
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
      
      -- Create agenda_items table
      CREATE TABLE IF NOT EXISTS public.agenda_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
        topic TEXT NOT NULL,
        description TEXT,
        duration_minutes INTEGER NOT NULL,
        day_index INTEGER NOT NULL,
        order_position INTEGER NOT NULL,
        start_time TEXT,
        end_time TEXT,
        sub_items TEXT[] DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
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
      
      -- Create update description function
      CREATE OR REPLACE FUNCTION update_agenda_item_description(
        item_id UUID,
        new_description TEXT,
        new_topic TEXT,
        new_duration INTEGER
      )
      RETURNS BOOLEAN AS $$
      BEGIN
        UPDATE public.agenda_items
        SET 
          description = new_description,
          topic = new_topic,
          duration_minutes = new_duration,
          updated_at = timezone('utc', now())
        WHERE id = item_id;
        
        RETURN FOUND;
      END;
      $$ LANGUAGE plpgsql;
    `
  })
}

// Original approach using RPC functions
async function createTablesWithRPC() {
  // Try creating tables with RPC functions
  try {
    await supabase.from("events").select("id").limit(1)
  } catch (error) {
    try {
      const { error: createError } = await supabase.rpc("create_events_table")
      if (createError) {
        console.log("Creating events table through _sql_queries")
        await createEventsTable()
      }
    } catch (error) {
      console.log("Creating events table through _sql_queries")
      await createEventsTable()
    }
  }

  try {
    await supabase.from("agenda_items").select("id").limit(1)
  } catch (error) {
    try {
      const { error: createError } = await supabase.rpc("create_agenda_items_table")
      if (createError) {
        console.log("Creating agenda_items table through _sql_queries")
        await createAgendaItemsTable()
      }
    } catch (error) {
      console.log("Creating agenda_items table through _sql_queries")
      await createAgendaItemsTable()
    }
  }

  try {
    await supabase.from("sub_items").select("id").limit(1)
  } catch (error) {
    try {
      const { error: createError } = await supabase.rpc("create_sub_items_table")
      if (createError) {
        console.log("Creating sub_items table through _sql_queries")
        await createSubItemsTable()
      }
    } catch (error) {
      console.log("Creating sub_items table through _sql_queries")
      await createSubItemsTable()
    }
  }

  try {
    await supabase.from("attendees").select("id").limit(1)
  } catch (error) {
    try {
      const { error: createError } = await supabase.rpc("create_attendees_table")
      if (createError) {
        console.log("Creating attendees table through _sql_queries")
        await createAttendeesTable()
      }
    } catch (error) {
      console.log("Creating attendees table through _sql_queries")
      await createAttendeesTable()
    }
  }

  // Also create the update description function
  try {
    const result = await createUpdateDescriptionFunction()
    if (!result.success) {
      console.error("Failed to create update_agenda_item_description function:", result.error)
    }
  } catch (error) {
    console.error("Error creating update description function:", error)
  }
}

// Helper functions to create tables using _sql_queries
async function createEventsTable() {
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
      throw error
    }
  } catch (error) {
    console.error("Failed to use _sql_queries table, it might not exist:", error)
    throw new Error("Cannot create tables: _sql_queries table not available")
  }
}

async function createAgendaItemsTable() {
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
        end_time TEXT,
        sub_items TEXT[] DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
      );

      -- Add trigger to update updated_at timestamp
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = timezone('utc', now());
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_agenda_items_updated_at ON agenda_items;
      CREATE TRIGGER update_agenda_items_updated_at
        BEFORE UPDATE ON agenda_items
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `,
  })

  if (error) {
    console.error("Error creating agenda_items table:", error)
    throw error
  }
}

async function createSubItemsTable() {
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
    throw error
  }
}

async function createAttendeesTable() {
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
    throw error
  }
}

export async function createUpdateDescriptionFunction() {
  try {
    const { error } = await supabase.from("_sql_queries").insert({
      name: "create_update_description_function",
      query: `
        CREATE OR REPLACE FUNCTION update_agenda_item_description(
          item_id UUID,
          new_description TEXT,
          new_topic TEXT,
          new_duration INTEGER
        )
        RETURNS BOOLEAN AS $$
        BEGIN
          UPDATE public.agenda_items
          SET 
            description = new_description,
            topic = new_topic,
            duration_minutes = new_duration,
            updated_at = timezone('utc', now())
          WHERE id = item_id;
          
          RETURN FOUND;
        END;
        $$ LANGUAGE plpgsql;
      `,
    })

    if (error) {
      console.error("Error creating update_agenda_item_description function:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Failed to create update_agenda_item_description function:", error)
    return { 
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

