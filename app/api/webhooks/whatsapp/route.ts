import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * Webhook para receber mensagens do WhatsApp (ConnectyHub / UAZAPI)
 * 
 * Fluxo:
 * 1. Identifica qual instância recebeu a mensagem
 * 2. Verifica se é de um Corretor IA ou Corretor Humano (Agente Sombra)
 * 3. Roteia para o agente correto
 * 4. Envia resposta via WhatsApp
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const supabase = getSupabase()

        // Extrair dados da mensagem (formato ConnectyHub/UAZAPI)
        const instanceName = body.instance || body.instanceName
        const messageData = body.data || body
        const remotePhone = messageData.from || messageData.remoteJid || messageData.phone
        const messageText = messageData.body || messageData.message?.conversation || messageData.text || ''
        const isFromMe = messageData.fromMe || false

        // Ignorar mensagens enviadas por nós mesmos e status updates
        if (isFromMe || !messageText || !remotePhone) {
            return NextResponse.json({ success: true, action: 'ignored' })
        }

        // Limpar número do telefone (remover @s.whatsapp.net etc.)
        const cleanPhone = remotePhone.replace(/@.+$/, '').replace(/\D/g, '')

        console.log(`[Webhook] Mensagem de ${cleanPhone} na instância ${instanceName}: "${messageText.substring(0, 50)}..."`)

        // 1. Buscar instância no banco
        const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('*, broker_id')
            .eq('instance_name', instanceName)
            .single()

        if (!instance) {
            console.warn(`[Webhook] Instância não encontrada: ${instanceName}`)
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        // 2. Determinar se é Corretor IA ou Corretor Humano (Agente Sombra)
        if (instance.broker_id) {
            // É uma instância de Corretor IA → rotear para agente IA
            await handleAIBrokerMessage(supabase, instance, cleanPhone, messageText)
        } else if (instance.admin_user_id) {
            // É uma instância de Corretor Humano → verificar se Agente Sombra deve responder
            await handleShadowAgentMessage(supabase, instance, cleanPhone, messageText)
        }

        return NextResponse.json({ success: true, action: 'processed' })
    } catch (error) {
        console.error('[Webhook Error]', error)
        return NextResponse.json({ success: false, message: 'Erro no webhook' }, { status: 500 })
    }
}

/**
 * Lida com mensagens recebidas no WhatsApp de um Corretor IA
 * O agente IA responde usando o prompt configurado
 */
async function handleAIBrokerMessage(
    supabase: ReturnType<typeof getSupabase>,
    instance: any,
    leadPhone: string,
    messageText: string
) {
    // Buscar corretor IA e seu prompt
    const { data: broker } = await supabase
        .from('virtual_brokers')
        .select('*')
        .eq('id', instance.broker_id)
        .single()

    if (!broker || !broker.is_active) {
        console.warn(`[AI Broker] Corretor IA inativo ou não encontrado: ${instance.broker_id}`)
        return
    }

    // Buscar ou criar conversa ativa
    let { data: conversation } = await supabase
        .from('whatsapp_ai_conversations')
        .select('*')
        .eq('broker_id', broker.id)
        .eq('lead_phone', leadPhone)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!conversation) {
        // Criar nova conversa
        const { data: newConv } = await supabase
            .from('whatsapp_ai_conversations')
            .insert({
                broker_id: broker.id,
                instance_id: instance.id,
                lead_phone: leadPhone,
                messages: [],
                status: 'active'
            })
            .select()
            .single()
        conversation = newConv
    }

    if (!conversation) return

    // Adicionar mensagem do lead
    const updatedMessages = [...(conversation.messages || []), {
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString()
    }]

    // Gerar resposta IA
    const aiResponse = await generateAIResponse(supabase, broker, updatedMessages)

    // Adicionar resposta do agente
    updatedMessages.push({
        role: 'assistant',
        content: aiResponse.text,
        timestamp: new Date().toISOString()
    })

    // Atualizar conversa no banco
    const updateData: any = {
        messages: updatedMessages,
        updated_at: new Date().toISOString()
    }
    if (aiResponse.extractedData) {
        updateData.lead_data_extracted = aiResponse.extractedData
    }

    await supabase
        .from('whatsapp_ai_conversations')
        .update(updateData)
        .eq('id', conversation.id)

    // Enviar resposta via WhatsApp
    await sendWhatsAppMessage(instance, leadPhone, aiResponse.text)

    // Verificar se deve transferir para corretor humano
    if (aiResponse.shouldTransfer) {
        await handleTransfer(supabase, conversation, broker, leadPhone, updatedMessages)
    }
}

