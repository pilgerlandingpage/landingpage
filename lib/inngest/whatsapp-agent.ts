import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import {
    sendWhatsAppMessage,
    sendAudioMessage,
    sendMenuMessage,
    sendCarousel,
    sendPixButton,
    setPresenceTyping,
    setPresenceRecording,
    setPresenceAvailable,
    markAsRead,
    downloadMedia
} from '../uazapi'
import {
    appendLeadConversationLog,
    ensureWhatsAppLead,
    syncWhatsAppLeadSnapshot,
} from '../whatsapp/lead-sync'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function getSaoPauloTimeContext() {
    const spNow = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
    )
    const hour = spNow.getHours()
    const greeting = hour < 12 ? 'bom dia' : hour < 18 ? 'boa tarde' : 'boa noite'
    const date = spNow.toLocaleDateString('pt-BR')
    const time = spNow.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    })
    return { hour, greeting, date, time }
}

function parseHourMinuteToMinutes(raw: string | null | undefined): number | null {
    if (!raw) return null
    const m = String(raw).match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const hh = parseInt(m[1], 10)
    const mm = parseInt(m[2], 10)
    if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
    return hh * 60 + mm
}

function getNowInTimezone(timezone: string): Date {
    const safeTz = timezone || 'America/Sao_Paulo'
    return new Date(new Date().toLocaleString('en-US', { timeZone: safeTz }))
}

function isWithinAISchedule(configs: Record<string, string>) {
    const enabled = configs['whatsapp_ai_schedule_enabled'] === 'true'
    if (!enabled) return { enabled: false, within: true, reason: 'schedule_disabled' as const }

    const startRaw = configs['whatsapp_ai_schedule_start'] || '18:00'
    const endRaw = configs['whatsapp_ai_schedule_end'] || '08:00'
    const timezone = configs['whatsapp_ai_schedule_timezone'] || 'America/Sao_Paulo'
    const startMin = parseHourMinuteToMinutes(startRaw)
    const endMin = parseHourMinuteToMinutes(endRaw)
    if (startMin == null || endMin == null) {
        return { enabled: true, within: true, reason: 'invalid_schedule_values' as const }
    }

    const now = getNowInTimezone(timezone)
    const nowMin = now.getHours() * 60 + now.getMinutes()

    // Same start/end means 24h window.
    if (startMin === endMin) {
        return { enabled: true, within: true, reason: '24h_window' as const, nowMin, startMin, endMin, timezone }
    }

    const within = startMin < endMin
        ? nowMin >= startMin && nowMin < endMin
        : nowMin >= startMin || nowMin < endMin

    return { enabled: true, within, reason: 'ok' as const, nowMin, startMin, endMin, timezone }
}

function buildHandoffSummary(leadPhone: string, messages: any[]): string {
    const safeMessages = Array.isArray(messages) ? messages : []
    const recent = safeMessages.slice(-10)
    const lines = recent.map((m: any) => {
        const who = m?.role === 'assistant' ? 'Atendente' : 'Lead'
        const txt = String(m?.content || '').replace(/\s+/g, ' ').trim()
        if (!txt) return ''
        return `- ${who}: ${txt.length > 180 ? `${txt.slice(0, 180)}...` : txt}`
    }).filter(Boolean)

    const body = lines.length
        ? lines.join('\n')
        : '- Conversa iniciada, sem conteúdo textual suficiente para resumir.'

    return `📋 *Passagem de Plantão (IA → Humano)*\n\n👤 Lead: ${leadPhone}\n\nResumo rápido da conversa:\n${body}\n\n✅ Atendimento humano assumido.`
}

function buildStructuredHandoffSummary(leadPhone: string, conversation: any): string {
    const extracted = conversation?.lead_data_extracted || {}
    const name = extracted?.name || 'Não informado'
    const interest = extracted?.interest || 'Não informado'
    const region = extracted?.region || 'Não informado'
    const budget = extracted?.budget || 'Não informado'
    const timeframe = extracted?.timeframe || 'Não informado'

    const recentMessages = Array.isArray(conversation?.messages) ? conversation.messages.slice(-8) : []
    const timeline = recentMessages.map((m: any) => {
        const who = m?.role === 'assistant' ? 'Atendente' : 'Lead'
        const txt = String(m?.content || '').replace(/\s+/g, ' ').trim()
        if (!txt) return ''
        return `- ${who}: ${txt.length > 140 ? `${txt.slice(0, 140)}...` : txt}`
    }).filter(Boolean).join('\n')

    const heuristicScore = (() => {
        let score = 0
        if (interest && interest !== 'Não informado') score += 25
        if (region && region !== 'Não informado') score += 20
        if (budget && budget !== 'Não informado') score += 25
        if (timeframe && timeframe !== 'Não informado') score += 15
        if (Array.isArray(conversation?.messages) && conversation.messages.length >= 6) score += 15
        return Math.min(100, score)
    })()
    const priority = heuristicScore >= 70 ? 'Quente' : heuristicScore >= 45 ? 'Morno' : 'Frio'

    return [
        '📋 *Passagem de Plantão (IA → Humano)*',
        '',
        `👤 Lead: ${name}`,
        `📱 Telefone: ${leadPhone}`,
        `🎯 Interesse: ${interest}`,
        `📍 Região: ${region}`,
        `💰 Orçamento: ${budget}`,
        `⏱️ Prazo: ${timeframe}`,
        `🔥 Prioridade: ${priority} (${heuristicScore}/100)`,
        '',
        'Resumo das últimas interações:',
        timeline || '- Sem conteúdo textual suficiente.',
        '',
        'Próximo passo sugerido:',
        '- Fazer contato humano imediato, confirmar critérios e avançar para visita/proposta.',
    ].join('\n')
}

