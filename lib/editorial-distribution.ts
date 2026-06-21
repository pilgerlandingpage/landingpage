import { getPublicAppUrl } from '@/lib/app-url'
import { saveAppConfig } from '@/lib/admin/app-config'
import { parseEmailAgentTemplatesJson, getDefaultEmailAgentTemplatesJson, type EmailAgentTemplateDefinition } from '@/lib/email/agent-templates'
import { sendBrevoEmail } from '@/lib/email/brevo'
import { parseWhatsAppEditorialTemplatesJson, getDefaultWhatsAppEditorialTemplatesJson, type WhatsAppEditorialTemplateDefinition } from '@/lib/whatsapp/editorial-templates'
import { parsePushEditorialTemplatesJson, getDefaultPushEditorialTemplatesJson, type PushEditorialTemplateDefinition } from '@/lib/push/editorial-templates'
import { sendPushToVisitor, type PushPayload } from '@/lib/push'
import { resolveEventWhatsAppCtaPhone } from '@/lib/events/whatsapp-cta'
import { buildTrackedWhatsAppLink } from '@/lib/tracking/whatsapp-links'
import { normalizeWhatsAppPhone, recordLeadOutboundContext } from '@/lib/whatsapp/lead-sync'
import { sendMenuMessage, sendWhatsAppMessage } from '@/lib/uazapi'
import { isTechnicalBlogSummary, pickPublicBlogSummary } from '@/lib/blog/types'
import { buildAgentContextBrief, getAgentEcosystemContext, recordEcosystemEvent } from '@/lib/intelligence/ecosystem'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'

type SupabaseAdminLike = {
    from: (table: string) => any
}

type EditorialContentType = 'blog' | 'news'
type DistributionContentType = EditorialContentType | 'property'
type EditorialChannel = 'email' | 'whatsapp' | 'push'
type EditorialTrigger = 'blog_published' | 'news_published'
type DistributionTrigger = EditorialTrigger | 'property_recommendation'

type EditorialConfig = {
    agentEnabled: boolean
    autopilot: boolean
    approvalRequired: boolean
    recommendationsEnabled: boolean
    emailEnabled: boolean
    whatsappEnabled: boolean
    pushEnabled: boolean
    audience: string
    emailIntervalMinutes: number
    whatsappIntervalMinutes: number
    pushIntervalMinutes: number
    emailDailyLimit: number
    whatsappDailyLimit: number
    pushDailyLimit: number
    recommendationMinScore: number
    recommendationBatchLimit: number
    minHoursBetweenLeadMessages: number
    allowedStartTime: string
    allowedEndTime: string
    templates: EmailAgentTemplateDefinition[]
    whatsappTemplates: WhatsAppEditorialTemplateDefinition[]
    pushTemplates: PushEditorialTemplateDefinition[]
}

export type EditorialCampaignSummary = {
    campaign_id: string
    post_id: string
    post_title: string
    post_slug: string
    content_type: DistributionContentType
    trigger: DistributionTrigger
    audience: string
    approval_status: string
    status: string
    created_at: string
    scheduled_for: string | null
    counts: Record<string, number>
    channel_counts: Record<EditorialChannel, number>
    sent: number
    failed: number
    waiting: number
    queued: number
    total: number
}

const EDITORIAL_TRIGGER_TYPES: EditorialTrigger[] = ['blog_published', 'news_published']
const DISTRIBUTION_TRIGGER_TYPES: DistributionTrigger[] = ['blog_published', 'news_published', 'property_recommendation']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TIME_ZONE = 'America/Sao_Paulo'
const PROPERTY_RECOMMENDATION_FIELDS = [
    'id',
    'title',
    'description',
    'city',
    'state',
    'neighborhood',
    'price',
    'property_type',
    'bedrooms',
    'bathrooms',
    'suites',
    'parking_spaces',
    'area_m2',
    'area_private_m2',
    'featured_image',
    'images',
    'exclusive',
    'source_status',
    'created_at',
    'amenities',
].join(',')

function isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function metadataRecord(value: unknown): Record<string, any> {
    return isRecord(value) ? value : {}
}

function safeArray<T = any>(value: unknown): T[] {
    return Array.isArray(value) ? value as T[] : []
}

function normalizeComparable(value: unknown) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
}

function normalizeText(value: unknown) {
    return String(value || '').trim()
}

function normalizeDistributionTrigger(value: unknown): DistributionTrigger | null {
    const trigger = normalizeText(value)
    return DISTRIBUTION_TRIGGER_TYPES.includes(trigger as DistributionTrigger)
        ? trigger as DistributionTrigger
        : null
}

function cooldownTriggerTypesFor(trigger: DistributionTrigger): DistributionTrigger[] {
    return trigger === 'property_recommendation'
        ? DISTRIBUTION_TRIGGER_TYPES
        : EDITORIAL_TRIGGER_TYPES
}

function distributionQueuePriority(row: Record<string, any>) {
    const context = metadataRecord(row.context)
    const trigger = normalizeDistributionTrigger(row.trigger_type || context.trigger)
    return trigger === 'property_recommendation' ? 1 : 0
}

function dateMs(value: unknown) {
    const timestamp = Date.parse(String(value || ''))
    return Number.isFinite(timestamp) ? timestamp : 0
}

function compareDistributionQueueRows(a: Record<string, any>, b: Record<string, any>) {
    const priorityDiff = distributionQueuePriority(a) - distributionQueuePriority(b)
    if (priorityDiff !== 0) return priorityDiff

    if (distributionQueuePriority(a) === 0) {
        const editorialRecencyDiff = dateMs(b.created_at) - dateMs(a.created_at)
        if (editorialRecencyDiff !== 0) return editorialRecencyDiff
    }

    return dateMs(a.scheduled_for) - dateMs(b.scheduled_for) || dateMs(a.created_at) - dateMs(b.created_at)
}

function normalizeEmail(value: unknown) {
    const email = normalizeText(value).toLowerCase()
    return EMAIL_RE.test(email) ? email : ''
}

function normalizePositiveInt(value: unknown, fallback: number, min = 1, max = 10000) {
    const parsed = Number.parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, parsed))
}

function normalizePostText(value: unknown, max = 220) {
    return normalizeText(value)
        .replace(/\s+/g, ' ')
        .slice(0, max)
}

function editorialSummaryFallback(contentType: DistributionContentType) {
    if (contentType === 'news') return 'Uma noticia selecionada pela equipe Guilherme Pilger para acompanhar o mercado imobiliario do litoral.'
    if (contentType === 'property') return 'Uma oportunidade selecionada pela equipe Guilherme Pilger com base no seu interesse recente.'
    return 'Uma leitura selecionada pela equipe Guilherme Pilger para comprar ou investir com mais contexto.'
}

function publicEditorialSummary(post: Record<string, any>, contentType: DistributionContentType, max = 420) {
    const summary = pickPublicBlogSummary({
        excerpt: post.excerpt,
        meta_description: post.meta_description,
        content_markdown: post.content_markdown,
    })

    return normalizePostText(summary || editorialSummaryFallback(contentType), max)
}

