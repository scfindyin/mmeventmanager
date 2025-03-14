"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

export function FixDescriptionButton({ itemId, description }: { itemId: string; description: string }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()

  async function handleUpdateDescription() {
    if (!itemId || isUpdating) return

    setIsUpdating(true)
    setError(null)
    setResult(null)
    
    try {
      console.log('🔧 Attempting direct SQL update via API endpoint')
      
      // Try the simple test endpoint first
      const testResponse = await fetch('/api/agenda-items/direct-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          itemId, 
          description
        }),
      })
      
      const testResult = await testResponse.json()
      setResult(testResult)

      console.log('Direct test result:', testResult)
      
      if (!testResponse.ok) {
        throw new Error(`Test API failed: ${testResult.error || 'Unknown error'}`)
      }
      
      // Now use the main endpoint
      const response = await fetch('/api/agenda-items/fix-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          itemId, 
          description,
          useDirectSql: true  // Indicate we want the SQL approach
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'API endpoint failed')
      }
      
      const result = await response.json()
      console.log('Direct SQL via API result:', result)
      
      // Verify the update by checking our local database
      const { data: verifyData, error: verifyError } = await supabase
        .from('agenda_items')
        .select('description')
        .eq('id', itemId)
        .single()
      
      if (verifyError) {
        console.warn('Verification failed:', verifyError)
        // Still continue, since the API call was successful
      } else {
        console.log('Verification result:', verifyData)
      }
      
      toast({
        title: "Description updated via SQL",
        description: `Successfully updated description to: "${result.description || 'empty'}"`,
      })
    } catch (error) {
      console.error('Error updating description:', error)
      setError(error instanceof Error ? error.message : "An unknown error occurred")
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleUpdateDescription}
        disabled={isUpdating}
      >
        {isUpdating ? "Updating..." : "Force Update Description"}
      </Button>
      
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="text-sm overflow-auto max-h-40">
            {error}
          </AlertDescription>
        </Alert>
      )}
      
      {result && (
        <Alert>
          <AlertTitle>Test Result</AlertTitle>
          <AlertDescription className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
} 