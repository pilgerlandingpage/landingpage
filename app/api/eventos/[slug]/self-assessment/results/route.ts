import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { resolveProfileAssessmentEventSlug } from '@/lib/events/profile-assessment'
import {
    SELF_ASSESSMENT_QUESTIONS,
    type SelfAssessmentBlockScore,
    type SelfAssessmentScoredAnswer,
} from '@/lib/events/self-assessment'

export const dynamic = 'force-dynamic'

type RouteContext = {
    params: Promise<{ slug: string }>
}

type AssessmentProfile = {
    score_percent?: number
    classification_key?: string
    classification_label?: string
    block_scores?: SelfAssessmentBlockScore[]
    answers?: SelfAssessmentScoredAnswer[]
    submitted_at?: string
}

type AssessmentProgress = {
    answered_question_ids?: string[]
    answers?: SelfAssessmentScoredAnswer[]
    updated_at?: string
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function numberOrNull(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function getAssessmentProfile(row: Record<string, any>): AssessmentProfile | null {
    const metadata = asRecord(row.metadata)
    const profile = asRecord(metadata.self_assessment_profile)
    const score = numberOrNull(profile.score_percent)

    if (score === null) return null

    return {
        score_percent: Math.max(0, Math.min(100, Math.round(score))),
        classification_key: String(profile.classification_key || ''),
        classification_label: String(profile.classification_label || 'Resultado registrado'),
        block_scores: Array.isArray(profile.block_scores) ? profile.block_scores as SelfAssessmentBlockScore[] : [],
        answers: Array.isArray(profile.answers) ? profile.answers as SelfAssessmentScoredAnswer[] : [],
        submitted_at: String(profile.submitted_at || row.updated_at || row.created_at || ''),
    }
}

function getAssessmentProgress(row: Record<string, any>): AssessmentProgress | null {
    const metadata = asRecord(row.metadata)
    const progress = asRecord(metadata.self_assessment_progress)
    const answeredIds = Array.isArray(progress.answered_question_ids)
        ? progress.answered_question_ids.map(String).filter(Boolean)
        : []
    const answers = Array.isArray(progress.answers) ? progress.answers as SelfAssessmentScoredAnswer[] : []

    if (!answeredIds.length && !answers.length) return null

    return {
        answered_question_ids: answeredIds,
        answers,
        updated_at: String(progress.updated_at || row.updated_at || row.created_at || ''),
    }
}

function average(values: number[]) {
    if (!values.length) return 0
    return Math.round(values.reduce((total, value) => total + value, 0) / values.length)
}

function shortName(value: unknown) {
    const name = String(value || '').trim().replace(/\s+/g, ' ')
    if (!name) return 'Corretor'
    const parts = name.split(' ').filter(Boolean)
    return parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0]
}

function buildQuestionAverages(profiles: AssessmentProfile[]) {
    return SELF_ASSESSMENT_QUESTIONS
        .map((question) => {
            const scores = profiles
                .map(profile => profile.answers?.find(answer => answer.question_id === question.id)?.score)
                .map(numberOrNull)
                .filter((score): score is number => score !== null)

            return {
                question_id: question.id,
                title: question.title,
                block: question.block,
                block_label: question.blockLabel,
                average_score: scores.length
                    ? Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 10) / 10
                    : 0,
                responses: scores.length,
            }
        })
        .filter(item => item.responses > 0)
}

function getCompletedQuestionIds(row: Record<string, any>, profile: AssessmentProfile | null) {
    const completedIds = new Set<string>()
    const progress = getAssessmentProgress(row)

    for (const answer of profile?.answers || []) {
        if (answer?.question_id) completedIds.add(answer.question_id)
    }

    for (const questionId of progress?.answered_question_ids || []) {
        if (questionId) completedIds.add(questionId)
    }

    for (const answer of progress?.answers || []) {
        if (answer?.question_id) completedIds.add(answer.question_id)
    }

    return completedIds
}

