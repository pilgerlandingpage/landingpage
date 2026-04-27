// =============================================
// Google Ads API Service
// =============================================
// Integração com a Google Ads API para gerenciar
// campanhas, criativos e buscar métricas.
//
// Documentação: https://developers.google.com/google-ads/api/docs
// =============================================

import type { GoogleCampaignConfig, MetricsSnapshot } from './types'
import { createAdminClient } from '../supabase/server'

// --- Configuração ---

async function getGoogleConfig() {
    const supabase = createAdminClient();
    const { data } = await supabase.from('app_config').select('key, value').in('key', [
        'google_ads_developer_token',
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_refresh_token',
        'google_ads_manager_id', // MCC
        'google_ads_customer_id'
    ]);

    const configMap = (data || []).reduce((acc: any, row: any) => {
        acc[row.key] = row.value;
        return acc;
    }, {});

    const developerToken = configMap['google_ads_developer_token'] || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const clientId = configMap['google_ads_client_id'] || process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = configMap['google_ads_client_secret'] || process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = configMap['google_ads_refresh_token'] || process.env.GOOGLE_ADS_REFRESH_TOKEN;

    // Fallback: o manager_id não existia antes. Se não estiver configurado no .env nem no DB, vamos usar o customerId como managerId no fallback (que daria erro de permissão da API se não for, mas tenta ao menos enviar o header exigido)
    let managerId = configMap['google_ads_manager_id'] || process.env.GOOGLE_ADS_MANAGER_ID;
    const customerId = configMap['google_ads_customer_id'] || process.env.GOOGLE_ADS_CUSTOMER_ID;

    // Limpeza de hifens caso o usuário tenha digitado com hifens (123-456-7890)
    const cleanId = (id?: string) => id ? id.replace(/-/g, '') : undefined;

    const cleanManagerId = cleanId(managerId);
    const cleanCustomerId = cleanId(customerId);

    if (!developerToken || !clientId || !clientSecret || !refreshToken || !cleanCustomerId || !cleanManagerId) {
        throw new Error('Credenciais do Google Ads incompletas. Preecha todos os campos na Sala de Manutenção ou .env.local')
    }

    return {
        developerToken,
        clientId,
        clientSecret,
        refreshToken,
        managerId: cleanManagerId!,
        customerId: cleanCustomerId!
    }
}

// --- Obter Access Token via Refresh Token ---

async function getAccessToken(config: Awaited<ReturnType<typeof getGoogleConfig>>): Promise<string> {
    const { clientId, clientSecret, refreshToken } = config

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        })
    })

    const data = await res.json()
    if (data.error) throw new Error(`Erro OAuth Google: ${data.error_description || data.error}`)
    return data.access_token
}

// --- Headers padrão ---

async function getHeaders(config: Awaited<ReturnType<typeof getGoogleConfig>>): Promise<HeadersInit> {
    const { developerToken, managerId } = config
    const accessToken = await getAccessToken(config)

    return {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'login-customer-id': managerId,
        'Content-Type': 'application/json'
    }
}

function getApiUrl(customerId: string): string {
    return `https://googleads.googleapis.com/v20/customers/${customerId}`
}

// --- Teste de Conexão ---

export async function testConnection(): Promise<{ success: boolean; message: string }> {
    try {
        const config = await getGoogleConfig()
        const headers = await getHeaders(config)

        const res = await fetch(
            `${getApiUrl(config.customerId)}/googleAds:searchStream`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: `SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1`
                })
            }
        )

        const data = await res.json()

        if (data.error || data[0]?.error) {
            const errMsg = data.error?.message || data[0]?.error?.message || 'Erro desconhecido'
            return { success: false, message: `Erro Google Ads: ${errMsg}` }
        }

        const customer = data[0]?.results?.[0]?.customer
        return {
            success: true,
            message: `Conectado! Conta: ${customer?.descriptiveName || config.customerId} | Moeda: ${customer?.currencyCode || 'N/A'}`
        }
    } catch (err) {
        return { success: false, message: `Falha na conexão: ${String(err)}` }
    }
}

// --- Criar Campanha ---

