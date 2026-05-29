import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractTrackingData, generateVisitorId } from '@/lib/tracking'
import { leadIntentColumnsFromMetadata, mergeLeadSiteActivity, type LeadActivityEventRow } from '@/lib/tracking/lead-activity'
import { phoneCandidates } from '@/lib/whatsapp/lead-sync'
import { inngest } from '@/lib/inngest/client'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function normalizePhoneBR(raw: string): string {
    const digits = String(raw || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('55')) return digits
    return `55${digits}`
}

function metadataRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

function buildPhoneOrFilter(candidates: string[]): string {
    const safe = candidates
        .map(candidate => candidate.replace(/[^0-9]/g, ''))
        .filter(Boolean)
    return `phone.in.(${safe.join(',')}),phone_e164.in.(${safe.join(',')})`
}

async function syncLeadActivityFromVisitor(params: {
    supabase: ReturnType<typeof getSupabase>
    leadId: string
    visitorId: string
    metadata: Record<string, unknown>
}) {
    await params.supabase
        .from('funnel_events')
        .update({ lead_id: params.leadId })
        .eq('visitor_id', params.visitorId)
        .is('lead_id', null)

    const { data: eventRows, error } = await params.supabase
        .from('funnel_events')
        .select('id, event_type, metadata, created_at')
        .eq('visitor_id', params.visitorId)
        .order('created_at', { ascending: false })
        .limit(120)

    if (error) {
        console.warn('[Lead Capture] activity history fetch skipped:', error.message)
        return params.metadata
    }

    return mergeLeadSiteActivity(params.metadata, ((eventRows || []) as LeadActivityEventRow[]).reverse())
}

