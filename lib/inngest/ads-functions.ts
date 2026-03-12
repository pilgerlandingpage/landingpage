// =============================================
// Inngest Functions — Workers de Tráfego
// =============================================

import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import * as metaAds from '../ads/meta'
import * as googleAds from '../ads/google'
import { analyzeCampaignMetrics, calculateBudgetPacing, generateDailyReport } from '../ads/ai-brain'
import { sendAlertToAdmins, sendDailyReport } from '../ads/whatsapp-alerts'
import type { AdCampaign, MetricsSnapshot, AlertUrgency } from '../ads/types'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// =============================================
// 1. Publicar Campanha nas Plataformas
// =============================================

export const publishCampaign = inngest.createFunction(
    { id: 'ads-publish-campaign', name: 'Publicar Campanha nos Ads' },
    { event: 'ads/campaign-created' },
    async ({ event, step }) => {
        const { campaign_id } = event.data
        const supabase = getSupabase()

        // Buscar campanha do banco
        const { data: campaign } = await step.run('fetch-campaign', async () => {
            const { data, error } = await supabase
                .from('ad_campaigns')
                .select('*, ad_creatives(*)')
                .eq('id', campaign_id)
                .single()
            if (error) throw new Error(`Campanha não encontrada: ${error.message}`)
            return { data }
        })

        if (!campaign.data) throw new Error('Campanha não encontrada')
        const camp = campaign.data as AdCampaign & { ad_creatives: { file_url: string; type: string; headline?: string }[] }

        // Atualizar status para "pending"
        await step.run('update-status-pending', async () => {
            await supabase.from('ad_campaigns').update({ status: 'pending' }).eq('id', campaign_id)
        })

        try {
            if (camp.platform === 'meta') {
                // --- Meta Ads ---
                // metaAds module internally fetches the token from Supabase now 
                const externalCampaignId = await step.run('meta-create-campaign', async () => {
                    return metaAds.createCampaign({
                        name: camp.name,
                        objective: 'OUTCOME_LEADS',
                        daily_budget: Math.round((camp.total_budget / camp.duration_days) * 100), // centavos
                        status: 'PAUSED'
                    })
                })

                // Atualizar ID externo
                await step.run('save-external-ids', async () => {
                    await supabase.from('ad_campaigns').update({
                        external_campaign_id: externalCampaignId,
                        status: 'active',
                        start_date: new Date().toISOString().split('T')[0],
                        end_date: new Date(Date.now() + camp.duration_days * 86400000).toISOString().split('T')[0]
                    }).eq('id', campaign_id)
                })

            } else if (camp.platform === 'google') {
                // --- Google Ads ---
                const resourceName = await step.run('google-create-campaign', async () => {
                    return googleAds.createCampaign({
                        name: camp.name,
                        budget_amount_micros: Math.round((camp.total_budget / camp.duration_days) * 1_000_000),
                        campaign_type: 'DISPLAY',
                        status: 'PAUSED'
                    })
                })

                await step.run('save-external-ids', async () => {
                    await supabase.from('ad_campaigns').update({
                        external_campaign_id: resourceName,
                        status: 'active',
                        start_date: new Date().toISOString().split('T')[0],
                        end_date: new Date(Date.now() + camp.duration_days * 86400000).toISOString().split('T')[0]
                    }).eq('id', campaign_id)
                })
            }

            // Notificar admins via WhatsApp
            await step.run('notify-admins', async () => {
                await sendAlertToAdmins({
                    type: 'insight',
                    urgency: 'medium',
                    message: `Nova campanha "${camp.name}" publicada com sucesso! Orçamento: R$ ${camp.total_budget.toFixed(2)} por ${camp.duration_days} dias.`,
                    campaign_name: camp.name,
                    platform: camp.platform
                })
            })

        } catch (err) {
            await supabase.from('ad_campaigns').update({ status: 'error' }).eq('id', campaign_id)
            throw err
        }
    }
)

// =============================================
// 2. Polling de Métricas (Cron Job — a cada 1h)
// =============================================