async function sendHandoffSummaryIfNeeded(
    supabase: ReturnType<typeof getSupabase>,
    params: {
        conversation: any
        instanceId: string
        instanceToken: string
        recipientPhone: string
        markerSuffix: string
    }
) {
    const { conversation, instanceId, instanceToken, recipientPhone, markerSuffix } = params
    if (!conversation?.id || !conversation?.broker_id || !instanceToken) return false

    const markerKey = `_handoff_${conversation.id}_${markerSuffix}`
    const { data: existingMarker } = await supabase
        .from('app_config')
        .select('key')
        .eq('key', markerKey)
        .maybeSingle()
    if (existingMarker?.key) return false

    const handoffPhone = await resolveSummaryTargetPhone(
        supabase,
        conversation.broker_id,
        instanceId,
        recipientPhone
    )
    if (!handoffPhone || handoffPhone === recipientPhone) return false

    const summary = buildStructuredHandoffSummary(conversation.lead_phone || recipientPhone, conversation)
    await sendWhatsAppMessage({
        phone: handoffPhone,
        message: summary,
        instanceToken,
    }).catch((err) => {
        console.warn('[Handoff] Failed to send summary:', err)
    })

    try {
        await supabase.from('app_config').upsert({
            key: markerKey,
            value: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
    } catch {
        // best effort marker
    }

    return true
}

async function resolveSummaryTargetPhone(
    supabase: ReturnType<typeof getSupabase>,
    brokerId: string,
    instanceId: string,
    recipientPhone: string
): Promise<string> {
    const { data: broker } = await supabase
        .from('virtual_brokers')
        .select('phone, transfer_to_phone, summary_to_phone')
        .eq('id', brokerId)
        .maybeSingle()

    const { data: inst } = await supabase
        .from('whatsapp_instances')
        .select('phone_number')
        .eq('id', instanceId)
        .maybeSingle()

    const candidates = [
        broker?.summary_to_phone,
        inst?.phone_number,
        broker?.transfer_to_phone,
        broker?.phone,
    ].map(v => String(v || '').replace(/\D/g, '')).filter(Boolean)

    const recipient = String(recipientPhone || '').replace(/\D/g, '')
    const firstValid = candidates.find(c => c && c !== recipient)
    return firstValid || ''
}

function buildShiftConsolidatedSummary(conversations: any[], timezone: string): string {
    const safe = Array.isArray(conversations) ? conversations : []
    const header = `📊 *Resumo Consolidado do Plantão IA*\n🕒 Fuso: ${timezone}\n👥 Atendimentos: ${safe.length}\n`
    if (safe.length === 0) {
        return `${header}\nNenhum atendimento registrado neste turno.`
    }

    const lines: string[] = []
    for (const conv of safe.slice(0, 20)) {
        const d = conv?.lead_data_extracted || {}
        const leadName = d?.name || 'Lead sem nome'
        const leadPhone = conv?.lead_phone || 'sem telefone'
        const interest = d?.interest || 'não informado'
        const region = d?.region || 'não informada'
        const budget = d?.budget || 'não informado'
        const score = typeof conv?.qualification_score === 'number' ? conv.qualification_score : null
        const priority = score != null ? (score >= 70 ? 'quente' : score >= 45 ? 'morno' : 'frio') : 'indefinida'
        lines.push(`- ${leadName} (${leadPhone}) | ${interest} | ${region} | orçamento: ${budget} | prioridade: ${priority}`)
    }

    const truncated = safe.length > 20 ? `\n...e mais ${safe.length - 20} atendimento(s).` : ''
    return `${header}\n${lines.join('\n')}${truncated}\n\n✅ Recomendação: priorize contatos *quentes* primeiro.`
}

async function sendShiftConsolidatedSummaryIfNeeded(
    supabase: ReturnType<typeof getSupabase>,
    params: {
        brokerId: string
        instanceId: string
        instanceToken: string
        timezone: string
        markerSuffix: string
    }
) {
    const { brokerId, instanceId, instanceToken, timezone, markerSuffix } = params
    if (!brokerId || !instanceToken) return false

    const markerKey = `_handoff_shift_${instanceId}_${markerSuffix}`
    const { data: marker } = await supabase
        .from('app_config')
        .select('key')
        .eq('key', markerKey)
        .maybeSingle()
    if (marker?.key) return false

    // recipientPhone not relevant here; use empty to only avoid impossible self-recipient collision.
    const handoffPhone = await resolveSummaryTargetPhone(supabase, brokerId, instanceId, '')
    if (!handoffPhone) return false

    const windowStart = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const { data: conversations } = await supabase
        .from('whatsapp_ai_conversations')
        .select('id, lead_phone, messages, updated_at')
        .eq('instance_id', instanceId)
        .eq('broker_id', brokerId)
        .gte('updated_at', windowStart)
        .order('updated_at', { ascending: false })
        .limit(50)

    const summary = buildShiftConsolidatedSummary(conversations || [], timezone)
    await sendWhatsAppMessage({
        phone: handoffPhone,
        message: summary,
        instanceToken,
    }).catch((err) => {
        console.warn('[Handoff Shift] Failed to send consolidated summary:', err)
    })

    try {
        await supabase.from('app_config').upsert({
            key: markerKey,
            value: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
    } catch {
        // best effort marker
    }

    return true
}

async function pickTransferTargetInstance(
    supabase: ReturnType<typeof getSupabase>,
    sourceInstanceId: string,
    transferConfig: Record<string, string>
) {
    const defaultInstanceId = transferConfig['agent_default_instance_id'] || ''
    const mode = (transferConfig['agent_transfer_mode'] || 'round_robin').toLowerCase()
    let targetIds: string[] = []
    try {
        const parsed = JSON.parse(transferConfig['agent_transfer_instance_ids'] || '[]')
        if (Array.isArray(parsed)) targetIds = parsed.filter(Boolean)
    } catch {
        targetIds = []
    }

    // Only default triage instance can distribute to queue.
    if (!defaultInstanceId || sourceInstanceId !== defaultInstanceId) return null
    if (targetIds.length === 0) return null

    const { data: candidates } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_token, phone_number, status, broker_id')
        .in('id', targetIds)

    const valid = (candidates || [])
        .filter((i: any) => i.id !== sourceInstanceId && i.status === 'connected' && i.instance_token && i.phone_number)
        .sort((a: any, b: any) => targetIds.indexOf(a.id) - targetIds.indexOf(b.id))

    if (valid.length === 0) return null
    if (mode === 'fixed') return valid[0]

    const rrKey = 'agent_transfer_rr_index'
    const { data: rr } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', rrKey)
        .maybeSingle()
    let idx = parseInt(rr?.value || transferConfig[rrKey] || '0', 10)
    if (!Number.isFinite(idx) || idx < 0) idx = 0
    const chosen = valid[idx % valid.length]
    const next = String((idx + 1) % valid.length)
    try {
        await supabase.from('app_config').upsert({
            key: rrKey,
            value: next,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
    } catch {}
    return chosen
}

function normalizeTextForMatch(value: string): string {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

async function pickTransferTargetByEmpreendimento(
    supabase: ReturnType<typeof getSupabase>,
    contextText: string
) {
    const normalized = normalizeTextForMatch(contextText)
    if (!normalized) return null

    const { data: empreendimentos } = await supabase
        .from('empreendimentos')
        .select('id, nome, slug, ativo')
        .eq('ativo', true)

    if (!empreendimentos || empreendimentos.length === 0) return null

    let matched: any = null
    for (const e of empreendimentos) {
        const nome = normalizeTextForMatch(String((e as any).nome || ''))
        const slug = normalizeTextForMatch(String((e as any).slug || ''))
        if ((nome && normalized.includes(nome)) || (slug && normalized.includes(slug))) {
            matched = e
            break
        }
    }
    if (!matched) return null

    const { data: links } = await supabase
        .from('broker_empreendimentos')
        .select('prioridade, broker_id')
        .eq('empreendimento_id', (matched as any).id)
        .eq('ativo', true)
        .order('prioridade', { ascending: true })
        .limit(10)

    if (!links || links.length === 0) return null

    const brokerIds = links.map((l: any) => l.broker_id).filter(Boolean)
    const { data: brokers } = await supabase
        .from('virtual_brokers')
        .select('id, name, is_active')
        .in('id', brokerIds)
        .eq('is_active', true)

    const activeBrokerMap = new Map((brokers || []).map((b: any) => [b.id, b]))
    const orderedActiveBrokerIds = brokerIds.filter((id: string) => activeBrokerMap.has(id))
    if (orderedActiveBrokerIds.length === 0) return null

    const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_token, phone_number, status, broker_id')
        .in('broker_id', orderedActiveBrokerIds)
        .eq('status', 'connected')

    if (!instances || instances.length === 0) return null

    // Keep priority order from broker_empreendimentos
    const first = orderedActiveBrokerIds.find((bid: string) => instances.some((i: any) => i.broker_id === bid))
    if (!first) return null
    const inst = instances.find((i: any) => i.broker_id === first)
    const broker = activeBrokerMap.get(first)
    if (!inst?.instance_token || !inst?.phone_number || !broker) return null

    return {
        source: 'empreendimento',
        empreendimento: matched,
        broker,
        instance: inst,
    }
}

async function appendConversationMessage(
    supabase: ReturnType<typeof getSupabase>,
    conversationId: string,
    message: { role: 'user' | 'assistant'; content: string; type?: string; source?: string }
) {
    const { data: conv } = await supabase
        .from('whatsapp_ai_conversations')
        .select('messages')
        .eq('id', conversationId)
        .maybeSingle()

    const current = Array.isArray(conv?.messages) ? conv.messages : []
    current.push({
        role: message.role,
        content: message.content,
        type: message.type || 'text',
        source: message.source || null,
        timestamp: new Date().toISOString(),
    })

    await supabase
        .from('whatsapp_ai_conversations')
        .update({ messages: current, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function loadAIConfigs(supabase: ReturnType<typeof getSupabase>, instanceId?: string) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
            'ai_provider', 'gemini_api_key', 'openai_api_key',
            'whatsapp_provider', 'gemini_whatsapp_model', 'openai_whatsapp_model',
            'whatsapp_audio_enabled', 'whatsapp_tts_provider', 'whatsapp_tts_voice',
            'elevenlabs_api_key',
            // Global fallback settings
            'whatsapp_always_online', 'whatsapp_mark_as_read',
            'whatsapp_transcription_enabled', 'whatsapp_human_intervention',
            'whatsapp_human_intervention_minutes', 'whatsapp_mirror_mode',
            'whatsapp_response_mode',
            'whatsapp_media_image_enabled', 'whatsapp_media_document_enabled', 'whatsapp_media_video_enabled',
            'whatsapp_agent_enabled', 'whatsapp_split_messages',
            'whatsapp_debounce_seconds',
            'whatsapp_ai_schedule_enabled', 'whatsapp_ai_schedule_start', 'whatsapp_ai_schedule_end', 'whatsapp_ai_schedule_timezone',
            // Agent operational settings from admin panel
            'agent_default_instance_id', 'agent_transfer_instance_ids', 'agent_transfer_mode', 'agent_transfer_rr_index',
            'agent_social_instagram', 'agent_social_facebook', 'agent_social_youtube',
            'agent_social_linkedin', 'agent_social_tiktok', 'agent_social_site', 'agent_link_buttons'
        ])

    const map: Record<string, string> = {}
    data?.forEach((c: any) => { map[c.key] = c.value })

    // Merge per-instance config (overrides global settings)
    if (instanceId) {
        try {
            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('config')
                .eq('id', instanceId)
                .single()

            if (inst?.config && typeof inst.config === 'object') {
                const cfg = inst.config as Record<string, any>
                // Map instance config keys to global config keys
                const keyMap: Record<string, string> = {
                    agent_enabled: 'whatsapp_agent_enabled',
                    always_online: 'whatsapp_always_online',
                    mark_as_read: 'whatsapp_mark_as_read',
                    response_mode: 'whatsapp_response_mode',
                    media_image_enabled: 'whatsapp_media_image_enabled',
                    media_document_enabled: 'whatsapp_media_document_enabled',
                    media_video_enabled: 'whatsapp_media_video_enabled',
                    split_messages: 'whatsapp_split_messages',
                    mirror_mode: 'whatsapp_mirror_mode',
                    audio_response: 'whatsapp_audio_enabled',
                    audio_transcription: 'whatsapp_transcription_enabled',
                    human_intervention: 'whatsapp_human_intervention',
                    debounce_seconds: 'whatsapp_debounce_seconds',
                    human_intervention_minutes: 'whatsapp_human_intervention_minutes',
                    ai_schedule_enabled: 'whatsapp_ai_schedule_enabled',
                    ai_schedule_start: 'whatsapp_ai_schedule_start',
                    ai_schedule_end: 'whatsapp_ai_schedule_end',
                    ai_schedule_timezone: 'whatsapp_ai_schedule_timezone',
                }
                for (const [instKey, globalKey] of Object.entries(keyMap)) {
                    if (cfg[instKey] !== undefined) {
                        map[globalKey] = String(cfg[instKey])
                    }
                }
                console.log(`[WhatsApp Agent] Loaded per-instance config for ${instanceId}`)
            }
        } catch { /* instance config not available, use global */ }
    }

    return map
}

// Split long text into human-like message chunks
function splitIntoHumanChunks(text: string): string[] {
    // Don't split short messages
    if (text.length <= 120) return [text]

    // Split on sentence boundaries: . ! ? followed by space or newline
    const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter(s => s.trim())
    if (sentences.length <= 1) return [text]

    // Group sentences into chunks of ~80-150 chars, max 4 chunks
    const chunks: string[] = []
    let current = ''

    for (const sentence of sentences) {
        if (current && (current.length + sentence.length + 1) > 150) {
            chunks.push(current.trim())
            current = sentence
        } else {
            current = current ? current + ' ' + sentence : sentence
        }
    }
    if (current.trim()) chunks.push(current.trim())

    // Limit to max 4 chunks to avoid spamming
    if (chunks.length > 4) {
        const merged: string[] = []
        const perGroup = Math.ceil(chunks.length / 4)
        for (let i = 0; i < chunks.length; i += perGroup) {
            merged.push(chunks.slice(i, i + perGroup).join(' '))
        }
        return merged
    }

    return chunks
}

function extractOutboundMessageId(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null
    const candidates = [
        payload?.id, payload?.messageId, payload?.key?.id,
        payload?.data?.id, payload?.data?.messageId, payload?.data?.key?.id,
        payload?.response?.id, payload?.response?.messageId, payload?.response?.key?.id,
    ]
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return null
}

async function trackBotMessageId(
    supabase: ReturnType<typeof getSupabase>,
    conversationId: string,
    currentIds: string[],
    sendResult: any
): Promise<string[]> {
    const outboundId = extractOutboundMessageId(sendResult)
    if (!outboundId || currentIds.includes(outboundId)) return currentIds
    const nextIds = [...currentIds, outboundId].slice(-150)
    await supabase
        .from('whatsapp_ai_conversations')
        .update({ bot_message_ids: nextIds, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    return nextIds
}

interface InteractiveElements {
    cleanText: string
    buttons?: { title: string; options: string[] }
    urlButtons?: { title: string; items: { text: string; url: string }[] }
    list?: { buttonText: string; sections: { title: string; rows: { title: string; id: string; description?: string }[] }[] }
    poll?: { question: string; options: string[]; multiSelect?: boolean }
    locationRequest?: boolean
    pix?: { pixKey: string; pixName: string; pixType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' }
    carousel?: { text: string; cards: { text: string; image?: string; buttons: { id: string; text: string; type: 'REPLY' | 'URL' | 'CALL' | 'COPY' }[] }[] }
}

function parseInteractiveElements(text: string): InteractiveElements {
    let cleanText = text

    // ── Parse [BOTOES_URL:titulo|Texto=>https://url|Texto2=>https://url2] ──
    const btnUrlMatch = cleanText.match(/\[BOTOES_URL:([^\]]+)\]/i)
    let urlButtons: InteractiveElements['urlButtons'] | undefined
    if (btnUrlMatch) {
        const parts = btnUrlMatch[1].split('|').map(s => s.trim()).filter(Boolean)
        const title = parts[0] || 'Abrir link'
        const items = parts
            .slice(1)
            .map((part) => {
                const separatorIndex = part.indexOf('=>')
                const textPart = separatorIndex >= 0 ? part.slice(0, separatorIndex).trim() : ''
                const urlPart = separatorIndex >= 0 ? part.slice(separatorIndex + 2).trim() : part.trim()
                return {
                    text: (textPart || 'Abrir').substring(0, 20),
                    url: (urlPart || '').trim(),
                }
            })
            .filter(i => /^https?:\/\//i.test(i.url))
            .slice(0, 4)

        if (items.length > 0) {
            urlButtons = { title, items }
        }
        cleanText = cleanText.replace(btnUrlMatch[0], '').trim()
    }

    // ── Parse [BOTOES:titulo|op1|op2|op3] ──
    const btnMatch = cleanText.match(/\[BOTOES:([^\]]+)\]/i)
    let buttons: InteractiveElements['buttons'] | undefined
    if (btnMatch) {
        const parts = btnMatch[1].split('|').map(s => s.trim())
        const title = parts[0] || 'Escolha uma opção'
        const options = parts.slice(1).filter(Boolean)
        if (options.length > 0) {
            buttons = { title, options }
        }
        cleanText = cleanText.replace(btnMatch[0], '').trim()
    }

    // ── Parse [LISTA:botao|[Seção]|item1|desc1|item2|desc2] ──
    const listMatch = cleanText.match(/\[LISTA:([^\]]+)\]/i)
    let list: InteractiveElements['list'] | undefined
    if (listMatch) {
        const parts = listMatch[1].split('|').map(s => s.trim())
        const buttonText = parts[0] || 'Ver opções'
        const sections: { title: string; rows: { title: string; id: string; description?: string }[] }[] = []
        let currentSection: { title: string; rows: { title: string; id: string; description?: string }[] } = { title: 'Opções', rows: [] }

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i]
            if (part.startsWith('[') && part.endsWith(']')) {
                // New section header
                if (currentSection.rows.length > 0) sections.push(currentSection)
                currentSection = { title: part.slice(1, -1), rows: [] }
            } else {
                // Row — check if next part is description
                const nextPart = parts[i + 1]
                const isNextASection = nextPart?.startsWith('[')
                const isNextARow = nextPart && !isNextASection

                // If current item has a description following it (not a section header)
                if (isNextARow && !parts[i + 2]?.startsWith('[') && currentSection.rows.length < parts.length) {
                    currentSection.rows.push({
                        title: part.substring(0, 24),
                        id: `row_${currentSection.rows.length}`,
                        description: nextPart.substring(0, 72),
                    })
                    i++ // skip description
                } else {
                    currentSection.rows.push({
                        title: part.substring(0, 24),
                        id: `row_${currentSection.rows.length}`,
                    })
                }
            }
        }
        if (currentSection.rows.length > 0) sections.push(currentSection)
        if (sections.length > 0) {
            list = { buttonText, sections }
        }
        cleanText = cleanText.replace(listMatch[0], '').trim()
    }

    // ── Parse [ENQUETE:pergunta|op1|op2|op3] ──
    const pollMatch = cleanText.match(/\[ENQUETE:([^\]]+)\]/i)
    let poll: InteractiveElements['poll'] | undefined
    if (pollMatch) {
        const parts = pollMatch[1].split('|').map(s => s.trim())
        const question = parts[0] || 'O que você prefere?'
        const options = parts.slice(1).filter(Boolean)
        if (options.length >= 2) {
            poll = { question, options, multiSelect: false }
        }
        cleanText = cleanText.replace(pollMatch[0], '').trim()
    }

    // ── Parse [LOCALIZACAO] ──
    const locMatch = cleanText.match(/\[LOCALIZACAO\]/i)
    let locationRequest = false
    if (locMatch) {
        locationRequest = true
        cleanText = cleanText.replace(locMatch[0], '').trim()
    }

    // ── Parse [PIX:pixKey|pixName|pixType] ──
    const pixMatch = cleanText.match(/\[PIX:([^\]]+)\]/i)
    let pix: InteractiveElements['pix'] | undefined
    if (pixMatch) {
        const [pixKeyRaw, pixNameRaw, pixTypeRaw] = pixMatch[1].split('|').map(s => s.trim())
        const pixType = ((pixTypeRaw || 'EVP').toUpperCase()) as 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'
        if (pixKeyRaw && ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'].includes(pixType)) {
            pix = {
                pixKey: pixKeyRaw,
                pixName: pixNameRaw || 'Pagamento',
                pixType,
            }
        }
        cleanText = cleanText.replace(pixMatch[0], '').trim()
    }

    // ── Parse [CAROUSEL_JSON:base64(json)] ──
    const carouselMatch = cleanText.match(/\[CAROUSEL_JSON:([A-Za-z0-9+/=_-]+)\]/i)
    let carousel: InteractiveElements['carousel'] | undefined
    if (carouselMatch) {
        try {
            const decoded = Buffer.from(carouselMatch[1], 'base64').toString('utf-8')
            const parsed = JSON.parse(decoded)
            if (parsed && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
                carousel = {
                    text: String(parsed.text || 'Confira as opções'),
                    cards: parsed.cards.slice(0, 10).map((c: any, idx: number) => ({
                        text: String(c?.text || `Card ${idx + 1}`).slice(0, 500),
                        image: c?.image ? String(c.image) : undefined,
                        buttons: Array.isArray(c?.buttons)
                            ? c.buttons.slice(0, 3).map((b: any, bIdx: number) => ({
                                id: String(b?.id || `btn_${idx}_${bIdx}`),
                                text: String(b?.text || 'Abrir').slice(0, 20),
                                type: (String(b?.type || 'URL').toUpperCase() as 'REPLY' | 'URL' | 'CALL' | 'COPY'),
                            }))
                            : [],
                    })),
                }
            }
        } catch {
            // ignore invalid payload
        }
        cleanText = cleanText.replace(carouselMatch[0], '').trim()
    }

    return { cleanText, buttons, urlButtons, list, poll, locationRequest, pix, carousel }
}

// Keep parseButtons as alias for backward compatibility
function parseButtons(text: string): { cleanText: string; buttons?: { title: string; options: string[] } } {
    const result = parseInteractiveElements(text)
    return { cleanText: result.cleanText, buttons: result.buttons }
}

function responseRequiresText(text: string): boolean {
    return /https?:\/\//.test(text) || /\[BOTOES_URL:/i.test(text) || /\[BOTOES:/i.test(text) || /\[LISTA:/i.test(text) || /\[ENQUETE:/i.test(text) || /\[LOCALIZACAO\]/i.test(text) || /\[PIX:/i.test(text) || /\[CAROUSEL_JSON:/i.test(text)
}

function resolveSocialQuickReply(choiceRaw: string | null | undefined, configs: Record<string, string>): string | null {
    const choice = String(choiceRaw || '').toLowerCase().trim()
    if (!choice) return null
    const ig = configs['agent_social_instagram'] || ''
    const yt = configs['agent_social_youtube'] || ''
    const site = configs['agent_social_site'] || ''
    const fb = configs['agent_social_facebook'] || ''
    const li = configs['agent_social_linkedin'] || ''
    const tt = configs['agent_social_tiktok'] || ''

    if (choice.includes('instagram') && ig) return `Perfeito! Nosso Instagram: ${ig}`
    if ((choice.includes('youtube') || choice.includes('vídeo') || choice.includes('video')) && yt) return `Claro! Nosso YouTube: ${yt}`
    if (choice.includes('site') && site) return `Aqui está nosso site oficial: ${site}`
    if (choice.includes('facebook') && fb) return `Aqui está nosso Facebook: ${fb}`
    if (choice.includes('linkedin') && li) return `Aqui está nosso LinkedIn: ${li}`
    if (choice.includes('tiktok') && tt) return `Aqui está nosso TikTok: ${tt}`
    return null
}

function sanitizeLeadName(raw?: string | null): string {
    const name = String(raw || '').trim()
    if (!name) return ''
    const lower = name.toLowerCase()
    // Ignore provider/system-like names that look robotic or not a real lead name.
    if (
        lower.includes('connectyhub') ||
        lower.includes('uazapi') ||
        lower.includes('whatsapp') ||
        lower.includes('bot')
    ) return ''
    return name
}

function normalizeGreetingByTime(text: string, userText: string, greeting: string): string {
    const clean = String(text || '')
    const user = String(userText || '').toLowerCase()
    const isGreetingInput = /\b(oi|ol[aá]|bom dia|boa tarde|boa noite|e ai|eai)\b/i.test(user)
    if (!isGreetingInput) return clean

    const expected = greeting.toLowerCase()
    return clean
        .replace(/\bbom dia\b/i, expected)
        .replace(/\bboa tarde\b/i, expected)
        .replace(/\bboa noite\b/i, expected)
}

function parseBudgetToNumber(value: unknown): number | null {
    if (!value) return null
    const raw = String(value).toLowerCase()
    const digits = raw.replace(/[^\d]/g, '')
    if (!digits) return null
    let n = parseInt(digits, 10)
    if (!Number.isFinite(n) || n <= 0) return null
    if (raw.includes('mil') && n < 10000) n *= 1000
    if (raw.includes('mi') && n < 1000) n *= 1000000
    if (n < 10000) n *= 1000
    return n
}

function extractLeadDataFromText(inputText: string, aiText: string, senderName?: string): Record<string, any> {
    const merged = `${inputText}\n${aiText}`
    const lower = merged.toLowerCase()
    const out: Record<string, any> = {}

    if (senderName) out.name = senderName

    const budgetMatch = merged.match(/(?:r\$\s*)?(\d{2,3}(?:[.\s]\d{3})+|\d{2,4})\s*(mil|mi|milh(?:ão|oes|ões))?/i)
    if (budgetMatch) {
        const rawBudget = `${budgetMatch[1]} ${budgetMatch[2] || ''}`.trim()
        out.budget = rawBudget
    }

    const regionMatch = merged.match(/\b(gramado|canela|nova petr[oó]polis|caxias do sul|bento gon[çc]alves|balne[aá]rio cambori[uú]|itapema|itaja[ií]|porto belo)\b/i)
    if (regionMatch) out.region = regionMatch[1]

    const bedroomsMatch = merged.match(/(\d+)\s*(?:quartos?|dormit[oó]rios?|su[ií]tes?)/i)
    if (bedroomsMatch) out.bedrooms = bedroomsMatch[1]

    if (/\b(casa|sobrado|apartamento|apto|terreno|cobertura|sala comercial|loja)\b/i.test(lower)) {
        const typeMatch = lower.match(/\b(casa|sobrado|apartamento|apto|terreno|cobertura|sala comercial|loja)\b/i)
        if (typeMatch) {
            out.property_type = typeMatch[1] === 'apto' ? 'apartamento' : typeMatch[1]
        }
    }

    if (/\b(invest|renda|aluguel)\b/i.test(lower)) out.interest = 'investir'
    if (/\b(morar|residir|mudar)\b/i.test(lower)) out.interest = out.interest || 'morar'

    if (/\b(urgente|imediat|agora)\b/i.test(lower)) out.timeframe = 'imediato'
    else if (/\b(30 dias|1 m[eê]s|2 meses|3 meses)\b/i.test(lower)) out.timeframe = 'até 3 meses'
    else if (/\b(6 meses|ano que vem|pr[oó]ximo ano)\b/i.test(lower)) out.timeframe = 'médio prazo'

    return out
}

function computeLeadScore(lead: Record<string, unknown>): number {
    let score = 0
    if (lead.lead_name) score += 15
    if (lead.interest) score += 15
    if (lead.region) score += 15
    if (lead.budget_max) score += 20
    if (lead.bedrooms_wanted) score += 10
    if (lead.property_type) score += 10
    if (lead.timeline) score += 15
    return Math.min(score, 100)
}

// ═══════════════════════════════════════════════════════════════
// WhatsApp Media Decryption (E2EE)
// WhatsApp encrypts all media with AES-256-CBC
// The mediaKey from payload is used to derive decryption keys via HKDF
// ═══════════════════════════════════════════════════════════════

async function decryptWhatsAppMedia(
    encryptedUrl: string,
    mediaKeyBase64: string,
    mediaType: 'audio' | 'image' | 'video' | 'document' = 'audio'
): Promise<Buffer | null> {
    try {
        console.log(`[WA Decrypt] Downloading encrypted media from: ${encryptedUrl.substring(0, 80)}...`)
        
        const response = await fetch(encryptedUrl)
        if (!response.ok) {
            console.error(`[WA Decrypt] Download failed (${response.status})`)
            return null
        }
        
        const encData = Buffer.from(await response.arrayBuffer())
        console.log(`[WA Decrypt] Downloaded ${encData.length} bytes encrypted`)
        
        if (encData.length < 10) {
            console.error(`[WA Decrypt] Encrypted data too small`)
            return null
        }
        
        // WhatsApp media type info strings for HKDF
        const mediaTypeInfo: Record<string, string> = {
            audio: 'WhatsApp Audio Keys',
            image: 'WhatsApp Image Keys',
            video: 'WhatsApp Video Keys',
            document: 'WhatsApp Document Keys',
        }
        
        const mediaKey = Buffer.from(mediaKeyBase64, 'base64')
        const info = mediaTypeInfo[mediaType] || 'WhatsApp Audio Keys'
        
        // HKDF expand: derive 112 bytes from mediaKey
        const hkdfKey = hkdfExpand(mediaKey, Buffer.from(info, 'utf8'), 112)
        
        const iv = hkdfKey.subarray(0, 16)
        const cipherKey = hkdfKey.subarray(16, 48)
        
        // Remove last 10 bytes (MAC) from encrypted data
        const encFile = encData.subarray(0, encData.length - 10)
        
        // Decrypt with AES-256-CBC
        const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv)
        const decrypted = Buffer.concat([decipher.update(encFile), decipher.final()])
        
        console.log(`[WA Decrypt] ✅ Decrypted successfully: ${decrypted.length} bytes`)
        return decrypted
    } catch (e) {
        console.error(`[WA Decrypt] Decryption error:`, e)
        return null
    }
}

/** HKDF-Expand (SHA-256) — derives key material from input key */
function hkdfExpand(key: Buffer, info: Buffer, length: number): Buffer {
    // HKDF-Extract
    const prk = crypto.createHmac('sha256', Buffer.alloc(32, 0)).update(key).digest()
    
    // HKDF-Expand
    let t = Buffer.alloc(0)
    let okm = Buffer.alloc(0)
    let counter = 1
    
    while (okm.length < length) {
        const hmac = crypto.createHmac('sha256', prk)
        hmac.update(Buffer.concat([t, info, Buffer.from([counter])]))
        t = hmac.digest()
        okm = Buffer.concat([okm, t])
        counter++
    }
    
    return okm.subarray(0, length)
}

// ═══════════════════════════════════════════════════════════════
// AUDIO: STT
// ═══════════════════════════════════════════════════════════════

async function transcribeWithWhisper(audioUrl: string, apiKey: string): Promise<string> {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
        console.error(`[Whisper STT] Failed to download audio (${audioRes.status}): ${audioUrl.substring(0, 100)}`)
        return ''
    }
    const audioBuffer = await audioRes.arrayBuffer()
    if (audioBuffer.byteLength < 100) {
        console.error(`[Whisper STT] Audio too small (${audioBuffer.byteLength} bytes), likely invalid`)
        return ''
    }
    const blob = new Blob([audioBuffer], { type: 'audio/ogg' })
    const formData = new FormData()
    formData.append('file', blob, 'audio.ogg')
    formData.append('model', 'whisper-1')
    formData.append('language', 'pt')
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
    })
    if (!res.ok) {
        const errBody = await res.text()
        console.error(`[Whisper STT] API error (${res.status}):`, errBody.substring(0, 300))
        return ''
    }
    const data = await res.json()
    return data.text || ''
}

