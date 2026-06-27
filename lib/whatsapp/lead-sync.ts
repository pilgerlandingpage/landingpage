import { getChatDetails, getContactAvatar } from '../connectyhub/whatsapp'
import { recordEcosystemEvent } from '../intelligence/ecosystem'
import { normalizeLeadPipelineStageKey } from '../leads/pipeline'

type SupabaseClientLike = any

export type WhatsAppLeadMessage = {
    role: 'user' | 'assistant'
    content: string
    type?: string | null
    source?: string | null
    message_id?: string | null
    instance_id?: string | null
    broker_id?: string | null
    timestamp?: string | null
    metadata?: Record<string, unknown> | null
}

export type WhatsAppLeadContext = {
    phone: string
    senderName?: string | null
    instanceId?: string | null
    instanceName?: string | null
    instanceToken?: string | null
    brokerId?: string | null
    conversationId?: string | null
    acquiredVia?: string | null
}

export function normalizeWhatsAppPhone(value: unknown): string {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('55') || digits.length > 11) return digits
    return `55${digits}`
}

function normalizeEmail(value: unknown): string | null {
    const email = String(value || '').trim().toLowerCase()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function phoneCandidates(value: unknown): string[] {
    const base = normalizeWhatsAppPhone(value)
    if (!base) return []

    const set = new Set<string>()
    const add = (raw: string) => {
        const digits = String(raw || '').replace(/\D/g, '')
        if (digits) set.add(digits)
    }

    add(base)
    if (base.startsWith('55')) {
        const local = base.slice(2)
        add(local)
        if (local.length === 11 && local[2] === '9') {
            add(`55${local.slice(0, 2)}${local.slice(3)}`)
            add(`${local.slice(0, 2)}${local.slice(3)}`)
        }
        if (local.length === 10) {
            add(`55${local.slice(0, 2)}9${local.slice(2)}`)
            add(`${local.slice(0, 2)}9${local.slice(2)}`)
        }
    }

    return [...set]
}

export function isGenericWhatsAppLeadName(value: unknown): boolean {
    const name = String(value || '').trim()
    if (!name) return true
    const normalized = name.toLowerCase().replace(/\s+/g, ' ')
    if (/^whatsapp(?:\s+\d{2,})?$/i.test(name)) return true
    if (/^(lead sem nome|sem nome|desconhecido|unknown)$/i.test(normalized)) return true
    const digits = name.replace(/\D/g, '')
    const letters = name.replace(/[^a-zA-ZÀ-ÿ]/g, '')
    return digits.length >= 8 && letters.length === 0
}

function cleanLeadNameCandidate(value: unknown): string | null {
    const name = String(value || '').replace(/\s+/g, ' ').trim()
    if (!name || isGenericWhatsAppLeadName(name)) return null
    const letters = name.replace(/[^a-zA-ZÀ-ÿ]/g, '')
    if (letters.length < 2) return null
    return name.slice(0, 90)
}

function formatPhoneFallbackName(phone: string): string {
    const digits = normalizeWhatsAppPhone(phone)
    if (!digits) return ''
    if (digits.startsWith('55') && digits.length >= 12) {
        const local = digits.slice(2)
        const ddd = local.slice(0, 2)
        const number = local.slice(2)
        if (number.length === 9) return `+55 ${ddd} ${number.slice(0, 5)}-${number.slice(5)}`
        if (number.length === 8) return `+55 ${ddd} ${number.slice(0, 4)}-${number.slice(4)}`
    }
    return `+${digits}`
}

function buildContactOrFilter(candidates: string[]): string {
    const safe = Array.from(new Set(
        candidates
            .map(candidate => candidate.replace(/[^0-9]/g, ''))
            .filter(Boolean)
    ))
    const filters: string[] = []
    for (const candidate of safe) {
        filters.push(`phone.eq.${candidate}`)
        filters.push(`jid.eq.${candidate}`)
        filters.push(`jid.eq.${candidate}@s.whatsapp.net`)
    }
    return filters.join(',')
}

function nameFromImportedContact(row: any): string | null {
    return cleanLeadNameCandidate(row?.contact_name)
        || cleanLeadNameCandidate(row?.first_name)
        || cleanLeadNameCandidate(row?.raw?.name)
        || cleanLeadNameCandidate(row?.raw?.pushName)
        || cleanLeadNameCandidate(row?.raw?.contactName)
        || cleanLeadNameCandidate(row?.raw?.wa_name)
        || cleanLeadNameCandidate(row?.raw?.wa_contactName)
}

async function findImportedContactName(
    supabase: SupabaseClientLike,
    phone: string,
    instanceId?: string | null
): Promise<{ name: string; source: string; contact?: any } | null> {
    const filter = buildContactOrFilter(phoneCandidates(phone))
    if (!filter) return null

    const queryContacts = async (scoped: boolean) => {
        let query = supabase
            .from('whatsapp_instance_contacts')
            .select('id, instance_id, phone, jid, contact_name, first_name, raw, updated_at')
            .or(filter)
            .order('updated_at', { ascending: false })
            .limit(10)
        if (scoped && instanceId) query = query.eq('instance_id', instanceId)
        const { data, error } = await query
        if (error) {
            console.warn('[WhatsApp Lead Sync] imported contact lookup failed:', error.message)
            return null
        }
        return (data || []).find((row: any) => nameFromImportedContact(row)) || null
    }

    const contact = (instanceId ? await queryContacts(true) : null) || await queryContacts(false)
    const name = nameFromImportedContact(contact)
    return name ? { name, source: 'whatsapp_instance_contacts', contact } : null
}

function inferLeadNameFromMessages(messages: any[]): string | null {
    const patterns = [
        /\bmeu nome (?:e|eh|é)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,50})/i,
        /\bme chamo\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,50})/i,
        /\baqui (?:e|eh|é)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,50})/i,
        /\bquem fala (?:e|eh|é)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,50})/i,
    ]

    for (const message of messages || []) {
        const role = String(message?.role || '').toLowerCase()
        if (role && role !== 'user') continue
        const text = String(message?.content || message?.text || '').trim()
        if (!text) continue
        for (const pattern of patterns) {
            const match = text.match(pattern)
            const candidate = match?.[1]
                ?.split(/[,.!?;:\n\r]/)[0]
                ?.replace(/\b(?:tudo bem|boa tarde|bom dia|boa noite|obrigado|obrigada)\b.*$/i, '')
                ?.trim()
            const clean = cleanLeadNameCandidate(candidate)
            if (clean) return clean
        }
    }
    return null
}

