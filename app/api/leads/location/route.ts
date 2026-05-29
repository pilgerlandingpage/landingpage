import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { phoneCandidates } from '@/lib/whatsapp/lead-sync'

const VISITOR_COOKIE_NAME = 'pilger_visitor_id'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function metadataRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, any>
        : {}
}

function normalizeLeadId(raw: unknown): string {
    const id = String(raw || '').trim()
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? id
        : ''
}

function normalizeLeadPhone(raw: unknown): string {
    const digits = String(raw || '').replace(/\D/g, '')
    if (!digits) return ''
    return digits.startsWith('55') || digits.length > 11 ? digits : `55${digits}`
}

function buildPhoneOrFilter(candidates: string[]): string {
    const safe = candidates
        .map(candidate => candidate.replace(/[^0-9]/g, ''))
        .filter(Boolean)
    return `phone.in.(${safe.join(',')}),phone_e164.in.(${safe.join(',')})`
}

function numberOrNull(value: unknown): number | null {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function safeUrl(value: unknown): string | null {
    const text = String(value || '').trim()
    if (!text) return null
    try {
        const url = new URL(text)
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
    } catch {
        return null
    }
}

async function findVisitor(visitorCookieId: string) {
    if (!visitorCookieId) return null
    const { data, error } = await supabase
        .from('visitors')
        .select('id, landing_page_id, country, city, region')
        .eq('visitor_cookie_id', visitorCookieId)
        .maybeSingle()

    if (error) {
        console.warn('[Lead Location] visitor lookup failed:', error.message)
        return null
    }
    return data || null
}

async function findLead(params: {
    leadId: string
    phone: string
    visitorId?: string | null
}) {
    if (params.leadId) {
        const { data, error } = await supabase
            .from('leads')
            .select('id, phone, phone_e164, metadata, visitor_id, landing_page_id')
            .eq('id', params.leadId)
            .maybeSingle()
        if (error) console.warn('[Lead Location] lead lookup by id failed:', error.message)
        if (data?.id) return data
    }

    const candidates = phoneCandidates(params.phone)
    if (candidates.length > 0) {
        const { data, error } = await supabase
            .from('leads')
            .select('id, phone, phone_e164, metadata, visitor_id, landing_page_id')
            .or(buildPhoneOrFilter(candidates))
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        if (error) console.warn('[Lead Location] lead lookup by phone failed:', error.message)
        if (data?.id) return data
    }

    if (params.visitorId) {
        const { data, error } = await supabase
            .from('leads')
            .select('id, phone, phone_e164, metadata, visitor_id, landing_page_id')
            .eq('visitor_id', params.visitorId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        if (error) console.warn('[Lead Location] lead lookup by visitor failed:', error.message)
        if (data?.id) return data
    }

    return null
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const searchParams = new URLSearchParams(String(body?.search_params || ''))
        const visitorCookieId = String(
            body?.visitor_cookie_id
            || request.cookies.get(VISITOR_COOKIE_NAME)?.value
            || ''
        ).trim()
        const visitor = await findVisitor(visitorCookieId)
        const leadId = normalizeLeadId(body?.lead_id || searchParams.get('lead_id'))
        const phone = normalizeLeadPhone(
            body?.lead_phone
            || searchParams.get('lead_phone')
            || searchParams.get('wa_phone')
            || searchParams.get('wpp_phone')
        )
        const lead = await findLead({
            leadId,
            phone,
            visitorId: visitor?.id || null,
        })

        if (!lead?.id) {
            return NextResponse.json({ success: false, error: 'lead_not_found' }, { status: 404 })
        }

        const permissionStatus = String(body?.permission_status || 'granted').toLowerCase()
        const latitude = numberOrNull(body?.latitude)
        const longitude = numberOrNull(body?.longitude)
        const hasValidCoords =
            permissionStatus === 'granted'
            && latitude !== null
            && longitude !== null
            && latitude >= -90
            && latitude <= 90
            && longitude >= -180
            && longitude <= 180

        if (permissionStatus === 'granted' && !hasValidCoords) {
            return NextResponse.json({ success: false, error: 'invalid_coordinates' }, { status: 400 })
        }

        const now = new Date().toISOString()
        const metadata = metadataRecord(lead.metadata)
        const tracking = metadataRecord(metadata.tracking)
        const previousHistory = Array.isArray(metadata.precise_location_history)
            ? metadata.precise_location_history
            : []
        const baseEntry = {
            source: String(body?.source || 'browser_geolocation').slice(0, 80),
            permission_status: permissionStatus,
            captured_at: now,
            visitor_id: visitor?.id || lead.visitor_id || null,
            landing_page_id: lead.landing_page_id || visitor?.landing_page_id || null,
            page_url: safeUrl(body?.page_url),
            page_path: String(body?.page_path || '').slice(0, 240) || null,
            utm_source: searchParams.get('utm_source') || null,
            utm_medium: searchParams.get('utm_medium') || null,
            utm_campaign: searchParams.get('utm_campaign') || null,
            utm_content: searchParams.get('utm_content') || null,
        }
        const locationEntry = hasValidCoords
            ? {
                ...baseEntry,
                latitude,
                longitude,
                accuracy_meters: numberOrNull(body?.accuracy),
                altitude_meters: numberOrNull(body?.altitude),
                altitude_accuracy_meters: numberOrNull(body?.altitude_accuracy),
                heading: numberOrNull(body?.heading),
                speed: numberOrNull(body?.speed),
            }
            : baseEntry

        const nextMetadata = {
            ...metadata,
            ...(hasValidCoords ? {
                precise_location: locationEntry,
                gps_location: locationEntry,
                precise_location_history: [locationEntry, ...previousHistory].slice(0, 30),
            } : {}),
            gps_permission: {
                status: permissionStatus,
                updated_at: now,
                source: baseEntry.source,
                page_path: baseEntry.page_path,
            },
            tracking: {
                ...tracking,
                precise_location_status: permissionStatus,
                precise_location_captured_at: hasValidCoords ? now : tracking.precise_location_captured_at || null,
                has_precise_location: hasValidCoords || Boolean(tracking.has_precise_location),
            },
        }

        const leadUpdate: Record<string, unknown> = {
            metadata: nextMetadata,
            updated_at: now,
        }
        if (!lead.visitor_id && visitor?.id) leadUpdate.visitor_id = visitor.id
        if (!lead.landing_page_id && visitor?.landing_page_id) leadUpdate.landing_page_id = visitor.landing_page_id

        const { error: updateError } = await supabase
            .from('leads')
            .update(leadUpdate)
            .eq('id', lead.id)

        if (updateError) throw updateError

        if (hasValidCoords) {
            const variants = phoneCandidates(lead.phone_e164 || lead.phone || phone)
            if (variants.length > 0) {
                await supabase
                    .from('lead_collected_data')
                    .update({
                        latitude,
                        longitude,
                        updated_at: now,
                    })
                    .in('lead_phone', variants)
            }
        }

        if (visitor?.id) {
            await supabase.from('funnel_events').insert({
                visitor_id: visitor.id,
                lead_id: lead.id,
                landing_page_id: lead.landing_page_id || visitor.landing_page_id || null,
                event_type: hasValidCoords ? 'lead_gps_location_granted' : `lead_gps_location_${permissionStatus}`,
                metadata: locationEntry,
            })
        }

        return NextResponse.json({
            success: true,
            lead_id: lead.id,
            precise_location_saved: hasValidCoords,
            permission_status: permissionStatus,
        })
    } catch (error: any) {
        console.error('[Lead Location] POST error:', error)
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}