async function transcribeWithGemini(audioUrl: string, apiKey: string, model: string): Promise<string> {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
        console.error(`[Gemini STT] Failed to download audio (${audioRes.status}): ${audioUrl.substring(0, 100)}`)
        return ''
    }
    const audioBuffer = await audioRes.arrayBuffer()
    if (audioBuffer.byteLength < 100) {
        console.error(`[Gemini STT] Audio too small (${audioBuffer.byteLength} bytes), likely invalid`)
        return ''
    }
    const base64Audio = Buffer.from(audioBuffer).toString('base64')
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'audio/ogg', data: base64Audio } },
                    { text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem explicações.' }
                ]
            }]
        })
    })
    if (!res.ok) {
        const errBody = await res.text()
        console.error(`[Gemini STT] API error (${res.status}):`, errBody.substring(0, 300))
        return ''
    }
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ═══════════════════════════════════════════════════════════════
// AUDIO: TTS
// ═══════════════════════════════════════════════════════════════

async function ttsElevenLabs(text: string, apiKey: string, voiceId: string): Promise<Buffer | null> {
    try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
            body: JSON.stringify({
                text, model_id: 'eleven_multilingual_v2',
                voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true }
            })
        })
        if (!res.ok) { console.error('[ElevenLabs TTS] Error:', res.status); return null }
        return Buffer.from(await res.arrayBuffer())
    } catch (e) { console.error('[ElevenLabs TTS] Error:', e); return null }
}

async function ttsOpenAI(text: string, apiKey: string, voice: string): Promise<Buffer | null> {
    try {
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'tts-1', input: text, voice: voice || 'onyx', response_format: 'opus' })
        })
        if (!res.ok) return null
        return Buffer.from(await res.arrayBuffer())
    } catch (e) { console.error('[OpenAI TTS] Error:', e); return null }
}

async function uploadAudioToR2(audioBuffer: Buffer, supabase: ReturnType<typeof getSupabase>): Promise<string | null> {
    try {
        const { data: configs } = await supabase
            .from('app_config').select('key, value')
            .in('key', ['r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket_name', 'r2_public_url'])
        const cfg: Record<string, string> = {}
        configs?.forEach((c: any) => { cfg[c.key] = c.value })

        if (!cfg.r2_account_id || !cfg.r2_access_key_id) {
            const fileName = `whatsapp-tts/${Date.now()}.opus`
            const { error } = await supabase.storage.from('audio').upload(fileName, audioBuffer, { contentType: 'audio/opus', upsert: true })
            if (error) { console.error('[Audio Upload] Error:', error); return null }
            const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName)
            return urlData?.publicUrl || null
        }

        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
        const s3 = new S3Client({
            region: 'auto',
            endpoint: `https://${cfg.r2_account_id}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId: cfg.r2_access_key_id, secretAccessKey: cfg.r2_secret_access_key }
        })
        const key = `whatsapp-tts/${Date.now()}.opus`
        await s3.send(new PutObjectCommand({ Bucket: cfg.r2_bucket_name, Key: key, Body: audioBuffer, ContentType: 'audio/opus' }))
        return `${cfg.r2_public_url}/${key}`
    } catch (e) { console.error('[Audio Upload] Error:', e); return null }
}

function inferMimeType(kind: 'image' | 'video' | 'document', provided?: string | null): string {
    if (provided && provided.trim()) return provided.trim()
    if (kind === 'image') return 'image/jpeg'
    if (kind === 'video') return 'video/mp4'
    return 'application/pdf'
}

async function analyzeMediaWithGemini(
    mediaBuffer: Buffer,
    mimeType: string,
    apiKey: string,
    model: string,
    kind: 'image' | 'video' | 'document',
    fileName?: string | null
): Promise<string> {
    const prompt = `Analise esta mídia enviada por um cliente no WhatsApp de imobiliária.
Tipo: ${kind}
Arquivo: ${fileName || 'sem nome'}

Responda em português (pt-BR), curto e prático com:
1) O que aparece/contém (resumo objetivo)
2) Perfil de imóvel/interesse provável do cliente
3) Características-chave (estilo, localização sugerida, padrão, quartos, área, lazer, etc. quando possível)
4) 3 perguntas curtas que o corretor deve fazer para qualificar melhor

Se não for possível analisar com confiança, diga isso claramente.`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: mediaBuffer.toString('base64') } },
                    { text: prompt }
                ]
            }]
        })
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function analyzeMediaWithOpenAIImage(
    mediaBuffer: Buffer,
    mimeType: string,
    apiKey: string,
    model: string,
    fileName?: string | null
): Promise<string> {
    const dataUrl = `data:${mimeType};base64,${mediaBuffer.toString('base64')}`
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content: 'Você analisa mídia de clientes para uma imobiliária. Responda em pt-BR, de forma objetiva e útil para o corretor.'
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: `Analise esta imagem (arquivo: ${fileName || 'sem nome'}) e traga: resumo, perfil de interesse e 3 perguntas de qualificação.` },
                        { type: 'image_url', image_url: { url: dataUrl } }
                    ]
                }
            ]
        })
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || ''
}

// ═══════════════════════════════════════════════════════════════
// AI RESPONSE
// ═══════════════════════════════════════════════════════════════

async function generateAIResponse(
    configs: Record<string, string>,
    broker: any,
    messages: any[],
    senderName?: string
): Promise<{ text: string; shouldTransfer: boolean; extractedData?: any }> {
    const lastUserTextRaw = String(messages[messages.length - 1]?.content || '')
    const lastUserText = lastUserTextRaw.toLowerCase().trim()
    const globalProvider = configs['ai_provider'] || 'openai'
    const effectiveProvider = configs['whatsapp_provider'] || globalProvider
    const apiKey = effectiveProvider === 'openai' ? configs['openai_api_key'] : configs['gemini_api_key']

    if (!apiKey) {
        console.error('[AI Response] No API key for provider:', effectiveProvider)
        return { text: 'Desculpe, estou com um problema técnico. Por favor, tente novamente em breve.', shouldTransfer: false }
    }

    // Prompt único: broker.system_prompt com tags processadas, ou fallback natural
    const spTime = getSaoPauloTimeContext()
    const brokerName = broker.name || 'Corretor'
    const safeLeadName = sanitizeLeadName(senderName)
    const customPrompt = String(broker.system_prompt || '').trim()
    const hasCustomPrompt = customPrompt.length > 0
    const rawPrompt = hasCustomPrompt ? customPrompt : `Você é ${brokerName}, corretor de imóveis da Pilger Imóveis.
Converse naturalmente no WhatsApp, como uma pessoa real.
Seja simpático, use linguagem informal mas profissional.
Use frases curtas — é WhatsApp, não email.
NUNCA pareça robô ou siga roteiro engessado.

Colete naturalmente durante a conversa: nome, interesse (morar/investir), região, orçamento.
Quando o lead demonstrar interesse real e você tiver os dados, ofereça agendar uma visita com {agendamento}.
Quando tiver todas as informações, use {transferir} para passar ao corretor humano.
Sempre chame pelo nome quando souber: {nome_lead}.

