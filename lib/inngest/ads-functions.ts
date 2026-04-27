// =============================================
// Inngest Functions — Workers de Tráfego
// =============================================

import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import * as metaAds from '../ads/meta'
import * as googleAds from '../ads/google'
import { analyzeCampaignMetrics, calculateBudgetPacing, generateDailyReport } from '../ads/ai-brain'
import { sendAlertToAdmins, sendDailyReport } from '../ads/whatsapp-alerts'
import { syncPaidAdsSpendToFinance } from '../finance/ads-spend-sync'
import type { AdCampaign, MetricsSnapshot, AlertUrgency } from '../ads/types'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const DEFAULT_ADS_SYNC_INTERVAL_MINUTES = 60
const MIN_ADS_SYNC_INTERVAL_MINUTES = 1
const MAX_ADS_SYNC_INTERVAL_MINUTES = 1440

function parseAdsSyncInterval(value?: string | null) {
    const parsed = Number.parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return DEFAULT_ADS_SYNC_INTERVAL_MINUTES
    return Math.min(MAX_ADS_SYNC_INTERVAL_MINUTES, Math.max(MIN_ADS_SYNC_INTERVAL_MINUTES, parsed))
}

function parseConfigDate(value?: string | null) {
    if (!value) return null
    const ms = new Date(value).getTime()
    return Number.isFinite(ms) ? ms : null
}

async function getAdsSyncSchedule(supabase: ReturnType<typeof getSupabase>) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['ads_sync_interval_minutes', 'ads_sync_last_run_at', 'ads_sync_last_started_at'])

    const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const intervalMinutes = parseAdsSyncInterval(config.ads_sync_interval_minutes)
    const lastRunMs = parseConfigDate(config.ads_sync_last_run_at)
    const lastStartedMs = parseConfigDate(config.ads_sync_last_started_at)
    const lastActivityMs = Math.max(lastRunMs || 0, lastStartedMs || 0)
    const nowMs = Date.now()
    const elapsedMinutes = lastActivityMs ? Math.floor((nowMs - lastActivityMs) / 60000) : null

    return {
        shouldRun: !lastActivityMs || nowMs - lastActivityMs >= intervalMinutes * 60000,
        intervalMinutes,
        elapsedMinutes,
        lastRunAt: config.ads_sync_last_run_at || null,
        lastStartedAt: config.ads_sync_last_started_at || null,
    }
}

async function saveAppConfig(supabase: ReturnType<typeof getSupabase>, key: string, value: string) {
    const { error } = await supabase
        .from('app_config')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) throw new Error(`Erro ao salvar ${key}: ${error.message}`)
}

async function markAdsSyncStarted(supabase: ReturnType<typeof getSupabase>) {
    await saveAppConfig(supabase, 'ads_sync_last_started_at', new Date().toISOString())
}

