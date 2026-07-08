import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncLeadEmailFromEventRegistration } from '@/lib/events/lead-email-sync'
import { resolveProfileAssessmentEventSlug } from '@/lib/events/profile-assessment'
import { cleanString, normalizePhone } from '@/lib/events/utils'
import {
    SELF_ASSESSMENT_QUESTIONS,
    calculateSelfAssessmentSummary,
    clampAssessmentScore,
    type SelfAssessmentAnswer,
} from '@/lib/events/self-assessment'

export const dynamic = 'force-dynamic'

type RouteContext = {
    params: Promise<{ slug: string }>
}
function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function parseAnswers(value: unknown): SelfAssessmentAnswer[] {
    const rows = Array.isArray(value) ? value : []
    const allowedIds = new Set(SELF_ASSESSMENT_QUESTIONS.map(question => question.id))
    const answers: SelfAssessmentAnswer[] = []

    for (const row of rows) {
        const item = asRecord(row)
        const questionId = cleanString(item.question_id, 120)
        const score = clampAssessmentScore(item.score)
        if (!allowedIds.has(questionId) || score === null) continue
        answers.push({ question_id: questionId, score })
    }

    return answers
}

function parsePayload(body: any, request: NextRequest) {
    const fullName = cleanString(body.full_name || body.name, 180)
    const email = cleanString(body.email, 180).toLowerCase()
    const phone = normalizePhone(body.phone)
    const brokerType = body.broker_type === 'imobiliaria' ? 'imobiliaria' : 'autonomo'
    const answers = parseAnswers(body.answers)
    const answeredIds = new Set(answers.map(answer => answer.question_id))
    const missingQuestions = SELF_ASSESSMENT_QUESTIONS
        .filter(question => !answeredIds.has(question.id))
        .map(question => question.id)

    if (!fullName) throw new Error('Informe seu nome completo.')
    if (!phone || phone.length < 12) throw new Error('Informe um WhatsApp valido.')
    if (!email || !email.includes('@')) throw new Error('Informe um e-mail valido.')
    if (missingQuestions.length > 0) throw new Error('Responda todas as perguntas da autoavaliacao.')

    const tracking = asRecord(body.tracking)
    const searchParams = request.nextUrl.searchParams

    return {
        registration: {
            full_name: fullName,
            email,
            phone,
            broker_type: brokerType,
            real_estate_name: brokerType === 'imobiliaria' ? cleanString(body.real_estate_name, 180) || null : null,
            creci: cleanString(body.creci, 80) || null,
            creci_state: cleanString(body.creci_state, 2).toUpperCase() || null,
            city: cleanString(body.city, 120) || null,
            market_focus: cleanString(body.market_focus, 160) || null,
            monthly_leads: cleanString(body.monthly_leads, 80) || null,
            consent_whatsapp: body.consent_whatsapp !== false,
            source: 'event_self_assessment',
        },
        answers,
        tracking: {
            utm_source: cleanString(tracking.utm_source || searchParams.get('utm_source'), 120) || null,
            utm_medium: cleanString(tracking.utm_medium || searchParams.get('utm_medium'), 120) || null,
            utm_campaign: cleanString(tracking.utm_campaign || searchParams.get('utm_campaign'), 160) || null,
            utm_content: cleanString(tracking.utm_content || searchParams.get('utm_content'), 160) || null,
            utm_term: cleanString(tracking.utm_term || searchParams.get('utm_term'), 160) || null,
            referrer: cleanString(tracking.referrer, 1000) || request.headers.get('referer') || null,
            page_url: cleanString(tracking.page_url, 1000) || null,
            user_agent: cleanString(request.headers.get('user-agent'), 600) || null,
        },
    }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
    try {
        const { slug } = await params
        const eventSlug = resolveProfileAssessmentEventSlug(slug)
        const body = await request.json()
        const payload = parsePayload(body, request)
        const supabase = createAdminClient()
        const now = new Date().toISOString()

        const { data: event, error: eventError } = await supabase
            .from('event_events')
            .select('*')
            .eq('slug', eventSlug)
            .eq('status', 'published')
            .maybeSingle()

        if (eventError) throw eventError
        if (!event) return NextResponse.json({ error: 'Evento nao encontrado ou indisponivel.' }, { status: 404 })

        const summary = calculateSelfAssessmentSummary(payload.answers)

        const { data: existing, error: existingError } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('event_id', event.id)
            .eq('phone', payload.registration.phone)
            .maybeSingle()

        if (existingError) throw existingError

        const existingMetadata = asRecord(existing?.metadata)
        const selfAssessmentProfile = {
            ...summary,
            submitted_at: now,
            source: 'perfil_corretor_ideal_ao_vivo',
            event_id: event.id,
            event_slug: event.slug,
            event_title: event.title,
            tracking: payload.tracking,
        }

        const registrationPayload = {
            ...payload.registration,
            event_id: event.id,
            status: existing?.status || 'confirmed',
            metadata: {
                ...existingMetadata,
                self_assessment_profile: selfAssessmentProfile,
                event_lead_profile: {
                    source: 'self_assessment',
                    score_percent: summary.score_percent,
                    classification_key: summary.classification_key,
                    classification_label: summary.classification_label,
                    updated_at: now,
                },
            },
            updated_at: now,
        }

        const mutation = existing
            ? supabase
                .from('event_registrations')
                .update(registrationPayload)
                .eq('id', existing.id)
                .select('*')
                .single()
            : supabase
                .from('event_registrations')
                .insert({
                    ...registrationPayload,
                    confirmed_at: now,
                })
                .select('*')
                .single()

        const { data: registration, error: registrationError } = await mutation
        if (registrationError) throw registrationError

        await syncLeadEmailFromEventRegistration(supabase, registration).catch((err) => {
            console.warn('[Event Self Assessment] lead email sync failed:', err)
        })

        await supabase.from('event_agent_logs').insert({
            event_id: event.id,
            registration_id: registration.id,
            action: 'self_assessment_submitted',
            message: `Autoavaliacao recebida: ${registration.full_name} - ${summary.score_percent}/100.`,
            metadata: {
                score_percent: summary.score_percent,
                classification_key: summary.classification_key,
                classification_label: summary.classification_label,
                strengths: summary.strengths.map(item => item.title),
                improvements: summary.improvements.map(item => item.title),
                source: 'perfil_corretor_ideal_ao_vivo',
            },
        })

        return NextResponse.json({
            success: true,
            registration_id: registration.id,
            already_registered: Boolean(existing),
            summary,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao salvar autoavaliacao.' }, { status: 400 })
    }
}
