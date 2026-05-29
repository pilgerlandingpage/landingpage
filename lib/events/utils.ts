export type EventStatus = 'draft' | 'published' | 'archived'
export type EventFormat = 'presencial' | 'online' | 'hibrido'
export type RegistrationStatus = 'confirmed' | 'cancelled' | 'checked_in' | 'waitlisted'
export type BrokerType = 'autonomo' | 'imobiliaria'
export type CreciStatus = 'pending' | 'manually_verified' | 'rejected'
export type AutomationTriggerType = 'immediate' | 'before_event' | 'at_event_time' | 'after_event' | 'fixed_datetime'
export type AutomationSegment = 'all' | 'autonomos' | 'imobiliarias' | 'creci_pending' | 'creci_verified'

export const DEFAULT_EVENT_HERO = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/portobelo.png'
export const DEFAULT_EVENT_PROFILE = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png'

export const DEFAULT_CONFIRMATION_TEMPLATE = [
    'Ola {nome}, sua presenca no encontro "{evento}" esta confirmada.',
    '',
    'Data: {data_evento}',
    'Local: {local_evento}',
    '',
    'Vamos apresentar uma novidade estrategica para corretores que querem operar com mais inteligencia no mercado imobiliario.',
    '',
    'Equipe Guilherme Pilger',
].join('\n')

export const DEFAULT_REMINDER_TEMPLATE = [
    'Ola {nome}, passando para lembrar do nosso encontro "{evento}".',
    '',
    'Comeca em {data_evento}.',
    'Local: {local_evento}',
    '',
    'Estamos te esperando.',
].join('\n')

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

export function normalizeEventSlug(value: unknown) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 90)
}

export function buildEventSlug(title: string, date?: string) {
    const base = normalizeEventSlug(title)
    if (!date) return base
    const suffix = new Date(date)
    if (Number.isNaN(suffix.getTime())) return base
    return normalizeEventSlug(`${base}-${suffix.getFullYear()}-${suffix.getMonth() + 1}-${suffix.getDate()}`)
}

export function formatEventDate(value: unknown, options: Intl.DateTimeFormatOptions = {}) {
    const date = new Date(String(value || ''))
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    })
}

