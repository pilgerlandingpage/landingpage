import { generateChatResponse } from '@/lib/ai/generation'

export const WHATSAPP_ATTENDANCE_COACH_AGENT_ID = 'whatsapp-attendance-coach'
export const WHATSAPP_ATTENDANCE_COACH_PROMPT_KEY = 'whatsapp_attendance_coach_system_prompt'

export const DEFAULT_WHATSAPP_ATTENDANCE_COACH_PROMPT = [
    'Voce e Helena Auditoria Comercial, agente senior de melhoria de atendimento imobiliario.',
    'Sua funcao e ler conversas de WhatsApp entre lead e corretor/agente e avaliar a qualidade comercial do atendimento.',
    'Analise intencao do lead, etapa do funil, objecoes, tempo/contexto de resposta, clareza, empatia, qualificacao, conducao para proximo passo e risco de perda.',
    'Aponte onde o corretor deixou a desejar, quais oportunidades foram perdidas, quais ainda sao recuperaveis e como melhorar a comunicacao.',
    'No resumo do agente, escreva como um coach de atendimento: seja direto, pratico, textual e orientado a acao.',
    'Inclua pontos de atencao, plano de treino e acoes de recuperacao que a gestao possa cobrar do corretor.',
    'Nao invente fatos, valores, nomes ou imoveis. Use apenas o historico recebido.',
    'Nunca escreva como se estivesse falando com o lead; voce esta orientando a gestao/corretor.',
    'Retorne somente JSON valido, sem markdown.',
].join('\n')

export type AttendanceCoachSettings = {
    enabled: boolean
    prompt: string
    maxConversations: number
    batchSize: number
    minMessages: number
}

export type AttendanceCoachMessage = {
    role: 'lead' | 'broker' | 'agent' | 'unknown'
    text: string
    at: string | null
}

export type AttendanceCoachConversationInput = {
    chat_id: string
    phone: string | null
    lead_name?: string | null
    baseline_score: number
    baseline_potential: string
    unanswered: boolean
    response_time_seconds: number | null
    messages: AttendanceCoachMessage[]
}

export type AttendanceCoachConversationAnalysis = {
    chat_id: string
    score: number
    lead_potential: 'hot' | 'warm' | 'cold' | 'unknown'
    lead_intent: string
    funnel_stage: string
    commercial_status: string
    lost_opportunity: boolean
    recoverable: boolean
    communication_quality: number
    response_quality: number
    closing_quality: number
    empathy_quality: number
    qualification_quality: number
    main_issue: string
    summary: string
    what_broker_did_well: string[]
    what_broker_missed: string[]
    risks: string[]
    recommendations: string[]
    recommended_next_action: string
    suggested_message: string
}

export type AttendanceCoachSummary = {
    executive_summary: string
    strengths: string[]
    attention_points: string[]
    improvement_points: string[]
    training_focus: string[]
    recovery_actions: string[]
}

export type AttendanceCoachResult = {
    conversations: Map<string, AttendanceCoachConversationAnalysis>
    summary: AttendanceCoachSummary | null
    errors: string[]
    analyzedCount: number
}

const DEFAULT_SETTINGS: AttendanceCoachSettings = {
    enabled: true,
    prompt: DEFAULT_WHATSAPP_ATTENDANCE_COACH_PROMPT,
    maxConversations: 40,
    batchSize: 8,
    minMessages: 2,
}

function normalizeBool(value: unknown, fallback: boolean) {
    const text = String(value ?? '').trim().toLowerCase()
    if (['true', '1', 'yes', 'sim', 'on'].includes(text)) return true
    if (['false', '0', 'no', 'nao', 'não', 'off'].includes(text)) return false
    return fallback
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(max, Math.max(min, Math.round(parsed)))
}

function cleanJson(text: string) {
    const cleaned = String(text || '')
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim()
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) return cleaned.slice(firstBrace, lastBrace + 1)
    return cleaned
}

function truncate(value: unknown, max = 900) {
    const text = String(value || '').trim()
    return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function normalizeScore(value: unknown, fallback = 0) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(100, Math.max(0, Math.round(parsed)))
}

function normalizePotential(value: unknown): AttendanceCoachConversationAnalysis['lead_potential'] {
    const text = String(value || '').trim().toLowerCase()
    if (['hot', 'quente', 'alto', 'alta'].includes(text)) return 'hot'
    if (['warm', 'morno', 'media', 'média', 'medio', 'médio'].includes(text)) return 'warm'
    if (['cold', 'frio', 'baixa', 'baixo'].includes(text)) return 'cold'
    return 'unknown'
}

function normalizeStringArray(value: unknown, limit = 6) {
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\n|;/) : []
    return raw
        .map((item) => truncate(item, 220))
        .filter(Boolean)
        .slice(0, limit)
}