export const pollMetricsCron = inngest.createFunction(
    { id: 'ads-poll-metrics', name: 'Buscar Métricas de Campanhas' },
    { cron: '0 * * * *' }, // A cada hora
    async ({ step }) => {
        const supabase = getSupabase()

        // Buscar campanhas ativas
        const campaigns = await step.run('fetch-active-campaigns', async () => {
            const { data, error } = await supabase
                .from('ad_campaigns')
                .select('*')
                .eq('status', 'active')
                .not('external_campaign_id', 'is', null)

            if (error) throw new Error(`Erro ao buscar campanhas: ${error.message}`)
            return data as AdCampaign[]
        })

        if (!campaigns || campaigns.length === 0) {
            return { message: 'Nenhuma campanha ativa para monitorar' }
        }

        const results = []

        for (const campaign of campaigns) {
            const metricsResult = await step.run(`poll-${campaign.id}`, async () => {
                let snapshotData

                if (campaign.platform === 'meta' && campaign.external_campaign_id) {
                    // metaAds module internally fetches the token from Supabase now 
                    const insights = await metaAds.getInsights(campaign.external_campaign_id, 'today')
                    if (insights) {
                        snapshotData = metaAds.parseInsightsToSnapshot(campaign.id, insights)
                    }
                } else if (campaign.platform === 'google' && campaign.external_campaign_id) {
                    const metrics = await googleAds.getMetrics(campaign.external_campaign_id, 'TODAY')
                    if (metrics) {
                        snapshotData = { campaign_id: campaign.id, ...metrics }
                    }
                }

                if (snapshotData) {
                    const { error } = await supabase
                        .from('ad_metrics_snapshots')
                        .insert(snapshotData)

                    if (error) console.error(`Erro ao salvar snapshot: ${error.message}`)
                }

                return snapshotData || null
            })

            if (metricsResult) {
                results.push({ campaign_id: campaign.id, metrics: metricsResult })
            }
        }

        // Disparar análise da IA para cada campanha com métricas
        for (const result of results) {
            await step.sendEvent('trigger-ai-analysis', {
                name: 'ads/ai-analyze',
                data: {
                    campaign_id: result.campaign_id,
                    metrics: result.metrics
                }
            })
        }

        return { campaigns_polled: results.length }
    }
)

// =============================================
// 3. Análise da IA
// =============================================

export const aiAnalyzeMetrics = inngest.createFunction(
    { id: 'ads-ai-analyze', name: 'Análise IA de Métricas' },
    { event: 'ads/ai-analyze' },
    async ({ event, step }) => {
        const { campaign_id, metrics } = event.data
        const supabase = getSupabase()

        // Buscar campanha
        const campaign = await step.run('fetch-campaign', async () => {
            const { data, error } = await supabase
                .from('ad_campaigns')
                .select('*')
                .eq('id', campaign_id)
                .single()
            if (error) throw new Error(error.message)
            return data as AdCampaign
        })

        // Análise da IA é feita para todas as campanhas, independente do ai_auto_manage

        // Chamar o cérebro da IA
        const analysis = await step.run('ai-analyze', async () => {
            return analyzeCampaignMetrics({
                name: campaign.name,
                platform: campaign.platform,
                total_budget: Number(campaign.total_budget),
                duration_days: campaign.duration_days,
                start_date: campaign.start_date || new Date().toISOString(),
                daily_budget: campaign.daily_budget ? Number(campaign.daily_budget) : undefined
            }, metrics as unknown as MetricsSnapshot)
        })

        // Salvar alerta no banco
        await step.run('save-alert', async () => {
            await supabase.from('ai_campaign_alerts').insert({
                campaign_id,
                type: analysis.action === 'NONE' ? 'insight' : 'action',
                urgency: analysis.urgency,
                action_taken: analysis.action,
                message: analysis.alert_message,
                ai_reasoning: analysis.reasoning
            })
        })

        // Se houver ação e auto_manage estiver ativado, delegar execução
        if (analysis.action !== 'NONE' && campaign.ai_auto_manage) {
            await step.sendEvent('execute-action', {
                name: 'ads/execute-action',
                data: {
                    campaign_id,
                    action: analysis.action,
                    alert_message: analysis.alert_message,
                    urgency: analysis.urgency,
                    budget_adjustment: analysis.budget_adjustment,
                    campaign_name: campaign.name,
                    platform: campaign.platform,
                    external_campaign_id: campaign.external_campaign_id,
                    external_adset_id: campaign.external_adset_id
                }
            })
        }

        return { action: analysis.action, urgency: analysis.urgency }
    }
)

// =============================================
// 4. Executar Ação da IA
// =============================================

