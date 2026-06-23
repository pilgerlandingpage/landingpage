// =============================================
// Meta Marketing API Service
// =============================================
// Integração com a Meta Graph API para gerenciar
// campanhas, criativos e buscar métricas.
//
// Documentação: https://developers.facebook.com/docs/marketing-apis/
// =============================================

import type {
    MetaCampaignConfig,
    MetaAdSetConfig,
    MetaInsightsResponse,
    MetricsSnapshot
} from './types'
import { createAdminClient } from '../supabase/server'
import { resolveMetaPixelId } from '@/lib/tracking/meta-pixel'

const META_API_VERSION = 'v21.0'

function getBaseUrl(): string {
    return `https://graph.facebook.com/${META_API_VERSION}`
}

function centsToCurrency(value: any) {
    const amount = Number(value || 0)
    return Number.isFinite(amount) ? amount / 100 : 0
}

function metaAccountStatusLabel(status: number | string | null | undefined) {
    const numericStatus = Number(status)
    const labels: Record<number, string> = {
        1: 'Ativa',
        2: 'Desativada',
        3: 'Pendente de pagamento',
        7: 'Pendente de revisao',
        8: 'Aguardando liquidacao',
        9: 'Em periodo de carencia',
        100: 'Fechamento pendente',
        101: 'Fechada',
    }

    return labels[numericStatus] || `Status ${status || 'desconhecido'}`
}

