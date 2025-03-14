"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import "./date-picker.css"

export interface DatePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  label?: string
  className?: string
  minDate?: Date
}

export function DatePicker({
  date,
  setDate,
  label = "Pick a date",
  className,
  minDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = React.useCallback((newDate: Date | undefined) => {
    setDate(newDate);
    setOpen(false);
  }, [setDate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[240px] pl-3 text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="date-picker-calendar">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            initialFocus
            disabled={minDate ? (date: Date) => date < minDate : undefined}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
} 