export const executeAiAction = inngest.createFunction(
    { id: 'ads-execute-action', name: 'Executar Ação IA' },
    { event: 'ads/execute-action' },
    async ({ event, step }) => {
        const {
            campaign_id, action, alert_message, urgency,
            budget_adjustment, campaign_name, platform,
            external_campaign_id, external_adset_id
        } = event.data

        const supabase = getSupabase()

        // Executar ação na plataforma
        await step.run('execute-platform-action', async () => {
            if (!external_campaign_id) {
                console.warn('Sem ID externo — ação não executada na plataforma')
                return
            }

            if (action === 'PAUSE_AD') {
                if (platform === 'meta') {
                    await metaAds.updateCampaignStatus(external_campaign_id, 'PAUSED')
                } else {
                    await googleAds.updateCampaignStatus(external_campaign_id, 'PAUSED')
                }

                await supabase.from('ad_campaigns').update({ status: 'paused' }).eq('id', campaign_id)
            }

            if ((action === 'SCALE_BUDGET' || action === 'REDUCE_BUDGET') && budget_adjustment) {
                if (platform === 'meta' && external_adset_id) {
                    await metaAds.updateDailyBudget(
                        external_adset_id,
                        Math.round(budget_adjustment.new_daily_budget * 100)
                    )
                }
                // Google Ads budget update requer o resource name do budget
            }
        })

        // Registrar no log
        await step.run('log-action', async () => {
            await supabase.from('ai_action_log').insert({
                campaign_id,
                action,
                reason: alert_message,
                new_value: budget_adjustment ? `R$ ${budget_adjustment.new_daily_budget}` : undefined
            })
        })

        // Enviar alerta WhatsApp para admins
        await step.run('whatsapp-alert', async () => {
            await sendAlertToAdmins({
                type: 'action',
                urgency: urgency as AlertUrgency,
                message: alert_message,
                action_taken: action,
                campaign_name,
                platform
            })

            // Marcar como enviado
            await supabase
                .from('ai_campaign_alerts')
                .update({ whatsapp_sent: true })
                .eq('campaign_id', campaign_id)
                .eq('whatsapp_sent', false)
                .order('created_at', { ascending: false })
                .limit(1)
        })

        return { executed: action }
    }
)

// =============================================
// 5. Relatório Diário (Cron Job — 20h)
// =============================================

export const dailyReportCron = inngest.createFunction(
    { id: 'ads-daily-report', name: 'Relatório Diário de Tráfego' },
    { cron: '0 20 * * *' }, // Todo dia às 20h
    async ({ step }) => {
        const supabase = getSupabase()

        // Buscar métricas do dia
        const todayMetrics = await step.run('fetch-today-metrics', async () => {
            const today = new Date().toISOString().split('T')[0]
            const { data } = await supabase
                .from('ad_metrics_snapshots')
                .select('*, ad_campaigns!inner(name, platform, status)')
                .gte('snapshot_at', `${today}T00:00:00`)

            return data || []
        })

        if (todayMetrics.length === 0) {
            return { message: 'Sem métricas hoje' }
        }

        // Agregar dados
        const totalSpend = todayMetrics.reduce((s, m) => s + Number(m.spend || 0), 0)
        const totalLeads = todayMetrics.reduce((s, m) => s + (m.leads_count || 0), 0)
        const avgCpa = totalLeads > 0 ? totalSpend / totalLeads : 0

        // Encontrar melhor e pior (por CPA)
        const withLeads = todayMetrics.filter(m => m.leads_count > 0)
        const sorted = withLeads.sort((a, b) => {
            const cpaA = Number(a.spend) / a.leads_count
            const cpaB = Number(b.spend) / b.leads_count
            return cpaA - cpaB
        })

        const best = sorted[0]
        const worst = sorted[sorted.length - 1]

        // Enviar relatório
        await step.run('send-daily-report', async () => {
            await sendDailyReport({
                total_spend: totalSpend,
                total_leads: totalLeads,
                avg_cpa: avgCpa,
                best_campaign: (best as unknown as { ad_campaigns: { name: string } })?.ad_campaigns?.name || 'N/A',
                worst_campaign: (worst as unknown as { ad_campaigns: { name: string } })?.ad_campaigns?.name || 'N/A',
                campaigns_active: todayMetrics.filter(m => (m as unknown as { ad_campaigns: { status: string } }).ad_campaigns?.status === 'active').length,
                campaigns_paused: todayMetrics.filter(m => (m as unknown as { ad_campaigns: { status: string } }).ad_campaigns?.status === 'paused').length
            })
        })

        return { total_spend: totalSpend, total_leads: totalLeads }
    }
)

