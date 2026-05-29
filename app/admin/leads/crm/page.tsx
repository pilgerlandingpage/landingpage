'use client'

import { useState, useEffect } from 'react'
import { Search, Phone, Mail, MapPin, DollarSign, Home, Clock, User, Filter, RefreshCw, ChevronDown, ChevronUp, Star, MessageSquare, FileText } from 'lucide-react'

interface LeadData {
    id: string
    lead_phone: string
    lead_name: string | null
    interest: string | null
    region: string | null
    budget_min: number | null
    budget_max: number | null
    bedrooms_wanted: number | null
    property_type: string | null
    timeline: string | null
    qualification_score: number
    status: string
    notes: string | null
    documents_received: any[]
    latitude: number | null
    longitude: number | null
    broker_id: string | null
    lead_id?: string | null
    lead_email?: string | null
    avatar_url?: string | null
    avatar_source?: string | null
    avatar_updated_at?: string | null
    source?: string | null
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    landing_page_title?: string | null
    landing_page_slug?: string | null
    device_type?: string | null
    browser?: string | null
    os?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    ai_summary?: string | null
    lead_classification?: string | null
    lead_score?: number | null
    last_whatsapp_click?: any | null
    whatsapp_clicks?: any[]
    site_activity?: any[]
    behavior_summary?: any | null
    precise_location?: any | null
    gps_permission?: any | null
    created_at: string
    updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    new: { label: 'Novo', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    qualifying: { label: 'Qualificando', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    qualified: { label: 'Qualificado', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    transferred: { label: 'Transferido', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    converted: { label: 'Convertido', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
    lost: { label: 'Perdido', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
}

function LeadAvatar({
    name,
    avatarUrl,
    size = 44,
}: {
    name?: string | null
    avatarUrl?: string | null
    size?: number
}) {
    const [imageFailed, setImageFailed] = useState(false)
    const initial = name?.trim()?.[0]?.toUpperCase() || '?'

    return (
        <div style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: '#dfe5e7',
            color: '#111b21',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.95rem',
            fontWeight: 700,
            flexShrink: 0,
            overflow: 'hidden',
        }}>
            {avatarUrl && !imageFailed ? (
                <img
                    src={avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                initial
            )}
        </div>
    )
}

export default function LeadCRMPage() {
    const [leads, setLeads] = useState<LeadData[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [expandedLead, setExpandedLead] = useState<string | null>(null)
    const [editingNotes, setEditingNotes] = useState<string | null>(null)
    const [notesText, setNotesText] = useState('')

    useEffect(() => {
        loadLeads()
    }, [statusFilter])

    async function loadLeads() {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (statusFilter !== 'all') params.set('status', statusFilter)
            if (search) params.set('search', search)
            const res = await fetch(`/api/admin/leads/crm?${params}`)
            const data = await res.json()
            if (data.success) setLeads(data.leads)
        } catch (err) {
            console.error('Erro ao carregar leads:', err)
        } finally {
            setLoading(false)
        }
    }

    async function updateLeadStatus(id: string, newStatus: string) {
        try {
            await fetch('/api/admin/leads/crm', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus })
            })
            setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus } : l))
        } catch (err) {
            console.error('Erro ao atualizar status:', err)
        }
    }

    async function saveNotes(id: string) {
        try {
            await fetch('/api/admin/leads/crm', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, notes: notesText })
            })
            setLeads(leads.map(l => l.id === id ? { ...l, notes: notesText } : l))
            setEditingNotes(null)
        } catch (err) {
            console.error('Erro ao salvar notas:', err)
        }
    }

    function getScoreColor(score: number): string {
        if (score >= 80) return '#22c55e'
        if (score >= 60) return '#f59e0b'
        if (score >= 40) return '#3b82f6'
        return '#999'
    }

    function getScoreLabel(score: number): string {
        if (score >= 80) return '🔥 Quente'
        if (score >= 60) return '🟡 Morno'
        if (score >= 40) return '🔵 Frio'
        return '⚪ Novo'
    }

    function getDisplayScore(lead: LeadData): number {
        return Math.max(Number(lead.qualification_score || 0), Number(lead.lead_score || 0))
    }

    function formatPhone(phone: string): string {
        if (!phone) return ''
        const clean = phone.replace(/\D/g, '')
        if (clean.length === 13) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`
        if (clean.length === 12) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`
        return phone
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    function getPreciseLocation(lead: LeadData) {
        const location = lead.precise_location
        const latitude = Number(location?.latitude)
        const longitude = Number(location?.longitude)

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

        return {
            latitude,
            longitude,
            accuracy: Number(location?.accuracy_meters || location?.accuracy || 0),
            capturedAt: location?.captured_at || location?.updated_at || null,
        }
    }

    function formatGpsLocation(lead: LeadData): string {
        const location = getPreciseLocation(lead)
        if (!location) return ''

        const accuracy = Number.isFinite(location.accuracy) && location.accuracy > 0
            ? ` +/- ${Math.round(location.accuracy)}m`
            : ''
        const capturedAt = location.capturedAt ? ` em ${formatDate(location.capturedAt)}` : ''

        return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${accuracy}${capturedAt}`
    }

    function formatCurrency(value: number | null): string {
        if (!value) return ''
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    }

    function formatClickAction(click: any): string {
        const type = String(click?.link_type || click?.event_type || 'link').replace(/^whatsapp_/, '').replace(/_click$/, '')
        const label = click?.link_label || click?.link_title || type
        return String(label || type)
    }

    function formatActivity(activity: any): string {
        const detail = activity?.detail ? ` - ${activity.detail}` : ''
        const title = activity?.property_title ? `: ${activity.property_title}` : ''
        return `${activity?.label || activity?.event_type || 'Atividade'}${title}${detail}`
    }

    // Stats
    const stats = {
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        qualifying: leads.filter(l => l.status === 'qualifying').length,
        qualified: leads.filter(l => l.status === 'qualified').length,
        transferred: leads.filter(l => l.status === 'transferred').length,
    }

    const cardStyle: React.CSSProperties = {
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e8e5e0',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
    }

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                        👥 CRM de Leads
                    </h1>
                    <p style={{ color: '#888', fontSize: '0.85rem', margin: '4px 0 0' }}>
                        Dados coletados automaticamente pelo agente IA
                    </p>
                </div>
                <button
                    onClick={loadLeads}
                    disabled={loading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                        background: '#f5f0ea', border: '1px solid #e0ddd8', borderRadius: 8,
                        cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#555'
                    }}
                >
                    <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    Atualizar
                </button>
            </div>

            {/* Stats Cards */}
            <div className="crm-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Total', value: stats.total, color: '#333', bg: '#f5f0ea' },
                    { label: 'Novos', value: stats.new, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)' },
                    { label: 'Qualificando', value: stats.qualifying, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' },
                    { label: 'Qualificados', value: stats.qualified, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)' },
                    { label: 'Transferidos', value: stats.transferred, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)' },
                ].map(s => (
                    <div key={s.label} className="crm-stat-card" style={{
                        background: s.bg, borderRadius: 10, padding: '14px 16px',
                        border: `1px solid ${s.color}22`
                    }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Search & Filter */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && loadLeads()}
                        placeholder="Buscar por nome, telefone, e-mail ou região..."
                        style={{
                            width: '100%', padding: '10px 10px 10px 34px',
                            border: '1px solid #e0ddd8', borderRadius: 8,
                            fontSize: '0.85rem', fontFamily: 'inherit', background: '#fafafa'
                        }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={14} color="#888" />
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{
                            padding: '10px 12px', border: '1px solid #e0ddd8',
                            borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit',
                            background: '#fafafa', cursor: 'pointer'
                        }}
                    >
                        <option value="all">Todos os Status</option>
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Lead Cards */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                    <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: 8 }}>Carregando leads...</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
            ) : leads.length === 0 ? (
                <div style={{ ...cardStyle, padding: 60, textAlign: 'center', color: '#aaa' }}>
                    <User size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600 }}>Nenhum lead encontrado</p>
                    <p style={{ fontSize: '0.82rem' }}>Os dados aparecerão aqui conforme o agente IA conversar com os leads</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {leads.map(lead => {
                        const isExpanded = expandedLead === lead.id
                        const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new
                        const displayScore = getDisplayScore(lead)

                        return (
                            <div key={lead.id} style={cardStyle}>
                                {/* Card Header */}
                                <div
                                    onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
                                        cursor: 'pointer', transition: 'background 0.15s'
                                    }}
                                >
                                    {/* WhatsApp Avatar */}
                                    <LeadAvatar name={lead.lead_name} avatarUrl={lead.avatar_url} />

                                    {/* Score Circle */}
                                    <div style={{
                                        width: 48, height: 48, borderRadius: '50%',
                                        background: `conic-gradient(${getScoreColor(displayScore)} ${displayScore}%, #f0ede8 0)`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                    }}>
                                        <div style={{
                                            width: 38, height: 38, borderRadius: '50%', background: '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.72rem', fontWeight: 700, color: getScoreColor(displayScore)
                                        }}>
                                            {displayScore}
                                        </div>
                                    </div>

                                    {/* Name & Phone */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>
                                                {lead.lead_name || 'Sem nome'}
                                            </span>
                                            <span style={{
                                                padding: '2px 10px', borderRadius: 12,
                                                fontSize: '0.68rem', fontWeight: 600,
                                                color: statusCfg.color, background: statusCfg.bg,
                                                border: `1px solid ${statusCfg.color}33`
                                            }}>
                                                {statusCfg.label}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Phone size={11} /> {formatPhone(lead.lead_phone)}
                                            </span>
                                            {lead.lead_email && (
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    color: '#888',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                    minWidth: 0,
                                                    maxWidth: 260,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    <Mail size={11} style={{ flexShrink: 0 }} /> {lead.lead_email}
                                                </span>
                                            )}
                                            {lead.source && (
                                                <span style={{ fontSize: '0.75rem', color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <MessageSquare size={11} /> {lead.source}
                                                </span>
                                            )}
                                            {lead.region && (
                                                <span style={{ fontSize: '0.75rem', color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <MapPin size={11} /> {lead.region}
                                                </span>
                                            )}
                                            {(lead.budget_min || lead.budget_max) && (
                                                <span style={{ fontSize: '0.75rem', color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <DollarSign size={11} /> {formatCurrency(lead.budget_min)} {lead.budget_max ? `- ${formatCurrency(lead.budget_max)}` : ''}
                                                </span>
                                            )}
                                            {lead.property_type && (
                                                <span style={{ fontSize: '0.75rem', color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Home size={11} /> {lead.property_type}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Score Label + Time */}
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: getScoreColor(displayScore) }}>
                                            {getScoreLabel(displayScore)}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: '#bbb', marginTop: 4 }}>
                                            {formatDate(lead.updated_at)}
                                        </div>
                                    </div>

                                    {isExpanded ? <ChevronUp size={16} color="#aaa" /> : <ChevronDown size={16} color="#aaa" />}
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f0ede8' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 16 }}>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>E-MAIL</label>
                                                <span style={{ fontSize: '0.85rem', color: '#333', wordBreak: 'break-word' }}>{lead.lead_email || '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>INTERESSE</label>
                                                <span style={{ fontSize: '0.85rem', color: '#333' }}>{lead.interest || '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>DORMITÓRIOS</label>
                                                <span style={{ fontSize: '0.85rem', color: '#333' }}>{lead.bedrooms_wanted ? `${lead.bedrooms_wanted} dormitórios` : '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>PRAZO</label>
                                                <span style={{ fontSize: '0.85rem', color: '#333' }}>{lead.timeline || '—'}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>COORDENADAS SALVAS</label>
                                                <span style={{ fontSize: '0.82rem', color: '#333' }}>
                                                    {lead.latitude && lead.longitude ? `${lead.latitude}, ${lead.longitude}` : '—'}
                                                </span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>DOCUMENTOS RECEBIDOS</label>
                                                <span style={{ fontSize: '0.82rem', color: '#333' }}>
                                                    {Array.isArray(lead.documents_received) ? lead.documents_received.length : 0}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12, padding: 12, background: '#fafafa', border: '1px solid #f0ede8', borderRadius: 8 }}>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>ORIGEM</label>
                                                <span style={{ fontSize: '0.82rem', color: '#333' }}>{lead.source || '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>CAMPANHA</label>
                                                <span style={{ fontSize: '0.82rem', color: '#333' }}>{lead.utm_campaign || lead.utm_source || '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>LANDING PAGE</label>
                                                <span style={{ fontSize: '0.82rem', color: '#333' }}>{lead.landing_page_title || lead.landing_page_slug || '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>DISPOSITIVO</label>
                                                <span style={{ fontSize: '0.82rem', color: '#333' }}>{[lead.device_type, lead.browser, lead.os].filter(Boolean).join(' / ') || '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>LOCALIZACAO APROX.</label>
                                                <span style={{ fontSize: '0.82rem', color: '#333' }}>{[lead.city, lead.state, lead.country].filter(Boolean).join(', ') || '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>GPS DO LEAD</label>
                                                {getPreciseLocation(lead) ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const location = getPreciseLocation(lead)
                                                            if (location) window.open(`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`, '_blank')
                                                        }}
                                                        style={{ border: 'none', background: 'transparent', padding: 0, color: '#008069', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                                                    >
                                                        {formatGpsLocation(lead)}
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: '0.82rem', color: '#333' }}>{lead.gps_permission?.status ? `Permissao: ${lead.gps_permission.status}` : '—'}</span>
                                                )}
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>RESUMO IA</label>
                                                <span style={{ fontSize: '0.82rem', color: '#333' }}>{lead.ai_summary || '—'}</span>
                                            </div>
                                        </div>

                                        {lead.behavior_summary && (
                                            <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8 }}>INTELIGENCIA DO LEAD</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                                    <div>
                                                        <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>TEMPERATURA</span>
                                                        <strong style={{ color: '#1e293b', fontSize: '0.82rem' }}>{lead.behavior_summary.intent_temperature || lead.lead_classification || 'Em analise'}</strong>
                                                    </div>
                                                    <div>
                                                        <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>SCORE DIGITAL</span>
                                                        <strong style={{ color: '#1e293b', fontSize: '0.82rem' }}>{lead.behavior_summary.engagement_score ?? lead.lead_score ?? 0}/100</strong>
                                                    </div>
                                                    <div>
                                                        <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>ULTIMA PAGINA</span>
                                                        <strong style={{ color: '#1e293b', fontSize: '0.82rem' }}>{lead.behavior_summary.last_page_path || '---'}</strong>
                                                    </div>
                                                </div>
                                                {Array.isArray(lead.behavior_summary.intent_signals) && lead.behavior_summary.intent_signals.length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                                        {lead.behavior_summary.intent_signals.slice(0, 5).map((signal: string, index: number) => (
                                                            <span key={`${signal}-${index}`} style={{ padding: '4px 8px', borderRadius: 999, background: '#fff', border: '1px solid #e2e8f0', color: '#334155', fontSize: '0.72rem', fontWeight: 700 }}>
                                                                {signal}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {lead.behavior_summary.next_best_action && (
                                                    <p style={{ margin: '10px 0 0', color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>
                                                        Proxima acao: {lead.behavior_summary.next_best_action}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {Array.isArray(lead.whatsapp_clicks) && lead.whatsapp_clicks.length > 0 && (
                                            <div style={{ marginTop: 12, padding: 12, background: '#f6fffb', border: '1px solid rgba(0,128,105,0.16)', borderRadius: 8 }}>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#008069', display: 'block', marginBottom: 8 }}>CLIQUE DOS BOTÕES</label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {lead.whatsapp_clicks.slice(0, 5).map((click: any, index: number) => (
                                                        <div key={`${click?.clicked_at || index}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.78rem', color: '#334155' }}>
                                                            <span style={{ fontWeight: 600 }}>{formatClickAction(click)}</span>
                                                            <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{click?.clicked_at ? formatDate(click.clicked_at) : 'agora'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {Array.isArray(lead.site_activity) && lead.site_activity.length > 0 && (
                                            <div style={{ marginTop: 12, padding: 12, background: '#fffaf0', border: '1px solid rgba(184,148,95,0.22)', borderRadius: 8 }}>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8a6d3b', display: 'block', marginBottom: 8 }}>ATIVIDADE NO SITE</label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                                    {lead.site_activity.slice(0, 6).map((activity: any, index: number) => (
                                                        <div key={`${activity?.id || activity?.occurred_at || index}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.78rem', color: '#334155' }}>
                                                            <span style={{ fontWeight: 600 }}>{formatActivity(activity)}</span>
                                                            <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{activity?.occurred_at ? formatDate(activity.occurred_at) : 'agora'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Status change */}
                                        <div style={{ marginTop: 16 }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 6 }}>ALTERAR STATUS</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => updateLeadStatus(lead.id, key)}
                                                        style={{
                                                            padding: '4px 12px', borderRadius: 8,
                                                            fontSize: '0.72rem', fontWeight: 600,
                                                            border: lead.status === key ? `2px solid ${cfg.color}` : '1px solid #e0ddd8',
                                                            background: lead.status === key ? cfg.bg : '#fafafa',
                                                            color: lead.status === key ? cfg.color : '#888',
                                                            cursor: 'pointer', transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {cfg.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div style={{ marginTop: 16 }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                                                <FileText size={11} /> NOTAS DO CORRETOR
                                            </label>
                                            {editingNotes === lead.id ? (
                                                <div>
                                                    <textarea
                                                        value={notesText}
                                                        onChange={e => setNotesText(e.target.value)}
                                                        style={{
                                                            width: '100%', padding: 10, border: '1px solid #e0ddd8',
                                                            borderRadius: 8, fontSize: '0.82rem', fontFamily: 'inherit',
                                                            minHeight: 60, resize: 'vertical', background: '#fafafa'
                                                        }}
                                                    />
                                                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                                        <button
                                                            onClick={() => saveNotes(lead.id)}
                                                            style={{
                                                                padding: '6px 14px', background: 'linear-gradient(135deg, #b8945f, #d4b87a)',
                                                                color: '#fff', border: 'none', borderRadius: 6,
                                                                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                                                            }}
                                                        >
                                                            Salvar
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingNotes(null)}
                                                            style={{
                                                                padding: '6px 14px', background: '#f5f0ea',
                                                                color: '#888', border: '1px solid #e0ddd8', borderRadius: 6,
                                                                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                                                            }}
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => { setEditingNotes(lead.id); setNotesText(lead.notes || '') }}
                                                    style={{
                                                        padding: 10, background: '#fafaf7', borderRadius: 8,
                                                        border: '1px dashed #e0ddd8', cursor: 'pointer',
                                                        fontSize: '0.82rem', color: lead.notes ? '#555' : '#bbb',
                                                        minHeight: 40
                                                    }}
                                                >
                                                    {lead.notes || 'Clique para adicionar notas...'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