NUNCA revele que é IA. Nunca invente dados de imóveis. Nunca fale preço exato.`

    // ═══ Carregar configs dinâmicas do admin ═══
    const agentConfigs: Record<string, string> = {}
    try {
        const supabase = getSupabase()
        const { data: cfgRows } = await supabase
            .from('app_config')
            .select('key, value')
            .like('key', 'agent_%')
        if (cfgRows) {
            for (const row of cfgRows) agentConfigs[row.key] = row.value
        }
    } catch (err) {
        console.error('[AI Agent] Erro ao carregar agent configs:', err)
    }

    // Parsear configs JSON com fallback
    let regionsForList = 'Balneário Camboriú|Itapema|Itajaí|Porto Belo'
    try {
        const parsed = JSON.parse(agentConfigs['agent_regions'] || '[]')
        if (parsed.length > 0) regionsForList = parsed.join('|')
    } catch {}

    let docsForButtons = 'RG e CPF|Comprovante de Renda|Todos os Documentos'
    try {
        const parsed = JSON.parse(agentConfigs['agent_required_documents'] || '[]')
        if (parsed.length > 0) docsForButtons = parsed.join('|')
    } catch {}

    let hoursText = 'segunda a sexta, das 9h às 18h, e sábados das 9h às 13h'
    try {
        const h = JSON.parse(agentConfigs['agent_working_hours'] || '{}')
        if (h.seg_sex_inicio) {
            hoursText = `segunda a sexta, das ${h.seg_sex_inicio} às ${h.seg_sex_fim}`
            if (h.sab_inicio && h.sab_fim) hoursText += `, sábados das ${h.sab_inicio} às ${h.sab_fim}`
            if (h.dom && h.dom !== 'Fechado') hoursText += `, domingos ${h.dom}`
            else hoursText += ', domingos fechado'
        }
    } catch {}

    const companyName = agentConfigs['agent_company_name'] || 'Pilger Imóveis'
    const companyDesc = agentConfigs['agent_company_description'] || 'referência em imóveis de alto padrão em Balneário Camboriú e região'
    const socialInstagram = agentConfigs['agent_social_instagram'] || ''
    const socialFacebook = agentConfigs['agent_social_facebook'] || ''
    const socialYoutube = agentConfigs['agent_social_youtube'] || ''
    const socialLinkedin = agentConfigs['agent_social_linkedin'] || ''
    const socialTiktok = agentConfigs['agent_social_tiktok'] || ''
    const socialSite = agentConfigs['agent_social_site'] || ''
    const socialLinksList = [
        socialInstagram ? `Instagram: ${socialInstagram}` : '',
        socialYoutube ? `YouTube: ${socialYoutube}` : '',
        socialFacebook ? `Facebook: ${socialFacebook}` : '',
        socialLinkedin ? `LinkedIn: ${socialLinkedin}` : '',
        socialTiktok ? `TikTok: ${socialTiktok}` : '',
        socialSite ? `Site: ${socialSite}` : '',
    ].filter(Boolean).join(' | ')
    const socialUrlButtons = [
        socialInstagram ? `Instagram=>${socialInstagram}` : '',
        socialYoutube ? `YouTube=>${socialYoutube}` : '',
        socialSite ? `Site=>${socialSite}` : '',
        socialFacebook ? `Facebook=>${socialFacebook}` : '',
        socialLinkedin ? `LinkedIn=>${socialLinkedin}` : '',
        socialTiktok ? `TikTok=>${socialTiktok}` : '',
    ].filter(Boolean).slice(0, 4)
    let customLinkButtons: Array<{
        name: string
        tag: string
        type?: string
        url?: string
        title?: string
        options?: string[]
        listButton?: string
        listChoices?: string[]
        pixKey?: string
        pixName?: string
        pixType?: string
        carouselJson?: string
    }> = []
    try {
        const parsed = JSON.parse(agentConfigs['agent_link_buttons'] || '[]')
        if (Array.isArray(parsed)) customLinkButtons = parsed
    } catch {}
    // Processar tags no prompt
    let basePromptWithTags = rawPrompt
        .replace(/\{nome_corretor\}/g, brokerName)
        .replace(/\{nome_lead\}/g, safeLeadName || 'cliente')
        .replace(/\{agendamento\}/g, hasCustomPrompt ? '[BOTOES:Agendar visita|Manhã|Tarde|Noite]' : 'envie botões com [BOTOES:Agendar Visita|Manhã|Tarde|Noite] para o cliente escolher')
        .replace(/\{regioes\}/g, hasCustomPrompt ? regionsForList.split('|').join(', ') : `envie uma lista com [LISTA:Ver Regiões|${regionsForList}]`)
        .replace(/\{transferir\}/g, hasCustomPrompt ? '[TRANSFERIR]' : 'use [TRANSFERIR] para encaminhar ao corretor humano')
        .replace(/\{documentos\}/g, hasCustomPrompt ? docsForButtons.split('|').join(', ') : `envie botões com [BOTOES:Enviar Documentos|${docsForButtons}]`)
        .replace(/\{horario\}/g, hasCustomPrompt ? hoursText : `informe que o atendimento é de ${hoursText}`)
        .replace(/\{empresa\}/g, hasCustomPrompt ? `${companyName} — ${companyDesc}` : `mencione que a ${companyName} é ${companyDesc}`)
        .replace(/\{instagram\}/g, socialInstagram || 'instagram não configurado')
        .replace(/\{facebook\}/g, socialFacebook || 'facebook não configurado')
        .replace(/\{youtube\}/g, socialYoutube || 'youtube não configurado')
        .replace(/\{linkedin\}/g, socialLinkedin || 'linkedin não configurado')
        .replace(/\{tiktok\}/g, socialTiktok || 'tiktok não configurado')
        .replace(/\{site\}/g, socialSite || 'site não configurado')
        .replace(/\{redes_sociais\}/g, socialUrlButtons.length
            ? `[BOTOES_URL:Redes sociais|${socialUrlButtons.join('|')}]`
            : (socialLinksList || 'redes sociais não configuradas'))

    // Dynamic URL button tags created by admin (e.g. {botao_instagram_vip})
    for (const btn of customLinkButtons) {
        const tag = String(btn?.tag || '').trim()
        const name = String(btn?.name || '').trim()
        const type = String(btn?.type || 'URL').toUpperCase()
        if (!tag || !name) continue
        const safeTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        let replacement = ''

        if (type === 'URL') {
            const url = String(btn?.url || '').trim()
            if (!url) continue
            replacement = `[BOTOES_URL:${name}|${name}=>${url}]`
        } else if (type === 'BUTTON') {
            const title = String(btn?.title || name).trim()
            const options = Array.isArray(btn?.options) ? btn.options.map((o: any) => String(o || '').trim()).filter(Boolean) : []
            if (!options.length) continue
            replacement = `[BOTOES:${title}|${options.join('|')}]`
        } else if (type === 'LIST') {
            const listButton = String(btn?.listButton || 'Ver opções').trim()
            const choices = Array.isArray(btn?.listChoices) ? btn.listChoices.map((o: any) => String(o || '').trim()).filter(Boolean) : []
            if (!choices.length) continue
            replacement = `[LISTA:${listButton}|${choices.join('|')}]`
        } else if (type === 'POLL') {
            const question = String(btn?.title || 'Qual opção você prefere?').trim()
            const options = Array.isArray(btn?.options) ? btn.options.map((o: any) => String(o || '').trim()).filter(Boolean) : []
            if (options.length < 2) continue
            replacement = `[ENQUETE:${question}|${options.join('|')}]`
        } else if (type === 'LOCATION') {
            replacement = '[LOCALIZACAO]'
        } else if (type === 'PIX') {
            const pixKey = String(btn?.pixKey || '').trim()
            if (!pixKey) continue
            const pixName = String(btn?.pixName || name || 'Pagamento').trim()
            const pixType = String(btn?.pixType || 'EVP').trim().toUpperCase()
            replacement = `[PIX:${pixKey}|${pixName}|${pixType}]`
        } else if (type === 'CAROUSEL') {
            const carouselRaw = String(btn?.carouselJson || '').trim()
            if (!carouselRaw) continue
            try {
                const parsed = JSON.parse(carouselRaw)
                const normalized = Array.isArray(parsed)
                    ? { text: name, cards: parsed }
                    : parsed
                const encoded = Buffer.from(JSON.stringify(normalized), 'utf-8').toString('base64')
                replacement = `[CAROUSEL_JSON:${encoded}]`
            } catch {
                continue
            }
        }

        if (!replacement) continue
        basePromptWithTags = basePromptWithTags.replace(new RegExp(safeTag, 'g'), replacement)
    }

    let systemPrompt = basePromptWithTags
    if (!hasCustomPrompt) {
        systemPrompt += '\n\nIMPORTANTE: Nunca envie mais de 1 elemento interativo por mensagem. Use botões/listas SOMENTE quando fizer sentido na conversa — nunca como roteiro.'
        + `\n\nCONTEXTO DE TEMPO (America/Sao_Paulo): agora sao ${spTime.time} de ${spTime.date}. Saudacao correta neste momento: "${spTime.greeting}".`
        + '\nREGRAS DE SAUDACAO:'
        + '\n- Sempre valide a saudacao pelo horario atual antes de responder.'
        + '\n- Nao espelhe automaticamente a saudacao enviada pelo cliente.'
        + '\n- Se o cliente usar saudacao fora do horario, responda com a saudacao correta do horario atual.'
        + '\n- Nao diga que esta corrigindo o cliente; apenas responda de forma natural e humana.'
        + '\nREGRAS DE REDES SOCIAIS:'
        + '\n- Envie redes sociais somente quando fizer sentido (prova social, vídeos, portfólio, pedido do cliente).'
        + '\n- Se o cliente demonstrar preferência por vídeos, priorize YouTube quando configurado.'
        + '\n- Se enviar rede social, prefira compartilhar 1 link por vez para manter a conversa natural.'
    }

    // ═══ CATÁLOGO DE IMÓVEIS — Injetar imóveis reais no contexto do agente ═══
    if (!hasCustomPrompt) {
    try {
        const supabase = getSupabase()
        const { data: properties } = await supabase
            .from('properties')
            .select('title, city, state, price, property_type, bedrooms, bathrooms, area_m2, amenities, description')
            .eq('status', 'active')
            .order('price', { ascending: false })
            .limit(30)

        if (properties && properties.length > 0) {
            const catalog = properties.map((p: any, i: number) => {
                const parts: string[] = []
                parts.push(`${i + 1}. ${p.title}`)
                if (p.city) parts.push(`📍 ${p.city}${p.state ? '/' + p.state : ''}`)
                if (p.price) parts.push(`💰 R$ ${Number(p.price).toLocaleString('pt-BR')}`)
                if (p.property_type) parts.push(`🏠 ${p.property_type}`)
                const specs: string[] = []
                if (p.bedrooms) specs.push(`${p.bedrooms}q`)
                if (p.bathrooms) specs.push(`${p.bathrooms}b`)
                if (p.area_m2) specs.push(`${p.area_m2}m²`)
                if (specs.length) parts.push(`📐 ${specs.join(' | ')}`)
                if (p.amenities?.length) parts.push(`✨ ${p.amenities.slice(0, 4).join(', ')}`)
                if (p.description) parts.push(`ℹ️ ${p.description.substring(0, 100)}${p.description.length > 100 ? '...' : ''}`)
                return parts.join(' | ')
            }).join('\n')

            systemPrompt += `\n\n═══ IMÓVEIS DISPONÍVEIS (use como referência para sugerir ao cliente) ═══\n${catalog}\n\nUSO DO CATÁLOGO:\n- Quando souber o que o cliente procura (região, orçamento, tipo), sugira imóveis que combinam\n- NÃO liste todos de uma vez — mencione 1 ou 2 que se encaixam e pergunte se quer ver mais\n- Diga "a partir de R$ X" em vez de valor exato\n- Se não tiver nada que combine, diga que tem opções sendo lançadas e pergunte se pode avisar quando sair\n- Se o cliente pedir detalhes de um imóvel específico, dê as informações que você tem`
        }
    } catch (err) {
        console.error('[AI Agent] Erro ao carregar catálogo de imóveis:', err)
    }
    }

    const chatMessages = messages.map((m: any) => ({ role: m.role, content: m.content }))

    try {
        let responseText = ''
        if (effectiveProvider === 'openai') {
            const model = configs['openai_whatsapp_model'] || 'gpt-4o-mini'
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, ...chatMessages], max_tokens: 500, temperature: 0.8 })
            })
            const data = await res.json()
            responseText = data.choices?.[0]?.message?.content || ''
        } else {
            const model = configs['gemini_whatsapp_model'] || 'gemini-2.0-flash'
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: chatMessages.map((m: any) => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    }))
                })
            })
            const data = await res.json()
            responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        }

        const conversationText = messages
            .filter((m: any) => typeof m?.content === 'string' && m.content.trim())
            .map((m: any) => `${m.role === 'assistant' ? 'Agente' : 'Lead'}: ${m.content}`)
            .join('\n')
        const extractedData = extractLeadDataFromText(
            conversationText || messages[messages.length - 1]?.content || '',
            responseText,
            senderName
        )
        const shouldTransfer = /\[transferir\]/i.test(responseText) || /\[transfer\]/i.test(responseText)
        const cleanText = responseText.replace(/\[transferir\]/gi, '').replace(/\[transfer\]/gi, '').trim()
        if (!cleanText) {
            return {
                text: 'Desculpe, não consegui formular uma resposta agora. Pode repetir de outra forma?',
                shouldTransfer: false,
                extractedData
            }
        }
        const finalText = normalizeGreetingByTime(cleanText, lastUserText, spTime.greeting)
        return { text: finalText, shouldTransfer, extractedData }
    } catch (error) {
        console.error('[AI Response Error]', error)
        return { text: 'Desculpe, tive uma falha técnica momentânea. Pode enviar novamente?', shouldTransfer: false }
    }
}

// ═══════════════════════════════════════════════════════════════
// INNGEST FUNCTION: Process WhatsApp Message
// ═══════════════════════════════════════════════════════════════

export const processWhatsAppMessage = inngest.createFunction(
    {
        id: 'whatsapp-agent-process-message',
        name: 'WhatsApp Agent — Process Incoming Message',
        retries: 1,
        concurrency: [
            { limit: 5 },
            { limit: 1, key: 'event.data.cleanPhone' },  // serialize per phone
        ],
    },
    { event: 'whatsapp/message-received' },
    async ({ event, step }) => {
        const {
            cleanPhone, messageText, isAudio, audioUrl, audioMediaKey, audioDirectPath, messageId,
            messageType, mediaUrl, mediaMimetype, mediaFilename, mediaType,
            buttonResponseId, buttonResponseTitle, pollVotes,
            instanceId, instanceToken, instanceName, brokerId, senderName
        } = event.data
        const isMediaMessage = !isAudio && !!mediaType && ['image', 'video', 'document'].includes(String(mediaType))

        const supabase = getSupabase()

        // ── Step 1: Load instance + broker ──
        const { instance, broker, configs } = await step.run('load-context', async () => {
            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('id', instanceId)
                .single()

            if (!inst) throw new Error(`Instance not found: ${instanceId}`)

            const effectiveBrokerId = brokerId || inst.broker_id
            let brokerData = null
            if (effectiveBrokerId) {
                const { data } = await supabase
                    .from('virtual_brokers')
                    .select('*')
                    .eq('id', effectiveBrokerId)
                    .single()
                brokerData = data
            }

            const cfgs = await loadAIConfigs(supabase, instanceId)
            return { instance: inst, broker: brokerData, configs: cfgs }
        })

        if (!broker || !broker.is_active) {
            console.warn(`[WhatsApp Agent] No active broker found for instance ${instanceName}`)
            return { action: 'skipped', reason: 'no_active_broker' }
        }

        // ── Step 2: Find or create conversation ──
        const conversation = await step.run('find-or-create-conversation', async () => {
            await ensureWhatsAppLead(supabase, {
                phone: cleanPhone,
                senderName,
                instanceId,
                instanceName,
                brokerId: broker.id,
                acquiredVia: 'whatsapp',
            }).catch(() => null)
            const { data: existing } = await supabase
                .from('whatsapp_ai_conversations')
                .select('*')
                .eq('broker_id', broker.id)
                .eq('lead_phone', cleanPhone)
                .in('status', ['active', 'human_takeover', 'transferred'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (existing) {
                // Co-piloto ativo: conversas antigas marcadas como transferred
                // voltam para active para a IA global seguir atendendo normalmente.
                if (existing.status === 'transferred') {
                    await supabase
                        .from('whatsapp_ai_conversations')
                        .update({ status: 'active', updated_at: new Date().toISOString() })
                        .eq('id', existing.id)
                    return { ...existing, status: 'active' }
                }
                return existing
            }

            const { data: newConv } = await supabase
                .from('whatsapp_ai_conversations')
                .insert({
                    broker_id: broker.id,
                    instance_id: instanceId,
                    lead_phone: cleanPhone,
                    messages: [],
                    bot_message_ids: [],
                    status: 'active'
                })
                .select()
                .single()

            return newConv
        })

        if (!conversation) {
            return { action: 'error', reason: 'could_not_create_conversation' }
        }

        // Check if agent is enabled
        if (configs['whatsapp_agent_enabled'] === 'false') {
            if (messageText?.trim()) {
                await appendConversationMessage(supabase, conversation.id, {
                    role: 'user',
                    content: messageText.trim(),
                    type: isAudio ? 'audio' : 'text',
                    source: 'lead',
                }).catch(() => { })
            }
            console.log(`[WhatsApp Agent] Agent disabled, skipping`)
            return { action: 'skipped', reason: 'agent_disabled' }
        }

        // Check if current time is inside AI service schedule (when enabled)
        const scheduleStatus = isWithinAISchedule(configs)
        if (scheduleStatus.enabled && !scheduleStatus.within) {
            if (messageText?.trim()) {
                await appendConversationMessage(supabase, conversation.id, {
                    role: 'user',
                    content: messageText.trim(),
                    type: isAudio ? 'audio' : 'text',
                    source: 'lead',
                }).catch(() => { })
            }
            const tzNow = getNowInTimezone(scheduleStatus.timezone || 'America/Sao_Paulo')
            const cycleDate = `${tzNow.getFullYear()}${String(tzNow.getMonth() + 1).padStart(2, '0')}${String(tzNow.getDate()).padStart(2, '0')}`
            const startKey = String(configs['whatsapp_ai_schedule_start'] || '18:00').replace(':', '')
            const endKey = String(configs['whatsapp_ai_schedule_end'] || '08:00').replace(':', '')
            await sendHandoffSummaryIfNeeded(supabase, {
                conversation,
                instanceId,
                instanceToken,
                recipientPhone: cleanPhone,
                markerSuffix: `schedule_${cycleDate}_${startKey}_${endKey}`,
            }).catch(() => { })
            await sendShiftConsolidatedSummaryIfNeeded(supabase, {
                brokerId: broker.id,
                instanceId,
                instanceToken,
                timezone: scheduleStatus.timezone || 'America/Sao_Paulo',
                markerSuffix: `${cycleDate}_${startKey}_${endKey}`,
            }).catch(() => { })
            console.log(`[WhatsApp Agent] Outside AI schedule (${scheduleStatus.timezone}), skipping`)
            return { action: 'skipped', reason: 'outside_ai_schedule' }
        }

        // Check human_takeover
        const humanInterventionEnabled = configs['whatsapp_human_intervention'] !== 'false'
        if (humanInterventionEnabled && conversation.status === 'human_takeover') {
            // Check if auto-reactivation time has passed
            const interventionMinutes = parseInt(configs['whatsapp_human_intervention_minutes'] || '60')
            const takeoverAt = conversation.human_takeover_at
            if (takeoverAt && interventionMinutes > 0) {
                const elapsed = (Date.now() - new Date(takeoverAt).getTime()) / 60000
                if (elapsed >= interventionMinutes) {
                    const canReactivateNow = !scheduleStatus.enabled || scheduleStatus.within
                    if (canReactivateNow) {
                        console.log(`[WhatsApp Agent] Auto-reactivating after ${Math.floor(elapsed)}min`)
                        await supabase
                            .from('whatsapp_ai_conversations')
                            .update({ status: 'active', human_takeover_at: null, updated_at: new Date().toISOString() })
                            .eq('id', conversation.id)
                    } else {
                        console.log(`[WhatsApp Agent] Reactivation window reached, but outside AI schedule; keeping human takeover`)
                        return { action: 'skipped', reason: 'human_takeover_outside_schedule' }
                    }
                } else {
                    if (messageText?.trim()) {
                        await appendConversationMessage(supabase, conversation.id, {
                            role: 'user',
                            content: messageText.trim(),
                            type: isAudio ? 'audio' : 'text',
                            source: 'lead',
                        }).catch(() => { })
                    }
                    console.log(`[WhatsApp Agent] Conversation in human_takeover, skipping`)
                    return { action: 'skipped', reason: 'human_takeover' }
                }
            } else {
                if (messageText?.trim()) {
                    await appendConversationMessage(supabase, conversation.id, {
                        role: 'user',
                        content: messageText.trim(),
                        type: isAudio ? 'audio' : 'text',
                        source: 'lead',
                    }).catch(() => { })
                }
                console.log(`[WhatsApp Agent] Conversation in human_takeover, skipping`)
                return { action: 'skipped', reason: 'human_takeover' }
            }
        }

        // ── Manual Debounce: wait 15s to collect multiple messages ──
        // (Per-phone concurrency=1 ensures only one function runs at a time)

        // Quick check: if queue is already empty (processed by previous invocation), skip
        const hasWork = await step.run('check-queue', async () => {
            const { data } = await supabase
                .from('app_config')
                .select('key')
                .like('key', `_pmq_${cleanPhone}_%`)
                .limit(1)
            return (data && data.length > 0) || isAudio || isMediaMessage
        })

        if (!hasWork) {
            console.log(`[WhatsApp Agent] Queue empty for ${cleanPhone}, skipping (already processed)`)
            return { action: 'skipped', reason: 'already_processed' }
        }

        // Sliding debounce: timer resets whenever a new message arrives.
        // We only proceed when there has been a full quiet window.
        if (!isAudio && !isMediaMessage) {
            const debounceSeconds = Math.max(1, parseInt(configs['whatsapp_debounce_seconds'] || '15', 10) || 15)
            const maxCycles = 12 // safety cap to avoid endless loops on extremely chatty threads

            for (let cycle = 0; cycle < maxCycles; cycle++) {
                await step.sleep(`debounce-collect-${cycle}`, `${debounceSeconds}s`)

                const peek = await step.run(`peek-latest-pending-${cycle}`, async () => {
                    const { data: latest } = await supabase
                        .from('app_config')
                        .select('updated_at')
                        .like('key', `_pmq_${cleanPhone}_%`)
                        .order('updated_at', { ascending: false })
                        .limit(1)
                        .maybeSingle()

                    return { latestAt: latest?.updated_at || null }
                })

                // Queue vanished (handled by another run) or no data: proceed and let next step decide.
                if (!peek?.latestAt) break

                const ageSeconds = (Date.now() - new Date(peek.latestAt).getTime()) / 1000
                if (ageSeconds >= debounceSeconds) {
                    // Quiet period reached.
                    break
                }

                // New message arrived recently: loop again and reset window.
                console.log(`[WhatsApp Agent] Debounce reset for ${cleanPhone}; latest message age=${ageSeconds.toFixed(2)}s`)
            }
        }

        // Read queued messages from debounce window (atomic INSERTs in app_config)
        const pendingMessages = await step.run('read-pending-messages', async () => {
            const { data: queuedMsgs } = await supabase
                .from('app_config')
                .select('key, value')
                .like('key', `_pmq_${cleanPhone}_%`)
                .order('updated_at', { ascending: true })

            if (!queuedMsgs || queuedMsgs.length === 0) return [] as string[]

            // Delete processed entries
            const keys = queuedMsgs.map(m => m.key)
            await supabase
                .from('app_config')
                .delete()
                .in('key', keys)

            console.log(`[WhatsApp Agent] 📨 Read ${queuedMsgs.length} queued messages: ${queuedMsgs.map(m => m.value).join(' | ')}`)
            return queuedMsgs.map(m => m.value) as string[]
        })

        // If queue was emptied by another function and not audio, skip
        if (pendingMessages.length === 0 && !isAudio && !isMediaMessage) {
            console.log(`[WhatsApp Agent] No messages after debounce for ${cleanPhone}, skipping`)
            return { action: 'skipped', reason: 'already_processed_after_sleep' }
        }

        // Combine all queued messages into one input (they form a single thought)
        const allMessages = pendingMessages.length > 0
            ? pendingMessages.join(' ')
            : messageText

        let botMessageIds: string[] = Array.isArray(conversation.bot_message_ids)
            ? conversation.bot_message_ids : []

        // ── Step 3: Download audio to R2 if needed ──
        // This step runs in Inngest (no Vercel timeout!) so we can take the time to:
        // 1) Download audio from UAZAPI
        // 2) Upload to R2 (Cloudflare)
        // 3) Get a stable public URL for transcription
        const audioR2Url = isAudio ? await step.run('download-audio-to-r2', async () => {
            console.log(`[WhatsApp Agent] 🎤 Audio detected from ${cleanPhone}`)
            console.log(`[WhatsApp Agent] 🎤 audioUrl=${audioUrl ? audioUrl.substring(0, 100) + '...' : 'NULL'}, messageId=${messageId || 'NULL'}, mediaKey=${audioMediaKey ? 'available' : 'NULL'}`)

            let audioBuffer: Buffer | null = null

            // Strategy 1: UAZAPI /message/download (PREFERRED — decrypts and returns base64)
            if (!audioBuffer && messageId) {
                console.log(`[WhatsApp Agent] 🎤 Attempting UAZAPI /message/download with id=${messageId}...`)
                audioBuffer = await downloadMedia(messageId, instanceToken)
                if (audioBuffer) {
                    console.log(`[WhatsApp Agent] 🎤 UAZAPI download success! Size: ${audioBuffer.length} bytes`)
                } else {
                    console.warn(`[WhatsApp Agent] 🎤 UAZAPI download failed, trying E2EE decryption...`)
                }
            }

            // Strategy 2: E2EE decryption fallback (decrypt the encrypted WhatsApp CDN URL)
            if (!audioBuffer && audioUrl && audioMediaKey) {
                try {
                    console.log(`[WhatsApp Agent] 🎤 Attempting WhatsApp E2EE decryption with mediaKey...`)
                    audioBuffer = await decryptWhatsAppMedia(audioUrl, audioMediaKey, 'audio')
                    if (audioBuffer) {
                        console.log(`[WhatsApp Agent] 🎤 E2EE decryption success! Size: ${audioBuffer.length} bytes`)
                    } else {
                        console.error(`[WhatsApp Agent] 🎤 E2EE decryption also failed!`)
                    }
                } catch (e) {
                    console.error(`[WhatsApp Agent] 🎤 E2EE decryption error:`, e)
                }
            }

            if (!audioBuffer) {
                console.error(`[WhatsApp Agent] 🎤 Could not obtain audio buffer from any source`)
                return null
            }

            // Upload to R2 for a stable, public URL
            console.log(`[WhatsApp Agent] 🎤 Uploading ${audioBuffer.length} bytes to R2...`)
            const r2Url = await uploadAudioToR2(audioBuffer, supabase)
            if (r2Url) {
                console.log(`[WhatsApp Agent] 🎤 R2 upload success: ${r2Url.substring(0, 100)}`)
            } else {
                console.error(`[WhatsApp Agent] 🎤 R2 upload failed!`)
            }
            return r2Url
        }) : null

        // ── Step 3.1: Download and analyze media (image/document/video) ──
        const mediaAnalysis = !isAudio && mediaType && ['image', 'video', 'document'].includes(String(mediaType))
            ? await step.run('analyze-media', async () => {
                const kind = mediaType as 'image' | 'video' | 'document'
                const mediaImageEnabled = configs['whatsapp_media_image_enabled'] !== 'false'
                const mediaDocumentEnabled = configs['whatsapp_media_document_enabled'] !== 'false'
                const mediaVideoEnabled = configs['whatsapp_media_video_enabled'] !== 'false'
                const allowed = (kind === 'image' && mediaImageEnabled)
                    || (kind === 'document' && mediaDocumentEnabled)
                    || (kind === 'video' && mediaVideoEnabled)
                if (!allowed) {
                    return { text: '', reason: `disabled_${kind}` }
                }

                if (!messageId) {
                    return { text: '', reason: 'missing_message_id' }
                }

                const mediaBuffer = await downloadMedia(messageId, instanceToken)
                if (!mediaBuffer || mediaBuffer.length < 64) {
                    return { text: '', reason: 'download_failed' }
                }

                // Keep memory/latency safe for very large files.
                const maxBytes = 12 * 1024 * 1024
                if (mediaBuffer.length > maxBytes) {
                    return { text: '', reason: `file_too_large_${mediaBuffer.length}` }
                }

                const mimeType = inferMimeType(kind, mediaMimetype)
                const geminiKey = configs['gemini_api_key']
                const openaiKey = configs['openai_api_key']
                const geminiModel = configs['gemini_whatsapp_model'] || 'gemini-2.0-flash'
                const openaiModel = configs['openai_whatsapp_model'] || 'gpt-4o-mini'

                let analysisText = ''

                // Prefer Gemini for generic multimodal (image, pdf, video).
                if (geminiKey) {
                    analysisText = await analyzeMediaWithGemini(
                        mediaBuffer,
                        mimeType,
                        geminiKey,
                        geminiModel,
                        kind,
                        mediaFilename || null
                    )
                }

                // OpenAI fallback only for images.
                if (!analysisText && openaiKey && kind === 'image' && mimeType.startsWith('image/')) {
                    analysisText = await analyzeMediaWithOpenAIImage(
                        mediaBuffer,
                        mimeType,
                        openaiKey,
                        openaiModel,
                        mediaFilename || null
                    )
                }

                return {
                    text: analysisText || '',
                    reason: analysisText ? 'ok' : 'no_analysis',
                    kind,
                    mimeType,
                    size: mediaBuffer.length
                }
            })
            : null

        // ── Step 4: Transcribe audio if we got a R2 URL ──
        const inputText = await step.run('process-input', async () => {
            console.log(`[WhatsApp Agent] process-input: isAudio=${isAudio}, mediaType=${mediaType || 'none'}, audioR2Url=${audioR2Url ? 'available' : 'null'}, messageText="${messageText}"`)
            
            const transcriptionEnabled = configs['whatsapp_transcription_enabled'] !== 'false'

            if (isAudio && !transcriptionEnabled) {
                return '[O usuário enviou áudio, mas a transcrição de áudio está desativada. Peça para ele enviar em texto ou ative a transcrição.]'
            }

            if (isAudio && audioR2Url) {
                console.log(`[WhatsApp Agent] Transcribing audio from R2 URL...`)
                
                // Helper: check if transcription result is actually valid
                const isValidTranscription = (text: string | undefined | null): boolean => {
                    if (!text) return false
                    const cleaned = text.replace(/[.\s…]+/g, '').trim()
                    return cleaned.length >= 2  // At least 2 real characters
                }
                
                const hasGemini = !!configs['gemini_api_key']
                const hasOpenAI = !!configs['openai_api_key']
                const geminiModel = configs['gemini_whatsapp_model'] || 'gemini-2.0-flash'
                
                // Respect the provider configured in the maintenance panel
                const globalProvider = configs['ai_provider'] || 'openai'
                const effectiveProvider = configs['whatsapp_provider'] || globalProvider
                const useWhisperFirst = effectiveProvider === 'openai'
                
                console.log(`[WhatsApp Agent] STT: provider=${effectiveProvider}, useWhisperFirst=${useWhisperFirst}, hasOpenAI=${hasOpenAI}, hasGemini=${hasGemini}`)
                
                let result: string | undefined
                
                if (useWhisperFirst) {
                    // ── OpenAI configured: Whisper first → Gemini fallback ──
                    if (hasOpenAI) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Whisper (OpenAI) transcription...`)
                            result = await transcribeWithWhisper(audioR2Url, configs['openai_api_key'])
                            console.log(`[WhatsApp Agent] Whisper result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                            console.log(`[WhatsApp Agent] Whisper returned invalid/empty result, trying Gemini fallback...`)
                        } catch (e) {
                            console.error('[WhatsApp Agent] Whisper transcription error:', e)
                        }
                    }
                    if (hasGemini) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Gemini transcription (fallback)...`)
                            result = await transcribeWithGemini(audioR2Url, configs['gemini_api_key'], geminiModel)
                            console.log(`[WhatsApp Agent] Gemini result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                        } catch (e) {
                            console.error('[WhatsApp Agent] Gemini transcription error:', e)
                        }
                    }
                } else {
                    // ── Gemini configured: Gemini first → Whisper fallback ──
                    if (hasGemini) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Gemini transcription...`)
                            result = await transcribeWithGemini(audioR2Url, configs['gemini_api_key'], geminiModel)
                            console.log(`[WhatsApp Agent] Gemini result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                            console.log(`[WhatsApp Agent] Gemini returned invalid/empty result, trying Whisper fallback...`)
                        } catch (e) {
                            console.error('[WhatsApp Agent] Gemini transcription error:', e)
                        }
                    }
                    if (hasOpenAI) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Whisper transcription (fallback)...`)
                            result = await transcribeWithWhisper(audioR2Url, configs['openai_api_key'])
                            console.log(`[WhatsApp Agent] Whisper result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                        } catch (e) {
                            console.error('[WhatsApp Agent] Whisper transcription error:', e)
                        }
                    }
                }
                
                // All transcription attempts failed
                console.error('[WhatsApp Agent] All transcription attempts failed or returned empty')
                return '[O usuário enviou uma mensagem de áudio que não pôde ser transcrita. Responda pedindo que repita ou envie por texto.]'
            }
            
            // Audio detected but we couldn't get the buffer at all
            if (isAudio && !audioR2Url) {
                console.error('[WhatsApp Agent] Audio detected but no R2 URL available (download failed)')
                return '[O usuário enviou uma mensagem de áudio que não pôde ser processada. Responda pedindo que repita ou envie por texto.]'
            }

            // Image/document/video analysis path
            if (!isAudio && mediaAnalysis && mediaAnalysis.text) {
                const leadText = allMessages?.trim() || ''
                const base = leadText || `[O usuário enviou uma mídia do tipo ${mediaType || messageType || 'desconhecido'}]`
                return `${base}\n\n[ANÁLISE DA MÍDIA]\n${mediaAnalysis.text}`
            }

            if (!isAudio && isMediaMessage) {
                const leadText = allMessages?.trim() || messageText?.trim() || ''
                const base = leadText || `[O usuário enviou uma mídia do tipo ${mediaType || messageType || 'desconhecido'}]`
                return `${base}\n\n[MÍDIA RECEBIDA]\nO cliente enviou ${mediaType || 'mídia'}, mas a análise automática desse tipo está desativada nas configurações.`
            }
            
            return allMessages
        })

        if (!inputText) {
            return { action: 'skipped', reason: 'empty_input' }
        }

        const quickSocialReply = resolveSocialQuickReply(
            buttonResponseTitle || buttonResponseId || inputText || null,
            configs
        )

        // ── Step 4: Generate AI response ──
        const aiResponse = await step.run('generate-ai-response', async () => {
            const historyMessages = (Array.isArray(conversation.messages) ? conversation.messages : [])
                .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')

            const updatedMessages = [...historyMessages, {
                role: 'user',
                content: inputText,
                type: isAudio ? 'audio' : 'text',
                source: 'lead',
                message_id: messageId || null,
                instance_id: instanceId,
                broker_id: broker.id,
                timestamp: new Date().toISOString()
            }]

            const response = quickSocialReply
                ? { text: quickSocialReply, shouldTransfer: false, extractedData: undefined as any }
                : await generateAIResponse(configs, broker, updatedMessages, senderName)

            // Add assistant message to history
            updatedMessages.push({
                role: 'assistant',
                content: response.text,
                type: 'text',
                source: quickSocialReply ? 'quick_reply' : 'agent',
                instance_id: instanceId,
                broker_id: broker.id,
                timestamp: new Date().toISOString()
            })

            // Save to DB
            const updateData: any = {
                messages: updatedMessages,
                updated_at: new Date().toISOString()
            }
            await supabase
                .from('whatsapp_ai_conversations')
                .update(updateData)
                .eq('id', conversation.id)

            return { ...response, updatedMessages }
        })

        await step.run('sync-lead-snapshot', async () => {
            await syncWhatsAppLeadSnapshot(supabase, {
                phone: cleanPhone,
                senderName,
                instanceId,
                instanceName,
                brokerId: broker.id,
                acquiredVia: 'whatsapp',
                messages: aiResponse.updatedMessages,
                extractedData: aiResponse.extractedData || null,
                shouldTransfer: aiResponse.shouldTransfer,
            })
        })

        // ── Step 5: Human-like behavior (sleep is native in Inngest!) ──
        await step.run('ensure-online', async () => {
            if (configs['whatsapp_always_online'] !== 'false') {
                await setPresenceAvailable(instanceToken, cleanPhone).catch((err) => {
                    console.warn('[WhatsApp Agent] setPresenceAvailable failed:', err)
                })
            }
        })

        await step.run('mark-as-read', async () => {
            if (configs['whatsapp_mark_as_read'] !== 'false') {
                await markAsRead(cleanPhone, instanceToken).catch((err) => {
                    console.warn('[WhatsApp Agent] markAsRead (before send) failed:', err)
                })
            }
        })

        // Reading delay (1-3s) — Inngest native sleep, no timeout risk!
        const readDelay = Math.floor(Math.random() * 2000) + 1000
        await step.sleep('reading-delay', `${readDelay}ms`)

        // Decide presence: "recording" if sending audio, "typing" otherwise
        const mode = (configs['whatsapp_response_mode'] || '').toLowerCase()
        const audioEnabled = configs['whatsapp_audio_enabled'] === 'true'
        const mirrorModeEnabled = configs['whatsapp_mirror_mode'] === 'true'
        const shouldMirror = mode ? mode === 'mirror' : mirrorModeEnabled
        const shouldAlwaysAudio = mode === 'audio'
        const willSendAudio = audioEnabled
            && (shouldAlwaysAudio || (isAudio && shouldMirror))
            && !isMediaMessage
            && !responseRequiresText(aiResponse.text) && !parseButtons(aiResponse.text).buttons

        await step.run('show-presence', async () => {
            if (willSendAudio) {
                await setPresenceRecording(cleanPhone, instanceToken).catch(() => { })
            } else {
                await setPresenceTyping(cleanPhone, instanceToken).catch(() => { })
            }
        })

        // Typing/recording delay proportional to response length
        const typingMs = Math.min(Math.max(aiResponse.text.length * 25, 1500), 8000)
        const actualTypingMs = Math.floor(typingMs * (0.7 + Math.random() * 0.6))
        await step.sleep('composing-delay', `${actualTypingMs}ms`)

        // ── Step 6: Send response (Função Espelho + Interactive Messages) ──
        await step.run('send-response', async () => {
            const interactive = parseInteractiveElements(aiResponse.text)
            const { cleanText, buttons, urlButtons, list, poll, locationRequest, pix, carousel } = interactive
            const needsTextFormat = responseRequiresText(aiResponse.text)
            const hasInteractive = !!(buttons || urlButtons || list || poll || locationRequest || pix || carousel)
            const mode = (configs['whatsapp_response_mode'] || '').toLowerCase()
            const audioEnabled = configs['whatsapp_audio_enabled'] === 'true'
            const mirrorModeEnabled = configs['whatsapp_mirror_mode'] === 'true'
            const shouldMirror = mode ? mode === 'mirror' : mirrorModeEnabled
            const shouldAlwaysAudio = mode === 'audio'
            const shouldSendAudio = audioEnabled
                && (shouldAlwaysAudio || (isAudio && shouldMirror))
                && !isMediaMessage
                && !needsTextFormat && !hasInteractive

            console.log(`[WhatsApp Agent] 📤 Send decision: mode=${mode || 'legacy'}, isAudio=${isAudio}, audioEnabled=${audioEnabled}, needsTextFormat=${needsTextFormat}, buttons=${!!buttons}, urlButtons=${!!urlButtons}, list=${!!list}, poll=${!!poll}, location=${locationRequest}, pix=${!!pix}, carousel=${!!carousel}, shouldSendAudio=${shouldSendAudio}`)

            if (urlButtons && urlButtons.items.length > 0) {
                try {
                    // UAZAPI expects URL buttons as choices: "texto|url:https://..."
                    const finalText = cleanText || urlButtons.title || 'Acesse o link abaixo:'
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: finalText,
                        type: 'button',
                        choices: urlButtons.items.map(item => `${item.text}|url:${item.url}`),
                        instanceToken,
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[URL Buttons] Failed, falling back to text links:', e)
                    const linksText = urlButtons.items.map(i => `${i.text}: ${i.url}`).join('\n')
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: `${cleanText ? cleanText + '\n\n' : ''}${linksText}`, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (buttons && buttons.options.length > 0) {
                try {
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: cleanText || buttons.title,
                        type: 'button',
                        choices: buttons.options.slice(0, 3).map(opt => opt.substring(0, 20)),
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[Buttons] Failed, falling back to text:', e)
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText || aiResponse.text, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (list && list.sections.length > 0) {
                // Send as UAZAPI list with choices format
                try {
                    const choices: string[] = []
                    for (const section of list.sections) {
                        choices.push(`[${section.title}]`)
                        for (const row of section.rows) {
                            if (row.description) {
                                choices.push(`${row.title}|${row.id}|${row.description}`)
                            } else {
                                choices.push(row.title)
                            }
                        }
                    }
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: cleanText || 'Escolha uma opção:',
                        type: 'list',
                        choices,
                        listButton: list.buttonText,
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[List] Failed, falling back to text:', e)
                    // Fallback: send as numbered text
                    const fallbackText = list.sections.map(s =>
                        `*${s.title}*\n${s.rows.map((r, i) => `${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ''}`).join('\n')}`
                    ).join('\n\n')
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: `${cleanText}\n\n${fallbackText}`, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (poll && poll.options.length >= 2) {
                // Send as UAZAPI poll
                try {
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: poll.question,
                        type: 'poll',
                        choices: poll.options,
                        selectableCount: poll.multiSelect ? poll.options.length : 1,
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    // Also send the text before the poll if any
                    if (cleanText) {
                        await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    }
                } catch (e) {
                    console.warn('[Poll] Failed, falling back to text:', e)
                    const fallbackText = `${poll.question}\n\n${poll.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: `${cleanText ? cleanText + '\n\n' : ''}${fallbackText}`, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (locationRequest) {
                // Send text first, then location request button
                try {
                    if (cleanText) {
                        await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    }
                    const { sendLocationRequest } = await import('../uazapi')
                    const sendResult = await sendLocationRequest(
                        cleanPhone,
                        cleanText || 'Pode compartilhar sua localização? Isso nos ajuda a encontrar os melhores imóveis perto de você! 📍',
                        instanceToken
                    )
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[Location] Failed, sending text only:', e)
                    if (!cleanText) {
                        const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: 'Pode nos informar em qual região você está buscando?', instanceToken })
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    }
                }
            } else if (pix) {
                try {
                    if (cleanText) {
                        await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    }
                    const sendResult = await sendPixButton(
                        cleanPhone,
                        pix.pixKey,
                        pix.pixName,
                        pix.pixType === 'EVP' ? 'RANDOM' : pix.pixType,
                        instanceToken
                    )
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[PIX] Failed, falling back to text:', e)
                    const sendResult = await sendWhatsAppMessage({
                        phone: cleanPhone,
                        message: `${cleanText ? cleanText + '\n\n' : ''}Chave PIX: ${pix.pixKey}`,
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (carousel && carousel.cards.length > 0) {
                try {
                    const sendResult = await sendCarousel(
                        cleanPhone,
                        cleanText || carousel.text,
                        carousel.cards,
                        instanceToken
                    )
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[Carousel] Failed, falling back to text:', e)
                    const sendResult = await sendWhatsAppMessage({
                        phone: cleanPhone,
                        message: cleanText || aiResponse.text,
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (shouldSendAudio) {
                let audioBuffer: Buffer | null = null
                const rawVoiceId = (broker as any).voice_id || configs['whatsapp_tts_voice'] || ''

                // Support "openai:voice_name" format from the broker dropdown
                const isOpenAIVoice = rawVoiceId.startsWith('openai:')
                const voiceId = isOpenAIVoice ? rawVoiceId.replace('openai:', '') : rawVoiceId

                const debugSteps: string[] = []
                debugSteps.push(`voiceId=${voiceId}, isOpenAI=${isOpenAIVoice}, textLen=${cleanText.length}`)

                if (isOpenAIVoice && configs['openai_api_key']) {
                    audioBuffer = await ttsOpenAI(cleanText, configs['openai_api_key'], voiceId || 'onyx')
                    debugSteps.push(`openai_tts: ${audioBuffer ? audioBuffer.length + 'b' : 'NULL'}`)
                } else if (!isOpenAIVoice && configs['elevenlabs_api_key'] && voiceId) {
                    audioBuffer = await ttsElevenLabs(cleanText, configs['elevenlabs_api_key'], voiceId)
                    debugSteps.push(`elevenlabs_tts: ${audioBuffer ? audioBuffer.length + 'b' : 'NULL'}`)
                } else {
                    debugSteps.push(`no_tts_match: hasELKey=${!!configs['elevenlabs_api_key']}, hasOAIKey=${!!configs['openai_api_key']}, voiceId=${voiceId}`)
                }
                if (!audioBuffer && configs['openai_api_key']) {
                    audioBuffer = await ttsOpenAI(cleanText, configs['openai_api_key'], configs['whatsapp_tts_voice'] || 'onyx')
                    debugSteps.push(`openai_fallback: ${audioBuffer ? audioBuffer.length + 'b' : 'NULL'}`)
                }

                if (audioBuffer) {
                    debugSteps.push(`uploading_to_r2: ${audioBuffer.length}b`)
                    const audioPublicUrl = await uploadAudioToR2(audioBuffer, supabase)
                    debugSteps.push(`r2_url: ${audioPublicUrl || 'NULL'}`)
                    if (audioPublicUrl) {
                        try {
                            const sendResult = await sendAudioMessage({ phone: cleanPhone, audioUrl: audioPublicUrl, ptt: true, instanceToken })
                            debugSteps.push(`send_audio: OK, result=${JSON.stringify(sendResult).substring(0, 200)}`)
                            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                        } catch (e: any) {
                            debugSteps.push(`send_audio: FAIL, error=${e?.message || String(e)}`)
                            const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                        }
                    } else {
                        debugSteps.push('r2_upload_failed, sending text')
                        const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    }
                } else {
                    debugSteps.push('all_tts_failed, sending text')
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }

                // Save debug to DB (fire-and-forget)
                try {
                    await supabase.from('app_config').upsert({
                        key: '_debug_tts_pipeline',
                        value: JSON.stringify({ timestamp: new Date().toISOString(), steps: debugSteps }),
                        updated_at: new Date().toISOString()
                    })
                } catch (_) { /* ignore */ }
            } else {
                // Split messages into human-like chunks if enabled
                const splitEnabled = configs['whatsapp_split_messages'] !== 'false'
                const textToSend = cleanText || aiResponse.text

                if (splitEnabled && textToSend.length > 120) {
                    const chunks = splitIntoHumanChunks(textToSend)
                    for (let i = 0; i < chunks.length; i++) {
                        if (i > 0) {
                            // Show typing between chunks + delay
                            await setPresenceTyping(cleanPhone, instanceToken).catch(() => {})
                            const chunkDelay = Math.floor(Math.random() * 2000) + 1000 + (chunks[i].length * 20)
                            await new Promise(r => setTimeout(r, Math.min(chunkDelay, 4000)))
                        }
                        const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: chunks[i], instanceToken })
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    }
                } else {
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: textToSend, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            }
        })

        await step.run('mark-as-read-after-send', async () => {
            if (configs['whatsapp_mark_as_read'] !== 'false') {
                await markAsRead(cleanPhone, instanceToken).catch((err) => {
                    console.warn('[WhatsApp Agent] markAsRead (after send) failed:', err)
                })
            }
        })

        // ── Step 7: Handle transfer if needed ──
        if (aiResponse.shouldTransfer) {
            await step.run('handle-transfer', async () => {
                const summary = aiResponse.updatedMessages
                    .map((m: any) => `${m.role === 'user' ? 'Lead' : 'Agente'}: ${m.content}`)
                    .join('\n')
                // Co-piloto ativo: mantém a conversa ativa, apenas registra a transferência.
                await supabase
                    .from('whatsapp_ai_conversations')
                    .update({
                        status: 'active',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', conversation.id)

                // ═══ NOTIFICAR CORRETOR HUMANO ═══
                try {
                    // Load transfer configs
                    const { data: transferConfigs } = await supabase
                        .from('app_config')
                        .select('key, value')
                        .in('key', ['agent_transfer_message_broker', 'agent_transfer_message_lead', 'agent_default_instance_id', 'agent_transfer_instance_ids', 'agent_transfer_mode', 'agent_transfer_rr_index'])

                    const tCfg: Record<string, string> = {}
                    for (const r of (transferConfigs || [])) tCfg[r.key] = r.value
                    const contextText = [
                        messageText || '',
                        aiResponse.text || '',
                        aiResponse.extractedData?.interest || '',
                        aiResponse.extractedData?.region || '',
                        aiResponse.extractedData?.summary || '',
                        ...aiResponse.updatedMessages.slice(-12).map((m: any) => String(m?.content || '')),
                    ].join(' ')

                    const specialized = await pickTransferTargetByEmpreendimento(supabase, contextText)
                    const fallback = await pickTransferTargetInstance(supabase, instanceId, tCfg)
                    const targetInstance = specialized?.instance || fallback
                    const selectedBrokerName = specialized?.broker?.name || 'especialista'
                    const selectedEmpreendimento = specialized?.empreendimento?.nome || ''

                    if (specialized?.instance?.id) {
                        console.log(`[Transfer] Routing by empreendimento: ${(specialized.empreendimento as any)?.nome} -> ${(specialized.broker as any)?.name}`)
                    } else {
                        console.log('[Transfer] No empreendimento specialist matched, using queue fallback')
                    }
                    if (targetInstance?.phone_number && targetInstance?.instance_token) {
                        const { data: targetBroker } = await supabase
                            .from('virtual_brokers')
                            .select('id, name, handoff_prompt')
                            .eq('id', targetInstance.broker_id)
                            .maybeSingle()

                        // Extract lead data from conversation context
                        const leadName = senderName || 'Nao informado'
                        const lastMessages = aiResponse.updatedMessages.slice(-6)
                            .map((m: any) => `${m.role === 'user' ? '??' : '??'} ${m.content}`)
                            .join('\n')

                        // Build specialist notification with lead context
                        let brokerMsg = tCfg['agent_transfer_message_broker']
                            || '?? *Lead qualificado transferido!*\n\n?? Nome: {nome_lead}\n?? Telefone: {telefone}\n\n? Entre em contato agora!'

                        brokerMsg = brokerMsg
                            .replace(/\{nome_lead\}/g, leadName)
                            .replace(/\{telefone\}/g, cleanPhone)
                            .replace(/\{interesse\}/g, aiResponse.extractedData?.interest || 'Nao identificado')
                            .replace(/\{orcamento\}/g, aiResponse.extractedData?.budget || 'Nao informado')
                            .replace(/\{regiao\}/g, aiResponse.extractedData?.region || 'Nao informada')

                        brokerMsg += `\n\n?? *Ultimas mensagens:*\n${lastMessages}`

                        const { sendWhatsAppMessage } = await import('../uazapi')
                        await sendWhatsAppMessage({
                            phone: targetInstance.phone_number,
                            message: brokerMsg,
                            instanceToken
                        })
                        console.log(`[Transfer] Summary sent to specialist instance ${targetInstance.id}`)

                        // Specialist instance reaches the lead from its own WhatsApp
                        let leadMsg = tCfg['agent_transfer_message_lead']
                            || 'Perfeito! Vou te encaminhar para nosso especialista agora. Ele ja recebeu seu contexto.'
                        leadMsg = leadMsg
                            .replace(/\{nome_lead\}/g, senderName || 'cliente')
                            .replace(/\{telefone\}/g, cleanPhone)
                            .replace(/\{nome_corretor\}/g, selectedBrokerName)
                            .replace(/\{empreendimento\}/g, selectedEmpreendimento || 'seu interesse')
                        await sendWhatsAppMessage({
                            phone: cleanPhone,
                            message: leadMsg,
                            instanceToken: targetInstance.instance_token
                        })

                        // Mensagem inicial automática do especialista para o lead.
                        let specialistFirstMsg = String(targetBroker?.handoff_prompt || '').trim()
                        if (!specialistFirstMsg) {
                            specialistFirstMsg = `Oi ${senderName || 'tudo bem'}! Eu sou ${targetBroker?.name || selectedBrokerName}. Vi aqui seu atendimento e vou dar continuidade agora.`
                        }
                        specialistFirstMsg = specialistFirstMsg
                            .replace(/\{nome_lead\}/g, senderName || 'cliente')
                            .replace(/\{nome_corretor\}/g, targetBroker?.name || selectedBrokerName)
                            .replace(/\{telefone\}/g, cleanPhone)
                            .replace(/\{interesse\}/g, aiResponse.extractedData?.interest || 'não identificado')
                            .replace(/\{orcamento\}/g, aiResponse.extractedData?.budget || 'não informado')
                            .replace(/\{regiao\}/g, aiResponse.extractedData?.region || 'não informada')
                            .replace(/\{empreendimento\}/g, selectedEmpreendimento || 'seu interesse')

                        await sendWhatsAppMessage({
                            phone: cleanPhone,
                            message: specialistFirstMsg,
                            instanceToken: targetInstance.instance_token
                        })
                    } else {
                        console.warn('[Transfer] No eligible specialist instance in configured queue')
                    }
                } catch (transferErr) {
                    console.error('[Transfer] Erro ao notificar corretor:', transferErr)
                }
            })
        }

        // ── Step 8: Sync CRM (fire-and-forget) ──
        await step.run('sync-crm', async () => {
            try {
                const { updateLead } = await import('../uazapi')
                const leadData: Record<string, unknown> = {
                    id: cleanPhone,
                    lead_field12: new Date().toISOString(),  // Último contato
                    lead_field05: broker.name || 'AI Agent',  // Agente
                }

                // Sync sender name if available
                if (senderName) {
                    leadData.lead_name = senderName
                }

                // Extract data from conversation if AI extracted it
                if (aiResponse.extractedData) {
                    const d = aiResponse.extractedData
                    if (d.name) leadData.lead_fullName = d.name
                    if (d.phone) leadData.lead_field01 = d.phone  // may duplicate but useful
                    if (d.budget) leadData.lead_field02 = d.budget
                    if (d.interest) leadData.lead_field01 = d.interest  // Tipo de imóvel
                    if (d.timeframe) leadData.lead_field04 = d.timeframe
                    if (d.email) leadData.lead_email = d.email
                    if (d.classification) {
                        leadData.lead_status = d.classification
                        // Auto-tag
                        const tags: string[] = []
                        if (d.classification === 'vip') tags.push('VIP')
                        if (d.classification === 'hot') tags.push('Qualificado')
                        if (d.is_partner) tags.push('Parceiro')
                        if (tags.length > 0) leadData.lead_tags = tags
                    }
                    if (d.summary) leadData.lead_field20 = d.summary  // Notas AI
                }

                await updateLead(leadData as any, instanceToken)
                console.log(`[WhatsApp Agent] 📋 CRM sync completed for ${cleanPhone}`)
            } catch (e) {
                console.warn('[WhatsApp Agent] CRM sync failed (non-fatal):', e)
            }
        })

        // ── Step 9: Sync lead_collected_data (CRM interno) ──
        await step.run('sync-lead-collected-data', async () => {
            try {
                const d = aiResponse.extractedData || {}
                const { data: existingLead } = await supabase
                    .from('lead_collected_data')
                    .select('*')
                    .eq('lead_phone', cleanPhone)
                    .maybeSingle()

                const leadUpdate: Record<string, unknown> = {
                    lead_phone: cleanPhone,
                    updated_at: new Date().toISOString(),
                }

                if (senderName || d.name || existingLead?.lead_name) leadUpdate.lead_name = d.name || senderName || existingLead?.lead_name
                if (d.interest || existingLead?.interest) leadUpdate.interest = d.interest || existingLead?.interest
                if (d.region || existingLead?.region) leadUpdate.region = d.region || existingLead?.region
                if (d.budget) {
                    const budgetNum = parseBudgetToNumber(d.budget)
                    if (budgetNum) leadUpdate.budget_max = budgetNum
                }
                if (!leadUpdate.budget_max && existingLead?.budget_max) leadUpdate.budget_max = existingLead.budget_max
                if (d.bedrooms || existingLead?.bedrooms_wanted) leadUpdate.bedrooms_wanted = parseInt(d.bedrooms) || existingLead?.bedrooms_wanted || null
                if (d.property_type || existingLead?.property_type) leadUpdate.property_type = d.property_type || existingLead?.property_type
                if (d.timeframe || existingLead?.timeline) leadUpdate.timeline = d.timeframe || existingLead?.timeline

                // Calculate qualification score (0-100)
                const score = computeLeadScore(leadUpdate)
                leadUpdate.qualification_score = score

                // Determine status based on score
                if (aiResponse.shouldTransfer) {
                    leadUpdate.status = 'transferred'
                } else if (score >= 70) {
                    leadUpdate.status = 'qualified'
                } else if (score >= 30) {
                    leadUpdate.status = 'qualifying'
                }

                if (broker.id) leadUpdate.broker_id = broker.id

                // Upsert by lead_phone
                const { error } = await supabase
                    .from('lead_collected_data')
                    .upsert(leadUpdate, { onConflict: 'lead_phone' })

                if (error) {
                    console.warn('[CRM Interno] Upsert error:', error.message)
                } else {
                    console.log(`[CRM Interno] ✅ Lead ${cleanPhone} atualizado (score: ${score})`)
                }
            } catch (e) {
                console.warn('[CRM Interno] Sync failed (non-fatal):', e)
            }
        })

        // ── Step 10: Detect and save appointment ──
        await step.run('detect-appointment', async () => {
            try {
                // Check if the incoming message or AI response indicates scheduling
                const lastUserMsg = (messageText || '').toLowerCase()
                const lastAiMsg = (aiResponse.text || '').toLowerCase()
                const buttonText = String(buttonResponseTitle || buttonResponseId || '').toLowerCase()
                const pollText = Array.isArray(pollVotes) ? pollVotes.join(' ').toLowerCase() : String(pollVotes || '').toLowerCase()
                const allMsgs = `${lastUserMsg} ${lastAiMsg} ${buttonText} ${pollText}`

                const timeSlots = ['manhã', 'tarde', 'noite', 'manha']
                const selectedSlot = timeSlots.find(s => allMsgs.includes(s))

                // Also check AI extracted data for scheduling
                const hasSchedulingContext = allMsgs.includes('agend') || allMsgs.includes('visita') || allMsgs.includes('visit')

                if (selectedSlot && hasSchedulingContext) {
                    // Calculate next business day
                    const tomorrow = new Date()
                    tomorrow.setDate(tomorrow.getDate() + 1)
                    // Skip weekends
                    while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
                        tomorrow.setDate(tomorrow.getDate() + 1)
                    }
                    const appointmentDate = tomorrow.toISOString().split('T')[0]

                    const timeLabel = selectedSlot.charAt(0).toUpperCase() + selectedSlot.slice(1).replace('manha', 'manhã')

                    const normalizedSlot = timeLabel.toLowerCase().replace('ã', 'a')
                    const { data: sameDayAppointments } = await supabase
                        .from('appointments')
                        .select('id, appointment_time, status')
                        .eq('lead_phone', cleanPhone)
                        .eq('appointment_date', appointmentDate)
                        .neq('status', 'cancelled')
                        .limit(20)

                    const alreadyExists = (sameDayAppointments || []).some((a: any) => {
                        const value = String(a.appointment_time || '').toLowerCase()
                        return value.includes(normalizedSlot) || value.includes(timeLabel.toLowerCase())
                    })

                    if (alreadyExists) {
                        console.log(`[Appointment] ℹ️ Duplicate prevented for ${cleanPhone} on ${appointmentDate} (${timeLabel})`)
                        return
                    }

                    const { error } = await supabase
                        .from('appointments')
                        .insert([{
                            lead_phone: cleanPhone,
                            lead_name: senderName || null,
                            broker_id: broker.id || null,
                            appointment_date: appointmentDate,
                            appointment_time: timeLabel,
                            appointment_type: 'visita',
                            property_title: aiResponse.extractedData?.property || null,
                            status: 'pending',
                        }])

                    if (error) {
                        console.warn('[Appointment] Insert error:', error.message)
                    } else {
                        console.log(`[Appointment] 📅 Agendamento criado: ${cleanPhone} em ${appointmentDate} (${timeLabel})`)
                    }
                }
            } catch (e) {
                console.warn('[Appointment] Detection failed (non-fatal):', e)
            }
        })

        // ── Step 11: Save location & documents ──
        await step.run('save-location-docs', async () => {
            try {
                const evData = event.data as any

                // Save GPS location if received
                if (evData.receivedLatitude && evData.receivedLongitude) {
                    const { error } = await supabase
                        .from('lead_collected_data')
                        .upsert({
                            lead_phone: cleanPhone,
                            latitude: evData.receivedLatitude,
                            longitude: evData.receivedLongitude,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'lead_phone' })

                    if (error) {
                        console.warn('[Location] Save error:', error.message)
                    } else {
                        console.log(`[Location] 📍 GPS salvo para ${cleanPhone}: ${evData.receivedLatitude}, ${evData.receivedLongitude}`)
                    }
                }

                // Log document/image received
                if (evData.mediaType && ['document', 'image', 'video'].includes(evData.messageType || '')) {
                    const docEntry = {
                        type: evData.mediaType,
                        filename: evData.mediaFilename || `${evData.mediaType}_${Date.now()}`,
                        mimetype: evData.mediaMimetype || 'unknown',
                        url: evData.mediaUrl || null,
                        received_at: new Date().toISOString(),
                    }

                    // Get existing docs
                    const { data: existing } = await supabase
                        .from('lead_collected_data')
                        .select('documents_received')
                        .eq('lead_phone', cleanPhone)
                        .maybeSingle()

                    const docs = Array.isArray(existing?.documents_received) ? existing.documents_received : []
                    docs.push(docEntry)

                    const { error } = await supabase
                        .from('lead_collected_data')
                        .upsert({
                            lead_phone: cleanPhone,
                            documents_received: docs,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'lead_phone' })

                    if (error) {
                        console.warn('[Document] Save error:', error.message)
                    } else {
                        console.log(`[Document] 📄 Documento salvo para ${cleanPhone}: ${docEntry.filename} (${docEntry.type})`)
                    }
                }
            } catch (e) {
                console.warn('[Location/Docs] Save failed (non-fatal):', e)
            }
        })

        return {
            action: 'processed',
            phone: cleanPhone,
            broker: broker.name,
            responseLength: aiResponse.text.length,
            wasAudio: isAudio,
            transferred: aiResponse.shouldTransfer
        }
    }
)

// ═══════════════════════════════════════════════════════════════
// INNGEST FUNCTION: Handle Human Takeover Detection
// ═══════════════════════════════════════════════════════════════

export const detectHumanTakeover = inngest.createFunction(
    {
        id: 'whatsapp-detect-human-takeover',
        name: 'WhatsApp — Detect Human Takeover',
        retries: 0,
    },
    { event: 'whatsapp/from-me-message' },
    async ({ event }) => {
        const { botMsgId, instanceId, recipientPhone, messageText } = event.data
        const supabase = getSupabase()

        // Check if this message was sent by the bot
        const { data: botMsg } = await supabase
            .from('whatsapp_ai_conversations')
            .select('id')
            .contains('bot_message_ids', [botMsgId])
            .limit(1)
            .maybeSingle()

        if (!botMsg && recipientPhone) {
            // This was a MANUAL message from the human operator
            console.log(`[Human Takeover] Detected on instance ${instanceId}`)
            const { data: conv } = await supabase
                .from('whatsapp_ai_conversations')
                .select('id, broker_id, lead_phone, messages, status')
                .eq('instance_id', instanceId)
                .eq('lead_phone', recipientPhone)
                .in('status', ['active', 'human_takeover', 'transferred'])
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            let currentConv = conv
            if (!currentConv?.id) {
                const { data: inst } = await supabase
                    .from('whatsapp_instances')
                    .select('broker_id')
                    .eq('id', instanceId)
                    .maybeSingle()

                if (inst?.broker_id) {
                    await ensureWhatsAppLead(supabase, {
                        phone: recipientPhone,
                        instanceId,
                        brokerId: inst.broker_id,
                        acquiredVia: 'whatsapp',
                    }).catch(() => null)
                    const { data: created } = await supabase
                        .from('whatsapp_ai_conversations')
                        .insert({
                            broker_id: inst.broker_id,
                            instance_id: instanceId,
                            lead_phone: recipientPhone,
                            messages: [],
                            bot_message_ids: [],
                            status: 'human_takeover',
                            human_takeover_at: new Date().toISOString(),
                        })
                        .select('id, broker_id, lead_phone, messages, status')
                        .single()
                    currentConv = created as any
                }
            }

            if (currentConv?.id) {
                const nextMessages = Array.isArray(currentConv.messages) ? [...currentConv.messages] : []
                const cleanHumanText = (messageText || '').trim()
                if (cleanHumanText) {
                    // Store manual broker message as assistant role so future AI turns preserve full context.
                    nextMessages.push({
                        role: 'assistant',
                        content: cleanHumanText,
                        type: 'text',
                        source: 'human',
                        timestamp: new Date().toISOString(),
                    })
                }

                await supabase
                    .from('whatsapp_ai_conversations')
                    .update({
                        status: 'human_takeover',
                        human_takeover_at: new Date().toISOString(),
                        messages: nextMessages,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentConv.id)

                if (cleanHumanText) {
                    const lead = await ensureWhatsAppLead(supabase, {
                        phone: recipientPhone,
                        instanceId,
                        brokerId: currentConv.broker_id || null,
                        acquiredVia: 'whatsapp',
                    }).catch(() => null)
                    await appendLeadConversationLog(supabase, lead?.id, {
                        role: 'assistant',
                        content: cleanHumanText,
                        type: 'text',
                        source: 'human',
                        instance_id: instanceId,
                        broker_id: currentConv.broker_id || null,
                    }).catch(() => { })
                }

                // Send shift handoff summary to broker phone (if configured)
                if (currentConv.broker_id) {
                    const { data: inst } = await supabase
                        .from('whatsapp_instances')
                        .select('instance_token')
                        .eq('id', instanceId)
                        .maybeSingle()
                    const instanceToken = inst?.instance_token || ''
                    await sendHandoffSummaryIfNeeded(supabase, {
                        conversation: { ...currentConv, messages: nextMessages },
                        instanceId,
                        instanceToken,
                        recipientPhone,
                        markerSuffix: `takeover_${new Date().toISOString().slice(0, 10)}`,
                    }).catch(() => { })
                }
            }

            return { action: 'takeover_activated', phone: recipientPhone }
        }

        return { action: 'bot_message_confirmed' }
    }
)

// ═══════════════════════════════════════════════════════════════
// INNGEST FUNCTION: Shadow Agent (for human brokers after hours)
// ═══════════════════════════════════════════════════════════════

export const shadowAgentResponse = inngest.createFunction(
    {
        id: 'whatsapp-shadow-agent',
        name: 'WhatsApp — Shadow Agent After Hours',
        retries: 1,
    },
    { event: 'whatsapp/shadow-agent' },
    async ({ event, step }) => {
        const { cleanPhone, messageText, instanceId, instanceToken, adminUserId } = event.data
        const supabase = getSupabase()

        const user = await step.run('load-user', async () => {
            const { data } = await supabase.from('admin_users').select('*').eq('id', adminUserId).single()
            return data
        })

        if (!user || !user.shadow_agent_enabled || !user.shadow_agent_prompt) {
            return { action: 'skipped', reason: 'shadow_agent_disabled' }
        }

        // Check availability
        const now = new Date()
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        const availableFrom = user.available_from || '08:00'
        const availableUntil = user.available_until || '20:00'

        if (currentTime >= availableFrom && currentTime <= availableUntil) {
            return { action: 'skipped', reason: 'user_available' }
        }

        // Find or create conversation
        const conversation = await step.run('find-or-create-shadow-conv', async () => {
            await ensureWhatsAppLead(supabase, {
                phone: cleanPhone,
                senderName: null,
                instanceId,
                acquiredVia: 'whatsapp',
            }).catch(() => null)

            const { data: existing } = await supabase
                .from('whatsapp_broker_conversations')
                .select('*')
                .eq('broker_user_id', user.id)
                .eq('lead_phone', cleanPhone)
                .eq('is_shadow_agent', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (existing) {
                return existing
            }

            const { data: newConv } = await supabase
                .from('whatsapp_broker_conversations')
                .insert({ broker_user_id: user.id, lead_phone: cleanPhone, messages: [], is_shadow_agent: true })
                .select()
                .single()
            return newConv
        })

        if (!conversation) return { action: 'error', reason: 'could_not_create_conversation' }

        // Generate AI response
        const responseText = await step.run('generate-shadow-response', async () => {
            const updatedMessages = [...(conversation.messages || []), {
                role: 'user',
                content: messageText,
                source: 'lead',
                instance_id: instanceId,
                timestamp: new Date().toISOString()
            }]

            const configs = await loadAIConfigs(supabase)
            const provider = configs['ai_provider'] || 'gemini'
            const apiKey = provider === 'openai' ? configs['openai_api_key'] : configs['gemini_api_key']

            if (!apiKey) return 'O corretor está indisponível no momento. Retornaremos em breve.'

            let text = ''
            try {
                if (provider === 'openai') {
                    const res = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'gpt-4o-mini',
                            messages: [{ role: 'system', content: user.shadow_agent_prompt }, ...updatedMessages.map((m: any) => ({ role: m.role, content: m.content }))],
                            max_tokens: 300, temperature: 0.7
                        })
                    })
                    const data = await res.json()
                    text = data.choices?.[0]?.message?.content || ''
                } else {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            systemInstruction: { parts: [{ text: user.shadow_agent_prompt }] },
                            contents: updatedMessages.map((m: any) => ({
                                role: m.role === 'assistant' ? 'model' : 'user',
                                parts: [{ text: m.content }]
                            }))
                        })
                    })
                    const data = await res.json()
                    text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
                }
            } catch {
                text = 'O corretor está indisponível no momento.'
            }

            const finalText = text || 'O corretor está indisponível. Retornaremos em breve.'
            updatedMessages.push({
                role: 'assistant',
                content: finalText,
                source: 'shadow_agent',
                instance_id: instanceId,
                timestamp: new Date().toISOString()
            })

            await supabase
                .from('whatsapp_broker_conversations')
                .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
                .eq('id', conversation.id)

            await syncWhatsAppLeadSnapshot(supabase, {
                phone: cleanPhone,
                senderName: null,
                instanceId,
                acquiredVia: 'whatsapp',
                messages: updatedMessages,
                extractedData: null,
                shouldTransfer: false,
            }).catch(() => null)

            return finalText
        })

        // Human-like delays
        await step.sleep('shadow-read-delay', `${Math.floor(Math.random() * 2000) + 1000}ms`)

        await step.run('shadow-typing', async () => {
            await setPresenceTyping(cleanPhone, instanceToken).catch(() => { })
        })

        const typingMs = Math.min(Math.max(responseText.length * 25, 1500), 6000)
        await step.sleep('shadow-typing-delay', `${typingMs}ms`)

        await step.run('shadow-send', async () => {
            await sendWhatsAppMessage({ phone: cleanPhone, message: responseText, instanceToken })
        })

        return { action: 'shadow_responded', phone: cleanPhone }
    }
)