function buildPhoneOrFilter(candidates: string[]): string {
    const safe = candidates
        .map(candidate => candidate.replace(/[^0-9]/g, ''))
        .filter(Boolean)
    return `phone.in.(${safe.join(',')}),phone_e164.in.(${safe.join(',')})`
}

function mergeMetadata(current: unknown, patch: Record<string, unknown>) {
    const base = current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, unknown> : {}
    return {
        ...base,
        whatsapp: {
            ...((base.whatsapp && typeof base.whatsapp === 'object') ? base.whatsapp as Record<string, unknown> : {}),
            ...patch,
        },
    }
}

function extractAvatarUrl(payload: any): string | null {
    const candidates = [
        payload?.imagePreview,
        payload?.image,
        payload?.profilePicUrl,
        payload?.profile_pic_url,
        payload?.avatar,
        payload?.url,
        payload?.picture,
        payload?.data?.imagePreview,
        payload?.data?.image,
        payload?.data?.url,
        payload?.response?.imagePreview,
        payload?.response?.image,
        payload?.response?.url,
    ]
    const found = candidates.find((value) => {
        const text = String(value || '').trim()
        return /^https?:\/\//i.test(text)
    })
    return found ? String(found).trim() : null
}

async function fetchWhatsAppAvatar(phone: string, instanceToken?: string | null): Promise<{
    url: string | null
    source: string
    raw?: any
}> {
    if (!instanceToken) return { url: null, source: 'missing_instance_token' }

    try {
        const details = await getChatDetails(phone, instanceToken, true)
        const url = extractAvatarUrl(details)
        if (url) return { url, source: 'chat_details', raw: details }
    } catch (err) {
        console.warn('[WhatsApp Lead Sync] chat details avatar lookup failed:', err)
    }

    try {
        const avatar = await getContactAvatar(phone, instanceToken)
        const url = extractAvatarUrl(avatar)
        if (url) return { url, source: 'contact_avatar', raw: avatar }
    } catch (err) {
        console.warn('[WhatsApp Lead Sync] contact avatar lookup failed:', err)
    }

    return { url: null, source: 'not_available' }
}

function toConversationEntry(message: WhatsAppLeadMessage) {
    return {
        role: message.role,
        content: String(message.content || '').trim(),
        type: message.type || 'text',
        source: message.source || null,
        message_id: message.message_id || null,
        instance_id: message.instance_id || null,
        broker_id: message.broker_id || null,
        timestamp: message.timestamp || new Date().toISOString(),
        metadata: message.metadata || null,
    }
}

function dedupeConversationLog(messages: any[]): any[] {
    const seenIds = new Set<string>()
    const seenFallback = new Set<string>()
    const result: any[] = []

    for (const item of messages) {
        const content = String(item?.content || '').trim()
        if (!content) continue

        const messageId = item?.message_id ? String(item.message_id) : ''
        if (messageId) {
            if (seenIds.has(messageId)) continue
            seenIds.add(messageId)
        } else {
            const fallback = [
                item?.role || '',
                content,
                item?.timestamp ? String(item.timestamp).slice(0, 19) : '',
            ].join('|')
            if (seenFallback.has(fallback)) continue
            seenFallback.add(fallback)
        }

        result.push(item)
    }

    return result.slice(-250)
}

function findConversationEntryIndex(messages: any[], entry: any) {
    const entryId = entry?.message_id ? String(entry.message_id) : ''
    if (entryId) {
        return messages.findIndex(item => item?.message_id && String(item.message_id) === entryId)
    }

    const entryContent = String(entry?.content || '').trim()
    const entryRole = String(entry?.role || '')
    const entryTimestamp = entry?.timestamp ? String(entry.timestamp).slice(0, 19) : ''
    return messages.findIndex(item => {
        const content = String(item?.content || '').trim()
        const role = String(item?.role || '')
        const timestamp = item?.timestamp ? String(item.timestamp).slice(0, 19) : ''
        return content === entryContent && role === entryRole && timestamp === entryTimestamp
    })
}

