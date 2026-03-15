import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    sendWhatsAppMessage,
    sendAudioMessage,
    sendMenuMessage,
    setPresenceTyping,
    markAsRead
} from '@/lib/uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Load all relevant AI configs from DB */
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

/** Best-effort extraction of outbound message id from provider response */
function extractOutboundMessageId(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null

    const candidates = [
        payload?.id,
        payload?.messageId,
        payload?.key?.id,
        payload?.data?.id,
        payload?.data?.messageId,
        payload?.data?.key?.id,
        payload?.response?.id,
        payload?.response?.messageId,
        payload?.response?.key?.id,
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

/** Random delay to simulate human behavior */
function humanDelay(minMs: number, maxMs: number): Promise<void> {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
    return new Promise(resolve => setTimeout(resolve, ms))
}

/** Simulate human-like behavior before responding */
async function simulateHumanBehavior(instanceToken: string, phone: string, responseLength: number) {
    try {
        // 1. Mark as read (✓✓ blue ticks)
        await markAsRead(phone, instanceToken).catch(() => { })

        // 2. Wait 1-3s (reading time)
        await humanDelay(1000, 3000)

        // 3. Show "typing..."
        await setPresenceTyping(phone, instanceToken).catch(() => { })

        // 4. Wait proportional to response length (simulate typing ~40 chars/sec)
        const typingMs = Math.min(Math.max(responseLength * 25, 1500), 8000)
        await humanDelay(typingMs * 0.7, typingMs * 1.3)
    } catch (e) {
        console.warn('[Human Behavior] Error (non-fatal):', e)
    }
}

/** Check if response contains links or structured content that requires text */
function responseRequiresText(text: string): boolean {
    return /https?:\/\//.test(text) ||
        /\[BOTOES:/i.test(text) ||
        /\[MENU:/i.test(text)
}

/** Parse button markup from AI response: [BOTOES:titulo|op1|op2|op3] */
function parseButtons(text: string): { cleanText: string; buttons?: { title: string; options: string[] } } {
    const match = text.match(/\[BOTOES:([^\]]+)\]/i)
    if (!match) return { cleanText: text }

    const parts = match[1].split('|').map(s => s.trim())
    const title = parts[0] || 'Escolha uma opção'
    const options = parts.slice(1)

    const cleanText = text.replace(match[0], '').trim()
    return { cleanText, buttons: { title, options } }
}

// ═══════════════════════════════════════════════════════════════
// AUDIO: STT (Speech-to-Text)
// ═══════════════════════════════════════════════════════════════

/** Transcribe audio using OpenAI Whisper */
async function transcribeWithWhisper(audioUrl: string, apiKey: string): Promise<string> {
    // Download audio
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

/** Transcribe audio using Gemini (multimodal) */
async function transcribeWithGemini(audioUrl: string, apiKey: string, model: string): Promise<string> {
    // Download audio and convert to base64
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
// AUDIO: TTS (Text-to-Speech)
// ═══════════════════════════════════════════════════════════════

/** Generate audio using ElevenLabs */
async function ttsElevenLabs(text: string, apiKey: string, voiceId: string): Promise<Buffer | null> {
    try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    style: 0.3,
                    use_speaker_boost: true
                }
            })
        })
        if (!res.ok) {
            console.error('[ElevenLabs TTS] Error:', res.status, await res.text())
            return null
        }
        const buffer = Buffer.from(await res.arrayBuffer())
        return buffer
    } catch (e) {
        console.error('[ElevenLabs TTS] Error:', e)
        return null
    }
}

/** Generate audio using OpenAI TTS */
async function ttsOpenAI(text: string, apiKey: string, voice: string): Promise<Buffer | null> {
    try {
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: text,
                voice: voice || 'onyx',
                response_format: 'opus'
            })
        })
        if (!res.ok) return null
        return Buffer.from(await res.arrayBuffer())
    } catch (e) {
        console.error('[OpenAI TTS] Error:', e)
        return null
    }
}