/**
 * Lida com mensagens no WhatsApp de um Corretor Humano (Agente Sombra)
 * Só responde se o corretor está indisponível
 */
async function handleShadowAgentMessage(
    supabase: ReturnType<typeof getSupabase>,
    instance: any,
    leadPhone: string,
    messageText: string
) {
    // Buscar dados do usuário (corretor humano)
    const { data: user } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', instance.admin_user_id)
        .single()

    if (!user || !user.shadow_agent_enabled || !user.shadow_agent_prompt) {
        return // Agente Sombra desativado ou sem prompt
    }

    // Verificar se corretor está indisponível (fora do horário)
    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const availableFrom = user.available_from || '08:00'
    const availableUntil = user.available_until || '20:00'

    const isAvailable = currentTime >= availableFrom && currentTime <= availableUntil
    if (isAvailable) {
        return // Corretor está disponível, não interferir
    }

    console.log(`[Shadow Agent] Corretor ${user.name} indisponível (${currentTime}), agente sombra respondendo...`)

    // Buscar ou criar conversa do agente sombra
    let { data: conversation } = await supabase
        .from('whatsapp_broker_conversations')
        .select('*')
        .eq('broker_user_id', user.id)
        .eq('lead_phone', leadPhone)
        .eq('is_shadow_agent', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!conversation) {
        const { data: newConv } = await supabase
            .from('whatsapp_broker_conversations')
            .insert({
                broker_user_id: user.id,
                lead_phone: leadPhone,
                messages: [],
                is_shadow_agent: true
            })
            .select()
            .single()
        conversation = newConv
    }

    if (!conversation) return

    // Adicionar mensagem do lead
    const updatedMessages = [...(conversation.messages || []), {
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString()
    }]

    // Gerar resposta do Agente Sombra
    const response = await generateShadowResponse(supabase, user, updatedMessages)

    updatedMessages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
    })

    await supabase
        .from('whatsapp_broker_conversations')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('id', conversation.id)

    // Enviar resposta via WhatsApp
    await sendWhatsAppMessage(instance, leadPhone, response)
}

/**
 * Gera resposta IA usando o prompt do corretor IA
 */
async function generateAIResponse(
    supabase: ReturnType<typeof getSupabase>,
    broker: any,
    messages: any[]
): Promise<{ text: string; shouldTransfer: boolean; extractedData?: any }> {
    // Determinar provedor e modelo
    const provider = broker.ai_provider || 'gemini'
    const model = broker.ai_model || ''

    // Buscar API key da manutenção
    const { data: configs } = await supabase
        .from('admin_config')
        .select('key, value')
        .in('key', ['gemini_api_key', 'openai_api_key', 'ai_provider'])

    const configMap: Record<string, string> = {}
    configs?.forEach((c: any) => { configMap[c.key] = c.value })

    const effectiveProvider = provider || configMap['ai_provider'] || 'gemini'
    const apiKey = effectiveProvider === 'openai' ? configMap['openai_api_key'] : configMap['gemini_api_key']

    if (!apiKey) {
        return { text: 'Desculpe, estou com um problema técnico. Por favor, tente novamente em breve.', shouldTransfer: false }
    }

    const systemPrompt = broker.system_prompt || `Você é ${broker.name}, corretor de imóveis. Atenda o lead com profissionalismo, colete informações e ajude a encontrar o imóvel ideal.`

    // Preparar mensagens para a API
    const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content }))
    ]

    try {
        let responseText = ''

        if (effectiveProvider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model || 'gpt-4o-mini',
                    messages: chatMessages,
                    max_tokens: 500,
                    temperature: 0.7
                })
            })
            const data = await res.json()
            responseText = data.choices?.[0]?.message?.content || ''
        } else {
            // Gemini
            const geminiModel = model || 'gemini-2.0-flash'
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: messages.map((m: any) => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    }))
                })
            })
            const data = await res.json()
            responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        }

        // Detectar se deve transferir (buscar sinais no texto)
        const shouldTransfer = responseText.toLowerCase().includes('[transferir]') ||
            responseText.toLowerCase().includes('[transfer]')

        // Limpar marcadores do texto final
        const cleanText = responseText.replace(/\[transferir\]/gi, '').replace(/\[transfer\]/gi, '').trim()

        return { text: cleanText || 'Desculpe, não entendi. Pode reformular?', shouldTransfer }
    } catch (error) {
        console.error('[AI Response Error]', error)
        return { text: 'Estou com um problema temporário. Tente novamente em instantes.', shouldTransfer: false }
    }
}