export function formatEventTime(value: unknown) {
    const date = new Date(String(value || ''))
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function formatShortDate(value: unknown) {
    const date = new Date(String(value || ''))
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function statusLabel(status: string) {
    const labels: Record<string, string> = {
        draft: 'Rascunho',
        published: 'Publicado',
        archived: 'Arquivado',
        confirmed: 'Confirmado',
        cancelled: 'Cancelado',
        checked_in: 'Check-in',
        waitlisted: 'Lista de espera',
        pending: 'Pendente',
        manually_verified: 'Verificado',
        rejected: 'Rejeitado',
        sent: 'Enviado',
        failed: 'Falhou',
        skipped: 'Ignorado',
    }
    return labels[status] || status
}

export function triggerTypeLabel(type: string) {
    const labels: Record<string, string> = {
        immediate: 'Apos cadastro',
        before_event: 'Antes do evento',
        at_event_time: 'Na hora do evento',
        after_event: 'Depois do evento',
        fixed_datetime: 'Data fixa',
    }
    return labels[type] || type
}

export function segmentLabel(segment: string) {
    const labels: Record<string, string> = {
        all: 'Todos',
        autonomos: 'Autonomos',
        imobiliarias: 'Imobiliarias',
        creci_pending: 'CRECI pendente',
        creci_verified: 'CRECI verificado',
    }
    return labels[segment] || segment
}

export function computeRuleSchedule(rule: any, event: any, baseDate = new Date()) {
    const now = baseDate.getTime()
    const eventDate = new Date(String(event?.event_date || '')).getTime()

    if (rule.trigger_type === 'fixed_datetime') {
        const fixed = new Date(String(rule.fixed_datetime || '')).getTime()
        return new Date(Number.isFinite(fixed) ? Math.max(fixed, now) : now).toISOString()
    }

    if (!Number.isFinite(eventDate)) return new Date(now).toISOString()

    const offset = Math.max(0, Number(rule.offset_minutes || 0)) * 60_000
    let target = now

    if (rule.trigger_type === 'before_event') target = eventDate - offset
    if (rule.trigger_type === 'at_event_time') target = eventDate
    if (rule.trigger_type === 'after_event') target = eventDate + offset
    if (rule.trigger_type === 'immediate') target = now

    return new Date(Math.max(target, now)).toISOString()
}

export function registrationMatchesSegment(registration: any, segment: AutomationSegment | string) {
    if (!segment || segment === 'all') return true
    if (segment === 'autonomos') return registration?.broker_type === 'autonomo'
    if (segment === 'imobiliarias') return registration?.broker_type === 'imobiliaria'
    if (segment === 'creci_pending') return registration?.creci_status === 'pending'
    if (segment === 'creci_verified') return registration?.creci_status === 'manually_verified'
    return true
}

function applyEventTrackingParams(tracked: URL, event: any, registration?: any) {
    tracked.searchParams.set('link_title', event?.title || 'Evento Guilherme Pilger')
    if (registration?.phone) tracked.searchParams.set('lead_phone', normalizePhone(registration.phone))
    if (event?.id) tracked.searchParams.set('event_id', String(event.id))
    if (registration?.id) tracked.searchParams.set('event_registration_id', String(registration.id))
    if (event?.slug) tracked.searchParams.set('event_slug', String(event.slug))
}

function buildTrackedEventUrl(params: {
    url?: string
    event: any
    registration?: any
    publicUrl?: string
    eventType: string
    linkType: string
    linkLabel: string
    utmContent: string
}) {
    const rawUrl = String(params.url || '').trim()
    if (!rawUrl) return ''

    try {
        const appUrl = params.publicUrl ? new URL(params.publicUrl).origin : 'https://guilhermepilger.ai'
        const target = new URL(rawUrl, appUrl)
        const tracked = new URL('/api/track', appUrl)
        tracked.searchParams.set('redirect', target.toString())
        tracked.searchParams.set('event_type', params.eventType)
        tracked.searchParams.set('link_type', params.linkType)
        tracked.searchParams.set('link_label', params.linkLabel)
        tracked.searchParams.set('utm_source', 'brevo')
        tracked.searchParams.set('utm_medium', 'email')
        tracked.searchParams.set('utm_campaign', 'lembrete_evento')
        tracked.searchParams.set('utm_content', params.utmContent)
        applyEventTrackingParams(tracked, params.event, params.registration)
        return tracked.toString()
    } catch {
        return rawUrl
    }
}

function buildEventWhatsAppUrl(event: any, publicUrl?: string, registration?: any) {
    const appUrl = publicUrl ? new URL(publicUrl).origin : 'https://guilhermepilger.ai'
    const whatsapp = new URL('https://wa.me/5547992528080')
    whatsapp.searchParams.set('text', `Ola! Tenho uma duvida sobre o evento ${event?.title || ''}.`)

    const tracked = new URL('/api/track', appUrl)
    tracked.searchParams.set('redirect', whatsapp.toString())
    tracked.searchParams.set('event_type', 'whatsapp_evento_email_click')
    tracked.searchParams.set('link_type', 'whatsapp')
    tracked.searchParams.set('link_label', 'Tirar duvida no WhatsApp')
    tracked.searchParams.set('utm_source', 'brevo')
    tracked.searchParams.set('utm_medium', 'email')
    tracked.searchParams.set('utm_campaign', 'lembrete_evento')
    tracked.searchParams.set('utm_content', 'botao_duvida_whatsapp')
    applyEventTrackingParams(tracked, event, registration)
    return tracked.toString()
}

export function interpolateEventTemplate(template: string, params: { event: any; registration: any; publicUrl?: string }) {
    const { event, registration, publicUrl } = params
    const intent = registration?.metadata?.top3_intent && typeof registration.metadata.top3_intent === 'object'
        ? registration.metadata.top3_intent
        : {}
    const answers = intent.answers && typeof intent.answers === 'object' ? intent.answers : {}
    const score = intent.score !== undefined && intent.score !== null ? String(intent.score) : ''
    const level = String(intent.level_label || intent.level || '')
    const challenge = String(answers.main_challenge_label || answers.desired_result_label || '')
    const timeline = String(answers.improvement_timeline_label || '')
    const investment = String(answers.monthly_investment_label || '')
    const brokerType = registration?.broker_type === 'imobiliaria' ? 'Imobiliaria' : 'Autonomo'

    const replacements: Record<string, string> = {
        nome: registration?.full_name || '',
        name: registration?.full_name || '',
        email: registration?.email || '',
        telefone: formatPhoneDisplay(registration?.phone),
        phone: formatPhoneDisplay(registration?.phone),
        evento: event?.title || '',
        event: event?.title || '',
        data_evento: formatEventDate(event?.event_date),
        hora_evento: formatEventTime(event?.event_date),
        local_evento: event?.location_name || event?.location_address || 'Local a confirmar',
        endereco_evento: event?.location_address || '',
        creci: registration?.creci || '',
        cidade: registration?.city || '',
        imobiliaria: registration?.real_estate_name || '',
        tipo_inscrito: brokerType,
        status_inscricao: statusLabel(registration?.status || ''),
        link_evento: buildTrackedEventUrl({
            url: publicUrl,
            event,
            registration,
            publicUrl,
            eventType: 'email_event_click',
            linkType: 'event',
            linkLabel: 'Ver evento',
            utmContent: 'link_evento',
        }),
        link_whatsapp_evento: buildEventWhatsAppUrl(event, publicUrl, registration),
        whatsapp_evento_url: buildEventWhatsAppUrl(event, publicUrl, registration),
        link_mapa: buildTrackedEventUrl({
            url: event?.maps_url,
            event,
            registration,
            publicUrl,
            eventType: 'email_event_map_click',
            linkType: 'location',
            linkLabel: 'Abrir mapa',
            utmContent: 'link_mapa',
        }),
        checkin_code: registration?.checkin_code || '',
        score_intencao: score,
        nivel_intencao: level,
        principal_interesse: challenge,
        prazo_interesse: timeline,
        score_top3: score,
        nivel_top3: level,
        principal_desafio: challenge,
        prazo_melhoria: timeline,
        investimento_mensal: investment,
    }

    return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => replacements[key] ?? '')
}
