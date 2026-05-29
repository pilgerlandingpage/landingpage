export type CandidateStatus = 'new' | 'in_review' | 'potential' | 'approved' | 'rejected' | 'contacted' | 'archived'
export type CandidatePotentialLevel = 'hot' | 'warm' | 'review' | 'cold'
export type CandidateTriggerType = 'immediate' | 'after_signup' | 'status_changed' | 'high_potential' | 'return_visit' | 'fixed_datetime' | 'manual'
export type CandidateSegment =
    | 'all'
    | 'high_potential'
    | 'medium_potential'
    | 'low_potential'
    | 'creci_informed'
    | 'creci_missing'
    | 'returning_visitors'
    | CandidateStatus

export const DEFAULT_CANDIDATE_WELCOME_TEMPLATE = [
    'Ola {nome}, recebemos seu cadastro para trabalhar com a Pilger.',
    '',
    'Nosso agente de recrutamento vai analisar seu perfil profissional e nossa equipe acompanha a proxima etapa pelo painel.',
    '',
    'Enquanto isso, continue acompanhando nosso ecossistema: {link_trabalhe_conosco}',
].join('\n')

const INTERACTION_TYPES = new Set(['none', 'buttons', 'poll', 'link_buttons', 'list', 'location_request'])

export function cleanString(value: unknown, max = 2000) {
    const text = String(value || '').trim()
    return text.length > max ? text.slice(0, max) : text
}

export function normalizePhone(value: unknown) {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.length === 10 || digits.length === 11) return `55${digits}`
    return digits
}

export function formatPhoneDisplay(value: unknown) {
    const phone = normalizePhone(value)
    const local = phone.startsWith('55') ? phone.slice(2) : phone
    if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
    if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
    return phone
}

export function safeArrayFromInput(value: unknown, maxItems = 12): string[] {
    const source = Array.isArray(value)
        ? value
        : String(value || '')
            .split(/[,;\n]/g)
            .map(item => item.trim())

    return source
        .map(item => cleanString(item, 80))
        .filter(Boolean)
        .slice(0, maxItems)
}

export function statusLabel(status: string) {
    const labels: Record<string, string> = {
        new: 'Novo',
        in_review: 'Em analise',
        potential: 'Potencial',
        approved: 'Aprovado',
        rejected: 'Recusado',
        contacted: 'Contatado',
        archived: 'Arquivado',
        pending: 'Pendente',
        sent: 'Enviado',
        failed: 'Falhou',
        skipped: 'Ignorado',
        cancelled: 'Cancelado',
    }
    return labels[status] || status
}

export function potentialLevel(score: number): CandidatePotentialLevel {
    if (score >= 80) return 'hot'
    if (score >= 60) return 'warm'
    if (score >= 40) return 'review'
    return 'cold'
}

export function potentialLabel(level: string) {
    const labels: Record<string, string> = {
        hot: 'Alto potencial',
        warm: 'Bom potencial',
        review: 'Analisar',
        cold: 'Baixo fit',
    }
    return labels[level] || level
}

export function triggerTypeLabel(type: string) {
    const labels: Record<string, string> = {
        immediate: 'Apos cadastro',
        after_signup: 'Depois do cadastro',
        status_changed: 'Mudanca de status',
        high_potential: 'Alto potencial',
        return_visit: 'Voltou ao ecossistema',
        fixed_datetime: 'Data fixa',
        manual: 'Manual',
    }
    return labels[type] || type
}

export function segmentLabel(segment: string) {
    const labels: Record<string, string> = {
        all: 'Todos',
        high_potential: 'Alto potencial',
        medium_potential: 'Medio potencial',
        low_potential: 'Baixo potencial',
        creci_informed: 'CRECI informado',
        creci_missing: 'CRECI pendente',
        returning_visitors: 'Visitantes recorrentes',
        new: 'Novos',
        in_review: 'Em analise',
        potential: 'Potencial',
        approved: 'Aprovados',
        rejected: 'Recusados',
        contacted: 'Contatados',
    }
    return labels[segment] || segment
}

