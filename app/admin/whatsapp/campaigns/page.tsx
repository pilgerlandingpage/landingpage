'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    Send, Loader2, AlertCircle, CheckCircle2, Users,
    Plus, Trash2, Pause, Play, FileText, Image, Mic, Video,
    Tag, RefreshCw, MessageSquare, ChevronUp,
    Smartphone, Search, BarChart3, TrendingUp, Eye, Inbox, Activity,
    XCircle, Upload, Download, Bot
} from 'lucide-react'
import {
    Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

interface Instance {
    id: string
    instance_name: string
    instance_token: string
    status: string
    broker_id?: string
    virtual_brokers?: { name: string } | null
}

interface CampaignFolder {
    id: string
    name: string
    status: string
    total: number
    sent: number
    failed: number
    created_at: string
}

interface MetaSender {
    id: string
    display_name: string
    phone_number: string
    phone_number_id: string
    local_status: string
    meta_status?: string | null
    quality_rating?: string | null
    messaging_limit_tier?: string | null
    daily_limit: number
    daily_sent_count: number
    daily_limit_resets_at?: string | null
    use_case: string
}

interface MetaTemplate {
    id: string
    name: string
    language: string
    category: string
    status: string
    quality_score?: string | null
    components?: unknown[] | null
    metadata?: unknown
    last_synced_at?: string | null
}

interface MetaCampaign {
    id: string
    name: string
    status: string
    campaign_type: string
    template_name?: string | null
    template_language?: string | null
    default_sender_id?: string | null
    scheduled_for?: string | null
    started_at?: string | null
    completed_at?: string | null
    created_at: string
    total_recipients: number
    total_queued: number
    total_sent: number
    total_delivered: number
    total_read: number
    total_failed: number
    total_skipped: number
    metadata?: unknown
}

interface MetaCampaignRecipient {
    id: string
    campaign_id?: string
    sender_id?: string | null
    recipient_phone: string
    recipient_name?: string | null
    status: string
    provider_message_id?: string | null
    error_code?: string | null
    error_message?: string | null
    sent_at?: string | null
    delivered_at?: string | null
    read_at?: string | null
    failed_at?: string | null
    created_at: string
    updated_at?: string | null
    template_parameters?: unknown
    metadata?: unknown
}

interface MetaCampaignEvent {
    id: string
    campaign_id?: string | null
    provider_message_id?: string | null
    event_type: string
    event_status?: string | null
    recipient_phone?: string | null
    received_at: string
    payload?: unknown
}

interface MetaReplyIntent {
    id: string
    conversation_id?: string | null
    message_id?: string | null
    event_id?: string | null
    campaign_id?: string | null
    recipient_id?: string | null
    sender_id?: string | null
    phone_number_id?: string | null
    provider_message_id?: string | null
    contact_phone: string
    contact_name?: string | null
    intent: string
    confidence?: number | null
    source?: string | null
    button_text?: string | null
    button_payload?: string | null
    raw_text?: string | null
    campaign_name?: string | null
    template_name?: string | null
    auto_reply_status?: string | null
    auto_reply_message?: string | null
    auto_reply_error?: string | null
    notified_status?: string | null
    notified_phone?: string | null
    notified_at?: string | null
    notified_error?: string | null
    metadata?: unknown
    created_at: string
    updated_at?: string | null
}

interface MetaReplyReportGroup {
    key: string
    campaign_id?: string | null
    campaign_name?: string
    template_name?: string
    count: number
    interested: number
    optOut: number
    question: number
    unknown: number
    lastSeenAt?: string | null
}

interface MetaReplyReportSummary {
    total: number
    interested: number
    optOut: number
    question: number
    unknown: number
    autoRepliesSent: number
    autoRepliesFailed: number
    notificationsSent: number
    notificationsFailed: number
    byIntent: Record<string, number>
    byTemplate: MetaReplyReportGroup[]
    byCampaign: MetaReplyReportGroup[]
}

interface MetaReplyReport {
    replies: MetaReplyIntent[]
    summary: MetaReplyReportSummary
}

interface MetaCampaignDetail {
    campaign?: MetaCampaign
    recipients: MetaCampaignRecipient[]
    events: MetaCampaignEvent[]
    replyIntents?: MetaReplyIntent[]
}

interface MetaCampaignSummary {
    total: number
    recipients: number
    queued: number
    sent: number
    delivered: number
    read: number
    failed: number
    skipped: number
    byStatus: Record<string, number>
}

interface MetaCampaignAnalyticsBucket {
    date: string
    campaigns: number
    recipients: number
    accepted: number
    delivered: number
    read: number
    failed: number
    skipped: number
}

interface MetaCampaignAnalytics {
    portfolioUsage?: {
        daily_limit: number
        daily_sent_count: number
        remaining: number
        usageRate: number
    }
    rates: {
        acceptedRate: number
        deliveryRate: number
        readRate: number
        failureRate: number
        optOutRate: number
    }
    timeline: MetaCampaignAnalyticsBucket[]
    byType: Array<{
        type: string
        campaigns: number
        recipients: number
        accepted: number
        delivered: number
        read: number
        failed: number
    }>
    errorBreakdown: Array<{
        code: string
        message: string
        detail?: string | null
        count: number
        campaigns: number
        lastSeenAt?: string | null
        hint?: string | null
    }>
    templatePerformance: Array<{
        key: string
        template_name: string
        language: string
        campaigns: number
        recipients: number
        accepted: number
        delivered: number
        read: number
        failed: number
        deliveryRate: number
        readRate: number
        failureRate: number
    }>
    senderHealth: Array<{
        sender_id: string
        display_name: string
        phone_number: string
        meta_status?: string | null
        quality_rating?: string | null
        daily_limit: number
        daily_sent_count: number
        usageRate: number
        recipients: number
        accepted: number
        delivered: number
        read: number
        failed: number
        failureRate: number
    }>
}

interface MetaRecipientDraft {
    phone: string
    name?: string
    templateParameters?: unknown
    metadata?: Record<string, unknown>
    missingVariables?: string[]
}

interface MetaContactList {
    id: string
    name: string
    description?: string | null
    source_file_name?: string | null
    source_sheet_name?: string | null
    status: string
    total_contacts: number
    valid_contacts: number
    duplicate_contacts: number
    invalid_contacts: number
    created_at: string
    updated_at: string
}

interface MetaContactListContact {
    id?: string
    list_id?: string
    phone_e164: string
    name?: string | null
    email?: string | null
    city?: string | null
    tags?: string[] | null
    template_variables?: Record<string, unknown> | null
    metadata?: unknown
}

interface MetaContactSegmentOption {
    value: string
    count: number
}

interface MetaContactListSegments {
    cities: MetaContactSegmentOption[]
    tags: MetaContactSegmentOption[]
    stats: {
        total: number
        with_name: number
        with_city: number
        with_tags: number
        with_variables: number
    }
}

interface MetaContactSegmentFilters {
    city: string
    tag: string
    search: string
}

const MSG_TYPES = [
    { value: 'text', label: '📝 Texto', icon: FileText },
    { value: 'image', label: '🖼️ Imagem + Texto', icon: Image },
    { value: 'audio', label: '🎤 Áudio', icon: Mic },
    { value: 'video', label: '📹 Vídeo', icon: Video },
]

type TemplateComponentRecord = Record<string, unknown>
type TemplateButtonRecord = Record<string, unknown>

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

function textValue(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function asFiniteNumber(value: unknown) {
    const parsed = Number(value || 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function metaSenderUsage(sender: MetaSender) {
    const limit = asFiniteNumber(sender.daily_limit)
    const sent = asFiniteNumber(sender.daily_sent_count)
    return {
        limit,
        sent,
        remaining: Math.max(limit - sent, 0),
        usageLabel: `${sent}/${limit || 'sem limite'}`,
    }
}

function isMetaSenderAvailable(sender: MetaSender) {
    const usage = metaSenderUsage(sender)
    return sender.local_status === 'active'
        && String(sender.meta_status || '').toUpperCase() === 'CONNECTED'
        && usage.limit > 0
        && usage.sent < usage.limit
}

function metaSenderOptionLabel(sender: MetaSender) {
    const usage = metaSenderUsage(sender)
    const name = sender.display_name || sender.phone_number
    const base = `${name} - ${sender.phone_number} (${usage.usageLabel})`
    if (sender.local_status !== 'active') return `${base} - pausado`
    if (String(sender.meta_status || '').toUpperCase() !== 'CONNECTED') return `${base} - Meta ${sender.meta_status || 'sem status'}`
    if (usage.limit > 0 && usage.sent >= usage.limit) return `${base} - limite esgotado`
    return `${base} - ${usage.remaining} disponiveis`
}

function metaPortfolioUsageFromSenders(senders: MetaSender[]) {
    const limit = Math.max(...senders.map(sender => asFiniteNumber(sender.daily_limit)), 0)
    const sent = senders.reduce((total, sender) => total + asFiniteNumber(sender.daily_sent_count), 0)
    return {
        limit,
        sent,
        remaining: Math.max(limit - sent, 0),
        usageLabel: `${sent}/${limit || 'sem limite'}`,
    }
}

function getTemplateComponents(template?: MetaTemplate | null): TemplateComponentRecord[] {
    if (!Array.isArray(template?.components)) return []
    return template.components.map(asRecord).filter(component => textValue(component.type))
}

function findTemplateComponent(template: MetaTemplate | null | undefined, type: string) {
    return getTemplateComponents(template).find(component => textValue(component.type).toUpperCase() === type.toUpperCase()) || null
}

function getTemplateButtons(template?: MetaTemplate | null): TemplateButtonRecord[] {
    const buttonsComponent = findTemplateComponent(template, 'BUTTONS')
    const rawButtons = Array.isArray(buttonsComponent?.buttons) ? buttonsComponent?.buttons : []
    return rawButtons.map(asRecord)
}

function getTemplateHeaderMediaUrl(template?: MetaTemplate | null) {
    const metadata = asRecord(template?.metadata)
    const panelHeaderMedia = asRecord(metadata.panel_header_media)
    const savedUrl = textValue(panelHeaderMedia.url) || textValue(metadata.header_media_url)
    if (savedUrl) return savedUrl

    const header = findTemplateComponent(template, 'HEADER')
    const example = asRecord(header?.example)
    const headerHandles = Array.isArray(example.header_handle) ? example.header_handle : []
    const metaSampleUrl = textValue(headerHandles[0])
    return metaSampleUrl.startsWith('https://') ? metaSampleUrl : ''
}

function extractTemplateVariables(text: string) {
    const matches = Array.from(text.matchAll(/{{\s*(\d+)\s*}}/g))
    return Array.from(new Set(matches.map(match => Number(match[1])))).filter(Number.isFinite).sort((a, b) => a - b)
}

function replaceTemplateVariables(text: string, values: Record<string, string>, fallback = 'valor') {
    return text.replace(/{{\s*(\d+)\s*}}/g, (_, index: string) => values[index] || `{{${index} ${fallback}}}`)
}

function buttonNeedsDynamicUrl(button: TemplateButtonRecord) {
    return textValue(button.type).toUpperCase() === 'URL' && extractTemplateVariables(textValue(button.url)).length > 0
}

function buttonNeedsCouponCode(button: TemplateButtonRecord) {
    const type = textValue(button.type).toUpperCase()
    return type === 'COPY_CODE' || type === 'COUPON_CODE'
}

function countDelimiter(line: string, delimiter: string) {
    let count = 0
    let quoted = false

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index]
        if (char === '"') {
            quoted = !quoted
            continue
        }
        if (!quoted && char === delimiter) count += 1
    }

    return count
}

function detectAudienceDelimiter(line: string) {
    return ['\t', ';', '|', ',']
        .map(delimiter => ({ delimiter, count: countDelimiter(line, delimiter) }))
        .sort((a, b) => b.count - a.count)[0]?.delimiter || ','
}

function splitAudienceRow(line: string) {
    const delimiter = detectAudienceDelimiter(line)
    const columns: string[] = []
    let current = ''
    let quoted = false

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index]
        const next = line[index + 1]

        if (char === '"' && quoted && next === '"') {
            current += '"'
            index += 1
            continue
        }

        if (char === '"') {
            quoted = !quoted
            continue
        }

        if (!quoted && char === delimiter) {
            columns.push(current.trim())
            current = ''
            continue
        }

        current += char
    }

    columns.push(current.trim())
    return columns
}

function normalizeAudienceHeader(value: string) {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9{}]+/g, '')
}

function findHeaderIndex(headers: string[], candidates: string[]) {
    const normalizedCandidates = new Set(candidates.map(normalizeAudienceHeader))
    return headers.findIndex(header => normalizedCandidates.has(header))
}

function rowLooksLikeAudienceHeader(row: string[]) {
    const headers = row.map(normalizeAudienceHeader)
    return headers.some(header =>
        ['telefone', 'phone', 'whatsapp', 'celular', 'numero', 'numerodetelefone', 'nome', 'name', 'lead', 'cliente'].includes(header)
        || /^var\d+$/.test(header)
        || /^variavel\d+$/.test(header)
        || /^\{\{\d+\}\}$/.test(header)
    )
}