function normalizeAnalysis(row: any, original: AttendanceCoachConversationInput): AttendanceCoachConversationAnalysis | null {
    const chatId = String(row?.chat_id || '').trim()
    if (!chatId || chatId !== original.chat_id) return null

    return {
        chat_id: original.chat_id,
        score: normalizeScore(row?.score ?? row?.llm_score, original.baseline_score),
        lead_potential: normalizePotential(row?.lead_potential || row?.lead_intent || original.baseline_potential),
        lead_intent: truncate(row?.lead_intent, 80) || original.baseline_potential || 'indefinido',
        funnel_stage: truncate(row?.funnel_stage, 80) || 'nao identificado',
        commercial_status: truncate(row?.commercial_status, 80) || 'monitorar',
        lost_opportunity: row?.lost_opportunity === true,
        recoverable: row?.recoverable !== false,
        communication_quality: normalizeScore(row?.communication_quality, original.baseline_score),
        response_quality: normalizeScore(row?.response_quality, original.baseline_score),
        closing_quality: normalizeScore(row?.closing_quality, original.baseline_score),
        empathy_quality: normalizeScore(row?.empathy_quality, original.baseline_score),
        qualification_quality: normalizeScore(row?.qualification_quality, original.baseline_score),
        main_issue: truncate(row?.main_issue, 280) || 'Sem problema principal destacado pela LLM.',
        summary: truncate(row?.summary, 500) || 'Conversa analisada pela auditoria comercial.',
        what_broker_did_well: normalizeStringArray(row?.what_broker_did_well),
        what_broker_missed: normalizeStringArray(row?.what_broker_missed),
        risks: normalizeStringArray(row?.risks),
        recommendations: normalizeStringArray(row?.recommendations),
        recommended_next_action: truncate(row?.recommended_next_action, 300),
        suggested_message: truncate(row?.suggested_message, 700),
    }
}

function normalizeSummary(value: any): AttendanceCoachSummary | null {
    if (!value || typeof value !== 'object') return null
    return {
        executive_summary: truncate(value.executive_summary || value.summary, 1800),
        strengths: normalizeStringArray(value.strengths, 8),
        attention_points: normalizeStringArray(value.attention_points || value.points_of_attention || value.risks, 8),
        improvement_points: normalizeStringArray(value.improvement_points, 10),
        training_focus: normalizeStringArray(value.training_focus, 8),
        recovery_actions: normalizeStringArray(value.recovery_actions, 8),
    }
}

function mergeStringArrays(...values: Array<string[] | null | undefined>) {
    const seen = new Set<string>()
    const merged: string[] = []
    for (const list of values) {
        for (const item of list || []) {
            const text = truncate(item, 260)
            const key = text.toLowerCase()
            if (!text || seen.has(key)) continue
            seen.add(key)
            merged.push(text)
        }
    }
    return merged.slice(0, 10)
}

function mergeCoachSummaries(current: AttendanceCoachSummary | null, next: AttendanceCoachSummary | null) {
    if (!current) return next
    if (!next) return current
    return {
        executive_summary: truncate([current.executive_summary, next.executive_summary].filter(Boolean).join(' '), 1800),
        strengths: mergeStringArrays(current.strengths, next.strengths),
        attention_points: mergeStringArrays(current.attention_points, next.attention_points),
        improvement_points: mergeStringArrays(current.improvement_points, next.improvement_points),
        training_focus: mergeStringArrays(current.training_focus, next.training_focus),
        recovery_actions: mergeStringArrays(current.recovery_actions, next.recovery_actions),
    }
}

function formatConversationForPrompt(conversation: AttendanceCoachConversationInput) {
    return {
        chat_id: conversation.chat_id,
        phone: conversation.phone,
        lead_name: conversation.lead_name || null,
        baseline: {
            score: conversation.baseline_score,
            lead_potential: conversation.baseline_potential,
            unanswered: conversation.unanswered,
            response_time_seconds: conversation.response_time_seconds,
        },
        messages: conversation.messages
            .slice(-18)
            .map((message) => ({
                role: message.role,
                at: message.at,
                text: truncate(message.text, 320),
            })),
    }
}

function buildPromptPayload(params: {
    ownerName: string
    reportDate: string
    conversations: AttendanceCoachConversationInput[]
}) {
    return {
        instruction: 'Analise as conversas e devolva JSON no schema indicado. Use chat_id exatamente igual ao recebido.',
        report_date: params.reportDate,
        broker_or_instance: params.ownerName,
        output_schema: {
            agent_summary: {
                executive_summary: 'relatorio diario textual como coach de atendimento, com leitura clara do comportamento do corretor',
                strengths: ['pontos fortes objetivos'],
                attention_points: ['pontos de atencao que a gestao deve cobrar'],
                improvement_points: ['pontos de melhoria objetivos'],
                training_focus: ['treinos praticos para o corretor'],
                recovery_actions: ['acoes para recuperar oportunidades'],
            },
            conversations: [{
                chat_id: 'id original',
                score: '0 a 100',
                lead_potential: 'hot|warm|cold|unknown',
                lead_intent: 'intencao do lead',
                funnel_stage: 'descoberta|qualificacao|visita|proposta|negociacao|pos-venda|perdido|indefinido',
                commercial_status: 'cliente_pronto_para_comprar|cliente_com_objecao|oportunidade_perdida|recuperavel|monitorar|mal_atendido',
                lost_opportunity: false,
                recoverable: true,
                communication_quality: '0 a 100',
                response_quality: '0 a 100',
                closing_quality: '0 a 100',
                empathy_quality: '0 a 100',
                qualification_quality: '0 a 100',
                main_issue: 'principal falha ou risco',
                summary: 'resumo curto da conversa',
                what_broker_did_well: ['pontos bons'],
                what_broker_missed: ['o que faltou'],
                risks: ['riscos comerciais'],
                recommendations: ['melhorias praticas'],
                recommended_next_action: 'proxima acao',
                suggested_message: 'mensagem sugerida para recuperar ou avancar',
            }],
        },
        conversations: params.conversations.map(formatConversationForPrompt),
    }
}

