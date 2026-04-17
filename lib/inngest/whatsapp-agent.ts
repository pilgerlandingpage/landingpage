import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import {
    sendWhatsAppMessage,
    sendAudioMessage,
    sendMenuMessage,
    setPresenceTyping,
    setPresenceRecording,
    setPresenceAvailable,
    markAsRead,
    downloadMedia
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

async function loadAIConfigs(supabase: ReturnType<typeof getSupabase>, instanceId?: string) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
            'ai_provider', 'gemini_api_key', 'openai_api_key',
            'whatsapp_provider', 'gemini_whatsapp_model', 'openai_whatsapp_model',
            'whatsapp_audio_enabled', 'whatsapp_tts_provider', 'whatsapp_tts_voice',
            'elevenlabs_api_key',
            // Global fallback settings
            'whatsapp_always_online', 'whatsapp_mark_as_read',
            'whatsapp_transcription_enabled', 'whatsapp_human_intervention',
            'whatsapp_human_intervention_minutes', 'whatsapp_mirror_mode',
            'whatsapp_agent_enabled', 'whatsapp_split_messages',
            'whatsapp_debounce_seconds'
        ])

    const map: Record<string, string> = {}
    data?.forEach((c: any) => { map[c.key] = c.value })

    // Merge per-instance config (overrides global settings)
    if (instanceId) {
        try {
            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('config')
                .eq('id', instanceId)
                .single()

            if (inst?.config && typeof inst.config === 'object') {
                const cfg = inst.config as Record<string, any>
                // Map instance config keys to global config keys
                const keyMap: Record<string, string> = {
                    agent_enabled: 'whatsapp_agent_enabled',
                    always_online: 'whatsapp_always_online',
                    mark_as_read: 'whatsapp_mark_as_read',
                    split_messages: 'whatsapp_split_messages',
                    mirror_mode: 'whatsapp_mirror_mode',
                    audio_response: 'whatsapp_audio_enabled',
                    audio_transcription: 'whatsapp_transcription_enabled',
                    human_intervention: 'whatsapp_human_intervention',
                    debounce_seconds: 'whatsapp_debounce_seconds',
                    human_intervention_minutes: 'whatsapp_human_intervention_minutes',
                }
                for (const [instKey, globalKey] of Object.entries(keyMap)) {
                    if (cfg[instKey] !== undefined) {
                        map[globalKey] = String(cfg[instKey])
                    }
                }
                console.log(`[WhatsApp Agent] Loaded per-instance config for ${instanceId}`)
            }
        } catch { /* instance config not available, use global */ }
    }

    return map
}

// Split long text into human-like message chunks
function splitIntoHumanChunks(text: string): string[] {
    // Don't split short messages
    if (text.length <= 120) return [text]

    // Split on sentence boundaries: . ! ? followed by space or newline
    const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter(s => s.trim())
    if (sentences.length <= 1) return [text]

    // Group sentences into chunks of ~80-150 chars, max 4 chunks
    const chunks: string[] = []
    let current = ''

    for (const sentence of sentences) {
        if (current && (current.length + sentence.length + 1) > 150) {
            chunks.push(current.trim())
            current = sentence
        } else {
            current = current ? current + ' ' + sentence : sentence
        }
    }
    if (current.trim()) chunks.push(current.trim())

    // Limit to max 4 chunks to avoid spamming
    if (chunks.length > 4) {
        const merged: string[] = []
        const perGroup = Math.ceil(chunks.length / 4)
        for (let i = 0; i < chunks.length; i += perGroup) {
            merged.push(chunks.slice(i, i + perGroup).join(' '))
        }
        return merged
    }

    return chunks
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

interface InteractiveElements {
    cleanText: string
    buttons?: { title: string; options: string[] }
    list?: { buttonText: string; sections: { title: string; rows: { title: string; id: string; description?: string }[] }[] }
    poll?: { question: string; options: string[]; multiSelect?: boolean }
    locationRequest?: boolean
}

function parseInteractiveElements(text: string): InteractiveElements {
    let cleanText = text

    // ── Parse [BOTOES:titulo|op1|op2|op3] ──
    const btnMatch = cleanText.match(/\[BOTOES:([^\]]+)\]/i)
    let buttons: InteractiveElements['buttons'] | undefined
    if (btnMatch) {
        const parts = btnMatch[1].split('|').map(s => s.trim())
        const title = parts[0] || 'Escolha uma opção'
        const options = parts.slice(1).filter(Boolean)
        if (options.length > 0) {
            buttons = { title, options }
        }
        cleanText = cleanText.replace(btnMatch[0], '').trim()
    }

    // ── Parse [LISTA:botao|[Seção]|item1|desc1|item2|desc2] ──
    const listMatch = cleanText.match(/\[LISTA:([^\]]+)\]/i)
    let list: InteractiveElements['list'] | undefined
    if (listMatch) {
        const parts = listMatch[1].split('|').map(s => s.trim())
        const buttonText = parts[0] || 'Ver opções'
        const sections: { title: string; rows: { title: string; id: string; description?: string }[] }[] = []
        let currentSection: { title: string; rows: { title: string; id: string; description?: string }[] } = { title: 'Opções', rows: [] }

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i]
            if (part.startsWith('[') && part.endsWith(']')) {
                // New section header
                if (currentSection.rows.length > 0) sections.push(currentSection)
                currentSection = { title: part.slice(1, -1), rows: [] }
            } else {
                // Row — check if next part is description
                const nextPart = parts[i + 1]
                const isNextASection = nextPart?.startsWith('[')
                const isNextARow = nextPart && !isNextASection

                // If current item has a description following it (not a section header)
                if (isNextARow && !parts[i + 2]?.startsWith('[') && currentSection.rows.length < parts.length) {
                    currentSection.rows.push({
                        title: part.substring(0, 24),
                        id: `row_${currentSection.rows.length}`,
                        description: nextPart.substring(0, 72),
                    })
                    i++ // skip description
                } else {
                    currentSection.rows.push({
                        title: part.substring(0, 24),
                        id: `row_${currentSection.rows.length}`,
                    })
                }
            }
        }
        if (currentSection.rows.length > 0) sections.push(currentSection)
        if (sections.length > 0) {
            list = { buttonText, sections }
        }
        cleanText = cleanText.replace(listMatch[0], '').trim()
    }

    // ── Parse [ENQUETE:pergunta|op1|op2|op3] ──
    const pollMatch = cleanText.match(/\[ENQUETE:([^\]]+)\]/i)
    let poll: InteractiveElements['poll'] | undefined
    if (pollMatch) {
        const parts = pollMatch[1].split('|').map(s => s.trim())
        const question = parts[0] || 'O que você prefere?'
        const options = parts.slice(1).filter(Boolean)
        if (options.length >= 2) {
            poll = { question, options, multiSelect: false }
        }
        cleanText = cleanText.replace(pollMatch[0], '').trim()
    }

    // ── Parse [LOCALIZACAO] ──
    const locMatch = cleanText.match(/\[LOCALIZACAO\]/i)
    let locationRequest = false
    if (locMatch) {
        locationRequest = true
        cleanText = cleanText.replace(locMatch[0], '').trim()
    }

    return { cleanText, buttons, list, poll, locationRequest }
}

