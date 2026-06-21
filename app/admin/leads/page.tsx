'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { Search, Download } from 'lucide-react'


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
    active_broker_id?: string | null
    active_broker_profile?: any | null
    active_broker_conversation?: any | null
    broker_conversation_log?: any[]
    broker_profiles?: any[]
    attendance_summary?: {
        ai_count: number
        human_count: number
        lead_count: number
        total_messages: number
        ai_brokers: { id: string | null; name: string; count: number; last_at: string | null }[]
        human_brokers: { id: string | null; name: string; count: number; last_at: string | null }[]
        last_actor: 'human' | 'ai' | 'lead' | 'unknown'
        last_at: string | null
        last_message_preview: string | null
    } | null
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

interface Broker {
    id: string
    name: string
    is_active?: boolean | null
}

const stageLabel: Record<string, string> = {
    'lead': 'Novo lead',
    'new': 'Novo lead',
    'engaged': 'Engajado',
    'qualifying': 'Em qualificação',
    'qualified': 'Qualificado',
    'contacted': 'Contatado',
    'scheduled': 'Agendado',
    'appointment': 'Agendado',
    'scheduled_visit': 'Visita agendada',
    'proposal': 'Proposta',
    'closed': 'Fechado',
    'closed_won': 'Fechado',
    'converted': 'Convertido',
    'lost': 'Perdido',
    'transferred': 'Transferido'
}

const stageBadge: Record<string, string> = {
    'lead': 'badge-success',
    'engaged': 'badge-gold',
    'qualifying': 'badge-info',
    'qualified': 'badge-warning',
    'contacted': 'badge-info',
    'scheduled': 'badge-warning',
    'proposal': 'badge-primary',
    'closed': 'badge-success',
    'lost': 'badge-error',
    'transferred': 'badge-primary'
}

const deviceLabelPt: Record<string, string> = {
    'mobile': 'Celular',
    'desktop': 'Computador',
    'tablet': 'Tablet',
    'bot': 'Robô',
    'unknown': 'Desconhecido',
}

const sourceLabelPt: Record<string, string> = {
    'direct': 'Acesso direto',
    'direct_access': 'Acesso direto',
    'whatsapp': 'WhatsApp',
    'whatsapp_web': 'WhatsApp Web',
    'site': 'Site',
    'website': 'Site',
    'push': 'Push',
    'google': 'Google',
    'google_ads': 'Google Ads',
    'meta': 'Meta',
    'meta_ads': 'Meta Ads',
    'facebook': 'Facebook',
    'facebook_ads': 'Facebook Ads',
    'instagram': 'Instagram',
    'instagram_ads': 'Instagram Ads',
    'instagram_direct': 'Direct do Instagram',
    'linkedin': 'LinkedIn',
    'organic': 'Orgânico',
    'organic_search': 'Busca orgânica',
    'referral': 'Indicação',
    'unknown': 'Desconhecido',
}

const browserLabelPt: Record<string, string> = {
    'chrome': 'Chrome',
    'safari': 'Safari',
    'firefox': 'Firefox',
    'edge': 'Edge',
    'opera': 'Opera',
    'unknown': 'Desconhecido',
}

const osLabelPt: Record<string, string> = {
    'windows': 'Windows',
    'macos': 'macOS',
    'mac_os': 'macOS',
    'android': 'Android',
    'ios': 'iOS',
    'linux': 'Linux',
    'unknown': 'Desconhecido',
}

const canonicalStage: Record<string, string> = {
    'new': 'lead',
    'lead': 'lead',
    'novo_lead': 'lead',
    'engaged': 'engaged',
    'qualifying': 'qualifying',
    'qualified': 'qualified',
    'contacted': 'contacted',
    'scheduled': 'scheduled',
    'appointment': 'scheduled',
    'scheduled_visit': 'scheduled',
    'proposal': 'proposal',
    'converted': 'closed',
    'closed': 'closed',
    'closed_won': 'closed',
    'lost': 'lost',
    'transferred': 'transferred',
}

const stageTabs = [
    ['lead', 'Novo lead'],
    ['engaged', 'Engajado'],
    ['qualified', 'Qualificado'],
    ['contacted', 'Contatado'],
    ['scheduled', 'Agendado'],
    ['proposal', 'Proposta'],
    ['closed', 'Fechado'],
    ['lost', 'Perdido'],
] as const

