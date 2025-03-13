import { AgendaManager } from "@/components/agenda-manager"

export default async function EventAgendaPage({ params }: { params: { id: string } }) {
  const eventId = await params.id
  
  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8">
      <AgendaManager eventId={eventId} />
    </main>
  )
}

