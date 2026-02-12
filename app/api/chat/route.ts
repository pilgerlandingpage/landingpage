import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { chatWithGemini, extractLeadData, summarizeLead } from '@/lib/gemini'
import { inngest } from '@/lib/inngest/client'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { message, visitor_id, landing_page_id, history = [] } = body

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }

        // Get the landing page config
        let systemPrompt = 'Você é um corretor de imóveis de luxo. Seja cordial, sofisticado e ajude o cliente a encontrar o imóvel perfeito. Colete nome, telefone e email de forma natural na conversa.'
        let propertyContext = ''
        let greetingMessage = ''

        if (landing_page_id) {
            const { data: lp } = await supabase
                .from('landing_pages')
                .select('*, property:properties(*), agent:ai_agents(*)')
                .eq('id', landing_page_id)
                .single()

            if (lp?.agent) {
                systemPrompt = lp.agent.system_prompt
                greetingMessage = lp.agent.greeting_message || ''
            }

            if (lp?.property) {
                propertyContext = `\n\nContexto do Imóvel:\nTítulo: ${lp.property.title}\nDescrição: ${lp.property.description}\nCidade: ${lp.property.city}\nPreço: R$ ${lp.property.price?.toLocaleString('pt-BR')}\nTipo: ${lp.property.property_type}\nQuartos: ${lp.property.bedrooms}\nÁrea: ${lp.property.area_m2}m²\nAmenidades: ${lp.property.amenities?.join(', ')}`
            }
        }

        const fullPrompt = systemPrompt + propertyContext + `\n\nIMPORTANTE: Nunca peça todos os dados de uma vez. Colete um por vez de forma natural. Primeiro pergunte como pode ajudar, depois peça o nome, em seguida o telefone/whatsapp, e por último o email.`

        // Convert history to Gemini format
        const geminiHistory = history.map((msg: { role: string; content: string }) => ({
            role: msg.role === 'user' ? 'user' as const : 'model' as const,
            parts: [{ text: msg.content }],
        }))

        // Get AI response
        const aiResponse = await chatWithGemini({
            systemPrompt: fullPrompt,
            history: geminiHistory,
            userMessage: message,
        })

        // Save messages to chat_history
        await supabase.from('chat_history').insert([
            {
                visitor_id,
                landing_page_id,
                role: 'user',
                content: message,
            },
            {
                visitor_id,
                landing_page_id,
                role: 'assistant',
                content: aiResponse,
            },
        ])

        // Log funnel event for chat interaction
        if (history.length === 0) {
            await supabase.from('funnel_events').insert({
                visitor_id,
                landing_page_id,
                event_type: 'chat_opened',
            })
        } else {
            await supabase.from('funnel_events').insert({
                visitor_id,
                landing_page_id,
                event_type: 'message_sent',
                metadata: { message_count: history.length + 1 },
            })
        }

        // Every 3 messages, try to extract lead data
        if ((history.length + 1) % 2 === 0) {
            const fullConversation = [
                ...history.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`),
                `user: ${message}`,
                `assistant: ${aiResponse}`,
            ].join('\n')

            const extracted = await extractLeadData(fullConversation)

            if (extracted.name || extracted.phone || extracted.email) {
                // Check if lead already exists for this visitor
                const { data: existingLead } = await supabase
                    .from('leads')
                    .select('id, name, phone, email, funnel_stage, is_vip')
                    .eq('visitor_id', visitor_id)
                    .single()

                const leadData: Record<string, unknown> = {}
                if (extracted.name) leadData.name = extracted.name
                if (extracted.phone) leadData.phone = extracted.phone
                if (extracted.email) leadData.email = extracted.email
                if (extracted.is_vip !== undefined) leadData.is_vip = extracted.is_vip

                // Determine funnel stage
                if (extracted.phone || extracted.email) {
                    leadData.funnel_stage = 'lead'
                } else if (extracted.name) {
                    leadData.funnel_stage = 'engaged'
                }

                if (existingLead) {
                    // Update existing lead
                    await supabase
                        .from('leads')
                        .update({ ...leadData, updated_at: new Date().toISOString() })
                        .eq('id', existingLead.id)

                    // If phone was just captured and wasn't there before
                    if (extracted.phone && !existingLead.phone) {
                        // Get landing page for property info
                        const { data: lp } = await supabase
                            .from('landing_pages')
                            .select('title, property:properties(title)')
                            .eq('id', landing_page_id)
                            .single()

                        const propertyTitle = (lp?.property as { title?: string })?.title || lp?.title || ''

                        // Trigger welcome WhatsApp
                        await inngest.send({
                            name: 'lead/created',
                            data: {
                                lead_id: existingLead.id,
                                phone: extracted.phone,
                                name: extracted.name || existingLead.name,
                                property_title: propertyTitle,
                            },
                        })

                        // Log lead captured funnel event
                        await supabase.from('funnel_events').insert({
                            visitor_id,
                            lead_id: existingLead.id,
                            landing_page_id,
                            event_type: 'lead_captured',
                        })
                    }

                    // If VIP detected
                    if (extracted.is_vip && !existingLead.is_vip) {
                        const summary = await summarizeLead(fullConversation)
                        await supabase
                            .from('leads')
                            .update({ ai_summary: summary, is_vip: true })
                            .eq('id', existingLead.id)

                        await inngest.send({
                            name: 'lead/vip-detected',
                            data: {
                                name: extracted.name || existingLead.name,
                                phone: extracted.phone || existingLead.phone,
                                property_title: '',
                                ai_summary: summary,
                            },
                        })
                    }
                } else {
                    // Create new lead
                    const { data: newLead } = await supabase
                        .from('leads')
                        .insert({
                            visitor_id,
                            landing_page_id,
                            ...leadData,
                        })
                        .select('id')
                        .single()

                    if (newLead && extracted.phone) {
                        const { data: lp } = await supabase
                            .from('landing_pages')
                            .select('title, property:properties(title)')
                            .eq('id', landing_page_id)
                            .single()

                        const propertyTitle = (lp?.property as { title?: string })?.title || lp?.title || ''

                        await inngest.send({
                            name: 'lead/created',
                            data: {
                                lead_id: newLead.id,
                                phone: extracted.phone,
                                name: extracted.name || '',
                                property_title: propertyTitle,
                            },
                        })

                        await supabase.from('funnel_events').insert({
                            visitor_id,
                            lead_id: newLead.id,
                            landing_page_id,
                            event_type: 'lead_captured',
                        })
                    }
                }

                // Update visitor as converted
                if (extracted.phone || extracted.email) {
                    await supabase
                        .from('visitors')
                        .update({ converted: true })
                        .eq('id', visitor_id)
                }
            }
        }

        return NextResponse.json({ response: aiResponse })
    } catch (error) {
        console.error('Chat error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
