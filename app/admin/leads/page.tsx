'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Download, Filter } from 'lucide-react'


interface Lead {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    avatar_url?: string | null
    avatar_source?: string | null
    avatar_updated_at?: string | null
    funnel_stage: string
    is_vip: boolean
    lead_classification?: string | null
    whatsapp_sent: boolean
    ai_summary: string | null
    conversation_log: any[] | null
    metadata?: any
    created_at: string
    lead_purpose?: string | null
    lead_budget?: string | null
    lead_timeframe?: string | null
    is_partner?: boolean
    push_subscribed_lead?: boolean
    landing_page?: {
        title: string
    }
    visitor?: {
        detected_source: string
        browser: string
        device_type: string
        ip_address: string
        os: string
        country?: string
        city?: string
        region?: string
    }
}

interface Visitor {
    id: string
    ip_address: string
    detected_source: string
    city: string
    region: string
    country: string
    browser: string
    os: string
    device_type: string
    first_visit_at: string
    last_visit_at: string
    page_views: number
    is_lead: boolean
    funnel_stage: string
    push_subscribed?: boolean
}

const stageLabel: Record<string, string> = {
    'lead': 'Novo Lead',
    'contacted': 'Contatado',
    'scheduled': 'Agendado',
    'proposal': 'Proposta',
    'closed': 'Fechado',
    'lost': 'Perdido'
}

const stageBadge: Record<string, string> = {
    'lead': 'badge-success',
    'contacted': 'badge-info',
    'scheduled': 'badge-warning',
    'proposal': 'badge-primary',
    'closed': 'badge-success',
    'lost': 'badge-error'
}

const deviceLabel: Record<string, string> = {
    'mobile': '📱 Celular',
    'desktop': '💻 Computador',
    'tablet': 'ipad Tablet',
}

