import { generateChatResponse } from '@/lib/ai/generation'
import { buildAgentContextBrief, getAgentEcosystemContext, recordEcosystemEvent } from '@/lib/intelligence/ecosystem'
import { DEFAULT_EVENT_AGENT_SYSTEM_PROMPT } from './agent-prompt'

type JsonRecord = Record<string, any>

export type EventAgentLead = {
    id: string
    name: string
    phone: string
    email: string
    city: string
    creci: string
    status: string
    score: number
    level: 'quente' | 'morno' | 'frio'
    top3_score: number
    lead_score: number
    challenge: string
    timeline: string
    investment: string
    current_tool: string
    automation_wish: string
    conversation_matched: boolean
    conversation_signal: string
    tracking_signal: string
    reasons: string[]
}

export type EventAgentReport = {
    generated_at: string
    event: {
        id: string
        title: string
        slug: string
        event_date: string
        location_name: string
        location_address: string
        maps_url: string
    }
    thresholds: {
        hot_score: number
        warm_score: number
    }
    totals: {
        registrations: number
        hot: number
        warm: number
        cold: number
        checked_in: number
        creci_verified: number
        pending_messages: number
        sent_messages: number
        failed_messages: number
        conversation_matches: number
    }
    top_leads: EventAgentLead[]
    recommendations: string[]
    ai_summary?: string
}

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function clean(value: unknown, fallback = '') {
    return String(value || fallback).trim()
}

function normalizePhone(value: unknown) {
    let digits = String(value || '').replace(/\D/g, '')
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = `55${digits}`
    return digits
}

