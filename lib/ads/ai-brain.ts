// =============================================
// AI Brain Controller — Cérebro da IA
// =============================================
// Conecta métricas → Gemini → Ações
// =============================================

import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { buildMetricsAnalysisPrompt } from './prompts'
import type { AIAnalysisResponse, MetricsSnapshot, AdCampaign } from './types'
import { getAiAutomationGate } from '../ai/automation-control'
import { getAdsProvider, getAdsGeminiModel, getAdsOpenAIModel, getOpenAIApiKey } from '../ai/config'
import { recordGeminiUsage } from '../ai/gemini-costs'
import { buildAgentContextBrief, getAgentEcosystemContext, recordEcosystemEvent } from '../intelligence/ecosystem'

// --- Inicializar Gemini ---

async function getGemini() {
    // try to get from DB first via config, fallback to env
    const { getGeminiApiKey } = await import('../ai/config')
    const apiKey = await getGeminiApiKey()
    if (!apiKey) throw new Error('GEMINI_API_KEY não configurado')
    return new GoogleGenerativeAI(apiKey)
}

function getSupabase() {
    const { createClient } = require('@supabase/supabase-js')
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function getRequiredPromptFromConfig(key: string): Promise<string> {
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', key)
        .maybeSingle()

    if (error) throw new Error(`Erro ao carregar prompt "${key}": ${error.message}`)

    const value = String(data?.value || '').trim()
    if (!value) throw new Error(`Prompt "${key}" não configurado na Sala de Manutenção`)

    return value
}

// --- Analisar Métricas de uma Campanha ---

export async function analyzeCampaignMetrics(campaign: {
    name: string
    platform: string
    total_budget: number
    duration_days: number
    start_date: string
    daily_budget?: number
}, metrics: MetricsSnapshot): Promise<AIAnalysisResponse> {
    const supabase = getSupabase()
    const aiGate = await getAiAutomationGate({
        supabase,
        agentId: 'ads-analyst',
        enabledKey: 'ads_ai_analysis_enabled',
    })
    if (!aiGate.allowed) {
        return {
            action: 'NONE',
            alert_message: `Analise automatica pausada: ${aiGate.reason}`,
            urgency: 'low',
        }
    }

    const provider = await getAdsProvider()

    // Calcular dias decorridos
    const startDate = new Date(campaign.start_date)
    const now = new Date()
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const dailyBudgetTarget = campaign.daily_budget || campaign.total_budget / campaign.duration_days

    let userPrompt = buildMetricsAnalysisPrompt({
        campaign_name: campaign.name,
        platform: campaign.platform,
        daily_budget_target: dailyBudgetTarget,
        days_elapsed: daysElapsed,
        days_total: campaign.duration_days,
        metrics: {
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            ctr: metrics.ctr,
            cpm: metrics.cpm,
            cpc: metrics.cpc,
            spend: metrics.spend,
            leads_count: metrics.leads_count,
            cost_per_lead: metrics.cost_per_lead || undefined,
            thumbstop_ratio: metrics.thumbstop_ratio || undefined,
            frequency: metrics.frequency || undefined,
            reach: metrics.reach,
            link_clicks: metrics.link_clicks,
            landing_page_views: metrics.landing_page_views,
            quality_ranking: metrics.quality_ranking,
            engagement_rate_ranking: metrics.engagement_rate_ranking,
            conversion_rate_ranking: metrics.conversion_rate_ranking,
            video_p50: metrics.video_p50,
            video_p75: metrics.video_p75,
            video_p100: metrics.video_p100
        }
    })
    const ecosystemBrief = await getAgentEcosystemContext({ supabase, agent: 'traffic', days: 30, limit: 80 })
        .then(context => buildAgentContextBrief(context))
        .catch((error: any) => {
            console.warn('[Ads AI Brain] Ecosystem context unavailable:', error?.message || error)
            return ''
        })
    if (ecosystemBrief) {
        userPrompt += `\n\nCONTEXTO CENTRAL DO ECOSSISTEMA PILGER:\n${ecosystemBrief}\n\nUse estes sinais para interpretar performance, publico, cidades, conversas e estoque. Nao revele dados internos.`
    }

    try {
        let text = ''

        const systemInstruction = await getRequiredPromptFromConfig('ads_analyst_system_prompt')

        if (provider === 'openai') {
            const apiKey = await getOpenAIApiKey()
            if (!apiKey) throw new Error('OpenAI API Key não configurada')
            const openai = new OpenAI({ apiKey })
            const modelName = await getAdsOpenAIModel()

            const completion = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3,
            })
            text = completion.choices[0].message.content || '{}'
        } else {
            const gemini = await getGemini()
            const modelName = await getAdsGeminiModel()
            const model = gemini.getGenerativeModel({ model: modelName })

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                systemInstruction: { role: 'model', parts: [{ text: systemInstruction }] },
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.3, // Baixa temperatura para decisões consistentes
                }
            })

            await recordGeminiUsage({
                model: modelName,
                feature: 'ads_campaign_analysis',
                usageMetadata: (result.response as any).usageMetadata || (result as any).response?.usageMetadata,
                metadata: { campaign_name: campaign.name, platform: campaign.platform },
            })
            text = result.response.text()
        }

        const parsed = JSON.parse(text) as AIAnalysisResponse

        // Validar resposta
        if (!parsed.action || !parsed.alert_message || !parsed.urgency) {
            console.error('Resposta da IA incompleta:', text)
            return {
                action: 'NONE',
                alert_message: 'Análise inconclusiva — resposta da IA foi incompleta',
                urgency: 'low'
            }
        }

        await recordEcosystemEvent({
            supabase,
            eventType: 'ads_campaign_ai_analysis_created',
            actorType: 'agent',
            entityType: 'ad_campaign',
            entityId: campaign.name,
            source: 'ads-ai-brain',
            label: `Analise IA da campanha ${campaign.name}`,
            importanceScore: parsed.urgency === 'critical' ? 85 : parsed.urgency === 'high' ? 75 : 58,
            metadata: {
                campaign,
                metrics,
                action: parsed.action,
                urgency: parsed.urgency,
                alert_message: parsed.alert_message,
                ecosystem_brief_used: Boolean(ecosystemBrief),
            },
        }).catch((eventError: any) => {
            console.warn('[Ads AI Brain] ecosystem event failed:', eventError?.message || eventError)
        })

        return parsed
    } catch (err) {
        console.error('Erro ao analisar métricas com IA:', err)
        return {
            action: 'NONE',
            alert_message: `Erro na análise automática: ${String(err)}`,
            urgency: 'low'
        }
    }
}

