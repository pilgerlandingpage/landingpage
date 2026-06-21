import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractTrackingData, generateVisitorId } from '@/lib/tracking'
import { leadIntentColumnsFromMetadata, mergeLeadSiteActivity, type LeadActivityEventRow } from '@/lib/tracking/lead-activity'
import { sendMetaCapiEvent } from '@/lib/tracking/meta-capi'
import { phoneCandidates } from '@/lib/whatsapp/lead-sync'
import { inngest } from '@/lib/inngest/client'
import { GLOBAL_PROPERTY_WHATSAPP_PHONE, getResponsibleBrokerForProperty } from '@/lib/properties/responsible-broker'

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

function metadataText(value: unknown): string | null {
    const text = String(value || '').trim()
    return text || null
}

function safeDecode(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

function pathnameFromUrl(value: string | null) {
    if (!value) return null
    try {
        return new URL(value, 'https://guilhermepilger.ai').pathname
    } catch {
        return null
    }
}

function propertySlugFromPath(pathname: string | null) {
    const match = String(pathname || '').match(/^\/imovel\/([^/]+)(?:\/detalhes)?\/?$/i)
    const segment = match?.[1] ? safeDecode(match[1]) : ''
    if (!segment || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
        return null
    }
    return segment
}

function buildCapturePageContext(metadata: Record<string, unknown>) {
    const pageUrl = metadataText(metadata.page_url)
        || metadataText(metadata.property_url)
        || metadataText(metadata.canonical_url)
    const pagePath = metadataText(metadata.page_path)
        || metadataText(metadata.property_path)
        || pathnameFromUrl(pageUrl)
    const propertyPath = metadataText(metadata.property_path)
        || (String(pagePath || '').startsWith('/imovel/') ? pagePath : null)
    const propertySlug = metadataText(metadata.property_slug)
        || metadataText(metadata.propertySlug)
        || propertySlugFromPath(propertyPath || pagePath)

    return {
        ...(pagePath ? { page_path: pagePath } : {}),
        ...(pageUrl ? { page_url: pageUrl } : {}),
        ...(propertyPath ? { property_path: propertyPath } : {}),
        ...(propertySlug ? { property_slug: propertySlug } : {}),
    }
}

function propertyIdFromLandingSlug(slug?: string | null): string | null {
    const match = String(slug || '').match(/^imovel-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
    return match?.[1] || null
}

function propertyIdFromMetadata(metadata: Record<string, unknown>): string | null {
    const property = metadata.property && typeof metadata.property === 'object' && !Array.isArray(metadata.property)
        ? metadata.property as Record<string, unknown>
        : {}

    return metadataText(metadata.property_id)
        || metadataText(metadata.propertyId)
        || metadataText(property.id)
}

async function resolveWhatsAppDestination(params: {
    supabase: ReturnType<typeof getSupabase>
    captureMetadata: Record<string, unknown>
    landingPageSlug: string | null
    requestedPhone: string
}) {
    const propertyId = propertyIdFromMetadata(params.captureMetadata) || propertyIdFromLandingSlug(params.landingPageSlug)
    const fallbackPhone = normalizePhoneBR(params.requestedPhone || GLOBAL_PROPERTY_WHATSAPP_PHONE)

    if (!propertyId) {
        return {
            property_id: null,
            phone: fallbackPhone || GLOBAL_PROPERTY_WHATSAPP_PHONE,
            broker_name: null,
            broker_id: null,
            admin_user_id: null,
            whatsapp_instance_id: null,
            source: 'provided',
            is_connected: false,
        }
    }

    try {
        const responsibleBroker = await getResponsibleBrokerForProperty(params.supabase, propertyId)
        const phone = normalizePhoneBR(responsibleBroker.phone || GLOBAL_PROPERTY_WHATSAPP_PHONE)
        return {
            property_id: propertyId,
            phone: phone || GLOBAL_PROPERTY_WHATSAPP_PHONE,
            broker_name: responsibleBroker.name || null,
            broker_id: responsibleBroker.broker_id || null,
            admin_user_id: responsibleBroker.admin_user_id || null,
            whatsapp_instance_id: responsibleBroker.whatsapp_instance_id || null,
            source: responsibleBroker.source,
            is_connected: responsibleBroker.is_connected,
        }
    } catch (error) {
        console.warn('[Lead Capture] responsible broker resolution failed:', error)
        return {
            property_id: propertyId,
            phone: GLOBAL_PROPERTY_WHATSAPP_PHONE,
            broker_name: 'Comercial Guilherme Pilger',
            broker_id: null,
            admin_user_id: null,
            whatsapp_instance_id: null,
            source: 'global',
            is_connected: false,
        }
    }
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

        const whatsappDestination = await resolveWhatsAppDestination({
            supabase,
            captureMetadata,
            landingPageSlug,
            requestedPhone: String(body?.whatsapp_phone || body?.destination_phone || body?.target_phone || ''),
        })
        const capturePageContext = buildCapturePageContext(captureMetadata)
        const enrichedCaptureContext: Record<string, any> = {
            ...captureMetadata,
            ...capturePageContext,
            ...(whatsappDestination.property_id ? { property_id: whatsappDestination.property_id } : {}),
            whatsapp_destination: {
                phone: whatsappDestination.phone,
                broker_name: whatsappDestination.broker_name,
                broker_id: whatsappDestination.broker_id,
                admin_user_id: whatsappDestination.admin_user_id,
                whatsapp_instance_id: whatsappDestination.whatsapp_instance_id,
                source: whatsappDestination.source,
                is_connected: whatsappDestination.is_connected,
            },
        }
        const premiumIntent = metadataText(enrichedCaptureContext.premium_intent)
        const requestedAction = metadataText(enrichedCaptureContext.requested_action)
        const ctaContext = metadataText(enrichedCaptureContext.cta_context)
        const trackingEventType = metadataText(enrichedCaptureContext.tracking_event_type)

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
            ...capturePageContext,
            ...(Object.keys(enrichedCaptureContext).length ? { capture_context: enrichedCaptureContext } : {}),
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
                ...capturePageContext,
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
        const { data: leadFunnelEvent, error: leadFunnelError } = await supabase.from('funnel_events').insert({
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
                ...enrichedCaptureContext,
            },
        })
            .select('id, event_type, metadata, created_at')
            .single()

        if (leadFunnelError) {
            console.warn('[Lead Capture] funnel event insert failed:', leadFunnelError.message)
        }

        if (leadFunnelEvent) {
            await sendMetaCapiEvent({
                siteEventType: leadFunnelEvent.event_type || 'form_submitted',
                metadata: {
                    ...metadataRecord(leadFunnelEvent.metadata),
                    created_at: leadFunnelEvent.created_at,
                },
                trackingData,
                visitorCookieId,
                visitorId: visitor.id,
                leadId,
                searchParams,
                requestCookies: {
                    fbp: request.cookies.get('_fbp')?.value || null,
                    fbc: request.cookies.get('_fbc')?.value || null,
                },
                lead: {
                    email,
                    phone,
                    name,
                },
            })
        }

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
                name,
                property_id: whatsappDestination.property_id || undefined,
                whatsapp_phone: whatsappDestination.phone,
                broker_id: whatsappDestination.broker_id || undefined,
                admin_user_id: whatsappDestination.admin_user_id || undefined,
                whatsapp_instance_id: whatsappDestination.whatsapp_instance_id || undefined,
                premium_intent: premiumIntent || undefined,
                requested_action: requestedAction || undefined,
                cta_context: ctaContext || undefined,
                tracking_event_type: trackingEventType || undefined,
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
                            property_id: whatsappDestination.property_id,
                            premium_intent: premiumIntent,
                            requested_action: requestedAction,
                            cta_context: ctaContext,
                            tracking_event_type: trackingEventType,
                            whatsapp_destination: enrichedCaptureContext.whatsapp_destination,
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
            whatsapp_phone: whatsappDestination.phone,
            whatsapp_contact: whatsappDestination,
        })
    } catch (error) {
        console.error('[Lead Capture] Error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