async function markAdsSyncCompleted(supabase: ReturnType<typeof getSupabase>) {
    const now = new Date().toISOString()
    await Promise.all([
        saveAppConfig(supabase, 'ads_sync_last_run_at', now),
        saveAppConfig(supabase, 'ads_sync_last_started_at', now),
    ])
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
    { cron: '* * * * *' }, // Checa a cada minuto; o intervalo real fica em app_config.ads_sync_interval_minutes
    async ({ step }) => {
        const supabase = getSupabase()

        const schedule = await step.run('check-ads-sync-schedule', async () => {
            return getAdsSyncSchedule(supabase)
        })

        if (!schedule.shouldRun) {
            return {
                skipped: true,
                reason: 'interval_not_reached',
                sync_interval_minutes: schedule.intervalMinutes,
                elapsed_minutes: schedule.elapsedMinutes,
                last_run_at: schedule.lastRunAt,
                last_started_at: schedule.lastStartedAt,
            }
        }

        await step.run('mark-ads-sync-started', async () => {
            await markAdsSyncStarted(supabase)
        })

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
            await step.run('mark-ads-sync-completed-no-campaigns', async () => {
                await markAdsSyncCompleted(supabase)
            })

            return {
                message: 'Nenhuma campanha ativa para monitorar',
                sync_interval_minutes: schedule.intervalMinutes,
            }
        }

        const results = []

        for (const campaign of campaigns) {
            const metricsResult = await step.run(`poll-${campaign.id}`, async () => {
                let snapshotData

                if (campaign.platform === 'meta' && campaign.external_campaign_id) {
                    // metaAds module internally fetches the token from Supabase now 
                    // Tenta buscar 'today' primeiro, mas se vier zerado (latência da API), tenta 'yesterday'
                    let metaInsights = await metaAds.getInsights(campaign.external_campaign_id, 'today');
                    if (!metaInsights || (parseInt(metaInsights.impressions || '0') === 0 && parseFloat(metaInsights.spend || '0') === 0)) {
                        metaInsights = await metaAds.getInsights(campaign.external_campaign_id, 'yesterday');
                    }

                    if (metaInsights) {
                        snapshotData = metaAds.parseInsightsToSnapshot(campaign.id, metaInsights);
                    }
                } else if (campaign.platform === 'google' && campaign.external_campaign_id) {
                    let gMetrics = await googleAds.getMetrics(campaign.external_campaign_id, 'TODAY');
                    if (!gMetrics || (gMetrics.impressions === 0 && gMetrics.spend === 0)) {
                        gMetrics = await googleAds.getMetrics(campaign.external_campaign_id, 'YESTERDAY');
                    }
                    if (gMetrics) {
                        snapshotData = { campaign_id: campaign.id, ...gMetrics }
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

        // Disparar análise da IA apenas às 23 horas (Horário de Brasília)
        const { hour } = getCurrentTimeSP()
        const shouldTriggerAIAnalysis = await step.run('check-daily-ads-ai-analysis', async () => {
            if (hour !== '23') return false

            const today = getCurrentDateSP()
            const { data } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', 'ads_ai_analysis_last_date')
                .maybeSingle()

            return String(data?.value || '') !== today
        })

        if (shouldTriggerAIAnalysis) {
            for (const result of results) {
                await step.sendEvent('trigger-ai-analysis', {
                    name: 'ads/ai-analyze',
                    data: {
                        campaign_id: result.campaign_id,
                        metrics: result.metrics
                    }
                })
            }

            await step.run('mark-daily-ads-ai-analysis', async () => {
                await saveAppConfig(supabase, 'ads_ai_analysis_last_date', getCurrentDateSP())
            })
        }

        const financeSync = await step.run('sync-paid-ads-spend-to-finance', async () => {
            return syncPaidAdsSpendToFinance(supabase)
        })

        await step.run('mark-ads-sync-completed', async () => {
            await markAdsSyncCompleted(supabase)
        })

        return {
            campaigns_polled: results.length,
            analysis_triggered: shouldTriggerAIAnalysis,
            finance_sync: financeSync,
            sync_interval_minutes: schedule.intervalMinutes,
        }
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
// 6. Sincronizar Leads Nativos do Meta (Forms)
// =============================================

export const syncMetaLeadsCron = inngest.createFunction(
    { id: 'ads-sync-meta-leads', name: 'Sincronizar Leads Nativos (Meta Forms)' },
    { cron: '0 * * * *' }, // A cada hora
    async ({ step }) => {
        const supabase = getSupabase()

        // 1. Buscar formulários ativos
        const forms = await step.run('fetch-meta-forms', async () => {
            return await metaAds.getLeadForms()
        })

        if (!forms || forms.length === 0) return { message: 'Nenhum formulário encontrado' }

        const summary = { forked_leads: 0, new_leads: 0 }

        for (const form of forms) {
            const leads = await step.run(`fetch-leads-from-form-${form.id}`, async () => {
                return await metaAds.getLeadsFromForm(form.id)
            })

            for (const metaLead of leads) {
                const leadId = metaLead.id
                
                // Extrair dados dos campos
                const fieldMap: Record<string, string> = {}
                metaLead.field_data?.forEach((f: any) => {
                    if (f.name && f.values?.[0]) {
                        fieldMap[f.name] = f.values[0]
                    }
                })

                const name = fieldMap.full_name || fieldMap.first_name || fieldMap.last_name || null
                const email = fieldMap.email || null
                const phone = (fieldMap.phone_number || '').replace(/\D/g, '')

                // 2. Verificar duplicidade por meta_lead_id no metadata
                const alreadyExists = await step.run(`check-lead-${leadId}`, async () => {
                    const { data } = await supabase
                        .from('leads')
                        .select('id')
                        .contains('metadata', { meta_lead_id: leadId })
                        .maybeSingle()
                    return !!data
                })

                if (!alreadyExists) {
                    await step.run(`insert-lead-${leadId}`, async () => {
                        // Buscar ou criar visitante fictício para o lead nativo se necessário,
                        // mas idealmente marcamos o source como 'Facebook Ads'
                        const { error } = await supabase.from('leads').insert({
                            name,
                            email,
                            phone,
                            acquired_via: 'Meta Lead Form',
                            funnel_stage: 'lead',
                            metadata: {
                                meta_lead_id: leadId,
                                meta_form_id: form.id,
                                meta_campaign_id: metaLead.campaign_id,
                                meta_ad_id: metaLead.ad_id,
                                platform: 'meta'
                            }
                        })
                        if (error) console.error(`Erro ao inserir lead nativo: ${error.message}`)
                    })
                    summary.new_leads++
                }
            }
        }

        return summary
    }
)

// =============================================
// 7. Relatórios de Gestão (Olho de Deus)
// =============================================

import { generateDailyPilgerReport, generateWeeklyPilgerReport, collectMarketRadarData } from '../ai/pilger-ceo'

// =============================================
// 7. Monitoramento Real-Time (Radar de Mercado)
// =============================================

export const radarCollectionCron = inngest.createFunction(
    { id: 'market-radar-collection', name: 'Coletar Dados do Radar de Mercado' },
    { cron: '0 * * * *' }, // Executa a cada hora para avaliar horários
    async ({ step }) => {
        const supabase = getSupabase()

        // 1. Verificar horários configurados
        const config = await step.run('check-radar-schedule', async () => {
            const { data } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', ['radar_collection_times', 'radar_collection_days'])
            
            // Padrão: 06, 12, 18
            const map = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
            const targetHours = (map.radar_collection_times || '06,12,18')
                .split(',')
                .map((v: string) => v.trim().padStart(2, '0'))
                .filter(Boolean)
            const targetDays = (map.radar_collection_days || '0,1,2,3,4,5,6')
                .split(',')
                .map((v: string) => v.trim())
                .filter(Boolean)
            const { hour, dayOfWeek } = getCurrentTimeSP()

            return {
                shouldRun: targetHours.includes(hour) && targetDays.includes(dayOfWeek),
                currentSlot: hour,
                currentDay: dayOfWeek
            }
        })

        if (!config.shouldRun) {
            return { skipped: true, reason: 'schedule_not_matched', hour: config.currentSlot, day: config.currentDay }
        }

        // 2. Executar Coleta
        const result = await step.run('collect-radar-data', async () => {
            return await collectMarketRadarData(config.currentSlot)
        })

        return { collected: result.length, slot: config.currentSlot }
    }
)

// Função auxiliar para pegar hora atual em fuso horário (America/Sao_Paulo)
function getCurrentTimeSP() {
    const spTime = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const dateObj = new Date(spTime);
    
    // Fallback manual caso toLocaleString falhe em extrair corretamente (raro em Node moderno)
    // Mas para garantir 100% de estabilidade na comparação de strings:
    const hour = dateObj.getHours().toString().padStart(2, '0');
    const dayOfWeek = dateObj.getDay().toString();
    
    return { dayOfWeek, hour }
}

function getCurrentDateSP() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())
}

export const generateDailyPilgerReportCron = inngest.createFunction(
    { id: 'pilger-daily-report', name: 'Gerar Relatório Diário Pilger AI' },
    { cron: '0 * * * *' }, // Executa a cada hora para avaliar configurações
    async ({ step }) => {
        const supabase = getSupabase()

        // 1. Verificar agendamento dinâmico (dias + horários)
        const config = await step.run('check-daily-schedule', async () => {
            const { data } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', ['pilger_daily_time', 'pilger_daily_days'])

            const map = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
            const targetHours = (map.pilger_daily_time || '23')
                .split(',')
                .map((v: string) => v.trim().padStart(2, '0'))
                .filter(Boolean)
            const targetDays = (map.pilger_daily_days || '0,1,2,3,4,5,6')
                .split(',')
                .map((v: string) => v.trim())
                .filter(Boolean)
            const { hour, dayOfWeek } = getCurrentTimeSP()

            return {
                shouldRun: targetHours.includes(hour) && targetDays.includes(dayOfWeek),
                currentSlot: hour,
                currentDay: dayOfWeek,
            }
        })

        if (!config.shouldRun) {
            return { skipped: true, reason: 'schedule_mismatch', current_hour: config.currentSlot, current_day: config.currentDay }
        }

        // 2. Extra proteção contra execuções duplas no mesmo horário do mesmo dia
        const hasRunToday = await step.run('check-already-run', async () => {
             const { data } = await supabase
                .from('pilger_ai_reports')
                .select('id')
                .eq('type', 'daily')
                // Supabase doesn't easily store runId yet in the default schema, so we can just look at created_at for the last 50 minutes.
                .gte('created_at', new Date(Date.now() - 50 * 60000).toISOString())
                .limit(1)
                
             return data && data.length > 0
        })

        if (hasRunToday) {
            return { skipped: true, reason: 'already_run_this_hour' }
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

        // 1. Verificar agendamento dinâmico (dias + horários)
        const config = await step.run('check-weekly-schedule', async () => {
            const { data } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', ['pilger_weekly_days', 'pilger_weekly_times', 'pilger_weekly_day', 'pilger_weekly_time'])

            const map = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
            const targetDays = (map.pilger_weekly_days || map.pilger_weekly_day || '1')
                .split(',')
                .map((v: string) => v.trim())
                .filter(Boolean)
            const targetHours = (map.pilger_weekly_times || map.pilger_weekly_time || '23')
                .split(',')
                .map((v: string) => v.trim().padStart(2, '0'))
                .filter(Boolean)

            const { dayOfWeek, hour } = getCurrentTimeSP()
            return {
                shouldRun: targetDays.includes(dayOfWeek) && targetHours.includes(hour),
                currentDay: dayOfWeek,
                currentHour: hour,
            }
        })

        if (!config.shouldRun) {
            return { skipped: true, reason: 'schedule_mismatch', current_day: config.currentDay, current_hour: config.currentHour }
        }

        // 2. Extra proteção
        const hasRunToday = await step.run('check-already-run', async () => {
             const { data } = await supabase
                .from('pilger_ai_reports')
                .select('id')
                .eq('type', 'weekly')
                .gte('created_at', new Date(Date.now() - 50 * 60000).toISOString())
                .limit(1)
                
             return data && data.length > 0
        })

        if (hasRunToday) {
            return { skipped: true, reason: 'already_run_this_hour' }
        }

        // 3. Executar Relatório
        const result = await step.run('generate-weekly-report', async () => {
            return await generateWeeklyPilgerReport()
        })
        return result
    }
)