function metaAccountHealthMessage(status: number, balance: number) {
    if (status === 1) return 'Conta Meta ativa para veiculacao.'
    if (status === 3) {
        return balance > 0
            ? `Conta Meta com pendencia de pagamento. Saldo/pendencia informado pela Meta: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
            : 'Conta Meta com pendencia de pagamento. A entrega pode ficar pausada ate a regularizacao.'
    }
    return 'Conta Meta nao esta ativa. Verifique o Gerenciador de Anuncios antes de avaliar performance.'
}

async function getMetaConfig() {
    const supabase = createAdminClient();
    const { data } = await supabase.from('app_config').select('key, value').in('key', ['meta_access_token', 'meta_ad_account_id', 'meta_pixel_id']);

    const configMap = (data || []).reduce((acc: any, row: any) => {
        acc[row.key] = row.value;
        return acc;
    }, {});

    const token = configMap['meta_access_token'] || process.env.META_ACCESS_TOKEN;
    if (!token) throw new Error('META_ACCESS_TOKEN não configurado.');

    const id = configMap['meta_ad_account_id'] || process.env.META_AD_ACCOUNT_ID;
    if (!id) throw new Error('META_AD_ACCOUNT_ID não configurado.');

    return {
        accessToken: token,
        adAccountId: id.startsWith('act_') ? id : `act_${id}`,
        pixelId: resolveMetaPixelId(configMap['meta_pixel_id'], process.env.META_PIXEL_ID)
    };
}

type MetaApiParams = Record<string, string | number | boolean | null | undefined>

function buildMetaUrl(path: string, params: MetaApiParams) {
    const url = new URL(`${getBaseUrl()}/${path.replace(/^\//, '')}`)
    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined || value === '') continue
        url.searchParams.set(key, String(value))
    }
    return url.toString()
}

async function fetchMetaPaged(path: string, params: MetaApiParams): Promise<any[]> {
    let url = buildMetaUrl(path, params)
    const rows: any[] = []

    while (url) {
        const res = await fetch(url)
        const data = await res.json()

        if (data.error) {
            throw new Error(data.error.message || 'Erro desconhecido na Meta API.')
        }

        rows.push(...(data.data || []))
        url = data.paging?.next || ''
    }

    return rows
}

function parseMetaNumber(value: unknown) {
    const parsed = Number(value || 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function metricArrayValue(rows: any[] | undefined, keys: string[] = ['value']) {
    const first = rows?.[0]
    if (!first) return 0
    for (const key of keys) {
        if (first[key] !== undefined) return parseMetaNumber(first[key])
    }
    return 0
}

function actionValue(actions: any[] | undefined, actionTypes: string[]) {
    return (actions || [])
        .filter(action => actionTypes.includes(String(action.action_type || '')))
        .reduce((sum, action) => sum + parseMetaNumber(action.value), 0)
}

function costActionValue(actions: any[] | undefined, actionTypes: string[]) {
    const first = (actions || []).find(action => actionTypes.includes(String(action.action_type || '')))
    return first ? parseMetaNumber(first.value) : 0
}

function baseInsightFields(level: MetaInsightLevel) {
    const identityFields: Record<MetaInsightLevel, string[]> = {
        account: [],
        campaign: ['campaign_id', 'campaign_name'],
        adset: ['campaign_id', 'campaign_name', 'adset_id', 'adset_name'],
        ad: ['campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name'],
    }

    return [
        ...identityFields[level],
        'date_start', 'date_stop',
        'impressions', 'clicks', 'ctr', 'cpm', 'cpc', 'spend',
        'actions', 'frequency', 'reach', 'unique_clicks',
        'outbound_clicks', 'inline_link_clicks', 'inline_link_click_ctr',
        'cost_per_action_type',
        'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
        'video_thruplay_watched_actions', 'video_p25_watched_actions',
        'video_p50_watched_actions', 'video_p75_watched_actions',
        'video_p100_watched_actions', 'video_avg_time_watched_actions',
    ]
}

export type MetaInsightLevel = 'account' | 'campaign' | 'adset' | 'ad'

export type MetaTrafficInsightQuery = {
    level?: MetaInsightLevel
    datePreset?: DatePreset | 'custom'
    timeRange?: { since: string; until: string }
    breakdowns?: string[]
    timeIncrement?: string | number
    actionBreakdowns?: string[]
    limit?: number
}

export type MetaTrafficManagerSnapshot = {
    generated_at: string
    date_preset: string
    totals: {
        spend: number
        impressions: number
        reach: number
        clicks: number
        leads: number
        conversations: number
        landing_page_views: number
        link_clicks: number
        post_engagements: number
        avg_ctr: number
        avg_cpc: number
        avg_cpm: number
        avg_cpl: number
        frequency: number
    }
    coverage: {
        campaigns: number
        adsets: number
        ads: number
        lead_forms: number
        placements: number
        devices: number
        demographics: number
        daily_points: number
    }
    top_campaigns: any[]
    top_adsets: any[]
    top_ads: any[]
    placements: any[]
    devices: any[]
    demographics: any[]
    daily_series: any[]
    lead_forms: any[]
    diagnostics: string[]
}

function normalizeInsightRow(row: any) {
    const spend = parseMetaNumber(row.spend)
    const impressions = parseMetaNumber(row.impressions)
    const clicks = parseMetaNumber(row.clicks)
    const leads = actionValue(row.actions, ['lead', 'onsite_conversion.lead_grouped'])
    const conversations = actionValue(row.actions, ['onsite_conversion.messaging_conversation_started_7d'])
    const landingPageViews = actionValue(row.actions, ['landing_page_view'])
    const linkClicks = actionValue(row.actions, ['link_click'])
    const postEngagements = actionValue(row.actions, ['post_engagement'])

    return {
        ...row,
        spend,
        impressions,
        clicks,
        reach: parseMetaNumber(row.reach),
        unique_clicks: parseMetaNumber(row.unique_clicks),
        leads,
        conversations,
        landing_page_views: landingPageViews,
        link_clicks: linkClicks || parseMetaNumber(row.inline_link_clicks),
        outbound_clicks: metricArrayValue(row.outbound_clicks, ['outbound_click', 'value']),
        post_engagements: postEngagements,
        ctr: parseMetaNumber(row.ctr),
        cpm: parseMetaNumber(row.cpm),
        cpc: parseMetaNumber(row.cpc),
        cpl: leads > 0 ? spend / leads : costActionValue(row.cost_per_action_type, ['lead', 'onsite_conversion.lead_grouped']),
        frequency: parseMetaNumber(row.frequency),
        thumbstop: impressions > 0 ? metricArrayValue(row.video_p25_watched_actions) / impressions : 0,
        video_p50: metricArrayValue(row.video_p50_watched_actions),
        video_p75: metricArrayValue(row.video_p75_watched_actions),
        video_p100: metricArrayValue(row.video_p100_watched_actions),
        video_avg_watch_time: metricArrayValue(row.video_avg_time_watched_actions),
    }
}

function aggregateInsightRows(rows: any[]) {
    const normalized = rows.map(normalizeInsightRow)
    const totals = normalized.reduce((acc, row) => {
        acc.spend += row.spend
        acc.impressions += row.impressions
        acc.reach += row.reach
        acc.clicks += row.clicks
        acc.leads += row.leads
        acc.conversations += row.conversations
        acc.landing_page_views += row.landing_page_views
        acc.link_clicks += row.link_clicks
        acc.post_engagements += row.post_engagements
        acc.frequency_weight += row.frequency * row.reach
        acc.frequency_reach += row.reach
        return acc
    }, {
        spend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        leads: 0,
        conversations: 0,
        landing_page_views: 0,
        link_clicks: 0,
        post_engagements: 0,
        frequency_weight: 0,
        frequency_reach: 0,
    })

    return {
        spend: Number(totals.spend.toFixed(2)),
        impressions: totals.impressions,
        reach: totals.reach,
        clicks: totals.clicks,
        leads: totals.leads,
        conversations: totals.conversations,
        landing_page_views: totals.landing_page_views,
        link_clicks: totals.link_clicks,
        post_engagements: totals.post_engagements,
        avg_ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        avg_cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        avg_cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
        avg_cpl: totals.leads > 0 ? totals.spend / totals.leads : 0,
        frequency: totals.frequency_reach > 0 ? totals.frequency_weight / totals.frequency_reach : 0,
    }
}

function aggregateBy(rows: any[], keyBuilder: (row: any) => Record<string, string>) {
    const map = new Map<string, any>()
    for (const raw of rows) {
        const row = normalizeInsightRow(raw)
        const keys = keyBuilder(row)
        const id = Object.entries(keys).map(([key, value]) => `${key}:${value || 'n/a'}`).join('|')
        const current = map.get(id) || {
            ...keys,
            spend: 0,
            impressions: 0,
            reach: 0,
            clicks: 0,
            leads: 0,
            conversations: 0,
            landing_page_views: 0,
            link_clicks: 0,
        }

        current.spend += row.spend
        current.impressions += row.impressions
        current.reach += row.reach
        current.clicks += row.clicks
        current.leads += row.leads
        current.conversations += row.conversations
        current.landing_page_views += row.landing_page_views
        current.link_clicks += row.link_clicks
        map.set(id, current)
    }

    return Array.from(map.values()).map(item => ({
        ...item,
        spend: Number(item.spend.toFixed(2)),
        ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
        cpl: item.leads > 0 ? item.spend / item.leads : 0,
        cpc: item.clicks > 0 ? item.spend / item.clicks : 0,
    })).sort((a, b) => b.spend - a.spend)
}

// --- Autenticação e Teste de Conexão ---

export async function testConnection(): Promise<{ success: boolean; message: string }> {
    try {
        const conf = await getMetaConfig();
        const res = await fetch(
            `${getBaseUrl()}/${conf.adAccountId}?fields=name,account_status,currency&access_token=${conf.accessToken}`
        )
        const data = await res.json()

        if (data.error) {
            return { success: false, message: `Erro Meta: ${data.error.message}` }
        }

        const statusMap: Record<number, string> = {
            1: 'Ativa',
            2: 'Desativada',
            3: 'Não confirmada',
            7: 'Pendente de revisão',
            100: 'Fechada',
        }

        return {
            success: true,
            message: `Conectado! Conta: ${data.name} | Status: ${statusMap[data.account_status] || data.account_status} | Moeda: ${data.currency}`
        }
    } catch (err) {
        return { success: false, message: `Falha na conexão: ${String(err)}` }
    }
}

export async function getAdAccountHealth() {
    const conf = await getMetaConfig()
    const res = await fetch(
        `${getBaseUrl()}/${conf.adAccountId}?fields=name,account_status,disable_reason,currency,timezone_name,amount_spent,balance&access_token=${conf.accessToken}`
    )
    const data = await res.json()

    if (data.error) {
        throw new Error(`Erro ao verificar conta Meta: ${data.error.message}`)
    }

    const status = Number(data.account_status || 0)
    const balance = centsToCurrency(data.balance)
    const paymentIssue = status === 3
    const active = status === 1

    return {
        account_id: data.id,
        name: data.name,
        status,
        status_label: metaAccountStatusLabel(status),
        disable_reason: Number(data.disable_reason || 0),
        currency: data.currency,
        timezone_name: data.timezone_name,
        amount_spent: centsToCurrency(data.amount_spent),
        balance,
        is_active: active,
        is_payment_issue: paymentIssue,
        severity: active ? 'ok' : paymentIssue ? 'error' : 'warning',
        message: metaAccountHealthMessage(status, balance),
    }
}

// --- Upload de Criativos ---

export async function uploadImage(imageUrl: string): Promise<string> {
    const conf = await getMetaConfig();
    const res = await fetch(
        `${getBaseUrl()}/${conf.adAccountId}/adimages`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: conf.accessToken,
                url: imageUrl
            })
        }
    )
    const data = await res.json()
    if (data.error) throw new Error(`Erro ao enviar imagem: ${data.error.message}`)

    // Retorna o hash da imagem (usado como identificador)
    const images = data.images
    const firstKey = Object.keys(images)[0]
    return images[firstKey].hash
}

