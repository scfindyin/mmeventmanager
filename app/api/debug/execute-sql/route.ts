import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create a Supabase client with the service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Create the admin client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function POST(request: Request) {
  try {
    const { sql } = await request.json()

    if (!sql) {
      return NextResponse.json({ error: "SQL query is required" }, { status: 400 })
    }

    console.log("Executing SQL:", sql)

    // Try different methods to execute SQL
    let result = null
    let error = null

    // Method 1: Using PostgreSQL function if available
    try {
      const { data, error: rpcError } = await supabaseAdmin.rpc("exec_sql", { sql_query: sql })

      if (!rpcError) {
        console.log("SQL executed successfully with exec_sql RPC")
        result = data
        return NextResponse.json({ success: true, result })
      }

      error = rpcError
      console.error("exec_sql RPC failed:", rpcError)
    } catch (err) {
      console.error("Method 1 failed:", err)
      error = err
    }

    // Method 2: Using raw SQL query
    try {
      // This is a workaround - we'll create a temporary table to store the result
      const tempTableName = `temp_result_${Date.now()}`
      const createTempTable = `CREATE TEMPORARY TABLE ${tempTableName} AS ${sql};`

      const { error: tempError } = await supabaseAdmin.rpc("exec_sql", {
        sql_query: createTempTable,
      })

      if (!tempError) {
        // Now fetch the results
        const { data, error: selectError } = await supabaseAdmin.rpc("exec_sql", {
          sql_query: `SELECT * FROM ${tempTableName};`,
        })

        if (!selectError) {
          console.log("SQL executed successfully with temp table method")
          result = data
          return NextResponse.json({ success: true, result })
        }
      }
    } catch (err) {
      console.error("Method 2 failed:", err)
    }

    // If we got here, all methods failed
    return NextResponse.json(
      {
        success: false,
        error: "Failed to execute SQL using all available methods",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  } catch (error: any) {
    console.error("Error in execute-sql API:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}

