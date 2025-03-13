"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface ErrorDialogProps {
  title?: string
  error: Error | string | null
  onClose?: () => void
}

export function ErrorDialog({ title = "Error", error, onClose }: ErrorDialogProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(!!error)
  }, [error])

  const handleClose = () => {
    setOpen(false)
    if (onClose) onClose()
  }

  if (!error) return null

  const errorMessage = error instanceof Error ? error.message : error

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {title}
          </DialogTitle>
          <DialogDescription>An error occurred while saving data.</DialogDescription>
        </DialogHeader>

        <div className="bg-muted p-3 rounded-md text-sm overflow-auto max-h-[200px]">{errorMessage}</div>

        <DialogFooter>
          <Button onClick={handleClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

