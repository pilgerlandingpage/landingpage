'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    Send, Loader2, AlertCircle, CheckCircle2, Users,
    Plus, Trash2, Pause, Play, FileText, Image, Mic, Video,
    Tag, RefreshCw, MessageSquare, ChevronUp, ChevronLeft, ChevronRight,
    Smartphone, Search, BarChart3, TrendingUp, Eye, Inbox, Activity,
    XCircle, Upload, Download, Bot, Calendar, DollarSign, MoreVertical
} from 'lucide-react'
import {
    Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import AdminLoadingState from '@/components/admin/AdminLoadingState'
import {
    getMetaWhatsAppSenderHealth,
    isMetaWhatsAppSenderAvailable,
    isMetaWhatsAppSenderPolicyEligible,
    metaWhatsAppSenderUsage,
} from '@/lib/meta/whatsapp-sender-health'

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
    waba_id: string
    local_status: string
    meta_status?: string | null
    quality_rating?: string | null
    messaging_limit_tier?: string | null
    daily_limit: number
    daily_sent_count: number
    daily_limit_resets_at?: string | null
    use_case: string
    weight?: number
    metadata?: unknown
    last_error?: string | null
}

interface MetaTemplate {
    id: string
    waba_id?: string | null
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

type MetaCampaignManageAction = 'pause' | 'resume' | 'cancel' | 'delete'
type MetaCreateStep = 'config' | 'message' | 'audience' | 'delivery' | 'review'

const META_CREATE_STEP_ORDER: MetaCreateStep[] = ['config', 'message', 'audience', 'delivery', 'review']

interface MetaCreateStepItem {
    id: MetaCreateStep
    title: string
    description: string
    complete: boolean
    attention?: boolean
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
        available?: boolean
        policy_eligible?: boolean
        health_status?: string | null
        health_reason?: string | null
        usageRate: number
        recipients: number
        accepted: number
        delivered: number
        read: number
        failed: number
        failureRate: number
    }>
}

interface MetaDailyReportCampaign {
    campaign_id?: string | null
    campaign_name: string
    template_name: string
    template_language?: string | null
    campaign_type?: string | null
    dispatched: number
    delivered: number
    read: number
    failed: number
    replies: number
    positive_replies: number
    cost_amount: number
}

interface MetaDailyReport {
    date: string
    timezone: string
    start_at: string
    end_at: string
    totals: {
        dispatched: number
        delivered: number
        read: number
        failed: number
        replies: number
        positive_replies: number
        opt_out_replies: number
        question_replies: number
        unknown_replies: number
        cost_amount: number
        cost_currency: string
        response_rate: number
        positive_response_rate: number
    }
    campaigns: MetaDailyReportCampaign[]
}

interface MetaDetailedReportGroup {
    key: string
    label: string
    recipients: number
    sent: number
    delivered: number
    read: number
    failed: number
    skipped: number
    replies: number
    positive_replies: number
    cost_amount: number
    delivery_rate?: number
    read_rate?: number
    reply_rate?: number
}

interface MetaDetailedReportRow {
    recipient_id: string
    campaign_id?: string | null
    campaign_name: string
    campaign_type?: string | null
    template_name: string
    template_language?: string | null
    sender_id?: string | null
    sender_name?: string | null
    sender_phone?: string | null
    waba_id?: string | null
    waba_label?: string | null
    recipient_phone: string
    recipient_name?: string | null
    status: string
    sent_at?: string | null
    delivered_at?: string | null
    read_at?: string | null
    failed_at?: string | null
    created_at?: string | null
    updated_at?: string | null
    error_code?: string | null
    error_message?: string | null
    reply_intent?: string | null
    reply_text?: string | null
    reply_button?: string | null
    reply_at?: string | null
    cost_amount?: number
    currency?: string | null
    repeat_creative_history?: boolean
    repeat_creative_action?: string | null
    prior_campaign_id?: string | null
    prior_campaign_name?: string | null
    prior_recipient_status?: string | null
    prior_sent_at?: string | null
}

interface MetaDetailedReport {
    filters: Record<string, unknown>
    summary: {
        recipients: number
        sent: number
        delivered: number
        read: number
        failed: number
        skipped: number
        replies: number
        positive_replies: number
        cost_amount: number
        cost_currency: string
        delivery_rate: number
        read_rate: number
        reply_rate: number
        positive_reply_rate: number
        by_status: Record<string, number>
        by_template: MetaDetailedReportGroup[]
        by_campaign: MetaDetailedReportGroup[]
        by_sender: MetaDetailedReportGroup[]
        by_waba: MetaDetailedReportGroup[]
    }
    rows: MetaDetailedReportRow[]
}

interface MetaDetailedReportFilters {
    dateFrom: string
    dateTo: string
    templateName: string
    campaignId: string
    senderId: string
    wabaId: string
    status: string
    intent: string
    search: string
    limit: string
}

interface MetaRecipientDraft {
    phone: string
    name?: string
    templateParameters?: unknown
    metadata?: Record<string, unknown>
    missingVariables?: string[]
}

interface MetaContactListUsageTemplate {
    template_name: string
    template_language: string
    campaigns: number
    total_recipients: number
    total_queued: number
    total_sent: number
    total_delivered: number
    total_read: number
    total_failed: number
    total_skipped: number
    last_used_at?: string | null
    last_campaign_id?: string | null
    last_campaign_name?: string | null
    last_status?: string | null
}

