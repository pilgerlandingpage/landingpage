import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'

type SupabaseAdminLike = {
    from: (table: string) => any
}

type AnalyticsConfig = {
    measurementId: string
    propertyId: string
    searchConsoleSiteUrl: string
    clientEmail: string
    privateKey: string
    oauthClientId: string
    oauthClientSecret: string
    oauthRefreshToken: string
}

const CONFIG_KEYS = [
    'google_analytics_measurement_id',
    'google_analytics_property_id',
    'google_analytics_service_account_json',
    'google_analytics_client_email',
    'google_analytics_private_key',
    'google_analytics_oauth_client_id',
    'google_analytics_oauth_client_secret',
    'google_analytics_refresh_token',
    'google_search_console_site_url',
    'google_ads_conversion_id',
]

function normalizeText(value: unknown) {
    return String(value || '').trim()
}

function base64Url(input: string | Buffer) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
}

async function loadConfigMap(supabase?: SupabaseAdminLike, overrides?: Record<string, unknown>) {
    const map: Record<string, string> = {}

    if (supabase) {
        try {
            const { data } = await supabase
                .from('app_config')
                .select('key,value')
                .in('key', CONFIG_KEYS)

            for (const row of data || []) {
                if (row?.key && row?.value) map[row.key] = String(row.value)
            }
        } catch {
            // Environment variables and explicit overrides still work.
        }
    }

    const envFallbacks: Record<string, string | undefined> = {
        google_analytics_measurement_id: process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
        google_analytics_property_id: process.env.GOOGLE_ANALYTICS_PROPERTY_ID || process.env.GA4_PROPERTY_ID,
        google_analytics_service_account_json: process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON,
        google_analytics_client_email: process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL,
        google_analytics_private_key: process.env.GOOGLE_ANALYTICS_PRIVATE_KEY,
        google_analytics_oauth_client_id: process.env.GOOGLE_ANALYTICS_OAUTH_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID,
        google_analytics_oauth_client_secret: process.env.GOOGLE_ANALYTICS_OAUTH_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET,
        google_analytics_refresh_token: process.env.GOOGLE_ANALYTICS_REFRESH_TOKEN,
        google_search_console_site_url: process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL,
        google_ads_conversion_id: process.env.GOOGLE_ADS_CONVERSION_ID || process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    }

    for (const [key, value] of Object.entries(envFallbacks)) {
        if (!map[key] && value) map[key] = value
    }

    for (const [key, value] of Object.entries(overrides || {})) {
        const normalized = normalizeText(value)
        if (normalized) map[key] = normalized
    }

    return map
}

function readServiceAccount(map: Record<string, string>) {
    const rawJson = normalizeText(map.google_analytics_service_account_json)
    if (rawJson) {
        try {
            const parsed = JSON.parse(rawJson)
            return {
                clientEmail: normalizeText(parsed.client_email),
                privateKey: normalizeText(parsed.private_key).replace(/\\n/g, '\n'),
            }
        } catch {
            throw new Error('JSON da service account do Google Analytics invalido.')
        }
    }

    return {
        clientEmail: normalizeText(map.google_analytics_client_email),
        privateKey: normalizeText(map.google_analytics_private_key).replace(/\\n/g, '\n'),
    }
}

