import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const GEMINI_USAGE_PREFIX = '_aiusage_gemini_'
const GEMINI_BILLING_CACHE_PREFIX = '_aiusage_gemini_billing_'
const DEFAULT_USD_TO_BRL = 5
const OFFICIAL_BILLING_CACHE_MINUTES = 10

export type GeminiUsageMetadata = {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
    cachedContentTokenCount?: number
    thoughtsTokenCount?: number
    promptTokensDetails?: Array<{ modality?: string; tokenCount?: number }>
    candidatesTokensDetails?: Array<{ modality?: string; tokenCount?: number }>
}

export type GeminiUsageEntry = {
    id: string
    provider: 'gemini'
    model: string
    feature: string
    status: 'success' | 'error'
    created_at: string
    prompt_tokens: number
    output_tokens: number
    total_tokens: number
    audio_input_tokens: number
    text_input_tokens: number
    estimated_usd: number
    estimated_brl: number
    pricing: GeminiPricing
    metadata?: Record<string, unknown>
}

export type GeminiPricing = {
    inputUsdPerMillion: number
    audioInputUsdPerMillion: number
    outputUsdPerMillion: number
    source: string
}

type GeminiOfficialBillingRow = {
    service: string
    sku: string
    project_id: string
    project_name: string
    currency: string
    month_cost: number
    today_cost: number
    last_24h_cost: number
    month_cost_brl: number
    today_cost_brl: number
    last_24h_cost_brl: number
    latest_usage_end_time?: string | null
}

export type GeminiOfficialBillingSummary = {
    configured: boolean
    status: 'ok' | 'not_configured' | 'error'
    source: 'cloud_billing_bigquery' | 'not_configured'
    message: string
    month: string
    generated_at: string
    cache_updated_at?: string | null
    billing_project_id?: string | null
    gemini_project_id?: string | null
    table?: string | null
    currency?: string
    month_cost: number
    today_cost: number
    last_24h_cost: number
    month_cost_brl: number
    today_cost_brl: number
    last_24h_cost_brl: number
    latest_usage_end_time?: string | null
    rows: GeminiOfficialBillingRow[]
}

export type GeminiUsageSummary = {
    month: string
    generated_at: string
    usd_to_brl: number
    month_total: UsageTotals
    today_total: UsageTotals
    last_24h_total: UsageTotals
    by_model: Array<UsageTotals & { model: string }>
    by_feature: Array<UsageTotals & { feature: string }>
    official_billing: GeminiOfficialBillingSummary
    recent: GeminiUsageEntry[]
}

type GeminiBillingConfig = {
    billingProjectId: string
    dataset: string
    table: string
    geminiProjectId?: string
    clientEmail: string
    privateKey: string
}

type UsageTotals = {
    calls: number
    prompt_tokens: number
    output_tokens: number
    total_tokens: number
    estimated_usd: number
    estimated_brl: number
}

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function roundMoney(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 1000000) / 1000000
}

function toNumber(value: unknown) {
    const n = Number(value || 0)
    return Number.isFinite(n) ? n : 0
}

function todayInSaoPaulo() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())
}

function currentMonthInSaoPaulo() {
    return todayInSaoPaulo().slice(0, 7)
}

function monthStart(month: string) {
    return `${month}-01T00:00:00.000-03:00`
}

function monthEnd(month: string) {
    const [year, monthNumber] = month.split('-').map(Number)
    return new Date(Date.UTC(year, monthNumber, 1, 2, 59, 59, 999)).toISOString()
}

function monthDateRange(month: string) {
    const [year, monthNumber] = month.split('-').map(Number)
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
    return {
        startDate: `${month}-01`,
        endDate: `${month}-${String(lastDay).padStart(2, '0')}`,
    }
}

function safeBigQueryIdentifier(value: string, label: string) {
    const text = String(value || '').trim()
    if (!/^[A-Za-z0-9_-]+$/.test(text)) {
        throw new Error(`Identificador BigQuery invalido: ${label}`)
    }
    return text
}

