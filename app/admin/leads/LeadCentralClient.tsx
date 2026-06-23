'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Search, Phone, Mail, MapPin, DollarSign, Home, Clock, User, Filter, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Star, MessageSquare, FileText, Copy, Send, ExternalLink, CircleDashed, CheckCircle2, Reply, Trophy, XCircle, BarChart3, TrendingUp, Target, AlertTriangle, Zap, ArrowRightLeft, BellRing } from 'lucide-react'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import {
    LEAD_PIPELINE_STAGES,
    getLeadPipelineStage,
    getLeadPipelineStageConfig,
    type LeadPipelineStageKey,
} from '@/lib/leads/pipeline'

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
    lead_purpose?: string | null
    lead_budget?: string | null
    lead_timeframe?: string | null
    push_subscribed_lead?: boolean | null
    is_partner?: boolean | null
    visitor_ip_address?: string | null
    visitor_referrer?: string | null
    visitor_last_visit_at?: string | null
    lead_classification?: string | null
    lead_score?: number | null
    pipeline_stage?: string | null
    pipeline_reason?: string | null
    broker_name?: string | null
    broker_is_active?: boolean | null
    broker_photo_url?: string | null
    crm_source?: string | null
    conversation_status?: string | null
    conversation_updated_at?: string | null
    conversation_summary?: string | null
    conversation_messages?: any[]
    last_whatsapp_click?: any | null
    whatsapp_clicks?: any[]
    site_activity?: any[]
    behavior_summary?: any | null
    crm_action_recommendations?: any | null
    crm_action_recommendation_actions?: any | null
    crm_executive_brief?: any | null
    crm_executive_brief_history?: any[] | null
    precise_location?: any | null
    gps_permission?: any | null
    created_at: string
    updated_at: string
}

interface Broker {
    id: string
    name: string
    creci?: string | null
    assignment_type?: string | null
    whatsapp_instance_id?: string | null
    whatsapp_instance_type?: string | null
    whatsapp_instance_name?: string | null
    whatsapp_instance_status?: string | null
    is_global_whatsapp_agent?: boolean | null
    photo_url?: string | null
    whatsapp_profile_photo_url?: string | null
    broker_avatar_url?: string | null
    is_active?: boolean | null
}

type DossierBlockTone = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'whatsapp'

