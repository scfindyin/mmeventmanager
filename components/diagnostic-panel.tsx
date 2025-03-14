"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TestSaveButton } from "@/components/test-save-button"
import { FixDescriptionButton } from "@/components/fix-description-button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function DiagnosticPanel() {
  const [itemId, setItemId] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [showButtons, setShowButtons] = useState(false)

  return (
    <Card className="border-dashed border-yellow-500 mb-6">
      <CardHeader>
        <CardTitle className="text-base">Agenda Item Save Diagnostics</CardTitle>
        <CardDescription>Test tools to debug agenda item save issues</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="item-id">Agenda Item ID</Label>
          <div className="flex gap-2">
            <Input 
              id="item-id" 
              value={itemId} 
              onChange={(e) => setItemId(e.target.value)}
              placeholder="Enter agenda item ID"
            />
            <Button 
              variant="secondary" 
              onClick={() => setShowButtons(!!itemId)}
              disabled={!itemId}
            >
              Set
            </Button>
          </div>

          <Label htmlFor="description">Test Description</Label>
          <Input 
            id="description" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a test description"
          />
        </div>

        {showButtons && (
          <div className="border p-4 rounded-md space-y-4 mt-4">
            <Alert>
              <AlertTitle>Testing for Item ID: {itemId}</AlertTitle>
              <AlertDescription>
                Use these buttons to test different save methods
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Direct Save (API with admin)</h3>
              <FixDescriptionButton 
                itemId={itemId} 
                description={description || 'Test description from diagnostic panel'} 
              />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Standard Supabase Save</h3>
              <TestSaveButton 
                itemId={itemId} 
                description={description || 'Test description from diagnostic panel'}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 