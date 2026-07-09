import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncLeadEmailFromEventRegistration } from '@/lib/events/lead-email-sync'
import { resolveProfileAssessmentEventSlug } from '@/lib/events/profile-assessment'
import { cleanString, normalizePhone } from '@/lib/events/utils'
import {
    SELF_ASSESSMENT_QUESTIONS,
    SELF_ASSESSMENT_VERSION,
    clampAssessmentScore,
    type SelfAssessmentAnswer,
    type SelfAssessmentScoredAnswer,
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
    const answerMap = new Map<string, number>()

    for (const row of rows) {
        const item = asRecord(row)
        const questionId = cleanString(item.question_id, 120)
        const score = clampAssessmentScore(item.score)
        if (!allowedIds.has(questionId) || score === null) continue
        answerMap.set(questionId, score)
    }

    return SELF_ASSESSMENT_QUESTIONS
        .filter(question => answerMap.has(question.id))
        .map(question => ({
            question_id: question.id,
            score: answerMap.get(question.id) || 0,
        }))
}

function scoreAnswers(answers: SelfAssessmentAnswer[]): SelfAssessmentScoredAnswer[] {
    const answerMap = new Map(answers.map(answer => [answer.question_id, answer.score]))

    return SELF_ASSESSMENT_QUESTIONS
        .filter(question => answerMap.has(question.id))
        .map(question => ({
            question_id: question.id,
            score: answerMap.get(question.id) || 0,
            title: question.title,
            block: question.block,
            block_label: question.blockLabel,
            criteria: question.criteria,
        }))
}

function mergeProgressAnswers(existingAnswers: unknown, incomingAnswers: SelfAssessmentAnswer[]) {
    const answerMap = new Map<string, number>()

    if (Array.isArray(existingAnswers)) {
        for (const row of existingAnswers) {
            const item = asRecord(row)
            const questionId = cleanString(item.question_id, 120)
            const score = clampAssessmentScore(item.score)
            if (score !== null) answerMap.set(questionId, score)
        }
    }

    for (const answer of incomingAnswers) {
        answerMap.set(answer.question_id, answer.score)
    }

    return SELF_ASSESSMENT_QUESTIONS
        .filter(question => answerMap.has(question.id))
        .map(question => ({
            question_id: question.id,
            score: answerMap.get(question.id) || 0,
        }))
}

function parsePayload(body: any, request: NextRequest) {
    const fullName = cleanString(body.full_name || body.name, 180)
    const email = cleanString(body.email, 180).toLowerCase()
    const phone = normalizePhone(body.phone)
    const brokerType = body.broker_type === 'imobiliaria' ? 'imobiliaria' : 'autonomo'
    const answers = parseAnswers(body.answers)
    const completedQuestionId = cleanString(body.completed_question_id, 120)
    const allowedIds = new Set(SELF_ASSESSMENT_QUESTIONS.map(question => question.id))

    if (!fullName) throw new Error('Informe seu nome completo.')
    if (!phone || phone.length < 12) throw new Error('Informe um WhatsApp valido.')
    if (!email || !email.includes('@')) throw new Error('Informe um e-mail valido.')
    if (completedQuestionId && !allowedIds.has(completedQuestionId)) throw new Error('Pergunta invalida para progresso.')

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
        completedQuestionId: completedQuestionId || null,
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

        const { data: existing, error: existingError } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('event_id', event.id)
            .eq('phone', payload.registration.phone)
            .maybeSingle()

        if (existingError) throw existingError

        const existingMetadata = asRecord(existing?.metadata)
        const existingProgress = asRecord(existingMetadata.self_assessment_progress)
        const progressAnswers = scoreAnswers(mergeProgressAnswers(existingProgress.answers, payload.answers))
        const lastAnsweredQuestionId = payload.completedQuestionId || progressAnswers.at(-1)?.question_id || null
        const selfAssessmentProgress = {
            ...existingProgress,
            version: SELF_ASSESSMENT_VERSION,
            source: 'perfil_corretor_ideal_ao_vivo',
            event_id: event.id,
            event_slug: event.slug,
            event_title: event.title,
            started_at: existingProgress.started_at || now,
            updated_at: now,
            answered_count: progressAnswers.length,
            answered_question_ids: progressAnswers.map(answer => answer.question_id),
            last_answered_question_id: lastAnsweredQuestionId,
            answers: progressAnswers,
            tracking: payload.tracking,
        }

        const registrationPayload = {
            ...payload.registration,
            event_id: event.id,
            status: existing?.status || 'confirmed',
            metadata: {
                ...existingMetadata,
                self_assessment_progress: selfAssessmentProgress,
                event_lead_profile: {
                    ...asRecord(existingMetadata.event_lead_profile),
                    source: 'self_assessment_progress',
                    progress_answered_count: progressAnswers.length,
                    progress_updated_at: now,
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

        if (!existing || existing.email !== payload.registration.email) {
            await syncLeadEmailFromEventRegistration(supabase, registration).catch((err) => {
                console.warn('[Event Self Assessment Progress] lead email sync failed:', err)
            })
        }

        return NextResponse.json({
            success: true,
            registration_id: registration.id,
            already_registered: Boolean(existing),
            progress: selfAssessmentProgress,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao salvar progresso da autoavaliacao.' }, { status: 400 })
    }
}