export function calculateCandidatePotential(input: Record<string, any>) {
    let score = 0
    const socialLinks = input.social_links && typeof input.social_links === 'object' ? input.social_links : {}
    const answers = input.answers && typeof input.answers === 'object' ? input.answers : {}
    const marketFocus = safeArrayFromInput(input.market_focus, 8)
    const regions = safeArrayFromInput(input.regions, 10)
    const specialties = safeArrayFromInput(input.specialties, 10)
    const experienceYears = Number(input.experience_years || 0)

    if (cleanString(input.full_name)) score += 8
    if (normalizePhone(input.phone)) score += 10
    if (cleanString(input.email).includes('@')) score += 6
    if (cleanString(input.creci)) score += 16
    if (cleanString(input.creci_state).length === 2) score += 4
    if (cleanString(input.city)) score += 8
    if (experienceYears >= 1) score += Math.min(16, experienceYears * 2)
    if (marketFocus.length) score += 6
    if (regions.length) score += 6
    if (specialties.some(item => /luxo|alto|padrao|frente|invest/i.test(item))) score += 10
    if (marketFocus.some(item => /luxo|alto|padrao|lan[cç]amento|invest/i.test(item))) score += 10
    if (cleanString(input.current_company)) score += 4

    const socialCount = Object.values(socialLinks).filter(value => cleanString(value, 500)).length
    score += Math.min(18, socialCount * 4)
    if (cleanString(socialLinks.instagram)) score += 4
    if (cleanString(socialLinks.linkedin)) score += 3

    const motivation = cleanString(answers.motivation || input.motivation, 1200)
    if (motivation.length >= 80) score += 8
    if (/pilger|luxo|alto padrao|curadoria|inteligencia|tecnologia/i.test(motivation)) score += 8

    score = Math.max(0, Math.min(100, score))
    const level = potentialLevel(score)

    return {
        score,
        level,
        label: potentialLabel(level),
        summary: `${potentialLabel(level)} (${score} pts): ${cleanString(input.city) || 'cidade nao informada'}; ${experienceYears || 0} anos; ${socialCount} redes informadas.`,
    }
}

function metadataRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function cleanId(value: unknown, fallback: string) {
    const id = String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64)
    return id || fallback
}

function cleanUrl(value: unknown) {
    const url = cleanString(value, 900)
    if (!url) return ''
    try {
        const parsed = new URL(url)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : ''
    } catch {
        return ''
    }
}

export function sanitizeCandidateAutomationMetadata(input: unknown) {
    const source = metadataRecord(input)
    const interactionType = INTERACTION_TYPES.has(String(source.interaction_type))
        ? String(source.interaction_type)
        : 'none'

    const buttons = Array.isArray(source.buttons)
        ? source.buttons
            .map((button: any, index: number) => {
                const label = cleanString(button?.label, 42)
                if (!label) return null
                const action = cleanId(button?.action || button?.id || button?.value, `candidate_button_${index + 1}`)
                return {
                    id: cleanId(button?.id || action, action),
                    label,
                    action,
                    value: cleanString(button?.value || action, 120),
                    url: cleanUrl(button?.url),
                }
            })
            .filter(Boolean)
            .slice(0, interactionType === 'list' ? 10 : 3)
        : []

    const pollOptions = Array.isArray(source.poll?.options)
        ? source.poll.options
            .map((option: unknown) => cleanString(option, 48))
            .filter(Boolean)
            .slice(0, 8)
        : []

    return {
        source: cleanString(source.source, 80) || 'broker-candidate-office',
        interaction_type: interactionType,
        tracking_enabled: source.tracking_enabled !== false,
        tracking_tag: cleanId(source.tracking_tag, 'broker_candidate_interaction'),
        buttons,
        poll: {
            question: cleanString(source.poll?.question, 140),
            options: pollOptions,
            multi_select: source.poll?.multi_select === true,
        },
    }
}

