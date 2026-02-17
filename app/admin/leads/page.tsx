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
    whatsapp_sent: boolean
    ai_summary: string | null
    conversation_log: any[] | null
    created_at: string
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
        lost: 0
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
                    lost: 0
                }

                leadsData.forEach(lead => {
                    if (newCounts.hasOwnProperty(lead.funnel_stage)) {
                        newCounts[lead.funnel_stage as keyof typeof newCounts]++
                    }
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
            <div className="admin-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1>Gerenciamento de Leads</h1>
                    <p className="text-[#888] text-sm mt-1">Acompanhe e gerencie todos os seus contatos.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar leads..."
                            className="form-input pl-10 w-full"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button onClick={exportCSV} className="btn btn-outline flex items-center gap-2">
                        <Download size={18} />
                        <span className="hidden md:inline">Exportar</span>
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 p-1 bg-[#1a1a1a] rounded-xl inline-flex border border-[#333]">
                <button
                    onClick={() => setActiveTab('leads')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'leads' ? 'bg-[#c9a96e] text-black shadow-lg' : 'text-[#888] hover:text-[#f5f5f5] hover:bg-[#222]'}`}
                >
                    Leads ({counts.total})
                </button>
                <button
                    onClick={() => setActiveTab('visitors')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'visitors' ? 'bg-[#c9a96e] text-black shadow-lg' : 'text-[#888] hover:text-[#f5f5f5] hover:bg-[#222]'}`}
                >
                    Visitantes (Topo de Funil)
                </button>
            </div>

            {/* Filters (Only for Leads tab) */}
            {activeTab === 'leads' && (
                <div className="flex gap-2 overflow-x-auto pb-4 mb-4 custom-scrollbar">
                    <button
                        onClick={() => setStageFilter('')}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${!stageFilter
                            ? 'bg-[#c9a96e] text-black border-[#c9a96e]'
                            : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:border-[#666]'
                            }`}
                    >
                        Todos ({counts.total})
                    </button>
                    {Object.entries(stageLabel).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setStageFilter(key)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${stageFilter === key
                                ? 'bg-[#c9a96e] text-black border-[#c9a96e]'
                                : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:border-[#666]'
                                }`}
                        >
                            {label} ({counts[key as keyof typeof counts] || 0})
                        </button>
                    ))}
                </div>
            )}

            {/* Table */}
            <div className="chart-card" style={{ padding: 0, overflow: 'auto' }}>
                {activeTab === 'leads' ? (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Contato</th>
                                <th>Estágio</th>
                                <th>Origem / Local</th>
                                <th>Dispositivo</th>
                                <th>IP / Data</th>
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
                                            {lead.name || <span style={{ color: 'var(--text-muted)' }}>Anônimo</span>}
                                            {lead.is_vip && <span className="badge badge-gold" style={{ marginLeft: '8px', fontSize: '0.7em' }}>VIP</span>}
                                        </td>
                                        <td>
                                            {lead.phone && <div style={{ fontSize: '0.85rem' }}>📱 {lead.phone}</div>}
                                            {lead.email && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>✉️ {lead.email}</div>}
                                        </td>
                                        <td>
                                            <span className={`badge ${stageBadge[lead.funnel_stage] || 'badge-gold'}`}>
                                                {stageLabel[lead.funnel_stage] || lead.funnel_stage}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.85rem' }}>
                                            <div style={{ fontWeight: 500 }}>{lead.visitor?.detected_source || '—'}</div>
                                            {(lead.visitor?.city || lead.visitor?.region || lead.visitor?.country) && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    📍 {[safeDecode(lead.visitor?.city), safeDecode(lead.visitor?.region), lead.visitor?.country].filter(Boolean).join(', ')}
                                                </div>
                                            )}
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
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
                    onClick={closeLeadDetails}
                >
                    <div
                        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
                    >

                        {/* Header */}
                        <div className="p-6 border-b border-[#2a2a2a] flex justify-between items-center bg-[#111]">
                            <div className="flex items-center gap-5">
                                <div
                                    className="h-14 w-14 rounded-full flex items-center justify-center text-[#0a0a0a] shadow-lg"
                                    style={{ background: 'linear-gradient(135deg, #c9a96e 0%, #dfc18e 50%, #a88b4a 100%)' }}
                                >
                                    <span className="text-2xl font-bold font-serif">{selectedLead.name?.[0]?.toUpperCase() || '?'}</span>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-[#f5f5f5] flex items-center gap-3 font-serif">
                                        {selectedLead.name || 'Lead Anônimo'}
                                        <span
                                            className="text-[10px] px-3 py-1 rounded-full uppercase tracking-widest font-bold border"
                                            style={{
                                                backgroundColor: selectedLead.funnel_stage === 'lead' ? 'rgba(45, 157, 92, 0.1)' : 'rgba(201, 169, 110, 0.1)',
                                                color: selectedLead.funnel_stage === 'lead' ? '#4ade80' : '#c9a96e',
                                                borderColor: selectedLead.funnel_stage === 'lead' ? 'rgba(45, 157, 92, 0.2)' : 'rgba(201, 169, 110, 0.2)'
                                            }}
                                        >
                                            {stageLabel[selectedLead.funnel_stage] || selectedLead.funnel_stage}
                                        </span>
                                    </h2>
                                    <div className="text-[#a0a0a0] text-sm flex items-center gap-4 mt-1 font-light">
                                        {selectedLead.phone && (
                                            <span className="flex items-center gap-2">
                                                <span className="text-[#c9a96e]">📱</span> {selectedLead.phone}
                                            </span>
                                        )}
                                        {selectedLead.email && (
                                            <span className="flex items-center gap-2">
                                                <span className="text-[#c9a96e]">✉️</span> {selectedLead.email}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={closeLeadDetails}
                                className="h-10 w-10 rounded-full bg-[#222] hover:bg-[#2a2a2a] flex items-center justify-center text-[#a0a0a0] hover:text-white transition-all border border-[#2a2a2a] hover:border-[#c9a96e]"
                            >
                                <Filter className="rotate-45" size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#0a0a0a]">

                            {/* Left Sidebar: Summary & Info */}
                            <div className="w-full md:w-[380px] border-r border-[#2a2a2a] bg-[#1a1a1a] p-8 space-y-8 overflow-y-auto">

                                {/* AI Summary */}
                                <div>
                                    <h3 className="text-[#c9a96e] text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 font-serif">
                                        <span className="text-lg">✨</span> Resumo Inteligente
                                    </h3>
                                    {selectedLead.ai_summary ? (
                                        <div
                                            className="p-5 rounded-xl border border-[#c9a96e]/20 relative overflow-hidden"
                                            style={{ background: 'linear-gradient(135deg, rgba(201, 169, 110, 0.08) 0%, rgba(201, 169, 110, 0.02) 100%)' }}
                                        >
                                            <p className="text-[#d0d0d0] leading-relaxed text-sm font-light relative z-10">
                                                {selectedLead.ai_summary}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="p-6 rounded-xl border border-[#2a2a2a] border-dashed text-center bg-[#222]/50">
                                            <p className="text-[#666] text-sm italic">Ainda sem resumo da IA.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Details Grid */}
                                <div>
                                    <h3 className="text-[#666] text-xs font-bold uppercase tracking-widest mb-4 pb-2 border-b border-[#2a2a2a] font-serif">
                                        Ficha Técnica
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center group">
                                            <span className="text-[#666] text-sm group-hover:text-[#888] transition-colors">Origem</span>
                                            <span className="text-[#f5f5f5] text-sm font-medium bg-[#2a2a2a] px-3 py-1 rounded border border-[#333]">
                                                {sourceLabel[selectedLead.visitor?.detected_source?.toLowerCase() || ''] || selectedLead.visitor?.detected_source || 'Desconhecido'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center group">
                                            <span className="text-[#666] text-sm group-hover:text-[#888] transition-colors">Dispositivo</span>
                                            <span className="text-[#f5f5f5] text-sm">
                                                {deviceLabel[selectedLead.visitor?.device_type?.toLowerCase() || ''] || selectedLead.visitor?.device_type || '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center group">
                                            <span className="text-[#666] text-sm group-hover:text-[#888] transition-colors">Sistema / Nav.</span>
                                            <span className="text-[#f5f5f5] text-sm truncate max-w-[150px]" title={`${selectedLead.visitor?.os || ''} / ${selectedLead.visitor?.browser || ''}`}>
                                                {selectedLead.visitor?.os || '?'} / {selectedLead.visitor?.browser || '?'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center group">
                                            <span className="text-[#666] text-sm group-hover:text-[#888] transition-colors">Localização</span>
                                            <span className="text-[#f5f5f5] text-sm">
                                                {[safeDecode(selectedLead.visitor?.city), safeDecode(selectedLead.visitor?.region), selectedLead.visitor?.country].filter(Boolean).join(', ') || '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center group">
                                            <span className="text-[#666] text-sm group-hover:text-[#888] transition-colors">IP</span>
                                            <span className="text-[#888] font-mono text-xs bg-[#111] px-2 py-1 rounded border border-[#2a2a2a]">
                                                {selectedLead.visitor?.ip_address || '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center group">
                                            <span className="text-[#666] text-sm group-hover:text-[#888] transition-colors">Data</span>
                                            <span className="text-[#f5f5f5] text-sm">
                                                {new Date(selectedLead.created_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Location Map */}
                                {(selectedLead.visitor?.city || selectedLead.visitor?.region) && (
                                    <div className="rounded-xl overflow-hidden border border-[#2a2a2a] h-40 relative group cursor-pointer"
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
                                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-all flex items-center justify-center pointer-events-none">
                                            <div className="bg-[#1a1a1a]/80 backdrop-blur px-3 py-1.5 rounded-full border border-[#2a2a2a] text-xs text-[#c9a96e] font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                                                Abrir no Google Maps
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action */}
                                <button
                                    className="w-full py-3.5 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 transform active:scale-[0.98] text-[#0a0a0a]"
                                    style={{
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
                            <div className="flex-1 bg-[#111] flex flex-col h-full relative">
                                {/* Chat Header */}
                                <div className="px-6 py-4 border-b border-[#2a2a2a] bg-[#111]/80 backdrop-blur sticky top-0 z-10 flex justify-between items-center">
                                    <h3 className="text-[#666] text-xs font-bold uppercase tracking-widest flex items-center gap-2 font-serif">
                                        Histórico da Conversa
                                    </h3>
                                    <span className="bg-[#1a1a1a] text-[#888] px-3 py-1 rounded-full text-xs font-mono border border-[#2a2a2a]">
                                        {selectedLead.conversation_log?.length || 0} mensagens
                                    </span>
                                </div>

                                {/* Chat Messages Area */}
                                <ChatViewer
                                    messages={selectedLead.conversation_log}
                                    leadName={selectedLead.name || 'Cliente'}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
