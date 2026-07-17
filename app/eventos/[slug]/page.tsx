import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { CalendarDays, CheckCircle2, MapPin, ShieldCheck, Users } from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import { createAdminClient, createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'
import { DEFAULT_EVENT_HERO, DEFAULT_EVENT_PROFILE, formatEventDate } from '@/lib/events/utils'
import RegistrationForm, { EventFormAnchorButton } from './RegistrationForm'
import { JsonLd, breadcrumbJsonLd, eventJsonLd, organizationJsonLd, webPageJsonLd } from '@/lib/seo/json-ld'

export const revalidate = 300

export function generateStaticParams() {
    return []
}

type PageProps = { params: Promise<{ slug: string }> }

const EVENT_DETAIL_TIMEOUT_MS = 8000

async function getEvent(slug: string) {
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('event_events')
            .select('*')
            .eq('slug', slug)
            .eq('status', 'published')
            .maybeSingle()
            .abortSignal(createSupabaseAbortSignal(EVENT_DETAIL_TIMEOUT_MS))

        if (error) {
            console.warn(`[Evento] public detail unavailable (${slug}):`, summarizeSupabaseError(error))
            return null
        }

        return data
    } catch (error) {
        console.warn(`[Evento] public detail unavailable (${slug}):`, summarizeSupabaseError(error))
        return null
    }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const event = await getEvent(slug)
    if (!event) return { title: 'Evento não encontrado' }

    return {
        title: event.title,
        description: event.description || event.subtitle || 'Encontro exclusivo da Guilherme Pilger para corretores de imóveis.',
        alternates: { canonical: `/eventos/${event.slug}` },
        openGraph: {
            title: event.title,
            description: event.description || event.subtitle || '',
            type: 'website',
            url: `/eventos/${event.slug}`,
            images: [{ url: event.hero_image_url || DEFAULT_EVENT_HERO, width: 1200, height: 630 }],
        },
    }
}

