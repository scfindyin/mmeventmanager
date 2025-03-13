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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type AgendaItem } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { differenceInDays, addDays, format } from "date-fns"
import { ErrorDialog } from "@/components/error-dialog"
import { dbStringToDate } from "@/lib/utils"

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
        console.log('🔍 Form initialization:', { 
          eventId, 
          item,
          description: item?.description,
          formDescription: form.getValues('description')
        })
        setIsLoading(true)
        const response = await fetch(`/api/events/${eventId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch event')
        }
        const { data } = await response.json()
        console.log('Fetched event data:', data)
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
        
        console.log('Setting form values:', {
          topic: item?.topic || "",
          description: item?.description || "",
          durationMinutes: item?.durationMinutes || 30,
          dayIndex: item?.dayIndex || 0,
        })
        
        // Reset form with complete data
        form.reset({
          topic: item?.topic || "",
          description: item?.description || "",
          durationMinutes: item?.durationMinutes || 30,
          dayIndex: item?.dayIndex || 0,
        })
      } catch (error) {
        console.error('Error in fetchEvent:', {
          error,
          stack: error instanceof Error ? error.stack : 'No stack trace available',
          eventId,
          item
        })
        setFormError(error instanceof Error ? error.message : 'An error occurred while fetching event details')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvent()
  }, [eventId, item, form])

  async function onSubmit(data: FormValues) {
    try {
      console.log('📝 Form submission data:', { 
        data, 
        description: data.description,
        item,
        itemDescription: item?.description
      })
      setIsSubmitting(true)
      setFormError(null)

      const updatedItem: AgendaItem = {
        id: item?.id || `temp-${Date.now()}`,
        event_id: eventId,
        topic: data.topic,
        description: data.description,
        durationMinutes: data.durationMinutes,
        dayIndex: data.dayIndex,
        order: item?.order ?? 0,
        startTime: item?.startTime ?? "",
        endTime: item?.endTime ?? ""
      }

      console.log('📤 Sending to parent:', {
        id: updatedItem.id,
        topic: updatedItem.topic,
        description: updatedItem.description,
        fullItem: updatedItem
      })
      onSave(updatedItem)
      onClose()
    } catch (error) {
      console.error('Error in form submission:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace available',
        formData: data,
        item
      })
      setFormError(error instanceof Error ? error.message : 'An error occurred while saving')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{item?.id ? "Edit Agenda Item" : "Add Agenda Item"}</CardTitle>
          <CardDescription>
            {item?.id ? "Update your agenda item details" : "Enter the details for your new agenda item"}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
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
              render={({ field }) => {
                console.log('🖊️ Description field render:', {
                  value: field.value,
                  defaultValue: item?.description
                })
                return (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add a description for this agenda item" 
                        className="min-h-[100px]"
                        {...field} 
                        value={field.value || ""}
                        onChange={(e) => {
                          console.log('✍️ Description field change:', {
                            newValue: e.target.value,
                            oldValue: field.value
                          })
                          field.onChange(e)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <FormField
              control={form.control}
              name="durationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (minutes)</FormLabel>
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
                  <FormDescription>Select the duration for this agenda item</FormDescription>
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
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : item?.id ? "Update Item" : "Add Item"}
            </Button>
          </CardFooter>
        </form>
      </Form>
      {formError && <ErrorDialog title="Form Error" error={formError} onClose={() => setFormError(null)} />}
    </Card>
  )
}