interface MetaContactListUsageSummary {
    total_campaigns: number
    total_recipients: number
    last_used_at?: string | null
    last_campaign_id?: string | null
    last_campaign_name?: string | null
    last_template_name?: string | null
    last_template_language?: string | null
    templates: MetaContactListUsageTemplate[]
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
    metadata?: unknown
    usage?: MetaContactListUsageSummary | null
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
        whatsapp_valid?: number
        whatsapp_invalid?: number
        whatsapp_unknown?: number
        whatsapp_error?: number
        whatsapp_unchecked?: number
        whatsapp_checked?: number
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
type ContactListValidationMode = 'confirmed_only' | 'include_unverified'
type CreativeDeduplicationMode = 'skip_previous' | 'track_only' | 'allow_repeat'

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

function textValue(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function isMetaHostedTemplateMediaUrl(value: string) {
    const url = value.trim()
    if (!/^https?:\/\//i.test(url)) return false

    try {
        const hostname = new URL(url).hostname.toLowerCase()
        return hostname.includes('whatsapp.net')
            || hostname.endsWith('fbcdn.net')
            || hostname.startsWith('scontent.')
    } catch {
        return false
    }
}

function publicTemplateMediaUrl(value: unknown) {
    const url = textValue(value).trim()
    if (!url.startsWith('https://')) return ''
    return isMetaHostedTemplateMediaUrl(url) ? '' : url
}

function asFiniteNumber(value: unknown) {
    const parsed = Number(value || 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function normalizeWhatsAppCheckStatus(value: unknown) {
    const status = textValue(value).toLowerCase()
    if (status === 'valid' || status === 'invalid' || status === 'unknown' || status === 'error') return status
    return 'unchecked'
}

function getContactWhatsAppCheck(contact?: MetaContactListContact | null) {
    return asRecord(asRecord(contact?.metadata).whatsapp_check)
}

function getContactWhatsAppCheckStatus(contact?: MetaContactListContact | null) {
    return normalizeWhatsAppCheckStatus(getContactWhatsAppCheck(contact).status)
}

function isContactWithoutWhatsApp(contact?: MetaContactListContact | null) {
    return getContactWhatsAppCheckStatus(contact) === 'invalid'
}

function isContactAllowedByValidationMode(
    contact: MetaContactListContact,
    input: { requiresConfirmedWhatsApp: boolean; mode: ContactListValidationMode }
) {
    const status = getContactWhatsAppCheckStatus(contact)
    if (status === 'invalid') return false
    if (input.mode === 'include_unverified') return true
    return status === 'valid'
}

function getContactListWhatsAppValidation(list?: MetaContactList | null) {
    return asRecord(asRecord(list?.metadata).whatsapp_validation)
}

function contactListValidationStatus(list?: MetaContactList | null) {
    const status = textValue(getContactListWhatsAppValidation(list).status).toLowerCase()
    if (status === 'queued' || status === 'running' || status === 'completed' || status === 'failed') return status
    return ''
}

function contactListValidationStats(list?: MetaContactList | null) {
    const validation = getContactListWhatsAppValidation(list)
    return {
        total: asFiniteNumber(validation.total_contacts),
        checked: asFiniteNumber(validation.checked_contacts),
        valid: asFiniteNumber(validation.valid_contacts),
        invalid: asFiniteNumber(validation.invalid_contacts),
        unknown: asFiniteNumber(validation.unknown_contacts),
        error: asFiniteNumber(validation.error_contacts),
        unchecked: asFiniteNumber(validation.unchecked_contacts),
        remaining: asFiniteNumber(validation.remaining_contacts),
    }
}

function templateUsageKey(templateName?: string | null, templateLanguage?: string | null) {
    return `${String(templateName || '').trim().toLowerCase()}::${String(templateLanguage || 'pt_BR').trim().toLowerCase()}`
}

function emptyContactListUsage(): MetaContactListUsageSummary {
    return {
        total_campaigns: 0,
        total_recipients: 0,
        last_used_at: null,
        last_campaign_id: null,
        last_campaign_name: null,
        last_template_name: null,
        last_template_language: null,
        templates: [],
    }
}

function contactListUsage(list?: MetaContactList | null) {
    return list?.usage || emptyContactListUsage()
}

function saoPauloDateInputDaysAgo(daysAgo: number) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date())
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
    const date = new Date(Date.UTC(
        Number(byType.year),
        Number(byType.month) - 1,
        Number(byType.day) - daysAgo,
        3,
        0,
        0,
        0
    ))
    return date.toISOString().slice(0, 10)
}

function formatCurrencyBRL(value: number, currency = 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency || 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value || 0))
}

function metaSenderUsage(sender: MetaSender) {
    return metaWhatsAppSenderUsage(sender)
}

function metaSenderSentTodayLabel(sender: MetaSender) {
    const sent = metaSenderUsage(sender).sent
    return `${sent} ${sent === 1 ? 'envio' : 'envios'} hoje`
}

function isMetaSenderAvailable(sender: MetaSender) {
    return isMetaWhatsAppSenderAvailable(sender)
}

function metaSenderWabaLabel(sender: MetaSender) {
    const metadata = asRecord(sender.metadata)
    return textValue(metadata.waba_label) || sender.waba_id || 'WABA'
}

function metaSenderOptionLabel(sender: MetaSender) {
    const health = getMetaWhatsAppSenderHealth(sender)
    const name = sender.display_name || sender.phone_number
    const base = `${name} - ${sender.phone_number} [${metaSenderWabaLabel(sender)}] - ${metaSenderSentTodayLabel(sender)}`
    if (!health.available) return `${base} - ${health.reason}`
    if (health.warning) return `${base} - ${health.warning}`
    return `${base}; limite compartilhado da BM/portfolio`
}

function metaTemplateWabaLabel(template?: MetaTemplate | null) {
    const metadata = asRecord(template?.metadata)
    return textValue(metadata.waba_label) || textValue(template?.waba_id) || 'WABA'
}

function metaTemplateNameLanguageValue(template: Pick<MetaTemplate, 'name' | 'language'>) {
    return [template.name || '', template.language || 'pt_BR'].join('::')
}

function templateHasImageHeader(template: MetaTemplate) {
    return Array.isArray(template.components)
        && template.components.some(component => {
            const item = asRecord(component)
            return textValue(item.type).toUpperCase() === 'HEADER'
                && textValue(item.format).toUpperCase() === 'IMAGE'
        })
}

function isApprovedImageMetaTemplate(template: MetaTemplate) {
    return String(template.status || '').toUpperCase() === 'APPROVED' && templateHasImageHeader(template)
}

function metaPortfolioUsageFromSenders(senders: MetaSender[]) {
    const eligibleSenders = senders.filter(isMetaWhatsAppSenderPolicyEligible)
    const limit = Math.max(...eligibleSenders.map(sender => asFiniteNumber(sender.daily_limit)), 0)
    const sent = senders.reduce((total, sender) => total + metaSenderUsage(sender).sent, 0)
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
    const savedUrl = publicTemplateMediaUrl(panelHeaderMedia.url) || publicTemplateMediaUrl(metadata.header_media_url)
    if (savedUrl) return savedUrl

    return ''
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

function MetaCampaignPhonePreview({
    template,
    campaignName,
    headerComponent,
    headerFormat,
    headerText,
    bodyText,
    footerText,
    mediaUrl,
    buttons,
    audienceLabel,
    routingLabel,
    approvedAccounts,
    readyAccounts,
    portfolioUsageLabel,
    portfolioRemaining,
    warnings,
}: {
    template: MetaTemplate | null
    campaignName: string
    headerComponent: TemplateComponentRecord | null
    headerFormat: string
    headerText: string
    bodyText: string
    footerText: string
    mediaUrl: string
    buttons: TemplateButtonRecord[]
    audienceLabel: string
    routingLabel: string
    approvedAccounts: number
    readyAccounts: number
    portfolioUsageLabel: string
    portfolioRemaining: number
    warnings: string[]
}) {
    const hasMediaHeader = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat)
    const hasTextHeader = headerComponent && headerFormat === 'TEXT' && headerText
    const messageText = bodyText || (template ? template.name : 'Escolha um template para visualizar a mensagem.')

    return (
        <aside className="meta-create-preview-pane" aria-label="Pre-visualizacao da campanha">
            <div className="meta-create-preview-header">
                <div>
                    <span className="meta-create-eyebrow">Pre-visualizar mensagem</span>
                    <h3>Como o lead vai receber</h3>
                </div>
                <Smartphone size={18} />
            </div>

            <div className="meta-phone-frame">
                <div className="meta-phone-speaker" />
                <div className="meta-phone-screen">
                    <div className="meta-phone-topbar">
                        <strong>{campaignName.trim() || 'Nova campanha'}</strong>
                        <span>09:41</span>
                    </div>
                    <div className="meta-phone-chat">
                        <div className="meta-phone-bubble">
                            {headerComponent && hasMediaHeader && (
                                <div className="meta-phone-media">
                                    {headerFormat === 'IMAGE' && mediaUrl.trim() ? (
                                        <img src={mediaUrl} alt="" />
                                    ) : (
                                        <span>{headerFormat || 'MIDIA'}</span>
                                    )}
                                </div>
                            )}
                            {hasTextHeader && (
                                <strong className="meta-phone-header-text">
                                    {renderWhatsAppPreviewText(headerText)}
                                </strong>
                            )}
                            <div className="meta-phone-body">
                                {renderWhatsAppPreviewText(messageText)}
                            </div>
                            {footerText && (
                                <div className="meta-phone-template-footer">
                                    {footerText}
                                </div>
                            )}
                            {buttons.length > 0 && (
                                <div className="meta-phone-buttons">
                                    {buttons.map((button, index) => (
                                        <div key={`phone-button-${index}`}>
                                            {textValue(button.text) || `Botao ${index + 1}`}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="meta-phone-footer">Mensagem oficial da imobiliaria</div>
                </div>
            </div>

            <div className="meta-preview-summary">
                <div>
                    <span>Criativo</span>
                    <strong>{template?.name || 'Nao selecionado'}</strong>
                </div>
                <div>
                    <span>Publico</span>
                    <strong>{audienceLabel}</strong>
                </div>
                <div>
                    <span>Envio</span>
                    <strong>{routingLabel}</strong>
                </div>
                <div>
                    <span>Contas</span>
                    <strong>{readyAccounts}/{approvedAccounts || 0} prontas</strong>
                </div>
                <div>
                    <span>Limite BM</span>
                    <strong>{portfolioUsageLabel}; {portfolioRemaining} livres</strong>
                </div>
            </div>

            <div className={warnings.length ? 'meta-preview-alert meta-preview-alert-warning' : 'meta-preview-alert meta-preview-alert-ready'}>
                {warnings.length ? (
                    warnings.map(warning => (
                        <span key={warning}><AlertCircle size={14} /> {warning}</span>
                    ))
                ) : (
                    <span><CheckCircle2 size={14} /> Campanha pronta para revisar e lancar.</span>
                )}
            </div>
        </aside>
    )
}

function MetaCampaignStepper({
    steps,
    currentStep,
    onStepChange,
}: {
    steps: MetaCreateStepItem[]
    currentStep: MetaCreateStep
    onStepChange: (step: MetaCreateStep) => void
}) {
    const currentIndex = steps.findIndex(step => step.id === currentStep)

    return (
        <nav className="meta-stepper" aria-label="Etapas da campanha">
            {steps.map((step, index) => {
                const isActive = step.id === currentStep
                const isPast = index < currentIndex
                const markerContent = step.complete
                    ? <CheckCircle2 size={15} />
                    : step.attention
                        ? <AlertCircle size={15} />
                        : index + 1

                return (
                    <button
                        key={step.id}
                        type="button"
                        className={`meta-stepper-button ${isActive ? 'is-active' : ''} ${step.complete ? 'is-complete' : ''} ${step.attention ? 'has-attention' : ''}`}
                        onClick={() => onStepChange(step.id)}
                    >
                        <span className="meta-stepper-marker">{markerContent}</span>
                        <span className="meta-stepper-copy">
                            <strong>{step.title}</strong>
                            <span>{step.description}</span>
                        </span>
                        {index < steps.length - 1 && (
                            <span className={`meta-stepper-line ${isPast ? 'is-past' : ''}`} aria-hidden="true" />
                        )}
                    </button>
                )
            })}
        </nav>
    )
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
    const [contactListValidationMode, setContactListValidationMode] = useState<ContactListValidationMode>('confirmed_only')
    const [contactListName, setContactListName] = useState('')
    const [savingContactList, setSavingContactList] = useState(false)
    const [loadingContactLists, setLoadingContactLists] = useState(false)
    const [loadingContactListAudience, setLoadingContactListAudience] = useState(false)
    const [validatingContactListId, setValidatingContactListId] = useState('')
    const [metaSummary, setMetaSummary] = useState<MetaCampaignSummary | null>(null)
    const [metaAnalytics, setMetaAnalytics] = useState<MetaCampaignAnalytics | null>(null)
    const [metaDailyReport, setMetaDailyReport] = useState<MetaDailyReport | null>(null)
    const [metaDailyReportDate, setMetaDailyReportDate] = useState(() => saoPauloDateInputDaysAgo(1))
    const [loadingMetaDailyReport, setLoadingMetaDailyReport] = useState(false)
    const [metaDetailedReport, setMetaDetailedReport] = useState<MetaDetailedReport | null>(null)
    const [loadingMetaDetailedReport, setLoadingMetaDetailedReport] = useState(false)
    const [metaDetailedReportFilters, setMetaDetailedReportFilters] = useState<MetaDetailedReportFilters>(() => ({
        dateFrom: saoPauloDateInputDaysAgo(7),
        dateTo: saoPauloDateInputDaysAgo(0),
        templateName: '',
        campaignId: '',
        senderId: '',
        wabaId: '',
        status: '',
        intent: '',
        search: '',
        limit: '1000',
    }))
    const [metaStatusFilter, setMetaStatusFilter] = useState('')
    const [expandedMetaCampaignId, setExpandedMetaCampaignId] = useState('')
    const [loadingMetaCampaignDetail, setLoadingMetaCampaignDetail] = useState('')
    const [metaCampaignDetails, setMetaCampaignDetails] = useState<Record<string, MetaCampaignDetail>>({})
    const [retryingMetaCampaignId, setRetryingMetaCampaignId] = useState('')
    const [metaReplyReport, setMetaReplyReport] = useState<MetaReplyReport | null>(null)
    const [loadingMetaReplyReport, setLoadingMetaReplyReport] = useState(false)
    const [metaReplyIntentFilter, setMetaReplyIntentFilter] = useState('')
    const [metaReplyDateFilter, setMetaReplyDateFilter] = useState('')
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [metaCreateStep, setMetaCreateStep] = useState<MetaCreateStep>('config')
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
    const [metaTemplateWabaId, setMetaTemplateWabaId] = useState('')
    const [metaCampaignType, setMetaCampaignType] = useState<'marketing' | 'editorial' | 'followup' | 'utility' | 'test'>('marketing')
    const [metaTemplateParameters, setMetaTemplateParameters] = useState('')
    const [metaBodyParameterValues, setMetaBodyParameterValues] = useState<Record<string, string>>({})
    const [metaHeaderParameterValue, setMetaHeaderParameterValue] = useState('')
    const [metaHeaderMediaUrl, setMetaHeaderMediaUrl] = useState('')
    const [metaButtonParameterValues, setMetaButtonParameterValues] = useState<Record<string, string>>({})
    const [metaAudiencePersonalized, setMetaAudiencePersonalized] = useState(false)
    const [selectedMetaSenderId, setSelectedMetaSenderId] = useState('')
    const [metaSenderRoutingMode, setMetaSenderRoutingMode] = useState<'weighted_pool' | 'round_robin'>('weighted_pool')
    const [confirmOptIn, setConfirmOptIn] = useState(false)
    const [allowRepeatCreative, setAllowRepeatCreative] = useState(true)

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

    const loadMetaCampaigns = async (statusOverride = metaStatusFilter) => {
        setLoadingMetaCampaigns(true)
        try {
            const statusParam = statusOverride ? `&status=${encodeURIComponent(statusOverride)}` : ''
            const res = await fetch(`/api/admin/whatsapp/campaigns?provider=meta_whatsapp&limit=250${statusParam}`)
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
            const params = new URLSearchParams({
                provider: 'meta_whatsapp',
                report: 'reply_intents',
                limit: '200',
            })
            if (metaReplyIntentFilter) params.set('intent', metaReplyIntentFilter)
            if (metaReplyDateFilter) params.set('date', metaReplyDateFilter)
            const res = await fetch(`/api/admin/whatsapp/campaigns?${params.toString()}`)
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

    const loadMetaDailyReport = async (date = metaDailyReportDate) => {
        setLoadingMetaDailyReport(true)
        try {
            const params = new URLSearchParams({
                provider: 'meta_whatsapp',
                report: 'daily',
                date,
            })
            const res = await fetch(`/api/admin/whatsapp/campaigns?${params.toString()}`)
            const data = await res.json()
            if (data.success) {
                setMetaDailyReport(data)
            } else {
                setFeedback({ type: 'error', text: data.message || 'Erro ao carregar relatorio diario Meta' })
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao carregar relatorio diario Meta' })
        } finally {
            setLoadingMetaDailyReport(false)
        }
    }

    const loadMetaDetailedReport = async (filters = metaDetailedReportFilters) => {
        setLoadingMetaDetailedReport(true)
        try {
            const params = new URLSearchParams({
                provider: 'meta_whatsapp',
                report: 'detailed',
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                limit: filters.limit || '1000',
            })
            if (filters.templateName) params.set('template_name', filters.templateName)
            if (filters.campaignId) params.set('campaign_id', filters.campaignId)
            if (filters.senderId) params.set('sender_id', filters.senderId)
            if (filters.wabaId) params.set('waba_id', filters.wabaId)
            if (filters.status) params.set('status', filters.status)
            if (filters.intent) params.set('intent', filters.intent)
            if (filters.search.trim()) params.set('search', filters.search.trim())

            const res = await fetch(`/api/admin/whatsapp/campaigns?${params.toString()}`)
            const data = await res.json()
            if (data.success) {
                setMetaDetailedReport(data)
            } else {
                setFeedback({ type: 'error', text: data.message || 'Erro ao carregar relatorio detalhado Meta' })
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao carregar relatorio detalhado Meta' })
        } finally {
            setLoadingMetaDetailedReport(false)
        }
    }

    const refreshMetaWorkspace = async () => {
        await Promise.all([
            loadMetaCampaigns(),
            loadMetaContactLists(),
            loadMetaReplyReport(),
            loadMetaDailyReport(),
            loadMetaDetailedReport(),
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
            loadMetaDailyReport()
        }
    }, [sendProvider, metaStatusFilter, metaReplyIntentFilter, metaReplyDateFilter, metaDailyReportDate])

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
        anchor.download = `respostas-meta-whatsapp-${intent || 'todas'}${metaReplyDateFilter ? `-${metaReplyDateFilter}` : ''}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    const exportMetaDailyReportCsv = () => {
        if (!metaDailyReport) {
            setFeedback({ type: 'error', text: 'Carregue um relatorio diario antes de exportar.' })
            return
        }

        const totals = metaDailyReport.totals
        const summaryRows = [
            ['data', metaDailyReport.date],
            ['fuso', metaDailyReport.timezone],
            ['disparos_aceitos_meta', String(totals.dispatched || 0)],
            ['entregues', String(totals.delivered || 0)],
            ['lidas', String(totals.read || 0)],
            ['falhas', String(totals.failed || 0)],
            ['respostas_totais', String(totals.replies || 0)],
            ['respostas_positivas', String(totals.positive_replies || 0)],
            ['respostas_saida', String(totals.opt_out_replies || 0)],
            ['perguntas', String(totals.question_replies || 0)],
            ['custo', String(totals.cost_amount || 0).replace('.', ',')],
            ['moeda', totals.cost_currency || 'BRL'],
        ].map(row => row.map(escapeAudienceCell).join(';'))

        const campaignRows = [
            ['campanha', 'template', 'idioma', 'disparos', 'entregues', 'lidas', 'falhas', 'respostas', 'positivas', 'custo']
                .map(escapeAudienceCell)
                .join(';'),
            ...metaDailyReport.campaigns.map(campaign => [
                campaign.campaign_name,
                campaign.template_name,
                campaign.template_language || '',
                String(campaign.dispatched || 0),
                String(campaign.delivered || 0),
                String(campaign.read || 0),
                String(campaign.failed || 0),
                String(campaign.replies || 0),
                String(campaign.positive_replies || 0),
                String(campaign.cost_amount || 0).replace('.', ','),
            ].map(escapeAudienceCell).join(';')),
        ]

        const csv = [
            'resumo',
            ...summaryRows,
            '',
            'campanhas',
            ...campaignRows,
        ].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')

        anchor.href = url
        anchor.download = `relatorio-meta-whatsapp-${metaDailyReport.date}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    const exportMetaDetailedReportCsv = () => {
        const rows = metaDetailedReport?.rows || []
        if (!rows.length) {
            setFeedback({ type: 'error', text: 'Busque um relatorio com resultados antes de exportar.' })
            return
        }

        const headers = [
            'campanha',
            'criativo_template',
            'idioma',
            'tipo_campanha',
            'conta_whatsapp',
            'waba_id',
            'numero_remetente',
            'telefone_destinatario',
            'nome_destinatario',
            'status',
            'enviado_em',
            'entregue_em',
            'lido_em',
            'falhou_em',
            'resposta_intencao',
            'resposta_texto',
            'resposta_botao',
            'resposta_em',
            'criativo_repetido',
            'acao_repeticao',
            'campanha_anterior',
            'status_anterior',
            'data_historico_anterior',
            'codigo_erro',
            'mensagem_erro',
            'custo',
            'moeda',
        ]
        const csv = [
            headers.map(escapeAudienceCell).join(';'),
            ...rows.map(row => [
                row.campaign_name,
                row.template_name,
                row.template_language || '',
                row.campaign_type || '',
                row.waba_label || '',
                row.waba_id || '',
                row.sender_phone || row.sender_name || '',
                row.recipient_phone,
                row.recipient_name || '',
                metaStatusLabel(row.status),
                formatMetaDate(row.sent_at),
                formatMetaDate(row.delivered_at),
                formatMetaDate(row.read_at),
                formatMetaDate(row.failed_at),
                metaReplyIntentLabel(row.reply_intent),
                row.reply_text || '',
                row.reply_button || '',
                formatMetaDate(row.reply_at),
                row.repeat_creative_history ? 'sim' : 'nao',
                row.repeat_creative_action || '',
                row.prior_campaign_name || row.prior_campaign_id || '',
                row.prior_recipient_status || '',
                formatMetaDate(row.prior_sent_at),
                row.error_code || '',
                row.error_message || '',
                String(row.cost_amount || 0).replace('.', ','),
                row.currency || 'BRL',
            ].map(value => escapeAudienceCell(String(value || ''))).join(';')),
        ].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')

        anchor.href = url
        anchor.download = `relatorio-detalhado-meta-whatsapp-${metaDetailedReportFilters.dateFrom}-a-${metaDetailedReportFilters.dateTo}.csv`
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

    const buildAudienceLinesFromContacts = (
        contacts: MetaContactListContact[],
        mode: ContactListValidationMode = contactListValidationMode
    ) => {
        const requireConfirmedWhatsApp = contacts.some(contact => getContactWhatsAppCheckStatus(contact) !== 'unchecked')
        return contacts
            .filter(contact => isContactAllowedByValidationMode(contact, {
                requiresConfirmedWhatsApp: requireConfirmedWhatsApp,
                mode,
            }))
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
            const nextValidationMode = listId !== selectedContactListId ? 'confirmed_only' : contactListValidationMode
            if (nextValidationMode !== contactListValidationMode) {
                setContactListValidationMode(nextValidationMode)
            }
            if (data.list) {
                setMetaContactLists(prev => {
                    const exists = prev.some(list => list.id === data.list.id)
                    if (!exists) return [data.list, ...prev]
                    return prev.map(list => list.id === data.list.id ? data.list : list)
                })
            }
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
            setNumbersInput(buildAudienceLinesFromContacts(contacts, nextValidationMode))
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

    useEffect(() => {
        const hasActiveValidation = metaContactLists.some(list => {
            const status = contactListValidationStatus(list)
            return status === 'queued' || status === 'running'
        })
        if (!hasActiveValidation) return

        const timer = window.setInterval(() => {
            void loadMetaContactLists()
            if (selectedContactListId) {
                void loadSavedContactListIntoAudience(selectedContactListId, {
                    city: contactSegmentCity,
                    tag: contactSegmentTag,
                    search: contactSegmentSearch,
                    silent: true,
                })
            }
        }, 20000)

        return () => window.clearInterval(timer)
    }, [metaContactLists, selectedContactListId, contactSegmentCity, contactSegmentTag, contactSegmentSearch])

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

    const validateSelectedContactListWhatsApp = async () => {
        if (!selectedContactListId || !selectedContactList) return

        const currentStatus = contactListValidationStatus(selectedContactList)
        const force = currentStatus === 'completed'
            ? window.confirm('Revalidar todos os contatos desta lista na ConnectyHub?')
            : false
        if (currentStatus === 'completed' && !force) return

        setValidatingContactListId(selectedContactListId)
        setFeedback(null)
        try {
            const res = await fetch('/api/admin/whatsapp/contact-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'validate_whatsapp',
                    listId: selectedContactListId,
                    force,
                    batchSize: 100,
                }),
            })
            const data = await res.json()

            if (!data.success) {
                setFeedback({ type: 'error', text: data.message || 'Erro ao iniciar validacao WhatsApp da lista.' })
                return
            }

            if (data.list) {
                setMetaContactLists(prev => prev.map(list => list.id === data.list.id ? data.list : list))
            }

            setFeedback({
                type: 'success',
                text: data.message || 'Validacao WhatsApp iniciada para a lista.',
            })
            await loadMetaContactLists()
            if (selectedContactListId) {
                await loadSavedContactListIntoAudience(selectedContactListId, { silent: true })
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao iniciar validacao WhatsApp da lista.' })
        } finally {
            setValidatingContactListId('')
        }
    }

    const clearSavedContactListSelection = () => {
        setSelectedContactListId('')
        setSelectedContactListContacts([])
        setContactListSegments(null)
        setContactListAudienceCounts({ all: 0, filtered: 0 })
        setContactListValidationMode('confirmed_only')
        resetContactSegmentFilters()
    }

    const resetMetaTemplateBuilder = () => {
        setMetaTemplateParameters('')
        setMetaBodyParameterValues({})
        setMetaHeaderParameterValue('')
        setMetaHeaderMediaUrl('')
        setMetaButtonParameterValues({})
    }

    const getSelectedMetaTemplate = (preferredWabaId = '') => {
        const matches = metaTemplates.filter(template =>
            isApprovedImageMetaTemplate(template)
            && template.name === metaTemplateName
            && template.language === metaTemplateLanguage
        )
        const targetWabaId = metaTemplateWabaId || preferredWabaId
        return (targetWabaId ? matches.find(template => template.waba_id === targetWabaId) : null)
            || matches[0]
            || null
    }

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
            if (savedContact) {
                if (!isContactAllowedByValidationMode(savedContact, {
                    requiresConfirmedWhatsApp: selectedContactListRequiresConfirmedWhatsApp,
                    mode: contactListValidationMode,
                })) return
            }

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
        let creativeDeduplicationMode: CreativeDeduplicationMode = allowRepeatCreative ? 'track_only' : 'skip_previous'
        const metaRecipientDrafts = sendProvider === 'meta_whatsapp' && metaAudiencePersonalized
            ? parseMetaRecipientDrafts()
            : []
        const numbers = sendProvider === 'meta_whatsapp' && metaAudiencePersonalized
            ? metaRecipientDrafts.map(recipient => recipient.phone)
            : parseNumbers()
        if (numbers.length === 0) {
            if (sendProvider === 'meta_whatsapp' && selectedContactListId) {
                setFeedback({ type: 'error', text: 'Nenhum contato ficou liberado neste modo. Use somente confirmados quando houver validos, ou marque incluir pendentes/nao verificados para enviar com pressa.' })
                return
            }
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
            if (selectedContactListRequiresConfirmedWhatsApp && selectedContactListEligibleContacts.length === 0) {
                setFeedback({ type: 'error', text: 'Esta lista nao tem contato confirmado para este modo. Para enviar com pressa, altere para incluir pendentes/nao verificados.' })
                return
            }
            if (selectedContactList && selectedContactListWillIncludeUnverified) {
                const confirmed = window.confirm(
                    `A lista "${selectedContactList.name}" ainda nao esta 100% validada.\n\n` +
                    `Confirmados com WhatsApp: ${selectedContactListConfirmedContacts.length}\n` +
                    `Pendentes/erro/sem verificacao: ${selectedContactListUnverifiedContacts.length}\n` +
                    `Sem WhatsApp confirmado: ${selectedContactListInvalidContacts.length}\n\n` +
                    'Enviar mesmo assim pode gastar limite Meta com numeros que talvez nao tenham WhatsApp. Deseja continuar?'
                )
                if (!confirmed) return
            }
            if (!allowRepeatCreative && selectedContactList && selectedTemplateWasUsedForList && selectedTemplateUsage) {
                const confirmed = window.confirm(
                    `A lista "${selectedContactList.name}" ja foi usada com o template "${selectedTemplateUsage.template_name}" em ${selectedTemplateUsage.campaigns} campanha(s).\n\n` +
                    `Ultima campanha: ${selectedTemplateUsage.last_campaign_name || 'sem nome'}\n` +
                    `Ultimo uso: ${formatMetaDate(selectedTemplateUsage.last_used_at)}\n\n` +
                    'Se continuar, o sistema vai reenviar este mesmo criativo tambem para contatos que ja receberam ou estao na fila. Deseja continuar mesmo assim?'
                )
                if (!confirmed) return
                creativeDeduplicationMode = 'track_only'
            }
            if (!hasMetaPortfolioCapacity) {
                setFeedback({ type: 'error', text: `A BM/portfolio Meta atingiu o uso/reserva diaria compartilhada (${metaPortfolioUsage.usageLabel}). Aguarde liberacao por falha, reset da janela de 24h ou agende para depois.` })
                return
            }
            if (!scheduleDate && numbers.length > metaPortfolioUsage.remaining) {
                setFeedback({ type: 'error', text: `A lista tem ${numbers.length} contatos, mas restam ${metaPortfolioUsage.remaining} vagas livres no limite compartilhado da BM/portfolio Meta hoje. Divida a lista ou agende para depois.` })
                return
            }
            if (readyMetaSenders.length === 0) {
                const firstBlocked = activeMetaSenders[0] ? metaSenderOptionLabel(activeMetaSenders[0]) : ''
                setFeedback({ type: 'error', text: `Nenhum numero Meta esta liberado para envio agora.${firstBlocked ? ` Primeiro diagnostico: ${firstBlocked}.` : ''} Sincronize os numeros oficiais ou pause o disparo ate recuperar saude/capacidade.` })
                return
            }
            if (selectedMetaSenderId && selectedMetaSender && !isMetaSenderAvailable(selectedMetaSender)) {
                setFeedback({ type: 'error', text: `O numero selecionado esta indisponivel para envio (${metaSenderOptionLabel(selectedMetaSender)}). Escolha um numero saudavel ou use o pool automatico por capacidade.` })
                return
            }
        }

        setSending(true)
        setFeedback(null)
        try {
            const selectedTemplateForSubmit = sendProvider === 'meta_whatsapp' ? getSelectedMetaTemplate() : null
            const usingPortfolioRouting = sendProvider === 'meta_whatsapp' && isMetaPortfolioRouting
            const targetWabaId = usingPortfolioRouting
                ? ''
                : selectedMetaSender?.waba_id || selectedTemplateForSubmit?.waba_id || metaTemplateWabaId
            if (
                sendProvider === 'meta_whatsapp'
                && !usingPortfolioRouting
                && selectedMetaSender?.waba_id
                && selectedTemplateForSubmit?.waba_id
                && selectedMetaSender.waba_id !== selectedTemplateForSubmit.waba_id
            ) {
                setFeedback({
                    type: 'error',
                    text: `O template selecionado pertence a ${metaTemplateWabaLabel(selectedTemplateForSubmit)}, mas o numero escolhido pertence a ${metaSenderWabaLabel(selectedMetaSender)}. Escolha um numero da mesma conta ou use o pool automatico.`,
                })
                return
            }
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
                        whatsAppValidationMode: selectedContactListId ? contactListValidationMode : undefined,
                        allowUnverifiedWhatsApp: selectedContactListId ? contactListValidationMode === 'include_unverified' : undefined,
                        creativeDeduplicationMode,
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
                        senderRoutingMode: usingPortfolioRouting ? 'round_robin' : 'weighted_pool',
                        portfolioRouting: usingPortfolioRouting,
                        defaultSenderId: usingPortfolioRouting ? undefined : selectedMetaSenderId || undefined,
                        wabaId: usingPortfolioRouting ? undefined : targetWabaId || undefined,
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
                setFeedback({ type: 'success', text: data.message || 'Campanha lancada com sucesso. Os contatos foram 100% liberados para envio em segundo plano.' })
                const createdCampaignId = textValue(data.campaign?.id)
                setShowCreateForm(false)
                setMetaCreateStep('config')
                setMetaStatusFilter('')
                if (createdCampaignId) setExpandedMetaCampaignId(createdCampaignId)
                setNumbersInput('')
                clearSavedContactListSelection()
                setMsgText('')
                setMediaUrl('')
                setMetaSenderRoutingMode('weighted_pool')
                setAllowRepeatCreative(true)
                resetMetaTemplateBuilder()
                if (sendProvider === 'connectyhub') loadCampaigns()
                if (sendProvider === 'meta_whatsapp') await loadMetaCampaigns('')
                window.setTimeout(() => {
                    document.getElementById('meta-campaign-history-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 0)
            } else {
                setFeedback({ type: 'error', text: data.message || 'Erro ao lancar campanha.' })
            }
        } catch (e) {
            setFeedback({ type: 'error', text: 'Erro de conexao ao lancar campanha.' })
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

    const manageMetaCampaign = async (campaignId: string, action: MetaCampaignManageAction) => {
        if (action === 'delete') {
            const confirmed = window.confirm('Excluir esta campanha do painel? Ela nao aparecera mais na lista, mas os dados historicos continuam salvos.')
            if (!confirmed) return
        }

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
                if (action === 'delete') {
                    setExpandedMetaCampaignId(current => current === campaignId ? '' : current)
                    setMetaCampaignDetails(prev => {
                        const next = { ...prev }
                        delete next[campaignId]
                        return next
                    })
                }
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
    const approvedImageMetaTemplates = approvedMetaTemplates.filter(templateHasImageHeader)
    const metaTemplateOptions = Array.from(approvedImageMetaTemplates.reduce((options, template) => {
        const key = metaTemplateNameLanguageValue(template)
        const current = options.get(key)
        if (current) {
            current.variants.push(template)
            return options
        }
        options.set(key, {
            key,
            name: template.name,
            language: template.language || 'pt_BR',
            category: template.category,
            variants: [template],
        })
        return options
    }, new Map<string, { key: string; name: string; language: string; category: string; variants: MetaTemplate[] }>()).values())
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    const activeMetaSenders = metaSenders.filter(sender => sender.local_status === 'active')
    const selectedMetaSender = activeMetaSenders.find(sender => sender.id === selectedMetaSenderId) || null
    const selectedContactList = metaContactLists.find(list => list.id === selectedContactListId) || null
    const selectedContactListUsage = contactListUsage(selectedContactList)
    const selectedContactListValidationStatus = contactListValidationStatus(selectedContactList)
    const selectedContactListValidationStats = contactListValidationStats(selectedContactList)
    const selectedContactListHasCheckedContacts = selectedContactListContacts.some(contact => getContactWhatsAppCheckStatus(contact) !== 'unchecked')
    const selectedContactListRequiresConfirmedWhatsApp = selectedContactListValidationStats.checked > 0 || selectedContactListHasCheckedContacts
    const selectedContactListEligibleContacts = selectedContactListContacts.filter(contact => (
        isContactAllowedByValidationMode(contact, {
            requiresConfirmedWhatsApp: selectedContactListRequiresConfirmedWhatsApp,
            mode: contactListValidationMode,
        })
    ))
    const selectedContactListConfirmedContacts = selectedContactListContacts.filter(contact => getContactWhatsAppCheckStatus(contact) === 'valid')
    const selectedContactListInvalidContacts = selectedContactListContacts.filter(isContactWithoutWhatsApp)
    const selectedContactListUnverifiedContacts = selectedContactListContacts.filter(contact => {
        const status = getContactWhatsAppCheckStatus(contact)
        return status === 'unchecked' || status === 'unknown' || status === 'error'
    })
    const selectedContactListHasPendingValidation = selectedContactListUnverifiedContacts.length > 0
        || selectedContactListValidationStatus === 'queued'
        || selectedContactListValidationStatus === 'running'
    const selectedContactListWillIncludeUnverified = contactListValidationMode === 'include_unverified'
        && selectedContactListHasPendingValidation
    const selectedMetaTemplate = getSelectedMetaTemplate(selectedMetaSender?.waba_id || '')
    const selectedMetaTemplateVariants = metaTemplateName.trim()
        ? approvedImageMetaTemplates.filter(template => (
            template.name === metaTemplateName
            && template.language === metaTemplateLanguage
        ))
        : []
    const selectedTemplateApprovedWabaIds = Array.from(new Set(
        selectedMetaTemplateVariants.map(template => textValue(template.waba_id)).filter(Boolean)
    ))
    const selectedTemplateApprovedWabaKey = selectedTemplateApprovedWabaIds.join('|')
    const portfolioRoutingEligibleSenders = selectedTemplateApprovedWabaIds.length > 0
        ? activeMetaSenders.filter(sender => selectedTemplateApprovedWabaIds.includes(sender.waba_id))
        : []
    const portfolioRoutingReadySenders = portfolioRoutingEligibleSenders.filter(isMetaSenderAvailable)
    const portfolioRoutingReadyWabaIds = Array.from(new Set(portfolioRoutingReadySenders.map(sender => sender.waba_id).filter(Boolean)))
    const portfolioRoutingAvailable = portfolioRoutingReadyWabaIds.length >= 2
    const isMetaPortfolioRouting = metaSenderRoutingMode === 'round_robin' && portfolioRoutingAvailable
    const selectedTargetWabaId = isMetaPortfolioRouting
        ? ''
        : selectedMetaSender?.waba_id || selectedMetaTemplate?.waba_id || metaTemplateWabaId
    const targetMetaSenders = isMetaPortfolioRouting
        ? portfolioRoutingEligibleSenders
        : selectedTargetWabaId
            ? activeMetaSenders.filter(sender => sender.waba_id === selectedTargetWabaId)
            : activeMetaSenders
    const metaPortfolioUsage = metaPortfolioUsageFromSenders(activeMetaSenders)
    const hasMetaPortfolioCapacity = metaPortfolioUsage.limit > 0 && metaPortfolioUsage.remaining > 0
    const readyMetaSenders = targetMetaSenders.filter(isMetaSenderAvailable)
    const selectedTemplateUsage = selectedContactListUsage.templates.find(template =>
        templateUsageKey(template.template_name, template.template_language) === templateUsageKey(metaTemplateName, metaTemplateLanguage)
    ) || null
    const selectedTemplateWasUsedForList = Boolean(selectedContactList && metaTemplateName.trim() && selectedTemplateUsage?.campaigns)
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
        if (metaSenderRoutingMode === 'round_robin' && !portfolioRoutingAvailable) {
            setMetaSenderRoutingMode('weighted_pool')
        }
    }, [metaSenderRoutingMode, portfolioRoutingAvailable, selectedTemplateApprovedWabaKey])

    useEffect(() => {
        if (metaSenderRoutingMode === 'round_robin' && selectedMetaSenderId) {
            setSelectedMetaSenderId('')
        }
    }, [metaSenderRoutingMode, selectedMetaSenderId])

    useEffect(() => {
        const templateMismatch = Boolean(
            selectedMetaSender?.waba_id
            && selectedMetaTemplate?.waba_id
            && selectedMetaSender.waba_id !== selectedMetaTemplate.waba_id
        )
        if (selectedMetaSenderId && selectedMetaSender && (!isMetaSenderAvailable(selectedMetaSender) || !hasMetaPortfolioCapacity || templateMismatch)) {
            setSelectedMetaSenderId('')
            setFeedback({
                type: 'error',
                text: templateMismatch
                    ? `O numero selecionado pertence a ${metaSenderWabaLabel(selectedMetaSender)}, mas o template pertence a ${metaTemplateWabaLabel(selectedMetaTemplate)}. Alterei para Pool automatico por capacidade.`
                    : hasMetaPortfolioCapacity
                    ? `O numero selecionado ficou indisponivel (${metaSenderOptionLabel(selectedMetaSender)}). Alterei para Pool automatico por capacidade.`
                    : `A BM/portfolio Meta atingiu o uso/reserva diaria compartilhada (${metaPortfolioUsage.usageLabel}).`,
            })
        }
    }, [selectedMetaSenderId, selectedMetaSender, selectedMetaTemplate, hasMetaPortfolioCapacity, metaPortfolioUsage.usageLabel])
    const previewBodyText = replaceTemplateVariables(selectedBodyText, metaBodyParameterValues, 'exemplo')
    const parsedMetaRecipientDrafts = sendProvider === 'meta_whatsapp' && metaAudiencePersonalized ? parseMetaRecipientDrafts() : []
    const parsedNumbers = sendProvider === 'meta_whatsapp' && metaAudiencePersonalized
        ? parsedMetaRecipientDrafts.map(recipient => recipient.phone)
        : parseNumbers()
    const selectedBodyVariablesKey = selectedBodyVariables.join(',')
    const metaCampaignAudienceLabel = selectedContactList
        ? `${selectedContactListEligibleContacts.length} de ${contactListAudienceCounts.all || selectedContactList.valid_contacts} elegiveis`
        : `${parsedNumbers.length} contato(s)`
    const metaRoutingPreviewLabel = isMetaPortfolioRouting
        ? `Pool BM/portfolio (${portfolioRoutingReadyWabaIds.length} contas)`
        : selectedMetaSender
            ? selectedMetaSender.display_name || selectedMetaSender.phone_number
            : 'Pool automatico'
    const missingBodyVariableCount = selectedBodyVariables.filter(variable => !String(metaBodyParameterValues[String(variable)] || '').trim()).length
    const metaCreateWarnings = [
        !selectedMetaTemplate ? 'Escolha um template aprovado.' : '',
        selectedHeaderUsesMedia && !metaHeaderMediaUrl.trim() ? 'Informe a midia do template.' : '',
        missingBodyVariableCount > 0 ? `${missingBodyVariableCount} variavel(is) sem valor de exemplo.` : '',
        parsedNumbers.length === 0 ? 'Selecione uma lista ou informe numeros.' : '',
        !confirmOptIn ? 'Confirme o opt-in da lista.' : '',
        !hasMetaPortfolioCapacity ? 'Limite compartilhado da BM sem vagas livres.' : '',
    ].filter(Boolean)
    const metaCampaignTypeLabel = {
        marketing: 'Marketing',
        editorial: 'Editorial',
        followup: 'Follow-up',
        utility: 'Utility',
        test: 'Teste',
    }[metaCampaignType]
    const metaScheduleLabel = scheduleDate
        ? new Date(scheduleDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        : 'Enviar agora'
    const metaCreateStepIndex = Math.max(0, META_CREATE_STEP_ORDER.indexOf(metaCreateStep))
    const metaNextStep = META_CREATE_STEP_ORDER[metaCreateStepIndex + 1]
    const metaPreviousStep = META_CREATE_STEP_ORDER[metaCreateStepIndex - 1]
    const metaMessageStepReady = Boolean(
        selectedMetaTemplate
        && (!selectedHeaderUsesMedia || metaHeaderMediaUrl.trim())
        && missingBodyVariableCount === 0
    )
    const metaAudienceStepReady = parsedNumbers.length > 0 && confirmOptIn
    const metaDeliveryStepReady = hasMetaPortfolioCapacity && readyMetaSenders.length > 0
    const metaCreateSteps: MetaCreateStepItem[] = [
        {
            id: 'config',
            title: 'Configuracao',
            description: 'Nome e infraestrutura',
            complete: Boolean(campaignName.trim()) && metaDeliveryStepReady,
            attention: !hasMetaPortfolioCapacity || readyMetaSenders.length === 0,
        },
        {
            id: 'message',
            title: 'Mensagem',
            description: 'Template e variaveis',
            complete: metaMessageStepReady,
            attention: Boolean(selectedMetaTemplate) && !metaMessageStepReady,
        },
        {
            id: 'audience',
            title: 'Publico',
            description: 'Lista e opt-in',
            complete: metaAudienceStepReady,
            attention: parsedNumbers.length > 0 && !confirmOptIn,
        },
        {
            id: 'delivery',
            title: 'Entrega',
            description: 'Quando enviar',
            complete: metaDeliveryStepReady,
            attention: !metaDeliveryStepReady,
        },
        {
            id: 'review',
            title: 'Revisao',
            description: 'Confirmar envio',
            complete: metaCreateWarnings.length === 0,
            attention: metaCreateWarnings.length > 0,
        },
    ]
    const goToNextMetaStep = () => {
        if (metaNextStep) setMetaCreateStep(metaNextStep)
    }
    const goToPreviousMetaStep = () => {
        if (metaPreviousStep) setMetaCreateStep(metaPreviousStep)
    }
    const metaPrimaryActionLabel = metaCreateStep === 'review'
        ? scheduleDate
            ? `Agendar campanha para ${parsedNumbers.length} contatos`
            : `Lancar campanha para ${parsedNumbers.length} contatos`
        : metaNextStep
            ? `Continuar para ${metaCreateSteps.find(step => step.id === metaNextStep)?.title.toLowerCase()}`
            : 'Continuar'
    const metaFinalSendDisabled = sending || parsedNumbers.length === 0 || metaCreateWarnings.length > 0

    useEffect(() => {
        if (!selectedContactListId || selectedContactListContacts.length === 0) return
        setNumbersInput(buildAudienceLinesFromContacts(selectedContactListContacts))
        setMetaAudiencePersonalized(true)
    }, [selectedContactListId, selectedContactListContacts, selectedBodyVariablesKey, contactListValidationMode])

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
                .meta-create-shell {
                    margin-bottom: 18px;
                    border: 1px solid rgba(201,169,110,0.28);
                    border-radius: 12px;
                    background: color-mix(in srgb, var(--bg-secondary) 94%, #ffffff 6%);
                    overflow: clip;
                }

                .meta-channel-strip {
                    display: grid;
                    grid-template-columns: repeat(5, minmax(150px, 1fr));
                    gap: 8px;
                    align-items: stretch;
                    margin-bottom: 14px;
                }

                .meta-channel-item {
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    padding: 10px 12px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.035);
                }

                .meta-channel-item span {
                    color: var(--text-muted);
                    font-size: 0.66rem;
                    font-weight: 900;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }

                .meta-channel-item strong {
                    min-width: 0;
                    color: var(--text-primary);
                    font-size: 0.82rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .meta-channel-item-success strong {
                    color: #16a34a;
                }

                .meta-channel-item-alert strong {
                    color: #d97706;
                }

                .meta-infra-bar {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-bottom: 14px;
                    padding: 12px 14px;
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    background: rgba(255,255,255,0.04);
                    color: var(--text-secondary);
                    font-size: 0.78rem;
                    box-shadow: 0 10px 26px rgba(15,23,42,0.04);
                }

                .meta-infra-bar span {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    min-height: 22px;
                    padding-right: 10px;
                    border-right: 1px solid var(--border);
                    white-space: nowrap;
                }

                .meta-infra-bar span:last-child {
                    border-right: 0;
                    padding-right: 0;
                }

                .meta-infra-bar svg {
                    color: #16a34a;
                }

                .meta-create-titlebar {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    align-items: center;
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--border);
                    background: rgba(255,255,255,0.025);
                }

                .meta-create-titlebar h2 {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    margin: 0;
                    color: var(--text-primary);
                    font-size: 1rem;
                }

                .meta-create-titlebar p {
                    margin: 3px 0 0;
                    color: var(--text-muted);
                    font-size: 0.74rem;
                    line-height: 1.4;
                }

                .meta-create-status-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    padding: 7px 10px;
                    border-radius: 8px;
                    border: 1px solid rgba(34,197,94,0.28);
                    background: rgba(34,197,94,0.08);
                    color: #16a34a;
                    font-size: 0.76rem;
                    font-weight: 800;
                    white-space: nowrap;
                }

                .meta-stepper {
                    display: grid;
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                    gap: 0;
                    padding: 14px 16px;
                    border-bottom: 1px solid var(--border);
                    background: rgba(255,255,255,0.018);
                }

                .meta-stepper-button {
                    position: relative;
                    min-width: 0;
                    border: 0;
                    background: transparent;
                    color: var(--text-muted);
                    cursor: pointer;
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr);
                    gap: 9px;
                    align-items: center;
                    text-align: left;
                    padding: 4px 18px 4px 0;
                }

                .meta-stepper-button:disabled {
                    cursor: not-allowed;
                }

                .meta-stepper-marker {
                    width: 32px;
                    height: 32px;
                    border-radius: 999px;
                    display: grid;
                    place-items: center;
                    border: 1px solid var(--border);
                    background: rgba(255,255,255,0.05);
                    color: var(--text-secondary);
                    font-size: 0.78rem;
                    font-weight: 900;
                }

                .meta-stepper-copy {
                    min-width: 0;
                    display: grid;
                    gap: 2px;
                }

                .meta-stepper-copy strong {
                    min-width: 0;
                    color: var(--text-secondary);
                    font-size: 0.78rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .meta-stepper-copy span {
                    min-width: 0;
                    color: var(--text-muted);
                    font-size: 0.68rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .meta-stepper-line {
                    position: absolute;
                    right: 7px;
                    top: 50%;
                    width: 22px;
                    height: 1px;
                    background: var(--border);
                }

                .meta-stepper-line.is-past {
                    background: rgba(34,197,94,0.36);
                }

                .meta-stepper-button.is-active .meta-stepper-marker {
                    border-color: rgba(37,99,235,0.34);
                    background: #2563eb;
                    color: #fff;
                    box-shadow: 0 8px 18px rgba(37,99,235,0.22);
                }

                .meta-stepper-button.is-active .meta-stepper-copy strong {
                    color: var(--text-primary);
                }

                .meta-stepper-button.is-complete .meta-stepper-marker {
                    border-color: rgba(34,197,94,0.28);
                    background: rgba(34,197,94,0.12);
                    color: #16a34a;
                }

                .meta-stepper-button.has-attention:not(.is-active) .meta-stepper-marker {
                    border-color: rgba(245,158,11,0.34);
                    background: rgba(245,158,11,0.1);
                    color: #d97706;
                }

                .meta-create-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 360px;
                    gap: 0;
                    align-items: start;
                }

                .meta-create-main {
                    display: grid;
                    gap: 10px;
                    min-width: 0;
                    padding: 12px 14px 14px;
                    border-right: 1px solid var(--border);
                }

                .meta-create-section {
                    display: grid;
                    gap: 9px;
                    padding: 10px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.028);
                }

                .meta-create-section-creative {
                    background: rgba(255,255,255,0.032);
                    border-color: var(--border);
                }

                .meta-step-hidden {
                    display: none !important;
                }

                .meta-create-section input:not([type="checkbox"]),
                .meta-create-section select,
                .meta-create-section textarea,
                .meta-advanced-panel input:not([type="checkbox"]),
                .meta-advanced-panel select,
                .meta-advanced-panel textarea {
                    min-height: 34px !important;
                    padding: 7px 10px !important;
                    border-radius: 6px !important;
                    font-size: 0.82rem !important;
                }

                .meta-create-section textarea {
                    min-height: 78px !important;
                }

                .meta-create-section label {
                    font-size: 0.68rem !important;
                    margin-bottom: 3px !important;
                }

                .meta-create-section h3 {
                    font-size: 0.9rem !important;
                }

                .meta-compact-note {
                    padding: 7px 9px;
                    border-radius: 6px;
                    border: 1px solid rgba(59,130,246,0.18);
                    background: rgba(59,130,246,0.055);
                    color: var(--text-secondary);
                    font-size: 0.72rem;
                    line-height: 1.35;
                }

                .meta-compact-note-success {
                    border-color: rgba(34,197,94,0.18);
                    background: rgba(34,197,94,0.055);
                }

                .meta-compact-grid-two {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    gap: 10px;
                    align-items: start;
                }

                .meta-advanced-panel {
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.025);
                }

                .meta-advanced-panel > summary {
                    cursor: pointer;
                    list-style: none;
                    padding: 8px 10px;
                    color: var(--text-secondary);
                    font-size: 0.78rem;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                }

                .meta-advanced-panel > summary::-webkit-details-marker {
                    display: none;
                }

                .meta-advanced-panel > summary::after {
                    content: '+';
                    color: var(--text-muted);
                    font-weight: 900;
                }

                .meta-advanced-panel[open] > summary::after {
                    content: '-';
                }

                .meta-advanced-panel-body {
                    display: grid;
                    gap: 8px;
                    padding: 0 10px 10px;
                }

                .meta-advanced-panel textarea {
                    min-height: 78px !important;
                }

                .meta-compact-checkbox {
                    display: flex !important;
                    align-items: flex-start !important;
                    gap: 8px !important;
                    padding: 8px 10px !important;
                    border-radius: 7px !important;
                    border: 1px solid var(--border) !important;
                    background: rgba(255,255,255,0.035) !important;
                    color: var(--text-secondary) !important;
                    font-size: 0.76rem !important;
                    line-height: 1.35 !important;
                }

                .meta-template-mini-card {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    align-items: center;
                    padding: 8px 10px;
                    border-radius: 7px;
                    border: 1px solid rgba(34,197,94,0.2);
                    background: rgba(34,197,94,0.055);
                    color: var(--text-secondary);
                    font-size: 0.76rem;
                    line-height: 1.35;
                }

                .meta-template-config-grid {
                    display: grid;
                    gap: 9px;
                    align-items: start;
                }

                .meta-template-inline-preview {
                    display: none;
                }

                .meta-review-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
                    gap: 10px;
                }

                .meta-review-card {
                    display: grid;
                    gap: 8px;
                    padding: 11px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.035);
                    min-width: 0;
                }

                .meta-review-card-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                }

                .meta-review-card h3 {
                    margin: 0;
                    color: var(--text-primary);
                    font-size: 0.86rem;
                }

                .meta-review-card button {
                    border: 1px solid var(--border);
                    border-radius: 7px;
                    background: rgba(255,255,255,0.04);
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-size: 0.72rem;
                    font-weight: 800;
                    padding: 6px 8px;
                }

                .meta-review-row {
                    display: grid;
                    grid-template-columns: 92px minmax(0, 1fr);
                    gap: 8px;
                    color: var(--text-secondary);
                    font-size: 0.76rem;
                    line-height: 1.35;
                }

                .meta-review-row span {
                    color: var(--text-muted);
                    font-size: 0.66rem;
                    font-weight: 900;
                    letter-spacing: 0.4px;
                    text-transform: uppercase;
                }

                .meta-review-row strong {
                    min-width: 0;
                    color: var(--text-primary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .meta-readiness-list {
                    display: grid;
                    gap: 7px;
                    padding: 0;
                    margin: 0;
                    list-style: none;
                }

                .meta-readiness-list li {
                    display: flex;
                    align-items: flex-start;
                    gap: 7px;
                    color: var(--text-secondary);
                    font-size: 0.76rem;
                    line-height: 1.35;
                }

                .meta-readiness-list svg {
                    flex: 0 0 auto;
                    margin-top: 1px;
                }

                .meta-create-actions {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr);
                    gap: 8px;
                    align-items: center;
                }

                .meta-create-secondary-button {
                    min-height: 42px;
                    padding: 10px 14px;
                    border-radius: 8px;
                    border: 1px solid var(--border);
                    background: rgba(255,255,255,0.045);
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-weight: 800;
                    font-size: 0.84rem;
                }

                .meta-create-secondary-button:disabled {
                    cursor: not-allowed;
                    opacity: 0.45;
                }

                .meta-create-actionbar {
                    position: sticky;
                    bottom: 10px;
                    z-index: 5;
                    display: grid;
                    gap: 8px;
                    padding: 10px;
                    border: 1px solid rgba(201,169,110,0.28);
                    border-radius: 8px;
                    background: color-mix(in srgb, var(--bg-secondary) 92%, #ffffff 8%);
                    box-shadow: 0 12px 28px rgba(15,23,42,0.12);
                }

                .meta-create-action-summary {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    color: var(--text-muted);
                    font-size: 0.74rem;
                    line-height: 1.35;
                }

                .meta-create-launch-button {
                    width: 100%;
                    min-height: 42px;
                    padding: 11px 20px;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                    background: linear-gradient(135deg, var(--gold), #b8860b);
                    color: #111827;
                    font-weight: 800;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: opacity 0.2s, transform 0.2s;
                }

                .meta-create-launch-button:disabled {
                    cursor: not-allowed;
                    opacity: 0.5;
                    transform: none;
                }

                .meta-create-preview-pane {
                    position: sticky;
                    top: 16px;
                    display: grid;
                    gap: 14px;
                    min-width: 0;
                    padding: 18px;
                    align-self: start;
                }

                .meta-create-preview-header {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    align-items: flex-start;
                }

                .meta-create-preview-header h3 {
                    margin: 3px 0 0;
                    color: var(--text-primary);
                    font-size: 0.98rem;
                }

                .meta-create-eyebrow {
                    color: var(--text-muted);
                    font-size: 0.68rem;
                    font-weight: 900;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }

                .meta-phone-frame {
                    width: min(100%, 310px);
                    margin: 0 auto;
                    padding: 10px;
                    border-radius: 26px;
                    border: 1px solid rgba(15,23,42,0.16);
                    background: #f8fafc;
                    box-shadow: 0 18px 38px rgba(15,23,42,0.16);
                }

                .meta-phone-speaker {
                    width: 68px;
                    height: 5px;
                    margin: 3px auto 9px;
                    border-radius: 999px;
                    background: #cbd5e1;
                }

                .meta-phone-screen {
                    overflow: hidden;
                    min-height: 470px;
                    border-radius: 19px;
                    border: 1px solid rgba(15,23,42,0.12);
                    background: #efe7dc;
                    color: #111827;
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                }

                .meta-phone-topbar {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    align-items: center;
                    padding: 11px 12px;
                    border-bottom: 1px solid rgba(15,23,42,0.12);
                    background: #ffffff;
                    font-size: 0.74rem;
                }

                .meta-phone-topbar strong {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .meta-phone-chat {
                    padding: 18px 11px;
                    background:
                        linear-gradient(45deg, rgba(255,255,255,0.34) 25%, transparent 25%),
                        linear-gradient(-45deg, rgba(255,255,255,0.34) 25%, transparent 25%),
                        #efe7dc;
                    background-size: 22px 22px;
                    display: flex;
                    align-items: flex-start;
                    justify-content: flex-end;
                }

                .meta-phone-bubble {
                    width: min(100%, 240px);
                    border-radius: 12px 12px 2px 12px;
                    padding: 9px 10px;
                    background: #dcf8c6;
                    box-shadow: 0 1px 2px rgba(15,23,42,0.16);
                    font-size: 0.78rem;
                    line-height: 1.42;
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                }

                .meta-phone-media {
                    margin: -2px -2px 8px;
                    min-height: 108px;
                    border-radius: 9px;
                    overflow: hidden;
                    background: #cbd5e1;
                    display: grid;
                    place-items: center;
                    color: #475569;
                    font-size: 0.74rem;
                    font-weight: 900;
                }

                .meta-phone-media img {
                    width: 100%;
                    max-height: 170px;
                    object-fit: cover;
                    display: block;
                }

                .meta-phone-header-text {
                    display: block;
                    margin-bottom: 6px;
                }

                .meta-phone-template-footer {
                    margin-top: 8px;
                    color: #64748b;
                    font-size: 0.7rem;
                }

                .meta-phone-buttons {
                    display: grid;
                    gap: 0;
                    margin-top: 9px;
                    color: #0369a1;
                    font-weight: 800;
                    text-align: center;
                }

                .meta-phone-buttons div {
                    padding-top: 7px;
                    margin-top: 7px;
                    border-top: 1px solid rgba(15,23,42,0.12);
                }

                .meta-phone-footer {
                    padding: 8px 10px 10px;
                    background: #ffffff;
                    color: #64748b;
                    text-align: center;
                    font-size: 0.64rem;
                }

                .meta-preview-summary {
                    display: grid;
                    gap: 8px;
                    padding: 12px;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    background: rgba(255,255,255,0.035);
                }

                .meta-preview-summary div {
                    display: grid;
                    grid-template-columns: 82px minmax(0, 1fr);
                    gap: 8px;
                    align-items: baseline;
                    font-size: 0.74rem;
                }

                .meta-preview-summary span {
                    color: var(--text-muted);
                    font-weight: 800;
                    text-transform: uppercase;
                    font-size: 0.62rem;
                    letter-spacing: 0.4px;
                }

                .meta-preview-summary strong {
                    min-width: 0;
                    color: var(--text-primary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .meta-preview-alert {
                    display: grid;
                    gap: 7px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    font-size: 0.75rem;
                    line-height: 1.35;
                }

                .meta-preview-alert span {
                    display: flex;
                    align-items: flex-start;
                    gap: 7px;
                }

                .meta-preview-alert svg {
                    flex: 0 0 auto;
                    margin-top: 1px;
                }

                .meta-preview-alert-warning {
                    border: 1px solid rgba(245,158,11,0.3);
                    background: rgba(245,158,11,0.08);
                    color: #b45309;
                }

                .meta-preview-alert-ready {
                    border: 1px solid rgba(34,197,94,0.22);
                    background: rgba(34,197,94,0.08);
                    color: #16a34a;
                    font-weight: 800;
                }

                .meta-campaigns-workspace {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    min-height: 0;
                }

                .meta-campaign-table-pane {
                    min-width: 0;
                    overflow-x: auto;
                }

                .meta-campaign-table-shell {
                    min-width: 1040px;
                }

                .meta-campaign-list-scroll {
                    max-height: 620px;
                    overflow-y: auto;
                }

                .meta-campaign-detail-aside {
                    min-width: 0;
                    background: rgba(255,255,255,0.02);
                    display: grid;
                    grid-template-rows: auto 1fr;
                    align-self: start;
                    max-height: 760px;
                }

                .meta-campaign-detail-text {
                    overflow-wrap: anywhere;
                    word-break: break-word;
                    white-space: normal;
                }

                .meta-campaigns-table-empty {
                    min-width: 1040px;
                }

                .meta-campaign-drawer-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 70;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    background: rgba(15,23,42,0.42);
                    backdrop-filter: blur(4px);
                }

                .meta-campaign-drawer {
                    width: min(1220px, calc(100vw - 48px));
                    height: min(88vh, 920px);
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    box-shadow: 0 28px 70px rgba(15,23,42,0.34);
                    overflow: hidden;
                    display: grid;
                    grid-template-rows: auto 1fr;
                }

                .meta-campaign-drawer-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    padding: 16px 18px;
                    border-bottom: 1px solid var(--border);
                    background: rgba(255,255,255,0.035);
                }

                .meta-campaign-drawer-header strong {
                    color: var(--text-primary);
                    font-size: 0.92rem;
                }

                .meta-campaign-drawer-header button {
                    width: 34px;
                    height: 34px;
                    border-radius: 8px;
                    border: 1px solid var(--border);
                    background: rgba(255,255,255,0.04);
                    color: var(--text-secondary);
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                .meta-campaign-drawer-body {
                    min-height: 0;
                    overflow: hidden;
                }

                .meta-campaign-drawer-body .meta-campaign-detail-aside {
                    height: 100%;
                    max-height: none;
                    background: var(--bg-secondary);
                }

                @media (max-width: 760px) {
                    .meta-campaign-drawer-backdrop {
                        padding: 10px;
                    }

                    .meta-campaign-drawer {
                        width: calc(100vw - 20px);
                        height: calc(100vh - 20px);
                        border-radius: 12px;
                    }
                }

                @media (max-width: 1500px) {
                    .meta-campaigns-workspace {
                        grid-template-columns: minmax(0, 1fr);
                    }

                    .meta-campaign-table-pane {
                        border-right: 0;
                        border-bottom: 1px solid var(--border);
                    }

                    .meta-campaign-detail-aside {
                        max-height: 560px;
                    }
                }

                @media (max-width: 1280px) {
                    .meta-channel-strip,
                    .meta-compact-grid-two {
                        grid-template-columns: minmax(0, 1fr);
                    }

                    .meta-stepper {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                        row-gap: 8px;
                    }

                    .meta-stepper-line {
                        display: none;
                    }
                }

                @media (max-width: 1180px) {
                    .meta-create-grid {
                        grid-template-columns: minmax(0, 1fr);
                    }

                    .meta-create-main {
                        border-right: 0;
                        border-bottom: 1px solid var(--border);
                    }

                    .meta-create-preview-pane {
                        position: static;
                    }

                    .meta-phone-frame {
                        max-width: 360px;
                    }
                }

                @media (max-width: 900px) {
                    .meta-campaigns-table-empty {
                        min-width: 880px;
                    }

                    .meta-stepper {
                        grid-template-columns: minmax(0, 1fr);
                        padding: 12px 14px;
                    }

                    .meta-stepper-button {
                        padding-right: 0;
                    }

                    .meta-create-titlebar {
                        flex-direction: column;
                    }

                    .meta-create-main,
                    .meta-create-preview-pane {
                        padding: 14px;
                    }

                    .meta-create-actionbar {
                        bottom: 8px;
                    }

                    .meta-create-actions {
                        grid-template-columns: minmax(0, 1fr);
                    }
                }
            `}</style>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', margin: 0 }}>
                        <Send size={26} style={{ color: 'var(--gold)' }} /> Central de Campanhas WhatsApp
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                        Acompanhe, analise e gerencie os envios realizados pela API oficial da Meta.
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
                    <button onClick={() => {
                        setShowCreateForm(prev => {
                            const next = !prev
                            if (next) setMetaCreateStep('config')
                            return next
                        })
                    }}
                        style={{
                            padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: showCreateForm ? 'rgba(239,68,68,0.15)' : '#0866ff',
                            color: showCreateForm ? '#ef4444' : '#fff', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: '8px',
                            boxShadow: showCreateForm ? 'none' : '0 10px 22px rgba(8,102,255,0.22)',
                        }}>
                        {showCreateForm ? <><ChevronUp size={16} /> Ver historico</> : <><Plus size={16} /> Nova Campanha</>}
                    </button>
                </div>
            </div>

            <div className="meta-infra-bar">
                <span><CheckCircle2 size={15} /> Meta conectada</span>
                <span><Smartphone size={15} /> {readyMetaSenders.length} numeros ativos</span>
                <span><Activity size={15} /> {metaPortfolioUsage.sent}/{metaPortfolioUsage.limit || 'sem limite'} utilizadas</span>
                <span><Inbox size={15} /> {metaPortfolioUsage.remaining} disponiveis</span>
                <span><Users size={15} /> {isMetaPortfolioRouting ? 'Pool automatico' : selectedMetaSender ? metaSenderOptionLabel(selectedMetaSender) : 'Pool automatico'}</span>
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
                <section className="meta-create-shell">
                    <div className="meta-create-titlebar">
                        <div>
                            <h2>
                                <Plus size={18} style={{ color: 'var(--gold)' }} /> Nova Campanha
                            </h2>
                            <p>Monte o criativo, escolha o publico e revise a mensagem antes de lancar.</p>
                        </div>
                        <span className="meta-create-status-pill">
                            <CheckCircle2 size={15} /> WhatsApp Cloud API
                        </span>
                    </div>

                    <MetaCampaignStepper
                        steps={metaCreateSteps}
                        currentStep={metaCreateStep}
                        onStepChange={setMetaCreateStep}
                    />

                    <div className="meta-create-grid">
                    <div className="meta-create-main">
                        {/* Campaign Name */}
                        <div className={`meta-create-section ${metaCreateStep === 'config' ? '' : 'meta-step-hidden'}`}>
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

                        {sendProvider === 'meta_whatsapp' && metaCreateStep !== 'delivery' && metaCreateStep !== 'review' && (
                            <div className="meta-create-section meta-create-section-creative">
                                <div
                                    className={metaCreateStep === 'config' || metaCreateStep === 'message' ? '' : 'meta-step-hidden'}
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}
                                >
                                    <div>
                                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                            Template aprovado Meta
                                        </label>
                                        {metaTemplateOptions.length > 0 ? (
                                            <select
                                                value={selectedMetaTemplate ? metaTemplateNameLanguageValue(selectedMetaTemplate) : ''}
                                                onChange={e => {
                                                    const [name, language] = e.target.value.split('::')
                                                    setMetaTemplateWabaId('')
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
                                                {metaTemplateOptions.map(option => (
                                                    <option key={option.key} value={option.key}>
                                                        {option.name} ({option.language}) - {option.category} - {option.variants.length} conta(s)
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
                                <div className={`meta-compact-grid-two ${metaCreateStep === 'config' ? '' : 'meta-step-hidden'}`}>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                        Roteamento entre contas
                                    </label>
                                    <select
                                        value={metaSenderRoutingMode}
                                        onChange={e => setMetaSenderRoutingMode(e.target.value as typeof metaSenderRoutingMode)}
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                            color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                        }}
                                    >
                                        <option value="weighted_pool">Usar uma conta aprovada</option>
                                        <option value="round_robin" disabled={!portfolioRoutingAvailable}>
                                            Distribuir entre contas aprovadas ({portfolioRoutingReadyWabaIds.length} prontas)
                                        </option>
                                    </select>
                                    <div className={`meta-compact-note ${portfolioRoutingAvailable ? 'meta-compact-note-success' : ''}`}>
                                        {selectedMetaTemplate
                                            ? `Este template esta aprovado em ${selectedTemplateApprovedWabaIds.length} conta(s); ${portfolioRoutingReadyWabaIds.length} conta(s) tem numero pronto para roteamento. O limite continua compartilhado no portfolio.`
                                            : 'Escolha um template aprovado para ver em quais contas ele pode ser usado.'}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                        Numero oficial de envio
                                    </label>
                                    <select
                                        value={selectedMetaSenderId}
                                        onChange={e => setSelectedMetaSenderId(e.target.value)}
                                        disabled={isMetaPortfolioRouting}
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                            color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                            cursor: isMetaPortfolioRouting ? 'not-allowed' : 'pointer',
                                        }}
                                        >
                                        <option value="">
                                            {isMetaPortfolioRouting
                                                ? `Pool da BM/portfolio (${portfolioRoutingReadyWabaIds.length} contas prontas; ${metaPortfolioUsage.remaining} vagas livres)`
                                                : `Pool automatico por capacidade (${metaPortfolioUsage.remaining} vagas livres na BM/portfolio)`}
                                        </option>
                                        {activeMetaSenders.map(sender => {
                                            const wabaMismatch = Boolean(
                                                selectedTemplateApprovedWabaIds.length
                                                && !selectedTemplateApprovedWabaIds.includes(sender.waba_id)
                                            )
                                            return (
                                                <option key={sender.id} value={sender.id} disabled={!isMetaSenderAvailable(sender) || !hasMetaPortfolioCapacity || wabaMismatch}>
                                                    {wabaMismatch ? `${metaSenderOptionLabel(sender)} - criativo nao aprovado nesta conta` : metaSenderOptionLabel(sender)}
                                                </option>
                                            )
                                        })}
                                    </select>
                                    <div style={{ marginTop: '8px', color: hasMetaPortfolioCapacity ? '#16a34a' : '#ef4444', fontSize: '0.78rem', fontWeight: 700 }}>
                                        Uso/reserva compartilhada da BM/portfolio Meta: {metaPortfolioUsage.usageLabel}; vagas livres {metaPortfolioUsage.remaining}.
                                    </div>
                                    {selectedMetaSender && !isMetaSenderAvailable(selectedMetaSender) && (
                                        <div style={{ marginTop: '8px', color: '#ef4444', fontSize: '0.78rem', fontWeight: 700 }}>
                                            Este numero nao esta liberado para envio: {getMetaWhatsAppSenderHealth(selectedMetaSender).reason}
                                        </div>
                                    )}
                                    {!selectedMetaSenderId && readyMetaSenders.length > 0 && hasMetaPortfolioCapacity && (
                                        <div style={{ marginTop: '6px', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700 }}>
                                            {isMetaPortfolioRouting
                                                ? `Distribuicao ativa entre ${portfolioRoutingReadyWabaIds.length} contas aprovadas.`
                                                : 'Pool automatico usa um numero conectado aprovado.'}
                                        </div>
                                    )}
                                </div>
                                </div>
                                <details className={`meta-advanced-panel ${metaCreateStep === 'config' ? '' : 'meta-step-hidden'}`}>
                                    <summary>Configuracoes avancadas do envio</summary>
                                    <div className="meta-advanced-panel-body">
                                <label className="meta-compact-checkbox" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                                    <input
                                        type="checkbox"
                                        checked={metaAudiencePersonalized}
                                        onChange={e => setMetaAudiencePersonalized(e.target.checked)}
                                        style={{ marginTop: '3px' }}
                                    />
                                    Personalizar valores por contato usando linhas com telefone, nome e variaveis do template.
                                </label>
                                <label className="meta-compact-checkbox" style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '10px',
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    border: allowRepeatCreative ? '1px solid rgba(34,197,94,0.32)' : '1px solid rgba(245,158,11,0.45)',
                                    background: allowRepeatCreative ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.1)',
                                    color: allowRepeatCreative ? 'var(--text-secondary)' : '#f59e0b',
                                    fontSize: '0.82rem',
                                    lineHeight: 1.45,
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={allowRepeatCreative}
                                        onChange={e => setAllowRepeatCreative(e.target.checked)}
                                        style={{ marginTop: '3px' }}
                                    />
                                    Permitir reenvio e registrar historico quando o contato ja recebeu este criativo. Desmarque apenas se quiser bloquear repeticao.
                                </label>
                                    </div>
                                </details>
                                {metaCreateStep === 'message' && (selectedMetaTemplate ? (
                                    <div className="meta-template-config-grid">
                                        <div style={{ display: 'grid', gap: '12px' }}>
                                            <div className="meta-template-mini-card">
                                                <div style={{ minWidth: 0 }}>
                                                    <strong style={{ color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedMetaTemplate.name}</strong>
                                                    <span>{selectedMetaTemplate.category} | {selectedMetaTemplate.language} | {selectedTemplateButtons.length} botao(s)</span>
                                                </div>
                                                <span style={{ color: '#16a34a', fontWeight: 800 }}>{metaTemplateWabaLabel(selectedMetaTemplate)}</span>
                                            </div>

                                            {selectedHeaderComponent && (
                                                <details className="meta-advanced-panel" open={selectedHeaderUsesMedia && !selectedTemplateHeaderMediaUrl}>
                                                    <summary>Midia e header</summary>
                                                    <div className="meta-advanced-panel-body">
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
                                                                <div className="meta-compact-note meta-compact-note-success">
                                                                    Midia padrao carregada.
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
                                                </details>
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
                                                <details className="meta-advanced-panel">
                                                    <summary>Botoes do template ({selectedTemplateButtons.length})</summary>
                                                    <div className="meta-advanced-panel-body">
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
                                                </details>
                                            )}
                                        </div>

                                        <div className="meta-template-inline-preview" style={{ borderRadius: '18px', padding: '14px', background: 'linear-gradient(180deg, rgba(15,23,42,0.18), rgba(15,23,42,0.06))', border: '1px solid var(--border)' }}>
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
                                ))}
                                <label className={metaCreateStep === 'audience' ? '' : 'meta-step-hidden'} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.45 }}>
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

                        {sendProvider === 'meta_whatsapp' && metaCreateStep === 'audience' && (
                            <div className="meta-create-section">
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Users size={17} style={{ color: 'var(--gold)' }} /> Publico
                                        </h3>
                                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                                            Escolha uma lista salva ou use uma entrada manual.
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

                                    <details className="meta-advanced-panel">
                                        <summary>Importar nova lista</summary>
                                        <div className="meta-advanced-panel-body meta-compact-grid-two">
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
                                    </details>
                                </div>

                                {selectedContactList && (
                                    <details className="meta-advanced-panel">
                                        <summary>Segmentar e validar lista ({selectedContactListEligibleContacts.length} elegiveis)</summary>
                                        <div className="meta-advanced-panel-body">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                            <div>
                                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Segmentar lista</strong>
                                                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.4 }}>
                                                    Filtre a lista por cidade, tag ou busca antes de enviar. O campo de numeros e atualizado automaticamente.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void validateSelectedContactListWhatsApp()}
                                                disabled={Boolean(validatingContactListId) || selectedContactListValidationStatus === 'queued' || selectedContactListValidationStatus === 'running'}
                                                style={{
                                                    padding: '7px 10px',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--gold)',
                                                    background: 'rgba(201,169,110,0.12)',
                                                    color: 'var(--gold)',
                                                    cursor: validatingContactListId || selectedContactListValidationStatus === 'queued' || selectedContactListValidationStatus === 'running' ? 'not-allowed' : 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '0.76rem',
                                                    fontWeight: 800,
                                                }}
                                                title="Verificar pela ConnectyHub quais contatos possuem WhatsApp."
                                            >
                                                {validatingContactListId === selectedContactListId || selectedContactListValidationStatus === 'queued' || selectedContactListValidationStatus === 'running'
                                                    ? <Loader2 size={13} className="spin" />
                                                    : <CheckCircle2 size={13} />}
                                                {selectedContactListValidationStatus === 'completed' ? 'Revalidar WhatsApp' : 'Validar WhatsApp'}
                                            </button>
                                            <span style={{
                                                padding: '6px 10px',
                                                borderRadius: '999px',
                                                background: 'rgba(255,255,255,0.08)',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.76rem',
                                                fontWeight: 700,
                                            }}>
                                                {selectedContactListEligibleContacts.length} elegiveis de {contactListAudienceCounts.all || selectedContactList.valid_contacts}
                                            </span>
                                        </div>

                                        {selectedContactListValidationStats.total > 0 && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                                                <span style={{ color: '#22c55e', fontWeight: 700 }}>
                                                    {selectedContactListValidationStats.valid} com WhatsApp
                                                </span>
                                                <span style={{ color: selectedContactListValidationStats.invalid ? '#ef4444' : 'var(--text-muted)', fontWeight: 700 }}>
                                                    {selectedContactListValidationStats.invalid} sem WhatsApp
                                                </span>
                                                <span>{selectedContactListValidationStats.unknown + selectedContactListValidationStats.error} para revisar</span>
                                                <span>{selectedContactListValidationStats.remaining || selectedContactListValidationStats.unchecked} pendente(s)</span>
                                                {selectedContactListValidationStatus && <span>Status: {selectedContactListValidationStatus}</span>}
                                            </div>
                                        )}

                                        <div style={{
                                            display: 'grid',
                                            gap: '8px',
                                            padding: '10px',
                                            borderRadius: '10px',
                                            border: selectedContactListWillIncludeUnverified ? '1px solid rgba(245,158,11,0.35)' : '1px solid var(--border)',
                                            background: selectedContactListWillIncludeUnverified ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                                        }}>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>Regra de envio Meta</strong>
                                                <div style={{ display: 'inline-flex', gap: '4px', padding: '3px', borderRadius: '9px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.12)' }}>
                                                    {([
                                                        ['confirmed_only', 'Somente confirmados'],
                                                        ['include_unverified', 'Incluir pendentes'],
                                                    ] as Array<[ContactListValidationMode, string]>).map(([mode, label]) => (
                                                        <button
                                                            key={mode}
                                                            type="button"
                                                            onClick={() => setContactListValidationMode(mode)}
                                                            style={{
                                                                border: 'none',
                                                                borderRadius: '7px',
                                                                padding: '7px 9px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.74rem',
                                                                fontWeight: 800,
                                                                background: contactListValidationMode === mode ? 'var(--gold)' : 'transparent',
                                                                color: contactListValidationMode === mode ? '#111827' : 'var(--text-secondary)',
                                                            }}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                                                <span style={{ color: '#22c55e', fontWeight: 700 }}>{selectedContactListConfirmedContacts.length} confirmados</span>
                                                <span style={{ color: selectedContactListUnverifiedContacts.length ? '#f59e0b' : 'var(--text-muted)', fontWeight: 700 }}>{selectedContactListUnverifiedContacts.length} pendentes/erro</span>
                                                <span style={{ color: selectedContactListInvalidContacts.length ? '#ef4444' : 'var(--text-muted)', fontWeight: 700 }}>{selectedContactListInvalidContacts.length} sem WhatsApp bloqueados</span>
                                            </div>
                                            {selectedContactListHasPendingValidation && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', color: selectedContactListWillIncludeUnverified ? '#f59e0b' : 'var(--text-muted)', fontSize: '0.74rem', lineHeight: 1.4 }}>
                                                    <AlertCircle size={14} style={{ flex: '0 0 auto', marginTop: '1px' }} />
                                                    <span>
                                                        {selectedContactListWillIncludeUnverified
                                                            ? 'Esta campanha vai incluir numeros ainda nao verificados. O sistema vai pedir confirmacao final ao lancar.'
                                                            : 'A lista ainda nao esta 100% validada. Neste modo, apenas numeros confirmados entram no envio.'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{
                                            display: 'grid',
                                            gap: '9px',
                                            padding: '10px',
                                            borderRadius: '10px',
                                            border: selectedTemplateWasUsedForList ? '1px solid rgba(245,158,11,0.42)' : '1px solid var(--border)',
                                            background: selectedTemplateWasUsedForList ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                                        }}>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>Historico lista x criativo</strong>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem', fontWeight: 700 }}>
                                                    {selectedContactListUsage.total_campaigns} campanha(s) com esta lista
                                                </span>
                                            </div>
                                            {selectedContactListUsage.total_campaigns > 0 ? (
                                                <>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                                                        <span>{selectedContactListUsage.total_recipients} destinatario(s) historicos</span>
                                                        <span>Ultima: {selectedContactListUsage.last_campaign_name || 'sem nome'}</span>
                                                        <span>{formatMetaDate(selectedContactListUsage.last_used_at)}</span>
                                                    </div>
                                                    {selectedTemplateWasUsedForList && selectedTemplateUsage ? (
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', color: '#f59e0b', fontSize: '0.74rem', lineHeight: 1.4 }}>
                                                            <AlertCircle size={14} style={{ flex: '0 0 auto', marginTop: '1px' }} />
                                                            <span>
                                                                Este template ja foi usado nesta lista em {selectedTemplateUsage.campaigns} campanha(s).
                                                                Ao lancar, o sistema vai registrar esse historico nos contatos e continuar o envio, salvo se a repeticao estiver bloqueada acima.
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', lineHeight: 1.4 }}>
                                                            {metaTemplateName.trim()
                                                                ? 'Este template ainda nao aparece no historico desta lista.'
                                                                : 'Escolha um template aprovado para checar repeticao nesta lista.'}
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'grid', gap: '6px' }}>
                                                        {selectedContactListUsage.templates.slice(0, 4).map(template => (
                                                            <div
                                                                key={templateUsageKey(template.template_name, template.template_language)}
                                                                style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                                                                    gap: '8px',
                                                                    alignItems: 'center',
                                                                    fontSize: '0.72rem',
                                                                    color: 'var(--text-muted)',
                                                                    padding: '6px 8px',
                                                                    borderRadius: '8px',
                                                                    background: 'rgba(255,255,255,0.04)',
                                                                }}
                                                            >
                                                                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {template.template_name} ({template.template_language}) - {template.last_campaign_name || 'sem nome'}
                                                                </span>
                                                                <strong style={{ color: templateUsageKey(template.template_name, template.template_language) === templateUsageKey(metaTemplateName, metaTemplateLanguage) ? '#f59e0b' : 'var(--text-secondary)' }}>
                                                                    {template.campaigns} uso(s)
                                                                </strong>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', lineHeight: 1.4 }}>
                                                    Esta lista ainda nao tem campanha Meta registrada no painel.
                                                </div>
                                            )}
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
                                                {asFiniteNumber(contactListSegments.stats.whatsapp_checked) > 0 && (
                                                    <>
                                                        <span style={{ color: '#22c55e' }}>{contactListSegments.stats.whatsapp_valid || 0} WhatsApp ok</span>
                                                        <span style={{ color: asFiniteNumber(contactListSegments.stats.whatsapp_invalid) ? '#ef4444' : 'var(--text-muted)' }}>{contactListSegments.stats.whatsapp_invalid || 0} sem WhatsApp</span>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        </div>
                                    </details>
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
                                        {' '}carregada com {selectedContactListEligibleContacts.length} contato(s) elegivel(is).
                                        {contactListAudienceCounts.all && contactListAudienceCounts.all !== selectedContactListContacts.length ? ` Total da lista: ${contactListAudienceCounts.all}.` : ''}
                                        {selectedContactList.source_file_name ? ` Origem: ${selectedContactList.source_file_name}.` : ''}
                                        {selectedContactListValidationStats.checked > 0 ? (
                                            <> WhatsApp: {selectedContactListValidationStats.valid} confirmado(s), {selectedContactListValidationStats.invalid} sem WhatsApp ignorado(s).</>
                                        ) : null}
                                        {selectedContactListWillIncludeUnverified ? (
                                            <> Incluindo {selectedContactListUnverifiedContacts.length} pendente(s)/erro por decisao manual.</>
                                        ) : selectedContactListHasPendingValidation ? (
                                            <> Pendente(s)/erro fora do envio neste modo: {selectedContactListUnverifiedContacts.length}.</>
                                        ) : null}
                                        {selectedContactList.duplicate_contacts || selectedContactList.invalid_contacts ? (
                                            <> Ignorados: {selectedContactList.duplicate_contacts} duplicado(s), {selectedContactList.invalid_contacts} invalido(s).</>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Numbers */}
                        <details className={`meta-advanced-panel ${sendProvider === 'meta_whatsapp' && metaCreateStep !== 'audience' ? 'meta-step-hidden' : ''}`} open={sendProvider === 'connectyhub' ? true : undefined}>
                            <summary>Colar ou importar numeros manualmente</summary>
                            <div className="meta-advanced-panel-body">
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
                        </details>

                        {/* Delay & Schedule */}
                        <div className={`meta-create-section ${metaCreateStep === 'delivery' ? '' : 'meta-step-hidden'}`} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
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

                        {metaCreateStep === 'review' && (
                            <div className="meta-create-section">
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CheckCircle2 size={17} style={{ color: 'var(--gold)' }} /> Revisao da campanha
                                        </h3>
                                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                                            Confira os pontos principais antes de enviar pela API oficial.
                                        </p>
                                    </div>
                                    <span className="meta-create-status-pill">
                                        {metaCreateWarnings.length === 0 ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                                        {metaCreateWarnings.length === 0 ? 'Pronta para envio' : `${metaCreateWarnings.length} ajuste(s)`}
                                    </span>
                                </div>

                                <div className="meta-review-grid">
                                    <div className="meta-review-card">
                                        <div className="meta-review-card-header">
                                            <h3>Configuracao</h3>
                                            <button type="button" onClick={() => setMetaCreateStep('config')}>Editar</button>
                                        </div>
                                        <div className="meta-review-row"><span>Nome</span><strong>{campaignName.trim() || 'Sem nome'}</strong></div>
                                        <div className="meta-review-row"><span>Tipo</span><strong>{metaCampaignTypeLabel}</strong></div>
                                        <div className="meta-review-row"><span>Idioma</span><strong>{metaTemplateLanguage || 'pt_BR'}</strong></div>
                                    </div>

                                    <div className="meta-review-card">
                                        <div className="meta-review-card-header">
                                            <h3>Mensagem</h3>
                                            <button type="button" onClick={() => setMetaCreateStep('message')}>Editar</button>
                                        </div>
                                        <div className="meta-review-row"><span>Template</span><strong>{selectedMetaTemplate?.name || 'Nao selecionado'}</strong></div>
                                        <div className="meta-review-row"><span>Categoria</span><strong>{selectedMetaTemplate?.category || 'Nao definida'}</strong></div>
                                        <div className="meta-review-row"><span>Variaveis</span><strong>{selectedBodyVariables.length ? `${selectedBodyVariables.length} no corpo` : 'Sem variaveis'}</strong></div>
                                    </div>

                                    <div className="meta-review-card">
                                        <div className="meta-review-card-header">
                                            <h3>Publico</h3>
                                            <button type="button" onClick={() => setMetaCreateStep('audience')}>Editar</button>
                                        </div>
                                        <div className="meta-review-row"><span>Lista</span><strong>{selectedContactList?.name || 'Entrada manual'}</strong></div>
                                        <div className="meta-review-row"><span>Contatos</span><strong>{metaCampaignAudienceLabel}</strong></div>
                                        <div className="meta-review-row"><span>Opt-in</span><strong>{confirmOptIn ? 'Confirmado' : 'Pendente'}</strong></div>
                                    </div>

                                    <div className="meta-review-card">
                                        <div className="meta-review-card-header">
                                            <h3>Entrega</h3>
                                            <button type="button" onClick={() => setMetaCreateStep('delivery')}>Editar</button>
                                        </div>
                                        <div className="meta-review-row"><span>Envio</span><strong>{metaRoutingPreviewLabel}</strong></div>
                                        <div className="meta-review-row"><span>Agenda</span><strong>{metaScheduleLabel}</strong></div>
                                        <div className="meta-review-row"><span>Limite</span><strong>{metaPortfolioUsage.usageLabel}; {metaPortfolioUsage.remaining} livres</strong></div>
                                    </div>
                                </div>

                                <div className="meta-review-card">
                                    <div className="meta-review-card-header">
                                        <h3>Prontidao</h3>
                                        <span style={{ color: metaCreateWarnings.length ? '#d97706' : '#16a34a', fontSize: '0.74rem', fontWeight: 800 }}>
                                            {metaCreateWarnings.length ? 'Ajustes necessarios' : 'Tudo certo'}
                                        </span>
                                    </div>
                                    <ul className="meta-readiness-list">
                                        {metaCreateWarnings.length ? (
                                            metaCreateWarnings.map(warning => (
                                                <li key={warning} style={{ color: '#d97706' }}>
                                                    <AlertCircle size={14} /> {warning}
                                                </li>
                                            ))
                                        ) : (
                                            <>
                                                <li><CheckCircle2 size={14} style={{ color: '#16a34a' }} /> Template aprovado e pronto para envio.</li>
                                                <li><CheckCircle2 size={14} style={{ color: '#16a34a' }} /> Publico carregado com opt-in confirmado.</li>
                                                <li><CheckCircle2 size={14} style={{ color: '#16a34a' }} /> Limite compartilhado da BM/portfolio disponivel.</li>
                                            </>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Send Button */}
                        <div className="meta-create-actionbar">
                            <div className="meta-create-action-summary">
                                <span>{metaCampaignAudienceLabel}</span>
                                <span>{metaRoutingPreviewLabel}</span>
                                <span>{metaPortfolioUsage.usageLabel}; {metaPortfolioUsage.remaining} vagas livres na BM</span>
                                {selectedMetaTemplate && <span>{selectedTemplateApprovedWabaIds.length} conta(s) com criativo aprovado</span>}
                            </div>
                            <div className="meta-create-actions">
                                <button
                                    type="button"
                                    onClick={goToPreviousMetaStep}
                                    disabled={!metaPreviousStep || sending}
                                    className="meta-create-secondary-button"
                                >
                                    Voltar
                                </button>
                                <button
                                    type="button"
                                    onClick={metaCreateStep === 'review' ? sendCampaign : goToNextMetaStep}
                                    disabled={metaCreateStep === 'review' ? metaFinalSendDisabled : sending}
                                    className="meta-create-launch-button"
                                >
                                    {sending ? <Loader2 size={18} className="spin" /> : metaCreateStep === 'review' ? <Send size={18} /> : <ChevronRight size={18} />}
                                    {sending ? 'Lancando...' : metaPrimaryActionLabel}
                                </button>
                            </div>
                        </div>
                    </div>
                    <MetaCampaignPhonePreview
                        template={selectedMetaTemplate}
                        campaignName={campaignName}
                        headerComponent={selectedHeaderComponent}
                        headerFormat={selectedHeaderFormat}
                        headerText={previewHeaderText}
                        bodyText={previewBodyText}
                        footerText={selectedFooterText}
                        mediaUrl={metaHeaderMediaUrl}
                        buttons={selectedTemplateButtons}
                        audienceLabel={metaCampaignAudienceLabel}
                        routingLabel={metaRoutingPreviewLabel}
                        approvedAccounts={selectedTemplateApprovedWabaIds.length}
                        readyAccounts={portfolioRoutingReadyWabaIds.length}
                        portfolioUsageLabel={metaPortfolioUsage.usageLabel}
                        portfolioRemaining={metaPortfolioUsage.remaining}
                        warnings={metaCreateWarnings}
                    />
                    </div>
                </section>
            )}

            {/* Campaigns List */}
            {!showCreateForm && (sendProvider === 'connectyhub' ? (
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
                    dailyReport={metaDailyReport}
                    dailyReportDate={metaDailyReportDate}
                    dailyReportLoading={loadingMetaDailyReport}
                    detailedReport={metaDetailedReport}
                    detailedReportFilters={metaDetailedReportFilters}
                    detailedReportLoading={loadingMetaDetailedReport}
                    replyReport={metaReplyReport}
                    replyReportLoading={loadingMetaReplyReport}
                    replyIntentFilter={metaReplyIntentFilter}
                    replyDateFilter={metaReplyDateFilter}
                    loading={loadingMetaCampaigns}
                    statusFilter={metaStatusFilter}
                    expandedCampaignId={expandedMetaCampaignId}
                    loadingDetailCampaignId={loadingMetaCampaignDetail}
                    campaignDetails={metaCampaignDetails}
                    onStatusFilterChange={setMetaStatusFilter}
                    onDailyReportDateChange={setMetaDailyReportDate}
                    onDailyReportRefresh={() => loadMetaDailyReport()}
                    onDailyReportExport={exportMetaDailyReportCsv}
                    onDetailedReportFiltersChange={setMetaDetailedReportFilters}
                    onDetailedReportRefresh={() => loadMetaDetailedReport()}
                    onDetailedReportExport={exportMetaDetailedReportCsv}
                    onReplyIntentFilterChange={setMetaReplyIntentFilter}
                    onReplyDateFilterChange={setMetaReplyDateFilter}
                    onRefresh={refreshMetaWorkspace}
                    onReplyRefresh={loadMetaReplyReport}
                    onReplyExport={exportMetaRepliesCsv}
                    onToggleDetail={toggleMetaCampaignDetail}
                    onManage={manageMetaCampaign}
                    retryingCampaignId={retryingMetaCampaignId}
                    onRetryFailed={retryFailedMetaCampaign}
                />
            ))}

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

function metaCampaignDateMs(value?: string | null) {
    if (!value) return 0
    const date = new Date(value)
    const time = date.getTime()
    return Number.isFinite(time) ? time : 0
}

function metaCampaignDeliveryRate(campaign: MetaCampaign) {
    return metricRate(Number(campaign.total_delivered || 0), Number(campaign.total_sent || campaign.total_recipients || 0))
}

function metaCampaignReadRate(campaign: MetaCampaign) {
    return metricRate(Number(campaign.total_read || 0), Number(campaign.total_delivered || campaign.total_sent || campaign.total_recipients || 0))
}

function metaCampaignFailureRate(campaign: MetaCampaign) {
    return metricRate(Number(campaign.total_failed || 0), Number(campaign.total_recipients || 0))
}

function metaCampaignMatchesSignal(campaign: MetaCampaign, filter: MetaCampaignSignalFilter) {
    if (filter === 'in_progress') return ['queued', 'sending', 'preparing'].includes(campaign.status)
    if (filter === 'with_failures') return Number(campaign.total_failed || 0) > 0
    if (filter === 'high_failure') return metaCampaignFailureRate(campaign) >= 30
    if (filter === 'with_reads') return Number(campaign.total_read || 0) > 0
    if (filter === 'without_failures') return Number(campaign.total_failed || 0) === 0
    return true
}

function sortMetaCampaigns(campaigns: MetaCampaign[], sortKey: MetaCampaignSortKey) {
    return [...campaigns].sort((a, b) => {
        if (sortKey === 'created_asc') return metaCampaignDateMs(a.created_at) - metaCampaignDateMs(b.created_at)
        if (sortKey === 'name_asc') return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
        if (sortKey === 'recipients_desc') return Number(b.total_recipients || 0) - Number(a.total_recipients || 0)
        if (sortKey === 'failed_desc') return Number(b.total_failed || 0) - Number(a.total_failed || 0)
        if (sortKey === 'delivery_desc') return metaCampaignDeliveryRate(b) - metaCampaignDeliveryRate(a)
        if (sortKey === 'read_desc') return metaCampaignReadRate(b) - metaCampaignReadRate(a)
        return metaCampaignDateMs(b.created_at) - metaCampaignDateMs(a.created_at)
    })
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
type MetaCampaignWorkspaceTab = 'overview' | 'campaigns' | 'reports' | 'replies' | 'diagnostics'
type MetaCampaignSortKey = 'created_desc' | 'created_asc' | 'name_asc' | 'recipients_desc' | 'failed_desc' | 'delivery_desc' | 'read_desc'
type MetaCampaignSignalFilter = 'all' | 'in_progress' | 'with_failures' | 'high_failure' | 'with_reads' | 'without_failures'
const META_CAMPAIGN_PAGE_SIZE_OPTIONS = [20, 50, 100]

function MetaDailyReportPanel({
    report,
    date,
    loading,
    onDateChange,
    onRefresh,
    onExport,
}: {
    report: MetaDailyReport | null
    date: string
    loading: boolean
    onDateChange: (value: string) => void
    onRefresh: () => void
    onExport: () => void
}) {
    const totals = report?.totals
    const costCurrency = totals?.cost_currency || 'BRL'
    const items = [
        { label: 'Disparos do dia', value: totals?.dispatched || 0, detail: 'Aceitos pela Meta', icon: Send, color: '#38bdf8' },
        { label: 'Respostas totais', value: totals?.replies || 0, detail: percentLabel(totals?.response_rate || 0), icon: MessageSquare, color: '#f59e0b' },
        { label: 'Respostas positivas', value: totals?.positive_replies || 0, detail: percentLabel(totals?.positive_response_rate || 0), icon: CheckCircle2, color: '#22c55e' },
        { label: 'Custo do dia', value: formatCurrencyBRL(totals?.cost_amount || 0, costCurrency), detail: costCurrency, icon: DollarSign, color: 'var(--gold)' },
    ]

    return (
        <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'grid',
            gap: '12px',
            background: 'rgba(176,138,67,0.035)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Calendar size={15} style={{ color: 'var(--gold)' }} /> Relatorio diario Meta
                    </strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.4 }}>
                        Recorte pelo fuso America/Sao_Paulo. Disparos sao mensagens aceitas pela Meta no dia selecionado.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="date"
                        value={date}
                        onChange={event => onDateChange(event.target.value)}
                        style={{
                            minHeight: '36px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.06)',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                        }}
                    />
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        style={{
                            minHeight: '36px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--text-secondary)',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                        }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar
                    </button>
                    <button
                        type="button"
                        onClick={onExport}
                        disabled={!report || loading}
                        style={{
                            minHeight: '36px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(176,138,67,0.42)',
                            background: 'rgba(176,138,67,0.13)',
                            color: 'var(--gold)',
                            cursor: !report || loading ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 900,
                            fontSize: '0.78rem',
                        }}
                    >
                        <Download size={14} /> Exportar CSV
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '10px' }}>
                {items.map(item => {
                    const Icon = item.icon
                    return (
                        <div key={item.label} style={{
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            padding: '11px',
                            background: 'rgba(255,255,255,0.04)',
                            display: 'grid',
                            gap: '6px',
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                <Icon size={14} style={{ color: item.color }} /> {item.label}
                            </span>
                            <strong style={{ color: item.color, fontSize: '1rem' }}>
                                {typeof item.value === 'number' ? item.value.toLocaleString('pt-BR') : item.value}
                            </strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{item.detail}</span>
                        </div>
                    )
                })}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                <span>Entregues: <strong style={{ color: '#22c55e' }}>{Number(totals?.delivered || 0).toLocaleString('pt-BR')}</strong></span>
                <span>Lidas: <strong style={{ color: '#0ea5e9' }}>{Number(totals?.read || 0).toLocaleString('pt-BR')}</strong></span>
                <span>Falhas: <strong style={{ color: '#ef4444' }}>{Number(totals?.failed || 0).toLocaleString('pt-BR')}</strong></span>
                <span>Saidas: <strong style={{ color: '#ef4444' }}>{Number(totals?.opt_out_replies || 0).toLocaleString('pt-BR')}</strong></span>
                <span>Perguntas: <strong style={{ color: '#f59e0b' }}>{Number(totals?.question_replies || 0).toLocaleString('pt-BR')}</strong></span>
            </div>

            {(report?.campaigns?.length || 0) > 0 && (
                <div style={{ display: 'grid', gap: '6px' }}>
                    {report?.campaigns.slice(0, 6).map(campaign => (
                        <div
                            key={campaign.campaign_id || `${campaign.campaign_name}-${campaign.template_name}`}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 1.3fr) repeat(4, minmax(70px, auto))',
                                gap: '8px',
                                alignItems: 'center',
                                padding: '7px 9px',
                                borderRadius: '8px',
                                background: 'rgba(255,255,255,0.035)',
                                color: 'var(--text-muted)',
                                fontSize: '0.72rem',
                                overflowX: 'auto',
                            }}
                        >
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontWeight: 800 }}>
                                {campaign.campaign_name} | {campaign.template_name}
                            </span>
                            <span>{campaign.dispatched} disp.</span>
                            <span>{campaign.replies} resp.</span>
                            <span style={{ color: '#22c55e' }}>{campaign.positive_replies} pos.</span>
                            <span>{formatCurrencyBRL(campaign.cost_amount || 0, costCurrency)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function MetaDetailedGroupList({
    title,
    groups,
    metricLabel = 'dest.',
}: {
    title: string
    groups: MetaDetailedReportGroup[]
    metricLabel?: string
}) {
    const visibleGroups = groups.slice(0, 5)
    return (
        <div style={{
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '10px',
            display: 'grid',
            gap: '8px',
            background: 'rgba(255,255,255,0.025)',
            minWidth: 0,
        }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.78rem' }}>{title}</strong>
            {visibleGroups.length === 0 ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Sem dados no filtro.</span>
            ) : (
                visibleGroups.map(group => (
                    <div key={group.key} style={{ display: 'grid', gap: '5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {group.label}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                                {Number(group.recipients || 0).toLocaleString('pt-BR')} {metricLabel}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '7px', color: 'var(--text-muted)', fontSize: '0.67rem', flexWrap: 'wrap' }}>
                            <span>Entrega <strong style={{ color: '#22c55e' }}>{percentLabel(group.delivery_rate || 0)}</strong></span>
                            <span>Leitura <strong style={{ color: '#0ea5e9' }}>{percentLabel(group.read_rate || 0)}</strong></span>
                            <span>Resp. <strong style={{ color: '#f59e0b' }}>{percentLabel(group.reply_rate || 0)}</strong></span>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

function MetaDetailedReportPanel({
    report,
    filters,
    campaigns,
    senders,
    loading,
    onFiltersChange,
    onRefresh,
    onExport,
}: {
    report: MetaDetailedReport | null
    filters: MetaDetailedReportFilters
    campaigns: MetaCampaign[]
    senders: MetaSender[]
    loading: boolean
    onFiltersChange: (filters: MetaDetailedReportFilters) => void
    onRefresh: () => void
    onExport: () => void
}) {
    const summary = report?.summary
    const rows = report?.rows || []
    const templateOptionEntries: Array<[string, { name: string; language: string }]> = campaigns
        .map(campaign => [templateUsageKey(campaign.template_name, campaign.template_language), {
            name: campaign.template_name || '',
            language: campaign.template_language || '',
        }] as [string, { name: string; language: string }])
        .filter(([, template]) => Boolean(template.name))
    const templateOptions = Array.from(new Map(templateOptionEntries).values())
        .sort((a, b) => a.name.localeCompare(b.name))
    const wabaOptionEntries: Array<[string, { id: string; label: string }]> = senders
        .map(sender => [sender.waba_id, {
            id: sender.waba_id,
            label: sender.display_name || sender.phone_number || sender.waba_id,
        }] as [string, { id: string; label: string }])
        .filter(([id]) => Boolean(id))
    const wabaOptions = Array.from(new Map(wabaOptionEntries).values())
    const metricItems = [
        { label: 'Destinatarios', value: summary?.recipients || 0, detail: 'linhas encontradas', icon: Users, color: 'var(--gold)' },
        { label: 'Aceitas', value: summary?.sent || 0, detail: percentLabel(summary?.delivery_rate || 0), icon: CheckCircle2, color: '#22c55e' },
        { label: 'Entregues', value: summary?.delivered || 0, detail: 'confirmadas', icon: Inbox, color: '#16a34a' },
        { label: 'Lidas', value: summary?.read || 0, detail: percentLabel(summary?.read_rate || 0), icon: Eye, color: '#0ea5e9' },
        { label: 'Respostas', value: summary?.replies || 0, detail: percentLabel(summary?.reply_rate || 0), icon: MessageSquare, color: '#f59e0b' },
        { label: 'Falhas', value: summary?.failed || 0, detail: 'erros Meta', icon: AlertCircle, color: '#ef4444' },
    ]
    const updateFilter = (key: keyof MetaDetailedReportFilters, value: string) => {
        onFiltersChange({ ...filters, [key]: value })
    }
    const clearFilters = () => {
        onFiltersChange({
            dateFrom: saoPauloDateInputDaysAgo(7),
            dateTo: saoPauloDateInputDaysAgo(0),
            templateName: '',
            campaignId: '',
            senderId: '',
            wabaId: '',
            status: '',
            intent: '',
            search: '',
            limit: filters.limit || '1000',
        })
    }
    const [reportView, setReportView] = useState<'all' | 'templates' | 'campaigns' | 'numbers' | 'failures' | 'replies'>('all')
    const [selectedRecipientId, setSelectedRecipientId] = useState('')
    const rowsForView = rows.filter(row => {
        if (reportView === 'failures') return row.status === 'failed' || Boolean(row.error_code || row.error_message)
        if (reportView === 'replies') return Boolean(row.reply_intent || row.reply_text || row.reply_button)
        return true
    })
    const selectedRow = rowsForView.find(row => row.recipient_id === selectedRecipientId) || rowsForView[0] || null
    const visibleRows = rowsForView.slice(0, 80)
    const reportViewItems = [
        { key: 'all', label: 'Todas as linhas', count: rows.length, icon: FileText },
        { key: 'templates', label: 'Criativos', count: summary?.by_template?.length || 0, icon: Image },
        { key: 'campaigns', label: 'Campanhas', count: summary?.by_campaign?.length || 0, icon: Send },
        { key: 'numbers', label: 'Numeros', count: summary?.by_sender?.length || 0, icon: Smartphone },
        { key: 'failures', label: 'Falhas', count: summary?.failed || 0, icon: AlertCircle },
        { key: 'replies', label: 'Respostas', count: summary?.replies || 0, icon: MessageSquare },
    ] as const
    const activeGroups = reportView === 'campaigns'
        ? summary?.by_campaign || []
        : reportView === 'numbers'
            ? summary?.by_sender || []
            : reportView === 'all' || reportView === 'templates'
                ? summary?.by_template || []
                : []
    const activeGroupTitle = reportView === 'campaigns'
        ? 'Campanhas no filtro'
        : reportView === 'numbers'
            ? 'Numeros no filtro'
            : 'Criativos no filtro'
    const applyGroupFilter = (group: MetaDetailedReportGroup) => {
        if (reportView === 'campaigns') updateFilter('campaignId', group.key)
        if (reportView === 'numbers') updateFilter('senderId', group.key)
        if (reportView === 'templates' || reportView === 'all') updateFilter('templateName', group.label)
    }

    return (
        <div id="relatorios-meta-whatsapp" style={{
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
                        <Download size={16} style={{ color: 'var(--gold)' }} />
                        Relatorio detalhado
                    </strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                        Filtre por criativo, periodo, campanha, conta, numero, status, resposta ou busca livre.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={clearFilters}
                        style={{
                            minHeight: '36px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--text-secondary)',
                            padding: '0 10px',
                            cursor: 'pointer',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                        }}
                    >
                        Limpar
                    </button>
                    <button
                        type="button"
                        onClick={onExport}
                        disabled={!rows.length || loading}
                        style={{
                            minHeight: '36px',
                            borderRadius: '8px',
                            border: '1px solid rgba(176,138,67,0.42)',
                            background: 'rgba(176,138,67,0.13)',
                            color: 'var(--gold)',
                            padding: '0 10px',
                            cursor: !rows.length || loading ? 'not-allowed' : 'pointer',
                            fontSize: '0.74rem',
                            fontWeight: 900,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <Download size={14} /> Baixar CSV
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
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Buscar
                    </button>
                </div>
            </div>

            <div style={{
                display: 'flex',
                gap: '6px',
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                overflowX: 'auto',
            }}>
                {reportViewItems.map(item => {
                    const Icon = item.icon
                    const active = reportView === item.key
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setReportView(item.key)}
                            style={{
                                minHeight: '36px',
                                borderRadius: '8px',
                                border: `1px solid ${active ? 'rgba(176,138,67,0.42)' : 'var(--border)'}`,
                                background: active ? 'rgba(176,138,67,0.14)' : 'rgba(255,255,255,0.035)',
                                color: active ? 'var(--gold)' : 'var(--text-secondary)',
                                padding: '0 11px',
                                cursor: 'pointer',
                                fontSize: '0.74rem',
                                fontWeight: 900,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '7px',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <Icon size={14} />
                            {item.label}
                            <span style={{
                                minWidth: '20px',
                                height: '20px',
                                borderRadius: '999px',
                                background: active ? 'rgba(176,138,67,0.18)' : 'rgba(148,163,184,0.14)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 6px',
                                color: active ? 'var(--gold)' : 'var(--text-muted)',
                                fontSize: '0.66rem',
                            }}>
                                {Number(item.count || 0).toLocaleString('pt-BR')}
                            </span>
                        </button>
                    )
                })}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '300px minmax(560px, 1fr) 330px',
                minHeight: '620px',
            }}>
                <aside style={{ borderRight: '1px solid var(--border)', minWidth: 0, display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                    <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'grid', gap: '8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={event => updateFilter('dateFrom', event.target.value)}
                                title="Data inicial"
                                style={{ minHeight: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 9px', fontSize: '0.76rem' }}
                            />
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={event => updateFilter('dateTo', event.target.value)}
                                title="Data final"
                                style={{ minHeight: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 9px', fontSize: '0.76rem' }}
                            />
                        </div>
                        <label style={{ minHeight: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', padding: '0 9px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Search size={14} />
                            <input
                                value={filters.search}
                                onChange={event => updateFilter('search', event.target.value)}
                                placeholder="Buscar telefone, nome ou erro"
                                style={{ border: 0, outline: 'none', background: 'transparent', color: 'var(--text-primary)', width: '100%', fontSize: '0.76rem' }}
                            />
                        </label>
                        <select value={filters.templateName} onChange={event => updateFilter('templateName', event.target.value)} style={{ minHeight: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 9px', fontSize: '0.76rem' }}>
                            <option value="">Todos os criativos</option>
                            {templateOptions.map(template => (
                                <option key={`${template.name}-${template.language}`} value={template.name}>
                                    {template.name}{template.language ? ` (${template.language})` : ''}
                                </option>
                            ))}
                        </select>
                        <select value={filters.campaignId} onChange={event => updateFilter('campaignId', event.target.value)} style={{ minHeight: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 9px', fontSize: '0.76rem' }}>
                            <option value="">Todas as campanhas</option>
                            {campaigns.map(campaign => (
                                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                            ))}
                        </select>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <select value={filters.status} onChange={event => updateFilter('status', event.target.value)} style={{ minHeight: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 9px', fontSize: '0.76rem' }}>
                                <option value="">Status</option>
                                <option value="sent">Aceita</option>
                                <option value="delivered">Entregue</option>
                                <option value="read">Lida</option>
                                <option value="failed">Falha</option>
                                <option value="skipped">Ignorada</option>
                            </select>
                            <select value={filters.intent} onChange={event => updateFilter('intent', event.target.value)} style={{ minHeight: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 9px', fontSize: '0.76rem' }}>
                                <option value="">Resposta</option>
                                <option value="interested">Interessado</option>
                                <option value="opt_out">Saida</option>
                                <option value="question">Pergunta</option>
                                <option value="unknown">Sem classe</option>
                            </select>
                        </div>
                        <select value={filters.senderId} onChange={event => updateFilter('senderId', event.target.value)} style={{ minHeight: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 9px', fontSize: '0.76rem' }}>
                            <option value="">Todos os numeros</option>
                            {senders.map(sender => (
                                <option key={sender.id} value={sender.id}>{sender.display_name || sender.phone_number}</option>
                            ))}
                        </select>
                        <select value={filters.wabaId} onChange={event => updateFilter('wabaId', event.target.value)} style={{ minHeight: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 9px', fontSize: '0.76rem' }}>
                            <option value="">Todas as contas</option>
                            {wabaOptions.map(option => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                        <select value={filters.limit} onChange={event => updateFilter('limit', event.target.value)} style={{ minHeight: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 9px', fontSize: '0.76rem' }}>
                            <option value="500">500 linhas</option>
                            <option value="1000">1.000 linhas</option>
                            <option value="2500">2.500 linhas</option>
                            <option value="5000">5.000 linhas</option>
                        </select>
                    </div>

                    <div style={{ minWidth: 0, overflowY: 'auto', maxHeight: '520px' }}>
                        <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {activeGroupTitle}
                        </div>
                        {activeGroups.length === 0 ? (
                            <div style={{ padding: '0 12px 12px', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                                Sem recortes para os filtros atuais.
                            </div>
                        ) : (
                            activeGroups.slice(0, 18).map(group => (
                                <button
                                    key={group.key}
                                    type="button"
                                    onClick={() => applyGroupFilter(group)}
                                    style={{
                                        width: '100%',
                                        border: 0,
                                        borderTop: '1px solid var(--border)',
                                        background: 'transparent',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: '10px 12px',
                                        display: 'grid',
                                        gap: '5px',
                                        textAlign: 'left',
                                    }}
                                >
                                    <span style={{ color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.label}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                        {Number(group.recipients || 0).toLocaleString('pt-BR')} dest. | {percentLabel(group.delivery_rate || 0)} entrega | {Number(group.failed || 0).toLocaleString('pt-BR')} falhas
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </aside>

                <main style={{ minWidth: 0, borderRight: '1px solid var(--border)', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, minmax(118px, 1fr))',
                        borderBottom: '1px solid var(--border)',
                        overflowX: 'auto',
                    }}>
                        {metricItems.map(item => {
                            const Icon = item.icon
                            return (
                                <div key={item.label} style={{ minWidth: '118px', padding: '11px', borderRight: '1px solid var(--border)', display: 'grid', gap: '4px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase' }}>
                                        <Icon size={13} style={{ color: item.color }} /> {item.label}
                                    </span>
                                    <strong style={{ color: item.color, fontSize: '0.95rem' }}>{Number(item.value || 0).toLocaleString('pt-BR')}</strong>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{item.detail}</span>
                                </div>
                            )
                        })}
                    </div>

                    <div style={{ minWidth: 0, overflow: 'auto' }}>
                        <div style={{
                            minWidth: '900px',
                            display: 'grid',
                            gridTemplateColumns: '150px minmax(170px, 1fr) minmax(170px, 1fr) 110px 110px 110px 120px',
                            gap: '8px',
                            padding: '9px 12px',
                            borderBottom: '1px solid var(--border)',
                            color: 'var(--text-muted)',
                            fontSize: '0.66rem',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            background: 'rgba(255,255,255,0.025)',
                        }}>
                            <span>Contato</span>
                            <span>Campanha</span>
                            <span>Criativo</span>
                            <span>Status</span>
                            <span>Entrega</span>
                            <span>Resposta</span>
                            <span>Erro</span>
                        </div>

                        {loading ? (
                            <div style={{ minWidth: '900px', padding: '34px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Loader2 size={16} className="spin" /> Carregando relatorio...
                            </div>
                        ) : !report ? (
                            <div style={{ minWidth: '900px', padding: '34px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                Clique em Buscar para carregar o relatorio detalhado.
                            </div>
                        ) : rowsForView.length === 0 ? (
                            <div style={{ minWidth: '900px', padding: '34px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                Nenhum resultado encontrado para esta visao e filtros atuais.
                            </div>
                        ) : (
                            <div style={{ minWidth: '900px' }}>
                                {visibleRows.map(row => {
                                    const selected = selectedRow?.recipient_id === row.recipient_id
                                    return (
                                        <button
                                            key={row.recipient_id}
                                            type="button"
                                            onClick={() => setSelectedRecipientId(row.recipient_id)}
                                            style={{
                                                width: '100%',
                                                border: 0,
                                                borderBottom: '1px solid var(--border)',
                                                background: selected ? 'rgba(176,138,67,0.09)' : 'transparent',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                display: 'grid',
                                                gridTemplateColumns: '150px minmax(170px, 1fr) minmax(170px, 1fr) 110px 110px 110px 120px',
                                                gap: '8px',
                                                padding: '10px 12px',
                                                alignItems: 'center',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.72rem',
                                            }}
                                        >
                                            <span style={{ minWidth: 0 }}>
                                                <strong style={{ color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.recipient_name || row.recipient_phone}</strong>
                                                <span style={{ color: 'var(--text-muted)' }}>{row.recipient_phone}</span>
                                            </span>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.campaign_name}</span>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.template_name}</span>
                                            <span style={{ color: metaStatusColor(row.status), fontWeight: 900 }}>{metaStatusLabel(row.status)}</span>
                                            <span>{row.read_at ? 'Lida' : row.delivered_at ? 'Entregue' : row.sent_at ? 'Aceita' : '-'}</span>
                                            <span style={{ color: row.reply_intent === 'interested' ? '#22c55e' : row.reply_intent === 'opt_out' ? '#ef4444' : row.reply_intent ? '#f59e0b' : 'var(--text-muted)' }}>
                                                {row.reply_intent ? metaReplyIntentLabel(row.reply_intent) : '-'}
                                            </span>
                                            <span style={{ color: row.error_message ? '#ef4444' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {row.error_message || row.error_code || '-'}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {rowsForView.length > 80 && (
                        <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.72rem', borderTop: '1px solid var(--border)' }}>
                            Mostrando 80 de {rowsForView.length.toLocaleString('pt-BR')} linhas na tela. O CSV baixa todas as linhas retornadas pelo filtro.
                        </div>
                    )}
                </main>

                <aside style={{ minWidth: 0, background: 'rgba(255,255,255,0.018)', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                    <div style={{ padding: '14px', borderBottom: '1px solid var(--border)' }}>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Detalhe do envio</strong>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.4 }}>
                            Selecione uma linha para ver campanha, criativo, datas, resposta e erro.
                        </p>
                    </div>

                    {selectedRow ? (
                        <div style={{ padding: '14px', display: 'grid', gap: '12px', alignContent: 'start', overflowY: 'auto', maxHeight: '620px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'rgba(176,138,67,0.14)', color: 'var(--gold)', fontWeight: 900 }}>
                                    {(selectedRow.recipient_name || selectedRow.recipient_phone || '?').slice(0, 2).toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <strong style={{ color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedRow.recipient_name || selectedRow.recipient_phone}</strong>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{selectedRow.recipient_phone}</span>
                                </div>
                            </div>

                            {[
                                ['Campanha', selectedRow.campaign_name],
                                ['Criativo', selectedRow.template_name],
                                ['Conta', selectedRow.waba_label || selectedRow.waba_id || '-'],
                                ['Numero', selectedRow.sender_phone || selectedRow.sender_name || '-'],
                                ['Status', metaStatusLabel(selectedRow.status)],
                                ['Enviado', formatMetaDate(selectedRow.sent_at)],
                                ['Entregue', formatMetaDate(selectedRow.delivered_at)],
                                ['Lido', formatMetaDate(selectedRow.read_at)],
                                ['Resposta', selectedRow.reply_intent ? metaReplyIntentLabel(selectedRow.reply_intent) : '-'],
                                ['Historico', selectedRow.repeat_creative_history ? `Reenvio: ${selectedRow.prior_campaign_name || selectedRow.prior_campaign_id || 'campanha anterior'}` : '-'],
                            ].map(([label, value]) => (
                                <div key={label} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '88px minmax(0, 1fr)',
                                    gap: '8px',
                                    alignItems: 'baseline',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.76rem',
                                }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 900, textTransform: 'uppercase' }}>{label}</span>
                                    <strong style={{ color: label === 'Status' ? metaStatusColor(selectedRow.status) : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {value}
                                    </strong>
                                </div>
                            ))}

                            {selectedRow.reply_text && (
                                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', background: 'rgba(255,255,255,0.035)', color: 'var(--text-secondary)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>Texto da resposta</span>
                                    {selectedRow.reply_text}
                                </div>
                            )}

                            {(selectedRow.error_message || selectedRow.error_code) && (
                                <div style={{ border: '1px solid rgba(239,68,68,0.24)', borderRadius: '10px', padding: '10px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '0.76rem', lineHeight: 1.45 }}>
                                    <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>Erro Meta</span>
                                    {selectedRow.error_code ? `Codigo ${selectedRow.error_code}: ` : ''}{selectedRow.error_message || 'Sem mensagem detalhada'}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ padding: '34px 18px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.78rem', lineHeight: 1.45 }}>
                            Nenhuma linha selecionada.
                        </div>
                    )}
                </aside>
            </div>
        </div>
    )
}

function MetaOfficialCampaignPanel({
    campaigns,
    senders,
    summary,
    analytics,
    dailyReport,
    dailyReportDate,
    dailyReportLoading,
    detailedReport,
    detailedReportFilters,
    detailedReportLoading,
    replyReport,
    replyReportLoading,
    replyIntentFilter,
    replyDateFilter,
    loading,
    statusFilter,
    expandedCampaignId,
    loadingDetailCampaignId,
    campaignDetails,
    onStatusFilterChange,
    onDailyReportDateChange,
    onDailyReportRefresh,
    onDailyReportExport,
    onDetailedReportFiltersChange,
    onDetailedReportRefresh,
    onDetailedReportExport,
    onReplyIntentFilterChange,
    onReplyDateFilterChange,
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
    dailyReport: MetaDailyReport | null
    dailyReportDate: string
    dailyReportLoading: boolean
    detailedReport: MetaDetailedReport | null
    detailedReportFilters: MetaDetailedReportFilters
    detailedReportLoading: boolean
    replyReport: MetaReplyReport | null
    replyReportLoading: boolean
    replyIntentFilter: string
    replyDateFilter: string
    loading: boolean
    statusFilter: string
    expandedCampaignId: string
    loadingDetailCampaignId: string
    campaignDetails: Record<string, MetaCampaignDetail>
    onStatusFilterChange: (value: string) => void
    onDailyReportDateChange: (value: string) => void
    onDailyReportRefresh: () => void
    onDailyReportExport: () => void
    onDetailedReportFiltersChange: (filters: MetaDetailedReportFilters) => void
    onDetailedReportRefresh: () => void
    onDetailedReportExport: () => void
    onReplyIntentFilterChange: (value: string) => void
    onReplyDateFilterChange: (value: string) => void
    onRefresh: () => void
    onReplyRefresh: () => void
    onReplyExport: (intent?: string) => void
    onToggleDetail: (campaignId: string) => void
    onManage: (campaignId: string, action: MetaCampaignManageAction) => void
    retryingCampaignId: string
    onRetryFailed: (campaignId: string, failedCount: number) => void
}) {
    const [searchTerm, setSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState<MetaCampaignWorkspaceTab>('campaigns')
    const [campaignPage, setCampaignPage] = useState(1)
    const [campaignPageSize, setCampaignPageSize] = useState(20)
    const [campaignSort, setCampaignSort] = useState<MetaCampaignSortKey>('created_desc')
    const [campaignSignalFilter, setCampaignSignalFilter] = useState<MetaCampaignSignalFilter>('all')
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const statusCounts = summary?.byStatus || {}
    const activeSenderCount = senders.filter(sender => getMetaWhatsAppSenderHealth(sender).available).length
    const totalSenderSendsToday = senders.reduce((total, sender) => total + metaSenderUsage(sender).sent, 0)
    const statusOptions: Array<{ key: string; value: string; label: string; count: number; signal: MetaCampaignSignalFilter }> = [
        { key: 'all', value: '', label: 'Todas', count: summary?.total || campaigns.length, signal: 'all' },
        {
            key: 'progress',
            value: '',
            label: 'Em andamento',
            count: (statusCounts.queued || 0) + (statusCounts.sending || 0) + (statusCounts.preparing || 0),
            signal: 'in_progress',
        },
        { key: 'scheduled', value: 'scheduled', label: 'Agendadas', count: statusCounts.scheduled || 0, signal: 'all' },
        { key: 'paused', value: 'paused', label: 'Pausadas', count: statusCounts.paused || 0, signal: 'all' },
        { key: 'completed', value: 'completed', label: 'Concluidas', count: statusCounts.completed || 0, signal: 'all' },
        { key: 'failures', value: '', label: 'Com falhas', count: summary?.failed || 0, signal: 'with_failures' },
    ]
    const metricItems = [
        { label: 'Campanhas enviadas', value: summary?.total || 0, detail: 'Total de campanhas', icon: Send, color: '#0866ff' },
        { label: 'Destinatarios', value: summary?.recipients || 0, detail: 'Total de contatos', icon: Users, color: '#6d5efc' },
        { label: 'Aceitas pela Meta', value: summary?.sent || 0, detail: `${percentLabel(analytics?.rates?.acceptedRate ?? metricRate(summary?.sent || 0, summary?.recipients || 0))} dos destinatarios`, icon: CheckCircle2, color: '#22c55e' },
        { label: 'Entregues', value: summary?.delivered || 0, detail: `${percentLabel(analytics?.rates?.deliveryRate ?? metricRate(summary?.delivered || 0, summary?.sent || summary?.recipients || 0))} das aceitas`, icon: Inbox, color: '#16a34a' },
        { label: 'Lidas', value: summary?.read || 0, detail: `${percentLabel(analytics?.rates?.readRate ?? metricRate(summary?.read || 0, summary?.delivered || summary?.sent || summary?.recipients || 0))} das entregues`, icon: Eye, color: '#0ea5e9' },
        { label: 'Falhas', value: summary?.failed || 0, detail: `${percentLabel(analytics?.rates?.failureRate ?? metricRate(summary?.failed || 0, summary?.recipients || 0))} dos destinatarios`, icon: AlertCircle, color: '#ef4444' },
    ]
    const failureLeader = [...campaigns].sort((a, b) => Number(b.total_failed || 0) - Number(a.total_failed || 0))[0] || null
    const failureTotal = Number(summary?.failed || 0)
    const replySummary = replyReport?.summary || emptyMetaReplyReportSummary()
    const tabItems: Array<{ key: MetaCampaignWorkspaceTab; label: string; count: number; icon: typeof MessageSquare }> = [
        { key: 'overview', label: 'Resumo', count: dailyReport?.totals?.dispatched || summary?.total || 0, icon: BarChart3 },
        { key: 'campaigns', label: 'Campanhas', count: summary?.total || campaigns.length, icon: Send },
        { key: 'reports', label: 'Relatorios', count: detailedReport?.rows?.length || 0, icon: Download },
        { key: 'replies', label: 'Respostas', count: replySummary.total || 0, icon: MessageSquare },
        { key: 'diagnostics', label: 'Diagnostico', count: analytics?.errorBreakdown?.length || summary?.failed || 0, icon: Activity },
    ]
    const filteredCampaigns = campaigns.filter(campaign => {
        if (!metaCampaignMatchesSignal(campaign, campaignSignalFilter)) return false
        if (!normalizedSearch) return true
        const sender = senders.find(item => item.id === campaign.default_sender_id)
        return [
            campaign.name,
            campaign.status,
            campaign.template_name,
            campaign.template_language,
            campaign.campaign_type,
            campaign.created_at,
            campaign.started_at,
            campaign.completed_at,
            campaign.scheduled_for,
            formatMetaDate(campaign.created_at),
            sender?.display_name,
            sender?.phone_number,
        ].some(value => String(value || '').toLowerCase().includes(normalizedSearch))
    })
    const sortedCampaigns = sortMetaCampaigns(filteredCampaigns, campaignSort)
    const campaignPageTotal = Math.max(1, Math.ceil(sortedCampaigns.length / campaignPageSize))
    const safeCampaignPage = Math.min(campaignPage, campaignPageTotal)
    const campaignPageStart = sortedCampaigns.length ? (safeCampaignPage - 1) * campaignPageSize : 0
    const campaignPageEnd = Math.min(campaignPageStart + campaignPageSize, sortedCampaigns.length)
    const paginatedCampaigns = sortedCampaigns.slice(campaignPageStart, campaignPageEnd)
    const selectedCampaign = sortedCampaigns.find(item => item.id === expandedCampaignId) || null
    const selectedSender = selectedCampaign
        ? senders.find(item => item.id === selectedCampaign.default_sender_id)
        : undefined
    const selectedDetail = selectedCampaign ? campaignDetails[selectedCampaign.id] : undefined
    const selectedCampaignId = selectedCampaign?.id || ''
    const selectCampaign = (campaignId: string) => {
        if (expandedCampaignId === campaignId) return
        onToggleDetail(campaignId)
    }
    const closeCampaignDrawer = () => {
        if (selectedCampaignId) onToggleDetail(selectedCampaignId)
    }
    const changeCampaignPage = (nextPage: number) => {
        setCampaignPage(Math.min(campaignPageTotal, Math.max(1, nextPage)))
    }

    useEffect(() => {
        if (!selectedCampaignId) return
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onToggleDetail(selectedCampaignId)
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [onToggleDetail, selectedCampaignId])

    return (
        <div id="meta-campaign-history-panel" style={{ display: 'grid', gap: '14px' }}>
            <div style={{
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
            }}>
                <div style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                    background: 'rgba(255,255,255,0.025)',
                }}>
                    <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Painel Meta WhatsApp</strong>
                        <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            Use as abas para separar operacao, respostas e diagnosticos sem misturar os dados.
                        </p>
                    </div>
                    <div style={{ display: 'inline-flex', gap: '5px', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.08)', overflowX: 'auto' }}>
                        {tabItems.map(tab => {
                            const active = activeTab === tab.key
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => {
                                        setActiveTab(tab.key)
                                        if (tab.key === 'reports' && !detailedReport && !detailedReportLoading) {
                                            onDetailedReportRefresh()
                                        }
                                    }}
                                    style={{
                                        minHeight: '34px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '7px 10px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '7px',
                                        background: active ? 'rgba(8,102,255,0.1)' : 'transparent',
                                        color: active ? '#0866ff' : 'var(--text-secondary)',
                                        fontSize: '0.76rem',
                                        fontWeight: 900,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    <Icon size={14} />
                                    {tab.label}
                                    <span style={{
                                        minWidth: '20px',
                                        height: '20px',
                                        borderRadius: '999px',
                                        background: active ? 'rgba(8,102,255,0.12)' : 'rgba(148,163,184,0.14)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0 6px',
                                        fontSize: '0.66rem',
                                    }}>
                                        {Number(tab.count || 0).toLocaleString('pt-BR')}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
                {activeTab === 'campaigns' && (
                <div style={{
                    padding: '12px 14px 10px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                }}>
                    {statusOptions.map(option => {
                        const active = statusFilter === option.value && campaignSignalFilter === option.signal
                        return (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => {
                                    setCampaignPage(1)
                                    setCampaignSignalFilter(option.signal)
                                    onStatusFilterChange(option.value)
                                }}
                                style={{
                                    minHeight: '34px',
                                    padding: '7px 11px',
                                    borderRadius: '8px',
                                    border: active ? '1px solid rgba(8,102,255,0.26)' : '1px solid var(--border)',
                                    background: active ? 'rgba(8,102,255,0.08)' : 'rgba(255,255,255,0.04)',
                                    color: active ? '#0866ff' : 'var(--text-primary)',
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
                                    background: active ? 'rgba(8,102,255,0.14)' : 'rgba(148,163,184,0.14)',
                                    color: active ? '#0866ff' : 'var(--text-muted)',
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
                )}

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
                            onChange={event => {
                                setCampaignPage(1)
                                setSearchTerm(event.target.value)
                            }}
                            placeholder={activeTab === 'replies'
                                ? 'Pesquisar contato, numero, resposta, campanha ou template'
                                : 'Pesquisar campanha, template, numero, data ou status'}
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
                    {activeTab === 'campaigns' && (
                        <select
                            value={statusFilter}
                            onChange={event => {
                                setCampaignPage(1)
                                setCampaignSignalFilter('all')
                                onStatusFilterChange(event.target.value)
                            }}
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
                    )}
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

                {activeTab === 'campaigns' && (
                <div style={{
                    padding: '18px 14px 14px',
                    borderBottom: '1px solid var(--border)',
                    display: 'grid',
                    gap: '16px',
                    background: 'rgba(255,255,255,0.012)',
                }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '10px',
                }}>
                    {metricItems.map(item => {
                        const Icon = item.icon
                        return (
                            <div key={item.label} style={{
                                minHeight: '92px',
                                padding: '14px',
                                borderRadius: '12px',
                                border: '1px solid var(--border)',
                                background: 'rgba(255,255,255,0.055)',
                                display: 'grid',
                                gap: '8px',
                                alignContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                    <span style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: `${item.color}18`,
                                        color: item.color,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Icon size={16} />
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 800 }}>
                                        {item.detail}
                                    </span>
                                </div>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '1.55rem', lineHeight: 1 }}>
                                        {Number(item.value || 0).toLocaleString('pt-BR')}
                                    </strong>
                                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.76rem', marginTop: '6px', fontWeight: 800 }}>
                                        {item.label}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '12px',
                    alignItems: 'stretch',
                }}>
                    <MetaCampaignFunnelCard summary={summary} analytics={analytics} />
                    <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: failureTotal > 0 ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(34,197,94,0.2)',
                        background: failureTotal > 0 ? 'rgba(239,68,68,0.075)' : 'rgba(34,197,94,0.065)',
                        display: 'grid',
                        gap: '12px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <span style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                background: failureTotal > 0 ? 'rgba(239,68,68,0.13)' : 'rgba(34,197,94,0.12)',
                                color: failureTotal > 0 ? '#ef4444' : '#16a34a',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                {failureTotal > 0 ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                            </span>
                            <div>
                                <strong style={{ color: failureTotal > 0 ? '#ef4444' : '#16a34a', fontSize: '0.92rem' }}>
                                    {failureTotal > 0 ? 'Atencao necessaria' : 'Operacao estavel'}
                                </strong>
                                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                                    {failureTotal > 0
                                        ? `${Number(failureTotal).toLocaleString('pt-BR')} mensagens falharam.${failureLeader?.total_failed ? ` Maior concentracao: ${failureLeader.name || 'campanha sem nome'}.` : ''}`
                                        : 'Nao ha falhas registradas nas campanhas carregadas.'}
                                </p>
                            </div>
                        </div>
                        {failureTotal > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setCampaignPage(1)
                                    setCampaignSignalFilter('with_failures')
                                    onStatusFilterChange('')
                                }}
                                style={{
                                    justifySelf: 'start',
                                    minHeight: '34px',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(239,68,68,0.22)',
                                    background: 'rgba(255,255,255,0.08)',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontSize: '0.76rem',
                                    fontWeight: 900,
                                }}
                            >
                                Analisar falhas
                            </button>
                        )}
                    </div>
                </div>
                </div>
                )}

                {activeTab === 'overview' && (
                    <MetaDailyReportPanel
                        report={dailyReport}
                        date={dailyReportDate}
                        loading={dailyReportLoading}
                        onDateChange={onDailyReportDateChange}
                        onRefresh={onDailyReportRefresh}
                        onExport={onDailyReportExport}
                    />
                )}

                {activeTab === 'campaigns' && (
                    <>
                    <div style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        background: 'rgba(255,255,255,0.018)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                                {activeSenderCount} numeros ativos · {Number(totalSenderSendsToday).toLocaleString('pt-BR')} envios hoje
                            </strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                Limite compartilhado da BM/portfolio Meta.
                            </span>
                        </div>
                        <details style={{ position: 'relative' }}>
                            <summary style={{
                                listStyle: 'none',
                                cursor: 'pointer',
                                color: '#0866ff',
                                fontSize: '0.76rem',
                                fontWeight: 900,
                            }}>
                                Ver numeros
                            </summary>
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '28px',
                                zIndex: 10,
                                minWidth: '290px',
                                display: 'grid',
                                gap: '7px',
                                padding: '10px',
                                borderRadius: '10px',
                                border: '1px solid var(--border)',
                                background: 'var(--bg-secondary)',
                                boxShadow: '0 16px 32px rgba(15,23,42,0.16)',
                            }}>
                                {senders.length === 0 ? (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                                        Nenhum numero Meta sincronizado.
                                    </span>
                                ) : (
                                    senders.map(sender => {
                                        const health = getMetaWhatsAppSenderHealth(sender)
                                        const usage = metaSenderUsage(sender)
                                        const color = health.available ? '#22c55e' : health.policyEligible ? '#f59e0b' : '#ef4444'
                                        return (
                                            <div key={sender.id} style={{
                                                display: 'grid',
                                                gap: '3px',
                                                padding: '8px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border)',
                                                background: 'rgba(255,255,255,0.035)',
                                            }}>
                                                <strong style={{ color, fontSize: '0.76rem' }}>{sender.display_name || sender.phone_number}</strong>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                                                    {metaSenderSentTodayLabel(sender)} · {health.warning || health.reason}
                                                </span>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </details>
                    </div>

                    <div style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                        background: 'rgba(255,255,255,0.018)',
                    }}>
                        <div style={{ display: 'grid', gap: '3px' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                                Campanhas encontradas
                            </strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                {sortedCampaigns.length === 0
                                    ? 'Nenhum resultado para os filtros atuais'
                                    : `Mostrando ${campaignPageStart + 1}-${campaignPageEnd} de ${sortedCampaigns.length}`}
                                {campaigns.length !== sortedCampaigns.length ? ` | total carregado ${campaigns.length}` : ''}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <select
                                value={campaignSignalFilter}
                                onChange={event => {
                                    setCampaignPage(1)
                                    setCampaignSignalFilter(event.target.value as MetaCampaignSignalFilter)
                                }}
                                style={{
                                    minHeight: '34px',
                                    padding: '7px 9px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.76rem',
                                }}
                                title="Filtrar campanhas por sinal operacional"
                            >
                                <option value="all">Todos os sinais</option>
                                <option value="in_progress">Em andamento</option>
                                <option value="with_failures">Com falhas</option>
                                <option value="high_failure">Falha acima de 30%</option>
                                <option value="with_reads">Com leituras</option>
                                <option value="without_failures">Sem falhas</option>
                            </select>

                            <select
                                value={campaignSort}
                                onChange={event => {
                                    setCampaignPage(1)
                                    setCampaignSort(event.target.value as MetaCampaignSortKey)
                                }}
                                style={{
                                    minHeight: '34px',
                                    padding: '7px 9px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.76rem',
                                }}
                                title="Ordenar campanhas"
                            >
                                <option value="created_desc">Mais recentes</option>
                                <option value="created_asc">Mais antigas</option>
                                <option value="name_asc">Nome A-Z</option>
                                <option value="recipients_desc">Mais destinatarios</option>
                                <option value="failed_desc">Mais falhas</option>
                                <option value="delivery_desc">Melhor entrega</option>
                                <option value="read_desc">Melhor leitura</option>
                            </select>

                            <select
                                value={campaignPageSize}
                                onChange={event => {
                                    setCampaignPage(1)
                                    setCampaignPageSize(Number(event.target.value))
                                }}
                                style={{
                                    minHeight: '34px',
                                    padding: '7px 9px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.76rem',
                                }}
                                title="Quantidade por pagina"
                            >
                                {META_CAMPAIGN_PAGE_SIZE_OPTIONS.map(size => (
                                    <option key={size} value={size}>{size} por pagina</option>
                                ))}
                            </select>

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <button
                                    type="button"
                                    onClick={() => changeCampaignPage(safeCampaignPage - 1)}
                                    disabled={safeCampaignPage <= 1}
                                    title="Pagina anterior"
                                    style={{
                                        width: '34px',
                                        height: '34px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'rgba(255,255,255,0.04)',
                                        color: 'var(--text-secondary)',
                                        cursor: safeCampaignPage <= 1 ? 'not-allowed' : 'pointer',
                                        opacity: safeCampaignPage <= 1 ? 0.48 : 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <ChevronLeft size={15} />
                                </button>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', minWidth: '74px', textAlign: 'center' }}>
                                    {safeCampaignPage}/{campaignPageTotal}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => changeCampaignPage(safeCampaignPage + 1)}
                                    disabled={safeCampaignPage >= campaignPageTotal}
                                    title="Proxima pagina"
                                    style={{
                                        width: '34px',
                                        height: '34px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'rgba(255,255,255,0.04)',
                                        color: 'var(--text-secondary)',
                                        cursor: safeCampaignPage >= campaignPageTotal ? 'not-allowed' : 'pointer',
                                        opacity: safeCampaignPage >= campaignPageTotal ? 0.48 : 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="meta-campaigns-workspace">
                        <div className="meta-campaign-table-pane">
                            <div className="meta-campaign-table-shell">
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(280px, 1.45fr) 132px 118px minmax(210px, 1fr) 150px 122px 146px',
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
                                    <span>Campanha</span>
                                    <span>Status</span>
                                    <span>Publico</span>
                                    <span>Desempenho</span>
                                    <span>Entrega</span>
                                    <span>Criada em</span>
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
                                ) : sortedCampaigns.length === 0 ? (
                                    <div className="meta-campaigns-table-empty" style={{ textAlign: 'center', padding: '38px', color: 'var(--text-muted)' }}>
                                        Nenhuma campanha encontrada para a busca ou filtro atual.
                                    </div>
                                ) : (
                                    <div className="meta-campaign-list-scroll">
                                        {paginatedCampaigns.map(campaign => (
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
                        </div>

                    </div>
                    {selectedCampaign && (
                        <div
                            className="meta-campaign-drawer-backdrop"
                            role="presentation"
                            onClick={closeCampaignDrawer}
                        >
                            <div
                                className="meta-campaign-drawer"
                                role="dialog"
                                aria-modal="true"
                                aria-label={`Detalhes da campanha ${selectedCampaign.name || 'Meta'}`}
                                onClick={event => event.stopPropagation()}
                            >
                                <div className="meta-campaign-drawer-header">
                                    <strong>Detalhes da campanha</strong>
                                    <button type="button" onClick={closeCampaignDrawer} title="Fechar detalhes">
                                        <XCircle size={18} />
                                    </button>
                                </div>
                                <div className="meta-campaign-drawer-body">
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
                        </div>
                    )}
                    </>
                )}
            </div>

            {activeTab === 'reports' && (
                <MetaDetailedReportPanel
                    report={detailedReport}
                    filters={detailedReportFilters}
                    campaigns={campaigns}
                    senders={senders}
                    loading={detailedReportLoading}
                    onFiltersChange={onDetailedReportFiltersChange}
                    onRefresh={onDetailedReportRefresh}
                    onExport={onDetailedReportExport}
                />
            )}

            {activeTab === 'replies' && (
                <MetaReplyOpsPanel
                    report={replyReport}
                    loading={replyReportLoading}
                    intentFilter={replyIntentFilter}
                    dateFilter={replyDateFilter}
                    searchTerm={searchTerm}
                    onIntentFilterChange={onReplyIntentFilterChange}
                    onDateFilterChange={onReplyDateFilterChange}
                    onRefresh={onReplyRefresh}
                    onExport={onReplyExport}
                />
            )}

            {activeTab === 'diagnostics' && (
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
            )}
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
    onManage: (campaignId: string, action: MetaCampaignManageAction) => void
    onRetryFailed: (campaignId: string, failedCount: number) => void
}) {
    const completion = metaProgress(campaign)
    const deliveryRate = metaCampaignDeliveryRate(campaign)
    const failureRate = metaCampaignFailureRate(campaign)
    const finalStatus = ['completed', 'cancelled', 'failed'].includes(campaign.status)
    const canPause = ['scheduled', 'queued', 'sending', 'preparing'].includes(campaign.status)
    const canResume = campaign.status === 'paused'
    const canCancel = ['scheduled', 'queued', 'sending', 'preparing'].includes(campaign.status)
    const canDelete = finalStatus || ['draft', 'paused'].includes(campaign.status)
    const canRetryFailed = campaign.total_failed > 0 && !['queued', 'sending', 'scheduled', 'preparing', 'cancelled'].includes(campaign.status)
    const campaignMetadata = asRecord(campaign.metadata)
    const portfolioRoutingEnabled = campaignMetadata.portfolio_routing_enabled === true
    const routingWabaLabels = Array.isArray(campaignMetadata.routing_waba_labels)
        ? campaignMetadata.routing_waba_labels.map(label => textValue(label)).filter(Boolean)
        : []
    const routedLabel = portfolioRoutingEnabled
        ? `Pool automatico${routingWabaLabels.length ? ` (${routingWabaLabels.length} contas)` : ''}`
        : sender?.display_name || sender?.phone_number || 'Conta nao identificada'
    const deliveryLabel = campaign.total_failed > 0
        ? `${Number(campaign.total_failed || 0).toLocaleString('pt-BR')} falha${campaign.total_failed === 1 ? '' : 's'}`
        : campaign.total_delivered > 0
            ? `${Number(campaign.total_delivered || 0).toLocaleString('pt-BR')} entregues`
            : campaign.scheduled_for
                ? 'Agendada'
                : `${completion}% processado`

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
                gridTemplateColumns: 'minmax(280px, 1.45fr) 132px 118px minmax(210px, 1fr) 150px 122px 146px',
                gap: '0',
                alignItems: 'center',
                padding: '12px',
                borderBottom: '1px solid var(--border)',
                background: selected ? 'rgba(8,102,255,0.055)' : 'rgba(255,255,255,0.01)',
                cursor: 'pointer',
                outline: 'none',
            }}
        >
            <div style={{ minWidth: 0, display: 'grid', gap: '4px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                    <span style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '10px',
                        background: 'rgba(176,138,67,0.12)',
                        color: 'var(--gold)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <FileText size={16} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                        <strong style={{
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                        }}>
                            {campaign.name || 'Campanha Meta'}
                        </strong>
                        <span style={{
                            color: 'var(--text-muted)',
                            fontSize: '0.7rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                            marginTop: '3px',
                        }}>
                            {campaign.template_name || '-'} ({campaign.template_language || 'pt_BR'}) · {routedLabel}
                        </span>
                    </div>
                </div>
            </div>

            <MetaCampaignStatusBadge status={campaign.status} failed={campaign.total_failed} />

            <div style={{ display: 'grid', gap: '2px' }}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    {Number(campaign.total_recipients || 0).toLocaleString('pt-BR')}
                </strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                    contato{campaign.total_recipients === 1 ? '' : 's'}
                </span>
            </div>

            <div style={{ display: 'grid', gap: '7px', minWidth: 0 }}>
                <MetaCampaignMiniBar label="Entregues" value={campaign.total_delivered} total={campaign.total_recipients} color="#22c55e" />
                <MetaCampaignMiniBar label="Lidas" value={campaign.total_read} total={campaign.total_delivered || campaign.total_recipients} color="#0866ff" />
            </div>

            <div style={{ display: 'grid', gap: '4px' }}>
                <strong style={{ color: campaign.total_failed > 0 ? '#ef4444' : 'var(--text-primary)', fontSize: '0.78rem' }}>
                    {deliveryLabel}
                </strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                    {campaign.total_failed > 0 ? `${percentLabel(failureRate)} de falha` : `${percentLabel(deliveryRate)} entrega`}
                </span>
            </div>

            <div style={{ display: 'grid', gap: '2px' }}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.76rem' }}>
                    {formatMetaDate(campaign.created_at)}
                </strong>
                {campaign.scheduled_for && (
                    <span style={{ color: '#0ea5e9', fontSize: '0.68rem' }}>
                        Agendada: {formatMetaDate(campaign.scheduled_for)}
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', justifyContent: 'flex-start' }}>
                <button
                    type="button"
                    onClick={event => {
                        event.stopPropagation()
                        onSelect(campaign.id)
                    }}
                    title="Abrir detalhes"
                    style={{
                        minHeight: '32px',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(8,102,255,0.18)',
                        background: 'rgba(8,102,255,0.06)',
                        color: '#0866ff',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                    }}
                >
                    {loadingDetail ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                    Detalhes
                </button>
                <details style={{ position: 'relative' }} onClick={event => event.stopPropagation()}>
                    <summary style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        listStyle: 'none',
                    }}>
                        <MoreVertical size={15} />
                    </summary>
                    <div style={{
                        position: 'absolute',
                        right: 0,
                        top: '38px',
                        zIndex: 12,
                        minWidth: '180px',
                        display: 'grid',
                        gap: '6px',
                        padding: '8px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                        boxShadow: '0 16px 32px rgba(15,23,42,0.16)',
                    }}>
                        {canRetryFailed && (
                            <button
                                type="button"
                                onClick={() => onRetryFailed(campaign.id, campaign.total_failed)}
                                disabled={retrying}
                                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.22)', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', cursor: retrying ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.74rem', fontWeight: 800 }}
                            >
                                {retrying ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                                Reenviar falhas
                            </button>
                        )}
                        {canPause && (
                            <button type="button" onClick={() => onManage(campaign.id, 'pause')} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.74rem', fontWeight: 800 }}>
                                <Pause size={14} /> Pausar
                            </button>
                        )}
                        {canResume && (
                            <button type="button" onClick={() => onManage(campaign.id, 'resume')} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.74rem', fontWeight: 800 }}>
                                <Play size={14} /> Retomar
                            </button>
                        )}
                        {canCancel && (
                            <button type="button" onClick={() => onManage(campaign.id, 'cancel')} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.16)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.74rem', fontWeight: 800 }}>
                                <Trash2 size={14} /> Cancelar
                            </button>
                        )}
                        {canDelete && (
                            <button type="button" onClick={() => onManage(campaign.id, 'delete')} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.16)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.74rem', fontWeight: 800 }}>
                                <Trash2 size={14} /> Excluir
                            </button>
                        )}
                    </div>
                </details>
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

function MetaCampaignStatusBadge({
    status,
    failed,
}: {
    status: string
    failed: number
}) {
    const hasFailures = Number(failed || 0) > 0
    const color = hasFailures && status === 'completed' ? '#f59e0b' : metaStatusColor(status)
    const label = hasFailures && status === 'completed' ? 'Concluida com falhas' : metaStatusLabel(status)

    return (
        <span style={{
            justifySelf: 'start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            maxWidth: '120px',
            padding: '6px 9px',
            borderRadius: '999px',
            border: `1px solid ${color}33`,
            background: `${color}12`,
            color,
            fontSize: '0.7rem',
            fontWeight: 900,
            whiteSpace: 'normal',
            lineHeight: 1.2,
        }}>
            <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: color,
                boxShadow: status === 'sending' ? '0 0 8px rgba(245,158,11,0.5)' : 'none',
                flexShrink: 0,
            }} />
            {label}
        </span>
    )
}

function MetaCampaignMiniBar({
    label,
    value,
    total,
    color,
}: {
    label: string
    value: number
    total: number
    color: string
}) {
    const rate = metricRate(Number(value || 0), Number(total || 0))

    return (
        <div style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.68rem' }}>
                <span>{label}</span>
                <strong style={{ color: 'var(--text-primary)' }}>{Number(value || 0).toLocaleString('pt-BR')}</strong>
            </div>
            <div style={{ height: '5px', borderRadius: '999px', background: 'rgba(148,163,184,0.18)', overflow: 'hidden' }}>
                <div style={{
                    width: `${Math.min(100, Math.max(0, rate))}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: color,
                }} />
            </div>
        </div>
    )
}

function MetaCampaignFunnelCard({
    summary,
    analytics,
}: {
    summary: MetaCampaignSummary | null
    analytics: MetaCampaignAnalytics | null
}) {
    const recipients = Number(summary?.recipients || 0)
    const accepted = Number(summary?.sent || 0)
    const delivered = Number(summary?.delivered || 0)
    const read = Number(summary?.read || 0)
    const funnelItems = [
        { label: 'Destinatarios', value: recipients, rate: recipients > 0 ? 100 : 0, color: '#0866ff', background: 'rgba(8,102,255,0.1)' },
        { label: 'Aceitas', value: accepted, rate: analytics?.rates?.acceptedRate ?? metricRate(accepted, recipients), color: '#6d5efc', background: 'rgba(109,94,252,0.1)' },
        { label: 'Entregues', value: delivered, rate: metricRate(delivered, recipients), color: '#22c55e', background: 'rgba(34,197,94,0.1)' },
        { label: 'Lidas', value: read, rate: metricRate(read, recipients), color: '#0ea5e9', background: 'rgba(14,165,233,0.1)' },
    ]

    return (
        <div style={{
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.055)',
            display: 'grid',
            gap: '14px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>Funil de entrega</strong>
                <span title="Acompanhe a passagem dos contatos por aceite, entrega e leitura." style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>i</span>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '8px',
            }}>
                {funnelItems.map(item => (
                    <div key={item.label} style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: item.background,
                        border: `1px solid ${item.color}1f`,
                        display: 'grid',
                        gap: '8px',
                    }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{item.label}</span>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{Number(item.value || 0).toLocaleString('pt-BR')}</strong>
                        <div style={{ display: 'grid', gap: '4px' }}>
                            <div style={{ height: '5px', borderRadius: '999px', background: 'rgba(148,163,184,0.22)', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${Math.min(100, Math.max(0, item.rate))}%`,
                                    height: '100%',
                                    background: item.color,
                                    borderRadius: '999px',
                                }} />
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>{percentLabel(item.rate)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
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
    onManage: (campaignId: string, action: MetaCampaignManageAction) => void
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
    const canCancel = ['scheduled', 'queued', 'sending', 'preparing'].includes(detailCampaign.status)
    const canDelete = finalStatus || ['draft', 'paused'].includes(detailCampaign.status)
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
                    {canCancel && (
                        <button type="button" onClick={() => onManage(campaign.id, 'cancel')} title="Cancelar" style={{ padding: '7px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.16)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer' }}>
                            <Trash2 size={14} />
                        </button>
                    )}
                    {canDelete && (
                        <button type="button" onClick={() => onManage(campaign.id, 'delete')} title="Excluir do painel" style={{ padding: '7px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.16)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
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

            <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '16px' }}>
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
                            detail: `${sender.health_reason || sender.meta_status || 'sem status'} | uso/reserva ${percentLabel(sender.usageRate)} | falha ${percentLabel(sender.failureRate)}`,
                            value: `${sender.daily_sent_count} ${sender.daily_sent_count === 1 ? 'envio' : 'envios'} hoje`,
                            color: sender.health_status === 'blocked'
                                ? '#ef4444'
                                : sender.health_status === 'warn' ? '#f59e0b' : '#22c55e',
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
    const campaignPortfolioRouting = campaignMetadata.portfolio_routing_enabled === true
    const routingWabaLabels = Array.isArray(campaignMetadata.routing_waba_labels)
        ? campaignMetadata.routing_waba_labels.map(label => textValue(label)).filter(Boolean)
        : []
    const routingDescription = campaignPortfolioRouting
        ? `Pool portfolio (${routingWabaLabels.length || 1} conta(s))${routingWabaLabels.length ? `: ${routingWabaLabels.join(', ')}` : ''}`
        : textValue(campaignMetadata.waba_label) || 'Conta do template'
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
                    <MetaDetailLine label="Roteamento" value={routingDescription} />
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

function incrementMetaReplyGroup(map: Map<string, MetaReplyReportGroup>, key: string, reply: MetaReplyIntent) {
    const intent = String(reply.intent || 'unknown')
    const existing = map.get(key) || {
        key,
        campaign_id: reply.campaign_id || null,
        campaign_name: reply.campaign_name || '',
        template_name: reply.template_name || '',
        count: 0,
        interested: 0,
        optOut: 0,
        question: 0,
        unknown: 0,
        lastSeenAt: null,
    }

    existing.count += 1
    if (intent === 'interested') existing.interested += 1
    else if (intent === 'opt_out') existing.optOut += 1
    else if (intent === 'question') existing.question += 1
    else existing.unknown += 1

    if (reply.created_at && (!existing.lastSeenAt || new Date(reply.created_at).getTime() > new Date(String(existing.lastSeenAt)).getTime())) {
        existing.lastSeenAt = reply.created_at
    }

    map.set(key, existing)
}

function buildMetaReplyReportSummary(replies: MetaReplyIntent[]): MetaReplyReportSummary {
    const byTemplate = new Map<string, MetaReplyReportGroup>()
    const byCampaign = new Map<string, MetaReplyReportGroup>()
    const byIntent: Record<string, number> = {}

    replies.forEach(reply => {
        const intent = String(reply.intent || 'unknown')
        byIntent[intent] = (byIntent[intent] || 0) + 1
        incrementMetaReplyGroup(byTemplate, String(reply.template_name || 'Sem template'), reply)
        incrementMetaReplyGroup(byCampaign, String(reply.campaign_id || reply.campaign_name || 'Sem campanha'), reply)
    })

    return {
        total: replies.length,
        interested: byIntent.interested || 0,
        optOut: byIntent.opt_out || 0,
        question: byIntent.question || 0,
        unknown: byIntent.unknown || 0,
        autoRepliesSent: replies.filter(reply => reply.auto_reply_status === 'sent').length,
        autoRepliesFailed: replies.filter(reply => reply.auto_reply_status === 'failed').length,
        notificationsSent: replies.filter(reply => reply.notified_status === 'sent').length,
        notificationsFailed: replies.filter(reply => reply.notified_status === 'failed').length,
        byIntent,
        byTemplate: Array.from(byTemplate.values()).sort((a, b) => b.count - a.count),
        byCampaign: Array.from(byCampaign.values()).sort((a, b) => b.count - a.count),
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
    dateFilter,
    searchTerm,
    onIntentFilterChange,
    onDateFilterChange,
    onRefresh,
    onExport,
}: {
    report: MetaReplyReport | null
    loading: boolean
    intentFilter: string
    dateFilter: string
    searchTerm?: string
    onIntentFilterChange: (value: string) => void
    onDateFilterChange: (value: string) => void
    onRefresh: () => void
    onExport: (intent?: string) => void
}) {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase()
    const rawReplies = report?.replies || []
    const replies = normalizedSearch
        ? rawReplies.filter(reply => [
            reply.contact_name,
            reply.contact_phone,
            reply.intent,
            reply.raw_text,
            reply.button_text,
            reply.button_payload,
            reply.campaign_name,
            reply.template_name,
        ].some(value => String(value || '').toLowerCase().includes(normalizedSearch)))
        : rawReplies
    const summary = normalizedSearch ? buildMetaReplyReportSummary(replies) : report?.summary || emptyMetaReplyReportSummary()
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
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={event => onDateFilterChange(event.target.value)}
                        title="Filtrar respostas pela data recebida"
                        style={{
                            minHeight: '36px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            padding: '0 10px',
                            fontSize: '0.76rem',
                        }}
                    />
                    {dateFilter && (
                        <button
                            type="button"
                            onClick={() => onDateFilterChange('')}
                            style={{
                                minHeight: '36px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                background: 'rgba(255,255,255,0.04)',
                                color: 'var(--text-secondary)',
                                padding: '0 10px',
                                cursor: 'pointer',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                            }}
                        >
                            Limpar data
                        </button>
                    )}
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
