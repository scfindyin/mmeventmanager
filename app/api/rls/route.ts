import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create a Supabase client with the service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

// This endpoint will disable RLS on all tables
export async function POST() {
  try {
    console.log("Attempting to disable RLS with service role key:", !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Disable RLS on events table
    const { error: eventsError } = await supabaseAdmin.rpc("disable_rls", { table_name: "events" })
    if (eventsError) {
      console.error("Error disabling RLS on events table:", eventsError)
      return NextResponse.json({ error: eventsError.message }, { status: 400 })
    }

    // Disable RLS on agenda_items table
    const { error: agendaItemsError } = await supabaseAdmin.rpc("disable_rls", { table_name: "agenda_items" })
    if (agendaItemsError) {
      console.error("Error disabling RLS on agenda_items table:", agendaItemsError)
      return NextResponse.json({ error: agendaItemsError.message }, { status: 400 })
    }

    // Disable RLS on sub_items table
    const { error: subItemsError } = await supabaseAdmin.rpc("disable_rls", { table_name: "sub_items" })
    if (subItemsError) {
      console.error("Error disabling RLS on sub_items table:", subItemsError)
      return NextResponse.json({ error: subItemsError.message }, { status: 400 })
    }

    // Disable RLS on attendees table
    const { error: attendeesError } = await supabaseAdmin.rpc("disable_rls", { table_name: "attendees" })
    if (attendeesError) {
      console.error("Error disabling RLS on attendees table:", attendeesError)
      return NextResponse.json({ error: attendeesError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in disable RLS API:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

// This endpoint will create the disable_rls function in Supabase
export async function PUT() {
  try {
    console.log(
      "Attempting to create disable_rls function with service role key:",
      !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    // Create the disable_rls function
    const { error } = await supabaseAdmin.rpc("execute_sql", {
      sql: `
        CREATE OR REPLACE FUNCTION public.disable_rls(table_name text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', table_name);
        END;
        $$;
      `,
    })

    if (error) {
      console.error("Error creating disable_rls function:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in create disable_rls function API:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

// This endpoint will directly execute SQL to disable RLS
export async function GET() {
  try {
    console.log("Attempting to directly disable RLS with service role key:", !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Directly execute SQL to disable RLS on all tables
    const { error } = await supabaseAdmin.rpc("execute_sql", {
      sql: `
        ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.agenda_items DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.sub_items DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.attendees DISABLE ROW LEVEL SECURITY;
      `,
    })

    if (error) {
      console.error("Error directly disabling RLS:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in direct disable RLS API:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