export async function uploadVideo(videoUrl: string, title: string): Promise<string> {
    const conf = await getMetaConfig();
    const res = await fetch(
        `${getBaseUrl()}/${conf.adAccountId}/advideos`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: conf.accessToken,
                file_url: videoUrl,
                title
            })
        }
    )
    const data = await res.json()
    if (data.error) throw new Error(`Erro ao enviar vídeo: ${data.error.message}`)
    return data.id
}

// --- Criação de Campanhas ---

export async function createCampaign(config: MetaCampaignConfig): Promise<string> {
    const conf = await getMetaConfig();
    const res = await fetch(
        `${getBaseUrl()}/${conf.adAccountId}/campaigns`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: conf.accessToken,
                name: config.name,
                objective: config.objective,
                status: config.status,
                special_ad_categories: ['HOUSING'], // Obrigatório para imobiliário
            })
        }
    )
    const data = await res.json()
    if (data.error) throw new Error(`Erro ao criar campanha: ${data.error.message}`)
    return data.id
}

// --- Criação de Conjunto de Anúncios (Ad Set) ---

export async function createAdSet(config: MetaAdSetConfig): Promise<string> {
    const conf = await getMetaConfig();
    const res = await fetch(
        `${getBaseUrl()}/${conf.adAccountId}/adsets`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: conf.accessToken,
                campaign_id: config.campaign_id,
                name: config.name,
                daily_budget: config.daily_budget, // Em centavos
                billing_event: 'IMPRESSIONS',
                optimization_goal: config.optimization_goal,
                targeting: config.targeting,
                status: 'PAUSED', // Começa pausado, ativa depois
            })
        }
    )
    const data = await res.json()
    if (data.error) throw new Error(`Erro ao criar ad set: ${data.error.message}`)
    return data.id
}

