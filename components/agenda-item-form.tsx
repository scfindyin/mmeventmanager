"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type AgendaItem } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { differenceInDays, addDays, format } from "date-fns"
import { ErrorDialog } from "@/components/error-dialog"
import { dbStringToDate } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { printTypeInfo, ensureNumber } from "@/lib/debug-utils"

const formSchema = z.object({
  topic: z.string().min(2, "Topic must be at least 2 characters"),
  description: z.string().optional(),
  durationMinutes: z.coerce.number().min(1, "Duration must be at least 1 minute"),
  dayIndex: z.coerce.number().min(0, "Day is required"),
})

// Helper function to format time in 12-hour format
function formatTo12Hour(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  
  const [hourStr, minuteStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  
  if (isNaN(hour)) return time24;
  
  const period = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  
  return `${hour12}:${minuteStr}${period}`;
}

type FormValues = z.infer<typeof formSchema>

interface AgendaItemFormProps {
  eventId: string
  item?: AgendaItem | null
  onClose: () => void
  onSave: (item: AgendaItem) => Promise<boolean>
  adhereToTimeRestrictions?: boolean
}

export function AgendaItemForm({ eventId, item, onClose, onSave, adhereToTimeRestrictions = true }: AgendaItemFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [event, setEvent] = useState<any>(null)
  const [days, setDays] = useState<{ value: number; label: string }[]>([])
  const { toast } = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeError, setTimeError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: item?.topic || "",
      description: item?.description || "",
      durationMinutes: item?.durationMinutes || 30,
      dayIndex: item?.dayIndex || 0,
    }
  })

  useEffect(() => {
    async function fetchEvent() {
      try {
        // Reset form when item changes
        if (item) {
          // Make sure description is always at least an empty string, never undefined/null
          const safeDescription = item.description || "";
          
          form.reset({
            topic: item.topic,
            description: safeDescription, // Use safe description
            durationMinutes: item.durationMinutes,
            dayIndex: item.dayIndex,
          }, { keepDirty: false, keepValues: false })
        }
        
        setIsLoading(true)
        const response = await fetch(`/api/events/${eventId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch event')
        }
        const { data } = await response.json()
        setEvent(data)

        // Calculate days between start and end date
        const startDate = dbStringToDate(data.startDate || data.start_date)
        const endDate = dbStringToDate(data.endDate || data.end_date)
        
        console.log("Event dates:", { 
          startDateString: data.startDate || data.start_date, 
          endDateString: data.endDate || data.end_date,
          parsedStartDate: startDate,
          parsedEndDate: endDate
        })
        
        // Ensure we always have at least 1 day and handle case sensitivity issues
        const dayCount = Math.max(differenceInDays(endDate, startDate) + 1, 1)
        console.log("Day count:", dayCount)

        const dayOptions = []
        for (let i = 0; i < dayCount; i++) {
          const date = addDays(startDate, i)
          dayOptions.push({
            value: i,
            label: `Day ${i + 1} - ${format(date, "MMM d, yyyy")}`,
          })
        }
        console.log("Day options:", dayOptions)
        
        setDays(dayOptions)
        
        // Reset form with complete data
        form.reset({
          topic: item?.topic || "",
          description: item?.description || "",
          durationMinutes: item?.durationMinutes || 30,
          dayIndex: item?.dayIndex !== undefined ? item.dayIndex : 0,
        }, { keepDirty: false, keepValues: false })
      } catch (error) {
        console.error('Error in fetchEvent:', error)
        setFormError(error instanceof Error ? error.message : 'An error occurred while fetching event details')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvent()
  }, [eventId, item, form])

  // Function to check if the current duration would exceed time boundaries
  const checkTimeRestrictions = (dayIndex: number, durationMinutes: number) => {
    if (!adhereToTimeRestrictions || !event) return true;
    
    // Calculate current day's available time
    const dayStartTime = event.start_time;
    const dayEndTime = event.end_time;
    
    if (!dayStartTime || !dayEndTime) {
      console.error("Missing required event times:", { dayStartTime, dayEndTime });
      throw new Error("Event start and end times are required");
    }
    
    // Convert times to minutes since midnight
    const [startHours, startMinutes] = dayStartTime.split(':').map(Number);
    const [endHours, endMinutes] = dayEndTime.split(':').map(Number);
    
    const dayStartMinutes = startHours * 60 + startMinutes;
    const dayEndMinutes = endHours * 60 + endMinutes;
    
    // Calculate total available minutes
    const availableMinutes = dayEndMinutes - dayStartMinutes;
    
    // Check if duration exceeds available time - just provide a warning now instead of blocking
    if (durationMinutes > availableMinutes) {
      setTimeError(`Duration exceeds available time (${Math.floor(availableMinutes / 60)}h ${availableMinutes % 60}m). Item may be moved to another day to fit the schedule.`);
      // We still return true since we'll handle this by moving to the next day
      return true;
    }
    
    setTimeError(null);
    return true;
  };

  // Update validation when duration changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'durationMinutes' || name === 'dayIndex') {
        const dayIndex = form.getValues('dayIndex');
        const duration = form.getValues('durationMinutes');
        checkTimeRestrictions(dayIndex, duration);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, adhereToTimeRestrictions, event]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);

    try {
      console.log("Form submitted with data:", data);
      
      // Convert dayIndex to a number to ensure it's the right type
      const dayIndex = ensureNumber(data.dayIndex, 0);
      
      printTypeInfo("Form submission dayIndex", dayIndex);
      
      // Format the item with form data
      const itemToSave: AgendaItem = {
        id: item?.id || '',
        event_id: eventId,
        topic: data.topic,
        description: data.description || '',
        durationMinutes: data.durationMinutes,
        dayIndex: dayIndex,
        order: item?.order || 0, // Default order
        startTime: item?.startTime || '',
        endTime: item?.endTime || '',
      };

      // If we're changing the day for an existing item or it's a new item,
      // set order to -1 to signal it should be placed at the end of the day
      if ((item?.id && item.dayIndex !== dayIndex) || !item?.id) {
        console.log(`Setting order to -1 for item moved to day ${dayIndex} or new item`);
        itemToSave.order = -1;
      } else if (item?.order !== undefined) {
        // If we have a selected item with a defined order and not changing day, carry that over
        itemToSave.order = item.order;
      }

      console.log("Submitting item:", itemToSave);
      
      // Clear any previous errors
      setFormError(null);
      
      // Call the save handler
      const success = await onSave(itemToSave);
      
      if (success) {
        onClose();
      } else {
        // If onSave returns false, it means there was an error handled in the parent component
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error("Error submitting form:", error);
      
      // Create a user-friendly error message
      let errorMessage = "Failed to save agenda item";
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        // Extract the helpful part of the error message if it's an API error
        if (error.message.includes('API error:')) {
          try {
            const jsonStr = error.message.split('API error:')[1].trim();
            const errorData = JSON.parse(jsonStr);
            
            if (errorData.error) {
              errorMessage = `Server error: ${errorData.error}`;
              
              if (errorData.suggestion) {
                errorMessage += `. ${errorData.suggestion}`;
              }
            }
          } catch (e) {
            errorMessage = error.message;
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      setFormError(errorMessage);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => {
      // Save current scroll position
      const scrollPos = window.scrollY;
      
      // Close the dialog
      onClose();
      
      // Restore scroll position after a small delay
      setTimeout(() => {
        window.scrollTo(0, scrollPos);
      }, 100);
    }}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{item ? "Edit" : "Add"} Agenda Item</DialogTitle>
          <DialogDescription>
            {item ? "Update the details of this agenda item." : "Add a new item to the agenda."}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic</FormLabel>
                    <FormControl>
                      <Input placeholder="Agenda item topic" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add a description for this agenda item" 
                        className="min-h-[100px]"
                        {...field} 
                        value={field.value || ""}
                        onChange={(e) => {
                          field.onChange(e)
                          
                          // Ensure we always store a string value, never undefined/null
                          form.setValue('description', e.target.value || "", { 
                            shouldValidate: true,
                            shouldDirty: true,
                            shouldTouch: true
                          })
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <FormDescription>
                      Select the total duration in hours and minutes
                      <span className="block text-xs text-muted-foreground">
                        Event hours: {formatTo12Hour(event?.start_time || "09:00")} - {formatTo12Hour(event?.end_time || "17:00")} (exceeding shows warning)
                      </span>
                    </FormDescription>
                    <Select
                      onValueChange={(value) => {
                        const duration = Number.parseInt(value);
                        field.onChange(duration);
                        checkTimeRestrictions(form.getValues('dayIndex'), duration);
                      }}
                      defaultValue={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 32 }, (_, i) => {
                          const minutes = (i + 1) * 15;
                          const hours = Math.floor(minutes / 60);
                          const mins = minutes % 60;
                          const label = hours > 0 
                            ? `${hours}h ${mins > 0 ? `${mins}m` : ''}`
                            : `${minutes}m`;
                          return (
                            <SelectItem key={minutes} value={minutes.toString()}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {timeError && (
                      <p className="text-sm font-medium text-destructive">{timeError}</p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dayIndex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        printTypeInfo("Day selection value", value);
                        const dayIndex = ensureNumber(value, 0);
                        printTypeInfo("Converted dayIndex", dayIndex);
                        field.onChange(dayIndex);
                        checkTimeRestrictions(dayIndex, form.getValues('durationMinutes'));
                      }}
                      value={field.value?.toString()}
                      disabled={isLoading || days.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoading ? "Loading..." : "Select a day"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={day.value} value={day.value.toString()}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-between mt-8">
              <Button 
                variant="outline" 
                type="button" 
                onClick={(e) => {
                  e.preventDefault();
                  
                  // Save current scroll position
                  const scrollPos = window.scrollY;
                  
                  // Close the dialog
                  onClose();
                  
                  // Restore scroll position after a small delay
                  setTimeout(() => {
                    window.scrollTo(0, scrollPos);
                  }, 100);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : (item?.id && !item.id.startsWith('temp-')) ? "Update Item" : "Add Item"}
              </Button>
            </div>
          </form>
        </Form>
        
        {formError && <ErrorDialog title="Form Error" error={formError} onClose={() => setFormError(null)} />}
      </DialogContent>
    </Dialog>
  )
}

