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

const META_API_VERSION = 'v21.0'

function getBaseUrl(): string {
    return `https://graph.facebook.com/${META_API_VERSION}`
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
        pixelId: configMap['meta_pixel_id'] || process.env.META_PIXEL_ID
    };
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

    // We fetch campaigns that are active or paused
    const res = await fetch(
        `${getBaseUrl()}/${conf.adAccountId}/campaigns?fields=${fields}&effective_status=['ACTIVE','PAUSED']&access_token=${conf.accessToken}`
    );
    const data = await res.json();

    if (data.error) {
        console.error(`Erro ao buscar campanhas: ${data.error.message}`);
        return [];
    }

    return data.data || [];
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
        url += `&time_range=${tr}`;
    } else {
        url += `&date_preset=${datePreset === 'custom' ? 'maximum' : datePreset}`;
    }

    const res = await fetch(url)
    const data = await res.json()

    if (data.error) {
        console.error(`Erro ao buscar insights da conta: ${data.error.message}`)
        return {}
    }

    // Mapear por campaign_id para fácil lookup
    const map: Record<string, MetaInsightsResponse> = {}
    for (const row of (data.data || [])) {
        map[row.campaign_id] = row
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