// --- Criação de Anúncio ---

export async function createAd(
    adSetId: string,
    creativeId: string,
    name: string
): Promise<string> {
    const conf = await getMetaConfig();
    const res = await fetch(
        `${getBaseUrl()}/${conf.adAccountId}/ads`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: conf.accessToken,
                adset_id: adSetId,
                creative: { creative_id: creativeId },
                name,
                status: 'PAUSED',
            })
        }
    )
    const data = await res.json()
    if (data.error) throw new Error(`Erro ao criar anúncio: ${data.error.message}`)
    return data.id
}

// --- Controle de Status ---

export async function updateCampaignStatus(
    campaignId: string,
    status: 'ACTIVE' | 'PAUSED'
): Promise<void> {
    const conf = await getMetaConfig();
    const res = await fetch(
        `${getBaseUrl()}/${campaignId}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: conf.accessToken,
                status
            })
        }
    )
    const data = await res.json()
    if (data.error) throw new Error(`Erro ao atualizar status: ${data.error.message}`)
}

export async function updateAdStatus(
    adId: string,
    status: 'ACTIVE' | 'PAUSED'
): Promise<void> {
    const conf = await getMetaConfig();
    const res = await fetch(
        `${getBaseUrl()}/${adId}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: conf.accessToken,
                status
            })
        }
    )
    const data = await res.json()
    if (data.error) throw new Error(`Erro ao atualizar anúncio: ${data.error.message}`)
}

// --- Controle de Orçamento ---

