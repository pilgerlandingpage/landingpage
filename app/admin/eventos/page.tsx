'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
    CalendarDays,
    CheckCircle2,
    Clock,
    Copy,
    Download,
    ExternalLink,
    Loader2,
    MapPin,
    Plus,
    Users,
} from 'lucide-react'
import { DEFAULT_EVENT_HERO, buildEventSlug, formatShortDate, statusLabel } from '@/lib/events/utils'

type EventRow = {
    id: string
    title: string
    slug: string
    status: string
    event_date: string
    location_name?: string | null
    hero_image_url?: string | null
    capacity?: number | null
    registrations_count?: number
    checked_in_count?: number
    pending_messages_count?: number
}

const defaultDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + 14)
    date.setHours(19, 0, 0, 0)
    return date.toISOString().slice(0, 16)
}

const PROFILE_ASSESSMENT_PARENT_SLUG = 'encontro-corretores-pilger'
const PROFILE_ASSESSMENT_TITLE = 'Perfil do Corretor Ideal'
const PROFILE_ASSESSMENT_EVENT_DATE = '2026-07-09T14:00:00-03:00'

function profileAssessmentPath(slug: string) {
    return `/eventos/${slug}/perfil-corretor-ideal`
}

function profileAssessmentCopyKey(slug: string) {
    return `${slug}:perfil-corretor-ideal`
}

