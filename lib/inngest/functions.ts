import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage, interpolateTemplate } from '../connectyhub'
import { scrapePage } from '../scraper'
import { generateLandingPageContent } from '../ai/generation'
import { uploadImageToR2 } from '../storage/r2'
import { v4 as uuidv4 } from 'uuid'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// Helper to slugify text
function slugify(text: string) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
}

export const processCloningJob = inngest.createFunction(
    { id: 'process-cloning-job', name: 'Process Cloning Job', concurrency: 5 },
    { event: 'cloner/process-url' },
    async ({ event, step }) => {
        const { pageId, url, customPrompt, userId } = event.data
        const supabase = getSupabase()

        // 1. Update Status to Processing
        await step.run('update-status-processing', async () => {
            await supabase.from('landing_pages').update({ status: 'processing' }).eq('id', pageId)
        })

        // 2. Scrape Page
        const scrapedData = await step.run('scrape-url', async () => {
            return await scrapePage(url)
        })

        // 3. Generate Content with Gemini
        const aiContent = await step.run('generate-content', async () => {
            return await generateLandingPageContent(scrapedData.html, customPrompt)
        })

        // 4. Process Images (Upload to R2)
        const processedContent = await step.run('process-images', async () => {
            const newContent = { ...aiContent }

            // Process Gallery
            if (newContent.custom_gallery && Array.isArray(newContent.custom_gallery)) {
                const newGallery = []
                for (const imgUrl of newContent.custom_gallery) {
                    if (imgUrl && imgUrl.startsWith('http')) {
                        const key = `cloned/${pageId}/${uuidv4()}.jpg`
                        const r2Url = await uploadImageToR2(imgUrl, key)
                        newGallery.push(r2Url)
                    }
                }
                newContent.custom_gallery = newGallery
            }

            // Process Hero Image
            if (newContent.custom_hero_image && newContent.custom_hero_image.startsWith('http')) {
                const key = `cloned/${pageId}/hero-${uuidv4()}.jpg`
                const r2Url = await uploadImageToR2(newContent.custom_hero_image, key)
                newContent.custom_hero_image = r2Url
            }

            return newContent
        })

        // 5. Save Result & Update SEO/Agent
        await step.run('save-result', async () => {
            // Use custom_title from AI or fallback
            const title = processedContent.custom_title || processedContent.title || 'Nova Landing Page'
            const baseSlug = slugify(title)
            const finalSlug = `${baseSlug}-${uuidv4().substring(0, 4)}`

            // Try to find a default agent if none assigned
            const { data: pageNow } = await supabase.from('landing_pages').select('ai_agent_id').eq('id', pageId).single()
            let agentId = pageNow?.ai_agent_id

            if (!agentId) {
                const { data: agents } = await supabase.from('ai_agents').select('id').limit(1)
                if (agents && agents.length > 0) agentId = agents[0].id
            }

            const { error } = await supabase.from('landing_pages').update({
                status: 'completed',
                content: processedContent,
                title: title,
                slug: finalSlug,
                description: processedContent.custom_description || processedContent.custom_seo_description || '',
                ai_agent_id: agentId,
                updated_at: new Date().toISOString()
            }).eq('id', pageId)

            if (error) throw new Error(error.message)
        })

        return { success: true, pageId }
    }
)

// ------------------------------------------------------------------
// EXISTING FUNCTIONS (Welcome, FollowUp, VIP, Automation)
// ------------------------------------------------------------------

// Send immediate welcome message
export const sendWelcome = inngest.createFunction(
    { id: 'send-welcome-message', name: 'Send Welcome WhatsApp Message' },
    { event: 'lead/created' },
    async ({ event }) => {
        const { lead_id, phone, name, property_title } = event.data

        if (!phone) return { skipped: true, reason: 'no phone' }

        const supabase = getSupabase()
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
            await supabase.from('leads').update({ whatsapp_sent: true }).eq('id', lead_id)
            return { success: true }
        } catch (error) {
            console.error('Failed to send welcome message:', error)
            return { success: false, error: String(error) }
        }
    }
)