function emptyOfficialBilling(month: string, message: string, status: 'not_configured' | 'error' = 'not_configured'): GeminiOfficialBillingSummary {
    return {
        configured: false,
        status,
        source: 'not_configured',
        message,
        month,
        generated_at: new Date().toISOString(),
        month_cost: 0,
        today_cost: 0,
        last_24h_cost: 0,
        month_cost_brl: 0,
        today_cost_brl: 0,
        last_24h_cost_brl: 0,
        rows: [],
    }
}

function isOptionalBillingConfigError(message: string) {
    const normalized = message.toLowerCase()
    return normalized.includes('decoder routines')
        || normalized.includes('unsupported')
        || normalized.includes('private key')
        || normalized.includes('service account')
        || normalized.includes('invalid_grant')
        || normalized.includes('json da service account')
}

function base64Url(input: Buffer | string) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
}

export function normalizeGeminiUsageMetadata(raw: any): GeminiUsageMetadata {
    const usage = raw || {}
    return {
        promptTokenCount: toNumber(usage.promptTokenCount ?? usage.prompt_token_count),
        candidatesTokenCount: toNumber(usage.candidatesTokenCount ?? usage.candidates_token_count),
        totalTokenCount: toNumber(usage.totalTokenCount ?? usage.total_token_count),
        cachedContentTokenCount: toNumber(usage.cachedContentTokenCount ?? usage.cached_content_token_count),
        thoughtsTokenCount: toNumber(usage.thoughtsTokenCount ?? usage.thoughts_token_count),
        promptTokensDetails: Array.isArray(usage.promptTokensDetails || usage.prompt_tokens_details)
            ? (usage.promptTokensDetails || usage.prompt_tokens_details)
            : [],
        candidatesTokensDetails: Array.isArray(usage.candidatesTokensDetails || usage.candidates_tokens_details)
            ? (usage.candidatesTokensDetails || usage.candidates_tokens_details)
            : [],
    }
}

export function getGeminiPricing(modelRaw: string): GeminiPricing {
    const model = String(modelRaw || '').toLowerCase()

    if (model.includes('3.1-pro') || model.includes('3-pro')) {
        return { inputUsdPerMillion: 2, audioInputUsdPerMillion: 4, outputUsdPerMillion: 12, source: 'gemini_3_pro_standard' }
    }
    if (model.includes('3.1-flash-lite')) {
        return { inputUsdPerMillion: 0.25, audioInputUsdPerMillion: 0.5, outputUsdPerMillion: 1.5, source: 'gemini_3_flash_lite_standard' }
    }
    if (model.includes('3-flash')) {
        return { inputUsdPerMillion: 0.5, audioInputUsdPerMillion: 1, outputUsdPerMillion: 3, source: 'gemini_3_flash_standard' }
    }
    if (model.includes('2.5-pro')) {
        return { inputUsdPerMillion: 1.25, audioInputUsdPerMillion: 2, outputUsdPerMillion: 10, source: 'gemini_2_5_pro_standard_under_200k' }
    }
    if (model.includes('2.5-flash-lite')) {
        return { inputUsdPerMillion: 0.1, audioInputUsdPerMillion: 0.3, outputUsdPerMillion: 0.4, source: 'gemini_2_5_flash_lite_standard' }
    }
    if (model.includes('2.5-flash')) {
        return { inputUsdPerMillion: 0.3, audioInputUsdPerMillion: 1, outputUsdPerMillion: 2.5, source: 'gemini_2_5_flash_standard' }
    }
    if (model.includes('2.0-flash-lite')) {
        return { inputUsdPerMillion: 0.075, audioInputUsdPerMillion: 0.075, outputUsdPerMillion: 0.3, source: 'gemini_2_0_flash_lite_standard' }
    }

    return { inputUsdPerMillion: 0.1, audioInputUsdPerMillion: 0.7, outputUsdPerMillion: 0.4, source: 'gemini_2_0_flash_standard_default' }
}

function getAudioPromptTokens(usage: GeminiUsageMetadata) {
    const details = usage.promptTokensDetails || []
    return details.reduce((sum, item) => {
        const modality = String(item?.modality || '').toLowerCase()
        if (modality !== 'audio') return sum
        return sum + toNumber(item?.tokenCount)
    }, 0)
}