const activityLabelPt: Record<string, string> = {
    'page_view': 'Visitou página',
    'page_viewed': 'Visitou página',
    'property_viewed': 'Visualizou imóvel',
    'property_liked': 'Curtiu imóvel',
    'property_disliked': 'Não gostou do imóvel',
    'property_shared': 'Compartilhou imóvel',
    'property_map_opened': 'Abriu mapa do imóvel',
    'property_details_opened': 'Abriu detalhes do imóvel',
    'home_search_submitted': 'Pesquisou na página inicial',
    'home_map_search_submitted': 'Pesquisou pelo mapa',
    'home_map_filter_changed': 'Ajustou filtro do mapa',
    'home_map_quiz_next_clicked': 'Avançou no quiz de busca',
    'home_map_quiz_back_clicked': 'Voltou no quiz de busca',
    'home_map_search_cleared': 'Limpou a busca do mapa',
    'whatsapp_clicked': 'Clicou no WhatsApp',
    'share_clicked': 'Clicou em compartilhar',
    'push_prompt_shown': 'Pedido de push exibido',
    'push_subscribed': 'Aceitou notificações push',
    'push_denied': 'Recusou notificações push',
}

const purposeLabelPt: Record<string, string> = {
    'investimento': 'Investimento',
    'investment': 'Investimento',
    'invest': 'Investimento',
    'moradia': 'Moradia',
    'housing': 'Moradia',
    'home': 'Moradia',
    'residencial': 'Moradia',
    'commercial': 'Comercial',
    'comercial': 'Comercial',
    'partnership': 'Parceria',
    'parceria': 'Parceria',
}

const timeframeLabelPt: Record<string, string> = {
    'imediato': 'Agora',
    'agora': 'Agora',
    'now': 'Agora',
    'immediate': 'Agora',
    'this_month': 'Este mês',
    'este_mes': 'Este mês',
    '30_days': 'Até 30 dias',
    '60_days': 'Até 60 dias',
    '90_days': 'Até 90 dias',
    'future': 'Futuro',
    'futuro': 'Futuro',
}

const normalizeKey = (value?: string | null) => {
    return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

const fallbackLabel = (value?: string | null, empty = '—') => {
    const raw = String(value || '').trim()
    if (!raw) return empty
    return raw
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase())
}

const getCanonicalStage = (stage?: string | null) => {
    const key = normalizeKey(stage)
    return canonicalStage[key] || key
}

const formatStage = (stage?: string | null) => {
    const key = normalizeKey(stage)
    const canonical = getCanonicalStage(stage)
    return stageLabel[canonical] || stageLabel[key] || fallbackLabel(stage)
}

const formatStageBadge = (stage?: string | null) => {
    return stageBadge[getCanonicalStage(stage)] || 'badge-gold'
}

const formatSource = (source?: string | null) => {
    const key = normalizeKey(source)
    return sourceLabelPt[key] || fallbackLabel(source, 'Desconhecido')
}

const formatDevice = (device?: string | null) => {
    const key = normalizeKey(device)
    return deviceLabelPt[key] || fallbackLabel(device)
}

const formatBrowser = (browser?: string | null) => {
    const key = normalizeKey(browser)
    return browserLabelPt[key] || fallbackLabel(browser)
}

const formatOs = (os?: string | null) => {
    const key = normalizeKey(os)
    return osLabelPt[key] || fallbackLabel(os)
}

const formatActivityLabel = (label?: string | null) => {
    const key = normalizeKey(label)
    return activityLabelPt[key] || fallbackLabel(label, 'Atividade')
}

const formatPurpose = (purpose?: string | null) => {
    const key = normalizeKey(purpose)
    return purposeLabelPt[key] || fallbackLabel(purpose, 'Não informada')
}

const formatTimeframe = (timeframe?: string | null) => {
    const key = normalizeKey(timeframe)
    return timeframeLabelPt[key] || fallbackLabel(timeframe, 'Não informado')
}

const isInvestmentPurpose = (purpose?: string | null) => {
    const key = normalizeKey(purpose)
    return ['investimento', 'investment', 'invest'].includes(key)
}