function parseCoachResponse(raw: string, originals: AttendanceCoachConversationInput[]) {
    const parsed = JSON.parse(cleanJson(raw))
    const rows = Array.isArray(parsed) ? parsed : parsed.conversations
    const byId = new Map(originals.map((item) => [item.chat_id, item]))
    const conversations = new Map<string, AttendanceCoachConversationAnalysis>()

    if (Array.isArray(rows)) {
        for (const row of rows) {
            const chatId = String(row?.chat_id || '').trim()
            const original = byId.get(chatId)
            if (!original) continue
            const normalized = normalizeAnalysis(row, original)
            if (normalized) conversations.set(normalized.chat_id, normalized)
        }
    }

    return {
        conversations,
        summary: normalizeSummary(parsed?.agent_summary || parsed?.summary),
    }
}

async function analyzeBatch(params: {
    settings: AttendanceCoachSettings
    ownerName: string
    reportDate: string
    conversations: AttendanceCoachConversationInput[]
}) {
    const raw = await generateChatResponse(
        [],
        JSON.stringify(buildPromptPayload(params)),
        params.settings.prompt,
        {}
    )
    return parseCoachResponse(raw, params.conversations)
}

export async function loadAttendanceCoachSettings(supabase: any): Promise<AttendanceCoachSettings> {
    try {
        const keys = [
            WHATSAPP_ATTENDANCE_COACH_PROMPT_KEY,
            'whatsapp_attendance_coach_enabled',
            'whatsapp_attendance_coach_max_conversations',
            'whatsapp_attendance_coach_batch_size',
            'whatsapp_attendance_coach_min_messages',
        ]
        const { data, error } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', keys)
        if (error) throw error
        const map = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
        return {
            enabled: normalizeBool(map.whatsapp_attendance_coach_enabled, DEFAULT_SETTINGS.enabled),
            prompt: map[WHATSAPP_ATTENDANCE_COACH_PROMPT_KEY] || DEFAULT_SETTINGS.prompt,
            maxConversations: boundedNumber(map.whatsapp_attendance_coach_max_conversations, DEFAULT_SETTINGS.maxConversations, 1, 200),
            batchSize: boundedNumber(map.whatsapp_attendance_coach_batch_size, DEFAULT_SETTINGS.batchSize, 1, 20),
            minMessages: boundedNumber(map.whatsapp_attendance_coach_min_messages, DEFAULT_SETTINGS.minMessages, 1, 20),
        }
    } catch (error) {
        console.warn('[attendance-coach-agent] usando configuracao padrao:', error instanceof Error ? error.message : error)
        return DEFAULT_SETTINGS
    }
}

export async function runAttendanceCoachAnalysis(params: {
    settings: AttendanceCoachSettings
    ownerName: string
    reportDate: string
    conversations: AttendanceCoachConversationInput[]
}): Promise<AttendanceCoachResult> {
    const result: AttendanceCoachResult = {
        conversations: new Map(),
        summary: null,
        errors: [],
        analyzedCount: 0,
    }

    if (!params.settings.enabled || params.conversations.length === 0) return result

    const capped = params.conversations
        .filter((conversation) => conversation.messages.length >= params.settings.minMessages)
        .slice(0, params.settings.maxConversations)
    const batchSize = Math.max(1, params.settings.batchSize)

    for (let index = 0; index < capped.length; index += batchSize) {
        const batch = capped.slice(index, index + batchSize)
        try {
            const parsed = await analyzeBatch({ ...params, conversations: batch })
            for (const [chatId, analysis] of parsed.conversations.entries()) {
                result.conversations.set(chatId, analysis)
            }
            if (
                parsed.summary?.executive_summary ||
                parsed.summary?.attention_points.length ||
                parsed.summary?.improvement_points.length ||
                parsed.summary?.training_focus.length ||
                parsed.summary?.recovery_actions.length
            ) {
                result.summary = mergeCoachSummaries(result.summary, parsed.summary)
            }
            result.analyzedCount += batch.length
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            result.errors.push(message.slice(0, 500))
            console.warn('[attendance-coach-agent] falha ao analisar lote:', message)
        }
    }

    return result
}