function toNumber(value: unknown, fallback = 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

function getTop3Intent(registration: JsonRecord) {
    const metadata = asRecord(registration.metadata)
    const intent = asRecord(metadata.top3_intent)
    const answers = asRecord(intent.answers)
    return {
        score: toNumber(intent.score, 0),
        level: clean(intent.level, 'frio'),
        challenge: clean(answers.main_challenge_label, 'Desafio nao informado'),
        timeline: clean(answers.improvement_timeline_label, 'Prazo nao informado'),
        investment: clean(answers.monthly_investment_label, 'Investimento nao informado'),
        currentTool: clean(answers.current_tool_label, 'Ferramenta nao informada'),
        automationWish: clean(answers.automation_wish),
    }
}

function readConversationText(value: unknown) {
    if (Array.isArray(value)) {
        return value
            .slice(-12)
            .map(item => {
                const record = asRecord(item)
                return clean(record.content || record.text || record.message || record.body)
            })
            .filter(Boolean)
            .join('\n')
            .slice(0, 2400)
    }
    return clean(value).slice(0, 2400)
}

function summarizeConversation(conversationText: string) {
    const lower = conversationText.toLowerCase()
    const hits: string[] = []

    if (/(preco|valor|plano|mensalidade|quanto custa|investimento)/i.test(lower)) hits.push('perguntou sobre valor/plano')
    if (/(comprar|contratar|fechar|assinar|quero usar|tenho interesse)/i.test(lower)) hits.push('sinalizou compra ou contratacao')
    if (/(automacao|crm|whatsapp|follow.?up|lead|leads|atendimento)/i.test(lower)) hits.push('falou sobre automacao, CRM ou leads')
    if (/(evento|confirmar|presenca|vou|participar)/i.test(lower)) hits.push('interagiu sobre o evento')

    return hits.join(', ') || (conversationText ? 'conversa encontrada, sem sinal quente explicito' : '')
}

function summarizeTracking(metadata: JsonRecord) {
    const activity = Array.isArray(metadata.site_activity) ? metadata.site_activity : []
    const clicks = Array.isArray(metadata.whatsapp_clicks) ? metadata.whatsapp_clicks : []
    const eventInteractions = Array.isArray(metadata.event_interactions) ? metadata.event_interactions : []
    const behavior = asRecord(metadata.behavior_summary)
    const signals: string[] = []

    if (activity.length) signals.push(`${activity.length} interacoes no site`)
    if (clicks.length) signals.push(`${clicks.length} cliques WhatsApp`)
    if (eventInteractions.length) signals.push(`${eventInteractions.length} interacoes do evento`)
    if (toNumber(behavior.high_intent_events, 0) > 0) signals.push(`${behavior.high_intent_events} eventos de alta intencao`)
    if (clean(metadata.last_whatsapp_click)) signals.push('clicou recentemente no WhatsApp')
    if (clean(metadata.last_event_interaction)) signals.push('respondeu automacao do evento')

    return signals.join(', ')
}

function summarizeEventInteractions(metadata: JsonRecord) {
    const interactions = Array.isArray(metadata.event_interactions) ? metadata.event_interactions.map(asRecord) : []
    if (!interactions.length) return ''

    const last = interactions[interactions.length - 1]
    const signals: string[] = [`${interactions.length} respostas/cliques do evento`]
    const lastLabel = clean(last.button_label || last.button_action || last.type)
    if (lastLabel) signals.push(`ultima: ${lastLabel}`)
    if (interactions.some(item => /confirm/i.test(clean(item.button_action || item.button_label)))) {
        signals.push('confirmou interesse pelo botao')
    }
    if (interactions.some(item => clean(item.type) === 'link_click')) {
        signals.push('clicou em link do evento')
    }

    return signals.join(', ')
}

function leadScoreBonus(lead: JsonRecord | null, conversationSignal: string, trackingSignal: string) {
    if (!lead) return 0
    let bonus = 0
    const leadScore = toNumber(lead.lead_score, 0)
    if (leadScore > 0) bonus += Math.min(12, Math.round(leadScore / 10))

    const classification = clean(lead.lead_classification).toLowerCase()
    if (/(quente|hot|qualified|alto)/i.test(classification)) bonus += 8
    if (/(morno|warm|medio)/i.test(classification)) bonus += 4

    if (/compra|contratacao|valor|plano/i.test(conversationSignal)) bonus += 8
    else if (conversationSignal) bonus += 3

    if (trackingSignal) bonus += 4

    return bonus
}

function classify(score: number, hotThreshold: number, warmThreshold: number): EventAgentLead['level'] {
    if (score >= hotThreshold) return 'quente'
    if (score >= warmThreshold) return 'morno'
    return 'frio'
}

function buildReasons(params: {
    top3Score: number
    challenge: string
    timeline: string
    investment: string
    conversationSignal: string
    trackingSignal: string
}) {
    const reasons: string[] = []
    if (params.top3Score) reasons.push(`Formulario de intencao: ${params.top3Score} pts`)
    if (params.challenge && params.challenge !== 'Desafio nao informado') reasons.push(params.challenge)
    if (params.timeline && params.timeline !== 'Prazo nao informado') reasons.push(params.timeline)
    if (params.investment && params.investment !== 'Investimento nao informado') reasons.push(params.investment)
    if (params.conversationSignal) reasons.push(params.conversationSignal)
    if (params.trackingSignal) reasons.push(params.trackingSignal)
    return reasons.slice(0, 5)
}

function getLeadMetadata(lead: JsonRecord | null) {
    return asRecord(lead?.metadata)
}

async function loadAppConfigs(supabase: any) {
    const { data } = await supabase
        .from('app_config')
        .select('key,value')
        .in('key', [
            'event_agent_enabled',
            'event_agent_ai_report_enabled',
            'event_agent_hot_score_threshold',
            'event_agent_report_limit',
            'event_agent_system_prompt',
        ])

    return Object.fromEntries((data || []).map((row: any) => [String(row.key), String(row.value || '')]))
}

async function loadTargetEvent(supabase: any, eventId?: string | null) {
    if (eventId) {
        const { data, error } = await supabase.from('event_events').select('*').eq('id', eventId).maybeSingle()
        if (error) throw error
        return data
    }

    const now = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: upcoming, error: upcomingError } = await supabase
        .from('event_events')
        .select('*')
        .in('status', ['published', 'draft'])
        .gte('event_date', now)
        .order('event_date', { ascending: true })
        .limit(1)
        .maybeSingle()

    if (upcomingError) throw upcomingError
    if (upcoming) return upcoming

    const { data: latest, error: latestError } = await supabase
        .from('event_events')
        .select('*')
        .order('event_date', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (latestError) throw latestError
    return latest
}

async function loadMatchingLeads(supabase: any, phones: string[]) {
    const uniquePhones = [...new Set(phones.filter(Boolean))].slice(0, 80)
    if (!uniquePhones.length) return new Map<string, JsonRecord>()

    const select = 'id,name,email,phone,phone_e164,metadata,conversation_log,lead_score,lead_classification,funnel_stage,acquired_via,created_at,updated_at'
    const [phoneRes, e164Res] = await Promise.all([
        supabase.from('leads').select(select).in('phone', uniquePhones).limit(120),
        supabase.from('leads').select(select).in('phone_e164', uniquePhones).limit(120),
    ])

    const rows = [
        ...(!phoneRes.error && Array.isArray(phoneRes.data) ? phoneRes.data : []),
        ...(!e164Res.error && Array.isArray(e164Res.data) ? e164Res.data : []),
    ]

    const map = new Map<string, JsonRecord>()
    for (const row of rows) {
        const phone = normalizePhone(row.phone)
        const e164 = normalizePhone(row.phone_e164)
        if (phone) map.set(phone, row)
        if (e164) map.set(e164, row)
    }
    return map
}

function buildRecommendations(report: Omit<EventAgentReport, 'recommendations'>) {
    const recommendations: string[] = []

    if (report.totals.hot > 0) {
        recommendations.push(`Priorizar ${report.totals.hot} leads quentes com contato humano ou mensagem com botao rastreavel criado no construtor do evento.`)
    }
    if (report.totals.pending_messages > 0) {
        recommendations.push(`Processar ${report.totals.pending_messages} mensagens pendentes antes de criar novos disparos.`)
    }
    if (report.totals.conversation_matches < report.totals.registrations) {
        recommendations.push('Estimular conversa no WhatsApp para inscritos sem historico, usando enquete curta de confirmacao de presenca.')
    }
    if (report.top_leads.some(lead => lead.challenge.includes('Responder') || lead.current_tool.includes('WhatsApp'))) {
        recommendations.push('Separar uma automacao especifica sobre velocidade de atendimento e WhatsApp Global.')
    }
    if (report.top_leads.some(lead => lead.investment.includes('5.000') || lead.score >= report.thresholds.hot_score + 12)) {
        recommendations.push('Criar lista VIP para leads com maior capacidade de investimento e abordagem pos-evento mais direta.')
    }

    return recommendations.length
        ? recommendations
        : ['Aguardar mais inscritos para gerar recomendacoes com maior confianca.']
}

export async function buildEventAgentReport(supabase: any, params: { eventId?: string | null } = {}): Promise<EventAgentReport> {
    const configs = await loadAppConfigs(supabase)
    const hotThreshold = Math.max(40, Math.min(95, toNumber(configs.event_agent_hot_score_threshold, 72)))
    const warmThreshold = Math.max(28, hotThreshold - 30)
    const reportLimit = Math.max(3, Math.min(40, toNumber(configs.event_agent_report_limit, 12)))
    const event = await loadTargetEvent(supabase, params.eventId)

    if (!event) throw new Error('Nenhum evento encontrado para o Agente de Eventos.')

    const [registrationsRes, messagesRes] = await Promise.all([
        supabase.from('event_registrations').select('*').eq('event_id', event.id).order('created_at', { ascending: false }).limit(300),
        supabase.from('event_message_queue').select('*').eq('event_id', event.id).order('scheduled_for', { ascending: false }).limit(200),
    ])

    if (registrationsRes.error) throw registrationsRes.error
    if (messagesRes.error) throw messagesRes.error

    const registrations = Array.isArray(registrationsRes.data) ? registrationsRes.data : []
    const messages = Array.isArray(messagesRes.data) ? messagesRes.data : []
    const leadMap = await loadMatchingLeads(supabase, registrations.map((row: JsonRecord) => normalizePhone(row.phone)))

    const leads: EventAgentLead[] = registrations.map((registration: JsonRecord) => {
        const phone = normalizePhone(registration.phone)
        const lead = leadMap.get(phone) || null
        const top3 = getTop3Intent(registration)
        const leadMetadata = getLeadMetadata(lead)
        const conversationText = readConversationText(lead?.conversation_log)
        const conversationSignal = summarizeConversation(conversationText)
        const trackingSignal = [
            summarizeTracking(leadMetadata),
            summarizeEventInteractions(asRecord(registration.metadata)),
        ].filter(Boolean).join(', ')
        const leadScore = toNumber(lead?.lead_score, 0)
        const score = Math.min(100, Math.round(top3.score + leadScoreBonus(lead, conversationSignal, trackingSignal)))
        const level = classify(score, hotThreshold, warmThreshold)

        return {
            id: String(registration.id || ''),
            name: clean(registration.full_name || lead?.name, 'Sem nome'),
            phone,
            email: clean(registration.email || lead?.email),
            city: clean(registration.city),
            creci: [clean(registration.creci_state), clean(registration.creci)].filter(Boolean).join(' '),
            status: clean(registration.status, 'confirmed'),
            score,
            level,
            top3_score: top3.score,
            lead_score: leadScore,
            challenge: top3.challenge,
            timeline: top3.timeline,
            investment: top3.investment,
            current_tool: top3.currentTool,
            automation_wish: top3.automationWish,
            conversation_matched: Boolean(lead),
            conversation_signal: conversationSignal,
            tracking_signal: trackingSignal,
            reasons: buildReasons({
                top3Score: top3.score,
                challenge: top3.challenge,
                timeline: top3.timeline,
                investment: top3.investment,
                conversationSignal,
                trackingSignal,
            }),
        }
    }).sort((a: EventAgentLead, b: EventAgentLead) => b.score - a.score)

    const active = registrations.filter((row: JsonRecord) => row.status !== 'cancelled')
    const baseReport: Omit<EventAgentReport, 'recommendations'> = {
        generated_at: new Date().toISOString(),
        event: {
            id: String(event.id || ''),
            title: clean(event.title),
            slug: clean(event.slug),
            event_date: clean(event.event_date),
            location_name: clean(event.location_name),
            location_address: clean(event.location_address),
            maps_url: clean(asRecord(event.metadata).maps_url),
        },
        thresholds: {
            hot_score: hotThreshold,
            warm_score: warmThreshold,
        },
        totals: {
            registrations: active.length,
            hot: leads.filter(lead => lead.level === 'quente').length,
            warm: leads.filter(lead => lead.level === 'morno').length,
            cold: leads.filter(lead => lead.level === 'frio').length,
            checked_in: registrations.filter((row: JsonRecord) => row.status === 'checked_in').length,
            creci_verified: registrations.filter((row: JsonRecord) => row.creci_status === 'manually_verified').length,
            pending_messages: messages.filter((row: JsonRecord) => row.status === 'pending').length,
            sent_messages: messages.filter((row: JsonRecord) => row.status === 'sent').length,
            failed_messages: messages.filter((row: JsonRecord) => row.status === 'failed').length,
            conversation_matches: leads.filter(lead => lead.conversation_matched).length,
        },
        top_leads: leads.slice(0, reportLimit),
    }

    return {
        ...baseReport,
        recommendations: buildRecommendations(baseReport),
    }
}

export async function generateEventAgentAiSummary(supabase: any, report: EventAgentReport) {
    const configs = await loadAppConfigs(supabase)
    if (configs.event_agent_ai_report_enabled === 'false') {
        throw new Error('Relatorio IA do Agente de Eventos esta desativado no comportamento operacional.')
    }

    const ecosystemContext = await getAgentEcosystemContext({ supabase, agent: 'events', days: 30, limit: 100 }).catch((error: any) => {
        console.warn('[Event Agent] Ecosystem context unavailable:', error?.message || error)
        return null
    })
    const ecosystemBrief = ecosystemContext ? buildAgentContextBrief(ecosystemContext) : ''
    const systemPrompt = [
        clean(configs.event_agent_system_prompt, DEFAULT_EVENT_AGENT_SYSTEM_PROMPT),
        ecosystemBrief
            ? [
                'CONTEXTO CENTRAL DO ECOSSISTEMA PILGER:',
                ecosystemBrief,
                'Use estes sinais para recomendar automacoes e prioridades, sem revelar dados internos, IPs, IDs ou nomes de outros leads ao publico.',
            ].join('\n')
            : '',
    ].filter(Boolean).join('\n\n')
    const payload = {
        event: report.event,
        totals: report.totals,
        thresholds: report.thresholds,
        top_leads: report.top_leads.slice(0, 8).map(lead => ({
            name: lead.name,
            city: lead.city,
            creci: lead.creci,
            score: lead.score,
            level: lead.level,
            challenge: lead.challenge,
            timeline: lead.timeline,
            investment: lead.investment,
            current_tool: lead.current_tool,
            conversation_signal: lead.conversation_signal,
            tracking_signal: lead.tracking_signal,
            reasons: lead.reasons,
        })),
        current_recommendations: report.recommendations,
        ecosystem_context: ecosystemContext ? {
            source_counts: ecosystemContext.source_counts,
            signals: ecosystemContext.signals,
        } : null,
    }

    const message = [
        'Gere uma leitura executiva para a equipe da Guilherme Pilger sobre os inscritos deste evento.',
        'Diga quem tem mais potencial comercial neste evento, quais automacoes devem ser disparadas e quais botoes/enquetes usar.',
        'Seja objetivo e use subtitulos curtos.',
        '',
        JSON.stringify(payload, null, 2),
    ].join('\n')

    const summary = (await generateChatResponse([], message, systemPrompt)).trim()

    await recordEcosystemEvent({
        supabase,
        eventType: 'event_agent_report_generated',
        actorType: 'agent',
        entityType: 'event',
        entityId: report.event.id,
        source: 'event-agent',
        label: `Relatorio do Agente de Eventos: ${report.event.title}`,
        importanceScore: report.totals.hot > 0 ? 78 : 62,
        metadata: {
            event: report.event,
            totals: report.totals,
            top_leads: report.top_leads.slice(0, 5).map(lead => ({
                id: lead.id,
                name: lead.name,
                score: lead.score,
                level: lead.level,
            })),
            recommendations: report.recommendations,
            ai_summary: summary.slice(0, 1200),
        },
    }).catch((error: any) => {
        console.warn('[Event Agent] ecosystem event failed:', error?.message || error)
    })

    return summary
}
