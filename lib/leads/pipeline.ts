export type LeadPipelineStageKey =
    | 'entrada'
    | 'fup'
    | 'conectados'
    | 'oportunidades'
    | 'investidores'
    | 'leads_quentes'
    | 'visitas'
    | 'proposta_negociacao'
    | 'contrato'
    | 'contatos_gerais'
    | 'standby'
    | 'proprietarios'
    | 'perdidos'

export type LeadPipelineStage = {
    key: LeadPipelineStageKey
    label: string
    shortLabel: string
    color: string
    bg: string
    border: string
}

export const LEAD_PIPELINE_STAGES: LeadPipelineStage[] = [
    { key: 'entrada', label: 'Entrada', shortLabel: 'Entrada', color: '#2563eb', bg: '#eff6ff', border: 'rgba(37,99,235,0.22)' },
    { key: 'fup', label: 'FUP', shortLabel: 'FUP', color: '#b45309', bg: '#fffbeb', border: 'rgba(180,83,9,0.24)' },
    { key: 'conectados', label: 'Conectados', shortLabel: 'Conect.', color: '#0891b2', bg: '#ecfeff', border: 'rgba(8,145,178,0.22)' },
    { key: 'oportunidades', label: 'Oportunidades', shortLabel: 'Oport.', color: '#7c3aed', bg: '#f5f3ff', border: 'rgba(124,58,237,0.22)' },
    { key: 'investidores', label: 'Investidores', shortLabel: 'Invest.', color: '#0f766e', bg: '#f0fdfa', border: 'rgba(15,118,110,0.22)' },
    { key: 'leads_quentes', label: 'Leads Quentes', shortLabel: 'Quentes', color: '#c2410c', bg: '#fff7ed', border: 'rgba(194,65,12,0.24)' },
    { key: 'visitas', label: 'Visitas', shortLabel: 'Visitas', color: '#047857', bg: '#ecfdf5', border: 'rgba(4,120,87,0.22)' },
    { key: 'proposta_negociacao', label: 'Proposta / Negociacao', shortLabel: 'Proposta', color: '#9333ea', bg: '#faf5ff', border: 'rgba(147,51,234,0.22)' },
    { key: 'contrato', label: 'Contrato', shortLabel: 'Contrato', color: '#15803d', bg: '#f0fdf4', border: 'rgba(21,128,61,0.22)' },
    { key: 'contatos_gerais', label: 'Contatos Gerais', shortLabel: 'Gerais', color: '#475569', bg: '#f8fafc', border: 'rgba(71,85,105,0.18)' },
    { key: 'standby', label: 'Standby', shortLabel: 'Standby', color: '#64748b', bg: '#f8fafc', border: 'rgba(100,116,139,0.2)' },
    { key: 'proprietarios', label: 'Proprietarios', shortLabel: 'Props.', color: '#0e7490', bg: '#ecfeff', border: 'rgba(14,116,144,0.22)' },
    { key: 'perdidos', label: 'Perdidos', shortLabel: 'Perdidos', color: '#b91c1c', bg: '#fef2f2', border: 'rgba(185,28,28,0.22)' },
]

export const LEAD_PIPELINE_STAGE_BY_KEY = LEAD_PIPELINE_STAGES.reduce<Record<LeadPipelineStageKey, LeadPipelineStage>>((acc, stage) => {
    acc[stage.key] = stage
    return acc
}, {} as Record<LeadPipelineStageKey, LeadPipelineStage>)

type PipelineLeadLike = {
    status?: string | null
    interest?: string | null
    lead_classification?: string | null
    lead_score?: number | null
    qualification_score?: number | null
    notes?: string | null
    ai_summary?: string | null
    conversation_summary?: string | null
    conversation_status?: string | null
    conversation_messages?: any[] | null
    whatsapp_clicks?: any[] | null
    site_activity?: any[] | null
    behavior_summary?: any | null
    crm_action_recommendations?: any | null
    crm_action_recommendation_actions?: any | null
    created_at?: string | null
    updated_at?: string | null
    source?: string | null
    landing_page_title?: string | null
    property_type?: string | null
    timeline?: string | null
    pipeline_stage?: string | null
    pipeline_reason?: string | null
}

function normalizeText(value: unknown) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function hasAny(text: string, words: string[]) {
    return words.some(word => text.includes(word))
}

function asRecord(value: any): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value: any): any[] {
    return Array.isArray(value) ? value : []
}