/** Upload audio buffer and get a public URL for sending */
async function uploadAudioToR2(audioBuffer: Buffer, supabase: ReturnType<typeof getSupabase>): Promise<string | null> {
    try {
        // Get R2 config
        const { data: configs } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', ['r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket_name', 'r2_public_url'])

        const cfg: Record<string, string> = {}
        configs?.forEach((c: any) => { cfg[c.key] = c.value })

        if (!cfg.r2_account_id || !cfg.r2_access_key_id) {
            // Fallback: use Supabase Storage
            const fileName = `whatsapp-tts/${Date.now()}.opus`
            const { error } = await supabase.storage
                .from('audio')
                .upload(fileName, audioBuffer, { contentType: 'audio/opus', upsert: true })

            if (error) {
                console.error('[Audio Upload] Supabase storage error:', error)
                return null
            }
            const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName)
            return urlData?.publicUrl || null
        }

        // Use R2 via S3 API
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
        const s3 = new S3Client({
            region: 'auto',
            endpoint: `https://${cfg.r2_account_id}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: cfg.r2_access_key_id,
                secretAccessKey: cfg.r2_secret_access_key,
            }
        })

        const key = `whatsapp-tts/${Date.now()}.opus`
        await s3.send(new PutObjectCommand({
            Bucket: cfg.r2_bucket_name,
            Key: key,
            Body: audioBuffer,
            ContentType: 'audio/opus',
        }))

        return `${cfg.r2_public_url}/${key}`
    } catch (e) {
        console.error('[Audio Upload] Error:', e)
        return null
    }
}

// ═══════════════════════════════════════════════════════════════
// MAIN WEBHOOK
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const supabase = getSupabase()

        // ── DEBUG: Log the full incoming payload ──
        console.log('[Webhook] 📩 Incoming payload:', JSON.stringify(body).substring(0, 500))

        // Extract message data (ConnectyHub/UAZAPI format)
        // ConnectyHub sends: { event, instance, data: { ... } }
        const event = body.event || body.action || ''
        const instanceName = body.instance || body.instanceName || body.server_url || ''
        const messageData = body.data || body.message || body

        // Skip non-message events (status, presence, etc.)
        if (event && !['messages.upsert', 'message', 'messages', 'chat', ''].includes(event)) {
            console.log(`[Webhook] ⏭️ Skipped event: ${event}`)
            return NextResponse.json({ success: true, action: 'ignored_event', event })
        }

        // Extract phone - try multiple paths
        const remotePhone = messageData.from
            || messageData.remoteJid
            || messageData.phone
            || messageData.key?.remoteJid
            || messageData.message?.key?.remoteJid
            || body.from
            || body.phone
            || ''

        // Extract message text - try multiple paths
        const messageText = messageData.body
            || messageData.message?.conversation
            || messageData.message?.extendedTextMessage?.text
            || messageData.text
            || messageData.caption
            || body.body
            || body.text
            || ''

        const isFromMe = messageData.fromMe ?? messageData.key?.fromMe ?? body.fromMe ?? false

        // Audio detection
        const audioUrl = messageData.audioUrl || messageData.media?.url || messageData.message?.audioMessage?.url || null
        const isAudio = !!(audioUrl || messageData.messageType === 'audioMessage' || messageData.message?.audioMessage || messageData.type === 'audio')

        // Clean phone number (remove @s.whatsapp.net, keep only digits)
        const cleanPhone = remotePhone?.toString().replace(/@.+$/, '').replace(/\D/g, '') || ''
        if (!cleanPhone) {
            console.log('[Webhook] ⚠️ No phone number found in payload. Keys:', Object.keys(messageData).join(', '))
            return NextResponse.json({ success: true, action: 'ignored_no_phone' })
        }

        console.log(`[Webhook] 📱 Phone: ${cleanPhone} | FromMe: ${isFromMe} | Audio: ${isAudio} | Instance: ${instanceName} | Text: "${(messageText || '[empty/audio]').substring(0, 80)}"`)

        // Find instance in database
        let instance: any = null

        // Try by instance_name first
        if (instanceName) {
            const { data } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('instance_name', instanceName)
                .maybeSingle()
            instance = data
        }

        // Fallback: find any connected instance
        if (!instance) {
            console.log(`[Webhook] ⚠️ Instance "${instanceName}" not found by name, trying fallback...`)
            const { data } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('status', 'connected')
                .limit(1)
                .maybeSingle()
            instance = data
        }

        if (!instance) {
            console.error(`[Webhook] ❌ No instance found at all. instanceName: ${instanceName}`)
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        console.log(`[Webhook] ✅ Instance found: ${instance.instance_name} (id: ${instance.id}, broker_id: ${instance.broker_id || 'none'})`)

        // ── HUMAN TAKEOVER DETECTION ──
        if (isFromMe) {
            console.log('[Webhook] 👤 Message is fromMe — checking human takeover...')
            try {
                const botMsgId = messageData.id?.id || messageData.key?.id
                if (botMsgId) {
                    const { data: botMsg } = await supabase
                        .from('whatsapp_ai_conversations')
                        .select('id')
                        .contains('bot_message_ids', [botMsgId])
                        .limit(1)
                        .maybeSingle()

                    if (!botMsg) {
                        console.log(`[Human Takeover] Detected manual message on instance ${instanceName}`)
                        const recipientPhone = messageData.to?.replace(/@.+$/, '').replace(/\D/g, '') || ''
                        if (recipientPhone) {
                            await supabase
                                .from('whatsapp_ai_conversations')
                                .update({ status: 'human_takeover', updated_at: new Date().toISOString() })
                                .eq('instance_id', instance.id)
                                .eq('lead_phone', recipientPhone)
                                .eq('status', 'active')
                        }
                    }
                }
            } catch (e) {
                console.warn('[Human Takeover] Error (non-fatal):', e)
            }
            return NextResponse.json({ success: true, action: 'from_me_processed' })
        }

        // Ignore empty messages (no text and no audio)
        if (!messageText && !isAudio) {
            console.log('[Webhook] ⏭️ Ignored empty message (no text, no audio)')
            return NextResponse.json({ success: true, action: 'ignored_empty' })
        }

        console.log(`[Webhook] 🤖 Processing ${isAudio ? '🎤 Audio' : '💬 Text'} from ${cleanPhone}: "${(messageText || '[audio]').substring(0, 80)}"`)

        // Route to AI Broker or Shadow Agent
        if (instance.broker_id) {
            await handleAIBrokerMessage(supabase, instance, cleanPhone, messageText, isAudio, audioUrl)
        } else if (instance.admin_user_id) {
            // Try to find a broker to use as the AI responder
            const { data: broker } = await supabase
                .from('virtual_brokers')
                .select('id')
                .eq('is_active', true)
                .limit(1)
                .maybeSingle()

            if (broker) {
                console.log(`[Webhook] 🔄 No broker_id on instance, using fallback broker: ${broker.id}`)
                instance.broker_id = broker.id
                await handleAIBrokerMessage(supabase, instance, cleanPhone, messageText, isAudio, audioUrl)
            } else {
                await handleShadowAgentMessage(supabase, instance, cleanPhone, messageText)
            }
        } else {
            console.warn('[Webhook] ⚠️ Instance has no broker_id and no admin_user_id — cannot route')
        }

        return NextResponse.json({ success: true, action: 'processed' })
    } catch (error) {
        console.error('[Webhook Error]', error)
        return NextResponse.json({ success: false, message: 'Erro no webhook' }, { status: 500 })
    }
}

// ═══════════════════════════════════════════════════════════════
// AI BROKER MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleAIBrokerMessage(
    supabase: ReturnType<typeof getSupabase>,
    instance: any,
    leadPhone: string,
    messageText: string,
    isAudio: boolean,
    audioUrl: string | null
) {
    // Load broker
    const { data: broker } = await supabase
        .from('virtual_brokers')
        .select('*')
        .eq('id', instance.broker_id)
        .single()

    if (!broker || !broker.is_active) {
        console.warn(`[AI Broker] Inactive or not found: ${instance.broker_id}`)
        return
    }

    // Load AI configs
    const configs = await loadAIConfigs(supabase)

    // Find or create active conversation
    let { data: conversation } = await supabase
        .from('whatsapp_ai_conversations')
        .select('*')
        .eq('broker_id', broker.id)
        .eq('lead_phone', leadPhone)
        .in('status', ['active', 'human_takeover'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!conversation) {
        const { data: newConv } = await supabase
            .from('whatsapp_ai_conversations')
            .insert({
                broker_id: broker.id,
                instance_id: instance.id,
                lead_phone: leadPhone,
                messages: [],
                bot_message_ids: [],
                status: 'active'
            })
            .select()
            .single()
        conversation = newConv
    }

    if (!conversation) return

    // Check for human_takeover — don't respond
    if (conversation.status === 'human_takeover') {
        console.log(`[AI Broker] Conversation in human_takeover mode, skipping`)
        return
    }

    let botMessageIds: string[] = Array.isArray(conversation.bot_message_ids)
        ? conversation.bot_message_ids
        : []

    // ── TRANSCRIBE AUDIO IF NEEDED ──
    let inputText = messageText
    if (isAudio && audioUrl) {
        console.log(`[AI Broker] Transcribing audio from ${leadPhone}...`)
        try {
            const effectiveProvider = configs['whatsapp_provider'] || configs['ai_provider'] || 'gemini'
            if (effectiveProvider === 'openai' && configs['openai_api_key']) {
                inputText = await transcribeWithWhisper(audioUrl, configs['openai_api_key'])
            } else if (configs['gemini_api_key']) {
                const model = configs['gemini_whatsapp_model'] || 'gemini-2.0-flash'
                inputText = await transcribeWithGemini(audioUrl, configs['gemini_api_key'], model)
            } else if (configs['openai_api_key']) {
                inputText = await transcribeWithWhisper(audioUrl, configs['openai_api_key'])
            }
            console.log(`[AI Broker] Transcription: "${inputText?.substring(0, 80)}..."`)
        } catch (e) {
            console.error('[AI Broker] Transcription error:', e)
            inputText = '[Áudio não transcrito]'
        }
    }

    if (!inputText) return

    // Add lead message to history
    const updatedMessages = [...(conversation.messages || []), {
        role: 'user',
        content: inputText,
        type: isAudio ? 'audio' : 'text',
        timestamp: new Date().toISOString()
    }]

    // ── GENERATE AI RESPONSE ──
    const aiResponse = await generateAIResponse(configs, broker, updatedMessages)

    // Add assistant message
    updatedMessages.push({
        role: 'assistant',
        content: aiResponse.text,
        type: 'text', // will be updated if sent as audio
        timestamp: new Date().toISOString()
    })

    // Update conversation in DB
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

    // ── SIMULATE HUMAN BEHAVIOR ──
    await simulateHumanBehavior(instance.instance_token, leadPhone, aiResponse.text.length)

    // ── SEND RESPONSE (FUNÇÃO ESPELHO) ──
    const { cleanText, buttons } = parseButtons(aiResponse.text)
    const needsTextFormat = responseRequiresText(aiResponse.text)
    const audioEnabled = configs['whatsapp_audio_enabled'] === 'true'
    const shouldSendAudio = isAudio && audioEnabled && !needsTextFormat && !buttons

    // Send buttons if detected
    if (buttons && buttons.options.length > 0) {
        try {
            const sendResult = await sendMenuMessage({
                phone: leadPhone,
                title: buttons.title,
                description: cleanText || buttons.title,
                buttons: buttons.options.slice(0, 3).map((opt, i) => ({
                    id: `btn_${i}`,
                    title: opt.substring(0, 20)
                })),
                instanceToken: instance.instance_token
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch (e) {
            console.warn('[Buttons] sendMenuMessage failed, falling back to text:', e)
            const sendResult = await sendWhatsAppMessage({
                phone: leadPhone,
                message: cleanText || aiResponse.text,
                instanceToken: instance.instance_token
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else if (shouldSendAudio) {
        // ── FUNÇÃO ESPELHO: Send as audio ──
        let audioBuffer: Buffer | null = null
        const voiceId = (broker as any).voice_id || configs['whatsapp_tts_voice'] || ''
        const ttsProvider = configs['whatsapp_tts_provider'] || 'elevenlabs'

        if (ttsProvider === 'elevenlabs' && configs['elevenlabs_api_key'] && voiceId) {
            audioBuffer = await ttsElevenLabs(cleanText, configs['elevenlabs_api_key'], voiceId)
        }

        // Fallback to OpenAI TTS
        if (!audioBuffer && configs['openai_api_key']) {
            audioBuffer = await ttsOpenAI(cleanText, configs['openai_api_key'], configs['whatsapp_tts_voice'] || 'onyx')
        }

        if (audioBuffer) {
            const audioPublicUrl = await uploadAudioToR2(audioBuffer, supabase)
            if (audioPublicUrl) {
                try {
                    const sendResult = await sendAudioMessage({
                        phone: leadPhone,
                        audioUrl: audioPublicUrl,
                        ptt: true,
                        instanceToken: instance.instance_token
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    // Update message type in DB
                    updatedMessages[updatedMessages.length - 1].type = 'audio'
                    await supabase
                        .from('whatsapp_ai_conversations')
                        .update({ messages: updatedMessages })
                        .eq('id', conversation.id)
                } catch (e) {
                    console.warn('[Audio Send] Failed, falling back to text:', e)
                    const sendResult = await sendWhatsAppMessage({
                        phone: leadPhone,
                        message: cleanText,
                        instanceToken: instance.instance_token
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else {
                // Upload failed, send as text
                const sendResult = await sendWhatsAppMessage({
                    phone: leadPhone,
                    message: cleanText,
                    instanceToken: instance.instance_token
                })
                botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
            }
        } else {
            // TTS failed, send as text
            const sendResult = await sendWhatsAppMessage({
                phone: leadPhone,
                message: cleanText,
                instanceToken: instance.instance_token
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else {
        // ── Send as text (default or mirror for text input) ──
        const sendResult = await sendWhatsAppMessage({
            phone: leadPhone,
            message: cleanText || aiResponse.text,
            instanceToken: instance.instance_token
        })
        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
    }

    // Handle transfer if needed
    if (aiResponse.shouldTransfer) {
        await handleTransfer(supabase, conversation, broker, leadPhone, updatedMessages)
    }
}

// ═══════════════════════════════════════════════════════════════
// AI RESPONSE GENERATION
// ═══════════════════════════════════════════════════════════════

async function generateAIResponse(
    configs: Record<string, string>,
    broker: any,
    messages: any[]
): Promise<{ text: string; shouldTransfer: boolean; extractedData?: any }> {
    // Determine provider and model from MAINTENANCE configs (not per-broker)
    const globalProvider = configs['ai_provider'] || 'gemini'
    const effectiveProvider = configs['whatsapp_provider'] || globalProvider
    const apiKey = effectiveProvider === 'openai' ? configs['openai_api_key'] : configs['gemini_api_key']

    if (!apiKey) {
        console.error('[AI Response] No API key found for provider:', effectiveProvider)
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
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'system', content: systemPrompt }, ...chatMessages],
                    max_tokens: 500,
                    temperature: 0.8
                })
            })
            const data = await res.json()
            responseText = data.choices?.[0]?.message?.content || ''
        } else {
            // Gemini
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

        // Detect transfer signal
        const shouldTransfer = /\[transferir\]/i.test(responseText) || /\[transfer\]/i.test(responseText)

        // Clean markers from final text
        const cleanText = responseText
            .replace(/\[transferir\]/gi, '')
            .replace(/\[transfer\]/gi, '')
            .trim()

        return { text: cleanText || 'Desculpe, não entendi. Pode reformular?', shouldTransfer }
    } catch (error) {
        console.error('[AI Response Error]', error)
        return { text: 'Estou com um problema temporário. Tente novamente em instantes.', shouldTransfer: false }
    }
}

// ═══════════════════════════════════════════════════════════════
// SHADOW AGENT (unchanged, just fixed table name)
// ═══════════════════════════════════════════════════════════════

async function handleShadowAgentMessage(
    supabase: ReturnType<typeof getSupabase>,
    instance: any,
    leadPhone: string,
    messageText: string
) {
    const { data: user } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', instance.admin_user_id)
        .single()

    if (!user || !user.shadow_agent_enabled || !user.shadow_agent_prompt) return

    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const availableFrom = user.available_from || '08:00'
    const availableUntil = user.available_until || '20:00'

    if (currentTime >= availableFrom && currentTime <= availableUntil) return

    console.log(`[Shadow Agent] ${user.name} unavailable (${currentTime}), responding...`)

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
            .insert({ broker_user_id: user.id, lead_phone: leadPhone, messages: [], is_shadow_agent: true })
            .select()
            .single()
        conversation = newConv
    }

    if (!conversation) return

    const updatedMessages = [...(conversation.messages || []), {
        role: 'user', content: messageText, timestamp: new Date().toISOString()
    }]

    const configs = await loadAIConfigs(supabase)
    const provider = configs['ai_provider'] || 'gemini'
    const apiKey = provider === 'openai' ? configs['openai_api_key'] : configs['gemini_api_key']

    if (!apiKey) {
        await sendWhatsAppMessage({
            phone: leadPhone,
            message: 'O corretor está indisponível no momento. Retornaremos em breve.',
            instanceToken: instance.instance_token
        })
        return
    }

    const systemPrompt = user.shadow_agent_prompt
    let responseText = ''

    try {
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'system', content: systemPrompt }, ...updatedMessages.map((m: any) => ({ role: m.role, content: m.content }))],
                    max_tokens: 300, temperature: 0.7
                })
            })
            const data = await res.json()
            responseText = data.choices?.[0]?.message?.content || 'O corretor está indisponível. Retornaremos em breve.'
        } else {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: updatedMessages.map((m: any) => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    }))
                })
            })
            const data = await res.json()
            responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'O corretor está indisponível. Retornaremos em breve.'
        }
    } catch {
        responseText = 'O corretor está indisponível no momento. Entrará em contato assim que possível.'
    }

    updatedMessages.push({ role: 'assistant', content: responseText, timestamp: new Date().toISOString() })

    await supabase
        .from('whatsapp_broker_conversations')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('id', conversation.id)

    await simulateHumanBehavior(instance.instance_token, leadPhone, responseText.length)

    await sendWhatsAppMessage({
        phone: leadPhone,
        message: responseText,
        instanceToken: instance.instance_token
    })
}

// ═══════════════════════════════════════════════════════════════
// TRANSFER
// ═══════════════════════════════════════════════════════════════

async function handleTransfer(
    supabase: ReturnType<typeof getSupabase>,
    conversation: any,
    broker: any,
    leadPhone: string,
    messages: any[]
) {
    console.log(`[Transfer] Transferring conversation ${conversation.id} from AI broker ${broker.name}`)

    const summary = messages.map((m: any) => `${m.role === 'user' ? 'Lead' : 'Agente'}: ${m.content}`).join('\n')

    await supabase
        .from('whatsapp_ai_conversations')
        .update({
            status: 'transferred',
            summary,
            transferred_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id)
}
