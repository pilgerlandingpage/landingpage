import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import {
    sendWhatsAppMessage,
    sendAudioMessage,
    sendMenuMessage,
    setPresenceTyping,
    setPresenceRecording,
    setPresenceAvailable,
    markAsRead
} from '../uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function loadAIConfigs(supabase: ReturnType<typeof getSupabase>) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
            'ai_provider', 'gemini_api_key', 'openai_api_key',
            'whatsapp_provider', 'gemini_whatsapp_model', 'openai_whatsapp_model',
            'whatsapp_audio_enabled', 'whatsapp_tts_provider', 'whatsapp_tts_voice',
            'elevenlabs_api_key'
        ])

    const map: Record<string, string> = {}
    data?.forEach((c: any) => { map[c.key] = c.value })
    return map
}

function extractOutboundMessageId(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null
    const candidates = [
        payload?.id, payload?.messageId, payload?.key?.id,
        payload?.data?.id, payload?.data?.messageId, payload?.data?.key?.id,
        payload?.response?.id, payload?.response?.messageId, payload?.response?.key?.id,
    ]
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return null
}

async function trackBotMessageId(
    supabase: ReturnType<typeof getSupabase>,
    conversationId: string,
    currentIds: string[],
    sendResult: any
): Promise<string[]> {
    const outboundId = extractOutboundMessageId(sendResult)
    if (!outboundId || currentIds.includes(outboundId)) return currentIds
    const nextIds = [...currentIds, outboundId].slice(-150)
    await supabase
        .from('whatsapp_ai_conversations')
        .update({ bot_message_ids: nextIds, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    return nextIds
}

function parseButtons(text: string): { cleanText: string; buttons?: { title: string; options: string[] } } {
    const match = text.match(/\[BOTOES:([^\]]+)\]/i)
    if (!match) return { cleanText: text }
    const parts = match[1].split('|').map(s => s.trim())
    const title = parts[0] || 'Escolha uma opção'
    const options = parts.slice(1)
    const cleanText = text.replace(match[0], '').trim()
    return { cleanText, buttons: { title, options } }
}

function responseRequiresText(text: string): boolean {
    return /https?:\/\//.test(text) || /\[BOTOES:/i.test(text) || /\[MENU:/i.test(text)
}

// ═══════════════════════════════════════════════════════════════
// AUDIO: STT
// ═══════════════════════════════════════════════════════════════

async function transcribeWithWhisper(audioUrl: string, apiKey: string): Promise<string> {
    const audioRes = await fetch(audioUrl)
    const audioBuffer = await audioRes.arrayBuffer()
    const blob = new Blob([audioBuffer], { type: 'audio/ogg' })
    const formData = new FormData()
    formData.append('file', blob, 'audio.ogg')
    formData.append('model', 'whisper-1')
    formData.append('language', 'pt')
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
    })
    const data = await res.json()
    return data.text || ''
}

async function transcribeWithGemini(audioUrl: string, apiKey: string, model: string): Promise<string> {
    const audioRes = await fetch(audioUrl)
    const audioBuffer = await audioRes.arrayBuffer()
    const base64Audio = Buffer.from(audioBuffer).toString('base64')
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'audio/ogg', data: base64Audio } },
                    { text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem explicações.' }
                ]
            }]
        })
    })
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ═══════════════════════════════════════════════════════════════
// AUDIO: TTS
// ═══════════════════════════════════════════════════════════════

async function ttsElevenLabs(text: string, apiKey: string, voiceId: string): Promise<Buffer | null> {
    try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
            body: JSON.stringify({
                text, model_id: 'eleven_multilingual_v2',
                voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true }
            })
        })
        if (!res.ok) { console.error('[ElevenLabs TTS] Error:', res.status); return null }
        return Buffer.from(await res.arrayBuffer())
    } catch (e) { console.error('[ElevenLabs TTS] Error:', e); return null }
}

async function ttsOpenAI(text: string, apiKey: string, voice: string): Promise<Buffer | null> {
    try {
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'tts-1', input: text, voice: voice || 'onyx', response_format: 'opus' })
        })
        if (!res.ok) return null
        return Buffer.from(await res.arrayBuffer())
    } catch (e) { console.error('[OpenAI TTS] Error:', e); return null }
}

