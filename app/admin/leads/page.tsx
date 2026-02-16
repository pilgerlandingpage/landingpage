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

    const openLeadDetails = (lead: Lead) => setSelectedLead(lead)
    const closeLeadDetails = () => setSelectedLead(null)

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
            [l.visitor?.city, l.visitor?.region, l.visitor?.country].filter(Boolean).join(', ') || '',
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

            {/* Filters */}
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

            {/* Table */}
            <div className="chart-card" style={{ padding: 0, overflow: 'auto' }}>
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
                                                📍 {[lead.visitor?.city, lead.visitor?.region, lead.visitor?.country].filter(Boolean).join(', ')}
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
                            <div className="w-full md:w-[320px] border-r border-[#2a2a2a] bg-[#1a1a1a] p-6 space-y-8 overflow-y-auto">

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
                                                {selectedLead.visitor?.detected_source || 'Desconhecido'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center group">
                                            <span className="text-[#666] text-sm group-hover:text-[#888] transition-colors">Dispositivo</span>
                                            <span className="text-[#f5f5f5] text-sm">
                                                {selectedLead.visitor?.device_type === 'mobile' ? '📱 Mobile' :
                                                    selectedLead.visitor?.device_type === 'desktop' ? '💻 Desktop' :
                                                        selectedLead.visitor?.device_type || '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center group">
                                            <span className="text-[#666] text-sm group-hover:text-[#888] transition-colors">Localização</span>
                                            <span className="text-[#f5f5f5] text-sm">
                                                {[selectedLead.visitor?.city, selectedLead.visitor?.region, selectedLead.visitor?.country].filter(Boolean).join(', ') || '—'}
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
