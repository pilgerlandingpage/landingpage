import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, MapPin, Users } from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import { createAdminClient, createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'
import { DEFAULT_EVENT_HERO, formatEventDate } from '@/lib/events/utils'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, itemListJsonLd, organizationJsonLd, webPageJsonLd } from '@/lib/seo/json-ld'

export const revalidate = 300

export const metadata: Metadata = {
    title: 'Eventos para corretores',
    description: 'Encontros exclusivos da Guilherme Pilger para profissionais do mercado imobiliario.',
    alternates: { canonical: '/eventos' },
}

const EVENTS_LIST_TIMEOUT_MS = 8000

async function getPublishedEvents() {
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('event_events')
            .select('id, title, slug, eyebrow, subtitle, description, event_date, location_name, location_address, hero_image_url, capacity')
            .eq('status', 'published')
            .order('event_date', { ascending: true })
            .abortSignal(createSupabaseAbortSignal(EVENTS_LIST_TIMEOUT_MS))

        if (error) {
            console.warn('[Eventos] public list unavailable:', summarizeSupabaseError(error))
            return []
        }

        return data || []
    } catch (error) {
        console.warn('[Eventos] public list unavailable:', summarizeSupabaseError(error))
        return []
    }
}

export default async function EventosPage() {
    const events = await getPublishedEvents()
    const jsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: '/eventos',
            name: 'Eventos para corretores',
            description: 'Encontros exclusivos da Guilherme Pilger para profissionais do mercado imobiliario.',
            type: 'CollectionPage',
            image: DEFAULT_EVENT_HERO,
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Eventos', url: '/eventos' },
        ]),
        itemListJsonLd({
            name: 'Eventos Guilherme Pilger',
            path: '/eventos',
            description: 'Agenda de encontros e eventos profissionais da Guilherme Pilger.',
            items: events.map((event: any) => ({
                type: 'Event',
                name: event.title,
                description: event.subtitle || event.description,
                image: event.hero_image_url || DEFAULT_EVENT_HERO,
                url: `/eventos/${event.slug}`,
            })),
        }),
        {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            '@id': `${absoluteUrl('/eventos')}#collection`,
            name: 'Eventos Guilherme Pilger',
            url: absoluteUrl('/eventos'),
            description: 'Agenda de encontros e eventos profissionais da Guilherme Pilger.',
            publisher: {
                '@id': `${absoluteUrl('/')}#organization`,
            },
            inLanguage: 'pt-BR',
        },
    ]

    if (events.length > 0) {
        redirect(`/eventos/${events[0].slug}`)
    }

    return (
        <>
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <main className="events-index">
                <section className="events-index-hero">
                    <div className="events-index-hero-media" />
                    <div className="events-index-hero-content">
                        <span>Eventos Guilherme Pilger</span>
                        <h1>Encontros para corretores que querem operar com mais inteligência.</h1>
                        <p>
                            Convites editoriais, apresentações reservadas e experiências de mercado para profissionais que atuam com imóveis.
                        </p>
                    </div>
                </section>

                <section className="events-index-list">
                    <div className="events-index-heading">
                        <span>Agenda</span>
                        <h2>Próximos encontros</h2>
                    </div>

                    {events.length === 0 ? (
                        <div className="events-empty">
                            <CalendarDays size={34} />
                            <h3>Nenhum evento publicado no momento</h3>
                            <p>Novos convites serao exibidos aqui assim que a agenda for liberada.</p>
                        </div>
                    ) : (
                        <div className="events-grid">
                            {events.map((event: any) => (
                                <Link href={`/eventos/${event.slug}`} className="event-card" key={event.id}>
                                    <div
                                        className="event-card-media"
                                        style={{ backgroundImage: `url("${event.hero_image_url || DEFAULT_EVENT_HERO}")` }}
                                    />
                                    <div className="event-card-body">
                                        <span>{event.eyebrow || 'Encontro exclusivo'}</span>
                                        <h3>{event.title}</h3>
                                        <p>{event.subtitle || event.description || 'Uma experiência reservada para profissionais do mercado imobiliário.'}</p>
                                        <div className="event-card-meta">
                                            <small><CalendarDays size={14} />{formatEventDate(event.event_date)}</small>
                                            <small><MapPin size={14} />{event.location_name || event.location_address || 'Local a confirmar'}</small>
                                            {event.capacity && <small><Users size={14} />Vagas limitadas</small>}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </main>
            <Footer />

            <style>{`
                .events-index {
                    background: #0b0f14;
                    color: #f7f2e8;
                    min-height: 100vh;
                    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
                }
                .events-index-hero {
                    position: relative;
                    min-height: min(720px, 86vh);
                    display: flex;
                    align-items: flex-end;
                    overflow: hidden;
                }
                .events-index-hero-media {
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(90deg, rgba(7,10,14,0.92), rgba(7,10,14,0.54), rgba(7,10,14,0.82)),
                        url('/images/brava-concetto/8_CL_BC_HALL_DE_ENTRADA_EF_web.jpg') center/cover no-repeat;
                }
                .events-index-hero-content {
                    position: relative;
                    z-index: 1;
                    width: min(1160px, calc(100% - 40px));
                    margin: 0 auto;
                    padding: 110px 0 78px;
                }
                .events-index-hero-content span,
                .events-index-heading span,
                .event-card-body span {
                    display: inline-block;
                    color: #d8b979;
                    font-size: 0.72rem;
                    font-weight: 900;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }
                .events-index-hero h1 {
                    max-width: 900px;
                    margin: 14px 0 18px;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(2.8rem, 8vw, 7.4rem);
                    line-height: 0.95;
                    letter-spacing: 0;
                    color: #fff8ea;
                }
                .events-index-hero p {
                    max-width: 620px;
                    margin: 0;
                    color: rgba(255,255,255,0.68);
                    font-size: 1.05rem;
                    line-height: 1.7;
                }
                .events-index-list {
                    width: min(1160px, calc(100% - 40px));
                    margin: 0 auto;
                    padding: 64px 0 90px;
                }
                .events-index-heading {
                    display: flex;
                    align-items: end;
                    justify-content: space-between;
                    gap: 24px;
                    margin-bottom: 24px;
                }
                .events-index-heading h2 {
                    margin: 8px 0 0;
                    color: #fff8ea;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(2rem, 4vw, 4rem);
                    line-height: 1;
                    letter-spacing: 0;
                }
                .events-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
                    gap: 18px;
                }
                .event-card {
                    display: grid;
                    grid-template-rows: 210px 1fr;
                    min-height: 460px;
                    border: 1px solid rgba(255,255,255,0.12);
                    border-radius: 8px;
                    overflow: hidden;
                    background: #111820;
                    color: inherit;
                    text-decoration: none;
                    transition: transform 0.18s ease, border-color 0.18s ease;
                }
                .event-card:hover {
                    transform: translateY(-3px);
                    border-color: rgba(216,185,121,0.45);
                }
                .event-card-media {
                    background-size: cover;
                    background-position: center;
                }
                .event-card-body {
                    padding: 22px;
                    display: flex;
                    flex-direction: column;
                }
                .event-card h3 {
                    margin: 10px 0;
                    color: #fff8ea;
                    font-size: 1.45rem;
                    line-height: 1.15;
                    letter-spacing: 0;
                }
                .event-card p {
                    color: rgba(255,255,255,0.64);
                    line-height: 1.6;
                    margin: 0 0 18px;
                }
                .event-card-meta {
                    display: grid;
                    gap: 8px;
                    margin-top: auto;
                    color: rgba(255,255,255,0.58);
                    font-size: 0.82rem;
                }
                .event-card-meta small {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                }
                .events-empty {
                    border: 1px solid rgba(255,255,255,0.12);
                    border-radius: 8px;
                    padding: 42px;
                    text-align: center;
                    color: rgba(255,255,255,0.62);
                    background: rgba(255,255,255,0.04);
                }
                .events-empty svg {
                    color: #d8b979;
                }
                .events-empty h3 {
                    color: #fff8ea;
                    margin: 14px 0 8px;
                }
                @media (max-width: 720px) {
                    .events-index-hero {
                        min-height: 82vh;
                    }
                    .events-index-hero-content {
                        padding-bottom: 42px;
                    }
                    .events-index-list {
                        padding-top: 42px;
                    }
                }
            `}</style>
        </>
    )
}