export function estimateGeminiCost(params: {
    model: string
    usageMetadata: any
    usdToBrl?: number
}): Omit<GeminiUsageEntry, 'id' | 'provider' | 'feature' | 'status' | 'created_at' | 'metadata'> {
    const usage = normalizeGeminiUsageMetadata(params.usageMetadata)
    const pricing = getGeminiPricing(params.model)
    const usdToBrl = Number.isFinite(params.usdToBrl) && params.usdToBrl ? Number(params.usdToBrl) : DEFAULT_USD_TO_BRL
    const promptTokens = toNumber(usage.promptTokenCount)
    const thoughtsTokens = toNumber(usage.thoughtsTokenCount)
    const outputTokens = toNumber(usage.candidatesTokenCount) + thoughtsTokens
    const totalTokens = toNumber(usage.totalTokenCount) || promptTokens + outputTokens
    const audioInputTokens = Math.min(promptTokens, getAudioPromptTokens(usage))
    const textInputTokens = Math.max(0, promptTokens - audioInputTokens)
    const estimatedUsd = (
        (textInputTokens / 1_000_000) * pricing.inputUsdPerMillion
        + (audioInputTokens / 1_000_000) * pricing.audioInputUsdPerMillion
        + (outputTokens / 1_000_000) * pricing.outputUsdPerMillion
    )

    return {
        model: params.model,
        prompt_tokens: promptTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        audio_input_tokens: audioInputTokens,
        text_input_tokens: textInputTokens,
        estimated_usd: roundMoney(estimatedUsd),
        estimated_brl: roundMoney(estimatedUsd * usdToBrl),
        pricing,
    }
}

export async function getConfiguredUsdToBrl(admin = getSupabase()): Promise<number> {
    try {
        const { data } = await admin
            .from('app_config')
            .select('value')
            .eq('key', 'ai_cost_usd_to_brl_rate')
            .maybeSingle()
        const value = Number(String(data?.value || '').replace(',', '.'))
        return Number.isFinite(value) && value > 0 ? value : DEFAULT_USD_TO_BRL
    } catch {
        return DEFAULT_USD_TO_BRL
    }
}

export async function recordGeminiUsage(params: {
    model: string
    feature: string
    usageMetadata: any
    status?: 'success' | 'error'
    metadata?: Record<string, unknown>
}) {
    const usage = normalizeGeminiUsageMetadata(params.usageMetadata)
    if (!usage.totalTokenCount && !usage.promptTokenCount && !usage.candidatesTokenCount) return

    const supabase = getSupabase()
    try {
        const usdToBrl = await getConfiguredUsdToBrl(supabase)
        const createdAt = new Date().toISOString()
        const id = `${GEMINI_USAGE_PREFIX}${createdAt.replace(/\D/g, '')}_${crypto.randomBytes(4).toString('hex')}`
        const cost = estimateGeminiCost({ model: params.model, usageMetadata: usage, usdToBrl })
        const entry: GeminiUsageEntry = {
            id,
            provider: 'gemini',
            feature: params.feature || 'unknown',
            status: params.status || 'success',
            created_at: createdAt,
            metadata: params.metadata || {},
            ...cost,
        }

        await supabase.from('app_config').insert({
            key: id,
            value: JSON.stringify(entry),
            updated_at: createdAt,
        })
    } catch (error) {
        console.warn('[Gemini Costs] Failed to record usage:', error)
    }
}

function emptyTotals(): UsageTotals {
    return {
        calls: 0,
        prompt_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        estimated_usd: 0,
        estimated_brl: 0,
    }
}

function addEntryToTotals(total: UsageTotals, entry: GeminiUsageEntry) {
    total.calls += 1
    total.prompt_tokens += Number(entry.prompt_tokens || 0)
    total.output_tokens += Number(entry.output_tokens || 0)
    total.total_tokens += Number(entry.total_tokens || 0)
    total.estimated_usd += Number(entry.estimated_usd || 0)
    total.estimated_brl += Number(entry.estimated_brl || 0)
}