export default function EventosAdminPage() {
    const router = useRouter()
    const [events, setEvents] = useState<EventRow[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState<string | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [form, setForm] = useState({
        title: 'Encontro exclusivo para corretores',
        slug: '',
        subtitle: 'Uma apresentacao estrategica para profissionais do mercado imobiliario.',
        event_date: defaultDate(),
        location_name: 'Imobiliaria Guilherme Pilger',
        location_address: 'Balneario Camboriu / SC',
        format: 'presencial',
        capacity: '',
        status: 'draft',
        hero_image_url: DEFAULT_EVENT_HERO,
    })

    const publicBase = useMemo(() => {
        if (typeof window === 'undefined') return ''
        return window.location.origin
    }, [])

    const fetchEvents = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/admin/eventos', { cache: 'no-store' })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Erro ao carregar eventos.')
            setEvents(data.events || [])
        } catch (err: any) {
            setError(err?.message || 'Erro ao carregar eventos.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEvents()
    }, [])

    useEffect(() => {
        if (form.slug) return
        setForm(prev => ({ ...prev, slug: buildEventSlug(prev.title, prev.event_date) }))
    }, [form.title, form.event_date, form.slug])

    const updateForm = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const createEvent = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setSaving(true)
        setError(null)
        try {
            const response = await fetch('/api/admin/eventos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    capacity: form.capacity ? Number(form.capacity) : null,
                    create_default_rules: true,
                }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Erro ao criar evento.')
            router.push(`/admin/eventos/${data.event.id}`)
        } catch (err: any) {
            setError(err?.message || 'Erro ao criar evento.')
        } finally {
            setSaving(false)
        }
    }

    const copyLink = async (slug: string) => {
        const url = `${publicBase}/eventos/${slug}`
        await navigator.clipboard.writeText(url)
        setCopied(slug)
        setTimeout(() => setCopied(null), 1600)
    }

    const copyProfileAssessmentLink = async (slug: string) => {
        const url = `${publicBase}${profileAssessmentPath(slug)}`
        await navigator.clipboard.writeText(url)
        setCopied(profileAssessmentCopyKey(slug))
        setTimeout(() => setCopied(null), 1600)
    }

    const downloadContacts = (eventId?: string) => {
        const url = eventId
            ? `/api/admin/eventos/export-contacts?eventId=${encodeURIComponent(eventId)}`
            : '/api/admin/eventos/export-contacts'
        window.location.href = url
    }

    return (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 8px 48px' }}>
            <div className="admin-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <CalendarDays className="text-gold" size={28} /> Eventos
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                        Crie paginas de confirmacao, acompanhe inscritos e controle automacoes pelo WhatsApp global.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-outline" onClick={() => downloadContacts()}>
                        <Download size={16} />
                        Baixar contatos
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCreate(prev => !prev)}>
                        <Plus size={16} />
                        Novo evento
                    </button>
                </div>
            </div>

            {error && (
                <div className="chart-card" style={{ padding: 16, marginBottom: 18, borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>
                    {error}
                </div>
            )}

            {showCreate && (
                <form onSubmit={createEvent} className="chart-card" style={{ padding: 24, marginBottom: 22 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.8fr', gap: 16 }}>
                        <label style={labelStyle}>
                            Titulo
                            <input style={inputStyle} value={form.title} onChange={e => updateForm('title', e.target.value)} required />
                        </label>
                        <label style={labelStyle}>
                            Slug
                            <input style={inputStyle} value={form.slug} onChange={e => updateForm('slug', e.target.value)} required />
                        </label>
                    </div>
                    <label style={labelStyle}>
                        Subtitulo
                        <input style={inputStyle} value={form.subtitle} onChange={e => updateForm('subtitle', e.target.value)} />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.6fr 0.6fr', gap: 16 }}>
                        <label style={labelStyle}>
                            Data e horario
                            <input type="datetime-local" style={inputStyle} value={form.event_date} onChange={e => updateForm('event_date', e.target.value)} required />
                        </label>
                        <label style={labelStyle}>
                            Local
                            <input style={inputStyle} value={form.location_name} onChange={e => updateForm('location_name', e.target.value)} />
                        </label>
                        <label style={labelStyle}>
                            Vagas
                            <input type="number" min="0" style={inputStyle} value={form.capacity} onChange={e => updateForm('capacity', e.target.value)} placeholder="Sem limite" />
                        </label>
                        <label style={labelStyle}>
                            Status
                            <select style={inputStyle} value={form.status} onChange={e => updateForm('status', e.target.value)}>
                                <option value="draft">Rascunho</option>
                                <option value="published">Publicado</option>
                            </select>
                        </label>
                    </div>
                    <label style={labelStyle}>
                        Endereco ou instrucoes de acesso
                        <input style={inputStyle} value={form.location_address} onChange={e => updateForm('location_address', e.target.value)} />
                    </label>
                    <label style={labelStyle}>
                        Imagem de capa
                        <input style={inputStyle} value={form.hero_image_url} onChange={e => updateForm('hero_image_url', e.target.value)} />
                    </label>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                        <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                            Criar evento
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="chart-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Loader2 size={28} className="spin" style={{ margin: '0 auto 12px' }} />
                    Carregando eventos...
                </div>
            ) : events.length === 0 ? (
                <div className="chart-card" style={{ padding: 48, textAlign: 'center' }}>
                    <CalendarDays size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Nenhum evento criado ainda</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Crie o primeiro encontro e publique a pagina de confirmacao.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                    {events.map(event => {
                        const showProfileAssessment = event.slug === PROFILE_ASSESSMENT_PARENT_SLUG
                        const assessmentPath = profileAssessmentPath(event.slug)
                        const assessmentCopyKey = profileAssessmentCopyKey(event.slug)

                        return (
                            <Fragment key={event.id}>
                                <div className="chart-card" style={{ padding: 20, display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 18, alignItems: 'center' }}>
                                    <div
                                        style={{
                                            width: 96,
                                            height: 72,
                                            borderRadius: 8,
                                            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.35)), url("${event.hero_image_url || DEFAULT_EVENT_HERO}")`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            border: '1px solid var(--border)',
                                        }}
                                    />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                            <Link href={`/admin/eventos/${event.id}`} style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.05rem' }}>
                                                {event.title}
                                            </Link>
                                            <span style={statusPill(event.status)}>{statusLabel(event.status)}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                            <span style={metaItem}><Clock size={14} />{formatShortDate(event.event_date)}</span>
                                            <span style={metaItem}><MapPin size={14} />{event.location_name || 'Local a confirmar'}</span>
                                            <span style={metaItem}><Users size={14} />{event.registrations_count || 0} inscritos</span>
                                            <span>{event.checked_in_count || 0} check-ins</span>
                                            <span>{event.pending_messages_count || 0} mensagens pendentes</span>
                                        </div>
                                        <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                                            /eventos/{event.slug}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <button type="button" className="btn btn-outline btn-sm" onClick={() => downloadContacts(event.id)}>
                                            <Download size={14} />
                                            Contatos
                                        </button>
                                        <button className="btn btn-outline btn-sm" onClick={() => copyLink(event.slug)}>
                                            {copied === event.slug ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                            {copied === event.slug ? 'Copiado' : 'Copiar'}
                                        </button>
                                        <Link href={`/eventos/${event.slug}`} className="btn btn-outline btn-sm" target="_blank">
                                            <ExternalLink size={14} />
                                            Abrir
                                        </Link>
                                        <Link href={`/admin/eventos/${event.id}`} className="btn btn-primary btn-sm">
                                            Gerenciar
                                        </Link>
                                    </div>
                                </div>

                                {showProfileAssessment && (
                                    <div className="chart-card" style={{ padding: 20, display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 18, alignItems: 'center' }}>
                                        <div
                                            style={{
                                                width: 96,
                                                height: 72,
                                                borderRadius: 8,
                                                backgroundImage: `linear-gradient(135deg, rgba(232,190,94,0.72), rgba(15,23,42,0.56)), url("${event.hero_image_url || DEFAULT_EVENT_HERO}")`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                border: '1px solid rgba(196, 143, 48, 0.32)',
                                            }}
                                        />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                                <Link href={assessmentPath} target="_blank" style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.05rem' }}>
                                                    {PROFILE_ASSESSMENT_TITLE}
                                                </Link>
                                                <span style={statusPill('published')}>Publicado</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                                <span style={metaItem}><Clock size={14} />{formatShortDate(PROFILE_ASSESSMENT_EVENT_DATE)}</span>
                                                <span style={metaItem}><MapPin size={14} />{event.location_name || 'Local a confirmar'}</span>
                                                <span style={metaItem}><Users size={14} />{event.registrations_count || 0} leads do evento</span>
                                                <span>50 perguntas</span>
                                                <span>Resultado no celular</span>
                                            </div>
                                            <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                                                {assessmentPath}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn btn-outline btn-sm" onClick={() => downloadContacts(event.id)}>
                                                <Download size={14} />
                                                Leads
                                            </button>
                                            <button className="btn btn-outline btn-sm" onClick={() => copyProfileAssessmentLink(event.slug)}>
                                                {copied === assessmentCopyKey ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                                {copied === assessmentCopyKey ? 'Copiado' : 'Copiar'}
                                            </button>
                                            <Link href={assessmentPath} className="btn btn-outline btn-sm" target="_blank">
                                                <ExternalLink size={14} />
                                                Abrir
                                            </Link>
                                            <Link href={`/admin/eventos/${event.id}`} className="btn btn-primary btn-sm">
                                                Gerenciar
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </Fragment>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

const labelStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginTop: 14,
}

const inputStyle: CSSProperties = {
    minHeight: 42,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'rgba(15, 23, 42, 0.55)',
    color: 'var(--text-primary)',
    padding: '0 12px',
    outline: 'none',
}

const metaItem: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
}

function statusPill(status: string): CSSProperties {
    const colors: Record<string, string> = {
        published: '#22c55e',
        draft: '#f59e0b',
        archived: '#94a3b8',
    }
    const color = colors[status] || '#94a3b8'
    return {
        color,
        border: `1px solid ${color}45`,
        background: `${color}18`,
        borderRadius: 999,
        padding: '3px 8px',
        fontSize: '0.67rem',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
    }
}