// ═══════════════════════════════════════════════════════════════
// INNGEST CRON: Keep WhatsApp Always Online
// ═══════════════════════════════════════════════════════════════

export const reliableMarkAsRead = inngest.createFunction(
    {
        id: 'whatsapp-reliable-mark-read',
        name: 'WhatsApp - Reliable Mark As Read',
        retries: 0,
    },
    { event: 'whatsapp/mark-read' },
    async ({ event, step }) => {
        const { instanceToken, remotePhone, cleanPhone } = event.data as {
            instanceToken: string
            remotePhone?: string | null
            cleanPhone: string
        }

        if (!instanceToken || !cleanPhone) {
            return { action: 'skipped', reason: 'missing_data' }
        }

        const targets = Array.from(new Set([
            remotePhone || '',
            cleanPhone,
            `${cleanPhone}@s.whatsapp.net`,
        ].filter(Boolean)))

        const delays = [0, 1, 2, 4, 8]
        const results: string[] = []

        for (let i = 0; i < delays.length; i++) {
            const delay = delays[i]
            if (delay > 0) {
                await step.sleep(`retry-wait-${i}`, `${delay}s`)
            }

            await step.run(`retry-mark-read-${i}`, async () => {
                const settled = await Promise.allSettled(
                    targets.map((target) => markAsRead(target, instanceToken))
                )
                const ok = settled.filter(r => r.status === 'fulfilled').length
                results.push(`t+${delay}s: ok=${ok}/${targets.length}`)
            })
        }

        return { action: 'done', targets, results }
    }
)

export const whatsappKeepOnline = inngest.createFunction(
    {
        id: 'whatsapp-keep-online',
        name: 'WhatsApp — Keep Instances Online',
        retries: 0,
    },
    { cron: '*/2 * * * *' },  // Every 2 minutes
    async () => {
        const supabase = getSupabase()

        // Get all connected instances with their config
        const { data: instances } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, instance_token, config')
            .eq('status', 'connected')

        if (!instances || instances.length === 0) {
            return { action: 'no_connected_instances' }
        }

        // Set presence for each instance that has always_online enabled
        const results: string[] = []
        for (const inst of instances) {
            const cfg = (inst.config as Record<string, any>) || {}
            // Default to true if not explicitly set to false
            if (cfg.always_online === false || cfg.always_online === 'false') {
                results.push(`${inst.instance_name}: skipped (always_online=false)`)
                continue
            }
            try {
                await setPresenceAvailable(inst.instance_token)
                results.push(`${inst.instance_name}: online`)
            } catch {
                results.push(`${inst.instance_name}: error`)
            }
        }

        console.log(`[KeepOnline] ${results.join(', ')}`)
        return { action: 'presence_set', count: instances.length, results }
    }
)
