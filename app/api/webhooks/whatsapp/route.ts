import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/lib/inngest/client'
import { markAsRead, setPresenceAvailable } from '@/lib/uazapi'
import { uploadImageToR2 } from '@/lib/storage/r2'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function safeSlug(input: string): string {
    return String(input || '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'unknown'
}

function extFromMime(mime?: string | null): string {
    const m = String(mime || '').toLowerCase()
    if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
    if (m.includes('png')) return 'png'
    if (m.includes('webp')) return 'webp'
    if (m.includes('gif')) return 'gif'
    if (m.includes('mp4')) return 'mp4'
    if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
    if (m.includes('ogg')) return 'ogg'
    if (m.includes('wav')) return 'wav'
    if (m.includes('pdf')) return 'pdf'
    if (m.includes('zip')) return 'zip'
    return 'bin'
}

async function mirrorMediaToR2(params: {
    url: string
    mime?: string | null
    instanceName?: string
    phone?: string
    mediaKind: string
}) {
    const { url, mime, instanceName, phone, mediaKind } = params
    const now = new Date()
    const yyyy = now.getUTCFullYear()
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(now.getUTCDate()).padStart(2, '0')
    const ext = extFromMime(mime)
    const key = [
        'whatsapp-audit',
        `${yyyy}`,
        `${mm}`,
        `${dd}`,
        safeSlug(instanceName || 'unknown-instance'),
        safeSlug(phone || 'unknown-phone'),
        `${Date.now()}-${safeSlug(mediaKind)}.${ext}`,
    ].join('/')

    const r2Url = await uploadImageToR2(url, key)
    return {
        media_kind: mediaKind,
        original_url: url,
        r2_url: r2Url,
        key,
        mime: mime || null,
    }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WEBHOOK DISPATCHER â€” Recebe â†’ Dispara evento Inngest â†’ 200 OK
// Sem processamento pesado. Retorno imediato.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const supabase = getSupabase()

        // â”€â”€ DEBUG: Log the incoming payload (truncated) â”€â”€
        console.log('[Webhook] ðŸ“© Payload:', JSON.stringify(body).substring(0, 500))

        // â”€â”€ Extract event type â”€â”€
        const event = body.event || body.EventType || body.action || ''
        const instanceName = body.instance || body.instanceName || body.server_url || ''
        const messageData = body.data || body.message || body
        let auditPhone: string | null = null
        let auditSenderName: string | null = null
        let auditLeadId: string | null = null
        let auditMessageType: string | null = null
        let auditIsFromMe = false
        const auditMedia: any[] = []

        const saveAudit = async (params: { action: string; statusCode?: number; error?: string }) => {
            try {
                await supabase.from('whatsapp_webhook_audit_logs').insert({
                    instance_name: instanceName || null,
                    event_type: event || null,
                    message_type: auditMessageType,
                    action: params.action,
                    status_code: params.statusCode || 200,
                    is_from_me: auditIsFromMe,
                    from_phone: auditPhone,
                    lead_id: auditLeadId,
                    sender_name: auditSenderName,
                    payload: body,
                    media: auditMedia,
                    error: params.error || null,
                })
            } catch (e) {
                console.warn('[Webhook][Audit] Failed to save audit row:', e)
            }
        }

        // Skip non-message events
        const messageEvents = ['messages.upsert', 'message', 'messages', 'chat', '']
        if (event && !messageEvents.includes(event)) {
            console.log(`[Webhook] â­ï¸ Skipped event: ${event}`)
            await saveAudit({ action: 'ignored_event' })
            return NextResponse.json({ success: true, action: 'ignored_event', event })
        }

        // â”€â”€ Extract phone number â”€â”€
        // ConnectyHub pode enviar LIDs internos no campo sender/sender_pn
        // O nÃºmero REAL vem em chatid, owner, ou chat.id
        // Prioridade: chatid > owner > chat.id > sender_pn > from > remoteJid
        const remotePhone = messageData.chatid           // "5511964830003@s.whatsapp.net" (BEST)
            || messageData.owner                         // sometimes has the real phone
            || body.chat?.id                             // nested chat object
            || messageData.key?.remoteJid                // Evolution/Baileys format
            || messageData.from
            || messageData.remoteJid
            || messageData.phone
            || body.from
            || body.phone
            || ''

        const senderNameRaw = messageData.senderName || messageData.sender_name || messageData.pushName || ''

        // Extract text â€” ensure it's always a string (audio msgs may have objects here)
        const rawText = messageData.text
            || messageData.caption
            || messageData.message?.conversation
            || messageData.message?.extendedTextMessage?.text
            // Only use content/body if they are strings (not audio objects like {URL: "..."})
            || (typeof messageData.content === 'string' ? messageData.content : '')
            || (typeof messageData.body === 'string' ? messageData.body : '')
            || body.text
            || body.body
            || ''
        const messageText = typeof rawText === 'string' ? rawText : ''

        const isFromMe = messageData.fromMe ?? messageData.key?.fromMe ?? body.fromMe ?? false
        auditIsFromMe = Boolean(isFromMe)

        // Audio detection â€” ConnectyHub uses type:"audio" or messageType:"AudioMessage"
        const msgType = (messageData.type || '').toString().toLowerCase()
        const msgMessageType = (messageData.messageType || '').toString().toLowerCase()
        const chatLastMsgType = (body.chat?.wa_lastMessageType || '').toString().toLowerCase()
        const genericContentUrl = messageData.content?.URL
            || messageData.content?.url
            || messageData.media?.url
            || body.chat?.media?.url
            || null
        const contentMime = String(
            messageData.content?.mimetype
            || messageData.media?.mimetype
            || messageData.message?.audioMessage?.mimetype
            || ''
        ).toLowerCase()
        const audioTypeHint = (
            msgType === 'audio'
            || msgType === 'audiomessage'
            || msgType === 'ptt'
            || msgMessageType === 'audio'
            || msgMessageType === 'audiomessage'
            || chatLastMsgType === 'audio'
            || chatLastMsgType === 'audiomessage'
        )
        const contentLooksAudio = contentMime.startsWith('audio/')
        const explicitAudioUrl = messageData.audioUrl
            || messageData.message?.audioMessage?.url
            || messageData.message?.body?.audioMessage?.url
            || messageData.body?.audioMessage?.url
            || messageData.audio?.url
            || messageData.message?.audio?.url
            || body.chat?.message?.audioMessage?.url
            || body.chat?.audioMessage?.url
            || body.chat?.audio?.url
            || null
        const audioUrl = explicitAudioUrl || ((audioTypeHint || contentLooksAudio) ? genericContentUrl : null)
        
        const isAudio = !!(audioUrl
            || msgType === 'audio'
            || msgType === 'audiomessage'
            || msgType === 'ptt'
            || msgType === 'media' && (msgMessageType === 'audiomessage' || msgMessageType === 'audio')
            || msgMessageType === 'audiomessage'
            || msgMessageType === 'audio'
            || chatLastMsgType === 'audiomessage'
            || messageData.message?.audioMessage
            || messageData.message?.body?.audioMessage
            || messageData.body?.audioMessage
            || messageData.audio
            || body.chat?.audioMessage
            || body.chat?.message?.audioMessage)

        // â”€â”€ Detect interactive button/list responses â”€â”€
        const buttonResponse = messageData.message?.buttonsResponseMessage
            || messageData.message?.listResponseMessage
            || messageData.buttonsResponseMessage
            || messageData.listResponseMessage
            || null
        const buttonResponseId = buttonResponse?.selectedButtonId
            || buttonResponse?.singleSelectReply?.selectedRowId
            || buttonResponse?.selectedRowId
            || messageData.selectedButtonId
            || messageData.selectedRowId
            || null
        const buttonResponseTitle = buttonResponse?.selectedDisplayText
            || buttonResponse?.title
            || messageData.selectedDisplayText
            || null
        const isButtonResponse = !!(buttonResponseId || buttonResponseTitle)

        // â”€â”€ Detect poll vote responses â”€â”€
        const pollUpdate = messageData.message?.pollUpdateMessage
            || messageData.pollUpdateMessage
            || null
        const pollVotes = pollUpdate?.vote?.selectedOptions
            || pollUpdate?.selectedOptions
            || (messageData.type === 'poll_vote' ? messageData.options : null)
            || null
        const isPollResponse = !!pollVotes

        // â”€â”€ Detect location received â”€â”€
        const locationMsg = messageData.message?.locationMessage
            || messageData.locationMessage
            || messageData.location
            || null
        const receivedLatitude = locationMsg?.degreesLatitude || locationMsg?.latitude || null
        const receivedLongitude = locationMsg?.degreesLongitude || locationMsg?.longitude || null
        const isLocation = !!(receivedLatitude && receivedLongitude)

        // â”€â”€ Detect documents/images/videos â”€â”€
        const documentMsg = messageData.message?.documentMessage
            || messageData.message?.documentWithCaptionMessage?.message?.documentMessage
            || messageData.documentMessage
            || null
        const imageMsg = messageData.message?.imageMessage
            || messageData.imageMessage
            || null
        const videoMsg = messageData.message?.videoMessage
            || messageData.videoMessage
            || null
        const mediaMsg = documentMsg || imageMsg || videoMsg || null
        const mediaUrl = mediaMsg?.url
            || mediaMsg?.URL
            || messageData.content?.URL
            || messageData.content?.url
            || messageData.media?.url
            || null
        const mediaMimetype = mediaMsg?.mimetype
            || messageData.content?.mimetype
            || null
        const mediaFilename = documentMsg?.fileName
            || messageData.content?.fileName
            || messageData.fileName
            || null
        const isDocument = !!(documentMsg || (imageMsg && !isAudio) || videoMsg)
        const mediaType = documentMsg ? 'document' : imageMsg ? 'image' : videoMsg ? 'video' : null

        // â”€â”€ Detect reactions â”€â”€
        const reactionMsg = messageData.message?.reactionMessage
            || messageData.reactionMessage
            || null
        const reactionEmoji = reactionMsg?.text || reactionMsg?.emoji || null
        const isReaction = !!reactionEmoji

        // â”€â”€ Determine message type â”€â”€
        const messageType = isAudio ? 'audio'
            : isButtonResponse ? 'button_response'
            : isPollResponse ? 'poll_response'
            : isLocation ? 'location'
            : isDocument ? 'document'
            : isReaction ? 'reaction'
            : 'text'
        auditMessageType = messageType

        // â”€â”€ Extract media decryption data (WhatsApp E2EE media keys) â”€â”€
        const audioMediaKey = messageData.content?.mediaKey || messageData.message?.audioMessage?.mediaKey || null
        const audioDirectPath = messageData.content?.directPath || messageData.message?.audioMessage?.directPath || null

        // â”€â”€ Extract message ID (needed for UAZAPI /message/download fallback) â”€â”€
        // ConnectyHub uses 'messageid' (lowercase), other providers use 'id' or 'key.id'
        const messageId = messageData.messageid       // ConnectyHub: 'messageid' field
            || messageData.id?.id                      // nested {id: {id: 'xxx'}}
            || messageData.key?.id                     // Baileys format
            || (typeof messageData.id === 'string' ? messageData.id : null)  // string id
            || messageData.messageId                   // camelCase variant
            || body.chat?.id?.id
            || body.chat?.key?.id
            || null

        // â”€â”€ Audio detected: log details and save debug payload â”€â”€
        if (isAudio) {
            console.log(`[Webhook] ðŸŽ¤ AUDIO DETECTED | audioUrl=${audioUrl ? audioUrl.substring(0, 100) : 'NULL'} | messageId=${messageId || 'NULL'} | type=${msgType} | messageType=${msgMessageType}`)
            if (!audioUrl) {
                console.log('[Webhook] ðŸŽ¤ No direct audioUrl â€” agent will use UAZAPI /message/download with messageId')
            }
            // Save full payload to DB for debugging (we can query this!)
            try {
                await supabase.from('app_config').upsert({
                    key: '_debug_last_audio_payload',
                    value: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        audioUrl: audioUrl || null,
                        messageId: messageId || null,
                        messageId_raw_messageid: messageData.messageid || null,
                        messageId_raw_id: typeof messageData.id === 'string' ? messageData.id : JSON.stringify(messageData.id)?.substring(0, 200) || null,
                        messageId_raw_keyid: messageData.key?.id || null,
                        msgType,
                        msgMessageType,
                        chatLastMsgType,
                        topLevelKeys: Object.keys(body),
                        dataKeys: messageData ? Object.keys(messageData) : [],
                        contentKeys: messageData?.content ? Object.keys(messageData.content) : [],
                        contentValue: typeof messageData?.content === 'object' ? JSON.stringify(messageData.content).substring(0, 500) : String(messageData?.content || '').substring(0, 200),
                        fullPayload: JSON.stringify(body).substring(0, 3000),
                    }).substring(0, 4000)
                }, { onConflict: 'key' })
            } catch (e) {
                console.error('[Webhook] Debug save error:', e)
            }
        }

        // â”€â”€ DEEP DEBUG: Log full structure when we get empty text (likely audio) â”€â”€
        if (!messageText && !isAudio) {
            console.log('[Webhook] ðŸ” AUDIO DEBUG â€” Empty message detected. Full key analysis:')
            console.log('[Webhook] ðŸ” Top-level keys:', Object.keys(body).join(', '))
            if (body.chat) console.log('[Webhook] ðŸ” body.chat keys:', Object.keys(body.chat).join(', '))
            if (body.chat?.message) console.log('[Webhook] ðŸ” body.chat.message keys:', Object.keys(body.chat.message).join(', '))
            if (body.data) console.log('[Webhook] ðŸ” body.data keys:', Object.keys(body.data).join(', '))
            if (body.message) console.log('[Webhook] ðŸ” body.message keys:', typeof body.message === 'object' ? Object.keys(body.message).join(', ') : body.message)
            console.log('[Webhook] ðŸ” FULL PAYLOAD:', JSON.stringify(body).substring(0, 2000))
        }

        // Clean phone number
        const cleanPhone = remotePhone?.toString().replace(/@.+$/, '').replace(/\D/g, '') || ''

        // â”€â”€ VALIDATION: Check phone number format â”€â”€
        if (!cleanPhone) {
            console.log('[Webhook] âš ï¸ No phone found. Keys:', Object.keys(messageData).join(', '))
            await saveAudit({ action: 'ignored_no_phone' })
            return NextResponse.json({ success: true, action: 'ignored_no_phone' })
        }

        // WhatsApp LIDs are ~20+ digits and start with a non-country-code pattern
        // Real BR numbers are 12-13 digits (55 + DDD + number)
        // Real international numbers are typically 10-15 digits
        if (cleanPhone.length > 15) {
            console.warn(`[Webhook] âš ï¸ Rejected LID/invalid number: ${cleanPhone} (${cleanPhone.length} digits). Full payload keys: ${JSON.stringify(Object.keys(messageData))}`)
            // Try to find the real phone in other fields
            const fallbackPhone = messageData.sender_pn?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || messageData.sender?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || ''
            
            if (fallbackPhone && fallbackPhone.length <= 15 && fallbackPhone.length >= 10) {
                console.log(`[Webhook] ðŸ”„ Using fallback phone: ${fallbackPhone}`)
                // Continue with fallback â€” reassign is handled below
            } else {
                console.error(`[Webhook] âŒ Could not find valid phone. chatid=${messageData.chatid}, sender_pn=${messageData.sender_pn}, sender=${messageData.sender}`)
                await saveAudit({ action: 'ignored_invalid_phone' })
                return NextResponse.json({ success: true, action: 'ignored_invalid_phone' })
            }
        }

        // Use the real phone (or fallback if LID was detected)
        const finalPhone = cleanPhone.length > 15
            ? (messageData.sender_pn?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || messageData.sender?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || cleanPhone)
            : cleanPhone
        auditPhone = finalPhone

        // Fallback do nome do lead: se WhatsApp nao trouxer senderName, usa nome do formulario salvo no CRM interno.
        let senderName = senderNameRaw
        try {
            const { data: leadByPhone } = await supabase
                .from('leads')
                .select('id, name')
                .or(`phone.eq.${finalPhone},phone_e164.eq.${finalPhone}`)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            if (leadByPhone?.id) auditLeadId = String(leadByPhone.id)
            if (!senderName && leadByPhone?.name) senderName = String(leadByPhone.name)
        } catch (e) {
            console.warn('[Webhook] Could not resolve senderName from leads:', e)
        }
        auditSenderName = senderName || null

        // Espelha midia no R2 para retencao forense de auditoria.
        try {
            const candidates = [
                { url: audioUrl, mime: 'audio/ogg', kind: 'audio' },
                { url: mediaUrl, mime: mediaMimetype, kind: mediaType || 'media' },
            ]
            const dedupe = new Set<string>()
            for (const item of candidates) {
                const sourceUrl = String(item.url || '').trim()
                if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl) || dedupe.has(sourceUrl)) continue
                dedupe.add(sourceUrl)

                const mirrored = await mirrorMediaToR2({
                    url: sourceUrl,
                    mime: item.mime,
                    instanceName,
                    phone: finalPhone,
                    mediaKind: item.kind,
                })
                auditMedia.push({
                    ...mirrored,
                    filename: mediaFilename || null,
                })
            }
        } catch (e) {
            console.warn('[Webhook] Media mirror to R2 failed:', e)
        }

        const logText = messageText ? messageText.substring(0, 80) : '[empty/audio]'
        console.log(`[Webhook] ðŸ“± Phone: ${finalPhone} | Name: ${senderName || '[unknown]'} | FromMe: ${isFromMe} | Audio: ${isAudio} | Instance: ${instanceName} | Text: "${logText}"`)

        // â”€â”€ Find instance in DB â”€â”€
        let instance: any = null

        if (instanceName) {
            const { data } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_name, instance_token, broker_id, admin_user_id, status, config')
                .eq('instance_name', instanceName)
                .maybeSingle()
            instance = data
        }

        if (!instance) {
            const { data } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_name, instance_token, broker_id, admin_user_id, status, config')
                .eq('status', 'connected')
                .limit(1)
                .maybeSingle()
            instance = data
        }

        if (!instance) {
            console.error(`[Webhook] âŒ No instance found. instanceName: ${instanceName}`)
            await saveAudit({ action: 'instance_not_found', statusCode: 404 })
            return NextResponse.json({ success: false, message: 'InstÃ¢ncia não encontrada' }, { status: 404 })
        }

        console.log(`[Webhook] âœ… Instance: ${instance.instance_name} (broker: ${instance.broker_id || 'none'})`)

        // Anti-loop: ignore inbound messages coming from another connected instance number.
        try {
            const senderDigits = (finalPhone || '').replace(/\D/g, '')
            if (senderDigits) {
                const { data: connectedInstances } = await supabase
                    .from('whatsapp_instances')
                    .select('id, phone_number')
                    .eq('status', 'connected')
                const internalSender = (connectedInstances || []).find((row: any) => {
                    const rowDigits = String(row?.phone_number || '').replace(/\D/g, '')
                    return row.id !== instance.id && rowDigits && rowDigits === senderDigits
                })
                if (internalSender) {
                    console.log(`[Webhook] â›” Ignored internal instance-to-instance message from ${senderDigits}`)
                    await saveAudit({ action: 'ignored_internal_instance_message' })
                    return NextResponse.json({ success: true, action: 'ignored_internal_instance_message' })
                }
            }
        } catch (e) {
            console.warn('[Webhook] Anti-loop check failed (non-fatal):', e)
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // DISPATCH TO INNGEST (async processing)
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

        if (isFromMe) {
            // â”€â”€ Human Takeover Detection â”€â”€
            const botMsgId = messageData.id?.id || messageData.key?.id || ''
            const recipientPhone = messageData.to?.replace(/@.+$/, '').replace(/\D/g, '')
                || messageData.chatid?.replace(/@.+$/, '').replace(/\D/g, '')
                || ''

            if (botMsgId) {
                await inngest.send({
                    name: 'whatsapp/from-me-message',
                    data: {
                        botMsgId,
                        instanceId: instance.id,
                        recipientPhone,
                        messageText: messageText || null,
                    }
                })
                console.log(`[Webhook] ðŸ“¤ Dispatched human-takeover check to Inngest`)
            }

            await saveAudit({ action: 'from_me_dispatched' })
            return NextResponse.json({ success: true, action: 'from_me_dispatched' })
        }

        // Ignore truly empty messages (but allow button responses, polls, locations, reactions)
        if (!messageText && !isAudio && !isButtonResponse && !isPollResponse && !isLocation && !isDocument && !isReaction) {
            console.log('[Webhook] â­ï¸ Ignored empty message')
            await saveAudit({ action: 'ignored_empty' })
            return NextResponse.json({ success: true, action: 'ignored_empty' })
        }

        // â”€â”€ Immediate actions (before async Inngest processing) â”€â”€

        // 1) Mark as read (blue ticks) â€” immediate + short retries for reliability
        try {
            const instanceMarkAsRead = (instance as any)?.config?.mark_as_read
            const shouldMarkAsRead = instanceMarkAsRead !== false && instanceMarkAsRead !== 'false'
            if (shouldMarkAsRead) {
                const readTargets = Array.from(new Set([
                    remotePhone || '',
                    finalPhone || '',
                    finalPhone ? `${finalPhone}@s.whatsapp.net` : '',
                ].filter(Boolean)))

                for (let attempt = 0; attempt < 3; attempt++) {
                    await Promise.allSettled(
                        readTargets.map((target) => markAsRead(target, instance.instance_token))
                    )
                    if (attempt < 2) {
                        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
                    }
                }

                // Reliability fallback in background: retries over a few seconds
                // (helps when provider hasn't indexed the inbound message yet).
                await inngest.send({
                    name: 'whatsapp/mark-read',
                    data: {
                        instanceToken: instance.instance_token,
                        remotePhone: remotePhone || null,
                        cleanPhone: finalPhone,
                    }
                })
            }
        } catch { /* ignore */ }

        // 1.1) Keep contact-level presence available when enabled
        try {
            const instanceAlwaysOnline = (instance as any)?.config?.always_online
            const shouldStayOnline = instanceAlwaysOnline !== false && instanceAlwaysOnline !== 'false'
            if (shouldStayOnline) {
                setPresenceAvailable(instance.instance_token, remotePhone || finalPhone).catch((err) => {
                    console.warn('[Webhook] setPresenceAvailable failed:', err)
                })
            }
        } catch { /* ignore */ }

        // 2) Queue message for debounce batching (atomic INSERT, no race condition)
        try {
            // Build content from various message types
            let msgContent = messageText || ''
            if (!msgContent && isButtonResponse) {
                msgContent = buttonResponseTitle || `[botÃ£o: ${buttonResponseId}]`
            } else if (!msgContent && isPollResponse) {
                msgContent = `[enquete: ${Array.isArray(pollVotes) ? pollVotes.join(', ') : pollVotes}]`
            } else if (!msgContent && isLocation) {
                msgContent = `[localizaÃ§Ã£o: ${receivedLatitude}, ${receivedLongitude}]`
            } else if (!msgContent && isAudio) {
                msgContent = '[audio]'
            }

            if (msgContent && !isAudio) {
                await supabase.from('app_config').insert({
                    key: `_pmq_${finalPhone}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    value: msgContent,
                    updated_at: new Date().toISOString()
                })
                console.log(`[Webhook] ðŸ“ Queued pending message for ${finalPhone} (type: ${messageType})`)
            }
        } catch (e) {
            console.warn('[Webhook] Failed to queue pending message:', e)
        }

        // â”€â”€ Route: AI Broker or Shadow Agent â”€â”€
        try {
            const { data: leadRow } = await supabase
                .from('leads')
                .select('id, visitor_id, landing_page_id, conversation_started_at, metadata')
                .or(`phone.eq.${finalPhone},phone_e164.eq.${finalPhone}`)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (leadRow?.visitor_id) {
                const followupAttempts = Number((leadRow.metadata as any)?.whatsapp_followup_attempts || 0)
                const isFirstInboundAfterFollowup = !leadRow.conversation_started_at && followupAttempts > 0

                await supabase.from('funnel_events').insert({
                    visitor_id: leadRow.visitor_id,
                    lead_id: leadRow.id || null,
                    landing_page_id: leadRow.landing_page_id || null,
                    event_type: 'whatsapp_conversation_started',
                    metadata: {
                        instance_id: instance.id,
                        instance_name: instance.instance_name,
                        message_type: messageType || 'text',
                    },
                })

                if (isFirstInboundAfterFollowup) {
                    await supabase.from('funnel_events').insert({
                        visitor_id: leadRow.visitor_id,
                        lead_id: leadRow.id || null,
                        landing_page_id: leadRow.landing_page_id || null,
                        event_type: 'whatsapp_followup_replied',
                        metadata: {
                            followup_attempts: followupAttempts,
                        },
                    })
                }

                await supabase
                    .from('leads')
                    .update({
                        conversation_started_at: new Date().toISOString(),
                    })
                    .eq('id', leadRow.id)
                    .is('conversation_started_at', null)
            }
        } catch (e) {
            console.warn('[Webhook] Failed to register whatsapp_conversation_started:', e)
        }

        if (instance.broker_id) {
            // AI Broker path
            await inngest.send({
                name: 'whatsapp/message-received',
                data: {
                    cleanPhone: finalPhone,
                    messageText,
                    messageType,
                    isAudio,
                    audioUrl,
                    audioMediaKey,
                    audioDirectPath,
                    messageId,
                    // Interactive message data
                    buttonResponseId: buttonResponseId || null,
                    buttonResponseTitle: buttonResponseTitle || null,
                    pollVotes: pollVotes || null,
                    receivedLatitude: receivedLatitude || null,
                    receivedLongitude: receivedLongitude || null,
                    reactionEmoji: reactionEmoji || null,
                    // Media/document data
                    mediaUrl: mediaUrl || null,
                    mediaMimetype: mediaMimetype || null,
                    mediaFilename: mediaFilename || null,
                    mediaType: mediaType || null,
                    // Instance/routing
                    instanceId: instance.id,
                    instanceToken: instance.instance_token,
                    instanceName: instance.instance_name,
                    brokerId: instance.broker_id || null,
                    senderName,
                }
            })
            console.log(`[Webhook] ðŸ“¤ Dispatched AI broker message to Inngest for ${finalPhone}`)
        } else if (instance.admin_user_id) {
            // Shadow Agent path
            await inngest.send({
                name: 'whatsapp/shadow-agent',
                data: {
                    cleanPhone: finalPhone,
                    messageText,
                    instanceId: instance.id,
                    instanceToken: instance.instance_token,
                    adminUserId: instance.admin_user_id,
                }
            })
            console.log(`[Webhook] ðŸ“¤ Dispatched shadow agent message to Inngest for ${finalPhone}`)
        } else {
            // No broker and no shadow owner: skip safely to avoid wrong persona/prompt.
            console.warn(`[Webhook] Skipped message: instance ${instance.id} has no broker_id/admin_user_id`)
            await saveAudit({ action: 'ignored_unassigned_instance' })
            return NextResponse.json({ success: true, action: 'ignored_unassigned_instance' })
        }

        await saveAudit({ action: 'dispatched' })
        return NextResponse.json({ success: true, action: 'dispatched' })
    } catch (error) {
        console.error('[Webhook Error]', error)
        try {
            const supabase = getSupabase()
            await supabase.from('whatsapp_webhook_audit_logs').insert({
                action: 'error',
                status_code: 500,
                payload: {},
                media: [],
                error: String(error),
            })
        } catch {
            // best effort
        }
        return NextResponse.json({ success: false, message: 'Erro no webhook' }, { status: 500 })
    }
}