/**
 * Gera resposta do Agente Sombra
 */
async function generateShadowResponse(
    supabase: ReturnType<typeof getSupabase>,
    user: any,
    messages: any[]
): Promise<string> {
    const { data: configs } = await supabase
        .from('admin_config')
        .select('key, value')
        .in('key', ['gemini_api_key', 'openai_api_key', 'ai_provider'])

    const configMap: Record<string, string> = {}
    configs?.forEach((c: any) => { configMap[c.key] = c.value })

    const provider = configMap['ai_provider'] || 'gemini'
    const apiKey = provider === 'openai' ? configMap['openai_api_key'] : configMap['gemini_api_key']

    if (!apiKey) return 'O corretor está indisponível no momento. Ele entrará em contato assim que possível.'

    const systemPrompt = user.shadow_agent_prompt || `Você é o assistente do corretor ${user.name}. Ele está indisponível no momento. Atenda com educação e informe que o corretor retornará em breve.`

    try {
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages.map((m: any) => ({ role: m.role, content: m.content }))
                    ],
                    max_tokens: 300,
                    temperature: 0.7
                })
            })
            const data = await res.json()
            return data.choices?.[0]?.message?.content || 'O corretor está indisponível. Retornaremos em breve.'
        } else {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: messages.map((m: any) => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    }))
                })
            })
            const data = await res.json()
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'O corretor está indisponível. Retornaremos em breve.'
        }
    } catch {
        return 'O corretor está indisponível no momento. Ele entrará em contato assim que possível.'
    }
}

/**
 * Transfere conversa IA para corretor humano
 */
async function handleTransfer(
    supabase: ReturnType<typeof getSupabase>,
    conversation: any,
    broker: any,
    leadPhone: string,
    messages: any[]
) {
    console.log(`[Transfer] Transferindo conversa ${conversation.id} do corretor IA ${broker.name}`)

    // Gerar resumo da conversa
    const summary = messages.map((m: any) => `${m.role === 'user' ? 'Lead' : 'Agente'}: ${m.content}`).join('\n')

    // Atualizar status da conversa
    await supabase
        .from('whatsapp_ai_conversations')
        .update({
            status: 'transferred',
            summary,
            transferred_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id)

    // TODO: Determinar qual corretor humano receberá (com base no rodízio)
    // TODO: Enviar mensagem de transferência do WhatsApp do corretor humano para o lead
    // TODO: Criar conversa em whatsapp_broker_conversations
}

/**
 * Envia mensagem via WhatsApp (ConnectyHub / UAZAPI)
 */
async function sendWhatsAppMessage(instance: any, phone: string, message: string) {
    const baseUrl = process.env.UAZAPI_BASE_URL || process.env.CONNECTYHUB_URL
    const token = instance.instance_token

    if (!baseUrl || !token) {
        console.warn('[WhatsApp Send] URL base ou token não configurados')
        return
    }

    try {
        await fetch(`${baseUrl}/instance/${instance.instance_name}/send-text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                phone: phone,
                message: message
            })
        })
    } catch (error) {
        console.error('[WhatsApp Send Error]', error)
    }
}
