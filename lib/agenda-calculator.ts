import { type Event, type AgendaItem } from "@/lib/types"
import { parseISO, format, addMinutes, isAfter, differenceInDays, isSameDay } from "date-fns"

export function calculateAgendaTimes(event: Event): AgendaItem[] {
  // Group agenda items by day index
  const itemsByDay: { [dayIndex: number]: AgendaItem[] } = {}

  event.agendaItems.forEach((item) => {
    if (!itemsByDay[item.dayIndex]) {
      itemsByDay[item.dayIndex] = []
    }
    itemsByDay[item.dayIndex].push(item)
  })

  // Process each day's items
  const updatedItems: AgendaItem[] = []

  // Process days in chronological order
  const sortedDayIndices = Object.keys(itemsByDay).map(Number).sort()
  
  sortedDayIndices.forEach((dayIndex) => {
    // Get the date for this day
    const date = addMinutes(parseISO(event.startDate), dayIndex * 24 * 60)
    const dateStr = format(date, "yyyy-MM-dd")

    // Get hours of operation for this day
    const hoursOfOperation = event.hoursOfOperation[dateStr] || {
      startTime: "09:00",
      endTime: "17:00"
    }

    // Sort items by order
    const dayItems = itemsByDay[dayIndex].sort((a, b) => a.order - b.order)

    // Parse start and end times for the day
    const dayStart = parseTimeString(dateStr, hoursOfOperation.startTime)
    const dayEnd = parseTimeString(dateStr, hoursOfOperation.endTime)

    // Calculate start and end times for each item
    let currentTime = dayStart

    dayItems.forEach((item, index) => {
      // Set the start time for this item
      const itemStartTime = new Date(currentTime)

      // Calculate the end time based on duration
      const itemEndTime = addMinutes(itemStartTime, item.durationMinutes)

      // Check if this item extends beyond the day's end time
      if (isAfter(itemEndTime, dayEnd)) {
        // This item extends beyond the current day's end time
        const nextDayIndex = dayIndex + 1
        const hasNextDay = nextDayIndex < sortedDayIndices.length

        if (hasNextDay) {
          // Get next day's date and hours
          const nextDate = addMinutes(parseISO(event.startDate), nextDayIndex * 24 * 60)
          const nextDateStr = format(nextDate, "yyyy-MM-dd")
          const nextDayHours = event.hoursOfOperation[nextDateStr] || {
            startTime: "09:00",
            endTime: "17:00"
          }

          // Calculate remaining duration
          const remainingDurationToday = getDiffInMinutes(currentTime, dayEnd)
          const remainingDurationTomorrow = item.durationMinutes - remainingDurationToday

          // Add part for today until end of day
          updatedItems.push({
            ...item,
            id: item.id ? `${item.id}-part1` : `temp-${Date.now()}-part1`,
            dayIndex,
            order: index,
            durationMinutes: remainingDurationToday,
            startTime: format(itemStartTime, "HH:mm"),
            endTime: hoursOfOperation.endTime
          })

          // Add part for tomorrow starting at beginning of day
          updatedItems.push({
            ...item,
            id: item.id ? `${item.id}-part2` : `temp-${Date.now()}-part2`,
            dayIndex: nextDayIndex,
            order: 0, // Put at beginning of next day
            durationMinutes: remainingDurationTomorrow,
            startTime: nextDayHours.startTime,
            endTime: format(
              addMinutes(parseTimeString(nextDateStr, nextDayHours.startTime), remainingDurationTomorrow),
              "HH:mm"
            )
          })

          // Update current time to end of current item for next scheduling
          currentTime = dayEnd
        } else {
          // This is the last day, so just extend beyond the end time
          updatedItems.push({
            ...item,
            dayIndex,
            order: index,
            startTime: format(itemStartTime, "HH:mm"),
            endTime: format(itemEndTime, "HH:mm")
          })

          // Update current time for the next item
          currentTime = itemEndTime
        }
      } else {
        // This item fits within the current day
        updatedItems.push({
          ...item,
          dayIndex,
          order: index,
          startTime: format(itemStartTime, "HH:mm"),
          endTime: format(itemEndTime, "HH:mm")
        })

        // Update current time for the next item
        currentTime = itemEndTime
      }
    })
  })

  return updatedItems
}

// Helper function to parse time string into Date object
function parseTimeString(dateStr: string, timeStr: string): Date {
  return parseISO(`${dateStr}T${timeStr}`)
}

// Helper function to calculate minutes between two dates
function getDiffInMinutes(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
}

// Helper function to get the duration of a day in minutes
function getDayDurationMinutes(startTime: string, endTime: string): number {
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const [endHours, endMinutes] = endTime.split(':').map(Number)
  
  return (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes)
}

// Helper function to get the index of a date in the event date range
function getDateIndex(event: Event, dateStr: string): number {
  const startDate = parseISO(event.startDate)
  const date = new Date(dateStr)

  return differenceInDays(date, startDate)
}

// Helper function to get a date string by index from the event start date
function getDateByIndex(event: Event, index: number): string | null {
  const startDate = parseISO(event.startDate)
  const endDate = parseISO(event.endDate)

  const date = addMinutes(startDate, index * 24 * 60)

  if (isAfter(date, endDate)) {
    return null
  }

  return format(date, "yyyy-MM-dd")
}

