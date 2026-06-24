// =============================================
// Alertas WhatsApp via ConnectyHub para Trafego
// =============================================

import {
    getSectorNotificationDeliveries,
    resolveSectorWhatsappInstance,
} from '@/lib/notifications/sector-recipients'
import { sendMenuMessage, sendWhatsAppMessage } from '../uazapi'
import type { AICampaignAlert, AlertType, AlertUrgency } from './types'
import type { VitorMonitoringSnapshot } from './vitor-monitoring'

type SupabaseAdmin = {
    from: (table: string) => any
}

async function createSupabaseAdmin() {
    const { createClient } = await import('@supabase/supabase-js')
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function getTrafficPaidRecipients(
    supabase: SupabaseAdmin,
    options: { eventType: string; critical?: boolean; includeDiretoria?: boolean }
) {
    return getSectorNotificationDeliveries(supabase, 'trafego_pago', options)
}

const URGENCY_EMOJI: Record<AlertUrgency, string> = {
    low: 'INFO',
    medium: 'ATENCAO',
    high: 'URGENTE',
    critical: 'CRITICO',
}

const TYPE_EMOJI: Record<AlertType, string> = {
    insight: 'INSIGHT',
    warning: 'AVISO',
    action: 'IA',
    budget_alert: 'ORCAMENTO',
}

const TYPE_LABEL: Record<AlertType, string> = {
    insight: 'Insight',
    warning: 'Aviso',
    action: 'Acao automatica',
    budget_alert: 'Alerta de orcamento',
}

function formatAlertMessage(
    alert: Pick<AICampaignAlert, 'type' | 'urgency' | 'message' | 'action_taken'>,
    campaignName: string,
    platform: string
): string {
    const emoji = TYPE_EMOJI[alert.type]
    const urgencyEmoji = URGENCY_EMOJI[alert.urgency]
    const typeLabel = TYPE_LABEL[alert.type]

    let msg = `*Alerta IA - Pilger Trafego*\n\n`
    msg += `Campanha: ${campaignName} - ${platform === 'meta' ? 'Meta Ads' : 'Google Ads'}\n`
    msg += `Prioridade: ${urgencyEmoji}\n`
    msg += `Tipo: ${emoji} ${typeLabel}\n`

    if (alert.action_taken && alert.action_taken !== 'NONE') {
        const actionLabels: Record<string, string> = {
            PAUSE_AD: 'ANUNCIO PAUSADO',
            SCALE_BUDGET: 'ORCAMENTO ESCALADO',
            REDUCE_BUDGET: 'ORCAMENTO REDUZIDO',
            SWAP_CREATIVE: 'TROCAR CRIATIVO',
        }
        msg += `Acao: ${actionLabels[alert.action_taken] || alert.action_taken}\n`
    }

    msg += `\n${alert.message}\n`

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://guilhermepilger.ai')
    msg += `\nPainel: ${siteUrl.replace(/\/$/, '')}/admin/ads`

    return msg
}

function vitorPanelUrl(origin?: string | null) {
    const baseUrl = (origin || process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://guilhermepilger.ai')).replace(/\/$/, '')
    return `${baseUrl}/admin/ads/vitor`
}

function getVitorMonitoringPriority(snapshot: VitorMonitoringSnapshot): AlertUrgency | null {
    if (snapshot.alerts.some(alert => alert.severity === 'critical') || snapshot.health.score < 45) return 'critical'
    if (snapshot.alerts.some(alert => alert.severity === 'high') || snapshot.health.score < 65) return 'high'
    return null
}

function getVitorMonitoringSignature(snapshot: VitorMonitoringSnapshot) {
    const topAlerts = snapshot.alerts
        .filter(alert => ['critical', 'high'].includes(alert.severity))
        .slice(0, 4)
        .map(alert => `${alert.type}:${alert.title}`)
        .join('|')
    return `${snapshot.health.tone}:${Math.floor(snapshot.health.score / 10)}:${topAlerts || 'no_high_alert'}`
}

async function getRecentVitorMonitoringAlert(supabase: SupabaseAdmin) {
    const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'vitor_monitoring_whatsapp_last_alert')
        .maybeSingle()

    try {
        return data?.value ? JSON.parse(String(data.value)) : null
    } catch {
        return null
    }
}

async function saveVitorMonitoringAlertStamp(supabase: SupabaseAdmin, value: Record<string, unknown>) {
    await supabase
        .from('app_config')
        .upsert({
            key: 'vitor_monitoring_whatsapp_last_alert',
            value: JSON.stringify(value),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
}

function formatVitorMonitoringMessage(snapshot: VitorMonitoringSnapshot) {
    const priority = getVitorMonitoringPriority(snapshot) || 'high'
    const topAlerts = snapshot.alerts
        .filter(alert => ['critical', 'high'].includes(alert.severity))
        .slice(0, 3)
    const learnings = snapshot.learnings.slice(0, 3)
    const recommendations = snapshot.recommendations.slice(0, 3)

    return [
        '*Alerta Vitor Trafego Pago*',
        '',
        `Prioridade: ${URGENCY_EMOJI[priority]}`,
        `Saude do trafego: ${snapshot.health.score}/100 (${snapshot.health.label})`,
        `Gasto: R$ ${Math.round(Number(snapshot.metrics.spend || 0))}`,
        `Leads Meta: ${Number(snapshot.metrics.leads || 0)} | Leads pagos CRM: ${Number(snapshot.metrics.crm_paid_leads || 0)}`,
        `CPL medio: R$ ${Math.round(Number(snapshot.metrics.avg_cpl || 0))}`,
        '',
        topAlerts.length ? 'Alertas principais:' : 'Alerta principal:',
        ...(topAlerts.length
            ? topAlerts.map(alert => `- ${alert.title}: ${alert.message}`)
            : [`- Saude abaixo do limite definido pelo Vitor.`]),
        '',
        recommendations.length ? 'Acao recomendada:' : '',
        ...recommendations.map(item => `- ${item.action}`),
        '',
        learnings.length ? 'Aprendizados recentes:' : '',
        ...learnings.map(item => `- ${item.title}: ${item.insight}`),
        '',
        'Nada foi publicado automaticamente. Revise no painel antes de agir.',
    ].filter(Boolean).join('\n')
}

export async function sendVitorMonitoringAlert(
    supabase: SupabaseAdmin,
    snapshot: VitorMonitoringSnapshot,
    options: { origin?: string | null; force?: boolean } = {},
): Promise<{ sent: number; errors: number; skipped?: boolean; reason?: string; priority?: AlertUrgency }> {
    const priority = getVitorMonitoringPriority(snapshot)
    if (!priority && !options.force) {
        return { sent: 0, errors: 0, skipped: true, reason: 'Monitoramento do Vitor sem alerta alto ou critico.' }
    }

    const signature = getVitorMonitoringSignature(snapshot)
    const lastAlert = await getRecentVitorMonitoringAlert(supabase)
    const lastSentAt = lastAlert?.sent_at ? new Date(lastAlert.sent_at).getTime() : 0
    const sixHours = 6 * 60 * 60 * 1000
    if (!options.force && lastSentAt && Date.now() - lastSentAt < sixHours && String(lastAlert?.signature || '') === signature) {
        return { sent: 0, errors: 0, skipped: true, reason: 'Alerta do Vitor ja enviado nas ultimas 6 horas.', priority: priority || 'high' }
    }

    const deliveries = await getTrafficPaidRecipients(supabase, {
        eventType: 'ads_alert',
        critical: priority === 'critical',
        includeDiretoria: priority === 'critical',
    })

    if (!deliveries.length) {
        return { sent: 0, errors: 0, skipped: true, reason: 'Nenhum envolvido configurado para alertas do Vitor.', priority: priority || 'high' }
    }

    const instanceToken = await resolveSectorWhatsappInstance(supabase)
    if (!instanceToken) {
        return { sent: 0, errors: deliveries.length, skipped: true, reason: 'Nenhuma instancia WhatsApp conectada.', priority: priority || 'high' }
    }

    const message = formatVitorMonitoringMessage(snapshot)
    const panelUrl = vitorPanelUrl(options.origin)
    let sent = 0
    let errors = 0

    for (const delivery of deliveries) {
        try {
            await sendMenuMessage({
                phone: delivery.phone,
                text: message,
                type: 'button',
                choices: [`Abrir Vitor|url:${panelUrl}`],
                footerText: 'Pilger Trafego',
                instanceToken,
            })
            sent += 1
        } catch (buttonError) {
            console.warn('[Vitor Monitoring Alert] button send failed, falling back to text:', buttonError)
            try {
                await sendWhatsAppMessage({
                    phone: delivery.phone,
                    message: `${message}\n\nAbrir Vitor: ${panelUrl}`,
                    instanceToken,
                })
                sent += 1
            } catch (textError) {
                errors += 1
                console.error('[Vitor Monitoring Alert] text fallback failed:', textError)
            }
        }
    }

    if (sent > 0) {
        await saveVitorMonitoringAlertStamp(supabase, {
            sent_at: new Date().toISOString(),
            signature,
            priority: priority || 'high',
            health: snapshot.health,
            alerts: snapshot.alerts.slice(0, 4),
            sent,
        })
    }

    return { sent, errors, priority: priority || 'high' }
}

// Envia alertas de trafego para os envolvidos configurados no setor.
export async function sendAlertToAdmins(alert: {
    type: AlertType
    urgency: AlertUrgency
    message: string
    action_taken?: string
    campaign_name: string
    platform: string
}): Promise<{ sent: number; errors: number }> {
    const supabase = await createSupabaseAdmin()
    const critical = alert.urgency === 'high' || alert.urgency === 'critical'
    const deliveries = await getTrafficPaidRecipients(supabase, {
        eventType: 'ads_alert',
        critical,
        includeDiretoria: alert.urgency === 'critical',
    })

    if (!deliveries.length) {
        console.log(`Nenhum envolvido configurado para alertas do setor Trafego Pago.`)
        return { sent: 0, errors: 0 }
    }

    const formattedMessage = formatAlertMessage(
        {
            type: alert.type,
            urgency: alert.urgency,
            message: alert.message,
            action_taken: alert.action_taken as AICampaignAlert['action_taken'],
        },
        alert.campaign_name,
        alert.platform
    )

    const instanceToken = await resolveSectorWhatsappInstance(supabase)
    let sent = 0
    let errors = 0

    if (!instanceToken) {
        console.log('Nenhuma instancia WhatsApp conectada para alertas de Trafego Pago.')
        return { sent: 0, errors: deliveries.length }
    }

    for (const delivery of deliveries) {
        const name = delivery.member?.name || delivery.recipient.responsible_name || delivery.recipient.label
        try {
            await sendWhatsAppMessage({
                phone: delivery.phone,
                message: formattedMessage,
                instanceToken,
            })
            console.log(`Alerta WhatsApp de Trafego Pago enviado para ${name} (${delivery.phone})`)
            sent += 1
        } catch (err) {
            console.error(`Falha ao enviar alerta de Trafego Pago para ${name}:`, err)
            errors += 1
        }
    }

    return { sent, errors }
}

async function getRecentMetaPaymentAlert(supabase: SupabaseAdmin) {
    const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'meta_payment_issue_last_alert')
        .maybeSingle()

    try {
        return data?.value ? JSON.parse(String(data.value)) : null
    } catch {
        return null
    }
}

async function saveMetaPaymentAlertStamp(supabase: SupabaseAdmin, value: Record<string, unknown>) {
    await supabase
        .from('app_config')
        .upsert({
            key: 'meta_payment_issue_last_alert',
            value: JSON.stringify(value),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
}

export async function sendMetaPaymentIssueAlert(
    supabase: SupabaseAdmin,
    accountHealth: {
        name?: string | null
        status?: number | string | null
        status_label?: string | null
        message?: string | null
        balance?: number | null
        is_payment_issue?: boolean
    } | null | undefined,
    origin?: string | null
): Promise<{ sent: number; errors: number; skipped?: boolean; reason?: string }> {
    if (!accountHealth?.is_payment_issue) {
        return { sent: 0, errors: 0, skipped: true, reason: 'Conta Meta sem pendencia de pagamento.' }
    }

    const lastAlert = await getRecentMetaPaymentAlert(supabase)
    const lastSentAt = lastAlert?.sent_at ? new Date(lastAlert.sent_at).getTime() : 0
    const sixHours = 6 * 60 * 60 * 1000
    if (lastSentAt && Date.now() - lastSentAt < sixHours && String(lastAlert?.status || '') === String(accountHealth.status || '')) {
        return { sent: 0, errors: 0, skipped: true, reason: 'Alerta de pagamento Meta ja enviado nas ultimas 6 horas.' }
    }

    const deliveries = await getTrafficPaidRecipients(supabase, {
        eventType: 'meta_payment_issue',
        critical: true,
        includeDiretoria: true,
    })

    if (!deliveries.length) {
        return { sent: 0, errors: 0, skipped: true, reason: 'Nenhum envolvido configurado para problema de pagamento Meta.' }
    }

    const instanceToken = await resolveSectorWhatsappInstance(supabase)
    if (!instanceToken) {
        return { sent: 0, errors: deliveries.length, skipped: true, reason: 'Nenhuma instancia WhatsApp conectada.' }
    }

    const baseUrl = (origin || process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://guilhermepilger.ai')).replace(/\/$/, '')
    const panelUrl = `${baseUrl}/admin/ads`
    const balance = Number(accountHealth.balance || 0)
    const balanceLine = balance > 0
        ? `Pendencia informada: ${balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
        : 'Pendencia informada: verificar no Gerenciador de Anuncios'
    const message = [
        '*Alerta critico - Meta Ads*',
        '',
        `Conta: ${accountHealth.name || 'Conta Meta'}`,
        `Status: ${accountHealth.status_label || accountHealth.status || 'pendente'}`,
        balanceLine,
        '',
        accountHealth.message || 'A conta Meta pode estar pausada por pendencia de pagamento.',
        '',
        'Acao recomendada: regularizar pagamento antes de avaliar performance das campanhas.',
    ].join('\n')

    let sent = 0
    let errors = 0
    for (const delivery of deliveries) {
        try {
            await sendMenuMessage({
                phone: delivery.phone,
                text: message,
                type: 'button',
                choices: [`Abrir Meta Ads|url:${panelUrl}`],
                footerText: 'Pilger Trafego',
                instanceToken,
            })
            sent += 1
        } catch (buttonError) {
            console.warn('[Meta Payment Alert] button send failed, falling back to text:', buttonError)
            try {
                await sendWhatsAppMessage({
                    phone: delivery.phone,
                    message: `${message}\n\nAbrir Meta Ads: ${panelUrl}`,
                    instanceToken,
                })
                sent += 1
            } catch (textError) {
                errors += 1
                console.error('[Meta Payment Alert] text fallback failed:', textError)
            }
        }
    }

    if (sent > 0) {
        await saveMetaPaymentAlertStamp(supabase, {
            sent_at: new Date().toISOString(),
            status: accountHealth.status,
            status_label: accountHealth.status_label,
            balance: accountHealth.balance,
            sent,
        })
    }

    return { sent, errors }
}

export async function sendGooglePaymentIssueAlert(
    supabase: SupabaseAdmin,
    accountHealth: {
        name?: string | null
        customer_status?: string | null
        customer_status_label?: string | null
        billing_status?: string | null
        billing_status_label?: string | null
        payments_account?: string | null
        message?: string | null
        is_payment_issue?: boolean
    } | null | undefined,
    origin?: string | null
): Promise<{ sent: number; errors: number; skipped?: boolean; reason?: string }> {
    if (!accountHealth?.is_payment_issue) {
        return { sent: 0, errors: 0, skipped: true, reason: 'Conta Google Ads sem problema de pagamento/faturamento detectado.' }
    }

    const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'google_payment_issue_last_alert')
        .maybeSingle()

    let lastAlert: any = null
    try {
        lastAlert = data?.value ? JSON.parse(String(data.value)) : null
    } catch {
        lastAlert = null
    }

    const lastSentAt = lastAlert?.sent_at ? new Date(lastAlert.sent_at).getTime() : 0
    const sixHours = 6 * 60 * 60 * 1000
    const currentSignature = `${accountHealth.customer_status || ''}:${accountHealth.billing_status || ''}`
    if (lastSentAt && Date.now() - lastSentAt < sixHours && String(lastAlert?.signature || '') === currentSignature) {
        return { sent: 0, errors: 0, skipped: true, reason: 'Alerta de pagamento Google ja enviado nas ultimas 6 horas.' }
    }

    const deliveries = await getTrafficPaidRecipients(supabase, {
        eventType: 'google_payment_issue',
        critical: true,
        includeDiretoria: true,
    })

    if (!deliveries.length) {
        return { sent: 0, errors: 0, skipped: true, reason: 'Nenhum envolvido configurado para problema de pagamento Google.' }
    }

    const instanceToken = await resolveSectorWhatsappInstance(supabase)
    if (!instanceToken) {
        return { sent: 0, errors: deliveries.length, skipped: true, reason: 'Nenhuma instancia WhatsApp conectada.' }
    }

    const baseUrl = (origin || process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://guilhermepilger.ai')).replace(/\/$/, '')
    const panelUrl = `${baseUrl}/admin/ads/google`
    const billingLine = accountHealth.billing_status_label
        ? `Faturamento: ${accountHealth.billing_status_label}`
        : 'Faturamento: verificar no painel Google Ads'
    const message = [
        '*Alerta critico - Google Ads*',
        '',
        `Conta: ${accountHealth.name || 'Conta Google Ads'}`,
        `Status: ${accountHealth.customer_status_label || accountHealth.customer_status || 'desconhecido'}`,
        billingLine,
        accountHealth.payments_account ? `Conta de pagamento: ${accountHealth.payments_account}` : '',
        '',
        accountHealth.message || 'A conta Google Ads pode estar com problema de pagamento, faturamento ou suspensao.',
        '',
        'Acao recomendada: verificar faturamento e status da conta no Google Ads antes de avaliar performance.',
    ].filter(Boolean).join('\n')

    let sent = 0
    let errors = 0
    for (const delivery of deliveries) {
        try {
            await sendMenuMessage({
                phone: delivery.phone,
                text: message,
                type: 'button',
                choices: [`Abrir Google Ads|url:${panelUrl}`],
                footerText: 'Pilger Trafego',
                instanceToken,
            })
            sent += 1
        } catch (buttonError) {
            console.warn('[Google Payment Alert] button send failed, falling back to text:', buttonError)
            try {
                await sendWhatsAppMessage({
                    phone: delivery.phone,
                    message: `${message}\n\nAbrir Google Ads: ${panelUrl}`,
                    instanceToken,
                })
                sent += 1
            } catch (textError) {
                errors += 1
                console.error('[Google Payment Alert] text fallback failed:', textError)
            }
        }
    }

    if (sent > 0) {
        await supabase
            .from('app_config')
            .upsert({
                key: 'google_payment_issue_last_alert',
                value: JSON.stringify({
                    sent_at: new Date().toISOString(),
                    signature: currentSignature,
                    customer_status: accountHealth.customer_status,
                    billing_status: accountHealth.billing_status,
                    sent,
                }),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'key' })
    }

    return { sent, errors }
}

export async function sendDailyReport(report: {
    total_spend: number
    total_leads: number
    avg_cpa: number
    best_campaign: string
    worst_campaign: string
    campaigns_active: number
    campaigns_paused: number
}): Promise<void> {
    const supabase = await createSupabaseAdmin()
    const deliveries = await getTrafficPaidRecipients(supabase, { eventType: 'ads_daily_report' })

    if (!deliveries.length) {
        console.log('Nenhum envolvido configurado para relatorio diario de Trafego Pago.')
        return
    }

    const msg = [
        `*Relatorio Diario - Pilger Trafego*`,
        ``,
        `Gasto Total: R$ ${report.total_spend.toFixed(2)}`,
        `Leads Captados: ${report.total_leads}`,
        `CPA Medio: R$ ${report.avg_cpa.toFixed(2)}`,
        ``,
        `Melhor Campanha: ${report.best_campaign}`,
        `Pior Campanha: ${report.worst_campaign}`,
        ``,
        `Ativas: ${report.campaigns_active} | Pausadas: ${report.campaigns_paused}`,
    ].join('\n')

    const instanceToken = await resolveSectorWhatsappInstance(supabase)
    if (!instanceToken) {
        console.log('Nenhuma instancia WhatsApp conectada para relatorio diario de Trafego Pago.')
        return
    }

    let errors = 0
    for (const delivery of deliveries) {
        const name = delivery.member?.name || delivery.recipient.responsible_name || delivery.recipient.label
        try {
            await sendWhatsAppMessage({ phone: delivery.phone, message: msg, instanceToken })
        } catch (err) {
            errors += 1
            console.error(`Falha no relatorio diario de Trafego Pago para ${name}:`, err)
        }
    }

    if (errors > 0) {
        console.error(`Relatorio diario de Trafego Pago finalizado com ${errors} erro(s).`)
    }
}
