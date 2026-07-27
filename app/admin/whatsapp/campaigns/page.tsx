'use client'

import { useState, useEffect } from 'react'
import {
    Send, Loader2, AlertCircle, CheckCircle2, Clock, Users,
    Plus, Trash2, Pause, Play, FileText, Image, Mic, Video,
    Tag, RefreshCw, MessageSquare, Calendar, ChevronDown, ChevronUp,
    Smartphone, Search
} from 'lucide-react'
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
}

interface MetaCampaignRecipient {
    id: string
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
}

interface MetaCampaignEvent {
    id: string
    provider_message_id?: string | null
    event_type: string
    event_status?: string | null
    recipient_phone?: string | null
    received_at: string
}

interface MetaCampaignDetail {
    recipients: MetaCampaignRecipient[]
    events: MetaCampaignEvent[]
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

interface MetaRecipientDraft {
    phone: string
    name?: string
    templateParameters?: unknown
    metadata?: Record<string, unknown>
    missingVariables?: string[]
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

function splitAudienceRow(line: string) {
    if (line.includes('\t')) return line.split('\t')
    if (line.includes(';')) return line.split(';')
    if (line.includes('|')) return line.split('|')
    return line.split(',')
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
    const [metaSummary, setMetaSummary] = useState<MetaCampaignSummary | null>(null)
    const [metaStatusFilter, setMetaStatusFilter] = useState('')
    const [expandedMetaCampaignId, setExpandedMetaCampaignId] = useState('')
    const [loadingMetaCampaignDetail, setLoadingMetaCampaignDetail] = useState('')
    const [metaCampaignDetails, setMetaCampaignDetails] = useState<Record<string, MetaCampaignDetail>>({})
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [sending, setSending] = useState(false)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Campaign form state
    const [sendProvider, setSendProvider] = useState<'connectyhub' | 'meta_whatsapp'>('meta_whatsapp')
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
            } else {
                setFeedback({ type: 'error', text: data.message || 'Erro ao carregar campanhas Meta' })
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erro ao carregar campanhas Meta' })
        } finally {
            setLoadingMetaCampaigns(false)
        }
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
                        recipients: data.recipients || [],
                        events: data.events || [],
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
        if (sendProvider === 'meta_whatsapp') loadMetaCampaigns()
    }, [sendProvider, metaStatusFilter])

    const parseNumbers = (): string[] => {
        return numbersInput
            .split(/[\n,;]+/)
            .map(n => n.replace(/\D/g, '').trim())
            .filter(n => n.length >= 10)
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

    const getMissingMetaTemplateFields = (skipBodyValues = false) => {
        const template = getSelectedMetaTemplate()
        if (!template) return []

        const missing: string[] = []
        const header = findTemplateComponent(template, 'HEADER')
        const body = findTemplateComponent(template, 'BODY')
        const headerFormat = textValue(header?.format).toUpperCase()
        const headerVariables = extractTemplateVariables(textValue(header?.text))
        const bodyVariables = extractTemplateVariables(textValue(body?.text))

        if (header && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && !metaHeaderMediaUrl.trim()) {
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

    const buildMetaTemplateParameters = (bodyValues: Record<string, string> = metaBodyParameterValues) => {
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
            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && metaHeaderMediaUrl.trim()) {
                components.push({
                    type: 'header',
                    parameters: [buildHeaderParameter(headerFormat, metaHeaderMediaUrl)],
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

        numbersInput.split(/\n+/).forEach((line, lineIndex) => {
            const columns = splitAudienceRow(line).map(column => column.trim())
            const phone = (columns[0] || '').replace(/\D/g, '').slice(0, 20)
            if (!phone) return

            const name = columns[1] || ''
            const bodyValues: Record<string, string> = { ...metaBodyParameterValues }
            selectedBodyVariables.forEach((variable, variableIndex) => {
                const key = String(variable)
                const rowValue = columns[variableIndex + 2] || ''
                if (rowValue) bodyValues[key] = rowValue
                if (!bodyValues[key] && variable === 1 && name) bodyValues[key] = name
            })

            const missingVariables = selectedBodyVariables
                .filter(variable => !bodyValues[String(variable)]?.trim())
                .map(variable => `{{${variable}}}`)

            recipients.push({
                phone,
                name: name || undefined,
                templateParameters: buildMetaTemplateParameters(bodyValues),
                metadata: {
                    source_line: lineIndex + 1,
                    personalized_campaign_row: true,
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
            const missingFields = getMissingMetaTemplateFields(metaAudiencePersonalized)
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

    const currentInstance = instances.find(i => i.id === selectedInstance)
    const approvedMetaTemplates = metaTemplates.filter(template => String(template.status || '').toUpperCase() === 'APPROVED')
    const activeMetaSenders = metaSenders.filter(sender => sender.local_status === 'active')
    const selectedMetaTemplate = approvedMetaTemplates.find(template => template.name === metaTemplateName && template.language === metaTemplateLanguage) || null
    const selectedHeaderComponent = findTemplateComponent(selectedMetaTemplate, 'HEADER')
    const selectedBodyComponent = findTemplateComponent(selectedMetaTemplate, 'BODY')
    const selectedFooterComponent = findTemplateComponent(selectedMetaTemplate, 'FOOTER')
    const selectedTemplateButtons = getTemplateButtons(selectedMetaTemplate)
    const selectedHeaderFormat = textValue(selectedHeaderComponent?.format).toUpperCase()
    const selectedHeaderText = textValue(selectedHeaderComponent?.text)
    const selectedBodyText = textValue(selectedBodyComponent?.text)
    const selectedFooterText = textValue(selectedFooterComponent?.text)
    const selectedHeaderVariables = extractTemplateVariables(selectedHeaderText)
    const selectedBodyVariables = extractTemplateVariables(selectedBodyText)
    const previewHeaderText = replaceTemplateVariables(selectedHeaderText, { 1: metaHeaderParameterValue }, 'header')
    const previewBodyText = replaceTemplateVariables(selectedBodyText, metaBodyParameterValues, 'exemplo')
    const parsedMetaRecipientDrafts = sendProvider === 'meta_whatsapp' && metaAudiencePersonalized ? parseMetaRecipientDrafts() : []
    const parsedNumbers = sendProvider === 'meta_whatsapp' && metaAudiencePersonalized
        ? parsedMetaRecipientDrafts.map(recipient => recipient.phone)
        : parseNumbers()

    if (loading) return <AdminLoadingState minHeight="400px" />

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', margin: 0 }}>
                        <Send size={26} style={{ color: 'var(--gold)' }} /> Campanhas Meta
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                        Envios oficiais pelo WhatsApp Cloud API para listas com opt-in
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
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
                display: 'grid', gap: '10px',
            }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Canal de envio
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                        { value: 'meta_whatsapp', label: 'Meta Oficial Campanhas' },
                        { value: 'connectyhub', label: 'ConnectyHub Atendimento' },
                    ].map(option => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setSendProvider(option.value as 'connectyhub' | 'meta_whatsapp')}
                            style={{
                                padding: '9px 14px',
                                borderRadius: '8px',
                                border: `1px solid ${sendProvider === option.value ? 'var(--gold)' : 'var(--border)'}`,
                                background: sendProvider === option.value ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
                                color: sendProvider === option.value ? 'var(--gold)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                    {sendProvider === 'meta_whatsapp'
                        ? 'Use somente listas com opt-in e templates aprovados. Respostas devem apontar para o numero ConnectyHub de atendimento.'
                        : 'Use para fluxos de atendimento, testes internos e operacao dos agentes IA conectados.'}
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
                                            <input value={metaTemplateName} onChange={e => setMetaTemplateName(e.target.value)}
                                                placeholder="ex: blog_news_update"
                                                style={{
                                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                                }} />
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
                                        <option value="">Pool automatico por capacidade</option>
                                        {activeMetaSenders.map(sender => (
                                            <option key={sender.id} value={sender.id}>
                                                {sender.display_name || sender.phone_number} - {sender.phone_number} ({sender.daily_sent_count}/{sender.daily_limit})
                                            </option>
                                        ))}
                                    </select>
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
                                                        <input
                                                            value={metaHeaderMediaUrl}
                                                            onChange={e => setMetaHeaderMediaUrl(e.target.value)}
                                                            placeholder="https://... arquivo publico aprovado no template"
                                                            style={{
                                                                width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                                                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                                                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                                            }}
                                                        />
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

                        {/* Numbers */}
                        <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                {sendProvider === 'meta_whatsapp' && metaAudiencePersonalized
                                    ? 'Lista personalizada'
                                    : 'Números (um por linha, ou separados por vírgula)'}
                            </label>
                            <textarea value={numbersInput} onChange={e => setNumbersInput(e.target.value)}
                                placeholder={sendProvider === 'meta_whatsapp' && metaAudiencePersonalized
                                    ? "5547999999999; Maria; Maria; Apartamento frente mar; https://guilhermepilger.ai/imovel\n5547888888888; Joao; Joao; Cobertura vista mar; https://guilhermepilger.ai/imovel-2"
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
                                    Formato: telefone; nome; valor para {'{{1}}'}; valor para {'{{2}}'}; valor para {'{{3}}'}.
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
                    loading={loadingMetaCampaigns}
                    statusFilter={metaStatusFilter}
                    expandedCampaignId={expandedMetaCampaignId}
                    loadingDetailCampaignId={loadingMetaCampaignDetail}
                    campaignDetails={metaCampaignDetails}
                    onStatusFilterChange={setMetaStatusFilter}
                    onRefresh={loadMetaCampaigns}
                    onToggleDetail={toggleMetaCampaignDetail}
                    onManage={manageMetaCampaign}
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
    }
    return labels[status] || status
}

function metaStatusColor(status: string) {
    if (status === 'completed') return '#22c55e'
    if (status === 'failed' || status === 'cancelled') return '#ef4444'
    if (status === 'paused') return '#6366f1'
    if (status === 'scheduled') return '#38bdf8'
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

function MetaOfficialCampaignPanel({
    campaigns,
    senders,
    summary,
    loading,
    statusFilter,
    expandedCampaignId,
    loadingDetailCampaignId,
    campaignDetails,
    onStatusFilterChange,
    onRefresh,
    onToggleDetail,
    onManage,
}: {
    campaigns: MetaCampaign[]
    senders: MetaSender[]
    summary: MetaCampaignSummary | null
    loading: boolean
    statusFilter: string
    expandedCampaignId: string
    loadingDetailCampaignId: string
    campaignDetails: Record<string, MetaCampaignDetail>
    onStatusFilterChange: (value: string) => void
    onRefresh: () => void
    onToggleDetail: (campaignId: string) => void
    onManage: (campaignId: string, action: 'pause' | 'resume' | 'cancel') => void
}) {
    const metricItems = [
        { label: 'Campanhas', value: summary?.total || 0, icon: MessageSquare, color: 'var(--gold)' },
        { label: 'Destinatarios', value: summary?.recipients || 0, icon: Users, color: '#38bdf8' },
        { label: 'Enviadas', value: summary?.sent || 0, icon: CheckCircle2, color: '#22c55e' },
        { label: 'Falhas', value: summary?.failed || 0, icon: AlertCircle, color: '#ef4444' },
    ]

    return (
        <div style={{ display: 'grid', gap: '14px' }}>
            <div style={{
                padding: '18px 20px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                display: 'grid',
                gap: '14px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                        <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                            <MessageSquare size={18} style={{ color: 'var(--gold)' }} /> Campanhas Oficiais Meta
                        </h2>
                        <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Fila oficial com templates aprovados, opt-in, status de entrega e varios numeros Meta.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <select
                            value={statusFilter}
                            onChange={e => onStatusFilterChange(e.target.value)}
                            style={{
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
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                background: 'rgba(255,255,255,0.04)',
                                color: 'var(--text-secondary)',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            <RefreshCw size={14} className={loading ? 'spin' : ''} />
                            Atualizar
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                    {metricItems.map(item => {
                        const Icon = item.icon
                        return (
                            <div key={item.label} style={{
                                padding: '12px',
                                borderRadius: '10px',
                                border: '1px solid var(--border)',
                                background: 'rgba(255,255,255,0.03)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                            }}>
                                <Icon size={17} style={{ color: item.color }} />
                                <div>
                                    <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                                        {Number(item.value || 0).toLocaleString('pt-BR')}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.label}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div style={{
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                display: 'grid',
                gap: '8px',
            }}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Numeros oficiais sincronizados</strong>
                {senders.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        Nenhum numero Meta sincronizado ainda. Use Testar Conexao na Sala de Manutencao para sincronizar.
                    </span>
                ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {senders.map(sender => (
                            <span key={sender.id} style={{
                                padding: '7px 9px',
                                borderRadius: '999px',
                                border: '1px solid var(--border)',
                                color: sender.local_status === 'active' ? '#22c55e' : 'var(--text-muted)',
                                background: sender.local_status === 'active' ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                            }}>
                                {sender.display_name || sender.phone_number} | {sender.daily_sent_count}/{sender.daily_limit}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '34px', color: 'var(--text-muted)' }}>
                    <Loader2 size={20} className="spin" /> Carregando campanhas Meta...
                </div>
            ) : campaigns.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '34px',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                }}>
                    <Send size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                    <p style={{ margin: 0 }}>Nenhuma campanha oficial Meta encontrada.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                    {campaigns.map(campaign => (
                        <MetaCampaignCard
                            key={campaign.id}
                            campaign={campaign}
                            sender={senders.find(item => item.id === campaign.default_sender_id)}
                            detail={campaignDetails[campaign.id]}
                            expanded={expandedCampaignId === campaign.id}
                            loadingDetail={loadingDetailCampaignId === campaign.id}
                            onToggleDetail={onToggleDetail}
                            onManage={onManage}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function MetaCampaignCard({
    campaign,
    sender,
    detail,
    expanded,
    loadingDetail,
    onToggleDetail,
    onManage,
}: {
    campaign: MetaCampaign
    sender?: MetaSender
    detail?: MetaCampaignDetail
    expanded: boolean
    loadingDetail: boolean
    onToggleDetail: (campaignId: string) => void
    onManage: (campaignId: string, action: 'pause' | 'resume' | 'cancel') => void
}) {
    const progress = metaProgress(campaign)
    const statusColor = metaStatusColor(campaign.status)
    const finalStatus = ['completed', 'cancelled', 'failed'].includes(campaign.status)
    const canPause = ['scheduled', 'queued', 'sending', 'preparing'].includes(campaign.status)
    const canResume = campaign.status === 'paused'

    return (
        <div style={{
            padding: '16px 18px',
            borderRadius: '12px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            display: 'grid',
            gap: '12px',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                            width: '9px',
                            height: '9px',
                            borderRadius: '50%',
                            background: statusColor,
                            boxShadow: campaign.status === 'sending' ? '0 0 8px rgba(245,158,11,0.5)' : 'none',
                        }} />
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                            {campaign.name || 'Campanha Meta'}
                        </strong>
                        <span style={{
                            color: statusColor,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--border)',
                            borderRadius: '999px',
                            padding: '3px 8px',
                            fontSize: '0.68rem',
                            fontWeight: 900,
                        }}>
                            {metaStatusLabel(campaign.status)}
                        </span>
                    </div>
                    <div style={{ marginTop: '5px', color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                        Template: {campaign.template_name || '-'} ({campaign.template_language || 'pt_BR'})
                        {' | '}
                        Tipo: {campaign.campaign_type}
                        {sender ? ` | Numero: ${sender.display_name || sender.phone_number}` : ''}
                    </div>
                    <div style={{ marginTop: '3px', color: 'var(--text-muted)', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <Clock size={13} />
                        Criada em {formatMetaDate(campaign.created_at)}
                        {campaign.scheduled_for ? ` | agendada para ${formatMetaDate(campaign.scheduled_for)}` : ''}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                        type="button"
                        onClick={() => onToggleDetail(campaign.id)}
                        title="Detalhes"
                        style={{ padding: '7px', borderRadius: '7px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                        {loadingDetail ? <Loader2 size={14} className="spin" /> : expanded ? <ChevronUp size={14} /> : <Search size={14} />}
                    </button>
                    {canPause && (
                        <button
                            type="button"
                            onClick={() => onManage(campaign.id, 'pause')}
                            title="Pausar"
                            style={{ padding: '7px', borderRadius: '7px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', cursor: 'pointer' }}
                        >
                            <Pause size={14} />
                        </button>
                    )}
                    {canResume && (
                        <button
                            type="button"
                            onClick={() => onManage(campaign.id, 'resume')}
                            title="Retomar"
                            style={{ padding: '7px', borderRadius: '7px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', cursor: 'pointer' }}
                        >
                            <Play size={14} />
                        </button>
                    )}
                    {!finalStatus && (
                        <button
                            type="button"
                            onClick={() => onManage(campaign.id, 'cancel')}
                            title="Cancelar"
                            style={{ padding: '7px', borderRadius: '7px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gap: '7px' }}>
                <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: campaign.status === 'completed' ? '#22c55e' : 'var(--gold)',
                        borderRadius: '999px',
                        transition: 'width 0.3s',
                    }} />
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                    <span>{progress}%</span>
                    <span>Total {campaign.total_recipients || 0}</span>
                    <span>Fila {campaign.total_queued || 0}</span>
                    <span>Enviadas {campaign.total_sent || 0}</span>
                    <span>Entregues {campaign.total_delivered || 0}</span>
                    <span>Lidas {campaign.total_read || 0}</span>
                    <span>Falhas {campaign.total_failed || 0}</span>
                    <span>Bloqueadas/opt-out {campaign.total_skipped || 0}</span>
                </div>
            </div>

            {expanded && (
                <div style={{
                    display: 'grid',
                    gap: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border)',
                }}>
                    {loadingDetail && !detail ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <Loader2 size={14} className="spin" /> Carregando detalhes...
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gap: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>Ultimos destinatarios</strong>
                                {(detail?.recipients || []).length === 0 ? (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Nenhum destinatario encontrado.</span>
                                ) : (
                                    <div style={{ display: 'grid', gap: '6px' }}>
                                        {(detail?.recipients || []).slice(0, 12).map(recipient => {
                                            const color = metaStatusColor(recipient.status)
                                            return (
                                                <div key={recipient.id} style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'minmax(120px, 1fr) minmax(80px, 110px) minmax(120px, 1.2fr)',
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
                                                    <span style={{ color, fontWeight: 800 }}>{metaStatusLabel(recipient.status)}</span>
                                                    <span style={{ color: recipient.error_message ? '#ef4444' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {recipient.error_message || recipient.provider_message_id || formatMetaDate(recipient.created_at)}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gap: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>Ultimos eventos Meta</strong>
                                {(detail?.events || []).length === 0 ? (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Nenhum evento de status recebido ainda.</span>
                                ) : (
                                    <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                                        {(detail?.events || []).slice(0, 16).map(event => (
                                            <span key={event.id} style={{
                                                padding: '6px 8px',
                                                borderRadius: '999px',
                                                border: '1px solid var(--border)',
                                                color: metaStatusColor(event.event_status || event.event_type),
                                                background: 'rgba(255,255,255,0.03)',
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                            }}>
                                                {event.event_status || event.event_type} | {formatMetaDate(event.received_at)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
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