function stripTechnicalOutboundText(value: unknown) {
    const text = normalizeText(value)
    if (!text) return ''

    return text
        .split(/\r?\n/)
        .filter(line => {
            const clean = line.trim()
            return !clean || !isTechnicalBlogSummary(clean)
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function stripTechnicalOutboundHtml(value: unknown) {
    const html = normalizeText(value)
    if (!html) return ''

    return html
        .split(/\r?\n/)
        .filter(line => {
            const visibleText = line.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            return !visibleText || !isTechnicalBlogSummary(visibleText)
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function isNewsPost(post: Record<string, any>) {
    const category = normalizeText(post.category).toLowerCase()
    const generatedBy = normalizeText(post.generated_by).toLowerCase()
    const tags = Array.isArray(post.tags) ? post.tags.map(tag => normalizeText(tag).toLowerCase()) : []
    return generatedBy.includes('news') || category.includes('noticia') || tags.some(tag => tag.includes('noticia'))
}

function resolveContentType(post: Record<string, any>): EditorialContentType {
    return isNewsPost(post) ? 'news' : 'blog'
}

function resolveTrigger(contentType: EditorialContentType): EditorialTrigger {
    return contentType === 'news' ? 'news_published' : 'blog_published'
}

function buildCampaignId(post: Record<string, any>, trigger: EditorialTrigger) {
    return `editorial:${trigger}:${post.id}`
}

function buildContentUrl(post: Record<string, any>, contentType: DistributionContentType, origin?: string | null) {
    const slug = normalizeText(post.slug)
    if (contentType === 'news') {
        return `${getPublicAppUrl(origin)}/noticias${slug ? `/${encodeURIComponent(slug)}` : ''}`
    }
    return `${getPublicAppUrl(origin)}/blog${slug ? `/${encodeURIComponent(slug)}` : ''}`
}

function addUtm(rawUrl: string, params: Record<string, string | null | undefined>) {
    try {
        const url = new URL(rawUrl)
        for (const [key, value] of Object.entries(params)) {
            if (value) url.searchParams.set(key, value)
        }
        return url.toString()
    } catch {
        return rawUrl
    }
}

function formatSaoPauloDate(value?: string | null) {
    const date = value ? new Date(value) : new Date()
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: TIME_ZONE,
    }).format(date)
}

function getSaoPauloTimeParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date)
    const hour = Number(parts.find(part => part.type === 'hour')?.value || 0)
    const minute = Number(parts.find(part => part.type === 'minute')?.value || 0)
    return { hour, minute, minuteOfDay: hour * 60 + minute }
}

function timeToMinutes(value: string, fallback: string) {
    const raw = /^\d{2}:\d{2}$/.test(value) ? value : fallback
    const [hour, minute] = raw.split(':').map(part => Number(part))
    return Math.max(0, Math.min(1439, hour * 60 + minute))
}

function isWithinWindow(config: Pick<EditorialConfig, 'allowedStartTime' | 'allowedEndTime'>, date = new Date()) {
    const start = timeToMinutes(config.allowedStartTime, '09:00')
    const end = timeToMinutes(config.allowedEndTime, '18:00')
    const now = getSaoPauloTimeParts(date).minuteOfDay
    if (start <= end) return now >= start && now <= end
    return now >= start || now <= end
}

function nextWindowStart(config: Pick<EditorialConfig, 'allowedStartTime' | 'allowedEndTime'>, date = new Date()) {
    if (isWithinWindow(config, date)) return date
    const start = timeToMinutes(config.allowedStartTime, '09:00')
    const { minuteOfDay } = getSaoPauloTimeParts(date)
    const deltaMinutes = minuteOfDay < start ? start - minuteOfDay : (24 * 60 - minuteOfDay) + start
    return new Date(date.getTime() + deltaMinutes * 60_000)
}

function htmlToText(html: string) {
    return String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function renderTemplate(value: string, variables: Record<string, string>) {
    return String(value || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => variables[key] ?? `{${key}}`)
}

async function loadConfigMap(supabase: SupabaseAdminLike) {
    const keys = [
        'email_agent_enabled',
        'email_agent_autopilot',
        'email_agent_require_approval',
        'email_agent_send_interval_minutes',
        'email_agent_daily_limit',
        'email_agent_min_hours_between_lead_messages',
        'email_agent_allowed_start_time',
        'email_agent_allowed_end_time',
        'email_agent_default_audience',
        'email_agent_templates',
        'editorial_distribution_recommendations_enabled',
        'editorial_distribution_recommendation_min_score',
        'editorial_distribution_recommendation_batch_limit',
        'editorial_distribution_email_enabled',
        'editorial_distribution_whatsapp_enabled',
        'editorial_distribution_push_enabled',
        'editorial_distribution_whatsapp_interval_minutes',
        'editorial_distribution_whatsapp_daily_limit',
        'editorial_distribution_whatsapp_templates',
        'editorial_distribution_push_interval_minutes',
        'editorial_distribution_push_daily_limit',
        'editorial_distribution_push_templates',
    ]

    const { data, error } = await supabase
        .from('app_config')
        .select('key,value')
        .in('key', keys)

    if (error) throw error
    return Object.fromEntries((data || []).map((row: any) => [String(row.key), String(row.value || '')]))
}

async function loadEditorialConfig(supabase: SupabaseAdminLike): Promise<EditorialConfig> {
    const config = await loadConfigMap(supabase)
    return {
        agentEnabled: config.email_agent_enabled !== 'false',
        autopilot: config.email_agent_autopilot === 'true',
        approvalRequired: config.email_agent_require_approval !== 'false',
        recommendationsEnabled: config.editorial_distribution_recommendations_enabled !== 'false',
        emailEnabled: config.editorial_distribution_email_enabled !== 'false',
        whatsappEnabled: config.editorial_distribution_whatsapp_enabled !== 'false',
        pushEnabled: config.editorial_distribution_push_enabled === 'true',
        audience: config.email_agent_default_audience || 'active_leads',
        emailIntervalMinutes: normalizePositiveInt(config.email_agent_send_interval_minutes, 5, 1, 1440),
        whatsappIntervalMinutes: normalizePositiveInt(config.editorial_distribution_whatsapp_interval_minutes || config.email_agent_send_interval_minutes, 5, 1, 1440),
        pushIntervalMinutes: normalizePositiveInt(config.editorial_distribution_push_interval_minutes || config.email_agent_send_interval_minutes, 5, 1, 1440),
        emailDailyLimit: normalizePositiveInt(config.email_agent_daily_limit, 150, 1, 5000),
        whatsappDailyLimit: normalizePositiveInt(config.editorial_distribution_whatsapp_daily_limit, 120, 1, 5000),
        pushDailyLimit: normalizePositiveInt(config.editorial_distribution_push_daily_limit, 300, 1, 10000),
        recommendationMinScore: normalizePositiveInt(config.editorial_distribution_recommendation_min_score, 45, 1, 100),
        recommendationBatchLimit: normalizePositiveInt(config.editorial_distribution_recommendation_batch_limit, 25, 1, 500),
        minHoursBetweenLeadMessages: normalizePositiveInt(config.email_agent_min_hours_between_lead_messages, 24, 1, 720),
        allowedStartTime: config.email_agent_allowed_start_time || '09:00',
        allowedEndTime: config.email_agent_allowed_end_time || '18:00',
        templates: parseEmailAgentTemplatesJson(config.email_agent_templates || getDefaultEmailAgentTemplatesJson()),
        whatsappTemplates: parseWhatsAppEditorialTemplatesJson(config.editorial_distribution_whatsapp_templates || getDefaultWhatsAppEditorialTemplatesJson()),
        pushTemplates: parsePushEditorialTemplatesJson(config.editorial_distribution_push_templates || getDefaultPushEditorialTemplatesJson()),
    }
}

function templateForTrigger(config: EditorialConfig, trigger: EditorialTrigger, audience: string) {
    return (
        config.templates.find(template => template.status === 'active' && template.trigger === trigger && template.audience === audience) ||
        config.templates.find(template => template.status === 'active' && template.trigger === trigger) ||
        config.templates.find(template => template.trigger === trigger) ||
        null
    )
}

function whatsappTemplateForTrigger(config: EditorialConfig, trigger: EditorialTrigger, audience: string) {
    return (
        config.whatsappTemplates.find(template => template.status === 'active' && template.trigger === trigger && template.audience === audience) ||
        config.whatsappTemplates.find(template => template.status === 'active' && template.trigger === trigger) ||
        config.whatsappTemplates.find(template => template.trigger === trigger) ||
        null
    )
}

function pushTemplateForTrigger(config: EditorialConfig, trigger: EditorialTrigger, audience: string) {
    return (
        config.pushTemplates.find(template => template.status === 'active' && template.trigger === trigger && template.audience === audience) ||
        config.pushTemplates.find(template => template.status === 'active' && template.trigger === trigger) ||
        config.pushTemplates.find(template => template.trigger === trigger) ||
        null
    )
}

function leadMatchesAudience(lead: Record<string, any>, audience: string) {
    const stage = normalizeText(lead.funnel_stage).toLowerCase()
    const acquiredVia = normalizeText(lead.acquired_via).toLowerCase()
    const metadata = metadataRecord(lead.metadata)

    if (metadata.unsubscribed === true || metadata.email_unsubscribed === true || metadata.content_unsubscribed === true) return false
    if (String(metadata.status || '').toLowerCase() === 'lost') return false
    if (stage === 'lost') return false

    if (audience === 'all_leads') return true
    if (audience === 'event_leads') return acquiredVia.includes('event') || Boolean(metadata.event_id || metadata.event_registration_id)
    if (audience === 'property_leads') return Boolean(lead.lead_purpose || metadata.property_id || metadata.last_property_id)
    if (audience === 'broker_candidates') return false

    return stage !== 'visitor'
}

async function loadAudienceLeads(supabase: SupabaseAdminLike, audience: string) {
    const { data, error } = await supabase
        .from('leads')
        .select('id,visitor_id,name,email,phone,phone_e164,push_subscribed,push_subscribed_lead,funnel_stage,lead_score,lead_classification,lead_purpose,acquired_via,metadata,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(5000)

    if (error) throw error

    return (data || []).filter((lead: any) => leadMatchesAudience(lead, audience))
}

function buildWhatsAppCtaUrl(post: Record<string, any>, contentType: EditorialContentType, lead: Record<string, any>, ctaPhone: string) {
    const phone = normalizeWhatsAppPhone(ctaPhone)
    if (!phone) return ''

    const text = contentType === 'news'
        ? `Oi, vi a noticia "${post.title}" e queria tirar uma duvida.`
        : `Oi, li o artigo "${post.title}" e queria tirar uma duvida.`
    const directUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`

    return buildTrackedWhatsAppLink({
        url: directUrl,
        leadPhone: lead.phone_e164 || lead.phone || null,
        label: 'Falar no WhatsApp',
        title: normalizeText(post.title),
        type: 'whatsapp',
        campaign: `${contentType}_published_email_cta`,
        content: normalizeText(post.slug || post.id),
        source: 'email_agent',
        medium: 'email',
    })
}

function buildTemplateVariables(params: {
    post: Record<string, any>
    lead: Record<string, any>
    contentType: EditorialContentType
    contentUrl: string
    whatsappUrl: string
}) {
    const { post, lead, contentType, contentUrl, whatsappUrl } = params
    const title = normalizePostText(post.title, 180)
    const summary = publicEditorialSummary(post, contentType, 420)
    const name = normalizeText(lead.name) || 'tudo bem'

    return {
        nome: name,
        email: normalizeEmail(lead.email),
        titulo_blog: title,
        resumo_blog: summary,
        link_artigo: contentUrl,
        titulo_noticia: title,
        resumo_noticia: summary,
        link_noticia: contentUrl,
        data_noticia: formatSaoPauloDate(post.published_at || post.created_at),
        link_whatsapp: whatsappUrl,
        link_cta: contentUrl,
        conteudo: contentType === 'news'
            ? `${title}\n\n${summary}`
            : `${title}\n\n${summary}`,
    }
}

async function buildQueueContext(params: {
    post: Record<string, any>
    lead: Record<string, any>
    config: EditorialConfig
    template: EmailAgentTemplateDefinition | null
    whatsappTemplate: WhatsAppEditorialTemplateDefinition | null
    pushTemplate: PushEditorialTemplateDefinition | null
    contentType: EditorialContentType
    trigger: EditorialTrigger
    channel: EditorialChannel
    contentUrl: string
    campaignId: string
    whatsappCtaPhone: string
    ecosystemSummary?: string
}) {
    const { post, lead, config, template, whatsappTemplate, pushTemplate, contentType, trigger, channel, contentUrl, campaignId, whatsappCtaPhone, ecosystemSummary } = params
    const defaultCtaLabel = contentType === 'news' ? 'Ler noticia' : 'Ler artigo'
    const ctaLabel = channel === 'whatsapp'
        ? (whatsappTemplate?.ctaLabel || defaultCtaLabel)
        : channel === 'push'
            ? (pushTemplate?.ctaLabel || defaultCtaLabel)
            : (template?.ctaLabel || defaultCtaLabel)
    const trackingContent = normalizeText(post.slug || post.id)
    const trackingTitle = normalizePostText(post.title, 120)
    const trackedContentUrl = channel === 'whatsapp'
        ? buildTrackedWhatsAppLink({
            url: contentUrl,
            leadId: normalizeText(lead.id),
            leadPhone: lead.phone_e164 || lead.phone || null,
            label: ctaLabel,
            title: trackingTitle,
            type: contentType,
            campaign: trigger,
            content: trackingContent,
            contentId: normalizeText(post.id),
            source: 'whatsapp',
            medium: 'whatsapp',
        })
        : addUtm(contentUrl, {
            utm_source: channel === 'email' ? 'brevo' : channel,
            utm_medium: channel,
            utm_campaign: trigger,
            utm_content: trackingContent,
            lead_id: normalizeText(lead.id),
            event_type: `${channel}_${contentType}_click`,
            link_type: contentType,
            link_label: ctaLabel,
            link_title: trackingTitle,
        })
    const whatsappUrl = buildWhatsAppCtaUrl(post, contentType, lead, whatsappCtaPhone)
    const variables = buildTemplateVariables({
        post,
        lead,
        contentType,
        contentUrl: trackedContentUrl,
        whatsappUrl,
    })

    const subject = template
        ? renderTemplate(template.subject, variables)
        : `${contentType === 'news' ? 'Nova noticia' : 'Novo artigo'}: ${normalizePostText(post.title, 140)}`
    const htmlContent = template?.html
        ? renderTemplate(template.html, variables)
        : `<p>Ola ${variables.nome},</p><p>${variables.conteudo}</p><p><a href="${trackedContentUrl}">Abrir conteudo</a></p>`
    const textContent = template?.text
        ? renderTemplate(template.text, variables)
        : htmlToText(htmlContent)
    const defaultWhatsappMessage = [
        `Ola, ${variables.nome}.`,
        '',
        contentType === 'news'
            ? 'Separei uma noticia rapida que pode te ajudar a acompanhar o mercado imobiliario do litoral:'
            : 'Separei uma leitura rapida que pode te ajudar a comprar ou investir com mais contexto:',
        '',
        `*${normalizePostText(post.title, 180)}*`,
        variables.conteudo.replace(normalizePostText(post.title, 180), '').trim(),
        '',
        'Se quiser, toque no botao para ler no site.',
        '',
        'Para parar de receber esse tipo de aviso, responda PARAR.',
    ].filter(Boolean).join('\n')
    const whatsappMessage = whatsappTemplate?.message
        ? renderTemplate(whatsappTemplate.message, variables)
        : defaultWhatsappMessage
    const defaultPushTitle = contentType === 'news' ? 'Nova noticia no radar' : 'Novo artigo para voce'
    const defaultPushBody = `${variables.nome}, ${contentType === 'news' ? 'saiu uma noticia sobre' : 'separei uma leitura sobre'} ${normalizePostText(post.title, 90)}.`
    const pushTitle = pushTemplate?.title
        ? renderTemplate(pushTemplate.title, variables)
        : defaultPushTitle
    const pushBody = pushTemplate?.body
        ? renderTemplate(pushTemplate.body, variables)
        : defaultPushBody

    return {
        type: 'editorial_distribution',
        campaign_id: campaignId,
        content_type: contentType,
        trigger,
        post_id: post.id,
        post_title: normalizeText(post.title),
        post_slug: normalizeText(post.slug),
        post_excerpt: variables.resumo_noticia || variables.resumo_blog,
        post_category: normalizeText(post.category),
        audience: config.audience,
        channel,
        target_email: normalizeEmail(lead.email),
        target_phone: normalizeWhatsAppPhone(lead.phone_e164 || lead.phone),
        target_visitor_id: normalizeText(lead.visitor_id),
        target_name: normalizeText(lead.name),
        subject,
        html_content: htmlContent,
        text_content: textContent,
        whatsapp_message: whatsappMessage,
        whatsapp_template_id: whatsappTemplate?.id || null,
        whatsapp_template_name: whatsappTemplate?.name || null,
        push_title: normalizePostText(pushTitle, 90),
        push_body: normalizePostText(pushBody, 220),
        push_template_id: pushTemplate?.id || null,
        push_template_name: pushTemplate?.name || null,
        content_url: trackedContentUrl,
        link_cta: trackedContentUrl,
        link_whatsapp: whatsappUrl,
        cta_label: ctaLabel,
        approval_required: config.approvalRequired || !config.autopilot,
        approval_status: config.approvalRequired || !config.autopilot ? 'awaiting_approval' : 'approved',
        ecosystem_summary: ecosystemSummary || null,
        created_by_agent: 'gabriel_correio',
        created_at: new Date().toISOString(),
    }
}

function nextScheduleForChannel(
    config: Pick<EditorialConfig, 'allowedStartTime' | 'allowedEndTime'>,
    base: Date,
    index: number,
    intervalMinutes: number
) {
    let cursor = nextWindowStart(config, base)
    for (let step = 0; step < index; step += 1) {
        const candidate = new Date(cursor.getTime() + intervalMinutes * 60_000)
        cursor = isWithinWindow(config, candidate) ? candidate : nextWindowStart(config, candidate)
    }
    return cursor.toISOString()
}

function channelTargetKey(channel: EditorialChannel, value: unknown, leadId?: unknown) {
    const normalized = channel === 'email'
        ? normalizeEmail(value)
        : channel === 'whatsapp'
            ? normalizeWhatsAppPhone(value)
            : normalizeText(value)
    const target = normalized || (leadId ? `lead:${normalizeText(leadId)}` : '')
    return target ? `${channel}:${target.toLowerCase()}` : ''
}

function leadChannelTargetKey(channel: EditorialChannel, lead: Record<string, any>) {
    const metadata = metadataRecord(lead.metadata)
    if (channel === 'email') return channelTargetKey(channel, lead.email, lead.id)
    if (channel === 'whatsapp') return channelTargetKey(channel, lead.phone_e164 || lead.phone, lead.id)
    return channelTargetKey(channel, lead.visitor_id || metadata.visitor_id, lead.id)
}

function rowChannelTargetKey(row: Record<string, any>) {
    const context = metadataRecord(row.context)
    const channel: EditorialChannel = context.channel === 'whatsapp'
        ? 'whatsapp'
        : context.channel === 'push'
            ? 'push'
            : 'email'
    const value = channel === 'email'
        ? context.target_email
        : channel === 'whatsapp'
            ? context.target_phone || row.lead_phone
            : context.target_visitor_id

    return channelTargetKey(channel, value, row.lead_id)
}

async function loadExistingEditorialCampaignTargets(supabase: SupabaseAdminLike, campaignId: string) {
    const { data, error } = await supabase
        .from('agent_workflow_runs')
        .select('id,lead_id,lead_phone,context')
        .in('trigger_type', EDITORIAL_TRIGGER_TYPES)
        .contains('context', { type: 'editorial_distribution', campaign_id: campaignId })
        .limit(10000)

    if (error) throw error

    const keys = new Set<string>()
    for (const row of data || []) {
        const key = rowChannelTargetKey(row)
        if (key) keys.add(key)
    }

    return {
        count: data?.length || 0,
        keys,
    }
}

function nextWindowStartAfterDailyLimit(
    config: Pick<EditorialConfig, 'allowedStartTime' | 'allowedEndTime'>,
    date = new Date()
) {
    return nextWindowStart(config, new Date(date.getTime() + 12 * 60 * 60 * 1000)).toISOString()
}

export async function enqueueEditorialCampaignForPost(
    supabase: SupabaseAdminLike,
    params: {
        post: Record<string, any>
        origin?: string | null
        source?: string
        force?: boolean
    }
) {
    const post = params.post
    if (!post?.id || post.status !== 'published') {
        return { queued: false, skipped: true, reason: 'post_not_published' }
    }

    const config = await loadEditorialConfig(supabase)
    if (!config.agentEnabled) return { queued: false, skipped: true, reason: 'email_agent_disabled' }
    if (!config.emailEnabled && !config.whatsappEnabled && !config.pushEnabled) return { queued: false, skipped: true, reason: 'channels_disabled' }

    const contentType = resolveContentType(post)
    const trigger = resolveTrigger(contentType)
    const campaignId = buildCampaignId(post, trigger)
    const existingCampaign = params.force
        ? { count: 0, keys: new Set<string>() }
        : await loadExistingEditorialCampaignTargets(supabase, campaignId)

    const leads = await loadAudienceLeads(supabase, config.audience)
    const template = templateForTrigger(config, trigger, config.audience)
    const whatsappTemplate = whatsappTemplateForTrigger(config, trigger, config.audience)
    const pushTemplate = pushTemplateForTrigger(config, trigger, config.audience)
    const contentUrl = buildContentUrl(post, contentType, params.origin)
    const whatsappCtaPhone = await resolveEventWhatsAppCtaPhone(supabase)
    const ecosystemSummary = await getAgentEcosystemContext({ supabase: supabase as any, agent: 'distribution', days: 30, limit: 100 })
        .then(context => buildAgentContextBrief(context))
        .catch((error: any) => {
            console.warn('[editorial-distribution] ecosystem context unavailable:', error?.message || error)
            return ''
        })
    const queueStatus = config.approvalRequired || !config.autopilot ? 'waiting' : 'queued'
    const baseSchedule = nextWindowStart(config)
    let emailIndex = 0
    let whatsappIndex = 0
    let pushIndex = 0
    const rows: any[] = []

    for (const lead of leads) {
        const leadName = normalizeText(lead.name) || 'Lead'
        const leadPhone = normalizeWhatsAppPhone(lead.phone_e164 || lead.phone)
        const leadEmail = normalizeEmail(lead.email)
        const leadMetadata = metadataRecord(lead.metadata)
        const leadVisitorId = normalizeText(lead.visitor_id || leadMetadata.visitor_id)
        const leadHasPush = Boolean(
            leadVisitorId &&
            (lead.push_subscribed === true || lead.push_subscribed_lead === true || leadMetadata.push_subscribed_at)
        )

        const emailTargetKey = leadChannelTargetKey('email', lead)
        const whatsappTargetKey = leadChannelTargetKey('whatsapp', lead)
        const pushTargetKey = leadChannelTargetKey('push', lead)

        if (config.emailEnabled && leadEmail && !existingCampaign.keys.has(emailTargetKey)) {
            const context = await buildQueueContext({
                post,
                lead,
                config,
                template,
                whatsappTemplate,
                pushTemplate,
                contentType,
                trigger,
                channel: 'email',
                contentUrl,
                campaignId,
                whatsappCtaPhone,
                ecosystemSummary,
            })
            rows.push({
                lead_id: lead.id,
                lead_phone: leadPhone || null,
                lead_name: leadName,
                status: queueStatus,
                trigger_type: trigger,
                current_node_id: 'email',
                scheduled_for: queueStatus === 'queued' ? nextScheduleForChannel(config, baseSchedule, emailIndex, config.emailIntervalMinutes) : null,
                context,
            })
            emailIndex += 1
            if (emailTargetKey) existingCampaign.keys.add(emailTargetKey)
        }

        if (config.whatsappEnabled && leadPhone && !existingCampaign.keys.has(whatsappTargetKey)) {
            const context = await buildQueueContext({
                post,
                lead,
                config,
                template,
                whatsappTemplate,
                pushTemplate,
                contentType,
                trigger,
                channel: 'whatsapp',
                contentUrl,
                campaignId,
                whatsappCtaPhone,
                ecosystemSummary,
            })
            rows.push({
                lead_id: lead.id,
                lead_phone: leadPhone,
                lead_name: leadName,
                status: queueStatus,
                trigger_type: trigger,
                current_node_id: 'whatsapp',
                scheduled_for: queueStatus === 'queued' ? nextScheduleForChannel(config, baseSchedule, whatsappIndex, config.whatsappIntervalMinutes) : null,
                context,
            })
            whatsappIndex += 1
            if (whatsappTargetKey) existingCampaign.keys.add(whatsappTargetKey)
        }

        if (config.pushEnabled && leadHasPush && !existingCampaign.keys.has(pushTargetKey)) {
            const context = await buildQueueContext({
                post,
                lead,
                config,
                template,
                whatsappTemplate,
                pushTemplate,
                contentType,
                trigger,
                channel: 'push',
                contentUrl,
                campaignId,
                whatsappCtaPhone,
                ecosystemSummary,
            })
            rows.push({
                lead_id: lead.id,
                lead_phone: leadPhone || null,
                lead_name: leadName,
                status: queueStatus,
                trigger_type: trigger,
                current_node_id: 'push',
                scheduled_for: queueStatus === 'queued' ? nextScheduleForChannel(config, baseSchedule, pushIndex, config.pushIntervalMinutes) : null,
                context,
            })
            pushIndex += 1
            if (pushTargetKey) existingCampaign.keys.add(pushTargetKey)
        }
    }

    if (rows.length === 0) {
        return {
            queued: false,
            skipped: true,
            reason: existingCampaign.count > 0 ? 'campaign_already_exists' : 'no_recipients',
            campaign_id: campaignId,
        }
    }

    const { data, error } = await supabase
        .from('agent_workflow_runs')
        .insert(rows)
        .select('id,status,context')

    if (error) throw error

    await logEditorialEvent(supabase, {
        eventType: 'editorial_campaign_created',
        status: queueStatus,
        message: `${rows.length} envios preparados para ${contentType === 'news' ? 'noticia' : 'blog'}.`,
        metadata: {
            campaign_id: campaignId,
            post_id: post.id,
            post_title: post.title,
            content_type: contentType,
            source: params.source || 'publish',
            existing_campaign_rows: existingCampaign.count,
            approval_required: config.approvalRequired || !config.autopilot,
            email: emailIndex,
            whatsapp: whatsappIndex,
            push: pushIndex,
        },
    })

    return {
        queued: true,
        campaign_id: campaignId,
        status: queueStatus,
        total: data?.length || rows.length,
        email: emailIndex,
        whatsapp: whatsappIndex,
        push: pushIndex,
        approval_required: config.approvalRequired || !config.autopilot,
    }
}

export async function enqueueLatestEditorialCampaigns(supabase: SupabaseAdminLike, origin?: string | null) {
    const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(40)

    if (error) throw error

    const posts = data || []
    const latestBlog = posts.find((post: any) => !isNewsPost(post))
    const latestNews = posts.find((post: any) => isNewsPost(post))
    const targets = [latestBlog, latestNews].filter(Boolean)
    const results = []

    for (const post of targets) {
        results.push(await enqueueEditorialCampaignForPost(supabase, {
            post,
            origin,
            source: 'manual_prepare_latest',
        }))
    }

    return results
}

export async function enqueuePublishedEditorialArchive(supabase: SupabaseAdminLike, origin?: string | null) {
    const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(200)

    if (error) throw error

    const results = []
    for (const post of data || []) {
        results.push(await enqueueEditorialCampaignForPost(supabase, {
            post,
            origin,
            source: 'manual_prepare_archive',
        }))
    }

    return {
        total_posts: (data || []).length,
        prepared: results.filter((result: any) => result?.queued).length,
        skipped: results.filter((result: any) => result?.skipped).length,
        results,
    }
}

function uniqueStrings(values: unknown[], limit = 80) {
    const seen = new Set<string>()
    const result: string[] = []
    for (const value of values) {
        const clean = normalizeText(value)
        if (!clean || seen.has(clean)) continue
        seen.add(clean)
        result.push(clean)
        if (result.length >= limit) break
    }
    return result
}

function leadBehaviorSummary(lead: Record<string, any>) {
    return metadataRecord(metadataRecord(lead.metadata).behavior_summary)
}

function collectLeadPropertySignalIds(lead: Record<string, any>) {
    const summary = leadBehaviorSummary(lead)
    return {
        viewed: uniqueStrings(safeArray(summary.viewed_property_ids)),
        liked: uniqueStrings(safeArray(summary.liked_property_ids)),
        disliked: uniqueStrings(safeArray(summary.disliked_property_ids)),
        whatsapp: uniqueStrings(safeArray(summary.whatsapp_property_ids)),
        details: uniqueStrings(safeArray(summary.detail_property_ids)),
    }
}

function leadRecommendedPropertyIds(lead: Record<string, any>) {
    const metadata = metadataRecord(lead.metadata)
    const whatsapp = metadataRecord(metadata.whatsapp)
    const contexts = [
        metadataRecord(whatsapp.last_outbound_context),
        ...safeArray(whatsapp.outbound_contexts).map(metadataRecord),
    ]
    return new Set(
        contexts
            .filter(context => String(context.content_type || '') === 'property')
            .map(context => normalizeText(context.content_id))
            .filter(Boolean)
    )
}

function propertySummaryText(property: Record<string, any>) {
    const specs: string[] = []
    if (property.suites) specs.push(`${property.suites} suites`)
    else if (property.bedrooms) specs.push(`${property.bedrooms} dormitorios`)
    if (property.parking_spaces) specs.push(`${property.parking_spaces} vagas`)
    const area = property.area_private_m2 || property.area_m2
    if (area) specs.push(`${area} m2`)
    const location = [property.neighborhood, property.city, property.state].filter(Boolean).join(' - ')
    return [location, specs.join(' | ')].filter(Boolean).join('\n')
}

function formatPropertyPrice(property: Record<string, any>) {
    const price = Number(property.price || 0)
    if (!price) return 'Sob consulta'
    return `R$ ${price.toLocaleString('pt-BR')}`
}

function propertyRecommendationUrl(property: Record<string, any>, origin?: string | null) {
    return `${getPublicAppUrl(origin)}${propertyDetailsPath(property)}`
}

function propertyText(property: Record<string, any>) {
    return normalizeComparable([
        property.title,
        property.description,
        property.city,
        property.state,
        property.neighborhood,
        property.property_type,
        property.source_status,
        safeArray(property.amenities).join(' '),
    ].filter(Boolean).join(' '))
}

type LeadPropertyProfile = {
    sourceIds: string[]
    likedIds: Set<string>
    detailIds: Set<string>
    dislikedIds: Set<string>
    recommendedIds: Set<string>
    cities: Set<string>
    neighborhoods: Set<string>
    propertyTypes: Set<string>
    tags: Set<string>
    targetPrice: number | null
    minBedrooms: number | null
    minSuites: number | null
    minParking: number | null
}

function buildLeadPropertyProfile(lead: Record<string, any>, referenceProperties: Record<string, any>[]): LeadPropertyProfile {
    const signals = collectLeadPropertySignalIds(lead)
    const sourceIds = uniqueStrings([
        ...signals.liked,
        ...signals.whatsapp,
        ...signals.details,
        ...signals.viewed,
    ], 24)
    const prices = referenceProperties
        .map(property => Number(property.price || 0))
        .filter(price => Number.isFinite(price) && price > 0)
    const metadata = metadataRecord(lead.metadata)
    const leadPurposeText = normalizeComparable([
        lead.lead_purpose,
        metadata.lead_purpose,
        metadata.interest,
        metadata.purpose,
    ].filter(Boolean).join(' '))

    const tags = new Set<string>()
    const combinedRefText = normalizeComparable(referenceProperties.map(propertyText).join(' '))
    const intentText = `${leadPurposeText} ${combinedRefText}`
    if (/frente\s*(ao\s*)?mar/.test(intentText)) tags.add('frente-mar')
    if (/vista\s*(para\s*)?mar/.test(intentText)) tags.add('vista-mar')
    if (/cobertura|duplex|triplex/.test(intentText)) tags.add('cobertura')
    if (/lancamento|na planta|construcao/.test(intentText)) tags.add('lancamento')
    if (/alto padrao|luxo|premium|exclusiv/.test(intentText)) tags.add('alto-padrao')
    if (/invest/.test(intentText)) tags.add('investimento')

    const numberMax = (field: string) => {
        const values = referenceProperties
            .map(property => Number(property[field] || 0))
            .filter(value => Number.isFinite(value) && value > 0)
        return values.length ? Math.max(...values) : null
    }

    return {
        sourceIds,
        likedIds: new Set(signals.liked),
        detailIds: new Set(signals.details),
        dislikedIds: new Set(signals.disliked),
        recommendedIds: leadRecommendedPropertyIds(lead),
        cities: new Set(referenceProperties.map(property => normalizeComparable(property.city)).filter(Boolean)),
        neighborhoods: new Set(referenceProperties.map(property => normalizeComparable(property.neighborhood)).filter(Boolean)),
        propertyTypes: new Set(referenceProperties.map(property => normalizeComparable(property.property_type)).filter(Boolean)),
        tags,
        targetPrice: prices.length ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null,
        minBedrooms: numberMax('bedrooms'),
        minSuites: numberMax('suites'),
        minParking: numberMax('parking_spaces'),
    }
}

function scoreRecommendedProperty(property: Record<string, any>, profile: LeadPropertyProfile) {
    const propertyId = normalizeText(property.id)
    if (!propertyId) return -10000
    if (profile.dislikedIds.has(propertyId)) return -10000
    if (profile.recommendedIds.has(propertyId)) return -10000

    const text = propertyText(property)
    let score = 0

    if (profile.likedIds.has(propertyId)) score += 35
    if (profile.detailIds.has(propertyId)) score += 22

    const city = normalizeComparable(property.city)
    const neighborhood = normalizeComparable(property.neighborhood)
    const propertyType = normalizeComparable(property.property_type)
    if (city && profile.cities.has(city)) score += 26
    if (neighborhood && profile.neighborhoods.has(neighborhood)) score += 34
    if (propertyType && profile.propertyTypes.has(propertyType)) score += 18

    const price = Number(property.price || 0)
    if (profile.targetPrice && price > 0) {
        const distance = Math.abs(price - profile.targetPrice) / Math.max(profile.targetPrice, 1)
        score += Math.max(0, 28 - Math.round(distance * 35))
    }

    if (profile.minBedrooms && Number(property.bedrooms || 0) >= profile.minBedrooms) score += 8
    if (profile.minSuites && Number(property.suites || 0) >= profile.minSuites) score += 10
    if (profile.minParking && Number(property.parking_spaces || 0) >= profile.minParking) score += 7

    if (profile.tags.has('frente-mar') && /frente mar|frente ao mar/.test(text)) score += 18
    if (profile.tags.has('vista-mar') && /vista mar|vista para o mar/.test(text)) score += 14
    if (profile.tags.has('cobertura') && /cobertura|duplex|triplex/.test(text)) score += 14
    if (profile.tags.has('lancamento') && /lancamento|na planta|construcao/.test(text)) score += 10
    if (profile.tags.has('alto-padrao') && (Number(property.price || 0) >= 5000000 || property.exclusive)) score += 14
    if (profile.tags.has('investimento') && /invest|renda|rentabilidade|liquidez/.test(text)) score += 8

    if (property.featured_image || safeArray(property.images).length) score += 5
    if (property.exclusive) score += 7
    const createdAt = new Date(property.created_at || 0).getTime()
    if (Number.isFinite(createdAt) && createdAt > 0) {
        score += Math.max(0, 8 - Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24 * 30)))
    }

    return score
}

async function loadReferenceProperties(supabase: SupabaseAdminLike, ids: string[]) {
    if (!ids.length) return []
    const { data, error } = await supabase
        .from('properties')
        .select(PROPERTY_RECOMMENDATION_FIELDS)
        .in('id', ids.slice(0, 24))
        .limit(24)

    if (error) {
        console.warn('[editorial-distribution] property references failed:', error.message)
        return []
    }
    return data || []
}

async function loadRecommendationCandidates(supabase: SupabaseAdminLike) {
    const { data, error } = await supabase
        .from('properties')
        .select(PROPERTY_RECOMMENDATION_FIELDS)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(700)

    if (error) throw error
    return data || []
}

function buildPropertyRecommendationContext(params: {
    property: Record<string, any>
    lead: Record<string, any>
    config: EditorialConfig
    channel: EditorialChannel
    campaignId: string
    contentUrl: string
    score: number
    reason: string
    ecosystemSummary?: string
}) {
    const { property, lead, config, channel, campaignId, contentUrl, score, reason, ecosystemSummary } = params
    const leadName = normalizeText(lead.name) || 'tudo bem'
    const title = normalizePostText(property.title || 'Imovel selecionado', 180)
    const price = formatPropertyPrice(property)
    const details = propertySummaryText(property)
    const ctaLabel = 'Ver imovel'
    const trackingContent = normalizeText(property.id)
    const trackingTitle = normalizePostText(title, 120)
    const trackedContentUrl = channel === 'whatsapp'
        ? buildTrackedWhatsAppLink({
            url: contentUrl,
            leadId: normalizeText(lead.id),
            leadPhone: lead.phone_e164 || lead.phone || null,
            label: ctaLabel,
            title: trackingTitle,
            type: 'property',
            campaign: 'property_recommendation',
            content: trackingContent,
            contentId: normalizeText(property.id),
            source: 'whatsapp',
            medium: 'whatsapp',
        })
        : addUtm(contentUrl, {
            utm_source: channel === 'email' ? 'brevo' : channel,
            utm_medium: channel,
            utm_campaign: 'property_recommendation',
            utm_content: trackingContent,
            lead_id: normalizeText(lead.id),
            event_type: `${channel}_property_click`,
            link_type: 'property',
            link_label: ctaLabel,
            link_title: trackingTitle,
        })
    const subject = `Uma oportunidade alinhada ao seu perfil: ${title}`
    const textContent = [
        `Ola, ${leadName}.`,
        '',
        'Separei uma oportunidade que combina com os imoveis que voce demonstrou interesse no ecossistema Guilherme Pilger.',
        '',
        title,
        details,
        `Valor: ${price}`,
        '',
        `Abrir: ${trackedContentUrl}`,
        '',
        'Para parar de receber esse tipo de aviso, responda PARAR.',
    ].filter(Boolean).join('\n')
    const htmlContent = `
        <p>Ola, <strong>${leadName}</strong>.</p>
        <p>Separei uma oportunidade que combina com os imoveis que voce demonstrou interesse no ecossistema Guilherme Pilger.</p>
        <p><strong>${title}</strong><br>${details.replace(/\n/g, '<br>')}<br>Valor: ${price}</p>
        <p><a href="${trackedContentUrl}">Ver imovel</a></p>
    `.trim()
    const whatsappMessage = [
        `Ola, ${leadName}.`,
        '',
        'Vi seu interesse em imoveis com esse perfil e separei uma oportunidade que faz sentido:',
        '',
        `*${title}*`,
        details,
        `Valor: ${price}`,
        '',
        'Toque no botao para ver os detalhes.',
        '',
        'Para parar de receber esse tipo de aviso, responda PARAR.',
    ].filter(Boolean).join('\n')

    return {
        type: 'editorial_distribution',
        campaign_id: campaignId,
        content_type: 'property',
        trigger: 'property_recommendation',
        post_id: property.id,
        post_title: title,
        post_slug: '',
        post_excerpt: `${details} ${price}`.trim(),
        post_category: 'imovel',
        property_id: property.id,
        property_title: title,
        recommendation_score: score,
        recommendation_reason: reason,
        audience: config.audience,
        channel,
        target_email: normalizeEmail(lead.email),
        target_phone: normalizeWhatsAppPhone(lead.phone_e164 || lead.phone),
        target_visitor_id: normalizeText(lead.visitor_id || metadataRecord(lead.metadata).visitor_id),
        target_name: normalizeText(lead.name),
        subject,
        html_content: htmlContent,
        text_content: textContent,
        whatsapp_message: whatsappMessage,
        whatsapp_template_id: null,
        whatsapp_template_name: null,
        push_title: normalizePostText('Imovel com perfil parecido', 90),
        push_body: normalizePostText(`${leadName}, encontrei uma oportunidade que combina com seu interesse: ${title}.`, 220),
        push_template_id: null,
        push_template_name: null,
        content_url: trackedContentUrl,
        link_cta: trackedContentUrl,
        link_whatsapp: '',
        cta_label: ctaLabel,
        approval_required: config.approvalRequired || !config.autopilot,
        approval_status: config.approvalRequired || !config.autopilot ? 'awaiting_approval' : 'approved',
        ecosystem_summary: ecosystemSummary || null,
        created_by_agent: 'gabriel_distribuicao',
        created_at: new Date().toISOString(),
    }
}

async function campaignExists(supabase: SupabaseAdminLike, campaignId: string) {
    const { data, error } = await supabase
        .from('agent_workflow_runs')
        .select('id')
        .contains('context', { type: 'editorial_distribution', campaign_id: campaignId })
        .limit(1)

    if (error) {
        console.warn('[editorial-distribution] recommendation duplicate check failed:', error.message)
        return false
    }
    return Boolean((data || []).length)
}

export async function enqueueBehavioralPropertyRecommendations(
    supabase: SupabaseAdminLike,
    origin?: string | null,
    options: { force?: boolean; limit?: number } = {}
) {
    const config = await loadEditorialConfig(supabase)
    if (!config.agentEnabled) return { queued: false, skipped: true, reason: 'email_agent_disabled' }
    if (!config.recommendationsEnabled) return { queued: false, skipped: true, reason: 'recommendations_disabled' }
    if (!config.emailEnabled && !config.whatsappEnabled && !config.pushEnabled) return { queued: false, skipped: true, reason: 'channels_disabled' }

    const leads = await loadAudienceLeads(supabase, config.audience)
    const candidates = await loadRecommendationCandidates(supabase)
    if (!candidates.length) return { queued: false, skipped: true, reason: 'no_active_properties' }

    const queueStatus = config.approvalRequired || !config.autopilot ? 'waiting' : 'queued'
    const baseSchedule = nextWindowStart(config)
    const ecosystemSummary = await getAgentEcosystemContext({ supabase: supabase as any, agent: 'distribution', days: 30, limit: 100 })
        .then(context => buildAgentContextBrief(context))
        .catch((error: any) => {
            console.warn('[editorial-distribution] recommendation ecosystem context unavailable:', error?.message || error)
            return ''
        })
    const batchLimit = Math.max(1, Math.min(options.limit || config.recommendationBatchLimit, 500))
    let emailIndex = 0
    let whatsappIndex = 0
    let pushIndex = 0
    let matchedLeads = 0
    const rows: any[] = []
    const skipped: Record<string, number> = {}

    for (const lead of leads) {
        if (matchedLeads >= batchLimit) break
        const summary = leadBehaviorSummary(lead)
        const behaviorScore = Number(summary.engagement_score || lead.lead_score || 0)
        if (!options.force && behaviorScore < config.recommendationMinScore) {
            skipped.low_score = (skipped.low_score || 0) + 1
            continue
        }

        const signals = collectLeadPropertySignalIds(lead)
        const sourceIds = uniqueStrings([
            ...signals.liked,
            ...signals.whatsapp,
            ...signals.details,
            ...signals.viewed,
        ], 24)
        if (!sourceIds.length) {
            skipped.no_property_signal = (skipped.no_property_signal || 0) + 1
            continue
        }

        const referenceProperties = await loadReferenceProperties(supabase, sourceIds)
        if (!referenceProperties.length) {
            skipped.no_reference_property = (skipped.no_reference_property || 0) + 1
            continue
        }

        const profile = buildLeadPropertyProfile(lead, referenceProperties)
        const scored = candidates
            .map((property: any): { property: Record<string, any>; score: number } => ({ property, score: scoreRecommendedProperty(property, profile) }))
            .filter((item: { property: Record<string, any>; score: number }) => item.score >= config.recommendationMinScore)
            .sort((a: { property: Record<string, any>; score: number }, b: { property: Record<string, any>; score: number }) => (
                b.score - a.score ||
                new Date(b.property?.created_at || 0).getTime() - new Date(a.property?.created_at || 0).getTime()
            ))

        const selected = scored[0]
        if (!selected?.property?.id) {
            skipped.no_match = (skipped.no_match || 0) + 1
            continue
        }

        const campaignId = `recommendation:property:${lead.id}:${selected.property.id}`
        if (!options.force && await campaignExists(supabase, campaignId)) {
            skipped.already_exists = (skipped.already_exists || 0) + 1
            continue
        }

        const leadName = normalizeText(lead.name) || 'Lead'
        const leadPhone = normalizeWhatsAppPhone(lead.phone_e164 || lead.phone)
        const leadEmail = normalizeEmail(lead.email)
        const leadMetadata = metadataRecord(lead.metadata)
        const leadVisitorId = normalizeText(lead.visitor_id || leadMetadata.visitor_id)
        const leadHasPush = Boolean(
            leadVisitorId &&
            (lead.push_subscribed === true || lead.push_subscribed_lead === true || leadMetadata.push_subscribed_at)
        )
        const contentUrl = propertyRecommendationUrl(selected.property, origin)
        const reason = [
            profile.neighborhoods.size ? `bairro semelhante aos imoveis visitados` : '',
            profile.propertyTypes.size ? `tipo de imovel semelhante` : '',
            profile.targetPrice ? `faixa de valor parecida` : '',
        ].filter(Boolean).join(', ') || 'comportamento recente do lead'

        if (config.emailEnabled && leadEmail) {
            const context = buildPropertyRecommendationContext({
                property: selected.property,
                lead,
                config,
                channel: 'email',
                campaignId,
                contentUrl,
                score: selected.score,
                reason,
                ecosystemSummary,
            })
            rows.push({
                lead_id: lead.id,
                lead_phone: leadPhone || null,
                lead_name: leadName,
                status: queueStatus,
                trigger_type: 'property_recommendation',
                current_node_id: 'email',
                scheduled_for: queueStatus === 'queued' ? nextScheduleForChannel(config, baseSchedule, emailIndex, config.emailIntervalMinutes) : null,
                context,
            })
            emailIndex += 1
        }

        if (config.whatsappEnabled && leadPhone) {
            const context = buildPropertyRecommendationContext({
                property: selected.property,
                lead,
                config,
                channel: 'whatsapp',
                campaignId,
                contentUrl,
                score: selected.score,
                reason,
                ecosystemSummary,
            })
            rows.push({
                lead_id: lead.id,
                lead_phone: leadPhone,
                lead_name: leadName,
                status: queueStatus,
                trigger_type: 'property_recommendation',
                current_node_id: 'whatsapp',
                scheduled_for: queueStatus === 'queued' ? nextScheduleForChannel(config, baseSchedule, whatsappIndex, config.whatsappIntervalMinutes) : null,
                context,
            })
            whatsappIndex += 1
        }

        if (config.pushEnabled && leadHasPush) {
            const context = buildPropertyRecommendationContext({
                property: selected.property,
                lead,
                config,
                channel: 'push',
                campaignId,
                contentUrl,
                score: selected.score,
                reason,
                ecosystemSummary,
            })
            rows.push({
                lead_id: lead.id,
                lead_phone: leadPhone || null,
                lead_name: leadName,
                status: queueStatus,
                trigger_type: 'property_recommendation',
                current_node_id: 'push',
                scheduled_for: queueStatus === 'queued' ? nextScheduleForChannel(config, baseSchedule, pushIndex, config.pushIntervalMinutes) : null,
                context,
            })
            pushIndex += 1
        }

        matchedLeads += 1
    }

    if (!rows.length) {
        return {
            queued: false,
            skipped: true,
            reason: 'no_recommendation_recipients',
            skipped_details: skipped,
        }
    }

    const { data, error } = await supabase
        .from('agent_workflow_runs')
        .insert(rows)
        .select('id,status,context')

    if (error) throw error

    await logEditorialEvent(supabase, {
        eventType: 'property_recommendations_created',
        status: queueStatus,
        message: `${rows.length} recomendacoes comportamentais preparadas pelo Gabriel.`,
        metadata: {
            source: 'gabriel_behavioral_recommendation',
            approval_required: config.approvalRequired || !config.autopilot,
            email: emailIndex,
            whatsapp: whatsappIndex,
            push: pushIndex,
            matched_leads: matchedLeads,
            skipped,
        },
    })

    return {
        queued: true,
        status: queueStatus,
        total: data?.length || rows.length,
        email: emailIndex,
        whatsapp: whatsappIndex,
        push: pushIndex,
        matched_leads: matchedLeads,
        skipped,
        approval_required: config.approvalRequired || !config.autopilot,
    }
}

async function logEditorialEvent(supabase: SupabaseAdminLike, payload: {
    runId?: string | null
    leadId?: string | null
    leadPhone?: string | null
    eventType: string
    status?: string | null
    message?: string | null
    metadata?: Record<string, unknown>
}) {
    const metadata = payload.metadata || {}
    try {
        await supabase.from('agent_workflow_events').insert({
            run_id: payload.runId || null,
            lead_id: payload.leadId || null,
            lead_phone: payload.leadPhone || null,
            event_type: payload.eventType,
            status: payload.status || null,
            message: payload.message || null,
            metadata,
        })
    } catch (error) {
        console.warn('[editorial-distribution] failed to write event:', error)
    }

    const campaignId = normalizeText(metadata.campaign_id)
    const postId = normalizeText(metadata.post_id)
    await recordEcosystemEvent({
        supabase: supabase as any,
        eventType: payload.eventType,
        actorType: 'agent',
        leadId: payload.leadId || null,
        entityType: postId
            ? 'blog_post'
            : campaignId
                ? 'editorial_campaign'
                : payload.runId
                    ? 'agent_workflow_run'
                    : 'editorial_distribution',
        entityId: payload.runId || campaignId || postId || null,
        source: 'editorial-distribution-agent',
        label: payload.message || payload.eventType,
        importanceScore: payload.status === 'failed'
            ? 44
            : payload.status === 'sent'
                ? 66
                : 60,
        metadata: {
            ...metadata,
            run_id: payload.runId || null,
            lead_id: payload.leadId || null,
            lead_phone: payload.leadPhone || null,
            status: payload.status || null,
        },
    }).catch((error: any) => {
        console.warn('[editorial-distribution] failed to write ecosystem event:', error?.message || error)
    })
}

async function updateRun(supabase: SupabaseAdminLike, id: string, patch: Record<string, any>) {
    const { error } = await supabase
        .from('agent_workflow_runs')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)

    if (error) throw error
}

function baseContentUrlFromContext(context: Record<string, any>) {
    const contentType = normalizeText(context.content_type).toLowerCase()
    const slug = normalizeText(context.post_slug)

    if (contentType === 'news' && slug) {
        return `${getPublicAppUrl()}/noticias/${encodeURIComponent(slug)}`
    }

    if (contentType === 'blog' && slug) {
        return `${getPublicAppUrl()}/blog/${encodeURIComponent(slug)}`
    }

    if (contentType === 'property') {
        const propertyId = normalizeText(context.property_id || context.post_id)
        if (propertyId) {
            return `${getPublicAppUrl()}${propertyDetailsPath({
                id: propertyId,
                source_slug: normalizeText(context.source_slug || context.property_slug || context.slug),
                title: normalizeText(context.property_title || context.title || context.link_title),
            })}`
        }
    }

    return normalizeText(context.content_url || context.link_cta)
}

function trackedWhatsAppContentUrlFromContext(context: Record<string, any>, row: Record<string, any>, phone: string) {
    const contentType = normalizeText(context.content_type).toLowerCase()
    const linkType = contentType === 'property'
        ? 'property'
        : contentType === 'news'
            ? 'news'
            : 'blog'
    const baseUrl = baseContentUrlFromContext(context)
    if (!baseUrl) return ''

    return buildTrackedWhatsAppLink({
        url: baseUrl,
        leadId: normalizeText(row.lead_id || context.lead_id),
        leadPhone: phone || context.target_phone || row.lead_phone || null,
        label: normalizeText(context.cta_label) || 'Abrir',
        title: normalizePostText(context.post_title || context.property_title || context.subject, 120),
        type: linkType,
        campaign: normalizeText(context.trigger) || (linkType === 'property' ? 'property_recommendation' : `${linkType}_published`),
        content: normalizeText(context.post_slug || context.property_id || context.post_id),
        contentId: normalizeText(context.property_id || context.post_id),
        source: 'whatsapp',
        medium: 'whatsapp',
    })
}

async function sendEditorialQueueItem(supabase: SupabaseAdminLike, row: any) {
    const context = metadataRecord(row.context)
    const channel = context.channel as EditorialChannel
    const now = new Date().toISOString()

    await updateRun(supabase, row.id, {
        status: 'running',
        started_at: now,
        attempt_count: Number(row.attempt_count || 0) + 1,
    })

    try {
        let response: any = null

        if (channel === 'email') {
            const email = normalizeEmail(context.target_email)
            if (!email) throw new Error('Lead sem e-mail valido.')
            const htmlContent = stripTechnicalOutboundHtml(context.html_content)
            const textContent = stripTechnicalOutboundText(context.text_content) || htmlToText(htmlContent)
            context.html_content = htmlContent || normalizeText(context.html_content)
            context.text_content = textContent
            context.post_excerpt = stripTechnicalOutboundText(context.post_excerpt)
            await sendBrevoEmail({
                to: [{ email, name: normalizeText(context.target_name) || undefined }],
                subject: normalizeText(context.subject),
                htmlContent: context.html_content,
                textContent: context.text_content || htmlToText(context.html_content),
            })
            response = { provider: 'brevo', email }
        } else if (channel === 'whatsapp') {
            const phone = normalizeWhatsAppPhone(context.target_phone || row.lead_phone)
            if (!phone) throw new Error('Lead sem telefone valido para WhatsApp.')
            const contentUrl = trackedWhatsAppContentUrlFromContext(context, row, phone)
            const message = stripTechnicalOutboundText(context.whatsapp_message)
            const ctaLabel = normalizeText(context.cta_label) || 'Abrir'
            if (!message) throw new Error('Mensagem de WhatsApp vazia apos limpeza editorial.')
            context.content_url = contentUrl
            context.link_cta = contentUrl
            context.whatsapp_message = message
            context.post_excerpt = stripTechnicalOutboundText(context.post_excerpt)

            try {
                response = await sendMenuMessage({
                    phone,
                    text: message,
                    type: 'button',
                    choices: contentUrl ? [`${ctaLabel.slice(0, 42)}|url:${contentUrl}`] : [],
                    footerText: 'Guilherme Pilger',
                })
            } catch (buttonError) {
                console.warn('[editorial-distribution] whatsapp button failed, fallback text:', buttonError)
                response = await sendWhatsAppMessage({
                    phone,
                    message: contentUrl ? `${message}\n\n${ctaLabel}: ${contentUrl}` : message,
                })
            }
        } else if (channel === 'push') {
            const visitorId = normalizeText(context.target_visitor_id)
            if (!visitorId) throw new Error('Lead sem visitante inscrito para Push.')
            const pushTitle = stripTechnicalOutboundText(context.push_title || context.subject || 'Guilherme Pilger')
            const pushBody = stripTechnicalOutboundText(context.push_body || context.text_content || context.post_title || 'Novo conteudo disponivel.')
            context.push_title = pushTitle
            context.push_body = pushBody
            context.post_excerpt = stripTechnicalOutboundText(context.post_excerpt)
            const payload: PushPayload = {
                title: normalizePostText(pushTitle || 'Guilherme Pilger', 90),
                body: normalizePostText(pushBody || context.post_title || 'Novo conteudo disponivel.', 220),
                url: normalizeText(context.content_url || context.link_cta) || '/',
                data: {
                    channel: 'push',
                    campaign_id: context.campaign_id,
                    content_type: context.content_type,
                    content_id: context.post_id,
                    lead_id: row.lead_id,
                },
            }
            response = await sendPushToVisitor(visitorId, payload)
            if (!response.sent) throw new Error(response.failed ? 'Push nao entregue para inscricao ativa.' : 'Nenhuma inscricao push ativa encontrada.')
        } else {
            throw new Error(`Canal invalido: ${channel}`)
        }

        await updateRun(supabase, row.id, {
            status: 'sent',
            completed_at: now,
            last_message_at: now,
            error_message: null,
            context: {
                ...context,
                sent_at: now,
                provider_response: response || null,
            },
        })

        try {
            await recordLeadOutboundContext(supabase, {
                leadId: row.lead_id,
                phone: row.lead_phone || context.target_phone,
                channel,
                sourceAgent: 'gabriel_distribuicao',
                senderAgent: channel === 'whatsapp' ? 'whatsapp_global' : channel === 'push' ? 'push_web' : 'brevo_email',
                originAgent: context.content_type === 'property'
                    ? 'gabriel_recomendacao_imoveis'
                    : context.content_type === 'news'
                        ? 'clara_noticias'
                        : 'isadora_blog',
                campaignId: context.campaign_id,
                workflowRunId: row.id,
                contentType: context.content_type,
                trigger: context.trigger,
                contentId: context.post_id,
                contentTitle: context.post_title,
                contentSummary: stripTechnicalOutboundText(context.post_excerpt || context.text_content || context.whatsapp_message),
                contentUrl: context.content_url || context.link_cta,
                ctaLabel: context.cta_label,
                message: channel === 'whatsapp'
                    ? context.whatsapp_message
                    : channel === 'push'
                        ? `${context.push_title || 'Push enviado'} ${context.push_body || ''} ${context.content_url || context.link_cta || ''}`
                        : `${context.subject || 'Conteudo enviado'} ${context.content_url || context.link_cta || ''}`,
                sentAt: now,
            })
        } catch (memoryError) {
            console.warn('[editorial-distribution] sent but failed to record outbound context:', memoryError)
        }

        await logEditorialEvent(supabase, {
            runId: row.id,
            leadId: row.lead_id,
            leadPhone: row.lead_phone,
            eventType: `editorial_${channel}_sent`,
            status: 'sent',
            message: `${channel === 'email' ? 'E-mail' : channel === 'push' ? 'Push' : 'WhatsApp'} enviado para ${row.lead_name || row.lead_phone || context.target_email}.`,
            metadata: {
                campaign_id: context.campaign_id,
                post_id: context.post_id,
                channel,
            },
        })

        return { sent: true, id: row.id, channel }
    } catch (error: any) {
        const message = error?.message || String(error)
        await updateRun(supabase, row.id, {
            status: 'failed',
            completed_at: now,
            error_message: message.slice(0, 500),
            context: {
                ...context,
                failed_at: now,
                last_error: message.slice(0, 500),
            },
        })

        await logEditorialEvent(supabase, {
            runId: row.id,
            leadId: row.lead_id,
            leadPhone: row.lead_phone,
            eventType: `editorial_${channel || 'unknown'}_failed`,
            status: 'failed',
            message,
            metadata: {
                campaign_id: context.campaign_id,
                post_id: context.post_id,
                channel,
            },
        })

        return { sent: false, id: row.id, channel, error: message }
    }
}

async function countSentTodayByChannel(supabase: SupabaseAdminLike) {
    const since = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
        .from('agent_workflow_runs')
        .select('completed_at,context')
        .in('trigger_type', DISTRIBUTION_TRIGGER_TYPES)
        .eq('status', 'sent')
        .gte('completed_at', since)
        .limit(5000)

    if (error) throw error

    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())
    const counts: Record<EditorialChannel, number> = { email: 0, whatsapp: 0, push: 0 }

    for (const row of data || []) {
        const rowDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date(row.completed_at))
        if (rowDate !== today) continue
        const context = metadataRecord(row.context)
        if (context.type !== 'editorial_distribution') continue
        const channel = context.channel === 'whatsapp'
            ? 'whatsapp'
            : context.channel === 'email'
                ? 'email'
                : context.channel === 'push'
                    ? 'push'
                    : null
        if (channel) counts[channel] += 1
    }

    return counts
}

function editorialLeadCooldownKey(row: any, context: Record<string, any>) {
    const leadId = normalizeText(row.lead_id)
    if (leadId) return `lead:${leadId}`

    const phone = normalizeWhatsAppPhone(row.lead_phone || context.target_phone)
    if (phone) return `phone:${phone}`

    const email = normalizeEmail(context.target_email)
    if (email) return `email:${email}`

    return ''
}

async function findRecentEditorialTouchForLead(
    supabase: SupabaseAdminLike,
    row: any,
    context: Record<string, any>,
    config: Pick<EditorialConfig, 'minHoursBetweenLeadMessages' | 'allowedStartTime' | 'allowedEndTime'>,
    trigger: DistributionTrigger,
    referenceDate = new Date()
) {
    const cooldownMs = config.minHoursBetweenLeadMessages * 60 * 60 * 1000
    const since = new Date(referenceDate.getTime() - cooldownMs).toISOString()
    const leadId = normalizeText(row.lead_id)
    const phone = normalizeWhatsAppPhone(row.lead_phone || context.target_phone)
    const email = normalizeEmail(context.target_email)

    let query = supabase
        .from('agent_workflow_runs')
        .select('id,completed_at,context')
        .in('trigger_type', cooldownTriggerTypesFor(trigger))
        .eq('status', 'sent')
        .gte('completed_at', since)
        .order('completed_at', { ascending: false })
        .limit(1)

    if (leadId) {
        query = query.eq('lead_id', leadId)
    } else if (phone) {
        query = query.eq('lead_phone', phone)
    } else if (email) {
        query = query.contains('context', { type: 'editorial_distribution', target_email: email })
    } else {
        return null
    }

    const { data, error } = await query
    if (error) throw error

    const completedAt = (data || [])[0]?.completed_at
    if (!completedAt) return null

    const lastTouchDate = new Date(completedAt)
    if (Number.isNaN(lastTouchDate.getTime())) return null

    return nextWindowStart(config, new Date(lastTouchDate.getTime() + cooldownMs)).toISOString()
}

async function rescheduleEditorialRunForCooldown(
    supabase: SupabaseAdminLike,
    row: any,
    context: Record<string, any>,
    scheduledFor: string,
    reason: string
) {
    await updateRun(supabase, row.id, {
        scheduled_for: scheduledFor,
        context: {
            ...context,
            cooldown_rescheduled_at: new Date().toISOString(),
            cooldown_reason: reason,
            next_allowed_for_lead: scheduledFor,
        },
    })

    return {
        sent: false,
        id: row.id,
        channel: context.channel as EditorialChannel,
        reason,
        scheduled_for: scheduledFor,
    }
}

export async function processDueEditorialDistribution(supabase: SupabaseAdminLike, limit = 20) {
    const config = await loadEditorialConfig(supabase)
    const checkedDate = new Date()
    const checkedAt = checkedDate.toISOString()

    if (!config.agentEnabled) {
        return { processed: 0, skipped: true, reason: 'email_agent_disabled', results: [] }
    }

    if (!isWithinWindow(config)) {
        return { processed: 0, skipped: true, reason: 'outside_allowed_window', results: [] }
    }

    const dailyCounts = await countSentTodayByChannel(supabase)
    const { data, error } = await supabase
        .from('agent_workflow_runs')
        .select('id,lead_id,lead_phone,lead_name,status,trigger_type,scheduled_for,created_at,attempt_count,context')
        .in('trigger_type', DISTRIBUTION_TRIGGER_TYPES)
        .eq('status', 'queued')
        .lte('scheduled_for', checkedAt)
        .order('scheduled_for', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(Math.max(limit * 10, 200))

    if (error) throw error

    const dueRows = (data || [])
        .filter((row: any) => metadataRecord(row.context).type === 'editorial_distribution')
        .sort(compareDistributionQueueRows)
    const results = []
    const touchedInBatch = new Set<string>()

    for (const row of dueRows) {
        if (results.length >= limit) break
        const context = metadataRecord(row.context)
        const channel = context.channel as EditorialChannel
        const trigger = normalizeDistributionTrigger(row.trigger_type || context.trigger)
        if (!trigger) continue

        if (channel === 'email' && dailyCounts.email >= config.emailDailyLimit) {
            const scheduledFor = nextWindowStartAfterDailyLimit(config, checkedDate)
            results.push(await rescheduleEditorialRunForCooldown(supabase, row, context, scheduledFor, 'email_daily_limit_reached'))
            continue
        }
        if (channel === 'whatsapp' && dailyCounts.whatsapp >= config.whatsappDailyLimit) {
            const scheduledFor = nextWindowStartAfterDailyLimit(config, checkedDate)
            results.push(await rescheduleEditorialRunForCooldown(supabase, row, context, scheduledFor, 'whatsapp_daily_limit_reached'))
            continue
        }
        if (channel === 'push' && dailyCounts.push >= config.pushDailyLimit) {
            const scheduledFor = nextWindowStartAfterDailyLimit(config, checkedDate)
            results.push(await rescheduleEditorialRunForCooldown(supabase, row, context, scheduledFor, 'push_daily_limit_reached'))
            continue
        }

        const cooldownKey = editorialLeadCooldownKey(row, context)
        if (cooldownKey && touchedInBatch.has(cooldownKey)) {
            const scheduledFor = nextWindowStart(
                config,
                new Date(checkedDate.getTime() + config.minHoursBetweenLeadMessages * 60 * 60 * 1000)
            ).toISOString()
            results.push(await rescheduleEditorialRunForCooldown(supabase, row, context, scheduledFor, 'lead_cooldown_batch'))
            continue
        }

        const recentScheduledFor = await findRecentEditorialTouchForLead(supabase, row, context, config, trigger, checkedDate)
        if (recentScheduledFor) {
            results.push(await rescheduleEditorialRunForCooldown(supabase, row, context, recentScheduledFor, 'lead_cooldown_recent'))
            continue
        }

        const result = await sendEditorialQueueItem(supabase, row)
        results.push(result)

        if (result.sent && channel === 'email') dailyCounts.email += 1
        if (result.sent && channel === 'whatsapp') dailyCounts.whatsapp += 1
        if (result.sent && channel === 'push') dailyCounts.push += 1
        if (result.sent && cooldownKey) touchedInBatch.add(cooldownKey)
    }

    await Promise.all([
        saveAppConfig(supabase, 'editorial_distribution_cron_last_checked_at', checkedAt).catch(() => {}),
        saveAppConfig(supabase, 'editorial_distribution_cron_last_result', JSON.stringify({
            processed: results.length,
            sent: results.filter((result: any) => result.sent).length,
        }).slice(0, 1000)).catch(() => {}),
    ])

    return { processed: results.length, skipped: false, results }
}

function summarizeCampaignStatus(rows: any[]) {
    const counts: Record<string, number> = {}
    const channelCounts: Record<EditorialChannel, number> = { email: 0, whatsapp: 0, push: 0 }

    for (const row of rows) {
        counts[row.status] = (counts[row.status] || 0) + 1
        const rawChannel = metadataRecord(row.context).channel
        const channel = rawChannel === 'whatsapp'
            ? 'whatsapp'
            : rawChannel === 'email'
                ? 'email'
                : rawChannel === 'push'
                    ? 'push'
                    : null
        if (channel) channelCounts[channel] += 1
    }

    const waiting = counts.waiting || 0
    const queued = counts.queued || 0
    const running = counts.running || 0
    const sent = counts.sent || 0
    const failed = counts.failed || 0
    const stopped = counts.stopped || 0
    const total = rows.length

    if (queued || running) return { status: 'sending', counts, channelCounts, waiting, queued, sent, failed, stopped, total }
    if (waiting && !queued && !running) return { status: 'awaiting_approval', counts, channelCounts, waiting, queued, sent, failed, stopped, total }
    if (failed && sent + stopped + failed >= total) return { status: 'finished_with_errors', counts, channelCounts, waiting, queued, sent, failed, stopped, total }
    if (sent + stopped >= total && total > 0) return { status: 'completed', counts, channelCounts, waiting, queued, sent, failed, stopped, total }
    return { status: 'draft', counts, channelCounts, waiting, queued, sent, failed, stopped, total }
}

export async function listEditorialCampaigns(supabase: SupabaseAdminLike): Promise<{ campaigns: EditorialCampaignSummary[]; summary: Record<string, number> }> {
    const { data, error } = await supabase
        .from('agent_workflow_runs')
        .select('id,status,trigger_type,scheduled_for,created_at,updated_at,completed_at,error_message,context')
        .in('trigger_type', DISTRIBUTION_TRIGGER_TYPES)
        .order('created_at', { ascending: false })
        .limit(1500)

    if (error) throw error

    const groups = new Map<string, any[]>()
    for (const row of data || []) {
        const context = metadataRecord(row.context)
        if (context.type !== 'editorial_distribution' || !context.campaign_id) continue
        const current = groups.get(context.campaign_id) || []
        current.push(row)
        groups.set(context.campaign_id, current)
    }

    const campaigns = Array.from(groups.entries()).map(([campaignId, rows]) => {
        const firstContext = metadataRecord(rows[0]?.context)
        const status = summarizeCampaignStatus(rows)
        const scheduledFor = rows
            .map(row => row.scheduled_for)
            .filter(Boolean)
            .sort()[0] || null

        return {
            campaign_id: campaignId,
            post_id: String(firstContext.post_id || ''),
            post_title: String(firstContext.post_title || 'Conteudo editorial'),
            post_slug: String(firstContext.post_slug || ''),
            content_type: (firstContext.content_type === 'property'
                ? 'property'
                : firstContext.content_type === 'news'
                    ? 'news'
                    : 'blog') as DistributionContentType,
            trigger: (firstContext.trigger === 'property_recommendation'
                ? 'property_recommendation'
                : firstContext.trigger === 'news_published'
                    ? 'news_published'
                    : 'blog_published') as DistributionTrigger,
            audience: String(firstContext.audience || 'active_leads'),
            approval_status: String(firstContext.approval_status || ''),
            status: status.status,
            created_at: rows.map(row => row.created_at).sort()[0] || '',
            scheduled_for: scheduledFor,
            counts: status.counts,
            channel_counts: status.channelCounts,
            sent: status.sent,
            failed: status.failed,
            waiting: status.waiting,
            queued: status.queued,
            total: status.total,
        }
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return {
        campaigns,
        summary: {
            campaigns: campaigns.length,
            awaiting_approval: campaigns.filter(campaign => campaign.status === 'awaiting_approval').length,
            sending: campaigns.filter(campaign => campaign.status === 'sending').length,
            completed: campaigns.filter(campaign => campaign.status === 'completed').length,
            failed: campaigns.filter(campaign => campaign.failed > 0).length,
            queued_items: campaigns.reduce((sum, campaign) => sum + campaign.queued, 0),
            waiting_items: campaigns.reduce((sum, campaign) => sum + campaign.waiting, 0),
        },
    }
}

async function updateCampaignRows(
    supabase: SupabaseAdminLike,
    campaignId: string,
    statuses: string[],
    updater: (row: any, indexByChannel: Record<EditorialChannel, number>, config: EditorialConfig) => Record<string, any>
) {
    const config = await loadEditorialConfig(supabase)
    const { data, error } = await supabase
        .from('agent_workflow_runs')
        .select('id,status,context')
        .in('trigger_type', DISTRIBUTION_TRIGGER_TYPES)
        .in('status', statuses)
        .contains('context', { type: 'editorial_distribution', campaign_id: campaignId })
        .order('created_at', { ascending: true })
        .limit(5000)

    if (error) throw error
    const indexByChannel: Record<EditorialChannel, number> = { email: 0, whatsapp: 0, push: 0 }

    for (const row of data || []) {
        const patch = updater(row, indexByChannel, config)
        await updateRun(supabase, row.id, patch)
    }

    return { updated: data?.length || 0 }
}

export async function approveEditorialCampaign(supabase: SupabaseAdminLike, campaignId: string) {
    const base = new Date()
    return updateCampaignRows(supabase, campaignId, ['waiting'], (row, indexByChannel, config) => {
        const context = metadataRecord(row.context)
        const channel = context.channel === 'whatsapp' ? 'whatsapp' : context.channel === 'push' ? 'push' : 'email'
        const index = indexByChannel[channel]
        indexByChannel[channel] += 1
        const scheduleBase = nextWindowStart(config, base)
        const interval = channel === 'whatsapp'
            ? config.whatsappIntervalMinutes
            : channel === 'push'
                ? config.pushIntervalMinutes
                : config.emailIntervalMinutes
        return {
            status: 'queued',
            scheduled_for: nextScheduleForChannel(config, scheduleBase, index, interval),
            error_message: null,
            context: {
                ...context,
                approval_status: 'approved',
                approved_at: new Date().toISOString(),
            },
        }
    })
}

export async function pauseEditorialCampaign(supabase: SupabaseAdminLike, campaignId: string) {
    return updateCampaignRows(supabase, campaignId, ['queued'], row => ({
        status: 'waiting',
        scheduled_for: null,
        context: {
            ...metadataRecord(row.context),
            approval_status: 'paused',
            paused_at: new Date().toISOString(),
        },
    }))
}

export async function cancelEditorialCampaign(supabase: SupabaseAdminLike, campaignId: string) {
    return updateCampaignRows(supabase, campaignId, ['waiting', 'queued', 'failed'], row => ({
        status: 'stopped',
        completed_at: new Date().toISOString(),
        context: {
            ...metadataRecord(row.context),
            approval_status: 'cancelled',
            cancelled_at: new Date().toISOString(),
        },
    }))
}