// =============================================
// 6. Relatórios de Gestão (Olho de Deus)
// =============================================

import { generateDailyPilgerReport, generateWeeklyPilgerReport } from '../ai/pilger-ceo'

// Função auxiliar para pegar hora atual em fuso horário
function getCurrentTimeSP() {
    const spTime = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const dateObj = new Date(spTime);
    return {
        dayOfWeek: dateObj.getDay().toString(), // 0-6 (0 = Dom, 1 = Seg...)
        hour: dateObj.getHours().toString().padStart(2, '0') // 00-23
    }
}

export const generateDailyPilgerReportCron = inngest.createFunction(
    { id: 'pilger-daily-report', name: 'Gerar Relatório Diário Pilger AI' },
    { cron: '0 * * * *' }, // Executa a cada hora para avaliar configurações
    async ({ step }) => {
        const supabase = getSupabase()

        // 1. Verificar configuração
        const shouldRun = await step.run('check-daily-schedule', async () => {
            const { data: configs } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', ['pilger_daily_days', 'pilger_daily_time'])

            const configMap = (configs || []).reduce((acc: any, c) => ({ ...acc, [c.key]: c.value }), {})
            
            const targetDays = (configMap['pilger_daily_days'] || '0,1,2,3,4,5,6').split(',')
            const targetHour = configMap['pilger_daily_time'] || '23'

            const { dayOfWeek, hour } = getCurrentTimeSP()

            return targetDays.includes(dayOfWeek) && targetHour === hour
        })

        if (!shouldRun) {
            return { skipped: true, reason: 'schedule_mismatch' }
        }

        // 2. Extra proteção contra execuções duplas no mesmo dia
        const hasRunToday = await step.run('check-already-run', async () => {
             const spTime = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
             const todayStr = new Date(spTime).toISOString().split('T')[0]
             
             const { data } = await supabase
                .from('pilger_ai_reports')
                .select('id')
                .eq('type', 'daily')
                .eq('date', todayStr)
                .limit(1)
                
             return data && data.length > 0
        })

        if (hasRunToday) {
            return { skipped: true, reason: 'already_run_today' }
        }

        // 3. Executar Relatório
        const result = await step.run('generate-daily-report', async () => {
            return await generateDailyPilgerReport()
        })
        return result
    }
)

export const generateWeeklyPilgerReportCron = inngest.createFunction(
    { id: 'pilger-weekly-report', name: 'Gerar Diretriz Semanal Pilger AI' },
    { cron: '0 * * * *' }, // Executa a cada hora para avaliar configurações
    async ({ step }) => {
        const supabase = getSupabase()

        // 1. Verificar configuração
        const shouldRun = await step.run('check-weekly-schedule', async () => {
            const { data: configs } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', ['pilger_weekly_day', 'pilger_weekly_time'])

            const configMap = (configs || []).reduce((acc: any, c) => ({ ...acc, [c.key]: c.value }), {})
            
            const targetDay = configMap['pilger_weekly_day'] || '1' // Padrão: Segunda
            const targetHour = configMap['pilger_weekly_time'] || '06'

            const { dayOfWeek, hour } = getCurrentTimeSP()

            return targetDay === dayOfWeek && targetHour === hour
        })

        if (!shouldRun) {
            return { skipped: true, reason: 'schedule_mismatch' }
        }

        // 2. Extra proteção
        const hasRunToday = await step.run('check-already-run', async () => {
             const spTime = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
             const todayStr = new Date(spTime).toISOString().split('T')[0]
             
             const { data } = await supabase
                .from('pilger_ai_reports')
                .select('id')
                .eq('type', 'weekly')
                .eq('date', todayStr)
                .limit(1)
                
             return data && data.length > 0
        })

        if (hasRunToday) {
            return { skipped: true, reason: 'already_run_today' }
        }

        // 3. Executar Relatório
        const result = await step.run('generate-weekly-report', async () => {
            return await generateWeeklyPilgerReport()
        })
        return result
    }
)