// Keep parseButtons as alias for backward compatibility
function parseButtons(text: string): { cleanText: string; buttons?: { title: string; options: string[] } } {
    const result = parseInteractiveElements(text)
    return { cleanText: result.cleanText, buttons: result.buttons }
}

function responseRequiresText(text: string): boolean {
    return /https?:\/\//.test(text) || /\[BOTOES:/i.test(text) || /\[LISTA:/i.test(text) || /\[ENQUETE:/i.test(text) || /\[LOCALIZACAO\]/i.test(text)
}

// ═══════════════════════════════════════════════════════════════
// WhatsApp Media Decryption (E2EE)
// WhatsApp encrypts all media with AES-256-CBC
// The mediaKey from payload is used to derive decryption keys via HKDF
// ═══════════════════════════════════════════════════════════════

async function decryptWhatsAppMedia(
    encryptedUrl: string,
    mediaKeyBase64: string,
    mediaType: 'audio' | 'image' | 'video' | 'document' = 'audio'
): Promise<Buffer | null> {
    try {
        console.log(`[WA Decrypt] Downloading encrypted media from: ${encryptedUrl.substring(0, 80)}...`)
        
        const response = await fetch(encryptedUrl)
        if (!response.ok) {
            console.error(`[WA Decrypt] Download failed (${response.status})`)
            return null
        }
        
        const encData = Buffer.from(await response.arrayBuffer())
        console.log(`[WA Decrypt] Downloaded ${encData.length} bytes encrypted`)
        
        if (encData.length < 10) {
            console.error(`[WA Decrypt] Encrypted data too small`)
            return null
        }
        
        // WhatsApp media type info strings for HKDF
        const mediaTypeInfo: Record<string, string> = {
            audio: 'WhatsApp Audio Keys',
            image: 'WhatsApp Image Keys',
            video: 'WhatsApp Video Keys',
            document: 'WhatsApp Document Keys',
        }
        
        const mediaKey = Buffer.from(mediaKeyBase64, 'base64')
        const info = mediaTypeInfo[mediaType] || 'WhatsApp Audio Keys'
        
        // HKDF expand: derive 112 bytes from mediaKey
        const hkdfKey = hkdfExpand(mediaKey, Buffer.from(info, 'utf8'), 112)
        
        const iv = hkdfKey.subarray(0, 16)
        const cipherKey = hkdfKey.subarray(16, 48)
        
        // Remove last 10 bytes (MAC) from encrypted data
        const encFile = encData.subarray(0, encData.length - 10)
        
        // Decrypt with AES-256-CBC
        const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv)
        const decrypted = Buffer.concat([decipher.update(encFile), decipher.final()])
        
        console.log(`[WA Decrypt] ✅ Decrypted successfully: ${decrypted.length} bytes`)
        return decrypted
    } catch (e) {
        console.error(`[WA Decrypt] Decryption error:`, e)
        return null
    }
}

/** HKDF-Expand (SHA-256) — derives key material from input key */
function hkdfExpand(key: Buffer, info: Buffer, length: number): Buffer {
    // HKDF-Extract
    const prk = crypto.createHmac('sha256', Buffer.alloc(32, 0)).update(key).digest()
    
    // HKDF-Expand
    let t = Buffer.alloc(0)
    let okm = Buffer.alloc(0)
    let counter = 1
    
    while (okm.length < length) {
        const hmac = crypto.createHmac('sha256', prk)
        hmac.update(Buffer.concat([t, info, Buffer.from([counter])]))
        t = hmac.digest()
        okm = Buffer.concat([okm, t])
        counter++
    }
    
    return okm.subarray(0, length)
}

// ═══════════════════════════════════════════════════════════════
// AUDIO: STT
// ═══════════════════════════════════════════════════════════════

