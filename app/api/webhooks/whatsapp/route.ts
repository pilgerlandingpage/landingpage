import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/lib/inngest/client'
import { markAsRead, setPresenceAvailable } from '@/lib/uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ═══════════════════════════════════════════════════════════════
// WEBHOOK DISPATCHER — Recebe → Dispara evento Inngest → 200 OK
// Sem processamento pesado. Retorno imediato.
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const supabase = getSupabase()

        // ── DEBUG: Log the incoming payload (truncated) ──
        console.log('[Webhook] 📩 Payload:', JSON.stringify(body).substring(0, 500))

        // ── Extract event type ──
        const event = body.event || body.EventType || body.action || ''
        const instanceName = body.instance || body.instanceName || body.server_url || ''
        const messageData = body.data || body.message || body

        // Skip non-message events
        const messageEvents = ['messages.upsert', 'message', 'messages', 'chat', '']
        if (event && !messageEvents.includes(event)) {
            console.log(`[Webhook] ⏭️ Skipped event: ${event}`)
            return NextResponse.json({ success: true, action: 'ignored_event', event })
        }

        // ── Extract phone number ──
        // ConnectyHub pode enviar LIDs internos no campo sender/sender_pn
        // O número REAL vem em chatid, owner, ou chat.id
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

        const senderName = messageData.senderName || messageData.sender_name || messageData.pushName || ''

        // Extract text — ensure it's always a string (audio msgs may have objects here)
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

        // Audio URL — ConnectyHub sends in message.content.URL (uppercase!)
        const audioUrl = messageData.content?.URL        // ConnectyHub: message.content.URL
            || messageData.content?.url                   // lowercase variant
            || messageData.audioUrl
            || messageData.media?.url
            || messageData.message?.audioMessage?.url
            || messageData.message?.body?.audioMessage?.url
            || messageData.body?.audioMessage?.url
            || messageData.audio?.url
            || messageData.message?.audio?.url
            || body.chat?.message?.audioMessage?.url
            || body.chat?.audioMessage?.url
            || body.chat?.audio?.url
            || body.chat?.media?.url
            || null

        // Audio detection — ConnectyHub uses type:"audio" or messageType:"AudioMessage"
        const msgType = (messageData.type || '').toString().toLowerCase()
        const msgMessageType = (messageData.messageType || '').toString().toLowerCase()
        const chatLastMsgType = (body.chat?.wa_lastMessageType || '').toString().toLowerCase()
        
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

        // ── Detect interactive button/list responses ──
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

        // ── Detect poll vote responses ──
        const pollUpdate = messageData.message?.pollUpdateMessage
            || messageData.pollUpdateMessage
            || null
        const pollVotes = pollUpdate?.vote?.selectedOptions
            || pollUpdate?.selectedOptions
            || (messageData.type === 'poll_vote' ? messageData.options : null)
            || null
        const isPollResponse = !!pollVotes

        // ── Detect location received ──
        const locationMsg = messageData.message?.locationMessage
            || messageData.locationMessage
            || messageData.location
            || null
        const receivedLatitude = locationMsg?.degreesLatitude || locationMsg?.latitude || null
        const receivedLongitude = locationMsg?.degreesLongitude || locationMsg?.longitude || null
        const isLocation = !!(receivedLatitude && receivedLongitude)

        // ── Detect documents/images/videos ──
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

        // ── Detect reactions ──
        const reactionMsg = messageData.message?.reactionMessage
            || messageData.reactionMessage
            || null
        const reactionEmoji = reactionMsg?.text || reactionMsg?.emoji || null
        const isReaction = !!reactionEmoji

        // ── Determine message type ──
        const messageType = isAudio ? 'audio'
            : isButtonResponse ? 'button_response'
            : isPollResponse ? 'poll_response'
            : isLocation ? 'location'
            : isDocument ? 'document'
            : isReaction ? 'reaction'
            : 'text'

        // ── Extract media decryption data (WhatsApp E2EE media keys) ──
        const audioMediaKey = messageData.content?.mediaKey || messageData.message?.audioMessage?.mediaKey || null
        const audioDirectPath = messageData.content?.directPath || messageData.message?.audioMessage?.directPath || null

        // ── Extract message ID (needed for UAZAPI /message/download fallback) ──
        // ConnectyHub uses 'messageid' (lowercase), other providers use 'id' or 'key.id'
        const messageId = messageData.messageid       // ConnectyHub: 'messageid' field
            || messageData.id?.id                      // nested {id: {id: 'xxx'}}
            || messageData.key?.id                     // Baileys format
            || (typeof messageData.id === 'string' ? messageData.id : null)  // string id
            || messageData.messageId                   // camelCase variant
            || body.chat?.id?.id
            || body.chat?.key?.id
            || null

        // ── Audio detected: log details and save debug payload ──
        if (isAudio) {
            console.log(`[Webhook] 🎤 AUDIO DETECTED | audioUrl=${audioUrl ? audioUrl.substring(0, 100) : 'NULL'} | messageId=${messageId || 'NULL'} | type=${msgType} | messageType=${msgMessageType}`)
            if (!audioUrl) {
                console.log('[Webhook] 🎤 No direct audioUrl — agent will use UAZAPI /message/download with messageId')
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

        // ── DEEP DEBUG: Log full structure when we get empty text (likely audio) ──
        if (!messageText && !isAudio) {
            console.log('[Webhook] 🔍 AUDIO DEBUG — Empty message detected. Full key analysis:')
            console.log('[Webhook] 🔍 Top-level keys:', Object.keys(body).join(', '))
            if (body.chat) console.log('[Webhook] 🔍 body.chat keys:', Object.keys(body.chat).join(', '))
            if (body.chat?.message) console.log('[Webhook] 🔍 body.chat.message keys:', Object.keys(body.chat.message).join(', '))
            if (body.data) console.log('[Webhook] 🔍 body.data keys:', Object.keys(body.data).join(', '))
            if (body.message) console.log('[Webhook] 🔍 body.message keys:', typeof body.message === 'object' ? Object.keys(body.message).join(', ') : body.message)
            console.log('[Webhook] 🔍 FULL PAYLOAD:', JSON.stringify(body).substring(0, 2000))
        }

        // Clean phone number
        const cleanPhone = remotePhone?.toString().replace(/@.+$/, '').replace(/\D/g, '') || ''

        // ── VALIDATION: Check phone number format ──
        if (!cleanPhone) {
            console.log('[Webhook] ⚠️ No phone found. Keys:', Object.keys(messageData).join(', '))
            return NextResponse.json({ success: true, action: 'ignored_no_phone' })
        }

        // WhatsApp LIDs are ~20+ digits and start with a non-country-code pattern
        // Real BR numbers are 12-13 digits (55 + DDD + number)
        // Real international numbers are typically 10-15 digits
        if (cleanPhone.length > 15) {
            console.warn(`[Webhook] ⚠️ Rejected LID/invalid number: ${cleanPhone} (${cleanPhone.length} digits). Full payload keys: ${JSON.stringify(Object.keys(messageData))}`)
            // Try to find the real phone in other fields
            const fallbackPhone = messageData.sender_pn?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || messageData.sender?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || ''
            
            if (fallbackPhone && fallbackPhone.length <= 15 && fallbackPhone.length >= 10) {
                console.log(`[Webhook] 🔄 Using fallback phone: ${fallbackPhone}`)
                // Continue with fallback — reassign is handled below
            } else {
                console.error(`[Webhook] ❌ Could not find valid phone. chatid=${messageData.chatid}, sender_pn=${messageData.sender_pn}, sender=${messageData.sender}`)
                return NextResponse.json({ success: true, action: 'ignored_invalid_phone' })
            }
        }

        // Use the real phone (or fallback if LID was detected)
        const finalPhone = cleanPhone.length > 15
            ? (messageData.sender_pn?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || messageData.sender?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || cleanPhone)
            : cleanPhone

        const logText = messageText ? messageText.substring(0, 80) : '[empty/audio]'
        console.log(`[Webhook] 📱 Phone: ${finalPhone} | Name: ${senderName} | FromMe: ${isFromMe} | Audio: ${isAudio} | Instance: ${instanceName} | Text: "${logText}"`)

        // ── Find instance in DB ──
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
            console.error(`[Webhook] ❌ No instance found. instanceName: ${instanceName}`)
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        console.log(`[Webhook] ✅ Instance: ${instance.instance_name} (broker: ${instance.broker_id || 'none'})`)

        // ═══════════════════════════════════════════
        // DISPATCH TO INNGEST (async processing)
        // ═══════════════════════════════════════════

        if (isFromMe) {
            // ── Human Takeover Detection ──
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
                    }
                })
                console.log(`[Webhook] 📤 Dispatched human-takeover check to Inngest`)
            }

            return NextResponse.json({ success: true, action: 'from_me_dispatched' })
        }

        // Ignore truly empty messages (but allow button responses, polls, locations, reactions)
        if (!messageText && !isAudio && !isButtonResponse && !isPollResponse && !isLocation && !isDocument && !isReaction) {
            console.log('[Webhook] ⏭️ Ignored empty message')
            return NextResponse.json({ success: true, action: 'ignored_empty' })
        }

        // ── Immediate actions (before async Inngest processing) ──

        // 1) Mark as read (blue ticks) — fire-and-forget
        try {
            const instanceMarkAsRead = (instance as any)?.config?.mark_as_read
            const shouldMarkAsRead = instanceMarkAsRead !== false && instanceMarkAsRead !== 'false'
            if (shouldMarkAsRead) {
                markAsRead(remotePhone || finalPhone, instance.instance_token).catch((err) => {
                    console.warn('[Webhook] markAsRead failed:', err)
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
                msgContent = buttonResponseTitle || `[botão: ${buttonResponseId}]`
            } else if (!msgContent && isPollResponse) {
                msgContent = `[enquete: ${Array.isArray(pollVotes) ? pollVotes.join(', ') : pollVotes}]`
            } else if (!msgContent && isLocation) {
                msgContent = `[localização: ${receivedLatitude}, ${receivedLongitude}]`
            } else if (!msgContent && isAudio) {
                msgContent = '[audio]'
            }

            if (msgContent && !isAudio) {
                await supabase.from('app_config').insert({
                    key: `_pmq_${finalPhone}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    value: msgContent,
                    updated_at: new Date().toISOString()
                })
                console.log(`[Webhook] 📝 Queued pending message for ${finalPhone} (type: ${messageType})`)
            }
        } catch (e) {
            console.warn('[Webhook] Failed to queue pending message:', e)
        }

        // ── Route: AI Broker or Shadow Agent ──
        if (instance.broker_id || !instance.admin_user_id) {
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
            console.log(`[Webhook] 📤 Dispatched AI broker message to Inngest for ${finalPhone}`)
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
            console.log(`[Webhook] 📤 Dispatched shadow agent message to Inngest for ${finalPhone}`)
        }

        return NextResponse.json({ success: true, action: 'dispatched' })
    } catch (error) {
        console.error('[Webhook Error]', error)
        return NextResponse.json({ success: false, message: 'Erro no webhook' }, { status: 500 })
    }
}