function guessPhoneColumn(rows: string[][]) {
    const columnScores = new Map<number, number>()

    rows.slice(0, 20).forEach(row => {
        row.forEach((cell, index) => {
            const digits = cell.replace(/\D/g, '')
            if (digits.length >= 10) columnScores.set(index, (columnScores.get(index) || 0) + 1)
        })
    })

    return Array.from(columnScores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
}

function escapeAudienceCell(value: string) {
    const cleaned = value.replace(/\r?\n/g, ' ').trim()
    if (/[;,"\t]/.test(cleaned)) return `"${cleaned.replace(/"/g, '""')}"`
    return cleaned
}

function variableHeaderCandidates(variable: number) {
    const number = String(variable)
    const candidates = [`var${number}`, `variavel${number}`, `{{${number}}}`, `valor${number}`]

    if (variable === 2) candidates.push('imovel', 'empreendimento', 'interesse', 'produto', 'oportunidade')
    if (variable === 3) candidates.push('link', 'url', 'site', 'pagina')

    return candidates
}

function buildHeaderParameter(format: string, value: string) {
    const selected = value.trim()
    switch (format.toUpperCase()) {
        case 'IMAGE':
            return { type: 'image', image: { link: selected } }
        case 'VIDEO':
            return { type: 'video', video: { link: selected } }
        case 'DOCUMENT':
            return { type: 'document', document: { link: selected } }
        default:
            return { type: 'text', text: selected }
    }
}

function renderWhatsAppPreviewText(text: string) {
    const parts = text.split(/(```[^`]+```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g)
    return parts.map((part, index) => {
        if (!part) return null
        if (part.startsWith('```') && part.endsWith('```')) {
            return <code key={index}>{part.slice(3, -3)}</code>
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <strong key={index}>{part.slice(1, -1)}</strong>
        }
        if (part.startsWith('_') && part.endsWith('_')) {
            return <em key={index}>{part.slice(1, -1)}</em>
        }
        if (part.startsWith('~') && part.endsWith('~')) {
            return <s key={index}>{part.slice(1, -1)}</s>
        }
        return <span key={index}>{part}</span>
    })
}

export default function CampaignsPage() {
    const [instances, setInstances] = useState<Instance[]>([])
    const [selectedInstance, setSelectedInstance] = useState<string>('')
    const [campaigns, setCampaigns] = useState<CampaignFolder[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingCampaigns, setLoadingCampaigns] = useState(false)
    const [loadingMetaCampaigns, setLoadingMetaCampaigns] = useState(false)
    const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([])
    const [metaSenders, setMetaSenders] = useState<MetaSender[]>([])
    const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
    const [metaContactLists, setMetaContactLists] = useState<MetaContactList[]>([])
    const [selectedContactListId, setSelectedContactListId] = useState('')
    const [selectedContactListContacts, setSelectedContactListContacts] = useState<MetaContactListContact[]>([])
    const [contactListSegments, setContactListSegments] = useState<MetaContactListSegments | null>(null)
    const [contactListAudienceCounts, setContactListAudienceCounts] = useState({ all: 0, filtered: 0 })
    const [contactSegmentCity, setContactSegmentCity] = useState('')
    const [contactSegmentTag, setContactSegmentTag] = useState('')
    const [contactSegmentSearch, setContactSegmentSearch] = useState('')
    const [contactListName, setContactListName] = useState('')
    const [savingContactList, setSavingContactList] = useState(false)
    const [loadingContactLists, setLoadingContactLists] = useState(false)
    const [loadingContactListAudience, setLoadingContactListAudience] = useState(false)
    const [metaSummary, setMetaSummary] = useState<MetaCampaignSummary | null>(null)
    const [metaAnalytics, setMetaAnalytics] = useState<MetaCampaignAnalytics | null>(null)
    const [metaStatusFilter, setMetaStatusFilter] = useState('')
    const [expandedMetaCampaignId, setExpandedMetaCampaignId] = useState('')
    const [loadingMetaCampaignDetail, setLoadingMetaCampaignDetail] = useState('')
    const [metaCampaignDetails, setMetaCampaignDetails] = useState<Record<string, MetaCampaignDetail>>({})
    const [retryingMetaCampaignId, setRetryingMetaCampaignId] = useState('')
    const [metaReplyReport, setMetaReplyReport] = useState<MetaReplyReport | null>(null)
    const [loadingMetaReplyReport, setLoadingMetaReplyReport] = useState(false)
    const [metaReplyIntentFilter, setMetaReplyIntentFilter] = useState('')
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [sending, setSending] = useState(false)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Campaign form state
    const [sendProvider] = useState<'connectyhub' | 'meta_whatsapp'>('meta_whatsapp')
    const [msgType, setMsgType] = useState('text')
    const [msgText, setMsgText] = useState('')
    const [mediaUrl, setMediaUrl] = useState('')
    const [numbersInput, setNumbersInput] = useState('')
    const [campaignName, setCampaignName] = useState('')
    const [delayMin, setDelayMin] = useState(10)
    const [delayMax, setDelayMax] = useState(30)
    const [scheduleDate, setScheduleDate] = useState('')
    const [metaTemplateName, setMetaTemplateName] = useState('')
    const [metaTemplateLanguage, setMetaTemplateLanguage] = useState('pt_BR')
    const [metaCampaignType, setMetaCampaignType] = useState<'marketing' | 'editorial' | 'followup' | 'utility' | 'test'>('marketing')
    const [metaTemplateParameters, setMetaTemplateParameters] = useState('')
    const [metaBodyParameterValues, setMetaBodyParameterValues] = useState<Record<string, string>>({})
    const [metaHeaderParameterValue, setMetaHeaderParameterValue] = useState('')
    const [metaHeaderMediaUrl, setMetaHeaderMediaUrl] = useState('')
    const [metaButtonParameterValues, setMetaButtonParameterValues] = useState<Record<string, string>>({})
    const [metaAudiencePersonalized, setMetaAudiencePersonalized] = useState(false)
    const [selectedMetaSenderId, setSelectedMetaSenderId] = useState('')
    const [confirmOptIn, setConfirmOptIn] = useState(false)

    useEffect(() => { loadInstances() }, [])

    const loadInstances = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/whatsapp/instances')
            const data = await res.json()
            const connected = (data.instances || []).filter((i: Instance) => i.status === 'connected' && i.instance_token)
            setInstances(connected)
            if (connected.length > 0 && !selectedInstance) {
                setSelectedInstance(connected[0].id)
            }
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }

    useEffect(() => {
        if (selectedInstance) loadCampaigns()
    }, [selectedInstance])

    const loadCampaigns = async () => {
        if (!selectedInstance) return
        setLoadingCampaigns(true)
        try {
            const res = await fetch(`/api/admin/whatsapp/campaigns?instance_id=${selectedInstance}`)
            const data = await res.json()
            if (data.success) {
                const folders = Array.isArray(data.campaigns) ? data.campaigns : (data.campaigns?.folders || [])
                setCampaigns(folders)
            }
        } catch { /* ignore */ }
        finally { setLoadingCampaigns(false) }
    }

    const loadMetaCampaigns = async () => {
        setLoadingMetaCampaigns(true)
        try {
            const statusParam = metaStatusFilter ? `&status=${encodeURIComponent(metaStatusFilter)}` : ''
            const res = await fetch(`/api/admin/whatsapp/campaigns?provider=meta_whatsapp&limit=60${statusParam}`)
            const data = await res.json()
            if (data.success) {
                setMetaCampaigns(data.campaigns || [])
                setMetaSenders(data.senders || [])
                setMetaTemplates(data.templates || [])
                setMetaSummary(data.summary || null)
                setMetaAnalytics(data.analytics || null)
            } else {
                setFeedback({ type: 'error', text: data.message || 'Erro ao carregar campanhas Meta' })
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao carregar campanhas Meta' })
        } finally {
            setLoadingMetaCampaigns(false)
        }
    }

    const syncMetaTemplatesForCampaigns = async () => {
        setFeedback(null)
        try {
            const res = await fetch('/api/admin/whatsapp/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync' }),
            })
            const data = await res.json()

            if (!data.success) {
                setFeedback({ type: 'error', text: data.message || 'Erro ao sincronizar templates Meta.' })
                return
            }

            await loadMetaCampaigns()
            setFeedback({ type: 'success', text: data.message || 'Templates Meta sincronizados.' })
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao sincronizar templates Meta.' })
        }
    }

    const loadMetaContactLists = async () => {
        setLoadingContactLists(true)
        try {
            const res = await fetch('/api/admin/whatsapp/contact-lists')
            const data = await res.json()
            if (data.success) {
                setMetaContactLists(data.lists || [])
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao carregar listas salvas Meta' })
        } finally {
            setLoadingContactLists(false)
        }
    }

    const loadMetaReplyReport = async () => {
        setLoadingMetaReplyReport(true)
        try {
            const intentParam = metaReplyIntentFilter ? `&intent=${encodeURIComponent(metaReplyIntentFilter)}` : ''
            const res = await fetch(`/api/admin/whatsapp/campaigns?provider=meta_whatsapp&report=reply_intents&limit=200${intentParam}`)
            const data = await res.json()
            if (data.success) {
                setMetaReplyReport({
                    replies: data.replies || [],
                    summary: data.summary || emptyMetaReplyReportSummary(),
                })
            } else {
                setFeedback({ type: 'error', text: data.message || 'Erro ao carregar respostas Meta' })
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao carregar respostas Meta' })
        } finally {
            setLoadingMetaReplyReport(false)
        }
    }

    const refreshMetaWorkspace = async () => {
        await Promise.all([
            loadMetaCampaigns(),
            loadMetaContactLists(),
            loadMetaReplyReport(),
        ])
    }

    const toggleMetaCampaignDetail = async (campaignId: string) => {
        if (expandedMetaCampaignId === campaignId) {
            setExpandedMetaCampaignId('')
            return
        }

        setExpandedMetaCampaignId(campaignId)
        if (metaCampaignDetails[campaignId]) return

        setLoadingMetaCampaignDetail(campaignId)
        try {
            const res = await fetch(`/api/admin/whatsapp/campaigns?provider=meta_whatsapp&campaign_id=${encodeURIComponent(campaignId)}&limit=80`)
            const data = await res.json()
            if (data.success) {
                setMetaCampaignDetails(prev => ({
                    ...prev,
                    [campaignId]: {
                        campaign: data.campaign,
                        recipients: data.recipients || [],
                        events: data.events || [],
                        replyIntents: data.replyIntents || [],
                    },
                }))
            } else {
                setFeedback({ type: 'error', text: data.message || 'Erro ao carregar detalhe da campanha Meta' })
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao carregar detalhe da campanha Meta' })
        } finally {
            setLoadingMetaCampaignDetail('')
        }
    }

    useEffect(() => {
        if (sendProvider === 'meta_whatsapp') {
            loadMetaCampaigns()
            loadMetaContactLists()
            loadMetaReplyReport()
        }
    }, [sendProvider, metaStatusFilter, metaReplyIntentFilter])

    const parseNumbers = (): string[] => {
        return numbersInput
            .split(/[\n,;]+/)
            .map(n => n.replace(/\D/g, '').trim())
            .filter(n => n.length >= 10)
    }

    const exportMetaRepliesCsv = (intent?: string) => {
        const allReplies = metaReplyReport?.replies || []
        const filtered = intent ? allReplies.filter(reply => reply.intent === intent) : allReplies
        if (filtered.length === 0) {
            setFeedback({ type: 'error', text: 'Nenhuma resposta encontrada para exportar.' })
            return
        }

        const csv = [
            ['telefone', 'nome', 'intencao', 'campanha', 'template', 'resposta', 'botao', 'auto_resposta', 'alerta_interno', 'data']
                .map(escapeAudienceCell)
                .join(';'),
            ...filtered.map(reply => [
                reply.contact_phone,
                reply.contact_name || '',
                metaReplyIntentLabel(reply.intent),
                reply.campaign_name || '',
                reply.template_name || '',
                reply.raw_text || '',
                reply.button_text || reply.button_payload || '',
                metaReplyStatusLabel(reply.auto_reply_status),
                metaReplyStatusLabel(reply.notified_status),
                formatMetaDate(reply.created_at),
            ].map(escapeAudienceCell).join(';')),
        ].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')

        anchor.href = url
        anchor.download = `respostas-meta-whatsapp-${intent || 'todas'}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    const downloadAudienceTemplate = () => {
        const variables = selectedBodyVariables.length > 0 ? selectedBodyVariables : [1, 2, 3]
        const headers = ['telefone', 'nome', ...variables.map(variable => `var${variable}`)]
        const sampleValues = ['554788271085', 'Maria', ...variables.map((variable, index) => {
            if (variable === 1) return 'Maria'
            if (variable === 2) return 'Apartamento frente mar'
            if (variable === 3) return 'https://guilhermepilger.ai/imovel'
            return `valor ${index + 1}`
        })]
        const csv = [
            headers.map(escapeAudienceCell).join(';'),
            sampleValues.map(escapeAudienceCell).join(';'),
        ].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')

        anchor.href = url
        anchor.download = 'modelo-contatos-meta-whatsapp.csv'
        anchor.click()
        URL.revokeObjectURL(url)
    }

    const importAudienceFile = async (file?: File) => {
        if (!file) return

        try {
            const text = await file.text()
            const rows = text
                .split(/\r?\n/)
                .map(line => splitAudienceRow(line))
                .filter(row => row.some(column => column.trim()))

            if (!rows.length) {
                setFeedback({ type: 'error', text: 'A lista importada esta vazia.' })
                return
            }

            const hasHeader = rowLooksLikeAudienceHeader(rows[0])
            const headers = hasHeader ? rows[0].map(normalizeAudienceHeader) : []
            const dataRows = hasHeader ? rows.slice(1) : rows
            const phoneIndex = hasHeader
                ? findHeaderIndex(headers, ['telefone', 'phone', 'whatsapp', 'celular', 'numero', 'numero de telefone', 'numero do telefone'])
                : guessPhoneColumn(dataRows)
            const nameIndex = hasHeader
                ? findHeaderIndex(headers, ['nome', 'name', 'lead', 'cliente', 'contato'])
                : (phoneIndex === 0 ? 1 : 0)
            const shouldPersonalize = sendProvider === 'meta_whatsapp' && (metaAudiencePersonalized || selectedBodyVariables.length > 0)
            const seenPhones = new Set<string>()
            const importedLines: string[] = []

            if (phoneIndex < 0) {
                setFeedback({ type: 'error', text: 'Nao encontrei uma coluna de telefone na lista.' })
                return
            }

            dataRows.forEach(row => {
                const phone = (row[phoneIndex] || '').replace(/\D/g, '').slice(0, 20)
                if (phone.length < 10 || seenPhones.has(phone)) return

                seenPhones.add(phone)

                if (!shouldPersonalize) {
                    importedLines.push(phone)
                    return
                }

                const name = nameIndex >= 0 && nameIndex !== phoneIndex ? (row[nameIndex] || '').trim() : ''
                const usedColumns = new Set([phoneIndex, nameIndex].filter(index => index >= 0))
                const freeColumns = row.map((_, index) => index).filter(index => !usedColumns.has(index))
                const variableValues = selectedBodyVariables.map((variable, variableIndex) => {
                    const headerIndex = hasHeader ? findHeaderIndex(headers, variableHeaderCandidates(variable)) : -1
                    const fallbackIndex = freeColumns[variableIndex]
                    const value = headerIndex >= 0
                        ? row[headerIndex]
                        : fallbackIndex !== undefined ? row[fallbackIndex] : ''
                    const cleaned = (value || '').trim()
                    if (cleaned) return cleaned
                    if (variable === 1 && name) return name
                    return ''
                })

                importedLines.push([phone, name, ...variableValues].map(escapeAudienceCell).join('; '))
            })

            if (!importedLines.length) {
                setFeedback({ type: 'error', text: 'Nenhum telefone valido foi encontrado na lista.' })
                return
            }

            setNumbersInput(prev => [prev.trim(), importedLines.join('\n')].filter(Boolean).join('\n'))
            if (shouldPersonalize) setMetaAudiencePersonalized(true)
            setFeedback({ type: 'success', text: `${importedLines.length} contato(s) importado(s) para a campanha.` })
        } catch {
            setFeedback({ type: 'error', text: 'Nao consegui ler este arquivo. Use CSV ou TXT aqui, ou use Listas salvas para subir XLSX.' })
        }
    }

    const buildAudienceLinesFromContacts = (contacts: MetaContactListContact[]) => {
        return contacts
            .map(contact => {
                const templateVariables = asRecord(contact.template_variables)
                const name = textValue(contact.name) || ''
                const variableValues = selectedBodyVariables.map(variable => {
                    const key = String(variable)
                    const value = textValue(templateVariables[key])
                    if (value) return value
                    if (variable === 1) return name
                    return ''
                })

                return [contact.phone_e164, name, ...variableValues].map(escapeAudienceCell).join('; ')
            })
            .join('\n')
    }

    const resetContactSegmentFilters = () => {
        setContactSegmentCity('')
        setContactSegmentTag('')
        setContactSegmentSearch('')
    }

    const loadSavedContactListIntoAudience = async (
        listId: string,
        options: Partial<MetaContactSegmentFilters> & { resetFilters?: boolean; silent?: boolean } = {}
    ) => {
        if (!listId) return

        const city = options.resetFilters ? '' : options.city ?? contactSegmentCity
        const tag = options.resetFilters ? '' : options.tag ?? contactSegmentTag
        const search = options.resetFilters ? '' : options.search ?? contactSegmentSearch
        const params = new URLSearchParams({ list_id: listId })
        if (city.trim()) params.set('city', city.trim())
        if (tag.trim()) params.set('tag', tag.trim())
        if (search.trim()) params.set('search', search.trim())

        setLoadingContactListAudience(true)
        try {
            const res = await fetch(`/api/admin/whatsapp/contact-lists?${params.toString()}`)
            const data = await res.json()
            if (!data.success) {
                setFeedback({ type: 'error', text: data.message || 'Erro ao carregar lista salva.' })
                return
            }

            const contacts = data.contacts || []
            setSelectedContactListId(listId)
            setSelectedContactListContacts(contacts)
            setContactListSegments(data.segments || null)
            setContactListAudienceCounts({
                all: Number(data.allContactsCount || contacts.length),
                filtered: Number(data.filteredContactsCount || contacts.length),
            })
            if (options.resetFilters) {
                resetContactSegmentFilters()
            } else {
                setContactSegmentCity(city)
                setContactSegmentTag(tag)
                setContactSegmentSearch(search)
            }
            setNumbersInput(buildAudienceLinesFromContacts(contacts))
            setMetaAudiencePersonalized(true)
            if (!options.silent) {
                const activeFilters = [
                    city.trim() ? `cidade: ${city.trim()}` : '',
                    tag.trim() ? `tag: ${tag.trim()}` : '',
                    search.trim() ? `busca: ${search.trim()}` : '',
                ].filter(Boolean).join(', ')
                setFeedback({
                    type: 'success',
                    text: `Lista "${data.list?.name || 'salva'}" carregada com ${contacts.length} contato(s)${activeFilters ? ` no segmento (${activeFilters})` : ''}.`,
                })
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao carregar lista salva.' })
        } finally {
            setLoadingContactListAudience(false)
        }
    }

    const uploadSavedContactList = async (file?: File) => {
        if (!file) return

        const lowerFileName = file.name.toLowerCase()
        if (lowerFileName.endsWith('.xls') && !lowerFileName.endsWith('.xlsx')) {
            setFeedback({
                type: 'error',
                text: 'Arquivo .xls antigo nao e aceito. Abra no Excel e salve como .xlsx, ou use o modelo CSV baixado pelo painel.',
            })
            return
        }

        setSavingContactList(true)
        setFeedback(null)
        try {
            const form = new FormData()
            form.append('file', file)
            form.append('name', contactListName)

            const res = await fetch('/api/admin/whatsapp/contact-lists', {
                method: 'POST',
                body: form,
            })
            const data = await res.json()

            if (!data.success) {
                setFeedback({ type: 'error', text: data.message || 'Erro ao salvar lista.' })
                return
            }

            const list = data.list as MetaContactList
            setMetaContactLists(prev => [list, ...prev.filter(item => item.id !== list.id)])
            setContactListName('')
            await loadSavedContactListIntoAudience(list.id, { resetFilters: true, silent: true })

            const summary = data.summary || {}
            setFeedback({
                type: 'success',
                text: `${data.message} Duplicados ignorados: ${summary.duplicateContacts || 0}. Invalidos: ${summary.invalidContacts || 0}.`,
            })
        } catch {
            setFeedback({ type: 'error', text: 'Nao consegui salvar essa lista. Use XLSX, CSV ou TXT com coluna de telefone.' })
        } finally {
            setSavingContactList(false)
        }
    }

    const clearSavedContactListSelection = () => {
        setSelectedContactListId('')
        setSelectedContactListContacts([])
        setContactListSegments(null)
        setContactListAudienceCounts({ all: 0, filtered: 0 })
        resetContactSegmentFilters()
    }

    const resetMetaTemplateBuilder = () => {
        setMetaTemplateParameters('')
        setMetaBodyParameterValues({})
        setMetaHeaderParameterValue('')
        setMetaHeaderMediaUrl('')
        setMetaButtonParameterValues({})
    }

    const getSelectedMetaTemplate = () => metaTemplates.find(template =>
        template.name === metaTemplateName && template.language === metaTemplateLanguage
    ) || null

    const getMissingMetaTemplateFields = (skipBodyValues = false, skipHeaderMedia = false) => {
        const template = getSelectedMetaTemplate()
        if (!template) return []

        const missing: string[] = []
        const header = findTemplateComponent(template, 'HEADER')
        const body = findTemplateComponent(template, 'BODY')
        const headerFormat = textValue(header?.format).toUpperCase()
        const headerVariables = extractTemplateVariables(textValue(header?.text))
        const bodyVariables = extractTemplateVariables(textValue(body?.text))

        if (!skipHeaderMedia && header && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && !metaHeaderMediaUrl.trim()) {
            missing.push(`midia do header ${headerFormat.toLowerCase()}`)
        }
        if (headerFormat === 'TEXT' && headerVariables.length && !metaHeaderParameterValue.trim()) {
            missing.push('variavel do header')
        }
        if (!skipBodyValues) {
            for (const variable of bodyVariables) {
                if (!metaBodyParameterValues[String(variable)]?.trim()) missing.push(`variavel {{${variable}}} do corpo`)
            }
        }

        getTemplateButtons(template).forEach((button, index) => {
            const value = metaButtonParameterValues[String(index)]?.trim()
            if (buttonNeedsDynamicUrl(button) && !value) missing.push(`parametro do botao ${index + 1}`)
            if (buttonNeedsCouponCode(button) && !value) missing.push(`codigo do botao ${index + 1}`)
        })

        return missing
    }

    const buildMetaTemplateParameters = (
        bodyValues: Record<string, string> = metaBodyParameterValues,
        headerMediaUrl: string = metaHeaderMediaUrl
    ) => {
        const template = getSelectedMetaTemplate()
        if (!template) {
            return metaTemplateParameters
                .split(/[\n,;]+/)
                .map(value => value.trim())
                .filter(Boolean)
        }

        const components: Record<string, unknown>[] = []
        const header = findTemplateComponent(template, 'HEADER')
        const body = findTemplateComponent(template, 'BODY')
        const headerFormat = textValue(header?.format).toUpperCase()
        const headerVariables = extractTemplateVariables(textValue(header?.text))
        const bodyVariables = extractTemplateVariables(textValue(body?.text))

        if (header) {
            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && headerMediaUrl.trim()) {
                components.push({
                    type: 'header',
                    parameters: [buildHeaderParameter(headerFormat, headerMediaUrl)],
                })
            } else if (headerFormat === 'TEXT' && headerVariables.length && metaHeaderParameterValue.trim()) {
                components.push({
                    type: 'header',
                    parameters: [{ type: 'text', text: metaHeaderParameterValue.trim() }],
                })
            }
        }

        if (bodyVariables.length) {
            components.push({
                type: 'body',
                parameters: bodyVariables.map(variable => ({
                    type: 'text',
                    text: bodyValues[String(variable)]?.trim() || '',
                })),
            })
        }

        getTemplateButtons(template).forEach((button, index) => {
            const value = metaButtonParameterValues[String(index)]?.trim()
            const buttonType = textValue(button.type).toUpperCase()
            if (!value) return

            if (buttonNeedsDynamicUrl(button)) {
                components.push({
                    type: 'button',
                    sub_type: 'url',
                    index: String(index),
                    parameters: [{ type: 'text', text: value }],
                })
                return
            }

            if (buttonNeedsCouponCode(button)) {
                components.push({
                    type: 'button',
                    sub_type: 'copy_code',
                    index: String(index),
                    parameters: [{ type: 'coupon_code', coupon_code: value }],
                })
                return
            }

            if (buttonType === 'QUICK_REPLY') {
                components.push({
                    type: 'button',
                    sub_type: 'quick_reply',
                    index: String(index),
                    parameters: [{ type: 'payload', payload: value }],
                })
            }
        })

        return components.length ? { components } : {}
    }

    const parseMetaRecipientDrafts = (): MetaRecipientDraft[] => {
        const recipients: MetaRecipientDraft[] = []
        const selectedContactsByPhone = new Map(
            selectedContactListContacts.map(contact => [
                String(contact.phone_e164 || '').replace(/\D/g, '').slice(0, 20),
                contact,
            ])
        )

        numbersInput.split(/\n+/).forEach((line, lineIndex) => {
            const columns = splitAudienceRow(line).map(column => column.trim())
            const phone = (columns[0] || '').replace(/\D/g, '').slice(0, 20)
            if (!phone) return

            const savedContact = selectedContactsByPhone.get(phone) || null
            const savedContactMetadata = asRecord(savedContact?.metadata)
            const name = columns[1] || ''
            const bodyValues: Record<string, string> = { ...metaBodyParameterValues }
            selectedBodyVariables.forEach((variable, variableIndex) => {
                const key = String(variable)
                const rowValue = columns[variableIndex + 2] || ''
                if (rowValue) bodyValues[key] = rowValue
                if (!bodyValues[key] && variable === 1 && name) bodyValues[key] = name
            })

            const selectedTemplate = getSelectedMetaTemplate()
            const header = findTemplateComponent(selectedTemplate, 'HEADER')
            const headerFormat = textValue(header?.format).toUpperCase()
            const headerUsesMedia = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat)
            const rowHeaderMediaUrl = headerUsesMedia
                ? (columns[selectedBodyVariables.length + 2] || metaHeaderMediaUrl).trim()
                : ''

            const missingVariables = selectedBodyVariables
                .filter(variable => !bodyValues[String(variable)]?.trim())
                .map(variable => `{{${variable}}}`)

            if (headerUsesMedia && !rowHeaderMediaUrl) {
                missingVariables.push('midia do header')
            }

            recipients.push({
                phone,
                name: name || undefined,
                templateParameters: buildMetaTemplateParameters(bodyValues, rowHeaderMediaUrl),
                metadata: {
                    ...savedContactMetadata,
                    source_line: lineIndex + 1,
                    personalized_campaign_row: true,
                    ...(selectedContactListId ? { contact_list_id: selectedContactListId } : {}),
                    ...(savedContact?.id ? { contact_list_contact_id: savedContact.id } : {}),
                    ...(rowHeaderMediaUrl ? { header_media_url: rowHeaderMediaUrl } : {}),
                },
                missingVariables,
            })
        })

        return recipients
    }

    const sendCampaign = async () => {
        const metaRecipientDrafts = sendProvider === 'meta_whatsapp' && metaAudiencePersonalized
            ? parseMetaRecipientDrafts()
            : []
        const numbers = sendProvider === 'meta_whatsapp' && metaAudiencePersonalized
            ? metaRecipientDrafts.map(recipient => recipient.phone)
            : parseNumbers()
        if (numbers.length === 0) {
            setFeedback({ type: 'error', text: 'Adicione pelo menos um número válido' })
            return
        }
        if (sendProvider === 'connectyhub' && !msgText && msgType === 'text') {
            setFeedback({ type: 'error', text: 'Digite a mensagem da campanha' })
            return
        }
        if (sendProvider === 'meta_whatsapp' && !metaTemplateName.trim()) {
            setFeedback({ type: 'error', text: 'Informe o nome do template aprovado na Meta' })
            return
        }
        if (sendProvider === 'meta_whatsapp' && !confirmOptIn) {
            setFeedback({ type: 'error', text: 'Confirme que a lista tem opt-in antes de usar a API oficial' })
            return
        }
        if (sendProvider === 'meta_whatsapp') {
            const missingFields = getMissingMetaTemplateFields(metaAudiencePersonalized, metaAudiencePersonalized)
            if (missingFields.length) {
                setFeedback({ type: 'error', text: `Preencha ${missingFields.join(', ')}.` })
                return
            }
            if (metaAudiencePersonalized) {
                const rowWithMissingValue = metaRecipientDrafts.find(recipient => (recipient.missingVariables || []).length > 0)
                if (rowWithMissingValue) {
                    setFeedback({ type: 'error', text: `Revise a lista personalizada: ${rowWithMissingValue.phone} sem ${rowWithMissingValue.missingVariables?.join(', ')}.` })
                    return
                }
            }
        }

        if (sendProvider === 'meta_whatsapp') {
            if (!hasMetaPortfolioCapacity) {
                setFeedback({ type: 'error', text: `O portfolio Meta atingiu o limite diario compartilhado (${metaPortfolioUsage.usageLabel}). Aguarde o reset da janela de 24h ou agende para depois.` })
                return
            }
            if (!scheduleDate && numbers.length > metaPortfolioUsage.remaining) {
                setFeedback({ type: 'error', text: `A lista tem ${numbers.length} contatos, mas restam ${metaPortfolioUsage.remaining} conversas novas no limite compartilhado do portfolio Meta hoje. Divida a lista ou agende para depois.` })
                return
            }
            if (readyMetaSenders.length === 0) {
                setFeedback({ type: 'error', text: 'Todos os numeros Meta ativos atingiram o limite diario ou nao estao prontos. Aguarde o reset diario ou ative outro numero conectado.' })
                return
            }
            if (selectedMetaSenderId && selectedMetaSender && !isMetaSenderAvailable(selectedMetaSender)) {
                setFeedback({ type: 'error', text: `O numero selecionado esta indisponivel para envio (${metaSenderOptionLabel(selectedMetaSender)}). Use Pool automatico por capacidade ou escolha outro numero.` })
                return
            }
        }

        setSending(true)
        setFeedback(null)
        try {
            const templateParameters = sendProvider === 'meta_whatsapp'
                ? buildMetaTemplateParameters()
                : []

            const res = await fetch('/api/admin/whatsapp/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sendProvider === 'meta_whatsapp'
                    ? {
                        action: 'meta_whatsapp',
                        numbers: metaAudiencePersonalized ? undefined : numbers,
                        recipients: metaAudiencePersonalized
                            ? metaRecipientDrafts.map(({ missingVariables, ...recipient }) => recipient)
                            : undefined,
                        name: campaignName || `campanha_meta_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`,
                        templateName: metaTemplateName.trim(),
                        templateLanguage: metaTemplateLanguage.trim() || 'pt_BR',
                        templateParameters,
                        contactListId: selectedContactListId || undefined,
                        contactSegment: selectedContactListId ? {
                            city: contactSegmentCity.trim() || null,
                            tag: contactSegmentTag.trim() || null,
                            search: contactSegmentSearch.trim() || null,
                            filteredContacts: selectedContactListContacts.length,
                            totalContacts: contactListAudienceCounts.all || selectedContactListContacts.length,
                        } : undefined,
                        confirmOptIn,
                        optInSource: 'site_lead_authorized',
                        campaignType: metaCampaignType,
                        defaultSenderId: selectedMetaSenderId || undefined,
                        scheduled_for: scheduleDate ? new Date(scheduleDate).getTime() / 1000 : undefined,
                    }
                    : {
                        action: 'simple',
                        instanceId: selectedInstance,
                        numbers,
                        type: msgType,
                        text: msgText,
                        file: mediaUrl || undefined,
                        folder: campaignName || `campanha_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`,
                        delayMin,
                        delayMax,
                        scheduled_for: scheduleDate ? new Date(scheduleDate).getTime() / 1000 : undefined,
                    })
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: `✅ ${data.message}` })
                setShowCreateForm(false)
                setNumbersInput('')
                clearSavedContactListSelection()
                setMsgText('')
                setMediaUrl('')
                resetMetaTemplateBuilder()
                if (sendProvider === 'connectyhub') loadCampaigns()
                if (sendProvider === 'meta_whatsapp') loadMetaCampaigns()
            } else {
                setFeedback({ type: 'error', text: `❌ ${data.message}` })
            }
        } catch (e) {
            setFeedback({ type: 'error', text: '❌ Erro de conexão' })
        } finally {
            setSending(false)
        }
    }

    const manageCampaign = async (folderId: string, action: 'stop' | 'continue' | 'delete') => {
        try {
            const res = await fetch('/api/admin/whatsapp/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'manage',
                    instanceId: selectedInstance,
                    folderId,
                    manageAction: action,
                })
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: `✅ Campanha ${action === 'stop' ? 'pausada' : action === 'continue' ? 'retomada' : 'deletada'}` })
                loadCampaigns()
            }
        } catch { /* ignore */ }
    }

    const manageMetaCampaign = async (campaignId: string, action: 'pause' | 'resume' | 'cancel') => {
        try {
            const res = await fetch('/api/admin/whatsapp/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'meta_manage',
                    campaignId,
                    manageAction: action,
                })
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: data.message || 'Campanha Meta atualizada' })
                loadMetaCampaigns()
            } else {
                setFeedback({ type: 'error', text: data.message || 'Erro ao atualizar campanha Meta' })
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao atualizar campanha Meta' })
        }
    }

    const retryFailedMetaCampaign = async (campaignId: string, failedCount: number) => {
        if (failedCount <= 0) return
        const confirmed = window.confirm(`Reenviar ${failedCount} destinatario(s) que falharam nesta campanha?`)
        if (!confirmed) return

        setRetryingMetaCampaignId(campaignId)
        setFeedback(null)
        try {
            const res = await fetch('/api/admin/whatsapp/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'meta_retry_failed',
                    campaignId,
                }),
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: data.message || 'Falhas reenfileiradas para reenvio.' })
                setMetaCampaignDetails(prev => {
                    const next = { ...prev }
                    delete next[campaignId]
                    return next
                })
                setExpandedMetaCampaignId('')
                await loadMetaCampaigns()
            } else {
                setFeedback({ type: 'error', text: data.message || 'Erro ao reenviar falhas.' })
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao reenviar falhas.' })
        } finally {
            setRetryingMetaCampaignId('')
        }
    }

    const currentInstance = instances.find(i => i.id === selectedInstance)
    const approvedMetaTemplates = metaTemplates.filter(template => String(template.status || '').toUpperCase() === 'APPROVED')
    const activeMetaSenders = metaSenders.filter(sender => sender.local_status === 'active')
    const metaPortfolioUsage = metaPortfolioUsageFromSenders(activeMetaSenders)
    const hasMetaPortfolioCapacity = metaPortfolioUsage.limit > 0 && metaPortfolioUsage.remaining > 0
    const readyMetaSenders = activeMetaSenders.filter(isMetaSenderAvailable)
    const selectedMetaSender = activeMetaSenders.find(sender => sender.id === selectedMetaSenderId) || null
    const selectedContactList = metaContactLists.find(list => list.id === selectedContactListId) || null
    const selectedMetaTemplate = approvedMetaTemplates.find(template => template.name === metaTemplateName && template.language === metaTemplateLanguage) || null
    const selectedHeaderComponent = findTemplateComponent(selectedMetaTemplate, 'HEADER')
    const selectedBodyComponent = findTemplateComponent(selectedMetaTemplate, 'BODY')
    const selectedFooterComponent = findTemplateComponent(selectedMetaTemplate, 'FOOTER')
    const selectedTemplateButtons = getTemplateButtons(selectedMetaTemplate)
    const selectedHeaderFormat = textValue(selectedHeaderComponent?.format).toUpperCase()
    const selectedHeaderUsesMedia = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(selectedHeaderFormat)
    const selectedHeaderText = textValue(selectedHeaderComponent?.text)
    const selectedBodyText = textValue(selectedBodyComponent?.text)
    const selectedFooterText = textValue(selectedFooterComponent?.text)
    const selectedHeaderVariables = extractTemplateVariables(selectedHeaderText)
    const selectedBodyVariables = extractTemplateVariables(selectedBodyText)
    const selectedTemplateHeaderMediaUrl = getTemplateHeaderMediaUrl(selectedMetaTemplate)
    const previewHeaderText = replaceTemplateVariables(selectedHeaderText, { 1: metaHeaderParameterValue }, 'header')

    useEffect(() => {
        if (selectedMetaSenderId && selectedMetaSender && (!isMetaSenderAvailable(selectedMetaSender) || !hasMetaPortfolioCapacity)) {
            setSelectedMetaSenderId('')
            setFeedback({
                type: 'error',
                text: hasMetaPortfolioCapacity
                    ? `O numero selecionado atingiu o limite diario (${metaSenderUsage(selectedMetaSender).usageLabel}). Alterei para Pool automatico por capacidade.`
                    : `O portfolio Meta atingiu o limite diario compartilhado (${metaPortfolioUsage.usageLabel}).`,
            })
        }
    }, [selectedMetaSenderId, selectedMetaSender, hasMetaPortfolioCapacity, metaPortfolioUsage.usageLabel])
    const previewBodyText = replaceTemplateVariables(selectedBodyText, metaBodyParameterValues, 'exemplo')
    const parsedMetaRecipientDrafts = sendProvider === 'meta_whatsapp' && metaAudiencePersonalized ? parseMetaRecipientDrafts() : []
    const parsedNumbers = sendProvider === 'meta_whatsapp' && metaAudiencePersonalized
        ? parsedMetaRecipientDrafts.map(recipient => recipient.phone)
        : parseNumbers()
    const selectedBodyVariablesKey = selectedBodyVariables.join(',')

    useEffect(() => {
        if (!selectedContactListId || selectedContactListContacts.length === 0) return
        setNumbersInput(buildAudienceLinesFromContacts(selectedContactListContacts))
        setMetaAudiencePersonalized(true)
    }, [selectedContactListId, selectedContactListContacts, selectedBodyVariablesKey])

    useEffect(() => {
        if (!selectedMetaTemplate) {
            setMetaHeaderMediaUrl('')
            return
        }
        if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(selectedHeaderFormat)) {
            setMetaHeaderMediaUrl(selectedTemplateHeaderMediaUrl || '')
            return
        }
        setMetaHeaderMediaUrl('')
    }, [selectedMetaTemplate, selectedHeaderFormat, selectedTemplateHeaderMediaUrl])

    if (loading) return <AdminLoadingState minHeight="400px" />

    return (
        <div className="meta-campaigns-page">
            <style>{`
                .meta-campaigns-workspace {
                    display: grid;
                    grid-template-columns: minmax(700px, 1fr) minmax(440px, 520px);
                    min-height: 470px;
                }

                .meta-campaign-table-pane {
                    min-width: 0;
                    border-right: 1px solid var(--border);
                    overflow-x: auto;
                }

                .meta-campaign-detail-aside {
                    min-width: 0;
                    background: rgba(255,255,255,0.02);
                    display: grid;
                    grid-template-rows: auto 1fr;
                }

                .meta-campaign-detail-text {
                    overflow-wrap: anywhere;
                    word-break: break-word;
                    white-space: normal;
                }

                .meta-campaigns-table-empty {
                    min-width: 980px;
                }

                @media (max-width: 1500px) {
                    .meta-campaigns-workspace {
                        grid-template-columns: minmax(0, 1fr);
                    }

                    .meta-campaign-table-pane {
                        border-right: 0;
                        border-bottom: 1px solid var(--border);
                    }
                }

                @media (max-width: 900px) {
                    .meta-campaigns-table-empty {
                        min-width: 880px;
                    }
                }
            `}</style>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', margin: 0 }}>
                        <Send size={26} style={{ color: 'var(--gold)' }} /> Campanhas Meta WhatsApp
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                        Crie campanhas no WhatsApp usando a API oficial da Meta para listas com opt-in
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Link
                        href="/admin/ads/meta-templates"
                        style={{
                            padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)',
                            fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
                            textDecoration: 'none',
                        }}
                    >
                        <FileText size={16} /> Templates Meta
                    </Link>
                    <button onClick={() => setShowCreateForm(!showCreateForm)}
                        style={{
                            padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: showCreateForm ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, var(--gold), #b8860b)',
                            color: showCreateForm ? '#ef4444' : '#000', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '8px',
                        }}>
                        {showCreateForm ? <><ChevronUp size={16} /> Fechar</> : <><Plus size={16} /> Nova Campanha</>}
                    </button>
                </div>
            </div>

            <div style={{
                padding: '16px 20px', borderRadius: '12px', marginBottom: '20px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                display: 'grid', gap: '8px',
            }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Canal oficial ativo
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                        padding: '9px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--gold)',
                        background: 'rgba(201,169,110,0.12)',
                        color: 'var(--gold)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                    }}>
                        WhatsApp Cloud API Oficial
                    </span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                    Use somente listas com opt-in e templates aprovados. Follow-ups, campanhas em massa e mensagens ativas saem pelo WhatsApp oficial da Meta.
                </p>
            </div>

            {/* Instance Selector */}
            {sendProvider === 'connectyhub' && (
            <div style={{
                padding: '16px 20px', borderRadius: '12px', marginBottom: '20px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            }}>
                <Smartphone size={18} style={{ color: 'var(--gold)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Instância:</span>
                <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)}
                    style={{
                        padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', cursor: 'pointer', flex: 1, minWidth: '200px',
                    }}>
                    {instances.map(inst => (
                        <option key={inst.id} value={inst.id}>
                            {inst.virtual_brokers?.name || inst.instance_name} (✅ Conectada)
                        </option>
                    ))}
                </select>
                <button onClick={loadCampaigns} disabled={loadingCampaigns}
                    style={{
                        padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                    <RefreshCw size={14} className={loadingCampaigns ? 'spin' : ''} />
                </button>
            </div>
            )}

            {/* Feedback */}
            {feedback && (
                <div style={{
                    padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.85rem',
                    background: feedback.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                    color: feedback.type === 'success' ? '#22c55e' : '#ef4444',
                    border: `1px solid ${feedback.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                    {feedback.text}
                </div>
            )}

            {/* Create Campaign Form */}
            {showCreateForm && (
                <div style={{
                    padding: '24px', borderRadius: '14px', marginBottom: '24px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--gold-30, rgba(201,169,110,0.3))',
                }}>
                    <h2 style={{ fontSize: '1.1rem', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} style={{ color: 'var(--gold)' }} /> Nova Campanha
                    </h2>

                    <div style={{ display: 'grid', gap: '16px' }}>
                        {/* Campaign Name */}
                        <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Nome da Campanha
                            </label>
                            <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                                placeholder="Ex: Lançamento Torre Sul - Abril 2026"
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                }} />
                        </div>

                        {sendProvider === 'meta_whatsapp' && (
                            <div style={{ display: 'grid', gap: '12px', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(34,197,94,0.06)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                            Template aprovado Meta
                                        </label>
                                        {approvedMetaTemplates.length > 0 ? (
                                            <select
                                                value={metaTemplateName ? `${metaTemplateName}::${metaTemplateLanguage}` : ''}
                                                onChange={e => {
                                                    const [name, language] = e.target.value.split('::')
                                                    setMetaTemplateName(name || '')
                                                    setMetaTemplateLanguage(language || 'pt_BR')
                                                    resetMetaTemplateBuilder()
                                                }}
                                                style={{
                                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                                }}
                                            >
                                                <option value="">Selecione um template aprovado</option>
                                                {approvedMetaTemplates.map(template => (
                                                    <option key={template.id} value={`${template.name}::${template.language}`}>
                                                        {template.name} ({template.language}) - {template.category}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div style={{
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(201,169,110,0.28)',
                                                background: 'rgba(201,169,110,0.08)',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.82rem',
                                                lineHeight: 1.45,
                                            }}>
                                                Nenhum template aprovado criado pelo painel foi encontrado. Crie um novo em Templates Meta e sincronize apos aprovacao.
                                                <button
                                                    type="button"
                                                    onClick={syncMetaTemplatesForCampaigns}
                                                    disabled={loadingMetaCampaigns}
                                                    style={{
                                                        marginTop: '8px',
                                                        padding: '8px 10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid rgba(201,169,110,0.45)',
                                                        background: 'rgba(201,169,110,0.12)',
                                                        color: 'var(--gold)',
                                                        cursor: loadingMetaCampaigns ? 'not-allowed' : 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    <RefreshCw size={14} className={loadingMetaCampaigns ? 'spin' : ''} /> Sincronizar templates
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                            Idioma
                                        </label>
                                        <input value={metaTemplateLanguage} onChange={e => setMetaTemplateLanguage(e.target.value)}
                                            placeholder="pt_BR"
                                            style={{
                                                width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                            }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                            Tipo da campanha
                                        </label>
                                        <select
                                            value={metaCampaignType}
                                            onChange={e => setMetaCampaignType(e.target.value as typeof metaCampaignType)}
                                            style={{
                                                width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                            }}
                                        >
                                            <option value="marketing">Marketing</option>
                                            <option value="editorial">Editorial</option>
                                            <option value="followup">Follow-up</option>
                                            <option value="utility">Utility</option>
                                            <option value="test">Teste</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                        Numero oficial de envio
                                    </label>
                                    <select
                                        value={selectedMetaSenderId}
                                        onChange={e => setSelectedMetaSenderId(e.target.value)}
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                            color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                        }}
                                        >
                                        <option value="">Pool automatico por capacidade ({metaPortfolioUsage.remaining} restantes no portfolio)</option>
                                        {activeMetaSenders.map(sender => (
                                            <option key={sender.id} value={sender.id} disabled={!isMetaSenderAvailable(sender) || !hasMetaPortfolioCapacity}>
                                                {metaSenderOptionLabel(sender)}
                                            </option>
                                        ))}
                                    </select>
                                    <div style={{ marginTop: '8px', color: hasMetaPortfolioCapacity ? '#16a34a' : '#ef4444', fontSize: '0.78rem', fontWeight: 700 }}>
                                        Limite compartilhado do portfolio: {metaPortfolioUsage.usageLabel}; restam {metaPortfolioUsage.remaining}.
                                    </div>
                                    {selectedMetaSender && !isMetaSenderAvailable(selectedMetaSender) && (
                                        <div style={{ marginTop: '8px', color: '#ef4444', fontSize: '0.78rem', fontWeight: 700 }}>
                                            Este numero atingiu o limite diario. Use o pool automatico ou outro numero conectado.
                                        </div>
                                    )}
                                    {!selectedMetaSenderId && readyMetaSenders.length > 0 && hasMetaPortfolioCapacity && (
                                        <div style={{ marginTop: '8px', color: '#16a34a', fontSize: '0.78rem', fontWeight: 700 }}>
                                            Pool automatico vai usar um numero conectado, respeitando o limite compartilhado.
                                        </div>
                                    )}
                                </div>
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                                    <input
                                        type="checkbox"
                                        checked={metaAudiencePersonalized}
                                        onChange={e => setMetaAudiencePersonalized(e.target.checked)}
                                        style={{ marginTop: '3px' }}
                                    />
                                    Personalizar valores por contato usando linhas com telefone, nome e variaveis do template.
                                </label>
                                {selectedMetaTemplate ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', alignItems: 'start' }}>
                                        <div style={{ display: 'grid', gap: '12px' }}>
                                            <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.22)', background: 'rgba(34,197,94,0.08)', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                                                <strong style={{ color: 'var(--text-primary)' }}>{selectedMetaTemplate.name}</strong>
                                                <div>{selectedMetaTemplate.category} | {selectedMetaTemplate.language} | {selectedTemplateButtons.length} botao(s)</div>
                                            </div>

                                            {selectedHeaderComponent && (
                                                <div>
                                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                                        Header {selectedHeaderFormat ? `(${selectedHeaderFormat})` : ''}
                                                    </label>
                                                    {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(selectedHeaderFormat) ? (
                                                        <div style={{ display: 'grid', gap: '8px' }}>
                                                            <input
                                                                value={metaHeaderMediaUrl}
                                                                onChange={e => setMetaHeaderMediaUrl(e.target.value)}
                                                                placeholder={selectedTemplateHeaderMediaUrl ? 'Midia padrao preenchida automaticamente' : 'Cole uma URL publica HTTPS para esta midia'}
                                                                style={{
                                                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                                                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                                                }}
                                                            />
                                                            {selectedTemplateHeaderMediaUrl ? (
                                                                <div style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.08)', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.35 }}>
                                                                    Midia padrao carregada do template. O usuario pode criar a campanha sem mexer nesse campo.
                                                                </div>
                                                            ) : (
                                                                <div style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.08)', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.35 }}>
                                                                    Este template nao tem midia salva no R2. Reenvie o template com upload de midia pelo painel ou informe uma URL publica.
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : selectedHeaderVariables.length > 0 ? (
                                                        <input
                                                            value={metaHeaderParameterValue}
                                                            onChange={e => setMetaHeaderParameterValue(e.target.value)}
                                                            placeholder={`Valor para {{${selectedHeaderVariables[0]}}}`}
                                                            style={{
                                                                width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                                                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                                                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                                            }}
                                                        />
                                                    ) : (
                                                        <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                                            {selectedHeaderText || 'Header fixo aprovado'}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div>
                                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                                    Variaveis do corpo
                                                </label>
                                                {selectedBodyVariables.length > 0 ? (
                                                    <div style={{ display: 'grid', gap: '8px' }}>
                                                        {selectedBodyVariables.map(variable => (
                                                            <input
                                                                key={variable}
                                                                value={metaBodyParameterValues[String(variable)] || ''}
                                                                onChange={e => setMetaBodyParameterValues(prev => ({ ...prev, [String(variable)]: e.target.value }))}
                                                                placeholder={`Valor para {{${variable}}}`}
                                                                style={{
                                                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                                                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                                        Este template nao tem variaveis no corpo.
                                                    </div>
                                                )}
                                            </div>

                                            {selectedTemplateButtons.length > 0 && (
                                                <div>
                                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                                        Botoes do template
                                                    </label>
                                                    <div style={{ display: 'grid', gap: '8px' }}>
                                                        {selectedTemplateButtons.map((button, index) => {
                                                            const buttonType = textValue(button.type).toUpperCase()
                                                            const buttonLabel = textValue(button.text) || `Botao ${index + 1}`
                                                            const needsValue = buttonNeedsDynamicUrl(button) || buttonNeedsCouponCode(button) || buttonType === 'QUICK_REPLY'
                                                            return (
                                                                <div key={`${buttonType}-${index}`} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', display: 'grid', gap: '8px' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                                                        <strong style={{ color: 'var(--text-primary)' }}>{buttonLabel}</strong>
                                                                        <span>{buttonType}</span>
                                                                    </div>
                                                                    {needsValue ? (
                                                                        <input
                                                                            value={metaButtonParameterValues[String(index)] || ''}
                                                                            onChange={e => setMetaButtonParameterValues(prev => ({ ...prev, [String(index)]: e.target.value }))}
                                                                            placeholder={buttonNeedsDynamicUrl(button) ? 'Complemento dinamico da URL' : buttonNeedsCouponCode(button) ? 'Codigo do cupom' : 'Payload interno opcional'}
                                                                            style={{
                                                                                width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '0.84rem',
                                                                                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                                                                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Botao fixo aprovado no template</span>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ borderRadius: '18px', padding: '14px', background: 'linear-gradient(180deg, rgba(15,23,42,0.18), rgba(15,23,42,0.06))', border: '1px solid var(--border)' }}>
                                            <div style={{ borderRadius: '16px', padding: '12px', background: '#efe7dc', color: '#111827', minHeight: '260px' }}>
                                                <div style={{ maxWidth: '86%', marginLeft: 'auto', borderRadius: '12px 12px 2px 12px', padding: '10px 12px', background: '#dcf8c6', boxShadow: '0 1px 2px rgba(0,0,0,0.16)', fontSize: '0.86rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                                                    {selectedHeaderComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(selectedHeaderFormat) && (
                                                        <div style={{ marginBottom: '8px', borderRadius: '10px', overflow: 'hidden', background: '#cbd5e1', minHeight: '84px', display: 'grid', placeItems: 'center', color: '#475569', fontWeight: 700 }}>
                                                            {selectedHeaderFormat === 'IMAGE' && metaHeaderMediaUrl ? (
                                                                <img src={metaHeaderMediaUrl} alt="" style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: '180px' }} />
                                                            ) : selectedHeaderFormat}
                                                        </div>
                                                    )}
                                                    {selectedHeaderComponent && selectedHeaderFormat === 'TEXT' && selectedHeaderText && (
                                                        <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                                                            {renderWhatsAppPreviewText(previewHeaderText)}
                                                        </div>
                                                    )}
                                                    <div>{renderWhatsAppPreviewText(previewBodyText || selectedMetaTemplate.name)}</div>
                                                    {selectedFooterText && (
                                                        <div style={{ marginTop: '8px', color: '#64748b', fontSize: '0.76rem' }}>
                                                            {selectedFooterText}
                                                        </div>
                                                    )}
                                                    {selectedTemplateButtons.length > 0 && (
                                                        <div style={{ display: 'grid', gap: '6px', marginTop: '10px' }}>
                                                            {selectedTemplateButtons.map((button, index) => {
                                                                const buttonLabel = textValue(button.text) || `Botao ${index + 1}`
                                                                return (
                                                                    <div key={`preview-${index}`} style={{ borderTop: '1px solid rgba(15,23,42,0.12)', paddingTop: '7px', textAlign: 'center', color: '#0369a1', fontWeight: 700 }}>
                                                                        {buttonLabel}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                            Parametros do corpo
                                        </label>
                                        <textarea value={metaTemplateParameters} onChange={e => setMetaTemplateParameters(e.target.value)}
                                            placeholder={"Um valor por linha, na ordem {{1}}, {{2}}, {{3}} do template"}
                                            rows={3}
                                            style={{
                                                width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                                color: 'var(--text-primary)', outline: 'none', resize: 'vertical',
                                                fontFamily: 'inherit', boxSizing: 'border-box',
                                            }} />
                                    </div>
                                )}
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                                    <input
                                        type="checkbox"
                                        checked={confirmOptIn}
                                        onChange={e => setConfirmOptIn(e.target.checked)}
                                        style={{ marginTop: '3px' }}
                                    />
                                    Confirmo que todos os contatos desta lista deram opt-in para receber mensagens WhatsApp da imobiliaria.
                                </label>
                            </div>
                        )}

                        {sendProvider === 'connectyhub' && (
                        <>
                        {/* Message Type */}
                        <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Tipo de Mensagem
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {MSG_TYPES.map(t => (
                                    <button key={t.value} onClick={() => setMsgType(t.value)}
                                        style={{
                                            padding: '8px 16px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                                            border: `1px solid ${msgType === t.value ? 'var(--gold)' : 'var(--border)'}`,
                                            background: msgType === t.value ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
                                            color: msgType === t.value ? 'var(--gold)' : 'var(--text-secondary)',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                        }}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Message Text */}
                        <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Mensagem
                            </label>
                            <textarea value={msgText} onChange={e => setMsgText(e.target.value)}
                                placeholder="Digite a mensagem da campanha..."
                                rows={4}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', outline: 'none', resize: 'vertical',
                                    fontFamily: 'inherit', boxSizing: 'border-box',
                                }} />
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Variáveis: {'{{name}}'} para o nome do contato
                            </div>
                        </div>

                        {/* Media URL (for image/audio/video) */}
                        {msgType !== 'text' && (
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    URL da Mídia
                                </label>
                                <input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
                                    placeholder="https://... (URL pública da imagem/áudio/vídeo)"
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                        color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                    }} />
                            </div>
                        )}
                        </>
                        )}

                        {sendProvider === 'meta_whatsapp' && (
                            <div style={{
                                display: 'grid',
                                gap: '14px',
                                padding: '14px',
                                borderRadius: '12px',
                                border: '1px solid var(--border)',
                                background: 'rgba(255,255,255,0.03)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Users size={17} style={{ color: 'var(--gold)' }} /> Listas salvas de contatos
                                        </h3>
                                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                                            Salve listas XLSX, CSV ou TXT com nome, telefone e variaveis para reutilizar em campanhas futuras.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={loadMetaContactLists}
                                        disabled={loadingContactLists}
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            background: 'rgba(255,255,255,0.04)',
                                            color: 'var(--text-secondary)',
                                            cursor: loadingContactLists ? 'not-allowed' : 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                        }}
                                    >
                                        <RefreshCw size={14} className={loadingContactLists ? 'spin' : ''} /> Atualizar listas
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                            Usar lista existente
                                        </label>
                                        <select
                                            value={selectedContactListId}
                                            onChange={event => {
                                                const listId = event.target.value
                                                if (!listId) {
                                                    clearSavedContactListSelection()
                                                    return
                                                }
                                                void loadSavedContactListIntoAudience(listId, { resetFilters: true })
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                borderRadius: '8px',
                                                fontSize: '0.9rem',
                                                background: 'rgba(255,255,255,0.06)',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-primary)',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                            }}
                                        >
                                            <option value="">Selecione uma lista salva</option>
                                            {metaContactLists.map(list => (
                                                <option key={list.id} value={list.id}>
                                                    {list.name} ({list.valid_contacts} contatos)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                            Nome da nova lista
                                        </label>
                                        <input
                                            value={contactListName}
                                            onChange={event => setContactListName(event.target.value)}
                                            placeholder="Ex: Midhaus Selecao 250 Leads"
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                borderRadius: '8px',
                                                fontSize: '0.9rem',
                                                background: 'rgba(255,255,255,0.06)',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-primary)',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'end', gap: '8px', flexWrap: 'wrap' }}>
                                        <label
                                            style={{
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--gold)',
                                                background: 'rgba(201,169,110,0.12)',
                                                color: 'var(--gold)',
                                                cursor: savingContactList ? 'not-allowed' : 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.82rem',
                                                fontWeight: 700,
                                                minHeight: '42px',
                                            }}
                                        >
                                            {savingContactList ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                                            Salvar CSV/XLSX
                                            <input
                                                type="file"
                                                accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
                                                disabled={savingContactList}
                                                onChange={event => {
                                                    const selectedFile = event.currentTarget.files?.[0]
                                                    event.currentTarget.value = ''
                                                    void uploadSavedContactList(selectedFile)
                                                }}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                        {selectedContactListId && (
                                            <button
                                                type="button"
                                                onClick={clearSavedContactListSelection}
                                                style={{
                                                    padding: '10px 12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border)',
                                                    background: 'rgba(255,255,255,0.04)',
                                                    color: 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.82rem',
                                                    fontWeight: 700,
                                                    minHeight: '42px',
                                                }}
                                            >
                                                Desvincular
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {selectedContactList && (
                                    <div style={{
                                        display: 'grid',
                                        gap: '12px',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(59,130,246,0.18)',
                                        background: 'rgba(59,130,246,0.06)',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                            <div>
                                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Segmentar lista</strong>
                                                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.4 }}>
                                                    Filtre a lista por cidade, tag ou busca antes de enviar. O campo de numeros e atualizado automaticamente.
                                                </p>
                                            </div>
                                            <span style={{
                                                padding: '6px 10px',
                                                borderRadius: '999px',
                                                background: 'rgba(255,255,255,0.08)',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.76rem',
                                                fontWeight: 700,
                                            }}>
                                                {contactListAudienceCounts.filtered || selectedContactListContacts.length} de {contactListAudienceCounts.all || selectedContactList.valid_contacts} selecionados
                                            </span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'end' }}>
                                            <div>
                                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                                    Cidade
                                                </label>
                                                <select
                                                    value={contactSegmentCity}
                                                    onChange={event => setContactSegmentCity(event.target.value)}
                                                    disabled={loadingContactListAudience || !(contactListSegments?.cities.length)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '9px 12px',
                                                        borderRadius: '8px',
                                                        fontSize: '0.84rem',
                                                        background: 'rgba(255,255,255,0.06)',
                                                        border: '1px solid var(--border)',
                                                        color: 'var(--text-primary)',
                                                        outline: 'none',
                                                        boxSizing: 'border-box',
                                                    }}
                                                >
                                                    <option value="">Todas as cidades</option>
                                                    {(contactListSegments?.cities || []).map(city => (
                                                        <option key={city.value} value={city.value}>
                                                            {city.value} ({city.count})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                                    Tag
                                                </label>
                                                <select
                                                    value={contactSegmentTag}
                                                    onChange={event => setContactSegmentTag(event.target.value)}
                                                    disabled={loadingContactListAudience || !(contactListSegments?.tags.length)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '9px 12px',
                                                        borderRadius: '8px',
                                                        fontSize: '0.84rem',
                                                        background: 'rgba(255,255,255,0.06)',
                                                        border: '1px solid var(--border)',
                                                        color: 'var(--text-primary)',
                                                        outline: 'none',
                                                        boxSizing: 'border-box',
                                                    }}
                                                >
                                                    <option value="">Todas as tags</option>
                                                    {(contactListSegments?.tags || []).map(tag => (
                                                        <option key={tag.value} value={tag.value}>
                                                            {tag.value} ({tag.count})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                                    Busca
                                                </label>
                                                <input
                                                    value={contactSegmentSearch}
                                                    onChange={event => setContactSegmentSearch(event.target.value)}
                                                    placeholder="Nome, telefone, email, cidade ou tag"
                                                    disabled={loadingContactListAudience}
                                                    style={{
                                                        width: '100%',
                                                        padding: '9px 12px',
                                                        borderRadius: '8px',
                                                        fontSize: '0.84rem',
                                                        background: 'rgba(255,255,255,0.06)',
                                                        border: '1px solid var(--border)',
                                                        color: 'var(--text-primary)',
                                                        outline: 'none',
                                                        boxSizing: 'border-box',
                                                    }}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => void loadSavedContactListIntoAudience(selectedContactListId, {
                                                        city: contactSegmentCity,
                                                        tag: contactSegmentTag,
                                                        search: contactSegmentSearch,
                                                    })}
                                                    disabled={loadingContactListAudience}
                                                    style={{
                                                        padding: '9px 11px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--gold)',
                                                        background: 'rgba(201,169,110,0.12)',
                                                        color: 'var(--gold)',
                                                        cursor: loadingContactListAudience ? 'not-allowed' : 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {loadingContactListAudience ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                                                    Aplicar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void loadSavedContactListIntoAudience(selectedContactListId, { resetFilters: true })}
                                                    disabled={loadingContactListAudience}
                                                    style={{
                                                        padding: '9px 11px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border)',
                                                        background: 'rgba(255,255,255,0.04)',
                                                        color: 'var(--text-secondary)',
                                                        cursor: loadingContactListAudience ? 'not-allowed' : 'pointer',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    Limpar
                                                </button>
                                            </div>
                                        </div>

                                        {contactListSegments && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                                                <span>{contactListSegments.stats.with_name} com nome</span>
                                                <span>{contactListSegments.stats.with_city} com cidade</span>
                                                <span>{contactListSegments.stats.with_tags} com tags</span>
                                                <span>{contactListSegments.stats.with_variables} com variaveis</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.74rem', lineHeight: 1.45 }}>
                                    O modelo baixado pelo painel e CSV e pode ser enviado aqui. Se o Excel gerar um arquivo .xls antigo, salve novamente como .xlsx antes de subir.
                                </p>

                                {selectedContactList && (
                                    <div style={{
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(34,197,94,0.22)',
                                        background: 'rgba(34,197,94,0.08)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.8rem',
                                        lineHeight: 1.45,
                                    }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>{selectedContactList.name}</strong>
                                        {' '}carregada com {selectedContactListContacts.length} contato(s).
                                        {contactListAudienceCounts.all && contactListAudienceCounts.all !== selectedContactListContacts.length ? ` Total da lista: ${contactListAudienceCounts.all}.` : ''}
                                        {selectedContactList.source_file_name ? ` Origem: ${selectedContactList.source_file_name}.` : ''}
                                        {selectedContactList.duplicate_contacts || selectedContactList.invalid_contacts ? (
                                            <> Ignorados: {selectedContactList.duplicate_contacts} duplicado(s), {selectedContactList.invalid_contacts} invalido(s).</>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Numbers */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                                    {sendProvider === 'meta_whatsapp' && metaAudiencePersonalized
                                        ? 'Lista personalizada'
                                        : 'Numeros (um por linha, ou separados por virgula)'}
                                </label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={downloadAudienceTemplate}
                                        style={{
                                            padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)',
                                            background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
                                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            fontSize: '0.78rem', fontWeight: 700,
                                        }}
                                    >
                                        <Download size={14} /> Baixar modelo CSV
                                    </button>
                                    <label
                                        style={{
                                            padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gold)',
                                            background: 'rgba(201,169,110,0.12)', color: 'var(--gold)',
                                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            fontSize: '0.78rem', fontWeight: 700,
                                        }}
                                    >
                                        <Upload size={14} /> Importar CSV/TXT rapido
                                        <input
                                            type="file"
                                            accept=".csv,.txt,text/csv,text/plain"
                                            onChange={event => {
                                                const selectedFile = event.currentTarget.files?.[0]
                                                event.currentTarget.value = ''
                                                void importAudienceFile(selectedFile)
                                            }}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                </div>
                            </div>
                            <textarea value={numbersInput} onChange={e => setNumbersInput(e.target.value)}
                                placeholder={sendProvider === 'meta_whatsapp' && metaAudiencePersonalized
                                    ? `5547999999999; Maria${selectedBodyVariables.map(variable => `; valor {{${variable}}}`).join('') || '; valor {{1}}'}${selectedHeaderUsesMedia ? '; https://guilhermepilger.ai/foto.jpg' : ''}\n5547888888888; Joao${selectedBodyVariables.map(variable => `; valor {{${variable}}}`).join('') || '; valor {{1}}'}${selectedHeaderUsesMedia ? '; https://guilhermepilger.ai/foto-2.jpg' : ''}`
                                    : "5547999999999\n5547888888888\n5511777777777"}
                                rows={5}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', outline: 'none', resize: 'vertical',
                                    fontFamily: 'monospace', boxSizing: 'border-box',
                                }} />
                            <div style={{
                                fontSize: '0.78rem', color: parsedNumbers.length > 0 ? '#22c55e' : 'var(--text-muted)',
                                marginTop: '4px', fontWeight: 600,
                            }}>
                                {parsedNumbers.length > 0 ? `✅ ${parsedNumbers.length} número(s) válido(s)` : 'Nenhum número adicionado'}
                            </div>
                            {sendProvider === 'meta_whatsapp' && metaAudiencePersonalized && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.45 }}>
                                    Formato: telefone; nome{selectedBodyVariables.map(variable => `; valor para {{${variable}}}`).join('') || '; valor para {{1}}'}{selectedHeaderUsesMedia ? '; URL da midia do header' : ''}.
                                    {parsedMetaRecipientDrafts.some(recipient => (recipient.missingVariables || []).length > 0) && (
                                        <span style={{ color: '#ef4444', display: 'block', marginTop: '4px' }}>
                                            Existem linhas com variaveis obrigatorias vazias.
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Delay & Schedule */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                            {sendProvider === 'connectyhub' && (
                            <>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    Delay Mín (seg)
                                </label>
                                <input type="number" value={delayMin} onChange={e => setDelayMin(Number(e.target.value))} min={5} max={120}
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                        color: 'var(--gold)', outline: 'none', fontWeight: 600, boxSizing: 'border-box',
                                    }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    Delay Máx (seg)
                                </label>
                                <input type="number" value={delayMax} onChange={e => setDelayMax(Number(e.target.value))} min={10} max={300}
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                        color: 'var(--gold)', outline: 'none', fontWeight: 600, boxSizing: 'border-box',
                                    }} />
                            </div>
                            </>
                            )}
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    Agendar (opcional)
                                </label>
                                <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                        color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                    }} />
                            </div>
                        </div>

                        {/* Send Button */}
                        <button onClick={sendCampaign} disabled={sending || parsedNumbers.length === 0}
                            style={{
                                padding: '14px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, var(--gold), #b8860b)',
                                color: '#000', fontWeight: 700, fontSize: '1rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                opacity: sending || parsedNumbers.length === 0 ? 0.5 : 1,
                                transition: 'all 0.2s',
                            }}>
                            {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                            {sending ? 'Enviando...' : scheduleDate ? `Agendar para ${parsedNumbers.length} contatos` : `Enviar para ${parsedNumbers.length} contatos`}
                        </button>
                    </div>
                </div>
            )}

            {/* Campaigns List */}
            {sendProvider === 'connectyhub' ? (
            <div>
                <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <MessageSquare size={18} style={{ color: 'var(--gold)' }} /> Campanhas Enviadas
                </h2>

                {loadingCampaigns ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <Loader2 size={20} className="spin" /> Carregando campanhas...
                    </div>
                ) : campaigns.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '40px', borderRadius: '12px',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                    }}>
                        <Send size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                        <p>Nenhuma campanha encontrada nesta instância</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {campaigns.map((camp, idx) => (
                            <CampaignCard key={camp.id || idx} campaign={camp}
                                onManage={(action) => manageCampaign(camp.id, action)} />
                        ))}
                    </div>
                )}
            </div>
            ) : (
                <MetaOfficialCampaignPanel
                    campaigns={metaCampaigns}
                    senders={metaSenders}
                    summary={metaSummary}
                    analytics={metaAnalytics}
                    replyReport={metaReplyReport}
                    replyReportLoading={loadingMetaReplyReport}
                    replyIntentFilter={metaReplyIntentFilter}
                    loading={loadingMetaCampaigns}
                    statusFilter={metaStatusFilter}
                    expandedCampaignId={expandedMetaCampaignId}
                    loadingDetailCampaignId={loadingMetaCampaignDetail}
                    campaignDetails={metaCampaignDetails}
                    onStatusFilterChange={setMetaStatusFilter}
                    onReplyIntentFilterChange={setMetaReplyIntentFilter}
                    onRefresh={refreshMetaWorkspace}
                    onReplyRefresh={loadMetaReplyReport}
                    onReplyExport={exportMetaRepliesCsv}
                    onToggleDetail={toggleMetaCampaignDetail}
                    onManage={manageMetaCampaign}
                    retryingCampaignId={retryingMetaCampaignId}
                    onRetryFailed={retryFailedMetaCampaign}
                />
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                .spin { animation: spin 1.2s linear infinite; }
            `}</style>
        </div>
    )
}

function formatMetaDate(value?: string | null) {
    if (!value) return 'Sem data'
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return 'Data invalida'
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

function metaStatusLabel(status: string) {
    const labels: Record<string, string> = {
        draft: 'Rascunho',
        scheduled: 'Agendada',
        preparing: 'Preparando',
        queued: 'Na fila',
        sending: 'Enviando',
        paused: 'Pausada',
        completed: 'Concluida',
        cancelled: 'Cancelada',
        failed: 'Falhou',
        sent: 'Aceita Meta',
        delivered: 'Entregue',
        read: 'Lida',
        skipped: 'Ignorada',
        opted_out: 'Opt-out',
    }
    return labels[status] || status
}

function metaStatusColor(status: string) {
    if (status === 'completed') return '#22c55e'
    if (status === 'read') return '#16a34a'
    if (status === 'delivered') return '#22c55e'
    if (status === 'sent') return '#38bdf8'
    if (status === 'failed' || status === 'cancelled') return '#ef4444'
    if (status === 'paused') return '#6366f1'
    if (status === 'scheduled') return '#38bdf8'
    if (status === 'skipped' || status === 'opted_out') return '#f59e0b'
    if (status === 'queued' || status === 'sending' || status === 'preparing') return '#f59e0b'
    return 'var(--text-muted)'
}

function metaProgress(campaign: MetaCampaign) {
    const total = Number(campaign.total_recipients || 0)
    if (total <= 0) return 0
    const done = Number(campaign.total_sent || 0)
        + Number(campaign.total_failed || 0)
        + Number(campaign.total_skipped || 0)
    return Math.min(100, Math.round((done / total) * 100))
}

function metricRate(part: number, total: number) {
    if (!total) return 0
    return Math.round((part / total) * 1000) / 10
}

function percentLabel(value?: number | null) {
    return `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function shortDateLabel(value: string) {
    const date = new Date(`${value}T00:00:00`)
    if (!Number.isFinite(date.getTime())) return value
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}

function shortProviderId(value?: string | null) {
    if (!value) return '-'
    if (value.length <= 18) return value
    return `${value.slice(0, 10)}...${value.slice(-6)}`
}

function jsonPreview(value: unknown) {
    if (!value) return ''
    try {
        const text = JSON.stringify(value)
        return text.length > 180 ? `${text.slice(0, 180)}...` : text
    } catch {
        return ''
    }
}

function payloadErrorSummary(payload: unknown) {
    const source = typeof payload === 'object' && payload !== null ? payload as Record<string, any> : {}
    const firstStatus = Array.isArray(source.statuses) ? source.statuses[0] : null
    const firstError = Array.isArray(source.errors) ? source.errors[0] : null
    const statusError = Array.isArray(firstStatus?.errors) ? firstStatus.errors[0] : null
    const error = firstError || statusError || source.error
    if (!error || typeof error !== 'object') return ''
    return [
        error.code ? `Codigo ${error.code}` : '',
        error.title || error.message || '',
        error.error_data?.details || error.details || '',
    ].filter(Boolean).join(' | ')
}

function metaErrorHint(code?: string | null, message?: string | null) {
    const selectedCode = String(code || '')
    const selectedMessage = String(message || '').toLowerCase()
    if (selectedCode === '131042' || selectedMessage.includes('payment')) {
        return 'Pagamento/elegibilidade da WABA. Verifique metodo de pagamento, linha de credito e cobranca do WhatsApp.'
    }
    if (selectedCode === '131026') return 'Numero nao pode receber a mensagem. Confira se existe no WhatsApp e se nao bloqueou o contato.'
    if (selectedCode === '131047') return 'Janela de atendimento expirada. Use template aprovado para iniciar conversa.'
    if (selectedCode === '132000' || selectedCode === '132001') return 'Variaveis do template nao batem com o modelo aprovado.'
    if (selectedCode === '132015' || selectedCode === '132016') return 'Template pausado/desabilitado pela Meta.'
    if (selectedCode === '131056' || selectedMessage.includes('limit')) return 'Limite do numero ou da conta atingido.'
    return 'Confira o payload Meta e o status do destinatario para a causa exata.'
}

function campaignErrorGroups(recipients: MetaCampaignRecipient[], events: MetaCampaignEvent[] = []) {
    const eventErrorByMessageId = new Map<string, string>()
    for (const event of events) {
        const summary = payloadErrorSummary(event.payload)
        if (summary && event.provider_message_id) eventErrorByMessageId.set(event.provider_message_id, summary)
    }

    const groups = new Map<string, {
        code: string
        message: string
        count: number
        hint: string
        detail?: string
    }>()

    for (const recipient of recipients) {
        if (recipient.status !== 'failed' && !recipient.error_code && !recipient.error_message) continue
        const payloadSummary = recipient.provider_message_id ? eventErrorByMessageId.get(recipient.provider_message_id) : ''
        const code = recipient.error_code || 'sem_codigo'
        const message = recipient.error_message || payloadSummary || 'Falha sem mensagem'
        const key = `${code}:${message}`
        const group = groups.get(key) || {
            code,
            message,
            count: 0,
            hint: metaErrorHint(code, message),
            detail: payloadSummary,
        }
        group.count += 1
        groups.set(key, group)
    }

    return Array.from(groups.values()).sort((a, b) => b.count - a.count)
}

const META_CHART_COLORS = ['#b08a43', '#22c55e', '#38bdf8', '#ef4444', '#6366f1', '#f59e0b']

function MetaOfficialCampaignPanel({
    campaigns,
    senders,
    summary,
    analytics,
    replyReport,
    replyReportLoading,
    replyIntentFilter,
    loading,
    statusFilter,
    expandedCampaignId,
    loadingDetailCampaignId,
    campaignDetails,
    onStatusFilterChange,
    onReplyIntentFilterChange,
    onRefresh,
    onReplyRefresh,
    onReplyExport,
    onToggleDetail,
    onManage,
    retryingCampaignId,
    onRetryFailed,
}: {
    campaigns: MetaCampaign[]
    senders: MetaSender[]
    summary: MetaCampaignSummary | null
    analytics: MetaCampaignAnalytics | null
    replyReport: MetaReplyReport | null
    replyReportLoading: boolean
    replyIntentFilter: string
    loading: boolean
    statusFilter: string
    expandedCampaignId: string
    loadingDetailCampaignId: string
    campaignDetails: Record<string, MetaCampaignDetail>
    onStatusFilterChange: (value: string) => void
    onReplyIntentFilterChange: (value: string) => void
    onRefresh: () => void
    onReplyRefresh: () => void
    onReplyExport: (intent?: string) => void
    onToggleDetail: (campaignId: string) => void
    onManage: (campaignId: string, action: 'pause' | 'resume' | 'cancel') => void
    retryingCampaignId: string
    onRetryFailed: (campaignId: string, failedCount: number) => void
}) {
    const [searchTerm, setSearchTerm] = useState('')
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const statusCounts = summary?.byStatus || {}
    const statusOptions = [
        { value: '', label: 'Todas', count: summary?.total || campaigns.length },
        { value: 'queued', label: 'Fila', count: statusCounts.queued || 0 },
        { value: 'sending', label: 'Enviando', count: statusCounts.sending || 0 },
        { value: 'completed', label: 'Concluidas', count: statusCounts.completed || 0 },
        { value: 'failed', label: 'Falhas', count: statusCounts.failed || 0 },
        { value: 'paused', label: 'Pausadas', count: statusCounts.paused || 0 },
        { value: 'scheduled', label: 'Agendadas', count: statusCounts.scheduled || 0 },
    ]
    const metricItems = [
        { label: 'Campanhas', value: summary?.total || 0, icon: MessageSquare, color: 'var(--gold)' },
        { label: 'Destinatarios', value: summary?.recipients || 0, icon: Users, color: '#38bdf8' },
        { label: 'Aceitas Meta', value: summary?.sent || 0, icon: CheckCircle2, color: '#22c55e' },
        { label: 'Entregues', value: summary?.delivered || 0, icon: Inbox, color: '#16a34a' },
        { label: 'Lidas', value: summary?.read || 0, icon: Eye, color: '#0ea5e9' },
        { label: 'Falhas', value: summary?.failed || 0, icon: AlertCircle, color: '#ef4444' },
    ]
    const rateItems = [
        { label: 'Taxa aceite', value: percentLabel(analytics?.rates?.acceptedRate ?? metricRate(summary?.sent || 0, summary?.recipients || 0)), color: '#38bdf8' },
        { label: 'Entrega', value: percentLabel(analytics?.rates?.deliveryRate ?? metricRate(summary?.delivered || 0, summary?.sent || summary?.recipients || 0)), color: '#22c55e' },
        { label: 'Leitura', value: percentLabel(analytics?.rates?.readRate ?? metricRate(summary?.read || 0, summary?.delivered || summary?.sent || summary?.recipients || 0)), color: '#0ea5e9' },
        { label: 'Falha', value: percentLabel(analytics?.rates?.failureRate ?? metricRate(summary?.failed || 0, summary?.recipients || 0)), color: '#ef4444' },
    ]
    const filteredCampaigns = campaigns.filter(campaign => {
        if (!normalizedSearch) return true
        const sender = senders.find(item => item.id === campaign.default_sender_id)
        return [
            campaign.name,
            campaign.status,
            campaign.template_name,
            campaign.template_language,
            campaign.campaign_type,
            sender?.display_name,
            sender?.phone_number,
        ].some(value => String(value || '').toLowerCase().includes(normalizedSearch))
    })
    const selectedCampaign = (
        filteredCampaigns.find(item => item.id === expandedCampaignId)
        || campaigns.find(item => item.id === expandedCampaignId)
        || filteredCampaigns[0]
        || null
    )
    const selectedSender = selectedCampaign
        ? senders.find(item => item.id === selectedCampaign.default_sender_id)
        : undefined
    const selectedDetail = selectedCampaign ? campaignDetails[selectedCampaign.id] : undefined
    const selectedCampaignId = selectedCampaign?.id || ''
    const selectCampaign = (campaignId: string) => {
        if (expandedCampaignId === campaignId) return
        onToggleDetail(campaignId)
    }

    return (
        <div style={{ display: 'grid', gap: '14px' }}>
            <div style={{
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
            }}>
                <div style={{
                    padding: '12px 14px 10px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                }}>
                    {statusOptions.map(option => {
                        const active = statusFilter === option.value
                        return (
                            <button
                                key={option.value || 'all'}
                                type="button"
                                onClick={() => onStatusFilterChange(option.value)}
                                style={{
                                    minHeight: '34px',
                                    padding: '7px 11px',
                                    borderRadius: '8px',
                                    border: active ? '1px solid rgba(176,138,67,0.36)' : '1px solid var(--border)',
                                    background: active ? 'rgba(176,138,67,0.13)' : 'rgba(255,255,255,0.04)',
                                    color: active ? 'var(--gold)' : 'var(--text-primary)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '7px',
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                }}
                            >
                                {option.label}
                                <span style={{
                                    minWidth: '20px',
                                    height: '20px',
                                    borderRadius: '999px',
                                    background: active ? 'rgba(176,138,67,0.18)' : 'rgba(148,163,184,0.14)',
                                    color: active ? 'var(--gold)' : 'var(--text-muted)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 6px',
                                    fontSize: '0.68rem',
                                    lineHeight: 1,
                                }}>
                                    {Number(option.count || 0).toLocaleString('pt-BR')}
                                </span>
                            </button>
                        )
                    })}
                </div>

                <div style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                }}>
                    <label style={{
                        flex: '1 1 260px',
                        minHeight: '38px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 10px',
                        color: 'var(--text-muted)',
                    }}>
                        <Search size={15} />
                        <input
                            value={searchTerm}
                            onChange={event => setSearchTerm(event.target.value)}
                            placeholder="Pesquisar campanha, template, numero ou status"
                            style={{
                                border: 0,
                                outline: 'none',
                                background: 'transparent',
                                color: 'var(--text-primary)',
                                width: '100%',
                                fontSize: '0.82rem',
                            }}
                        />
                    </label>
                    <select
                        value={statusFilter}
                        onChange={e => onStatusFilterChange(e.target.value)}
                        style={{
                            minHeight: '38px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.06)',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                        }}
                    >
                        <option value="">Todos os status</option>
                        <option value="scheduled">Agendadas</option>
                        <option value="queued">Na fila</option>
                        <option value="sending">Enviando</option>
                        <option value="paused">Pausadas</option>
                        <option value="completed">Concluidas</option>
                        <option value="failed">Falhas</option>
                        <option value="cancelled">Canceladas</option>
                    </select>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        style={{
                            minHeight: '38px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--text-secondary)',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 800,
                        }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        Atualizar
                    </button>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, minmax(118px, 1fr))',
                    borderBottom: '1px solid var(--border)',
                    overflowX: 'auto',
                }}>
                    {metricItems.map(item => {
                        const Icon = item.icon
                        return (
                            <div key={item.label} style={{
                                minWidth: '118px',
                                padding: '12px',
                                borderRight: '1px solid var(--border)',
                                background: 'rgba(255,255,255,0.02)',
                                display: 'grid',
                                gap: '6px',
                            }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    <Icon size={13} style={{ color: item.color }} />
                                    {item.label}
                                </span>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                                    {Number(item.value || 0).toLocaleString('pt-BR')}
                                </strong>
                            </div>
                        )
                    })}
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))',
                    borderBottom: '1px solid var(--border)',
                    overflowX: 'auto',
                }}>
                    {rateItems.map(item => (
                        <div key={item.label} style={{
                            minWidth: '120px',
                            padding: '10px 12px',
                            borderRight: '1px solid var(--border)',
                            display: 'grid',
                            gap: '3px',
                        }}>
                            <strong style={{ color: item.color, fontSize: '0.9rem' }}>{item.value}</strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{item.label}</span>
                        </div>
                    ))}
                </div>

                <div style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.78rem', marginRight: '4px' }}>Numeros oficiais</strong>
                    {senders.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                            Nenhum numero Meta sincronizado.
                        </span>
                    ) : (
                        senders.map(sender => (
                            <span key={sender.id} style={{
                                padding: '6px 9px',
                                borderRadius: '999px',
                                border: '1px solid var(--border)',
                                color: sender.local_status === 'active' ? '#22c55e' : 'var(--text-muted)',
                                background: sender.local_status === 'active' ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                            }}>
                                {sender.display_name || sender.phone_number} | {sender.daily_sent_count}/{sender.daily_limit}
                            </span>
                        ))
                    )}
                </div>

                <div className="meta-campaigns-workspace">
                    <div className="meta-campaign-table-pane">
                        <div style={{
                            minWidth: '980px',
                            display: 'grid',
                            gridTemplateColumns: '90px minmax(280px, 1.45fr) 116px 96px 96px 86px 86px 132px',
                            gap: '0',
                            padding: '9px 12px',
                            borderBottom: '1px solid var(--border)',
                            color: 'var(--text-muted)',
                            fontSize: '0.66rem',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: 'rgba(255,255,255,0.025)',
                        }}>
                            <span>Status</span>
                            <span>Campanha</span>
                            <span>Destinatarios</span>
                            <span>Aceitas</span>
                            <span>Entregues</span>
                            <span>Lidas</span>
                            <span>Falhas</span>
                            <span>Acoes</span>
                        </div>

                        {loading ? (
                            <div className="meta-campaigns-table-empty" style={{ padding: '34px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Loader2 size={18} className="spin" /> Carregando campanhas Meta...
                            </div>
                        ) : campaigns.length === 0 ? (
                            <div className="meta-campaigns-table-empty" style={{ textAlign: 'center', padding: '46px', color: 'var(--text-muted)' }}>
                                <Send size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                <p style={{ margin: 0 }}>Nenhuma campanha oficial de WhatsApp encontrada.</p>
                            </div>
                        ) : filteredCampaigns.length === 0 ? (
                            <div className="meta-campaigns-table-empty" style={{ textAlign: 'center', padding: '38px', color: 'var(--text-muted)' }}>
                                Nenhuma campanha encontrada para a busca atual.
                            </div>
                        ) : (
                            <div style={{ minWidth: '980px' }}>
                                {filteredCampaigns.map(campaign => (
                                    <MetaCampaignTableRow
                                        key={campaign.id}
                                        campaign={campaign}
                                        sender={senders.find(item => item.id === campaign.default_sender_id)}
                                        selected={campaign.id === selectedCampaignId}
                                        loadingDetail={loadingDetailCampaignId === campaign.id}
                                        retrying={retryingCampaignId === campaign.id}
                                        onSelect={selectCampaign}
                                        onManage={onManage}
                                        onRetryFailed={onRetryFailed}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <MetaSelectedCampaignAside
                        campaign={selectedCampaign}
                        sender={selectedSender}
                        detail={selectedDetail}
                        loadingDetail={Boolean(selectedCampaign && loadingDetailCampaignId === selectedCampaign.id)}
                        retrying={Boolean(selectedCampaign && retryingCampaignId === selectedCampaign.id)}
                        onSelect={selectCampaign}
                        onManage={onManage}
                        onRetryFailed={onRetryFailed}
                    />
                </div>
            </div>

            <MetaReplyOpsPanel
                report={replyReport}
                loading={replyReportLoading}
                intentFilter={replyIntentFilter}
                onIntentFilterChange={onReplyIntentFilterChange}
                onRefresh={onReplyRefresh}
                onExport={onReplyExport}
            />

            <div style={{
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                padding: '14px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>Relatorios e diagnosticos</strong>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                            Indicadores de saude, funil e principais erros das campanhas oficiais.
                        </p>
                    </div>
                </div>
                <MetaCampaignDashboard
                    summary={summary}
                    analytics={analytics}
                    campaigns={campaigns}
                />
            </div>
        </div>
    )
}

function MetaCampaignTableRow({
    campaign,
    sender,
    selected,
    loadingDetail,
    retrying,
    onSelect,
    onManage,
    onRetryFailed,
}: {
    campaign: MetaCampaign
    sender?: MetaSender
    selected: boolean
    loadingDetail: boolean
    retrying: boolean
    onSelect: (campaignId: string) => void
    onManage: (campaignId: string, action: 'pause' | 'resume' | 'cancel') => void
    onRetryFailed: (campaignId: string, failedCount: number) => void
}) {
    const progress = metaProgress(campaign)
    const statusColor = metaStatusColor(campaign.status)
    const finalStatus = ['completed', 'cancelled', 'failed'].includes(campaign.status)
    const canPause = ['scheduled', 'queued', 'sending', 'preparing'].includes(campaign.status)
    const canResume = campaign.status === 'paused'
    const canRetryFailed = campaign.total_failed > 0 && !['queued', 'sending', 'scheduled', 'preparing', 'cancelled'].includes(campaign.status)

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect(campaign.id)}
            onKeyDown={event => {
                if (!['Enter', ' '].includes(event.key)) return
                event.preventDefault()
                onSelect(campaign.id)
            }}
            style={{
                display: 'grid',
                gridTemplateColumns: '90px minmax(280px, 1.45fr) 116px 96px 96px 86px 86px 132px',
                gap: '0',
                alignItems: 'center',
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                background: selected ? 'rgba(176,138,67,0.08)' : 'transparent',
                cursor: 'pointer',
                outline: 'none',
            }}
        >
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                color: statusColor,
                fontSize: '0.72rem',
                fontWeight: 900,
            }}>
                <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: statusColor,
                    boxShadow: campaign.status === 'sending' ? '0 0 8px rgba(245,158,11,0.5)' : 'none',
                }} />
                {metaStatusLabel(campaign.status)}
            </span>

            <div style={{ minWidth: 0, display: 'grid', gap: '4px' }}>
                <strong style={{
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {campaign.name || 'Campanha Meta'}
                </strong>
                <span style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.7rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {campaign.template_name || '-'} ({campaign.template_language || 'pt_BR'})
                    {sender ? ` | ${sender.display_name || sender.phone_number}` : ''}
                </span>
                <div style={{ height: '5px', borderRadius: '999px', background: 'rgba(148,163,184,0.16)', overflow: 'hidden' }}>
                    <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        borderRadius: '999px',
                        background: campaign.total_failed > 0 ? '#ef4444' : '#22c55e',
                    }} />
                </div>
            </div>

            <MetaTableNumber value={campaign.total_recipients} sub={`${progress}%`} />
            <MetaTableNumber value={campaign.total_sent} />
            <MetaTableNumber value={campaign.total_delivered} />
            <MetaTableNumber value={campaign.total_read} />
            <MetaTableNumber value={campaign.total_failed} color={campaign.total_failed > 0 ? '#ef4444' : 'var(--text-primary)'} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                    type="button"
                    onClick={event => {
                        event.stopPropagation()
                        onSelect(campaign.id)
                    }}
                    title="Abrir detalhes"
                    style={{ padding: '7px', borderRadius: '7px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                    {loadingDetail ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                </button>
                {canRetryFailed && (
                    <button
                        type="button"
                        onClick={event => {
                            event.stopPropagation()
                            onRetryFailed(campaign.id, campaign.total_failed)
                        }}
                        disabled={retrying}
                        title="Reenviar falhas"
                        style={{ padding: '7px', borderRadius: '7px', border: '1px solid rgba(245,158,11,0.22)', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', cursor: retrying ? 'not-allowed' : 'pointer', opacity: retrying ? 0.7 : 1 }}
                    >
                        {retrying ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                    </button>
                )}
                {canPause && (
                    <button
                        type="button"
                        onClick={event => {
                            event.stopPropagation()
                            onManage(campaign.id, 'pause')
                        }}
                        title="Pausar"
                        style={{ padding: '7px', borderRadius: '7px', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', cursor: 'pointer' }}
                    >
                        <Pause size={14} />
                    </button>
                )}
                {canResume && (
                    <button
                        type="button"
                        onClick={event => {
                            event.stopPropagation()
                            onManage(campaign.id, 'resume')
                        }}
                        title="Retomar"
                        style={{ padding: '7px', borderRadius: '7px', border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer' }}
                    >
                        <Play size={14} />
                    </button>
                )}
                {!finalStatus && (
                    <button
                        type="button"
                        onClick={event => {
                            event.stopPropagation()
                            onManage(campaign.id, 'cancel')
                        }}
                        title="Cancelar"
                        style={{ padding: '7px', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.16)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer' }}
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
        </div>
    )
}

function MetaTableNumber({
    value,
    sub,
    color = 'var(--text-primary)',
}: {
    value: number
    sub?: string
    color?: string
}) {
    return (
        <span style={{ display: 'grid', gap: '2px', color, fontSize: '0.78rem', fontWeight: 800 }}>
            {Number(value || 0).toLocaleString('pt-BR')}
            {sub && <small style={{ color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 600 }}>{sub}</small>}
        </span>
    )
}

function MetaSelectedCampaignAside({
    campaign,
    sender,
    detail,
    loadingDetail,
    retrying,
    onSelect,
    onManage,
    onRetryFailed,
}: {
    campaign: MetaCampaign | null
    sender?: MetaSender
    detail?: MetaCampaignDetail
    loadingDetail: boolean
    retrying: boolean
    onSelect: (campaignId: string) => void
    onManage: (campaignId: string, action: 'pause' | 'resume' | 'cancel') => void
    onRetryFailed: (campaignId: string, failedCount: number) => void
}) {
    if (!campaign) {
        return (
            <aside style={{ padding: '22px', color: 'var(--text-muted)', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                <div>
                    <MessageSquare size={28} style={{ opacity: 0.35, marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '0.8rem' }}>Selecione uma campanha para ver os detalhes.</p>
                </div>
            </aside>
        )
    }

    const detailCampaign = detail?.campaign || campaign
    const recipients = detail?.recipients || []
    const events = detail?.events || []
    const replyIntents = detail?.replyIntents || []
    const errors = campaignErrorGroups(recipients, events)
    const acceptedTotal = detailCampaign.total_sent || recipients.filter(item => ['sent', 'delivered', 'read'].includes(item.status)).length
    const deliveredTotal = detailCampaign.total_delivered || recipients.filter(item => ['delivered', 'read'].includes(item.status)).length
    const readTotal = detailCampaign.total_read || recipients.filter(item => item.status === 'read').length
    const failedTotal = detailCampaign.total_failed || recipients.filter(item => item.status === 'failed').length
    const progress = metaProgress(detailCampaign)
    const statusColor = metaStatusColor(detailCampaign.status)
    const finalStatus = ['completed', 'cancelled', 'failed'].includes(detailCampaign.status)
    const canPause = ['scheduled', 'queued', 'sending', 'preparing'].includes(detailCampaign.status)
    const canResume = detailCampaign.status === 'paused'
    const canRetryFailed = failedTotal > 0 && !['queued', 'sending', 'scheduled', 'preparing', 'cancelled'].includes(detailCampaign.status)

    return (
        <aside className="meta-campaign-detail-aside">
            <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'rgba(176,138,67,0.14)',
                        color: 'var(--gold)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        flexShrink: 0,
                    }}>
                        {(campaign.name || 'M').slice(0, 1).toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <strong className="meta-campaign-detail-text" style={{ color: 'var(--text-primary)', fontSize: '0.92rem', display: 'block', lineHeight: 1.25 }}>
                            {campaign.name || 'Campanha Meta'}
                        </strong>
                        <span className="meta-campaign-detail-text" style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block', marginTop: '3px', lineHeight: 1.35 }}>
                            {campaign.template_name || '-'} | {sender?.display_name || sender?.phone_number || 'Pool automatico'}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                        color: statusColor,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border)',
                        borderRadius: '999px',
                        padding: '4px 9px',
                        fontSize: '0.7rem',
                        fontWeight: 900,
                    }}>
                        {metaStatusLabel(detailCampaign.status)}
                    </span>
                    <button
                        type="button"
                        onClick={() => onSelect(campaign.id)}
                        disabled={loadingDetail}
                        style={{
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--text-secondary)',
                            cursor: loadingDetail ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            gap: '6px',
                            alignItems: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                        }}
                    >
                        {loadingDetail ? <Loader2 size={13} className="spin" /> : <Search size={13} />}
                        Detalhes
                    </button>
                    {canRetryFailed && (
                        <button
                            type="button"
                            onClick={() => onRetryFailed(campaign.id, failedTotal)}
                            disabled={retrying}
                            style={{
                                padding: '7px 10px',
                                borderRadius: '8px',
                                border: '1px solid rgba(245,158,11,0.22)',
                                background: 'rgba(245,158,11,0.1)',
                                color: '#f59e0b',
                                cursor: retrying ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                gap: '6px',
                                alignItems: 'center',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                            }}
                        >
                            {retrying ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                            Reenviar
                        </button>
                    )}
                    {canPause && (
                        <button type="button" onClick={() => onManage(campaign.id, 'pause')} title="Pausar" style={{ padding: '7px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', cursor: 'pointer' }}>
                            <Pause size={14} />
                        </button>
                    )}
                    {canResume && (
                        <button type="button" onClick={() => onManage(campaign.id, 'resume')} title="Retomar" style={{ padding: '7px', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer' }}>
                            <Play size={14} />
                        </button>
                    )}
                    {!finalStatus && (
                        <button type="button" onClick={() => onManage(campaign.id, 'cancel')} title="Cancelar" style={{ padding: '7px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.16)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer' }}>
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                    <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(148,163,184,0.16)', overflow: 'hidden' }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            borderRadius: '999px',
                            background: failedTotal > 0 ? '#ef4444' : '#22c55e',
                        }} />
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        {progress}% | Total {detailCampaign.total_recipients || 0} | Falhas {failedTotal}
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                    {[
                        { label: 'Aceitas', value: acceptedTotal, color: '#38bdf8' },
                        { label: 'Entregues', value: deliveredTotal, color: '#22c55e' },
                        { label: 'Lidas', value: readTotal, color: '#0ea5e9' },
                        { label: 'Falhas', value: failedTotal, color: failedTotal > 0 ? '#ef4444' : 'var(--text-primary)' },
                    ].map(item => (
                        <div key={item.label} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '9px', display: 'grid', gap: '2px', background: 'rgba(255,255,255,0.025)' }}>
                            <strong style={{ color: item.color, fontSize: '0.88rem' }}>{Number(item.value || 0).toLocaleString('pt-BR')}</strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ minHeight: 0, overflowY: 'auto', padding: '14px' }}>
                {loadingDetail && !detail ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Loader2 size={14} className="spin" /> Carregando detalhes...
                    </div>
                ) : detail ? (
                    <MetaCampaignDetailPanel
                        campaign={detailCampaign}
                        recipients={recipients}
                        events={events}
                        errors={errors}
                                acceptedTotal={acceptedTotal}
                                deliveredTotal={deliveredTotal}
                                readTotal={readTotal}
                                failedTotal={failedTotal}
                                replyIntents={replyIntents}
                                retrying={retrying}
                                onRetryFailed={onRetryFailed}
                            />
                ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                        Clique em Detalhes para carregar destinatarios, eventos da Meta e diagnostico de falhas desta campanha.
                    </div>
                )}
            </div>
        </aside>
    )
}

function MetaCampaignDashboard({
    summary,
    analytics,
    campaigns,
}: {
    summary: MetaCampaignSummary | null
    analytics: MetaCampaignAnalytics | null
    campaigns: MetaCampaign[]
}) {
    const rates = analytics?.rates || {
        acceptedRate: metricRate(summary?.sent || 0, summary?.recipients || 0),
        deliveryRate: metricRate(summary?.delivered || 0, summary?.sent || summary?.recipients || 0),
        readRate: metricRate(summary?.read || 0, summary?.delivered || summary?.sent || summary?.recipients || 0),
        failureRate: metricRate(summary?.failed || 0, summary?.recipients || 0),
        optOutRate: metricRate(summary?.skipped || 0, summary?.recipients || 0),
    }

    const timeline = (analytics?.timeline || []).map(item => ({
        ...item,
        label: shortDateLabel(item.date),
    }))
    const funnelData = [
        { name: 'Aceitas', value: summary?.sent || 0, color: '#38bdf8' },
        { name: 'Entregues', value: summary?.delivered || 0, color: '#22c55e' },
        { name: 'Lidas', value: summary?.read || 0, color: '#16a34a' },
        { name: 'Falhas', value: summary?.failed || 0, color: '#ef4444' },
    ]
    const statusData = Object.entries(summary?.byStatus || {}).map(([status, value]) => ({
        name: metaStatusLabel(status),
        value,
    }))
    const topError = analytics?.errorBreakdown?.[0]
    const bestTemplate = analytics?.templatePerformance?.[0]

    return (
        <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                {[
                    { label: 'Taxa aceite', value: percentLabel(rates.acceptedRate), icon: TrendingUp, color: '#38bdf8' },
                    { label: 'Taxa entrega', value: percentLabel(rates.deliveryRate), icon: Inbox, color: '#22c55e' },
                    { label: 'Taxa leitura', value: percentLabel(rates.readRate), icon: Eye, color: '#0ea5e9' },
                    { label: 'Taxa falha', value: percentLabel(rates.failureRate), icon: XCircle, color: '#ef4444' },
                ].map(item => {
                    const Icon = item.icon
                    return (
                        <div key={item.label} style={{
                            padding: '11px 12px',
                            borderRadius: '10px',
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.025)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '9px',
                        }}>
                            <Icon size={16} style={{ color: item.color }} />
                            <div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '0.95rem' }}>{item.value}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{item.label}</div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {(topError || bestTemplate) && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '10px',
                }}>
                    {topError && (
                        <div style={{
                            border: '1px solid rgba(239,68,68,0.2)',
                            background: 'rgba(239,68,68,0.06)',
                            borderRadius: '10px',
                            padding: '12px',
                            display: 'grid',
                            gap: '5px',
                        }}>
                            <strong style={{ color: '#ef4444', display: 'flex', gap: '7px', alignItems: 'center', fontSize: '0.82rem' }}>
                                <AlertCircle size={15} /> Principal erro: {topError.code}
                            </strong>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>{topError.message}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{topError.hint || metaErrorHint(topError.code, topError.message)}</span>
                        </div>
                    )}
                    {bestTemplate && (
                        <div style={{
                            border: '1px solid rgba(34,197,94,0.18)',
                            background: 'rgba(34,197,94,0.05)',
                            borderRadius: '10px',
                            padding: '12px',
                            display: 'grid',
                            gap: '5px',
                        }}>
                            <strong style={{ color: '#22c55e', display: 'flex', gap: '7px', alignItems: 'center', fontSize: '0.82rem' }}>
                                <BarChart3 size={15} /> Template mais usado
                            </strong>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                                {bestTemplate.template_name} ({bestTemplate.language}) | {bestTemplate.recipients} destinatarios
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                Entrega {percentLabel(bestTemplate.deliveryRate)} | Leitura {percentLabel(bestTemplate.readRate)} | Falha {percentLabel(bestTemplate.failureRate)}
                            </span>
                        </div>
                    )}
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '12px',
            }}>
                <div style={{
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px',
                    background: 'rgba(255,255,255,0.025)',
                    minHeight: 250,
                }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                        <Activity size={15} style={{ color: 'var(--gold)' }} /> Evolucao diaria
                    </strong>
                    {timeline.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Sem dados suficientes.</span>
                    ) : (
                        <ResponsiveContainer width="100%" height={205}>
                            <LineChart data={timeline} margin={{ top: 6, right: 12, left: -20, bottom: 0 }}>
                                <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }} />
                                <Line type="monotone" dataKey="accepted" name="Aceitas" stroke="#38bdf8" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="delivered" name="Entregues" stroke="#22c55e" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="failed" name="Falhas" stroke="#ef4444" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div style={{
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px',
                    background: 'rgba(255,255,255,0.025)',
                    minHeight: 250,
                }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                        <BarChart3 size={15} style={{ color: 'var(--gold)' }} /> Funil de entrega
                    </strong>
                    <ResponsiveContainer width="100%" height={205}>
                        <BarChart data={funnelData} margin={{ top: 6, right: 12, left: -20, bottom: 0 }}>
                            <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {funnelData.map(item => <Cell key={item.name} fill={item.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div style={{
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px',
                    background: 'rgba(255,255,255,0.025)',
                    minHeight: 250,
                }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                        <MessageSquare size={15} style={{ color: 'var(--gold)' }} /> Status das campanhas
                    </strong>
                    {statusData.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Sem campanhas no filtro atual.</span>
                    ) : (
                        <ResponsiveContainer width="100%" height={205}>
                            <PieChart>
                                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={3}>
                                    {statusData.map((item, index) => (
                                        <Cell key={item.name} fill={META_CHART_COLORS[index % META_CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {(analytics?.senderHealth?.length || analytics?.templatePerformance?.length || campaigns.length > 0) && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '12px',
                }}>
                    <MetaMiniRanking
                        title="Saude dos numeros"
                        rows={(analytics?.senderHealth || []).map(sender => ({
                            key: sender.sender_id,
                            name: sender.display_name || sender.phone_number,
                            detail: `${sender.meta_status || 'sem status'} | uso diario ${percentLabel(sender.usageRate)} | falha ${percentLabel(sender.failureRate)}`,
                            value: `${sender.daily_sent_count}/${sender.daily_limit}`,
                            color: sender.daily_limit > 0 && sender.daily_sent_count >= sender.daily_limit
                                ? '#ef4444'
                                : sender.meta_status === 'CONNECTED' ? '#22c55e' : '#f59e0b',
                        }))}
                    />
                    <MetaMiniRanking
                        title="Templates por desempenho"
                        rows={(analytics?.templatePerformance || []).map(template => ({
                            key: template.key,
                            name: template.template_name,
                            detail: `${template.language} | entrega ${percentLabel(template.deliveryRate)} | leitura ${percentLabel(template.readRate)}`,
                            value: String(template.recipients),
                            color: template.failureRate > 20 ? '#ef4444' : '#22c55e',
                        }))}
                    />
                </div>
            )}
        </div>
    )
}

function MetaMiniRanking({
    title,
    rows,
}: {
    title: string
    rows: Array<{ key: string; name: string; detail: string; value: string; color: string }>
}) {
    return (
        <div style={{
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '12px',
            background: 'rgba(255,255,255,0.025)',
            display: 'grid',
            gap: '9px',
        }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>{title}</strong>
            {rows.length === 0 ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Sem dados suficientes.</span>
            ) : (
                rows.slice(0, 5).map(row => (
                    <div key={row.key} style={{ display: 'grid', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {row.name}
                            </span>
                            <span style={{ color: row.color, fontSize: '0.75rem', fontWeight: 900 }}>{row.value}</span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{row.detail}</span>
                    </div>
                ))
            )}
        </div>
    )
}

function MetaCampaignDetailPanel({
    campaign,
    recipients,
    events,
    errors,
    acceptedTotal,
    deliveredTotal,
    readTotal,
    failedTotal,
    replyIntents,
    retrying,
    onRetryFailed,
}: {
    campaign: MetaCampaign
    recipients: MetaCampaignRecipient[]
    events: MetaCampaignEvent[]
    errors: Array<{ code: string; message: string; count: number; hint: string; detail?: string }>
    acceptedTotal: number
    deliveredTotal: number
    readTotal: number
    failedTotal: number
    replyIntents: MetaReplyIntent[]
    retrying: boolean
    onRetryFailed: (campaignId: string, failedCount: number) => void
}) {
    const total = campaign.total_recipients || recipients.length
    const canRetryFailed = failedTotal > 0 && !['queued', 'sending', 'scheduled', 'preparing', 'cancelled'].includes(campaign.status)
    const firstRecipient = recipients[0]
    const campaignMetadata = asRecord(campaign.metadata)
    const contactSegment = asRecord(campaignMetadata.contact_segment)
    const segmentCity = textValue(contactSegment.city)
    const segmentTag = textValue(contactSegment.tag)
    const segmentSearch = textValue(contactSegment.search)
    const segmentFilteredContacts = Number(contactSegment.filteredContacts || contactSegment.filtered_contacts || 0)
    const segmentTotalContacts = Number(contactSegment.totalContacts || contactSegment.total_contacts || 0)
    const segmentDescription = [
        textValue(campaignMetadata.contact_list_name) ? `Lista: ${textValue(campaignMetadata.contact_list_name)}` : '',
        segmentCity ? `Cidade: ${segmentCity}` : '',
        segmentTag ? `Tag: ${segmentTag}` : '',
        segmentSearch ? `Busca: ${segmentSearch}` : '',
        segmentFilteredContacts || segmentTotalContacts
            ? `Selecionados: ${segmentFilteredContacts || total} de ${segmentTotalContacts || total}`
            : '',
    ].filter(Boolean).join(' | ')
    const interestedReplies = replyIntents.filter(item => item.intent === 'interested').length
    const optOutReplies = replyIntents.filter(item => item.intent === 'opt_out').length
    const questionReplies = replyIntents.filter(item => item.intent === 'question').length

    return (
        <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                {[
                    { label: 'Total', value: total, detail: 'destinatarios', color: 'var(--gold)' },
                    { label: 'Aceitas Meta', value: acceptedTotal, detail: percentLabel(metricRate(acceptedTotal, total)), color: '#38bdf8' },
                    { label: 'Entregues', value: deliveredTotal, detail: percentLabel(metricRate(deliveredTotal, acceptedTotal || total)), color: '#22c55e' },
                    { label: 'Lidas', value: readTotal, detail: percentLabel(metricRate(readTotal, deliveredTotal || acceptedTotal || total)), color: '#0ea5e9' },
                    { label: 'Falhas', value: failedTotal, detail: percentLabel(metricRate(failedTotal, total)), color: '#ef4444' },
                ].map(item => (
                    <div key={item.label} style={{
                        border: '1px solid var(--border)',
                        borderRadius: '9px',
                        background: 'rgba(255,255,255,0.025)',
                        padding: '10px',
                        display: 'grid',
                        gap: '3px',
                    }}>
                        <span style={{ color: item.color, fontSize: '0.95rem', fontWeight: 900 }}>{Number(item.value || 0).toLocaleString('pt-BR')}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 800 }}>{item.label}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{item.detail}</span>
                    </div>
                ))}
            </div>

            {errors.length > 0 && (
                <div style={{
                    border: '1px solid rgba(239,68,68,0.22)',
                    borderRadius: '10px',
                    background: 'rgba(239,68,68,0.05)',
                    padding: '12px',
                    display: 'grid',
                    gap: '9px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                        <strong style={{ color: '#ef4444', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <AlertCircle size={15} /> Diagnostico das falhas
                        </strong>
                        {canRetryFailed && (
                            <button
                                type="button"
                                onClick={() => onRetryFailed(campaign.id, failedTotal)}
                                disabled={retrying}
                                style={{
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    background: 'rgba(245,158,11,0.12)',
                                    border: '1px solid rgba(245,158,11,0.25)',
                                    color: '#f59e0b',
                                    cursor: retrying ? 'not-allowed' : 'pointer',
                                    opacity: retrying ? 0.7 : 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 900,
                                }}
                            >
                                {retrying ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                                Reenviar falhas
                            </button>
                        )}
                    </div>
                    {errors.slice(0, 5).map(error => (
                        <div key={`${error.code}:${error.message}`} style={{ display: 'grid', gap: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 900 }}>
                                    {error.code} | {error.count} falha(s)
                                </span>
                                <span style={{ color: '#ef4444', fontSize: '0.72rem', fontWeight: 800 }}>{error.message}</span>
                            </div>
                                <span className="meta-campaign-detail-text" style={{ color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.35 }}>{error.hint}</span>
                            {error.detail && <span className="meta-campaign-detail-text" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', lineHeight: 1.35 }}>{error.detail}</span>}
                        </div>
                    ))}
                </div>
            )}

            {replyIntents.length > 0 && (
                <div style={{
                    border: '1px solid rgba(34,197,94,0.18)',
                    borderRadius: '10px',
                    background: 'rgba(34,197,94,0.045)',
                    padding: '12px',
                    display: 'grid',
                    gap: '10px',
                }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Bot size={15} style={{ color: '#22c55e' }} />
                        Respostas dos leads
                    </strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                        {[
                            { label: 'Interessados', value: interestedReplies, color: '#22c55e' },
                            { label: 'Saidas', value: optOutReplies, color: '#ef4444' },
                            { label: 'Perguntas', value: questionReplies, color: '#f59e0b' },
                        ].map(item => (
                            <div key={item.label} style={{
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                padding: '9px',
                                background: 'rgba(255,255,255,0.035)',
                                display: 'grid',
                                gap: '3px',
                            }}>
                                <strong style={{ color: item.color, fontSize: '0.9rem' }}>{item.value}</strong>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                        {replyIntents.slice(0, 12).map(reply => (
                            <div key={reply.id} style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(130px, 1fr) 110px minmax(160px, 1.6fr) 120px',
                                gap: '8px',
                                alignItems: 'center',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                background: 'rgba(255,255,255,0.03)',
                                padding: '8px 9px',
                                fontSize: '0.72rem',
                            }}>
                                <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {reply.contact_name || reply.contact_phone}
                                </span>
                                <span style={{ color: metaReplyIntentColor(reply.intent), fontWeight: 900 }}>
                                    {metaReplyIntentLabel(reply.intent)}
                                </span>
                                <span title={metaReplyClassifierSummary(reply)} style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {metaReplyPreview(reply)}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>{formatMetaDate(reply.created_at)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
            }}>
                <div style={{
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px',
                    background: 'rgba(255,255,255,0.025)',
                    display: 'grid',
                    gap: '8px',
                }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>Resumo da mensagem</strong>
                    <MetaDetailLine label="Template" value={`${campaign.template_name || '-'} (${campaign.template_language || 'pt_BR'})`} />
                    <MetaDetailLine label="Tipo" value={campaign.campaign_type || '-'} />
                    <MetaDetailLine label="Criada" value={formatMetaDate(campaign.created_at)} />
                    <MetaDetailLine label="Iniciada" value={formatMetaDate(campaign.started_at)} />
                    <MetaDetailLine label="Finalizada" value={formatMetaDate(campaign.completed_at)} />
                    {segmentDescription && (
                        <MetaDetailLine label="Lista/segmento" value={segmentDescription} />
                    )}
                    {Boolean(firstRecipient?.template_parameters) && (
                        <MetaDetailLine label="Variaveis" value={jsonPreview(firstRecipient.template_parameters)} />
                    )}
                </div>

                <div style={{
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px',
                    background: 'rgba(255,255,255,0.025)',
                    display: 'grid',
                    gap: '8px',
                }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>Eventos Meta</strong>
                    {events.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Nenhum webhook de status recebido ainda.</span>
                    ) : (
                        events.slice(0, 8).map(event => {
                            const summary = payloadErrorSummary(event.payload)
                            return (
                                <div key={event.id} style={{ display: 'grid', gap: '2px', borderBottom: '1px solid rgba(148,163,184,0.12)', paddingBottom: '6px' }}>
                                    <span style={{ color: metaStatusColor(event.event_status || event.event_type), fontSize: '0.75rem', fontWeight: 900 }}>
                                        {event.event_status || event.event_type} | {formatMetaDate(event.received_at)}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                                        {event.recipient_phone || 'sem telefone'} | {shortProviderId(event.provider_message_id)}
                                    </span>
                                    {summary && <span style={{ color: '#ef4444', fontSize: '0.68rem' }}>{summary}</span>}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>Destinatarios</strong>
                {recipients.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Nenhum destinatario encontrado.</span>
                ) : (
                    <div style={{ display: 'grid', gap: '6px' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(130px, 1fr) minmax(90px, 120px) minmax(120px, 1.3fr) minmax(100px, 1fr)',
                            gap: '8px',
                            color: 'var(--text-muted)',
                            fontSize: '0.66rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                        }}>
                            <span>Contato</span>
                            <span>Status</span>
                            <span>Erro/retorno</span>
                            <span>ID Meta</span>
                        </div>
                        {recipients.slice(0, 30).map(recipient => {
                            const color = metaStatusColor(recipient.status)
                            const errorText = recipient.error_message
                                ? `${recipient.error_code || 'sem codigo'} | ${recipient.error_message}`
                                : formatMetaDate(recipient.read_at || recipient.delivered_at || recipient.sent_at || recipient.failed_at || recipient.created_at)
                            return (
                                <div key={recipient.id} style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(130px, 1fr) minmax(90px, 120px) minmax(120px, 1.3fr) minmax(100px, 1fr)',
                                    gap: '8px',
                                    alignItems: 'center',
                                    padding: '8px 9px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--border)',
                                    fontSize: '0.74rem',
                                }}>
                                    <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {recipient.recipient_name || recipient.recipient_phone}
                                    </span>
                                    <span style={{ color, fontWeight: 900 }}>{metaStatusLabel(recipient.status)}</span>
                                    <span style={{ color: recipient.error_message ? '#ef4444' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {errorText}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {shortProviderId(recipient.provider_message_id)}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

function MetaDetailLine({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'grid', gap: '2px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
            <span className="meta-campaign-detail-text" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.35 }}>{value || '-'}</span>
        </div>
    )
}

function metaReplyIntentLabel(value?: string | null) {
    const labels: Record<string, string> = {
        interested: 'Interessado',
        opt_out: 'Saiu da lista',
        question: 'Pergunta',
        unknown: 'Sem classificacao',
    }
    return labels[String(value || '')] || String(value || 'Sem classificacao')
}

function metaReplyIntentColor(value?: string | null) {
    const colors: Record<string, string> = {
        interested: '#22c55e',
        opt_out: '#ef4444',
        question: '#f59e0b',
        unknown: 'var(--text-muted)',
    }
    return colors[String(value || '')] || 'var(--text-muted)'
}

function metaReplyStatusLabel(value?: string | null) {
    const labels: Record<string, string> = {
        pending: 'Pendente',
        sent: 'Enviado',
        skipped: 'Ignorado',
        failed: 'Falhou',
    }
    return labels[String(value || '')] || String(value || 'Nao aplicado')
}

function emptyMetaReplyReportSummary(): MetaReplyReportSummary {
    return {
        total: 0,
        interested: 0,
        optOut: 0,
        question: 0,
        unknown: 0,
        autoRepliesSent: 0,
        autoRepliesFailed: 0,
        notificationsSent: 0,
        notificationsFailed: 0,
        byIntent: {},
        byTemplate: [],
        byCampaign: [],
    }
}

function metaReplyPreview(reply: MetaReplyIntent) {
    return reply.button_text || reply.button_payload || reply.raw_text || '-'
}

function metaReplyClassifierSummary(reply: MetaReplyIntent) {
    const meta = asRecord(reply.metadata)
    const triage = asRecord(meta.triage)
    return textValue(triage.reason) || '-'
}

function MetaReplyOpsPanel({
    report,
    loading,
    intentFilter,
    onIntentFilterChange,
    onRefresh,
    onExport,
}: {
    report: MetaReplyReport | null
    loading: boolean
    intentFilter: string
    onIntentFilterChange: (value: string) => void
    onRefresh: () => void
    onExport: (intent?: string) => void
}) {
    const summary = report?.summary || emptyMetaReplyReportSummary()
    const replies = report?.replies || []
    const metricItems = [
        { label: 'Respostas', value: summary.total, icon: MessageSquare, color: 'var(--gold)' },
        { label: 'Interessados', value: summary.interested, icon: Users, color: '#22c55e' },
        { label: 'Saidas', value: summary.optOut, icon: XCircle, color: '#ef4444' },
        { label: 'Perguntas', value: summary.question, icon: Bot, color: '#f59e0b' },
        { label: 'Alertas enviados', value: summary.notificationsSent, icon: Send, color: '#38bdf8' },
        { label: 'Auto respostas', value: summary.autoRepliesSent, icon: CheckCircle2, color: '#22c55e' },
    ]

    return (
        <div id="central-respostas" style={{
            borderRadius: '12px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
        }}>
            <div style={{
                padding: '13px 14px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
            }}>
                <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Bot size={16} style={{ color: 'var(--gold)' }} />
                        Central de respostas
                    </strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                        Leads interessados, opt-outs e perguntas detectadas pelo agente das campanhas Meta WhatsApp.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <select
                        value={intentFilter}
                        onChange={event => onIntentFilterChange(event.target.value)}
                        style={{
                            minHeight: '36px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            padding: '0 10px',
                            fontSize: '0.76rem',
                        }}
                    >
                        <option value="">Todas as respostas</option>
                        <option value="interested">Interessados</option>
                        <option value="opt_out">Saidas</option>
                        <option value="question">Perguntas</option>
                        <option value="unknown">Sem classificacao</option>
                    </select>
                    <button
                        type="button"
                        onClick={() => onExport(intentFilter || undefined)}
                        disabled={replies.length === 0}
                        style={{
                            minHeight: '36px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--text-secondary)',
                            padding: '0 10px',
                            cursor: replies.length === 0 ? 'not-allowed' : 'pointer',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <Download size={14} /> Exportar
                    </button>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        style={{
                            minHeight: '36px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--text-secondary)',
                            padding: '0 10px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar
                    </button>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, minmax(126px, 1fr))',
                borderBottom: '1px solid var(--border)',
                overflowX: 'auto',
            }}>
                {metricItems.map(item => {
                    const Icon = item.icon
                    return (
                        <div key={item.label} style={{
                            minWidth: '126px',
                            padding: '12px',
                            borderRight: '1px solid var(--border)',
                            display: 'grid',
                            gap: '5px',
                        }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Icon size={13} style={{ color: item.color }} />
                                {item.label}
                            </span>
                            <strong style={{ color: item.color, fontSize: '0.92rem' }}>{Number(item.value || 0).toLocaleString('pt-BR')}</strong>
                        </div>
                    )
                })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(250px, 320px)', minHeight: '230px' }}>
                <div style={{ minWidth: 0, borderRight: '1px solid var(--border)', overflowX: 'auto' }}>
                    <div style={{
                        minWidth: '820px',
                        display: 'grid',
                        gridTemplateColumns: '150px 120px 1fr 150px 120px 120px',
                        gap: '8px',
                        padding: '9px 12px',
                        color: 'var(--text-muted)',
                        fontSize: '0.66rem',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        borderBottom: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.025)',
                    }}>
                        <span>Contato</span>
                        <span>Intencao</span>
                        <span>Resposta</span>
                        <span>Campanha</span>
                        <span>Alerta</span>
                        <span>Recebida</span>
                    </div>
                    {loading ? (
                        <div style={{ minWidth: '820px', padding: '32px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <Loader2 size={16} className="spin" /> Carregando respostas...
                        </div>
                    ) : replies.length === 0 ? (
                        <div style={{ minWidth: '820px', padding: '32px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            Nenhuma resposta classificada neste filtro.
                        </div>
                    ) : (
                        <div style={{ minWidth: '820px' }}>
                            {replies.slice(0, 12).map(reply => (
                                <div key={reply.id} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '150px 120px 1fr 150px 120px 120px',
                                    gap: '8px',
                                    padding: '10px 12px',
                                    borderBottom: '1px solid var(--border)',
                                    alignItems: 'center',
                                    fontSize: '0.74rem',
                                }}>
                                    <span style={{ color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {reply.contact_name || reply.contact_phone}
                                    </span>
                                    <span style={{ color: metaReplyIntentColor(reply.intent), fontWeight: 900 }}>
                                        {metaReplyIntentLabel(reply.intent)}
                                    </span>
                                    <span title={metaReplyClassifierSummary(reply)} style={{ color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {metaReplyPreview(reply)}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {reply.campaign_name || reply.template_name || '-'}
                                    </span>
                                    <span style={{ color: reply.notified_status === 'failed' ? '#ef4444' : 'var(--text-muted)' }}>
                                        {metaReplyStatusLabel(reply.notified_status)}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)' }}>{formatMetaDate(reply.created_at)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ padding: '12px', display: 'grid', gap: '10px', alignContent: 'start' }}>
                    <MetaMiniRanking
                        title="Templates com resposta"
                        rows={(summary.byTemplate || []).slice(0, 5).map(item => ({
                            key: String(item.key || item.template_name || 'template'),
                            name: String(item.template_name || item.key || 'Sem template'),
                            detail: `${Number(item.interested || 0)} interessados | ${Number(item.optOut || 0)} saidas`,
                            value: String(item.count || 0),
                            color: Number(item.optOut || 0) > Number(item.interested || 0) ? '#ef4444' : '#22c55e',
                        }))}
                    />
                    <MetaMiniRanking
                        title="Campanhas com resposta"
                        rows={(summary.byCampaign || []).slice(0, 5).map(item => ({
                            key: String(item.key || item.campaign_id || 'campaign'),
                            name: String(item.campaign_name || item.key || 'Sem campanha'),
                            detail: `${Number(item.interested || 0)} interessados | ${Number(item.question || 0)} perguntas`,
                            value: String(item.count || 0),
                            color: Number(item.interested || 0) > 0 ? '#22c55e' : 'var(--gold)',
                        }))}
                    />
                </div>
            </div>
        </div>
    )
}

function CampaignCard({ campaign, onManage }: { campaign: CampaignFolder; onManage: (action: 'stop' | 'continue' | 'delete') => void }) {
    const progress = campaign.total > 0 ? Math.round((campaign.sent / campaign.total) * 100) : 0
    const isSending = campaign.status === 'sending' || campaign.status === 'active'
    const isPaused = campaign.status === 'paused' || campaign.status === 'stopped'
    const isDone = campaign.status === 'done' || campaign.status === 'completed' || progress === 100

    return (
        <div style={{
            padding: '16px 20px', borderRadius: '12px',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
        }}>
            {/* Status indicator */}
            <div style={{
                width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                background: isDone ? '#22c55e' : isSending ? '#f59e0b' : isPaused ? '#6366f1' : 'var(--text-muted)',
                boxShadow: isSending ? '0 0 8px rgba(245,158,11,0.5)' : 'none',
            }} />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {campaign.name || 'Campanha sem nome'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {campaign.sent || 0}/{campaign.total || 0} enviadas
                    {campaign.failed > 0 && <span style={{ color: '#ef4444' }}> • {campaign.failed} falhas</span>}
                </div>
            </div>

            {/* Progress bar */}
            <div style={{ width: '120px', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <div style={{
                    width: `${progress}%`, height: '100%', borderRadius: '3px',
                    background: isDone ? '#22c55e' : 'var(--gold)',
                    transition: 'width 0.3s',
                }} />
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gold)', width: '35px', textAlign: 'right' }}>
                {progress}%
            </span>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                {isSending && (
                    <button onClick={() => onManage('stop')} title="Pausar"
                        style={{ padding: '6px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', cursor: 'pointer' }}>
                        <Pause size={14} />
                    </button>
                )}
                {isPaused && (
                    <button onClick={() => onManage('continue')} title="Continuar"
                        style={{ padding: '6px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', cursor: 'pointer' }}>
                        <Play size={14} />
                    </button>
                )}
                <button onClick={() => onManage('delete')} title="Deletar"
                    style={{ padding: '6px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    )
}
