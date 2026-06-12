import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { resolveMetaPixelId } from '@/lib/tracking/meta-pixel'
import { buildMetaCustomData, resolveMetaEventName, type MetaEventName } from '@/lib/tracking/meta-events'
import type { VisitorData } from '@/lib/tracking'

const META_API_VERSION = 'v21.0'
const CONFIG_KEYS = [
    'meta_pixel_id',
    'meta_capi_access_token',
    'meta_access_token',
    'meta_test_event_code',
] as const

type MetaCapiParams = {
    siteEventType: string
    metadata?: Record<string, unknown>
    trackingData: VisitorData
    visitorCookieId?: string | null
    visitorId?: string | null
    leadId?: string | null
    searchParams?: URLSearchParams
    requestCookies?: {
        fbp?: string | null
        fbc?: string | null
    }
    lead?: {
        email?: string | null
        phone?: string | null
        name?: string | null
    }
}

type MetaCapiConfig = {
    accessToken: string
    pixelId: string
    testEventCode: string
}

function sha256(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex')
}

function normalizeEmail(value: unknown) {
    return String(value || '').trim().toLowerCase()
}

function normalizePhone(value: unknown) {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return ''
    return digits.startsWith('55') ? digits : `55${digits}`
}

function textValue(value: unknown) {
    const text = String(value || '').trim()
    return text || ''
}

function unixTime(value: unknown) {
    const date = value ? new Date(String(value)) : new Date()
    const timestamp = Number.isNaN(date.getTime()) ? Date.now() : date.getTime()
    return Math.floor(timestamp / 1000)
}

function buildFbc(params: {
    fbclid?: string | null
    fbc?: string | null
    eventTime: number
}) {
    const fbc = textValue(params.fbc)
    if (fbc) return fbc

    const fbclid = textValue(params.fbclid)
    if (!fbclid) return ''

    return `fb.1.${params.eventTime * 1000}.${fbclid}`
}

async function getMetaCapiConfig(): Promise<MetaCapiConfig | null> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', CONFIG_KEYS)

    if (error) {
        console.warn('[Meta CAPI] config lookup failed:', error.message)
    }

    const config: Record<string, string> = {}
    for (const row of data || []) {
        if (row?.key) config[String(row.key)] = String(row.value || '')
    }

    const accessToken = (
        config.meta_capi_access_token
        || process.env.META_CAPI_ACCESS_TOKEN
        || config.meta_access_token
        || process.env.META_ACCESS_TOKEN
        || ''
    ).trim()

    const pixelId = resolveMetaPixelId(config.meta_pixel_id, process.env.META_PIXEL_ID)
    const testEventCode = (config.meta_test_event_code || process.env.META_TEST_EVENT_CODE || '').trim()

    if (!accessToken || !pixelId) {
        console.warn('[Meta CAPI] pixel or access token missing; event skipped.')
        return null
    }

    return { accessToken, pixelId, testEventCode }
}

function resolveEventId(params: MetaCapiParams, metaEventName: MetaEventName) {
    return textValue(params.metadata?.meta_event_id)
        || textValue(params.metadata?.event_id)
        || `${metaEventName.toLowerCase()}_${Date.now()}_${crypto.randomUUID()}`
}

function resolveEventUrl(params: MetaCapiParams) {
    return textValue(params.metadata?.page_url)
        || textValue(params.metadata?.url)
        || textValue(params.trackingData.referrer)
        || process.env.NEXT_PUBLIC_SITE_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || ''
}

function buildUserData(params: MetaCapiParams, eventTime: number) {
    const metadata = params.metadata || {}
    const email = normalizeEmail(params.lead?.email || metadata.email)
    const phone = normalizePhone(params.lead?.phone || metadata.phone || metadata.lead_phone)
    const fbp = textValue(metadata.meta_fbp || params.requestCookies?.fbp)
    const fbc = buildFbc({
        fbc: textValue(metadata.meta_fbc || params.requestCookies?.fbc),
        fbclid: textValue(params.trackingData.fbclid || params.searchParams?.get('fbclid')),
        eventTime,
    })
    const externalId = textValue(params.leadId || params.visitorId || params.visitorCookieId || params.trackingData.visitor_cookie_id)

    const userData: Record<string, unknown> = {
        client_ip_address: params.trackingData.ip_address,
        client_user_agent: params.trackingData.user_agent,
    }

    if (email) userData.em = [sha256(email)]
    if (phone) userData.ph = [sha256(phone)]
    if (externalId) userData.external_id = [sha256(externalId)]
    if (fbp) userData.fbp = fbp
    if (fbc) userData.fbc = fbc

    return userData
}

export async function sendMetaCapiEvent(params: MetaCapiParams) {
    try {
        const metadata = params.metadata || {}
        const metaEventName = resolveMetaEventName(params.siteEventType, metadata.meta_event_name)
        if (!metaEventName) return { skipped: true, reason: 'unmapped_event' }

        const config = await getMetaCapiConfig()
        if (!config) return { skipped: true, reason: 'missing_config' }

        const eventTime = unixTime(metadata.created_at || metadata.event_time)
        const eventId = resolveEventId(params, metaEventName)
        const payload: Record<string, unknown> = {
            event_name: metaEventName,
            event_time: eventTime,
            event_id: eventId,
            action_source: 'website',
            event_source_url: resolveEventUrl(params),
            user_data: buildUserData(params, eventTime),
            custom_data: buildMetaCustomData(metaEventName, metadata),
        }

        const body: Record<string, unknown> = {
            access_token: config.accessToken,
            data: [payload],
        }
        if (config.testEventCode) body.test_event_code = config.testEventCode

        const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${config.pixelId}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await response.json().catch(() => null)

        if (!response.ok || data?.error) {
            console.warn('[Meta CAPI] event failed:', data?.error?.message || response.statusText)
            return { success: false, error: data?.error || response.statusText }
        }

        return { success: true, event_name: metaEventName, event_id: eventId }
    } catch (error) {
        console.warn('[Meta CAPI] event skipped:', error instanceof Error ? error.message : error)
        return { success: false, error }
    }
}
