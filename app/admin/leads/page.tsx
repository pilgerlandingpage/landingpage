'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Download, Filter } from 'lucide-react'

interface Lead {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    funnel_stage: string
    is_vip: boolean
    whatsapp_sent: boolean
    ai_summary: string | null
    created_at: string
    visitor?: {
        detected_source: string
        browser: string
        device_type: string
        ip_address: string
        os: string
    }
}

const stageBadge: Record<string, string> = {
    visitor: 'badge-warning',
    engaged: 'badge-gold',
    lead: 'badge-success',
    qualified: 'badge-gold',
    converted: 'badge-success',
}

const stageLabel: Record<string, string> = {
    visitor: 'Visitante',
    engaged: 'Engajado',
    lead: 'Lead',
    qualified: 'Qualificado',
    converted: 'Convertido',
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [stageFilter, setStageFilter] = useState('')

    useEffect(() => {
        const fetch = async () => {
            const supabase = createClient()
            let query = supabase
                .from('leads')
                .select('*, visitor:visitors(detected_source, browser, device_type, ip_address, os)')
                .order('created_at', { ascending: false })

            if (stageFilter) {
                query = query.eq('funnel_stage', stageFilter)
            }

            const { data } = await query
            setLeads((data as Lead[]) || [])
            setLoading(false)
        }
        fetch()
    }, [stageFilter])

    const filteredLeads = leads.filter(lead => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
            lead.name?.toLowerCase().includes(s) ||
            lead.email?.toLowerCase().includes(s) ||
            lead.phone?.includes(s)
        )
    })

    const exportCSV = () => {
        const headers = ['Nome', 'Email', 'Telefone', 'Estágio', 'VIP', 'Origem', 'Navegador', 'Dispositivo', 'IP', 'Data']
        const rows = filteredLeads.map(l => [
            l.name || '',
            l.email || '',
            l.phone || '',
            stageLabel[l.funnel_stage] || l.funnel_stage,
            l.is_vip ? 'Sim' : 'Não',
            l.visitor?.detected_source || '',
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

    return (
        <div>
            <div className="admin-header">
                <h1>Leads</h1>
                <div className="admin-header-actions">
                    <button className="btn btn-outline btn-sm" onClick={exportCSV}>
                        <Download size={16} /> Exportar CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        className="form-input"
                        style={{ paddingLeft: '36px' }}
                        placeholder="Buscar por nome, email ou telefone..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="form-select"
                    style={{ width: '200px' }}
                    value={stageFilter}
                    onChange={e => setStageFilter(e.target.value)}
                >
                    <option value="">Todos os Estágios</option>
                    <option value="visitor">Visitante</option>
                    <option value="engaged">Engajado</option>
                    <option value="lead">Lead</option>
                    <option value="qualified">Qualificado</option>
                    <option value="converted">Convertido</option>
                </select>
            </div>

            {/* Table */}
            <div className="chart-card" style={{ padding: 0, overflow: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Contato</th>
                            <th>Estágio</th>
                            <th>Origem</th>
                            <th>Dispositivo</th>
                            <th>IP</th>
                            <th>VIP</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    Carregando...
                                </td>
                            </tr>
                        ) : filteredLeads.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    Nenhum lead encontrado
                                </td>
                            </tr>
                        ) : (
                            filteredLeads.map(lead => (
                                <tr key={lead.id}>
                                    <td style={{ fontWeight: 500 }}>
                                        {lead.name || <span style={{ color: 'var(--text-muted)' }}>Anônimo</span>}
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
                                    <td style={{ fontSize: '0.85rem' }}>{lead.visitor?.detected_source || '—'}</td>
                                    <td style={{ fontSize: '0.85rem' }}>
                                        {lead.visitor?.browser || '—'} / {lead.visitor?.device_type || '—'}
                                    </td>
                                    <td style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{lead.visitor?.ip_address || '—'}</td>
                                    <td>{lead.is_vip ? <span className="badge badge-gold">⭐ VIP</span> : '—'}</td>
                                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                        {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
