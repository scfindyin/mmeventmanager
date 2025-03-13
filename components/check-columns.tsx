"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw, CheckCircle, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

export function CheckColumns() {
  const [isChecking, setIsChecking] = useState(false)
  const [columns, setColumns] = useState<{ [key: string]: boolean }>({})
  const { toast } = useToast()

  const checkColumns = async () => {
    setIsChecking(true)
    try {
      // Try to get column information
      const { data, error } = await supabase.rpc("get_column_info", {
        table_name: "events",
      })

      if (error) {
        throw error
      }

      // Process column data
      const columnMap: { [key: string]: boolean } = {}
      if (Array.isArray(data)) {
        data.forEach((col) => {
          columnMap[col.column_name] = true
        })
      }

      setColumns(columnMap)
    } catch (error) {
      console.error("Error checking columns:", error)

      // Fallback method - try to query the table
      try {
        const { data, error: queryError } = await supabase.from("events").select("start_time, end_time").limit(1)

        if (!queryError) {
          setColumns({
            start_time: true,
            end_time: true,
          })
        } else if (queryError.message.includes("column") && queryError.message.includes("does not exist")) {
          // Parse the error message to determine which column doesn't exist
          const missingStartTime = queryError.message.includes("start_time")
          const missingEndTime = queryError.message.includes("end_time")

          setColumns({
            start_time: !missingStartTime,
            end_time: !missingEndTime,
          })
        } else {
          throw queryError
        }
      } catch (fallbackError) {
        toast({
          title: "Error Checking Columns",
          description: fallbackError instanceof Error ? fallbackError.message : "An unexpected error occurred",
          variant: "destructive",
        })
      }
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    checkColumns()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Column Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              {columns.start_time ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span>start_time column</span>
            </div>
            <div className="flex items-center gap-2">
              {columns.end_time ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span>end_time column</span>
            </div>
          </div>

          <Button onClick={checkColumns} disabled={isChecking} variant="outline" className="gap-2">
            {isChecking ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh Status
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

