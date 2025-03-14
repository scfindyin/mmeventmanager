"use client"

import { useState, useRef, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Upload, X } from "lucide-react"
import type { Event } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { ErrorDialog } from "@/components/error-dialog"
import { format } from "date-fns"
import { dateToDbString, dbStringToDate } from "@/lib/utils"
import Image from "next/image"
import { ClientDayPicker } from '@/components/ClientDayPicker'
import BasicTimePicker from '@/components/BasicTimePicker'

const formSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  subtitle: z.string().optional(),
  notes: z.string().optional(),
  start_date: z.date({
    required_error: "Start date is required",
    invalid_type_error: "Start date must be a valid date",
  }),
  end_date: z.date({
    required_error: "End date is required",
    invalid_type_error: "End date must be a valid date",
  }),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  logo_url: z.string().optional(),
}).refine(
  (data) => {
    return data.end_date >= data.start_date
  },
  {
    message: "End date must be after or equal to start date",
    path: ["end_date"],
  },
)

type FormValues = z.infer<typeof formSchema>

interface EventFormProps {
  event: Event | null
  onClose: () => void
}

export function EventForm({ event, onClose }: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(event?.logo_url || null)
  const [saveError, setSaveError] = useState<Error | string | null>(null)
  const { toast } = useToast()

  // Type assertion to handle the snake_case field names from API
  // This tells TypeScript that the Event might have these additional properties
  const apiEvent = event as unknown as {
    id?: string;
    title: string;
    subtitle?: string;
    notes?: string;
    start_date?: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    logo_url?: string;
  } | null;

  // Use the start_date and end_date from the actual API response
  let safeStartDate = new Date();
  let safeEndDate = new Date();
  
  if (apiEvent) {
    // Use the actual snake_case field names from the API response
    if (apiEvent.start_date) {
      safeStartDate = dbStringToDate(apiEvent.start_date);
    }
    if (apiEvent.end_date) {
      safeEndDate = dbStringToDate(apiEvent.end_date);
    }
  }

  const defaultValues: Partial<FormValues> = event
    ? {
        title: apiEvent?.title || "",
        subtitle: apiEvent?.subtitle || "",
        notes: apiEvent?.notes || "",
        start_date: safeStartDate,
        end_date: safeEndDate,
        start_time: apiEvent?.start_time?.substring(0, 5) || "08:00",
        end_time: apiEvent?.end_time?.substring(0, 5) || "17:00",
        logo_url: apiEvent?.logo_url || "",
      }
    : {
        title: "",
        subtitle: "",
        notes: "",
        start_date: new Date(),
        end_date: new Date(),
        start_time: "08:00",
        end_time: "17:00",
        logo_url: "",
      }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  // Watch the start_time field to update the end_time field
  const startTime = form.watch("start_time");
  
  // When start_time changes, adjust end_time if needed
  useEffect(() => {
    const currentEndTime = form.getValues("end_time");
    
    // If end time is earlier than start time, set it to start time
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = currentEndTime.split(":").map(Number);
    
    if (
      startHours > endHours || 
      (startHours === endHours && startMinutes >= endMinutes)
    ) {
      // Set end time 1 hour after start time
      let newEndHours = startHours + 1;
      if (newEndHours >= 24) {
        newEndHours = 23;
        form.setValue("end_time", `${newEndHours.toString().padStart(2, "0")}:${startMinutes.toString().padStart(2, "0")}`);
      } else {
        form.setValue("end_time", `${newEndHours.toString().padStart(2, "0")}:${startMinutes.toString().padStart(2, "0")}`);
      }
    }
  }, [startTime, form]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoFile(file)

    // Create a preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function uploadLogo(file: File): Promise<string> {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/upload-simple", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Upload failed")
    }

    const result = await response.json()
    return result.publicUrl
  }

  async function onSubmit(data: FormValues) {
    try {
      setIsSubmitting(true)
      
      // Handle logo upload if there's a new file
      let logoUrl = data.logo_url
      if (logoFile) {
        logoUrl = await uploadLogo(logoFile)
      }

      // Format start and end dates as ISO strings for API
      const startDateStr = dateToDbString(data.start_date);
      const endDateStr = dateToDbString(data.end_date);

      // Prepare the event data - match the expected API format
      const eventData = {
        title: data.title,
        subtitle: data.subtitle,
        notes: data.notes,
        start_date: startDateStr,
        end_date: endDateStr,
        start_time: data.start_time,
        end_time: data.end_time,
        logo_url: logoUrl,
      }

      // API call would go here
      const url = event?.id ? `/api/events/${event.id}` : '/api/events'
      const method = event?.id ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save event")
      }

      toast({
        title: "Event saved",
        description: "Your event has been saved successfully."
      })
      onClose()
    } catch (error: any) {
      setSaveError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{event?.id ? "Edit Event" : "Create New Event"}</CardTitle>
          <CardDescription>
            {event?.id ? "Update your event details" : "Enter the details for your new event"}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-1 space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Event title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="subtitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtitle</FormLabel>
                      <FormControl>
                        <Input placeholder="Event subtitle (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start Date</FormLabel>
                          <ClientDayPicker
                            initialDate={field.value}
                            onChange={(date) => field.onChange(date)}
                            label=""
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>End Date</FormLabel>
                          <ClientDayPicker
                            initialDate={field.value}
                            onChange={(date) => field.onChange(date)}
                            label=""
                            minDate={form.getValues("start_date")}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="start_time"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start Time</FormLabel>
                          <FormControl>
                            <BasicTimePicker 
                              value={field.value} 
                              onChange={field.onChange}
                              label="" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="end_time"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>End Time</FormLabel>
                          <FormControl>
                            <BasicTimePicker 
                              value={field.value} 
                              onChange={field.onChange}
                              label="" 
                              minTime={form.getValues("start_time")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes (optional)" className="min-h-[120px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="w-64 space-y-4">
                <FormField
                  control={form.control}
                  name="logo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo</FormLabel>
                      <FormDescription>
                        {logoPreview ? "Click on logo to replace it" : "Upload your event logo (optional)"}
                      </FormDescription>
                      <FormControl>
                        <div className="space-y-4">
                          <label 
                            className="border rounded-md p-4 flex items-center justify-center bg-muted/50 h-40 cursor-pointer"
                            htmlFor="logo-upload"
                          >
                            {logoPreview ? (
                              <div className="relative w-full h-full">
                                <Image 
                                  src={logoPreview} 
                                  alt="Logo preview" 
                                  fill
                                  className="object-contain"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
                                  <span className="text-transparent hover:text-white font-medium">Change</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-muted-foreground text-center">
                                <Upload className="h-8 w-8 mx-auto mb-2" />
                                <p>Click to upload logo</p>
                              </div>
                            )}
                          </label>
                          <Input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoChange}
                            className="hidden"
                          />
                          <input type="hidden" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : event?.id ? "Update Event" : "Create Event"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      
      <ErrorDialog title="Save Error" error={saveError} onClose={() => setSaveError(null)} />
    </Card>
  )
}


