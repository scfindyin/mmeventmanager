"use client"

import { Copy, Edit, Trash, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { Event } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <Card key={event.id}>
          <CardHeader>
            {event.logo_url && (
              <div className="w-full flex justify-center mb-2">
                <div className="relative w-32 h-16">
                  <img
                    src={`${event.logo_url}?v=${Date.now()}`}
                    alt={event.title}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      console.error("Image failed to load:", event.logo_url)
                      ;(e.target as HTMLImageElement).style.display = "none"
                    }}
                  />
                </div>
              </div>
            )}
            <CardTitle>{event.title}</CardTitle>
            {event.subtitle && <CardDescription className="text-base font-medium">{event.subtitle}</CardDescription>}
            {event.notes && <p className="text-muted-foreground mt-2 text-sm line-clamp-2">{event.notes}</p>}
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <p className="font-medium">
                {formatDate(event.start_date) || 'No start date'} - {formatDate(event.end_date) || 'No end date'}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/events/${event.id}`}>
                <Calendar className="mr-2 h-4 w-4" />
                Agenda
              </Link>
            </Button>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => onEdit(event)}>
                <Edit className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onClone(event)}>
                <Copy className="h-4 w-4" />
                <span className="sr-only">Clone</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(event.id)}>
                <Trash className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