function normalizePropertyId(value: string) {
    return normalizeText(value).replace(/^properties\//, '')
}

function normalizeSiteUrl(value: string) {
    const raw = normalizeText(value)
    if (!raw) return ''
    if (raw.startsWith('sc-domain:')) return raw
    return raw.replace(/\/$/, '')
}

export async function getPublicGoogleTrackingConfig(supabase?: SupabaseAdminLike) {
    const map = await loadConfigMap(supabase || createAdminClient())
    return {
        googleAnalyticsId: normalizeText(map.google_analytics_measurement_id),
        googleAdsId: normalizeText(map.google_ads_conversion_id),
    }
}

async function getAnalyticsConfig(supabase?: SupabaseAdminLike, overrides?: Record<string, unknown>): Promise<AnalyticsConfig> {
    const map = await loadConfigMap(supabase || createAdminClient(), overrides)
    const serviceAccount = readServiceAccount(map)
    return {
        measurementId: normalizeText(map.google_analytics_measurement_id),
        propertyId: normalizePropertyId(map.google_analytics_property_id),
        searchConsoleSiteUrl: normalizeSiteUrl(map.google_search_console_site_url),
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
        oauthClientId: normalizeText(map.google_analytics_oauth_client_id),
        oauthClientSecret: normalizeText(map.google_analytics_oauth_client_secret),
        oauthRefreshToken: normalizeText(map.google_analytics_refresh_token),
    }
}

async function getServiceAccountAccessToken(config: AnalyticsConfig, scopes: string[]) {
    const now = Math.floor(Date.now() / 1000)
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claims = base64Url(JSON.stringify({
        iss: config.clientEmail,
        scope: scopes.join(' '),
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    }))
    const unsignedJwt = `${header}.${claims}`
    const signature = crypto.createSign('RSA-SHA256').update(unsignedJwt).sign(config.privateKey)
    const assertion = `${unsignedJwt}.${base64Url(signature)}`

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
        throw new Error(`Erro OAuth Google Analytics: ${data.error_description || data.error || res.statusText}`)
    }

    return String(data.access_token || '')
}

async function getOAuthAccessToken(config: AnalyticsConfig) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: config.oauthClientId,
            client_secret: config.oauthClientSecret,
            refresh_token: config.oauthRefreshToken,
            grant_type: 'refresh_token',
        }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
        throw new Error(`Erro OAuth Google Analytics: ${data.error_description || data.error || res.statusText}`)
    }

    return String(data.access_token || '')
}

function hasServiceAccount(config: AnalyticsConfig) {
    return Boolean(config.clientEmail && config.privateKey)
}

function hasOAuth(config: AnalyticsConfig) {
    return Boolean(config.oauthClientId && config.oauthClientSecret && config.oauthRefreshToken)
}

async function getGoogleAccessToken(config: AnalyticsConfig, scopes: string[]) {
    if (hasOAuth(config)) return getOAuthAccessToken(config)
    if (hasServiceAccount(config)) return getServiceAccountAccessToken(config, scopes)
    throw new Error('Configure uma Service Account ou OAuth Client ID, Client Secret e Refresh Token do Google Analytics.')
}

function daysAgoDate(days: number) {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().slice(0, 10)
}