function DossierBlock({
    title,
    subtitle,
    count,
    tone = 'default',
    defaultOpen = false,
    children,
}: {
    title: string
    subtitle?: string
    count?: string
    tone?: DossierBlockTone
    defaultOpen?: boolean
    children: ReactNode
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    const toneStyles: Record<DossierBlockTone, { border: string; headerBg: string; bodyBg: string; accent: string; chipBg: string; rail: string; shadow: string }> = {
        default: {
            border: '#ead6a6',
            headerBg: 'linear-gradient(135deg, #fff8e7 0%, #ffffff 76%)',
            bodyBg: '#fffdf7',
            accent: '#8a5a12',
            chipBg: '#fff3c4',
            rail: '#d4a72c',
            shadow: '0 12px 26px rgba(138,90,18,0.08)',
        },
        blue: {
            border: '#bfdbfe',
            headerBg: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 78%)',
            bodyBg: '#f8fbff',
            accent: '#1d4ed8',
            chipBg: '#dbeafe',
            rail: '#3b82f6',
            shadow: '0 12px 26px rgba(29,78,216,0.08)',
        },
        green: {
            border: 'rgba(4,120,87,0.24)',
            headerBg: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 78%)',
            bodyBg: '#f6fffb',
            accent: '#047857',
            chipBg: '#d1fae5',
            rail: '#10b981',
            shadow: '0 12px 26px rgba(4,120,87,0.08)',
        },
        amber: {
            border: 'rgba(180,83,9,0.26)',
            headerBg: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 78%)',
            bodyBg: '#fffaf0',
            accent: '#b45309',
            chipBg: '#fed7aa',
            rail: '#f97316',
            shadow: '0 12px 26px rgba(180,83,9,0.08)',
        },
        red: {
            border: 'rgba(185,28,28,0.22)',
            headerBg: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 78%)',
            bodyBg: '#fff8f8',
            accent: '#b91c1c',
            chipBg: '#fee2e2',
            rail: '#ef4444',
            shadow: '0 12px 26px rgba(185,28,28,0.08)',
        },
        whatsapp: {
            border: '#b7d8cb',
            headerBg: 'linear-gradient(135deg, #e7f7ef 0%, #f8fffb 72%)',
            bodyBg: '#f0f7f4',
            accent: '#008069',
            chipBg: '#ffffff',
            rail: '#00a884',
            shadow: '0 12px 26px rgba(0,128,105,0.1)',
        },
    }
    const activeTone = toneStyles[tone]

    return (
        <details
            open={isOpen}
            onToggle={event => setIsOpen(event.currentTarget.open)}
            style={{
                marginTop: 12,
                border: `1px solid ${activeTone.border}`,
                borderRadius: 12,
                background: activeTone.bodyBg,
                overflow: 'hidden',
                boxShadow: activeTone.shadow,
            }}
        >
            <summary
                style={{
                    cursor: 'pointer',
                    padding: '12px 15px 12px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    color: '#0f172a',
                    userSelect: 'none',
                    listStyle: 'none',
                    background: activeTone.headerBg,
                    borderLeft: `5px solid ${activeTone.rail}`,
                }}
            >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 950, color: activeTone.accent, letterSpacing: 0 }}>
                        {title}
                    </span>
                    {subtitle && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {subtitle}
                        </span>
                    )}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                    {count && (
                        <span style={{ padding: '4px 9px', borderRadius: 999, background: activeTone.chipBg, border: `1px solid ${activeTone.border}`, color: activeTone.accent, fontSize: '0.62rem', fontWeight: 950, whiteSpace: 'nowrap', boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset' }}>
                            {count}
                        </span>
                    )}
                    <ChevronDown size={15} color={activeTone.accent} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }} />
                </span>
            </summary>
            <div style={{ padding: 12, borderTop: `1px solid ${activeTone.border}`, background: activeTone.bodyBg }}>
                {children}
            </div>
        </details>
    )
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    new: { label: 'Novo', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    qualifying: { label: 'Qualificando', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    qualified: { label: 'Qualificado', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    transferred: { label: 'Transferido', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    converted: { label: 'Convertido', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
    lost: { label: 'Perdido', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
}

const FOLLOWUP_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pendente', color: '#b45309', bg: '#fffbeb' },
    sent: { label: 'Enviada', color: '#047857', bg: '#ecfdf5' },
    responded: { label: 'Respondida', color: '#2563eb', bg: '#eff6ff' },
    converted: { label: 'Convertida', color: '#7c3aed', bg: '#f5f3ff' },
    dismissed: { label: 'Descartada', color: '#64748b', bg: '#f8fafc' },
}

const FOLLOWUP_STATUS_OPTIONS = [
    { value: 'pending', icon: CircleDashed },
    { value: 'sent', icon: CheckCircle2 },
    { value: 'responded', icon: Reply },
    { value: 'converted', icon: Trophy },
]

const PENDING_FOLLOWUP_SLA_HOURS = 24
const SENT_FOLLOWUP_SLA_HOURS = 48
const TIMELINE_CATEGORY_ORDER = ['IA', 'Alerta', 'Follow-up', 'WhatsApp', 'Conversa', 'Site', 'Lead']

type CommercialTimelineEvent = {
    key: string
    category: string
    title: string
    detail: string
    actor: string
    occurredAt: string
    icon: any
    color: string
    bg: string
    propertyUrl?: string
    whatsappUrl?: string
    followup?: any
    followupStatus?: string
    source?: string
}

type LeadExecutiveBrief = {
    level: 'high' | 'medium' | 'low'
    title: string
    summary: string
    risk: string
    nextAction: string
    facts: Array<{ label: string; value: string; color: string }>
}

type LeadExecutiveBriefHistoryItem = LeadExecutiveBrief & {
    generatedAt: string
    source: string
    actorLabel: string
    isAiNarrative: boolean
}

type ExecutiveBriefRunResult = {
    processedLeads: number
    updatedLeads: number
    highRisk: number
    mediumRisk: number
    lowRisk: number
    aiNarrativesRequested: number
    aiNarrativesGenerated: number
    aiNarrativeSkippedReason: string
    source: string
    generatedAt: string
    errors: string[]
}

type ExecutiveBriefStatus = {
    lastStartedAt: string
    lastRunAt: string
    lastError: string
    lastErrorAt: string
    lastResult: ExecutiveBriefRunResult | null
    cronLastCheckedAt: string
    cronLastRunAt: string
    cronLastReason: string
    cronLastError: string
    cronLastErrorAt: string
    cronLastResult: ExecutiveBriefRunResult | null
}

type PropertySearchAlertsRunResult = {
    processedProperties: number
    alertsChecked: number
    matchesCreated: number
    notificationsSent: number
    notificationsFailed: number
    propertyErrors: number
    source: string
    processedAt: string
    updatedSince: string
    limit: number
    force: boolean
}

type PropertySearchAlertsStatus = {
    lastStartedAt: string
    lastRunAt: string
    lastError: string
    lastErrorAt: string
    lastResult: PropertySearchAlertsRunResult | null
    cronLastCheckedAt: string
    cronLastRunAt: string
    cronLastReason: string
    cronLastError: string
    cronLastErrorAt: string
    cronLastResult: PropertySearchAlertsRunResult | null
}

type CrmActionRecommendationsRunResult = {
    processedLeads: number
    leadsWithFollowups: number
    updatedLeads: number
    totalRecommendations: number
    generatedAt: string
    errors: string[]
    summary: Record<string, number>
    strongestBroker: {
        id?: string | null
        name?: string | null
        response_rate?: number | null
        conversion_rate?: number | null
    } | null
}

type CrmActionRecommendationsStatus = {
    lastStartedAt: string
    lastRunAt: string
    lastError: string
    lastErrorAt: string
    lastResult: CrmActionRecommendationsRunResult | null
    cronLastCheckedAt: string
    cronLastRunAt: string
    cronLastReason: string
    cronLastError: string
    cronLastErrorAt: string
    cronLastResult: CrmActionRecommendationsRunResult | null
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
            fontSize: size <= 20 ? '0.55rem' : size <= 30 ? '0.72rem' : '0.95rem',
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

export default function LeadCentralClient() {
    const [leads, setLeads] = useState<LeadData[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [expandedLead, setExpandedLead] = useState<string | null>(null)
    const [editingNotes, setEditingNotes] = useState<string | null>(null)
    const [notesText, setNotesText] = useState('')
    const pipelineScrollerRef = useRef<HTMLDivElement | null>(null)
    const pipelineDragRef = useRef({ active: false, dragged: false, startX: 0, scrollLeft: 0 })
    const [isPipelineDragging, setIsPipelineDragging] = useState(false)
    const [brokers, setBrokers] = useState<Broker[]>([])
    const [selectedBrokerId, setSelectedBrokerId] = useState('')
    const [copiedFollowUpKey, setCopiedFollowUpKey] = useState<string | null>(null)
    const [copiedExecutiveQueueKey, setCopiedExecutiveQueueKey] = useState<string | null>(null)
    const [selectedExecutiveAgendaKey, setSelectedExecutiveAgendaKey] = useState<string | null>(null)
    const [completedExecutiveAgendaKeys, setCompletedExecutiveAgendaKeys] = useState<string[]>([])
    const [updatingFollowUpKey, setUpdatingFollowUpKey] = useState<string | null>(null)
    const [processingActions, setProcessingActions] = useState(false)
    const [processingExecutiveBriefs, setProcessingExecutiveBriefs] = useState(false)
    const [processingSearchAlerts, setProcessingSearchAlerts] = useState(false)
    const [applyingRecommendationKey, setApplyingRecommendationKey] = useState<string | null>(null)
    const [savingExecutiveBriefKey, setSavingExecutiveBriefKey] = useState<string | null>(null)
    const [executiveBriefStatus, setExecutiveBriefStatus] = useState<ExecutiveBriefStatus | null>(null)
    const [propertySearchAlertsStatus, setPropertySearchAlertsStatus] = useState<PropertySearchAlertsStatus | null>(null)
    const [crmActionRecommendationsStatus, setCrmActionRecommendationsStatus] = useState<CrmActionRecommendationsStatus | null>(null)
    const [loadingExecutiveBriefStatus, setLoadingExecutiveBriefStatus] = useState(false)
    const [auditBrokerFilter, setAuditBrokerFilter] = useState('all')
    const [auditTypeFilter, setAuditTypeFilter] = useState('all')
    const [auditPeriodFilter, setAuditPeriodFilter] = useState('all')
    const [timelineCategoryFilter, setTimelineCategoryFilter] = useState('all')

    useEffect(() => {
        loadLeads()
    }, [statusFilter, selectedBrokerId])

    useEffect(() => {
        loadBrokers()
        loadExecutiveBriefStatus()
    }, [])

    useEffect(() => {
        if (!expandedLead) return

        const previousOverflow = document.body.style.overflow
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setExpandedLead(null)
        }

        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [expandedLead])

    async function loadBrokers() {
        try {
            const res = await fetch('/api/admin/brokers')
            const data = await res.json()
            if (Array.isArray(data?.data)) setBrokers(data.data)
        } catch (err) {
            console.error('Erro ao carregar corretores:', err)
        }
    }

    async function loadLeads() {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (statusFilter !== 'all') params.set('status', statusFilter)
            if (search) params.set('search', search)
            if (selectedBrokerId) params.set('broker_id', selectedBrokerId)
            const res = await fetch(`/api/admin/leads/crm?${params}`)
            const data = await res.json()
            if (data.success) setLeads(data.leads)
        } catch (err) {
            console.error('Erro ao carregar leads:', err)
        } finally {
            setLoading(false)
        }
    }

    async function loadExecutiveBriefStatus() {
        setLoadingExecutiveBriefStatus(true)
        try {
            const res = await fetch('/api/admin/configs', { cache: 'no-store' })
            const data = await res.json()
            if (!data.success) throw new Error(data.message || 'Erro ao carregar status dos resumos')
            const configs = data.configs || {}
            setExecutiveBriefStatus({
                lastStartedAt: String(configs.lead_executive_briefs_last_started_at || ''),
                lastRunAt: String(configs.lead_executive_briefs_last_run_at || ''),
                lastError: String(configs.lead_executive_briefs_last_error || ''),
                lastErrorAt: String(configs.lead_executive_briefs_last_error_at || ''),
                lastResult: parseExecutiveBriefRunResult(configs.lead_executive_briefs_last_result),
                cronLastCheckedAt: String(configs.lead_executive_briefs_cron_last_checked_at || ''),
                cronLastRunAt: String(configs.lead_executive_briefs_cron_last_run_at || ''),
                cronLastReason: String(configs.lead_executive_briefs_cron_last_reason || ''),
                cronLastError: String(configs.lead_executive_briefs_cron_last_error || ''),
                cronLastErrorAt: String(configs.lead_executive_briefs_cron_last_error_at || ''),
                cronLastResult: parseExecutiveBriefRunResult(configs.lead_executive_briefs_cron_last_result),
            })
            setPropertySearchAlertsStatus({
                lastStartedAt: String(configs.property_search_alerts_last_started_at || ''),
                lastRunAt: String(configs.property_search_alerts_last_run_at || ''),
                lastError: String(configs.property_search_alerts_last_error || ''),
                lastErrorAt: String(configs.property_search_alerts_last_error_at || ''),
                lastResult: parsePropertySearchAlertsRunResult(configs.property_search_alerts_last_result),
                cronLastCheckedAt: String(configs.property_search_alerts_cron_last_checked_at || ''),
                cronLastRunAt: String(configs.property_search_alerts_cron_last_run_at || ''),
                cronLastReason: String(configs.property_search_alerts_cron_last_reason || ''),
                cronLastError: String(configs.property_search_alerts_cron_last_error || ''),
                cronLastErrorAt: String(configs.property_search_alerts_cron_last_error_at || ''),
                cronLastResult: parsePropertySearchAlertsRunResult(configs.property_search_alerts_cron_last_result),
            })
            setCrmActionRecommendationsStatus({
                lastStartedAt: String(configs.crm_action_recommendations_last_started_at || ''),
                lastRunAt: String(configs.crm_action_recommendations_last_run_at || ''),
                lastError: String(configs.crm_action_recommendations_last_error || ''),
                lastErrorAt: String(configs.crm_action_recommendations_last_error_at || ''),
                lastResult: parseCrmActionRecommendationsRunResult(configs.crm_action_recommendations_last_result),
                cronLastCheckedAt: String(configs.crm_action_recommendations_cron_last_checked_at || ''),
                cronLastRunAt: String(configs.crm_action_recommendations_cron_last_run_at || ''),
                cronLastReason: String(configs.crm_action_recommendations_cron_last_reason || ''),
                cronLastError: String(configs.crm_action_recommendations_cron_last_error || ''),
                cronLastErrorAt: String(configs.crm_action_recommendations_cron_last_error_at || ''),
                cronLastResult: parseCrmActionRecommendationsRunResult(configs.crm_action_recommendations_cron_last_result),
            })
        } catch (err) {
            console.error('Erro ao carregar status dos resumos executivos:', err)
        } finally {
            setLoadingExecutiveBriefStatus(false)
        }
    }

    async function processActionRecommendations() {
        setProcessingActions(true)
        try {
            const res = await fetch('/api/admin/leads/crm/actions/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: 500, source: 'crm_manual' }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Erro ao sincronizar fila IA')
            await loadLeads()
        } catch (err) {
            console.error('Erro ao sincronizar fila IA:', err)
        } finally {
            setProcessingActions(false)
        }
    }

    async function processExecutiveBriefs() {
        setProcessingExecutiveBriefs(true)
        try {
            const res = await fetch('/api/admin/leads/crm/executive-briefs/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: 500, source: 'crm_manual', ai_narrative: true, ai_limit: 40 }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Erro ao atualizar resumos executivos')
            await Promise.all([loadLeads(), loadExecutiveBriefStatus()])
        } catch (err) {
            console.error('Erro ao atualizar resumos executivos:', err)
        } finally {
            setProcessingExecutiveBriefs(false)
        }
    }

    async function processSearchAlerts() {
        setProcessingSearchAlerts(true)
        try {
            const res = await fetch('/api/admin/search-alerts/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: 100 }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Erro ao varrer alertas salvos')
            await Promise.all([loadLeads(), loadExecutiveBriefStatus()])
        } catch (err) {
            console.error('Erro ao varrer alertas salvos:', err)
        } finally {
            setProcessingSearchAlerts(false)
        }
    }

    async function applyActionRecommendation(lead: LeadData, recommendation: any) {
        const key = `${lead.id}:${recommendation?.id || recommendation?.followup_key || 'recommendation'}`
        setApplyingRecommendationKey(key)
        try {
            const res = await fetch('/api/admin/leads/crm/actions/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: recommendation?.lead_id || lead.lead_id || lead.id,
                    recommendation_id: recommendation?.id,
                    followup_key: recommendation?.followup_key,
                    target_broker_id: recommendation?.suggested_broker_id,
                }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Erro ao aplicar recomendacao')
            await loadLeads()
        } catch (err) {
            console.error('Erro ao aplicar recomendacao:', err)
        } finally {
            setApplyingRecommendationKey(null)
        }
    }

    function buildExecutiveBriefSignals(lead: LeadData, timeline: CommercialTimelineEvent[]) {
        const followups = getSearchAlertFollowups(lead)
        const categoryCounts = timeline.reduce<Record<string, number>>((acc, event) => {
            acc[event.category] = (acc[event.category] || 0) + 1
            return acc
        }, {})

        return {
            score: getDisplayScore(lead),
            lead_status: lead.status,
            lead_source: lead.crm_source || null,
            lead_classification: lead.lead_classification || null,
            broker_id: lead.broker_id || null,
            broker_name: lead.broker_name || null,
            timeline_events: timeline.length,
            timeline_categories: categoryCounts,
            last_event_at: timeline[0]?.occurredAt || null,
            followups_total: followups.length,
            followups_pending: followups.filter((item: any) => getFollowUpStatus(item) === 'pending').length,
            followups_sent: followups.filter((item: any) => getFollowUpStatus(item) === 'sent').length,
            followups_responded: followups.filter((item: any) => getFollowUpStatus(item) === 'responded').length,
            followups_converted: followups.filter((item: any) => getFollowUpStatus(item) === 'converted').length,
            whatsapp_clicks: Array.isArray(lead.whatsapp_clicks) ? lead.whatsapp_clicks.length : 0,
            conversation_messages: Array.isArray(lead.conversation_messages) ? lead.conversation_messages.length : 0,
            recommendations: Array.isArray(lead.crm_action_recommendations?.items) ? lead.crm_action_recommendations.items.length : 0,
        }
    }

    async function saveExecutiveBriefSnapshot(lead: LeadData, brief: LeadExecutiveBrief, timeline: CommercialTimelineEvent[]) {
        const key = `${lead.id}:executive-brief`
        setSavingExecutiveBriefKey(key)
        try {
            const res = await fetch('/api/admin/leads/crm/executive-briefs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: lead.lead_id,
                    lead_phone: lead.lead_phone,
                    lead_name: lead.lead_name,
                    crm_row_id: lead.id,
                    broker_id: lead.broker_id,
                    source: 'crm_manual_snapshot',
                    brief,
                    signals: buildExecutiveBriefSignals(lead, timeline),
                }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Erro ao salvar resumo executivo')

            setLeads(current => current.map(item => (
                item.id === lead.id
                    ? { ...item, crm_executive_brief: data.snapshot }
                    : item
            )))
        } catch (err) {
            console.error('Erro ao salvar resumo executivo:', err)
        } finally {
            setSavingExecutiveBriefKey(null)
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
        if (score >= 80) return '#b45309'
        if (score >= 60) return '#c8a66a'
        if (score >= 40) return '#2563eb'
        return '#94a3b8'
    }

    function getScoreLabel(score: number): string {
        if (score >= 80) return 'Quente'
        if (score >= 60) return 'Morno'
        if (score >= 40) return 'Frio'
        return 'Novo'
    }

    function getLeadTemperature(score: number, stage?: LeadPipelineStageKey) {
        if (stage === 'perdidos') return { label: 'Perdido', color: '#b91c1c', bg: '#fef2f2', border: 'rgba(185,28,28,0.18)' }
        if (stage === 'contrato') return { label: 'Contrato', color: '#047857', bg: '#ecfdf5', border: 'rgba(4,120,87,0.18)' }
        if (score >= 80) return { label: 'Quente', color: '#b45309', bg: '#fff7ed', border: 'rgba(180,83,9,0.22)' }
        if (score >= 60) return { label: 'Morno', color: '#8a6a1f', bg: '#f8f1df', border: 'rgba(200,166,106,0.28)' }
        if (score >= 40) return { label: 'Frio', color: '#2563eb', bg: '#eff6ff', border: 'rgba(37,99,235,0.18)' }
        return { label: 'Novo', color: '#64748b', bg: '#f8fafc', border: 'rgba(100,116,139,0.18)' }
    }

    function getHeatLevel(score: number) {
        if (score >= 80) return 5
        if (score >= 60) return 4
        if (score >= 40) return 3
        if (score > 0) return 2
        return 1
    }

    function scrollPipelineStages(direction: -1 | 1) {
        const scroller = pipelineScrollerRef.current
        if (!scroller) return
        scroller.scrollBy({
            left: direction * Math.max(360, scroller.clientWidth * 0.72),
            behavior: 'smooth',
        })
    }

    function isPipelineInteractiveTarget(target: EventTarget | null) {
        return target instanceof HTMLElement && Boolean(target.closest('button,a,input,select,textarea,[role="button"]'))
    }

    function openLeadDossier(leadId: string) {
        pipelineDragRef.current.active = false
        pipelineDragRef.current.dragged = false
        setIsPipelineDragging(false)
        setExpandedLead(leadId)
    }

    function handlePipelinePointerDown(event: React.PointerEvent<HTMLDivElement>) {
        if (isPipelineInteractiveTarget(event.target)) {
            pipelineDragRef.current.active = false
            pipelineDragRef.current.dragged = false
            setIsPipelineDragging(false)
            return
        }
        const scroller = pipelineScrollerRef.current
        if (!scroller) return

        pipelineDragRef.current = {
            active: true,
            dragged: false,
            startX: event.clientX,
            scrollLeft: scroller.scrollLeft,
        }
        scroller.setPointerCapture?.(event.pointerId)
    }

    function handlePipelinePointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const scroller = pipelineScrollerRef.current
        const drag = pipelineDragRef.current
        if (!scroller || !drag.active) return

        const deltaX = event.clientX - drag.startX
        if (Math.abs(deltaX) > 4) {
            drag.dragged = true
            setIsPipelineDragging(true)
            scroller.scrollLeft = drag.scrollLeft - deltaX
            event.preventDefault()
        }
    }

    function finishPipelineDrag(event: React.PointerEvent<HTMLDivElement>) {
        const scroller = pipelineScrollerRef.current
        pipelineDragRef.current.active = false
        setIsPipelineDragging(false)
        scroller?.releasePointerCapture?.(event.pointerId)
    }

    function handlePipelineClickCapture(event: React.MouseEvent<HTMLDivElement>) {
        if (isPipelineInteractiveTarget(event.target)) {
            pipelineDragRef.current.dragged = false
            return
        }
        if (!pipelineDragRef.current.dragged) return
        event.preventDefault()
        event.stopPropagation()
        pipelineDragRef.current.dragged = false
    }

    function getDisplayScore(lead: LeadData): number {
        return Math.max(Number(lead.qualification_score || 0), Number(lead.lead_score || 0))
    }

    function getBrokerPhotoUrl(broker?: Broker | null): string | null {
        return broker?.whatsapp_profile_photo_url || broker?.broker_avatar_url || broker?.photo_url || null
    }

    function isGlobalWhatsappBroker(broker?: Pick<Broker, 'is_global_whatsapp_agent' | 'whatsapp_instance_type' | 'whatsapp_instance_name'> | null): boolean {
        const instanceType = String(broker?.whatsapp_instance_type || '').trim().toLowerCase()
        const instanceName = String(broker?.whatsapp_instance_name || '').trim().toLowerCase()
        return Boolean(
            broker?.is_global_whatsapp_agent ||
            instanceType === 'global' ||
            instanceName.includes('agente global') ||
            instanceName.includes('whatsapp global')
        )
    }

    function getPipelineStageForLead(lead: LeadData) {
        return getLeadPipelineStage(lead)
    }

    function getPipelineReason(lead: LeadData): string {
        if (lead.pipeline_reason) return lead.pipeline_reason

        const stage = getPipelineStageForLead(lead)
        const score = getDisplayScore(lead)
        if (stage === 'leads_quentes') return score >= 85 ? 'VIP / alta prioridade' : 'Score comercial quente'
        if (stage === 'visitas') return 'Sinal de visita ou agenda'
        if (stage === 'proposta_negociacao') return 'Sinal de valor ou negociacao'
        if (stage === 'investidores') return 'Perfil de investimento'
        if (stage === 'oportunidades') return 'Interesse ou atividade relevante'
        if (stage === 'fup') return 'Follow-up ou retomada pendente'
        if (stage === 'conectados') return 'Conversa iniciada'
        if (stage === 'proprietarios') return 'Possivel captacao'
        if (stage === 'standby') return 'Sem movimento recente'
        if (stage === 'perdidos') return 'Perdido ou opt-out'
        if (stage === 'contrato') return 'Conversao registrada'
        if (stage === 'contatos_gerais') return 'Contato sem intencao clara'
        return 'Novo contato'
    }

    function latestLeadMovement(lead: LeadData): string {
        const timestamps = [
            lead.conversation_updated_at,
            lead.updated_at,
            ...(Array.isArray(lead.conversation_messages)
                ? lead.conversation_messages.slice(-4).map((message: any) => message?.timestamp || message?.created_at || message?.sent_at)
                : []),
            ...(Array.isArray(lead.site_activity)
                ? lead.site_activity.slice(0, 4).map((activity: any) => activity?.occurred_at || activity?.created_at)
                : []),
        ]
            .map(value => String(value || '').trim())
            .filter(value => Number.isFinite(Date.parse(value)))
            .sort((a, b) => Date.parse(b) - Date.parse(a))

        return timestamps[0] || lead.updated_at || lead.created_at
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

    function asPlainRecord(value: any): Record<string, any> {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    }

    function parseExecutiveBriefRunResult(value: any): ExecutiveBriefRunResult | null {
        let parsed = value
        if (typeof value === 'string') {
            if (!value.trim()) return null
            try {
                parsed = JSON.parse(value)
            } catch {
                return null
            }
        }

        const record = asPlainRecord(parsed)
        if (Object.keys(record).length === 0) return null

        return {
            processedLeads: Number(record.processed_leads || 0),
            updatedLeads: Number(record.updated_leads || 0),
            highRisk: Number(record.high_risk || 0),
            mediumRisk: Number(record.medium_risk || 0),
            lowRisk: Number(record.low_risk || 0),
            aiNarrativesRequested: Number(record.ai_narratives_requested || 0),
            aiNarrativesGenerated: Number(record.ai_narratives_generated || 0),
            aiNarrativeSkippedReason: String(record.ai_narrative_skipped_reason || ''),
            source: String(record.source || ''),
            generatedAt: String(record.generated_at || ''),
            errors: Array.isArray(record.errors)
                ? record.errors.map((item: any) => String(item)).filter(Boolean).slice(0, 3)
                : [],
        }
    }

    function parsePropertySearchAlertsRunResult(value: any): PropertySearchAlertsRunResult | null {
        let parsed = value
        if (typeof value === 'string') {
            if (!value.trim()) return null
            try {
                parsed = JSON.parse(value)
            } catch {
                return null
            }
        }

        const record = asPlainRecord(parsed)
        if (Object.keys(record).length === 0) return null

        return {
            processedProperties: Number(record.processed_properties || record.processedProperties || 0),
            alertsChecked: Number(record.alerts_checked || record.alertsChecked || 0),
            matchesCreated: Number(record.matches_created || record.matchesCreated || 0),
            notificationsSent: Number(record.notifications_sent || record.notificationsSent || 0),
            notificationsFailed: Number(record.notifications_failed || record.notificationsFailed || 0),
            propertyErrors: Number(record.property_errors || record.propertyErrors || 0),
            source: String(record.source || ''),
            processedAt: String(record.processed_at || record.processedAt || ''),
            updatedSince: String(record.updated_since || record.updatedSince || ''),
            limit: Number(record.limit || 0),
            force: Boolean(record.force),
        }
    }

    function parseCrmActionRecommendationsRunResult(value: any): CrmActionRecommendationsRunResult | null {
        let parsed = value
        if (typeof value === 'string') {
            if (!value.trim()) return null
            try {
                parsed = JSON.parse(value)
            } catch {
                return null
            }
        }

        const record = asPlainRecord(parsed)
        if (Object.keys(record).length === 0) return null

        const strongestBroker = asPlainRecord(record.strongest_broker || record.strongestBroker)
        return {
            processedLeads: Number(record.processed_leads || record.processedLeads || 0),
            leadsWithFollowups: Number(record.leads_with_followups || record.leadsWithFollowups || 0),
            updatedLeads: Number(record.updated_leads || record.updatedLeads || 0),
            totalRecommendations: Number(record.total_recommendations || record.totalRecommendations || 0),
            generatedAt: String(record.generated_at || record.generatedAt || ''),
            errors: Array.isArray(record.errors)
                ? record.errors.map((item: any) => String(item)).filter(Boolean).slice(0, 3)
                : [],
            summary: asPlainRecord(record.summary),
            strongestBroker: Object.keys(strongestBroker).length
                ? {
                    id: String(strongestBroker.id || ''),
                    name: String(strongestBroker.name || ''),
                    response_rate: Number(strongestBroker.response_rate || 0),
                    conversion_rate: Number(strongestBroker.conversion_rate || 0),
                }
                : null,
        }
    }

    function formatExecutiveBriefSkipReason(reason: string) {
        if (!reason) return 'IA executada quando aplicavel'
        if (reason === 'ai_narrative_disabled') return 'Narrativa IA desativada nesta execucao'
        if (reason === 'ai_key_missing') return 'Chave de IA ausente ou nao configurada'
        if (reason.startsWith('ai_config_error')) return 'Erro ao ler configuracao de IA'
        return reason
    }

    function getExecutiveBriefHealth(status: ExecutiveBriefStatus | null) {
        if (!status) {
            return { label: 'Sem leitura', color: '#64748b', bg: '#f8fafc', detail: 'Status ainda nao carregado.' }
        }

        const lastStartedMs = Date.parse(status.lastStartedAt)
        const lastRunMs = Date.parse(status.lastRunAt)
        const hasFreshStarted = Number.isFinite(lastStartedMs) && (Date.now() - lastStartedMs) < 2 * 36e5
        const hasFreshRun = Number.isFinite(lastRunMs) && (Date.now() - lastRunMs) < 36 * 36e5

        if (status.lastError || status.cronLastError) {
            return { label: 'Atencao', color: '#b91c1c', bg: '#fef2f2', detail: status.lastError || status.cronLastError }
        }
        if (hasFreshStarted && (!Number.isFinite(lastRunMs) || lastStartedMs > lastRunMs)) {
            return { label: 'Rodando', color: '#b45309', bg: '#fffbeb', detail: 'Existe uma execucao iniciada recentemente.' }
        }
        if (hasFreshRun) {
            return { label: 'OK', color: '#047857', bg: '#ecfdf5', detail: 'Resumo executivo atualizado recentemente.' }
        }
        if (status.lastRunAt) {
            return { label: 'Atrasado', color: '#b45309', bg: '#fffbeb', detail: 'Ultima execucao passou da janela operacional.' }
        }

        return { label: 'Sem execucao', color: '#64748b', bg: '#f8fafc', detail: 'Nenhuma execucao registrada ainda.' }
    }

    function getPropertySearchAlertsHealth(status: PropertySearchAlertsStatus | null) {
        if (!status) {
            return { label: 'Sem leitura', color: '#64748b', bg: '#f8fafc', detail: 'Status ainda nao carregado.' }
        }

        const lastStartedMs = Date.parse(status.lastStartedAt)
        const lastRunMs = Date.parse(status.lastRunAt || status.cronLastRunAt)
        const hasFreshStarted = Number.isFinite(lastStartedMs) && (Date.now() - lastStartedMs) < 90 * 60000
        const hasFreshRun = Number.isFinite(lastRunMs) && (Date.now() - lastRunMs) < 3 * 36e5

        if (status.lastError || status.cronLastError) {
            return { label: 'Atencao', color: '#b91c1c', bg: '#fef2f2', detail: status.lastError || status.cronLastError }
        }
        if (hasFreshStarted && (!Number.isFinite(lastRunMs) || lastStartedMs > lastRunMs)) {
            return { label: 'Rodando', color: '#b45309', bg: '#fffbeb', detail: 'O cron iniciou uma varredura recentemente.' }
        }
        if (hasFreshRun) {
            return { label: 'OK', color: '#047857', bg: '#ecfdf5', detail: 'Alertas salvos foram varridos recentemente.' }
        }
        if (status.lastRunAt || status.cronLastRunAt) {
            return { label: 'Atrasado', color: '#b45309', bg: '#fffbeb', detail: 'Ultima varredura passou da janela operacional.' }
        }

        return { label: 'Sem execucao', color: '#64748b', bg: '#f8fafc', detail: 'Aguardando primeira varredura automatica.' }
    }

    function getCrmActionRecommendationsHealth(status: CrmActionRecommendationsStatus | null) {
        if (!status) {
            return { label: 'Sem leitura', color: '#64748b', bg: '#f8fafc', detail: 'Status ainda nao carregado.' }
        }

        const lastStartedMs = Date.parse(status.lastStartedAt)
        const lastRunMs = Date.parse(status.lastRunAt || status.cronLastRunAt)
        const hasFreshStarted = Number.isFinite(lastStartedMs) && (Date.now() - lastStartedMs) < 2 * 36e5
        const hasFreshRun = Number.isFinite(lastRunMs) && (Date.now() - lastRunMs) < 36 * 36e5

        if (status.lastError || status.cronLastError) {
            return { label: 'Atencao', color: '#b91c1c', bg: '#fef2f2', detail: status.lastError || status.cronLastError }
        }
        if (hasFreshStarted && (!Number.isFinite(lastRunMs) || lastStartedMs > lastRunMs)) {
            return { label: 'Rodando', color: '#b45309', bg: '#fffbeb', detail: 'A fila IA iniciou uma sincronizacao recentemente.' }
        }
        if (hasFreshRun) {
            return { label: 'OK', color: '#047857', bg: '#ecfdf5', detail: 'Proximas melhores acoes atualizadas recentemente.' }
        }
        if (status.lastRunAt || status.cronLastRunAt) {
            return { label: 'Atrasado', color: '#b45309', bg: '#fffbeb', detail: 'Ultima sincronizacao passou da janela operacional.' }
        }

        return { label: 'Sem execucao', color: '#64748b', bg: '#f8fafc', detail: 'Aguardando primeira sincronizacao da fila IA.' }
    }

    function getActionActorLabel(action: any): string {
        const record = asPlainRecord(action)
        const name = String(record.action_actor_name || record.actor_name || record.updated_by_name || record.applied_by_name || '').trim()
        const email = String(record.action_actor_email || record.actor_email || record.updated_by_email || record.applied_by_email || '').trim()

        return name || email
    }

    function getRecommendationTypeLabel(type: string): string {
        if (type === 'alert_opened_no_contact') return 'Alerta aberto'
        if (type === 'redistribution') return 'Rebalanceamento'
        if (type === 'unassigned') return 'Distribuicao'
        if (type === 'stale_sent') return 'Reativacao'
        if (type === 'stale_pending') return 'Primeiro contato'
        if (type === 'premium_intent_no_contact') return 'Intencao premium'
        if (type === 'private_visit_pending') return 'Visita privada'
        if (type === 'availability_pending') return 'Disponibilidade'
        if (type === 'reserved_negotiation_pending') return 'Negociacao reservada'
        if (type === 'value_reading_pending') return 'Leitura de valor'
        if (type === 'favorite_property_pending') return 'Favorito'
        if (type === 'revisited_property_pending') return 'Revisita'
        if (type === 'street_view_pending') return 'Street View'
        if (type === 'price_history_pending') return 'Valor historico'
        return 'Acao IA'
    }

    function isPremiumRecommendationType(type: string): boolean {
        return [
            'premium_intent_no_contact',
            'private_visit_pending',
            'availability_pending',
            'reserved_negotiation_pending',
            'value_reading_pending',
        ].includes(type)
    }

    function getRecommendationTypeTone(type: string): { color: string; bg: string } {
        if (isPremiumRecommendationType(type)) return { color: '#7c2d12', bg: '#fff7ed' }
        if (isBehaviorSignalRecommendationType(type)) return { color: '#0f766e', bg: '#f0fdfa' }
        if (type === 'redistribution') return { color: '#7c3aed', bg: '#f5f3ff' }
        if (type === 'unassigned') return { color: '#047857', bg: '#ecfdf5' }
        if (type === 'stale_sent') return { color: '#2563eb', bg: '#eff6ff' }
        if (type === 'alert_opened_no_contact') return { color: '#b45309', bg: '#fffbeb' }
        return { color: '#0f172a', bg: '#f8fafc' }
    }

    function isBehaviorSignalRecommendationType(type: string): boolean {
        return [
            'favorite_property_pending',
            'revisited_property_pending',
            'street_view_pending',
            'price_history_pending',
        ].includes(type)
    }

    function isRecommendationResolved(item: any): boolean {
        const status = String(item?.applied_status || '').toLowerCase()
        return status === 'applied' || status === 'resolved' || Boolean(item?.applied_at || item?.resolved_at)
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

    function formatReadableText(value?: string | null): string {
        const text = String(value || '').trim()
        if (!text) return ''
        if (!/%[0-9a-f]{2}/i.test(text)) return text

        try {
            return decodeURIComponent(text.replace(/\+/g, ' '))
        } catch {
            return text
        }
    }

    function formatApproxLocation(lead: LeadData): string {
        return [lead.city, lead.state, lead.country]
            .map(formatReadableText)
            .filter(Boolean)
            .join(', ')
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

    function formatMapIntent(summary: any): string[] {
        const items: string[] = []
        const areaCount = Number(summary?.map_area_search_count || 0)
        const drawCount = Number(summary?.map_draw_area_count || 0)
        const boundsCount = Number(summary?.map_bounds_search_count || 0)
        const previewCount = Number(summary?.map_preview_count || 0)
        const streetCount = Number(summary?.street_view_count || 0)
        const locationCount = Number(summary?.location_view_count || 0)
        const savedSearchCount = Number(summary?.saved_search_count || 0)
        const searchAlertMatchCount = Number(summary?.search_alert_match_count || 0)
        const regions = Array.isArray(summary?.selected_regions) ? summary.selected_regions.filter(Boolean) : []
        const areaSummaries = Array.isArray(summary?.map_area_summaries) ? summary.map_area_summaries.filter(Boolean) : []
        const lastMapIntent = asPlainRecord(summary?.last_map_intent)

        if (searchAlertMatchCount > 0) items.push(`${searchAlertMatchCount} match(es) de alerta`)
        if (savedSearchCount > 0) items.push(`${savedSearchCount} alerta(s) salvo(s)`)
        if (drawCount > 0) items.push(`${drawCount} area(s) desenhada(s)`)
        if (boundsCount > 0) items.push(`${boundsCount} recorte(s) no mapa`)
        if (areaCount > 0 && !drawCount && !boundsCount) items.push(`${areaCount} busca(s) por area`)
        if (previewCount > 0) items.push(`${previewCount} interacao(oes) com previews`)
        if (streetCount > 0) items.push(`${streetCount} Street View`)
        if (locationCount > 0) items.push(`${locationCount} consulta(s) de localizacao`)
        if (regions.length > 0) items.push(`Regiao: ${regions.slice(0, 2).join(', ')}`)
        if (lastMapIntent?.visible_count) items.push(`Ultimo recorte: ${lastMapIntent.visible_count} imoveis`)
        if (areaSummaries.length > 0) items.push(`Bounds: ${String(areaSummaries[0]).slice(0, 56)}`)

        return items
    }

    function premiumIntentLabel(value: any): string {
        const intent = String(value || '').toLowerCase()
        if (intent === 'private_visit') return 'Visita privada'
        if (intent === 'availability') return 'Disponibilidade'
        if (intent === 'reserved_negotiation') return 'Negociacao reservada'
        if (intent === 'value_reading') return 'Leitura de valor'
        return String(value || '').trim()
    }

    function getPremiumIntentItems(summary: any): Array<{ label: string; detail: string; propertyUrl: string; occurredAt: string }> {
        const raw = Array.isArray(summary?.premium_intents) ? summary.premium_intents : []
        return raw
            .map((item: any) => {
                const intent = premiumIntentLabel(item?.premium_intent)
                const label = intent || String(item?.label || '').trim()
                const detail = [
                    item?.property_title,
                    item?.requested_action,
                    item?.cta_context,
                ].map(value => String(value || '').trim()).filter(Boolean).join(' | ')

                return {
                    label,
                    detail,
                    propertyUrl: getPropertyUrlFromRecord(item) || '',
                    occurredAt: String(item?.occurred_at || '').trim(),
                }
            })
            .filter((item: { label: string }) => item.label)
            .slice(0, 4)
    }

    function formatPremiumIntent(summary: any): string[] {
        const items: string[] = []
        const privateVisitCount = Number(summary?.private_visit_request_count || 0)
        const availabilityCount = Number(summary?.availability_request_count || 0)
        const negotiationCount = Number(summary?.reserved_negotiation_request_count || 0)
        const valueReadingCount = Number(summary?.value_reading_request_count || 0)
        const latest = asPlainRecord(summary?.latest_premium_intent)

        if (privateVisitCount > 0) items.push(`${privateVisitCount} visita(s) privada(s)`)
        if (availabilityCount > 0) items.push(`${availabilityCount} pedido(s) de disponibilidade`)
        if (negotiationCount > 0) items.push(`${negotiationCount} negociacao(oes) reservada(s)`)
        if (valueReadingCount > 0) items.push(`${valueReadingCount} leitura(s) de valor`)
        if (latest?.property_title) items.push(`Ultimo imovel: ${String(latest.property_title).slice(0, 54)}`)

        return items
    }

    function formatSavedPropertyIntent(summary: any): string[] {
        const items: string[] = []
        const favoriteCount = Array.isArray(summary?.liked_property_ids) ? summary.liked_property_ids.length : 0
        const previewCount = Number(summary?.map_preview_count || 0)
        const continuationCount = Number(summary?.continuation_count || 0)
        const streetCount = Number(summary?.street_view_count || 0)
        const priceHistoryCount = Array.isArray(summary?.price_history_property_ids) ? summary.price_history_property_ids.length : 0

        if (favoriteCount > 0) items.push(`${favoriteCount} favorito(s)`)
        if (continuationCount > 0) items.push(`${continuationCount} retomada(s) de salvos/recentes`)
        if (previewCount > 0) items.push(`${previewCount} preview(s) no mapa`)
        if (streetCount > 0) items.push(`${streetCount} Street View`)
        if (priceHistoryCount > 0) items.push(`${priceHistoryCount} leitura(s) de valor/historico`)

        return items
    }

    function getSavedPropertySignalItems(lead: LeadData): Array<{ label: string; detail: string; propertyUrl: string; occurredAt: string }> {
        const activities = Array.isArray(lead.site_activity) ? lead.site_activity : []
        return activities
            .map(asPlainRecord)
            .filter(item => {
                const eventType = String(item.event_type || '')
                const source = String(item.source || '')
                const sectionId = String(item.section_id || '')
                const sectionLabel = String(item.section_label || '').toLowerCase()
                return eventType === 'property_favorited'
                    || eventType === 'search_results_memory_property_clicked'
                    || eventType === 'property_details_continuation_favorites_clicked'
                    || eventType === 'property_details_continuation_property_clicked'
                    || (eventType === 'property_feed_saved_history_clicked' && ['favorites', 'history'].includes(source))
                    || eventType === 'property_location_street_view_opened'
                    || (eventType === 'property_details_landing_section_viewed' && (sectionId === 'historico-precos' || sectionLabel.includes('historico')))
            })
            .sort((a, b) => Date.parse(String(b.occurred_at || b.created_at || '')) - Date.parse(String(a.occurred_at || a.created_at || '')))
            .slice(0, 4)
            .map(item => {
                const eventType = String(item.event_type || '')
                const source = String(item.source || '')
                const sectionId = String(item.section_id || '')
                const label = eventType === 'property_favorited' || source === 'favorites'
                    ? 'Favorito'
                    : eventType === 'property_location_street_view_opened'
                        ? 'Street View'
                        : sectionId === 'historico-precos'
                            ? 'Valor historico'
                            : 'Revisita'
                const title = String(item.property_title || item.title || '').trim()
                const detail = [
                    title,
                    source === 'history' ? 'Historico recente' : '',
                    item.detail,
                ].map(value => String(value || '').trim()).filter(Boolean).join(' | ')

                return {
                    label,
                    detail,
                    propertyUrl: getPropertyUrlFromRecord(item) || '',
                    occurredAt: String(item.occurred_at || item.created_at || '').trim(),
                }
            })
    }

    function getBehaviorEventCount(summary: any, eventType: string): number {
        const counts = asPlainRecord(summary?.event_counts)
        const count = Number(counts[eventType] || 0)
        return Number.isFinite(count) ? count : 0
    }

    function getAlertOpenSourceLabel(source: any): string {
        const value = String(source || '').toLowerCase()
        if (value.includes('direct')) return 'link direto'
        if (value.includes('panel')) return 'painel'
        if (value.includes('push')) return 'push'
        if (value.includes('crm')) return 'CRM'
        return 'alerta salvo'
    }

    function getLatestSearchAlertFollowup(summary: any) {
        const followups = Array.isArray(summary?.search_alert_followups)
            ? summary.search_alert_followups
            : []
        const withMessage = followups.filter((item: any) => typeof item?.message === 'string' && item.message.trim())
        return withMessage.find((item: any) => {
            const status = getFollowUpStatus(item)
            return status !== 'converted' && status !== 'dismissed'
        }) || withMessage[0] || null
    }

    function getSearchAlertFollowups(lead: LeadData) {
        return Array.isArray(lead.behavior_summary?.search_alert_followups)
            ? lead.behavior_summary.search_alert_followups.filter((item: any) => typeof item?.message === 'string' && item.message.trim())
            : []
    }

    function getSearchAlertOpenInsight(lead: LeadData) {
        const summary = lead.behavior_summary || {}
        const openedCount = getBehaviorEventCount(summary, 'property_search_alert_match_opened')
        const openedActivities = Array.isArray(lead.site_activity)
            ? lead.site_activity
                .filter((activity: any) => String(activity?.event_type || '') === 'property_search_alert_match_opened')
                .sort((a: any, b: any) => Date.parse(String(b?.occurred_at || b?.created_at || '')) - Date.parse(String(a?.occurred_at || a?.created_at || '')))
            : []
        const latestActivity = openedActivities[0] || null
        const latestFollowup = getLatestSearchAlertFollowup(summary)
        const count = Math.max(openedCount, openedActivities.length)

        if (count <= 0 && !latestActivity) return null

        const propertyTitle = String(
            latestActivity?.property_title
            || latestActivity?.title
            || latestFollowup?.property_title
            || latestFollowup?.title
            || ''
        ).trim()
        const alertTitle = String(latestActivity?.alert_title || latestFollowup?.alert_title || latestActivity?.detail || '').trim()
        const propertyUrl = getPropertyUrlFromRecord(latestActivity) || getPropertyUrlFromRecord(latestFollowup)
        const openedAt = String(latestActivity?.occurred_at || latestActivity?.created_at || '').trim()
        const matchScore = Number(latestActivity?.match_score ?? latestFollowup?.match_score ?? lead.lead_score ?? lead.qualification_score ?? 0)

        return {
            lead,
            latestActivity,
            latestFollowup,
            openedCount: count,
            propertyTitle,
            alertTitle,
            propertyUrl,
            openedAt,
            matchScore: Number.isFinite(matchScore) ? matchScore : 0,
            sourceLabel: getAlertOpenSourceLabel(latestActivity?.source),
        }
    }

    function getFollowUpStatus(followup: any): string {
        const status = String(followup?.action_status || followup?.status || 'pending').toLowerCase()
        return FOLLOWUP_STATUS_CONFIG[status] ? status : 'pending'
    }

    function getFollowUpStatusTimestamp(followup: any): string {
        const status = getFollowUpStatus(followup)
        if (status === 'sent' && followup?.sent_at) return String(followup.sent_at)
        if (status === 'responded' && followup?.responded_at) return String(followup.responded_at)
        if (status === 'converted' && followup?.converted_at) return String(followup.converted_at)
        return followup?.action_updated_at ? String(followup.action_updated_at) : ''
    }

    function getFollowUpActionKey(followup: any): string {
        const explicit = String(followup?.key || followup?.followup_key || '').trim()
        if (explicit) return explicit

        return [
            followup?.alert_id,
            followup?.property_id,
            followup?.message,
        ].map(item => String(item || '').trim()).filter(Boolean).join(':') || String(followup?.title || 'followup')
    }

    function getFollowUpUiKey(lead: LeadData, followup: any): string {
        return `${lead.id}:${getFollowUpActionKey(followup)}`
    }

    function getRecommendationFollowup(lead: LeadData, recommendation: any) {
        const recommendationKey = String(recommendation?.followup_key || '').trim()
        const recommendationAlertId = String(recommendation?.alert_id || '').trim()
        const recommendationPropertyId = String(recommendation?.property_id || '').trim()

        return getSearchAlertFollowups(lead).find((followup: any) => {
            if (recommendationKey && getFollowUpActionKey(followup) === recommendationKey) return true
            if (recommendationAlertId && String(followup?.alert_id || '').trim() === recommendationAlertId) return true
            return Boolean(recommendationPropertyId && String(followup?.property_id || '').trim() === recommendationPropertyId)
        }) || null
    }

    function isConsultativeRecommendationActive(lead: LeadData, recommendation: any): boolean {
        if (isRecommendationResolved(recommendation)) return false

        const type = String(recommendation?.type || '')
        const followup = getRecommendationFollowup(lead, recommendation)
        const status = followup ? getFollowUpStatus(followup) : String(recommendation?.status || 'pending').toLowerCase()

        if (type === 'alert_opened_no_contact' || type === 'stale_pending') return status === 'pending'
        if (type === 'stale_sent') return status === 'sent'
        return true
    }

    function applyFollowUpStatusToLead(lead: LeadData, actionKey: string, status: string, action?: any, crmActionRecommendations?: any): LeadData {
        const summary = lead.behavior_summary || {}
        const followups = Array.isArray(summary.search_alert_followups)
            ? summary.search_alert_followups
            : []

        return {
            ...lead,
            crm_action_recommendations: crmActionRecommendations || lead.crm_action_recommendations,
            behavior_summary: {
                ...summary,
                search_alert_followups: followups.map((item: any) => (
                    getFollowUpActionKey(item) === actionKey
                        ? {
                            ...item,
                            action_status: status,
                            action_updated_at: action?.updated_at || new Date().toISOString(),
                            action_actor_type: action?.actor_type ?? item.action_actor_type ?? null,
                            action_actor_id: action?.actor_id ?? action?.updated_by_admin_user_id ?? item.action_actor_id ?? null,
                            action_actor_name: action?.actor_name ?? action?.updated_by_name ?? item.action_actor_name ?? null,
                            action_actor_email: action?.actor_email ?? action?.updated_by_email ?? item.action_actor_email ?? null,
                            sent_at: action?.sent_at ?? item.sent_at ?? null,
                            responded_at: action?.responded_at ?? item.responded_at ?? null,
                            converted_at: action?.converted_at ?? item.converted_at ?? null,
                        }
                        : item
                )),
            },
        }
    }

    async function updateFollowUpStatus(lead: LeadData, followup: any, status: string) {
        const actionKey = getFollowUpActionKey(followup)
        const uiKey = getFollowUpUiKey(lead, followup)
        setUpdatingFollowUpKey(uiKey)

        try {
            const res = await fetch('/api/admin/leads/crm', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: lead.id,
                    lead_id: lead.lead_id,
                    lead_phone: lead.lead_phone,
                    followup_action: {
                        key: actionKey,
                        status,
                        alert_id: followup.alert_id,
                        alert_title: followup.alert_title,
                        property_id: followup.property_id,
                        property_title: followup.property_title,
                        property_url: followup.property_url,
                        message: followup.message,
                        match_score: followup.match_score,
                    },
                }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Erro ao atualizar abordagem')

            setLeads(current => current.map(item => (
                item.id === lead.id
                    ? applyFollowUpStatusToLead(item, actionKey, status, data.followup_action, data.crm_action_recommendations)
                    : item
            )))
        } catch (err) {
            console.error('Erro ao atualizar abordagem:', err)
        } finally {
            setUpdatingFollowUpKey(null)
        }
    }

    function normalizePhoneForWhatsApp(phone?: string | null): string {
        const clean = String(phone || '').replace(/\D/g, '')
        if (!clean) return ''
        if (clean.startsWith('55')) return clean
        if (clean.length > 11) return clean
        return `55${clean}`
    }

    function buildWhatsAppFollowUpUrl(lead: LeadData, message: string): string {
        const phone = normalizePhoneForWhatsApp(lead.lead_phone)
        if (!phone || !message.trim()) return ''
        return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    }

    function buildWhatsAppLeadUrl(lead: LeadData, message = ''): string {
        const phone = normalizePhoneForWhatsApp(lead.lead_phone)
        if (!phone) return ''
        const text = message.trim()
        return text ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/${phone}`
    }

    function getPropertyUrlFromRecord(record: any): string {
        const source = asPlainRecord(record)
        const explicitUrl = String(source.property_url || source.url || '').trim()
        if (explicitUrl) return explicitUrl

        const propertyId = String(source.property_id || source.target_property_id || '').trim()
        if (!propertyId) return ''

        return propertyDetailsPath({
            id: propertyId,
            source_slug: String(source.source_slug || source.property_slug || '').trim() || null,
            slug: String(source.slug || '').trim() || null,
            title: String(source.property_title || source.title || '').trim() || null,
            seo_title: String(source.seo_title || '').trim() || null,
            property_type: String(source.property_type || '').trim() || null,
        })
    }

    async function copyTextToClipboard(text: string) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return
        }

        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
    }

    async function copyFollowUpMessage(key: string, message: string) {
        if (!message.trim()) return

        try {
            await copyTextToClipboard(message)
            setCopiedFollowUpKey(key)
            window.setTimeout(() => setCopiedFollowUpKey(null), 1800)
        } catch (err) {
            console.error('Erro ao copiar abordagem:', err)
        }
    }

    async function copyExecutiveQueueBriefing(key: string, briefing: string) {
        if (!briefing.trim()) return

        try {
            await copyTextToClipboard(briefing)
            setCopiedExecutiveQueueKey(key)
            window.setTimeout(() => setCopiedExecutiveQueueKey(null), 1800)
        } catch (err) {
            console.error('Erro ao copiar briefing executivo:', err)
        }
    }

    function toggleExecutiveAgendaDone(key: string) {
        setCompletedExecutiveAgendaKeys(current => current.includes(key)
            ? current.filter(item => item !== key)
            : [...current, key])
    }

    function formatActivity(activity: any): string {
        const detail = activity?.detail ? ` - ${activity.detail}` : ''
        const title = activity?.property_title ? `: ${activity.property_title}` : ''
        return `${activity?.label || activity?.event_type || 'Atividade'}${title}${detail}`
    }

    function compactTimelineText(value: any, max = 132): string {
        const text = String(value || '').replace(/\s+/g, ' ').trim()
        if (!text) return ''
        return text.length > max ? `${text.slice(0, max).trim()}...` : text
    }

    function validTimelineDate(value: any): string {
        const text = String(value || '').trim()
        if (!text) return ''
        return Number.isFinite(Date.parse(text)) ? text : ''
    }

    function getCommercialTimeline(lead: LeadData): CommercialTimelineEvent[] {
        const events: CommercialTimelineEvent[] = []

        Object.entries(asPlainRecord(lead.crm_action_recommendation_actions)).forEach(([actionKey, rawAction]) => {
            const action = asPlainRecord(rawAction)
            const occurredAt = validTimelineDate(action.applied_at || action.updated_at)
            if (!occurredAt) return

            const type = String(action.recommendation_type || '')
            const targetBroker = String(action.target_broker_name || '').trim()
            const propertyTitle = String(action.property_title || action.alert_title || '').trim()
            const title = String(action.recommendation_title || getRecommendationTypeLabel(type)).trim()
            const detail = [
                title,
                targetBroker ? `Destino: ${targetBroker}` : '',
                propertyTitle,
            ].filter(Boolean).join(' | ')

            events.push({
                key: `recommendation:${actionKey}:${occurredAt}`,
                category: 'IA',
                title: getRecommendationTypeLabel(type),
                detail: compactTimelineText(detail),
                actor: getActionActorLabel(action),
                occurredAt,
                icon: type === 'redistribution' ? ArrowRightLeft : Zap,
                color: type === 'redistribution' ? '#7c3aed' : '#047857',
                bg: type === 'redistribution' ? '#f5f3ff' : '#ecfdf5',
                propertyUrl: getPropertyUrlFromRecord(action),
                whatsappUrl: buildWhatsAppLeadUrl(lead),
            })
        })

        getSearchAlertFollowups(lead).forEach((followup: any) => {
            const occurredAt = validTimelineDate(getFollowUpStatusTimestamp(followup))
            if (!occurredAt) return

            const status = getFollowUpStatus(followup)
            const cfg = FOLLOWUP_STATUS_CONFIG[status] || FOLLOWUP_STATUS_CONFIG.pending
            const Icon = status === 'responded'
                ? Reply
                : status === 'converted'
                    ? Trophy
                    : status === 'dismissed'
                        ? XCircle
                        : status === 'sent'
                            ? Send
                            : CircleDashed

            events.push({
                key: `followup:${getFollowUpActionKey(followup)}:${occurredAt}`,
                category: 'Follow-up',
                title: `Abordagem ${cfg.label.toLowerCase()}`,
                detail: compactTimelineText(followup.property_title || followup.title || followup.message || 'Alerta salvo'),
                actor: getActionActorLabel(followup),
                occurredAt,
                icon: Icon,
                color: cfg.color,
                bg: cfg.bg,
                propertyUrl: getPropertyUrlFromRecord(followup),
                whatsappUrl: buildWhatsAppLeadUrl(lead, String(followup.message || '')),
                followup,
                followupStatus: status,
            })
        })

        if (Array.isArray(lead.whatsapp_clicks)) {
            lead.whatsapp_clicks.forEach((click: any, index: number) => {
                const occurredAt = validTimelineDate(click?.clicked_at || click?.occurred_at || click?.created_at)
                if (!occurredAt) return

                events.push({
                    key: `whatsapp-click:${click?.id || index}:${occurredAt}`,
                    category: 'WhatsApp',
                    title: 'Clique para conversa',
                    detail: compactTimelineText(formatClickAction(click)),
                    actor: 'Lead',
                    occurredAt,
                    icon: MessageSquare,
                    color: '#008069',
                    bg: '#f6fffb',
                    propertyUrl: getPropertyUrlFromRecord(click),
                    whatsappUrl: buildWhatsAppLeadUrl(lead),
                })
            })
        }

        if (Array.isArray(lead.conversation_messages)) {
            lead.conversation_messages.slice(-6).forEach((message: any, index: number) => {
                const occurredAt = validTimelineDate(message?.timestamp || message?.created_at || message?.sent_at)
                const text = cleanConversationContent(message?.content || message?.text || '')
                if (!occurredAt || !text) return

                const isLead = message?.role !== 'assistant'
                events.push({
                    key: `conversation:${message?.message_id || index}:${occurredAt}`,
                    category: 'Conversa',
                    title: isLead ? 'Lead respondeu no WhatsApp' : 'IA respondeu no WhatsApp',
                    detail: compactTimelineText(text),
                    actor: isLead ? 'Lead' : (lead.broker_name || 'IA Pilger'),
                    occurredAt,
                    icon: isLead ? Reply : MessageSquare,
                    color: isLead ? '#2563eb' : '#64748b',
                    bg: isLead ? '#eff6ff' : '#f8fafc',
                    whatsappUrl: buildWhatsAppLeadUrl(lead),
                })
            })
        }

        if (Array.isArray(lead.site_activity)) {
            lead.site_activity.forEach((activity: any, index: number) => {
                const eventType = String(activity?.event_type || '')
                if (eventType.startsWith('crm_search_alert_followup') || eventType === 'crm_action_recommendation_applied') return

                const occurredAt = validTimelineDate(activity?.occurred_at || activity?.created_at)
                if (!occurredAt) return
                const isAlertOpen = eventType === 'property_search_alert_match_opened'

                events.push({
                    key: `site:${activity?.id || eventType || index}:${occurredAt}`,
                    category: isAlertOpen ? 'Alerta' : 'Site',
                    title: String(activity?.label || activity?.event_type || 'Atividade no site'),
                    detail: compactTimelineText(formatActivity(activity)),
                    actor: 'Lead',
                    occurredAt,
                    icon: isAlertOpen ? BellRing : Home,
                    color: isAlertOpen ? '#b45309' : '#8a6d3b',
                    bg: isAlertOpen ? '#fffbeb' : '#fffaf0',
                    propertyUrl: getPropertyUrlFromRecord(activity),
                    whatsappUrl: buildWhatsAppLeadUrl(lead),
                    source: String(activity?.source || ''),
                })
            })
        }

        if (lead.created_at) {
            events.push({
                key: `lead-created:${lead.id}:${lead.created_at}`,
                category: 'Lead',
                title: 'Lead entrou no CRM',
                detail: compactTimelineText([lead.source, lead.landing_page_title || lead.landing_page_slug].filter(Boolean).join(' | ') || 'Cadastro inicial'),
                actor: 'Sistema',
                occurredAt: lead.created_at,
                icon: User,
                color: '#0f172a',
                bg: '#f8fafc',
                whatsappUrl: buildWhatsAppLeadUrl(lead),
            })
        }

        const byKey = new Map<string, CommercialTimelineEvent>()
        events.forEach(item => {
            if (!byKey.has(item.key)) byKey.set(item.key, item)
        })
        const deduped = Array.from(byKey.values())

        return deduped
            .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
            .slice(0, 12)
    }

    function getLeadExecutiveBrief(lead: LeadData, timeline: CommercialTimelineEvent[]): LeadExecutiveBrief {
        const score = getDisplayScore(lead)
        const followups = getSearchAlertFollowups(lead)
        const pendingFollowups = followups.filter((item: any) => getFollowUpStatus(item) === 'pending')
        const sentFollowups = followups.filter((item: any) => getFollowUpStatus(item) === 'sent')
        const convertedFollowups = followups.filter((item: any) => getFollowUpStatus(item) === 'converted')
        const lastEvent = timeline[0]
        const latestFollowup = getLatestSearchAlertFollowup(lead.behavior_summary)
        const lastEventAgeHours = lastEvent?.occurredAt
            ? Math.max(0, Math.floor((Date.now() - Date.parse(lastEvent.occurredAt)) / 36e5))
            : null
        const staleSentCount = sentFollowups.filter((followup: any) => {
            const reference = getFollowUpStatusTimestamp(followup) || followup.occurred_at || lead.updated_at || lead.created_at
            const time = Date.parse(reference)
            return Number.isFinite(time) && (Date.now() - time) >= SENT_FOLLOWUP_SLA_HOURS * 36e5
        }).length
        const stalePendingCount = pendingFollowups.filter((followup: any) => {
            const reference = followup.occurred_at || getFollowUpStatusTimestamp(followup) || lead.updated_at || lead.created_at
            const time = Date.parse(reference)
            return Number.isFinite(time) && (Date.now() - time) >= PENDING_FOLLOWUP_SLA_HOURS * 36e5
        }).length
        const hasConversation = Array.isArray(lead.conversation_messages) && lead.conversation_messages.length > 0
        const hasWhatsAppIntent = Array.isArray(lead.whatsapp_clicks) && lead.whatsapp_clicks.length > 0
        const alertOpenInsight = getSearchAlertOpenInsight(lead)
        const premiumIntentItems = getPremiumIntentItems(lead.behavior_summary)
        const premiumIntentCount = Number(lead.behavior_summary?.premium_intent_count || 0)
        const isHot = score >= 75 || /quente|hot|alta/i.test(String(lead.behavior_summary?.intent_temperature || lead.lead_classification || ''))
        const level: LeadExecutiveBrief['level'] = (
            premiumIntentCount > 0 || staleSentCount > 0 || stalePendingCount > 0 || (isHot && !lead.broker_id) || (alertOpenInsight && !hasConversation)
                ? 'high'
                : isHot || Boolean(alertOpenInsight) || pendingFollowups.length > 0 || sentFollowups.length > 0
                    ? 'medium'
                    : 'low'
        )

        const lastMovement = lastEvent
            ? `${lastEvent.title}${lastEventAgeHours !== null ? ` ha ${lastEventAgeHours < 48 ? `${lastEventAgeHours}h` : `${Math.floor(lastEventAgeHours / 24)}d`}` : ''}`
            : 'sem atividade recente consolidada'
        const title = level === 'high'
            ? 'Atencao comercial imediata'
            : level === 'medium'
                ? 'Lead com oportunidade ativa'
                : 'Lead em acompanhamento'
        const summary = [
            `Score ${score}/100`,
            lead.broker_name ? `corretor ${lead.broker_name}` : 'sem corretor definido',
            `ultimo movimento: ${lastMovement}`,
        ].join(' | ')

        let risk = 'Sem risco critico detectado; manter nutricao e observar novos sinais.'
        if (premiumIntentCount > 0 && !hasConversation) {
            risk = 'Lead acionou uma intencao premium, mas ainda nao existe conversa registrada.'
        } else if (!lead.broker_id && isHot) {
            risk = 'Lead quente sem corretor responsavel; risco de perder velocidade comercial.'
        } else if (alertOpenInsight && !hasConversation) {
            risk = 'Lead abriu um match de alerta salvo, mas ainda nao existe conversa registrada.'
        } else if (staleSentCount > 0) {
            risk = `${staleSentCount} abordagem(ns) enviada(s) sem resposta dentro do SLA.`
        } else if (stalePendingCount > 0) {
            risk = `${stalePendingCount} abordagem(ns) pendente(s) fora do SLA de primeiro contato.`
        } else if (!hasConversation && (hasWhatsAppIntent || pendingFollowups.length > 0)) {
            risk = 'Ha intencao comercial, mas nenhuma conversa registrada ainda.'
        }

        let nextAction = lead.behavior_summary?.next_best_action || 'Acompanhar atividade e atualizar status quando houver novo contato.'
        if (premiumIntentItems.length > 0) {
            nextAction = lead.behavior_summary?.next_best_action || 'Responder a intencao premium com abordagem reservada e proximo passo objetivo.'
        } else if (latestFollowup && getFollowUpStatus(latestFollowup) === 'pending') {
            nextAction = 'Enviar a abordagem pronta pelo WhatsApp e registrar como enviada.'
        } else if (alertOpenInsight && !latestFollowup) {
            nextAction = 'Abrir conversa consultiva usando o imovel que o lead acabou de ver pelo alerta.'
        } else if (sentFollowups.length > 0 && staleSentCount > 0) {
            nextAction = 'Reativar a conversa e marcar o follow-up como respondido quando houver retorno.'
        } else if (!lead.broker_id) {
            nextAction = 'Definir corretor responsavel antes de avançar a tratativa.'
        } else if (convertedFollowups.length > 0) {
            nextAction = 'Consolidar conversao, atualizar notas do corretor e preparar proximo passo comercial.'
        }

        return {
            level,
            title,
            summary,
            risk,
            nextAction,
            facts: [
                { label: 'Timeline', value: `${timeline.length} eventos`, color: '#0f172a' },
                { label: 'Intencoes premium', value: String(premiumIntentCount), color: '#7c2d12' },
                { label: 'Alertas abertos', value: String(alertOpenInsight?.openedCount || 0), color: '#b45309' },
                { label: 'Pendentes', value: String(pendingFollowups.length), color: '#b45309' },
                { label: 'Enviadas', value: String(sentFollowups.length), color: '#047857' },
                { label: 'Conversao', value: String(convertedFollowups.length), color: '#7c3aed' },
            ],
        }
    }

    function parseExecutiveBriefSnapshot(value: any): LeadExecutiveBriefHistoryItem | null {
        const stored = asPlainRecord(value)
        const level = String(stored.level || '')
        const title = String(stored.title || '').trim()
        const summary = String(stored.summary || '').trim()
        const risk = String(stored.risk || '').trim()
        const nextAction = String(stored.next_action || stored.nextAction || '').trim()

        if (!['high', 'medium', 'low'].includes(level) || !title || !summary || !risk || !nextAction) {
            return null
        }

        const facts = Array.isArray(stored.facts)
            ? stored.facts.map((item: any) => ({
                label: String(item?.label || '').trim(),
                value: String(item?.value || '').trim(),
                color: String(item?.color || '#0f172a').trim() || '#0f172a',
            })).filter((item: any) => item.label && item.value)
            : []

        const signals = asPlainRecord(stored.signals)

        return {
            level: level as LeadExecutiveBrief['level'],
            title,
            summary,
            risk,
            nextAction,
            facts,
            generatedAt: String(stored.generated_at || ''),
            source: String(stored.source || ''),
            actorLabel: String(stored.actor_name || stored.actor_email || stored.actor_type || '').trim(),
            isAiNarrative: Boolean(signals.ai_narrative_generated) || String(stored.source || '').includes('ai_narrative'),
        }
    }

    function getStoredExecutiveBrief(lead: LeadData): LeadExecutiveBrief | null {
        return parseExecutiveBriefSnapshot(lead.crm_executive_brief)
    }

    function getExecutiveBriefHistory(lead: LeadData): LeadExecutiveBriefHistoryItem[] {
        const rawHistory = Array.isArray(lead.crm_executive_brief_history)
            ? lead.crm_executive_brief_history
            : []
        const seen = new Set<string>()

        return [lead.crm_executive_brief, ...rawHistory]
            .map(item => parseExecutiveBriefSnapshot(item))
            .filter((item): item is LeadExecutiveBriefHistoryItem => Boolean(item))
            .filter(item => {
                const key = `${item.generatedAt}:${item.title}:${item.summary}`
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
            .sort((a, b) => (Date.parse(b.generatedAt || '') || 0) - (Date.parse(a.generatedAt || '') || 0))
            .slice(0, 5)
    }

    function cleanConversationContent(content: string): string {
        return String(content || '')
            .replace(/\[BOTOES_URL:[^\]]+\]/gi, '')
            .replace(/\*\*/g, '')
            .trim()
    }

    function extractConversationButtons(content: string) {
        const buttons: { label: string; url: string }[] = []
        const matches = String(content || '').matchAll(/\[BOTOES_URL:([^\]]+)\]/gi)
        for (const match of matches) {
            const parts = String(match[1] || '').split('|').map(part => part.trim()).filter(Boolean)
            for (const part of parts.slice(1)) {
                const [label, url] = part.split('=>').map(piece => piece?.trim())
                if (label && /^https?:\/\//i.test(url || '')) buttons.push({ label, url })
            }
        }
        return buttons
    }

    function renderConversationMessage(message: any, index: number) {
        const source = String(message?.source || message?.metadata?.attendance_source || '').toLowerCase()
        const role = String(message?.role || '').toLowerCase()
        const authorType = String(message?.author_type || message?.metadata?.author_type || '').toLowerCase()
        const isPendingFromMe = source === 'from_me_pending'
        const isHuman = source === 'human' || authorType === 'broker' || authorType === 'human'
        const isAssistant = role === 'assistant' || source === 'agent' || source === 'whatsapp_agent' || source === 'ai' || authorType === 'agent'
        const isLead = !isAssistant && !isHuman && !isPendingFromMe
        const text = cleanConversationContent(message?.content || message?.text || message?.body || '')
        const buttons = extractConversationButtons(message?.content || message?.text || message?.body || '')
        const messageTime = message?.timestamp
            ? new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : ''
        const speakerLabel = isHuman
            ? 'Humano'
            : isPendingFromMe
                ? 'Pendente'
                : isAssistant
                    ? (message?.metadata?.sender_name || message?.sender_name || 'Corretor IA')
                    : 'Lead'
        const speakerColor = isHuman
            ? '#047857'
            : isPendingFromMe
                ? '#8a6d3b'
                : isAssistant
                    ? '#7b5a20'
                    : '#008069'

        return (
            <div key={`${message?.message_id || message?.timestamp || index}-${index}`} style={{
                alignSelf: isLead ? 'flex-end' : 'flex-start',
                maxWidth: '74%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isLead ? 'flex-end' : 'flex-start',
                gap: 3,
            }}>
                <div style={{
                    background: isLead ? '#d9fdd3' : isPendingFromMe ? '#fff7d6' : '#fff',
                    color: '#111b21',
                    borderRadius: isLead ? '8px 0 8px 8px' : '0 8px 8px 8px',
                    padding: '8px 10px 6px',
                    fontSize: '0.83rem',
                    lineHeight: 1.42,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: '0 1px 1px rgba(11,20,26,0.13)',
                    minWidth: 82,
                }}>
                    <span style={{ display: 'block', color: speakerColor, fontSize: '0.62rem', fontWeight: 900, letterSpacing: 0, marginBottom: text ? 4 : 0, textTransform: 'uppercase' }}>
                        {speakerLabel}
                    </span>
                    {text ? <span>{text}</span> : <span style={{ color: '#667781' }}>[mensagem sem texto]</span>}
                    {buttons.length > 0 && (
                        <div style={{
                            borderTop: text ? '1px solid rgba(0,0,0,0.08)' : 'none',
                            display: 'grid',
                            gap: 4,
                            marginTop: text ? 8 : 0,
                            paddingTop: text ? 6 : 0,
                        }}>
                            {buttons.map((button, buttonIndex) => (
                                <button
                                    key={`${button.label}-${buttonIndex}`}
                                    type="button"
                                    onClick={() => window.open(button.url, '_blank')}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#008069',
                                        cursor: 'pointer',
                                        fontSize: '0.78rem',
                                        fontWeight: 800,
                                        padding: '6px 8px',
                                        textAlign: 'center',
                                    }}
                                >
                                    Abrir {button.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <span style={{ display: 'block', marginTop: 4, color: '#667781', fontSize: '0.66rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {messageTime}{isLead ? ' ✓✓' : ''}
                    </span>
                </div>
            </div>
        )
    }

    // Stats
    const stats = {
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        qualifying: leads.filter(l => l.status === 'qualifying').length,
        qualified: leads.filter(l => l.status === 'qualified').length,
        transferred: leads.filter(l => l.status === 'transferred').length,
        alertOpenLeads: leads.filter(lead => Boolean(getSearchAlertOpenInsight(lead))).length,
        premiumIntentLeads: leads.filter(lead => Number(lead.behavior_summary?.premium_intent_count || 0) > 0).length,
        privateVisitRequests: leads.reduce((sum, lead) => sum + Number(lead.behavior_summary?.private_visit_request_count || 0), 0),
        availabilityRequests: leads.reduce((sum, lead) => sum + Number(lead.behavior_summary?.availability_request_count || 0), 0),
        reservedNegotiationRequests: leads.reduce((sum, lead) => sum + Number(lead.behavior_summary?.reserved_negotiation_request_count || 0), 0),
        favoriteLeads: leads.filter(lead => Array.isArray(lead.behavior_summary?.liked_property_ids) && lead.behavior_summary.liked_property_ids.length > 0).length,
        revisitLeads: leads.filter(lead => Number(lead.behavior_summary?.continuation_count || 0) > 0 || Number(lead.behavior_summary?.street_view_count || 0) > 0).length,
    }
    const alertOpenInsights = leads
        .map(lead => getSearchAlertOpenInsight(lead))
        .filter((item): item is Exclude<ReturnType<typeof getSearchAlertOpenInsight>, null> => Boolean(item))
    const alertOpenEventsCount = alertOpenInsights.reduce((sum, item) => sum + item.openedCount, 0)
    const recentAlertOpenCount = alertOpenInsights.filter(item => {
        const openedTime = Date.parse(item.openedAt || item.lead.updated_at || item.lead.created_at || '')
        return Number.isFinite(openedTime) && Date.now() - openedTime <= 48 * 36e5
    }).length
    const alertOpenRadar = [...alertOpenInsights]
        .sort((a, b) => {
            const aStatus = a.latestFollowup ? getFollowUpStatus(a.latestFollowup) : ''
            const bStatus = b.latestFollowup ? getFollowUpStatus(b.latestFollowup) : ''
            const aPending = aStatus === 'pending' ? 1 : 0
            const bPending = bStatus === 'pending' ? 1 : 0
            const aTime = Date.parse(a.openedAt || a.lead.updated_at || a.lead.created_at || '')
            const bTime = Date.parse(b.openedAt || b.lead.updated_at || b.lead.created_at || '')
            return bPending - aPending || (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0) || b.matchScore - a.matchScore
        })
        .slice(0, 5)
    const followUpTasks = leads.flatMap(lead => getSearchAlertFollowups(lead).map((followup: any) => ({
        lead,
        followup,
        key: getFollowUpUiKey(lead, followup),
        actionKey: getFollowUpActionKey(followup),
        status: getFollowUpStatus(followup),
    })))
    const followUpStats = {
        pending: followUpTasks.filter(task => task.status === 'pending').length,
        sent: followUpTasks.filter(task => task.status === 'sent').length,
        responded: followUpTasks.filter(task => task.status === 'responded').length,
        converted: followUpTasks.filter(task => task.status === 'converted').length,
        dismissed: followUpTasks.filter(task => task.status === 'dismissed').length,
    }
    const activeFollowUpTasks = followUpTasks
        .filter(task => task.status !== 'converted' && task.status !== 'dismissed')
        .slice(0, 6)
    const percent = (value: number, total: number) => total > 0 ? Math.round((value / total) * 100) : 0
    const overallFollowUpPerformance = {
        responseRate: percent(followUpStats.responded + followUpStats.converted, followUpStats.sent + followUpStats.responded + followUpStats.converted),
        conversionRate: percent(followUpStats.converted, followUpTasks.length - followUpStats.dismissed),
    }
    const brokerPerformanceMap = new Map<string, {
        id: string
        name: string
        canFilter: boolean
        total: number
        pending: number
        sent: number
        responded: number
        converted: number
        dismissed: number
        scoreSum: number
        lastActionAt: string
    }>()

    followUpTasks.forEach(task => {
        const brokerId = task.lead.broker_id || ''
        const brokerName = task.lead.broker_name || (brokerId ? 'Corretor atribuido' : 'Sem corretor definido')
        const brokerKey = brokerId || brokerName
        const current = brokerPerformanceMap.get(brokerKey) || {
            id: brokerId || brokerKey,
            name: brokerName,
            canFilter: Boolean(brokerId),
            total: 0,
            pending: 0,
            sent: 0,
            responded: 0,
            converted: 0,
            dismissed: 0,
            scoreSum: 0,
            lastActionAt: '',
        }
        const status = ['pending', 'sent', 'responded', 'converted', 'dismissed'].includes(task.status) ? task.status : 'pending'
        current.total += 1
        current[status as 'pending' | 'sent' | 'responded' | 'converted' | 'dismissed'] += 1

        const rawScore = Number(task.followup.match_score ?? task.lead.lead_score ?? task.lead.qualification_score ?? 0)
        current.scoreSum += Number.isFinite(rawScore) ? rawScore : 0

        const lastActionAt = getFollowUpStatusTimestamp(task.followup) || task.followup.occurred_at || task.lead.updated_at || task.lead.created_at || ''
        const currentTime = current.lastActionAt ? Date.parse(current.lastActionAt) : 0
        const nextTime = lastActionAt ? Date.parse(lastActionAt) : 0
        if (nextTime && nextTime > currentTime) current.lastActionAt = lastActionAt

        brokerPerformanceMap.set(brokerKey, current)
    })

    const allBrokerPerformance = Array.from(brokerPerformanceMap.values())
        .map(metric => {
            const contacted = metric.sent + metric.responded + metric.converted
            const actionable = metric.total - metric.dismissed
            return {
                ...metric,
                active: metric.pending + metric.sent + metric.responded,
                avgScore: metric.total > 0 ? Math.round(metric.scoreSum / metric.total) : 0,
                responseRate: percent(metric.responded + metric.converted, contacted),
                conversionRate: percent(metric.converted, actionable),
            }
        })
        .sort((a, b) => b.converted - a.converted || b.responseRate - a.responseRate || b.total - a.total)

    const brokerPerformance = allBrokerPerformance.slice(0, 6)
    const actionTaskAgeHours = (task: typeof followUpTasks[number]) => {
        const referenceDate = getFollowUpStatusTimestamp(task.followup) || task.followup.occurred_at || task.lead.updated_at || task.lead.created_at || ''
        const referenceTime = Date.parse(referenceDate)
        if (!Number.isFinite(referenceTime)) return 0
        return Math.max(0, Math.floor((Date.now() - referenceTime) / 36e5))
    }
    const formatActionAge = (hours: number) => hours >= 48 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h`
    const actionableFollowUpTasks = followUpTasks
        .filter(task => task.status !== 'converted' && task.status !== 'dismissed')
        .map(task => ({
            ...task,
            ageHours: actionTaskAgeHours(task),
            brokerName: task.lead.broker_name || 'Sem corretor',
        }))
        .sort((a, b) => b.ageHours - a.ageHours)
    const alertOpenedNoContactTasks = actionableFollowUpTasks.filter(task => (
        task.status === 'pending' && Boolean(getSearchAlertOpenInsight(task.lead))
    ))
    const alertOpenedNoContactTaskKeys = new Set(alertOpenedNoContactTasks.map(task => task.key))
    const stalePendingTasks = actionableFollowUpTasks.filter(task => (
        task.status === 'pending'
        && task.ageHours >= PENDING_FOLLOWUP_SLA_HOURS
        && !alertOpenedNoContactTaskKeys.has(task.key)
    ))
    const staleSentTasks = actionableFollowUpTasks.filter(task => task.status === 'sent' && task.ageHours >= SENT_FOLLOWUP_SLA_HOURS)
    const unassignedFollowUpTasks = actionableFollowUpTasks.filter(task => !task.lead.broker_id)
    const strongestBroker = allBrokerPerformance
        .filter(metric => metric.canFilter)
        .sort((a, b) => b.conversionRate - a.conversionRate || b.responseRate - a.responseRate || a.active - b.active)[0]
    const overloadedBrokerIds = new Set(allBrokerPerformance
        .filter(metric => metric.canFilter && metric.active >= 3 && metric.responseRate < overallFollowUpPerformance.responseRate && metric.id !== strongestBroker?.id)
        .map(metric => metric.id))
    const redistributionTasks = actionableFollowUpTasks.filter(task => Boolean(task.lead.broker_id && overloadedBrokerIds.has(task.lead.broker_id)))
    const respondedFollowUpTasks = actionableFollowUpTasks.filter(task => task.status === 'responded')
    const dailyExecutionPlanCandidates = [
        ...staleSentTasks.map(task => ({
            key: `stale-sent:${task.key}`,
            task,
            title: 'Cobrar retorno',
            action: 'Reativar conversa e atualizar status quando o lead responder.',
            deadline: 'Agora',
            group: 'SLA',
            color: '#2563eb',
            bg: '#eff6ff',
            icon: Clock,
            priorityScore: 90000 + task.ageHours,
        })),
        ...stalePendingTasks.map(task => ({
            key: `stale-pending:${task.key}`,
            task,
            title: 'Enviar primeira abordagem',
            action: 'Enviar mensagem consultiva e marcar como enviada no CRM.',
            deadline: 'Agora',
            group: 'SLA',
            color: '#b45309',
            bg: '#fffbeb',
            icon: AlertTriangle,
            priorityScore: 85000 + task.ageHours,
        })),
        ...alertOpenedNoContactTasks.map(task => ({
            key: `alert-opened:${task.key}`,
            task,
            title: 'Aproveitar interesse quente',
            action: 'Abrir conversa sobre o imovel visualizado no alerta.',
            deadline: 'Hoje',
            group: 'Interesse',
            color: '#b45309',
            bg: '#fffbeb',
            icon: BellRing,
            priorityScore: 76000 + task.ageHours,
        })),
        ...unassignedFollowUpTasks.map(task => ({
            key: `unassigned:${task.key}`,
            task,
            title: 'Definir responsavel',
            action: strongestBroker ? `Direcionar para ${strongestBroker.name} ou escolher corretor disponivel.` : 'Escolher corretor responsavel antes do proximo contato.',
            deadline: 'Hoje',
            group: 'Distribuicao',
            color: '#047857',
            bg: '#ecfdf5',
            icon: Zap,
            priorityScore: 64000 + task.ageHours,
        })),
        ...respondedFollowUpTasks.map(task => ({
            key: `responded:${task.key}`,
            task,
            title: 'Converter resposta em proximo passo',
            action: 'Registrar proximo passo comercial, visita ou proposta.',
            deadline: '24h',
            group: 'Conversao',
            color: '#7c3aed',
            bg: '#f5f3ff',
            icon: Trophy,
            priorityScore: 52000 + task.ageHours,
        })),
    ]
    const dailyExecutionPlanSeen = new Set<string>()
    const dailyExecutionPlan = dailyExecutionPlanCandidates
        .filter(item => {
            if (dailyExecutionPlanSeen.has(item.task.key)) return false
            dailyExecutionPlanSeen.add(item.task.key)
            return true
        })
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, 6)
    const dailyExecutionPlanUniqueCount = new Set(dailyExecutionPlanCandidates.map(item => item.task.key)).size
    const dailyExecutionPlanTotals = {
        total: dailyExecutionPlanUniqueCount,
        sla: stalePendingTasks.length + staleSentTasks.length,
        hot: alertOpenedNoContactTasks.length,
        unassigned: unassignedFollowUpTasks.length,
        conversion: respondedFollowUpTasks.length,
    }
    const dailyExecutionPlanKey = 'daily-execution-plan'
    const dailyExecutionPlanBriefing = [
        'Roteiro diario IA - CRM de Leads',
        `Prioridades detectadas: ${dailyExecutionPlanTotals.total}`,
        `SLA: ${dailyExecutionPlanTotals.sla} | interesse quente: ${dailyExecutionPlanTotals.hot} | sem responsavel: ${dailyExecutionPlanTotals.unassigned} | conversao: ${dailyExecutionPlanTotals.conversion}`,
        ...dailyExecutionPlan.map((item, index) => {
            const contact = formatPhone(item.task.lead.lead_phone) || item.task.lead.lead_email || 'sem contato'
            const broker = item.task.lead.broker_name || (item.task.lead.broker_id ? 'Corretor atribuido' : 'Sem corretor')
            const context = item.task.followup.property_title || item.task.followup.title || 'Match de alerta salvo'
            const statusLabel = FOLLOWUP_STATUS_CONFIG[item.task.status]?.label || 'Pendente'

            return [
                `${index + 1}. ${item.title} | ${item.deadline}`,
                `Lead: ${item.task.lead.lead_name || 'Lead sem nome'} | ${contact}`,
                `Responsavel: ${broker}`,
                `Status: ${statusLabel}${item.task.ageHours > 0 ? ` ha ${formatActionAge(item.task.ageHours)}` : ''}`,
                `Contexto: ${context}`,
                `Acao: ${item.action}`,
            ].join('\n')
        }),
    ].join('\n\n')
    const actionRecommendations = [
        {
            key: 'alert-opened-no-contact',
            title: 'Alertas abertos sem contato',
            description: 'Lead abriu um match salvo e ainda precisa de abordagem consultiva.',
            count: alertOpenedNoContactTasks.length,
            color: '#b45309',
            bg: '#fffbeb',
            icon: BellRing,
            tasks: alertOpenedNoContactTasks.slice(0, 3),
            action: 'Abrir conversa consultiva',
        },
        {
            key: 'stale-pending',
            title: 'Pendentes fora do SLA',
            description: `Sem envio ha mais de ${PENDING_FOLLOWUP_SLA_HOURS}h.`,
            count: stalePendingTasks.length,
            color: '#b45309',
            bg: '#fffbeb',
            icon: AlertTriangle,
            tasks: stalePendingTasks.slice(0, 3),
            action: 'Enviar abordagem',
        },
        {
            key: 'stale-sent',
            title: 'Enviadas sem resposta',
            description: `Sem retorno ha mais de ${SENT_FOLLOWUP_SLA_HOURS}h.`,
            count: staleSentTasks.length,
            color: '#2563eb',
            bg: '#eff6ff',
            icon: Clock,
            tasks: staleSentTasks.slice(0, 3),
            action: 'Reativar conversa',
        },
        {
            key: 'unassigned',
            title: 'Leads sem corretor',
            description: strongestBroker ? `Sugerir para ${strongestBroker.name}.` : 'Aguardando corretor disponivel.',
            count: unassignedFollowUpTasks.length,
            color: '#047857',
            bg: '#ecfdf5',
            icon: Zap,
            tasks: unassignedFollowUpTasks.slice(0, 3),
            action: 'Distribuir lead',
        },
        {
            key: 'redistribution',
            title: 'Redistribuicao sugerida',
            description: strongestBroker ? `Mover gargalos para ${strongestBroker.name}.` : 'Comparar carga por corretor.',
            count: redistributionTasks.length,
            color: '#7c3aed',
            bg: '#f5f3ff',
            icon: ArrowRightLeft,
            tasks: redistributionTasks.slice(0, 3),
            action: 'Rebalancear fila',
        },
    ].filter(item => item.count > 0)
    const persistedActionSnapshots = leads
        .map(lead => lead.crm_action_recommendations)
        .filter(snapshot => snapshot && typeof snapshot === 'object')
    const persistedRecommendationTasks = leads.flatMap(lead => {
        const items = Array.isArray(lead.crm_action_recommendations?.items)
            ? lead.crm_action_recommendations.items
            : []
        return items.map((item: any) => ({
            lead,
            item,
            key: `${lead.id}:${item?.id || item?.followup_key || 'recommendation'}`,
            applied: isRecommendationResolved(item),
        }))
    })
    const activePersistedRecommendationTasks = persistedRecommendationTasks.filter(task => !task.applied)
    const actionablePersistedRecommendationTasks = activePersistedRecommendationTasks
        .filter(task => ['unassigned', 'redistribution'].includes(String(task.item?.type || '')) && Boolean(task.item?.suggested_broker_id))
        .slice(0, 4)
    const consultativePersistedRecommendationTasks = activePersistedRecommendationTasks
        .filter(task => ['alert_opened_no_contact', 'stale_pending', 'stale_sent'].includes(String(task.item?.type || '')) || isPremiumRecommendationType(String(task.item?.type || '')) || isBehaviorSignalRecommendationType(String(task.item?.type || '')))
        .filter(task => isConsultativeRecommendationActive(task.lead, task.item))
        .slice(0, 4)
    const persistedActionItemsCount = activePersistedRecommendationTasks.length
    const latestPersistedActionRunAt = persistedActionSnapshots
        .map((snapshot: any) => String(snapshot.generated_at || ''))
        .filter(Boolean)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || ''
    const appliedRecommendationActionAuditItems = leads.flatMap(lead => {
        const actions = asPlainRecord(lead.crm_action_recommendation_actions)
        const snapshotItems = Array.isArray(lead.crm_action_recommendations?.items)
            ? lead.crm_action_recommendations.items
            : []

        return Object.entries(actions).map(([actionKey, rawAction]) => {
            const action = asPlainRecord(rawAction)
            const matchedItem = snapshotItems.find((item: any) => {
                const record = asPlainRecord(item)
                return String(record.id || '') === String(action.recommendation_id || actionKey)
                    || String(record.followup_key || '') === String(action.followup_key || actionKey)
            }) || {}
            const item = asPlainRecord(matchedItem)
            const type = String(action.recommendation_type || item.type || '')
            const appliedAt = String(action.applied_at || item.applied_at || '')
            const targetBrokerId = String(action.target_broker_id || item.target_broker_id || item.suggested_broker_id || '')
            const targetBrokerName = String(action.target_broker_name || item.target_broker_name || item.suggested_broker_name || '')

            return {
                key: `${lead.id}:${actionKey}`,
                lead,
                type,
                appliedAt,
                auditStatus: 'applied',
                label: getRecommendationTypeLabel(type),
                title: String(action.recommendation_title || item.title || getRecommendationTypeLabel(type)),
                reason: String(action.recommendation_reason || item.reason || ''),
                sourceBrokerId: String(action.source_broker_id || item.broker_id || ''),
                sourceBrokerName: String(action.source_broker_name || item.broker_name || ''),
                targetBrokerId,
                targetBrokerName: targetBrokerName || lead.broker_name || 'Acompanhamento consultivo',
                profileId: String(action.profile_id || item.profile_id || ''),
                propertyTitle: String(action.property_title || item.property_title || item.alert_title || ''),
                actorLabel: getActionActorLabel(action) || getActionActorLabel(item),
                canMeasureBrokerImpact: Boolean(targetBrokerId),
                source: String(action.source || 'crm'),
            }
        })
    })
        .filter(item => item.appliedAt)

    const resolvedRecommendationSnapshotAuditItems = persistedRecommendationTasks
        .filter(task => {
            const item = asPlainRecord(task.item)
            const type = String(item.type || '')
            return Boolean(item.resolved_at)
                && (['alert_opened_no_contact', 'stale_pending', 'stale_sent'].includes(type) || isPremiumRecommendationType(type) || isBehaviorSignalRecommendationType(type))
        })
        .map(task => {
            const item = asPlainRecord(task.item)
            const type = String(item.type || '')
            const resolvedAt = String(item.resolved_at || '')
            const followup = getRecommendationFollowup(task.lead, item)
            const targetBrokerId = String(item.broker_id || task.lead.broker_id || '')
            const targetBrokerName = String(item.broker_name || task.lead.broker_name || '')

            return {
                key: `${task.key}:resolved`,
                lead: task.lead,
                type,
                appliedAt: resolvedAt,
                auditStatus: String(item.resolved_status || followup?.action_status || 'resolved'),
                label: getRecommendationTypeLabel(type),
                title: String(item.title || getRecommendationTypeLabel(type)),
                reason: String(item.reason || ''),
                sourceBrokerId: '',
                sourceBrokerName: '',
                targetBrokerId,
                targetBrokerName: targetBrokerName || 'Acompanhamento consultivo',
                profileId: '',
                propertyTitle: String(item.property_title || item.alert_title || followup?.property_title || ''),
                actorLabel: getActionActorLabel(item) || (followup ? getActionActorLabel(followup) : ''),
                canMeasureBrokerImpact: Boolean(targetBrokerId),
                source: String(item.resolved_reason || 'followup_status_updated'),
            }
        })

    const allAppliedRecommendationAuditItems = [
        ...appliedRecommendationActionAuditItems,
        ...resolvedRecommendationSnapshotAuditItems,
    ]
        .sort((a, b) => Date.parse(b.appliedAt) - Date.parse(a.appliedAt))
    const auditBrokerOptions = Array.from(allAppliedRecommendationAuditItems.reduce((map, item) => {
        const key = item.targetBrokerId || item.targetBrokerName
        if (key && !map.has(key)) map.set(key, {
            id: key,
            name: item.targetBrokerName,
            count: 0,
        })
        if (key) {
            const current = map.get(key)
            if (current) current.count += 1
        }
        return map
    }, new Map<string, { id: string; name: string; count: number }>()).values())
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    const auditTypeOptions = [
        'alert_opened_no_contact',
        'unassigned',
        'redistribution',
        'stale_pending',
        'stale_sent',
        'premium_intent_no_contact',
        'private_visit_pending',
        'availability_pending',
        'reserved_negotiation_pending',
        'value_reading_pending',
        'favorite_property_pending',
        'revisited_property_pending',
        'street_view_pending',
        'price_history_pending',
    ]
        .map(type => ({
            type,
            label: getRecommendationTypeLabel(type),
            count: allAppliedRecommendationAuditItems.filter(item => item.type === type).length,
        }))
        .filter(item => item.count > 0)
    const filteredAppliedRecommendationAuditItems = allAppliedRecommendationAuditItems.filter(item => {
        if (auditBrokerFilter !== 'all' && (item.targetBrokerId || item.targetBrokerName) !== auditBrokerFilter) return false
        if (auditTypeFilter !== 'all' && item.type !== auditTypeFilter) return false
        if (auditPeriodFilter !== 'all') {
            const days = auditPeriodFilter === '7d' ? 7 : 30
            const appliedTime = Date.parse(item.appliedAt)
            if (!Number.isFinite(appliedTime)) return false
            if ((Date.now() - appliedTime) > days * 24 * 60 * 60 * 1000) return false
        }
        return true
    })
    const appliedRecommendationAuditItems = filteredAppliedRecommendationAuditItems.slice(0, 8)
    const appliedRecommendationCount = allAppliedRecommendationAuditItems.length
    const latestAppliedRecommendationAt = allAppliedRecommendationAuditItems[0]?.appliedAt || ''
    const appliedDistributionCount = allAppliedRecommendationAuditItems.filter(item => item.type === 'unassigned').length
    const appliedRedistributionCount = allAppliedRecommendationAuditItems.filter(item => item.type === 'redistribution').length
    const resolvedConsultativeRecommendationCount = allAppliedRecommendationAuditItems.filter(item => ['alert_opened_no_contact', 'stale_pending', 'stale_sent'].includes(item.type) || isPremiumRecommendationType(item.type) || isBehaviorSignalRecommendationType(item.type)).length
    const auditFiltersActive = auditBrokerFilter !== 'all' || auditTypeFilter !== 'all' || auditPeriodFilter !== 'all'
    const auditBrokerFilterLabel = auditBrokerFilter === 'all'
        ? 'Todos os destinos'
        : auditBrokerOptions.find(option => option.id === auditBrokerFilter)?.name || auditBrokerFilter
    const auditTypeFilterLabel = auditTypeFilter === 'all'
        ? 'Todos os tipos'
        : auditTypeOptions.find(option => option.type === auditTypeFilter)?.label || getRecommendationTypeLabel(auditTypeFilter)
    const auditPeriodFilterLabel = auditPeriodFilter === '7d'
        ? 'Ultimos 7 dias'
        : auditPeriodFilter === '30d'
            ? 'Ultimos 30 dias'
            : 'Todo o historico'
    const auditTrailReportKey = 'ai-audit-trail-report'
    const auditTrailReportItems = filteredAppliedRecommendationAuditItems.slice(0, 12)
    const auditTrailReportBriefing = [
        'Trilha de auditoria IA - CRM de Leads',
        `Filtros: ${auditBrokerFilterLabel} | ${auditTypeFilterLabel} | ${auditPeriodFilterLabel}`,
        `Registradas: ${appliedRecommendationCount} | neste filtro: ${filteredAppliedRecommendationAuditItems.length}`,
        `Distribuicoes: ${appliedDistributionCount} | rebalanceamentos: ${appliedRedistributionCount} | consultivas: ${resolvedConsultativeRecommendationCount}`,
        latestAppliedRecommendationAt ? `Ultima acao registrada: ${formatDate(latestAppliedRecommendationAt)}` : '',
        ...auditTrailReportItems.map((item, index) => {
            const auditStatusLabel = item.auditStatus === 'applied'
                ? 'Aplicada'
                : item.auditStatus === 'sent'
                    ? 'Enviada'
                    : item.auditStatus === 'responded'
                        ? 'Respondida'
                        : item.auditStatus === 'converted'
                            ? 'Convertida'
                            : item.auditStatus === 'dismissed'
                                ? 'Descartada'
                                : 'Resolvida'

            return [
                `${index + 1}. ${item.label} | ${auditStatusLabel}`,
                `Lead: ${item.lead.lead_name || 'Lead sem nome'}`,
                `Titulo: ${item.title}`,
                `Destino: ${item.targetBrokerName}`,
                item.sourceBrokerName ? `Origem: ${item.sourceBrokerName}` : '',
                `Contexto: ${item.propertyTitle || item.reason || 'Recomendacao registrada'}`,
                `Data: ${formatDate(item.appliedAt)}${item.actorLabel ? ` | por ${item.actorLabel}` : ''}`,
            ].filter(Boolean).join('\n')
        }),
        filteredAppliedRecommendationAuditItems.length > auditTrailReportItems.length
            ? `Mais ${filteredAppliedRecommendationAuditItems.length - auditTrailReportItems.length} acao(oes) neste filtro.`
            : '',
    ].filter(Boolean).join('\n\n')
    const brokerImpactMetrics = auditBrokerOptions
        .filter(option => allAppliedRecommendationAuditItems.some(item => item.canMeasureBrokerImpact && (item.targetBrokerId || item.targetBrokerName) === option.id))
        .map(option => {
        const brokerActions = allAppliedRecommendationAuditItems.filter(item => item.canMeasureBrokerImpact && (item.targetBrokerId || item.targetBrokerName) === option.id)
        const impactedLeadIds = new Set(brokerActions.flatMap(item => [
            item.lead.id,
            item.lead.lead_id || '',
        ]).filter(Boolean))
        const impactedFollowUps = followUpTasks.filter(task => impactedLeadIds.has(task.lead.id) || (task.lead.lead_id ? impactedLeadIds.has(task.lead.lead_id) : false))
        const impactedStatuses = {
            pending: impactedFollowUps.filter(task => task.status === 'pending').length,
            sent: impactedFollowUps.filter(task => task.status === 'sent').length,
            responded: impactedFollowUps.filter(task => task.status === 'responded').length,
            converted: impactedFollowUps.filter(task => task.status === 'converted').length,
            dismissed: impactedFollowUps.filter(task => task.status === 'dismissed').length,
        }
        const contacted = impactedStatuses.sent + impactedStatuses.responded + impactedStatuses.converted
        const actionable = impactedFollowUps.length - impactedStatuses.dismissed
        const needsAttention = impactedFollowUps.filter(task => {
            const ageHours = actionTaskAgeHours(task)
            if (task.status === 'pending') return ageHours >= PENDING_FOLLOWUP_SLA_HOURS
            if (task.status === 'sent') return ageHours >= SENT_FOLLOWUP_SLA_HOURS
            return false
        }).length
        const latestActionAt = brokerActions
            .map(item => item.appliedAt)
            .filter(Boolean)
            .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || ''

        return {
            id: option.id,
            name: option.name,
            actions: brokerActions.length,
            leads: impactedLeadIds.size,
            distributions: brokerActions.filter(item => item.type === 'unassigned').length,
            redistributions: brokerActions.filter(item => item.type === 'redistribution').length,
            followups: impactedFollowUps.length,
            responded: impactedStatuses.responded + impactedStatuses.converted,
            converted: impactedStatuses.converted,
            pending: impactedStatuses.pending,
            sent: impactedStatuses.sent,
            responseRate: percent(impactedStatuses.responded + impactedStatuses.converted, contacted),
            conversionRate: percent(impactedStatuses.converted, actionable),
            needsAttention,
            latestActionAt,
        }
    })
        .sort((a, b) => b.actions - a.actions || b.converted - a.converted || b.responseRate - a.responseRate)
        .slice(0, 6)
    const brokerImpactTotals = {
        brokers: brokerImpactMetrics.length,
        leads: brokerImpactMetrics.reduce((total, item) => total + item.leads, 0),
        attention: brokerImpactMetrics.reduce((total, item) => total + item.needsAttention, 0),
        conversions: brokerImpactMetrics.reduce((total, item) => total + item.converted, 0),
    }
    const brokerImpactReportKey = 'broker-impact-report'
    const brokerImpactReportBriefing = [
        'Relatorio de impacto IA por corretor',
        `Corretores impactados: ${brokerImpactTotals.brokers}`,
        `Leads destinados: ${brokerImpactTotals.leads}`,
        `Atencao pendente: ${brokerImpactTotals.attention}`,
        `Conversoes registradas: ${brokerImpactTotals.conversions}`,
        ...brokerImpactMetrics.map((metric, index) => [
            `${index + 1}. ${metric.name}`,
            `Acoes IA: ${metric.actions} | leads: ${metric.leads} | follow-ups: ${metric.followups}`,
            `Distribuicoes: ${metric.distributions} | redistribuicoes: ${metric.redistributions}`,
            `Resposta: ${metric.responseRate}% | conversao: ${metric.conversionRate}%`,
            `Fila: ${metric.pending} pendente(s) | ${metric.sent} enviada(s) | ${metric.needsAttention} em atencao`,
            metric.latestActionAt ? `Ultima acao IA: ${formatDate(metric.latestActionAt)}` : '',
        ].filter(Boolean).join('\n')),
    ].join('\n\n')
    const aiOperationalAlertCandidates = allAppliedRecommendationAuditItems.flatMap(action => {
        const actionLeadIds = new Set([action.lead.id, action.lead.lead_id || ''].filter(Boolean))
        const leadFollowUps = followUpTasks.filter(task => actionLeadIds.has(task.lead.id) || (task.lead.lead_id ? actionLeadIds.has(task.lead.lead_id) : false))

        return leadFollowUps.map(task => {
            const ageHours = actionTaskAgeHours(task)
            const slaHours = task.status === 'pending'
                ? PENDING_FOLLOWUP_SLA_HOURS
                : task.status === 'sent'
                    ? SENT_FOLLOWUP_SLA_HOURS
                    : 0

            if (!slaHours || ageHours < slaHours) return null

            const overdueHours = Math.max(0, ageHours - slaHours)
            const priorityScore = task.status === 'sent' || overdueHours >= 24 ? 2 : 1

            return {
                key: `${action.targetBrokerId || action.targetBrokerName}:${task.lead.id}:${task.actionKey}:${task.status}`,
                followUpKey: task.key,
                lead: task.lead,
                followup: task.followup,
                status: task.status,
                statusLabel: FOLLOWUP_STATUS_CONFIG[task.status]?.label || 'Pendente',
                brokerName: action.targetBrokerName || task.lead.broker_name || 'Corretor indicado',
                recommendationLabel: action.label,
                recommendationTitle: action.title,
                propertyTitle: task.followup.property_title || task.followup.title || action.propertyTitle || 'Abordagem de alerta salvo',
                ageHours,
                slaHours,
                overdueHours,
                priority: priorityScore === 2 ? 'Alta' : 'Media',
                priorityScore,
                appliedAt: action.appliedAt,
                appliedActorLabel: action.actorLabel,
            }
        }).filter(Boolean)
    })
    const aiOperationalAlertMap = new Map<string, NonNullable<typeof aiOperationalAlertCandidates[number]>>()
    aiOperationalAlertCandidates.forEach(alert => {
        if (!alert) return
        const current = aiOperationalAlertMap.get(alert.key)
        if (!current || Date.parse(alert.appliedAt) > Date.parse(current.appliedAt)) {
            aiOperationalAlertMap.set(alert.key, alert)
        }
    })
    const aiOperationalAlerts = Array.from(aiOperationalAlertMap.values())
        .sort((a, b) => b.priorityScore - a.priorityScore || b.overdueHours - a.overdueHours || b.ageHours - a.ageHours)
        .slice(0, 8)
    const aiOperationalAlertTotals = {
        total: aiOperationalAlertMap.size,
        high: Array.from(aiOperationalAlertMap.values()).filter(item => item.priorityScore === 2).length,
        pending: Array.from(aiOperationalAlertMap.values()).filter(item => item.status === 'pending').length,
        sent: Array.from(aiOperationalAlertMap.values()).filter(item => item.status === 'sent').length,
    }
    const aiOperationalAlertBriefingKey = 'ai-operational-alert-briefing'
    const aiOperationalAlertBriefing = [
        'Cobranca operacional IA - alertas de SLA',
        `Total em atraso: ${aiOperationalAlertTotals.total}`,
        `Criticos: ${aiOperationalAlertTotals.high} | pendentes: ${aiOperationalAlertTotals.pending} | sem resposta: ${aiOperationalAlertTotals.sent}`,
        ...aiOperationalAlerts.map((alert, index) => {
            const actorLabel = getActionActorLabel(alert.followup) || alert.appliedActorLabel || alert.brokerName
            const contact = formatPhone(alert.lead.lead_phone) || alert.lead.lead_email || 'sem contato'
            const action = alert.status === 'pending'
                ? 'Enviar abordagem e marcar como enviada no CRM.'
                : 'Cobrar retorno do lead e atualizar status quando responder.'

            return [
                `${index + 1}. ${alert.lead.lead_name || 'Lead sem nome'} | ${contact}`,
                `Responsavel: ${actorLabel}`,
                `Status: ${alert.statusLabel} ha ${formatActionAge(alert.ageHours)} | SLA ${alert.slaHours}h | atraso ${formatActionAge(alert.overdueHours)}`,
                `Contexto: ${alert.propertyTitle}`,
                `Cobranca: ${action}`,
            ].join('\n')
        }),
    ].join('\n\n')
    const aiExecutiveLeadIds = new Set(allAppliedRecommendationAuditItems.flatMap(item => [
        item.lead.id,
        item.lead.lead_id || '',
    ]).filter(Boolean))
    const aiExecutiveFollowUps = followUpTasks.filter(task => aiExecutiveLeadIds.has(task.lead.id) || (task.lead.lead_id ? aiExecutiveLeadIds.has(task.lead.lead_id) : false))
    const aiExecutiveStatuses = {
        pending: aiExecutiveFollowUps.filter(task => task.status === 'pending').length,
        sent: aiExecutiveFollowUps.filter(task => task.status === 'sent').length,
        responded: aiExecutiveFollowUps.filter(task => task.status === 'responded').length,
        converted: aiExecutiveFollowUps.filter(task => task.status === 'converted').length,
        dismissed: aiExecutiveFollowUps.filter(task => task.status === 'dismissed').length,
    }
    const aiExecutiveContacted = aiExecutiveStatuses.sent + aiExecutiveStatuses.responded + aiExecutiveStatuses.converted
    const aiExecutiveActionable = aiExecutiveFollowUps.length - aiExecutiveStatuses.dismissed
    const aiExecutiveSlaRisk = aiExecutiveFollowUps.filter(task => {
        const ageHours = actionTaskAgeHours(task)
        if (task.status === 'pending') return ageHours >= PENDING_FOLLOWUP_SLA_HOURS
        if (task.status === 'sent') return ageHours >= SENT_FOLLOWUP_SLA_HOURS
        return false
    }).length
    const aiExecutiveResponseRate = percent(aiExecutiveStatuses.responded + aiExecutiveStatuses.converted, aiExecutiveContacted)
    const aiExecutiveConversionRate = percent(aiExecutiveStatuses.converted, aiExecutiveActionable)
    const aiExecutiveResolutionRate = percent(aiExecutiveStatuses.sent + aiExecutiveStatuses.responded + aiExecutiveStatuses.converted, aiExecutiveActionable)
    const aiExecutiveHealth = aiExecutiveSlaRisk > 0
        ? {
            label: 'Atencao',
            color: '#b45309',
            bg: '#fffbeb',
            summary: `${aiExecutiveSlaRisk} follow-up(s) de leads tocados pela IA passaram do SLA.`,
        }
        : aiExecutiveConversionRate > 0
            ? {
                label: 'Convertendo',
                color: '#7c3aed',
                bg: '#f5f3ff',
                summary: 'Acoes IA ja aparecem conectadas a conversoes na visao atual.',
            }
            : aiExecutiveResponseRate > 0
                ? {
                    label: 'Respondendo',
                    color: '#2563eb',
                    bg: '#eff6ff',
                    summary: 'Leads tocados pela IA ja apresentam resposta registrada.',
                }
                : appliedRecommendationCount > 0
                    ? {
                        label: 'Em aquecimento',
                        color: '#047857',
                        bg: '#ecfdf5',
                        summary: 'A IA ja acionou a fila; acompanhar resposta dos leads.',
                    }
                    : {
                        label: 'Sem dados',
                        color: '#64748b',
                        bg: '#f8fafc',
                        summary: 'Nenhuma acao IA registrada na visao atual.',
                    }
    const aiExecutiveLeadDrilldown = Array.from(allAppliedRecommendationAuditItems.reduce((map, action) => {
        const leadKey = action.lead.id || action.lead.lead_id || action.key
        const current = map.get(leadKey) || {
            lead: action.lead,
            actions: 0,
            consultative: 0,
            distributions: 0,
            redistributions: 0,
            latestActionAt: '',
            latestTitle: '',
            latestPropertyTitle: '',
            latestType: '',
            latestStatus: '',
            targetLabel: '',
        }
        const actionTime = Date.parse(action.appliedAt)
        const currentTime = Date.parse(current.latestActionAt)

        current.actions += 1
        if (['alert_opened_no_contact', 'stale_pending', 'stale_sent'].includes(action.type) || isPremiumRecommendationType(action.type) || isBehaviorSignalRecommendationType(action.type)) current.consultative += 1
        if (action.type === 'unassigned') current.distributions += 1
        if (action.type === 'redistribution') current.redistributions += 1
        if (!current.latestActionAt || (Number.isFinite(actionTime) && actionTime > (Number.isFinite(currentTime) ? currentTime : 0))) {
            current.latestActionAt = action.appliedAt
            current.latestTitle = action.title
            current.latestPropertyTitle = action.propertyTitle
            current.latestType = action.type
            current.latestStatus = action.auditStatus
            current.targetLabel = action.targetBrokerName
        }

        map.set(leadKey, current)
        return map
    }, new Map<string, any>()).values())
        .map(row => {
            const leadIds = new Set([row.lead.id, row.lead.lead_id || ''].filter(Boolean))
            const followups = aiExecutiveFollowUps.filter(task => leadIds.has(task.lead.id) || (task.lead.lead_id ? leadIds.has(task.lead.lead_id) : false))
            const riskFollowups = followups.filter(task => {
                const ageHours = actionTaskAgeHours(task)
                if (task.status === 'pending') return ageHours >= PENDING_FOLLOWUP_SLA_HOURS
                if (task.status === 'sent') return ageHours >= SENT_FOLLOWUP_SLA_HOURS
                return false
            })
            const primaryFollowup = [...followups]
                .filter(task => task.status !== 'converted' && task.status !== 'dismissed')
                .sort((a, b) => {
                    const aRisk = riskFollowups.some(risk => risk.key === a.key) ? 1 : 0
                    const bRisk = riskFollowups.some(risk => risk.key === b.key) ? 1 : 0
                    return bRisk - aRisk || actionTaskAgeHours(b) - actionTaskAgeHours(a)
                })[0]
            const statuses = {
                pending: followups.filter(task => task.status === 'pending').length,
                sent: followups.filter(task => task.status === 'sent').length,
                responded: followups.filter(task => task.status === 'responded').length,
                converted: followups.filter(task => task.status === 'converted').length,
            }
            const score = Number(row.lead.lead_score || row.lead.qualification_score || 0)
            const health = riskFollowups.length > 0
                ? { label: 'SLA em risco', color: '#b45309', bg: '#fffbeb' }
                : statuses.converted > 0
                    ? { label: 'Convertido', color: '#7c3aed', bg: '#f5f3ff' }
                    : statuses.responded > 0
                        ? { label: 'Respondido', color: '#2563eb', bg: '#eff6ff' }
                        : statuses.sent > 0
                            ? { label: 'Enviado', color: '#047857', bg: '#ecfdf5' }
                            : { label: 'Aguardando', color: '#64748b', bg: '#f8fafc' }

            return {
                ...row,
                followups,
                riskFollowups,
                primaryFollowup,
                statuses,
                score: Number.isFinite(score) ? score : 0,
                health,
            }
        })
        .sort((a, b) => b.riskFollowups.length - a.riskFollowups.length || b.statuses.converted - a.statuses.converted || b.statuses.responded - a.statuses.responded || b.score - a.score)
        .slice(0, 6)
    const aiExecutiveBrokerQueue = Array.from(aiExecutiveFollowUps.reduce<Map<string, any>>((map, task) => {
        const brokerId = task.lead.broker_id || ''
        const brokerKey = brokerId || 'unassigned'
        const current = map.get(brokerKey) || {
            id: brokerId,
            key: brokerKey,
            name: task.lead.broker_name || 'Sem corretor',
            canFilter: Boolean(brokerId),
            total: 0,
            pending: 0,
            sent: 0,
            responded: 0,
            converted: 0,
            dismissed: 0,
            risk: 0,
            scoreSum: 0,
            oldestRiskHours: 0,
            topLead: null as LeadData | null,
            topFollowup: null as any,
            topStatus: '',
            topAgeHours: 0,
            topRank: -1,
        }
        const status = ['pending', 'sent', 'responded', 'converted', 'dismissed'].includes(task.status) ? task.status : 'pending'
        const ageHours = actionTaskAgeHours(task)
        const isRisk = (status === 'pending' && ageHours >= PENDING_FOLLOWUP_SLA_HOURS) || (status === 'sent' && ageHours >= SENT_FOLLOWUP_SLA_HOURS)
        const rawScore = Number(task.followup.match_score ?? task.lead.lead_score ?? task.lead.qualification_score ?? 0)
        const score = Number.isFinite(rawScore) ? rawScore : 0
        const rank = (isRisk ? 100000 : 0) + (status === 'pending' ? 2000 : status === 'sent' ? 1000 : 0) + (score * 10) + ageHours

        current.total += 1
        current[status as 'pending' | 'sent' | 'responded' | 'converted' | 'dismissed'] += 1
        current.scoreSum += score
        if (isRisk) {
            current.risk += 1
            current.oldestRiskHours = Math.max(current.oldestRiskHours, ageHours)
        }
        if (rank > current.topRank) {
            current.topLead = task.lead
            current.topFollowup = task.followup
            current.topStatus = status
            current.topAgeHours = ageHours
            current.topRank = rank
        }

        map.set(brokerKey, current)
        return map
    }, new Map<string, any>()).values())
        .map(metric => {
            const contacted = metric.sent + metric.responded + metric.converted
            const actionable = metric.total - metric.dismissed
            const avgScore = metric.total > 0 ? Math.round(metric.scoreSum / metric.total) : 0
            const health = metric.risk > 0
                ? { label: 'SLA em risco', color: '#b45309', bg: '#fffbeb' }
                : metric.converted > 0
                    ? { label: 'Convertendo', color: '#7c3aed', bg: '#f5f3ff' }
                    : metric.responded > 0
                        ? { label: 'Respondendo', color: '#2563eb', bg: '#eff6ff' }
                        : metric.sent > 0
                            ? { label: 'Em contato', color: '#047857', bg: '#ecfdf5' }
                            : { label: 'Aguardando', color: '#64748b', bg: '#f8fafc' }
            const nextAction = metric.risk > 0
                ? 'Cobrar SLA'
                : metric.pending > 0
                    ? 'Ativar pendentes'
                    : metric.sent > 0
                        ? 'Buscar retorno'
                        : metric.responded > 0
                            ? 'Tentar conversao'
                            : 'Acompanhar'

            return {
                ...metric,
                avgScore,
                responseRate: percent(metric.responded + metric.converted, contacted),
                conversionRate: percent(metric.converted, actionable),
                health,
                nextAction,
            }
        })
        .sort((a, b) => b.risk - a.risk || b.converted - a.converted || b.responseRate - a.responseRate || b.avgScore - a.avgScore)
        .slice(0, 4)
    const aiExecutiveSummaryKey = 'ai-executive-summary'
    const aiExecutiveTopBroker = aiExecutiveBrokerQueue[0]
    const aiExecutiveTopLead = aiExecutiveLeadDrilldown[0]
    const aiExecutiveSummaryBriefing = [
        'Resumo executivo IA - CRM de Leads',
        `Saude: ${aiExecutiveHealth.label}`,
        aiExecutiveHealth.summary,
        `Acoes IA: ${appliedRecommendationCount} | leads tocados: ${aiExecutiveLeadIds.size}`,
        `Resolucao: ${aiExecutiveResolutionRate}% | resposta: ${aiExecutiveResponseRate}% | conversao: ${aiExecutiveConversionRate}%`,
        `Follow-ups: ${aiExecutiveFollowUps.length} total | ${aiExecutiveStatuses.pending} pendentes | ${aiExecutiveStatuses.sent} enviadas | ${aiExecutiveStatuses.responded} respondidas | ${aiExecutiveStatuses.converted} convertidas`,
        `Risco SLA: ${aiExecutiveSlaRisk}`,
        aiExecutiveTopBroker
            ? `Responsavel prioritario: ${aiExecutiveTopBroker.name} - ${aiExecutiveTopBroker.nextAction} (${aiExecutiveTopBroker.risk} risco SLA, ${aiExecutiveTopBroker.responseRate}% resposta)`
            : '',
        aiExecutiveTopLead
            ? `Lead prioritario: ${aiExecutiveTopLead.lead.lead_name || 'Lead sem nome'} - ${aiExecutiveTopLead.health.label} - score ${aiExecutiveTopLead.score}`
            : '',
        aiExecutiveTopLead?.latestTitle ? `Ultima acao: ${aiExecutiveTopLead.latestTitle}` : '',
        `Proximo passo: ${aiExecutiveSlaRisk > 0 ? 'cobrar SLA dos responsaveis em risco' : aiExecutiveStatuses.pending > 0 ? 'ativar pendentes e acompanhar resposta' : 'acompanhar resposta e conversao dos leads tocados pela IA'}`,
    ].filter(Boolean).join('\n')
    const aiExecutiveUnassignedActive = aiExecutiveFollowUps.filter(task => !task.lead.broker_id && task.status !== 'converted' && task.status !== 'dismissed').length
    const aiExecutiveAgendaItems = [
        {
            key: 'sla-risk',
            title: 'Resolver SLA em risco',
            description: 'Follow-ups tocados pela IA que ja passaram do prazo operacional.',
            count: aiExecutiveSlaRisk,
            action: 'Cobrar responsavel e destravar contato ainda hoje.',
            color: '#b45309',
            bg: '#fffbeb',
            icon: AlertTriangle,
            rank: 1,
        },
        {
            key: 'unassigned',
            title: 'Definir responsavel',
            description: 'Leads tocados pela IA ainda sem corretor definido.',
            count: aiExecutiveUnassignedActive,
            action: 'Distribuir para o corretor com melhor resposta.',
            color: '#047857',
            bg: '#ecfdf5',
            icon: User,
            rank: 2,
        },
        {
            key: 'pending',
            title: 'Ativar pendentes',
            description: 'Leads com abordagem pronta que ainda nao saiu.',
            count: aiExecutiveStatuses.pending,
            action: 'Enviar primeira abordagem consultiva.',
            color: '#b45309',
            bg: '#fffbeb',
            icon: Send,
            rank: 3,
        },
        {
            key: 'sent',
            title: 'Buscar retorno',
            description: 'Mensagens enviadas que ainda nao tiveram resposta registrada.',
            count: aiExecutiveStatuses.sent,
            action: 'Reativar conversa com contexto do imovel.',
            color: '#2563eb',
            bg: '#eff6ff',
            icon: MessageSquare,
            rank: 4,
        },
        {
            key: 'responded',
            title: 'Converter respondidos',
            description: 'Leads que ja responderam e precisam de proximo passo comercial.',
            count: aiExecutiveStatuses.responded,
            action: 'Marcar visita, call ou proposta.',
            color: '#7c3aed',
            bg: '#f5f3ff',
            icon: Trophy,
            rank: 5,
        },
    ]
        .filter(item => item.count > 0)
        .sort((a, b) => a.rank - b.rank)
    const completedExecutiveAgendaSet = new Set(completedExecutiveAgendaKeys)
    const completedExecutiveAgendaCount = aiExecutiveAgendaItems.filter(item => completedExecutiveAgendaSet.has(item.key)).length
    const aiExecutiveAgendaProgressRate = percent(completedExecutiveAgendaCount, aiExecutiveAgendaItems.length)
    const aiExecutiveAgendaKey = 'ai-executive-agenda'
    const aiExecutiveAgendaBriefing = [
        'Pauta executiva IA - CRM de Leads',
        `Checklist: ${completedExecutiveAgendaCount}/${aiExecutiveAgendaItems.length} tratado(s)`,
        ...aiExecutiveAgendaItems.map((item, index) => `${index + 1}. ${item.title}: ${item.count} - ${item.action}${completedExecutiveAgendaSet.has(item.key) ? ' [tratada]' : ''}`),
    ].join('\n')
    const activeExecutiveAgendaItem = aiExecutiveAgendaItems.find(item => item.key === selectedExecutiveAgendaKey) || aiExecutiveAgendaItems[0]
    const activeExecutiveAgendaKey = activeExecutiveAgendaItem?.key || ''
    const aiExecutiveAgendaLeadQueue = activeExecutiveAgendaItem
        ? aiExecutiveFollowUps.map(task => {
            const ageHours = actionTaskAgeHours(task)
            const status = ['pending', 'sent', 'responded', 'converted', 'dismissed'].includes(task.status) ? task.status : 'pending'
            const isRisk = (status === 'pending' && ageHours >= PENDING_FOLLOWUP_SLA_HOURS) || (status === 'sent' && ageHours >= SENT_FOLLOWUP_SLA_HOURS)
            const rawScore = Number(task.followup.match_score ?? task.lead.lead_score ?? task.lead.qualification_score ?? 0)
            const score = Number.isFinite(rawScore) ? rawScore : 0
            const priorityScore = (isRisk ? 100000 : 0)
                + (!task.lead.broker_id ? 10000 : 0)
                + (status === 'pending' ? 3000 : status === 'sent' ? 2000 : status === 'responded' ? 1000 : 0)
                + (score * 10)
                + ageHours

            return {
                ...task,
                ageHours,
                status,
                isRisk,
                score,
                priorityScore,
                brokerLabel: task.lead.broker_name || (task.lead.broker_id ? 'Corretor atribuido' : 'Sem corretor'),
            }
        })
            .filter(task => {
                if (activeExecutiveAgendaKey === 'sla-risk') return task.isRisk
                if (activeExecutiveAgendaKey === 'unassigned') return !task.lead.broker_id && task.status !== 'converted' && task.status !== 'dismissed'
                if (activeExecutiveAgendaKey === 'pending') return task.status === 'pending'
                if (activeExecutiveAgendaKey === 'sent') return task.status === 'sent'
                if (activeExecutiveAgendaKey === 'responded') return task.status === 'responded'
                return false
            })
            .sort((a, b) => b.priorityScore - a.priorityScore || b.ageHours - a.ageHours || b.score - a.score)
            .slice(0, 5)
        : []
    const aiExecutiveAgendaLeadsKey = activeExecutiveAgendaKey ? `ai-executive-agenda-leads:${activeExecutiveAgendaKey}` : ''
    const aiExecutiveAgendaLeadsBriefing = activeExecutiveAgendaItem
        ? [
            `Leads da pauta IA - ${activeExecutiveAgendaItem.title}`,
            activeExecutiveAgendaItem.action,
            ...aiExecutiveAgendaLeadQueue.map((task, index) => {
                const statusLabel = FOLLOWUP_STATUS_CONFIG[task.status]?.label || 'Pendente'
                const contact = formatPhone(task.lead.lead_phone) || task.lead.lead_email || 'sem contato'
                const context = task.followup.property_title || task.followup.title || 'Match de alerta salvo'
                return `${index + 1}. ${task.lead.lead_name || 'Lead sem nome'} | ${contact} | ${statusLabel}${task.ageHours > 0 ? ` ha ${formatActionAge(task.ageHours)}` : ''} | score ${task.score} | ${task.brokerLabel} | ${context}`
            }),
        ].filter(Boolean).join('\n')
        : ''
    const aiExecutiveOperationalHandoffKey = activeExecutiveAgendaKey ? `ai-executive-operational-handoff:${activeExecutiveAgendaKey}` : ''
    const aiExecutiveOperationalHandoffBriefing = activeExecutiveAgendaItem
        ? [
            `Encaminhamento operacional IA - ${activeExecutiveAgendaItem.title}`,
            `Objetivo: ${activeExecutiveAgendaItem.action}`,
            `Checklist: ${completedExecutiveAgendaCount}/${aiExecutiveAgendaItems.length} pauta(s) tratada(s)`,
            '',
            ...aiExecutiveAgendaLeadQueue.flatMap((task, index) => {
                const statusLabel = FOLLOWUP_STATUS_CONFIG[task.status]?.label || 'Pendente'
                const contact = formatPhone(task.lead.lead_phone) || task.lead.lead_email || 'sem contato'
                const context = task.followup.property_title || task.followup.title || 'Match de alerta salvo'
                const message = String(task.followup.message || '').replace(/\s+/g, ' ').trim()
                const whatsappUrl = message
                    ? buildWhatsAppFollowUpUrl(task.lead, message)
                    : buildWhatsAppLeadUrl(task.lead)
                const operationalAction = !task.lead.broker_id
                    ? 'Definir responsavel e iniciar contato.'
                    : task.status === 'pending'
                        ? 'Enviar abordagem e marcar como enviada no CRM.'
                        : task.status === 'sent'
                            ? 'Cobrar retorno e marcar como respondida quando houver conversa.'
                            : task.status === 'responded'
                                ? 'Converter proximo passo comercial ou registrar motivo de perda.'
                                : task.status === 'converted'
                                    ? 'Conferir proximo passo de fechamento e documentacao.'
                                    : 'Revisar necessidade de manter ou descartar.'
                const urgency = task.isRisk
                    ? 'Prazo: hoje, risco de SLA.'
                    : task.status === 'pending'
                        ? 'Prazo: contato ainda hoje.'
                        : 'Prazo: acompanhar em ate 24h.'

                return [
                    `${index + 1}. ${task.lead.lead_name || 'Lead sem nome'} | ${contact}`,
                    `Responsavel: ${task.brokerLabel}`,
                    `Status: ${statusLabel}${task.ageHours > 0 ? ` ha ${formatActionAge(task.ageHours)}` : ''} | score ${task.score}`,
                    `Contexto: ${context}`,
                    `${urgency} Acao: ${operationalAction}`,
                    message ? `Mensagem sugerida: ${message}` : '',
                    whatsappUrl ? `WhatsApp: ${whatsappUrl}` : '',
                    '',
                ].filter(Boolean)
            }),
        ].filter(Boolean).join('\n')
        : ''
    const aiExecutiveMeetingMinuteKey = 'ai-executive-meeting-minute'
    const openExecutiveAgendaItems = aiExecutiveAgendaItems.filter(item => !completedExecutiveAgendaSet.has(item.key))
    const aiExecutiveMeetingMinuteBriefing = [
        'Ata executiva IA - CRM de Leads',
        `Saude geral: ${aiExecutiveHealth.label}`,
        aiExecutiveHealth.summary,
        `Checklist da pauta: ${completedExecutiveAgendaCount}/${aiExecutiveAgendaItems.length} tratado(s) (${aiExecutiveAgendaProgressRate}%)`,
        `Indicadores: ${appliedRecommendationCount} acoes IA | ${aiExecutiveLeadIds.size} leads tocados | ${aiExecutiveSlaRisk} risco SLA`,
        `Performance: ${aiExecutiveResolutionRate}% resolucao | ${aiExecutiveResponseRate}% resposta | ${aiExecutiveConversionRate}% conversao`,
        aiExecutiveAgendaItems.length > 0
            ? `Tratadas: ${aiExecutiveAgendaItems.filter(item => completedExecutiveAgendaSet.has(item.key)).map(item => item.title).join(', ') || 'nenhuma'}`
            : '',
        openExecutiveAgendaItems.length > 0
            ? `Pendentes: ${openExecutiveAgendaItems.map(item => `${item.title} (${item.count})`).join(', ')}`
            : 'Pendentes: nenhuma',
        activeExecutiveAgendaItem ? `Pauta em foco: ${activeExecutiveAgendaItem.title} - ${activeExecutiveAgendaItem.action}` : '',
        aiExecutiveAgendaLeadQueue.length > 0 ? 'Leads em foco:' : '',
        ...aiExecutiveAgendaLeadQueue.slice(0, 3).map((task, index) => {
            const statusLabel = FOLLOWUP_STATUS_CONFIG[task.status]?.label || 'Pendente'
            const contact = formatPhone(task.lead.lead_phone) || task.lead.lead_email || 'sem contato'
            const context = task.followup.property_title || task.followup.title || 'Match de alerta salvo'
            return `${index + 1}. ${task.lead.lead_name || 'Lead sem nome'} | ${contact} | ${statusLabel}${task.ageHours > 0 ? ` ha ${formatActionAge(task.ageHours)}` : ''} | ${task.brokerLabel} | ${context}`
        }),
        `Encaminhamento: ${openExecutiveAgendaItems.length > 0 ? 'tratar pendencias abertas e atualizar status dos follow-ups no CRM' : 'acompanhar conversao dos leads ja tratados'}`,
    ].filter(Boolean).join('\n')

    const executiveBriefResult = executiveBriefStatus?.lastResult || executiveBriefStatus?.cronLastResult || null
    const executiveBriefHealth = getExecutiveBriefHealth(executiveBriefStatus)
    const executiveBriefAiRate = executiveBriefResult
        ? percent(executiveBriefResult.aiNarrativesGenerated, executiveBriefResult.aiNarrativesRequested)
        : 0
    const executiveBriefLastRunAt = executiveBriefStatus?.lastRunAt || executiveBriefStatus?.cronLastRunAt || ''
    const executiveBriefCronReason = executiveBriefStatus?.cronLastReason || 'sem registro'
    const propertySearchAlertResult = propertySearchAlertsStatus?.lastResult || propertySearchAlertsStatus?.cronLastResult || null
    const propertySearchAlertsHealth = getPropertySearchAlertsHealth(propertySearchAlertsStatus)
    const propertySearchAlertsLastRunAt = propertySearchAlertsStatus?.lastRunAt || propertySearchAlertsStatus?.cronLastRunAt || ''
    const propertySearchAlertsCronReason = propertySearchAlertsStatus?.cronLastReason || 'sem registro'
    const crmActionRecommendationsResult = crmActionRecommendationsStatus?.lastResult || crmActionRecommendationsStatus?.cronLastResult || null
    const crmActionRecommendationsHealth = getCrmActionRecommendationsHealth(crmActionRecommendationsStatus)
    const crmActionRecommendationsLastRunAt = crmActionRecommendationsStatus?.lastRunAt || crmActionRecommendationsStatus?.cronLastRunAt || ''
    const crmActionRecommendationsCronReason = crmActionRecommendationsStatus?.cronLastReason || 'sem registro'

    const selectedBroker = brokers.find(broker => broker.id === selectedBrokerId)
    const selectedBrokerPhotoUrl = selectedBroker ? getBrokerPhotoUrl(selectedBroker) : null

    const brokerPipelineOverview = (() => {
        const brokerNames = new Map(brokers.map(broker => [broker.id, broker.name]))
        const brokerPhotos = new Map(brokers.map(broker => [broker.id, getBrokerPhotoUrl(broker)]))
        const brokerGlobalFlags = new Map(brokers.map(broker => [broker.id, isGlobalWhatsappBroker(broker)]))
        const overview = new Map<string, {
            id: string
            name: string
            photoUrl: string | null
            isGlobal: boolean
            total: number
            hot: number
            warm: number
            cold: number
            fup: number
            visits: number
            proposal: number
            contract: number
        }>()

        leads.forEach(lead => {
            const id = lead.broker_id || 'unassigned'
            const current = overview.get(id) || {
                id,
                name: id === 'unassigned' ? 'Sem corretor' : (brokerNames.get(id) || lead.broker_name || 'Corretor'),
                photoUrl: id === 'unassigned' ? null : (brokerPhotos.get(id) || lead.broker_photo_url || null),
                isGlobal: id === 'unassigned' ? false : Boolean(brokerGlobalFlags.get(id)),
                total: 0,
                hot: 0,
                warm: 0,
                cold: 0,
                fup: 0,
                visits: 0,
                proposal: 0,
                contract: 0,
            }
            if (!current.photoUrl && lead.broker_photo_url) current.photoUrl = lead.broker_photo_url
            const stage = getPipelineStageForLead(lead)
            const score = getDisplayScore(lead)
            current.total += 1
            if (stage === 'leads_quentes') current.hot += 1
            if (score >= 60 && stage !== 'leads_quentes') current.warm += 1
            if (score < 60 && stage !== 'leads_quentes') current.cold += 1
            if (stage === 'fup') current.fup += 1
            if (stage === 'visitas') current.visits += 1
            if (stage === 'proposta_negociacao') current.proposal += 1
            if (stage === 'contrato') current.contract += 1
            overview.set(id, current)
        })

        return Array.from(overview.values()).sort((a, b) => {
            if (a.id === selectedBrokerId) return -1
            if (b.id === selectedBrokerId) return 1
            return b.total - a.total || a.name.localeCompare(b.name)
        })
    })()

    const pipelineColumns = (() => {
        const grouped = new Map<LeadPipelineStageKey, LeadData[]>()
        LEAD_PIPELINE_STAGES.forEach(stage => grouped.set(stage.key, []))

        leads.forEach(lead => {
            const stage = getPipelineStageForLead(lead)
            grouped.get(stage)?.push(lead)
        })

        return LEAD_PIPELINE_STAGES.map(stage => ({
            ...stage,
            leads: (grouped.get(stage.key) || []).sort((a, b) => {
                const scoreDelta = getDisplayScore(b) - getDisplayScore(a)
                if (scoreDelta !== 0 && ['leads_quentes', 'oportunidades', 'visitas', 'proposta_negociacao'].includes(stage.key)) {
                    return scoreDelta
                }
                return Date.parse(latestLeadMovement(b)) - Date.parse(latestLeadMovement(a))
            }),
        }))
    })()

    const pipelineTotals = (() => {
        return pipelineColumns.reduce((acc, column) => {
            acc[column.key] = column.leads.length
            return acc
        }, {} as Record<LeadPipelineStageKey, number>)
    })()

    const brokerStatsById = new Map(brokerPipelineOverview.map(item => [item.id, item]))
    const brokerSelectorCards = [
        {
            id: '',
            name: 'Todos os corretores',
            photoUrl: null,
            total: leads.length,
            hot: pipelineTotals.leads_quentes || 0,
            warm: pipelineColumns.reduce((sum, column) => sum + column.leads.filter(lead => {
                const score = getDisplayScore(lead)
                return score >= 60 && score < 80
            }).length, 0),
            cold: pipelineColumns.reduce((sum, column) => sum + column.leads.filter(lead => getDisplayScore(lead) < 60).length, 0),
            fup: pipelineTotals.fup || 0,
            visits: pipelineTotals.visitas || 0,
            proposal: pipelineTotals.proposta_negociacao || 0,
            contract: pipelineTotals.contrato || 0,
            isGlobal: false,
            canFilter: true,
            resetCard: true,
        },
        ...brokers.map(broker => {
            const fallback = {
                id: broker.id,
                name: broker.name,
                photoUrl: getBrokerPhotoUrl(broker),
                total: 0,
                hot: 0,
                warm: 0,
                cold: 0,
                fup: 0,
                visits: 0,
                proposal: 0,
                contract: 0,
                isGlobal: isGlobalWhatsappBroker(broker),
            }
            return {
                ...fallback,
                ...(brokerStatsById.get(broker.id) || {}),
                canFilter: true,
                resetCard: false,
            }
        }),
        ...(brokerStatsById.get('unassigned')
            ? [{
                ...brokerStatsById.get('unassigned')!,
                canFilter: false,
                resetCard: false,
            }]
            : []),
    ]

    const pipelineDashboardMetrics = [
        { label: 'Leads', value: leads.length, color: '#1a1a1a', bg: '#f5f0ea', border: '#e8e5e0' },
        { label: 'Corretores', value: selectedBroker ? 1 : Math.max(brokers.length, brokerPipelineOverview.filter(item => item.id !== 'unassigned').length), color: '#6b4f1d', bg: '#f8f1df', border: '#ead6a6' },
        { label: 'Quentes', value: pipelineTotals.leads_quentes || 0, color: '#b45309', bg: '#fff7ed', border: 'rgba(180,83,9,0.22)' },
        { label: 'Visitas', value: pipelineTotals.visitas || 0, color: '#047857', bg: '#ecfdf5', border: 'rgba(4,120,87,0.18)' },
        { label: 'Propostas', value: pipelineTotals.proposta_negociacao || 0, color: '#7c3aed', bg: '#f5f3ff', border: 'rgba(124,58,237,0.18)' },
        { label: 'Contratos', value: pipelineTotals.contrato || 0, color: '#15803d', bg: '#f0fdf4', border: 'rgba(21,128,61,0.18)' },
    ]

    const operationHealthItems = [
        { label: 'Resumos IA', value: executiveBriefHealth.label, color: executiveBriefHealth.color },
        { label: 'Alertas salvos', value: propertySearchAlertsHealth.label, color: propertySearchAlertsHealth.color },
        { label: 'Fila IA', value: crmActionRecommendationsHealth.label, color: crmActionRecommendationsHealth.color },
    ]

    const selectedLeadForModal = expandedLead
        ? leads.find(lead => lead.id === expandedLead) || null
        : null

    const cardStyle: React.CSSProperties = {
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e8e5e0',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
    }

    return (
        <div className="lead-crm-page" style={{
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            margin: 0,
            padding: '28px clamp(18px, 3.2vw, 64px) 48px',
            boxSizing: 'border-box',
            overflowX: 'hidden',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                        CRM dos Leads
                    </h1>
                    <p style={{ color: '#888', fontSize: '0.85rem', margin: '4px 0 0' }}>
                        {selectedBroker ? `Historico e pipeline de ${selectedBroker.name}` : 'Pipeline, lista e historico comercial em uma unica central'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                        onClick={processExecutiveBriefs}
                        disabled={processingExecutiveBriefs || loading}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '9px 12px',
                            borderRadius: 9,
                            border: '1px solid rgba(4,120,87,0.18)',
                            background: processingExecutiveBriefs ? '#f0fdf4' : '#ecfdf5',
                            color: '#047857',
                            fontSize: '0.76rem',
                            fontWeight: 900,
                            cursor: processingExecutiveBriefs || loading ? 'wait' : 'pointer',
                            opacity: processingExecutiveBriefs || loading ? 0.7 : 1,
                        }}
                    >
                        <FileText size={14} />
                        {processingExecutiveBriefs ? 'Gerando resumos IA...' : 'Atualizar resumos IA'}
                    </button>
                    <button
                        onClick={processActionRecommendations}
                        disabled={processingActions || loading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            background: '#0f172a', border: '1px solid #0f172a', borderRadius: 8,
                            cursor: processingActions || loading ? 'wait' : 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#fff',
                            opacity: processingActions || loading ? 0.72 : 1,
                        }}
                    >
                        <Zap size={14} />
                        {processingActions ? 'Sincronizando...' : 'Sincronizar fila IA'}
                    </button>
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
            </div>

            <div style={{
                marginBottom: 16,
                display: 'grid',
                gridTemplateColumns: 'minmax(260px, 0.9fr) minmax(420px, 1.45fr) minmax(270px, 0.95fr)',
                gap: 12,
                alignItems: 'stretch',
            }}>
                <div style={{
                    padding: 16,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #fff8ea 0%, #ffffff 78%)',
                    border: '1px solid #ead6a6',
                    boxShadow: '0 10px 28px rgba(107,79,29,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    minHeight: 132,
                }}>
                    <div>
                        <span style={{ display: 'block', color: '#8a6a1f', fontSize: '0.68rem', fontWeight: 950, letterSpacing: 0, textTransform: 'uppercase' }}>
                            Visao atual
                        </span>
                        <strong style={{ display: 'block', color: '#1a1a1a', fontSize: '1.08rem', marginTop: 5, lineHeight: 1.25 }}>
                            {selectedBroker ? selectedBroker.name : 'Todos os corretores'}
                        </strong>
                        <p style={{ margin: '7px 0 0', color: '#64748b', fontSize: '0.74rem', fontWeight: 750, lineHeight: 1.35, maxWidth: 420 }}>
                            {selectedBroker
                                ? 'Filtro ativo neste corretor. Volte para todos quando quiser comparar a operacao completa.'
                                : 'Selecione um corretor no pipeline para isolar a carteira e acompanhar as etapas.'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <span style={{ padding: '5px 9px', borderRadius: 999, background: '#fff', border: '1px solid #ead6a6', color: '#6b4f1d', fontSize: '0.66rem', fontWeight: 950 }}>
                            {leads.length} leads no filtro
                        </span>
                        {selectedBrokerId && (
                            <button
                                type="button"
                                onClick={() => setSelectedBrokerId('')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '7px 10px',
                                    borderRadius: 9,
                                    border: '1px solid #d4a72c',
                                    background: '#fff7db',
                                    color: '#6b4f1d',
                                    fontSize: '0.7rem',
                                    fontWeight: 950,
                                    cursor: 'pointer',
                                }}
                            >
                                <ArrowRightLeft size={13} />
                                Ver todos
                            </button>
                        )}
                    </div>
                </div>

                <div style={{
                    padding: 10,
                    borderRadius: 14,
                    background: '#ffffff',
                    border: '1px solid #e8e5e0',
                    boxShadow: '0 10px 28px rgba(15,23,42,0.06)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 8,
                }}>
                    {pipelineDashboardMetrics.map(item => (
                        <div key={item.label} style={{
                            minHeight: 62,
                            padding: '10px 11px',
                            borderRadius: 10,
                            background: item.bg,
                            border: `1px solid ${item.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset',
                        }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ color: '#64748b', fontSize: '0.6rem', fontWeight: 950, textTransform: 'uppercase', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.label}
                                </div>
                                <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.58rem', fontWeight: 850, marginTop: 4 }}>
                                    pipeline
                                </span>
                            </div>
                            <strong style={{ display: 'block', color: item.color, fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>
                                {item.value}
                            </strong>
                        </div>
                    ))}
                </div>

                <div style={{
                    padding: 14,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 74%)',
                    border: '1px solid #dbe3ee',
                    boxShadow: '0 10px 28px rgba(15,23,42,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    minHeight: 132,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                            <span style={{ display: 'block', color: '#475569', fontSize: '0.68rem', fontWeight: 950, textTransform: 'uppercase' }}>Operacao IA</span>
                            <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.62rem', fontWeight: 800, marginTop: 3 }}>resumos, alertas e fila</span>
                        </div>
                        <button
                            type="button"
                            onClick={loadExecutiveBriefStatus}
                            disabled={loadingExecutiveBriefStatus}
                            style={{
                                border: '1px solid #dbe3ee',
                                background: '#ffffff',
                                color: '#334155',
                                borderRadius: 9,
                                padding: '6px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: '0.64rem',
                                fontWeight: 950,
                                cursor: loadingExecutiveBriefStatus ? 'wait' : 'pointer',
                                boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                            }}
                        >
                            <RefreshCw size={12} style={{ animation: loadingExecutiveBriefStatus ? 'spin 1s linear infinite' : 'none' }} />
                            Status
                        </button>
                    </div>
                    <div style={{ display: 'grid', gap: 7 }}>
                        {operationHealthItems.map(item => (
                            <div key={item.label} style={{
                                display: 'grid',
                                gridTemplateColumns: '10px minmax(0, 1fr) auto',
                                alignItems: 'center',
                                gap: 8,
                                padding: '7px 8px',
                                borderRadius: 10,
                                background: '#ffffff',
                                border: '1px solid #edf1f5',
                            }}>
                                <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color, boxShadow: `0 0 0 3px ${item.color}18` }} />
                                <span style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                                <span style={{ color: item.color, background: `${item.color}10`, border: `1px solid ${item.color}22`, borderRadius: 999, padding: '4px 8px', fontSize: '0.62rem', fontWeight: 950, whiteSpace: 'nowrap' }}>
                                    {item.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{
                marginBottom: 20,
                display: 'none',
                padding: 14,
                borderRadius: 10,
                border: `1px solid ${executiveBriefHealth.color}24`,
                background: executiveBriefHealth.bg,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                alignItems: 'center',
            }}>
                <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: executiveBriefHealth.color, fontSize: '0.68rem', fontWeight: 900, marginBottom: 5 }}>
                        <Target size={13} /> SAUDE DOS RESUMOS IA
                    </span>
                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.95rem', lineHeight: 1.25 }}>
                        {loadingExecutiveBriefStatus ? 'Carregando status' : executiveBriefHealth.label}
                    </strong>
                    <p style={{ margin: '5px 0 0', color: '#475569', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.4 }}>
                        {executiveBriefHealth.detail}
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                    {[
                        {
                            label: 'Ultima execucao',
                            value: executiveBriefLastRunAt ? formatDate(executiveBriefLastRunAt) : 'sem registro',
                        },
                        {
                            label: 'Leads atualizados',
                            value: executiveBriefResult ? String(executiveBriefResult.updatedLeads) : '0',
                        },
                        {
                            label: 'Narrativas IA',
                            value: executiveBriefResult
                                ? `${executiveBriefResult.aiNarrativesGenerated}/${executiveBriefResult.aiNarrativesRequested}`
                                : '0/0',
                        },
                        {
                            label: 'Cron',
                            value: executiveBriefCronReason,
                        },
                    ].map(item => (
                        <div key={item.label} style={{ padding: 9, borderRadius: 8, background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)' }}>
                            <div style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 900, marginBottom: 4, textTransform: 'uppercase' }}>
                                {item.label}
                            </div>
                            <div style={{ color: '#0f172a', fontSize: '0.75rem', fontWeight: 900, lineHeight: 1.25, wordBreak: 'break-word' }}>
                                {item.value}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
                    {executiveBriefResult && (
                        <span style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid rgba(37,99,235,0.16)', borderRadius: 999, padding: '5px 8px', fontSize: '0.62rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                            IA {executiveBriefAiRate}%
                        </span>
                    )}
                    <span style={{ color: '#64748b', fontSize: '0.64rem', fontWeight: 800, textAlign: 'right' }}>
                        {executiveBriefResult
                            ? formatExecutiveBriefSkipReason(executiveBriefResult.aiNarrativeSkippedReason)
                            : executiveBriefStatus?.cronLastCheckedAt
                                ? `Cron checado ${formatDate(executiveBriefStatus.cronLastCheckedAt)}`
                                : 'Aguardando primeira execucao'}
                    </span>
                    {executiveBriefResult?.errors.length ? (
                        <span style={{ color: '#b91c1c', fontSize: '0.62rem', fontWeight: 800, textAlign: 'right', maxWidth: 220 }}>
                            {executiveBriefResult.errors[0]}
                        </span>
                    ) : null}
                    <button
                        type="button"
                        onClick={loadExecutiveBriefStatus}
                        disabled={loadingExecutiveBriefStatus}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 9px',
                            borderRadius: 8,
                            border: `1px solid ${executiveBriefHealth.color}22`,
                            background: '#ffffff',
                            color: executiveBriefHealth.color,
                            fontSize: '0.64rem',
                            fontWeight: 900,
                            cursor: loadingExecutiveBriefStatus ? 'wait' : 'pointer',
                            opacity: loadingExecutiveBriefStatus ? 0.72 : 1,
                        }}
                    >
                        <RefreshCw size={12} style={{ animation: loadingExecutiveBriefStatus ? 'spin 1s linear infinite' : 'none' }} />
                        Status
                    </button>
                </div>
            </div>

            <div style={{
                marginBottom: 20,
                display: 'none',
                padding: 14,
                borderRadius: 10,
                border: `1px solid ${propertySearchAlertsHealth.color}24`,
                background: propertySearchAlertsHealth.bg,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                alignItems: 'center',
            }}>
                <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: propertySearchAlertsHealth.color, fontSize: '0.68rem', fontWeight: 900, marginBottom: 5 }}>
                        <BellRing size={13} /> SAUDE DOS ALERTAS SALVOS
                    </span>
                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.95rem', lineHeight: 1.25 }}>
                        {loadingExecutiveBriefStatus ? 'Carregando status' : propertySearchAlertsHealth.label}
                    </strong>
                    <p style={{ margin: '5px 0 0', color: '#475569', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.4 }}>
                        {propertySearchAlertsHealth.detail}
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                    {[
                        {
                            label: 'Ultima varredura',
                            value: propertySearchAlertsLastRunAt ? formatDate(propertySearchAlertsLastRunAt) : 'sem registro',
                        },
                        {
                            label: 'Imoveis avaliados',
                            value: propertySearchAlertResult ? String(propertySearchAlertResult.processedProperties) : '0',
                        },
                        {
                            label: 'Matches criados',
                            value: propertySearchAlertResult ? String(propertySearchAlertResult.matchesCreated) : '0',
                        },
                        {
                            label: 'Cron',
                            value: propertySearchAlertsCronReason,
                        },
                    ].map(item => (
                        <div key={item.label} style={{ padding: 9, borderRadius: 8, background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)' }}>
                            <div style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 900, marginBottom: 4, textTransform: 'uppercase' }}>
                                {item.label}
                            </div>
                            <div style={{ color: '#0f172a', fontSize: '0.75rem', fontWeight: 900, lineHeight: 1.25, wordBreak: 'break-word' }}>
                                {item.value}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
                    {propertySearchAlertResult && (
                        <span style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid rgba(37,99,235,0.16)', borderRadius: 999, padding: '5px 8px', fontSize: '0.62rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                            Push {propertySearchAlertResult.notificationsSent}/{propertySearchAlertResult.notificationsFailed}
                        </span>
                    )}
                    <span style={{ color: '#64748b', fontSize: '0.64rem', fontWeight: 800, textAlign: 'right' }}>
                        {propertySearchAlertResult
                            ? `${propertySearchAlertResult.alertsChecked} alertas avaliados`
                            : propertySearchAlertsStatus?.cronLastCheckedAt
                                ? `Cron checado ${formatDate(propertySearchAlertsStatus.cronLastCheckedAt)}`
                                : 'Aguardando primeira varredura'}
                    </span>
                    {propertySearchAlertResult?.propertyErrors ? (
                        <span style={{ color: '#b91c1c', fontSize: '0.62rem', fontWeight: 800, textAlign: 'right', maxWidth: 220 }}>
                            {propertySearchAlertResult.propertyErrors} imovel(is) com falha de processamento
                        </span>
                    ) : null}
                    <button
                        type="button"
                        onClick={processSearchAlerts}
                        disabled={processingSearchAlerts || loading}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 9px',
                            borderRadius: 8,
                            border: '1px solid rgba(15,23,42,0.12)',
                            background: '#0f172a',
                            color: '#ffffff',
                            fontSize: '0.64rem',
                            fontWeight: 900,
                            cursor: processingSearchAlerts || loading ? 'wait' : 'pointer',
                            opacity: processingSearchAlerts || loading ? 0.72 : 1,
                        }}
                    >
                        <BellRing size={12} style={{ animation: processingSearchAlerts ? 'spin 1s linear infinite' : 'none' }} />
                        {processingSearchAlerts ? 'Varrendo' : 'Varrer agora'}
                    </button>
                    <button
                        type="button"
                        onClick={loadExecutiveBriefStatus}
                        disabled={loadingExecutiveBriefStatus}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 9px',
                            borderRadius: 8,
                            border: `1px solid ${propertySearchAlertsHealth.color}22`,
                            background: '#ffffff',
                            color: propertySearchAlertsHealth.color,
                            fontSize: '0.64rem',
                            fontWeight: 900,
                            cursor: loadingExecutiveBriefStatus ? 'wait' : 'pointer',
                            opacity: loadingExecutiveBriefStatus ? 0.72 : 1,
                        }}
                    >
                        <RefreshCw size={12} style={{ animation: loadingExecutiveBriefStatus ? 'spin 1s linear infinite' : 'none' }} />
                        Status
                    </button>
                </div>
            </div>

            <div style={{
                marginBottom: 20,
                display: 'none',
                padding: 14,
                borderRadius: 10,
                border: `1px solid ${crmActionRecommendationsHealth.color}24`,
                background: crmActionRecommendationsHealth.bg,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                alignItems: 'center',
            }}>
                <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: crmActionRecommendationsHealth.color, fontSize: '0.68rem', fontWeight: 900, marginBottom: 5 }}>
                        <Zap size={13} /> SAUDE DA FILA IA
                    </span>
                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.95rem', lineHeight: 1.25 }}>
                        {loadingExecutiveBriefStatus ? 'Carregando status' : crmActionRecommendationsHealth.label}
                    </strong>
                    <p style={{ margin: '5px 0 0', color: '#475569', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.4 }}>
                        {crmActionRecommendationsHealth.detail}
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                    {[
                        {
                            label: 'Ultima sinc.',
                            value: crmActionRecommendationsLastRunAt ? formatDate(crmActionRecommendationsLastRunAt) : 'sem registro',
                        },
                        {
                            label: 'Leads analisados',
                            value: crmActionRecommendationsResult ? String(crmActionRecommendationsResult.processedLeads) : '0',
                        },
                        {
                            label: 'Acoes geradas',
                            value: crmActionRecommendationsResult ? String(crmActionRecommendationsResult.totalRecommendations) : '0',
                        },
                        {
                            label: 'Cron',
                            value: crmActionRecommendationsCronReason,
                        },
                    ].map(item => (
                        <div key={item.label} style={{ padding: 9, borderRadius: 8, background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)' }}>
                            <div style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 900, marginBottom: 4, textTransform: 'uppercase' }}>
                                {item.label}
                            </div>
                            <div style={{ color: '#0f172a', fontSize: '0.75rem', fontWeight: 900, lineHeight: 1.25, wordBreak: 'break-word' }}>
                                {item.value}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
                    {crmActionRecommendationsResult?.strongestBroker?.name && (
                        <span style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid rgba(37,99,235,0.16)', borderRadius: 999, padding: '5px 8px', fontSize: '0.62rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                            Forte: {crmActionRecommendationsResult.strongestBroker.name}
                        </span>
                    )}
                    <span style={{ color: '#64748b', fontSize: '0.64rem', fontWeight: 800, textAlign: 'right' }}>
                        {crmActionRecommendationsResult
                            ? `${crmActionRecommendationsResult.updatedLeads} leads atualizados`
                            : crmActionRecommendationsStatus?.cronLastCheckedAt
                                ? `Cron checado ${formatDate(crmActionRecommendationsStatus.cronLastCheckedAt)}`
                                : 'Aguardando primeira sincronizacao'}
                    </span>
                    {crmActionRecommendationsResult?.errors.length ? (
                        <span style={{ color: '#b91c1c', fontSize: '0.62rem', fontWeight: 800, textAlign: 'right', maxWidth: 220 }}>
                            {crmActionRecommendationsResult.errors[0]}
                        </span>
                    ) : null}
                    <button
                        type="button"
                        onClick={loadExecutiveBriefStatus}
                        disabled={loadingExecutiveBriefStatus}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 9px',
                            borderRadius: 8,
                            border: `1px solid ${crmActionRecommendationsHealth.color}22`,
                            background: '#ffffff',
                            color: crmActionRecommendationsHealth.color,
                            fontSize: '0.64rem',
                            fontWeight: 900,
                            cursor: loadingExecutiveBriefStatus ? 'wait' : 'pointer',
                            opacity: loadingExecutiveBriefStatus ? 0.72 : 1,
                        }}
                    >
                        <RefreshCw size={12} style={{ animation: loadingExecutiveBriefStatus ? 'spin 1s linear infinite' : 'none' }} />
                        Status
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="crm-stats-grid" style={{ display: 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Total', value: stats.total, color: '#333', bg: '#f5f0ea' },
                    { label: 'Novos', value: stats.new, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)' },
                    { label: 'Qualificando', value: stats.qualifying, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' },
                    { label: 'Qualificados', value: stats.qualified, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)' },
                    { label: 'Transferidos', value: stats.transferred, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)' },
                    { label: 'Intencao premium', value: stats.premiumIntentLeads, color: '#7c2d12', bg: '#fff7ed' },
                    { label: 'Visita privada', value: stats.privateVisitRequests, color: '#0f766e', bg: '#f0fdfa' },
                    { label: 'Disponibilidade', value: stats.availabilityRequests, color: '#2563eb', bg: '#eff6ff' },
                    { label: 'Neg. reservada', value: stats.reservedNegotiationRequests, color: '#7c3aed', bg: '#f5f3ff' },
                    { label: 'Favoritos', value: stats.favoriteLeads, color: '#0f766e', bg: '#f0fdfa' },
                    { label: 'Revisitas', value: stats.revisitLeads, color: '#334155', bg: '#f8fafc' },
                    { label: 'Alertas abertos', value: stats.alertOpenLeads, color: '#b45309', bg: '#fffbeb' },
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

            <section className="lead-crm-pipeline-section" style={{ maxWidth: '100%', minWidth: 0, marginBottom: 22, padding: 18, borderRadius: 12, border: '1px solid #e8e5e0', background: '#fff', boxShadow: '0 10px 28px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div>
                        <span style={{ display: 'block', color: '#8a6a1f', fontSize: '0.68rem', fontWeight: 950, letterSpacing: 0, textTransform: 'uppercase' }}>Pipeline IA</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, minWidth: 0 }}>
                            {selectedBroker && (
                                <LeadAvatar name={selectedBroker.name} avatarUrl={selectedBrokerPhotoUrl} size={30} />
                            )}
                            <strong style={{ display: 'block', color: '#1a1a1a', fontSize: '1.05rem', lineHeight: 1.25, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {selectedBroker ? selectedBroker.name : 'Todos os corretores'}
                            </strong>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span style={{ display: 'inline-flex', gap: 5, padding: 2, borderRadius: 999, background: '#fafafa', border: '1px solid #e8e5e0' }}>
                            <button
                                type="button"
                                onClick={() => scrollPipelineStages(-1)}
                                title="Etapas anteriores"
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: '#fff',
                                    color: '#6b4f1d',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => scrollPipelineStages(1)}
                                title="Proximas etapas"
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: '#fff',
                                    color: '#6b4f1d',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </span>
                        {[
                            { label: 'Entrada', value: pipelineTotals.entrada || 0, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'FUP', value: pipelineTotals.fup || 0, color: '#b45309', bg: '#fffbeb' },
                            { label: 'Quentes', value: pipelineTotals.leads_quentes || 0, color: '#b45309', bg: '#fff7ed' },
                            { label: 'Visitas', value: pipelineTotals.visitas || 0, color: '#047857', bg: '#ecfdf5' },
                            { label: 'Contrato', value: pipelineTotals.contrato || 0, color: '#15803d', bg: '#f0fdf4' },
                        ].map(item => (
                            <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 999, background: item.bg, color: item.color, border: `1px solid ${item.color}22`, fontSize: '0.68rem', fontWeight: 900 }}>
                                {item.label}: {item.value}
                            </span>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(178px, 1fr))', gap: 8, marginBottom: 14 }}>
                    {brokerSelectorCards.map(item => {
                        const isSelected = selectedBrokerId === item.id || (!selectedBrokerId && item.id === '')
                        const heatTotal = Math.max(1, item.hot + item.warm + item.cold)
                        return (
                            <button
                                key={item.id || 'all-brokers'}
                                type="button"
                                onClick={() => item.canFilter && setSelectedBrokerId(item.id)}
                                disabled={!item.canFilter}
                                style={{
                                    minHeight: 82,
                                    borderRadius: 10,
                                    border: isSelected ? '1px solid #c8a66a' : '1px solid #e8e5e0',
                                    background: isSelected ? '#f8f1df' : '#fafafa',
                                    color: '#1a1a1a',
                                    padding: 10,
                                    textAlign: 'left',
                                    cursor: item.canFilter ? 'pointer' : 'default',
                                    opacity: item.canFilter ? 1 : 0.65,
                                    boxShadow: isSelected ? '0 8px 20px rgba(200,166,106,0.16)' : 'none',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                        {!item.resetCard && item.id !== 'unassigned' && (
                                            <LeadAvatar name={item.name} avatarUrl={item.photoUrl} size={28} />
                                        )}
                                        <strong style={{ display: 'block', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.resetCard && selectedBrokerId ? 'Ver todos' : item.name}
                                        </strong>
                                    </div>
                                    <span style={{ flexShrink: 0, color: isSelected ? '#6b4f1d' : '#64748b', fontSize: '0.68rem', fontWeight: 950 }}>
                                        {item.resetCard && selectedBrokerId ? 'geral' : item.total}
                                    </span>
                                </div>
                                {item.isGlobal && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', marginTop: 6, padding: '2px 7px', borderRadius: 999, background: '#111827', color: '#fff7ed', border: '1px solid rgba(200,166,106,0.55)', fontSize: '0.58rem', fontWeight: 950, textTransform: 'uppercase', letterSpacing: 0 }}>
                                        Agente global
                                    </span>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: `${Math.max(6, Math.round((item.hot / heatTotal) * 100))}% ${Math.max(6, Math.round((item.warm / heatTotal) * 100))}% 1fr`, height: 5, borderRadius: 999, overflow: 'hidden', background: '#edf0f2', marginTop: 10 }}>
                                    <span style={{ background: '#b45309' }} />
                                    <span style={{ background: '#c8a66a' }} />
                                    <span style={{ background: '#cbd5e1' }} />
                                </div>
                                <span style={{ display: 'block', marginTop: 7, color: '#64748b', fontSize: '0.64rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.hot} quente | {item.warm} morno | {item.fup} FUP
                                </span>
                            </button>
                        )
                    })}
                </div>

                <div
                    className="lead-crm-pipeline-scroller"
                    ref={pipelineScrollerRef}
                    onPointerDown={handlePipelinePointerDown}
                    onPointerMove={handlePipelinePointerMove}
                    onPointerUp={finishPipelineDrag}
                    onPointerCancel={finishPipelineDrag}
                    onClickCapture={handlePipelineClickCapture}
                    style={{
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    display: 'grid',
                    gridAutoFlow: 'column',
                    gridAutoColumns: 'minmax(188px, 208px)',
                    gap: 10,
                    alignItems: 'start',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    paddingBottom: 14,
                    scrollbarGutter: 'stable',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#c8a66a #f5f0ea',
                    cursor: isPipelineDragging ? 'grabbing' : 'grab',
                    userSelect: isPipelineDragging ? 'none' : 'auto',
                    touchAction: 'pan-y',
                }}>
                    {pipelineColumns.map(column => (
                        <section key={column.key} style={{ minHeight: 240, height: 560, overflowY: 'auto', borderRadius: 10, border: `1px solid ${column.border}`, background: '#fafafa' }}>
                            <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '9px 10px', background: '#fff', borderBottom: `1px solid ${column.border}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                                    <strong style={{ color: '#1a1a1a', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{column.label}</strong>
                                    <span style={{ display: 'inline-flex', minWidth: 24, justifyContent: 'center', padding: '2px 6px', borderRadius: 999, background: column.bg, color: column.color, fontSize: '0.66rem', fontWeight: 950 }}>
                                        {column.leads.length}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gap: 7, padding: 8 }}>
                                {column.leads.length === 0 ? (
                                    <div style={{ minHeight: 70, borderRadius: 8, border: '1px dashed #d8d3ca', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800 }}>
                                        Sem leads
                                    </div>
                                ) : column.leads.slice(0, 30).map(lead => {
                                    const score = getDisplayScore(lead)
                                    const leadStage = getLeadPipelineStageConfig(getPipelineStageForLead(lead))
                                    const temperature = getLeadTemperature(score, leadStage.key)
                                    const heatLevel = getHeatLevel(score)
                                    const whatsappUrl = buildWhatsAppLeadUrl(lead)
                                    return (
                                        <article key={`dashboard:${column.key}:${lead.id}`} style={{ borderRadius: 9, border: `1px solid ${temperature.border}`, background: '#fff', boxShadow: '0 4px 14px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
                                            <button
                                                type="button"
                                                onClick={() => openLeadDossier(lead.id)}
                                                style={{ width: '100%', border: 'none', background: 'transparent', padding: 9, textAlign: 'left', cursor: 'pointer' }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                    <LeadAvatar name={lead.lead_name} avatarUrl={lead.avatar_url} size={34} />
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'flex-start' }}>
                                                            <strong style={{ display: 'block', color: '#1a1a1a', fontSize: '0.74rem', lineHeight: 1.2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {lead.lead_name || 'Lead sem nome'}
                                                            </strong>
                                                            <span style={{ flexShrink: 0, color: temperature.color, background: temperature.bg, border: `1px solid ${temperature.border}`, borderRadius: 999, padding: '2px 6px', fontSize: '0.58rem', fontWeight: 950 }}>
                                                                {score}
                                                            </span>
                                                        </div>
                                                        <span style={{ display: 'block', color: temperature.color, fontSize: '0.62rem', fontWeight: 900, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {temperature.label} | {getPipelineReason(lead)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginTop: 8 }}>
                                                    {Array.from({ length: 5 }).map((_, index) => (
                                                        <span
                                                            key={index}
                                                            style={{
                                                                height: 5,
                                                                borderRadius: 999,
                                                                background: index < heatLevel ? temperature.color : '#edf0f2',
                                                                opacity: index < heatLevel ? 1 : 0.9,
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                <span style={{ display: 'block', color: '#475569', fontSize: '0.62rem', fontWeight: 750, marginTop: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {formatPhone(lead.lead_phone) || lead.lead_email || 'Sem contato'}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8', fontSize: '0.6rem', fontWeight: 750, marginTop: 4, minWidth: 0 }}>
                                                    {lead.broker_name && (
                                                        <LeadAvatar name={lead.broker_name} avatarUrl={lead.broker_photo_url} size={16} />
                                                    )}
                                                    <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {lead.broker_name || 'Sem corretor'} | {formatDate(latestLeadMovement(lead))}
                                                    </span>
                                                </div>
                                            </button>
                                            <div style={{ display: 'flex', borderTop: '1px solid #edf0f2' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => openLeadDossier(lead.id)}
                                                    style={{ flex: 1, border: 'none', background: '#fafafa', color: '#334155', padding: '6px 8px', fontSize: '0.62rem', fontWeight: 950, cursor: 'pointer' }}
                                                >
                                                    Abrir
                                                </button>
                                                {whatsappUrl && (
                                                    <a
                                                        href={whatsappUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ flex: 1, textAlign: 'center', textDecoration: 'none', background: '#ecfdf5', color: '#047857', padding: '6px 8px', fontSize: '0.62rem', fontWeight: 950 }}
                                                    >
                                                        WhatsApp
                                                    </a>
                                                )}
                                            </div>
                                        </article>
                                    )
                                })}
                                {column.leads.length > 30 && (
                                    <div style={{ color: '#64748b', textAlign: 'center', fontSize: '0.64rem', fontWeight: 850, padding: '6px 0' }}>
                                        +{column.leads.length - 30} no filtro atual
                                    </div>
                                )}
                            </div>
                        </section>
                    ))}
                </div>
            </section>

            {false && (
                <div style={{ display: 'none', marginBottom: 18, padding: 14, borderRadius: 12, border: '1px solid #d8e0ea', background: '#0f2433', boxShadow: '0 12px 30px rgba(15,36,51,0.14)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div>
                        <span style={{ display: 'block', color: '#93c5fd', fontSize: '0.68rem', fontWeight: 950, letterSpacing: 0 }}>PIPELINE IA</span>
                        <strong style={{ display: 'block', color: '#f8fafc', fontSize: '1rem', lineHeight: 1.25 }}>
                            Pipeline legado
                        </strong>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {[
                            { label: 'Entrada', value: pipelineTotals.entrada || 0, color: '#bfdbfe' },
                            { label: 'FUP', value: pipelineTotals.fup || 0, color: '#fde68a' },
                            { label: 'Quentes', value: pipelineTotals.leads_quentes || 0, color: '#fed7aa' },
                            { label: 'Visitas', value: pipelineTotals.visitas || 0, color: '#bbf7d0' },
                            { label: 'Contrato', value: pipelineTotals.contrato || 0, color: '#dcfce7' },
                        ].map(item => (
                            <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: item.color, border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.68rem', fontWeight: 900 }}>
                                {item.label}: {item.value}
                            </span>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(150px, 1fr)', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 12 }}>
                    <button
                        type="button"
                        onClick={() => setSelectedBrokerId('')}
                        style={{
                            minHeight: 74,
                            borderRadius: 9,
                            border: !selectedBrokerId ? '1px solid #93c5fd' : '1px solid rgba(255,255,255,0.1)',
                            background: !selectedBrokerId ? 'rgba(147,197,253,0.16)' : 'rgba(255,255,255,0.06)',
                            color: '#f8fafc',
                            padding: 10,
                            textAlign: 'left',
                            cursor: 'pointer',
                        }}
                    >
                        <strong style={{ display: 'block', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Todos</strong>
                        <span style={{ display: 'block', color: '#cbd5e1', fontSize: '0.68rem', fontWeight: 800, marginTop: 4 }}>{leads.length} leads</span>
                        <span style={{ display: 'block', color: '#fed7aa', fontSize: '0.64rem', fontWeight: 900, marginTop: 3 }}>{pipelineTotals.leads_quentes || 0} quentes</span>
                    </button>
                    {brokerPipelineOverview.map(item => {
                        const isSelected = selectedBrokerId === item.id
                        const canFilter = item.id !== 'unassigned'
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => canFilter && setSelectedBrokerId(item.id)}
                                disabled={!canFilter}
                                style={{
                                    minHeight: 74,
                                    borderRadius: 9,
                                    border: isSelected ? '1px solid #93c5fd' : '1px solid rgba(255,255,255,0.1)',
                                    background: isSelected ? 'rgba(147,197,253,0.16)' : 'rgba(255,255,255,0.06)',
                                    color: '#f8fafc',
                                    padding: 10,
                                    textAlign: 'left',
                                    cursor: canFilter ? 'pointer' : 'default',
                                    opacity: canFilter ? 1 : 0.72,
                                }}
                            >
                                <strong style={{ display: 'block', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</strong>
                                <span style={{ display: 'block', color: '#cbd5e1', fontSize: '0.68rem', fontWeight: 800, marginTop: 4 }}>{item.total} leads</span>
                                <span style={{ display: 'block', color: '#fed7aa', fontSize: '0.64rem', fontWeight: 900, marginTop: 3 }}>
                                    {item.hot} quentes | {item.fup} FUP
                                </span>
                            </button>
                        )
                    })}
                </div>

                <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(218px, 238px)', gap: 9, overflowX: 'auto', paddingBottom: 4 }}>
                    {pipelineColumns.map(column => (
                        <section key={column.key} style={{ minHeight: 260, maxHeight: 560, overflowY: 'auto', borderRadius: 10, border: `1px solid ${column.border}`, background: 'rgba(255,255,255,0.05)' }}>
                            <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '9px 10px', background: '#102a3b', borderBottom: `1px solid ${column.border}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                                    <strong style={{ color: '#f8fafc', fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{column.label}</strong>
                                    <span style={{ display: 'inline-flex', minWidth: 24, justifyContent: 'center', padding: '2px 6px', borderRadius: 999, background: column.bg, color: column.color, fontSize: '0.66rem', fontWeight: 950 }}>
                                        {column.leads.length}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gap: 7, padding: 8 }}>
                                {column.leads.length === 0 ? (
                                    <div style={{ minHeight: 74, borderRadius: 8, border: '1px dashed rgba(255,255,255,0.13)', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800 }}>
                                        Sem leads
                                    </div>
                                ) : column.leads.slice(0, 30).map(lead => {
                                    const score = getDisplayScore(lead)
                                    const leadStage = getLeadPipelineStageConfig(getPipelineStageForLead(lead))
                                    const whatsappUrl = buildWhatsAppLeadUrl(lead)
                                    return (
                                        <article key={`${column.key}:${lead.id}`} style={{ borderRadius: 8, border: `1px solid ${leadStage.border}`, background: '#173449', boxShadow: '0 4px 12px rgba(0,0,0,0.14)', overflow: 'hidden' }}>
                                            <button
                                                type="button"
                                                onClick={() => openLeadDossier(lead.id)}
                                                style={{ width: '100%', border: 'none', background: 'transparent', color: '#f8fafc', padding: 9, textAlign: 'left', cursor: 'pointer' }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                                    <strong style={{ display: 'block', color: '#ffffff', fontSize: '0.78rem', lineHeight: 1.2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {lead.lead_name || 'Lead sem nome'}
                                                    </strong>
                                                    <span style={{ flexShrink: 0, color: getScoreColor(score), background: 'rgba(255,255,255,0.08)', border: `1px solid ${getScoreColor(score)}33`, borderRadius: 999, padding: '2px 6px', fontSize: '0.62rem', fontWeight: 950 }}>
                                                        {score}
                                                    </span>
                                                </div>
                                                <span style={{ display: 'block', color: '#93c5fd', fontSize: '0.65rem', fontWeight: 850, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {getPipelineReason(lead)}
                                                </span>
                                                <span style={{ display: 'block', color: '#cbd5e1', fontSize: '0.64rem', fontWeight: 700, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {formatPhone(lead.lead_phone) || lead.lead_email || 'Sem contato'}
                                                </span>
                                                <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.62rem', fontWeight: 700, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {lead.broker_name || 'Sem corretor'} | {lead.source || lead.interest || 'origem aberta'}
                                                </span>
                                                <span style={{ display: 'block', color: '#64748b', fontSize: '0.6rem', fontWeight: 800, marginTop: 4 }}>
                                                    {formatDate(latestLeadMovement(lead))}
                                                </span>
                                            </button>
                                            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => openLeadDossier(lead.id)}
                                                    style={{ flex: 1, border: 'none', background: 'rgba(255,255,255,0.04)', color: '#bfdbfe', padding: '6px 8px', fontSize: '0.62rem', fontWeight: 950, cursor: 'pointer' }}
                                                >
                                                    Abrir
                                                </button>
                                                {whatsappUrl && (
                                                    <a
                                                        href={whatsappUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ flex: 1, textAlign: 'center', textDecoration: 'none', background: 'rgba(4,120,87,0.28)', color: '#bbf7d0', padding: '6px 8px', fontSize: '0.62rem', fontWeight: 950 }}
                                                    >
                                                        WhatsApp
                                                    </a>
                                                )}
                                            </div>
                                        </article>
                                    )
                                })}
                                {column.leads.length > 30 && (
                                    <div style={{ color: '#94a3b8', textAlign: 'center', fontSize: '0.64rem', fontWeight: 850, padding: '6px 0' }}>
                                        +{column.leads.length - 30} no filtro atual
                                    </div>
                                )}
                            </div>
                        </section>
                    ))}
                </div>
                </div>
            )}

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
                    <User size={14} color="#888" />
                    <select
                        value={selectedBrokerId}
                        onChange={e => setSelectedBrokerId(e.target.value)}
                        style={{
                            padding: '10px 12px', border: '1px solid #e0ddd8',
                            borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit',
                            background: '#fafafa', cursor: 'pointer', maxWidth: 220
                        }}
                    >
                        <option value="">Todos os corretores</option>
                        {brokers.map(broker => (
                            <option key={broker.id} value={broker.id}>{broker.name}</option>
                        ))}
                    </select>
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

            {!loading && alertOpenRadar.length > 0 && (
                <div style={{ marginBottom: 16, padding: 14, background: '#fffbeb', border: '1px solid rgba(180,83,9,0.22)', borderRadius: 10, boxShadow: '0 6px 18px rgba(180,83,9,0.07)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: '#fef3c7', color: '#b45309', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <BellRing size={17} />
                            </span>
                            <div>
                                <span style={{ display: 'block', color: '#b45309', fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>RADAR DE ALERTAS ABERTOS</span>
                                <p style={{ margin: '3px 0 0', color: '#78350f', fontSize: '0.78rem', fontWeight: 700 }}>
                                    Leads que abriram um imovel vindo de alerta salvo, push ou link direto.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Leads', value: alertOpenInsights.length },
                                { label: 'Aberturas', value: alertOpenEventsCount },
                                { label: '48h', value: recentAlertOpenCount },
                            ].map(item => (
                                <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#ffffff', color: '#92400e', border: '1px solid rgba(180,83,9,0.18)', fontSize: '0.68rem', fontWeight: 900 }}>
                                    {item.label}: {item.value}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                        {alertOpenRadar.map(item => {
                            const followup = item.latestFollowup
                            const followupStatus = followup ? getFollowUpStatus(followup) : ''
                            const statusCfg = followupStatus ? FOLLOWUP_STATUS_CONFIG[followupStatus] : null
                            const isUpdating = followup ? updatingFollowUpKey === getFollowUpUiKey(item.lead, followup) : false
                            const whatsappUrl = followup?.message ? buildWhatsAppFollowUpUrl(item.lead, String(followup.message)) : buildWhatsAppLeadUrl(item.lead)

                            return (
                                <div key={`alert-open:${item.lead.id}:${item.latestActivity?.id || item.openedAt || item.propertyTitle}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'center', padding: 10, background: '#ffffff', border: '1px solid rgba(180,83,9,0.18)', borderRadius: 8 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.lead.lead_name || 'Lead sem nome'}
                                        </strong>
                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.68rem', fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {formatPhone(item.lead.lead_phone) || item.lead.lead_email || 'Sem contato'}
                                        </span>
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <strong style={{ display: 'block', color: '#334155', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.propertyTitle || item.alertTitle || 'Match de alerta salvo'}
                                        </strong>
                                        <span style={{ display: 'block', color: '#92400e', fontSize: '0.66rem', fontWeight: 900, marginTop: 2 }}>
                                            {item.openedCount} abertura(s) via {item.sourceLabel}{item.matchScore ? ` | score ${item.matchScore}` : ''}
                                        </span>
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        {statusCfg ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.color}22`, borderRadius: 999, padding: '4px 7px', fontSize: '0.64rem', fontWeight: 900 }}>
                                                Follow-up {statusCfg.label}
                                            </span>
                                        ) : (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#92400e', background: '#fffbeb', border: '1px solid rgba(180,83,9,0.18)', borderRadius: 999, padding: '4px 7px', fontSize: '0.64rem', fontWeight: 900 }}>
                                                Sem abordagem pronta
                                            </span>
                                        )}
                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.64rem', fontWeight: 800, marginTop: 5 }}>
                                            {item.openedAt ? `Aberto em ${formatDate(item.openedAt)}` : 'Abertura registrada no dossie'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedLead(item.lead.id)}
                                            style={{ border: '1px solid rgba(180,83,9,0.18)', background: '#ffffff', color: '#92400e', borderRadius: 7, padding: '6px 8px', fontSize: '0.64rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >
                                            Abrir lead
                                        </button>
                                        {whatsappUrl && (
                                            <a
                                                href={whatsappUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={() => {
                                                    if (followup) void updateFollowUpStatus(item.lead, followup, 'sent')
                                                }}
                                                style={{ border: '1px solid rgba(4,120,87,0.18)', background: '#047857', color: '#ffffff', borderRadius: 7, padding: '6px 8px', fontSize: '0.64rem', fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap', opacity: isUpdating ? 0.72 : 1 }}
                                            >
                                                WhatsApp
                                            </a>
                                        )}
                                        {item.propertyUrl && (
                                            <a
                                                href={item.propertyUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ border: '1px solid rgba(15,23,42,0.1)', background: '#ffffff', color: '#334155', borderRadius: 7, padding: '6px 8px', fontSize: '0.64rem', fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap' }}
                                            >
                                                Imovel
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {!loading && followUpTasks.length > 0 && (
                <div style={{ marginBottom: 16, padding: 14, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ display: 'block', color: '#008069', fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>FILA DE ABORDAGENS</span>
                            <p style={{ margin: '3px 0 0', color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>
                                Matches de alertas salvos prontos para acao comercial.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Pendentes', value: followUpStats.pending, status: 'pending' },
                                { label: 'Enviadas', value: followUpStats.sent, status: 'sent' },
                                { label: 'Respondidas', value: followUpStats.responded, status: 'responded' },
                                { label: 'Convertidas', value: followUpStats.converted, status: 'converted' },
                            ].map(item => {
                                const cfg = FOLLOWUP_STATUS_CONFIG[item.status]
                                return (
                                    <span key={item.status} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.color}22`, color: cfg.color, fontSize: '0.72rem', fontWeight: 800 }}>
                                        {item.label}: {item.value}
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                    {activeFollowUpTasks.length > 0 ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {activeFollowUpTasks.map(task => {
                                const cfg = FOLLOWUP_STATUS_CONFIG[task.status] || FOLLOWUP_STATUS_CONFIG.pending
                                const actorLabel = getActionActorLabel(task.followup)
                                return (
                                    <div key={task.key} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'center', padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {task.lead.lead_name || 'Lead sem nome'}
                                            </strong>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {formatPhone(task.lead.lead_phone) || task.lead.lead_email || 'Sem contato'}
                                            </span>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <span style={{ display: 'block', color: '#334155', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {task.followup.property_title || task.followup.title || 'Match do alerta salvo'}
                                            </span>
                                            <span style={{ display: 'block', color: cfg.color, fontSize: '0.7rem', fontWeight: 800 }}>
                                                {cfg.label}{task.followup.match_score ? ` | ${task.followup.match_score}% aderente` : ''}
                                            </span>
                                            {actorLabel && (
                                                <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.66rem', fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    por {actorLabel}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedLead(task.lead.id)}
                                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(0,128,105,0.18)', background: '#fff', color: '#047857', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >
                                            <ExternalLink size={13} />
                                            Abrir lead
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div style={{ padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, color: '#64748b', fontSize: '0.78rem', fontWeight: 700 }}>
                            Todas as abordagens ativas ja foram convertidas ou descartadas.
                        </div>
                    )}
                </div>
            )}

            {!loading && dailyExecutionPlan.length > 0 && (
                <div style={{ marginBottom: 18, padding: 14, background: '#f8fafc', border: '1px solid #dbe3ee', borderRadius: 10, boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: '#0f172a', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Target size={17} />
                            </span>
                            <div>
                                <span style={{ display: 'block', color: '#0f172a', fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>ROTEIRO DIARIO IA</span>
                                <p style={{ margin: '3px 0 0', color: '#475569', fontSize: '0.78rem', fontWeight: 700 }}>
                                    Ordem de execucao do dia por SLA, interesse, distribuicao e conversao.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {[
                                { label: 'SLA', value: dailyExecutionPlanTotals.sla, color: '#b45309', bg: '#fffbeb' },
                                { label: 'Quentes', value: dailyExecutionPlanTotals.hot, color: '#2563eb', bg: '#eff6ff' },
                                { label: 'Sem corretor', value: dailyExecutionPlanTotals.unassigned, color: '#047857', bg: '#ecfdf5' },
                                { label: 'Conversao', value: dailyExecutionPlanTotals.conversion, color: '#7c3aed', bg: '#f5f3ff' },
                            ].map(item => (
                                <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: item.bg, color: item.color, border: `1px solid ${item.color}18`, fontSize: '0.66rem', fontWeight: 900 }}>
                                    {item.label}: {item.value}
                                </span>
                            ))}
                            <button
                                type="button"
                                onClick={() => copyExecutiveQueueBriefing(dailyExecutionPlanKey, dailyExecutionPlanBriefing)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#0f172a', color: '#ffffff', border: '1px solid rgba(15,23,42,0.18)', fontSize: '0.66rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                <Copy size={12} />
                                {copiedExecutiveQueueKey === dailyExecutionPlanKey ? 'Copiado' : 'Copiar roteiro'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(255px, 1fr))', gap: 10 }}>
                        {dailyExecutionPlan.map(item => {
                            const Icon = item.icon
                            const cfg = FOLLOWUP_STATUS_CONFIG[item.task.status] || FOLLOWUP_STATUS_CONFIG.pending
                            const isUpdating = updatingFollowUpKey === item.task.key
                            const message = String(item.task.followup.message || '').trim()
                            const whatsappUrl = message
                                ? buildWhatsAppFollowUpUrl(item.task.lead, message)
                                : buildWhatsAppLeadUrl(item.task.lead)

                            return (
                                <div key={item.key} style={{ display: 'grid', gap: 9, padding: 10, borderRadius: 9, background: '#ffffff', border: `1px solid ${item.color}18`, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                        <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
                                            <span style={{ width: 30, height: 30, borderRadius: 8, background: item.bg, color: item.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Icon size={15} />
                                            </span>
                                            <div style={{ minWidth: 0 }}>
                                                <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.title}
                                                </strong>
                                                <span style={{ display: 'block', color: '#64748b', fontSize: '0.64rem', fontWeight: 850, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.group} | {item.deadline}
                                                </span>
                                            </div>
                                        </div>
                                        <span style={{ color: item.color, background: item.bg, border: `1px solid ${item.color}18`, borderRadius: 999, padding: '4px 7px', fontSize: '0.58rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.task.lead.lead_name || 'Lead sem nome'}
                                        </strong>
                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.66rem', fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {formatPhone(item.task.lead.lead_phone) || item.task.lead.lead_email || 'sem contato'} | {item.task.lead.broker_name || 'Sem corretor'}
                                        </span>
                                        <span style={{ display: 'block', color: '#334155', fontSize: '0.68rem', fontWeight: 800, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.task.followup.property_title || item.task.followup.title || 'Match de alerta salvo'}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, color: '#475569', fontSize: '0.68rem', fontWeight: 750, lineHeight: 1.35 }}>
                                        {item.action}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ color: item.color, fontSize: '0.62rem', fontWeight: 900 }}>
                                            {item.task.ageHours > 0 ? `ha ${formatActionAge(item.task.ageHours)}` : 'novo'}
                                        </span>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedLead(item.task.lead.id)}
                                                style={{ border: `1px solid ${item.color}18`, background: '#ffffff', color: item.color, borderRadius: 7, padding: '5px 7px', fontSize: '0.62rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            >
                                                Abrir
                                            </button>
                                            {whatsappUrl && (
                                                <a
                                                    href={whatsappUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={() => {
                                                        if (item.task.status === 'pending') void updateFollowUpStatus(item.task.lead, item.task.followup, 'sent')
                                                    }}
                                                    style={{ border: '1px solid rgba(4,120,87,0.18)', background: '#047857', color: '#ffffff', borderRadius: 7, padding: '5px 7px', fontSize: '0.62rem', fontWeight: 900, textDecoration: 'none', opacity: isUpdating ? 0.72 : 1, whiteSpace: 'nowrap' }}
                                                >
                                                    WhatsApp
                                                </a>
                                            )}
                                            {item.task.status === 'sent' && (
                                                <button
                                                    type="button"
                                                    disabled={isUpdating}
                                                    onClick={() => updateFollowUpStatus(item.task.lead, item.task.followup, 'responded')}
                                                    style={{ border: '1px solid rgba(37,99,235,0.18)', background: '#eff6ff', color: '#2563eb', borderRadius: 7, padding: '5px 7px', fontSize: '0.62rem', fontWeight: 900, cursor: isUpdating ? 'wait' : 'pointer', opacity: isUpdating ? 0.72 : 1, whiteSpace: 'nowrap' }}
                                                >
                                                    Respondeu
                                                </button>
                                            )}
                                            {item.task.status === 'responded' && (
                                                <button
                                                    type="button"
                                                    disabled={isUpdating}
                                                    onClick={() => updateFollowUpStatus(item.task.lead, item.task.followup, 'converted')}
                                                    style={{ border: '1px solid rgba(124,58,237,0.18)', background: '#f5f3ff', color: '#7c3aed', borderRadius: 7, padding: '5px 7px', fontSize: '0.62rem', fontWeight: 900, cursor: isUpdating ? 'wait' : 'pointer', opacity: isUpdating ? 0.72 : 1, whiteSpace: 'nowrap' }}
                                                >
                                                    Converter
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {!loading && brokerPerformance.length > 0 && (
                <div style={{ marginBottom: 18, padding: 14, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: '#ecfdf5', color: '#047857', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <BarChart3 size={17} />
                            </span>
                            <div>
                                <span style={{ display: 'block', color: '#047857', fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>PERFORMANCE COMERCIAL</span>
                                <p style={{ margin: '3px 0 0', color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>
                                    Abordagens de alertas salvos na visao atual do CRM.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(92px, 1fr))', gap: 8 }}>
                            {[
                                { label: 'Abordagens', value: followUpTasks.length, icon: Target, color: '#0f172a' },
                                { label: 'Resposta', value: `${overallFollowUpPerformance.responseRate}%`, icon: MessageSquare, color: '#2563eb' },
                                { label: 'Conversao', value: `${overallFollowUpPerformance.conversionRate}%`, icon: TrendingUp, color: '#7c3aed' },
                            ].map(item => {
                                const Icon = item.icon
                                return (
                                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', borderRadius: 8, border: `1px solid ${item.color}18`, background: '#f8fafc', minWidth: 0 }}>
                                        <Icon size={14} color={item.color} style={{ flexShrink: 0 }} />
                                        <div style={{ minWidth: 0 }}>
                                            <strong style={{ display: 'block', color: item.color, fontSize: '0.88rem', lineHeight: 1 }}>{item.value}</strong>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.66rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{item.label}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                        {brokerPerformance.map(metric => {
                            const isSelected = selectedBrokerId === metric.id
                            return (
                                <div key={metric.id} style={{ padding: 12, border: `1px solid ${isSelected ? 'rgba(4,120,87,0.32)' : '#e2e8f0'}`, borderRadius: 9, background: isSelected ? '#f0fdf4' : '#f8fafc', minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {metric.name}
                                            </strong>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.68rem', fontWeight: 700, marginTop: 2 }}>
                                                {metric.active} ativa(s) | score medio {metric.avgScore}
                                            </span>
                                        </div>
                                        {metric.canFilter && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedBrokerId(isSelected ? '' : metric.id)}
                                                style={{
                                                    flexShrink: 0,
                                                    border: '1px solid rgba(4,120,87,0.18)',
                                                    background: isSelected ? '#047857' : '#ffffff',
                                                    color: isSelected ? '#ffffff' : '#047857',
                                                    borderRadius: 8,
                                                    padding: '6px 8px',
                                                    fontSize: '0.68rem',
                                                    fontWeight: 900,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {isSelected ? 'Todos' : 'Filtrar'}
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                                        {[
                                            { label: 'Pend.', value: metric.pending, color: '#b45309' },
                                            { label: 'Env.', value: metric.sent, color: '#047857' },
                                            { label: 'Resp.', value: metric.responded, color: '#2563eb' },
                                            { label: 'Conv.', value: metric.converted, color: '#7c3aed' },
                                        ].map(item => (
                                            <div key={item.label} style={{ padding: '6px 4px', borderRadius: 7, background: '#ffffff', border: `1px solid ${item.color}18`, textAlign: 'center', minWidth: 0 }}>
                                                <strong style={{ display: 'block', color: item.color, fontSize: '0.82rem', lineHeight: 1 }}>{item.value}</strong>
                                                <span style={{ display: 'block', color: '#64748b', fontSize: '0.62rem', fontWeight: 800, marginTop: 2 }}>{item.label}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ display: 'grid', gap: 7 }}>
                                        {[
                                            { label: 'Resposta', value: metric.responseRate, color: '#2563eb' },
                                            { label: 'Conversao', value: metric.conversionRate, color: '#7c3aed' },
                                        ].map(item => (
                                            <div key={item.label}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', fontSize: '0.68rem', fontWeight: 800, marginBottom: 4 }}>
                                                    <span>{item.label}</span>
                                                    <span>{item.value}%</span>
                                                </div>
                                                <div style={{ height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.min(100, Math.max(0, item.value))}%`, height: '100%', background: item.color, borderRadius: 999 }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {metric.lastActionAt && (
                                        <span style={{ display: 'block', marginTop: 9, color: '#64748b', fontSize: '0.66rem', fontWeight: 700 }}>
                                            Ultima acao: {formatDate(metric.lastActionAt)}
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {!loading && (actionRecommendations.length > 0 || persistedActionItemsCount > 0) && (
                <div style={{ marginBottom: 18, padding: 14, background: '#0f172a', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(34,197,94,0.14)', color: '#86efac', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Zap size={17} />
                            </span>
                            <div>
                                <span style={{ display: 'block', color: '#86efac', fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>CENTRAL DE ACAO IA</span>
                                <p style={{ margin: '3px 0 0', color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 600 }}>
                                    Proximas intervencoes calculadas pela fila comercial atual.
                                    {latestPersistedActionRunAt ? ` Ultima rotina: ${formatDate(latestPersistedActionRunAt)}.` : ''}
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Alertas abertos', value: alertOpenedNoContactTasks.length },
                                { label: 'SLA', value: stalePendingTasks.length + staleSentTasks.length },
                                { label: 'Sem corretor', value: unassignedFollowUpTasks.length },
                                { label: 'Rebalancear', value: redistributionTasks.length },
                                { label: 'Persistidas', value: persistedActionItemsCount },
                            ].map(item => (
                                <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.12)', fontSize: '0.68rem', fontWeight: 900 }}>
                                    {item.label}: {item.value}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: 10 }}>
                        {consultativePersistedRecommendationTasks.map(task => {
                            const item = task.item || {}
                            const itemType = String(item.type || '')
                            const itemTone = getRecommendationTypeTone(itemType)
                            const itemColor = itemTone.color
                            const ItemIcon = isPremiumRecommendationType(itemType)
                                ? Zap
                                : isBehaviorSignalRecommendationType(itemType)
                                    ? Star
                                    : itemType === 'alert_opened_no_contact' ? BellRing : itemType === 'stale_sent' ? Clock : AlertTriangle
                            const followup = getSearchAlertFollowups(task.lead).find((candidate: any) => getFollowUpActionKey(candidate) === String(item.followup_key || ''))
                            const recommendationFollowup = followup || (isPremiumRecommendationType(itemType) || isBehaviorSignalRecommendationType(itemType) ? item : null)
                            const whatsappUrl = item.message ? buildWhatsAppFollowUpUrl(task.lead, String(item.message)) : buildWhatsAppLeadUrl(task.lead)
                            const isUpdating = recommendationFollowup ? updatingFollowUpKey === getFollowUpUiKey(task.lead, recommendationFollowup) : false

                            return (
                                <div key={`consultative:${task.key}`} style={{ background: '#ffffff', borderRadius: 9, border: `1px solid ${itemColor}22`, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: 12, background: itemTone.bg }}>
                                        <div style={{ display: 'flex', gap: 9, minWidth: 0 }}>
                                            <span style={{ width: 30, height: 30, borderRadius: 8, background: '#ffffff', color: itemColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <ItemIcon size={16} />
                                            </span>
                                            <div style={{ minWidth: 0 }}>
                                                <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.title || getRecommendationTypeLabel(itemType)}
                                                </strong>
                                                <span style={{ display: 'block', color: '#64748b', fontSize: '0.68rem', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.action || 'Abordagem comercial recomendada'}
                                                </span>
                                            </div>
                                        </div>
                                        <span style={{ color: itemColor, fontSize: '0.66rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                                            {formatActionAge(Number(item.age_hours || 0))}
                                        </span>
                                    </div>
                                    <div style={{ display: 'grid', gap: 8, padding: 10 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.lead_name || task.lead.lead_name || 'Lead sem nome'}
                                            </strong>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.66rem', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.property_title || item.alert_title || item.reason || 'Sinal comercial persistido'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: itemColor, background: '#f8fafc', border: `1px solid ${itemColor}18`, borderRadius: 999, padding: '4px 7px', fontSize: '0.62rem', fontWeight: 900 }}>
                                                {getRecommendationTypeLabel(itemType)}
                                            </span>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedLead(task.lead.id)}
                                                    style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', borderRadius: 7, padding: '5px 7px', fontSize: '0.64rem', fontWeight: 900, cursor: 'pointer' }}
                                                >
                                                    Abrir
                                                </button>
                                                {whatsappUrl && (
                                                    <a
                                                        href={whatsappUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onClick={() => {
                                                            if (recommendationFollowup && getFollowUpStatus(recommendationFollowup) === 'pending') void updateFollowUpStatus(task.lead, recommendationFollowup, 'sent')
                                                        }}
                                                        style={{ border: '1px solid rgba(4,120,87,0.18)', background: '#047857', color: '#ffffff', borderRadius: 7, padding: '5px 7px', fontSize: '0.64rem', fontWeight: 900, textDecoration: 'none', opacity: isUpdating ? 0.72 : 1 }}
                                                    >
                                                        WhatsApp
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        {actionablePersistedRecommendationTasks.map(task => {
                            const item = task.item || {}
                            const isApplying = applyingRecommendationKey === task.key
                            const itemColor = item.type === 'redistribution' ? '#7c3aed' : '#047857'
                            return (
                                <div key={task.key} style={{ background: '#ffffff', borderRadius: 9, border: `1px solid ${itemColor}22`, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: 12, background: item.type === 'redistribution' ? '#f5f3ff' : '#ecfdf5' }}>
                                        <div style={{ display: 'flex', gap: 9, minWidth: 0 }}>
                                            <span style={{ width: 30, height: 30, borderRadius: 8, background: '#ffffff', color: itemColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {item.type === 'redistribution' ? <ArrowRightLeft size={16} /> : <Zap size={16} />}
                                            </span>
                                            <div style={{ minWidth: 0 }}>
                                                <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.title || 'Recomendacao persistida'}
                                                </strong>
                                                <span style={{ display: 'block', color: '#64748b', fontSize: '0.68rem', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    Sugerido para {item.suggested_broker_name || 'corretor indicado'}
                                                </span>
                                            </div>
                                        </div>
                                        <span style={{ color: itemColor, fontSize: '0.66rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                                            {formatActionAge(Number(item.age_hours || 0))}
                                        </span>
                                    </div>
                                    <div style={{ display: 'grid', gap: 8, padding: 10 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.lead_name || task.lead.lead_name || 'Lead sem nome'}
                                            </strong>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.66rem', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.property_title || item.alert_title || item.reason || 'Fila comercial persistida'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: itemColor, background: '#f8fafc', border: `1px solid ${itemColor}18`, borderRadius: 999, padding: '4px 7px', fontSize: '0.62rem', fontWeight: 900 }}>
                                                {item.type === 'redistribution' ? 'Rebalancear' : 'Distribuir'}
                                            </span>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedLead(task.lead.id)}
                                                    style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', borderRadius: 7, padding: '5px 7px', fontSize: '0.64rem', fontWeight: 900, cursor: 'pointer' }}
                                                >
                                                    Abrir
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isApplying}
                                                    onClick={() => applyActionRecommendation(task.lead, item)}
                                                    style={{ border: `1px solid ${itemColor}22`, background: itemColor, color: '#ffffff', borderRadius: 7, padding: '5px 7px', fontSize: '0.64rem', fontWeight: 900, cursor: isApplying ? 'wait' : 'pointer', opacity: isApplying ? 0.72 : 1 }}
                                                >
                                                    {isApplying ? 'Aplicando...' : 'Aplicar'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        {actionRecommendations.map(item => {
                            const Icon = item.icon
                            return (
                                <div key={item.key} style={{ background: '#ffffff', borderRadius: 9, border: `1px solid ${item.color}22`, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: 12, background: item.bg }}>
                                        <div style={{ display: 'flex', gap: 9, minWidth: 0 }}>
                                            <span style={{ width: 30, height: 30, borderRadius: 8, background: '#ffffff', color: item.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Icon size={16} />
                                            </span>
                                            <div style={{ minWidth: 0 }}>
                                                <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</strong>
                                                <span style={{ display: 'block', color: '#64748b', fontSize: '0.68rem', fontWeight: 700, marginTop: 2 }}>{item.description}</span>
                                            </div>
                                        </div>
                                        <span style={{ flexShrink: 0, minWidth: 28, height: 28, borderRadius: 999, background: item.color, color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 900 }}>
                                            {item.count}
                                        </span>
                                    </div>
                                    <div style={{ display: 'grid', gap: 8, padding: 10 }}>
                                        {item.tasks.map(task => {
                                            const statusCfg = FOLLOWUP_STATUS_CONFIG[task.status] || FOLLOWUP_STATUS_CONFIG.pending
                                            const actorLabel = getActionActorLabel(task.followup)
                                            return (
                                                <div key={`${item.key}:${task.key}`} style={{ display: 'grid', gap: 7, padding: 9, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                                        <div style={{ minWidth: 0 }}>
                                                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {task.lead.lead_name || 'Lead sem nome'}
                                                            </strong>
                                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.66rem', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {task.followup.property_title || task.followup.title || 'Match do alerta salvo'}
                                                            </span>
                                                        </div>
                                                        <span style={{ color: item.color, fontSize: '0.66rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                                                            {formatActionAge(task.ageHours)}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.color}18`, borderRadius: 999, padding: '4px 7px', fontSize: '0.62rem', fontWeight: 900 }}>
                                                            {statusCfg.label} | {task.brokerName}
                                                        </span>
                                                        {actorLabel && (
                                                            <span style={{ color: '#94a3b8', fontSize: '0.62rem', fontWeight: 900 }}>
                                                                por {actorLabel}
                                                            </span>
                                                        )}
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedLead(task.lead.id)}
                                                                style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', borderRadius: 7, padding: '5px 7px', fontSize: '0.64rem', fontWeight: 900, cursor: 'pointer' }}
                                                            >
                                                                Abrir
                                                            </button>
                                                            {task.status === 'pending' && (
                                                                <button
                                                                    type="button"
                                                                    disabled={updatingFollowUpKey === task.key}
                                                                    onClick={() => updateFollowUpStatus(task.lead, task.followup, 'sent')}
                                                                    style={{ border: '1px solid rgba(4,120,87,0.18)', background: '#047857', color: '#ffffff', borderRadius: 7, padding: '5px 7px', fontSize: '0.64rem', fontWeight: 900, cursor: updatingFollowUpKey === task.key ? 'wait' : 'pointer', opacity: updatingFollowUpKey === task.key ? 0.72 : 1 }}
                                                                >
                                                                    Enviada
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        <span style={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 800 }}>
                                            Acao: {item.action}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                        {actionRecommendations.length === 0 && actionablePersistedRecommendationTasks.length === 0 && consultativePersistedRecommendationTasks.length === 0 && (
                            <div style={{ gridColumn: '1 / -1', padding: 12, background: '#ffffff', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 9, color: '#475569', fontSize: '0.76rem', fontWeight: 800 }}>
                                Fila persistida sincronizada. Nenhuma nova intervencao critica na visao atual.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!loading && (appliedRecommendationAuditItems.length > 0 || appliedRecommendationCount > 0) && (
                <div style={{ marginBottom: 18, padding: 14, background: '#ffffff', border: '1px solid #dbe3ee', borderRadius: 10, boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: '#ecfdf5', color: '#047857', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <CheckCircle2 size={17} />
                            </span>
                            <div>
                                <span style={{ display: 'block', color: '#047857', fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>AUDITORIA DA ACAO IA</span>
                                <p style={{ margin: '3px 0 0', color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>
                                    Vinculos internos gravados no dossie comercial dos leads.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#f0fdf4', color: '#047857', border: '1px solid rgba(4,120,87,0.16)', fontSize: '0.68rem', fontWeight: 900 }}>
                                Registradas: {appliedRecommendationCount}
                            </span>
                            {auditFiltersActive && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', border: '1px solid rgba(37,99,235,0.16)', fontSize: '0.68rem', fontWeight: 900 }}>
                                    Exibindo: {filteredAppliedRecommendationAuditItems.length}
                                </span>
                            )}
                            {latestAppliedRecommendationAt && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', fontSize: '0.68rem', fontWeight: 900 }}>
                                    Ultima: {formatDate(latestAppliedRecommendationAt)}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => copyExecutiveQueueBriefing(auditTrailReportKey, auditTrailReportBriefing)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#0f172a', color: '#ffffff', border: '1px solid rgba(15,23,42,0.18)', fontSize: '0.68rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                <Copy size={12} />
                                {copiedExecutiveQueueKey === auditTrailReportKey ? 'Copiada' : 'Copiar auditoria'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
                        {[
                            { label: 'Distribuicoes', value: appliedDistributionCount, color: '#047857', bg: '#ecfdf5' },
                            { label: 'Rebalanceamentos', value: appliedRedistributionCount, color: '#7c3aed', bg: '#f5f3ff' },
                            { label: 'Consultivas', value: resolvedConsultativeRecommendationCount, color: '#b45309', bg: '#fffbeb' },
                            { label: 'Destinos', value: auditBrokerOptions.length, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'No filtro', value: filteredAppliedRecommendationAuditItems.length, color: '#0f172a', bg: '#f8fafc' },
                        ].map(item => (
                            <div key={item.label} style={{ padding: 10, borderRadius: 8, background: item.bg, border: `1px solid ${item.color}18`, minWidth: 0 }}>
                                <strong style={{ display: 'block', color: item.color, fontSize: '1rem', lineHeight: 1 }}>{item.value}</strong>
                                <span style={{ display: 'block', color: '#64748b', fontSize: '0.66rem', fontWeight: 900, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                        <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                            <span style={{ color: '#64748b', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase' }}>Destino</span>
                            <select
                                value={auditBrokerFilter}
                                onChange={event => setAuditBrokerFilter(event.target.value)}
                                style={{ width: '100%', border: '1px solid #dbe3ee', borderRadius: 8, background: '#ffffff', color: '#0f172a', padding: '8px 9px', fontSize: '0.74rem', fontWeight: 800, fontFamily: 'inherit' }}
                            >
                                <option value="all">Todos os destinos</option>
                                {auditBrokerOptions.map(option => (
                                    <option key={option.id} value={option.id}>
                                        {option.name} ({option.count})
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                            <span style={{ color: '#64748b', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase' }}>Tipo</span>
                            <select
                                value={auditTypeFilter}
                                onChange={event => setAuditTypeFilter(event.target.value)}
                                style={{ width: '100%', border: '1px solid #dbe3ee', borderRadius: 8, background: '#ffffff', color: '#0f172a', padding: '8px 9px', fontSize: '0.74rem', fontWeight: 800, fontFamily: 'inherit' }}
                            >
                                <option value="all">Todos os tipos</option>
                                {auditTypeOptions.map(option => (
                                    <option key={option.type} value={option.type}>
                                        {option.label} ({option.count})
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                            <span style={{ color: '#64748b', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase' }}>Periodo</span>
                            <select
                                value={auditPeriodFilter}
                                onChange={event => setAuditPeriodFilter(event.target.value)}
                                style={{ width: '100%', border: '1px solid #dbe3ee', borderRadius: 8, background: '#ffffff', color: '#0f172a', padding: '8px 9px', fontSize: '0.74rem', fontWeight: 800, fontFamily: 'inherit' }}
                            >
                                <option value="all">Todo o historico</option>
                                <option value="7d">Ultimos 7 dias</option>
                                <option value="30d">Ultimos 30 dias</option>
                            </select>
                        </label>
                        <button
                            type="button"
                            disabled={!auditFiltersActive}
                            onClick={() => {
                                setAuditBrokerFilter('all')
                                setAuditTypeFilter('all')
                                setAuditPeriodFilter('all')
                            }}
                            style={{ alignSelf: 'end', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid #dbe3ee', background: auditFiltersActive ? '#ffffff' : '#f8fafc', color: auditFiltersActive ? '#334155' : '#94a3b8', borderRadius: 8, padding: '8px 9px', fontSize: '0.72rem', fontWeight: 900, cursor: auditFiltersActive ? 'pointer' : 'default', minHeight: 35 }}
                        >
                            <Filter size={13} />
                            Limpar filtros
                        </button>
                    </div>

                    {filteredAppliedRecommendationAuditItems.length > 0 ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {appliedRecommendationAuditItems.map(item => {
                                const tone = getRecommendationTypeTone(item.type)
                                const auditStatusLabel = item.auditStatus === 'applied'
                                    ? 'Aplicada'
                                    : item.auditStatus === 'sent'
                                        ? 'Enviada'
                                        : item.auditStatus === 'responded'
                                            ? 'Respondida'
                                            : item.auditStatus === 'converted'
                                                ? 'Convertida'
                                                : item.auditStatus === 'dismissed'
                                                    ? 'Descartada'
                                                    : 'Resolvida'

                                return (
                                    <div key={item.key} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'center', padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: tone.color, background: '#ffffff', border: `1px solid ${tone.color}18`, borderRadius: 999, padding: '4px 7px', fontSize: '0.62rem', fontWeight: 900, marginBottom: 5 }}>
                                                {item.label}
                                            </span>
                                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.lead.lead_name || 'Lead sem nome'}
                                            </strong>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <strong style={{ display: 'block', color: '#334155', fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.title}
                                            </strong>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.66rem', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.propertyTitle || item.reason || 'Recomendacao registrada'}
                                            </span>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase' }}>Destino</span>
                                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.targetBrokerName}
                                            </strong>
                                            <span style={{ display: 'inline-flex', width: 'fit-content', marginTop: 3, color: tone.color, background: tone.bg, border: `1px solid ${tone.color}18`, borderRadius: 999, padding: '3px 6px', fontSize: '0.58rem', fontWeight: 900 }}>
                                                {auditStatusLabel}
                                            </span>
                                            {item.sourceBrokerName && (
                                                <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.63rem', fontWeight: 700, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    Origem: {item.sourceBrokerName}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                                            <div style={{ display: 'grid', justifyItems: 'end', gap: 2, minWidth: 0 }}>
                                                <span style={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                                    {formatDate(item.appliedAt)}
                                                </span>
                                                {item.actorLabel && (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.62rem', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
                                                        por {item.actorLabel}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedLead(item.lead.id)}
                                                style={{ border: `1px solid ${tone.color}18`, background: '#ffffff', color: tone.color, borderRadius: 7, padding: '5px 7px', fontSize: '0.64rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            >
                                                Abrir
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                            {filteredAppliedRecommendationAuditItems.length > appliedRecommendationAuditItems.length && (
                                <div style={{ padding: 9, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textAlign: 'center' }}>
                                    Mostrando {appliedRecommendationAuditItems.length} de {filteredAppliedRecommendationAuditItems.length} acoes neste filtro.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, color: '#64748b', fontSize: '0.76rem', fontWeight: 800 }}>
                            Nenhuma acao aplicada encontrada para esses filtros.
                        </div>
                    )}
                </div>
            )}

            {!loading && (appliedRecommendationCount > 0 || aiExecutiveFollowUps.length > 0) && (
                <div style={{ marginBottom: 18, padding: 14, background: '#ffffff', border: '1px solid #dbe3ee', borderRadius: 10, boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: aiExecutiveHealth.bg, color: aiExecutiveHealth.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <TrendingUp size={17} />
                            </span>
                            <div>
                                <span style={{ display: 'block', color: aiExecutiveHealth.color, fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>PLACAR EXECUTIVO IA</span>
                                <p style={{ margin: '3px 0 0', color: '#475569', fontSize: '0.78rem', fontWeight: 650 }}>
                                    {aiExecutiveHealth.summary}
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => copyExecutiveQueueBriefing(aiExecutiveSummaryKey, aiExecutiveSummaryBriefing)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#ffffff', color: '#334155', border: '1px solid rgba(15,23,42,0.12)', fontSize: '0.66rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                <Copy size={12} />
                                {copiedExecutiveQueueKey === aiExecutiveSummaryKey ? 'Copiado' : 'Copiar resumo'}
                            </button>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: aiExecutiveHealth.bg, color: aiExecutiveHealth.color, border: `1px solid ${aiExecutiveHealth.color}18`, fontSize: '0.68rem', fontWeight: 900 }}>
                                {aiExecutiveHealth.label}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8, marginBottom: 12 }}>
                        {[
                            { label: 'Acoes IA', value: appliedRecommendationCount, color: '#0f172a', bg: '#f8fafc', icon: Zap },
                            { label: 'Leads tocados', value: aiExecutiveLeadIds.size, color: '#047857', bg: '#ecfdf5', icon: Target },
                            { label: 'Resolucao', value: `${aiExecutiveResolutionRate}%`, color: '#2563eb', bg: '#eff6ff', icon: CheckCircle2 },
                            { label: 'Resposta', value: `${aiExecutiveResponseRate}%`, color: '#0f766e', bg: '#f0fdfa', icon: MessageSquare },
                            { label: 'Conversao', value: `${aiExecutiveConversionRate}%`, color: '#7c3aed', bg: '#f5f3ff', icon: Trophy },
                            { label: 'Risco SLA', value: aiExecutiveSlaRisk, color: aiExecutiveSlaRisk > 0 ? '#b45309' : '#64748b', bg: aiExecutiveSlaRisk > 0 ? '#fffbeb' : '#f8fafc', icon: AlertTriangle },
                        ].map(item => {
                            const Icon = item.icon
                            return (
                                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, background: item.bg, border: `1px solid ${item.color}18`, minWidth: 0 }}>
                                    <span style={{ width: 26, height: 26, borderRadius: 8, background: '#ffffff', color: item.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Icon size={14} />
                                    </span>
                                    <div style={{ minWidth: 0 }}>
                                        <strong style={{ display: 'block', color: item.color, fontSize: '0.95rem', lineHeight: 1 }}>
                                            {item.value}
                                        </strong>
                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.64rem', fontWeight: 900, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.label}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
                        {[
                            { label: 'Pendentes', value: aiExecutiveStatuses.pending, color: '#b45309', bg: '#fffbeb' },
                            { label: 'Enviadas', value: aiExecutiveStatuses.sent, color: '#047857', bg: '#ecfdf5' },
                            { label: 'Respondidas', value: aiExecutiveStatuses.responded, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Convertidas', value: aiExecutiveStatuses.converted, color: '#7c3aed', bg: '#f5f3ff' },
                        ].map(item => (
                            <div key={item.label} style={{ display: 'grid', gap: 5, padding: 9, borderRadius: 8, border: `1px solid ${item.color}16`, background: '#ffffff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: item.color, fontSize: '0.68rem', fontWeight: 900 }}>
                                    <span>{item.label}</span>
                                    <span>{item.value}</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min(100, percent(item.value, Math.max(1, aiExecutiveFollowUps.length)))}%`, height: '100%', background: item.color, borderRadius: 999 }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {aiExecutiveAgendaItems.length > 0 && (
                        <div style={{ marginTop: 12, display: 'grid', gap: 8, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                <div>
                                    <span style={{ display: 'block', color: '#0f172a', fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>PAUTA EXECUTIVA IA</span>
                                    <span style={{ display: 'block', color: '#64748b', fontSize: '0.66rem', fontWeight: 800, marginTop: 2 }}>
                                        Prioridades para a proxima reuniao comercial
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#ffffff', color: '#334155', border: '1px solid rgba(15,23,42,0.12)', fontSize: '0.62rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                                        {completedExecutiveAgendaCount}/{aiExecutiveAgendaItems.length} tratada(s)
                                    </span>
                                    {completedExecutiveAgendaCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setCompletedExecutiveAgendaKeys([])}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#ffffff', color: '#64748b', border: '1px solid rgba(100,116,139,0.18)', fontSize: '0.62rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >
                                            Limpar
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => copyExecutiveQueueBriefing(aiExecutiveAgendaKey, aiExecutiveAgendaBriefing)}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#ffffff', color: '#334155', border: '1px solid rgba(15,23,42,0.12)', fontSize: '0.64rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                        <Copy size={12} />
                                        {copiedExecutiveQueueKey === aiExecutiveAgendaKey ? 'Copiada' : 'Copiar pauta'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copyExecutiveQueueBriefing(aiExecutiveMeetingMinuteKey, aiExecutiveMeetingMinuteBriefing)}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#0f172a', color: '#ffffff', border: '1px solid rgba(15,23,42,0.14)', fontSize: '0.64rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                        <FileText size={12} />
                                        {copiedExecutiveQueueKey === aiExecutiveMeetingMinuteKey ? 'Copiada' : 'Copiar ata'}
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gap: 4 }}>
                                <div style={{ height: 7, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                                    <div style={{ width: `${aiExecutiveAgendaProgressRate}%`, height: '100%', background: aiExecutiveAgendaProgressRate === 100 ? '#047857' : '#2563eb', borderRadius: 999 }} />
                                </div>
                                <span style={{ color: '#64748b', fontSize: '0.6rem', fontWeight: 800 }}>
                                    Checklist de reuniao: {aiExecutiveAgendaProgressRate}% concluido nesta tela
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 8 }}>
                                {aiExecutiveAgendaItems.map(item => {
                                    const Icon = item.icon
                                    const isAgendaSelected = activeExecutiveAgendaKey === item.key
                                    const isAgendaDone = completedExecutiveAgendaSet.has(item.key)
                                    return (
                                        <div
                                            key={item.key}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedExecutiveAgendaKey(item.key)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') setSelectedExecutiveAgendaKey(item.key)
                                            }}
                                            style={{ display: 'grid', gap: 7, padding: 9, borderRadius: 8, background: isAgendaSelected ? item.bg : '#ffffff', border: `1px solid ${isAgendaSelected ? item.color : `${item.color}18`}`, minWidth: 0, textAlign: 'left', cursor: 'pointer', opacity: isAgendaDone ? 0.76 : 1 }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <span style={{ width: 26, height: 26, borderRadius: 8, background: item.bg, color: item.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <Icon size={14} />
                                                </span>
                                                <strong style={{ color: item.color, fontSize: '0.9rem', lineHeight: 1 }}>
                                                    {item.count}
                                                </strong>
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.title}
                                                </strong>
                                                <span style={{ display: 'block', color: '#64748b', fontSize: '0.62rem', fontWeight: 750, marginTop: 2, lineHeight: 1.35 }}>
                                                    {item.description}
                                                </span>
                                            </div>
                                            <span style={{ display: 'block', color: item.color, fontSize: '0.62rem', fontWeight: 900, lineHeight: 1.35 }}>
                                                {item.action}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    toggleExecutiveAgendaDone(item.key)
                                                }}
                                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, width: '100%', padding: '6px 8px', borderRadius: 7, border: `1px solid ${isAgendaDone ? 'rgba(4,120,87,0.22)' : `${item.color}18`}`, background: isAgendaDone ? '#ecfdf5' : '#ffffff', color: isAgendaDone ? '#047857' : item.color, fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer' }}
                                            >
                                                <CheckCircle2 size={12} />
                                                {isAgendaDone ? 'Tratada' : 'Marcar tratada'}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                            {activeExecutiveAgendaItem && aiExecutiveAgendaLeadQueue.length > 0 && (
                                <div style={{ display: 'grid', gap: 8, padding: 9, borderRadius: 8, background: '#ffffff', border: `1px solid ${activeExecutiveAgendaItem.color}18` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ color: activeExecutiveAgendaItem.color, fontSize: '0.68rem', fontWeight: 900 }}>
                                            Leads da pauta: {activeExecutiveAgendaItem.title}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                            <span style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 800 }}>
                                                Top {aiExecutiveAgendaLeadQueue.length} por urgencia
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => copyExecutiveQueueBriefing(aiExecutiveAgendaLeadsKey, aiExecutiveAgendaLeadsBriefing)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 999, background: '#ffffff', color: '#334155', border: '1px solid rgba(15,23,42,0.12)', fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            >
                                                <Copy size={11} />
                                                {copiedExecutiveQueueKey === aiExecutiveAgendaLeadsKey ? 'Copiado' : 'Copiar leads'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => copyExecutiveQueueBriefing(aiExecutiveOperationalHandoffKey, aiExecutiveOperationalHandoffBriefing)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 999, background: activeExecutiveAgendaItem.color, color: '#ffffff', border: `1px solid ${activeExecutiveAgendaItem.color}`, fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            >
                                                <Send size={11} />
                                                {copiedExecutiveQueueKey === aiExecutiveOperationalHandoffKey ? 'Copiado' : 'Copiar encaminhamento'}
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gap: 7 }}>
                                        {aiExecutiveAgendaLeadQueue.map(task => {
                                            const whatsappUrl = task.followup?.message
                                                ? buildWhatsAppFollowUpUrl(task.lead, String(task.followup.message))
                                                : buildWhatsAppLeadUrl(task.lead)
                                            const statusConfig = FOLLOWUP_STATUS_CONFIG[task.status] || FOLLOWUP_STATUS_CONFIG.pending
                                            const isUpdating = updatingFollowUpKey === task.key

                                            return (
                                                <div key={`agenda-lead:${activeExecutiveAgendaKey}:${task.key}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 9, alignItems: 'center', padding: 9, borderRadius: 8, border: `1px solid ${task.isRisk ? 'rgba(180,83,9,0.22)' : 'rgba(15,23,42,0.08)'}`, background: task.isRisk ? '#fffbeb' : '#f8fafc' }}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {task.lead.lead_name || 'Lead sem nome'}
                                                        </strong>
                                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.62rem', fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            Score {task.score} | {formatPhone(task.lead.lead_phone) || task.lead.lead_email || 'sem contato'}
                                                        </span>
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 7px', borderRadius: 999, color: statusConfig.color, background: statusConfig.bg, border: `1px solid ${statusConfig.color}18`, fontSize: '0.58rem', fontWeight: 900, marginBottom: 4 }}>
                                                            {statusConfig.label}{task.ageHours > 0 ? ` ha ${formatActionAge(task.ageHours)}` : ''}
                                                        </span>
                                                        <strong style={{ display: 'block', color: '#334155', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {task.followup.property_title || task.followup.title || 'Match de alerta salvo'}
                                                        </strong>
                                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.6rem', fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {task.brokerLabel}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedLead(task.lead.id)}
                                                            style={{ border: `1px solid ${activeExecutiveAgendaItem.color}18`, background: '#ffffff', color: activeExecutiveAgendaItem.color, borderRadius: 7, padding: '5px 7px', fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                        >
                                                            Abrir lead
                                                        </button>
                                                        {whatsappUrl && (
                                                            <a
                                                                href={whatsappUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                onClick={() => {
                                                                    if (task.status === 'pending') void updateFollowUpStatus(task.lead, task.followup, 'sent')
                                                                }}
                                                                style={{ border: '1px solid rgba(4,120,87,0.18)', background: '#047857', color: '#ffffff', borderRadius: 7, padding: '5px 7px', fontSize: '0.6rem', fontWeight: 900, textDecoration: 'none', opacity: isUpdating ? 0.72 : 1, whiteSpace: 'nowrap' }}
                                                            >
                                                                WhatsApp
                                                            </a>
                                                        )}
                                                        {task.status === 'pending' && (
                                                            <button
                                                                type="button"
                                                                disabled={isUpdating}
                                                                onClick={() => updateFollowUpStatus(task.lead, task.followup, 'sent')}
                                                                style={{ border: '1px solid rgba(4,120,87,0.18)', background: '#ecfdf5', color: '#047857', borderRadius: 7, padding: '5px 7px', fontSize: '0.6rem', fontWeight: 900, cursor: isUpdating ? 'wait' : 'pointer', opacity: isUpdating ? 0.72 : 1, whiteSpace: 'nowrap' }}
                                                            >
                                                                Enviada
                                                            </button>
                                                        )}
                                                        {task.status === 'sent' && (
                                                            <button
                                                                type="button"
                                                                disabled={isUpdating}
                                                                onClick={() => updateFollowUpStatus(task.lead, task.followup, 'responded')}
                                                                style={{ border: '1px solid rgba(37,99,235,0.18)', background: '#eff6ff', color: '#2563eb', borderRadius: 7, padding: '5px 7px', fontSize: '0.6rem', fontWeight: 900, cursor: isUpdating ? 'wait' : 'pointer', opacity: isUpdating ? 0.72 : 1, whiteSpace: 'nowrap' }}
                                                            >
                                                                Respondeu
                                                            </button>
                                                        )}
                                                        {task.status === 'responded' && (
                                                            <button
                                                                type="button"
                                                                disabled={isUpdating}
                                                                onClick={() => updateFollowUpStatus(task.lead, task.followup, 'converted')}
                                                                style={{ border: '1px solid rgba(124,58,237,0.18)', background: '#f5f3ff', color: '#7c3aed', borderRadius: 7, padding: '5px 7px', fontSize: '0.6rem', fontWeight: 900, cursor: isUpdating ? 'wait' : 'pointer', opacity: isUpdating ? 0.72 : 1, whiteSpace: 'nowrap' }}
                                                            >
                                                                Converter
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {aiExecutiveBrokerQueue.length > 0 && (
                        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ display: 'block', color: '#0f172a', fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>FILA EXECUTIVA POR RESPONSAVEL</span>
                                <span style={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 800 }}>
                                    Prioridade por SLA, resposta e score medio
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
                                {aiExecutiveBrokerQueue.map(metric => {
                                    const lead = metric.topLead as LeadData | null
                                    const followup = metric.topFollowup
                                    const whatsappUrl = lead && followup?.message
                                        ? buildWhatsAppFollowUpUrl(lead, String(followup.message))
                                        : lead
                                            ? buildWhatsAppLeadUrl(lead)
                                            : ''
                                    const statusLabel = FOLLOWUP_STATUS_CONFIG[metric.topStatus]?.label || 'Pendente'
                                    const isSelected = metric.canFilter && selectedBrokerId === metric.id
                                    const isUpdating = lead && followup ? updatingFollowUpKey === getFollowUpUiKey(lead, followup) : false
                                    const executiveBriefing = [
                                        `Briefing executivo IA - ${metric.name}`,
                                        `Prioridade: ${metric.nextAction} (${metric.health.label})`,
                                        `Fila: ${metric.total} follow-up(s) IA | ${metric.risk} em risco SLA`,
                                        `Performance: ${metric.responseRate}% resposta | ${metric.conversionRate}% conversao | score medio ${metric.avgScore}`,
                                        lead ? `Lead prioritario: ${lead.lead_name || 'Lead sem nome'} - ${formatPhone(lead.lead_phone) || lead.lead_email || 'sem contato'}` : '',
                                        followup ? `Contexto: ${followup.property_title || followup.title || 'Match de alerta salvo'}` : '',
                                        `Status: ${statusLabel}${metric.topAgeHours > 0 ? ` ha ${formatActionAge(metric.topAgeHours)}` : ''}`,
                                        `Acao sugerida: ${metric.nextAction}`,
                                    ].filter(Boolean).join('\n')

                                    return (
                                        <div key={`ai-broker-queue:${metric.key}`} style={{ display: 'grid', gap: 9, padding: 10, borderRadius: 8, border: `1px solid ${metric.health.color}18`, background: metric.health.bg }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: metric.health.color, background: '#ffffff', border: `1px solid ${metric.health.color}18`, borderRadius: 999, padding: '4px 7px', fontSize: '0.58rem', fontWeight: 900, marginBottom: 5 }}>
                                                        {metric.health.label}
                                                    </span>
                                                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {metric.name}
                                                    </strong>
                                                    <span style={{ display: 'block', color: '#64748b', fontSize: '0.62rem', fontWeight: 850, marginTop: 2 }}>
                                                        {metric.nextAction} | score medio {metric.avgScore}
                                                    </span>
                                                </div>
                                                {metric.canFilter && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedBrokerId(isSelected ? '' : metric.id)}
                                                        style={{ flexShrink: 0, border: `1px solid ${metric.health.color}22`, background: isSelected ? metric.health.color : '#ffffff', color: isSelected ? '#ffffff' : metric.health.color, borderRadius: 7, padding: '5px 7px', fontSize: '0.62rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                    >
                                                        {isSelected ? 'Todos' : 'Filtrar'}
                                                    </button>
                                                )}
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                                                {[
                                                    { label: 'Total', value: metric.total, color: '#0f172a' },
                                                    { label: 'Risco', value: metric.risk, color: metric.risk > 0 ? '#b45309' : '#64748b' },
                                                    { label: 'Resp.', value: `${metric.responseRate}%`, color: '#2563eb' },
                                                    { label: 'Conv.', value: `${metric.conversionRate}%`, color: '#7c3aed' },
                                                ].map(item => (
                                                    <div key={item.label} style={{ padding: '6px 4px', borderRadius: 7, background: '#ffffff', border: `1px solid ${item.color}16`, textAlign: 'center', minWidth: 0 }}>
                                                        <strong style={{ display: 'block', color: item.color, fontSize: '0.78rem', lineHeight: 1 }}>
                                                            {item.value}
                                                        </strong>
                                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.58rem', fontWeight: 900, marginTop: 2 }}>
                                                            {item.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {lead && (
                                                <div style={{ display: 'grid', gap: 7, padding: 8, borderRadius: 7, background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)' }}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <span style={{ display: 'block', color: metric.health.color, fontSize: '0.6rem', fontWeight: 900 }}>
                                                            Priorizar: {statusLabel}{metric.topAgeHours > 0 ? ` ha ${formatActionAge(metric.topAgeHours)}` : ''}
                                                        </span>
                                                        <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.72rem', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {lead.lead_name || 'Lead sem nome'}
                                                        </strong>
                                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.6rem', fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {followup?.property_title || followup?.title || formatPhone(lead.lead_phone) || lead.lead_email || 'Sem contato'}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyExecutiveQueueBriefing(metric.key, executiveBriefing)}
                                                            style={{ border: '1px solid rgba(15,23,42,0.1)', background: '#ffffff', color: '#334155', borderRadius: 7, padding: '5px 7px', fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                        >
                                                            {copiedExecutiveQueueKey === metric.key ? 'Copiado' : 'Copiar briefing'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openLeadDossier(lead.id)}
                                                            style={{ border: `1px solid ${metric.health.color}18`, background: '#ffffff', color: metric.health.color, borderRadius: 7, padding: '5px 7px', fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                        >
                                                            Abrir lead
                                                        </button>
                                                        {whatsappUrl && (
                                                            <a
                                                                href={whatsappUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                onClick={() => {
                                                                    if (followup && metric.topStatus === 'pending') void updateFollowUpStatus(lead, followup, 'sent')
                                                                }}
                                                                style={{ border: '1px solid rgba(4,120,87,0.18)', background: '#047857', color: '#ffffff', borderRadius: 7, padding: '5px 7px', fontSize: '0.6rem', fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap', opacity: isUpdating ? 0.72 : 1 }}
                                                            >
                                                                WhatsApp
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {aiExecutiveLeadDrilldown.length > 0 && (
                        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ display: 'block', color: '#0f172a', fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>LEADS QUE EXPLICAM O PLACAR</span>
                                <span style={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 800 }}>
                                    Top {aiExecutiveLeadDrilldown.length} por risco, resposta e score
                                </span>
                            </div>
                            {aiExecutiveLeadDrilldown.map(item => {
                                const followup = item.primaryFollowup?.followup
                                const whatsappUrl = followup?.message
                                    ? buildWhatsAppFollowUpUrl(item.lead, String(followup.message))
                                    : buildWhatsAppLeadUrl(item.lead)
                                const latestTone = getRecommendationTypeTone(item.latestType)
                                const isUpdating = item.primaryFollowup ? updatingFollowUpKey === item.primaryFollowup.key : false

                                return (
                                    <div key={`ai-drilldown:${item.lead.id || item.lead.lead_id || item.latestActionAt}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10, alignItems: 'center', padding: 10, borderRadius: 8, border: `1px solid ${item.health.color}18`, background: '#ffffff' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: item.health.color, background: item.health.bg, border: `1px solid ${item.health.color}18`, borderRadius: 999, padding: '4px 7px', fontSize: '0.6rem', fontWeight: 900, marginBottom: 5 }}>
                                                {item.health.label}
                                            </span>
                                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.lead.lead_name || 'Lead sem nome'}
                                            </strong>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.64rem', fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                Score {item.score} | {formatPhone(item.lead.lead_phone) || item.lead.lead_email || 'sem contato'}
                                            </span>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: latestTone.color, background: latestTone.bg, border: `1px solid ${latestTone.color}18`, borderRadius: 999, padding: '3px 7px', fontSize: '0.58rem', fontWeight: 900, marginBottom: 5 }}>
                                                {getRecommendationTypeLabel(item.latestType)}
                                            </span>
                                            <strong style={{ display: 'block', color: '#334155', fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.latestTitle || 'Acao IA registrada'}
                                            </strong>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.64rem', fontWeight: 750, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.latestPropertyTitle || item.targetLabel || 'Sem imovel vinculado'}
                                            </span>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase' }}>Follow-ups IA</span>
                                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.76rem', marginTop: 2 }}>
                                                {item.followups.length} total | {item.riskFollowups.length} risco
                                            </strong>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.62rem', fontWeight: 800, marginTop: 2 }}>
                                                {item.statuses.sent} env. | {item.statuses.responded} resp. | {item.statuses.converted} conv.
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedLead(item.lead.id)}
                                                style={{ border: `1px solid ${item.health.color}18`, background: '#ffffff', color: item.health.color, borderRadius: 7, padding: '6px 8px', fontSize: '0.64rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            >
                                                Abrir lead
                                            </button>
                                            {whatsappUrl && (
                                                <a
                                                    href={whatsappUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={() => {
                                                        if (item.primaryFollowup && item.primaryFollowup.status === 'pending') void updateFollowUpStatus(item.lead, item.primaryFollowup.followup, 'sent')
                                                    }}
                                                    style={{ border: '1px solid rgba(4,120,87,0.18)', background: '#047857', color: '#ffffff', borderRadius: 7, padding: '6px 8px', fontSize: '0.64rem', fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap', opacity: isUpdating ? 0.72 : 1 }}
                                                >
                                                    WhatsApp
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {!loading && aiOperationalAlerts.length > 0 && (
                <div style={{ marginBottom: 18, padding: 14, background: '#fffbeb', border: '1px solid rgba(180,83,9,0.24)', borderRadius: 10, boxShadow: '0 6px 18px rgba(180,83,9,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: '#fef3c7', color: '#b45309', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <AlertTriangle size={17} />
                            </span>
                            <div>
                                <span style={{ display: 'block', color: '#b45309', fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>ALERTAS OPERACIONAIS IA</span>
                                <p style={{ margin: '3px 0 0', color: '#78350f', fontSize: '0.78rem', fontWeight: 700 }}>
                                    Leads destinados pela IA que passaram do SLA de atendimento.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Total', value: aiOperationalAlertTotals.total },
                                { label: 'Alta', value: aiOperationalAlertTotals.high },
                                { label: 'Pendentes', value: aiOperationalAlertTotals.pending },
                                { label: 'Sem resposta', value: aiOperationalAlertTotals.sent },
                            ].map(item => (
                                <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#ffffff', color: '#92400e', border: '1px solid rgba(180,83,9,0.18)', fontSize: '0.68rem', fontWeight: 900 }}>
                                    {item.label}: {item.value}
                                </span>
                            ))}
                            <button
                                type="button"
                                onClick={() => copyExecutiveQueueBriefing(aiOperationalAlertBriefingKey, aiOperationalAlertBriefing)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#92400e', color: '#ffffff', border: '1px solid rgba(120,53,15,0.22)', fontSize: '0.68rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                <Copy size={12} />
                                {copiedExecutiveQueueKey === aiOperationalAlertBriefingKey ? 'Copiada' : 'Copiar cobranca'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                        {aiOperationalAlerts.map(alert => {
                            const isUpdating = updatingFollowUpKey === alert.followUpKey
                            const actorLabel = getActionActorLabel(alert.followup) || alert.appliedActorLabel
                            return (
                                <div key={alert.key} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'center', padding: 10, background: '#ffffff', border: `1px solid ${alert.priorityScore === 2 ? 'rgba(185,28,28,0.22)' : 'rgba(180,83,9,0.18)'}`, borderRadius: 8 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: alert.priorityScore === 2 ? '#b91c1c' : '#b45309', background: alert.priorityScore === 2 ? '#fef2f2' : '#fffbeb', border: `1px solid ${alert.priorityScore === 2 ? 'rgba(185,28,28,0.18)' : 'rgba(180,83,9,0.18)'}`, borderRadius: 999, padding: '4px 7px', fontSize: '0.62rem', fontWeight: 900, marginBottom: 5 }}>
                                            {alert.priority}
                                        </span>
                                        <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {alert.lead.lead_name || 'Lead sem nome'}
                                        </strong>
                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.64rem', fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {alert.brokerName}
                                        </span>
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <strong style={{ display: 'block', color: '#334155', fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {alert.status === 'pending' ? 'Contato inicial atrasado' : 'Follow-up sem resposta'}
                                        </strong>
                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.66rem', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {alert.propertyTitle}
                                        </span>
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <span style={{ display: 'block', color: '#92400e', fontSize: '0.66rem', fontWeight: 900 }}>
                                            {alert.statusLabel} ha {formatActionAge(alert.ageHours)}
                                        </span>
                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.64rem', fontWeight: 800, marginTop: 2 }}>
                                            SLA {alert.slaHours}h | atraso {formatActionAge(alert.overdueHours)}
                                        </span>
                                        {actorLabel && (
                                            <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.62rem', fontWeight: 900, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                Responsavel: {actorLabel}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedLead(alert.lead.id)}
                                            style={{ border: '1px solid rgba(180,83,9,0.18)', background: '#ffffff', color: '#92400e', borderRadius: 7, padding: '6px 8px', fontSize: '0.64rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >
                                            Abrir lead
                                        </button>
                                        {alert.status === 'pending' && (
                                            <button
                                                type="button"
                                                disabled={isUpdating}
                                                onClick={() => updateFollowUpStatus(alert.lead, alert.followup, 'sent')}
                                                style={{ border: '1px solid rgba(4,120,87,0.18)', background: '#047857', color: '#ffffff', borderRadius: 7, padding: '6px 8px', fontSize: '0.64rem', fontWeight: 900, cursor: isUpdating ? 'wait' : 'pointer', opacity: isUpdating ? 0.72 : 1, whiteSpace: 'nowrap' }}
                                            >
                                                {isUpdating ? 'Atualizando...' : 'Marcar enviada'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {aiOperationalAlertTotals.total > aiOperationalAlerts.length && (
                            <div style={{ padding: 9, background: '#ffffff', border: '1px solid rgba(180,83,9,0.18)', borderRadius: 8, color: '#92400e', fontSize: '0.7rem', fontWeight: 800, textAlign: 'center' }}>
                                Mostrando {aiOperationalAlerts.length} de {aiOperationalAlertTotals.total} alertas operacionais.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!loading && brokerImpactMetrics.length > 0 && (
                <div style={{ marginBottom: 18, padding: 14, background: '#0f172a', border: '1px solid rgba(15,23,42,0.16)', borderRadius: 10, boxShadow: '0 8px 22px rgba(15,23,42,0.12)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(37,99,235,0.16)', color: '#93c5fd', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <TrendingUp size={17} />
                            </span>
                            <div>
                                <span style={{ display: 'block', color: '#93c5fd', fontSize: '0.7rem', fontWeight: 900, letterSpacing: 0 }}>IMPACTO POR CORRETOR</span>
                                <p style={{ margin: '3px 0 0', color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 600 }}>
                                    Resultado operacional dos leads destinados por recomendacao da IA.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Corretores', value: brokerImpactTotals.brokers },
                                { label: 'Leads', value: brokerImpactTotals.leads },
                                { label: 'Atencao', value: brokerImpactTotals.attention },
                                { label: 'Conversoes', value: brokerImpactTotals.conversions },
                            ].map(item => (
                                <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.12)', fontSize: '0.68rem', fontWeight: 900 }}>
                                    {item.label}: {item.value}
                                </span>
                            ))}
                            <button
                                type="button"
                                onClick={() => copyExecutiveQueueBriefing(brokerImpactReportKey, brokerImpactReportBriefing)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#ffffff', color: '#0f172a', border: '1px solid rgba(255,255,255,0.18)', fontSize: '0.68rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                <Copy size={12} />
                                {copiedExecutiveQueueKey === brokerImpactReportKey ? 'Copiado' : 'Copiar impacto'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
                        {brokerImpactMetrics.map(metric => {
                            const needsAttention = metric.needsAttention > 0
                            return (
                                <div key={metric.id} style={{ display: 'grid', gap: 10, padding: 12, background: '#ffffff', border: `1px solid ${needsAttention ? 'rgba(180,83,9,0.24)' : 'rgba(37,99,235,0.18)'}`, borderRadius: 9, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {metric.name}
                                            </strong>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.68rem', fontWeight: 800, marginTop: 2 }}>
                                                {metric.actions} acao(oes) IA | {metric.leads} lead(s)
                                            </span>
                                        </div>
                                        <span style={{ flexShrink: 0, color: needsAttention ? '#b45309' : '#2563eb', background: needsAttention ? '#fffbeb' : '#eff6ff', border: `1px solid ${needsAttention ? 'rgba(180,83,9,0.18)' : 'rgba(37,99,235,0.18)'}`, borderRadius: 999, padding: '4px 7px', fontSize: '0.62rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                                            {needsAttention ? `${metric.needsAttention} atencao` : 'em dia'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                                        {[
                                            { label: 'Dist.', value: metric.distributions, color: '#047857' },
                                            { label: 'Rebal.', value: metric.redistributions, color: '#7c3aed' },
                                            { label: 'Resp.', value: metric.responded, color: '#2563eb' },
                                            { label: 'Conv.', value: metric.converted, color: '#0f766e' },
                                        ].map(item => (
                                            <div key={item.label} style={{ padding: '7px 5px', borderRadius: 7, background: '#f8fafc', border: `1px solid ${item.color}16`, textAlign: 'center', minWidth: 0 }}>
                                                <strong style={{ display: 'block', color: item.color, fontSize: '0.86rem', lineHeight: 1 }}>{item.value}</strong>
                                                <span style={{ display: 'block', color: '#64748b', fontSize: '0.62rem', fontWeight: 900, marginTop: 3 }}>{item.label}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ display: 'grid', gap: 7 }}>
                                        {[
                                            { label: 'Resposta dos leads destinados', value: metric.responseRate, color: '#2563eb' },
                                            { label: 'Conversao dos leads destinados', value: metric.conversionRate, color: '#0f766e' },
                                        ].map(item => (
                                            <div key={item.label}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#334155', fontSize: '0.66rem', fontWeight: 900, marginBottom: 4 }}>
                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                                                    <span>{item.value}%</span>
                                                </div>
                                                <div style={{ height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.min(100, Math.max(0, item.value))}%`, height: '100%', background: item.color, borderRadius: 999 }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 800 }}>
                                            {metric.followups > 0 ? `${metric.pending} pend. | ${metric.sent} env.` : 'Sem follow-up vinculado'}
                                        </span>
                                        {metric.latestActionAt && (
                                            <span style={{ color: '#94a3b8', fontSize: '0.64rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                                Ultima IA: {formatDate(metric.latestActionAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Lead dossier modal */}
            {selectedLeadForModal && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Arquivo do lead"
                    onClick={() => setExpandedLead(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 80,
                        background: 'rgba(15,23,42,0.54)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'stretch',
                        padding: '24px clamp(12px, 3vw, 40px)',
                        overflowY: 'auto',
                    }}
                >
                    <div
                        onClick={event => event.stopPropagation()}
                        style={{
                            width: 'min(1180px, 100%)',
                            maxHeight: 'calc(100vh - 48px)',
                            alignSelf: 'center',
                            overflowY: 'auto',
                            borderRadius: 14,
                            boxShadow: '0 28px 80px rgba(15,23,42,0.35)',
                        }}
                    >
                    {[selectedLeadForModal].map(lead => {
                        const isExpanded = true
                        const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new
                        const displayScore = getDisplayScore(lead)
                        const latestFollowup = getLatestSearchAlertFollowup(lead.behavior_summary)
                        const alertOpenInsight = getSearchAlertOpenInsight(lead)
                        const followupMessage = typeof latestFollowup?.message === 'string' ? latestFollowup.message : ''
                        const followupKey = latestFollowup ? getFollowUpUiKey(lead, latestFollowup) : ''
                        const followupStatus = latestFollowup ? getFollowUpStatus(latestFollowup) : 'pending'
                        const followupStatusCfg = FOLLOWUP_STATUS_CONFIG[followupStatus] || FOLLOWUP_STATUS_CONFIG.pending
                        const followupActionTime = latestFollowup ? getFollowUpStatusTimestamp(latestFollowup) : ''
                        const followupActorLabel = latestFollowup ? getActionActorLabel(latestFollowup) : ''
                        const whatsappFollowupUrl = buildWhatsAppFollowUpUrl(lead, followupMessage)
                        const followupReasons = Array.isArray(latestFollowup?.match_reasons)
                            ? latestFollowup.match_reasons.filter(Boolean).slice(0, 3)
                            : []
                        const isUpdatingFollowup = Boolean(followupKey && updatingFollowUpKey === followupKey)
                        const commercialTimeline = getCommercialTimeline(lead)
                        const timelineCategoryCounts = commercialTimeline.reduce<Record<string, number>>((acc, event) => {
                            acc[event.category] = (acc[event.category] || 0) + 1
                            return acc
                        }, {})
                        const timelineFilterOptions = [
                            { value: 'all', label: 'Tudo', count: commercialTimeline.length },
                            ...TIMELINE_CATEGORY_ORDER
                                .filter(category => timelineCategoryCounts[category] > 0)
                                .map(category => ({ value: category, label: category, count: timelineCategoryCounts[category] })),
                        ]
                        const activeTimelineFilter = timelineCategoryFilter === 'all' || timelineCategoryCounts[timelineCategoryFilter] > 0
                            ? timelineCategoryFilter
                            : 'all'
                        const filteredCommercialTimeline = activeTimelineFilter === 'all'
                            ? commercialTimeline
                            : commercialTimeline.filter(event => event.category === activeTimelineFilter)
                        const liveExecutiveBrief = getLeadExecutiveBrief(lead, commercialTimeline)
                        const persistedExecutiveBrief = asPlainRecord(lead.crm_executive_brief)
                        const storedExecutiveBrief = getStoredExecutiveBrief(lead)
                        const executiveBrief = storedExecutiveBrief
                            ? {
                                ...storedExecutiveBrief,
                                facts: storedExecutiveBrief.facts.length > 0
                                    ? storedExecutiveBrief.facts
                                    : liveExecutiveBrief.facts,
                            }
                            : liveExecutiveBrief
                        const executiveBriefTone = executiveBrief.level === 'high'
                            ? { color: '#b91c1c', bg: '#fef2f2', border: 'rgba(185,28,28,0.18)' }
                            : executiveBrief.level === 'medium'
                                ? { color: '#b45309', bg: '#fffbeb', border: 'rgba(180,83,9,0.18)' }
                                : { color: '#047857', bg: '#ecfdf5', border: 'rgba(4,120,87,0.18)' }
                        const executiveBriefSignals = asPlainRecord(persistedExecutiveBrief.signals)
                        const executiveBriefIsAi = Boolean(executiveBriefSignals.ai_narrative_generated)
                        const persistedExecutiveBriefAt = String(persistedExecutiveBrief.generated_at || '')
                        const persistedExecutiveBriefActor = String(persistedExecutiveBrief.actor_name || persistedExecutiveBrief.actor_email || '')
                        const executiveBriefHistory = getExecutiveBriefHistory(lead)
                        const executiveBriefSaveKey = `${lead.id}:executive-brief`
                        const isSavingExecutiveBrief = savingExecutiveBriefKey === executiveBriefSaveKey

                        return (
                            <div key={lead.id} style={{ ...cardStyle, border: 'none', boxShadow: 'none' }}>
                                {/* Card Header */}
                                <div
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
                                        cursor: 'default', transition: 'background 0.15s'
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
                                            {lead.broker_name && (
                                                <span style={{
                                                    padding: '2px 10px',
                                                    borderRadius: 12,
                                                    fontSize: '0.68rem',
                                                    fontWeight: 600,
                                                    color: '#6b4f1d',
                                                    background: '#f8f1df',
                                                    border: '1px solid #ead6a6',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {lead.broker_name}
                                                </span>
                                            )}
                                            {lead.push_subscribed_lead && (
                                                <span style={{
                                                    padding: '2px 10px',
                                                    borderRadius: 12,
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700,
                                                    color: '#047857',
                                                    background: '#ecfdf5',
                                                    border: '1px solid rgba(4,120,87,0.18)',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    Push ativo
                                                </span>
                                            )}
                                            {lead.is_partner && (
                                                <span style={{
                                                    padding: '2px 10px',
                                                    borderRadius: 12,
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700,
                                                    color: '#7c2d12',
                                                    background: '#fff7ed',
                                                    border: '1px solid rgba(194,65,12,0.18)',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    Parceria
                                                </span>
                                            )}
                                            {alertOpenInsight && (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                    padding: '2px 10px',
                                                    borderRadius: 12,
                                                    fontSize: '0.68rem',
                                                    fontWeight: 800,
                                                    color: '#92400e',
                                                    background: '#fffbeb',
                                                    border: '1px solid rgba(180,83,9,0.22)',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    <BellRing size={10} />
                                                    Alerta aberto{alertOpenInsight.openedCount > 1 ? ` x${alertOpenInsight.openedCount}` : ''}
                                                </span>
                                            )}
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
                                            {(lead.lead_budget || lead.budget_min || lead.budget_max) && (
                                                <span style={{ fontSize: '0.75rem', color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <DollarSign size={11} /> {lead.lead_budget || `${formatCurrency(lead.budget_min)}${lead.budget_max ? ` - ${formatCurrency(lead.budget_max)}` : ''}`}
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

                                    <button
                                        type="button"
                                        onClick={() => setExpandedLead(null)}
                                        aria-label="Fechar arquivo do lead"
                                        style={{
                                            border: '1px solid #e8e5e0',
                                            background: '#fff',
                                            color: '#64748b',
                                            width: 34,
                                            height: 34,
                                            borderRadius: 999,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <XCircle size={18} />
                                    </button>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f0ede8' }}>
                                        <DossierBlock
                                            title="DADOS DO LEAD"
                                            subtitle="Identificacao, origem, IP, push, GPS e resumo IA"
                                            tone="default"
                                            defaultOpen
                                        >
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 16 }}>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>E-MAIL</label>
                                                <span style={{ fontSize: '0.85rem', color: '#333', wordBreak: 'break-word' }}>{lead.lead_email || '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>INTERESSE</label>
                                                <span style={{ fontSize: '0.85rem', color: '#333' }}>{lead.interest || lead.lead_purpose || '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>ORCAMENTO</label>
                                                <span style={{ fontSize: '0.85rem', color: '#333' }}>
                                                    {lead.lead_budget || (lead.budget_min || lead.budget_max
                                                        ? `${formatCurrency(lead.budget_min)}${lead.budget_max ? ` - ${formatCurrency(lead.budget_max)}` : ''}`
                                                        : '—')}
                                                </span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>DORMITÓRIOS</label>
                                                <span style={{ fontSize: '0.85rem', color: '#333' }}>{lead.bedrooms_wanted ? `${lead.bedrooms_wanted} dormitórios` : '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>PRAZO</label>
                                                <span style={{ fontSize: '0.85rem', color: '#333' }}>{lead.timeline || lead.lead_timeframe || '—'}</span>
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
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>PUSH</label>
                                                <span style={{ fontSize: '0.82rem', color: lead.push_subscribed_lead ? '#047857' : '#64748b', fontWeight: 700 }}>
                                                    {lead.push_subscribed_lead ? 'Sim, ativo' : 'Nao inscrito'}
                                                </span>
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
                                                <span style={{ fontSize: '0.82rem', color: '#333' }}>{formatApproxLocation(lead) || '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>IP</label>
                                                <span style={{ fontSize: '0.82rem', color: '#333', fontFamily: 'monospace' }}>{lead.visitor_ip_address || '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>ULTIMA VISITA</label>
                                                <span style={{ fontSize: '0.82rem', color: '#333' }}>{lead.visitor_last_visit_at ? formatDate(lead.visitor_last_visit_at) : '—'}</span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', display: 'block', marginBottom: 4 }}>REFERENCIA</label>
                                                <span style={{ fontSize: '0.82rem', color: '#333', wordBreak: 'break-word' }}>{formatReadableText(lead.visitor_referrer) || '—'}</span>
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

                                        </DossierBlock>

                                        {lead.behavior_summary && (
                                            <DossierBlock
                                                title="INTELIGENCIA DO LEAD"
                                                subtitle="Temperatura, score digital e intencoes"
                                                count={`${lead.behavior_summary.engagement_score ?? lead.lead_score ?? 0}/100`}
                                                tone="blue"
                                                defaultOpen
                                            >
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
                                                {(() => {
                                                    const premiumIntent = formatPremiumIntent(lead.behavior_summary)
                                                    const premiumItems = getPremiumIntentItems(lead.behavior_summary)
                                                    if (!premiumIntent.length && !premiumItems.length) return null

                                                    return (
                                                        <div style={{ marginTop: 10, padding: 10, background: '#fff7ed', border: '1px solid rgba(194,65,12,0.18)', borderRadius: 8 }}>
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#9a3412', fontSize: '0.68rem', fontWeight: 900, marginBottom: 6 }}>
                                                                <Zap size={13} /> INTENCAO PREMIUM
                                                            </span>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                                {premiumIntent.map((item, index) => (
                                                                    <span key={`${item}-${index}`} style={{ padding: '4px 8px', borderRadius: 999, background: '#ffffff', border: '1px solid rgba(194,65,12,0.16)', color: '#7c2d12', fontSize: '0.72rem', fontWeight: 800 }}>
                                                                        {item}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            {premiumItems.length > 0 && (
                                                                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                                                                    {premiumItems.map((item, index) => (
                                                                        <div key={`${item.label}-${item.occurredAt}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '7px 8px', borderRadius: 8, background: '#ffffff', border: '1px solid rgba(194,65,12,0.12)' }}>
                                                                            <div style={{ minWidth: 0 }}>
                                                                                <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.76rem', lineHeight: 1.25 }}>{item.label}</strong>
                                                                                {item.detail && <span style={{ display: 'block', color: '#64748b', fontSize: '0.68rem', lineHeight: 1.35 }}>{item.detail}</span>}
                                                                            </div>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                                                {item.occurredAt && <span style={{ color: '#9a3412', fontSize: '0.66rem', fontWeight: 800 }}>{formatDate(item.occurredAt)}</span>}
                                                                                {item.propertyUrl && (
                                                                                    <a href={item.propertyUrl} target="_blank" rel="noreferrer" style={{ color: '#9a3412', display: 'inline-flex' }} aria-label="Abrir imovel da intencao premium">
                                                                                        <ExternalLink size={13} />
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })()}
                                                {(() => {
                                                    const savedIntent = formatSavedPropertyIntent(lead.behavior_summary)
                                                    const savedItems = getSavedPropertySignalItems(lead)
                                                    if (!savedIntent.length && !savedItems.length) return null

                                                    return (
                                                        <div style={{ marginTop: 10, padding: 10, background: '#f0fdfa', border: '1px solid rgba(15,118,110,0.18)', borderRadius: 8 }}>
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#0f766e', fontSize: '0.68rem', fontWeight: 900, marginBottom: 6 }}>
                                                                <Star size={13} /> FAVORITOS E RETORNO
                                                            </span>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                                {savedIntent.map((item, index) => (
                                                                    <span key={`${item}-${index}`} style={{ padding: '4px 8px', borderRadius: 999, background: '#ffffff', border: '1px solid rgba(15,118,110,0.16)', color: '#115e59', fontSize: '0.72rem', fontWeight: 800 }}>
                                                                        {item}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            {savedItems.length > 0 && (
                                                                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                                                                    {savedItems.map((item, index) => (
                                                                        <div key={`${item.label}-${item.occurredAt}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '7px 8px', borderRadius: 8, background: '#ffffff', border: '1px solid rgba(15,118,110,0.12)' }}>
                                                                            <div style={{ minWidth: 0 }}>
                                                                                <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.76rem', lineHeight: 1.25 }}>{item.label}</strong>
                                                                                {item.detail && <span style={{ display: 'block', color: '#64748b', fontSize: '0.68rem', lineHeight: 1.35 }}>{item.detail}</span>}
                                                                            </div>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                                                {item.occurredAt && <span style={{ color: '#0f766e', fontSize: '0.66rem', fontWeight: 800 }}>{formatDate(item.occurredAt)}</span>}
                                                                                {item.propertyUrl && (
                                                                                    <a href={item.propertyUrl} target="_blank" rel="noreferrer" style={{ color: '#0f766e', display: 'inline-flex' }} aria-label="Abrir imovel salvo ou revisitado">
                                                                                        <ExternalLink size={13} />
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })()}
                                                {alertOpenInsight && (() => {
                                                    const followup = alertOpenInsight.latestFollowup
                                                    const status = followup ? getFollowUpStatus(followup) : ''
                                                    const statusCfg = status ? FOLLOWUP_STATUS_CONFIG[status] : null
                                                    const insightWhatsappUrl = followup?.message ? buildWhatsAppFollowUpUrl(lead, String(followup.message)) : buildWhatsAppLeadUrl(lead)
                                                    const insightUpdating = followup ? updatingFollowUpKey === getFollowUpUiKey(lead, followup) : false

                                                    return (
                                                        <div style={{ marginTop: 10, padding: 10, background: '#fffbeb', border: '1px solid rgba(180,83,9,0.2)', borderRadius: 8 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                                <div style={{ minWidth: 180, flex: 1 }}>
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#b45309', fontSize: '0.68rem', fontWeight: 900, marginBottom: 4 }}>
                                                                        <BellRing size={13} /> MATCH ABERTO PELO LEAD
                                                                    </span>
                                                                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.82rem', lineHeight: 1.35 }}>
                                                                        {alertOpenInsight.propertyTitle || alertOpenInsight.alertTitle || 'Alerta salvo aberto'}
                                                                    </strong>
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                                                        <span style={{ padding: '3px 7px', borderRadius: 999, background: '#ffffff', border: '1px solid rgba(180,83,9,0.16)', color: '#92400e', fontSize: '0.68rem', fontWeight: 900 }}>
                                                                            {alertOpenInsight.openedCount} abertura(s)
                                                                        </span>
                                                                        <span style={{ padding: '3px 7px', borderRadius: 999, background: '#ffffff', border: '1px solid rgba(180,83,9,0.16)', color: '#92400e', fontSize: '0.68rem', fontWeight: 900 }}>
                                                                            Via {alertOpenInsight.sourceLabel}
                                                                        </span>
                                                                        {alertOpenInsight.matchScore > 0 && (
                                                                            <span style={{ padding: '3px 7px', borderRadius: 999, background: '#ffffff', border: '1px solid rgba(180,83,9,0.16)', color: '#92400e', fontSize: '0.68rem', fontWeight: 900 }}>
                                                                                Score {alertOpenInsight.matchScore}
                                                                            </span>
                                                                        )}
                                                                        {statusCfg && (
                                                                            <span style={{ padding: '3px 7px', borderRadius: 999, background: statusCfg.bg, border: `1px solid ${statusCfg.color}22`, color: statusCfg.color, fontSize: '0.68rem', fontWeight: 900 }}>
                                                                                Follow-up {statusCfg.label}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span style={{ display: 'block', marginTop: 6, color: '#64748b', fontSize: '0.66rem', fontWeight: 800 }}>
                                                                        {alertOpenInsight.openedAt ? `Aberto em ${formatDate(alertOpenInsight.openedAt)}` : 'Abertura registrada no dossie do lead'}
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                    {insightWhatsappUrl && (
                                                                        <a
                                                                            href={insightWhatsappUrl}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            onClick={() => {
                                                                                if (followup) void updateFollowUpStatus(lead, followup, 'sent')
                                                                            }}
                                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, border: '1px solid #047857', background: '#047857', color: '#ffffff', fontSize: '0.72rem', fontWeight: 900, textDecoration: 'none', opacity: insightUpdating ? 0.72 : 1 }}
                                                                        >
                                                                            <MessageSquare size={13} />
                                                                            WhatsApp
                                                                        </a>
                                                                    )}
                                                                    {alertOpenInsight.propertyUrl && (
                                                                        <a
                                                                            href={alertOpenInsight.propertyUrl}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.12)', background: '#ffffff', color: '#334155', fontSize: '0.72rem', fontWeight: 900, textDecoration: 'none' }}
                                                                        >
                                                                            <ExternalLink size={13} />
                                                                            Imovel
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })()}
                                                {(() => {
                                                    const mapIntent = formatMapIntent(lead.behavior_summary)
                                                    if (!mapIntent.length) return null

                                                    return (
                                                        <div style={{ marginTop: 10, padding: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                                            <span style={{ display: 'block', marginBottom: 6, color: '#64748b', fontSize: '0.68rem', fontWeight: 800 }}>INTENCAO NO MAPA</span>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                                {mapIntent.map((item, index) => (
                                                                    <span key={`${item}-${index}`} style={{ padding: '4px 8px', borderRadius: 999, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.72rem', fontWeight: 700 }}>
                                                                        {item}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                })()}
                                                {lead.behavior_summary.next_best_action && (
                                                    <p style={{ margin: '10px 0 0', color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>
                                                        Proxima acao: {lead.behavior_summary.next_best_action}
                                                    </p>
                                                )}
                                                {latestFollowup && (
                                                    <div style={{ marginTop: 10, padding: 10, background: '#ecfdf5', border: '1px solid rgba(0,128,105,0.18)', borderRadius: 8 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                            <div style={{ minWidth: 180, flex: 1 }}>
                                                                <span style={{ display: 'block', color: '#008069', fontSize: '0.68rem', fontWeight: 800, marginBottom: 4 }}>ABORDAGEM PRONTA</span>
                                                                <strong style={{ display: 'block', color: '#064e3b', fontSize: '0.82rem', lineHeight: 1.35 }}>
                                                                    {latestFollowup.property_title || latestFollowup.title || 'Match do alerta salvo'}
                                                                </strong>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                                                    {latestFollowup.match_score && (
                                                                        <span style={{ padding: '3px 7px', borderRadius: 999, background: '#fff', border: '1px solid rgba(0,128,105,0.14)', color: '#047857', fontSize: '0.68rem', fontWeight: 800 }}>
                                                                            {latestFollowup.match_score}% aderente
                                                                        </span>
                                                                    )}
                                                                    {latestFollowup.priority && (
                                                                        <span style={{ padding: '3px 7px', borderRadius: 999, background: '#fff', border: '1px solid rgba(0,128,105,0.14)', color: '#047857', fontSize: '0.68rem', fontWeight: 800 }}>
                                                                            Prioridade {latestFollowup.priority}
                                                                        </span>
                                                                    )}
                                                                    <span style={{ padding: '3px 7px', borderRadius: 999, background: followupStatusCfg.bg, border: `1px solid ${followupStatusCfg.color}22`, color: followupStatusCfg.color, fontSize: '0.68rem', fontWeight: 800 }}>
                                                                        {followupStatusCfg.label}
                                                                    </span>
                                                                    {followupReasons.map((reason: string, index: number) => (
                                                                        <span key={`${reason}-${index}`} style={{ padding: '3px 7px', borderRadius: 999, background: '#f8fffc', border: '1px solid rgba(0,128,105,0.12)', color: '#065f46', fontSize: '0.68rem', fontWeight: 700 }}>
                                                                            {reason}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => copyFollowUpMessage(followupKey, followupMessage)}
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(0,128,105,0.18)', background: '#fff', color: '#047857', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                                                                >
                                                                    <Copy size={13} />
                                                                    {copiedFollowUpKey === followupKey ? 'Copiado' : 'Copiar'}
                                                                </button>
                                                                {whatsappFollowupUrl && (
                                                                    <a
                                                                        href={whatsappFollowupUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        onClick={() => updateFollowUpStatus(lead, latestFollowup, 'sent')}
                                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, border: '1px solid #008069', background: '#008069', color: '#fff', fontSize: '0.72rem', fontWeight: 800, textDecoration: 'none' }}
                                                                    >
                                                                        <Send size={13} />
                                                                        WhatsApp
                                                                    </a>
                                                                )}
                                                                {typeof latestFollowup.property_url === 'string' && latestFollowup.property_url && (
                                                                    <a
                                                                        href={latestFollowup.property_url}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.12)', background: '#fff', color: '#334155', fontSize: '0.72rem', fontWeight: 800, textDecoration: 'none' }}
                                                                    >
                                                                        <ExternalLink size={13} />
                                                                        Ver imovel
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
                                                            {FOLLOWUP_STATUS_OPTIONS.map(option => {
                                                                const cfg = FOLLOWUP_STATUS_CONFIG[option.value]
                                                                const Icon = option.icon
                                                                const isActive = followupStatus === option.value
                                                                return (
                                                                    <button
                                                                        key={option.value}
                                                                        type="button"
                                                                        disabled={isUpdatingFollowup}
                                                                        onClick={() => updateFollowUpStatus(lead, latestFollowup, option.value)}
                                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 8, border: isActive ? `1px solid ${cfg.color}` : '1px solid rgba(15,23,42,0.1)', background: isActive ? cfg.bg : '#fff', color: isActive ? cfg.color : '#475569', fontSize: '0.7rem', fontWeight: 800, cursor: isUpdatingFollowup ? 'wait' : 'pointer', opacity: isUpdatingFollowup ? 0.7 : 1 }}
                                                                    >
                                                                        <Icon size={13} />
                                                                        {cfg.label}
                                                                    </button>
                                                                )
                                                            })}
                                                            <button
                                                                type="button"
                                                                disabled={isUpdatingFollowup}
                                                                onClick={() => updateFollowUpStatus(lead, latestFollowup, 'dismissed')}
                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 8, border: followupStatus === 'dismissed' ? '1px solid #64748b' : '1px solid rgba(15,23,42,0.1)', background: followupStatus === 'dismissed' ? '#f8fafc' : '#fff', color: followupStatus === 'dismissed' ? '#64748b' : '#475569', fontSize: '0.7rem', fontWeight: 800, cursor: isUpdatingFollowup ? 'wait' : 'pointer', opacity: isUpdatingFollowup ? 0.7 : 1 }}
                                                            >
                                                                <XCircle size={13} />
                                                                Descartar
                                                            </button>
                                                        </div>
                                                        {followupActionTime && (
                                                            <div style={{ marginTop: 7, color: '#64748b', fontSize: '0.68rem', fontWeight: 700 }}>
                                                                Ultima atualizacao da abordagem: {formatDate(followupActionTime)}{followupActorLabel ? ` por ${followupActorLabel}` : ''}
                                                            </div>
                                                        )}
                                                        <p style={{ margin: '9px 0 0', padding: 9, borderRadius: 8, background: '#fff', border: '1px solid rgba(0,128,105,0.12)', color: '#1f2937', fontSize: '0.76rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                                                            {followupMessage}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            </DossierBlock>
                                        )}

                                        <DossierBlock
                                            title="RESUMO EXECUTIVO IA"
                                            subtitle={executiveBrief.title}
                                            count={executiveBrief.level === 'high' ? 'Alta atencao' : executiveBrief.level === 'medium' ? 'Atencao' : 'Ok'}
                                            tone={executiveBrief.level === 'high' ? 'red' : executiveBrief.level === 'medium' ? 'amber' : 'green'}
                                        >
                                        <div style={{ marginTop: 12, padding: 12, background: executiveBriefTone.bg, border: `1px solid ${executiveBriefTone.border}`, borderRadius: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                                                <div style={{ minWidth: 220, flex: 1 }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: executiveBriefTone.color, fontSize: '0.68rem', fontWeight: 900, marginBottom: 5 }}>
                                                        <Target size={13} /> RESUMO EXECUTIVO DO LEAD
                                                    </span>
                                                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.9rem', lineHeight: 1.25 }}>
                                                        {executiveBrief.title}
                                                    </strong>
                                                    <p style={{ margin: '5px 0 0', color: '#475569', fontSize: '0.74rem', fontWeight: 700, lineHeight: 1.4 }}>
                                                        {executiveBrief.summary}
                                                    </p>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-end' }}>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                        {executiveBrief.facts.map(item => (
                                                            <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 999, background: '#ffffff', border: `1px solid ${item.color}18`, color: item.color, fontSize: '0.64rem', fontWeight: 900 }}>
                                                                {item.label}: {item.value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                        {executiveBriefIsAi && (
                                                            <span style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid rgba(37,99,235,0.16)', borderRadius: 999, padding: '4px 8px', fontSize: '0.62rem', fontWeight: 900 }}>
                                                                Narrativa IA
                                                            </span>
                                                        )}
                                                        {persistedExecutiveBriefAt && (
                                                            <span style={{ color: '#64748b', fontSize: '0.64rem', fontWeight: 800 }}>
                                                                Snapshot salvo {formatDate(persistedExecutiveBriefAt)}{persistedExecutiveBriefActor ? ` por ${persistedExecutiveBriefActor}` : ''}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            disabled={isSavingExecutiveBrief}
                                                            onClick={() => saveExecutiveBriefSnapshot(lead, executiveBrief, commercialTimeline)}
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 8, border: `1px solid ${executiveBriefTone.border}`, background: '#ffffff', color: executiveBriefTone.color, fontSize: '0.64rem', fontWeight: 900, cursor: isSavingExecutiveBrief ? 'wait' : 'pointer', opacity: isSavingExecutiveBrief ? 0.72 : 1 }}
                                                        >
                                                            {isSavingExecutiveBrief ? <RefreshCw size={12} /> : <FileText size={12} />}
                                                            {isSavingExecutiveBrief ? 'Salvando' : 'Salvar snapshot'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                                                <div style={{ padding: 9, borderRadius: 8, background: '#ffffff', border: `1px solid ${executiveBriefTone.border}` }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: executiveBriefTone.color, fontSize: '0.64rem', fontWeight: 900, marginBottom: 4 }}>
                                                        <AlertTriangle size={12} /> RISCO
                                                    </span>
                                                    <p style={{ margin: 0, color: '#334155', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.4 }}>
                                                        {executiveBrief.risk}
                                                    </p>
                                                </div>
                                                <div style={{ padding: 9, borderRadius: 8, background: '#ffffff', border: '1px solid rgba(4,120,87,0.16)' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#047857', fontSize: '0.64rem', fontWeight: 900, marginBottom: 4 }}>
                                                        <Zap size={12} /> PROXIMA MELHOR ACAO
                                                    </span>
                                                    <p style={{ margin: 0, color: '#334155', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.4 }}>
                                                        {executiveBrief.nextAction}
                                                    </p>
                                                </div>
                                            </div>
                                            {executiveBriefHistory.length > 0 && (
                                                <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#ffffff', border: `1px solid ${executiveBriefTone.border}` }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#0f172a', fontSize: '0.64rem', fontWeight: 900 }}>
                                                            <Clock size={12} /> HISTORICO DE SNAPSHOTS
                                                        </span>
                                                        <span style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 900 }}>
                                                            {executiveBriefHistory.length} registro(s)
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'grid', gap: 7 }}>
                                                        {executiveBriefHistory.map((item, index) => {
                                                            const itemTone = item.level === 'high'
                                                                ? { color: '#b91c1c', bg: '#fef2f2', label: 'Alta' }
                                                                : item.level === 'medium'
                                                                    ? { color: '#b45309', bg: '#fffbeb', label: 'Media' }
                                                                    : { color: '#047857', bg: '#ecfdf5', label: 'Baixa' }

                                                            return (
                                                                <div key={`${item.generatedAt}-${item.title}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(88px, auto) minmax(0, 1fr)', gap: 9, alignItems: 'start', padding: 8, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                                    <div style={{ display: 'grid', gap: 5, justifyItems: 'start' }}>
                                                                        <span style={{ color: itemTone.color, background: itemTone.bg, border: `1px solid ${itemTone.color}22`, borderRadius: 999, padding: '3px 7px', fontSize: '0.58rem', fontWeight: 900 }}>
                                                                            {index === 0 ? 'Atual' : itemTone.label}
                                                                        </span>
                                                                        {item.isAiNarrative && (
                                                                            <span style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid rgba(37,99,235,0.16)', borderRadius: 999, padding: '3px 7px', fontSize: '0.58rem', fontWeight: 900 }}>
                                                                                IA
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                                                            <strong style={{ color: '#0f172a', fontSize: '0.72rem', lineHeight: 1.25 }}>
                                                                                {item.title}
                                                                            </strong>
                                                                            <span style={{ color: '#64748b', fontSize: '0.6rem', fontWeight: 900 }}>
                                                                                {item.generatedAt ? formatDate(item.generatedAt) : 'sem data'}
                                                                            </span>
                                                                        </div>
                                                                        <p style={{ margin: '3px 0 0', color: '#475569', fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.35 }}>
                                                                            {item.summary}
                                                                        </p>
                                                                        <span style={{ display: 'block', marginTop: 3, color: '#94a3b8', fontSize: '0.58rem', fontWeight: 900 }}>
                                                                            {[item.source || 'crm', item.actorLabel].filter(Boolean).join(' / ')}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        </DossierBlock>

                                        {commercialTimeline.length > 0 && (
                                            <DossierBlock
                                                title="LINHA DO TEMPO COMERCIAL"
                                                subtitle="Conversas, site, follow-ups e interacoes"
                                                count={`${commercialTimeline.length} eventos`}
                                                tone="blue"
                                            >
                                            <div style={{ marginTop: 12, padding: 12, background: '#ffffff', border: '1px solid #dbe3ee', borderRadius: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                                                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Clock size={12} /> LINHA DO TEMPO COMERCIAL
                                                    </label>
                                                    <span style={{ fontSize: '0.66rem', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 999, padding: '3px 8px', fontWeight: 900 }}>
                                                        {filteredCommercialTimeline.length} de {commercialTimeline.length} eventos
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                                                    {timelineFilterOptions.map(option => {
                                                        const isActive = activeTimelineFilter === option.value
                                                        return (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                onClick={() => setTimelineCategoryFilter(option.value)}
                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 999, border: isActive ? '1px solid #0f172a' : '1px solid #e2e8f0', background: isActive ? '#0f172a' : '#f8fafc', color: isActive ? '#ffffff' : '#475569', fontSize: '0.66rem', fontWeight: 900, cursor: 'pointer' }}
                                                            >
                                                                {option.label}
                                                                <span style={{ minWidth: 16, height: 16, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'rgba(255,255,255,0.18)' : '#ffffff', color: isActive ? '#ffffff' : '#64748b', fontSize: '0.58rem', fontWeight: 900 }}>
                                                                    {option.count}
                                                                </span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                                <div style={{ display: 'grid', gap: 8 }}>
                                                    {filteredCommercialTimeline.length > 0 ? filteredCommercialTimeline.map((event, index) => {
                                                        const Icon = event.icon
                                                        const isLast = index === filteredCommercialTimeline.length - 1

                                                        return (
                                                            <div key={event.key} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto', gap: 9, alignItems: 'start', minWidth: 0 }}>
                                                                <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                                                                    <span style={{ width: 24, height: 24, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: event.bg, color: event.color, border: `1px solid ${event.color}22` }}>
                                                                        <Icon size={13} />
                                                                    </span>
                                                                    {!isLast && (
                                                                        <span style={{ width: 1, minHeight: 22, background: '#e2e8f0' }} />
                                                                    )}
                                                                </div>
                                                                <div style={{ minWidth: 0, paddingBottom: isLast ? 0 : 2 }}>
                                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                                                        <strong style={{ color: '#0f172a', fontSize: '0.78rem', lineHeight: 1.25 }}>
                                                                            {event.title}
                                                                        </strong>
                                                                        <span style={{ color: event.color, background: event.bg, border: `1px solid ${event.color}18`, borderRadius: 999, padding: '2px 6px', fontSize: '0.6rem', fontWeight: 900 }}>
                                                                            {event.category}
                                                                        </span>
                                                                    </div>
                                                                    {event.detail && (
                                                                        <p style={{ margin: '3px 0 0', color: '#475569', fontSize: '0.7rem', fontWeight: 650, lineHeight: 1.35 }}>
                                                                            {event.detail}
                                                                        </p>
                                                                    )}
                                                                    {event.actor && (
                                                                        <span style={{ display: 'block', marginTop: 3, color: '#94a3b8', fontSize: '0.62rem', fontWeight: 900 }}>
                                                                            Responsavel: {event.actor}
                                                                        </span>
                                                                    )}
                                                                    {(event.whatsappUrl || event.propertyUrl || event.followup) && (
                                                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                                                                            {event.whatsappUrl && (
                                                                                <a
                                                                                    href={event.whatsappUrl}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    onClick={() => {
                                                                                        if (event.followup && event.followupStatus === 'pending') updateFollowUpStatus(lead, event.followup, 'sent')
                                                                                    }}
                                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 7px', borderRadius: 7, border: '1px solid rgba(0,128,105,0.18)', background: '#f6fffb', color: '#008069', fontSize: '0.62rem', fontWeight: 900, textDecoration: 'none' }}
                                                                                >
                                                                                    <MessageSquare size={12} />
                                                                                    WhatsApp
                                                                                </a>
                                                                            )}
                                                                            {event.propertyUrl && (
                                                                                <a
                                                                                    href={event.propertyUrl}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 7px', borderRadius: 7, border: '1px solid rgba(15,23,42,0.1)', background: '#ffffff', color: '#334155', fontSize: '0.62rem', fontWeight: 900, textDecoration: 'none' }}
                                                                                >
                                                                                    <ExternalLink size={12} />
                                                                                    Imovel
                                                                                </a>
                                                                            )}
                                                                            {event.followup && event.followupStatus === 'pending' && (
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={updatingFollowUpKey === getFollowUpUiKey(lead, event.followup)}
                                                                                    onClick={() => updateFollowUpStatus(lead, event.followup, 'sent')}
                                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 7px', borderRadius: 7, border: '1px solid rgba(4,120,87,0.18)', background: '#ecfdf5', color: '#047857', fontSize: '0.62rem', fontWeight: 900, cursor: updatingFollowUpKey === getFollowUpUiKey(lead, event.followup) ? 'wait' : 'pointer', opacity: updatingFollowUpKey === getFollowUpUiKey(lead, event.followup) ? 0.7 : 1 }}
                                                                                >
                                                                                    <Send size={12} />
                                                                                    Enviada
                                                                                </button>
                                                                            )}
                                                                            {event.followup && event.followupStatus !== 'responded' && event.followupStatus !== 'converted' && event.followupStatus !== 'dismissed' && (
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={updatingFollowUpKey === getFollowUpUiKey(lead, event.followup)}
                                                                                    onClick={() => updateFollowUpStatus(lead, event.followup, 'responded')}
                                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 7px', borderRadius: 7, border: '1px solid rgba(37,99,235,0.18)', background: '#eff6ff', color: '#2563eb', fontSize: '0.62rem', fontWeight: 900, cursor: updatingFollowUpKey === getFollowUpUiKey(lead, event.followup) ? 'wait' : 'pointer', opacity: updatingFollowUpKey === getFollowUpUiKey(lead, event.followup) ? 0.7 : 1 }}
                                                                                >
                                                                                    <Reply size={12} />
                                                                                    Respondida
                                                                                </button>
                                                                            )}
                                                                            {event.followup && event.followupStatus !== 'converted' && event.followupStatus !== 'dismissed' && (
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={updatingFollowUpKey === getFollowUpUiKey(lead, event.followup)}
                                                                                    onClick={() => updateFollowUpStatus(lead, event.followup, 'converted')}
                                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 7px', borderRadius: 7, border: '1px solid rgba(124,58,237,0.18)', background: '#f5f3ff', color: '#7c3aed', fontSize: '0.62rem', fontWeight: 900, cursor: updatingFollowUpKey === getFollowUpUiKey(lead, event.followup) ? 'wait' : 'pointer', opacity: updatingFollowUpKey === getFollowUpUiKey(lead, event.followup) ? 0.7 : 1 }}
                                                                                >
                                                                                    <Trophy size={12} />
                                                                                    Converter
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span style={{ color: '#64748b', fontSize: '0.64rem', fontWeight: 800, whiteSpace: 'nowrap', paddingTop: 3 }}>
                                                                    {formatDate(event.occurredAt)}
                                                                </span>
                                                            </div>
                                                        )
                                                    }) : (
                                                        <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.72rem', fontWeight: 800 }}>
                                                            Nenhum evento desta categoria neste lead.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            </DossierBlock>
                                        )}

                                        {Array.isArray(lead.whatsapp_clicks) && lead.whatsapp_clicks.length > 0 && (
                                            <DossierBlock
                                                title="CLIQUES DOS BOTOES"
                                                subtitle="Acoes de WhatsApp e chamadas comerciais"
                                                count={`${lead.whatsapp_clicks.length} cliques`}
                                                tone="green"
                                            >
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
                                            </DossierBlock>
                                        )}

                                        {Array.isArray(lead.site_activity) && lead.site_activity.length > 0 && (
                                            <DossierBlock
                                                title="ATIVIDADE NO SITE"
                                                subtitle="Paginas abertas e movimentos recentes"
                                                count={`${lead.site_activity.length} eventos`}
                                                tone="amber"
                                            >
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
                                            </DossierBlock>
                                        )}

                                        <DossierBlock
                                            title="CONVERSA WHATSAPP"
                                            subtitle={lead.broker_name ? `Conversa com ${lead.broker_name}` : 'Historico geral do WhatsApp'}
                                            count={`${Array.isArray(lead.conversation_messages) ? lead.conversation_messages.length : 0} mensagens`}
                                            tone="whatsapp"
                                        >
                                        <div style={{ marginTop: 12, border: '1px solid #d1d7db', borderRadius: 10, overflow: 'hidden', background: '#f0f2f5', boxShadow: '0 8px 22px rgba(15,23,42,0.08)' }}>
                                            <div style={{ padding: '10px 12px', borderBottom: '1px solid #d1d7db', background: '#f0f2f5', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                                    <LeadAvatar name={lead.lead_name} avatarUrl={lead.avatar_url} size={38} />
                                                    <div style={{ minWidth: 0 }}>
                                                        <strong style={{ display: 'block', color: '#111b21', fontSize: '0.86rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {lead.lead_name || 'Lead sem nome'}
                                                        </strong>
                                                        <span style={{ display: 'block', color: '#667781', fontSize: '0.68rem', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {lead.broker_name ? `Conversa com ${lead.broker_name}` : 'Historico geral do WhatsApp'} · {formatPhone(lead.lead_phone) || 'sem telefone'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                                                    <span style={{ fontSize: '0.68rem', color: '#667781', background: '#fff', border: '1px solid #d1d7db', borderRadius: 999, padding: '4px 9px', whiteSpace: 'nowrap' }}>
                                                        {Array.isArray(lead.conversation_messages) ? lead.conversation_messages.length : 0} mensagens
                                                    </span>
                                                    {buildWhatsAppLeadUrl(lead) && (
                                                        <a
                                                            href={buildWhatsAppLeadUrl(lead)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: '#008069', color: '#fff', textDecoration: 'none', fontSize: '0.68rem', fontWeight: 900 }}
                                                        >
                                                            <MessageSquare size={13} />
                                                            WhatsApp
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{
                                                minHeight: 220,
                                                maxHeight: 430,
                                                overflowY: 'auto',
                                                padding: '18px 18px 20px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 8,
                                                backgroundColor: '#efeae2',
                                                backgroundImage: 'url("https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/8c98994518b575bfd8c949e91d20548b.jpg")',
                                                backgroundSize: '420px auto',
                                                backgroundPosition: 'top left',
                                                backgroundRepeat: 'repeat',
                                            }}>
                                                {Array.isArray(lead.conversation_messages) && lead.conversation_messages.length > 0 ? (
                                                    lead.conversation_messages.map((message: any, index: number) => renderConversationMessage(message, index))
                                                ) : (
                                                    <div style={{ flex: 1, minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#667781', gap: 8, textAlign: 'center' }}>
                                                        <MessageSquare size={28} />
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>Nenhuma conversa registrada para este lead.</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ background: '#f0f2f5', borderTop: '1px solid #d1d7db', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ height: 36, borderRadius: 999, background: '#fff', color: '#667781', flex: 1, display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: '0.78rem', minWidth: 0 }}>
                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {lead.conversation_updated_at ? `Atualizada em ${formatDate(lead.conversation_updated_at)}` : 'Historico sincronizado do WhatsApp'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        </DossierBlock>

                                        {/* Status change */}
                                        <DossierBlock
                                            title="STATUS E NOTAS"
                                            subtitle="Alterar status e registrar observacoes do corretor"
                                            tone="default"
                                        >
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
                                        </DossierBlock>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    </div>
                </div>
            )}
        </div>
    )
}
