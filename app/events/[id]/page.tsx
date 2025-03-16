"use client"

import { AgendaManager } from "@/components/agenda-manager"
import { useEffect, useState } from "react"

export default function EventAgendaPage() {
  const [eventId, setEventId] = useState<string | null>(null)
  
  // Extract ID from URL on the client side
  useEffect(() => {
    const path = window.location.pathname
    const segments = path.split('/')
    const id = segments[segments.length - 1]
    setEventId(id)
  }, [])
  
  if (!eventId) {
    return <div className="min-h-screen p-4 md:p-6 lg:p-8">Loading...</div>
  }
  
  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-8">
          <AgendaManager eventId={eventId} />
        </div>
      </div>
    </main>
  )
}