export default async function EventoPublicPage({ params }: PageProps) {
    const { slug } = await params
    const event = await getEvent(slug)
    if (!event) notFound()

    const heroImage = event.hero_image_url || DEFAULT_EVENT_HERO
    const subtitle = event.subtitle || event.description || 'Uma apresentação reservada para profissionais que querem operar com mais inteligência no mercado imobiliário.'
    const eventMetadata = event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
        ? event.metadata as Record<string, unknown>
        : {}
    const mapsUrl = typeof eventMetadata.maps_url === 'string' ? eventMetadata.maps_url : ''
    const location = event.location_name || 'Local do encontro'
    const locationAddress = event.location_address || 'Endereço a confirmar'
    const jsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: `/eventos/${event.slug}`,
            name: event.title,
            description: event.description || event.subtitle,
            type: 'WebPage',
            image: heroImage,
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Eventos', url: '/eventos' },
            { name: event.title, url: `/eventos/${event.slug}` },
        ]),
        eventJsonLd({ ...event, location_address: locationAddress }, `/eventos/${event.slug}`),
    ]

    return (
        <>
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <main className="event-report" style={{ ['--event-bg' as string]: `url("${heroImage}")` }}>
            <section className="event-report-stage">
                <header className="event-report-hero">
                    <div className="event-report-brand">
                        <span>GUILHERME</span>
                        <span>PILGER</span>
                    </div>
                    <p className="event-report-kicker">INTELIGÊNCIA DE MERCADO | LITORAL NORTE SC</p>
                    <h1>ENCONTRO ESTRATÉGICO<br />PARA CORRETORES</h1>
                    <p className="event-report-subtitle">{subtitle}</p>
                    <EventFormAnchorButton />
                    <div className="event-report-rule" />
                </header>

                <section className="event-report-grid" aria-label="Informações principais do evento">
                    <div className="event-left-column">
                        <article className="event-card event-host-card">
                            <Image src={DEFAULT_EVENT_PROFILE} alt="Guilherme Pilger" width={132} height={132} priority />
                            <div>
                                <span>Seu consultor estratégico</span>
                                <p>
                                    Especialista em investimentos imobiliários de alto padrão no Litoral&nbsp;Norte&nbsp;Catarinense.
                                    <br />
                                    <strong className="event-inline-name">Guilherme Pilger</strong> conduz uma apresentação reservada sobre tecnologia, posicionamento e inteligência comercial para corretores.
                                </p>
                            </div>
                        </article>

                        <article className="event-card event-main-card">
                            <h2>Antes do mercado perceber.</h2>
                            <p>
                                Tecnologia, posicionamento e inteligência comercial para corretores que querem sair na frente.
                            </p>
                            <div className="event-meta-grid">
                                <div>
                                    <CalendarDays size={18} />
                                    <strong>{formatEventDate(event.event_date)}</strong>
                                    <span>Data e horario</span>
                                </div>
                                <div>
                                    <MapPin size={18} />
                                    {mapsUrl ? (
                                        <a className="event-location-link" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                                            {location}
                                        </a>
                                    ) : (
                                        <strong>{location}</strong>
                                    )}
                                    <span>Local do encontro</span>
                                    <small>{locationAddress}</small>
                                </div>
                            </div>
                        </article>

                        <div className="event-small-row">
                            <article className="event-card event-small-card">
                                <span>A estratégia</span>
                                <h3>Operar com mais inteligência</h3>
                                <p>Uma leitura objetiva sobre atendimento, captação e automação aplicada ao dia a dia de corretores.</p>
                            </article>

                            <article className="event-card event-small-card">
                                <span>WhatsApp seguro</span>
                                <h3>Conversa iniciada pelo corretor</h3>
                                <p>Depois do cadastro, o corretor escolhe chamar a equipe para confirmar presença e tirar dúvidas.</p>
                            </article>
                        </div>

                        <article className="event-card event-wide-card">
                            <ShieldCheck size={31} />
                            <div>
                                <h3>Cadastro profissional com CRECI</h3>
                                <p>O formulário registra CRECI, cidade de atuação e perfil comercial para que a equipe organize a lista de presença com mais controle e contexto.</p>
                            </div>
                        </article>
                    </div>

                    <aside className="event-card event-form-card" id="cadastro">
                        <RegistrationForm slug={event.slug} />
                    </aside>
                </section>
            </section>

            <style>{`
                .event-report {
                    min-height: 100vh;
                    color: #f6efe2;
                    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
                    scroll-behavior: smooth;
                    background:
                        linear-gradient(180deg, rgba(14,8,7,0.45), rgba(4,9,10,0.78) 45%, rgba(3,7,8,0.86) 100%),
                        linear-gradient(90deg, rgba(12,7,6,0.38), rgba(5,9,10,0.08), rgba(4,8,9,0.52)),
                        var(--event-bg) center top / cover fixed no-repeat;
                }
                .event-report-stage {
                    width: min(1180px, calc(100% - 40px));
                    margin: 0 auto;
                    padding: 58px 0 40px;
                }
                .event-report-hero {
                    text-align: center;
                    margin-bottom: 28px;
                }
                .event-report-brand {
                    display: inline-grid;
                    justify-items: center;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(2.29rem, 3.64vw, 3.9rem);
                    font-weight: 900;
                    line-height: 0.82;
                    letter-spacing: 0;
                    text-transform: uppercase;
                    background: linear-gradient(90deg, #fff4b8 0%, #d6aa42 28%, #8e6117 50%, #ffebb0 68%, #c89532 100%);
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    text-shadow: 0 20px 72px rgba(0,0,0,0.48);
                }
                .event-report-brand span {
                    display: block;
                }
                .event-report-kicker {
                    margin: 26px 0 13px;
                    color: #d8ad2e;
                    font-size: 0.62rem;
                    font-weight: 900;
                    letter-spacing: 0.32em;
                    text-transform: uppercase;
                }
                .event-report-hero h1 {
                    margin: 0;
                    color: #fff8ef;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.08rem, 1.5vw, 1.68rem);
                    font-weight: 900;
                    line-height: 0.98;
                    letter-spacing: 0;
                    text-transform: uppercase;
                    text-shadow: 0 8px 32px rgba(0,0,0,0.65);
                }
                .event-report-hero h1::first-line {
                    color: #fff8ef;
                }
                .event-report-subtitle {
                    max-width: 720px;
                    margin: 16px auto 0;
                    color: rgba(226,235,244,0.74);
                    font-size: 1.08rem;
                    line-height: 1.58;
                }
                .event-hero-cta {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    min-height: 46px;
                    margin-top: 22px;
                    padding: 0 24px;
                    border-radius: 999px;
                    background: linear-gradient(135deg, #e5ba45, #bd7c14);
                    color: #151008;
                    font-size: 0.78rem;
                    font-weight: 950;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    text-decoration: none;
                    box-shadow: 0 18px 38px rgba(188,124,20,0.24);
                    border: 0;
                    cursor: pointer;
                }
                .event-report-rule {
                    width: 78px;
                    height: 1px;
                    margin: 22px auto 0;
                    background: rgba(216,173,46,0.55);
                }
                .event-report-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1.18fr) minmax(380px, 440px);
                    gap: 28px;
                    align-items: start;
                }
                .event-left-column {
                    display: grid;
                    gap: 22px;
                }
                .event-card {
                    border: 1px solid rgba(218,173,46,0.22);
                    border-radius: 8px;
                    background:
                        radial-gradient(circle at 100% 0%, rgba(198,126,31,0.13), transparent 38%),
                        linear-gradient(135deg, rgba(42,32,29,0.84), rgba(8,17,19,0.87));
                    box-shadow: 0 24px 70px rgba(0,0,0,0.3);
                    backdrop-filter: blur(14px);
                }
                .event-host-card {
                    display: grid;
                    grid-template-columns: 132px minmax(0, 1fr);
                    gap: 26px;
                    min-height: 194px;
                    padding: 30px;
                    align-items: center;
                }
                .event-host-card img {
                    width: 132px;
                    height: 132px;
                    border-radius: 8px;
                    object-fit: cover;
                    box-shadow: 0 14px 34px rgba(0,0,0,0.38);
                }
                .event-host-card span,
                .event-small-card > span,
                .event-form-head span {
                    color: #d8ad2e;
                    font-size: 0.76rem;
                    font-weight: 900;
                    letter-spacing: 0.13em;
                    text-transform: uppercase;
                }
                .event-host-card h2,
                .event-main-card h2,
                .event-small-card h3,
                .event-wide-card h3,
                .event-form-head h2 {
                    margin: 8px 0 12px;
                    color: #fff;
                    letter-spacing: 0;
                    line-height: 1.08;
                }
                .event-host-card h2 {
                    font-size: 1.7rem;
                }
                .event-host-card p,
                .event-main-card p,
                .event-small-card p,
                .event-wide-card p,
                .event-form-head p,
                .event-consent {
                    color: rgba(239,245,250,0.76);
                    line-height: 1.7;
                }
                .event-host-card p {
                    margin: 0;
                    font-size: 0.92rem;
                    text-align: justify;
                }
                .event-inline-name {
                    color: #fff8ef;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.12em;
                    font-weight: 900;
                    letter-spacing: 0;
                    white-space: nowrap;
                }
                .event-form-card {
                    padding: 0;
                    overflow: hidden;
                }
                .event-main-card {
                    padding: 34px;
                }
                .event-main-card h2 {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.9rem;
                }
                .event-main-card p {
                    max-width: 730px;
                    margin: 0;
                    font-size: 1rem;
                }
                .event-meta-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 18px;
                    margin-top: 26px;
                }
                .event-meta-grid div {
                    min-height: 94px;
                    padding: 18px;
                    border-radius: 8px;
                    background: rgba(0,0,0,0.34);
                    border: 1px solid rgba(255,255,255,0.08);
                }
                .event-meta-grid svg,
                .event-wide-card svg {
                    color: #d8ad2e;
                }
                .event-meta-grid strong,
                .event-location-link,
                .event-meta-grid span {
                    display: block;
                }
                .event-meta-grid strong,
                .event-location-link {
                    margin-top: 10px;
                    color: #f2c641;
                    font-size: 1rem;
                    line-height: 1.25;
                    font-weight: 900;
                    letter-spacing: 0;
                }
                .event-location-link {
                    text-decoration: none;
                }
                .event-location-link:hover {
                    text-decoration: underline;
                }
                .event-meta-grid span {
                    margin-top: 6px;
                    color: rgba(226,235,244,0.62);
                    font-size: 0.72rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .event-meta-grid small {
                    display: block;
                    margin-top: 9px;
                    color: rgba(226,235,244,0.68);
                    font-size: 0.78rem;
                    line-height: 1.45;
                }
                .event-small-card {
                    padding: 26px;
                }
                .event-small-row {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 22px;
                }
                .event-small-card h3 {
                    color: #f2c641;
                    font-size: 1.1rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }
                .event-small-card p {
                    margin: 0;
                    font-size: 0.92rem;
                }
                .event-wide-card {
                    display: grid;
                    grid-template-columns: 42px minmax(0, 1fr);
                    gap: 18px;
                    padding: 28px;
                    align-items: start;
                }
                .event-wide-card h3 {
                    margin-top: 0;
                    font-size: 1.28rem;
                }
                .event-wide-card p {
                    margin: 0;
                    font-size: 0.95rem;
                }
                .event-form,
                .event-form-success {
                    color: #fff8ec;
                }
                .event-form {
                    padding: 34px 34px 30px;
                }
                .event-form-head {
                    text-align: center;
                    margin-bottom: 22px;
                }
                .event-form-head h2 {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.85rem;
                }
                .event-form-head p {
                    max-width: 320px;
                    margin: 0 auto;
                    color: rgba(226,235,244,0.68);
                    font-size: 0.84rem;
                    line-height: 1.55;
                }
                .event-form label {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 12px;
                    color: rgba(255,255,255,0.72);
                    font-size: 0.68rem;
                    font-weight: 900;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .event-form input,
                .event-form select,
                .event-form textarea {
                    width: 100%;
                    min-height: 46px;
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.055);
                    color: #fff8ec;
                    padding: 0 13px;
                    outline: none;
                    font: inherit;
                    font-size: 0.9rem;
                }
                .event-form textarea {
                    min-height: 86px;
                    padding-top: 13px;
                    resize: vertical;
                    line-height: 1.5;
                }
                .event-form input::placeholder,
                .event-form textarea::placeholder {
                    color: rgba(255,255,255,0.34);
                }
                .event-form select option {
                    background: #121719;
                    color: #fff8ec;
                }
                .event-form select option:disabled {
                    color: rgba(255,248,236,0.52);
                }
                .event-form select option:checked {
                    background: #d8ad2e;
                    color: #151008;
                }
                .event-form input:focus,
                .event-form select:focus,
                .event-form textarea:focus {
                    border-color: #f2c641;
                    box-shadow: 0 0 0 3px rgba(242,198,65,0.16);
                }
                .event-form-section {
                    margin: 18px 0 14px;
                    padding: 14px 0 0;
                    border-top: 1px solid rgba(216,173,46,0.18);
                }
                .event-form-section span {
                    display: block;
                    color: #d8ad2e;
                    font-size: 0.68rem;
                    font-weight: 950;
                    letter-spacing: 0.13em;
                    text-transform: uppercase;
                }
                .event-form-section p {
                    margin: 7px 0 0;
                    color: rgba(226,235,244,0.66);
                    font-size: 0.82rem;
                    line-height: 1.5;
                }
                .event-choice-field {
                    border: 0;
                    padding: 0;
                    margin: 0 0 14px;
                    min-width: 0;
                }
                .event-choice-field.progressive,
                .event-form-section.progressive,
                .event-final-step.progressive {
                    animation: eventQuestionIn 0.28s ease both;
                }
                .event-choice-field legend {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    width: 100%;
                    margin: 0 0 8px;
                    color: rgba(255,255,255,0.72);
                    font-size: 0.68rem;
                    font-weight: 900;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    line-height: 1.35;
                }
                .event-choice-field legend span {
                    min-width: 0;
                }
                .event-choice-field legend small {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 40px;
                    height: 24px;
                    padding: 0 8px;
                    border: 1px solid rgba(242,198,65,0.34);
                    border-radius: 999px;
                    background: rgba(242,198,65,0.1);
                    color: #f2c641;
                    font-size: 0.66rem;
                    font-weight: 950;
                    letter-spacing: 0.05em;
                    white-space: nowrap;
                }
                .event-choice-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 8px;
                }
                .event-choice-field.stacked .event-choice-grid {
                    grid-template-columns: 1fr;
                }
                .event-choice-option {
                    position: relative;
                    display: grid !important;
                    grid-template-columns: 17px minmax(0, 1fr);
                    align-items: center;
                    gap: 9px !important;
                    min-height: 42px;
                    margin: 0 !important;
                    padding: 9px 10px;
                    border: 1px solid rgba(255,255,255,0.14);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.045);
                    color: rgba(255,255,255,0.78) !important;
                    cursor: pointer;
                    font-size: 0.78rem !important;
                    font-weight: 780 !important;
                    letter-spacing: 0 !important;
                    line-height: 1.3 !important;
                    text-transform: none !important;
                    transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
                }
                .event-choice-option input {
                    position: absolute;
                    width: 1px;
                    min-height: 1px;
                    opacity: 0;
                    pointer-events: none;
                    border: 0;
                    padding: 0;
                    margin: 0;
                }
                .event-choice-mark {
                    display: grid;
                    place-items: center;
                    width: 15px;
                    height: 15px;
                    border: 1px solid rgba(255,255,255,0.32);
                    border-radius: 4px;
                    background: rgba(0,0,0,0.16);
                    color: #151008;
                    font-size: 0.72rem;
                    font-weight: 950;
                    line-height: 1;
                }
                .event-choice-option:has(input:focus-visible),
                .event-choice-option:hover {
                    border-color: rgba(242,198,65,0.72);
                    background: rgba(242,198,65,0.1);
                }
                .event-choice-option:has(input:checked) {
                    border-color: #f2c641;
                    background: rgba(216,173,46,0.18);
                    color: #fff8ec !important;
                    box-shadow:
                        0 0 0 1px rgba(242,198,65,0.34),
                        0 12px 26px rgba(216,173,46,0.1);
                }
                .event-choice-option:has(input:checked) .event-choice-mark {
                    border-color: #f2c641;
                    background: #f2c641;
                }
                .event-choice-option:has(input:checked) .event-choice-mark::after {
                    content: 'x';
                    transform: translateY(-0.5px);
                }
                .event-choice-back {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 32px;
                    margin-top: 10px;
                    padding: 0 12px;
                    border: 1px solid rgba(255,255,255,0.14);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.04);
                    color: rgba(255,248,236,0.7);
                    font-size: 0.72rem;
                    font-weight: 850;
                    cursor: pointer;
                }
                .event-choice-back:hover {
                    border-color: rgba(242,198,65,0.52);
                    color: #f2c641;
                }
                .event-form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                }
                .creci-grid {
                    grid-template-columns: minmax(0, 1fr) 78px;
                }
                .event-type {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 8px;
                    margin: 4px 0 12px;
                }
                .event-type button {
                    min-height: 42px;
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.045);
                    color: rgba(255,255,255,0.78);
                    font-weight: 850;
                    cursor: pointer;
                }
                .event-type button.active {
                    border-color: rgba(216,173,46,0.75);
                    background: rgba(216,173,46,0.16);
                    color: #fff8ec;
                }
                .event-type button:focus-visible {
                    outline: none;
                    border-color: #f2c641;
                    box-shadow: 0 0 0 3px rgba(242,198,65,0.16);
                }
                .event-consent {
                    display: grid !important;
                    grid-template-columns: 19px 1fr;
                    gap: 10px;
                    align-items: start;
                    color: rgba(226,235,244,0.66) !important;
                    font-size: 0.78rem !important;
                    font-weight: 600 !important;
                    letter-spacing: 0 !important;
                    line-height: 1.45;
                    text-transform: none !important;
                }
                .event-consent input {
                    width: 17px;
                    min-height: 17px;
                    margin-top: 2px;
                }
                .event-submit,
                .event-form-success button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 50px;
                    border-radius: 8px;
                    font-weight: 950;
                    cursor: pointer;
                }
                .event-submit {
                    width: 100%;
                    border: 0;
                    background: linear-gradient(135deg, #e5ba45, #bd7c14);
                    color: #151008;
                    font-size: 0.76rem;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    box-shadow: 0 18px 38px rgba(188,124,20,0.26);
                }
                .event-submit:disabled {
                    opacity: 0.68;
                    cursor: not-allowed;
                }
                .event-form-error {
                    border: 1px solid rgba(239,68,68,0.34);
                    background: rgba(239,68,68,0.12);
                    color: #fecaca;
                    border-radius: 8px;
                    padding: 11px;
                    margin-bottom: 12px;
                    font-size: 0.86rem;
                    line-height: 1.45;
                }
                .event-form-success {
                    padding: 42px 34px;
                    text-align: center;
                }
                .event-form-success svg {
                    color: #22c55e;
                    margin: 0 auto 14px;
                }
                .event-form-success h3 {
                    margin: 0 0 8px;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.9rem;
                    letter-spacing: 0;
                }
                .event-form-success p {
                    color: rgba(255,255,255,0.72);
                    line-height: 1.6;
                    margin: 0 0 20px;
                }
                .event-whatsapp-cta {
                    display: grid;
                    gap: 10px;
                    margin: 22px 0;
                    padding: 16px;
                    border: 1px solid rgba(34,197,94,0.32);
                    border-radius: 8px;
                    background: rgba(34,197,94,0.1);
                    text-align: left;
                }
                .event-whatsapp-cta span {
                    color: #bbf7d0;
                    font-size: 0.74rem;
                    font-weight: 950;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .event-whatsapp-cta a {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 48px;
                    border-radius: 8px;
                    background: #22c55e;
                    color: #06210f;
                    font-size: 0.82rem;
                    font-weight: 950;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    text-decoration: none;
                    box-shadow: 0 16px 32px rgba(34,197,94,0.2);
                }
                .event-whatsapp-cta small,
                .event-whatsapp-fallback {
                    color: rgba(226,235,244,0.7);
                    font-size: 0.78rem;
                    line-height: 1.45;
                }
                .event-whatsapp-fallback {
                    margin: 20px 0;
                    padding: 13px;
                    border: 1px solid rgba(242,198,65,0.26);
                    border-radius: 8px;
                    background: rgba(242,198,65,0.08);
                    text-align: left;
                }
                .event-form-success button {
                    border: 1px solid rgba(255,255,255,0.14);
                    background: rgba(255,255,255,0.06);
                    color: #fff8ec;
                    padding: 0 16px;
                }
                .spin {
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes eventQuestionIn {
                    from {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @media (max-width: 1020px) {
                    .event-report-grid {
                        grid-template-columns: 1fr;
                        width: min(720px, 100%);
                        margin: 0 auto;
                    }
                    .event-form-card {
                        grid-row: auto;
                        grid-column: auto;
                    }
                }
                @media (max-width: 720px) {
                    .event-report {
                        background:
                            linear-gradient(180deg, rgba(18,10,9,0.24), rgba(6,11,12,0.48) 46%, rgba(4,8,9,0.58) 100%),
                            linear-gradient(90deg, rgba(12,7,6,0.18), rgba(5,9,10,0.02), rgba(4,8,9,0.22)),
                            var(--event-bg) center top / cover fixed no-repeat;
                    }
                    .event-report-stage {
                        width: min(100% - 36px, 430px);
                        padding-top: 42px;
                    }
                    .event-report-hero {
                        margin-bottom: 20px;
                    }
                    .event-report-brand {
                        font-size: clamp(1.61rem, 8.32vw, 2.6rem);
                        line-height: 0.9;
                    }
                    .event-report-kicker {
                        margin-top: 22px;
                        letter-spacing: 0.18em;
                        font-size: 0.5rem;
                    }
                    .event-report-hero h1 {
                        font-size: clamp(0.93rem, 4vw, 1.28rem);
                    }
                    .event-report-subtitle {
                        display: none;
                    }
                    .event-form-head h2 {
                        font-size: clamp(1.35rem, 6vw, 1.62rem);
                        white-space: nowrap;
                    }
                    .event-hero-cta {
                        display: none;
                    }
                    .event-form-card {
                        order: -1;
                    }
                    .event-card {
                        border-color: rgba(218,173,46,0.3);
                        background:
                            radial-gradient(circle at 100% 0%, rgba(207,128,29,0.16), transparent 42%),
                            linear-gradient(135deg, rgba(54,36,31,0.64), rgba(5,16,18,0.7));
                        box-shadow: 0 24px 62px rgba(0,0,0,0.32);
                        backdrop-filter: blur(10px) saturate(118%);
                    }
                    .event-form-card {
                        background:
                            radial-gradient(circle at 100% 100%, rgba(204,129,29,0.2), transparent 44%),
                            linear-gradient(180deg, rgba(58,38,33,0.66), rgba(7,13,15,0.72));
                    }
                    .event-form input,
                    .event-form select,
                    .event-form textarea {
                        border-color: rgba(255,255,255,0.22);
                        background: rgba(18,23,24,0.52);
                    }
                    .event-form label:focus-within {
                        color: #f2c641;
                    }
                    .event-choice-field:focus-within legend {
                        color: #f2c641;
                    }
                    .event-choice-option {
                        border-color: rgba(255,255,255,0.22);
                        background: rgba(18,23,24,0.48);
                    }
                    .event-form input:focus,
                    .event-form select:focus,
                    .event-form textarea:focus {
                        border-color: #f2c641;
                        background: rgba(8,13,14,0.68);
                        box-shadow:
                            0 0 0 1px rgba(242,198,65,0.46),
                            0 0 0 4px rgba(242,198,65,0.12);
                    }
                    .event-type button {
                        background: rgba(18,23,24,0.48);
                    }
                    .event-type button.active,
                    .event-type button:focus-visible {
                        border-color: #f2c641;
                        background: rgba(216,173,46,0.18);
                        box-shadow:
                            0 0 0 1px rgba(242,198,65,0.34),
                            0 12px 26px rgba(216,173,46,0.1);
                    }
                    .event-host-card {
                        display: block;
                        padding: 22px;
                        align-items: start;
                    }
                    .event-host-card::after {
                        content: '';
                        display: block;
                        clear: both;
                    }
                    .event-host-card img {
                        float: left;
                        width: 96px;
                        height: 96px;
                        margin: 2px 18px 10px 0;
                    }
                    .event-host-card p {
                        text-align: justify;
                        text-align-last: left;
                        hyphens: auto;
                    }
                    .event-host-card span {
                        font-size: 0.62rem;
                        letter-spacing: 0.1em;
                        line-height: 1.25;
                    }
                    .event-host-card h2 {
                        font-size: 1.28rem;
                        white-space: nowrap;
                    }
                    .event-main-card,
                    .event-small-card,
                    .event-wide-card,
                    .event-form {
                        padding: 22px;
                    }
                    .event-main-card {
                        padding: 20px;
                    }
                    .event-main-card h2 {
                        margin-bottom: 10px;
                        font-size: clamp(1.22rem, 6.1vw, 1.52rem);
                        line-height: 1.02;
                    }
                    .event-main-card p {
                        font-size: 0.85rem;
                        line-height: 1.42;
                    }
                    .event-meta-grid {
                        gap: 12px;
                        margin-top: 18px;
                    }
                    .event-meta-grid div {
                        min-height: auto;
                        padding: 14px 16px;
                    }
                    .event-meta-grid strong,
                    .event-location-link {
                        margin-top: 7px;
                        font-size: 0.92rem;
                    }
                    .event-meta-grid span {
                        margin-top: 4px;
                        font-size: 0.62rem;
                    }
                    .event-meta-grid small {
                        margin-top: 7px;
                        font-size: 0.7rem;
                        line-height: 1.35;
                    }
                    .event-small-row,
                    .event-wide-card {
                        display: none;
                    }
                    .event-meta-grid,
                    .event-small-row,
                    .event-choice-grid,
                    .event-form-grid {
                        grid-template-columns: 1fr;
                    }
                    .creci-grid {
                        grid-template-columns: minmax(0, 1fr) 76px;
                    }
                    .event-wide-card {
                        grid-template-columns: 1fr;
                    }
                    .event-whatsapp-cta {
                        padding: 14px;
                    }
                    .event-whatsapp-cta a {
                        width: 100%;
                    }
                }
                @keyframes eventCtaPulse {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 18px 38px rgba(188,124,20,0.2);
                        filter: brightness(1);
                    }
                    50% {
                        transform: scale(1.035);
                        box-shadow: 0 20px 48px rgba(229,186,69,0.38);
                        filter: brightness(1.08);
                    }
                }
            `}</style>
            </main>
            <Footer />
        </>
    )
}
