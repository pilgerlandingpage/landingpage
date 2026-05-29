import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPublicAppUrl } from '@/lib/app-url'
import { inngest } from '@/lib/inngest/client'
import { extractTrackingData, generateVisitorId } from '@/lib/tracking'
import { enqueueCandidateMessages, logCandidateAgent, sendQueuedCandidateMessage } from '@/lib/broker-candidates/messages'
import {
    calculateCandidatePotential,
    cleanString,
    normalizePhone,
    safeArrayFromInput,
} from '@/lib/broker-candidates/utils'

export const dynamic = 'force-dynamic'

const VISITOR_COOKIE_NAME = 'pilger_visitor_id'

function metadataRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function socialLinksFromBody(body: any) {
    return {
        instagram: cleanString(body.instagram || body.social_links?.instagram, 500),
        linkedin: cleanString(body.linkedin || body.social_links?.linkedin, 500),
        tiktok: cleanString(body.tiktok || body.social_links?.tiktok, 500),
        youtube: cleanString(body.youtube || body.social_links?.youtube, 500),
        facebook: cleanString(body.facebook || body.social_links?.facebook, 500),
        website: cleanString(body.website || body.site || body.social_links?.website || body.social_links?.site, 500),
    }
}

function parseCandidateBody(body: any, trackingData: ReturnType<typeof extractTrackingData>, visitorId: string | null) {
    const fullName = cleanString(body.full_name || body.name, 180)
    const email = cleanString(body.email, 180)
    const phone = normalizePhone(body.phone)
    const creci = cleanString(body.creci, 80)
    const creciState = cleanString(body.creci_state || body.state, 2).toUpperCase()
    const city = cleanString(body.city, 120)
    const state = cleanString(body.state || creciState, 2).toUpperCase()
    const brokerType = ['autonomo', 'imobiliaria', 'equipe'].includes(String(body.broker_type))
        ? String(body.broker_type)
        : 'autonomo'
    const experienceYears = Math.max(0, Math.min(60, Math.floor(Number(body.experience_years || 0))))
    const socialLinks = socialLinksFromBody(body)
    const answers = {
        motivation: cleanString(body.motivation, 1500),
        availability: cleanString(body.availability, 300),
        current_operation: cleanString(body.current_operation, 600),
        why_pilger: cleanString(body.why_pilger, 1200),
    }
    const marketFocus = safeArrayFromInput(body.market_focus, 10)
    const regions = safeArrayFromInput(body.regions, 12)
    const specialties = safeArrayFromInput(body.specialties, 12)

    if (!fullName) throw new Error('Informe seu nome completo.')
    if (!phone || phone.length < 12) throw new Error('Informe um WhatsApp valido.')
    if (!email || !email.includes('@')) throw new Error('Informe um e-mail valido.')
    if (!city) throw new Error('Informe sua cidade de atuacao.')
    if (body.consent_whatsapp !== true) throw new Error('Autorize o contato pelo WhatsApp para continuar.')
    if (body.consent_data_processing !== true) throw new Error('Autorize a analise dos dados informados para continuar.')

    const potential = calculateCandidatePotential({
        full_name: fullName,
        email,
        phone,
        creci,
        creci_state: creciState,
        city,
        state,
        current_company: cleanString(body.current_company, 180),
        experience_years: experienceYears,
        market_focus: marketFocus,
        regions,
        specialties,
        social_links: socialLinks,
        answers,
    })

    return {
        visitor_id: visitorId,
        full_name: fullName,
        email,
        phone,
        phone_normalized: phone,
        broker_type: brokerType,
        creci: creci || null,
        creci_state: creciState || null,
        city,
        state: state || null,
        current_company: cleanString(body.current_company, 180) || null,
        experience_years: experienceYears || null,
        market_focus: marketFocus,
        regions,
        specialties,
        social_links: socialLinks,
        answers,
        source: cleanString(body.source, 120) || trackingData.detected_source || 'trabalhe_conosco',
        utm_source: trackingData.utm_source || null,
        utm_medium: trackingData.utm_medium || null,
        utm_campaign: trackingData.utm_campaign || null,
        utm_content: trackingData.utm_content || null,
        potential_score: potential.score,
        potential_level: potential.level,
        ai_summary: potential.summary,
        ai_recommendation: potential.level === 'hot'
            ? 'Priorizar contato humano. Perfil com bom potencial para conversa comercial.'
            : potential.level === 'warm'
                ? 'Manter em nutricao e validar fit com a operacao Pilger.'
                : 'Acompanhar comportamento no ecossistema antes de avancar.',
        consent_whatsapp: true,
        consent_data_processing: true,
        last_activity_at: new Date().toISOString(),
        metadata: {
            tracking: {
                detected_source: trackingData.detected_source,
                utm_source: trackingData.utm_source || null,
                utm_medium: trackingData.utm_medium || null,
                utm_campaign: trackingData.utm_campaign || null,
                utm_content: trackingData.utm_content || null,
                referrer: trackingData.referrer || null,
                device_type: trackingData.device_type || null,
                browser: trackingData.browser || null,
                os: trackingData.os || null,
                country: trackingData.country || null,
                city: trackingData.city || null,
                region: trackingData.region || null,
            },
            potential,
            activity: {
                events: 1,
                last_event_type: 'broker_candidate_form_submitted',
                last_event_at: new Date().toISOString(),
            },
        },
    }
}