export function normalizeLeadPipelineStageKey(value: unknown): LeadPipelineStageKey | null {
    const key = normalizeText(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    const aliases: Partial<Record<string, LeadPipelineStageKey>> = {
        lead_quente: 'leads_quentes',
        quente: 'leads_quentes',
        quentes: 'leads_quentes',
        proposta: 'proposta_negociacao',
        negociacao: 'proposta_negociacao',
        proposta_negociacao: 'proposta_negociacao',
        proposta_negocio: 'proposta_negociacao',
        contato_geral: 'contatos_gerais',
        contatos: 'contatos_gerais',
        geral: 'contatos_gerais',
        proprietario: 'proprietarios',
        captacao: 'proprietarios',
        perdido: 'perdidos',
        lost: 'perdidos',
        follow_up: 'fup',
        followup: 'fup',
    }

    if (LEAD_PIPELINE_STAGE_BY_KEY[key as LeadPipelineStageKey]) {
        return key as LeadPipelineStageKey
    }

    return aliases[key] || null
}

function getLeadScore(lead: PipelineLeadLike) {
    return Math.max(Number(lead.qualification_score || 0), Number(lead.lead_score || 0))
}

function getLatestActivityAt(lead: PipelineLeadLike) {
    const dates = [
        lead.updated_at,
        ...asArray(lead.conversation_messages).map(message => message?.timestamp || message?.created_at || message?.sent_at),
        ...asArray(lead.site_activity).map(activity => activity?.occurred_at || activity?.created_at),
        ...asArray(lead.whatsapp_clicks).map(click => click?.clicked_at || click?.created_at),
    ]
        .map(value => Date.parse(String(value || '')))
        .filter(Number.isFinite)

    return dates.length ? Math.max(...dates) : null
}

function hasPendingFollowup(lead: PipelineLeadLike) {
    const summary = asRecord(lead.behavior_summary)
    const recommendations = asRecord(lead.crm_action_recommendations)
    const actions = asRecord(lead.crm_action_recommendation_actions)

    const followups = [
        ...asArray(summary.search_alert_followups),
        ...asArray(summary.followups),
        ...asArray(recommendations.items),
    ]

    if (followups.some(item => {
        const status = normalizeText(item?.status || item?.action_status)
        return !status || status === 'pending' || status === 'sent'
    })) return true

    return Object.values(actions).some((item: any) => {
        const status = normalizeText(item?.status || item?.action_status)
        return status === 'pending' || status === 'sent'
    })
}

function hasAlertOrSavedProperty(lead: PipelineLeadLike) {
    const summary = asRecord(lead.behavior_summary)
    const activity = asArray(lead.site_activity)
    const text = normalizeText([
        summary.last_page_path,
        summary.next_best_action,
        summary.intent_temperature,
        summary.premium_intent_count,
        summary.favorite_property_count,
        summary.revisited_property_count,
        ...activity.map(item => `${item?.event_type || ''} ${item?.label || ''} ${item?.property_title || ''}`),
    ].join(' '))

    return Number(summary.premium_intent_count || 0) > 0
        || Number(summary.favorite_property_count || 0) > 0
        || Number(summary.revisited_property_count || 0) > 0
        || hasAny(text, ['alerta', 'favorite', 'favorito', 'revisit', 'match', 'imovel salvo', 'visualizou imovel'])
}

export function getLeadPipelineStage(lead: PipelineLeadLike): LeadPipelineStageKey {
    const status = normalizeText(lead.status)
    const conversationStatus = normalizeText(lead.conversation_status)
    const classification = normalizeText(lead.lead_classification)
    const score = getLeadScore(lead)
    const summary = asRecord(lead.behavior_summary)
    const explicitStage = normalizeLeadPipelineStageKey(lead.pipeline_stage || summary.pipeline_stage)
    const haystack = normalizeText([
        lead.interest,
        lead.notes,
        lead.ai_summary,
        lead.conversation_summary,
        lead.source,
        lead.landing_page_title,
        lead.property_type,
        lead.timeline,
        summary.intent_temperature,
        summary.next_best_action,
        ...asArray(summary.intent_signals),
        ...asArray(lead.conversation_messages).slice(-8).map(message => message?.content || message?.text || message?.body || ''),
        ...asArray(lead.site_activity).slice(0, 12).map(activity => `${activity?.event_type || ''} ${activity?.label || ''} ${activity?.detail || ''} ${activity?.property_title || ''}`),
    ].join(' '))

    if (status === 'lost' || hasAny(haystack, ['opt out', 'sem interesse', 'nao quero mais', 'parar contato', 'perdido'])) {
        return 'perdidos'
    }

    if (status === 'converted' || status === 'closed' || conversationStatus === 'closed') {
        return 'contrato'
    }

    if (explicitStage) {
        return explicitStage
    }

    if (hasAny(haystack, ['proprietario', 'captacao', 'vender meu imovel', 'avaliar meu imovel', 'anunciar imovel', 'imovel para vender', 'parte de pagamento', 'permuta'])) {
        return 'proprietarios'
    }

    if (hasAny(haystack, ['proposta', 'negociacao', 'negociar', 'entrada', 'financiamento', 'fechar', 'reserva', 'sinal', 'contraproposta', 'condicao de pagamento'])) {
        return 'proposta_negociacao'
    }

    if (hasAny(haystack, ['visita', 'visitar', 'agenda', 'agendar', 'horario', 'disponibilidade', 'visita privada', 'tour', 'conhecer o imovel'])) {
        return 'visitas'
    }

    if (score >= 70 || ['hot', 'vip'].includes(classification) || hasAny(haystack, ['quente', 'vip', 'alta intencao', 'pronto para abordagem'])) {
        return 'leads_quentes'
    }

    if (hasAny(haystack, ['investimento', 'investidor', 'investir', 'rentabilidade', 'valorizacao', 'patrimonio', 'renda', 'liquidez'])) {
        return 'investidores'
    }

    if (hasAlertOrSavedProperty(lead) || status === 'qualified' || score >= 40 || classification === 'warm') {
        return 'oportunidades'
    }

    if (hasPendingFollowup(lead) || status === 'qualifying') {
        return 'fup'
    }

    if (asArray(lead.conversation_messages).length > 0 || conversationStatus === 'active' || status === 'transferred') {
        return 'conectados'
    }

    const latest = getLatestActivityAt(lead)
    if (latest && Date.now() - latest > 30 * 24 * 60 * 60 * 1000) {
        return 'standby'
    }

    if (score > 0 || lead.interest || lead.source) {
        return 'contatos_gerais'
    }

    return 'entrada'
}

export function getLeadPipelineStageConfig(key: LeadPipelineStageKey) {
    return LEAD_PIPELINE_STAGE_BY_KEY[key] || LEAD_PIPELINE_STAGE_BY_KEY.entrada
}
