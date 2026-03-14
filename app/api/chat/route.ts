import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { extractLeadInfo } from '@/lib/ai/generation'
import { generateChatResponse } from '@/lib/ai/generation'
import { CONCIERGE_BASE_PROMPT, CONCIERGE_SAFEGUARD_RULES } from '@/lib/ai/prompts'
import { sendWhatsAppMessage } from '@/lib/connectyhub'
import { inngest } from '@/lib/inngest/client'

export const maxDuration = 60 // Allow longer timeout for AI processing

export async function POST(req: NextRequest) {
    try {
        const { message, history, broker, propertyId, page_context, page_content, landing_page_id, visitor_cookie_id, visitor_id: bodyVisitorId } = await req.json()
        const supabase = createAdminClient()

        // 0. Resolve Visitor ID & Save User Message
        let visitorId: string | null = null

        // Priority 1: Use visitor_id sent by client (if valid UUID)
        if (bodyVisitorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bodyVisitorId)) {
            visitorId = bodyVisitorId
        }

        // Priority 2: Resolve via cookie_id if no visitor_id provided
        else if (visitor_cookie_id) {
            const { data: vis } = await supabase.from('visitors').select('id').eq('visitor_cookie_id', visitor_cookie_id).maybeSingle()
            if (vis) {
                visitorId = vis.id
            } else {
                // FALLBACK: Create visitor on-the-fly
                console.log('[Chat] Visitor not found for cookie:', visitor_cookie_id, '- Creating new visitor...')
                const { data: newVis, error: createError } = await supabase.from('visitors').insert({
                    visitor_cookie_id,
                    first_visit_at: new Date().toISOString(),
                    last_visit_at: new Date().toISOString(),
                    page_views: 1,
                    // Try to guess country/city from headers later/async or just leave null
                }).select('id').single()

                if (newVis) {
                    visitorId = newVis.id
                    console.log('[Chat] New visitor created:', visitorId)
                } else {
                    console.error('[Chat] Failed to create visitor:', createError)
                }
            }
        } else {
            console.warn('[Chat] No visitor_id or visitor_cookie_id provided in request body')
        }

        if (visitorId) {
            // Save User Message
            await supabase.from('chat_history').insert({
                visitor_id: visitorId,
                role: 'user',
                content: message,
                landing_page_id: landing_page_id || null
            })
        }

        // 1. Get Base Agent Configuration
        const { data: agent } = await supabase
            .from('ai_agents')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        // Fetch all AI configs at once (prompt, timing, response length)
        const { data: allConfigs } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', [
                'concierge_system_prompt',
                'concierge_rules_prompt',
                'chat_delay_before_typing',
                'chat_typing_min_duration',
                'chat_typing_max_duration',
                'chat_max_response_length'
            ])

        const configMap: Record<string, string> = {}
        allConfigs?.forEach((c: { key: string; value: string }) => { configMap[c.key] = c.value })

        const promptConfig = configMap['concierge_system_prompt']
        const maxResponseLength = configMap['chat_max_response_length'] || 'Curta (2-3 frases)'

        // 2. Build dynamic context based on Page Type
        let dynamicContext = ''

        // Context: HOME (Marketplace)
        if (page_context?.type === 'home') {
            // Fetch 2 latest/featured properties to have something to talk about
            const { data: featured } = await supabase
                .from('properties')
                .select('title, price, city, bedrooms')
                .limit(2)
                .order('created_at', { ascending: false })

            dynamicContext += `\nCONTEXTO: O usuário está na PÁGINA INICIAL (Marketplace).`
            if (featured && featured.length > 0) {
                dynamicContext += `\nDESTAQUES RECENTES (se o cliente perguntar):`
                featured.forEach((p: any) => {
                    dynamicContext += `\n- ${p.title} em ${p.city} (${p.bedrooms} quartos). Preço: ${p.price ? 'R$ ' + p.price : 'Sob Consulta'}.`
                })
            }
        }

        // Context: LANDING PAGE or CLONED LANDING PAGE
        else if ((page_context?.type === 'landing_page' || page_context?.type === 'cloned_landing_page') && page_context.slug) {
            const { data: lp } = await supabase
                .from('landing_pages')
                .select('title, content, ai_context, property:properties(title, price, city, description)')
                .eq('slug', page_context.slug)
                .maybeSingle()

            if (lp) {
                const lpType = page_context.type === 'cloned_landing_page' ? 'Landing Page Clonada' : 'Landing Page de Alta Conversão'
                dynamicContext += `\nCONTEXTO: O usuário está na ${lpType}: "${lp.title}".`

                if (lp.property) {
                    const prop = lp.property as any
                    dynamicContext += `\nIMÓVEL DA OFERTA: "${prop.title}" em ${prop.city}.\nDetalhes: ${prop.description?.substring(0, 200)}...\nPreço: ${prop.price || 'Sob Consulta'}.`
                }

                const content: any = lp.content || {}
                if (content.seo_description) dynamicContext += `\nFoco da Venda: ${content.seo_description}`
                if (content.custom_cta) dynamicContext += `\nChamada para Ação: ${content.custom_cta}`

                // Injetar treinamento específico se houver
                if ((lp as any).ai_context) {
                    dynamicContext += `\n\nREGRAS E TREINAMENTO ESPECÍFICO PARA ESTA PÁGINA (OBRIGATÓRIO SEGUIR):\n${(lp as any).ai_context}`
                }
            }
        }

        // Context: PROPERTY DETAIL (or fallback legacy propertyId)
        else if ((page_context?.type === 'property' && page_context.id) || propertyId) {
            const id = page_context?.id || propertyId
            const { data: property } = await supabase
                .from('properties')
                .select('*')
                .eq('id', id)
                .maybeSingle()

            if (property) {
                dynamicContext += `\nCONTEXTO: O usuário está visualizando o imóvel: "${property.title}" localizado em ${property.city}.`
                dynamicContext += `\nDETALHES DO IMÓVEL: ${property.description || 'Descrição não disponível'}`
                dynamicContext += `\nPREÇO: ${property.price || 'Sob Consulta'}`
                dynamicContext += `\nCARACTERÍSTICAS: ${property.bedrooms} quartos, ${property.bathrooms} banheiros, ${property.area_m2}m².`
            }
        }

        // Append scraped page content from frontend DOM (if available)
        if (page_content && typeof page_content === 'string' && page_content.trim()) {
            dynamicContext += `\n\nCONTEÚDO VISÍVEL NA PÁGINA DO CLIENTE (use para persuadir):\n${page_content.substring(0, 800)}`
        }

        const brokerName = broker?.name || 'Guilherme Pilger'
        const brokerCreci = broker?.creci || 'CRECI 5555'
        const brokerPhone = broker?.phone
        const brokerConnectyhubChatMessage = broker?.connectyhub_chat_message

        // ===== DIAGNOSTIC: Log everything received from frontend =====
        console.log('[Chat Debug] ═══ BROKER DATA RECEIVED FROM FRONTEND ═══')
        console.log('[Chat Debug] broker object keys:', broker ? Object.keys(broker) : 'NULL')
        console.log('[Chat Debug] brokerName:', brokerName)
        console.log('[Chat Debug] brokerPhone:', brokerPhone)
        console.log('[Chat Debug] brokerConnectyhubChatMessage:', brokerConnectyhubChatMessage ? 'SET' : 'UNDEFINED')
        console.log('[Chat Debug] ════════════════════════════════════════════')

        // Priority order for Persona:
        // 1. Specific Broker Prompt (from virtual_brokers table)
        // 2. Maintenance Config Prompt (from app_config)
        // 3. AI Agents table prompt
        // 4. Default hardcoded fallback
        const basePrompt = broker?.system_prompt || promptConfig || agent?.system_prompt || CONCIERGE_BASE_PROMPT

        // Root rules: admin-configurable or default hardcoded
        const rulesPrompt = configMap['concierge_rules_prompt'] || CONCIERGE_SAFEGUARD_RULES

        const systemPrompt = basePrompt +
            ` SEU NOME É ${brokerName} (${brokerCreci}). ` +
            rulesPrompt + ' ' +
            `TAMANHO DAS RESPOSTAS MÁXIMO (OBRIGATÓRIO): ${maxResponseLength}. JAMAIS crie listas em tópicos (bullets). Responda com no máximo duas frases curtas (max 20 a 30 palavras no total). Seja muito conciso, focado no chat como se fosse um SMS. Além disso, SE o cliente lhe fornecer o Whatsapp dizendo que você pode contatá-lo lá, NUNCA diga que vai "repassar o contato para outro gestor ou corretor". Você DEVE DIZER QUE VOCÊ MESMO ("eu mesmo", "irei te chamar", "te chamo agora") vai entrar em contato com ele.` +
            dynamicContext

        // 3. Generate AI Response
        let response: string
        try {
            response = await generateChatResponse(history || [], message, systemPrompt)
        } catch (aiError: any) {
            console.error('[Chat] Gemini response failed:', aiError.message)

            // Handle 429 / Quota Error specifically
            if (aiError.message?.includes('429') || aiError.message?.includes('Quota exceeded')) {
                return NextResponse.json({
                    response: `⚠️ LIMITE DE USO EXCEDIDO (Erro 429). \n\nO modelo atual atingiu sua cota gratuita diária/minuto. Por favor, acesse a **Sala de Manutenção** e altere o "Modelo do Concierge" para o **gemini-1.5-flash** (que possui limites maiores) ou aguarde alguns instantes.`
                })
            }

            // In development, show the actual error to help debugging
            if (process.env.NODE_ENV === 'development') {
                return NextResponse.json({
                    response: `⚠️ ERRO DE SISTEMA: ${aiError.message}. \n\nVerifique a API Key e o Modelo na Sala de Manutenção.`
                })
            }

            // Return a graceful human-like fallback instead of an error in production
            return NextResponse.json({
                response: 'Perdão, estou com um probleminha aqui no sistema. Pode me enviar sua mensagem novamente? 😊'
            })
        }

        // 3.1 Save Assistant Message
        if (visitorId && response) {
            await supabase.from('chat_history').insert({
                visitor_id: visitorId,
                role: 'assistant',
                content: response,
                landing_page_id: landing_page_id || null
            })
        }

        // 4. Build timing config for frontend
        const timing = {
            delayBeforeTyping: parseInt(configMap['chat_delay_before_typing'] || '2') * 1000,
            typingMinDuration: parseInt(configMap['chat_typing_min_duration'] || '5') * 1000,
            typingMaxDuration: parseInt(configMap['chat_typing_max_duration'] || '7') * 1000,
        }

        // 5. Extract Lead Info — fire-and-forget (never blocks the response)
        const safeHistory = history || []
        const leadExtraction = (async () => {
            try {
                const conversationLog = safeHistory.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n') + `\nUser: ${message}\nAssistant: ${response}`
                const extracted = await extractLeadInfo(conversationLog)

                // Get visitor location from DB
                let locationData = {}
                if (visitorId) {
                    const { data: vis } = await supabase.from('visitors').select('country, city, region, detected_source').eq('id', visitorId).maybeSingle()
                    if (vis) {
                        locationData = {
                            country: vis.country,
                            city: vis.city,
                            state: vis.region,
                            source: vis.detected_source
                        }
                    }
                }

                const lastUserMessage = message // The current message being processed

                // fallback regex for phone if AI missed it (common for simple numbers)
                let finalPhone = extracted?.phone
                if (!finalPhone && lastUserMessage) {
                    // Matches: (XX) XXXXX-XXXX, XX 98888 8888, 47988888888
                    const phoneMatch = lastUserMessage.match(/(\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g)
                    // Simple check for at least 10 digits total to avoid false positives like dates "2024"
                    if (phoneMatch) {
                        const candidates = phoneMatch.map((p: string) => p.replace(/\D/g, '')).filter((p: string) => p.length >= 10)
                        if (candidates.length > 0) finalPhone = candidates[0]
                    }
                }

                // Sanitize phone
                if (finalPhone) {
                    finalPhone = finalPhone.replace(/\D/g, '')
                }

                console.log('[Chat] Extraction Result:', {
                    extractedName: extracted?.name,
                    extractedPhone: extracted?.phone,
                    regexPhone: finalPhone,
                    visitorId
                })

                if (visitorId && (extracted?.name || finalPhone)) {
                    const leadData: any = {
                        visitor_id: visitorId, // Link lead to visitor
                        name: extracted?.name || null,
                        phone: finalPhone || null,
                        email: extracted?.email || null,
                        ai_summary: extracted?.summary || null,
                        conversation_log: [...safeHistory, { role: 'user', content: message }, { role: 'assistant', content: response }], // Save full chat history
                        acquired_via: 'Concierge AI',
                        funnel_stage: 'lead',
                        // Add location data to root columns
                        country: (locationData as any).country || null,
                        city: (locationData as any).city || null,
                        state: (locationData as any).state || null,
                        lead_purpose: typeof extracted?.interest === 'string' ? extracted.interest.toLowerCase().trim() : null,
                        lead_budget: extracted?.budget || null,
                        lead_timeframe: extracted?.timeframe || null,
                        is_partner: extracted?.is_partner || false,
                        is_vip: extracted?.classification === 'vip',
                        lead_classification: extracted?.classification || 'cold',
                        metadata: {
                            budget: extracted?.budget || null,
                            timeframe: extracted?.timeframe || null,
                            interest: extracted?.interest || null,
                            is_partner: extracted?.is_partner || false,
                            property_id: propertyId || null,
                            page_url: page_context?.url || null
                        }
                    }

                    // Remove null/undefined keys from metadata
                    Object.keys(leadData.metadata).forEach(key => {
                        if (leadData.metadata[key] === null || leadData.metadata[key] === undefined) {
                            delete leadData.metadata[key]
                        }
                    })

                    // Check if lead already exists by phone or email, then update or insert
                    let existingLead = null

                    if (leadData.phone) {
                        const { data } = await supabase
                            .from('leads')
                            .select('id, phone, metadata, funnel_stage, visitor_id')
                            .eq('phone', leadData.phone)
                            .maybeSingle()
                        existingLead = data
                    }

                    if (!existingLead && leadData.email) {
                        const { data } = await supabase
                            .from('leads')
                            .select('id, phone, metadata, funnel_stage, visitor_id')
                            .eq('email', leadData.email)
                            .maybeSingle()
                        existingLead = data
                    }

                    // NEW: Check by Visitor ID (to catch "Inscrito Push" leads)
                    if (!existingLead && visitorId) {
                        const { data } = await supabase
                            .from('leads')
                            .select('id, phone, metadata, funnel_stage, visitor_id')
                            .eq('visitor_id', visitorId)
                            .maybeSingle()
                        existingLead = data
                    }


                    if (existingLead) {
                        // Prepare update data
                        const updateData: any = {
                            updated_at: new Date().toISOString(),
                            conversation_log: leadData.conversation_log, // Current session history
                            metadata: { ...existingLead.metadata, ...leadData.metadata }, // Merge metadata
                            // Promote funnel_stage to 'lead' when contact data is provided (e.g., from 'engaged' push subscriber)
                            ...((leadData.name || leadData.phone) && existingLead.funnel_stage === 'engaged' ? { funnel_stage: 'lead' } : {})
                        }

                        // Only update text fields if new value is present
                        // IMPORTANT: Don't overwrite name if lead already has one (AI extraction can hallucinate names)
                        if (leadData.name && !existingLead.name) updateData.name = leadData.name
                        if (leadData.phone) updateData.phone = leadData.phone
                        if (leadData.email) updateData.email = leadData.email
                        if (leadData.ai_summary) updateData.ai_summary = leadData.ai_summary
                        if (leadData.lead_classification) updateData.lead_classification = leadData.lead_classification
                        if (leadData.is_vip) updateData.is_vip = true
                        if (leadData.push_subscribed) updateData.push_subscribed = true
                        if (visitorId && !existingLead.visitor_id) updateData.visitor_id = visitorId
                        // Update qualification fields when new data is extracted
                        if (leadData.lead_purpose) updateData.lead_purpose = leadData.lead_purpose
                        if (leadData.lead_budget) updateData.lead_budget = leadData.lead_budget
                        if (leadData.lead_timeframe) updateData.lead_timeframe = leadData.lead_timeframe
                        if (leadData.is_partner) updateData.is_partner = leadData.is_partner


                        // Update
                        const { error } = await supabase
                            .from('leads')
                            .update(updateData)
                            .eq('id', existingLead.id)
                        if (error) console.error('[Chat] Lead update error:', error.message)
                        else console.log('[Chat] Lead updated:', existingLead.id)

                        // Check if phone was just added (existing lead had no phone before)
                        // OR if this is a re-engagement from a different session/visitor
                        const isPhoneNewlyAdded = leadData.phone && !existingLead.phone
                        const isReEngagement = leadData.phone && existingLead.phone && visitorId && existingLead.visitor_id !== visitorId
                        const shouldTriggerWhatsApp = isPhoneNewlyAdded || isReEngagement
                        console.log(`[Chat Debug] Lead Phone: ${leadData.phone}, Existing Phone: ${existingLead.phone}, isPhoneNewlyAdded: ${isPhoneNewlyAdded}, isReEngagement: ${isReEngagement}, shouldTriggerWhatsApp: ${shouldTriggerWhatsApp}`)

                        if (isPhoneNewlyAdded) {
                            console.log('[Chat] Phone newly added to existing lead — triggering WhatsApp flow')
                        }
                        if (isReEngagement) {
                            console.log('[Chat] Lead re-engaged from new session — triggering WhatsApp flow')
                            // Clean up duplicate lead created by visitor_id match
                            if (visitorId) {
                                const { data: duplicateLead } = await supabase
                                    .from('leads')
                                    .select('id')
                                    .eq('visitor_id', visitorId)
                                    .neq('id', existingLead.id)
                                    .maybeSingle()
                                if (duplicateLead) {
                                    await supabase.from('leads').delete().eq('id', duplicateLead.id)
                                    console.log('[Chat] Cleaned up duplicate visitor-based lead:', duplicateLead.id)
                                }
                            }
                            // Update visitor_id to current session
                            await supabase.from('leads').update({ visitor_id: visitorId }).eq('id', existingLead.id)
                        }

                        // WhatsApp Notifications: fire if phone was just added OR re-engagement from new session
                        if (shouldTriggerWhatsApp) {
                            console.log(`[Chat Debug] brokerPhone: ${brokerPhone}, brokerConnectyhubChatMessage: ${brokerConnectyhubChatMessage}`)
                            const urlContext = page_context?.url || 'Site / LP'
                            const fullHistory = [...safeHistory, { role: 'user', content: message }, { role: 'assistant', content: response }]
                            const conversationTranscript = fullHistory
                                .map((msg: any) => `${msg.role === 'user' ? '👤 Lead' : '🤖 Você (IA)'}:  ${msg.content}`)
                                .join('\n')

                            // CRITICAL: Use the stored name (already confirmed) over freshly extracted name (can hallucinate)
                            const confirmedName = existingLead.name || updateData.name || leadData.name || null

                            if (brokerPhone || brokerConnectyhubChatMessage) {
                                const leadNameSafe = confirmedName ? confirmedName.split(' ')[0] : ''
                                const defaultMsg = leadNameSafe
                                    ? 'Oi {{lead_name}}! Acabei de falar com você pelo site e quero continuar nosso papo por aqui, fica mais fácil pra gente 😊\n\nMe conta, como posso te ajudar?'
                                    : 'Oi! Acabei de falar com você pelo site e quero continuar nosso papo por aqui, fica mais fácil pra gente 😊\n\nMe conta, como posso te ajudar?'
                                const baseMsgTemplate = brokerConnectyhubChatMessage || defaultMsg
                                const leadMsg = baseMsgTemplate
                                    .replace(/\{\{lead_name\}\}/g, leadNameSafe)
                                    .replace(/\{\{broker_name\}\}/g, brokerName)
                                    .replace(/\{\{conversation_summary\}\}/g, leadData.ai_summary || '');

                                const tempEmoji = leadData.lead_classification === 'vip' ? '💎 VIP' : (leadData.lead_classification === 'hot' ? '🔥 QUENTE' : '❄️ FRIO')
                                const brokerMsg = `🚀 *Novo Lead [${tempEmoji}] Captado*\n\n` +
                                    `*Nome:* ${confirmedName || 'Não informado'}\n` +
                                    `*Telefone:* ${leadData.phone}\n` +
                                    `*Qualificação:* ${tempEmoji}\n` +
                                    `*Página:* ${urlContext}\n\n` +
                                    `🎯 *Detalhes:*\n` +
                                    `• Finalidade: ${leadData.metadata.interest || 'Não informada'}\n` +
                                    `• Investimento: ${leadData.metadata.budget || 'Não informado'}\n` +
                                    `• Prazo: ${leadData.metadata.timeframe || 'Não informado'}\n` +
                                    `${leadData.metadata.is_partner ? '🤝 *SOLICITAÇÃO DE PARCERIA*\n' : ''}\n` +
                                    `📋 *Resumo:*\n${leadData.ai_summary || 'Sem resumo'}\n\n` +
                                    `💬 *Conversa Completa:*\n${conversationTranscript}\n\n` +
                                    `⚡ _Uma mensagem já foi enviada do seu celular para o lead. Continue a conversa pelo WhatsApp!_`

                                console.log('[Chat Debug] Queuing chat/handover event to Inngest (existing lead)')
                                await inngest.send({
                                    name: 'chat/handover',
                                    data: {
                                        leadPhone: leadData.phone,
                                        leadName: confirmedName || 'Não informado',
                                        brokerPhone: brokerPhone,
                                        brokerName: brokerName,
                                        brokerMsg: brokerMsg,
                                        leadMsg: leadMsg,
                                        leadId: existingLead.id
                                    }
                                })
                            }

                            // 2. NEW: VIP Lead Alert
                            if (leadData.lead_classification === 'vip') {
                                console.log('[Chat Debug] Triggering VIP alert for existing lead update')
                                await inngest.send({
                                    name: 'lead/vip-detected',
                                    data: {
                                        name: leadData.name || 'Não informado',
                                        phone: leadData.phone,
                                        property_title: configMap['site_title'] || 'Pilger Luxury',
                                        ai_summary: leadData.ai_summary
                                    }
                                })
                            }
                        }
                    } else {
                        // Insert new lead - return it to get ID
                        const { data: newLead, error } = await supabase.from('leads').insert(leadData).select().single()
                        if (error) console.error('[Chat] Lead insert error:', error.message)
                        else {
                            console.log('[Chat] New lead saved!', newLead?.id)

                            // Log 'lead_captured' event to funnel if visitorId is present
                            if (visitorId) {
                                try {
                                    await supabase.from('funnel_events').insert({
                                        visitor_id: visitorId,
                                        landing_page_id: landing_page_id || null, // Might be null if not passed
                                        event_type: 'lead_captured',
                                        metadata: { lead_phone: leadData.phone }
                                    })
                                } catch (funnelError) {
                                    console.error('[Chat] Failed to log lead_captured event:', funnelError)
                                }
                            }

                            // WhatsApp Notifications Flow for NEW leads
                            if (leadData.phone) {
                                const urlContext = page_context?.url || 'Site / LP'

                                // Build conversation transcript for broker context
                                const fullHistory = [...safeHistory, { role: 'user', content: message }, { role: 'assistant', content: response }]
                                const conversationTranscript = fullHistory
                                    .map((msg: any) => `${msg.role === 'user' ? '👤 Lead' : '🤖 Você (IA)'
                                        }:  ${msg.content} `)
                                    .join('\n')

                                // 1. Notify Broker with FULL conversation summary (via system default instance)
                                // So the broker knows exactly what was discussed before continuing
                                // Fire Inngest Event instead of blocking the chat response
                                if (brokerPhone || brokerConnectyhubChatMessage) {
                                    const leadNameSafe = leadData.name ? leadData.name.split(' ')[0] : ''
                                    const defaultMsg = leadNameSafe
                                        ? 'Oi {{lead_name}}! Acabei de falar com você pelo site e quero continuar nosso papo por aqui, fica mais fácil pra gente 😊\n\nMe conta, como posso te ajudar?'
                                        : 'Oi! Acabei de falar com você pelo site e quero continuar nosso papo por aqui, fica mais fácil pra gente 😊\n\nMe conta, como posso te ajudar?'
                                    const baseMsgTemplate = brokerConnectyhubChatMessage || defaultMsg
                                    const leadMsg = baseMsgTemplate
                                        .replace(/\{\{lead_name\}\}/g, leadNameSafe)
                                        .replace(/\{\{broker_name\}\}/g, brokerName)
                                        .replace(/\{\{conversation_summary\}\}/g, leadData.ai_summary || '');

                                    const tempEmoji = leadData.lead_classification === 'vip' ? '💎 VIP' : (leadData.lead_classification === 'hot' ? '🔥 QUENTE' : '❄️ FRIO')
                                    const brokerMsg = `🚀 *Novo Lead [${tempEmoji}] Captado*\n\n` +
                                        `*Nome:* ${leadData.name || 'Não informado'}\n` +
                                        `*Telefone:* ${leadData.phone}\n` +
                                        `*Qualificação:* ${tempEmoji}\n` +
                                        `*Página:* ${urlContext}\n\n` +
                                        `🎯 *Detalhes:*\n` +
                                        `• Finalidade: ${leadData.metadata.interest || 'Não informada'}\n` +
                                        `• Investimento: ${leadData.metadata.budget || 'Não informado'}\n` +
                                        `• Prazo: ${leadData.metadata.timeframe || 'Não informado'}\n` +
                                        `${leadData.metadata.is_partner ? '🤝 *SOLICITAÇÃO DE PARCERIA*\n' : ''}\n` +
                                        `📋 *Resumo:*\n${leadData.ai_summary || 'Sem resumo'}\n\n` +
                                        `💬 *Conversa Completa:*\n${conversationTranscript}\n\n` +
                                        `⚡ _Uma mensagem já foi enviada do seu celular para o lead. Continue a conversa pelo WhatsApp!_`

                                    console.log('[Chat Debug] Queuing chat/handover event to Inngest (new lead)')
                                    await inngest.send({
                                        name: 'chat/handover',
                                        data: {
                                            leadPhone: leadData.phone,
                                            leadName: leadData.name || 'Não informado',
                                            leadId: newLead?.id,
                                            brokerPhone: brokerPhone,
                                            brokerName: brokerName,
                                            brokerMsg: brokerMsg,
                                            leadMsg: leadMsg
                                        }
                                    })
                                }

                                // 2. NEW: VIP Lead Alert
                                if (leadData.lead_classification === 'vip') {
                                    console.log('[Chat Debug] Triggering VIP alert for NEW lead')
                                    await inngest.send({
                                        name: 'lead/vip-detected',
                                        data: {
                                            name: leadData.name || 'Não informado',
                                            phone: leadData.phone,
                                            property_title: configMap['site_title'] || 'Pilger Luxury',
                                            ai_summary: leadData.ai_summary
                                        }
                                    })
                                }
                            }
                        }
                    }
                } else {
                    console.log('[Chat] No lead info found in conversation yet')
                }
            } catch (leadError: any) {
                console.error('[Chat] Lead extraction failed:', leadError.message)
            }
        })()

        // WAITING for lead extraction to ensure it runs before serverless function termination
        await leadExtraction
        // boost robustness
        // leadExtraction.catch(e => console.error('[Chat] Lead background error:', e))

        return NextResponse.json({ response, timing })

    } catch (error: any) {
        console.error('[Chat] API Error:', error.message || error)
        return NextResponse.json({
            response: 'Desculpe, estou com um probleminha técnico. Pode enviar novamente? 😊'
        })
    }
}