const sourceLabel: Record<string, string> = {
    'direct': 'Acesso Direto',
    'google': 'Google',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'linkedin': 'LinkedIn',
    'organic': 'Orgânico',
    'referral': 'Referência',
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [stageFilter, setStageFilter] = useState('')
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [counts, setCounts] = useState({
        total: 0,
        lead: 0,
        contacted: 0,
        scheduled: 0,
        proposal: 0,
        closed: 0,
        lost: 0,
        purpose_invest: 0,
        purpose_housing: 0,
        timeframe_now: 0,
        has_push: 0,
        partners: 0
    })

    const [activeTab, setActiveTab] = useState<'leads' | 'visitors'>('leads')
    const [visitors, setVisitors] = useState<Visitor[]>([])
    const [loadingVisitors, setLoadingVisitors] = useState(false)

    const openLeadDetails = (lead: Lead) => setSelectedLead(lead)
    const closeLeadDetails = () => setSelectedLead(null)

    const safeDecode = (str?: string) => {
        if (!str) return ''
        try {
            return decodeURIComponent(str)
        } catch (e) {
            return str
        }
    }

    useEffect(() => {
        const fetchLeads = async () => {
            try {
                const res = await fetch('/api/admin/leads')
                if (!res.ok) throw new Error('Failed to fetch')

                const leadsData: Lead[] = await res.json()
                setLeads(leadsData)

                // Calculate counts
                const newCounts = {
                    total: leadsData.length,
                    lead: 0,
                    contacted: 0,
                    scheduled: 0,
                    proposal: 0,
                    closed: 0,
                    lost: 0,
                    purpose_invest: 0,
                    purpose_housing: 0,
                    timeframe_now: 0,
                    has_push: 0,
                    partners: 0
                }

                leadsData.forEach(lead => {
                    if (newCounts.hasOwnProperty(lead.funnel_stage)) {
                        newCounts[lead.funnel_stage as keyof typeof newCounts]++
                    }
                    if (lead.lead_purpose?.toLowerCase().includes('investimento')) newCounts.purpose_invest++
                    if (lead.lead_purpose?.toLowerCase().includes('moradia')) newCounts.purpose_housing++
                    if (lead.lead_timeframe?.toLowerCase().includes('imediato')) newCounts.timeframe_now++
                    if (lead.push_subscribed_lead) newCounts.has_push++
                    if (lead.is_partner) newCounts.partners++
                })
                setCounts(newCounts)
            } catch (error) {
                console.error('Error fetching leads:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchLeads()
    }, [])

    useEffect(() => {
        if (activeTab === 'visitors' && visitors.length === 0) {
            fetchVisitors()
        }
    }, [activeTab])

    const fetchVisitors = async () => {
        setLoadingVisitors(true)
        try {
            const res = await fetch('/api/admin/visitors')
            if (!res.ok) throw new Error('Failed to fetch visitors')
            const data: Visitor[] = await res.json()
            setVisitors(data)
        } catch (error) {
            console.error('Error fetching visitors:', error)
        } finally {
            setLoadingVisitors(false)
        }
    }

    const filteredLeads = leads.filter(lead => {
        if (stageFilter && lead.funnel_stage !== stageFilter) return false

        if (!search) return true
        const s = search.toLowerCase()
        return (
            lead.name?.toLowerCase().includes(s) ||
            lead.email?.toLowerCase().includes(s) ||
            lead.phone?.includes(s)
        )
    })

    const exportCSV = () => {
        const headers = ['Nome', 'Email', 'Telefone', 'Estágio', 'VIP', 'Origem', 'Localização', 'Navegador', 'Dispositivo', 'IP', 'Data']
        const rows = filteredLeads.map(l => [
            l.name || '',
            l.email || '',
            l.phone || '',
            stageLabel[l.funnel_stage] || l.funnel_stage,
            l.is_vip ? 'Sim' : 'Não',
            l.visitor?.detected_source || '',
            [safeDecode(l.visitor?.city), safeDecode(l.visitor?.region), l.visitor?.country].filter(Boolean).join(', ') || '',
            l.visitor?.browser || '',
            l.visitor?.device_type || '',
            l.visitor?.ip_address || '',
            new Date(l.created_at).toLocaleString('pt-BR'),
        ])

        const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
    }

    const formatWhatsAppClick = (click?: any) => {
        if (!click || typeof click !== 'object') return ''
        const label = click.link_label || click.link_title || click.link_type || click.event_type || 'Link'
        const date = click.clicked_at ? new Date(click.clicked_at).toLocaleString('pt-BR') : ''
        return date ? `${label} em ${date}` : String(label)
    }

    const cleanConversationContent = (content: string) => {
        return String(content || '')
            .replace(/\[BOTOES_URL:[^\]]+\]/gi, '')
            .replace(/\*\*/g, '')
            .trim()
    }

    const extractConversationButtons = (content: string) => {
        const buttons: { label: string; url: string }[] = []
        const matches = String(content || '').matchAll(/\[BOTOES_URL:([^\]]+)\]/gi)
        for (const match of matches) {
            const parts = String(match[1] || '').split('|').map(p => p.trim()).filter(Boolean)
            for (const part of parts.slice(1)) {
                const [label, url] = part.split('=>').map(p => p?.trim())
                if (label && url) buttons.push({ label, url })
            }
        }
        return buttons
    }

    const renderChatMessage = (msg: any, idx: number) => {
        const isLead = msg.role !== 'assistant'
        const text = cleanConversationContent(msg.content)
        const buttons = extractConversationButtons(msg.content)
        const messageTime = msg.timestamp
            ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : ''

        return (
            <div key={idx} style={{
                alignSelf: isLead ? 'flex-end' : 'flex-start',
                maxWidth: '72%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isLead ? 'flex-end' : 'flex-start',
                gap: '4px',
            }}>
                <div style={{
                    backgroundColor: isLead ? '#d9fdd3' : '#fff',
                    color: '#111b21',
                    borderRadius: isLead ? '8px 0 8px 8px' : '0 8px 8px 8px',
                    boxShadow: '0 1px 1px rgba(11,20,26,0.13)',
                    padding: '8px 10px 6px',
                    fontSize: '14px',
                    lineHeight: 1.42,
                    minWidth: '70px',
                    position: 'relative',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                }}>
                    {text ? <div>{text}</div> : null}
                    {buttons.length > 0 && (
                        <div style={{
                            borderTop: text ? '1px solid rgba(0,0,0,0.08)' : 'none',
                            display: 'grid',
                            gap: '4px',
                            marginTop: text ? '8px' : 0,
                            paddingTop: text ? '6px' : 0,
                        }}>
                            {buttons.map((button, buttonIndex) => (
                                <button
                                    key={`${button.label}-${buttonIndex}`}
                                    onClick={() => window.open(button.url, '_blank')}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#008069',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        padding: '6px 8px',
                                        textAlign: 'center',
                                    }}
                                >
                                    ↗ {button.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <span style={{
                        color: '#667781',
                        display: 'block',
                        fontSize: '11px',
                        marginTop: '4px',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                    }}>
                        {messageTime}{isLead ? ' ✓✓' : ''}
                    </span>
                </div>
            </div>
        )
    }

    // ... (keep existing state/handlers)

    return (
        <div>
            <div className="leads-page-header" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                <div className="leads-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Gerenciamento de Leads</h1>
                        <p style={{ color: '#888', fontSize: '14px', marginTop: '4px', margin: 0 }}>Acompanhe e gerencie todos os seus contatos.</p>
                    </div>
                    <div className="leads-search-actions" style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '400px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} size={18} />
                            <input
                                type="text"
                                placeholder="Buscar leads..."
                                className="form-input"
                                style={{ width: '100%', paddingLeft: '40px' }}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <button onClick={exportCSV} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Download size={18} />
                            <span>Exportar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation & Filters Toolbar */}
            <div className="leads-toolbar" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                {/* Tabs */}
                <div className="leads-primary-tabs" style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: '#f5f5f5', border: '1px solid #eee', borderRadius: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <button
                        onClick={() => setActiveTab('leads')}
                        style={{
                            padding: '10px 32px', borderRadius: '12px', fontSize: '14px', fontWeight: 900, transition: 'all 0.3s', cursor: 'pointer', border: 'none',
                            ...(activeTab === 'leads' ? { backgroundColor: '#c9a96e', color: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transform: 'scale(1.02)' } : { backgroundColor: 'transparent', color: '#888' })
                        }}
                    >
                        Leads <span style={{ marginLeft: '4px', fontWeight: 'bold', opacity: activeTab === 'leads' ? 0.4 : 0.3 }}>({counts.total})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('visitors')}
                        style={{
                            padding: '10px 40px', borderRadius: '12px', fontSize: '14px', fontWeight: 900, transition: 'all 0.3s', cursor: 'pointer', border: 'none',
                            ...(activeTab === 'visitors' ? { backgroundColor: '#c9a96e', color: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transform: 'scale(1.02)' } : { backgroundColor: 'transparent', color: '#888' })
                        }}
                    >
                        Visitantes <span style={{ marginLeft: '4px', fontWeight: 'bold', opacity: activeTab === 'visitors' ? 0.4 : 0.3 }}>({visitors.length})</span>
                    </button>
                </div>

                {/* Filters (Only for Leads tab) */}
                {activeTab === 'leads' && (
                    <div className="leads-stage-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '4px', backgroundColor: '#f5f5f5', border: '1px solid #eee', borderRadius: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        <button
                            onClick={() => setStageFilter('')}
                            style={{
                                padding: '10px 20px', borderRadius: '12px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', transition: 'all 0.3s', cursor: 'pointer', border: 'none',
                                ...(!stageFilter ? { backgroundColor: '#c9a96e', color: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transform: 'scale(1.02)' } : { backgroundColor: 'transparent', color: '#999' })
                            }}
                        >
                            Todos <span style={{ marginLeft: '4px', opacity: !stageFilter ? 0.4 : 0.3 }}>({counts.total})</span>
                        </button>
                        {Object.entries(stageLabel).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setStageFilter(key)}
                                style={{
                                    padding: '10px 20px', borderRadius: '12px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', transition: 'all 0.3s', cursor: 'pointer', border: 'none',
                                    ...(stageFilter === key ? { backgroundColor: '#c9a96e', color: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transform: 'scale(1.02)' } : { backgroundColor: 'transparent', color: '#999' })
                                }}
                            >
                                {label} <span style={{ marginLeft: '4px', opacity: stageFilter === key ? 0.4 : 0.3 }}>({counts[key as keyof typeof counts] || 0})</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="chart-card" style={{ padding: 0, overflow: 'auto' }}>
                {activeTab === 'leads' ? (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Contato</th>
                                <th>Perfil / Persona</th>
                                <th>Push</th>
                                <th>Estágio</th>
                                <th>Origem / Local</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        Carregando...
                                    </td>
                                </tr>
                            ) : filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        Nenhum lead encontrado
                                    </td>
                                </tr>
                            ) : (
                                filteredLeads.map(lead => (
                                    <tr key={lead.id}>
                                        <td style={{ fontWeight: 500 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ height: '34px', width: '34px', borderRadius: '50%', overflow: 'hidden', background: '#dfe5e7', color: '#111b21', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                                                    {lead.avatar_url ? (
                                                        <img src={lead.avatar_url} alt={lead.name || 'Lead'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <span>{lead.name?.[0]?.toUpperCase() || '?'}</span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {lead.name || <span style={{ color: '#444', fontStyle: 'italic' }}>Anônimo</span>}
                                                    </span>
                                                    {lead.lead_classification === 'vip' ? (
                                                        <span style={{ background: 'linear-gradient(to right, #b8945f, #e8c691)', color: '#000', fontSize: '9px', padding: '2px 8px', borderRadius: '9999px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0em', boxShadow: '0 0 10px rgba(184,148,95,0.4)' }}>
                                                            VIP
                                                        </span>
                                                    ) : lead.lead_classification === 'hot' ? (
                                                        <span style={{ backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.3)', fontSize: '9px', padding: '2px 8px', borderRadius: '9999px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '-0em' }}>
                                                            QUENTE
                                                        </span>
                                                    ) : (
                                                        <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '9px', padding: '2px 8px', borderRadius: '9999px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '-0em', opacity: 0.6 }}>
                                                            FRIO
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#555', marginTop: '4px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ width: '4px', height: '4px', backgroundColor: '#333', borderRadius: '50%' }}></span>
                                                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                                                </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {lead.phone && <div style={{ fontSize: '0.85rem' }}>📱 {lead.phone}</div>}
                                            {lead.email && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>✉️ {lead.email}</div>}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {lead.is_partner ? (
                                                    <span className="badge badge-info" style={{ fontSize: '9px', width: 'fit-content' }}>🤝 PARCERIA</span>
                                                ) : (
                                                    <>
                                                        {lead.lead_purpose && (
                                                            <span className={`badge ${lead.lead_purpose.toLowerCase().includes('investimento') ? 'badge-primary' : 'badge-gold'}`} style={{ fontSize: '9px', width: 'fit-content' }}>
                                                                {lead.lead_purpose.toUpperCase()}
                                                            </span>
                                                        )}
                                                        {lead.lead_timeframe && lead.lead_timeframe.toLowerCase().includes('imediato') && (
                                                            <span className="badge badge-success" style={{ fontSize: '9px', width: 'fit-content', marginLeft: 'auto' }}>⚡ AGORA</span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {lead.push_subscribed_lead ? (
                                                <span title="Inscrito no Push" className="text-xl">🔔</span>
                                            ) : (
                                                <span title="Não inscrito" className="text-xl opacity-10 grayscale">🔕</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge ${stageBadge[lead.funnel_stage] || 'badge-gold'}`}>
                                                {stageLabel[lead.funnel_stage] || lead.funnel_stage}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.85rem' }}>
                                            <div style={{ fontWeight: 500 }}>{lead.visitor?.detected_source || '—'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                📍 {[safeDecode(lead.visitor?.city), lead.visitor?.country].filter(Boolean).join(', ')}
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '0.85rem' }}>
                                            {lead.visitor?.browser || '—'} / {lead.visitor?.device_type || '—'}
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            <div style={{ fontFamily: 'monospace' }}>{lead.visitor?.ip_address || '—'}</div>
                                            <div>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</div>
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-sm btn-outline"
                                                onClick={() => openLeadDetails(lead)}
                                                style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                                            >
                                                Ver Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Última Visita</th>
                                <th>Origem / Local</th>
                                <th>Dispositivo</th>
                                <th>Páginas</th>
                                <th>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingVisitors ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Carregando visitantes...</td></tr>
                            ) : visitors.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum visitante recente</td></tr>
                            ) : (
                                visitors.map(visitor => (
                                    <tr key={visitor.id}>
                                        <td>
                                            {visitor.is_lead ? (
                                                <span className="badge badge-success">Lead ({stageLabel[visitor.funnel_stage || ''] || visitor.funnel_stage})</span>
                                            ) : (
                                                <span className="badge badge-gold opacity-50">Visitante</span>
                                            )}
                                            {visitor.push_subscribed && (
                                                <span title="Assinante Push notification" style={{ marginLeft: '8px', cursor: 'help' }}>🔔</span>
                                            )}
                                        </td>
                                        <td style={{ fontSize: '0.85rem' }}>
                                            {new Date(visitor.last_visit_at).toLocaleString('pt-BR')}
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                1ª: {new Date(visitor.first_visit_at).toLocaleDateString('pt-BR')}
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '0.85rem' }}>
                                            <div style={{ fontWeight: 500 }}>{visitor.detected_source || '—'}</div>
                                            {(visitor.city || visitor.region || visitor.country) && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    📍 {[safeDecode(visitor.city), safeDecode(visitor.region), visitor.country].filter(Boolean).join(', ')}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ fontSize: '0.85rem' }}>
                                            {visitor.browser || '—'} <br />
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>{visitor.os} • {visitor.device_type}</span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className="text-[#f5f5f5] font-mono bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                                                {visitor.page_views || 1}
                                            </span>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {visitor.ip_address}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Details Modal */}
            {selectedLead && (
                <div
                    className="animate-in fade-in duration-200 lead-detail-overlay"
                    style={{ 
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
                        backgroundColor: 'rgba(17,27,33,0.72)', backdropFilter: 'blur(6px)'
                    }}
                    onClick={closeLeadDetails}
                >
                    <div
                        className="animate-in zoom-in-95 duration-200 lead-detail-modal"
                        onClick={e => e.stopPropagation()}
                        style={{ 
                            backgroundColor: '#f0f2f5', border: '1px solid rgba(17,27,33,0.12)', borderRadius: '10px',
                            width: '100%', maxWidth: '1180px', maxHeight: '88vh',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            boxShadow: '0 24px 70px rgba(0,0,0,0.38)'
                        }}
                    >

                        {/* Header */}
                        <div className="lead-detail-header" style={{ padding: '12px 18px', borderBottom: '1px solid #d1d7db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f2f5' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div
                                    style={{ 
                                        height: '48px', width: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#111b21',
                                        background: '#dfe5e7',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {selectedLead.avatar_url ? (
                                        <img src={selectedLead.avatar_url} alt={selectedLead.name || 'Lead'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontSize: '22px', fontWeight: 700 }}>{selectedLead.name?.[0]?.toUpperCase() || '?'}</span>
                                    )}
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111b21', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                        {selectedLead.name || 'Lead Anônimo'}
                                        <span
                                            style={{
                                                fontSize: '10px', padding: '4px 12px', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', border: '1px solid',
                                                backgroundColor: selectedLead.funnel_stage === 'lead' ? '#d9fdd3' : '#fff7d6',
                                                color: selectedLead.funnel_stage === 'lead' ? '#008069' : '#9a6b00',
                                                borderColor: selectedLead.funnel_stage === 'lead' ? '#a8e6bd' : '#f0d27a'
                                            }}
                                        >
                                            {stageLabel[selectedLead.funnel_stage] || selectedLead.funnel_stage}
                                        </span>
                                    </h2>
                                    <div style={{ color: '#667781', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px', fontWeight: 400 }}>
                                        {selectedLead.phone && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: '#c9a96e' }}>📱</span> {selectedLead.phone}
                                            </span>
                                        )}
                                        {selectedLead.email && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: '#c9a96e' }}>✉️</span> {selectedLead.email}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={closeLeadDetails}
                                style={{ height: '40px', width: '40px', borderRadius: '50%', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#54656f', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#e9edef'; e.currentTarget.style.color = '#111b21'; }}
                                onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#54656f'; }}
                            >
                                <span style={{ fontSize: '20px', lineHeight: 1 }}>×</span>
                            </button>
                        </div>

                        <div className="lead-detail-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', backgroundColor: '#fff', flexDirection: 'row', minHeight: 0 }}>

                            {/* Left Sidebar: Summary & Info */}
                            <div className="lead-detail-sidebar" style={{ width: '360px', borderRight: '1px solid #d1d7db', backgroundColor: '#fff', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>

                                {/* AI Summary */}
                                <div>
                                    <h3 style={{ color: '#008069', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '15px' }}>✨</span> Resumo Inteligente
                                    </h3>
                                    {selectedLead.ai_summary ? (
                                        <div
                                            style={{ padding: '11px 12px', borderRadius: '8px', border: '1px solid #d1d7db', position: 'relative', overflow: 'hidden', background: '#f7f8fa' }}
                                        >
                                            <p style={{ color: '#111b21', lineHeight: 1.35, fontSize: '12px', fontWeight: 400, position: 'relative', zIndex: 10, margin: 0 }}>
                                                {selectedLead.ai_summary}
                                            </p>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '12px', borderRadius: '8px', border: '1px dashed #d1d7db', textAlign: 'center', backgroundColor: '#f7f8fa' }}>
                                            <p style={{ color: '#667781', fontSize: '12px', fontStyle: 'italic', margin: 0 }}>Ainda sem resumo da IA.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Persona Details (The Panorama) */}
                                <div>
                                    <h3 style={{ color: '#008069', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '15px' }}>🎯</span> Panorama de Qualificação
                                    </h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                        {selectedLead.lead_classification === 'vip' ? (
                                            <span style={{ background: 'linear-gradient(to right, #b8945f, #e8c691)', color: '#000', fontSize: '10px', padding: '4px 12px', borderRadius: '9999px', fontWeight: '900', boxShadow: '0 0 15px rgba(184,148,95,0.3)', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
                                                💎 Lead VIP
                                            </span>
                                        ) : selectedLead.lead_classification === 'hot' ? (
                                            <span style={{ backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.3)', fontSize: '10px', padding: '4px 12px', borderRadius: '9999px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
                                                🔥 Lead Quente
                                            </span>
                                        ) : (
                                            <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '10px', padding: '4px 12px', borderRadius: '9999px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '-0.05em', opacity: 0.6 }}>
                                                ❄️ Lead Frio
                                            </span>
                                        )}
                                    </div>
                                    <div className="lead-qualification-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                                        <div style={{ backgroundColor: '#f7f8fa', padding: '10px', borderRadius: '8px', border: '1px solid #e9edef', minHeight: '58px' }}>
                                            <span style={{ color: '#667781', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Finalidade</span>
                                            <span style={{ color: '#111b21', fontSize: '12px', fontWeight: 500, lineHeight: 1.25 }}>
                                                {selectedLead.lead_purpose || 'Não informada'}
                                            </span>
                                        </div>
                                        <div style={{ backgroundColor: '#f7f8fa', padding: '10px', borderRadius: '8px', border: '1px solid #e9edef', minHeight: '58px' }}>
                                            <span style={{ color: '#667781', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Investimento</span>
                                            <span style={{ color: '#111b21', fontSize: '12px', fontWeight: 500, lineHeight: 1.25 }}>
                                                {selectedLead.lead_budget || 'Não informado'}
                                            </span>
                                        </div>
                                        <div style={{ backgroundColor: '#f7f8fa', padding: '10px', borderRadius: '8px', border: '1px solid #e9edef', minHeight: '58px' }}>
                                            <span style={{ color: '#667781', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Prazo</span>
                                            <span style={{ color: '#111b21', fontSize: '12px', fontWeight: 500, lineHeight: 1.25 }}>
                                                {selectedLead.lead_timeframe || 'Não informado'}
                                            </span>
                                        </div>
                                        <div style={{ backgroundColor: '#f7f8fa', padding: '10px', borderRadius: '8px', border: '1px solid #e9edef', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '58px' }}>
                                            <div style={{ flex: 1 }}>
                                                <span style={{ color: '#667781', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Push</span>
                                                <span style={{ color: '#111b21', fontSize: '12px', fontWeight: 500, lineHeight: 1.25 }}>
                                                    {selectedLead.push_subscribed_lead ? 'Sim, Ativo' : 'Não'}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '18px' }}>{selectedLead.push_subscribed_lead ? '🔔' : '🔕'}</span>
                                        </div>
                                        {selectedLead.is_partner && (
                                            <div style={{ gridColumn: '1 / -1', backgroundColor: 'rgba(201, 169, 110, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(201, 169, 110, 0.2)', textAlign: 'center' }}>
                                                <span style={{ color: '#c9a96e', fontSize: '12px', fontWeight: 'bold', fontFamily: 'serif', textTransform: 'uppercase', letterSpacing: '0.1em', fontStyle: 'italic' }}>🤝 Solicitou Parceria</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div>
                                    <h3 style={{ color: '#667781', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #d1d7db' }}>
                                        Ficha Técnica
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>Origem</span>
                                            <span style={{ color: '#8a6d3b', fontSize: '12px', fontWeight: 700, backgroundColor: 'rgba(201, 169, 110, 0.14)', padding: '3px 8px', borderRadius: '999px', border: '1px solid rgba(201, 169, 110, 0.34)' }}>
                                                {sourceLabel[selectedLead.visitor?.detected_source?.toLowerCase() || ''] || selectedLead.visitor?.detected_source || 'Desconhecido'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>Dispositivo</span>
                                            <span style={{ color: '#111b21', fontSize: '12px' }}>
                                                {deviceLabel[selectedLead.visitor?.device_type?.toLowerCase() || ''] || selectedLead.visitor?.device_type || '—'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>Sistema / Nav.</span>
                                            <span style={{ color: '#111b21', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }} title={`${selectedLead.visitor?.os || ''} / ${selectedLead.visitor?.browser || ''}`}>
                                                {selectedLead.visitor?.os || '?'} / {selectedLead.visitor?.browser || '?'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>Localização</span>
                                            <span style={{ color: '#111b21', fontSize: '12px', textAlign: 'right' }}>
                                                {[safeDecode(selectedLead.visitor?.city), safeDecode(selectedLead.visitor?.region), selectedLead.visitor?.country].filter(Boolean).join(', ') || '—'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>IP</span>
                                            <span style={{ color: '#54656f', fontFamily: 'monospace', fontSize: '11px', backgroundColor: '#f0f2f5', padding: '3px 6px', borderRadius: '4px', border: '1px solid #d1d7db' }}>
                                                {selectedLead.visitor?.ip_address || '—'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>Data</span>
                                            <span style={{ color: '#111b21', fontSize: '12px' }}>
                                                {new Date(selectedLead.created_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                        {selectedLead.metadata?.last_whatsapp_click && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                                <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>Último clique</span>
                                                <span style={{ color: '#008069', fontSize: '11px', fontWeight: 700, textAlign: 'right', lineHeight: 1.25 }}>
                                                    {formatWhatsAppClick(selectedLead.metadata.last_whatsapp_click)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Location Map */}
                                {(selectedLead.visitor?.city || selectedLead.visitor?.region) && (
                                    <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #d1d7db', height: '96px', position: 'relative', cursor: 'pointer' }}
                                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([safeDecode(selectedLead.visitor?.city), safeDecode(selectedLead.visitor?.region), selectedLead.visitor?.country].filter(Boolean).join(', '))}`, '_blank')}
                                    >
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            title="Mapa de Localização do Lead"
                                            style={{ border: 0, filter: 'grayscale(100%) invert(90%) contrast(85%)' }}
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                            src={`https://maps.google.com/maps?q=${encodeURIComponent([safeDecode(selectedLead.visitor?.city), safeDecode(selectedLead.visitor?.region), selectedLead.visitor?.country].filter(Boolean).join(', '))}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                                        ></iframe>
                                    </div>
                                )}

                                {/* Action */}
                                <button
                                    style={{
                                        width: '100%', padding: '9px', fontWeight: 'bold', borderRadius: '8px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#0a0a0a', border: 'none', cursor: 'pointer',
                                        background: 'linear-gradient(135deg, #c9a96e 0%, #a88b4a 100%)',
                                        boxShadow: '0 4px 20px rgba(201, 169, 110, 0.2)'
                                    }}
                                    onClick={() => window.open(`https://wa.me/${selectedLead.phone?.replace(/\D/g, '')}`, '_blank')}
                                >
                                    <span>💬</span>
                                    Abrir no WhatsApp
                                </button>
                            </div>

                            {/* Right Content: Conversas WhatsApp */}
                            <div className="lead-detail-chat" style={{ flex: 1, backgroundColor: '#efeae2', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
                                {/* Header */}
                                <div style={{ padding: '10px 16px', borderBottom: '1px solid #d1d7db', backgroundColor: '#f0f2f5', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ height: '40px', width: '40px', borderRadius: '50%', background: '#dfe5e7', color: '#111b21', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, overflow: 'hidden' }}>
                                            {selectedLead.avatar_url ? (
                                                <img src={selectedLead.avatar_url} alt={selectedLead.name || 'Lead'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                selectedLead.name?.[0]?.toUpperCase() || '?'
                                            )}
                                        </div>
                                        <div>
                                            <h3 style={{ color: '#111b21', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                                                {selectedLead.name || 'Lead AnÃ´nimo'}
                                            </h3>
                                            <span style={{ color: '#667781', fontSize: '12px' }}>
                                                {selectedLead.phone || 'sem telefone'}
                                            </span>
                                        </div>
                                    </div>
                                    <span style={{ backgroundColor: '#fff', color: '#667781', padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', border: '1px solid #d1d7db' }}>
                                        {selectedLead.conversation_log?.length || 0} mensagens
                                    </span>
                                </div>

                                {/* Messages Area */}
                                <div className="lead-detail-messages" style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    padding: '22px 28px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    backgroundColor: '#efeae2',
                                    backgroundImage: 'url("https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/8c98994518b575bfd8c949e91d20548b.jpg")',
                                    backgroundSize: '420px auto',
                                    backgroundRepeat: 'repeat',
                                    backgroundPosition: 'center top',
                                }}>
                                    {selectedLead.conversation_log && selectedLead.conversation_log.length > 0 ? (
                                        selectedLead.conversation_log.map((msg: any, idx: number) => renderChatMessage(msg, idx))
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#667781', gap: '8px' }}>
                                            <span style={{ fontSize: '2rem' }}>💬</span>
                                            <span style={{ fontSize: '0.85rem' }}>Nenhuma conversa registrada</span>
                                        </div>
                                    )}
                                </div>
                                <div style={{ background: '#f0f2f5', borderTop: '1px solid #d1d7db', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ height: '40px', borderRadius: '999px', background: '#fff', color: '#667781', flex: 1, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: '14px' }}>
                                        Histórico espelhado do WhatsApp
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
