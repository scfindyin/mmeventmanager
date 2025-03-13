"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { AlertCircle, CheckCircle2, Database } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function SupabaseConnectionPage() {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [connectionMessage, setConnectionMessage] = useState<string>('')
  const [envVars, setEnvVars] = useState<{url?: string, key?: string}>({})
  const [tablesStatus, setTablesStatus] = useState<{[key: string]: boolean}>({})
  const [logs, setLogs] = useState<string[]>([])

  // Add a log message
  const addLog = (message: string) => {
    console.log(message)
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`])
  }

  useEffect(() => {
    // Check if environment variables are defined in client-side
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    setEnvVars({
      url: supabaseUrl || undefined,
      key: supabaseKey ? '****' + supabaseKey.substring(supabaseKey.length - 8) : undefined
    })

    if (supabaseUrl && supabaseKey) {
      addLog("Supabase environment variables are defined")
    } else {
      addLog("Supabase environment variables are missing")
    }
  }, [])

  const testConnection = async () => {
    setConnectionStatus('testing')
    addLog("Testing Supabase connection...")
    
    try {
      // Check if we can query the database
      const start = Date.now()
      const { data, error } = await supabase.from('events').select('id').limit(1)
      const duration = Date.now() - start
      
      if (error) {
        setConnectionStatus('error')
        setConnectionMessage(`Error: ${error.message}`)
        addLog(`Connection failed: ${error.message}`)
        return
      }
      
      setConnectionStatus('success')
      setConnectionMessage(`Connected successfully in ${duration}ms`)
      addLog(`Connection successful (${duration}ms)`)
      
      // Check all tables
      await checkTables()
    } catch (error) {
      setConnectionStatus('error')
      setConnectionMessage(`Exception: ${error instanceof Error ? error.message : String(error)}`)
      addLog(`Connection exception: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const checkTables = async () => {
    const tables = ['events', 'agenda_items', 'sub_items', 'attendees']
    const statuses: {[key: string]: boolean} = {}
    
    for (const table of tables) {
      try {
        addLog(`Checking table: ${table}...`)
        const { error } = await supabase.from(table).select('id').limit(1)
        statuses[table] = !error
        addLog(`Table ${table}: ${!error ? 'OK' : 'ERROR - ' + error.message}`)
      } catch (err) {
        statuses[table] = false
        addLog(`Table ${table} check failed with exception`)
      }
    }
    
    setTablesStatus(statuses)
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Supabase Connection Checker</h1>
      
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Supabase Configuration
            </CardTitle>
            <CardDescription>
              Check your Supabase connection settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">Environment Variables</h3>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <span className="inline-block w-36">Project URL:</span>
                    {envVars.url ? (
                      <span className="text-green-600 font-medium">{envVars.url}</span>
                    ) : (
                      <span className="text-red-600 font-medium">Not set</span>
                    )}
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-36">API Key:</span>
                    {envVars.key ? (
                      <span className="text-green-600 font-medium">{envVars.key}</span>
                    ) : (
                      <span className="text-red-600 font-medium">Not set</span>
                    )}
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Connection Status</h3>
                {connectionStatus === 'idle' && (
                  <p className="text-gray-500">Not tested yet</p>
                )}
                {connectionStatus === 'testing' && (
                  <p className="text-blue-500">Testing connection...</p>
                )}
                {connectionStatus === 'success' && (
                  <p className="text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {connectionMessage}
                  </p>
                )}
                {connectionStatus === 'error' && (
                  <p className="text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {connectionMessage}
                  </p>
                )}
              </div>
            </div>
            
            <div className="pt-4">
              <Button onClick={testConnection} disabled={connectionStatus === 'testing'}>
                {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
            
            {Object.keys(tablesStatus).length > 0 && (
              <div className="pt-4">
                <h3 className="font-medium mb-2">Tables Status</h3>
                <ul className="space-y-2">
                  {Object.entries(tablesStatus).map(([table, exists]) => (
                    <li key={table} className="flex items-center">
                      <span className="inline-block w-36">{table}:</span>
                      {exists ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          OK
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          Not found
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Connection Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="logs">
              <AccordionTrigger>View Logs ({logs.length})</AccordionTrigger>
              <AccordionContent>
                <div className="bg-gray-100 p-3 rounded max-h-60 overflow-auto">
                  {logs.length > 0 ? (
                    <ul className="space-y-1 font-mono text-sm">
                      {logs.map((log, i) => (
                        <li key={i}>{log}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No logs yet</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
      
      <div className="mt-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Need to update your Supabase configuration?</AlertTitle>
          <AlertDescription>
            <p className="mb-2">Update the <code className="bg-gray-100 px-1 py-0.5 rounded">.env.local</code> file with your Supabase credentials and restart the server.</p>
            <p>You can find your Project URL and API Key in the Supabase Dashboard under Project Settings &gt; API.</p>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
} 