async function uploadAudioToR2(audioBuffer: Buffer, supabase: ReturnType<typeof getSupabase>): Promise<string | null> {
    try {
        const { data: configs } = await supabase
            .from('app_config').select('key, value')
            .in('key', ['r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket_name', 'r2_public_url'])
        const cfg: Record<string, string> = {}
        configs?.forEach((c: any) => { cfg[c.key] = c.value })

        if (!cfg.r2_account_id || !cfg.r2_access_key_id) {
            const fileName = `whatsapp-tts/${Date.now()}.opus`
            const { error } = await supabase.storage.from('audio').upload(fileName, audioBuffer, { contentType: 'audio/opus', upsert: true })
            if (error) { console.error('[Audio Upload] Error:', error); return null }
            const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName)
            return urlData?.publicUrl || null
        }

        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
        const s3 = new S3Client({
            region: 'auto',
            endpoint: `https://${cfg.r2_account_id}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId: cfg.r2_access_key_id, secretAccessKey: cfg.r2_secret_access_key }
        })
        const key = `whatsapp-tts/${Date.now()}.opus`
        await s3.send(new PutObjectCommand({ Bucket: cfg.r2_bucket_name, Key: key, Body: audioBuffer, ContentType: 'audio/opus' }))
        return `${cfg.r2_public_url}/${key}`
    } catch (e) { console.error('[Audio Upload] Error:', e); return null }
}

// ═══════════════════════════════════════════════════════════════
// AI RESPONSE
// ═══════════════════════════════════════════════════════════════

async function generateAIResponse(
    configs: Record<string, string>,
    broker: any,
    messages: any[]
): Promise<{ text: string; shouldTransfer: boolean; extractedData?: any }> {
    const globalProvider = configs['ai_provider'] || 'gemini'
    const effectiveProvider = configs['whatsapp_provider'] || globalProvider
    const apiKey = effectiveProvider === 'openai' ? configs['openai_api_key'] : configs['gemini_api_key']

    if (!apiKey) {
        console.error('[AI Response] No API key for provider:', effectiveProvider)
        return { text: 'Desculpe, estou com um problema técnico. Por favor, tente novamente em breve.', shouldTransfer: false }
    }

    const systemPrompt = broker.system_prompt || `Você é ${broker.name}, corretor de imóveis de alto padrão. Atenda o lead com profissionalismo, colete informações e ajude a encontrar o imóvel ideal.

REGRAS:
- Responda de forma natural e humana, como um corretor real
- Colete: nome, telefone, tipo de imóvel, faixa de preço, região
- Quando tiver todos os dados, use [TRANSFERIR] para indicar transferência
- Pode usar [BOTOES:titulo|opção1|opção2|opção3] para oferecer opções interativas
- NUNCA revele que é uma IA`

    const chatMessages = messages.map((m: any) => ({ role: m.role, content: m.content }))

    try {
        let responseText = ''
        if (effectiveProvider === 'openai') {
            const model = configs['openai_whatsapp_model'] || 'gpt-4o-mini'
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, ...chatMessages], max_tokens: 500, temperature: 0.8 })
            })
            const data = await res.json()
            responseText = data.choices?.[0]?.message?.content || ''
        } else {
            const model = configs['gemini_whatsapp_model'] || 'gemini-2.0-flash'
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: chatMessages.map((m: any) => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    }))
                })
            })
            const data = await res.json()
            responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        }

        const shouldTransfer = /\[transferir\]/i.test(responseText) || /\[transfer\]/i.test(responseText)
        const cleanText = responseText.replace(/\[transferir\]/gi, '').replace(/\[transfer\]/gi, '').trim()
        return { text: cleanText || 'Desculpe, não entendi. Pode reformular?', shouldTransfer }
    } catch (error) {
        console.error('[AI Response Error]', error)
        return { text: 'Estou com um problema temporário. Tente novamente em instantes.', shouldTransfer: false }
    }
}

// ═══════════════════════════════════════════════════════════════
// INNGEST FUNCTION: Process WhatsApp Message
// ═══════════════════════════════════════════════════════════════

export const processWhatsAppMessage = inngest.createFunction(
    {
        id: 'whatsapp-agent-process-message',
        name: 'WhatsApp Agent — Process Incoming Message',
        retries: 1,
        concurrency: [{ limit: 5 }],  // Limit concurrent processing
    },
    { event: 'whatsapp/message-received' },
    async ({ event, step }) => {
        const {
            cleanPhone, messageText, isAudio, audioUrl,
            instanceId, instanceToken, instanceName, brokerId, senderName
        } = event.data

        const supabase = getSupabase()

        // ── Step 1: Load instance + broker ──
        const { instance, broker, configs } = await step.run('load-context', async () => {
            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('id', instanceId)
                .single()

            if (!inst) throw new Error(`Instance not found: ${instanceId}`)

            const effectiveBrokerId = brokerId || inst.broker_id
            let brokerData = null
            if (effectiveBrokerId) {
                const { data } = await supabase
                    .from('virtual_brokers')
                    .select('*')
                    .eq('id', effectiveBrokerId)
                    .single()
                brokerData = data
            }

            // If no broker found from instance, try any active broker
            if (!brokerData) {
                const { data } = await supabase
                    .from('virtual_brokers')
                    .select('*')
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle()
                brokerData = data
            }

            const cfgs = await loadAIConfigs(supabase)
            return { instance: inst, broker: brokerData, configs: cfgs }
        })

        if (!broker || !broker.is_active) {
            console.warn(`[WhatsApp Agent] No active broker found for instance ${instanceName}`)
            return { action: 'skipped', reason: 'no_active_broker' }
        }

        // ── Step 2: Find or create conversation ──
        const conversation = await step.run('find-or-create-conversation', async () => {
            const { data: existing } = await supabase
                .from('whatsapp_ai_conversations')
                .select('*')
                .eq('broker_id', broker.id)
                .eq('lead_phone', cleanPhone)
                .in('status', ['active', 'human_takeover'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (existing) return existing

            const { data: newConv } = await supabase
                .from('whatsapp_ai_conversations')
                .insert({
                    broker_id: broker.id,
                    instance_id: instanceId,
                    lead_phone: cleanPhone,
                    messages: [],
                    bot_message_ids: [],
                    status: 'active'
                })
                .select()
                .single()

            return newConv
        })

        if (!conversation) {
            return { action: 'error', reason: 'could_not_create_conversation' }
        }

        // Check human_takeover
        if (conversation.status === 'human_takeover') {
            console.log(`[WhatsApp Agent] Conversation in human_takeover, skipping`)
            return { action: 'skipped', reason: 'human_takeover' }
        }

        let botMessageIds: string[] = Array.isArray(conversation.bot_message_ids)
            ? conversation.bot_message_ids : []

        // ── Step 3: Transcribe audio if needed ──
        const inputText = await step.run('process-input', async () => {
            if (isAudio && audioUrl) {
                console.log(`[WhatsApp Agent] Transcribing audio from ${cleanPhone}...`)
                try {
                    const effectiveProvider = configs['whatsapp_provider'] || configs['ai_provider'] || 'gemini'
                    if (effectiveProvider === 'openai' && configs['openai_api_key']) {
                        return await transcribeWithWhisper(audioUrl, configs['openai_api_key'])
                    } else if (configs['gemini_api_key']) {
                        const model = configs['gemini_whatsapp_model'] || 'gemini-2.0-flash'
                        return await transcribeWithGemini(audioUrl, configs['gemini_api_key'], model)
                    } else if (configs['openai_api_key']) {
                        return await transcribeWithWhisper(audioUrl, configs['openai_api_key'])
                    }
                } catch (e) {
                    console.error('[WhatsApp Agent] Transcription error:', e)
                    return '[Áudio não transcrito]'
                }
            }
            return messageText
        })

        if (!inputText) {
            return { action: 'skipped', reason: 'empty_input' }
        }

        // ── Step 4: Generate AI response ──
        const aiResponse = await step.run('generate-ai-response', async () => {
            const updatedMessages = [...(conversation.messages || []), {
                role: 'user',
                content: inputText,
                type: isAudio ? 'audio' : 'text',
                timestamp: new Date().toISOString()
            }]

            const response = await generateAIResponse(configs, broker, updatedMessages)

            // Add assistant message to history
            updatedMessages.push({
                role: 'assistant',
                content: response.text,
                type: 'text',
                timestamp: new Date().toISOString()
            })

            // Save to DB
            const updateData: any = {
                messages: updatedMessages,
                updated_at: new Date().toISOString()
            }
            if (response.extractedData) {
                updateData.lead_data_extracted = response.extractedData
            }
            await supabase
                .from('whatsapp_ai_conversations')
                .update(updateData)
                .eq('id', conversation.id)

            return { ...response, updatedMessages }
        })

        // ── Step 5: Human-like behavior (sleep is native in Inngest!) ──
        await step.run('mark-as-read', async () => {
            await markAsRead(cleanPhone, instanceToken).catch(() => { })
        })

        // Reading delay (1-3s) — Inngest native sleep, no timeout risk!
        const readDelay = Math.floor(Math.random() * 2000) + 1000
        await step.sleep('reading-delay', `${readDelay}ms`)

        // Decide presence: "recording" if sending audio, "typing" otherwise
        const willSendAudio = isAudio && configs['whatsapp_audio_enabled'] === 'true'
            && !responseRequiresText(aiResponse.text) && !parseButtons(aiResponse.text).buttons

        await step.run('show-presence', async () => {
            if (willSendAudio) {
                await setPresenceRecording(cleanPhone, instanceToken).catch(() => { })
            } else {
                await setPresenceTyping(cleanPhone, instanceToken).catch(() => { })
            }
        })

        // Typing/recording delay proportional to response length
        const typingMs = Math.min(Math.max(aiResponse.text.length * 25, 1500), 8000)
        const actualTypingMs = Math.floor(typingMs * (0.7 + Math.random() * 0.6))
        await step.sleep('composing-delay', `${actualTypingMs}ms`)

        // ── Step 6: Send response (Função Espelho) ──
        await step.run('send-response', async () => {
            const { cleanText, buttons } = parseButtons(aiResponse.text)
            const needsTextFormat = responseRequiresText(aiResponse.text)
            const audioEnabled = configs['whatsapp_audio_enabled'] === 'true'
            const shouldSendAudio = isAudio && audioEnabled && !needsTextFormat && !buttons

            if (buttons && buttons.options.length > 0) {
                try {
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        title: buttons.title,
                        description: cleanText || buttons.title,
                        buttons: buttons.options.slice(0, 3).map((opt, i) => ({
                            id: `btn_${i}`,
                            title: opt.substring(0, 20)
                        })),
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[Buttons] Failed, falling back to text:', e)
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText || aiResponse.text, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (shouldSendAudio) {
                let audioBuffer: Buffer | null = null
                const rawVoiceId = (broker as any).voice_id || configs['whatsapp_tts_voice'] || ''
                const ttsProvider = configs['whatsapp_tts_provider'] || 'elevenlabs'

                // Support "openai:voice_name" format from the broker dropdown
                const isOpenAIVoice = rawVoiceId.startsWith('openai:')
                const voiceId = isOpenAIVoice ? rawVoiceId.replace('openai:', '') : rawVoiceId

                if (isOpenAIVoice && configs['openai_api_key']) {
                    // Broker explicitly chose an OpenAI TTS voice
                    audioBuffer = await ttsOpenAI(cleanText, configs['openai_api_key'], voiceId || 'onyx')
                } else if (ttsProvider === 'elevenlabs' && configs['elevenlabs_api_key'] && voiceId) {
                    audioBuffer = await ttsElevenLabs(cleanText, configs['elevenlabs_api_key'], voiceId)
                }
                if (!audioBuffer && configs['openai_api_key']) {
                    audioBuffer = await ttsOpenAI(cleanText, configs['openai_api_key'], configs['whatsapp_tts_voice'] || 'onyx')
                }

                if (audioBuffer) {
                    const audioPublicUrl = await uploadAudioToR2(audioBuffer, supabase)
                    if (audioPublicUrl) {
                        try {
                            const sendResult = await sendAudioMessage({ phone: cleanPhone, audioUrl: audioPublicUrl, ptt: true, instanceToken })
                            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                        } catch (e) {
                            console.warn('[Audio] Failed, text fallback:', e)
                            const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                        }
                    } else {
                        const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    }
                } else {
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else {
                const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText || aiResponse.text, instanceToken })
                botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
            }
        })

        // ── Step 7: Handle transfer if needed ──
        if (aiResponse.shouldTransfer) {
            await step.run('handle-transfer', async () => {
                const summary = aiResponse.updatedMessages
                    .map((m: any) => `${m.role === 'user' ? 'Lead' : 'Agente'}: ${m.content}`)
                    .join('\n')
                await supabase
                    .from('whatsapp_ai_conversations')
                    .update({
                        status: 'transferred',
                        summary,
                        transferred_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', conversation.id)
            })
        }

        return {
            action: 'processed',
            phone: cleanPhone,
            broker: broker.name,
            responseLength: aiResponse.text.length,
            wasAudio: isAudio,
            transferred: aiResponse.shouldTransfer
        }
    }
)

// ═══════════════════════════════════════════════════════════════
// INNGEST FUNCTION: Handle Human Takeover Detection
// ═══════════════════════════════════════════════════════════════

export const detectHumanTakeover = inngest.createFunction(
    {
        id: 'whatsapp-detect-human-takeover',
        name: 'WhatsApp — Detect Human Takeover',
        retries: 0,
    },
    { event: 'whatsapp/from-me-message' },
    async ({ event }) => {
        const { botMsgId, instanceId, recipientPhone } = event.data
        const supabase = getSupabase()

        // Check if this message was sent by the bot
        const { data: botMsg } = await supabase
            .from('whatsapp_ai_conversations')
            .select('id')
            .contains('bot_message_ids', [botMsgId])
            .limit(1)
            .maybeSingle()

        if (!botMsg && recipientPhone) {
            // This was a MANUAL message from the human operator
            console.log(`[Human Takeover] Detected on instance ${instanceId}`)
            await supabase
                .from('whatsapp_ai_conversations')
                .update({ status: 'human_takeover', updated_at: new Date().toISOString() })
                .eq('instance_id', instanceId)
                .eq('lead_phone', recipientPhone)
                .eq('status', 'active')

            return { action: 'takeover_activated', phone: recipientPhone }
        }

        return { action: 'bot_message_confirmed' }
    }
)

// ═══════════════════════════════════════════════════════════════
// INNGEST FUNCTION: Shadow Agent (for human brokers after hours)
// ═══════════════════════════════════════════════════════════════

export const shadowAgentResponse = inngest.createFunction(
    {
        id: 'whatsapp-shadow-agent',
        name: 'WhatsApp — Shadow Agent After Hours',
        retries: 1,
    },
    { event: 'whatsapp/shadow-agent' },
    async ({ event, step }) => {
        const { cleanPhone, messageText, instanceId, instanceToken, adminUserId } = event.data
        const supabase = getSupabase()

        const user = await step.run('load-user', async () => {
            const { data } = await supabase.from('admin_users').select('*').eq('id', adminUserId).single()
            return data
        })

        if (!user || !user.shadow_agent_enabled || !user.shadow_agent_prompt) {
            return { action: 'skipped', reason: 'shadow_agent_disabled' }
        }

        // Check availability
        const now = new Date()
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        const availableFrom = user.available_from || '08:00'
        const availableUntil = user.available_until || '20:00'

        if (currentTime >= availableFrom && currentTime <= availableUntil) {
            return { action: 'skipped', reason: 'user_available' }
        }

        // Find or create conversation
        const conversation = await step.run('find-or-create-shadow-conv', async () => {
            const { data: existing } = await supabase
                .from('whatsapp_broker_conversations')
                .select('*')
                .eq('broker_user_id', user.id)
                .eq('lead_phone', cleanPhone)
                .eq('is_shadow_agent', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (existing) return existing

            const { data: newConv } = await supabase
                .from('whatsapp_broker_conversations')
                .insert({ broker_user_id: user.id, lead_phone: cleanPhone, messages: [], is_shadow_agent: true })
                .select()
                .single()
            return newConv
        })

        if (!conversation) return { action: 'error', reason: 'could_not_create_conversation' }

        // Generate AI response
        const responseText = await step.run('generate-shadow-response', async () => {
            const updatedMessages = [...(conversation.messages || []), {
                role: 'user', content: messageText, timestamp: new Date().toISOString()
            }]

            const configs = await loadAIConfigs(supabase)
            const provider = configs['ai_provider'] || 'gemini'
            const apiKey = provider === 'openai' ? configs['openai_api_key'] : configs['gemini_api_key']

            if (!apiKey) return 'O corretor está indisponível no momento. Retornaremos em breve.'

            let text = ''
            try {
                if (provider === 'openai') {
                    const res = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'gpt-4o-mini',
                            messages: [{ role: 'system', content: user.shadow_agent_prompt }, ...updatedMessages.map((m: any) => ({ role: m.role, content: m.content }))],
                            max_tokens: 300, temperature: 0.7
                        })
                    })
                    const data = await res.json()
                    text = data.choices?.[0]?.message?.content || ''
                } else {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            systemInstruction: { parts: [{ text: user.shadow_agent_prompt }] },
                            contents: updatedMessages.map((m: any) => ({
                                role: m.role === 'assistant' ? 'model' : 'user',
                                parts: [{ text: m.content }]
                            }))
                        })
                    })
                    const data = await res.json()
                    text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
                }
            } catch {
                text = 'O corretor está indisponível no momento.'
            }

            const finalText = text || 'O corretor está indisponível. Retornaremos em breve.'
            updatedMessages.push({ role: 'assistant', content: finalText, timestamp: new Date().toISOString() })

            await supabase
                .from('whatsapp_broker_conversations')
                .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
                .eq('id', conversation.id)

            return finalText
        })

        // Human-like delays
        await step.sleep('shadow-read-delay', `${Math.floor(Math.random() * 2000) + 1000}ms`)

        await step.run('shadow-typing', async () => {
            await setPresenceTyping(cleanPhone, instanceToken).catch(() => { })
        })

        const typingMs = Math.min(Math.max(responseText.length * 25, 1500), 6000)
        await step.sleep('shadow-typing-delay', `${typingMs}ms`)

        await step.run('shadow-send', async () => {
            await sendWhatsAppMessage({ phone: cleanPhone, message: responseText, instanceToken })
        })

        return { action: 'shadow_responded', phone: cleanPhone }
    }
)

// ═══════════════════════════════════════════════════════════════
// INNGEST CRON: Keep WhatsApp Always Online
// ═══════════════════════════════════════════════════════════════

export const whatsappKeepOnline = inngest.createFunction(
    {
        id: 'whatsapp-keep-online',
        name: 'WhatsApp — Keep Instances Online',
        retries: 0,
    },
    { cron: '*/4 * * * *' },  // Every 4 minutes
    async () => {
        const supabase = getSupabase()

        // Get all connected instances
        const { data: instances } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, instance_token')
            .eq('status', 'connected')

        if (!instances || instances.length === 0) {
            return { action: 'no_connected_instances' }
        }

        const results: { instance: string; ok: boolean }[] = []
        for (const inst of instances) {
            try {
                await setPresenceAvailable(inst.instance_token)
                results.push({ instance: inst.instance_name, ok: true })
            } catch (e) {
                console.warn(`[KeepOnline] Failed for ${inst.instance_name}:`, e)
                results.push({ instance: inst.instance_name, ok: false })
            }
        }

        console.log(`[KeepOnline] Pinged ${results.length} instances:`, results)
        return { action: 'pinged', results }
    }
)
