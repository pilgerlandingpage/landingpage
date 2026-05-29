import EventDetailClient from './EventDetailClient'

export const dynamic = 'force-dynamic'

export default async function EventoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return <EventDetailClient eventId={id} />
}
