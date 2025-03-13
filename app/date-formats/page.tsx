"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, RefreshCw } from "lucide-react"

export default function DateFormatsPage() {
  const [dateInfo, setDateInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDateFormats()
  }, [])

  async function fetchDateFormats() {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/debug/date-formats')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch date formats')
      }
      
      setDateInfo(data)
    } catch (err) {
      console.error('Error fetching date formats:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Date Formats Debug</h1>
        <Button 
          onClick={fetchDateFormats}
          variant="outline"
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-full max-w-md" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : dateInfo && dateInfo.data ? (
        <div className="space-y-6">
          <div className="bg-muted px-4 py-3 rounded-md text-sm">
            <p><strong>Utils Version:</strong> {dateInfo.utils_version}</p>
            <p><strong>Events Retrieved:</strong> {dateInfo.data.length}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dateInfo.data.map((event: any) => (
              <Card key={event.id} className="overflow-hidden">
                <CardHeader>
                  <CardTitle>{event.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Tabs defaultValue="raw">
                    <TabsList className="w-full grid grid-cols-4">
                      <TabsTrigger value="raw">Raw</TabsTrigger>
                      <TabsTrigger value="parsed">Parsed</TabsTrigger>
                      <TabsTrigger value="formatted">Formatted</TabsTrigger>
                      <TabsTrigger value="types">Debug</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="raw" className="p-4 space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">start_date:</p>
                          <pre className="bg-muted p-1 rounded text-xs">{JSON.stringify(event.raw.start_date)}</pre>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">end_date:</p>
                          <pre className="bg-muted p-1 rounded text-xs">{JSON.stringify(event.raw.end_date)}</pre>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">created_at:</p>
                          <pre className="bg-muted p-1 rounded text-xs">{JSON.stringify(event.raw.created_at)}</pre>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">start_time:</p>
                          <pre className="bg-muted p-1 rounded text-xs">{JSON.stringify(event.raw.start_time)}</pre>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">end_time:</p>
                          <pre className="bg-muted p-1 rounded text-xs">{JSON.stringify(event.raw.end_time)}</pre>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="parsed" className="p-4 space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">start_date parsed:</p>
                          <pre className="bg-muted p-1 rounded text-xs">{event.parsed_js_dates?.start_date}</pre>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">start_date ISO:</p>
                          <pre className="bg-muted p-1 rounded text-xs">{event.parsed_js_dates?.start_date_iso}</pre>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">start_date locale format:</p>
                          <pre className="bg-muted p-1 rounded text-xs">{event.parsed_js_dates?.start_date_locale}</pre>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <p className="text-xs text-muted-foreground font-semibold">UTC Handling:</p>
                          <p className="text-xs text-muted-foreground mt-1">UTC Date:</p>
                          <pre className="bg-muted p-1 rounded text-xs">{event.parsed_js_dates?.start_date_utc}</pre>
                          <p className="text-xs text-muted-foreground mt-1">UTC Formatted:</p>
                          <pre className="bg-muted p-1 rounded text-xs">{event.parsed_js_dates?.start_date_utc_formatted}</pre>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="formatted" className="p-4 space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">start_date:</p>
                          <p className="font-medium">{event.formatted.start_date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">end_date:</p>
                          <p className="font-medium">{event.formatted.end_date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">created_at:</p>
                          <p className="font-medium">{event.formatted.created_at}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">start_time:</p>
                          <p className="font-medium">{event.formatted.start_time}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">end_time:</p>
                          <p className="font-medium">{event.formatted.end_time}</p>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="types" className="p-4 space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="border-b pb-2 mb-2">
                          <p className="font-medium text-sm">Type Information</p>
                          <div className="grid grid-cols-2 gap-1 mt-1">
                            <p className="text-xs text-muted-foreground">start_date type:</p>
                            <p className="font-mono text-xs">{event.type_info.start_date_type}</p>
                            
                            <p className="text-xs text-muted-foreground">end_date type:</p>
                            <p className="font-mono text-xs">{event.type_info.end_date_type}</p>
                          </div>
                        </div>
                        
                        <div className="border-b pb-2 mb-2">
                          <p className="font-medium text-sm">Formatting Test</p>
                          <div className="grid grid-cols-1 gap-1 mt-1">
                            <p className="text-xs text-muted-foreground">utils.formatDate:</p>
                            <pre className="bg-muted p-1 rounded text-xs">{event.date_utils_test?.utils_format}</pre>
                            
                            <p className="text-xs text-muted-foreground">dateUtils.formatDate:</p>
                            <pre className="bg-muted p-1 rounded text-xs">{event.date_utils_test?.dateUtils_format}</pre>
                            
                            <p className="text-xs text-muted-foreground">formatDateForInput:</p>
                            <pre className="bg-muted p-1 rounded text-xs">{event.date_utils_test?.formatDateForInput}</pre>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
                <CardFooter className="border-t bg-muted/50 p-2">
                  <div className="text-xs text-muted-foreground w-full">
                    Event ID: <span className="font-mono">{event.id}</span>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">No date format information available</p>
        </div>
      )}
    </div>
  )
} 