async function transcribeWithWhisper(audioUrl: string, apiKey: string): Promise<string> {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
        console.error(`[Whisper STT] Failed to download audio (${audioRes.status}): ${audioUrl.substring(0, 100)}`)
        return ''
    }
    const audioBuffer = await audioRes.arrayBuffer()
    if (audioBuffer.byteLength < 100) {
        console.error(`[Whisper STT] Audio too small (${audioBuffer.byteLength} bytes), likely invalid`)
        return ''
    }
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
    if (!res.ok) {
        const errBody = await res.text()
        console.error(`[Whisper STT] API error (${res.status}):`, errBody.substring(0, 300))
        return ''
    }
    const data = await res.json()
    return data.text || ''
}

async function transcribeWithGemini(audioUrl: string, apiKey: string, model: string): Promise<string> {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
        console.error(`[Gemini STT] Failed to download audio (${audioRes.status}): ${audioUrl.substring(0, 100)}`)
        return ''
    }
    const audioBuffer = await audioRes.arrayBuffer()
    if (audioBuffer.byteLength < 100) {
        console.error(`[Gemini STT] Audio too small (${audioBuffer.byteLength} bytes), likely invalid`)
        return ''
    }
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
    if (!res.ok) {
        const errBody = await res.text()
        console.error(`[Gemini STT] API error (${res.status}):`, errBody.substring(0, 300))
        return ''
    }
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

    // Prompt único: broker.system_prompt com tags processadas, ou fallback natural
    const brokerName = broker.name || 'Corretor'
    const rawPrompt = broker.system_prompt || `Você é ${brokerName}, corretor de imóveis da Pilger Imóveis.
Converse naturalmente no WhatsApp, como uma pessoa real.
Seja simpático, use linguagem informal mas profissional.
Use frases curtas — é WhatsApp, não email.
NUNCA pareça robô ou siga roteiro engessado.

Colete naturalmente durante a conversa: nome, interesse (morar/investir), região, orçamento.
Quando o lead demonstrar interesse real e você tiver os dados, ofereça agendar uma visita com {agendamento}.
Quando tiver todas as informações, use {transferir} para passar ao corretor humano.
Sempre chame pelo nome quando souber: {nome_lead}.

NUNCA revele que é IA. Nunca invente dados de imóveis. Nunca fale preço exato.`

    // ═══ Carregar configs dinâmicas do admin ═══
    const agentConfigs: Record<string, string> = {}
    try {
        const supabase = getSupabase()
        const { data: cfgRows } = await supabase
            .from('app_config')
            .select('key, value')
            .like('key', 'agent_%')
        if (cfgRows) {
            for (const row of cfgRows) agentConfigs[row.key] = row.value
        }
    } catch (err) {
        console.error('[AI Agent] Erro ao carregar agent configs:', err)
    }

    // Parsear configs JSON com fallback
    let regionsForList = 'Balneário Camboriú|Itapema|Itajaí|Porto Belo'
    try {
        const parsed = JSON.parse(agentConfigs['agent_regions'] || '[]')
        if (parsed.length > 0) regionsForList = parsed.join('|')
    } catch {}

    let docsForButtons = 'RG e CPF|Comprovante de Renda|Todos os Documentos'
    try {
        const parsed = JSON.parse(agentConfigs['agent_required_documents'] || '[]')
        if (parsed.length > 0) docsForButtons = parsed.join('|')
    } catch {}

    let hoursText = 'segunda a sexta, das 9h às 18h, e sábados das 9h às 13h'
    try {
        const h = JSON.parse(agentConfigs['agent_working_hours'] || '{}')
        if (h.seg_sex_inicio) {
            hoursText = `segunda a sexta, das ${h.seg_sex_inicio} às ${h.seg_sex_fim}`
            if (h.sab_inicio && h.sab_fim) hoursText += `, sábados das ${h.sab_inicio} às ${h.sab_fim}`
            if (h.dom && h.dom !== 'Fechado') hoursText += `, domingos ${h.dom}`
            else hoursText += ', domingos fechado'
        }
    } catch {}

    const companyName = agentConfigs['agent_company_name'] || 'Pilger Imóveis'
    const companyDesc = agentConfigs['agent_company_description'] || 'referência em imóveis de alto padrão em Balneário Camboriú e região'
    const companyAddress = agentConfigs['agent_company_address'] || ''
    const companyMapsLink = agentConfigs['agent_company_maps_link'] || ''
    const locationInstruction = companyMapsLink
        ? `envie o link da localização: ${companyMapsLink} e mencione o endereço: ${companyAddress}`
        : companyAddress
        ? `informe o endereço: ${companyAddress} e peça a localização do cliente com [LOCALIZACAO]`
        : 'peça a localização com [LOCALIZACAO]'

    // Processar tags no prompt
    let systemPrompt = rawPrompt
        .replace(/\{nome_corretor\}/g, brokerName)
        .replace(/\{nome_lead\}/g, '(use o nome do cliente quando souber)')
        .replace(/\{agendamento\}/g, 'envie botões com [BOTOES:Agendar Visita|Manhã|Tarde|Noite] para o cliente escolher')
        .replace(/\{regioes\}/g, `envie uma lista com [LISTA:Ver Regiões|${regionsForList}]`)
        .replace(/\{transferir\}/g, 'use [TRANSFERIR] para encaminhar ao corretor humano')
        .replace(/\{localizacao\}/g, locationInstruction)
        .replace(/\{documentos\}/g, `envie botões com [BOTOES:Enviar Documentos|${docsForButtons}]`)
        .replace(/\{horario\}/g, `informe que o atendimento é de ${hoursText}`)
        .replace(/\{empresa\}/g, `mencione que a ${companyName} é ${companyDesc}`)
    + '\n\nIMPORTANTE: Nunca envie mais de 1 elemento interativo por mensagem. Use botões/listas SOMENTE quando fizer sentido na conversa — nunca como roteiro.'

    // ═══ CATÁLOGO DE IMÓVEIS — Injetar imóveis reais no contexto do agente ═══
    try {
        const supabase = getSupabase()
        const { data: properties } = await supabase
            .from('properties')
            .select('title, city, state, price, property_type, bedrooms, bathrooms, area_m2, amenities, description')
            .eq('status', 'active')
            .order('price', { ascending: false })
            .limit(30)

        if (properties && properties.length > 0) {
            const catalog = properties.map((p: any, i: number) => {
                const parts: string[] = []
                parts.push(`${i + 1}. ${p.title}`)
                if (p.city) parts.push(`📍 ${p.city}${p.state ? '/' + p.state : ''}`)
                if (p.price) parts.push(`💰 R$ ${Number(p.price).toLocaleString('pt-BR')}`)
                if (p.property_type) parts.push(`🏠 ${p.property_type}`)
                const specs: string[] = []
                if (p.bedrooms) specs.push(`${p.bedrooms}q`)
                if (p.bathrooms) specs.push(`${p.bathrooms}b`)
                if (p.area_m2) specs.push(`${p.area_m2}m²`)
                if (specs.length) parts.push(`📐 ${specs.join(' | ')}`)
                if (p.amenities?.length) parts.push(`✨ ${p.amenities.slice(0, 4).join(', ')}`)
                if (p.description) parts.push(`ℹ️ ${p.description.substring(0, 100)}${p.description.length > 100 ? '...' : ''}`)
                return parts.join(' | ')
            }).join('\n')

            systemPrompt += `\n\n═══ IMÓVEIS DISPONÍVEIS (use como referência para sugerir ao cliente) ═══\n${catalog}\n\nUSO DO CATÁLOGO:\n- Quando souber o que o cliente procura (região, orçamento, tipo), sugira imóveis que combinam\n- NÃO liste todos de uma vez — mencione 1 ou 2 que se encaixam e pergunte se quer ver mais\n- Diga "a partir de R$ X" em vez de valor exato\n- Se não tiver nada que combine, diga que tem opções sendo lançadas e pergunte se pode avisar quando sair\n- Se o cliente pedir detalhes de um imóvel específico, dê as informações que você tem`
        }
    } catch (err) {
        console.error('[AI Agent] Erro ao carregar catálogo de imóveis:', err)
    }

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
        concurrency: [
            { limit: 5 },
            { limit: 1, key: 'event.data.cleanPhone' },  // serialize per phone
        ],
    },
    { event: 'whatsapp/message-received' },
    async ({ event, step }) => {
        const {
            cleanPhone, messageText, isAudio, audioUrl, audioMediaKey, audioDirectPath, messageId,
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

            const cfgs = await loadAIConfigs(supabase, instanceId)
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

        // Check if agent is enabled
        if (configs['whatsapp_agent_enabled'] === 'false') {
            console.log(`[WhatsApp Agent] Agent disabled, skipping`)
            return { action: 'skipped', reason: 'agent_disabled' }
        }

        // Check human_takeover
        if (conversation.status === 'human_takeover') {
            // Check if auto-reactivation time has passed
            const interventionMinutes = parseInt(configs['whatsapp_human_intervention_minutes'] || '60')
            const takeoverAt = conversation.human_takeover_at
            if (takeoverAt && interventionMinutes > 0) {
                const elapsed = (Date.now() - new Date(takeoverAt).getTime()) / 60000
                if (elapsed >= interventionMinutes) {
                    console.log(`[WhatsApp Agent] Auto-reactivating after ${Math.floor(elapsed)}min`)
                    await supabase
                        .from('whatsapp_ai_conversations')
                        .update({ status: 'active', human_takeover_at: null, updated_at: new Date().toISOString() })
                        .eq('id', conversation.id)
                } else {
                    console.log(`[WhatsApp Agent] Conversation in human_takeover, skipping`)
                    return { action: 'skipped', reason: 'human_takeover' }
                }
            } else {
                console.log(`[WhatsApp Agent] Conversation in human_takeover, skipping`)
                return { action: 'skipped', reason: 'human_takeover' }
            }
        }

        // ── Manual Debounce: wait 15s to collect multiple messages ──
        // (Per-phone concurrency=1 ensures only one function runs at a time)

        // Quick check: if queue is already empty (processed by previous invocation), skip
        const hasWork = await step.run('check-queue', async () => {
            const { data } = await supabase
                .from('app_config')
                .select('key')
                .like('key', `_pmq_${cleanPhone}_%`)
                .limit(1)
            return (data && data.length > 0) || isAudio
        })

        if (!hasWork) {
            console.log(`[WhatsApp Agent] Queue empty for ${cleanPhone}, skipping (already processed)`)
            return { action: 'skipped', reason: 'already_processed' }
        }

        // Sleep 15s to allow more messages to accumulate
        if (!isAudio) {
            await step.sleep('debounce-collect', '15s')
        }

        // Read queued messages from debounce window (atomic INSERTs in app_config)
        const pendingMessages = await step.run('read-pending-messages', async () => {
            const { data: queuedMsgs } = await supabase
                .from('app_config')
                .select('key, value')
                .like('key', `_pmq_${cleanPhone}_%`)
                .order('updated_at', { ascending: true })

            if (!queuedMsgs || queuedMsgs.length === 0) return [] as string[]

            // Delete processed entries
            const keys = queuedMsgs.map(m => m.key)
            await supabase
                .from('app_config')
                .delete()
                .in('key', keys)

            console.log(`[WhatsApp Agent] 📨 Read ${queuedMsgs.length} queued messages: ${queuedMsgs.map(m => m.value).join(' | ')}`)
            return queuedMsgs.map(m => m.value) as string[]
        })

        // If queue was emptied by another function and not audio, skip
        if (pendingMessages.length === 0 && !isAudio) {
            console.log(`[WhatsApp Agent] No messages after debounce for ${cleanPhone}, skipping`)
            return { action: 'skipped', reason: 'already_processed_after_sleep' }
        }

        // Combine all queued messages into one input (they form a single thought)
        const allMessages = pendingMessages.length > 0
            ? pendingMessages.join(' ')
            : messageText

        let botMessageIds: string[] = Array.isArray(conversation.bot_message_ids)
            ? conversation.bot_message_ids : []

        // ── Step 3: Download audio to R2 if needed ──
        // This step runs in Inngest (no Vercel timeout!) so we can take the time to:
        // 1) Download audio from UAZAPI
        // 2) Upload to R2 (Cloudflare)
        // 3) Get a stable public URL for transcription
        const audioR2Url = isAudio ? await step.run('download-audio-to-r2', async () => {
            console.log(`[WhatsApp Agent] 🎤 Audio detected from ${cleanPhone}`)
            console.log(`[WhatsApp Agent] 🎤 audioUrl=${audioUrl ? audioUrl.substring(0, 100) + '...' : 'NULL'}, messageId=${messageId || 'NULL'}, mediaKey=${audioMediaKey ? 'available' : 'NULL'}`)

            let audioBuffer: Buffer | null = null

            // Strategy 1: UAZAPI /message/download (PREFERRED — decrypts and returns base64)
            if (!audioBuffer && messageId) {
                console.log(`[WhatsApp Agent] 🎤 Attempting UAZAPI /message/download with id=${messageId}...`)
                audioBuffer = await downloadMedia(messageId, instanceToken)
                if (audioBuffer) {
                    console.log(`[WhatsApp Agent] 🎤 UAZAPI download success! Size: ${audioBuffer.length} bytes`)
                } else {
                    console.warn(`[WhatsApp Agent] 🎤 UAZAPI download failed, trying E2EE decryption...`)
                }
            }

            // Strategy 2: E2EE decryption fallback (decrypt the encrypted WhatsApp CDN URL)
            if (!audioBuffer && audioUrl && audioMediaKey) {
                try {
                    console.log(`[WhatsApp Agent] 🎤 Attempting WhatsApp E2EE decryption with mediaKey...`)
                    audioBuffer = await decryptWhatsAppMedia(audioUrl, audioMediaKey, 'audio')
                    if (audioBuffer) {
                        console.log(`[WhatsApp Agent] 🎤 E2EE decryption success! Size: ${audioBuffer.length} bytes`)
                    } else {
                        console.error(`[WhatsApp Agent] 🎤 E2EE decryption also failed!`)
                    }
                } catch (e) {
                    console.error(`[WhatsApp Agent] 🎤 E2EE decryption error:`, e)
                }
            }

            if (!audioBuffer) {
                console.error(`[WhatsApp Agent] 🎤 Could not obtain audio buffer from any source`)
                return null
            }

            // Upload to R2 for a stable, public URL
            console.log(`[WhatsApp Agent] 🎤 Uploading ${audioBuffer.length} bytes to R2...`)
            const r2Url = await uploadAudioToR2(audioBuffer, supabase)
            if (r2Url) {
                console.log(`[WhatsApp Agent] 🎤 R2 upload success: ${r2Url.substring(0, 100)}`)
            } else {
                console.error(`[WhatsApp Agent] 🎤 R2 upload failed!`)
            }
            return r2Url
        }) : null

        // ── Step 4: Transcribe audio if we got a R2 URL ──
        const inputText = await step.run('process-input', async () => {
            console.log(`[WhatsApp Agent] process-input: isAudio=${isAudio}, audioR2Url=${audioR2Url ? 'available' : 'null'}, messageText="${messageText}"`)
            
            if (isAudio && audioR2Url) {
                console.log(`[WhatsApp Agent] Transcribing audio from R2 URL...`)
                
                // Helper: check if transcription result is actually valid
                const isValidTranscription = (text: string | undefined | null): boolean => {
                    if (!text) return false
                    const cleaned = text.replace(/[.\s…]+/g, '').trim()
                    return cleaned.length >= 2  // At least 2 real characters
                }
                
                const hasGemini = !!configs['gemini_api_key']
                const hasOpenAI = !!configs['openai_api_key']
                const geminiModel = configs['gemini_whatsapp_model'] || 'gemini-2.0-flash'
                
                // Respect the provider configured in the maintenance panel
                const globalProvider = configs['ai_provider'] || 'openai'
                const effectiveProvider = configs['whatsapp_provider'] || globalProvider
                const useWhisperFirst = effectiveProvider === 'openai'
                
                console.log(`[WhatsApp Agent] STT: provider=${effectiveProvider}, useWhisperFirst=${useWhisperFirst}, hasOpenAI=${hasOpenAI}, hasGemini=${hasGemini}`)
                
                let result: string | undefined
                
                if (useWhisperFirst) {
                    // ── OpenAI configured: Whisper first → Gemini fallback ──
                    if (hasOpenAI) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Whisper (OpenAI) transcription...`)
                            result = await transcribeWithWhisper(audioR2Url, configs['openai_api_key'])
                            console.log(`[WhatsApp Agent] Whisper result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                            console.log(`[WhatsApp Agent] Whisper returned invalid/empty result, trying Gemini fallback...`)
                        } catch (e) {
                            console.error('[WhatsApp Agent] Whisper transcription error:', e)
                        }
                    }
                    if (hasGemini) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Gemini transcription (fallback)...`)
                            result = await transcribeWithGemini(audioR2Url, configs['gemini_api_key'], geminiModel)
                            console.log(`[WhatsApp Agent] Gemini result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                        } catch (e) {
                            console.error('[WhatsApp Agent] Gemini transcription error:', e)
                        }
                    }
                } else {
                    // ── Gemini configured: Gemini first → Whisper fallback ──
                    if (hasGemini) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Gemini transcription...`)
                            result = await transcribeWithGemini(audioR2Url, configs['gemini_api_key'], geminiModel)
                            console.log(`[WhatsApp Agent] Gemini result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                            console.log(`[WhatsApp Agent] Gemini returned invalid/empty result, trying Whisper fallback...`)
                        } catch (e) {
                            console.error('[WhatsApp Agent] Gemini transcription error:', e)
                        }
                    }
                    if (hasOpenAI) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Whisper transcription (fallback)...`)
                            result = await transcribeWithWhisper(audioR2Url, configs['openai_api_key'])
                            console.log(`[WhatsApp Agent] Whisper result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                        } catch (e) {
                            console.error('[WhatsApp Agent] Whisper transcription error:', e)
                        }
                    }
                }
                
                // All transcription attempts failed
                console.error('[WhatsApp Agent] All transcription attempts failed or returned empty')
                return '[O usuário enviou uma mensagem de áudio que não pôde ser transcrita. Responda pedindo que repita ou envie por texto.]'
            }
            
            // Audio detected but we couldn't get the buffer at all
            if (isAudio && !audioR2Url) {
                console.error('[WhatsApp Agent] Audio detected but no R2 URL available (download failed)')
                return '[O usuário enviou uma mensagem de áudio que não pôde ser processada. Responda pedindo que repita ou envie por texto.]'
            }
            
            return allMessages
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
        await step.run('ensure-online', async () => {
            await setPresenceAvailable(instanceToken).catch(() => { })
        })

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

        // ── Step 6: Send response (Função Espelho + Interactive Messages) ──
        await step.run('send-response', async () => {
            const interactive = parseInteractiveElements(aiResponse.text)
            const { cleanText, buttons, list, poll, locationRequest } = interactive
            const needsTextFormat = responseRequiresText(aiResponse.text)
            const hasInteractive = !!(buttons || list || poll || locationRequest)
            const audioEnabled = configs['whatsapp_audio_enabled'] === 'true'
            const shouldSendAudio = isAudio && audioEnabled && !needsTextFormat && !hasInteractive

            console.log(`[WhatsApp Agent] 📤 Send decision: isAudio=${isAudio}, audioEnabled=${audioEnabled}, needsTextFormat=${needsTextFormat}, buttons=${!!buttons}, list=${!!list}, poll=${!!poll}, location=${locationRequest}, shouldSendAudio=${shouldSendAudio}`)

            if (buttons && buttons.options.length > 0) {
                try {
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: cleanText || buttons.title,
                        type: 'button',
                        choices: buttons.options.slice(0, 3).map(opt => opt.substring(0, 20)),
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[Buttons] Failed, falling back to text:', e)
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText || aiResponse.text, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (list && list.sections.length > 0) {
                // Send as UAZAPI list with choices format
                try {
                    const choices: string[] = []
                    for (const section of list.sections) {
                        choices.push(`[${section.title}]`)
                        for (const row of section.rows) {
                            if (row.description) {
                                choices.push(`${row.title}|${row.id}|${row.description}`)
                            } else {
                                choices.push(row.title)
                            }
                        }
                    }
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: cleanText || 'Escolha uma opção:',
                        type: 'list',
                        choices,
                        listButton: list.buttonText,
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[List] Failed, falling back to text:', e)
                    // Fallback: send as numbered text
                    const fallbackText = list.sections.map(s =>
                        `*${s.title}*\n${s.rows.map((r, i) => `${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ''}`).join('\n')}`
                    ).join('\n\n')
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: `${cleanText}\n\n${fallbackText}`, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (poll && poll.options.length >= 2) {
                // Send as UAZAPI poll
                try {
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: poll.question,
                        type: 'poll',
                        choices: poll.options,
                        selectableCount: poll.multiSelect ? poll.options.length : 1,
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    // Also send the text before the poll if any
                    if (cleanText) {
                        await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    }
                } catch (e) {
                    console.warn('[Poll] Failed, falling back to text:', e)
                    const fallbackText = `${poll.question}\n\n${poll.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: `${cleanText ? cleanText + '\n\n' : ''}${fallbackText}`, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (locationRequest) {
                // Send text first, then location request button
                try {
                    if (cleanText) {
                        await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    }
                    const { sendLocationRequest } = await import('../uazapi')
                    const sendResult = await sendLocationRequest(
                        cleanPhone,
                        cleanText || 'Pode compartilhar sua localização? Isso nos ajuda a encontrar os melhores imóveis perto de você! 📍',
                        instanceToken
                    )
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[Location] Failed, sending text only:', e)
                    if (!cleanText) {
                        const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: 'Pode nos informar em qual região você está buscando?', instanceToken })
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    }
                }
            } else if (shouldSendAudio) {
                let audioBuffer: Buffer | null = null
                const rawVoiceId = (broker as any).voice_id || configs['whatsapp_tts_voice'] || ''
                const ttsProvider = configs['whatsapp_tts_provider'] || 'elevenlabs'

                // Support "openai:voice_name" format from the broker dropdown
                const isOpenAIVoice = rawVoiceId.startsWith('openai:')
                const voiceId = isOpenAIVoice ? rawVoiceId.replace('openai:', '') : rawVoiceId

                const debugSteps: string[] = []
                debugSteps.push(`provider=${ttsProvider}, voiceId=${voiceId}, isOpenAI=${isOpenAIVoice}, textLen=${cleanText.length}`)

                if (isOpenAIVoice && configs['openai_api_key']) {
                    audioBuffer = await ttsOpenAI(cleanText, configs['openai_api_key'], voiceId || 'onyx')
                    debugSteps.push(`openai_tts: ${audioBuffer ? audioBuffer.length + 'b' : 'NULL'}`)
                } else if (ttsProvider === 'elevenlabs' && configs['elevenlabs_api_key'] && voiceId) {
                    audioBuffer = await ttsElevenLabs(cleanText, configs['elevenlabs_api_key'], voiceId)
                    debugSteps.push(`elevenlabs_tts: ${audioBuffer ? audioBuffer.length + 'b' : 'NULL'}`)
                } else {
                    debugSteps.push(`no_tts_match: provider=${ttsProvider}, hasELKey=${!!configs['elevenlabs_api_key']}, hasOAIKey=${!!configs['openai_api_key']}, voiceId=${voiceId}`)
                }
                if (!audioBuffer && configs['openai_api_key']) {
                    audioBuffer = await ttsOpenAI(cleanText, configs['openai_api_key'], configs['whatsapp_tts_voice'] || 'onyx')
                    debugSteps.push(`openai_fallback: ${audioBuffer ? audioBuffer.length + 'b' : 'NULL'}`)
                }

                if (audioBuffer) {
                    debugSteps.push(`uploading_to_r2: ${audioBuffer.length}b`)
                    const audioPublicUrl = await uploadAudioToR2(audioBuffer, supabase)
                    debugSteps.push(`r2_url: ${audioPublicUrl || 'NULL'}`)
                    if (audioPublicUrl) {
                        try {
                            const sendResult = await sendAudioMessage({ phone: cleanPhone, audioUrl: audioPublicUrl, ptt: true, instanceToken })
                            debugSteps.push(`send_audio: OK, result=${JSON.stringify(sendResult).substring(0, 200)}`)
                            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                        } catch (e: any) {
                            debugSteps.push(`send_audio: FAIL, error=${e?.message || String(e)}`)
                            const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                        }
                    } else {
                        debugSteps.push('r2_upload_failed, sending text')
                        const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    }
                } else {
                    debugSteps.push('all_tts_failed, sending text')
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }

                // Save debug to DB (fire-and-forget)
                try {
                    await supabase.from('app_config').upsert({
                        key: '_debug_tts_pipeline',
                        value: JSON.stringify({ timestamp: new Date().toISOString(), steps: debugSteps }),
                        updated_at: new Date().toISOString()
                    })
                } catch (_) { /* ignore */ }
            } else {
                // Split messages into human-like chunks if enabled
                const splitEnabled = configs['whatsapp_split_messages'] !== 'false'
                const textToSend = cleanText || aiResponse.text

                if (splitEnabled && textToSend.length > 120) {
                    const chunks = splitIntoHumanChunks(textToSend)
                    for (let i = 0; i < chunks.length; i++) {
                        if (i > 0) {
                            // Show typing between chunks + delay
                            await setPresenceTyping(cleanPhone, instanceToken).catch(() => {})
                            const chunkDelay = Math.floor(Math.random() * 2000) + 1000 + (chunks[i].length * 20)
                            await new Promise(r => setTimeout(r, Math.min(chunkDelay, 4000)))
                        }
                        const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: chunks[i], instanceToken })
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    }
                } else {
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: textToSend, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            }
        })

        // ── Step 7: Handle transfer if needed ──
        if (aiResponse.shouldTransfer) {
            await step.run('handle-transfer', async () => {
                const summary = aiResponse.updatedMessages
                    .map((m: any) => `${m.role === 'user' ? 'Lead' : 'Agente'}: ${m.content}`)
                    .join('\n')

                // Mark conversation as transferred
                await supabase
                    .from('whatsapp_ai_conversations')
                    .update({
                        status: 'transferred',
                        summary,
                        transferred_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', conversation.id)

                // ═══ NOTIFICAR CORRETOR HUMANO ═══
                try {
                    // Load transfer configs
                    const { data: transferConfigs } = await supabase
                        .from('app_config')
                        .select('key, value')
                        .in('key', ['agent_transfer_message_broker', 'agent_transfer_message_lead'])

                    const tCfg: Record<string, string> = {}
                    for (const r of (transferConfigs || [])) tCfg[r.key] = r.value

                    // Find broker's transfer-to phone (from broker config or instance admin)
                    const transferToPhone = broker.transfer_to_phone
                        || broker.phone
                        || ''

                    if (transferToPhone) {
                        // Extract lead data from conversation context
                        const leadName = senderName || 'Não informado'
                        const lastMessages = aiResponse.updatedMessages.slice(-6)
                            .map((m: any) => `${m.role === 'user' ? '👤' : '🤖'} ${m.content}`)
                            .join('\n')

                        // Build broker notification
                        let brokerMsg = tCfg['agent_transfer_message_broker']
                            || '🔔 *Lead qualificado transferido!*\n\n👤 Nome: {nome_lead}\n📱 Telefone: {telefone}\n\n⚡ Entre em contato agora!'

                        brokerMsg = brokerMsg
                            .replace(/\{nome_lead\}/g, leadName)
                            .replace(/\{telefone\}/g, cleanPhone)
                            .replace(/\{interesse\}/g, aiResponse.extractedData?.interest || 'Não identificado')
                            .replace(/\{orcamento\}/g, aiResponse.extractedData?.budget || 'Não informado')
                            .replace(/\{regiao\}/g, aiResponse.extractedData?.region || 'Não informada')

                        brokerMsg += `\n\n📝 *Últimas mensagens:*\n${lastMessages}`

                        // Send to human broker
                        const { sendWhatsAppMessage } = await import('../uazapi')
                        await sendWhatsAppMessage({
                            phone: transferToPhone,
                            message: brokerMsg,
                            instanceToken
                        })
                        console.log(`[Transfer] 📲 Notificação enviada para corretor: ${transferToPhone}`)
                    } else {
                        console.warn('[Transfer] ⚠️ Nenhum telefone de transferência configurado para o broker')
                    }
                } catch (transferErr) {
                    console.error('[Transfer] Erro ao notificar corretor:', transferErr)
                }
            })
        }

        // ── Step 8: Sync CRM (fire-and-forget) ──
        await step.run('sync-crm', async () => {
            try {
                const { updateLead } = await import('../uazapi')
                const leadData: Record<string, unknown> = {
                    id: cleanPhone,
                    lead_field12: new Date().toISOString(),  // Último contato
                    lead_field05: broker.name || 'AI Agent',  // Agente
                }

                // Sync sender name if available
                if (senderName) {
                    leadData.lead_name = senderName
                }

                // Extract data from conversation if AI extracted it
                if (aiResponse.extractedData) {
                    const d = aiResponse.extractedData
                    if (d.name) leadData.lead_fullName = d.name
                    if (d.phone) leadData.lead_field01 = d.phone  // may duplicate but useful
                    if (d.budget) leadData.lead_field02 = d.budget
                    if (d.interest) leadData.lead_field01 = d.interest  // Tipo de imóvel
                    if (d.timeframe) leadData.lead_field04 = d.timeframe
                    if (d.email) leadData.lead_email = d.email
                    if (d.classification) {
                        leadData.lead_status = d.classification
                        // Auto-tag
                        const tags: string[] = []
                        if (d.classification === 'vip') tags.push('VIP')
                        if (d.classification === 'hot') tags.push('Qualificado')
                        if (d.is_partner) tags.push('Parceiro')
                        if (tags.length > 0) leadData.lead_tags = tags
                    }
                    if (d.summary) leadData.lead_field20 = d.summary  // Notas AI
                }

                await updateLead(leadData as any, instanceToken)
                console.log(`[WhatsApp Agent] 📋 CRM sync completed for ${cleanPhone}`)
            } catch (e) {
                console.warn('[WhatsApp Agent] CRM sync failed (non-fatal):', e)
            }
        })

        // ── Step 9: Sync lead_collected_data (CRM interno) ──
        await step.run('sync-lead-collected-data', async () => {
            try {
                const d = aiResponse.extractedData || {}
                const leadUpdate: Record<string, unknown> = {
                    lead_phone: cleanPhone,
                    updated_at: new Date().toISOString(),
                }

                if (senderName || d.name) leadUpdate.lead_name = d.name || senderName
                if (d.interest) leadUpdate.interest = d.interest
                if (d.region) leadUpdate.region = d.region
                if (d.budget) {
                    // Try to parse budget — could be "800 mil", "R$ 800.000", etc.
                    const budgetStr = String(d.budget).replace(/[^\d]/g, '')
                    const budgetNum = parseInt(budgetStr)
                    if (budgetNum > 0) leadUpdate.budget_max = budgetNum > 10000 ? budgetNum : budgetNum * 1000
                }
                if (d.bedrooms) leadUpdate.bedrooms_wanted = parseInt(d.bedrooms) || null
                if (d.property_type) leadUpdate.property_type = d.property_type
                if (d.timeframe) leadUpdate.timeline = d.timeframe

                // Calculate qualification score (0-100)
                let score = 0
                if (leadUpdate.lead_name) score += 15
                if (leadUpdate.interest) score += 15
                if (leadUpdate.region) score += 15
                if (leadUpdate.budget_max) score += 20
                if (leadUpdate.bedrooms_wanted) score += 10
                if (leadUpdate.property_type) score += 10
                if (leadUpdate.timeline) score += 15
                leadUpdate.qualification_score = score

                // Determine status based on score
                if (aiResponse.shouldTransfer) {
                    leadUpdate.status = 'transferred'
                } else if (score >= 70) {
                    leadUpdate.status = 'qualified'
                } else if (score >= 30) {
                    leadUpdate.status = 'qualifying'
                }

                if (broker.id) leadUpdate.broker_id = broker.id

                // Upsert by lead_phone
                const { error } = await supabase
                    .from('lead_collected_data')
                    .upsert(leadUpdate, { onConflict: 'lead_phone' })

                if (error) {
                    console.warn('[CRM Interno] Upsert error:', error.message)
                } else {
                    console.log(`[CRM Interno] ✅ Lead ${cleanPhone} atualizado (score: ${score})`)
                }
            } catch (e) {
                console.warn('[CRM Interno] Sync failed (non-fatal):', e)
            }
        })

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
    { cron: '*/2 * * * *' },  // Every 2 minutes
    async () => {
        const supabase = getSupabase()

        // Get all connected instances with their config
        const { data: instances } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, instance_token, config')
            .eq('status', 'connected')

        if (!instances || instances.length === 0) {
            return { action: 'no_connected_instances' }
        }

        // Set presence for each instance that has always_online enabled
        const results: string[] = []
        for (const inst of instances) {
            const cfg = (inst.config as Record<string, any>) || {}
            // Default to true if not explicitly set to false
            if (cfg.always_online === false) {
                results.push(`${inst.instance_name}: skipped (always_online=false)`)
                continue
            }
            try {
                await setPresenceAvailable(inst.instance_token)
                results.push(`${inst.instance_name}: online`)
            } catch {
                results.push(`${inst.instance_name}: error`)
            }
        }

        console.log(`[KeepOnline] ${results.join(', ')}`)
        return { action: 'presence_set', count: instances.length, results }
    }
)
