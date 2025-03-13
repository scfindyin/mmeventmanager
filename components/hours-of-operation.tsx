"use client"

import { useState, useEffect } from "react"
import type { DateRange } from "react-day-picker"
import { format, addDays, differenceInDays, isValid } from "date-fns"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"
import type { HoursOfOperationType } from "@/types/event"

interface HoursOfOperationProps {
  hoursOfOperation: HoursOfOperationType
  dateRange: DateRange | undefined
  onHoursChange: (hours: HoursOfOperationType) => void
}

export function HoursOfOperation({ hoursOfOperation, dateRange, onHoursChange }: HoursOfOperationProps) {
  const [days, setDays] = useState<{ date: Date; startTime: string; endTime: string }[]>([])

  useEffect(() => {
    if (dateRange?.from && dateRange?.to && isValid(dateRange.from) && isValid(dateRange.to)) {
      const dayCount = differenceInDays(dateRange.to, dateRange.from) + 1
      const newDays = []

      for (let i = 0; i < dayCount; i++) {
        const date = addDays(dateRange.from, i)
        const dateStr = format(date, "yyyy-MM-dd")
        const existingHours = hoursOfOperation[dateStr]

        newDays.push({
          date,
          startTime: existingHours?.startTime || "09:00",
          endTime: existingHours?.endTime || "17:00",
        })
      }

      setDays(newDays)
    }
  }, [dateRange, hoursOfOperation])

  const handleTimeChange = (index: number, field: "startTime" | "endTime", value: string) => {
    const updatedDays = [...days]
    updatedDays[index] = {
      ...updatedDays[index],
      [field]: value,
    }
    setDays(updatedDays)

    // Update the hours of operation
    const updatedHours = { ...hoursOfOperation }
    const dateStr = format(updatedDays[index].date, "yyyy-MM-dd")
    updatedHours[dateStr] = {
      startTime: updatedDays[index].startTime,
      endTime: updatedDays[index].endTime,
    }

    onHoursChange(updatedHours)
  }

  const copyToDays = (sourceIndex: number) => {
    const sourceDay = days[sourceIndex]
    const updatedDays = days.map((day, i) => {
      if (i !== sourceIndex) {
        return {
          ...day,
          startTime: sourceDay.startTime,
          endTime: sourceDay.endTime,
        }
      }
      return day
    })

    setDays(updatedDays)

    // Update all hours of operation
    const updatedHours = { ...hoursOfOperation }
    updatedDays.forEach((day) => {
      const dateStr = format(day.date, "yyyy-MM-dd")
      updatedHours[dateStr] = {
        startTime: day.startTime,
        endTime: day.endTime,
      }
    })

    onHoursChange(updatedHours)
  }

  if (!dateRange?.from || !dateRange?.to) {
    return <div>Please select a date range first</div>
  }

  return (
    <div className="space-y-4">
      {days.map((day, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div>
            <Label className="mb-2 block">{format(day.date, "EEEE, MMMM d, yyyy")}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={day.startTime}
                onChange={(e) => handleTimeChange(index, "startTime", e.target.value)}
              />
              <span>to</span>
              <Input
                type="time"
                value={day.endTime}
                onChange={(e) => handleTimeChange(index, "endTime", e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => copyToDays(index)}
              title="Apply these hours to all days"
            >
              <Copy className="h-4 w-4" />
              <span className="sr-only">Copy to all days</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