export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()

        const name = String(body?.name || '').trim()
        const phoneRaw = String(body?.phone || '').trim()
        const email = body?.email ? String(body.email).trim() : null
        const landingPageSlug = body?.landing_page_slug ? String(body.landing_page_slug) : null
        const visitorCookieId = body?.visitor_cookie_id ? String(body.visitor_cookie_id) : generateVisitorId()
        const referrer = body?.referrer ? String(body.referrer) : undefined
        const searchParams = new URLSearchParams(String(body?.search_params || ''))
        const consentLgpd = Boolean(body?.consent_lgpd)
        const captureMetadata = metadataRecord(body?.metadata)

        if (!name || !phoneRaw) {
            return NextResponse.json({ success: false, error: 'name e phone são obrigatórios' }, { status: 400 })
        }

        const phone = normalizePhoneBR(phoneRaw)
        if (phone.length < 12) {
            return NextResponse.json({ success: false, error: 'Telefone inválido' }, { status: 400 })
        }

        const trackingData = extractTrackingData(request.headers, searchParams, referrer)
        trackingData.visitor_cookie_id = visitorCookieId

        let landingPageId: string | null = null
        if (landingPageSlug) {
            const { data: lp } = await supabase
                .from('landing_pages')
                .select('id')
                .eq('slug', landingPageSlug)
                .maybeSingle()
            landingPageId = lp?.id || null
        }

        // Upsert visitor by cookie id (reutiliza estrutura já existente)
        const { data: visitor, error: visitorError } = await supabase
            .from('visitors')
            .upsert({
                ...trackingData,
                landing_page_id: landingPageId,
                last_visit_at: new Date().toISOString(),
            }, { onConflict: 'visitor_cookie_id' })
            .select('id, page_views')
            .single()

        if (visitorError) throw visitorError

        // Busca lead existente por telefone, depois por visitor_id
        const candidates = phoneCandidates(phone)
        const { data: existingByPhone } = await supabase
            .from('leads')
            .select('id, metadata, lead_score, lead_classification')
            .or(buildPhoneOrFilter(candidates.length ? candidates : [phone]))
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        let leadId: string | null = existingByPhone?.id || null
        let existingMetadata = existingByPhone?.metadata || {}
        let currentLeadScore = existingByPhone?.lead_score || null
        let currentLeadClassification = existingByPhone?.lead_classification || null

        if (!leadId) {
            const { data: existingByVisitor } = await supabase
                .from('leads')
                .select('id, metadata, lead_score, lead_classification')
                .eq('visitor_id', visitor.id)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            leadId = existingByVisitor?.id || null
            existingMetadata = existingByVisitor?.metadata || existingMetadata
            currentLeadScore = existingByVisitor?.lead_score || currentLeadScore
            currentLeadClassification = existingByVisitor?.lead_classification || currentLeadClassification
        }

        const metadataPatch = {
            ...existingMetadata,
            form_submitted_at: new Date().toISOString(),
            consent_lgpd: consentLgpd,
            capture_source: 'site_form',
            landing_page_slug: landingPageSlug,
            visitor_cookie_id: visitorCookieId,
            ...(Object.keys(captureMetadata).length ? { capture_context: captureMetadata } : {}),
            tracking: {
                detected_source: trackingData.detected_source || null,
                utm_source: trackingData.utm_source || null,
                utm_medium: trackingData.utm_medium || null,
                utm_campaign: trackingData.utm_campaign || null,
                utm_term: trackingData.utm_term || null,
                utm_content: trackingData.utm_content || null,
                referrer: trackingData.referrer || null,
                device_type: trackingData.device_type || null,
                browser: trackingData.browser || null,
                os: trackingData.os || null,
                country: trackingData.country || null,
                city: trackingData.city || null,
                region: trackingData.region || null,
            },
        }

        if (leadId) {
            const { error: upErr } = await supabase
                .from('leads')
                .update({
                    visitor_id: visitor.id,
                    landing_page_id: landingPageId,
                    name,
                    phone,
                    phone_e164: phone,
                    email,
                    funnel_stage: 'lead',
                    country: trackingData.country || null,
                    city: trackingData.city || null,
                    state: trackingData.region || null,
                    metadata: metadataPatch,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', leadId)
            if (upErr) throw upErr
        } else {
            const { data: inserted, error: insErr } = await supabase
                .from('leads')
                .insert({
                    visitor_id: visitor.id,
                    landing_page_id: landingPageId,
                    name,
                    phone,
                    phone_e164: phone,
                    email,
                    funnel_stage: 'lead',
                    country: trackingData.country || null,
                    city: trackingData.city || null,
                    state: trackingData.region || null,
                    acquired_via: 'form',
                    metadata: metadataPatch,
                })
                .select('id')
                .single()
            if (insErr) throw insErr
            leadId = inserted.id
        }

        // Evento novo no funil: formulário enviado
        await supabase.from('funnel_events').insert({
            visitor_id: visitor.id,
            lead_id: leadId,
            landing_page_id: landingPageId,
            event_type: 'form_submitted',
            metadata: {
                name,
                phone,
                consent_lgpd: consentLgpd,
                landing_page_slug: landingPageSlug,
                visitor_cookie_id: visitorCookieId,
                tracking: metadataPatch.tracking,
                ...captureMetadata,
            },
        })

        if (!leadId) {
            throw new Error('Lead ID not resolved after capture')
        }

        const metadataWithActivity = await syncLeadActivityFromVisitor({
            supabase,
            leadId,
            visitorId: visitor.id,
            metadata: metadataPatch,
        })

        await supabase
            .from('leads')
            .update({
                metadata: metadataWithActivity,
                ...leadIntentColumnsFromMetadata(
                    metadataWithActivity,
                    currentLeadScore,
                    currentLeadClassification
                ),
                updated_at: new Date().toISOString(),
            })
            .eq('id', leadId)

        // Agenda fluxo completo de follow-up caso o lead não inicie conversa no WhatsApp.
        await inngest.send({
            name: 'lead/schedule-whatsapp-followup-flow',
            data: {
                lead_id: leadId,
                phone,
                name
            },
        })

        // Fase 2: dispara workflows visuais ativos para novos leads.
        // Best-effort para manter compatibilidade caso a migration ainda nao tenha sido aplicada.
        try {
            const { data: workflows } = await supabase
                .from('agent_workflows')
                .select('id, trigger_type')
                .eq('is_active', true)
                .in('trigger_type', ['lead_created', 'lead_no_reply'])

            for (const workflow of workflows || []) {
                await inngest.send({
                    name: 'automation/run-agent-workflow',
                    data: {
                        workflow_id: workflow.id,
                        lead_id: leadId,
                        phone,
                        name,
                        trigger_type: workflow.trigger_type || 'lead_created',
                        context: {
                            landing_page_slug: landingPageSlug,
                            visitor_cookie_id: visitorCookieId,
                        },
                    },
                })
            }
        } catch (workflowErr) {
            console.warn('[Lead Capture] agent workflow trigger skipped:', workflowErr)
        }

        return NextResponse.json({
            success: true,
            lead_id: leadId,
            visitor_id: visitor.id,
            visitor_cookie_id: visitorCookieId,
        })
    } catch (error) {
        console.error('[Lead Capture] Error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