const isHousingPurpose = (purpose?: string | null) => {
    const key = normalizeKey(purpose)
    return ['moradia', 'housing', 'home', 'residencial'].includes(key)
}

const isImmediateTimeframe = (timeframe?: string | null) => {
    const key = normalizeKey(timeframe)
    return ['imediato', 'agora', 'now', 'immediate'].includes(key)
}

function LeadAvatar({
    name,
    avatarUrl,
    size = 34,
}: {
    name?: string | null
    avatarUrl?: string | null
    size?: number
}) {
    const [imageFailed, setImageFailed] = useState(false)
    const initial = name?.trim()?.[0]?.toUpperCase() || '?'

    return (
        <div style={{ height: `${size}px`, width: `${size}px`, borderRadius: '50%', overflow: 'hidden', background: '#dfe5e7', color: '#111b21', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
            {avatarUrl && !imageFailed ? (
                <img
                    src={avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                <span style={{ fontSize: size >= 44 ? '22px' : '14px' }}>{initial}</span>
            )}
        </div>
    )
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [stageFilter, setStageFilter] = useState('')
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [counts, setCounts] = useState<Record<string, number>>({
        total: 0,
        lead: 0,
        engaged: 0,
        qualifying: 0,
        qualified: 0,
        contacted: 0,
        scheduled: 0,
        proposal: 0,
        closed: 0,
        lost: 0,
        transferred: 0,
        purpose_invest: 0,
        purpose_housing: 0,
        timeframe_now: 0,
        has_push: 0,
        partners: 0
    })

    const [activeTab, setActiveTab] = useState<'leads' | 'visitors'>('leads')
    const [visitors, setVisitors] = useState<Visitor[]>([])
    const [loadingVisitors, setLoadingVisitors] = useState(false)
    const [brokers, setBrokers] = useState<Broker[]>([])
    const [selectedBrokerId, setSelectedBrokerId] = useState('')

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

    const getPreciseLocation = (lead?: Lead | null) => {
        const location = lead?.metadata?.precise_location || lead?.metadata?.gps_location
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

    const formatGpsLocation = (lead?: Lead | null) => {
        const location = getPreciseLocation(lead)
        if (!location) return ''

        const accuracy = Number.isFinite(location.accuracy) && location.accuracy > 0
            ? ` +/- ${Math.round(location.accuracy)}m`
            : ''
        const capturedAt = location.capturedAt
            ? ` em ${new Date(location.capturedAt).toLocaleString('pt-BR')}`
            : ''

        return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${accuracy}${capturedAt}`
    }

    const formatGpsPermissionStatus = (lead?: Lead | null) => {
        const status = String(lead?.metadata?.gps_permission?.status || '').trim()
        if (!status) return ''

        const labels: Record<string, string> = {
            granted: 'autorizado',
            denied: 'recusado',
            prompt: 'pendente',
            unavailable: 'indisponivel',
            unsupported: 'sem suporte',
            error: 'erro',
        }

        return labels[status] || status
    }

    const getLeadMapQuery = (lead?: Lead | null) => {
        const precise = getPreciseLocation(lead)
        if (precise) return `${precise.latitude},${precise.longitude}`

        return [safeDecode(lead?.visitor?.city), safeDecode(lead?.visitor?.region), lead?.visitor?.country]
            .filter(Boolean)
            .join(', ')
    }

    const calculateCounts = (leadsData: Lead[]) => {
        const newCounts: Record<string, number> = {
            total: leadsData.length,
            lead: 0,
            engaged: 0,
            qualifying: 0,
            qualified: 0,
            contacted: 0,
            scheduled: 0,
            proposal: 0,
            closed: 0,
            lost: 0,
            transferred: 0,
            purpose_invest: 0,
            purpose_housing: 0,
            timeframe_now: 0,
            has_push: 0,
            partners: 0
        }

        leadsData.forEach(lead => {
            const stageKey = getCanonicalStage(lead.funnel_stage)
            if (Object.prototype.hasOwnProperty.call(newCounts, stageKey)) {
                newCounts[stageKey]++
            }
            if (isInvestmentPurpose(lead.lead_purpose)) newCounts.purpose_invest++
            if (isHousingPurpose(lead.lead_purpose)) newCounts.purpose_housing++
            if (isImmediateTimeframe(lead.lead_timeframe)) newCounts.timeframe_now++
            if (lead.push_subscribed_lead) newCounts.has_push++
            if (lead.is_partner) newCounts.partners++
        })

        return newCounts
    }

    const fetchBrokers = async () => {
        try {
            const res = await fetch('/api/admin/brokers')
            const data = await res.json()
            if (Array.isArray(data?.data)) setBrokers(data.data)
        } catch (error) {
            console.error('Error fetching brokers:', error)
        }
    }

    const fetchLeads = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (selectedBrokerId) params.set('broker_id', selectedBrokerId)
            const url = params.toString() ? `/api/admin/leads?${params}` : '/api/admin/leads'
            const res = await fetch(url)
            if (!res.ok) throw new Error('Failed to fetch')

            const leadsData: Lead[] = await res.json()
            setLeads(leadsData)
            setCounts(calculateCounts(leadsData))
        } catch (error) {
            console.error('Error fetching leads:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchVisitors = async () => {
        setLoadingVisitors(true)
        try {
            const params = new URLSearchParams()
            if (selectedBrokerId) params.set('broker_id', selectedBrokerId)
            const url = params.toString() ? `/api/admin/visitors?${params}` : '/api/admin/visitors'
            const res = await fetch(url)
            if (!res.ok) throw new Error('Failed to fetch visitors')
            const data: Visitor[] = await res.json()
            setVisitors(data)
        } catch (error) {
            console.error('Error fetching visitors:', error)
        } finally {
            setLoadingVisitors(false)
        }
    }

    useEffect(() => {
        fetchBrokers()
    }, [])

    useEffect(() => {
        setSelectedLead(null)
        setVisitors([])
        fetchLeads()
    }, [selectedBrokerId])

    useEffect(() => {
        if (activeTab === 'visitors') {
            fetchVisitors()
        }
    }, [activeTab, selectedBrokerId])

    const filteredLeads = leads.filter(lead => {
        if (stageFilter && getCanonicalStage(lead.funnel_stage) !== stageFilter) return false

        if (!search) return true
        const s = search.toLowerCase()
        return (
            lead.name?.toLowerCase().includes(s) ||
            lead.email?.toLowerCase().includes(s) ||
            lead.phone?.includes(s)
        )
    })

    const selectedBroker = brokers.find(broker => broker.id === selectedBrokerId)

    const getLeadBrokerProfiles = (lead: Lead) => {
        const rawProfiles = selectedBrokerId
            ? [lead.active_broker_profile].filter(Boolean)
            : Array.isArray(lead.broker_profiles) ? lead.broker_profiles : []
        const seen = new Set<string>()
        const profiles: any[] = []

        for (const profile of rawProfiles) {
            const key = profile?.broker_id || profile?.id
            if (!key || seen.has(key)) continue
            seen.add(key)
            profiles.push(profile)
        }

        if (selectedBrokerId && profiles.length === 0 && selectedBroker) {
            profiles.push({ broker_id: selectedBroker.id, broker_name: selectedBroker.name })
        }

        return profiles
    }

    const getBrokerProfileName = (profile: any) => {
        return profile?.broker_name
            || brokers.find(broker => broker.id === profile?.broker_id)?.name
            || 'Corretor IA'
    }

    const getLeadBrokerSummary = (lead: Lead) => {
        const names = getLeadBrokerProfiles(lead).map(getBrokerProfileName)
        if (names.length === 0) return ''
        if (names.length <= 2) return names.join(', ')
        return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
    }

    const renderLeadBrokerBadges = (lead: Lead) => {
        const profiles = getLeadBrokerProfiles(lead)
        if (profiles.length === 0) {
            return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>--</span>
        }

        const visibleProfiles = profiles.slice(0, 2)
        return (
            <div title={profiles.map(getBrokerProfileName).join(', ')} style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxWidth: 220 }}>
                {visibleProfiles.map((profile: any) => (
                    <span key={profile.broker_id || profile.id} style={{
                        background: '#f8f1df',
                        color: '#7b5a20',
                        border: '1px solid #e6cc91',
                        borderRadius: '999px',
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 800,
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                    }}>
                        {getBrokerProfileName(profile)}
                    </span>
                ))}
                {profiles.length > visibleProfiles.length && (
                    <span style={{
                        background: '#f2f2f2',
                        color: '#666',
                        border: '1px solid #ddd',
                        borderRadius: '999px',
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 800,
                        lineHeight: 1.2,
                    }}>
                        +{profiles.length - visibleProfiles.length}
                    </span>
                )}
            </div>
        )
    }

    const getLeadAttendanceSummary = (lead: Lead) => {
        const summary = lead.attendance_summary
        if (summary) return summary

        const messages = Array.isArray(lead.conversation_log) ? lead.conversation_log : []
        const humanMessages = messages.filter((message: any) => String(message?.source || '').toLowerCase() === 'human')
        const aiMessages = messages.filter((message: any) => {
            const source = String(message?.source || '').toLowerCase()
            const role = String(message?.role || '').toLowerCase()
            return ['agent', 'whatsapp_agent', 'ai', 'assistant'].includes(source) || (role === 'assistant' && source !== 'human' && source !== 'from_me_pending')
        })
        return {
            ai_count: aiMessages.length,
            human_count: humanMessages.length,
            lead_count: messages.filter((message: any) => String(message?.role || '').toLowerCase() === 'user').length,
            total_messages: messages.length,
            ai_brokers: getLeadBrokerProfiles(lead).map((profile: any) => ({
                id: profile?.broker_id || null,
                name: getBrokerProfileName(profile),
                count: 0,
                last_at: profile?.updated_at || null,
            })),
            human_brokers: [] as { id: string | null; name: string; count: number; last_at: string | null }[],
            last_actor: 'unknown' as const,
            last_at: null,
            last_message_preview: null,
        }
    }

    const getAttendanceLine = (lead: Lead) => {
        const summary = getLeadAttendanceSummary(lead)
        const parts = []
        if (summary.human_count > 0) parts.push('Humano')
        if (summary.ai_count > 0) parts.push('IA')
        return parts.length ? `Atendimento: ${parts.join(' + ')}` : ''
    }

    const renderLeadAttendanceBadges = (lead: Lead) => {
        const summary = getLeadAttendanceSummary(lead)
        const human = summary.human_brokers?.[0]
        const ai = summary.ai_brokers?.[0]
        const hasHuman = summary.human_count > 0
        const hasAi = summary.ai_count > 0

        if (!hasHuman && !hasAi) {
            return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>--</span>
        }

        const title = [
            hasHuman ? `Humano: ${summary.human_count} mensagem(ns)` : '',
            hasAi ? `IA: ${summary.ai_count} mensagem(ns)` : '',
            summary.last_message_preview ? `Ultima: ${summary.last_message_preview}` : '',
        ].filter(Boolean).join(' | ')

        const chipBase: CSSProperties = {
            borderRadius: '999px',
            padding: '3px 8px',
            fontSize: '10px',
            fontWeight: 900,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            maxWidth: '150px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        }

        return (
            <div title={title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px', maxWidth: 180 }}>
                {hasHuman && (
                    <span style={{
                        ...chipBase,
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                    }}>
                        Humano: {human?.name || 'Corretor'}
                    </span>
                )}
                {hasAi && (
                    <span style={{
                        ...chipBase,
                        background: '#f8f1df',
                        color: '#7b5a20',
                        border: '1px solid #e6cc91',
                    }}>
                        IA: {ai?.name || getLeadBrokerSummary(lead) || 'Corretor IA'}
                    </span>
                )}
                {summary.last_actor !== 'unknown' && (
                    <span style={{ color: '#777', fontSize: '10px', fontWeight: 700 }}>
                        Ultimo: {summary.last_actor === 'human' ? 'Humano' : summary.last_actor === 'ai' ? 'IA' : 'Lead'}
                    </span>
                )}
            </div>
        )
    }

    const exportCSV = () => {
        const headers = ['Nome', 'Email', 'Telefone', 'Estágio', 'VIP', 'Origem', 'Localização', 'GPS autorizado', 'Navegador', 'Dispositivo', 'IP', 'Data']
        const rows = filteredLeads.map(l => [
            l.name || '',
            l.email || '',
            l.phone || '',
            formatStage(l.funnel_stage),
            l.is_vip ? 'Sim' : 'Não',
            formatSource(l.visitor?.detected_source),
            [safeDecode(l.visitor?.city), safeDecode(l.visitor?.region), l.visitor?.country].filter(Boolean).join(', ') || '',
            formatGpsLocation(l),
            formatBrowser(l.visitor?.browser),
            formatDevice(l.visitor?.device_type),
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

    const getLeadSiteActivity = (lead?: Lead | null) => {
        const activity = lead?.metadata?.site_activity
        return Array.isArray(activity) ? activity.slice(-8).reverse() : []
    }

    const formatSiteActivity = (activity: any) => {
        const label = formatActivityLabel(activity?.label || activity?.event_type)
        const title = activity?.property_title ? `: ${activity.property_title}` : ''
        const detail = activity?.detail ? ` - ${activity.detail}` : ''
        return `${label}${title}${detail}`
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
        const source = String(msg?.source || '').toLowerCase()
        const role = String(msg?.role || '').toLowerCase()
        const isAssistant = role === 'assistant'
        const isLead = !isAssistant
        const isHuman = source === 'human'
        const isPendingFromMe = source === 'from_me_pending'
        const speakerLabel = isHuman
            ? 'Humano'
            : isPendingFromMe
                ? 'Pendente'
                : isAssistant
                    ? 'Corretor IA'
                    : 'Lead'
        const speakerColor = isHuman
            ? '#047857'
            : isPendingFromMe
                ? '#8a6d3b'
                : isAssistant
                    ? '#7b5a20'
                    : '#008069'
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
                    <div style={{
                        color: speakerColor,
                        fontSize: '10px',
                        fontWeight: 900,
                        letterSpacing: '0.02em',
                        marginBottom: text ? '4px' : 0,
                        textTransform: 'uppercase',
                    }}>
                        {speakerLabel}
                    </div>
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

    const getDisplayedConversation = (lead?: Lead | null) => {
        if (!lead) return []
        const brokerMessages = Array.isArray(lead.broker_conversation_log)
            ? lead.broker_conversation_log
            : Array.isArray(lead.active_broker_conversation?.messages)
                ? lead.active_broker_conversation.messages
                : []

        if (selectedBrokerId) return brokerMessages
        return Array.isArray(lead.conversation_log) ? lead.conversation_log : []
    }

    const selectedLeadConversation = getDisplayedConversation(selectedLead)
    const selectedLeadConversationLabel = selectedBroker
        ? `Conversa com ${selectedBroker.name}`
        : 'Historico geral'

    // ... (keep existing state/handlers)

    return (
        <div>
            <div className="leads-page-header" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                <div className="leads-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Gerenciamento de Leads</h1>
                        <p style={{ color: '#888', fontSize: '14px', marginTop: '4px', margin: 0 }}>
                            {selectedBroker ? `Acompanhe contatos atendidos por ${selectedBroker.name}.` : 'Acompanhe e gerencie todos os seus contatos.'}
                        </p>
                    </div>
                    <div className="leads-search-actions" style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '680px', flexWrap: 'wrap' }}>
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
                        <select
                            className="form-input"
                            value={selectedBrokerId}
                            onChange={e => setSelectedBrokerId(e.target.value)}
                            style={{ width: '220px', cursor: 'pointer' }}
                        >
                            <option value="">Todos os corretores</option>
                            {brokers.map(broker => (
                                <option key={broker.id} value={broker.id}>{broker.name}</option>
                            ))}
                        </select>
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
                        {stageTabs.map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setStageFilter(key)}
                                style={{
                                    padding: '10px 20px', borderRadius: '12px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', transition: 'all 0.3s', cursor: 'pointer', border: 'none',
                                    ...(stageFilter === key ? { backgroundColor: '#c9a96e', color: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transform: 'scale(1.02)' } : { backgroundColor: 'transparent', color: '#999' })
                                }}
                            >
                                {label} <span style={{ marginLeft: '4px', opacity: stageFilter === key ? 0.4 : 0.3 }}>({counts[key] || 0})</span>
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
                                <th>Atendimento</th>
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
                                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        Carregando...
                                    </td>
                                </tr>
                            ) : filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        Nenhum lead encontrado
                                    </td>
                                </tr>
                            ) : (
                                filteredLeads.map(lead => (
                                    <tr key={lead.id}>
                                        <td style={{ fontWeight: 500 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <LeadAvatar name={lead.name} avatarUrl={lead.avatar_url} />
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
                                                {getAttendanceLine(lead) && (
                                                    <div style={{ fontSize: '10px', color: '#9b7a3b', marginTop: '4px', fontWeight: 700 }}>
                                                        {getAttendanceLine(lead)}
                                                    </div>
                                                )}
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
                                                            <span className={`badge ${isInvestmentPurpose(lead.lead_purpose) ? 'badge-primary' : 'badge-gold'}`} style={{ fontSize: '9px', width: 'fit-content' }}>
                                                                {formatPurpose(lead.lead_purpose).toUpperCase()}
                                                            </span>
                                                        )}
                                                        {lead.lead_timeframe && isImmediateTimeframe(lead.lead_timeframe) && (
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
                                            {renderLeadAttendanceBadges(lead)}
                                        </td>
                                        <td>
                                            <span className={`badge ${formatStageBadge(lead.funnel_stage)}`}>
                                                {formatStage(lead.funnel_stage)}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.85rem' }}>
                                            <div style={{ fontWeight: 500 }}>{formatSource(lead.visitor?.detected_source)}</div>
                                            {getPreciseLocation(lead) ? (
                                                <button
                                                    type="button"
                                                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getLeadMapQuery(lead))}`, '_blank')}
                                                    style={{ marginTop: '4px', color: '#008069', fontSize: '0.72rem', fontWeight: 700, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                                                    title={formatGpsLocation(lead)}
                                                >
                                                    GPS autorizado
                                                </button>
                                            ) : formatGpsPermissionStatus(lead) ? (
                                                <div style={{ marginTop: '4px', color: '#8a6d3b', fontSize: '0.72rem', fontWeight: 700 }}>
                                                    GPS: {formatGpsPermissionStatus(lead)}
                                                </div>
                                            ) : null}
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                📍 {[safeDecode(lead.visitor?.city), lead.visitor?.country].filter(Boolean).join(', ')}
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '0.85rem' }}>
                                            {formatBrowser(lead.visitor?.browser)} / {formatDevice(lead.visitor?.device_type)}
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
                                                <span className="badge badge-success">Lead ({formatStage(visitor.funnel_stage)})</span>
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
                                            <div style={{ fontWeight: 500 }}>{formatSource(visitor.detected_source)}</div>
                                            {(visitor.city || visitor.region || visitor.country) && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    📍 {[safeDecode(visitor.city), safeDecode(visitor.region), visitor.country].filter(Boolean).join(', ')}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ fontSize: '0.85rem' }}>
                                            {formatBrowser(visitor.browser)} <br />
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>{formatOs(visitor.os)} • {formatDevice(visitor.device_type)}</span>
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
                                <LeadAvatar name={selectedLead.name} avatarUrl={selectedLead.avatar_url} size={48} />
                                <div>
                                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111b21', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                        {selectedLead.name || 'Lead Anônimo'}
                                        <span
                                            style={{
                                                fontSize: '10px', padding: '4px 12px', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', border: '1px solid',
                                                backgroundColor: getCanonicalStage(selectedLead.funnel_stage) === 'lead' ? '#d9fdd3' : '#fff7d6',
                                                color: getCanonicalStage(selectedLead.funnel_stage) === 'lead' ? '#008069' : '#9a6b00',
                                                borderColor: getCanonicalStage(selectedLead.funnel_stage) === 'lead' ? '#a8e6bd' : '#f0d27a'
                                            }}
                                        >
                                            {formatStage(selectedLead.funnel_stage)}
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
                                                {formatPurpose(selectedLead.lead_purpose)}
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
                                                {formatTimeframe(selectedLead.lead_timeframe)}
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
                                                {formatSource(selectedLead.visitor?.detected_source)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>Dispositivo</span>
                                            <span style={{ color: '#111b21', fontSize: '12px' }}>
                                                {formatDevice(selectedLead.visitor?.device_type)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>Sistema / Nav.</span>
                                            <span style={{ color: '#111b21', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }} title={`${formatOs(selectedLead.visitor?.os)} / ${formatBrowser(selectedLead.visitor?.browser)}`}>
                                                {formatOs(selectedLead.visitor?.os)} / {formatBrowser(selectedLead.visitor?.browser)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>Localização aprox.</span>
                                            <span style={{ color: '#111b21', fontSize: '12px', textAlign: 'right' }}>
                                                {[safeDecode(selectedLead.visitor?.city), safeDecode(selectedLead.visitor?.region), selectedLead.visitor?.country].filter(Boolean).join(', ') || '—'}
                                            </span>
                                        </div>
                                        {getPreciseLocation(selectedLead) && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                                <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>GPS autorizado</span>
                                                <button
                                                    type="button"
                                                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getLeadMapQuery(selectedLead))}`, '_blank')}
                                                    style={{ color: '#008069', fontSize: '11px', fontWeight: 700, textAlign: 'right', lineHeight: 1.25, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', maxWidth: '190px' }}
                                                    title="Abrir localizacao exata no Google Maps"
                                                >
                                                    {formatGpsLocation(selectedLead)}
                                                </button>
                                            </div>
                                        )}
                                        {!getPreciseLocation(selectedLead) && formatGpsPermissionStatus(selectedLead) && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: '#667781', fontSize: '12px', transition: 'color 0.2s' }}>GPS</span>
                                                <span style={{ color: '#8a6d3b', fontSize: '12px', fontWeight: 700 }}>
                                                    {formatGpsPermissionStatus(selectedLead)}
                                                </span>
                                            </div>
                                        )}
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

                                {getLeadSiteActivity(selectedLead).length > 0 && (
                                    <div>
                                        <h3 style={{ color: '#8a6d3b', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(201,169,110,0.28)' }}>
                                            Atividade no site
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', background: '#fffaf0', border: '1px solid rgba(201,169,110,0.22)', borderRadius: '8px', padding: '10px' }}>
                                            {getLeadSiteActivity(selectedLead).map((activity: any, index: number) => (
                                                <div key={`${activity?.id || activity?.occurred_at || index}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                                                    <span style={{ color: '#111b21', fontSize: '11px', fontWeight: 700, lineHeight: 1.3 }}>{formatSiteActivity(activity)}</span>
                                                    <span style={{ color: '#667781', fontSize: '10px', whiteSpace: 'nowrap' }}>
                                                        {activity?.occurred_at ? new Date(activity.occurred_at).toLocaleDateString('pt-BR') : 'agora'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Location Map */}
                                {getLeadMapQuery(selectedLead) && (
                                    <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #d1d7db', height: '96px', position: 'relative', cursor: 'pointer' }}
                                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getLeadMapQuery(selectedLead))}`, '_blank')}
                                    >
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            title="Mapa de Localização do Lead"
                                            style={{ border: 0, filter: 'grayscale(100%) invert(90%) contrast(85%)' }}
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                            src={`https://maps.google.com/maps?q=${encodeURIComponent(getLeadMapQuery(selectedLead))}&t=&z=${getPreciseLocation(selectedLead) ? '16' : '13'}&ie=UTF8&iwloc=&output=embed`}
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
                                        <LeadAvatar name={selectedLead.name} avatarUrl={selectedLead.avatar_url} size={40} />
                                        <div>
                                            <h3 style={{ color: '#111b21', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                                                {selectedLead.name || 'Lead Anônimo'}
                                            </h3>
                                            <span style={{ color: '#667781', fontSize: '12px' }}>
                                                {selectedLead.phone || 'sem telefone'}
                                            </span>
                                        </div>
                                    </div>
                                    <span style={{ backgroundColor: '#fff', color: '#667781', padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', border: '1px solid #d1d7db' }}>
                                        {selectedLeadConversation.length} mensagens
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
                                    {selectedLeadConversation.length > 0 ? (
                                        selectedLeadConversation.map((msg: any, idx: number) => renderChatMessage(msg, idx))
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#667781', gap: '8px' }}>
                                            <span style={{ fontSize: '2rem' }}>💬</span>
                                            <span style={{ fontSize: '0.85rem' }}>Nenhuma conversa registrada</span>
                                        </div>
                                    )}
                                </div>
                                <div style={{ background: '#f0f2f5', borderTop: '1px solid #d1d7db', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ height: '40px', borderRadius: '999px', background: '#fff', color: '#667781', flex: 1, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: '14px' }}>
                                        {selectedLeadConversationLabel}
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