async function upsertVisitor(request: NextRequest, body: any, supabase: any) {
    const searchParams = new URLSearchParams(body.search_params || '')
    const cookieId = cleanString(body.visitor_cookie_id, 100)
        || request.cookies.get(VISITOR_COOKIE_NAME)?.value
        || generateVisitorId()
    const trackingData = extractTrackingData(request.headers, searchParams, cleanString(body.referrer, 1200) || undefined)
    trackingData.visitor_cookie_id = cookieId

    const { data: existing } = await supabase
        .from('visitors')
        .select('id, page_views, country, city, region')
        .eq('visitor_cookie_id', cookieId)
        .maybeSingle()

    if (existing?.id) {
        await supabase
            .from('visitors')
            .update({
                last_visit_at: new Date().toISOString(),
                page_views: (existing.page_views || 1) + 1,
                country: trackingData.country || existing.country,
                city: trackingData.city || existing.city,
                region: trackingData.region || existing.region,
                utm_source: trackingData.utm_source || undefined,
                utm_medium: trackingData.utm_medium || undefined,
                utm_campaign: trackingData.utm_campaign || undefined,
                utm_content: trackingData.utm_content || undefined,
                referrer: trackingData.referrer || undefined,
                detected_source: trackingData.detected_source || undefined,
                user_agent: trackingData.user_agent || undefined,
                device_type: trackingData.device_type || undefined,
                browser: trackingData.browser || undefined,
                os: trackingData.os || undefined,
            })
            .eq('id', existing.id)
        return { visitorId: existing.id as string, cookieId, trackingData }
    }

    const { data: visitor, error } = await supabase
        .from('visitors')
        .upsert(trackingData, { onConflict: 'visitor_cookie_id' })
        .select('id')
        .single()

    if (error) throw error
    return { visitorId: visitor.id as string, cookieId, trackingData }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const supabase = createAdminClient()
        const { visitorId, cookieId, trackingData } = await upsertVisitor(request, body, supabase)
        const payload = parseCandidateBody(body, trackingData, visitorId)

        const { data: existingCandidate, error: lookupError } = await supabase
            .from('broker_candidates')
            .select('*')
            .eq('phone_normalized', payload.phone_normalized)
            .maybeSingle()

        if (lookupError) throw lookupError

        let candidate: any
        if (existingCandidate?.id) {
            const previousMetadata = metadataRecord(existingCandidate.metadata)
            const nextMetadata = {
                ...previousMetadata,
                ...payload.metadata,
                activity: {
                    ...metadataRecord(previousMetadata.activity),
                    ...metadataRecord(payload.metadata.activity),
                    events: Number(metadataRecord(previousMetadata.activity).events || 0) + 1,
                },
            }
            const { data, error } = await supabase
                .from('broker_candidates')
                .update({
                    ...payload,
                    status: existingCandidate.status,
                    metadata: nextMetadata,
                })
                .eq('id', existingCandidate.id)
                .select('*')
                .single()
            if (error) throw error
            candidate = data
        } else {
            const { data, error } = await supabase
                .from('broker_candidates')
                .insert(payload)
                .select('*')
                .single()
            if (error) throw error
            candidate = data
        }

        await supabase.from('funnel_events').insert({
            visitor_id: visitorId,
            event_type: 'broker_candidate_form_submitted',
            metadata: {
                candidate_id: candidate.id,
                potential_score: candidate.potential_score,
                potential_level: candidate.potential_level,
                source: candidate.source,
            },
        })

        await logCandidateAgent(supabase, {
            candidate_id: candidate.id,
            action: existingCandidate?.id ? 'candidate_updated' : 'candidate_created',
            message: `${existingCandidate?.id ? 'Cadastro atualizado' : 'Novo candidato'}: ${candidate.full_name}.`,
            metadata: {
                potential_score: candidate.potential_score,
                potential_level: candidate.potential_level,
                source: candidate.source,
            },
        })

        try {
            const { data: rules, error: rulesError } = await supabase
                .from('broker_candidate_automation_rules')
                .select('*')
                .eq('is_active', true)

            if (rulesError) throw rulesError

            const createdQueued = await enqueueCandidateMessages(supabase, {
                candidate,
                rules: rules || [],
                publicUrl: `${getPublicAppUrl(request.headers.get('origin'))}/trabalhe-conosco`,
                triggerType: 'created',
            })
            const highPotentialQueued = Number(candidate.potential_score || 0) >= 80
                ? await enqueueCandidateMessages(supabase, {
                    candidate,
                    rules: rules || [],
                    publicUrl: `${getPublicAppUrl(request.headers.get('origin'))}/trabalhe-conosco`,
                    triggerType: 'high_potential',
                })
                : []
            const queued = [...createdQueued, ...highPotentialQueued]
            const dueNow = queued.filter((row: any) => new Date(row.scheduled_for).getTime() <= Date.now() + 30_000)
            const results = []
            for (const row of dueNow) {
                results.push(await sendQueuedCandidateMessage(supabase, row.id))
            }

            await logCandidateAgent(supabase, {
                candidate_id: candidate.id,
                action: 'candidate_queue_processed_inline',
                message: 'Cadastro criou a fila de automacoes do Trabalhe Conosco.',
                metadata: { queued: queued.length, processed: results.length, results },
            })
        } catch (queueError) {
            await logCandidateAgent(supabase, {
                candidate_id: candidate.id,
                level: 'warning',
                action: 'candidate_inline_queue_failed',
                message: queueError instanceof Error ? queueError.message : String(queueError),
            })
        }

        await inngest.send({
            name: 'broker-candidate/created',
            data: {
                candidate_id: candidate.id,
                reason: existingCandidate?.id ? 'candidate_updated' : 'new_candidate',
            },
        }).catch(async err => {
            await logCandidateAgent(supabase, {
                candidate_id: candidate.id,
                level: 'warning',
                action: 'inngest_trigger_failed',
                message: err instanceof Error ? err.message : String(err),
            })
        })

        const response = NextResponse.json({
            success: true,
            already_registered: Boolean(existingCandidate?.id),
            candidate: {
                id: candidate.id,
                full_name: candidate.full_name,
                potential_score: candidate.potential_score,
                potential_level: candidate.potential_level,
                status: candidate.status,
            },
        }, { status: existingCandidate?.id ? 200 : 201 })

        response.cookies.set(VISITOR_COOKIE_NAME, cookieId, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
            sameSite: 'lax',
        })
        return response
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao enviar cadastro.' }, { status: 400 })
    }
}
