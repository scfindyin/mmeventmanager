import { AgendaManager } from "@/components/agenda-manager"

export default function EventAgendaPage({ params }: { params: { id: string } }) {
  const eventId = params.id
  
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