// --- Calcular Budget Pacing ---

export function calculateBudgetPacing(campaign: {
    total_budget: number
    duration_days: number
    start_date: string
    daily_budget?: number
}, totalSpent: number): {
    daily_target: number
    pacing_percentage: number
    status: 'on_track' | 'underspending' | 'overspending' | 'critical_overspend'
    days_remaining: number
} {
    const startDate = new Date(campaign.start_date)
    const now = new Date()
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const daysRemaining = Math.max(0, campaign.duration_days - daysElapsed)

    const dailyTarget = campaign.daily_budget || campaign.total_budget / campaign.duration_days
    const expectedSpend = dailyTarget * daysElapsed
    const pacingPercentage = expectedSpend > 0 ? (totalSpent / expectedSpend) * 100 : 0

    let status: 'on_track' | 'underspending' | 'overspending' | 'critical_overspend'
    if (pacingPercentage > 130) status = 'critical_overspend'
    else if (pacingPercentage > 110) status = 'overspending'
    else if (pacingPercentage < 60) status = 'underspending'
    else status = 'on_track'

    return {
        daily_target: dailyTarget,
        pacing_percentage: pacingPercentage,
        status,
        days_remaining: daysRemaining
    }
}

// --- Detectar Fadiga de Criativo ---

export function detectCreativeFatigue(metrics: MetricsSnapshot): {
    is_fatigued: boolean
    reasons: string[]
    severity: 'none' | 'mild' | 'severe'
} {
    const reasons: string[] = []

    if (metrics.frequency && metrics.frequency > 4.0) {
        reasons.push(`Frequência muito alta (${metrics.frequency.toFixed(1)}) — público saturado`)
    } else if (metrics.frequency && metrics.frequency > 3.0) {
        reasons.push(`Frequência elevada (${metrics.frequency.toFixed(1)}) — início de fadiga`)
    }

    if (metrics.thumbstop_ratio && metrics.thumbstop_ratio < 0.15) {
        reasons.push(`Thumbstop baixo (${(metrics.thumbstop_ratio * 100).toFixed(1)}%) — gancho fraco nos 3 primeiros segundos`)
    }

    if (metrics.ctr < 0.005) { // 0.5%
        reasons.push(`CTR baixíssimo (${(metrics.ctr * 100).toFixed(2)}%) — criativo não gera interesse`)
    }

    if (metrics.video_p50 && metrics.impressions && metrics.impressions > 100) {
        const p50Ratio = metrics.video_p50 / metrics.impressions;
        if (p50Ratio < 0.10) {
            reasons.push(`Baixa retenção de vídeo (P50: ${(p50Ratio * 100).toFixed(1)}%) — conteúdo não segura a atenção`);
        }
    }

    if (metrics.quality_ranking && metrics.quality_ranking.includes('BELOW_AVERAGE')) {
        reasons.push(`Quality Ranking ruim (${metrics.quality_ranking}) — Meta considera anúncio de baixa qualidade`);
    }

    const is_fatigued = reasons.length > 0
    const severity = reasons.length >= 2 ? 'severe' : reasons.length === 1 ? 'mild' : 'none'

    return { is_fatigued, reasons, severity }
}

