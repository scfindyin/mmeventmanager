"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Shield, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function RLSFixButton() {
  const [isDisabling, setIsDisabling] = useState(false)
  const [success, setSuccess] = useState(false)
  const { toast } = useToast()

  const disableRLS = async () => {
    setIsDisabling(true)
    setSuccess(false)

    try {
      // First try to create the function
      await fetch("/api/rls", { method: "PUT" })

      // Then try to use the function
      const response = await fetch("/api/rls", { method: "POST" })

      if (!response.ok) {
        // If that fails, try direct SQL
        const directResponse = await fetch("/api/rls")

        if (!directResponse.ok) {
          throw new Error("Failed to disable RLS")
        }
      }

      setSuccess(true)
      toast({
        title: "RLS Disabled",
        description: "Row Level Security has been disabled on all tables.",
      })
    } catch (error) {
      console.error("Error disabling RLS:", error)
      toast({
        title: "Error Disabling RLS",
        description: "There was an error disabling Row Level Security. Please check the console for details.",
        variant: "destructive",
      })
    } finally {
      setIsDisabling(false)
    }
  }

  return (
    <Button
      variant={success ? "outline" : "destructive"}
      onClick={disableRLS}
      disabled={isDisabling || success}
      className="gap-2"
    >
      {isDisabling ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Disabling RLS...
        </>
      ) : success ? (
        <>
          <CheckCircle className="h-4 w-4" />
          RLS Disabled
        </>
      ) : (
        <>
          <Shield className="h-4 w-4" />
          Disable RLS
        </>
      )}
    </Button>
  )
}