export async function updateDailyBudget(
    adSetId: string,
    newBudgetCents: number
): Promise<void> {
    const conf = await getMetaConfig();
    const res = await fetch(
        `${getBaseUrl()}/${adSetId}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: conf.accessToken,
                daily_budget: newBudgetCents
            })
        }
    )
    const data = await res.json()
    if (data.error) throw new Error(`Erro ao atualizar orçamento: ${data.error.message}`)
}

// --- Buscar Métricas (Insights) ---

export async function getInsights(
    objectId: string,
    datePreset: 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'maximum' = 'today'
): Promise<MetaInsightsResponse | null> {
    const conf = await getMetaConfig();
    const fields = [
        'impressions', 'clicks', 'ctr', 'cpm', 'cpc', 'spend',
        'actions', 'frequency', 'reach', 'unique_clicks',
        'outbound_clicks', 'inline_link_clicks', 'inline_link_click_ctr',
        'cost_per_action_type',
        'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
        'video_thruplay_watched_actions', 'video_p25_watched_actions',
        'video_p50_watched_actions', 'video_p75_watched_actions',
        'video_p100_watched_actions', 'video_avg_time_watched_actions'
    ].join(',')

    const res = await fetch(
        `${getBaseUrl()}/${objectId}/insights?fields=${fields}&date_preset=${datePreset}&access_token=${conf.accessToken}`
    )
    const data = await res.json()

    if (data.error) {
        console.error(`Erro ao buscar insights: ${data.error.message}`)
        return null
    }

    return data.data?.[0] || null
}

export async function getAllCampaigns(): Promise<any[]> {
    const conf = await getMetaConfig();
    const fields = ['id', 'name', 'status', 'objective', 'daily_budget', 'lifetime_budget', 'start_time', 'stop_time'].join(',');
    const campaigns: any[] = []

    // We fetch campaigns that are active or paused
    let url = `${getBaseUrl()}/${conf.adAccountId}/campaigns?fields=${fields}&effective_status=['ACTIVE','PAUSED']&limit=500&access_token=${conf.accessToken}`

    while (url) {
        const res = await fetch(url)
        const data = await res.json()

        if (data.error) {
            console.error(`Erro ao buscar campanhas: ${data.error.message}`)
            return campaigns
        }

        campaigns.push(...(data.data || []))
        url = data.paging?.next || ''
    }

    return campaigns;
}

// --- Buscar Insights de TODAS as campanhas de uma só vez ---

export type DatePreset = 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'this_month' | 'last_month' | 'maximum'

export async function getAccountInsightsByCampaign(
    datePreset: DatePreset | 'custom' = 'maximum',
    timeRange?: { since: string; until: string }
): Promise<Record<string, MetaInsightsResponse>> {
    const conf = await getMetaConfig();
    const fields = [
        'campaign_id', 'campaign_name',
        'impressions', 'clicks', 'ctr', 'cpm', 'cpc', 'spend',
        'actions', 'frequency', 'reach', 'unique_clicks',
        'outbound_clicks', 'inline_link_clicks', 'inline_link_click_ctr',
        'cost_per_action_type',
        'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
        'video_thruplay_watched_actions', 'video_p25_watched_actions',
        'video_p50_watched_actions', 'video_p75_watched_actions',
        'video_p100_watched_actions', 'video_avg_time_watched_actions'
    ].join(',')

    let url = `${getBaseUrl()}/${conf.adAccountId}/insights?fields=${fields}&level=campaign&limit=500&access_token=${conf.accessToken}`;
    
    if (datePreset === 'custom' && timeRange) {
        const tr = JSON.stringify({ since: timeRange.since, until: timeRange.until });
        url += `&time_range=${encodeURIComponent(tr)}`;
    } else {
        url += `&date_preset=${datePreset === 'custom' ? 'maximum' : datePreset}`;
    }
    const map: Record<string, MetaInsightsResponse> = {}

    while (url) {
        const res = await fetch(url)
        const data = await res.json()

    if (data.error) {
        console.error(`Erro ao buscar insights da conta: ${data.error.message}`)
        return map
    }

    // Mapear por campaign_id para fácil lookup
    for (const row of (data.data || [])) {
        map[row.campaign_id] = row
    }
        url = data.paging?.next || ''
    }

    return map
}

export async function getTrafficInsightsRows({
    level = 'campaign',
    datePreset = 'last_30d',
    timeRange,
    breakdowns = [],
    timeIncrement,
    actionBreakdowns = [],
    limit = 500,
}: MetaTrafficInsightQuery = {}): Promise<any[]> {
    const conf = await getMetaConfig()
    const params: MetaApiParams = {
        fields: baseInsightFields(level).join(','),
        level,
        limit,
        access_token: conf.accessToken,
    }

    if (breakdowns.length > 0) params.breakdowns = breakdowns.join(',')
    if (actionBreakdowns.length > 0) params.action_breakdowns = actionBreakdowns.join(',')
    if (timeIncrement) params.time_increment = timeIncrement

    if (datePreset === 'custom' && timeRange) {
        params.time_range = JSON.stringify({ since: timeRange.since, until: timeRange.until })
    } else {
        params.date_preset = datePreset === 'custom' ? 'last_30d' : datePreset
    }

    return fetchMetaPaged(`${conf.adAccountId}/insights`, params)
}

export async function getAllAdSets(): Promise<any[]> {
    const conf = await getMetaConfig()
    const fields = [
        'id', 'name', 'status', 'effective_status',
        'campaign_id', 'daily_budget', 'lifetime_budget',
        'bid_strategy', 'billing_event', 'optimization_goal',
        'start_time', 'end_time', 'targeting', 'promoted_object',
    ].join(',')

    return fetchMetaPaged(`${conf.adAccountId}/adsets`, {
        fields,
        effective_status: "['ACTIVE','PAUSED','IN_PROCESS','WITH_ISSUES']",
        limit: 500,
        access_token: conf.accessToken,
    })
}

export async function getAllAdsWithCreatives(): Promise<any[]> {
    const conf = await getMetaConfig()
    const fields = [
        'id', 'name', 'status', 'effective_status',
        'campaign_id', 'adset_id', 'created_time', 'updated_time',
        'creative{id,name,title,body,thumbnail_url,image_url,object_story_spec,call_to_action_type}',
    ].join(',')

    try {
        return await fetchMetaPaged(`${conf.adAccountId}/ads`, {
            fields,
            effective_status: "['ACTIVE','PAUSED','IN_PROCESS','WITH_ISSUES']",
            limit: 500,
            access_token: conf.accessToken,
        })
    } catch (error) {
        console.warn('[Meta Ads] Falha ao buscar criativos completos, usando fallback:', error instanceof Error ? error.message : error)
        return fetchMetaPaged(`${conf.adAccountId}/ads`, {
            fields: 'id,name,status,effective_status,campaign_id,adset_id,created_time,updated_time,creative{id,name,thumbnail_url}',
            effective_status: "['ACTIVE','PAUSED','IN_PROCESS','WITH_ISSUES']",
            limit: 500,
            access_token: conf.accessToken,
        })
    }
}

async function safeTrafficRows(label: string, query: MetaTrafficInsightQuery) {
    try {
        return await getTrafficInsightsRows(query)
    } catch (error) {
        console.warn(`[Meta Traffic Manager] ${label} indisponivel:`, error instanceof Error ? error.message : error)
        return []
    }
}

function summarizeEntityRows(rows: any[], idKey: string, nameKey: string, extra?: (row: any) => Record<string, unknown>) {
    return rows
        .map(row => {
            const normalized = normalizeInsightRow(row)
            return {
                id: row[idKey],
                name: row[nameKey] || row[idKey],
                campaign_id: row.campaign_id,
                campaign_name: row.campaign_name,
                adset_id: row.adset_id,
                adset_name: row.adset_name,
                spend: normalized.spend,
                impressions: normalized.impressions,
                reach: normalized.reach,
                clicks: normalized.clicks,
                leads: normalized.leads,
                conversations: normalized.conversations,
                landing_page_views: normalized.landing_page_views,
                link_clicks: normalized.link_clicks,
                ctr: normalized.ctr,
                cpc: normalized.cpc,
                cpm: normalized.cpm,
                cpl: normalized.cpl,
                frequency: normalized.frequency,
                quality_ranking: row.quality_ranking,
                engagement_rate_ranking: row.engagement_rate_ranking,
                conversion_rate_ranking: row.conversion_rate_ranking,
                thumbstop: normalized.thumbstop,
                video_p50: normalized.video_p50,
                video_p75: normalized.video_p75,
                video_p100: normalized.video_p100,
                ...(extra ? extra(row) : {}),
            }
        })
        .sort((a, b) => b.spend - a.spend)
}

export async function getMetaTrafficManagerSnapshot({
    datePreset = 'last_30d',
    timeRange,
}: {
    datePreset?: DatePreset | 'custom'
    timeRange?: { since: string; until: string }
} = {}): Promise<MetaTrafficManagerSnapshot> {
    const [
        campaignInsights,
        adsetInsights,
        adInsights,
        placementRows,
        deviceRows,
        demographicRows,
        dailyRows,
        adsets,
        ads,
        leadForms,
    ] = await Promise.all([
        safeTrafficRows('campanhas', { level: 'campaign', datePreset, timeRange }),
        safeTrafficRows('conjuntos', { level: 'adset', datePreset, timeRange }),
        safeTrafficRows('anuncios', { level: 'ad', datePreset, timeRange }),
        safeTrafficRows('posicionamentos', { level: 'ad', datePreset, timeRange, breakdowns: ['publisher_platform', 'platform_position'] }),
        safeTrafficRows('dispositivos', { level: 'ad', datePreset, timeRange, breakdowns: ['device_platform'] }),
        safeTrafficRows('publico', { level: 'ad', datePreset, timeRange, breakdowns: ['age', 'gender'] }),
        safeTrafficRows('serie diaria', { level: 'account', datePreset, timeRange, timeIncrement: 1 }),
        getAllAdSets().catch(error => {
            console.warn('[Meta Traffic Manager] adsets indisponiveis:', error instanceof Error ? error.message : error)
            return []
        }),
        getAllAdsWithCreatives().catch(error => {
            console.warn('[Meta Traffic Manager] ads indisponiveis:', error instanceof Error ? error.message : error)
            return []
        }),
        getLeadForms().catch(() => []),
    ])

    const adsetById = new Map((adsets || []).map((item: any) => [String(item.id), item]))
    const adById = new Map((ads || []).map((item: any) => [String(item.id), item]))
    const topCampaigns = summarizeEntityRows(campaignInsights, 'campaign_id', 'campaign_name').slice(0, 12)
    const topAdsets = summarizeEntityRows(adsetInsights, 'adset_id', 'adset_name', row => {
        const adset = adsetById.get(String(row.adset_id)) || {}
        return {
            status: adset.effective_status || adset.status,
            daily_budget: centsToCurrency(adset.daily_budget),
            lifetime_budget: centsToCurrency(adset.lifetime_budget),
            optimization_goal: adset.optimization_goal,
            bid_strategy: adset.bid_strategy,
            targeting: adset.targeting,
        }
    }).slice(0, 12)
    const topAds = summarizeEntityRows(adInsights, 'ad_id', 'ad_name', row => {
        const ad = adById.get(String(row.ad_id)) || {}
        const creative = ad.creative || {}
        return {
            status: ad.effective_status || ad.status,
            creative_id: creative.id,
            creative_name: creative.name,
            creative_title: creative.title,
            creative_body: creative.body,
            creative_thumbnail_url: creative.thumbnail_url || creative.image_url,
            call_to_action_type: creative.call_to_action_type,
        }
    }).slice(0, 16)

    const totals = aggregateInsightRows(campaignInsights.length > 0 ? campaignInsights : adInsights)
    const placements = aggregateBy(placementRows, row => ({
        publisher_platform: row.publisher_platform || 'nao informado',
        platform_position: row.platform_position || 'nao informado',
    })).slice(0, 16)
    const devices = aggregateBy(deviceRows, row => ({
        device_platform: row.device_platform || 'nao informado',
    })).slice(0, 10)
    const demographics = aggregateBy(demographicRows, row => ({
        age: row.age || 'nao informado',
        gender: row.gender || 'nao informado',
    })).slice(0, 16)
    const dailySeries = dailyRows.map(row => {
        const normalized = normalizeInsightRow(row)
        return {
            date: row.date_start,
            spend: normalized.spend,
            impressions: normalized.impressions,
            reach: normalized.reach,
            clicks: normalized.clicks,
            leads: normalized.leads,
            cpl: normalized.cpl,
            ctr: normalized.ctr,
        }
    })

    const diagnostics: string[] = []
    if (topAds.length === 0) diagnostics.push('Sem leitura por anuncio; a IA ainda nao consegue comparar criativos individualmente.')
    if (placements.length === 0) diagnostics.push('Sem breakdown de posicionamentos; nao foi possivel separar Feed, Stories, Reels ou Messenger.')
    if (demographics.length === 0) diagnostics.push('Sem breakdown de publico; idade e genero nao vieram da Meta neste periodo.')
    if (totals.leads > 0 && topAds.every(item => item.leads === 0)) diagnostics.push('Ha leads em campanha, mas sem distribuicao clara por anuncio.')

    return {
        generated_at: new Date().toISOString(),
        date_preset: datePreset,
        totals,
        coverage: {
            campaigns: campaignInsights.length,
            adsets: adsetInsights.length || adsets.length,
            ads: adInsights.length || ads.length,
            lead_forms: leadForms.length,
            placements: placements.length,
            devices: devices.length,
            demographics: demographics.length,
            daily_points: dailySeries.length,
        },
        top_campaigns: topCampaigns,
        top_adsets: topAdsets,
        top_ads: topAds,
        placements,
        devices,
        demographics,
        daily_series: dailySeries,
        lead_forms: leadForms.slice(0, 20),
        diagnostics,
    }
}

export async function getTodayAccountSpendEstimate(currentInsightsSpend = 0): Promise<{
    spend: number
    current_insights_spend: number
    lifetime_insights_spend: number
    account_amount_spent: number
    currency?: string
    timezone_name?: string
    source: 'insights' | 'account_amount_spent_delta'
}> {
    const conf = await getMetaConfig()

    const [accountRes, maximumRes] = await Promise.all([
        fetch(`${getBaseUrl()}/${conf.adAccountId}?fields=amount_spent,currency,timezone_name&access_token=${conf.accessToken}`),
        fetch(`${getBaseUrl()}/${conf.adAccountId}/insights?fields=spend&level=account&date_preset=maximum&access_token=${conf.accessToken}`),
    ])

    const accountData = await accountRes.json()
    const maximumData = await maximumRes.json()

    if (accountData.error) {
        throw new Error(`Erro ao buscar gasto total Meta: ${accountData.error.message}`)
    }

    if (maximumData.error) {
        throw new Error(`Erro ao buscar gasto vitalicio Meta: ${maximumData.error.message}`)
    }

    const accountAmountSpent = centsToCurrency(accountData.amount_spent)
    const lifetimeInsightsSpend = Number.parseFloat(maximumData.data?.[0]?.spend || '0')
    const deltaSpend = Math.max(0, accountAmountSpent - lifetimeInsightsSpend)
    const spend = Math.max(currentInsightsSpend, deltaSpend)

    return {
        spend: Number(spend.toFixed(2)),
        current_insights_spend: Number(currentInsightsSpend.toFixed(2)),
        lifetime_insights_spend: Number(lifetimeInsightsSpend.toFixed(2)),
        account_amount_spent: Number(accountAmountSpent.toFixed(2)),
        currency: accountData.currency,
        timezone_name: accountData.timezone_name,
        source: spend > currentInsightsSpend ? 'account_amount_spent_delta' : 'insights',
    }
}

export async function getAccountMonthlySpend(): Promise<Record<string, number>> {
    const conf = await getMetaConfig()
    const fields = ['spend', 'date_start', 'date_stop'].join(',')
    const map: Record<string, number> = {}

    let url = `${getBaseUrl()}/${conf.adAccountId}/insights?fields=${fields}&level=account&date_preset=maximum&time_increment=monthly&limit=500&access_token=${conf.accessToken}`

    while (url) {
        const res = await fetch(url)
        const data = await res.json()

        if (data.error) {
            throw new Error(`Erro ao buscar gasto mensal Meta: ${data.error.message}`)
        }

        for (const row of (data.data || [])) {
            const month = String(row.date_start || '').slice(0, 7)
            if (!month) continue
            map[month] = (map[month] || 0) + parseFloat(row.spend || '0')
        }

        url = data.paging?.next || ''
    }

    return map
}

// --- Converter Insights para nosso formato ---

export function parseInsightsToSnapshot(
    campaignId: string,
    insights: MetaInsightsResponse
): Omit<MetricsSnapshot, 'id' | 'snapshot_at'> {
    const impressions = parseInt(insights.impressions || '0')
    const videoViews3s = insights.video_p25_watched_actions?.[0]?.value
        ? parseInt(insights.video_p25_watched_actions[0].value)
        : undefined

    const thumbstopRatio = impressions > 0 && videoViews3s
        ? videoViews3s / impressions
        : undefined

    // Extrair ações específicas
    const findAction = (type: string) =>
        insights.actions?.find(a => a.action_type === type)

    const leadAction = findAction('lead') || findAction('onsite_conversion.lead_grouped')
    const leadsCount = leadAction ? parseInt(leadAction.value) : 0
    const spend = parseFloat(insights.spend || '0')

    const landingPageViewAction = findAction('landing_page_view')
    const linkClickAction = findAction('link_click')
    const messagingAction = findAction('onsite_conversion.messaging_conversation_started_7d')
    const postEngagementAction = findAction('post_engagement')

    // Conversões totais (soma de todas as conversões rastreadas)
    const conversionTypes = ['lead', 'onsite_conversion.lead_grouped', 'complete_registration', 'contact', 'submit_application']
    const conversionsTotal = insights.actions
        ?.filter(a => conversionTypes.includes(a.action_type))
        .reduce((sum, a) => sum + parseInt(a.value), 0) || 0

    // Cost per result (do cost_per_action_type da Meta)
    const costPerResultAction = insights.cost_per_action_type?.find(
        a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
    )

    // Outbound clicks
    const outboundClicksVal = insights.outbound_clicks?.[0]?.outbound_click
        ? parseInt(insights.outbound_clicks[0].outbound_click)
        : undefined

    return {
        campaign_id: campaignId,
        impressions,
        clicks: parseInt(insights.clicks || '0'),
        ctr: parseFloat(insights.ctr || '0'),
        cpm: parseFloat(insights.cpm || '0'),
        cpc: parseFloat(insights.cpc || '0'),
        spend,
        leads_count: leadsCount,
        cost_per_lead: leadsCount > 0 ? spend / leadsCount : undefined,
        roas: undefined, // Será calculado se tivermos dados de receita
        thumbstop_ratio: thumbstopRatio,
        video_views_3s: videoViews3s,
        frequency: insights.frequency ? parseFloat(insights.frequency) : undefined,
        // --- Novos campos enriquecidos ---
        reach: insights.reach ? parseInt(insights.reach) : undefined,
        unique_clicks: insights.unique_clicks ? parseInt(insights.unique_clicks) : undefined,
        landing_page_views: landingPageViewAction ? parseInt(landingPageViewAction.value) : undefined,
        link_clicks: linkClickAction ? parseInt(linkClickAction.value) : undefined,
        outbound_clicks: outboundClicksVal,
        inline_link_click_ctr: insights.inline_link_click_ctr ? parseFloat(insights.inline_link_click_ctr) : undefined,
        conversions: conversionsTotal > 0 ? conversionsTotal : undefined,
        cost_per_result: costPerResultAction ? parseFloat(costPerResultAction.value) : undefined,
        messaging_conversations: messagingAction ? parseInt(messagingAction.value) : undefined,
        post_engagements: postEngagementAction ? parseInt(postEngagementAction.value) : undefined,
        // Rankings de qualidade
        quality_ranking: insights.quality_ranking || undefined,
        engagement_rate_ranking: insights.engagement_rate_ranking || undefined,
        conversion_rate_ranking: insights.conversion_rate_ranking || undefined,
        // Retenção de vídeo
        video_p50: insights.video_p50_watched_actions?.[0]?.value
            ? parseInt(insights.video_p50_watched_actions[0].value) : undefined,
        video_p75: insights.video_p75_watched_actions?.[0]?.value
            ? parseInt(insights.video_p75_watched_actions[0].value) : undefined,
        video_p100: insights.video_p100_watched_actions?.[0]?.value
            ? parseInt(insights.video_p100_watched_actions[0].value) : undefined,
        video_avg_watch_time: insights.video_avg_time_watched_actions?.[0]?.value
            ? parseFloat(insights.video_avg_time_watched_actions[0].value) : undefined,
    }
}

// --- Meta Lead Gen (Forms) ---

export async function getLeadForms(): Promise<any[]> {
    const conf = await getMetaConfig();
    const res = await fetch(
        `${getBaseUrl()}/${conf.adAccountId}/leadgen_forms?fields=id,name,status,created_time&access_token=${conf.accessToken}`
    );
    const data = await res.json();
    if (data.error) {
        console.error(`Erro ao buscar Lead Forms: ${data.error.message}`);
        return [];
    }
    return data.data || [];
}

export async function getLeadsFromForm(formId: string): Promise<any[]> {
    const conf = await getMetaConfig();
    const res = await fetch(
        `${getBaseUrl()}/${formId}/leads?fields=id,created_time,ad_id,ad_name,campaign_id,campaign_name,field_data&access_token=${conf.accessToken}`
    );
    const data = await res.json();
    if (data.error) {
        console.error(`Erro ao buscar Leads do form ${formId}: ${data.error.message}`);
        return [];
    }
    return data.data || [];
}

// --- CAPI — API de Conversões (Server-Side) ---

export async function sendConversionEvent(eventData: {
    event_name: string
    event_time: number
    user_data: {
        phone?: string
        email?: string
        client_ip_address?: string
        client_user_agent?: string
        fbclid?: string
    }
    custom_data?: Record<string, unknown>
}): Promise<void> {
    const conf = await getMetaConfig();
    const pixelId = conf.pixelId;
    if (!pixelId) {
        console.warn('META_PIXEL_ID não configurado — evento CAPI não enviado')
        return
    }

    const res = await fetch(
        `${getBaseUrl()}/${pixelId}/events`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: conf.accessToken,
                data: [eventData]
            })
        }
    )
    const data = await res.json()
    if (data.error) {
        console.error(`Erro CAPI: ${data.error.message}`)
    }
}