export async function createCampaign(config: GoogleCampaignConfig): Promise<string> {
    const googleConfig = await getGoogleConfig()
    const headers = await getHeaders(googleConfig)

    // Primeiro: criar o orçamento
    const budgetRes = await fetch(
        `${getApiUrl(googleConfig.customerId)}/campaignBudgets:mutate`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                operations: [{
                    create: {
                        name: `Budget - ${config.name}`,
                        amountMicros: config.budget_amount_micros.toString(),
                        deliveryMethod: 'STANDARD'
                    }
                }]
            })
        }
    )

    const budgetData = await budgetRes.json()
    if (budgetData.error) throw new Error(`Erro ao criar orçamento: ${budgetData.error.message}`)
    const budgetResourceName = budgetData.results[0].resourceName

    // Depois: criar a campanha vinculada ao orçamento
    const campaignRes = await fetch(
        `${getApiUrl(googleConfig.customerId)}/campaigns:mutate`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                operations: [{
                    create: {
                        name: config.name,
                        advertisingChannelType: config.campaign_type,
                        status: config.status,
                        campaignBudget: budgetResourceName
                    }
                }]
            })
        }
    )

    const campaignData = await campaignRes.json()
    if (campaignData.error) throw new Error(`Erro ao criar campanha: ${campaignData.error.message}`)
    return campaignData.results[0].resourceName
}

// --- Controle de Status ---

export async function updateCampaignStatus(
    campaignResourceName: string,
    status: 'ENABLED' | 'PAUSED'
): Promise<void> {
    const config = await getGoogleConfig()
    const headers = await getHeaders(config)

    const res = await fetch(
        `${getApiUrl(config.customerId)}/campaigns:mutate`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                operations: [{
                    update: {
                        resourceName: campaignResourceName,
                        status
                    },
                    updateMask: 'status'
                }]
            })
        }
    )

    const data = await res.json()
    if (data.error) throw new Error(`Erro ao atualizar status: ${data.error.message}`)
}

// --- Buscar Métricas ---

export async function getMetrics(
    campaignResourceName: string,
    dateRange: 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' = 'TODAY'
): Promise<Omit<MetricsSnapshot, 'id' | 'snapshot_at' | 'campaign_id'> | null> {
    const config = await getGoogleConfig()
    const headers = await getHeaders(config)

    const query = `
        SELECT
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpm,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.cost_per_conversion,
            metrics.video_views,
            metrics.video_quartile_p25_rate
        FROM campaign
        WHERE campaign.resource_name = '${campaignResourceName}'
            AND segments.date DURING ${dateRange}
    `

    const res = await fetch(
        `${getApiUrl(config.customerId)}/googleAds:searchStream`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({ query })
        }
    )

    const data = await res.json()
    if (data.error) {
        console.error(`Erro ao buscar métricas Google: ${data.error.message}`)
        return null
    }

    const row = data[0]?.results?.[0]?.metrics
    if (!row) return null

    const impressions = parseInt(row.impressions || '0')
    const costMicros = parseInt(row.costMicros || '0')
    const spend = costMicros / 1_000_000
    const conversions = parseFloat(row.conversions || '0')

    return {
        impressions,
        clicks: parseInt(row.clicks || '0'),
        ctr: parseFloat(row.ctr || '0'),
        cpm: parseFloat(row.averageCpm || '0') / 1_000_000,
        cpc: parseFloat(row.averageCpc || '0') / 1_000_000,
        spend,
        leads_count: Math.round(conversions),
        cost_per_lead: conversions > 0 ? spend / conversions : undefined,
        roas: undefined,
        thumbstop_ratio: row.videoQuartileP25Rate ? parseFloat(row.videoQuartileP25Rate) : undefined,
        video_views_3s: row.videoViews ? parseInt(row.videoViews) : undefined,
        frequency: undefined
    }
}

// --- Atualizar Orçamento ---

export async function updateBudget(
    budgetResourceName: string,
    newAmountMicros: number
): Promise<void> {
    const config = await getGoogleConfig()
    const headers = await getHeaders(config)

    const res = await fetch(
        `${getApiUrl(config.customerId)}/campaignBudgets:mutate`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                operations: [{
                    update: {
                        resourceName: budgetResourceName,
                        amountMicros: newAmountMicros.toString()
                    },
                    updateMask: 'amountMicros'
                }]
            })
        }
    )

    const data = await res.json()
    if (data.error) throw new Error(`Erro ao atualizar orçamento: ${data.error.message}`)
}

// --- Mapear date_preset do frontend para GAQL ---

export type GoogleDatePreset = 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'this_month' | 'last_month' | 'maximum'