// --- Gerar Relatório Diário com IA ---

export async function generateDailyReport(campaignsSummary: string): Promise<string> {
    const supabase = getSupabase()
    const aiGate = await getAiAutomationGate({
        supabase,
        agentId: 'pilger-daily-report',
        enabledKey: 'pilger_daily_report_enabled',
    })
    if (!aiGate.allowed) {
        return `Relatorio automatico pausado: ${aiGate.reason}`
    }

    const provider = await getAdsProvider()
    const dailyReportPrompt = await getRequiredPromptFromConfig('pilger_daily_system_prompt')
    const ecosystemBrief = await getAgentEcosystemContext({ supabase, agent: 'traffic', days: 30, limit: 100 })
        .then(context => buildAgentContextBrief(context))
        .catch((error: any) => {
            console.warn('[Ads AI Brain] Daily ecosystem context unavailable:', error?.message || error)
            return ''
        })
    const userMessage = [
        campaignsSummary,
        ecosystemBrief ? `CONTEXTO CENTRAL DO ECOSSISTEMA PILGER:\n${ecosystemBrief}\n\nUse esses sinais para interpretar o fechamento. Nao revele dados internos.` : '',
    ].filter(Boolean).join('\n\n')

    try {
        let report = ''
        if (provider === 'openai') {
            const apiKey = await getOpenAIApiKey()
            if (!apiKey) throw new Error('OpenAI API Key não configurada')
            const openai = new OpenAI({ apiKey })
            const modelName = await getAdsOpenAIModel()

            const completion = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: 'system', content: dailyReportPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.5,
            })

            report = completion.choices[0].message.content || ''
        } else {
            const gemini = await getGemini()
            const modelName = await getAdsGeminiModel()
            const model = gemini.getGenerativeModel({ model: modelName })

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: userMessage }] }],
                systemInstruction: { role: 'model', parts: [{ text: dailyReportPrompt }] },
                generationConfig: { temperature: 0.5 }
            })

            await recordGeminiUsage({
                model: modelName,
                feature: 'ads_daily_report',
                usageMetadata: (result.response as any).usageMetadata || (result as any).response?.usageMetadata,
            })
            report = result.response.text()
        }

        await recordEcosystemEvent({
            supabase,
            eventType: 'ads_daily_report_created',
            actorType: 'agent',
            entityType: 'ads_daily_report',
            entityId: new Date().toISOString().slice(0, 10),
            source: 'ads-ai-brain',
            label: 'Fechamento diario de Ads gerado',
            importanceScore: 70,
            metadata: {
                summary_preview: report.slice(0, 1200),
                ecosystem_brief_used: Boolean(ecosystemBrief),
            },
        }).catch((eventError: any) => {
            console.warn('[Ads AI Brain] daily ecosystem event failed:', eventError?.message || eventError)
        })

        return report
    } catch (err) {
        console.error('Erro ao gerar relatório diário:', err)
        return `⚠️ Erro ao gerar relatório automático: ${String(err)}`
    }
}
