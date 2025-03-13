"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Database, Play, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function DebugPage() {
  const [sql, setSql] = useState(
    `
-- Check if start_time and end_time columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('start_time', 'end_time');

-- Add columns if they don't exist
-- ALTER TABLE public.events 
-- ADD COLUMN IF NOT EXISTS start_time TEXT,
-- ADD COLUMN IF NOT EXISTS end_time TEXT;
  `.trim(),
  )

  const [isExecuting, setIsExecuting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [tableInfo, setTableInfo] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  async function executeSQL() {
    if (!sql.trim()) return

    setIsExecuting(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/debug/execute-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute SQL")
      }

      setResult(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsExecuting(false)
    }
  }

  async function fetchTableInfo() {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from("information_schema.columns")
        .select("column_name, data_type, is_nullable")
        .eq("table_name", "events")
        .order("column_name")

      if (error) throw error

      setTableInfo(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))

      // Try with the API
      try {
        const sqlQuery = `
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = 'events'
          ORDER BY column_name;
        `

        const response = await fetch("/api/debug/execute-sql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql: sqlQuery }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch table info")
        }

        setTableInfo(data.result || [])
      } catch (apiErr) {
        setError(
          (err instanceof Error ? err.message : String(err)) +
            "\n\nAPI fallback also failed: " +
            (apiErr instanceof Error ? apiErr.message : String(apiErr)),
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function addTimeColumns() {
    setIsLoading(true)
    setError(null)

    try {
      const sqlQuery = `
        ALTER TABLE public.events 
        ADD COLUMN IF NOT EXISTS start_time TEXT,
        ADD COLUMN IF NOT EXISTS end_time TEXT;
      `

      const response = await fetch("/api/debug/execute-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql: sqlQuery }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add columns")
      }

      // Refresh table info
      await fetchTableInfo()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Database Debug Tools</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Table Information</CardTitle>
            <CardDescription>View and manage the events table structure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <Button onClick={fetchTableInfo} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Fetch Table Info
                    </>
                  )}
                </Button>

                <Button onClick={addTimeColumns} disabled={isLoading} variant="outline">
                  Add Time Columns
                </Button>
              </div>

              {tableInfo.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">Column</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Nullable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableInfo.map((column, index) => (
                        <tr key={index} className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                          <td className="px-4 py-2">{column.column_name}</td>
                          <td className="px-4 py-2">{column.data_type}</td>
                          <td className="px-4 py-2">{column.is_nullable === "YES" ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  {isLoading ? "Loading..." : "No table information available"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execute SQL</CardTitle>
            <CardDescription>Run SQL queries directly against the database</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="font-mono text-sm h-40"
              placeholder="Enter SQL to execute"
            />

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap font-mono text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="mt-4 space-y-2">
                <h3 className="font-medium">Result:</h3>
                <div className="bg-muted p-4 rounded-md overflow-auto max-h-60">
                  <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={executeSQL} disabled={isExecuting} className="w-full">
              {isExecuting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Execute SQL
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Common SQL Fixes</CardTitle>
          <CardDescription>Quick SQL snippets to fix common issues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Add Time Columns</h3>
              <pre className="bg-muted p-3 rounded-md text-xs">
                {`ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS start_time TEXT,
ADD COLUMN IF NOT EXISTS end_time TEXT;`}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSql(`ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS start_time TEXT,
ADD COLUMN IF NOT EXISTS end_time TEXT;`)
                }}
              >
                Use This SQL
              </Button>
            </div>

            <div>
              <h3 className="font-medium mb-2">Check Column Existence</h3>
              <pre className="bg-muted p-3 rounded-md text-xs">
                {`SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('start_time', 'end_time');`}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSql(`SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('start_time', 'end_time');`)
                }}
              >
                Use This SQL
              </Button>
            </div>

            <div>
              <h3 className="font-medium mb-2">Disable Row Level Security</h3>
              <pre className="bg-muted p-3 rounded-md text-xs">
                {`ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees DISABLE ROW LEVEL SECURITY;`}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSql(`ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees DISABLE ROW LEVEL SECURITY;`)
                }}
              >
                Use This SQL
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

