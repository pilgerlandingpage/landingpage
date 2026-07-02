import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import { formatEventDate, formatPhoneDisplay, normalizeEventSlug, statusLabel } from '@/lib/events/utils'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 1000

const monthlyLeadLabels: Record<string, string> = {
    ate_20: 'Ate 20',
    '21_50': '21 a 50',
    '51_100': '51 a 100',
    '100_plus': 'Mais de 100',
    '20_100': '20 a 100',
    '100_300': '100 a 300',
    '300_plus': 'Mais de 300',
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function cleanFilePart(value: unknown) {
    const slug = normalizeEventSlug(String(value || 'evento'))
    return slug || 'evento'
}

function formatDateOnly(value: unknown) {
    const date = new Date(String(value || ''))
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().slice(0, 10)
}

function compact(value: unknown, fallback = '') {
    const text = String(value ?? '').trim()
    return text || fallback
}

function yesNo(value: unknown) {
    return value ? 'Sim' : 'Nao'
}

function stringifyJson(value: unknown) {
    if (!value || (typeof value === 'object' && Object.keys(asRecord(value)).length === 0)) return ''
    try {
        return JSON.stringify(value)
    } catch {
        return String(value || '')
    }
}

function csvCell(value: unknown) {
    let text = typeof value === 'object' && value !== null ? stringifyJson(value) : String(value ?? '')
    text = text.replace(/\r?\n/g, ' ').trim()
    if (/^[=+\-@]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
}

function getTop3Intent(registration: Record<string, any>) {
    const metadata = asRecord(registration.metadata)
    const intent = asRecord(metadata.top3_intent)
    const answers = asRecord(intent.answers)

    return {
        score: intent.score ?? '',
        level: compact(intent.level_label || intent.level),
        summary: compact(intent.summary),
        commercialRole: compact(answers.commercial_role_label || answers.commercial_role),
        mainChallenge: compact(answers.main_challenge_label || answers.main_challenge),
        currentTool: compact(answers.current_tool_label || answers.current_tool),
        timeline: compact(answers.improvement_timeline_label || answers.improvement_timeline),
        investment: compact(answers.monthly_investment_label || answers.monthly_investment),
        desiredResult: compact(answers.desired_result_label || answers.desired_result),
        automationWish: compact(answers.automation_wish),
    }
}

function buildCsv(event: Record<string, any>, registrations: Record<string, any>[]) {
    const headers = [
        'Evento',
        'Slug do evento',
        'Data do evento',
        'Local do evento',
        'ID cadastro',
        'Nome',
        'Email',
        'Telefone',
        'Telefone formatado',
        'Perfil',
        'Imobiliaria',
        'CRECI',
        'UF CRECI',
        'Status CRECI',
        'Cidade',
        'Foco de mercado',
        'Leads por mes',
        'Consentiu WhatsApp',
        'Status inscricao',
        'Origem',
        'Codigo check-in',
        'Confirmado em',
        'Check-in em',
        'Criado em',
        'Atualizado em',
        'Score intencao',
        'Nivel intencao',
        'Resumo intencao',
        'Papel comercial',
        'Principal desafio',
        'Ferramenta atual',
        'Prazo de melhoria',
        'Investimento mensal',
        'Resultado desejado',
        'Desejo de automacao',
        'Metadata JSON',
    ]

    const lines = [
        'sep=;',
        headers.map(csvCell).join(';'),
    ]

    registrations.forEach((registration) => {
        const intent = getTop3Intent(registration)
        const monthlyLeads = compact(registration.monthly_leads)
        const values = [
            event.title,
            event.slug,
            formatEventDate(event.event_date),
            event.location_name || event.location_address || 'Local a confirmar',
            registration.id,
            registration.full_name,
            registration.email,
            registration.phone,
            formatPhoneDisplay(registration.phone),
            registration.broker_type === 'imobiliaria' ? 'Imobiliaria' : 'Autonomo',
            registration.real_estate_name,
            registration.creci,
            registration.creci_state,
            statusLabel(registration.creci_status),
            registration.city,
            registration.market_focus,
            monthlyLeadLabels[monthlyLeads] || monthlyLeads,
            yesNo(registration.consent_whatsapp),
            statusLabel(registration.status),
            registration.source,
            registration.checkin_code,
            registration.confirmed_at ? formatEventDate(registration.confirmed_at) : '',
            registration.checked_in_at ? formatEventDate(registration.checked_in_at) : '',
            registration.created_at ? formatEventDate(registration.created_at) : '',
            registration.updated_at ? formatEventDate(registration.updated_at) : '',
            intent.score,
            intent.level,
            intent.summary,
            intent.commercialRole,
            intent.mainChallenge,
            intent.currentTool,
            intent.timeline,
            intent.investment,
            intent.desiredResult,
            intent.automationWish,
            registration.metadata,
        ]
        lines.push(values.map(csvCell).join(';'))
    })

    return `\uFEFF${lines.join('\r\n')}\r\n`
}

async function findLatestEvent(admin: any) {
    const now = new Date().toISOString()
    const latestHeld = await admin
        .from('event_events')
        .select('*')
        .neq('status', 'archived')
        .lte('event_date', now)
        .order('event_date', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (latestHeld.error) throw latestHeld.error
    if (latestHeld.data) return latestHeld.data

    const latestAny = await admin
        .from('event_events')
        .select('*')
        .neq('status', 'archived')
        .order('event_date', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (latestAny.error) throw latestAny.error
    return latestAny.data
}

async function findEvent(admin: any, eventId: string | null) {
    if (!eventId) return findLatestEvent(admin)

    const { data, error } = await admin
        .from('event_events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle()

    if (error) throw error
    return data
}

async function fetchAllRegistrations(admin: any, eventId: string) {
    const rows: Record<string, any>[] = []
    let from = 0

    while (true) {
        const { data, error } = await admin
            .from('event_registrations')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })
            .range(from, from + PAGE_SIZE - 1)

        if (error) throw error
        const page = data || []
        rows.push(...page)
        if (page.length < PAGE_SIZE) break
        from += PAGE_SIZE
    }

    return rows
}

export async function GET(request: NextRequest) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const eventId = request.nextUrl.searchParams.get('eventId')
        const event = await findEvent(ctx.admin, eventId)
        if (!event) return NextResponse.json({ error: 'Evento nao encontrado.' }, { status: 404 })

        const registrations = await fetchAllRegistrations(ctx.admin, event.id)
        const csv = buildCsv(event, registrations)
        const filename = `contatos-${cleanFilePart(event.slug || event.title)}-${formatDateOnly(event.event_date)}.csv`

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao exportar contatos do evento.' }, { status: 500 })
    }
}
