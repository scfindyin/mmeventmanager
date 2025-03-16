'use client'

import { AgendaManager } from "@/components/agenda-manager"
import { useParams } from 'next/navigation'

export default function InlineClientComponent() {
  // Get eventId from URL path safely on the client side
  const params = useParams()
  const eventId = Array.isArray(params.id) ? params.id[0] : params.id as string
  
  return <AgendaManager eventId={eventId} />
} 