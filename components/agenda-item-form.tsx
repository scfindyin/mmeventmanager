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

const formSchema = z.object({
  topic: z.string().min(2, "Topic must be at least 2 characters"),
  description: z.string().optional(),
  durationMinutes: z.coerce.number().min(1, "Duration must be at least 1 minute"),
  dayIndex: z.coerce.number().min(0, "Day is required"),
})

type FormValues = z.infer<typeof formSchema>

interface AgendaItemFormProps {
  eventId: string
  item?: AgendaItem | null
  onClose: () => void
  onSave: (item: AgendaItem) => void
}

export function AgendaItemForm({ eventId, item, onClose, onSave }: AgendaItemFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [event, setEvent] = useState<any>(null)
  const [days, setDays] = useState<{ value: number; label: string }[]>([])
  const { toast } = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
        const startDate = dbStringToDate(data.startDate)
        const endDate = dbStringToDate(data.endDate)
        const dayCount = differenceInDays(endDate, startDate) + 1

        const dayOptions = []
        for (let i = 0; i < dayCount; i++) {
          const date = addDays(startDate, i)
          dayOptions.push({
            value: i,
            label: `Day ${i + 1} - ${format(date, "MMM d, yyyy")}`,
          })
        }
        setDays(dayOptions)
        
        // Reset form with complete data
        form.reset({
          topic: item?.topic || "",
          description: item?.description || "",
          durationMinutes: item?.durationMinutes || 30,
          dayIndex: item?.dayIndex || 0,
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

  async function onSubmit(data: FormValues) {
    try {
      // Force getting the latest form values
      const latestValues = form.getValues();
      
      setIsSubmitting(true)
      setFormError(null)

      // Create the updated item object
      const updatedItem: AgendaItem = {
        id: item?.id || `temp-${Date.now()}`,
        event_id: eventId,
        topic: latestValues.topic || data.topic,
        description: latestValues.description || data.description,
        durationMinutes: latestValues.durationMinutes || data.durationMinutes,
        dayIndex: latestValues.dayIndex || data.dayIndex,
        order: item?.order ?? 0,
        startTime: item?.startTime ?? "",
        endTime: item?.endTime ?? ""
      }
      
      // If this is an existing item, use the direct API approach
      if (item?.id) {
        try {
          // Prepare API payload with all the fields
          const apiPayload = { 
            itemId: updatedItem.id, 
            description: updatedItem.description || '',
            topic: updatedItem.topic,
            durationMinutes: updatedItem.durationMinutes,
            dayIndex: updatedItem.dayIndex,
            orderPosition: updatedItem.order,
            startTime: updatedItem.startTime,
            endTime: updatedItem.endTime,
            fullUpdate: true,  // Important: this ensures all fields are updated
            useDirectSql: true // Use admin privileges
          };
          
          // Call the API directly
          const response = await fetch('/api/agenda-items/fix-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiPayload),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${errorData.error || response.statusText}`);
          }
          
          // Get the response data
          const result = await response.json();
          
          toast({
            title: "Item updated",
            description: "The agenda item has been saved successfully."
          });
          
          // IMPORTANT: Always call onSave even after successful API update
          // This ensures the parent component recalculates times for all items
          // when the duration changes
          onSave(updatedItem);
          
          // Close the form
          onClose();
        } catch (apiError) {
          console.error('API update failed:', apiError);
          // If API fails, fall back to the parent's onSave method
          onSave(updatedItem);
          onClose();
        }
      } else {
        // NEW ITEM: Use the parent component's onSave callback
        onSave(updatedItem);
        onClose();
      }
    } catch (error) {
      console.error('Error in form submission:', error)
      setFormError(error instanceof Error ? error.message : 'An error occurred while saving')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
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
                    <FormDescription>Select the total duration in hours and minutes</FormDescription>
                    <Select
                      onValueChange={(value) => field.onChange(Number.parseInt(value))}
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
                      onValueChange={(value) => field.onChange(Number.parseInt(value))}
                      defaultValue={field.value?.toString()}
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
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : item?.id ? "Update Item" : "Add Item"}
              </Button>
            </div>
          </form>
        </Form>
        
        {formError && <ErrorDialog title="Form Error" error={formError} onClose={() => setFormError(null)} />}
      </DialogContent>
    </Dialog>
  )
}