function finalizeTotals<T extends UsageTotals>(total: T): T {
    total.estimated_usd = roundMoney(total.estimated_usd)
    total.estimated_brl = roundMoney(total.estimated_brl)
    return total
}

function parseUsageEntry(row: any): GeminiUsageEntry | null {
    try {
        const parsed = JSON.parse(String(row?.value || '{}'))
        if (parsed?.provider !== 'gemini') return null
        return parsed as GeminiUsageEntry
    } catch {
        return null
    }
}

async function getConfigMap(admin: ReturnType<typeof getSupabase>, keys: string[]) {
    const map: Record<string, string> = {}
    try {
        const { data } = await admin
            .from('app_config')
            .select('key, value')
            .in('key', keys)

        for (const row of data || []) {
            if (row?.key && row?.value) map[row.key] = String(row.value)
        }
    } catch {
        // Environment variables still work when app_config is not reachable.
    }
    return map
}

function readServiceAccount(configMap: Record<string, string>) {
    const rawJson = configMap.gemini_billing_service_account_json || process.env.GEMINI_BILLING_SERVICE_ACCOUNT_JSON
    if (rawJson) {
        try {
            const parsed = JSON.parse(rawJson)
            return {
                clientEmail: String(parsed.client_email || '').trim(),
                privateKey: String(parsed.private_key || '').replace(/\\n/g, '\n'),
            }
        } catch {
            throw new Error('JSON da service account do Billing/BigQuery invalido.')
        }
    }

    return {
        clientEmail: String(configMap.gemini_billing_client_email || process.env.GEMINI_BILLING_CLIENT_EMAIL || '').trim(),
        privateKey: String(configMap.gemini_billing_private_key || process.env.GEMINI_BILLING_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }
}

async function getGeminiBillingConfig(admin: ReturnType<typeof getSupabase>): Promise<GeminiBillingConfig | null> {
    const keys = [
        'gemini_billing_bigquery_project_id',
        'gemini_billing_bigquery_dataset',
        'gemini_billing_bigquery_table',
        'gemini_billing_google_project_id',
        'gemini_billing_service_account_json',
        'gemini_billing_client_email',
        'gemini_billing_private_key',
    ]
    const configMap = await getConfigMap(admin, keys)
    const serviceAccount = readServiceAccount(configMap)
    const billingProjectId = String(configMap.gemini_billing_bigquery_project_id || process.env.GEMINI_BILLING_BIGQUERY_PROJECT_ID || '').trim()
    const dataset = String(configMap.gemini_billing_bigquery_dataset || process.env.GEMINI_BILLING_BIGQUERY_DATASET || '').trim()
    const table = String(configMap.gemini_billing_bigquery_table || process.env.GEMINI_BILLING_BIGQUERY_TABLE || '').trim()
    const geminiProjectId = String(configMap.gemini_billing_google_project_id || process.env.GEMINI_BILLING_GOOGLE_PROJECT_ID || '').trim()

    if (!billingProjectId || !dataset || !table || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
        return null
    }

    return {
        billingProjectId: safeBigQueryIdentifier(billingProjectId, 'projeto'),
        dataset: safeBigQueryIdentifier(dataset, 'dataset'),
        table: safeBigQueryIdentifier(table, 'tabela'),
        geminiProjectId: geminiProjectId ? safeBigQueryIdentifier(geminiProjectId, 'projeto Gemini') : undefined,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
    }
}

async function getGoogleAccessToken(config: GeminiBillingConfig) {
    const now = Math.floor(Date.now() / 1000)
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claims = base64Url(JSON.stringify({
        iss: config.clientEmail,
        scope: 'https://www.googleapis.com/auth/bigquery.readonly',
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
        throw new Error(`Erro OAuth Google Billing: ${data.error_description || data.error || res.statusText}`)
    }
    return String(data.access_token || '')
}

function bigQueryRowsToObjects(response: any): Record<string, unknown>[] {
    const fields = response?.schema?.fields || []
    return (response?.rows || []).map((row: any) => {
        const obj: Record<string, unknown> = {}
        fields.forEach((field: any, index: number) => {
            obj[field.name] = row?.f?.[index]?.v
        })
        return obj
    })
}

function convertOfficialCostToBrl(value: number, currency: string, usdToBrl: number) {
    const code = String(currency || '').toUpperCase()
    if (code === 'BRL' || code === 'R$') return value
    if (code === 'USD' || code === 'US$') return value * usdToBrl
    return value
}

async function runGeminiBillingQuery(config: GeminiBillingConfig, month: string) {
    const token = await getGoogleAccessToken(config)
    const { startDate, endDate } = monthDateRange(month)
    const tableRef = `\`${config.billingProjectId}.${config.dataset}.${config.table}\``
    const projectFilter = config.geminiProjectId ? 'AND project.id = @project_id' : ''
    const netCostExpression = 'CAST(cost AS FLOAT64) + IFNULL((SELECT SUM(CAST(c.amount AS FLOAT64)) FROM UNNEST(credits) c), 0)'
    const query = `
        SELECT
            COALESCE(service.description, '') AS service,
            COALESCE(sku.description, '') AS sku,
            COALESCE(project.id, '') AS project_id,
            COALESCE(project.name, '') AS project_name,
            COALESCE(currency, 'USD') AS currency,
            SUM(${netCostExpression}) AS month_cost,
            SUM(IF(DATE(usage_start_time, 'America/Sao_Paulo') = CURRENT_DATE('America/Sao_Paulo'), ${netCostExpression}, 0)) AS today_cost,
            SUM(IF(usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR), ${netCostExpression}, 0)) AS last_24h_cost,
            CAST(MAX(usage_end_time) AS STRING) AS latest_usage_end_time
        FROM ${tableRef}
        WHERE DATE(usage_start_time, 'America/Sao_Paulo') BETWEEN @start_date AND @end_date
            ${projectFilter}
            AND (
                LOWER(COALESCE(service.description, '')) LIKE '%gemini%'
                OR LOWER(COALESCE(service.description, '')) LIKE '%generative language%'
                OR LOWER(COALESCE(service.description, '')) LIKE '%google ai%'
                OR LOWER(COALESCE(sku.description, '')) LIKE '%gemini%'
                OR LOWER(COALESCE(sku.description, '')) LIKE '%generative language%'
                OR LOWER(COALESCE(sku.description, '')) LIKE '%google ai%'
            )
        GROUP BY service, sku, project_id, project_name, currency
        ORDER BY month_cost DESC
        LIMIT 25
    `
    const queryParameters: any[] = [
        { name: 'start_date', parameterType: { type: 'DATE' }, parameterValue: { value: startDate } },
        { name: 'end_date', parameterType: { type: 'DATE' }, parameterValue: { value: endDate } },
    ]
    if (config.geminiProjectId) {
        queryParameters.push({ name: 'project_id', parameterType: { type: 'STRING' }, parameterValue: { value: config.geminiProjectId } })
    }

    const res = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${config.billingProjectId}/queries`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            useLegacySql: false,
            parameterMode: 'NAMED',
            queryParameters,
            timeoutMs: 12000,
        }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
        throw new Error(`Erro BigQuery Billing: ${data.error?.message || res.statusText}`)
    }
    return data
}

async function getCachedOfficialBilling(admin: ReturnType<typeof getSupabase>, month: string): Promise<GeminiOfficialBillingSummary | null> {
    try {
        const { data } = await admin
            .from('app_config')
            .select('value, updated_at')
            .eq('key', `${GEMINI_BILLING_CACHE_PREFIX}${month}`)
            .maybeSingle()
        if (!data?.value || !data?.updated_at) return null
        const ageMs = Date.now() - new Date(data.updated_at).getTime()
        if (ageMs > OFFICIAL_BILLING_CACHE_MINUTES * 60 * 1000) return null
        const parsed = JSON.parse(String(data.value))
        if (parsed?.status === 'error' && isOptionalBillingConfigError(String(parsed?.message || ''))) {
            return {
                ...parsed,
                configured: false,
                status: 'not_configured',
                source: 'not_configured',
                message: 'Billing oficial opcional nao configurado corretamente. O painel esta usando o relatorio interno por tokens.',
                cache_updated_at: data.updated_at,
            } as GeminiOfficialBillingSummary
        }
        return { ...parsed, cache_updated_at: data.updated_at } as GeminiOfficialBillingSummary
    } catch {
        return null
    }
}

async function setCachedOfficialBilling(admin: ReturnType<typeof getSupabase>, month: string, summary: GeminiOfficialBillingSummary) {
    try {
        await admin.from('app_config').upsert({
            key: `${GEMINI_BILLING_CACHE_PREFIX}${month}`,
            value: JSON.stringify(summary),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
    } catch {
        // The official billing block is optional; never break the agent for cache failures.
    }
}

export async function loadGeminiOfficialBillingSummary(options: {
    admin?: ReturnType<typeof getSupabase>
    month?: string
    usdToBrl?: number
    forceRefresh?: boolean
}): Promise<GeminiOfficialBillingSummary> {
    const admin = options.admin || getSupabase()
    const month = options.month && /^\d{4}-\d{2}$/.test(options.month) ? options.month : currentMonthInSaoPaulo()
    const usdToBrl = Number(options.usdToBrl || DEFAULT_USD_TO_BRL)

    if (!options.forceRefresh) {
        const cached = await getCachedOfficialBilling(admin, month)
        if (cached) return cached
    }

    let config: GeminiBillingConfig | null = null
    try {
        config = await getGeminiBillingConfig(admin)
    } catch (error: any) {
        const rawMessage = error?.message || 'Configuracao oficial do Google Billing invalida.'
        return emptyOfficialBilling(
            month,
            isOptionalBillingConfigError(rawMessage)
                ? 'Billing oficial opcional nao configurado corretamente. O painel esta usando o relatorio interno por tokens.'
                : rawMessage,
            isOptionalBillingConfigError(rawMessage) ? 'not_configured' : 'error'
        )
    }

    if (!config) {
        return emptyOfficialBilling(month, 'Configure a exportacao do Cloud Billing para BigQuery e a service account para puxar o valor oficial do Google.')
    }

    try {
        const data = await runGeminiBillingQuery(config, month)
        const rows: GeminiOfficialBillingRow[] = bigQueryRowsToObjects(data).map((row: Record<string, unknown>) => {
            const currency = String(row.currency || 'USD')
            const monthCost = toNumber(row.month_cost)
            const todayCost = toNumber(row.today_cost)
            const last24hCost = toNumber(row.last_24h_cost)
            return {
                service: String(row.service || ''),
                sku: String(row.sku || ''),
                project_id: String(row.project_id || ''),
                project_name: String(row.project_name || ''),
                currency,
                month_cost: roundMoney(monthCost),
                today_cost: roundMoney(todayCost),
                last_24h_cost: roundMoney(last24hCost),
                month_cost_brl: roundMoney(convertOfficialCostToBrl(monthCost, currency, usdToBrl)),
                today_cost_brl: roundMoney(convertOfficialCostToBrl(todayCost, currency, usdToBrl)),
                last_24h_cost_brl: roundMoney(convertOfficialCostToBrl(last24hCost, currency, usdToBrl)),
                latest_usage_end_time: row.latest_usage_end_time ? String(row.latest_usage_end_time) : null,
            }
        })

        const latestUsageValues = rows
            .map(row => row.latest_usage_end_time)
            .filter((value): value is string => Boolean(value))
            .sort()
        const summary: GeminiOfficialBillingSummary = {
            configured: true,
            status: 'ok',
            source: 'cloud_billing_bigquery',
            message: rows.length > 0
                ? 'Faturamento oficial carregado do Cloud Billing exportado no BigQuery.'
                : 'Cloud Billing conectado, mas nao retornou custo Gemini para este periodo.',
            month,
            generated_at: new Date().toISOString(),
            billing_project_id: config.billingProjectId,
            gemini_project_id: config.geminiProjectId || null,
            table: `${config.billingProjectId}.${config.dataset}.${config.table}`,
            currency: rows.length > 0 ? Array.from(new Set(rows.map(row => row.currency))).join(', ') : undefined,
            month_cost: roundMoney(rows.reduce((sum, row) => sum + row.month_cost, 0)),
            today_cost: roundMoney(rows.reduce((sum, row) => sum + row.today_cost, 0)),
            last_24h_cost: roundMoney(rows.reduce((sum, row) => sum + row.last_24h_cost, 0)),
            month_cost_brl: roundMoney(rows.reduce((sum, row) => sum + row.month_cost_brl, 0)),
            today_cost_brl: roundMoney(rows.reduce((sum, row) => sum + row.today_cost_brl, 0)),
            last_24h_cost_brl: roundMoney(rows.reduce((sum, row) => sum + row.last_24h_cost_brl, 0)),
            latest_usage_end_time: latestUsageValues[latestUsageValues.length - 1] || null,
            rows,
        }
        await setCachedOfficialBilling(admin, month, summary)
        return summary
    } catch (error: any) {
        const rawMessage = error?.message || 'Nao foi possivel puxar o faturamento oficial do Google Billing.'
        const optionalConfigError = isOptionalBillingConfigError(rawMessage)
        const summary = emptyOfficialBilling(
            month,
            optionalConfigError
                ? 'Billing oficial opcional nao configurado corretamente. O painel esta usando o relatorio interno por tokens.'
                : rawMessage,
            optionalConfigError ? 'not_configured' : 'error'
        )
        summary.configured = !optionalConfigError
        summary.source = optionalConfigError ? 'not_configured' : 'cloud_billing_bigquery'
        summary.billing_project_id = config.billingProjectId
        summary.gemini_project_id = config.geminiProjectId || null
        summary.table = `${config.billingProjectId}.${config.dataset}.${config.table}`
        return summary
    }
}

export async function loadGeminiUsageSummary(options?: {
    month?: string
    limit?: number
    admin?: ReturnType<typeof getSupabase>
    refreshOfficial?: boolean
}): Promise<GeminiUsageSummary> {
    const admin = options?.admin || getSupabase()
    const month = options?.month && /^\d{4}-\d{2}$/.test(options.month) ? options.month : currentMonthInSaoPaulo()
    const limit = Math.max(100, Math.min(options?.limit || 3000, 8000))
    const usdToBrl = await getConfiguredUsdToBrl(admin)
    const { data, error } = await admin
        .from('app_config')
        .select('key, value, updated_at')
        .like('key', `${GEMINI_USAGE_PREFIX}%`)
        .gte('updated_at', monthStart(month))
        .lte('updated_at', monthEnd(month))
        .order('updated_at', { ascending: false })
        .limit(limit)

    if (error) throw error

    const entries = (data || [])
        .map(parseUsageEntry)
        .filter(Boolean) as GeminiUsageEntry[]

    const today = todayInSaoPaulo()
    const last24hCutoff = Date.now() - 24 * 60 * 60 * 1000
    const monthTotal = emptyTotals()
    const todayTotal = emptyTotals()
    const last24hTotal = emptyTotals()
    const byModel = new Map<string, UsageTotals & { model: string }>()
    const byFeature = new Map<string, UsageTotals & { feature: string }>()

    for (const entry of entries) {
        addEntryToTotals(monthTotal, entry)
        if (entry.created_at.slice(0, 10) === today) addEntryToTotals(todayTotal, entry)
        if (new Date(entry.created_at).getTime() >= last24hCutoff) addEntryToTotals(last24hTotal, entry)

        const modelRow = byModel.get(entry.model) || { model: entry.model, ...emptyTotals() }
        addEntryToTotals(modelRow, entry)
        byModel.set(entry.model, modelRow)

        const featureRow = byFeature.get(entry.feature) || { feature: entry.feature, ...emptyTotals() }
        addEntryToTotals(featureRow, entry)
        byFeature.set(entry.feature, featureRow)
    }

    const officialBilling = await loadGeminiOfficialBillingSummary({
        admin,
        month,
        usdToBrl,
        forceRefresh: options?.refreshOfficial,
    })

    return {
        month,
        generated_at: new Date().toISOString(),
        usd_to_brl: usdToBrl,
        month_total: finalizeTotals(monthTotal),
        today_total: finalizeTotals(todayTotal),
        last_24h_total: finalizeTotals(last24hTotal),
        by_model: Array.from(byModel.values()).map(finalizeTotals).sort((a, b) => b.estimated_brl - a.estimated_brl),
        by_feature: Array.from(byFeature.values()).map(finalizeTotals).sort((a, b) => b.estimated_brl - a.estimated_brl),
        official_billing: officialBilling,
        recent: entries.slice(0, 30),
    }
}

async function getOrCreateAICostCenter(admin: any) {
    const { data: existing } = await admin
        .from('finance_cost_centers')
        .select('id')
        .or('name.ilike.IA%,name.ilike.Tecnologia%,code.ilike.IA%')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

    if (existing?.id) return existing.id

    const { data, error } = await admin
        .from('finance_cost_centers')
        .insert({ name: 'IA e Automacao', code: 'IA', is_active: true })
        .select('id')
        .single()

    if (error) return null
    return data?.id || null
}

export async function syncGeminiUsageToFinance(admin: any, options?: { month?: string }) {
    const summary = await loadGeminiUsageSummary({ admin, month: options?.month, refreshOfficial: true })
    const officialBilling = summary.official_billing
    const useOfficial = officialBilling.status === 'ok' && officialBilling.month_cost_brl > 0
    const amount = roundCurrency(useOfficial ? officialBilling.month_cost_brl : summary.month_total.estimated_brl)
    const month = summary.month
    const entryDate = todayInSaoPaulo()
    const costCenterId = await getOrCreateAICostCenter(admin)
    const externalReference = `gemini_usage:${month}`

    if (amount <= 0) {
        return { success: true, action: 'skipped', month, amount, entry_id: null, summary }
    }

    const payload: Record<string, any> = {
        description: `Gemini API - uso estimado - ${month.slice(5, 7)}/${month.slice(0, 4)}`,
        entry_type: 'expense',
        amount,
        category: 'Tecnologia',
        subcategory: 'IA Gemini',
        entry_date: entryDate,
        occurred_at: `${entryDate}T12:00:00.000Z`,
        payment_method: 'Cartao',
        payment_status: 'pending',
        counterparty_name: 'Google Gemini API',
        counterparty_type: 'pessoa_juridica',
        reference_company: 'Google',
        due_date: entryDate,
        competence_date: `${month}-01`,
        cost_center_id: costCenterId,
        notes: useOfficial
            ? `Lancamento automatico pelo faturamento oficial do Google Billing/BigQuery. Valor original: ${officialBilling.currency || 'moeda da conta'} ${officialBilling.month_cost.toFixed(6)}. Tokens locais no periodo: entrada ${summary.month_total.prompt_tokens}, saida ${summary.month_total.output_tokens}, total ${summary.month_total.total_tokens}. Chamadas locais: ${summary.month_total.calls}.`
            : `Lancamento automatico estimado por tokens do Gemini. Chamadas: ${summary.month_total.calls}. Tokens: entrada ${summary.month_total.prompt_tokens}, saida ${summary.month_total.output_tokens}, total ${summary.month_total.total_tokens}. USD estimado: ${summary.month_total.estimated_usd.toFixed(6)}. Cambio config: ${summary.usd_to_brl}. Conferir com Cloud Billing no fechamento.`,
        source_module: 'ai_usage_gemini',
        external_reference: externalReference,
        updated_at: new Date().toISOString(),
    }

    const { data: existing, error: existingError } = await admin
        .from('finance_entries')
        .select('id')
        .eq('source_module', 'ai_usage_gemini')
        .eq('external_reference', externalReference)
        .maybeSingle()

    if (existingError) throw existingError

    if (existing?.id) {
        const { error } = await admin
            .from('finance_entries')
            .update(payload)
            .eq('id', existing.id)
        if (error) throw error
        return { success: true, action: 'updated', month, amount, entry_id: existing.id, summary }
    }

    const { data: inserted, error } = await admin
        .from('finance_entries')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select('id')
        .single()

    if (error) throw error
    return { success: true, action: 'inserted', month, amount, entry_id: inserted?.id || null, summary }
}
