"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

export function TestSaveButton({ 
  itemId, 
  description 
}: { 
  itemId: string; 
  description?: string 
}) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()

  async function handleTestSave() {
    if (!itemId || isUpdating) return

    setIsUpdating(true)
    setError(null)
    setResult(null)
    
    try {
      console.log('🧪 Testing save functionality for item:', itemId)
      
      // First, fetch current item data
      console.log('Fetching current item data...')
      const { data: currentItem, error: fetchError } = await supabase
        .from('agenda_items')
        .select('*')
        .eq('id', itemId)
        .single()
      
      if (fetchError || !currentItem) {
        throw new Error(`Failed to fetch item: ${fetchError?.message || 'Item not found'}`)
      }
      
      console.log('Current item data:', currentItem)
      
      // Use the provided description or fall back to a timestamp-based one
      const timestamp = new Date().toISOString()
      const descriptionToSave = description || `Test update at ${timestamp}`
      
      console.log(`Preparing test update with description: "${descriptionToSave}"`)
      
      // Try direct update using Supabase client
      console.log('Attempting direct update via Supabase client...')
      const { data: updateResult, error: updateError } = await supabase
        .from('agenda_items')
        .update({ description: descriptionToSave })
        .eq('id', itemId)
        .select()
      
      console.log('Direct update result:', { data: updateResult, error: updateError })
      
      if (updateError) {
        throw new Error(`Direct update failed: ${updateError.message}`)
      }
      
      // Verify the update
      console.log('Verifying update...')
      const { data: verifiedItem, error: verifyError } = await supabase
        .from('agenda_items')
        .select('*')
        .eq('id', itemId)
        .single()
        
      if (verifyError || !verifiedItem) {
        throw new Error(`Verification failed: ${verifyError?.message || 'Could not retrieve updated item'}`)
      }
      
      console.log('Updated item data:', verifiedItem)
      
      // Set the result for display
      setResult({
        originalItem: currentItem,
        updateResult,
        verifiedItem
      })
      
      toast({
        title: "Test save succeeded",
        description: `Description updated to: "${verifiedItem.description}"`,
      })
    } catch (error) {
      console.error('Error in test save:', error)
      setError(error instanceof Error ? error.message : "An unknown error occurred")
      toast({
        title: "Test save failed",
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
        variant="outline"
        size="sm"
        onClick={handleTestSave}
        disabled={isUpdating}
      >
        {isUpdating ? "Testing..." : "Test Direct Save"}
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