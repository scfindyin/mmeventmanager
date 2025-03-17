"use client"

import { useState } from "react"
import { Copy, Edit, Trash, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { Event } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { BorderBeam } from "@/components/magicui/border-beam"

// Helper function for handling various date formats
function formatDateSafely(dateValue: any): string {
  if (!dateValue) return '';
  
  try {
    // If it's a string that might be a date
    if (typeof dateValue === 'string') {
      return formatDate(dateValue) || '';
    }
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return formatDate(dateValue) || '';
    }
    
    // Otherwise, convert to string
    return formatDate(String(dateValue)) || '';
  } catch (error) {
    console.error('Error formatting date:', dateValue, error);
    return '';
  }
}

interface EventListProps {
  events: Event[]
  isLoading: boolean
  onEdit: (event: Event) => void
  onClone: (event: Event) => void
  onDelete: (id: string) => void
}

export function EventList({ events, isLoading, onEdit, onClone, onDelete }: EventListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-1/2 mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-9 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">No events found</h2>
        <p className="text-muted-foreground mt-1">Create your first event to get started.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-6 rounded-lg">
      {events.map((event) => {
        // Try both camelCase and snake_case property names
        const startDate = event.startDate || (event as any).start_date;
        const endDate = event.endDate || (event as any).end_date;
        
        const startDateDisplay = startDate ? formatDateSafely(startDate) : 'No start date';
        const endDateDisplay = endDate ? formatDateSafely(endDate) : 'No end date';
        
        const [isHovered, setIsHovered] = useState(false);
        
        return (
          <Card 
            key={event.id} 
            className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col relative overflow-hidden cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(e) => {
              // Only call onEdit if the click wasn't on a button or link
              if (!(e.target as HTMLElement).closest('button, a')) {
                onEdit(event);
              }
            }}
          >
            <CardHeader>
              <div className="w-full flex justify-center mb-2">
                <div className="relative w-32 h-16">
                  {event.logo_url ? (
                    <img
                      src={`${event.logo_url}?v=${Date.now()}`}
                      alt={event.title}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        console.error("Image failed to load:", event.logo_url)
                        ;(e.target as HTMLImageElement).style.display = "none"
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-300 rounded">
                      No Logo
                    </div>
                  )}
                </div>
              </div>
              <CardTitle>{event.title}</CardTitle>
              {event.subtitle && <CardDescription className="text-base font-medium">{event.subtitle}</CardDescription>}
              {event.notes && <p className="text-muted-foreground mt-2 text-sm line-clamp-2">{event.notes}</p>}
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="text-sm">
                <p className="font-medium">
                  {startDateDisplay} - {endDateDisplay}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between gap-2 mt-auto">
              <Button size="sm" asChild>
                <Link href={`/events/${event.id}`}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Agenda
                </Link>
              </Button>
              <div className="flex gap-3">
                <Button variant="ghost" size="icon" onClick={() => onEdit(event)} className="border border-gray-200 rounded-full transition-transform duration-200 hover:scale-[1.15]">
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onClone(event)} className="border border-gray-200 rounded-full transition-transform duration-200 hover:scale-[1.15]">
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">Clone</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(event.id)} className="border border-gray-200 rounded-full transition-transform duration-200 hover:scale-[1.15]">
                  <Trash className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </CardFooter>
            
            {isHovered && (
              <>
                <BorderBeam
                  duration={8}
                  size={350}
                  colorFrom="#3b82f6"
                  colorTo="#93c5fd"
                />
                <BorderBeam
                  duration={8}
                  delay={4}
                  size={350}
                  colorFrom="#93c5fd"
                  colorTo="#3b82f6"
                  reverse
                />
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}

