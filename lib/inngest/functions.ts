import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage, interpolateTemplate } from '../connectyhub'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// Send immediate welcome message when a new lead is captured
export const sendWelcome = inngest.createFunction(
    { id: 'send-welcome-message', name: 'Send Welcome WhatsApp Message' },
    { event: 'lead/created' },
    async ({ event }) => {
        const { lead_id, phone, name, property_title } = event.data

        if (!phone) return { skipped: true, reason: 'no phone' }

        const supabase = getSupabase()

        // Get welcome template from app_config
        const { data: config } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'welcome_message_template')
            .single()

        const template = config?.value ||
            'Olá {{name}}! 👋 Obrigado pelo seu interesse em {{property}}. Um de nossos consultores entrará em contato em breve. 🏠✨'

        const message = interpolateTemplate(template, {
            name: name || 'visitante',
            property: property_title || 'nossos imóveis',
        })

        try {
            await sendWhatsAppMessage({ phone, message })
            await supabase
                .from('leads')
                .update({ whatsapp_sent: true })
                .eq('id', lead_id)
            return { success: true }
        } catch (error) {
            console.error('Failed to send welcome message:', error)
            return { success: false, error: String(error) }
        }
    }
)

// Send follow-up message after delay
export const sendFollowUp = inngest.createFunction(
    { id: 'send-followup-message', name: 'Send Follow-up Message' },
    { event: 'lead/schedule-followup' },
    async ({ event, step }) => {
        const { lead_id, phone, name, delay_minutes, message_template, property_title } = event.data

        // Wait for the specified delay
        await step.sleep('wait-before-followup', `${delay_minutes}m`)

        const message = interpolateTemplate(message_template, {
            name: name || 'visitante',
            property: property_title || 'nossos imóveis',
        })

        try {
            await sendWhatsAppMessage({ phone, message })
            return { success: true }
        } catch (error) {
            console.error('Failed to send follow-up:', error)
            return { success: false, error: String(error) }
        }
    }
)

// Alert realtor about VIP lead
export const vipAlert = inngest.createFunction(
    { id: 'vip-lead-alert', name: 'VIP Lead Alert to Realtor' },
    { event: 'lead/vip-detected' },
    async ({ event }) => {
        const { name, phone, property_title, ai_summary } = event.data
        const supabase = getSupabase()

        // Get realtor phone from app_config
        const { data: config } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'realtor_phone')
            .single()

        if (!config?.value) return { skipped: true, reason: 'no realtor phone configured' }

        const message = `🔥 *LEAD VIP DETECTADO!*\n\n👤 Nome: ${name || 'Não informado'}\n📱 Telefone: ${phone || 'Não informado'}\n🏠 Imóvel: ${property_title || 'N/A'}\n\n📊 *Resumo da IA:*\n${ai_summary || 'Sem resumo disponível'}\n\n⚡ Entre em contato agora!`

        try {
            await sendWhatsAppMessage({ phone: config.value, message })
            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    }
)

// Process automation rules for scheduled messages
export const processAutomationRule = inngest.createFunction(
    { id: 'process-automation-rule', name: 'Process Automation Rule' },
    { event: 'automation/execute-rule' },
    async ({ event, step }) => {
        const { rule_id, lead_id, phone, name, delay_minutes, message_template, property_title } = event.data

        if (delay_minutes > 0) {
            await step.sleep('wait-for-rule', `${delay_minutes}m`)
        }

        const message = interpolateTemplate(message_template, {
            name: name || 'visitante',
            property: property_title || 'nossos imóveis',
        })

        const supabase = getSupabase()

        try {
            await sendWhatsAppMessage({ phone, message })
            // Update message_queue status
            await supabase
                .from('lp_message_queue')
                .update({ status: 'sent', sent_at: new Date().toISOString() })
                .eq('lead_id', lead_id)
                .eq('rule_id', rule_id)
                .eq('status', 'pending')
            return { success: true }
        } catch (error) {
            await supabase
                .from('lp_message_queue')
                .update({ status: 'failed' })
                .eq('lead_id', lead_id)
                .eq('rule_id', rule_id)
                .eq('status', 'pending')
            return { success: false, error: String(error) }
        }
    }
)

export const functions = [sendWelcome, sendFollowUp, vipAlert, processAutomationRule]