export function appendCandidateInteractionLinks(content: string, metadata: Record<string, any>) {
    const buttons = Array.isArray(metadata.buttons) ? metadata.buttons : []
    const links = buttons
        .map((button: any) => ({
            label: cleanString(button?.label, 42),
            url: cleanUrl(button?.url),
        }))
        .filter(button => button.label && button.url)

    if (!links.length) return content
    return [
        content.trim(),
        '',
        ...links.map(button => `${button.label}: ${button.url}`),
    ].join('\n')
}

export function computeCandidateRuleSchedule(rule: any, candidate: any, baseDate = new Date()) {
    const now = baseDate.getTime()

    if (rule.trigger_type === 'fixed_datetime') {
        const fixed = new Date(String(rule.fixed_datetime || '')).getTime()
        return new Date(Number.isFinite(fixed) ? Math.max(fixed, now) : now).toISOString()
    }

    const createdAt = new Date(String(candidate?.created_at || '')).getTime()
    const base = Number.isFinite(createdAt) ? createdAt : now
    const offset = Math.max(0, Number(rule.offset_minutes || 0)) * 60_000
    const target = ['after_signup', 'high_potential', 'return_visit', 'status_changed'].includes(String(rule.trigger_type))
        ? base + offset
        : now + offset

    return new Date(Math.max(target, now)).toISOString()
}

export function candidateMatchesSegment(candidate: any, segment: CandidateSegment | string) {
    if (!segment || segment === 'all') return true
    const score = Number(candidate?.potential_score || 0)
    if (segment === 'high_potential') return score >= 80 || candidate?.potential_level === 'hot'
    if (segment === 'medium_potential') return score >= 60 && score < 80
    if (segment === 'low_potential') return score < 60
    if (segment === 'creci_informed') return Boolean(cleanString(candidate?.creci))
    if (segment === 'creci_missing') return !cleanString(candidate?.creci)
    if (segment === 'returning_visitors') return Number(candidate?.metadata?.activity?.events || 0) > 1
    return candidate?.status === segment
}

export function interpolateCandidateTemplate(template: string, params: { candidate: any; publicUrl?: string }) {
    const { candidate, publicUrl } = params
    const social = metadataRecord(candidate?.social_links)
    const metadata = metadataRecord(candidate?.metadata)
    const activity = metadataRecord(metadata.activity)

    const replacements: Record<string, string> = {
        nome: candidate?.full_name || '',
        name: candidate?.full_name || '',
        email: candidate?.email || '',
        telefone: formatPhoneDisplay(candidate?.phone),
        phone: formatPhoneDisplay(candidate?.phone),
        creci: candidate?.creci || '',
        cidade: candidate?.city || '',
        estado: candidate?.state || candidate?.creci_state || '',
        imobiliaria: candidate?.current_company || '',
        empresa_atual: candidate?.current_company || '',
        score_potencial: String(candidate?.potential_score ?? ''),
        nivel_potencial: potentialLabel(candidate?.potential_level || ''),
        status: statusLabel(candidate?.status || ''),
        origem: candidate?.source || candidate?.utm_source || '',
        instagram: social.instagram || '',
        linkedin: social.linkedin || '',
        tiktok: social.tiktok || '',
        youtube: social.youtube || '',
        facebook: social.facebook || '',
        site: social.website || social.site || '',
        ultima_visita: activity.last_event_at || candidate?.last_activity_at || '',
        resumo_agente: candidate?.ai_summary || '',
        recomendacao_agente: candidate?.ai_recommendation || '',
        link_trabalhe_conosco: publicUrl || '',
        link_agendamento: metadata.schedule_url || publicUrl || '',
    }

    return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => replacements[key] ?? '')
}
