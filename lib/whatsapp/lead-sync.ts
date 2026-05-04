import { getChatDetails, getContactAvatar } from '../uazapi'

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
}

export type WhatsAppLeadContext = {
    phone: string
    senderName?: string | null
    instanceId?: string | null
    instanceName?: string | null
    instanceToken?: string | null
    brokerId?: string | null
    acquiredVia?: string | null
}

export function normalizeWhatsAppPhone(value: unknown): string {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('55') || digits.length > 11) return digits
    return `55${digits}`
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
    const senderName = String(context.senderName || '').trim()
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

        if (senderName && (!existing.name || /^whatsapp\s/i.test(String(existing.name)))) {
            updateData.name = senderName
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
        return data
    }

    const fallbackName = senderName || `WhatsApp ${phone.slice(-4)}`
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
        .select('conversation_log')
        .eq('id', leadId)
        .maybeSingle()

    if (error) {
        console.warn('[WhatsApp Lead Sync] read conversation_log failed:', error.message)
        return
    }

    const current = Array.isArray(data?.conversation_log) ? data.conversation_log : []
    const next = dedupeConversationLog([...current, entry])

    const { error: updateError } = await supabase
        .from('leads')
        .update({ conversation_log: next, updated_at: new Date().toISOString() })
        .eq('id', leadId)

    if (updateError) {
        console.warn('[WhatsApp Lead Sync] append conversation_log failed:', updateError.message)
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

    const scoreSeed: Record<string, unknown> = {
        lead_name: extracted.name || params.senderName || lead.name,
        interest: extracted.interest || extracted.purpose || extracted.finalidade || null,
        region: extracted.region || null,
        budget_max: parseBudgetToNumber(extracted.budget || extracted.orcamento),
        property_type: extracted.property_type || null,
        timeline: extracted.timeframe || extracted.prazo || null,
    }
    const score = scoreCollectedLead(scoreSeed)
    const classification = classificationFromScore(score, extracted.classification)
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

    if (extracted.name && (!lead.name || /^whatsapp\s/i.test(String(lead.name)))) leadUpdate.name = extracted.name
    if (extracted.email) leadUpdate.email = extracted.email
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
            interest: scoreSeed.interest || null,
            region: scoreSeed.region || null,
            budget: extracted.budget || extracted.orcamento || null,
            budget_number: extracted.budget_number || scoreSeed.budget_max || null,
            property_type: scoreSeed.property_type || null,
            bedrooms: extracted.bedrooms || null,
            timeline: scoreSeed.timeline || null,
            classification,
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
        budget_max: scoreSeed.budget_max || null,
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

    return { lead_id: lead.id, score, classification }
}