async function runGaReport(config: AnalyticsConfig, token: string, body: Record<string, unknown>) {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runReport`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
        throw new Error(`Erro GA4 Data API: ${data.error?.message || res.statusText}`)
    }
    return data
}

function metricValue(row: any, index: number) {
    return Number(row?.metricValues?.[index]?.value || 0)
}

function dimensionValue(row: any, index: number) {
    return String(row?.dimensionValues?.[index]?.value || '')
}

function rowsFromReport(report: any, mapper: (row: any) => Record<string, unknown>) {
    return (report?.rows || []).map(mapper)
}

async function fetchSearchConsole(config: AnalyticsConfig, token: string, startDate: string, endDate: string) {
    if (!config.searchConsoleSiteUrl) return { configured: false, queries: [], pages: [], totals: null, error: null }

    const runQuery = async (dimensions: string[]) => {
        const encodedSite = encodeURIComponent(config.searchConsoleSiteUrl)
        const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                startDate,
                endDate,
                dimensions,
                rowLimit: 12,
            }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.error) {
            throw new Error(data.error?.message || res.statusText)
        }
        return data
    }

    try {
        const [queriesReport, pagesReport] = await Promise.all([
            runQuery(['query']),
            runQuery(['page']),
        ])

        const mapRow = (row: any) => ({
            label: String(row?.keys?.[0] || ''),
            clicks: Number(row?.clicks || 0),
            impressions: Number(row?.impressions || 0),
            ctr: Number(row?.ctr || 0) * 100,
            position: Number(row?.position || 0),
        })

        const queries = (queriesReport.rows || []).map(mapRow)
        const pages = (pagesReport.rows || []).map(mapRow)
        const totals = queries.reduce((acc: any, row: any) => ({
            clicks: acc.clicks + row.clicks,
            impressions: acc.impressions + row.impressions,
        }), { clicks: 0, impressions: 0 })

        return { configured: true, queries, pages, totals, error: null }
    } catch (error: any) {
        return { configured: true, queries: [], pages: [], totals: null, error: error?.message || 'Erro Search Console.' }
    }
}

export async function getGoogleOrganicAnalytics(params: {
    days?: number
    supabase?: SupabaseAdminLike
    overrides?: Record<string, unknown>
} = {}) {
    const days = Math.max(1, Math.min(180, Number(params.days || 28)))
    const config = await getAnalyticsConfig(params.supabase, params.overrides)

    if (!config.propertyId || (!hasServiceAccount(config) && !hasOAuth(config))) {
        return {
            configured: false,
            message: 'Configure Property ID e Service Account ou OAuth do Google Analytics na Sala de Manutencao.',
            measurementId: config.measurementId,
            propertyId: config.propertyId,
            summary: null,
            channels: [],
            landingPages: [],
            sourceMedium: [],
            searchConsole: { configured: Boolean(config.searchConsoleSiteUrl), queries: [], pages: [], totals: null, error: null },
        }
    }

    const startDate = daysAgoDate(days)
    const endDate = daysAgoDate(0)
    const token = await getGoogleAccessToken(config, [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly',
    ])

    const dateRanges = [{ startDate, endDate }]
    const organicFilter = {
        filter: {
            fieldName: 'sessionDefaultChannelGroup',
            stringFilter: { matchType: 'EXACT', value: 'Organic Search' },
        },
    }

    const [channelsReport, landingReport, sourceReport, searchConsole] = await Promise.all([
        runGaReport(config, token, {
            dateRanges,
            dimensions: [{ name: 'sessionDefaultChannelGroup' }],
            metrics: [
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'screenPageViews' },
                { name: 'keyEvents' },
            ],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 12,
        }),
        runGaReport(config, token, {
            dateRanges,
            dimensions: [{ name: 'landingPagePlusQueryString' }],
            metrics: [
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'screenPageViews' },
                { name: 'keyEvents' },
            ],
            dimensionFilter: organicFilter,
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 12,
        }),
        runGaReport(config, token, {
            dateRanges,
            dimensions: [{ name: 'sessionSourceMedium' }],
            metrics: [
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'keyEvents' },
            ],
            dimensionFilter: organicFilter,
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 12,
        }),
        fetchSearchConsole(config, token, startDate, endDate),
    ])

    const channels = rowsFromReport(channelsReport, row => ({
        channel: dimensionValue(row, 0),
        sessions: metricValue(row, 0),
        users: metricValue(row, 1),
        views: metricValue(row, 2),
        conversions: metricValue(row, 3),
    }))

    const landingPages = rowsFromReport(landingReport, row => ({
        page: dimensionValue(row, 0),
        sessions: metricValue(row, 0),
        users: metricValue(row, 1),
        views: metricValue(row, 2),
        conversions: metricValue(row, 3),
    }))

    const sourceMedium = rowsFromReport(sourceReport, row => ({
        sourceMedium: dimensionValue(row, 0),
        sessions: metricValue(row, 0),
        users: metricValue(row, 1),
        conversions: metricValue(row, 2),
    }))

    const totalSessions = channels.reduce((sum: number, row: any) => sum + Number(row.sessions || 0), 0)
    const organic = channels.find((row: any) => row.channel === 'Organic Search') || {}
    const organicSessions = Number((organic as any).sessions || 0)

    return {
        configured: true,
        measurementId: config.measurementId,
        propertyId: config.propertyId,
        period: { startDate, endDate, days },
        summary: {
            totalSessions,
            organicSessions,
            organicUsers: Number((organic as any).users || 0),
            organicViews: Number((organic as any).views || 0),
            organicConversions: Number((organic as any).conversions || 0),
            organicShare: totalSessions > 0 ? (organicSessions / totalSessions) * 100 : 0,
        },
        channels,
        landingPages,
        sourceMedium,
        searchConsole,
    }
}

export async function testGoogleAnalyticsConnection(overrides?: Record<string, unknown>) {
    const result = await getGoogleOrganicAnalytics({ days: 7, overrides })
    if (!result.configured) {
        return { success: false, message: result.message || 'Google Analytics nao configurado.' }
    }
    return {
        success: true,
        message: `GA4 conectado. Propriedade ${result.propertyId}: ${result.summary?.organicSessions || 0} sessoes organicas nos ultimos 7 dias.`,
    }
}