function mapDatePreset(preset: GoogleDatePreset): string | null {
    const map: Record<string, string> = {
        'today': 'TODAY',
        'yesterday': 'YESTERDAY',
        'last_7d': 'LAST_7_DAYS',
        'last_30d': 'LAST_30_DAYS',
        'this_month': 'THIS_MONTH',
        'last_month': 'LAST_MONTH',
    }
    // 'maximum' = sem filtro de data (retorna tudo)
    return map[preset] || null
}

// --- Buscar TODAS campanhas com métricas (para dashboard) ---

export async function getAllCampaignsWithMetrics(
    datePreset: GoogleDatePreset | 'custom' = 'maximum',
    customRange?: { startDate: string; endDate: string }
): Promise<Record<string, { campaign: any; metrics: any }>> {
    const config = await getGoogleConfig()
    const headers = await getHeaders(config)

    let dateClause = ''
    if (datePreset === 'custom' && customRange) {
        dateClause = `segments.date BETWEEN '${customRange.startDate}' AND '${customRange.endDate}'`
    } else {
        const dateFilter = mapDatePreset(datePreset === 'custom' ? 'maximum' : datePreset)
        dateClause = dateFilter ? `segments.date DURING ${dateFilter}` : ''
    }
    const whereParts = [
        datePreset === 'maximum' ? '' : `campaign.status != 'REMOVED'`,
        dateClause,
    ].filter(Boolean)
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

    const query = `
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpm,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.cost_per_conversion,
            metrics.video_views,
            metrics.video_quartile_p25_rate
        FROM campaign
        ${whereClause}
    `

    const res = await fetch(
        `${getApiUrl(config.customerId)}/googleAds:searchStream`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({ query })
        }
    )

    if (!res.ok) {
        const errText = await res.text()
        console.error('Google Ads API error:', errText)
        return {}
    }

    const data = await res.json()
    const result: Record<string, { campaign: any; metrics: any }> = {}

    if (data && data.length > 0) {
        for (const chunk of data) {
            if (chunk.results) {
                for (const row of chunk.results) {
                    if (row.campaign) {
                        const campaignId = String(row.campaign.id)
                        const m = row.metrics || {}

                        const impressions = parseInt(m.impressions || '0')
                        const clicks = parseInt(m.clicks || '0')
                        const costMicros = parseInt(m.costMicros || '0')
                        const spend = costMicros / 1_000_000
                        const conversions = parseFloat(m.conversions || '0')

                        result[campaignId] = {
                            campaign: {
                                id: campaignId,
                                name: row.campaign.name,
                                status: row.campaign.status,
                            },
                            metrics: {
                                impressions,
                                clicks,
                                ctr: impressions > 0 ? clicks / impressions : 0,
                                cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
                                cpc: clicks > 0 ? spend / clicks : 0,
                                spend,
                                conversions: Math.round(conversions),
                                leads_count: Math.round(conversions),
                                cost_per_lead: conversions > 0 ? spend / conversions : null,
                                reach: impressions, // Google Ads não tem 'reach' separado; usamos impressions
                                thumbstop_ratio: m.videoQuartileP25Rate ? parseFloat(m.videoQuartileP25Rate) : undefined,
                                video_views_3s: m.videoViews ? parseInt(m.videoViews) : undefined,
                            }
                        }
                    }
                }
            }
        }
    }

    return result
}

// --- Buscar gasto mensal da conta inteira (historico financeiro) ---

export async function getAccountMonthlySpend(): Promise<Record<string, number>> {
    const config = await getGoogleConfig()
    const headers = await getHeaders(config)
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())

    const query = `
        SELECT
            segments.month,
            metrics.cost_micros
        FROM customer
        WHERE segments.date BETWEEN '2000-01-01' AND '${today}'
    `

    const res = await fetch(
        `${getApiUrl(config.customerId)}/googleAds:searchStream`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({ query })
        }
    )

    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Google Ads monthly spend API error: ${errText}`)
    }

    const data = await res.json()
    const monthly: Record<string, number> = {}

    if (data && data.length > 0) {
        for (const chunk of data) {
            for (const row of (chunk.results || [])) {
                const month = String(row?.segments?.month || '').slice(0, 7)
                if (!month) continue

                const costMicros = Number.parseInt(String(row?.metrics?.costMicros || '0'), 10)
                monthly[month] = (monthly[month] || 0) + (costMicros / 1_000_000)
            }
        }
    }

    return monthly
}