async function recordLeadConversationLogEvent(
    supabase: SupabaseClientLike,
    lead: any,
    entry: ReturnType<typeof toConversationEntry>
) {
    const source = String(entry.source || '').toLowerCase()
    const role = String(entry.role || '').toLowerCase()
    const isHuman = source === 'human'
    const isLead = source === 'lead' || role === 'user'
    if (!isHuman && !isLead) return

    const phone = normalizeWhatsAppPhone(lead?.phone_e164 || lead?.phone)
    const eventType = isHuman ? 'whatsapp_human_message_logged' : 'whatsapp_lead_message_logged'
    const label = isHuman
        ? `Mensagem humana registrada no WhatsApp${lead?.name ? ` para ${lead.name}` : ''}`
        : `Mensagem do lead registrada no WhatsApp${lead?.name ? `: ${lead.name}` : ''}`

    await recordEcosystemEvent({
        supabase,
        eventType,
        actorType: isHuman ? 'human' : 'lead',
        leadId: lead?.id || null,
        entityType: 'lead_conversation_log',
        entityId: lead?.id || null,
        source: isHuman ? 'human-broker-whatsapp' : 'lead-whatsapp',
        label,
        importanceScore: isHuman ? 63 : 56,
        occurredAt: entry.timestamp || undefined,
        metadata: {
            lead_id: lead?.id || null,
            lead_name: lead?.name || null,
            lead_phone: phone || null,
            broker_id: entry.broker_id || null,
            instance_id: entry.instance_id || null,
            message_id: entry.message_id || null,
            message_type: entry.type || null,
            message_source: source || null,
            message_role: role || null,
            message_preview: compactString(entry.content, 500),
        },
    }).catch((error: any) => {
        console.warn('[WhatsApp Lead Sync] ecosystem conversation log event failed:', error?.message || error)
    })
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function compactString(value: unknown, max = 700): string {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
}

function isTechnicalOutboundText(value: unknown) {
    const text = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

    return [
        'rascunho criado por fallback',
        'rascunho de noticia criado por fallback',
        'fallback usando o contexto disponivel',
        'revisar fontes e atualidade antes de publicar',
        'ia nao retornou json valido',
    ].some(marker => text.includes(marker))
}

function cleanOutboundText(value: unknown) {
    return String(value || '')
        .split(/\r?\n/)
        .filter(line => {
            const clean = line.trim()
            return !clean || !isTechnicalOutboundText(clean)
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function normalizeOutboundContentType(value: unknown): LeadOutboundContext['content_type'] {
    const normalized = String(value || '').toLowerCase()
    if (['blog', 'news', 'event', 'property', 'campaign'].includes(normalized)) {
        return normalized as LeadOutboundContext['content_type']
    }
    return 'other'
}

export type LeadOutboundContext = {
    id: string
    channel: 'whatsapp' | 'email' | 'sms' | 'push' | 'other'
    source_agent: string | null
    sender_agent: string | null
    origin_agent: string | null
    campaign_id: string | null
    workflow_run_id: string | null
    content_type: 'blog' | 'news' | 'event' | 'property' | 'campaign' | 'other'
    trigger: string | null
    content_id: string | null
    content_title: string | null
    content_summary: string | null
    content_url: string | null
    cta_label: string | null
    message_preview: string | null
    recommendation_score?: number | null
    recommendation_reason?: string | null
    recommendation_reasons?: string[]
    recommendation_source_property_ids?: string[]
    sent_at: string
}

function sanitizeOutboundContext(params: {
    channel?: unknown
    sourceAgent?: unknown
    senderAgent?: unknown
    originAgent?: unknown
    campaignId?: unknown
    workflowRunId?: unknown
    contentType?: unknown
    trigger?: unknown
    contentId?: unknown
    contentTitle?: unknown
    contentSummary?: unknown
    contentUrl?: unknown
    ctaLabel?: unknown
    message?: unknown
    recommendationScore?: unknown
    recommendationReason?: unknown
    recommendationReasons?: unknown
    recommendationSourcePropertyIds?: unknown
    sentAt?: unknown
}): LeadOutboundContext {
    const sentAt = String(params.sentAt || '').trim() || new Date().toISOString()
    const contentTitle = compactString(params.contentTitle, 220)
    const contentUrl = compactString(params.contentUrl, 600)
    const campaignId = compactString(params.campaignId, 180)
    const workflowRunId = compactString(params.workflowRunId, 120)
    const contentSummary = cleanOutboundText(params.contentSummary)
    const messagePreview = cleanOutboundText(params.message)
    return {
        id: workflowRunId || campaignId || `${sentAt}:${contentTitle || contentUrl || 'outbound'}`,
        channel: ['whatsapp', 'email', 'sms', 'push'].includes(String(params.channel || '').toLowerCase())
            ? String(params.channel).toLowerCase() as LeadOutboundContext['channel']
            : 'other',
        source_agent: compactString(params.sourceAgent, 120) || null,
        sender_agent: compactString(params.senderAgent, 120) || null,
        origin_agent: compactString(params.originAgent, 120) || null,
        campaign_id: campaignId || null,
        workflow_run_id: workflowRunId || null,
        content_type: normalizeOutboundContentType(params.contentType),
        trigger: compactString(params.trigger, 120) || null,
        content_id: compactString(params.contentId, 120) || null,
        content_title: contentTitle || null,
        content_summary: compactString(contentSummary, 500) || null,
        content_url: contentUrl || null,
        cta_label: compactString(params.ctaLabel, 80) || null,
        message_preview: compactString(messagePreview, 700) || null,
        recommendation_score: Number.isFinite(Number(params.recommendationScore))
            ? Math.max(0, Math.min(100, Math.round(Number(params.recommendationScore))))
            : null,
        recommendation_reason: compactString(params.recommendationReason, 300) || null,
        recommendation_reasons: Array.isArray(params.recommendationReasons)
            ? params.recommendationReasons.map(item => compactString(item, 120)).filter(Boolean).slice(0, 8)
            : [],
        recommendation_source_property_ids: Array.isArray(params.recommendationSourcePropertyIds)
            ? params.recommendationSourcePropertyIds.map(item => compactString(item, 80)).filter(Boolean).slice(0, 12)
            : [],
        sent_at: sentAt,
    }
}

export function getRecentLeadOutboundContexts(lead: any): LeadOutboundContext[] {
    const metadata = asRecord(lead?.metadata)
    const whatsapp = asRecord(metadata.whatsapp)
    const contexts = Array.isArray(whatsapp.outbound_contexts) ? whatsapp.outbound_contexts : []
    const last = asRecord(whatsapp.last_outbound_context)
    const all = [
        Object.keys(last).length ? last : null,
        ...contexts,
    ].filter(Boolean)

    const seen = new Set<string>()
    return all
        .map((item: any) => sanitizeOutboundContext({
            channel: item.channel,
            sourceAgent: item.source_agent,
            senderAgent: item.sender_agent,
            originAgent: item.origin_agent,
            campaignId: item.campaign_id,
            workflowRunId: item.workflow_run_id,
            contentType: item.content_type,
            trigger: item.trigger,
            contentId: item.content_id,
            contentTitle: item.content_title,
            contentSummary: item.content_summary,
            contentUrl: item.content_url,
            ctaLabel: item.cta_label,
            message: item.message_preview,
            recommendationScore: item.recommendation_score,
            recommendationReason: item.recommendation_reason,
            recommendationReasons: item.recommendation_reasons,
            recommendationSourcePropertyIds: item.recommendation_source_property_ids,
            sentAt: item.sent_at,
        }))
        .filter((item) => {
            const key = item.id || `${item.sent_at}:${item.content_url || item.content_title || ''}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
        .slice(0, 5)
}

export function buildRecentLeadOutboundContextPrompt(lead: any, latestUserMessage?: string | null): string {
    const contexts = getRecentLeadOutboundContexts(lead)
    const latest = contexts.find(context => context.channel === 'whatsapp') || contexts[0]
    if (!latest) return ''

    const sentAtMs = new Date(latest.sent_at).getTime()
    const maxAgeMs = 10 * 24 * 60 * 60 * 1000
    if (Number.isFinite(sentAtMs) && Date.now() - sentAtMs > maxAgeMs) return ''

    const contentLabel = latest.content_type === 'news'
        ? 'noticia'
        : latest.content_type === 'blog'
            ? 'artigo de blog'
            : latest.content_type === 'event'
                ? 'evento'
                : latest.content_type === 'property'
                    ? 'imovel'
                    : 'conteudo'
    const rawLeadText = compactString(latestUserMessage, 160).toLowerCase()
    const looksLikeReplyToContext = rawLeadText.length > 0 && rawLeadText.length <= 90

    return [
        'CONTEXTO RECENTE DO LEAD NO ECOSSISTEMA (nao revele como dado interno):',
        `- Ultima comunicacao ativa enviada pelo sistema: ${contentLabel}.`,
        latest.content_title ? `- Titulo enviado: ${latest.content_title}` : '',
        latest.content_summary ? `- Resumo do conteudo: ${latest.content_summary}` : '',
        latest.content_url ? `- Link enviado ao lead: ${latest.content_url}` : '',
        latest.cta_label ? `- Texto do botao enviado: ${latest.cta_label}` : '',
        latest.recommendation_score != null ? `- Score contextual da recomendacao: ${latest.recommendation_score}%.` : '',
        latest.recommendation_reason ? `- Motivo contextual do envio: ${latest.recommendation_reason}.` : '',
        `- Canal de envio: ${latest.channel}; agente distribuidor: ${latest.source_agent || 'gabriel_distribuicao'}; origem: ${latest.origin_agent || 'ecossistema'}.`,
        latest.sent_at ? `- Enviado em: ${latest.sent_at}` : '',
        '',
        'REGRAS PARA RESPONDER:',
        looksLikeReplyToContext
            ? '- A mensagem atual do lead parece resposta curta/ambigua ao conteudo enviado. Responda considerando esse conteudo antes de qualquer outro assunto.'
            : '- Se o lead citar esse conteudo, use as informacoes acima para responder com continuidade.',
        '- Nao assuma que o lead esta falando de um apartamento, visita ou outro imovel se ele nao mencionou isso claramente.',
        '- Se houver duvida, confirme com naturalidade: "Voce esta falando da noticia/artigo que te enviei agora ha pouco?"',
        '- Quando fizer sentido, convide o lead a abrir o link enviado ou perguntar algo sobre aquele conteudo.',
    ].filter(Boolean).join('\n')
}

export async function recordLeadOutboundContext(
    supabase: SupabaseClientLike,
    params: {
        leadId?: string | null
        phone?: string | null
        channel?: unknown
        sourceAgent?: unknown
        senderAgent?: unknown
        originAgent?: unknown
        campaignId?: unknown
        workflowRunId?: unknown
        contentType?: unknown
        trigger?: unknown
        contentId?: unknown
        contentTitle?: unknown
        contentSummary?: unknown
        contentUrl?: unknown
        ctaLabel?: unknown
        message?: unknown
        recommendationScore?: unknown
        recommendationReason?: unknown
        recommendationReasons?: unknown
        recommendationSourcePropertyIds?: unknown
        sentAt?: unknown
    }
) {
    let lead: any = null

    if (params.leadId) {
        const { data, error } = await supabase
            .from('leads')
            .select('id, metadata, conversation_log, phone, phone_e164')
            .eq('id', params.leadId)
            .maybeSingle()
        if (error) console.warn('[WhatsApp Lead Sync] outbound lead lookup by id failed:', error.message)
        else lead = data || null
    }

    if (!lead && params.phone) {
        lead = await findLeadByPhone(supabase, params.phone)
    }

    if (!lead?.id) return null

    const outbound = sanitizeOutboundContext(params)
    const metadata = asRecord(lead.metadata)
    const whatsapp = asRecord(metadata.whatsapp)
    const previousContexts = Array.isArray(whatsapp.outbound_contexts)
        ? whatsapp.outbound_contexts
        : []
    const nextContexts = [
        outbound,
        ...previousContexts.filter((item: any) => {
            const itemId = compactString(item?.id || item?.workflow_run_id || item?.campaign_id)
            return itemId !== outbound.id
        }),
    ].slice(0, 20)

    const nextMetadata = {
        ...metadata,
        whatsapp: {
            ...whatsapp,
            last_outbound_context: outbound,
            last_editorial_context: ['blog', 'news'].includes(outbound.content_type)
                ? outbound
                : whatsapp.last_editorial_context || null,
            outbound_contexts: nextContexts,
        },
    }

    const currentLog = Array.isArray(lead.conversation_log) ? lead.conversation_log : []
    const conversationLog = dedupeConversationLog([
        ...currentLog,
        toConversationEntry({
            role: 'assistant',
            content: outbound.message_preview || outbound.content_title || outbound.content_url || 'Conteudo enviado pelo ecossistema.',
            type: 'editorial_distribution',
            source: outbound.source_agent || 'editorial_distribution',
            message_id: outbound.workflow_run_id ? `editorial:${outbound.workflow_run_id}` : null,
            timestamp: outbound.sent_at,
            metadata: {
                outbound_context: outbound,
            },
        }),
    ])

    const { error } = await supabase
        .from('leads')
        .update({
            metadata: nextMetadata,
            conversation_log: conversationLog,
            updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)

    if (error) {
        console.warn('[WhatsApp Lead Sync] outbound context update failed:', error.message)
        return null
    }

    return { lead_id: lead.id, outbound_context: outbound }
}

export async function findLeadByPhone(supabase: SupabaseClientLike, phone: string) {
    const candidates = phoneCandidates(phone)
    if (candidates.length === 0) return null

    const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, phone_e164, avatar_url, avatar_source, avatar_updated_at, metadata, conversation_log, funnel_stage, acquired_via, conversation_started_at')
        .or(buildPhoneOrFilter(candidates))
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        console.warn('[WhatsApp Lead Sync] findLeadByPhone failed:', error.message)
        return null
    }
    return data || null
}

export async function ensureWhatsAppLead(
    supabase: SupabaseClientLike,
    context: WhatsAppLeadContext
): Promise<any | null> {
    const phone = normalizeWhatsAppPhone(context.phone)
    if (!phone) return null

    const now = new Date().toISOString()
    const existing = await findLeadByPhone(supabase, phone)
    const senderName = cleanLeadNameCandidate(context.senderName)
    const hasReliableExistingName = Boolean(existing?.name && !isGenericWhatsAppLeadName(existing.name))
    const importedContactName = hasReliableExistingName
        ? null
        : await findImportedContactName(supabase, phone, context.instanceId)
    const resolvedName = importedContactName?.name || senderName || null
    const fallbackName = resolvedName || formatPhoneFallbackName(phone) || phone
    const nameSource = importedContactName?.source || (senderName ? 'whatsapp_sender_name' : 'phone_fallback')
    const avatarCheckedAt = (existing?.metadata as any)?.whatsapp?.avatar_checked_at
    const avatarCheckedMs = avatarCheckedAt ? new Date(String(avatarCheckedAt)).getTime() : 0
    const shouldRefreshAvatar = Boolean(context.instanceToken)
        && (!existing?.avatar_url || !Number.isFinite(avatarCheckedMs) || Date.now() - avatarCheckedMs > 24 * 60 * 60 * 1000)
    const avatar = shouldRefreshAvatar
        ? await fetchWhatsAppAvatar(phone, context.instanceToken)
        : { url: existing?.avatar_url || null, source: 'cached' }
    const metadata = mergeMetadata(existing?.metadata, {
        first_contact_channel: 'whatsapp',
        last_contact_channel: 'whatsapp',
        last_contact_at: now,
        instance_id: context.instanceId || null,
        instance_name: context.instanceName || null,
        broker_id: context.brokerId || null,
        avatar_checked_at: shouldRefreshAvatar ? now : avatarCheckedAt || null,
        avatar_status: avatar.url ? 'available' : (shouldRefreshAvatar ? avatar.source : 'cached'),
        avatar_source: avatar.source,
        resolved_name: fallbackName,
        lead_name_source: nameSource,
        lead_name_resolved_at: now,
        imported_contact_id: importedContactName?.contact?.id || null,
        imported_contact_name: importedContactName?.name || null,
    })

    if (existing?.id) {
        const updateData: Record<string, unknown> = {
            phone,
            phone_e164: phone,
            metadata,
            conversation_started_at: existing.conversation_started_at || now,
            updated_at: now,
        }
        if (avatar.url) {
            updateData.avatar_url = avatar.url
            updateData.avatar_source = avatar.source
            updateData.avatar_updated_at = now
        }

        if (!existing.name || isGenericWhatsAppLeadName(existing.name)) {
            updateData.name = fallbackName
        }
        if (!existing.acquired_via) updateData.acquired_via = context.acquiredVia || 'whatsapp'
        if (!['qualified', 'converted', 'closed'].includes(String(existing.funnel_stage || '').toLowerCase())) {
            updateData.funnel_stage = 'lead'
        }

        const { data, error } = await supabase
            .from('leads')
            .update(updateData)
            .eq('id', existing.id)
            .select('id, name, email, phone, phone_e164, avatar_url, avatar_source, avatar_updated_at, metadata, conversation_log, funnel_stage, acquired_via')
            .single()

        if (error) {
            console.warn('[WhatsApp Lead Sync] lead update failed:', error.message)
            return existing
        }
        if (context.brokerId) {
            await upsertBrokerLeadProfile(supabase, {
                ...context,
                leadId: data.id,
                leadName: data.name || fallbackName || null,
                status: 'new',
                lastMessageAt: now,
            }).catch(() => null)
        }
        return data
    }

    const { data, error } = await supabase
        .from('leads')
        .insert({
            name: fallbackName,
            phone,
            phone_e164: phone,
            funnel_stage: 'lead',
            acquired_via: context.acquiredVia || 'whatsapp',
            avatar_url: avatar.url || null,
            avatar_source: avatar.url ? avatar.source : null,
            avatar_updated_at: avatar.url ? now : null,
            metadata,
            conversation_log: [],
            conversation_started_at: now,
        })
        .select('id, name, email, phone, phone_e164, avatar_url, avatar_source, avatar_updated_at, metadata, conversation_log, funnel_stage, acquired_via')
        .single()

    if (error) {
        console.warn('[WhatsApp Lead Sync] lead insert failed:', error.message)
        return null
    }

    if (context.brokerId) {
        await upsertBrokerLeadProfile(supabase, {
            ...context,
            leadId: data.id,
            leadName: data.name || fallbackName,
            status: 'new',
            lastMessageAt: now,
        }).catch(() => null)
    }

    return data
}

export async function appendLeadConversationLog(
    supabase: SupabaseClientLike,
    leadId: string | null | undefined,
    message: WhatsAppLeadMessage
) {
    if (!leadId) return
    const entry = toConversationEntry(message)
    if (!entry.content) return

    const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone, phone_e164, conversation_log')
        .eq('id', leadId)
        .maybeSingle()

    if (error) {
        console.warn('[WhatsApp Lead Sync] read conversation_log failed:', error.message)
        return
    }

    const current = Array.isArray(data?.conversation_log) ? data.conversation_log : []
    const existingIndex = findConversationEntryIndex(current, entry)
    const existingEntry = existingIndex >= 0 ? current[existingIndex] : null
    const existingSource = String(existingEntry?.source || '').toLowerCase()
    const nextSource = String(entry.source || '').toLowerCase()
    const shouldUpgradePendingSource = existingEntry && existingSource === 'from_me_pending' && ['human', 'agent', 'whatsapp_agent'].includes(nextSource)
    const shouldRecordEvent = existingIndex < 0 || shouldUpgradePendingSource
    const mergedCurrent = shouldUpgradePendingSource
        ? current.map((item: any, index: number) => index === existingIndex
            ? {
                ...item,
                ...entry,
                metadata: {
                    ...((item?.metadata && typeof item.metadata === 'object') ? item.metadata : {}),
                    ...((entry.metadata && typeof entry.metadata === 'object') ? entry.metadata : {}),
                },
            }
            : item)
        : current
    const next = dedupeConversationLog(shouldUpgradePendingSource ? mergedCurrent : [...current, entry])

    const { error: updateError } = await supabase
        .from('leads')
        .update({ conversation_log: next, updated_at: new Date().toISOString() })
        .eq('id', leadId)

    if (updateError) {
        console.warn('[WhatsApp Lead Sync] append conversation_log failed:', updateError.message)
        return
    }

    if (shouldRecordEvent) {
        await recordLeadConversationLogEvent(supabase, data, entry)
    }
}

function parseBudgetToNumber(value: unknown): number | null {
    const raw = String(value || '')
    if (!raw.trim()) return null
    const lower = raw.toLowerCase()
    const cleaned = raw
        .replace(/[^\d,\.]/g, '')
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.')
    let parsed = Number(cleaned)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    if (/(milh|milhao|milhoes|mi\b)/i.test(lower) && parsed < 1000) parsed *= 1000000
    else if (/(^|\s)(mil|k)(\s|$)/i.test(lower) && parsed < 10000) parsed *= 1000
    return parsed
}

function scoreCollectedLead(data: Record<string, unknown>) {
    let score = 0
    if (data.lead_name) score += 10
    if (data.interest) score += 25
    if (data.region) score += 20
    if (data.budget_max) score += 25
    if (data.timeline) score += 15
    if (data.property_type) score += 5
    return Math.min(100, score)
}

function classificationFromScore(score: number, explicit?: unknown) {
    const normalized = String(explicit || '').toLowerCase()
    if (['vip', 'hot', 'warm', 'cold'].includes(normalized)) return normalized
    if (score >= 85) return 'vip'
    if (score >= 70) return 'hot'
    if (score >= 40) return 'warm'
    return 'cold'
}

async function upsertBrokerLeadProfile(
    supabase: SupabaseClientLike,
    params: WhatsAppLeadContext & {
        leadId?: string | null
        conversationId?: string | null
        leadName?: string | null
        interest?: string | null
        region?: string | null
        budgetMin?: number | null
        budgetMax?: number | null
        bedroomsWanted?: number | null
        propertyType?: string | null
        timeline?: string | null
        qualificationScore?: number | null
        leadClassification?: string | null
        status?: string | null
        notes?: string | null
        documentsReceived?: any[] | null
        latitude?: number | null
        longitude?: number | null
        lastMessageAt?: string | null
    }
) {
    const phone = normalizeWhatsAppPhone(params.phone)
    if (!phone || !params.brokerId) return null

    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
        lead_id: params.leadId || null,
        lead_phone: phone,
        broker_id: params.brokerId,
        instance_id: params.instanceId || null,
        conversation_id: params.conversationId || null,
        lead_name: params.leadName || params.senderName || null,
        interest: params.interest || null,
        region: params.region || null,
        budget_min: params.budgetMin ?? null,
        budget_max: params.budgetMax ?? null,
        bedrooms_wanted: params.bedroomsWanted ?? null,
        property_type: params.propertyType || null,
        timeline: params.timeline || null,
        qualification_score: Math.max(0, Math.min(100, Number(params.qualificationScore || 0))),
        lead_classification: params.leadClassification || null,
        status: params.status || 'new',
        notes: params.notes ?? null,
        documents_received: Array.isArray(params.documentsReceived) ? params.documentsReceived : [],
        latitude: params.latitude ?? null,
        longitude: params.longitude ?? null,
        first_contact_at: params.lastMessageAt || now,
        last_message_at: params.lastMessageAt || now,
        updated_at: now,
    }

    for (const key of Object.keys(payload)) {
        if (
            !['lead_phone', 'broker_id', 'qualification_score', 'status', 'documents_received', 'updated_at'].includes(key)
            && (payload[key] === null || payload[key] === undefined || payload[key] === '')
        ) {
            delete payload[key]
        }
    }

    const { data, error } = await supabase
        .from('broker_lead_profiles')
        .upsert(payload, { onConflict: 'broker_id,lead_phone' })
        .select('id')
        .maybeSingle()

    if (error) {
        console.warn('[WhatsApp Lead Sync] broker lead profile upsert failed:', error.message)
        return null
    }

    return data || null
}

export async function syncWhatsAppLeadSnapshot(
    supabase: SupabaseClientLike,
    params: WhatsAppLeadContext & {
        messages?: WhatsAppLeadMessage[] | any[]
        extractedData?: Record<string, any> | null
        shouldTransfer?: boolean
    }
) {
    const lead = await ensureWhatsAppLead(supabase, params)
    if (!lead?.id) return null

    const extracted = params.extractedData || {}
    const normalizedMessages = (params.messages || [])
        .map((message: any) => toConversationEntry({
            role: message?.role === 'assistant' ? 'assistant' : 'user',
            content: String(message?.content || ''),
            type: message?.type || 'text',
            source: message?.source || (message?.role === 'assistant' ? 'agent' : 'lead'),
            message_id: message?.message_id || null,
            instance_id: message?.instance_id || params.instanceId || null,
            broker_id: message?.broker_id || params.brokerId || null,
            timestamp: message?.timestamp || null,
        }))
        .filter((message: any) => message.content)
    const inferredMessageName = inferLeadNameFromMessages(normalizedMessages)
    const snapshotLeadName = cleanLeadNameCandidate(extracted.name)
        || cleanLeadNameCandidate(params.senderName)
        || inferredMessageName
        || (!isGenericWhatsAppLeadName(lead.name) ? String(lead.name || '').trim() : null)

    const scoreSeed: Record<string, unknown> = {
        lead_name: snapshotLeadName || lead.name,
        interest: extracted.interest || extracted.purpose || extracted.finalidade || null,
        region: extracted.region || null,
        budget_max: parseBudgetToNumber(extracted.budget || extracted.orcamento),
        property_type: extracted.property_type || null,
        timeline: extracted.timeframe || extracted.prazo || null,
    }
    const budgetMaxNumber = typeof scoreSeed.budget_max === 'number' ? scoreSeed.budget_max : null
    const score = scoreCollectedLead(scoreSeed)
    const classification = classificationFromScore(score, extracted.classification)
    const pipelineStage = normalizeLeadPipelineStageKey(extracted.pipeline_stage)
    const now = new Date().toISOString()
    const currentLog = Array.isArray(lead.conversation_log) ? lead.conversation_log : []
    const conversationLog = normalizedMessages.length > 0
        ? dedupeConversationLog([...currentLog, ...normalizedMessages])
        : currentLog

    const leadUpdate: Record<string, unknown> = {
        conversation_log: conversationLog,
        lead_score: score,
        lead_classification: classification,
        updated_at: now,
    }

    if (score >= 70 || params.shouldTransfer) leadUpdate.funnel_stage = 'qualified'
    else if (!['qualified', 'converted', 'closed'].includes(String(lead.funnel_stage || '').toLowerCase())) leadUpdate.funnel_stage = 'lead'

    if (snapshotLeadName && (!lead.name || isGenericWhatsAppLeadName(lead.name))) leadUpdate.name = snapshotLeadName
    const extractedEmail = normalizeEmail(extracted.email)
    if (extractedEmail) leadUpdate.email = extractedEmail
    if (extracted.summary) leadUpdate.ai_summary = extracted.summary
    if (scoreSeed.interest) leadUpdate.lead_purpose = scoreSeed.interest
    if (extracted.budget || extracted.orcamento) leadUpdate.lead_budget = extracted.budget || extracted.orcamento
    if (scoreSeed.timeline) leadUpdate.lead_timeframe = scoreSeed.timeline
    if (typeof extracted.is_partner === 'boolean') leadUpdate.is_partner = extracted.is_partner
    const baseMetadata = lead.metadata && typeof lead.metadata === 'object' && !Array.isArray(lead.metadata)
        ? lead.metadata as Record<string, unknown>
        : {}
    const currentTracking = baseMetadata.tracking && typeof baseMetadata.tracking === 'object'
        ? baseMetadata.tracking as Record<string, unknown>
        : {}
    let nextMetadata: Record<string, unknown> = mergeMetadata(lead.metadata, {
        qualification: {
            updated_at: now,
            source: 'whatsapp_agent',
            lead_name: scoreSeed.lead_name || null,
            lead_name_inferred_from_messages: inferredMessageName || null,
            interest: scoreSeed.interest || null,
            region: scoreSeed.region || null,
            budget: extracted.budget || extracted.orcamento || null,
            budget_number: extracted.budget_number || scoreSeed.budget_max || null,
            property_type: scoreSeed.property_type || null,
            bedrooms: extracted.bedrooms || null,
            timeline: scoreSeed.timeline || null,
            classification,
            pipeline_stage: pipelineStage,
            pipeline_reason: extracted.pipeline_reason || null,
            score,
            objections: Array.isArray(extracted.objections) ? extracted.objections : [],
        },
    })
    if (extracted.self_reported_source || extracted.lead_source) {
        const reportedSource = String(extracted.self_reported_source || extracted.lead_source)
        nextMetadata = {
            ...nextMetadata,
            tracking: {
                ...currentTracking,
                self_reported_source: reportedSource,
                detected_source: currentTracking.detected_source || reportedSource,
                source_collected_by: 'whatsapp_agent',
                source_collected_at: now,
            },
        }
        if (!lead.acquired_via || String(lead.acquired_via).toLowerCase() === 'whatsapp') {
            leadUpdate.acquired_via = reportedSource
        }
    }
    leadUpdate.metadata = nextMetadata

    const { error: leadError } = await supabase
        .from('leads')
        .update(leadUpdate)
        .eq('id', lead.id)

    if (leadError) {
        console.warn('[WhatsApp Lead Sync] lead snapshot update failed:', leadError.message)
    }

    const collectedUpdate: Record<string, unknown> = {
        lead_phone: normalizeWhatsAppPhone(params.phone),
        lead_name: scoreSeed.lead_name || null,
        interest: scoreSeed.interest || null,
        region: scoreSeed.region || null,
        budget_max: budgetMaxNumber,
        property_type: scoreSeed.property_type || null,
        timeline: scoreSeed.timeline || null,
        qualification_score: score,
        status: params.shouldTransfer ? 'transferred' : score >= 70 ? 'qualified' : score >= 30 ? 'qualifying' : 'new',
        broker_id: params.brokerId || null,
        updated_at: now,
    }

    if (extracted.bedrooms) {
        const bedrooms = parseInt(String(extracted.bedrooms), 10)
        if (Number.isFinite(bedrooms)) collectedUpdate.bedrooms_wanted = bedrooms
    }

    for (const key of Object.keys(collectedUpdate)) {
        if (key !== 'lead_phone' && (collectedUpdate[key] === null || collectedUpdate[key] === undefined || collectedUpdate[key] === '')) {
            delete collectedUpdate[key]
        }
    }

    const { error: collectedError } = await supabase
        .from('lead_collected_data')
        .upsert(collectedUpdate, { onConflict: 'lead_phone' })

    if (collectedError) {
        console.warn('[WhatsApp Lead Sync] lead_collected_data upsert failed:', collectedError.message)
    }

    await upsertBrokerLeadProfile(supabase, {
        ...params,
        leadId: lead.id,
        leadName: String(scoreSeed.lead_name || lead.name || params.senderName || '').trim() || null,
        interest: scoreSeed.interest ? String(scoreSeed.interest) : null,
        region: scoreSeed.region ? String(scoreSeed.region) : null,
        budgetMax: budgetMaxNumber,
        propertyType: scoreSeed.property_type ? String(scoreSeed.property_type) : null,
        timeline: scoreSeed.timeline ? String(scoreSeed.timeline) : null,
        bedroomsWanted: extracted.bedrooms ? parseInt(String(extracted.bedrooms), 10) || null : null,
        qualificationScore: score,
        leadClassification: classification,
        status: String(collectedUpdate.status || 'new'),
        lastMessageAt: now,
    }).catch(() => null)

    return { lead_id: lead.id, score, classification, pipeline_stage: pipelineStage }
}
