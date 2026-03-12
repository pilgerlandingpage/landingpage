// =============================================
// Alertas WhatsApp via ConnectyHub para Admins
// =============================================
// Envia alertas de tráfego e ações da IA
// para os administradores via WhatsApp.
// =============================================

import { sendWhatsAppMessage } from '../connectyhub'
import type { AICampaignAlert, AdminAlertContact, AlertType, AlertUrgency } from './types'

// --- Mapa de urgência (para comparação) ---

const URGENCY_LEVEL: Record<AlertUrgency, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
}

// --- Buscar contatos de admin ativos ---

async function getActiveAdminContacts(
    alertType: AlertType,
    urgency: AlertUrgency
): Promise<AdminAlertContact[]> {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
        .from('admin_alert_contacts')
        .select('*')
        .eq('is_active', true)

    if (error || !data) {
        console.error('Erro ao buscar contatos admin:', error)
        return []
    }

    // Filtrar por tipo de alerta e urgência mínima
    return (data as AdminAlertContact[]).filter(contact => {
        // Verificar tipo de alerta
        if (alertType === 'action' && !contact.receive_ai_actions) return false
        if (alertType === 'budget_alert' && !contact.receive_budget_alerts) return false
        if ((alertType === 'insight' || alertType === 'warning') && !contact.receive_traffic_alerts) return false

        // Verificar urgência mínima
        if (URGENCY_LEVEL[urgency] < URGENCY_LEVEL[contact.min_urgency]) return false

        return true
    })
}

// --- Formatar mensagem de alerta ---

const URGENCY_EMOJI: Record<AlertUrgency, string> = {
    low: 'ℹ️',
    medium: '⚠️',
    high: '🚨',
    critical: '🔴'
}

const TYPE_EMOJI: Record<AlertType, string> = {
    insight: '💡',
    warning: '⚠️',
    action: '🤖',
    budget_alert: '💰'
}

const TYPE_LABEL: Record<AlertType, string> = {
    insight: 'Insight',
    warning: 'Aviso',
    action: 'Ação Automática',
    budget_alert: 'Alerta de Orçamento'
}

function formatAlertMessage(
    alert: Pick<AICampaignAlert, 'type' | 'urgency' | 'message' | 'action_taken'>,
    campaignName: string,
    platform: string
): string {
    const emoji = TYPE_EMOJI[alert.type]
    const urgencyEmoji = URGENCY_EMOJI[alert.urgency]
    const typeLabel = TYPE_LABEL[alert.type]

    let msg = `🤖 *Alerta IA — Pilger Tráfego*\n\n`
    msg += `📛 Campanha: ${campaignName} — ${platform === 'meta' ? 'Meta Ads' : 'Google Ads'}\n`
    msg += `${urgencyEmoji} Tipo: ${emoji} ${typeLabel}\n`

    if (alert.action_taken && alert.action_taken !== 'NONE') {
        const actionLabels: Record<string, string> = {
            'PAUSE_AD': '⏸️ ANÚNCIO PAUSADO',
            'SCALE_BUDGET': '📈 ORÇAMENTO ESCALADO',
            'REDUCE_BUDGET': '📉 ORÇAMENTO REDUZIDO',
            'SWAP_CREATIVE': '🔄 TROCAR CRIATIVO'
        }
        msg += `🎯 Ação: ${actionLabels[alert.action_taken] || alert.action_taken}\n`
    }

    msg += `\n📝 ${alert.message}\n`

    // Link para o painel (será interpolado com a URL real)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'seusite.com'
    msg += `\n🔗 Painel: https://${siteUrl}/admin/ads`

    return msg
}

// --- Enviar alerta para todos os admins elegíveis ---

export async function sendAlertToAdmins(alert: {
    type: AlertType
    urgency: AlertUrgency
    message: string
    action_taken?: string
    campaign_name: string
    platform: string
}): Promise<{ sent: number; errors: number }> {
    const contacts = await getActiveAdminContacts(alert.type, alert.urgency)

    if (contacts.length === 0) {
        console.log(`Nenhum admin para receber alerta tipo=${alert.type} urgencia=${alert.urgency}`)
        return { sent: 0, errors: 0 }
    }

    const formattedMessage = formatAlertMessage(
        {
            type: alert.type,
            urgency: alert.urgency,
            message: alert.message,
            action_taken: alert.action_taken as AICampaignAlert['action_taken']
        },
        alert.campaign_name,
        alert.platform
    )

    let sent = 0
    let errors = 0

    for (const contact of contacts) {
        try {
            await sendWhatsAppMessage({
                phone: contact.phone,
                message: formattedMessage
            })
            sent++
            console.log(`✅ Alerta WhatsApp enviado para ${contact.name} (${contact.phone})`)
        } catch (err) {
            errors++
            console.error(`❌ Falha ao enviar alerta para ${contact.name}:`, err)
        }
    }

    return { sent, errors }
}

// --- Enviar relatório diário ---

export async function sendDailyReport(report: {
    total_spend: number
    total_leads: number
    avg_cpa: number
    best_campaign: string
    worst_campaign: string
    campaigns_active: number
    campaigns_paused: number
}): Promise<void> {
    const contacts = await getActiveAdminContacts('insight', 'low')

    const msg = [
        `📊 *Relatório Diário — Pilger Tráfego*`,
        ``,
        `💰 Gasto Total: R$ ${report.total_spend.toFixed(2)}`,
        `👥 Leads Captados: ${report.total_leads}`,
        `📈 CPA Médio: R$ ${report.avg_cpa.toFixed(2)}`,
        ``,
        `🏆 Melhor Campanha: ${report.best_campaign}`,
        `⚠️ Pior Campanha: ${report.worst_campaign}`,
        ``,
        `✅ Ativas: ${report.campaigns_active} | ⏸️ Pausadas: ${report.campaigns_paused}`,
    ].join('\n')

    for (const contact of contacts) {
        try {
            await sendWhatsAppMessage({ phone: contact.phone, message: msg })
        } catch (err) {
            console.error(`Falha no relatório diário para ${contact.name}:`, err)
        }
    }
}
