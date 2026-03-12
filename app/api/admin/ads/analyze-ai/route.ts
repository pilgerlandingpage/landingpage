import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { analyzeCampaignMetrics } from '@/lib/ads/ai-brain'
import * as metaAds from '@/lib/ads/meta'
import type { MetricsSnapshot } from '@/lib/ads/types'

export async function POST() {
    try {
        const supabase = createAdminClient()

        // 1. Get all Meta campaigns from DB
        const { data: campaigns, error: campErr } = await supabase
            .from('ad_campaigns')
            .select('*')
            .eq('platform', 'meta')
            .in('status', ['active', 'paused'])

        if (campErr) throw campErr
        if (!campaigns || campaigns.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Nenhuma campanha Meta Ads encontrada. Sincronize primeiro.'
            }, { status: 400 })
        }

        // 2. Fetch live metrics from Meta API
        let insightsMap: Record<string, any> = {}
        try {
            insightsMap = await metaAds.getAccountInsightsByCampaign('last_7d')
        } catch (err) {
            console.error('Erro ao buscar insights Meta para análise:', err)
            return NextResponse.json({
                success: false,
                error: `Erro ao buscar métricas da Meta: ${String(err)}`
            }, { status: 500 })
        }

        // 3. Analyze each campaign with AI
        const results: Array<{
            campaign_name: string
            campaign_id: string
            analysis: any
        }> = []

        for (const camp of campaigns) {
            const extId = camp.external_campaign_id
            const liveInsights = extId ? insightsMap[extId] : null

            if (!liveInsights) {
                results.push({
                    campaign_name: camp.name,
                    campaign_id: camp.id,
                    analysis: {
                        action: 'NONE',
                        alert_message: `Sem dados de métricas disponíveis para "${camp.name}". A campanha pode estar sem impressões recentes.`,
                        urgency: 'low',
                        reasoning: 'Nenhuma métrica retornada pela API da Meta para o período selecionado.'
                    }
                })
                continue
            }

            // Parse Meta insights to our internal format
            const parsed = metaAds.parseInsightsToSnapshot(camp.id, liveInsights)
            const metricsForAI: MetricsSnapshot = {
                id: '',
                snapshot_at: new Date().toISOString(),
                ...parsed,
            } as MetricsSnapshot

            try {
                const analysis = await analyzeCampaignMetrics(
                    {
                        name: camp.name,
                        platform: 'meta',
                        total_budget: Number(camp.total_budget) || 0,
                        duration_days: camp.duration_days || 30,
                        start_date: camp.start_date || camp.created_at,
                        daily_budget: camp.daily_budget ? Number(camp.daily_budget) : undefined,
                    },
                    metricsForAI
                )

                // Save alert to database
                await supabase.from('ai_campaign_alerts').insert({
                    campaign_id: camp.id,
                    type: analysis.action === 'NONE' ? 'insight' : 'action',
                    urgency: analysis.urgency,
                    action_taken: analysis.action,
                    message: analysis.alert_message,
                    ai_reasoning: analysis.reasoning || null,
                })

                results.push({
                    campaign_name: camp.name,
                    campaign_id: camp.id,
                    analysis,
                })
            } catch (aiErr) {
                console.error(`Erro AI para campanha Meta ${camp.name}:`, aiErr)
                results.push({
                    campaign_name: camp.name,
                    campaign_id: camp.id,
                    analysis: {
                        action: 'NONE',
                        alert_message: `Erro ao analisar "${camp.name}": ${String(aiErr)}`,
                        urgency: 'low',
                    }
                })
            }
        }

        // Build a summary report and save to pilger_ai_reports for history
        if (results.length > 0) {
            const urgencyEmoji: Record<string, string> = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }
            const actionLabels: Record<string, string> = {
                'PAUSE_AD': '⏸️ Pausar Anúncio',
                'SCALE_BUDGET': '📈 Escalar Orçamento',
                'REDUCE_BUDGET': '📉 Reduzir Orçamento',
                'SWAP_CREATIVE': '🔄 Trocar Criativo',
                'NONE': '✅ Nenhuma ação necessária',
            }

            let md = `# 🧠 Análise IA — Meta Ads\n\n`
            md += `**${results.length}** campanha(s) analisada(s) em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}\n\n`

            // Calculate a simple performance score based on urgency distribution
            const urgencyScores: Record<string, number> = { low: 100, medium: 70, high: 40, critical: 10 }
            let totalScore = 0

            for (const r of results) {
                const urg = r.analysis.urgency || 'low'
                const urgEmoji = urgencyEmoji[urg] || '⚪'
                const action = actionLabels[r.analysis.action] || r.analysis.action || 'N/A'
                totalScore += urgencyScores[urg] || 50

                md += `## ${urgEmoji} ${r.campaign_name}\n`
                md += `- **Ação:** ${action}\n`
                md += `- **Urgência:** ${urg}\n`
                md += `- ${r.analysis.alert_message}\n`
                if (r.analysis.reasoning) {
                    md += `- *Raciocínio:* ${r.analysis.reasoning}\n`
                }
                md += `\n`
            }

            const avgScore = Math.round(totalScore / results.length)

            try {
                await supabase.from('pilger_ai_reports').insert({
                    type: 'daily',
                    date: new Date().toISOString().split('T')[0],
                    content_markdown: md,
                    platform: 'meta',
                    performance_score: avgScore,
                })
            } catch (reportErr) {
                console.error('Erro ao salvar relatório de análise Meta:', reportErr)
            }
        }

        return NextResponse.json({
            success: true,
            message: `${results.length} campanha(s) Meta analisada(s) pela IA.`,
            results,
        })
    } catch (error: any) {
        console.error('API Error (Analyze Meta Ads):', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Erro interno' },
            { status: 500 }
        )
    }
}