export const sendFollowUp = inngest.createFunction(
    { id: 'send-followup-message', name: 'Send Follow-up Message' },
    { event: 'lead/schedule-followup' },
    async ({ event, step }) => {
        const { phone, name, delay_minutes, message_template, property_title } = event.data
        await step.sleep('wait-before-followup', `${delay_minutes}m`)
        const message = interpolateTemplate(message_template, {
            name: name || 'visitante',
            property: property_title || 'nossos imóveis',
        })
        try {
            await sendWhatsAppMessage({ phone, message })
            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    }
)

export const vipAlert = inngest.createFunction(
    { id: 'vip-lead-alert', name: 'VIP Lead Alert to Realtor' },
    { event: 'lead/vip-detected' },
    async ({ event }) => {
        const { name, phone, property_title, ai_summary } = event.data
        const supabase = getSupabase()
        const { data: config } = await supabase.from('app_config').select('value').eq('key', 'realtor_phone').single()

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

export const processAutomationRule = inngest.createFunction(
    { id: 'process-automation-rule', name: 'Process Automation Rule' },
    { event: 'automation/execute-rule' },
    async ({ event, step }) => {
        const { rule_id, lead_id, phone, name, delay_minutes, message_template, property_title } = event.data
        if (delay_minutes > 0) await step.sleep('wait-for-rule', `${delay_minutes}m`)

        const message = interpolateTemplate(message_template, { name: name || 'visitante', property: property_title || 'nossos imóveis' })
        const supabase = getSupabase()

        try {
            await sendWhatsAppMessage({ phone, message })
            await supabase.from('lp_message_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('lead_id', lead_id).eq('rule_id', rule_id).eq('status', 'pending')
            return { success: true }
        } catch (error) {
            await supabase.from('lp_message_queue').update({ status: 'failed' }).eq('lead_id', lead_id).eq('rule_id', rule_id).eq('status', 'pending')
            return { success: false, error: String(error) }
        }
    }
)

export const processChatHandover = inngest.createFunction(
    { id: 'process-chat-handover', name: 'Send Chat WhatsApp Handover', retries: 3 },
    { event: 'chat/handover' },
    async ({ event }) => {
        const {
            leadPhone,
            brokerPhone,
            brokerMsg,
            leadMsg,
            brokerConnectyhubInstance,
            brokerConnectyhubApiKey,
            brokerConnectyhubApiUrl
        } = event.data

        const results = { broker: false, lead: false }

        // 1. Send to Broker (using default system instance)
        if (brokerPhone) {
            try {
                await sendWhatsAppMessage({
                    phone: brokerPhone,
                    message: brokerMsg
                })
                results.broker = true
                console.log(`[Inngest Handover] ✅ WA successfully sent to broker: ${brokerPhone}`)
            } catch (error) {
                console.error(`[Inngest Handover] ❌ Failed to send WA to broker: ${brokerPhone}`, error)

                // Diagnostic logging to DB since Vercel logs are locked
                try {
                    const supabase = getSupabase()
                    await supabase.from('funnel_events').insert({
                        event_type: 'system_error',
                        metadata: {
                            error_source: 'inngest_broker_wa_send',
                            error_message: String(error),
                            phone: brokerPhone
                        }
                    })
                } catch (e) { /* ignore db log errors */ }

                // Continue to try sending to lead even if broker fails
            }
        }

        // 2. Send to Lead (using broker's custom instance)
        if (brokerConnectyhubInstance) {
            try {
                await sendWhatsAppMessage({
                    phone: leadPhone,
                    message: leadMsg,
                    instanceName: brokerConnectyhubInstance,
                    apiKey: brokerConnectyhubApiKey,
                    apiUrl: brokerConnectyhubApiUrl
                })
                results.lead = true
                console.log(`[Inngest Handover] ✅ WA successfully sent to lead: ${leadPhone}`)
            } catch (error) {
                console.error(`[Inngest Handover] ❌ Failed to send WA to lead: ${leadPhone}`, error)
                // If the lead message fails, we throw to trigger Inngest auto-retry
                throw new Error(`Failed to send WhatsApp to lead: ${error}`)
            }
        }

        return { success: true, results }
    }
)

// EXPORT ALL FUNCTIONS
export const functions = [
    sendWelcome,
    sendFollowUp,
    vipAlert,
    processAutomationRule,
    processCloningJob, // Existing function
    processChatHandover // New function for chat
]
