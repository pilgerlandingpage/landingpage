'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Download, Filter } from 'lucide-react'
import { ChatViewer } from '@/components/admin/ChatViewer'

interface Lead {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    funnel_stage: string
    is_vip: boolean
    lead_classification?: string | null
    whatsapp_sent: boolean
    ai_summary: string | null
    conversation_log: any[] | null
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

    // ... (keep existing state/handlers)

    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Gerenciamento de Leads</h1>
                        <p style={{ color: '#888', fontSize: '14px', marginTop: '4px', margin: 0 }}>Acompanhe e gerencie todos os seus contatos.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '400px' }}>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: '#f5f5f5', border: '1px solid #eee', borderRadius: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '4px', backgroundColor: '#f5f5f5', border: '1px solid #eee', borderRadius: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
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
                    className="animate-in fade-in duration-200"
                    style={{ 
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
                        backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' 
                    }}
                    onClick={closeLeadDetails}
                >
                    <div
                        className="animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                        style={{ 
                            backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', 
                            width: '100%', maxWidth: '1024px', maxHeight: '85vh', 
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.6)' 
                        }}
                    >

                        {/* Header */}
                        <div style={{ padding: '24px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div
                                    style={{ 
                                        height: '56px', width: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                        color: '#0a0a0a', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                        background: 'linear-gradient(135deg, #c9a96e 0%, #dfc18e 50%, #a88b4a 100%)' 
                                    }}
                                >
                                    <span style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'serif' }}>{selectedLead.name?.[0]?.toUpperCase() || '?'}</span>
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#f5f5f5', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'serif', margin: 0 }}>
                                        {selectedLead.name || 'Lead Anônimo'}
                                        <span
                                            style={{
                                                fontSize: '10px', padding: '4px 12px', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', border: '1px solid',
                                                backgroundColor: selectedLead.funnel_stage === 'lead' ? 'rgba(45, 157, 92, 0.1)' : 'rgba(201, 169, 110, 0.1)',
                                                color: selectedLead.funnel_stage === 'lead' ? '#4ade80' : '#c9a96e',
                                                borderColor: selectedLead.funnel_stage === 'lead' ? 'rgba(45, 157, 92, 0.2)' : 'rgba(201, 169, 110, 0.2)'
                                            }}
                                        >
                                            {stageLabel[selectedLead.funnel_stage] || selectedLead.funnel_stage}
                                        </span>
                                    </h2>
                                    <div style={{ color: '#a0a0a0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px', fontWeight: 300 }}>
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
                                style={{ height: '40px', width: '40px', borderRadius: '50%', backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0a0a0', border: '1px solid #2a2a2a', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#2a2a2a'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#c9a96e'; }}
                                onMouseOut={e => { e.currentTarget.style.backgroundColor = '#222'; e.currentTarget.style.color = '#a0a0a0'; e.currentTarget.style.borderColor = '#2a2a2a'; }}
                            >
                                <span style={{ fontSize: '20px', lineHeight: 1 }}>×</span>
                            </button>
                        </div>

                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', backgroundColor: '#0a0a0a', flexDirection: 'row', minHeight: 0 }}>

                            {/* Left Sidebar: Summary & Info */}
                            <div style={{ width: '400px', borderRight: '1px solid #2a2a2a', backgroundColor: '#1a1a1a', padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto' }}>

                                {/* AI Summary */}
                                <div>
                                    <h3 style={{ color: '#c9a96e', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'serif' }}>
                                        <span style={{ fontSize: '18px' }}>✨</span> Resumo Inteligente
                                    </h3>
                                    {selectedLead.ai_summary ? (
                                        <div
                                            style={{ padding: '20px', borderRadius: '12px', border: '1px solid rgba(201, 169, 110, 0.2)', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(201, 169, 110, 0.08) 0%, rgba(201, 169, 110, 0.02) 100%)' }}
                                        >
                                            <p style={{ color: '#d0d0d0', lineHeight: 1.6, fontSize: '14px', fontWeight: 300, position: 'relative', zIndex: 10, margin: 0 }}>
                                                {selectedLead.ai_summary}
                                            </p>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '24px', borderRadius: '12px', border: '1px dashed #2a2a2a', textAlign: 'center', backgroundColor: 'rgba(34, 34, 34, 0.5)' }}>
                                            <p style={{ color: '#666', fontSize: '14px', fontStyle: 'italic', margin: 0 }}>Ainda sem resumo da IA.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Persona Details (The Panorama) */}
                                <div>
                                    <h3 style={{ color: '#c9a96e', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'serif' }}>
                                        <span style={{ fontSize: '18px' }}>🎯</span> Panorama de Qualificação
                                    </h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
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
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '12px' }}>
                                        <div style={{ backgroundColor: '#111', padding: '16px', borderRadius: '12px', border: '1px solid #222' }}>
                                            <span style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Finalidade</span>
                                            <span style={{ color: '#f5f5f5', fontSize: '14px', fontWeight: 500 }}>
                                                {selectedLead.lead_purpose || 'Não informada'}
                                            </span>
                                        </div>
                                        <div style={{ backgroundColor: '#111', padding: '16px', borderRadius: '12px', border: '1px solid #222' }}>
                                            <span style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Investimento Estimado</span>
                                            <span style={{ color: '#f5f5f5', fontSize: '14px', fontWeight: 500 }}>
                                                {selectedLead.lead_budget || 'Não informado'}
                                            </span>
                                        </div>
                                        <div style={{ backgroundColor: '#111', padding: '16px', borderRadius: '12px', border: '1px solid #222' }}>
                                            <span style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Prazo de Compra</span>
                                            <span style={{ color: '#f5f5f5', fontSize: '14px', fontWeight: 500 }}>
                                                {selectedLead.lead_timeframe || 'Não informado'}
                                            </span>
                                        </div>
                                        <div style={{ backgroundColor: '#111', padding: '16px', borderRadius: '12px', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyItems: 'space-between' }}>
                                            <div style={{ flex: 1 }}>
                                                <span style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Inscrito no Push</span>
                                                <span style={{ color: '#f5f5f5', fontSize: '14px', fontWeight: 500 }}>
                                                    {selectedLead.push_subscribed_lead ? 'Sim, Ativo' : 'Não'}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '24px' }}>{selectedLead.push_subscribed_lead ? '🔔' : '🔕'}</span>
                                        </div>
                                        {selectedLead.is_partner && (
                                            <div style={{ backgroundColor: 'rgba(201, 169, 110, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(201, 169, 110, 0.2)', textAlign: 'center' }}>
                                                <span style={{ color: '#c9a96e', fontSize: '12px', fontWeight: 'bold', fontFamily: 'serif', textTransform: 'uppercase', letterSpacing: '0.1em', fontStyle: 'italic' }}>🤝 Solicitou Parceria</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div>
                                    <h3 style={{ color: '#666', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #2a2a2a', fontFamily: 'serif' }}>
                                        Ficha Técnica
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#666', fontSize: '14px', transition: 'color 0.2s' }}>Origem</span>
                                            <span style={{ color: '#f5f5f5', fontSize: '14px', fontWeight: 500, backgroundColor: '#2a2a2a', padding: '4px 12px', borderRadius: '4px', border: '1px solid #333' }}>
                                                {sourceLabel[selectedLead.visitor?.detected_source?.toLowerCase() || ''] || selectedLead.visitor?.detected_source || 'Desconhecido'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#666', fontSize: '14px', transition: 'color 0.2s' }}>Dispositivo</span>
                                            <span style={{ color: '#f5f5f5', fontSize: '14px' }}>
                                                {deviceLabel[selectedLead.visitor?.device_type?.toLowerCase() || ''] || selectedLead.visitor?.device_type || '—'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#666', fontSize: '14px', transition: 'color 0.2s' }}>Sistema / Nav.</span>
                                            <span style={{ color: '#f5f5f5', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }} title={`${selectedLead.visitor?.os || ''} / ${selectedLead.visitor?.browser || ''}`}>
                                                {selectedLead.visitor?.os || '?'} / {selectedLead.visitor?.browser || '?'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#666', fontSize: '14px', transition: 'color 0.2s' }}>Localização</span>
                                            <span style={{ color: '#f5f5f5', fontSize: '14px', textAlign: 'right' }}>
                                                {[safeDecode(selectedLead.visitor?.city), safeDecode(selectedLead.visitor?.region), selectedLead.visitor?.country].filter(Boolean).join(', ') || '—'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#666', fontSize: '14px', transition: 'color 0.2s' }}>IP</span>
                                            <span style={{ color: '#888', fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#111', padding: '4px 8px', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                                                {selectedLead.visitor?.ip_address || '—'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#666', fontSize: '14px', transition: 'color 0.2s' }}>Data</span>
                                            <span style={{ color: '#f5f5f5', fontSize: '14px' }}>
                                                {new Date(selectedLead.created_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Location Map */}
                                {(selectedLead.visitor?.city || selectedLead.visitor?.region) && (
                                    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #2a2a2a', height: '160px', position: 'relative', cursor: 'pointer' }}
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
                                        width: '100%', padding: '14px', fontWeight: 'bold', borderRadius: '12px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#0a0a0a', border: 'none', cursor: 'pointer',
                                        background: 'linear-gradient(135deg, #c9a96e 0%, #a88b4a 100%)',
                                        boxShadow: '0 4px 20px rgba(201, 169, 110, 0.2)'
                                    }}
                                    onClick={() => window.open(`https://wa.me/${selectedLead.phone?.replace(/\D/g, '')}`, '_blank')}
                                >
                                    <span>💬</span>
                                    Abrir no WhatsApp
                                </button>
                            </div>

                            {/* Right Content: Chat History */}
                            <div style={{ flex: 1, backgroundColor: '#111', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
                                {/* Chat Header */}
                                <div style={{ padding: '16px 24px', borderBottom: '1px solid #2a2a2a', backgroundColor: 'rgba(17, 17, 17, 0.8)', backdropFilter: 'blur(4px)', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ color: '#666', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'serif', margin: 0 }}>
                                        Histórico da Conversa
                                    </h3>
                                    <span style={{ backgroundColor: '#1a1a1a', color: '#888', padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid #2a2a2a' }}>
                                        {selectedLead.conversation_log?.length || 0} mensagens
                                    </span>
                                </div>

                                {/* Chat Messages Area */}
                                <ChatViewer
                                    messages={selectedLead.conversation_log}
                                    leadName={selectedLead.name || 'Cliente'}
                                    brokerName={selectedLead.landing_page?.title}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
