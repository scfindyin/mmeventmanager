"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { DatePickerWithRange } from "./date-picker-with-range"
import { HoursOfOperation } from "./hours-of-operation"
import { AttendeeList } from "./attendee-list"
import type { Event } from "@/types/event"
import type { DateRange } from "react-day-picker"

interface EventDetailsProps {
  event: Event
  onEventUpdate: (event: Event) => void
}

export function EventDetails({ event, onEventUpdate }: EventDetailsProps) {
  const [title, setTitle] = useState(event.title)
  const [subtitle, setSubtitle] = useState(event.subtitle || "")
  const [notes, setNotes] = useState(event.notes || "")
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(event.startDate),
    to: new Date(event.endDate),
  })
  const [hoursOfOperation, setHoursOfOperation] = useState(event.hoursOfOperation)
  const [attendees, setAttendees] = useState(event.attendees)

  const handleSave = () => {
    if (!dateRange?.from || !dateRange?.to) {
      return
    }

    const updatedEvent: Event = {
      ...event,
      title,
      subtitle,
      notes,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      hoursOfOperation,
      attendees,
    }

    onEventUpdate(updatedEvent)
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Event Information</CardTitle>
          <CardDescription>Enter the basic details about your event</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-3">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="subtitle">Subtitle (Optional)</Label>
            <Input
              id="subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Enter event subtitle"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional notes about the event"
              rows={4}
            />
          </div>

          <div className="grid gap-3">
            <Label>Event Date Range</Label>
            <DatePickerWithRange dateRange={dateRange} onDateRangeChange={setDateRange} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hours of Operation</CardTitle>
          <CardDescription>Set the daily start and end times for your event</CardDescription>
        </CardHeader>
        <CardContent>
          <HoursOfOperation
            hoursOfOperation={hoursOfOperation}
            dateRange={dateRange}
            onHoursChange={setHoursOfOperation}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendees</CardTitle>
          <CardDescription>Manage the list of attendees for this event</CardDescription>
        </CardHeader>
        <CardContent>
          <AttendeeList attendees={attendees} onAttendeesChange={setAttendees} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Save Event Details</Button>
      </div>
    </div>
  )
}

