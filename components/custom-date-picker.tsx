"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

interface CustomDatePickerProps {
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  label: string
  disabled?: (date: Date) => boolean
  className?: string
}

export function CustomDatePicker({ date, onDateChange, label, disabled, className }: CustomDatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Format the date for display
  const formattedDate = date ? format(date, "PPP") : undefined

  // Handle date selection
  const handleSelect = (selectedDate: Date | undefined) => {
    // Set time to noon to avoid timezone issues
    if (selectedDate) {
      selectedDate.setHours(12, 0, 0, 0)
    }
    onDateChange(selectedDate)
    setOpen(false) // Explicitly close the popover
  }

  return (
    <FormItem className={cn("flex flex-col", className)}>
      <FormLabel>{label}</FormLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              className={cn("w-full pl-3 text-left font-normal", !date && "text-muted-foreground")}
            >
              {formattedDate || <span>Pick a date</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={handleSelect} disabled={disabled} initialFocus />
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  )
}