function buildQuestionProgress(rows: Record<string, any>[]) {
    const participantProgress = rows.map(row => getCompletedQuestionIds(row, getAssessmentProfile(row)))

    return SELF_ASSESSMENT_QUESTIONS.map((question, index) => ({
        question_id: question.id,
        title: question.title,
        block: question.block,
        block_label: question.blockLabel,
        step: index + 1,
        completed_count: participantProgress.filter(completedIds => completedIds.has(question.id)).length,
    }))
}

export async function GET(_request: Request, { params }: RouteContext) {
    try {
        const { slug } = await params
        const eventSlug = resolveProfileAssessmentEventSlug(slug)
        const supabase = createAdminClient()

        const { data: event, error: eventError } = await supabase
            .from('event_events')
            .select('id, title, slug, status')
            .eq('slug', eventSlug)
            .eq('status', 'published')
            .maybeSingle()

        if (eventError) throw eventError
        if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })

        const { data: registrations, error: registrationsError, count } = await supabase
            .from('event_registrations')
            .select('id, full_name, broker_type, real_estate_name, city, status, metadata, created_at, updated_at', { count: 'exact' })
            .eq('event_id', event.id)
            .neq('status', 'cancelled')
            .order('updated_at', { ascending: false })
            .range(0, 4999)

        if (registrationsError) throw registrationsError

        const rows = Array.isArray(registrations) ? registrations : []
        const submitted = rows
            .map(row => ({ row, profile: getAssessmentProfile(row) }))
            .filter((item): item is { row: Record<string, any>; profile: AssessmentProfile } => Boolean(item.profile))

        const profiles = submitted.map(item => item.profile)
        const scores = profiles.map(profile => Number(profile.score_percent || 0))
        const questionAverages = buildQuestionAverages(profiles)
        const questionProgress = buildQuestionProgress(rows)
        const strongestQuestions = [...questionAverages]
            .sort((a, b) => b.average_score - a.average_score || a.title.localeCompare(b.title))
            .slice(0, 3)
        const improvementQuestions = [...questionAverages]
            .sort((a, b) => a.average_score - b.average_score || a.title.localeCompare(b.title))
            .slice(0, 3)

        const blockKeys = new Map<string, { label: string; values: number[] }>()
        for (const profile of profiles) {
            for (const block of profile.block_scores || []) {
                const percentage = numberOrNull(block.percentage)
                if (percentage === null) continue
                const current = blockKeys.get(block.block) || { label: block.label, values: [] }
                current.values.push(percentage)
                blockKeys.set(block.block, current)
            }
        }

        const classificationMap = new Map<string, { label: string; count: number }>()
        for (const profile of profiles) {
            const key = profile.classification_key || profile.classification_label || 'resultado'
            const current = classificationMap.get(key) || { label: profile.classification_label || 'Resultado registrado', count: 0 }
            current.count += 1
            classificationMap.set(key, current)
        }

        const latestSubmittedAt = profiles
            .map(profile => profile.submitted_at)
            .filter(Boolean)
            .sort()
            .at(-1) || null

        return NextResponse.json({
            event: {
                id: event.id,
                title: event.title,
                slug: event.slug,
            },
            registrations_count: count || rows.length,
            submitted_count: submitted.length,
            average_score: average(scores),
            updated_at: latestSubmittedAt,
            question_progress: questionProgress,
            block_averages: Array.from(blockKeys.entries()).map(([block, item]) => ({
                block,
                label: item.label,
                average_percentage: average(item.values),
                responses: item.values.length,
            })),
            classification_counts: Array.from(classificationMap.entries()).map(([key, item]) => ({
                key,
                label: item.label,
                count: item.count,
            })).sort((a, b) => b.count - a.count),
            ranking: submitted
                .map(({ row, profile }) => ({
                    name: shortName(row.full_name),
                    city: String(row.city || '').trim() || null,
                    score_percent: profile.score_percent || 0,
                    classification_label: profile.classification_label || 'Resultado registrado',
                }))
                .sort((a, b) => b.score_percent - a.score_percent || a.name.localeCompare(b.name))
                .slice(0, 5),
            strongest_questions: strongestQuestions,
            improvement_questions: improvementQuestions,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao carregar resultado do evento.' }, { status: 500 })
    }
}
