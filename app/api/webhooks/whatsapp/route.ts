import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/lib/inngest/client'
import { downloadMedia, markAsRead, sendCarousel, sendLocationRequest, sendMenuMessage, sendPixButton, sendWhatsAppMessage, setPresenceAvailable } from '@/lib/connectyhub/whatsapp'
import { uploadImageToR2 } from '@/lib/storage/r2'
import { analyzeVoteProofMedia } from '@/lib/events/vote-proof-validation'
import {
    detectProfileAssessmentToolIntent,
    isProfileAssessmentAwaitingProofFollowUp,
    loadProfileAssessmentGate,
    PROFILE_ASSESSMENT_VOTE_URL,
    profileAssessmentToolUrl,
    saveProfileAssessmentGate,
} from '@/lib/whatsapp/profile-assessment-gate'
import {
    sendProfileAssessmentReminder,
    sendProfileAssessmentToolReleased,
    sendProfileAssessmentVoteRequest,
} from '@/lib/whatsapp/profile-assessment-delivery'
import { appendLeadConversationLog, ensureWhatsAppLead, isGenericWhatsAppLeadName, syncWhatsAppLeadSnapshot } from '@/lib/whatsapp/lead-sync'
import { getAiAutomationGate } from '@/lib/ai/automation-control'
import { generateChatResponse } from '@/lib/ai/generation'
import { recordGeminiUsage } from '@/lib/ai/gemini-costs'
import { trackEventInteractionFromWhatsApp } from '@/lib/events/interaction-tracking'
import { resolveSystemNotificationWhatsappInstance } from '@/lib/notifications/sector-recipients'
import { recordAgentConversationEcosystemEvent, recordEcosystemEvent } from '@/lib/intelligence/ecosystem'
import { saveHistoryWebhookMessages } from '@/lib/whatsapp/attendance-monitor'
import { normalizeWhatsAppConnectionStatus } from '@/lib/whatsapp/connection-status'
import { processVitorPaidTrafficCommand } from '@/lib/ads/vitor-traffic-manager'
import { processPilgerEditorialCommand } from '@/lib/whatsapp/pilger-editorial-agent'
import {
    buildGlobalInternalPartnerReply,
    processPilgerFinanceCommand,
    resolveGlobalFinanceContext,
} from '@/lib/whatsapp/pilger-finance-agent'
import { processPilgerPropertyCommand } from '@/lib/whatsapp/pilger-property-agent'
import { processPilgerReportCommand } from '@/lib/whatsapp/pilger-report-agent'
import {
    buildWhatsAppGlobalAcknowledgement,
    buildWhatsAppGlobalConversationHistory,
    detectWhatsAppGlobalCommandIntent,
    getOrCreateWhatsAppGlobalSession,
    isWhatsAppGlobalInstance,
    isWhatsAppGlobalOperatorMessage,
    recordWhatsAppGlobalCommand,
    resolveWhatsAppGlobalIdentity,
} from '@/lib/whatsapp/global-identity'
import {
    buildPilgerAgentRouterAcknowledgement,
    buildPilgerAgentResultMessage,
    recordPilgerAgentRoute,
    resolvePilgerAgentRoute,
} from '@/lib/whatsapp/pilger-agent-router'
import {
    buildAppointmentConfirmationText,
    detectConfirmedAppointment,
    extractAppointmentTimeFromText,
    generateAIResponse,
    getSaoPauloDate,
    loadAIConfigs,
    parseInteractiveElements,
    resolveSocialQuickReply,
    resolveRelativeAppointmentDate,
    saveDetectedAppointment,
    splitIntoHumanChunks,
    trackBotMessageId,
} from '@/lib/inngest/whatsapp-agent'

export const maxDuration = 60

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const MAX_VOTE_PROOF_BYTES = 20 * 1024 * 1024
type VoteProofMediaKind = 'image' | 'video' | 'document'

function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function parseStoredMediaUrl(value?: string | null): { url: string; mime?: string | null } | null {
    if (!value) return null
    try {
        const parsed = JSON.parse(value)
        const url = String(parsed?.url || parsed?.r2Url || '').trim()
        if (!url) return null
        return { url, mime: parsed?.mime || null }
    } catch {
        const url = String(value || '').trim()
        return url ? { url } : null
    }
}

function isLikelyEncryptedWhatsAppMediaUrl(url?: string | null): boolean {
    const value = String(url || '').toLowerCase()
    return value.includes('mmg.whatsapp.net') || value.includes('.enc?') || value.endsWith('.enc')
}

function detectImageMimeType(buffer: Buffer, fallback?: string | null) {
    const header4 = buffer.subarray(0, 4).toString('latin1')
    const header8 = buffer.subarray(0, 8).toString('latin1')
    const hinted = String(fallback || '').split(';')[0].trim().toLowerCase()
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
    if (header8 === '\x89PNG\r\n\x1a\n') return 'image/png'
    if (header4 === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
    if (header4 === 'GIF8') return 'image/gif'
    return hinted.startsWith('image/') ? hinted : ''
}

function detectVoteProofMimeType(kind: VoteProofMediaKind, buffer: Buffer, fallback?: string | null) {
    const hinted = String(fallback || '').split(';')[0].trim().toLowerCase()
    const imageMime = detectImageMimeType(buffer, hinted)
    if (imageMime) return imageMime

    const header4 = buffer.subarray(0, 4).toString('latin1')
    const at4 = buffer.subarray(4, 8).toString('latin1')

    if (kind === 'video') {
        if (at4 === 'ftyp') return hinted.startsWith('video/') ? hinted : 'video/mp4'
        if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return hinted.startsWith('video/') ? hinted : 'video/webm'
        if (header4 === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'AVI ') return hinted.startsWith('video/') ? hinted : 'video/x-msvideo'
        return hinted.startsWith('video/') ? hinted : ''
    }

    if (header4 === '%PDF') return 'application/pdf'
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
        return hinted.startsWith('application/') ? hinted : 'application/zip'
    }
    if (kind === 'document' && (hinted.startsWith('application/') || hinted.startsWith('text/'))) return hinted
    return ''
}

function isUsableVoteProofBuffer(kind: VoteProofMediaKind, buffer: Buffer | null, mimeHint?: string | null) {
    if (!buffer || buffer.length < 64) return false
    const mimeType = detectVoteProofMimeType(kind, buffer, mimeHint)
    if (!mimeType) return false
    if (kind === 'image') return mimeType.startsWith('image/')
    if (kind === 'video') return mimeType.startsWith('video/')
    return mimeType.startsWith('application/') || mimeType.startsWith('text/') || mimeType.startsWith('image/')
}

async function fetchUrlToVoteProofBuffer(url: string, kind: VoteProofMediaKind, mimeHint?: string | null) {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error(`download_${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = String(response.headers.get('content-type') || mimeHint || '').split(';')[0].trim().toLowerCase()
    return { buffer, mimeType: detectVoteProofMimeType(kind, buffer, contentType) }
}

async function fetchVoteProofMedia(params: {
    kind: VoteProofMediaKind
    supabase: any
    instanceToken: string
    mediaUrl?: string | null
    mimeHint?: string | null
    messageId?: string | null
}) {
    const errors: string[] = []

    const accept = (buffer: Buffer | null, mimeHint?: string | null) => {
        if (!buffer) return null
        if (buffer.length > MAX_VOTE_PROOF_BYTES) {
            errors.push(`arquivo acima de ${(MAX_VOTE_PROOF_BYTES / 1024 / 1024).toFixed(0)}MB`)
            return null
        }
        const mimeType = detectVoteProofMimeType(params.kind, buffer, mimeHint)
        if (!isUsableVoteProofBuffer(params.kind, buffer, mimeType)) {
            errors.push('bytes recebidos não parecem uma mídia válida')
            return null
        }
        return { buffer, mimeType }
    }

    if (params.mediaUrl && !isLikelyEncryptedWhatsAppMediaUrl(params.mediaUrl)) {
        try {
            const direct = await fetchUrlToVoteProofBuffer(params.mediaUrl, params.kind, params.mimeHint)
            const accepted = accept(direct.buffer, direct.mimeType || params.mimeHint)
            if (accepted) return accepted
        } catch (error: any) {
            errors.push(`url direta: ${error?.message || String(error)}`)
        }
    }

    if (params.messageId) {
        for (let attempt = 1; attempt <= 5; attempt += 1) {
            try {
                const downloaded = await downloadMedia(params.messageId, params.instanceToken, { generateMp3: false })
                const accepted = accept(downloaded, params.mimeHint)
                if (accepted) return accepted
            } catch (error: any) {
                errors.push(`download provider: ${error?.message || String(error)}`)
            }
            if (attempt < 5) await wait(1200)
        }

        for (let attempt = 1; attempt <= 3; attempt += 1) {
            let stored: { url: string; mime?: string | null } | null = null
            try {
                const { data: storedMedia } = await params.supabase
                    .from('app_config')
                    .select('value')
                    .eq('key', `_wmedia_${params.messageId}`)
                    .maybeSingle()
                stored = parseStoredMediaUrl(storedMedia?.value || null)
            } catch (error: any) {
                errors.push(`mídia armazenada indisponível: ${error?.message || String(error)}`)
            }
            if (stored?.url) {
                try {
                    const fromStored = await fetchUrlToVoteProofBuffer(stored.url, params.kind, stored.mime || params.mimeHint)
                    const accepted = accept(fromStored.buffer, fromStored.mimeType || stored.mime || params.mimeHint)
                    if (accepted) return accepted
                } catch (error: any) {
                    errors.push(`mídia armazenada: ${error?.message || String(error)}`)
                }
            }
            if (attempt < 3) await wait(1500)
        }
    }

    throw new Error(errors.slice(0, 4).join(' | ') || 'Não foi possível baixar o comprovante como mídia válida.')
}

const PROFILE_ASSESSMENT_REMINDER_COOLDOWN_MS = 90 * 1000

function recentlySentProfileAssessmentReminder(gate: any) {
    const lastReminderAt = Date.parse(String(gate?.last_reminder_at || ''))
    return Number.isFinite(lastReminderAt) && Date.now() - lastReminderAt < PROFILE_ASSESSMENT_REMINDER_COOLDOWN_MS
}

async function loadProfileAssessmentDeliveryConfigs(supabase: any, instance: any, baseConfigs: Record<string, string>) {
    const configs = { ...(baseConfigs || {}) }
    if (!instance?.broker_id) return configs

    try {
        const { data } = await supabase
            .from('virtual_brokers')
            .select('voice_id')
            .eq('id', instance.broker_id)
            .maybeSingle()
        const brokerVoiceId = String(data?.voice_id || '').trim()
        if (brokerVoiceId) configs.whatsapp_tts_voice = brokerVoiceId
    } catch {
        // Keep global voice fallback.
    }

    return configs
}

async function clearProfileAssessmentPendingQueue(supabase: any, phone: string) {
    await supabase
        .from('app_config')
        .delete()
        .like('key', `_pmq_${phone}_%`)
}

async function maybeHandleProfileAssessmentToolGate(params: {
    supabase: any
    instance: any
    phone: string
    text: string
    messageType?: string | null
    mediaUrl?: string | null
    mediaMimetype?: string | null
    messageId?: string | null
    origin?: string | null
    isGlobalLead: boolean
    allowGlobalProfileAssessment?: boolean
    identityType?: string | null
    senderName?: string | null
    saveAudit?: (params: { action: string; statusCode?: number; error?: string }) => Promise<void>
}) {
    const { supabase, instance, phone, text, messageType, mediaUrl, mediaMimetype, messageId, origin, isGlobalLead, allowGlobalProfileAssessment, identityType, senderName, saveAudit } = params
    if ((!isGlobalLead && !allowGlobalProfileAssessment) || !instance?.instance_token) {
        return { handled: false, action: 'profile_assessment_gate_not_allowed' }
    }

    const currentGate = await loadProfileAssessmentGate(supabase, phone)
    const awaitingProof = currentGate?.status === 'awaiting_vote_proof'
    const normalizedMime = String(mediaMimetype || '').toLowerCase()
    const isImage = messageType === 'image' || normalizedMime.startsWith('image/')
    const isVideo = messageType === 'video' || normalizedMime.startsWith('video/')
    const isDocument = messageType === 'document'
        || normalizedMime.startsWith('application/')
        || normalizedMime.startsWith('text/')
    const proofMediaKind: VoteProofMediaKind | null = isImage
        ? 'image'
        : isVideo
            ? 'video'
            : isDocument
                ? 'document'
                : null
    const replyChannel = messageType === 'audio' || normalizedMime.startsWith('audio/')
        ? 'audio'
        : 'text'
    const baseConfigs = await loadAIConfigs(supabase, instance.id).catch(() => ({} as Record<string, string>))
    const deliveryConfigs = await loadProfileAssessmentDeliveryConfigs(supabase, instance, baseConfigs)
    const isAwaitingProofFollowUp = awaitingProof && isProfileAssessmentAwaitingProofFollowUp(text)

    if (awaitingProof && proofMediaKind) {
        await clearProfileAssessmentPendingQueue(supabase, phone)

        if (!mediaUrl && !messageId) {
            await sendWhatsAppMessage({
                phone,
                instanceToken: instance.instance_token,
                message: 'Recebi o arquivo, mas ele ainda não ficou disponível para leitura. Pode reenviar o comprovante da tela final do seu voto em mim? Pode ser print, vídeo curto ou PDF legível.',
            })
            await saveAudit?.({ action: 'profile_assessment_vote_proof_missing_media_url' })
            return { handled: true, action: 'profile_assessment_vote_proof_missing_media_url' }
        }

        try {
            const proofMedia = await fetchVoteProofMedia({
                kind: proofMediaKind,
                supabase,
                instanceToken: instance.instance_token,
                mediaUrl,
                mimeHint: mediaMimetype,
                messageId,
            })
            const analysis = await analyzeVoteProofMedia(proofMedia.buffer, proofMedia.mimeType, proofMediaKind)
            const approved = analysis.status === 'approved'
            const toolUrl = profileAssessmentToolUrl(origin, phone)

            await saveProfileAssessmentGate(supabase, phone, {
                ...(currentGate || {}),
                status: approved ? 'approved' : 'awaiting_vote_proof',
                analyzed_at: new Date().toISOString(),
                last_analysis_status: analysis.status,
                analysis,
                media_url: mediaUrl,
                message_id: messageId || null,
                media_kind: proofMediaKind,
                tool_url: approved ? toolUrl : null,
            })

            if (approved) {
                await sendProfileAssessmentToolReleased({
                    phone,
                    instanceToken: instance.instance_token,
                    toolUrl,
                })
                await saveAudit?.({ action: 'profile_assessment_tool_released' })
                return { handled: true, action: 'profile_assessment_tool_released' }
            }

            await sendWhatsAppMessage({
                phone,
                instanceToken: instance.instance_token,
                message: [
                    'Ainda não consegui validar esse comprovante como voto concluído em mim.',
                    analysis.reason,
                    '',
                    'Me envie a tela final de confirmação do voto, aparecendo meu nome, Guilherme Pilger, e a categoria Influenciador do Ano. Pode ser print, vídeo curto ou PDF legível.',
                ].filter(Boolean).join('\n'),
            })
            await saveAudit?.({ action: `profile_assessment_vote_proof_${analysis.status}` })
            return { handled: true, action: `profile_assessment_vote_proof_${analysis.status}` }
        } catch (error: any) {
            await sendWhatsAppMessage({
                phone,
                instanceToken: instance.instance_token,
                message: 'Não consegui analisar esse comprovante agora. Pode reenviar a confirmação final do seu voto em mim? Pode ser print, vídeo curto ou PDF legível.',
            })
            await saveAudit?.({ action: 'profile_assessment_vote_proof_error', error: error?.message || String(error) })
            return { handled: true, action: 'profile_assessment_vote_proof_error' }
        }
    }

    if (awaitingProof && text.trim()) {
        if (!isAwaitingProofFollowUp) {
            await saveAudit?.({ action: 'profile_assessment_awaiting_proof_normal_conversation' })
            return { handled: false, action: 'profile_assessment_awaiting_proof_normal_conversation' }
        }

        await clearProfileAssessmentPendingQueue(supabase, phone)

        if (recentlySentProfileAssessmentReminder(currentGate)) {
            await saveAudit?.({ action: 'profile_assessment_waiting_vote_proof_recently_reminded' })
            return { handled: true, action: 'profile_assessment_waiting_vote_proof_recently_reminded' }
        }

        await saveProfileAssessmentGate(supabase, phone, {
            ...(currentGate || {}),
            status: 'awaiting_vote_proof',
            last_reminder_at: new Date().toISOString(),
            last_reminder_channel: replyChannel,
        })
        await sendProfileAssessmentReminder({
            phone,
            instanceToken: instance.instance_token,
            channel: replyChannel,
            userText: text,
            name: senderName,
            identityType: identityType || (isGlobalLead ? 'lead' : 'unknown'),
            configs: deliveryConfigs,
        })
        await saveAudit?.({ action: 'profile_assessment_waiting_vote_proof_reminder' })
        return { handled: true, action: 'profile_assessment_waiting_vote_proof_reminder' }
    }

    const intent = await detectProfileAssessmentToolIntent({ text, configs: baseConfigs })
    if (!intent.matched) {
        await saveAudit?.({
            action: intent.method === 'error'
                ? 'profile_assessment_intent_detection_error'
                : 'no_profile_assessment_intent',
            error: intent.method === 'error' ? intent.reason : undefined,
        })
        return { handled: false, action: 'no_profile_assessment_intent' }
    }

    await clearProfileAssessmentPendingQueue(supabase, phone)

    await saveProfileAssessmentGate(supabase, phone, {
        status: 'awaiting_vote_proof',
        requested_at: new Date().toISOString(),
        vote_url: PROFILE_ASSESSMENT_VOTE_URL,
        intent,
        identity_type: identityType || (isGlobalLead ? 'lead' : 'unknown'),
    })

    await sendProfileAssessmentVoteRequest({
        phone,
        instanceToken: instance.instance_token,
        channel: replyChannel,
        userText: text,
        name: senderName,
        identityType: identityType || (isGlobalLead ? 'lead' : 'unknown'),
        configs: deliveryConfigs,
    })
    await saveAudit?.({ action: 'profile_assessment_vote_requested' })
    return { handled: true, action: 'profile_assessment_vote_requested' }
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

const MAX_WEBHOOK_BODY_SIZE = 1024 * 1024
const MAX_AUDIT_STRING_SIZE = 2000
const MAX_AUDIT_ARRAY_ITEMS = 20
const MAX_AUDIT_OBJECT_KEYS = 60
const BOT_LOOP_PAUSE_DEFAULT_MINUTES = 60
const BOT_LOOP_WINDOW_MS = 30 * 60 * 1000

function compactAuditPayload(value: any, depth = 0): any {
    if (value == null) return value
    if (typeof value === 'string') {
        if (value.length <= MAX_AUDIT_STRING_SIZE) return value
        return `${value.slice(0, MAX_AUDIT_STRING_SIZE)}...[truncated ${value.length} chars]`
    }
    if (typeof value !== 'object') return value
    if (depth >= 4) return '[truncated depth]'
    if (Array.isArray(value)) {
        return value.slice(0, MAX_AUDIT_ARRAY_ITEMS).map((item) => compactAuditPayload(item, depth + 1))
    }

    const output: Record<string, any> = {}
    for (const key of Object.keys(value).slice(0, MAX_AUDIT_OBJECT_KEYS)) {
        output[key] = compactAuditPayload(value[key], depth + 1)
    }
    return output
}

function isConfigEnabled(value: unknown, defaultEnabled = true): boolean {
    if (value === undefined || value === null) return defaultEnabled
    return value !== false && value !== 'false' && value !== '0'
}

function normalizeLoopText(value: unknown): string {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/https?:\/\/\S+/g, ' link ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function pickTextFromMessageNode(node: any): string {
    if (!node || typeof node !== 'object') return ''
    const candidates = [
        node.conversation,
        node.text,
        node.caption,
        node.extendedTextMessage?.text,
        node.imageMessage?.caption,
        node.videoMessage?.caption,
        node.documentMessage?.caption,
        node.message?.conversation,
        node.message?.extendedTextMessage?.text,
        node.message?.imageMessage?.caption,
        node.message?.videoMessage?.caption,
        node.message?.documentMessage?.caption,
    ]
    for (const candidate of candidates) {
        const text = String(candidate || '').trim()
        if (text) return text.slice(0, 500)
    }
    return ''
}

function extractQuotedReplyText(messageData: any): string {
    const contextInfo = messageData?.message?.extendedTextMessage?.contextInfo
        || messageData?.extendedTextMessage?.contextInfo
        || messageData?.contextInfo
        || messageData?.message?.contextInfo
        || null
    const quoted = contextInfo?.quotedMessage
        || messageData?.quotedMessage
        || messageData?.quoted
        || messageData?.reply_to
        || messageData?.replyTo
        || null
    return pickTextFromMessageNode(quoted)
}

function parseMessageTimestamp(value: unknown): number {
    const time = new Date(String(value || '')).getTime()
    return Number.isFinite(time) ? time : 0
}

function analyzeBotLoopRisk(messages: any[], nowMs = Date.now()): { detected: boolean; reason: string } {
    const recent = (Array.isArray(messages) ? messages : [])
        .map((message) => ({
            role: String(message?.role || ''),
            content: String(message?.content || ''),
            normalized: normalizeLoopText(message?.content),
            timestampMs: parseMessageTimestamp(message?.timestamp),
        }))
        .filter((message) => message.timestampMs > 0 && nowMs - message.timestampMs <= BOT_LOOP_WINDOW_MS)
        .slice(-30)

    const userMessages = recent.filter((message) => message.role === 'user' && message.normalized)
    const assistantMessages = recent.filter((message) => message.role === 'assistant' && message.normalized)
    if (userMessages.length < 3 || assistantMessages.length < 2) {
        return { detected: false, reason: '' }
    }

    const frequency = new Map<string, number>()
    for (const message of userMessages) {
        if (message.normalized.length < 2) continue
        frequency.set(message.normalized, (frequency.get(message.normalized) || 0) + 1)
    }
    const repeatedUserText = Math.max(0, ...Array.from(frequency.values()))

    const automatedPatterns = [
        /\bsou (um |uma )?(assistente|atendente|chatbot|bot|agente virtual)\b/,
        /\batendimento automatico\b/,
        /\bmensagem automatica\b/,
        /\bnao entendi\b/,
        /\bescolha uma opcao\b/,
        /\bdigite\s+\d+\b/,
        /\bmenu principal\b/,
        /\bcomo posso ajudar\b/,
        /\bestou aqui para ajudar\b/,
    ]
    const automatedPhraseHits = userMessages
        .slice(-8)
        .filter((message) => automatedPatterns.some((pattern) => pattern.test(message.normalized)))
        .length

    const last90sUserMessages = userMessages.filter((message) => nowMs - message.timestampMs <= 90 * 1000).length

    let rapidAssistantToUserReplies = 0
    let alternations = 0
    for (let index = 1; index < recent.length; index++) {
        const previous = recent[index - 1]
        const current = recent[index]
        if (previous.role && current.role && previous.role !== current.role) alternations++
        if (previous.role === 'assistant' && current.role === 'user') {
            const gapMs = current.timestampMs - previous.timestampMs
            if (gapMs >= 0 && gapMs <= 7000) rapidAssistantToUserReplies++
        }
    }

    if (last90sUserMessages >= 8) {
        return { detected: true, reason: 'muitas_mensagens_em_90s' }
    }
    if (repeatedUserText >= 4) {
        return { detected: true, reason: 'texto_repetido_pelo_contato' }
    }
    if (automatedPhraseHits >= 2) {
        return { detected: true, reason: 'frases_de_atendimento_automatico' }
    }
    if (
        rapidAssistantToUserReplies >= 3 &&
        alternations >= 6 &&
        (automatedPhraseHits >= 1 || repeatedUserText >= 2 || recent.length >= 14)
    ) {
        return { detected: true, reason: 'ping_pong_automatico_rapido' }
    }
    if (assistantMessages.length >= 10 && userMessages.length >= 10 && rapidAssistantToUserReplies >= 2) {
        return { detected: true, reason: 'muitas_rodadas_automaticas' }
    }

    return { detected: false, reason: '' }
}

function mergeWhatsappMetadata(current: unknown, patch: Record<string, unknown>) {
    const base = current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, any> : {}
    const whatsapp = base.whatsapp && typeof base.whatsapp === 'object' && !Array.isArray(base.whatsapp)
        ? base.whatsapp as Record<string, any>
        : {}

    return {
        ...base,
        whatsapp: {
            ...whatsapp,
            ...patch,
        },
    }
}

function normalizePresencePhone(value: unknown): string {
    return String(value || '').replace(/@.+$/, '').replace(/\D/g, '')
}

function extractPresencePayload(body: any, messageData: any) {
    const source = messageData && typeof messageData === 'object' ? messageData : {}
    const rawJid = source.id
        || source.jid
        || source.chatid
        || source.chatId
        || source.from
        || source.remoteJid
        || source.participant
        || source.sender
        || body?.jid
        || body?.chatid
        || body?.from
        || body?.phone
        || ''
    const phone = normalizePresencePhone(source.phone || rawJid)
    const presence = String(
        source.presence
        || source.status
        || source.type
        || source.lastKnownPresence
        || body?.presence
        || body?.status
        || ''
    ).toLowerCase()
    const lastSeenRaw = source.lastSeen || source.last_seen || source.lastSeenAt || source.last_seen_at || null
    const lastSeenAt = lastSeenRaw && !Number.isNaN(new Date(String(lastSeenRaw)).getTime())
        ? new Date(String(lastSeenRaw)).toISOString()
        : null
    const onlineValues = new Set(['available', 'online', 'composing', 'recording'])
    const offlineValues = new Set(['unavailable', 'offline', 'paused'])
    const isOnline = onlineValues.has(presence)
        ? true
        : offlineValues.has(presence)
            ? false
            : Boolean(source.isOnline ?? source.online ?? false)

    return {
        phone,
        jid: String(rawJid || ''),
        presence: presence || (isOnline ? 'online' : 'unknown'),
        isOnline,
        lastSeenAt,
    }
}

async function savePresenceEvent(params: {
    supabase: ReturnType<typeof getSupabase>
    instanceName: string
    body: any
    messageData: any
}) {
    const { supabase, instanceName, body, messageData } = params
    const presence = extractPresencePayload(body, messageData)
    if (!presence.phone) return { tracked: false, reason: 'missing_phone' }

    let instance: any = null
    if (instanceName) {
        const { data } = await supabase
            .from('whatsapp_instances')
            .select('id, broker_id')
            .eq('instance_name', instanceName)
            .maybeSingle()
        instance = data
    }

    const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .or(`phone.eq.${presence.phone},phone_e164.eq.${presence.phone}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    const now = new Date().toISOString()
    const row = {
        instance_id: instance?.id || null,
        broker_id: instance?.broker_id || null,
        lead_id: lead?.id || null,
        phone: presence.phone,
        jid: presence.jid || null,
        presence: presence.presence,
        is_online: presence.isOnline,
        last_online_at: presence.isOnline ? now : undefined,
        last_seen_at: presence.lastSeenAt || (!presence.isOnline ? now : undefined),
        last_event_at: now,
        raw_payload: compactAuditPayload(body),
        updated_at: now,
    }

    if (instance?.id) {
        const { data: existing } = await supabase
            .from('whatsapp_contact_presence')
            .select('id, last_online_at')
            .eq('instance_id', instance.id)
            .eq('phone', presence.phone)
            .maybeSingle()

        if (existing?.id) {
            await supabase
                .from('whatsapp_contact_presence')
                .update({
                    ...row,
                    last_online_at: presence.isOnline ? now : existing.last_online_at,
                })
                .eq('id', existing.id)
        } else {
            await supabase
                .from('whatsapp_contact_presence')
                .insert({
                    ...row,
                    created_at: now,
                })
        }
    } else {
        await supabase
            .from('whatsapp_contact_presence')
            .insert({
                ...row,
                created_at: now,
            })
    }

    return { tracked: true, phone: presence.phone, presence: presence.presence, isOnline: presence.isOnline }
}

async function enforceBotLoopProtection(params: {
    supabase: ReturnType<typeof getSupabase>
    leadId?: string | null
    instance: any
    phone: string
}): Promise<{ blocked: boolean; reason: string }> {
    const { supabase, leadId, instance, phone } = params
    if (!leadId) return { blocked: false, reason: '' }

    const config = instance?.config || {}
    if (!isConfigEnabled(config.bot_loop_protection_enabled, true)) {
        return { blocked: false, reason: '' }
    }

    const { data: lead } = await supabase
        .from('leads')
        .select('id, metadata, conversation_log')
        .eq('id', leadId)
        .maybeSingle()

    const now = Date.now()
    const botLoop = (lead?.metadata as any)?.whatsapp?.bot_loop
    const pausedUntilMs = parseMessageTimestamp(botLoop?.paused_until)
    if (pausedUntilMs > now) {
        return { blocked: true, reason: 'bot_loop_pause_active' }
    }

    const analysis = analyzeBotLoopRisk(lead?.conversation_log || [], now)
    if (!analysis.detected) return { blocked: false, reason: '' }

    const rawPauseMinutes = Number(config.bot_loop_pause_minutes || config.human_intervention_minutes || BOT_LOOP_PAUSE_DEFAULT_MINUTES)
    const pauseMinutes = Math.min(1440, Math.max(5, Number.isFinite(rawPauseMinutes) ? Math.floor(rawPauseMinutes) : BOT_LOOP_PAUSE_DEFAULT_MINUTES))
    const detectedAt = new Date(now).toISOString()
    const pausedUntil = new Date(now + pauseMinutes * 60 * 1000).toISOString()

    await supabase
        .from('leads')
        .update({
            metadata: mergeWhatsappMetadata(lead?.metadata, {
                bot_loop: {
                    detected_at: detectedAt,
                    paused_until: pausedUntil,
                    reason: analysis.reason,
                    instance_id: instance?.id || null,
                    instance_name: instance?.instance_name || null,
                },
            }),
            updated_at: detectedAt,
        })
        .eq('id', leadId)

    if (instance?.broker_id) {
        await supabase
            .from('whatsapp_ai_conversations')
            .update({
                status: 'human_takeover',
                human_takeover_at: detectedAt,
                updated_at: detectedAt,
            })
            .eq('broker_id', instance.broker_id)
            .eq('lead_phone', phone)
            .in('status', ['active', 'transferred'])
    }

    return { blocked: true, reason: analysis.reason }
}

function normalizePhoneDigits(value: any): string {
    return String(value || '').replace(/\D/g, '')
}

function normalizeOutboundBrazilPhone(value: any): string {
    let digits = normalizePhoneDigits(value)
    if (!digits) return ''
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        digits = `55${digits}`
    }
    return digits
}

function phonesLookSame(a: any, b: any): boolean {
    const left = normalizePhoneDigits(a)
    const right = normalizePhoneDigits(b)
    if (!left || !right) return false
    return left === right || left.slice(-8) === right.slice(-8)
}

function formatAppointmentDatePt(dateKey: string): string {
    const date = new Date(`${dateKey}T12:00:00-03:00`)
    return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

async function notifyHumanAboutPendingAppointment(params: {
    supabase: ReturnType<typeof getSupabase>
    instance: any
    broker: any
    leadPhone: string
    senderName?: string | null
    appointment: { date: string; time: string }
}) {
    const { supabase, instance, broker, leadPhone, senderName, appointment } = params
    const blockedPhones = [leadPhone, instance?.phone_number, instance?.live_data?.phone, broker?.phone]
    const candidates: Array<{ phone?: string | null; label: string }> = [
        { phone: broker?.transfer_to_phone, label: 'broker_transfer_to_phone' },
        { phone: broker?.summary_to_phone, label: 'broker_summary_to_phone' },
    ]

    const adminIds = Array.from(new Set([
        instance?.admin_user_id,
        broker?.admin_user_id,
    ].filter((id: any) => id && String(id) !== '00000000-0000-0000-0000-000000000000')))

    if (adminIds.length > 0) {
        const { data: admins } = await supabase
            .from('admin_users')
            .select('id, phone')
            .in('id', adminIds as string[])
        for (const admin of admins || []) {
            candidates.push({ phone: admin?.phone, label: `admin_user:${admin?.id}` })
        }
    }

    const target = candidates
        .map(candidate => ({
            ...candidate,
            phone: normalizeOutboundBrazilPhone(candidate.phone),
        }))
        .find(candidate =>
            candidate.phone
            && !blockedPhones.some(blocked => phonesLookSame(candidate.phone, blocked))
        )

    if (!target?.phone) {
        console.warn('[Appointment] Pending appointment created without human notification target', {
            broker_id: broker?.id,
            instance_id: instance?.id,
        })
        return { sent: false, reason: 'no_human_target' as const }
    }

    const dateLabel = formatAppointmentDatePt(appointment.date)
    const leadLabel = senderName ? `${senderName} (${leadPhone})` : leadPhone
    const message = [
        'Pedido de visita para confirmar',
        '',
        `Lead: ${leadLabel}`,
        `Agente IA: ${broker?.name || instance?.instance_name || 'Agente IA'}`,
        `Data: ${dateLabel}`,
        `Horario: ${appointment.time}`,
        '',
        'Confirme no painel da agenda se esse horario esta disponivel. O lead ja foi avisado que estamos verificando.'
    ].join('\n')

    const systemInstanceToken = await resolveSystemNotificationWhatsappInstance(supabase)
    if (!systemInstanceToken) {
        console.warn('[Appointment] Pending appointment notification skipped: global agent instance unavailable')
        return { sent: false, reason: 'global_instance_unavailable' as const }
    }

    const result = await sendWhatsAppMessage({
        phone: target.phone,
        message,
        instanceToken: systemInstanceToken,
    })

    return {
        sent: true,
        reason: target.label,
        targetPhone: target.phone,
        result,
    }
}

function normalizeAssistantText(text: string): string {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function isAssistantConfirmationText(text: string): boolean {
    return /\b(sim|confirmo|confirma|confirmar|concierge_confirm|agenda_confirm|pode|pode marcar|pode criar|isso|isso mesmo|ok|fechado|perfeito|confirmado)\b/.test(normalizeAssistantText(text))
}

function isAssistantCancelText(text: string): boolean {
    return /\b(nao|não|cancela|cancelar|concierge_cancel|agenda_cancel|deixa|esquece|volta|errado)\b/.test(normalizeAssistantText(text))
}

function parseAssistantAgendaCommand(text: string) {
    const normalized = normalizeAssistantText(text)
    const looksLikeAgenda =
        /(agenda|agendar|marca|marque|marcar|coloca|coloque|reuniao|visita|compromisso|bloqueia|bloquear)/.test(normalized)
    if (!looksLikeAgenda) return null

    const date = resolveRelativeAppointmentDate(text, getSaoPauloDate())
    const time = extractAppointmentTimeFromText(text)
    if (!date || !time) {
        return { incomplete: true as const, date, time }
    }

    const leadMatch = text.match(/\b(?:lead|cliente)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,40}?)(?=\s+(?:hoje|amanh[aã]|depois|dia|\d|as|às|na|no|para|por|$))/i)
        || text.match(/\bcom\s+(?:o\s+lead\s+|a\s+lead\s+|cliente\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,40}?)(?=\s+(?:hoje|amanh[aã]|depois|dia|\d|as|às|na|no|para|por|$))/i)

    const leadName = leadMatch?.[1]?.trim().replace(/\s+/g, ' ') || null
    const type = normalized.includes('visita') ? 'visita' : normalized.includes('bloque') ? 'bloqueio' : 'reuniao'
    const title = leadName
        ? `${type === 'visita' ? 'Visita' : type === 'bloqueio' ? 'Bloqueio' : 'Reuniao'} com ${leadName}`
        : type === 'bloqueio'
            ? 'Bloqueio de agenda'
            : type === 'visita'
                ? 'Visita'
                : 'Reuniao'

    return {
        incomplete: false as const,
        date,
        time,
        leadName,
        type,
        title,
        requestedText: text,
    }
}

async function findAssistantAuthorization(params: {
    supabase: ReturnType<typeof getSupabase>
    brokerId: string
    phone: string
}) {
    const { supabase, brokerId, phone } = params
    const normalized = normalizeOutboundBrazilPhone(phone)
    const raw = normalizePhoneDigits(phone)
    const withoutBrazil = normalized.startsWith('55') ? normalized.slice(2) : ''
    const candidates = Array.from(new Set([normalized, raw, withoutBrazil].filter(Boolean)))
    if (!candidates.length) return null

    try {
        const { data, error } = await supabase
            .from('broker_assistant_authorized_phones')
            .select('*')
            .eq('broker_id', brokerId)
            .eq('is_active', true)
            .in('phone', candidates)
            .limit(1)

        if (error) {
            console.warn('[Broker Assistant] Authorization lookup skipped:', error.message)
            return null
        }
        return data?.[0] || null
    } catch (error) {
        console.warn('[Broker Assistant] Authorization lookup failed:', error)
        return null
    }
}

function isBrokerConciergeEnabled(broker: any): boolean {
    if (!broker) return false
    if (!Object.prototype.hasOwnProperty.call(broker, 'concierge_enabled')) return true
    return isConfigEnabled(broker?.concierge_enabled, false)
}

function brokerConciergeRequiresConfirmation(broker: any): boolean {
    return isConfigEnabled(broker?.concierge_require_confirmation, true)
}

function assistantHasPermission(authorization: any, permission: string, defaultEnabled = false): boolean {
    return isConfigEnabled(authorization?.[permission], defaultEnabled)
}

function buildConciergeCapabilities(authorization: any): string[] {
    const capabilities = [
        assistantHasPermission(authorization, 'can_manage_agenda', true) ? 'agenda' : '',
        assistantHasPermission(authorization, 'can_view_properties', true) ? 'imoveis' : '',
        assistantHasPermission(authorization, 'can_manage_leads') ? 'leads' : '',
        assistantHasPermission(authorization, 'can_update_crm') ? 'CRM' : '',
        assistantHasPermission(authorization, 'can_send_messages') ? 'mensagens' : '',
        assistantHasPermission(authorization, 'can_view_reports') ? 'relatorios' : '',
        assistantHasPermission(authorization, 'can_manage_finance') ? 'financeiro' : '',
    ].filter(Boolean)

    return capabilities
}

function buildConciergeFallbackReply(params: {
    broker: any
    authorization: any
    conciergeEnabled: boolean
}) {
    const { broker, authorization, conciergeEnabled } = params
    const brokerName = broker?.name || broker?.broker_name || broker?.display_name || 'este agente'

    if (!conciergeEnabled) {
        return 'Recebi sua mensagem como telefone autorizado do dono, mas o Concierge deste agente esta desligado no painel. Ligue o Concierge do dono para eu executar comandos internos.'
    }

    const capabilities = buildConciergeCapabilities(authorization)
    if (!capabilities.length) {
        return `Estou no modo concierge do ${brokerName}, mas este telefone ainda nao tem permissoes operacionais liberadas.`
    }

    const examples = assistantHasPermission(authorization, 'can_manage_agenda', true)
        ? '\n\nPara agenda, me envie algo como: "marca reuniao com o lead Joao amanha as 15h".'
        : ''

    return `Estou no modo concierge do ${brokerName}. Posso ajudar com: ${capabilities.join(', ')}.${examples}`
}

type ConciergeButtonTagConfig = {
    tag: string
    aliases?: string[]
    type: 'button' | 'list'
    choices: string[]
    listButton?: string
    fallbackTitle: string
}

const CONCIERGE_BUTTON_TAGS: ConciergeButtonTagConfig[] = [
    {
        tag: '{pf_pj}',
        aliases: ['{botao_pf_pj}'],
        type: 'button',
        fallbackTitle: 'Escolha o tipo do lancamento:',
        choices: ['Pessoa fisica|finance_party_pf', 'Pessoa juridica|finance_party_pj'],
    },
    {
        tag: '{confirmar}',
        aliases: ['{botao_confirmar_cancelar}'],
        type: 'button',
        fallbackTitle: 'Confirme a acao:',
        choices: ['Sim, confirmar|concierge_confirm', 'Cancelar|concierge_cancel'],
    },
    {
        tag: '{corrigir}',
        aliases: ['{botao_corrigir_lancamento}'],
        type: 'list',
        listButton: 'Corrigir',
        fallbackTitle: 'O que voce quer corrigir?',
        choices: [
            '[Lancamento]',
            'Corrigir valor|finance_fix_amount|Alterar o valor antes de gravar',
            'Corrigir data|finance_fix_date|Alterar a data do lancamento',
            'Corrigir categoria|finance_fix_category|Escolher outra categoria',
            'Corrigir pagamento|finance_fix_payment|Alterar a forma de pagamento',
        ],
    },
    {
        tag: '{categoria}',
        aliases: ['{botao_categoria_despesa}'],
        type: 'list',
        listButton: 'Categorias',
        fallbackTitle: 'Escolha a categoria da despesa:',
        choices: [
            '[Despesa]',
            'Combustivel|finance_category_fuel|Abastecimento, gasolina, etanol ou diesel',
            'Alimentacao|finance_category_food|Cafe, almoco, jantar ou reuniao',
            'Marketing|finance_category_marketing|Trafego pago, criativos ou divulgacao',
            'Documentacao|finance_category_docs|Cartorio, taxas e documentos',
            'Manutencao|finance_category_maintenance|Servicos, reparos e manutencao',
            'Outros|finance_category_other|Outra despesa operacional',
        ],
    },
    {
        tag: '{pagamento}',
        aliases: ['{botao_forma_pagamento}'],
        type: 'list',
        listButton: 'Pagamento',
        fallbackTitle: 'Escolha a forma de pagamento:',
        choices: [
            '[Pagamento]',
            'Pix|finance_payment_pix|Pagamento por Pix',
            'Cartao|finance_payment_card|Credito ou debito',
            'Dinheiro|finance_payment_cash|Pagamento em dinheiro',
            'Boleto|finance_payment_boleto|Pagamento por boleto',
        ],
    },
    {
        tag: '{agenda}',
        aliases: ['{botao_agenda_confirmar}'],
        type: 'button',
        fallbackTitle: 'Confirme a agenda:',
        choices: ['Sim, confirmar|agenda_confirm', 'Reagendar|agenda_reschedule', 'Cancelar|agenda_cancel'],
    },
    {
        tag: '{resumo}',
        aliases: ['{botao_resumo_dia}'],
        type: 'button',
        fallbackTitle: 'Qual resumo voce quer ver?',
        choices: ['Resumo financeiro|summary_finance', 'Resumo agenda|summary_agenda', 'Resumo leads|summary_leads'],
    },
    {
        tag: '{imoveis}',
        aliases: ['{botao_imoveis}'],
        type: 'button',
        fallbackTitle: 'O que voce quer consultar?',
        choices: ['Estoque ativo|properties_stock', 'Mais visitados|properties_top', 'Oportunidades|properties_opportunities'],
    },
    {
        tag: '{relatorio}',
        aliases: ['{botao_relatorio_atendimentos}'],
        type: 'button',
        fallbackTitle: 'Periodo do relatorio:',
        choices: ['Hoje|report_today', 'Semana|report_week', 'Mes|report_month'],
    },
]

function parseConciergeButtonTags(reply: string): { cleanText: string; menu?: ConciergeButtonTagConfig } {
    let cleanText = String(reply || '')
    const found = CONCIERGE_BUTTON_TAGS.find(config => [config.tag, ...(config.aliases || [])].some(tag => cleanText.includes(tag)))
    for (const config of CONCIERGE_BUTTON_TAGS) {
        for (const tag of [config.tag, ...(config.aliases || [])]) {
            cleanText = cleanText.split(tag).join('')
        }
        cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim()
    }
    return { cleanText, menu: found }
}

function buildConciergeButtonFallback(text: string, menu: ConciergeButtonTagConfig): string {
    const options = menu.choices
        .filter(choice => !choice.startsWith('['))
        .map(choice => {
            const [label] = choice.split('|')
            return `- ${label}`
        })
        .join('\n')
    return [text || menu.fallbackTitle, options].filter(Boolean).join('\n\n')
}

function detectConciergeIntent(text: string): string {
    const normalized = normalizeAssistantText(text)
    if (/(comprovante|nota fiscal|recibo|abastec|combustivel|gasolina|etanol|diesel|pix|pagamento|despesa|lancamento|financeiro)/.test(normalized)) {
        return 'financeiro'
    }
    if (/(agenda|agendar|reuniao|visita|compromisso|calendario|horario)/.test(normalized)) {
        return 'agenda'
    }
    if (/(lead|cliente|atendimento|follow|funil|crm)/.test(normalized)) {
        return 'crm'
    }
    if (/(imovel|imoveis|casa|apartamento|terreno|estoque|catalogo|codigo)/.test(normalized)) {
        return 'imoveis'
    }
    if (/(relatorio|resumo|performance|resultado|quantos|metricas)/.test(normalized)) {
        return 'relatorios'
    }
    if (/(mensagem|enviar|mande|responda|whatsapp)/.test(normalized)) {
        return 'mensagens'
    }
    return 'geral'
}

function buildConciergeSystemPrompt(params: {
    broker: any
    authorization: any
    senderName?: string | null
    intent: string
    mediaReceived: any[]
}) {
    const { broker, authorization, senderName, intent, mediaReceived } = params
    const brokerName = broker?.name || broker?.broker_name || broker?.display_name || 'agente Pilger'
    const ownerName = senderName || authorization?.name || 'dono autorizado'
    const adminPrompt = String(broker?.concierge_prompt || '').trim()
    const capabilities = buildConciergeCapabilities(authorization)
    const recentMedia = mediaReceived.slice(-3).map((item: any, index: number) => {
        const type = item?.type || 'midia'
        const filename = item?.filename || item?.url || `arquivo ${index + 1}`
        return `- ${type}: ${filename}`
    }).join('\n')

    return [
        `Voce e o concierge privado do ${brokerName} no WhatsApp.`,
        `Voce esta falando com ${ownerName}, que e um telefone autorizado do dono/corretor, nao um lead.`,
        `Intencao provavel da ultima mensagem: ${intent}.`,
        `Permissoes ativas deste telefone: ${capabilities.length ? capabilities.join(', ') : 'nenhuma'}.`,
        '',
        'Regras de seguranca:',
        '- Nunca use o prompt comercial de atendimento de leads para responder o dono.',
        '- Nunca trate o dono como lead, nunca colete interesse imobiliario como se ele fosse cliente.',
        '- Responda em portugues do Brasil, curto, claro e natural para WhatsApp.',
        '- Se faltar dado para uma tarefa, faca uma pergunta objetiva por vez.',
        '- Nao diga que executou uma acao se ela ainda nao foi executada por ferramenta do sistema.',
        '- Nesta fase, a execucao automatica disponivel e agenda e rascunho financeiro confirmado. CRM, relatorios, imoveis e mensagens podem ser entendidos e preparados, mas quando dependerem de ferramenta futura voce deve pedir os dados e deixar claro que vai preparar a acao para confirmacao.',
        '- Para despesas/comprovantes, peca PF ou PJ quando isso ainda nao estiver claro.',
        '- Para agenda, se o sistema pedir confirmacao ou dados, siga a pergunta deterministica que ja foi feita.',
        '',
        'Tags de botoes disponiveis para facilitar a resposta do dono:',
        '- {pf_pj}: quando precisar escolher Pessoa fisica ou Pessoa juridica.',
        '- {confirmar}: quando precisar confirmar ou cancelar uma acao sensivel.',
        '- {corrigir}: quando o dono precisar corrigir valor, data, categoria ou pagamento.',
        '- {categoria}: quando a categoria da despesa nao estiver clara.',
        '- {pagamento}: quando faltar forma de pagamento.',
        '- {agenda}: antes de criar ou alterar compromisso de agenda.',
        '- {resumo}: quando o dono pedir resumo rapido.',
        '- {imoveis}: quando o dono pedir estoque, oportunidades ou imoveis mais relevantes.',
        '- {relatorio}: quando o dono pedir relatorio de leads/atendimentos.',
        '- Use no maximo uma tag de botao por resposta.',
        '',
        adminPrompt ? `Prompt especifico configurado pelo admin:\n${adminPrompt}` : 'Prompt especifico configurado pelo admin: nao informado.',
        recentMedia ? `\nMidias internas recentes recebidas deste dono:\n${recentMedia}` : '',
    ].filter(Boolean).join('\n')
}

function buildConciergeHistory(messages: any[]): { role: string; content: string }[] {
    return (messages || [])
        .slice(-14)
        .map((message: any) => {
            const content = String(message?.content || '').trim()
            if (!content) return null
            const role = message?.role === 'assistant' ? 'assistant' : 'user'
            return { role, content: content.slice(0, 1200) }
        })
        .filter(Boolean) as { role: string; content: string }[]
}

function sanitizeConciergeReply(reply: string): string {
    const text = String(reply || '').trim()
    if (!text) return ''
    return text
        .replace(/\n{3,}/g, '\n\n')
        .slice(0, 1400)
}

function saoPauloDateKey(date = getSaoPauloDate()): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function formatCurrencyBR(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function normalizeReceiptDate(raw: any): string | null {
    const value = String(raw || '').trim()
    if (!value) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

    const br = value.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/)
    if (br) {
        const day = String(br[1]).padStart(2, '0')
        const month = String(br[2]).padStart(2, '0')
        const currentYear = String(getSaoPauloDate().getFullYear())
        const rawYear = br[3] ? String(br[3]) : currentYear
        const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
        if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
            return `${year}-${month}-${day}`
        }
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toISOString().slice(0, 10)
}

function parseMoneyValue(raw: string): number | null {
    const value = String(raw || '').replace(/[^\d,.]/g, '').trim()
    if (!value) return null
    const normalized = value.includes(',')
        ? value.replace(/\./g, '').replace(',', '.')
        : value
    const amount = Number(normalized)
    if (!Number.isFinite(amount) || amount <= 0) return null
    return Math.round(amount * 100) / 100
}

function coerceReceiptAmount(raw: any): number | null {
    if (typeof raw === 'number') {
        return Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) / 100 : null
    }
    return parseMoneyValue(String(raw || ''))
}

function extractJsonObject(text: string): any | null {
    const raw = String(text || '').trim()
    if (!raw) return null
    const withoutFence = raw
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim()
    const jsonSlice = withoutFence.includes('{') && withoutFence.includes('}')
        ? withoutFence.slice(withoutFence.indexOf('{'), withoutFence.lastIndexOf('}') + 1)
        : ''
    const candidates = [withoutFence, jsonSlice]
        .filter(candidate => candidate && candidate.startsWith('{') && candidate.endsWith('}'))

    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate)
        } catch {
            // Try next candidate.
        }
    }
    return null
}

function normalizeFinanceReceiptAnalysis(raw: any, fallbackText = '') {
    if (!raw || typeof raw !== 'object') return null
    const amount = coerceReceiptAmount(raw.amount ?? raw.valor ?? raw.total)
    const paymentMethod = detectFinancePaymentMethod([
        raw.payment_method,
        raw.forma_pagamento,
        raw.raw_summary,
        fallbackText,
    ].filter(Boolean).join(' '))
    const merchant = String(raw.merchant || raw.favorecido || raw.estabelecimento || '').trim() || null
    const rawSummary = String(raw.raw_summary || raw.summary || fallbackText || '').trim()
    const normalized = normalizeAssistantText([merchant, rawSummary, raw.category_hint, raw.subcategory_hint].filter(Boolean).join(' '))
    const isFuel = /(abastec|combustivel|gasolina|etanol|diesel|posto)/.test(normalized)

    return {
        is_receipt: raw.is_receipt !== false,
        amount,
        date: normalizeReceiptDate(raw.date || raw.data || raw.entry_date),
        merchant,
        document_number: String(raw.document_number || raw.numero || '').trim() || null,
        payment_method: paymentMethod,
        category_hint: String(raw.category_hint || '').trim() || (isFuel ? 'Consumo despesas' : null),
        subcategory_hint: String(raw.subcategory_hint || '').trim() || (isFuel ? 'Combustivel' : null),
        description: String(raw.description || raw.descricao || '').trim() || (isFuel ? `Abastecimento${merchant ? ` - ${merchant}` : ''}` : merchant ? `Despesa - ${merchant}` : null),
        confidence: Math.max(0, Math.min(1, Number(raw.confidence || raw.confianca || 0) || 0)),
        raw_summary: rawSummary,
    }
}

function extractFinanceAmountFromText(text: string, allowLoose = false): number | null {
    const value = String(text || '')
    const explicit = value.match(/(?:r\$|valor|total|paguei|pagamento|deu|custou|foi|abasteci|abastecimento)\s*(?:de\s*)?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+(?:[,.][0-9]{1,2})?)/i)
    const decimal = value.match(/\b([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\b/)
    const loose = (allowLoose || /(comprovante|recibo|abastec|combustivel|gasolina|etanol|diesel|despesa|paguei|pagamento)/i.test(normalizeAssistantText(value)))
        ? value.match(/\b([1-9]\d{1,5})\b/)
        : null

    return parseMoneyValue(explicit?.[1] || decimal?.[1] || loose?.[1] || '')
}

function detectFinancePartyType(text: string): 'pessoa_fisica' | 'pessoa_juridica' | null {
    const normalized = normalizeAssistantText(text)
    if (/\b(pf|fisica|pessoa fisica|finance_party_pf)\b/.test(normalized)) return 'pessoa_fisica'
    if (/\b(pj|juridica|pessoa juridica|cnpj|empresa|finance_party_pj)\b/.test(normalized)) return 'pessoa_juridica'
    return null
}

function detectFinancePaymentMethod(text: string): string | null {
    const normalized = normalizeAssistantText(text)
    if (/\b(pix|finance_payment_pix)\b/.test(normalized)) return 'PIX'
    if (/\b(cartao|credito|debito|finance_payment_card)\b/.test(normalized)) return 'Cartao'
    if (/\b(boleto|finance_payment_boleto)\b/.test(normalized)) return 'Boleto'
    if (/\b(dinheiro|especie|finance_payment_cash)\b/.test(normalized)) return 'Dinheiro'
    if (/\b(ted)\b/.test(normalized)) return 'TED'
    if (/\b(doc)\b/.test(normalized)) return 'DOC'
    return null
}

function detectFinanceCategoryPatch(text: string): { category: string; subcategory: string; description?: string } | null {
    const normalized = normalizeAssistantText(text)
    if (/\b(combustivel|abastec|gasolina|etanol|diesel|finance_category_fuel)\b/.test(normalized)) {
        return { category: 'Consumo despesas', subcategory: 'Combustivel', description: 'Abastecimento do carro' }
    }
    if (/\b(alimentacao|restaurante|almoco|jantar|cafe|finance_category_food)\b/.test(normalized)) {
        return { category: 'Consumo despesas', subcategory: 'Alimentacao', description: 'Despesa de alimentacao' }
    }
    if (/\b(marketing|trafego|meta|google|criativo|divulgacao|finance_category_marketing)\b/.test(normalized)) {
        return { category: 'Marketing', subcategory: 'Divulgacao', description: 'Despesa de marketing' }
    }
    if (/\b(documentacao|documento|cartorio|taxa|finance_category_docs)\b/.test(normalized)) {
        return { category: 'Taxas e documentacao', subcategory: 'Documentacao', description: 'Despesa de documentacao' }
    }
    if (/\b(manutencao|reparo|servico|finance_category_maintenance)\b/.test(normalized)) {
        return { category: 'Manutencao', subcategory: 'Servicos', description: 'Despesa de manutencao' }
    }
    if (/\b(outros|finance_category_other)\b/.test(normalized)) {
        return { category: 'Outros', subcategory: 'Outros', description: 'Despesa operacional' }
    }
    return null
}

function detectFinanceCorrectionChoice(text: string): 'amount' | 'date' | 'category' | 'payment' | null {
    const normalized = normalizeAssistantText(text)
    if (/\b(corrigir valor|alterar valor|finance_fix_amount)\b/.test(normalized)) return 'amount'
    if (/\b(corrigir data|alterar data|finance_fix_date)\b/.test(normalized)) return 'date'
    if (/\b(corrigir categoria|alterar categoria|finance_fix_category)\b/.test(normalized)) return 'category'
    if (/\b(corrigir pagamento|forma de pagamento|finance_fix_payment)\b/.test(normalized)) return 'payment'
    return null
}

function parseFinanceDateFromText(text: string): string | null {
    const value = String(text || '')
    const match = value.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/)
    if (!match) return null
    const day = Number(match[1])
    const month = Number(match[2])
    const yearRaw = match[3] ? Number(match[3]) : Number(saoPauloDateKey().slice(0, 4))
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) return null
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isConciergeQuickChoice(text: string): boolean {
    const normalized = normalizeAssistantText(text)
    return /\b(summary_finance|summary_agenda|summary_leads|resumo financeiro|resumo agenda|resumo leads|properties_stock|properties_top|properties_opportunities|estoque ativo|mais visitados|oportunidades|report_today|report_week|report_month)\b/.test(normalized)
}

async function fetchFinanceReceiptBuffer(url: string): Promise<Buffer | null> {
    try {
        if (!/^https?:\/\//i.test(String(url || ''))) return null
        const response = await fetch(url)
        if (!response.ok) {
            console.warn(`[Broker Concierge] Receipt media fetch failed (${response.status}): ${url.substring(0, 120)}`)
            return null
        }
        const buffer = Buffer.from(await response.arrayBuffer())
        return buffer.length > 64 ? buffer : null
    } catch (error) {
        console.warn('[Broker Concierge] Receipt media fetch error:', error)
        return null
    }
}

function canAnalyzeFinanceReceiptMime(mime: string): boolean {
    const value = String(mime || '').toLowerCase()
    return value.startsWith('image/')
        || value.includes('pdf')
        || value.includes('octet-stream')
        || value === 'unknown'
}

async function analyzeFinanceReceiptWithGemini(params: {
    mediaBuffer: Buffer
    mimeType: string
    apiKey: string
    model: string
    fileName?: string | null
}) {
    const { mediaBuffer, mimeType, apiKey, model, fileName } = params
    const prompt = [
        'Analise este comprovante, recibo, cupom fiscal, nota fiscal ou comprovante de pagamento enviado pelo dono no WhatsApp.',
        'Retorne somente JSON valido, sem markdown, no formato:',
        '{"is_receipt":true,"amount":123.45,"date":"YYYY-MM-DD","merchant":"Nome do favorecido","document_number":"numero ou null","payment_method":"PIX|Cartao|Boleto|Dinheiro|TED|DOC|null","category_hint":"categoria sugerida","subcategory_hint":"subcategoria sugerida","description":"descricao curta","confidence":0.0,"raw_summary":"resumo curto"}',
        'Regras:',
        '- amount deve ser numero em reais, usando ponto decimal.',
        '- Se nao encontrar um campo com seguranca, use null.',
        '- Para abastecimento, use category_hint "Consumo despesas" e subcategory_hint "Combustivel".',
        '- Se nao parecer comprovante financeiro, use is_receipt false e explique em raw_summary.',
        `Arquivo: ${fileName || 'sem nome'}.`,
    ].join('\n')

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: mediaBuffer.toString('base64') } },
                    { text: prompt },
                ],
            }],
        }),
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        console.warn(`[Broker Concierge] Gemini receipt analysis failed (${response.status}): ${errorText.substring(0, 500)}`)
        return null
    }

    const data = await response.json()
    await recordGeminiUsage({
        model: model || 'gemini-2.5-flash',
        feature: 'broker_concierge_receipt_analysis',
        usageMetadata: data.usageMetadata,
        metadata: { mimeType },
    })
    const parts = data?.candidates?.[0]?.content?.parts
    const text = Array.isArray(parts) ? parts.map((part: any) => part?.text || '').filter(Boolean).join('\n') : ''
    return normalizeFinanceReceiptAnalysis(extractJsonObject(text), text)
}

async function analyzeFinanceReceiptWithOpenAI(params: {
    mediaBuffer: Buffer
    mimeType: string
    apiKey: string
    model: string
    fileName?: string | null
}) {
    const { mediaBuffer, mimeType, apiKey, model, fileName } = params
    if (!mimeType.toLowerCase().startsWith('image/')) return null

    const dataUrl = `data:${mimeType};base64,${mediaBuffer.toString('base64')}`
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            temperature: 0.1,
            messages: [
                {
                    role: 'system',
                    content: 'Voce extrai dados financeiros de comprovantes. Responda somente JSON valido.',
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: [
                                `Arquivo: ${fileName || 'sem nome'}.`,
                                'Extraia comprovante em JSON: {"is_receipt":true,"amount":123.45,"date":"YYYY-MM-DD","merchant":"Nome","document_number":null,"payment_method":"PIX|Cartao|Boleto|Dinheiro|TED|DOC|null","category_hint":"categoria","subcategory_hint":"subcategoria","description":"descricao curta","confidence":0.0,"raw_summary":"resumo"}',
                                'Se nao encontrar com seguranca, use null. Para abastecimento use categoria Consumo despesas e subcategoria Combustivel.',
                            ].join('\n'),
                        },
                        { type: 'image_url', image_url: { url: dataUrl } },
                    ],
                },
            ],
        }),
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        console.warn(`[Broker Concierge] OpenAI receipt analysis failed (${response.status}): ${errorText.substring(0, 500)}`)
        return null
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content || ''
    return normalizeFinanceReceiptAnalysis(extractJsonObject(text), text)
}

async function analyzeFinanceReceiptMedia(params: {
    supabase: ReturnType<typeof getSupabase>
    instance?: any
    docEntry: any
}) {
    const { supabase, instance, docEntry } = params
    const url = String(docEntry?.url || docEntry?.r2_url || docEntry?.original_url || '').trim()
    const mimeType = String(docEntry?.mimetype || docEntry?.mime || 'application/octet-stream').trim() || 'application/octet-stream'
    if (!url || !canAnalyzeFinanceReceiptMime(mimeType)) return null

    const aiGate = await getAiAutomationGate({
        agentId: 'finance-ops-agent',
        enabledKey: 'finance_ops_agent_enabled',
        supabase,
    })
    if (!aiGate.allowed) return null

    const mediaBuffer = await fetchFinanceReceiptBuffer(url)
    if (!mediaBuffer) return null

    const maxBytes = 12 * 1024 * 1024
    if (mediaBuffer.length > maxBytes) {
        console.warn(`[Broker Concierge] Receipt media too large for analysis: ${mediaBuffer.length}`)
        return null
    }

    const configs = await loadAIConfigs(supabase, instance?.id)
    const provider = configs['ai_provider'] === 'openai' ? 'openai' : 'gemini'
    const geminiKey = configs['gemini_api_key']
    const openaiKey = configs['openai_api_key']
    const geminiModel = configs['gemini_model'] || 'gemini-2.5-flash'
    const openaiModel = configs['openai_model'] || 'gpt-4o-mini'

    let analysis: any = null
    if (provider === 'openai' && openaiKey) {
        analysis = await analyzeFinanceReceiptWithOpenAI({
            mediaBuffer,
            mimeType,
            apiKey: openaiKey,
            model: openaiModel,
            fileName: docEntry?.filename || null,
        })
    }

    if (!analysis && geminiKey) {
        analysis = await analyzeFinanceReceiptWithGemini({
            mediaBuffer,
            mimeType,
            apiKey: geminiKey,
            model: geminiModel,
            fileName: docEntry?.filename || null,
        })
    }

    if (!analysis && openaiKey && provider !== 'openai') {
        analysis = await analyzeFinanceReceiptWithOpenAI({
            mediaBuffer,
            mimeType,
            apiKey: openaiKey,
            model: openaiModel,
            fileName: docEntry?.filename || null,
        })
    }

    return analysis?.is_receipt ? analysis : null
}

function latestAssistantMedia(state: any): any | null {
    const mediaReceived = Array.isArray(state?.media_received) ? state.media_received : []
    return mediaReceived.length ? mediaReceived[mediaReceived.length - 1] : null
}

function isMediaOnlyFinanceCandidate(text: string, state: any): boolean {
    void state
    const normalized = normalizeAssistantText(text)
    return /\[(image|document|midia)/.test(normalized)
}

function buildFinanceDraftFromText(text: string, state: any, previous?: any) {
    const normalized = normalizeAssistantText(text)
    const media = latestAssistantMedia(state)
    const receipt = media?.finance_receipt_analysis || previous?.receipt_analysis || null
    const receiptText = normalizeAssistantText([
        receipt?.merchant,
        receipt?.description,
        receipt?.raw_summary,
        receipt?.category_hint,
        receipt?.subcategory_hint,
    ].filter(Boolean).join(' '))
    const isFuel = /(abastec|combustivel|gasolina|etanol|diesel|posto)/.test(`${normalized} ${receiptText}`)
    const partyType = detectFinancePartyType(text) || previous?.counterparty_type || null
    const amount = extractFinanceAmountFromText(text, previous?.assistant_action === 'create_finance_entry')
        || Number(previous?.amount || 0)
        || Number(receipt?.amount || 0)
        || null
    const paymentMethod = detectFinancePaymentMethod(text) || previous?.payment_method || receipt?.payment_method || null
    const categoryPatch = detectFinanceCategoryPatch(text)
    const typedDate = parseFinanceDateFromText(text)
    const today = saoPauloDateKey()
    const shouldUseReceiptDate = receipt?.date && (!previous?.entry_date || (previous.entry_date === today && !previous?.receipt_analysis))
    const entryDate = typedDate || (shouldUseReceiptDate ? receipt.date : (previous?.entry_date || today))
    const receiptDescription = receipt?.description
        || (receipt?.merchant ? `${isFuel ? 'Abastecimento' : 'Despesa'} - ${receipt.merchant}` : null)
    const previousDescription = String(previous?.description || '').trim()
    const canReplaceDefaultDescription = !previousDescription
        || previousDescription === 'Despesa enviada pelo WhatsApp'
        || previousDescription === 'Abastecimento do carro'
    const previousCounterparty = String(previous?.counterparty_name || '').trim()
    const canReplaceDefaultCounterparty = !previousCounterparty || previousCounterparty === 'Posto de combustivel'

    return {
        ...(previous || {}),
        assistant_action: 'create_finance_entry',
        entry_type: 'expense',
        amount,
        counterparty_type: partyType,
        payment_method: paymentMethod,
        payment_status: previous?.payment_status || 'paid',
        entry_date: entryDate,
        due_date: (typedDate || shouldUseReceiptDate) ? entryDate : (previous?.due_date || entryDate),
        competence_date: (typedDate || shouldUseReceiptDate) ? entryDate : (previous?.competence_date || entryDate),
        category: categoryPatch?.category || previous?.category || receipt?.category_hint || 'Consumo despesas',
        subcategory: categoryPatch?.subcategory || previous?.subcategory || receipt?.subcategory_hint || (isFuel ? 'Combustivel' : 'Comprovante recebido'),
        description: canReplaceDefaultDescription
            ? (categoryPatch?.description || receiptDescription || (isFuel ? 'Abastecimento do carro' : 'Despesa enviada pelo WhatsApp'))
            : previousDescription,
        counterparty_name: canReplaceDefaultCounterparty ? (receipt?.merchant || (isFuel ? 'Posto de combustivel' : null)) : previousCounterparty,
        reference_company: partyType === 'pessoa_fisica'
            ? 'Pessoa fisica'
            : partyType === 'pessoa_juridica'
                ? 'Pessoa juridica'
                : previous?.reference_company || null,
        attachment_url: previous?.attachment_url || media?.url || media?.r2_url || null,
        source_text: previous?.source_text || text,
        media_filename: previous?.media_filename || media?.filename || null,
        receipt_analysis: receipt || previous?.receipt_analysis || null,
    }
}

function getFinanceDraftMissingField(draft: any): 'counterparty_type' | 'amount' | null {
    if (!draft?.counterparty_type) return 'counterparty_type'
    if (!Number.isFinite(Number(draft?.amount)) || Number(draft?.amount) <= 0) return 'amount'
    return null
}

function financeDraftSummary(draft: any): string {
    const party = draft?.counterparty_type === 'pessoa_fisica' ? 'Pessoa fisica' : 'Pessoa juridica'
    return [
        `Descricao: ${draft?.description || 'Despesa'}`,
        `Valor: ${formatCurrencyBR(Number(draft?.amount || 0))}`,
        `Tipo: ${party}`,
        draft?.counterparty_name ? `Favorecido: ${draft.counterparty_name}` : '',
        `Categoria: ${draft?.category || '-'}`,
        `Subcategoria: ${draft?.subcategory || '-'}`,
        `Data: ${draft?.entry_date || saoPauloDateKey()}`,
        draft?.payment_method ? `Pagamento: ${draft.payment_method}` : '',
        draft?.attachment_url ? 'Anexo: comprovante recebido' : '',
        draft?.receipt_analysis?.confidence ? `Leitura IA: ${Math.round(Number(draft.receipt_analysis.confidence) * 100)}%` : '',
    ].filter(Boolean).join('\n')
}

async function financeColumnExists(supabase: ReturnType<typeof getSupabase>, columnName: string): Promise<boolean> {
    try {
        const { error } = await supabase.from('finance_entries').select(columnName).limit(1)
        return !error
    } catch {
        return false
    }
}

async function getConciergeFinanceSchema(supabase: ReturnType<typeof getSupabase>) {
    const [
        hasEntryDate,
        hasDate,
        hasOccurredAt,
        hasCreatedAt,
        hasCategory,
        hasSubcategory,
        hasPaymentMethod,
        hasPaymentStatus,
        hasCounterpartyName,
        hasCounterpartyType,
        hasReferenceCompany,
        hasDueDate,
        hasCompetenceDate,
        hasSourceModule,
        hasExternalReference,
        hasNotes,
        hasAttachmentUrl,
        hasCreatedBy,
        hasUpdatedAt,
    ] = await Promise.all([
        financeColumnExists(supabase, 'entry_date'),
        financeColumnExists(supabase, 'date'),
        financeColumnExists(supabase, 'occurred_at'),
        financeColumnExists(supabase, 'created_at'),
        financeColumnExists(supabase, 'category'),
        financeColumnExists(supabase, 'subcategory'),
        financeColumnExists(supabase, 'payment_method'),
        financeColumnExists(supabase, 'payment_status'),
        financeColumnExists(supabase, 'counterparty_name'),
        financeColumnExists(supabase, 'counterparty_type'),
        financeColumnExists(supabase, 'reference_company'),
        financeColumnExists(supabase, 'due_date'),
        financeColumnExists(supabase, 'competence_date'),
        financeColumnExists(supabase, 'source_module'),
        financeColumnExists(supabase, 'external_reference'),
        financeColumnExists(supabase, 'notes'),
        financeColumnExists(supabase, 'attachment_url'),
        financeColumnExists(supabase, 'created_by'),
        financeColumnExists(supabase, 'updated_at'),
    ])

    const dateField = hasEntryDate ? 'entry_date' : hasDate ? 'date' : hasOccurredAt ? 'occurred_at' : hasCreatedAt ? 'created_at' : null
    if (!dateField) return null

    return {
        dateField,
        hasOccurredAt,
        hasCategory,
        hasSubcategory,
        hasPaymentMethod,
        hasPaymentStatus,
        hasCounterpartyName,
        hasCounterpartyType,
        hasReferenceCompany,
        hasDueDate,
        hasCompetenceDate,
        hasSourceModule,
        hasExternalReference,
        hasNotes,
        hasAttachmentUrl,
        hasCreatedBy,
        hasUpdatedAt,
    }
}

async function ensureFinanceDateUnlocked(supabase: ReturnType<typeof getSupabase>, dateKey: string): Promise<string | null> {
    const periodMonth = `${String(dateKey || '').slice(0, 7)}-01`
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodMonth)) return null
    const { data, error } = await supabase
        .from('finance_closing_periods')
        .select('status')
        .eq('period_month', periodMonth)
        .maybeSingle()
    if (error) return null
    if (String(data?.status || '').trim().toLowerCase() === 'locked') {
        return `Periodo ${periodMonth.slice(5, 7)}/${periodMonth.slice(0, 4)} bloqueado para alteracoes.`
    }
    return null
}

async function createConciergeFinanceEntry(params: {
    supabase: ReturnType<typeof getSupabase>
    broker: any
    authorization: any
    phone: string
    conversationId: string
    draft: any
    actionId?: string | null
}) {
    const { supabase, broker, authorization, phone, conversationId, draft, actionId } = params
    const schema = await getConciergeFinanceSchema(supabase)
    if (!schema) throw new Error('Tabela financeira incompativel para lancamento via concierge.')

    const entryDate = draft.entry_date || saoPauloDateKey()
    const lockError = await ensureFinanceDateUnlocked(supabase, entryDate)
    if (lockError) throw new Error(lockError)

    const insertData: any = {
        description: draft.description || 'Despesa enviada pelo WhatsApp',
        entry_type: 'expense',
        amount: Number(draft.amount || 0),
    }

    if (schema.hasCategory) insertData.category = draft.category || 'Consumo despesas'
    if (schema.hasSubcategory) insertData.subcategory = draft.subcategory || null
    if (schema.hasPaymentMethod) insertData.payment_method = draft.payment_method || null
    if (schema.hasPaymentStatus) insertData.payment_status = draft.payment_status || 'paid'
    if (schema.hasCounterpartyName) insertData.counterparty_name = draft.counterparty_name || authorization?.name || null
    if (schema.hasCounterpartyType) insertData.counterparty_type = draft.counterparty_type || 'pessoa_juridica'
    if (schema.hasReferenceCompany) insertData.reference_company = draft.reference_company || null
    if (schema.hasDueDate) insertData.due_date = draft.due_date || entryDate
    if (schema.hasCompetenceDate) insertData.competence_date = draft.competence_date || entryDate
    if (schema.hasSourceModule) insertData.source_module = 'broker_concierge'
    if (schema.hasExternalReference) insertData.external_reference = actionId || `broker-concierge:${conversationId}:${Date.now()}`
    if (schema.hasAttachmentUrl) insertData.attachment_url = draft.attachment_url || null
    if (schema.hasCreatedBy) insertData.created_by = broker?.admin_user_id || null
    if (schema.hasUpdatedAt) insertData.updated_at = new Date().toISOString()
    if (schema.hasNotes) {
        insertData.notes = [
            'Lancado pelo concierge financeiro do WhatsApp.',
            `Telefone autorizado: ${normalizeOutboundBrazilPhone(phone)}`,
            draft.source_text ? `Solicitacao: ${draft.source_text}` : '',
            draft.media_filename ? `Comprovante: ${draft.media_filename}` : '',
            draft.receipt_analysis?.raw_summary ? `Leitura IA: ${draft.receipt_analysis.raw_summary}` : '',
            draft.receipt_analysis?.document_number ? `Documento: ${draft.receipt_analysis.document_number}` : '',
        ].filter(Boolean).join('\n')
    }

    if (schema.dateField === 'created_at' || schema.dateField === 'occurred_at') {
        insertData[schema.dateField] = `${entryDate}T12:00:00.000Z`
    } else {
        insertData[schema.dateField] = entryDate
    }
    if (schema.hasOccurredAt && !insertData.occurred_at) insertData.occurred_at = `${entryDate}T12:00:00.000Z`

    const { data, error } = await supabase
        .from('finance_entries')
        .insert(insertData)
        .select('id, description, amount')
        .single()

    if (error) throw error
    return data
}

async function upsertPendingFinanceAction(params: {
    supabase: ReturnType<typeof getSupabase>
    conversationId: string
    brokerId: string
    authorizedPhoneId: string
    draft: any
    actionId?: string | null
}) {
    const { supabase, conversationId, brokerId, authorizedPhoneId, draft, actionId } = params
    if (actionId) {
        await supabase
            .from('broker_assistant_actions')
            .update({
                payload: draft,
                updated_at: new Date().toISOString(),
            })
            .eq('id', actionId)
        return actionId
    }

    const { data } = await supabase
        .from('broker_assistant_actions')
        .insert({
            conversation_id: conversationId,
            broker_id: brokerId,
            authorized_phone_id: authorizedPhoneId,
            action_type: 'create_finance_entry',
            status: 'pending',
            payload: draft,
        })
        .select('id')
        .single()

    return data?.id || null
}

async function markAssistantAction(params: {
    supabase: ReturnType<typeof getSupabase>
    actionId?: string | null
    status: 'executed' | 'cancelled' | 'failed'
    result?: any
}) {
    const { supabase, actionId, status, result } = params
    if (!actionId) return
    const now = new Date().toISOString()
    await supabase
        .from('broker_assistant_actions')
        .update({
            status,
            result: result || {},
            confirmed_at: status === 'executed' ? now : undefined,
            executed_at: status === 'executed' ? now : undefined,
            updated_at: now,
        })
        .eq('id', actionId)
}

async function generateConciergeReply(params: {
    supabase: ReturnType<typeof getSupabase>
    instance: any
    broker: any
    authorization: any
    messages: any[]
    state: any
    inputText: string
    senderName?: string | null
}) {
    const { supabase, instance, broker, authorization, messages, state, inputText, senderName } = params
    const intent = detectConciergeIntent(inputText)
    const configs = await loadAIConfigs(supabase, instance?.id)
    const provider = configs['ai_provider'] === 'openai' ? 'openai' : 'gemini'
    const mediaReceived = Array.isArray(state?.media_received) ? state.media_received : []
    const systemPrompt = buildConciergeSystemPrompt({
        broker,
        authorization,
        senderName,
        intent,
        mediaReceived,
    })

    const reply = await generateChatResponse(
        buildConciergeHistory(messages),
        inputText,
        systemPrompt,
        {
            provider,
            geminiModel: configs['gemini_model'] || undefined,
            openaiModel: configs['openai_model'] || undefined,
        }
    )

    return {
        text: sanitizeConciergeReply(reply),
        intent,
        provider,
    }
}

async function getOrCreateAssistantConversation(params: {
    supabase: ReturnType<typeof getSupabase>
    brokerId: string
    phone: string
    authorizedPhoneId: string
}) {
    const { supabase, brokerId, phone, authorizedPhoneId } = params
    const { data: existing } = await supabase
        .from('broker_assistant_conversations')
        .select('*')
        .eq('broker_id', brokerId)
        .eq('phone', phone)
        .maybeSingle()

    if (existing) return existing

    const { data, error } = await supabase
        .from('broker_assistant_conversations')
        .insert({
            broker_id: brokerId,
            authorized_phone_id: authorizedPhoneId,
            phone,
            messages: [],
            state: {},
        })
        .select()
        .single()

    if (error) throw error
    return data
}

async function updateAssistantConversation(params: {
    supabase: ReturnType<typeof getSupabase>
    conversationId: string
    messages: any[]
    state: any
}) {
    const { supabase, conversationId, messages, state } = params
    await supabase
        .from('broker_assistant_conversations')
        .update({
            messages: messages.slice(-80),
            state: state || {},
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
}

async function brokerAgendaSlotHasConflict(params: {
    supabase: ReturnType<typeof getSupabase>
    brokerId: string
    date: string
    time: string
}) {
    const { supabase, brokerId, date, time } = params
    const { data } = await supabase
        .from('appointments')
        .select('id, lead_name, appointment_type, status')
        .eq('broker_id', brokerId)
        .eq('appointment_date', date)
        .eq('appointment_time', time)
        .not('status', 'in', '("cancelled","expirado")')
        .limit(1)
    return data?.[0] || null
}

async function createAssistantAppointment(params: {
    supabase: ReturnType<typeof getSupabase>
    broker: any
    assistantPhone: string
    pending: any
}) {
    const { supabase, broker, assistantPhone, pending } = params
    const scheduledStartAt = `${pending.date}T${pending.time}:00-03:00`
    const end = new Date(scheduledStartAt)
    end.setMinutes(end.getMinutes() + 60)

    const payload = {
        lead_phone: pending.lead_phone || assistantPhone,
        lead_name: pending.leadName || pending.title || 'Compromisso do corretor',
        broker_id: broker?.id || null,
        admin_user_id: broker?.admin_user_id || null,
        appointment_date: pending.date,
        appointment_time: pending.time,
        appointment_type: pending.type || 'reuniao',
        property_title: pending.propertyTitle || null,
        status: 'confirmed',
        source: 'broker_assistant',
        scheduled_start_at: scheduledStartAt,
        scheduled_end_at: end.toISOString(),
        notes: pending.requestedText || null,
        metadata: {
            created_from: 'broker_assistant',
            assistant_phone: assistantPhone,
            requested_text: pending.requestedText || null,
        },
    }

    const { data, error } = await supabase
        .from('appointments')
        .insert([payload])
        .select()
        .single()

    if (error) throw error
    return data
}

async function handleBrokerAssistantMessage(params: {
    supabase: ReturnType<typeof getSupabase>
    instance: any
    brokerId: string
    phone: string
    text: string
    senderName?: string | null
}) {
    const { supabase, instance, brokerId, phone, text, senderName } = params
    const inputText = String(text || '').trim()
    if (!brokerId || !inputText) return { handled: false, reason: 'empty' }

    const authorization = await findAssistantAuthorization({ supabase, brokerId, phone })
    if (!authorization?.id) return { handled: false, reason: 'not_authorized_assistant_phone' }

    const { data: broker } = await supabase
        .from('virtual_brokers')
        .select('*')
        .eq('id', brokerId)
        .maybeSingle()
    const conciergeEnabled = isBrokerConciergeEnabled(broker)
    const canManageAgenda = assistantHasPermission(authorization, 'can_manage_agenda', true)
    const canManageFinance = assistantHasPermission(authorization, 'can_manage_finance')
    const requiresConfirmation = brokerConciergeRequiresConfirmation(broker)

    const conversation = await getOrCreateAssistantConversation({
        supabase,
        brokerId,
        phone: normalizeOutboundBrazilPhone(phone),
        authorizedPhoneId: authorization.id,
    })

    const messages = Array.isArray(conversation?.messages) ? conversation.messages : []
    const state = conversation?.state && typeof conversation.state === 'object' ? conversation.state : {}
    const nextMessages = [...messages, {
        role: 'broker',
        content: inputText,
        sender_name: senderName || authorization.name || null,
        timestamp: new Date().toISOString(),
    }]

    const sendAssistantReply = async (reply: string, nextState: any) => {
        const parsedReply = parseConciergeButtonTags(reply)
        const outgoingText = parsedReply.cleanText || parsedReply.menu?.fallbackTitle || reply
        nextMessages.push({
            role: 'assistant',
            content: outgoingText,
            timestamp: new Date().toISOString(),
        })
        await updateAssistantConversation({
            supabase,
            conversationId: conversation.id,
            messages: nextMessages,
            state: nextState,
        })
        if (parsedReply.menu) {
            try {
                await sendMenuMessage({
                    phone,
                    text: outgoingText,
                    type: parsedReply.menu.type,
                    choices: parsedReply.menu.choices,
                    listButton: parsedReply.menu.listButton,
                    instanceToken: instance.instance_token,
                })
            } catch (error) {
                console.warn('[Broker Concierge] Failed to send tagged buttons, using text fallback:', error)
                await sendWhatsAppMessage({
                    phone,
                    message: buildConciergeButtonFallback(outgoingText, parsedReply.menu),
                    instanceToken: instance.instance_token,
                })
            }
        } else {
            await sendWhatsAppMessage({
                phone,
                message: outgoingText,
                instanceToken: instance.instance_token,
            })
        }
        return { handled: true, reason: conciergeEnabled ? 'broker_concierge' : 'broker_assistant_disabled' }
    }

    const sendAssistantButtonReply = async (reply: string, choices: string[], nextState: any) => {
        nextMessages.push({
            role: 'assistant',
            content: reply,
            timestamp: new Date().toISOString(),
        })
        await updateAssistantConversation({
            supabase,
            conversationId: conversation.id,
            messages: nextMessages,
            state: nextState,
        })

        try {
            await sendMenuMessage({
                phone,
                text: reply,
                type: 'button',
                choices,
                instanceToken: instance.instance_token,
            })
        } catch (error) {
            console.warn('[Broker Concierge] Failed to send finance buttons, using text fallback:', error)
            await sendWhatsAppMessage({
                phone,
                message: `${reply}\n\n- Pessoa fisica\n- Pessoa juridica`,
                instanceToken: instance.instance_token,
            })
        }

        return { handled: true, reason: conciergeEnabled ? 'broker_concierge' : 'broker_assistant_disabled' }
    }

    const pending = state?.pending_action
    if (pending?.assistant_action === 'create_finance_entry') {
        if (isAssistantCancelText(inputText)) {
            await markAssistantAction({
                supabase,
                actionId: pending.action_id,
                status: 'cancelled',
                result: { reason: 'cancelled_by_owner' },
            })
            return sendAssistantReply('Sem problema, descartei esse lancamento financeiro antes de gravar.', {
                ...state,
                pending_action: null,
            })
        }

        if (!conciergeEnabled) {
            return sendAssistantReply(buildConciergeFallbackReply({ broker, authorization, conciergeEnabled }), {
                ...state,
                pending_action: null,
            })
        }

        if (!canManageFinance) {
            await markAssistantAction({
                supabase,
                actionId: pending.action_id,
                status: 'cancelled',
                result: { reason: 'missing_permission', permission: 'can_manage_finance' },
            })
            return sendAssistantReply('Nao posso criar lancamentos financeiros porque este telefone autorizado nao tem permissao financeira.', {
                ...state,
                pending_action: null,
            })
        }

        const correctionChoice = detectFinanceCorrectionChoice(inputText)
        if (correctionChoice === 'amount') {
            return sendAssistantReply('Claro. Qual e o valor correto? Pode mandar assim: R$ 250,00.', {
                ...state,
                pending_action: {
                    ...pending,
                    awaiting_confirmation: false,
                    awaiting_field: 'amount',
                },
            })
        }
        if (correctionChoice === 'date') {
            return sendAssistantReply('Qual e a data correta do lancamento? Pode mandar no formato 18/05/2026.', {
                ...state,
                pending_action: {
                    ...pending,
                    awaiting_confirmation: false,
                    awaiting_field: 'date',
                },
            })
        }
        if (correctionChoice === 'category') {
            return sendAssistantReply('Escolha a categoria correta para esse lancamento. {categoria}', {
                ...state,
                pending_action: {
                    ...pending,
                    awaiting_confirmation: false,
                    awaiting_field: 'category',
                },
            })
        }
        if (correctionChoice === 'payment') {
            return sendAssistantReply('Qual foi a forma de pagamento? {pagamento}', {
                ...state,
                pending_action: {
                    ...pending,
                    awaiting_confirmation: false,
                    awaiting_field: 'payment_method',
                },
            })
        }

        const mergedDraft = buildFinanceDraftFromText(inputText, state, pending)
        const actionId = await upsertPendingFinanceAction({
            supabase,
            conversationId: conversation.id,
            brokerId,
            authorizedPhoneId: authorization.id,
            draft: mergedDraft,
            actionId: pending.action_id,
        })
        const nextFinanceState = {
            ...state,
            pending_action: {
                ...mergedDraft,
                action_id: actionId,
            },
        }
        const missing = getFinanceDraftMissingField(mergedDraft)

        if (missing === 'counterparty_type') {
            return sendAssistantButtonReply('Esse lancamento e para pessoa fisica ou pessoa juridica?', [
                'Pessoa fisica|finance_party_pf',
                'Pessoa juridica|finance_party_pj',
            ], nextFinanceState)
        }

        if (missing === 'amount') {
            return sendAssistantReply('Qual foi o valor desse comprovante? Pode mandar assim: R$ 250,00.', nextFinanceState)
        }

        if (!isAssistantConfirmationText(inputText) && (requiresConfirmation || pending.awaiting_confirmation === true)) {
            return sendAssistantReply([
                'Vou criar este lancamento financeiro:',
                financeDraftSummary(mergedDraft),
                '',
                'Confirma que posso gravar no financeiro?',
                '{confirmar}',
            ].join('\n'), {
                ...nextFinanceState,
                pending_action: {
                    ...mergedDraft,
                    action_id: actionId,
                    awaiting_confirmation: true,
                },
            })
        }

        try {
            const entry = await createConciergeFinanceEntry({
                supabase,
                broker,
                authorization,
                phone,
                conversationId: conversation.id,
                draft: mergedDraft,
                actionId,
            })
            await markAssistantAction({
                supabase,
                actionId,
                status: 'executed',
                result: { finance_entry_id: entry?.id || null },
            })
            return sendAssistantReply(`Feito. Lancei ${formatCurrencyBR(Number(mergedDraft.amount || 0))} no financeiro como ${mergedDraft.description || 'despesa'}.`, {
                ...state,
                pending_action: null,
                last_finance_entry_id: entry?.id || null,
            })
        } catch (error) {
            console.error('[Broker Concierge] Failed to create finance entry:', error)
            await markAssistantAction({
                supabase,
                actionId,
                status: 'failed',
                result: { error: error instanceof Error ? error.message : String(error) },
            })
            return sendAssistantReply('Tentei gravar no financeiro, mas encontrei um erro. Mantive a acao registrada para revisao no painel.', {
                ...state,
                pending_action: null,
            })
        }
    }

    if (pending?.assistant_action === 'create_appointment') {
        if (isAssistantCancelText(inputText)) {
            return sendAssistantReply('Sem problema, cancelei essa solicitação antes de gravar na agenda.', {
                ...state,
                pending_action: null,
            })
        }

        if (/\b(reagendar|agenda_reschedule)\b/.test(normalizeAssistantText(inputText))) {
            return sendAssistantReply('Claro. Me envie a nova data e horario para eu montar o compromisso novamente.', {
                ...state,
                pending_action: null,
            })
        }

        if (!conciergeEnabled) {
            return sendAssistantReply(buildConciergeFallbackReply({ broker, authorization, conciergeEnabled }), {
                ...state,
                pending_action: null,
            })
        }

        if (!canManageAgenda) {
            if (pending.action_id) {
                await supabase
                    .from('broker_assistant_actions')
                    .update({
                        status: 'cancelled',
                        result: { reason: 'missing_permission', permission: 'can_manage_agenda' },
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', pending.action_id)
            }

            return sendAssistantReply('Nao posso gravar esse compromisso porque este telefone autorizado nao tem permissao de agenda.', {
                ...state,
                pending_action: null,
            })
        }

        if (!isAssistantConfirmationText(inputText)) {
            return sendAssistantReply('Tenho uma ação aguardando confirmação. Me responde com "sim" para gravar ou "cancelar" para descartar.', state)
        }

        try {
            const conflict = await brokerAgendaSlotHasConflict({
                supabase,
                brokerId,
                date: pending.date,
                time: pending.time,
            })
            if (conflict) {
                return sendAssistantReply(`Não gravei porque já existe um compromisso nesse horário (${formatAppointmentDatePt(pending.date)}, ${pending.time}). Quer que eu marque em outro horário?`, {
                    ...state,
                    pending_action: null,
                })
            }

            const appointment = await createAssistantAppointment({
                supabase,
                broker,
                assistantPhone: normalizeOutboundBrazilPhone(phone),
                pending,
            })

            if (pending.action_id) {
                await supabase
                    .from('broker_assistant_actions')
                    .update({
                        status: 'executed',
                        confirmed_at: new Date().toISOString(),
                        executed_at: new Date().toISOString(),
                        result: { appointment_id: appointment.id },
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', pending.action_id)
            }

            return sendAssistantReply(`Feito. Registrei ${pending.title || 'o compromisso'} na sua agenda para ${formatAppointmentDatePt(pending.date)}, as ${pending.time}.`, {
                ...state,
                pending_action: null,
            })
        } catch (error) {
            console.error('[Broker Assistant] Failed to create appointment:', error)
            return sendAssistantReply('Tentei gravar na agenda, mas encontrei um erro. Vou deixar registrado que essa ação precisa ser revisada no painel.', {
                ...state,
                pending_action: null,
            })
        }
    }

    const parsed = parseAssistantAgendaCommand(inputText)
    if (!parsed) {
        const shouldHandleFinance = conciergeEnabled
            && !isConciergeQuickChoice(inputText)
            && (detectConciergeIntent(inputText) === 'financeiro' || isMediaOnlyFinanceCandidate(inputText, state))

        if (shouldHandleFinance) {
            if (!canManageFinance) {
                return sendAssistantReply('Entendi que isso e financeiro, mas este telefone autorizado nao tem permissao para criar lancamentos.', state)
            }

            const financeDraft = buildFinanceDraftFromText(inputText, state)
            const actionId = await upsertPendingFinanceAction({
                supabase,
                conversationId: conversation.id,
                brokerId,
                authorizedPhoneId: authorization.id,
                draft: financeDraft,
            })
            const nextFinanceState = {
                ...state,
                pending_action: {
                    ...financeDraft,
                    action_id: actionId,
                    awaiting_confirmation: requiresConfirmation,
                },
                last_intent: 'financeiro',
            }
            const missing = getFinanceDraftMissingField(financeDraft)

            if (missing === 'counterparty_type') {
                return sendAssistantButtonReply('Recebi o comprovante/despesa. Esse lancamento e para pessoa fisica ou pessoa juridica?', [
                    'Pessoa fisica|finance_party_pf',
                    'Pessoa juridica|finance_party_pj',
                ], nextFinanceState)
            }

            if (missing === 'amount') {
                return sendAssistantReply('Recebi a despesa. Qual foi o valor? Pode mandar assim: R$ 250,00.', nextFinanceState)
            }

            if (requiresConfirmation) {
                return sendAssistantReply([
                    'Vou criar este lancamento financeiro:',
                    financeDraftSummary(financeDraft),
                    '',
                    'Confirma que posso gravar no financeiro?',
                    '{confirmar}',
                ].join('\n'), nextFinanceState)
            }

            try {
                const entry = await createConciergeFinanceEntry({
                    supabase,
                    broker,
                    authorization,
                    phone,
                    conversationId: conversation.id,
                    draft: financeDraft,
                    actionId,
                })
                await markAssistantAction({
                    supabase,
                    actionId,
                    status: 'executed',
                    result: { finance_entry_id: entry?.id || null },
                })
                return sendAssistantReply(`Feito. Lancei ${formatCurrencyBR(Number(financeDraft.amount || 0))} no financeiro como ${financeDraft.description || 'despesa'}.`, {
                    ...state,
                    pending_action: null,
                    last_intent: 'financeiro',
                    last_finance_entry_id: entry?.id || null,
                })
            } catch (error) {
                console.error('[Broker Concierge] Failed to create direct finance entry:', error)
                await markAssistantAction({
                    supabase,
                    actionId,
                    status: 'failed',
                    result: { error: error instanceof Error ? error.message : String(error) },
                })
                return sendAssistantReply('Tentei gravar no financeiro, mas encontrei um erro. Mantive a acao registrada para revisao no painel.', {
                    ...state,
                    pending_action: null,
                    last_intent: 'financeiro',
                })
            }
        }

        if (conciergeEnabled) {
            try {
                const aiReply = await generateConciergeReply({
                    supabase,
                    instance,
                    broker,
                    authorization,
                    messages,
                    state,
                    inputText,
                    senderName,
                })

                if (aiReply.text) {
                    return sendAssistantReply(aiReply.text, {
                        ...state,
                        last_intent: aiReply.intent,
                        last_ai_provider: aiReply.provider,
                        last_ai_at: new Date().toISOString(),
                        last_ai_error: null,
                    })
                }
            } catch (error) {
                console.warn('[Broker Concierge] AI reply failed, using deterministic fallback:', error)
            }
        }

        return sendAssistantReply(buildConciergeFallbackReply({ broker, authorization, conciergeEnabled }), state)
    }

    if (!conciergeEnabled) {
        return sendAssistantReply(buildConciergeFallbackReply({ broker, authorization, conciergeEnabled }), state)
    }

    if (!canManageAgenda) {
        return sendAssistantReply('Entendi que voce quer mexer na agenda, mas este telefone autorizado nao tem permissao para criar compromissos.', state)
    }

    if (parsed.incomplete) {
        const missing = [
            !parsed.date ? 'data' : '',
            !parsed.time ? 'horário' : '',
        ].filter(Boolean).join(' e ')
        return sendAssistantReply(`Consigo fazer isso, mas preciso que você me diga ${missing}. Exemplo: "amanhã às 15h".`, state)
    }

    const conflict = await brokerAgendaSlotHasConflict({
        supabase,
        brokerId,
        date: parsed.date,
        time: parsed.time,
    })
    if (conflict) {
        return sendAssistantReply(`Esse horário já tem um compromisso na sua agenda (${formatAppointmentDatePt(parsed.date)}, ${parsed.time}). Quer me passar outro horário?`, state)
    }

    if (!requiresConfirmation) {
        try {
            const appointment = await createAssistantAppointment({
                supabase,
                broker,
                assistantPhone: normalizeOutboundBrazilPhone(phone),
                pending: parsed,
            })

            await supabase
                .from('broker_assistant_actions')
                .insert({
                    conversation_id: conversation.id,
                    broker_id: brokerId,
                    authorized_phone_id: authorization.id,
                    action_type: 'create_appointment',
                    status: 'executed',
                    payload: parsed,
                    result: { appointment_id: appointment.id },
                    confirmed_at: new Date().toISOString(),
                    executed_at: new Date().toISOString(),
                })

            return sendAssistantReply(`Feito. Registrei ${parsed.title || 'o compromisso'} na sua agenda para ${formatAppointmentDatePt(parsed.date)}, as ${parsed.time}.`, {
                ...state,
                pending_action: null,
            })
        } catch (error) {
            console.error('[Broker Assistant] Failed to create appointment without confirmation:', error)
            return sendAssistantReply('Tentei gravar na agenda, mas encontrei um erro. Vou deixar registrado que essa ação precisa ser revisada no painel.', state)
        }
    }

    const { data: action } = await supabase
        .from('broker_assistant_actions')
        .insert({
            conversation_id: conversation.id,
            broker_id: brokerId,
            authorized_phone_id: authorization.id,
            action_type: 'create_appointment',
            status: 'pending',
            payload: parsed,
        })
        .select()
        .single()

    const nextState = {
        ...state,
        pending_action: {
            ...parsed,
            assistant_action: 'create_appointment',
            action_id: action?.id || null,
        },
    }

    return sendAssistantReply([
        `Entendi. Vou registrar ${parsed.title} para ${formatAppointmentDatePt(parsed.date)}, as ${parsed.time}.`,
        'Confirma que posso gravar na sua agenda?',
        '{agenda}',
    ].join('\n\n'), nextState)
}

async function tryFastTextBrokerResponse(params: {
    supabase: ReturnType<typeof getSupabase>
    instance: any
    phone: string
    text: string
    messageId?: string | null
    messageType?: string | null
    senderName?: string | null
    bypassTimingGuards?: boolean
}): Promise<{ handled: boolean; reason: string; responseLength?: number }> {
    const { supabase, instance, phone, text, messageId, messageType, senderName, bypassTimingGuards } = params
    const inputText = String(text || '').trim()
    if (!instance?.broker_id || !inputText) return { handled: false, reason: 'not_fast_candidate' }

    const configs = await loadAIConfigs(supabase, instance.id)
    if (!bypassTimingGuards && configs['whatsapp_smart_timing_enabled'] !== 'false') return { handled: false, reason: 'smart_timing_enabled' }
    const debounceSeconds = Math.max(1, parseInt(configs['whatsapp_debounce_seconds'] || '15', 10) || 15)
    if (!bypassTimingGuards && debounceSeconds > 5) return { handled: false, reason: 'debounce_above_fast_threshold' }
    if (configs['whatsapp_agent_enabled'] === 'false') return { handled: false, reason: 'agent_disabled' }
    if (isWhatsAppGlobalInstance(instance) && configs['whatsapp_global_agent_enabled'] === 'false') {
        return { handled: false, reason: 'global_agent_disabled' }
    }
    if (configs['whatsapp_ai_schedule_enabled'] === 'true') return { handled: false, reason: 'schedule_requires_inngest' }

    const { data: broker } = await supabase
        .from('virtual_brokers')
        .select('*')
        .eq('id', instance.broker_id)
        .single()
    if (!broker?.is_active) return { handled: false, reason: 'no_active_broker' }

    const { data: existing } = await supabase
        .from('whatsapp_ai_conversations')
        .select('*')
        .eq('broker_id', broker.id)
        .eq('lead_phone', phone)
        .in('status', ['active', 'human_takeover', 'transferred'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    let conversation = existing
    if (conversation?.status === 'human_takeover' && configs['whatsapp_human_intervention'] !== 'false') {
        const interventionMinutes = parseInt(configs['whatsapp_human_intervention_minutes'] || '60', 10)
        const takeoverAt = conversation.human_takeover_at
        const elapsedMinutes = takeoverAt ? (Date.now() - new Date(takeoverAt).getTime()) / 60000 : 0
        if (!takeoverAt || elapsedMinutes < interventionMinutes) {
            return { handled: false, reason: 'human_takeover' }
        }
        await supabase
            .from('whatsapp_ai_conversations')
            .update({ status: 'active', human_takeover_at: null, updated_at: new Date().toISOString() })
            .eq('id', conversation.id)
        conversation = { ...conversation, status: 'active', human_takeover_at: null }
    }

    if (conversation?.status === 'transferred') {
        await supabase
            .from('whatsapp_ai_conversations')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('id', conversation.id)
        conversation = { ...conversation, status: 'active' }
    }

    if (!conversation) {
        const { data: created } = await supabase
            .from('whatsapp_ai_conversations')
            .insert({
                broker_id: broker.id,
                instance_id: instance.id,
                lead_phone: phone,
                messages: [],
                bot_message_ids: [],
                status: 'active',
            })
            .select()
            .single()
        conversation = created
    }

    if (!conversation) return { handled: false, reason: 'conversation_unavailable' }

    try {
        await supabase
            .from('app_config')
            .delete()
            .like('key', `_pmq_${phone}_%`)
    } catch { /* ignore stale debounce cleanup failures */ }

    const historyMessages = (Array.isArray(conversation.messages) ? conversation.messages : [])
        .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')

    const updatedMessages = [...historyMessages, {
        role: 'user',
        content: inputText,
        type: messageType || 'text',
        source: 'lead',
        message_id: messageId || null,
        instance_id: instance.id,
        broker_id: broker.id,
        timestamp: new Date().toISOString(),
    }]

    const confirmedAppointment = detectConfirmedAppointment(updatedMessages)
    const confirmedAppointmentResult = confirmedAppointment
        ? await saveDetectedAppointment({
            supabase,
            appointment: confirmedAppointment,
            broker,
            leadPhone: phone,
            senderName,
            propertyTitle: null,
            createdFrom: 'fast_webhook_lead_confirmation',
        })
        : null

    if (confirmedAppointment && confirmedAppointmentResult === 'created') {
        await notifyHumanAboutPendingAppointment({
            supabase,
            instance,
            broker,
            leadPhone: phone,
            senderName,
            appointment: confirmedAppointment,
        }).catch(error => {
            console.warn('[Appointment] Human notification failed:', error?.message || error)
        })
    }

    const quickSocialReply = !confirmedAppointment ? resolveSocialQuickReply(inputText, configs) : null
    const aiResponse = confirmedAppointment && confirmedAppointmentResult !== 'failed'
        ? {
            text: buildAppointmentConfirmationText(confirmedAppointment),
            shouldTransfer: false,
            extractedData: {
                appointment_created_from_marker: confirmedAppointmentResult,
                appointment_date: confirmedAppointment.date,
                appointment_time: confirmedAppointment.time,
            } as any,
        }
        : quickSocialReply
            ? { text: quickSocialReply, shouldTransfer: false, extractedData: undefined as any }
            : await generateAIResponse(configs, broker, updatedMessages, senderName || undefined, phone)

    updatedMessages.push({
        role: 'assistant',
        content: aiResponse.text,
        type: 'text',
        source: quickSocialReply ? 'quick_reply' : 'agent',
        instance_id: instance.id,
        broker_id: broker.id,
        timestamp: new Date().toISOString(),
    })

    await supabase
        .from('whatsapp_ai_conversations')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('id', conversation.id)

    await recordAgentConversationEcosystemEvent({
        supabase,
        conversationId: conversation.id,
        brokerId: broker.id,
        brokerName: broker.name,
        instanceId: instance.id,
        instanceName: instance.instance_name,
        leadPhone: phone,
        leadName: senderName || null,
        messages: updatedMessages,
        status: aiResponse.shouldTransfer ? 'transfer_requested' : conversation.status || 'active',
        source: 'fast-whatsapp-webhook',
        extractedData: aiResponse.extractedData || null,
        shouldTransfer: aiResponse.shouldTransfer,
    }).catch(error => {
        console.warn('[Webhook] Ecosystem conversation event failed:', error?.message || error)
    })

    setPresenceAvailable(instance.instance_token, phone).catch(() => null)

    const interactive = parseInteractiveElements(aiResponse.text)
    const { cleanText, buttons, urlButtons, list, poll, locationRequest, pix, carousel } = interactive
    let botMessageIds: string[] = Array.isArray(conversation.bot_message_ids) ? conversation.bot_message_ids : []
    const sendTextRespectingSplit = async (message: string) => {
        const textToSend = String(message || '').trim()
        if (!textToSend) return null

        const splitEnabled = configs['whatsapp_split_messages'] !== 'false'
        const chunks = splitEnabled && textToSend.length > 120
            ? splitIntoHumanChunks(textToSend)
            : [textToSend]

        let lastResult: any = null
        for (let index = 0; index < chunks.length; index++) {
            if (index > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.min(1800 + chunks[index].length * 18, 3500)))
            }
            lastResult = await sendWhatsAppMessage({
                phone,
                message: chunks[index],
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, lastResult)
        }
        return lastResult
    }

    if (urlButtons && urlButtons.items.length > 0) {
        try {
            const sendResult = await sendMenuMessage({
                phone,
                text: cleanText || urlButtons.title || 'Acesse o link abaixo:',
                type: 'button',
                choices: urlButtons.items.map(item => `${item.text}|url:${item.url}`),
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            const linksText = urlButtons.items.map(i => `${i.text}: ${i.url}`).join('\n')
            const sendResult = await sendWhatsAppMessage({
                phone,
                message: `${cleanText ? cleanText + '\n\n' : ''}${linksText}`,
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else if (buttons && buttons.options.length > 0) {
        try {
            const sendResult = await sendMenuMessage({
                phone,
                text: cleanText || buttons.title,
                type: 'button',
                choices: buttons.options.slice(0, 3).map(opt => opt.substring(0, 20)),
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            await sendTextRespectingSplit(cleanText || aiResponse.text)
        }
    } else if (list && list.sections.length > 0) {
        try {
            const choices: string[] = []
            for (const section of list.sections) {
                choices.push(`[${section.title}]`)
                for (const row of section.rows) {
                    choices.push(row.description ? `${row.title}|${row.id}|${row.description}` : row.title)
                }
            }
            const sendResult = await sendMenuMessage({
                phone,
                text: cleanText || 'Escolha uma opção:',
                type: 'list',
                choices,
                listButton: list.buttonText,
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            const fallbackText = list.sections.map(section =>
                `*${section.title}*\n${section.rows.map((row, index) => `${index + 1}. ${row.title}${row.description ? ` - ${row.description}` : ''}`).join('\n')}`
            ).join('\n\n')
            const sendResult = await sendWhatsAppMessage({ phone, message: `${cleanText ? cleanText + '\n\n' : ''}${fallbackText}`, instanceToken: instance.instance_token })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else if (poll && poll.options.length >= 2) {
        try {
            if (cleanText) await sendWhatsAppMessage({ phone, message: cleanText, instanceToken: instance.instance_token })
            const sendResult = await sendMenuMessage({
                phone,
                text: poll.question,
                type: 'poll',
                choices: poll.options,
                selectableCount: poll.multiSelect ? poll.options.length : 1,
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            const fallbackText = `${poll.question}\n\n${poll.options.map((option, index) => `${index + 1}. ${option}`).join('\n')}`
            const sendResult = await sendWhatsAppMessage({ phone, message: `${cleanText ? cleanText + '\n\n' : ''}${fallbackText}`, instanceToken: instance.instance_token })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else if (locationRequest) {
        try {
            if (cleanText) await sendWhatsAppMessage({ phone, message: cleanText, instanceToken: instance.instance_token })
            const sendResult = await sendLocationRequest(phone, cleanText || 'Pode compartilhar sua localização?', instance.instance_token)
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            const sendResult = await sendWhatsAppMessage({ phone, message: cleanText || 'Pode nos informar sua localização por texto?', instanceToken: instance.instance_token })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else if (pix) {
        try {
            if (cleanText) await sendWhatsAppMessage({ phone, message: cleanText, instanceToken: instance.instance_token })
            const sendResult = await sendPixButton(phone, pix.pixKey, pix.pixName, pix.pixType === 'EVP' ? 'RANDOM' : pix.pixType, instance.instance_token)
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            const sendResult = await sendWhatsAppMessage({ phone, message: cleanText || `Chave PIX: ${pix.pixKey}`, instanceToken: instance.instance_token })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else if (carousel && carousel.cards.length > 0) {
        try {
            const sendResult = await sendCarousel(phone, cleanText || carousel.text, carousel.cards, instance.instance_token)
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            await sendTextRespectingSplit(cleanText || carousel.text)
        }
    } else {
        await sendTextRespectingSplit(cleanText || aiResponse.text)
    }

    await syncWhatsAppLeadSnapshot(supabase, {
        phone,
        senderName: senderName || undefined,
        instanceId: instance.id,
        instanceName: instance.instance_name,
        instanceToken: instance.instance_token,
        brokerId: broker.id,
        conversationId: conversation.id,
        acquiredVia: 'whatsapp',
        messages: updatedMessages,
        extractedData: aiResponse.extractedData || null,
        shouldTransfer: aiResponse.shouldTransfer,
    }).catch(() => null)

    return { handled: true, reason: 'responded_fast_webhook', responseLength: aiResponse.text.length }
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

function mediaKindFromMime(mime?: string | null): string {
    const value = String(mime || '').toLowerCase()
    if (value.startsWith('image/')) return 'image'
    if (value.startsWith('video/')) return 'video'
    if (value.startsWith('audio/')) return 'audio'
    return 'document'
}

function filenameFromMediaUrl(url: string, fallback: string): string {
    try {
        const parsed = new URL(url)
        const last = parsed.pathname.split('/').filter(Boolean).pop()
        return last || fallback
    } catch {
        return fallback
    }
}

async function saveAssistantMediaArtifact(params: {
    supabase: ReturnType<typeof getSupabase>
    instance?: any
    brokerId: string
    phone: string
    authorization: any
    docEntry: any
}) {
    const { supabase, instance, brokerId, phone, authorization, docEntry } = params
    const conversation = await getOrCreateAssistantConversation({
        supabase,
        brokerId,
        phone: normalizeOutboundBrazilPhone(phone),
        authorizedPhoneId: authorization.id,
    })

    const messages = Array.isArray(conversation?.messages) ? conversation.messages : []
    const state = conversation?.state && typeof conversation.state === 'object' ? conversation.state : {}
    const mediaReceived = Array.isArray(state?.media_received) ? state.media_received : []
    const messageIds: string[] = Array.isArray(docEntry?.message_ids) ? docEntry.message_ids.map(String) : []
    const alreadySaved = mediaReceived.some((doc: any) => {
        const docIds = Array.isArray(doc?.message_ids) ? doc.message_ids.map(String) : []
        return doc?.url === docEntry.url
            || doc?.r2_url === docEntry.r2_url
            || doc?.original_url === docEntry.original_url
            || messageIds.some((id) => docIds.includes(id))
    })
    const existingDoc = mediaReceived.find((doc: any) => {
        const docIds = Array.isArray(doc?.message_ids) ? doc.message_ids.map(String) : []
        return doc?.url === docEntry.url
            || doc?.r2_url === docEntry.r2_url
            || doc?.original_url === docEntry.original_url
            || messageIds.some((id) => docIds.includes(id))
    })
    let enrichedDocEntry = existingDoc || docEntry

    if (!existingDoc?.finance_receipt_analysis
        && assistantHasPermission(authorization, 'can_manage_finance')
        && (docEntry.type === 'image' || docEntry.type === 'document')) {
        const analysis = await analyzeFinanceReceiptMedia({
            supabase,
            instance,
            docEntry,
        }).catch((error) => {
            console.warn('[Broker Concierge] Receipt analysis failed:', error)
            return null
        })

        if (analysis) {
            enrichedDocEntry = {
                ...docEntry,
                finance_receipt_analysis: analysis,
                finance_receipt_analyzed_at: new Date().toISOString(),
            }
        }
    }

    const pendingAction = state?.pending_action
    const nextMediaReceived = alreadySaved
        ? mediaReceived.map((doc: any) => {
            const docIds = Array.isArray(doc?.message_ids) ? doc.message_ids.map(String) : []
            const sameDoc = doc?.url === docEntry.url
                || doc?.r2_url === docEntry.r2_url
                || doc?.original_url === docEntry.original_url
                || messageIds.some((id) => docIds.includes(id))
            return sameDoc ? { ...doc, ...enrichedDocEntry } : doc
        })
        : [...mediaReceived, enrichedDocEntry].slice(-80)
    const pendingWithAttachment = pendingAction?.assistant_action === 'create_finance_entry'
        ? buildFinanceDraftFromText('', { ...state, media_received: nextMediaReceived }, {
            ...pendingAction,
            attachment_url: pendingAction.attachment_url || enrichedDocEntry.url || enrichedDocEntry.r2_url || null,
            media_filename: pendingAction.media_filename || enrichedDocEntry.filename || null,
        })
        : pendingAction

    const nextState: any = {
        ...state,
        media_received: nextMediaReceived,
    }
    if (pendingWithAttachment !== undefined) nextState.pending_action = pendingWithAttachment
    const nextMessages = alreadySaved
        ? messages
        : [...messages, {
            role: 'broker',
            content: `[${enrichedDocEntry.type} recebida] ${enrichedDocEntry.filename}`,
            type: enrichedDocEntry.type,
            media_url: enrichedDocEntry.url,
            finance_receipt_analysis: enrichedDocEntry.finance_receipt_analysis || null,
            timestamp: enrichedDocEntry.received_at || new Date().toISOString(),
        }]

    if (pendingWithAttachment !== pendingAction && pendingWithAttachment?.action_id) {
        try {
            await supabase
                .from('broker_assistant_actions')
                .update({
                    payload: pendingWithAttachment,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', pendingWithAttachment.action_id)
        } catch {
            // Best effort: the conversation state still keeps the attachment.
        }
    }

    await updateAssistantConversation({
        supabase,
        conversationId: conversation.id,
        messages: nextMessages,
        state: nextState,
    })

    return { alreadySaved, conversationId: conversation.id }
}

async function saveInboundMediaArtifact(params: {
    supabase: ReturnType<typeof getSupabase>
    instanceName: string
    phone: string
    fileUrl: string
    mime?: string | null
    mediaKind: string
    messageIds: string[]
}) {
    const { supabase, instanceName, phone, fileUrl, mime, mediaKind, messageIds } = params
    const mirrored = await mirrorMediaToR2({
        url: fileUrl,
        mime,
        instanceName,
        phone,
        mediaKind,
    })
    const storedUrl = mirrored.r2_url || fileUrl
    const now = new Date().toISOString()
    const filename = filenameFromMediaUrl(storedUrl, `${mediaKind}_${Date.now()}.${extFromMime(mime)}`)

    let instance: any = null
    if (instanceName) {
        const { data } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, broker_id, admin_user_id')
            .eq('instance_name', instanceName)
            .maybeSingle()
        instance = data
    }

    const docEntry = {
        type: mediaKind,
        filename,
        mimetype: mime || mirrored.mime || 'unknown',
        url: storedUrl,
        r2_url: storedUrl,
        original_url: fileUrl,
        storage: storedUrl === fileUrl ? 'connectyhub' : 'r2',
        message_ids: messageIds,
        received_at: now,
        instance_id: instance?.id || null,
        broker_id: instance?.broker_id || null,
    }

    if (phone && instance?.broker_id) {
        const authorization = await findAssistantAuthorization({
            supabase,
            brokerId: instance.broker_id,
            phone,
        }).catch(() => null)

        if (authorization?.id) {
            await saveAssistantMediaArtifact({
                supabase,
                instance,
                brokerId: instance.broker_id,
                phone,
                authorization,
                docEntry,
            }).catch((error) => console.warn('[Broker Assistant] Failed to save assistant media:', error))

            return { ...mirrored, stored_url: storedUrl, filename, assistant_mode: true }
        }
    }

    let lead: any = null
    if (phone) {
        lead = await ensureWhatsAppLead(supabase, {
            phone,
            instanceId: instance?.id || null,
            instanceName: instance?.instance_name || instanceName || null,
            brokerId: instance?.broker_id || null,
            acquiredVia: 'whatsapp',
        }).catch(() => null)
    }

    if (phone) {
        const { data: existing } = await supabase
            .from('lead_collected_data')
            .select('documents_received')
            .eq('lead_phone', phone)
            .maybeSingle()

        const docs = Array.isArray(existing?.documents_received) ? existing.documents_received : []
        const alreadySaved = docs.some((doc: any) => {
            const docIds = Array.isArray(doc?.message_ids) ? doc.message_ids.map(String) : []
            return doc?.url === storedUrl
                || doc?.r2_url === storedUrl
                || doc?.original_url === fileUrl
                || messageIds.some((id) => docIds.includes(String(id)))
        })
        if (!alreadySaved) docs.push(docEntry)

        const { error } = await supabase
            .from('lead_collected_data')
            .upsert({
                lead_phone: phone,
                documents_received: docs.slice(-80),
                updated_at: now,
            }, { onConflict: 'lead_phone' })
        if (error) console.warn('[Webhook] Failed to save media in lead_collected_data:', error.message)

        if (lead?.id && !alreadySaved) {
            await appendLeadConversationLog(supabase, lead.id, {
                role: 'user',
                content: `[${mediaKind} recebida] ${filename} | ${storedUrl}`,
                type: mediaKind,
                source: 'lead',
                message_id: messageIds[0] || null,
                instance_id: instance?.id || null,
                broker_id: instance?.broker_id || null,
                timestamp: now,
            }).catch(() => null)
        }
    }

    return { ...mirrored, stored_url: storedUrl, filename }
}

function webhookText(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
    return ''
}

function extractWebhookInstanceName(body: any, eventPayload: any): string {
    const direct = webhookText(body?.instanceName)
        || webhookText(body?.instance_name)
        || webhookText(body?.server_url)
        || webhookText(body?.data?.instanceName)
        || webhookText(body?.data?.instance_name)
        || webhookText(body?.data?.server_url)
        || webhookText(eventPayload?.Instance)
        || webhookText(eventPayload?.instanceName)
        || webhookText(eventPayload?.instance_name)
    if (direct) return direct

    const instanceObject = body?.instance || eventPayload?.instance
    if (instanceObject && typeof instanceObject === 'object') {
        return webhookText(instanceObject.name)
            || webhookText(instanceObject.instanceName)
            || webhookText(instanceObject.instance_name)
    }

    return ''
}

function extractConnectyHubInstanceId(headers: Headers, body: any, eventPayload: any): string {
    const headerValue = webhookText(headers.get('x-connectyhub-instance-id'))
    if (headerValue) return headerValue

    const instanceObject = body?.instance && typeof body.instance === 'object' && !Array.isArray(body.instance)
        ? body.instance
        : eventPayload?.instance && typeof eventPayload.instance === 'object' && !Array.isArray(eventPayload.instance)
            ? eventPayload.instance
            : null

    return webhookText(body?.instanceId)
        || webhookText(body?.connectyhubInstanceId)
        || webhookText(body?.connectyhub_instance_id)
        || webhookText(body?.instance)
        || webhookText(body?.data?.instanceId)
        || webhookText(body?.data?.connectyhubInstanceId)
        || webhookText(body?.data?.connectyhub_instance_id)
        || webhookText(eventPayload?.instanceId)
        || webhookText(eventPayload?.connectyhubInstanceId)
        || webhookText(eventPayload?.connectyhub_instance_id)
        || webhookText(eventPayload?.instance)
        || webhookText(instanceObject?.id)
        || webhookText(instanceObject?.instanceId)
        || webhookText(instanceObject?.connectyhubInstanceId)
}

function isPlainWebhookObject(value: unknown): value is Record<string, any> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}

function looksLikeWhatsAppMessage(value: unknown): boolean {
    if (!isPlainWebhookObject(value)) return false
    return Boolean(
        value.messageid ||
        value.chatid ||
        value.sender ||
        value.sender_pn ||
        value.fromMe !== undefined ||
        value.wasSentByApi !== undefined ||
        value.text !== undefined ||
        value.messageType ||
        value.content !== undefined
    )
}

function extractWebhookMessageData(body: any, eventPayload: any, event: string): any {
    const eventKey = String(event || '').toLowerCase()
    const messageEvents = new Set(['message', 'messages', 'messages.upsert', 'messages_update', 'history'])
    const data = isPlainWebhookObject(body?.data) ? body.data : null
    const dataMessage = data?.message

    if (
        dataMessage &&
        isPlainWebhookObject(dataMessage) &&
        (messageEvents.has(eventKey) || looksLikeWhatsAppMessage(dataMessage))
    ) {
        return dataMessage
    }

    if (isPlainWebhookObject(body?.message) && looksLikeWhatsAppMessage(body.message)) {
        return body.message
    }

    if (isPlainWebhookObject(eventPayload) && looksLikeWhatsAppMessage(eventPayload)) {
        return eventPayload
    }

    return data || body?.message || eventPayload || body
}

async function rememberConnectyHubInstanceId(params: {
    supabase: ReturnType<typeof getSupabase>
    instance: any
    connectyHubInstanceId: string
    event: string
    webhookEventId: string
}) {
    const { supabase, instance, connectyHubInstanceId, event, webhookEventId } = params
    if (!instance?.id || !connectyHubInstanceId) return instance

    const now = new Date().toISOString()
    const currentConfig = instance.config && typeof instance.config === 'object' && !Array.isArray(instance.config)
        ? instance.config
        : {}
    const nextConfig = {
        ...currentConfig,
        connectyhub_instance_id: connectyHubInstanceId,
        connectyhub_last_event: event || null,
        connectyhub_last_webhook_event_id: webhookEventId || null,
        connectyhub_last_webhook_at: now,
    }
    const updates: Record<string, any> = {
        config: nextConfig,
        updated_at: now,
    }
    if (!instance.instance_token) {
        updates.instance_token = connectyHubInstanceId
    }

    const { error } = await supabase
        .from('whatsapp_instances')
        .update(updates)
        .eq('id', instance.id)
    if (error) {
        console.warn('[Webhook] Failed to persist ConnectyHub instance id:', error.message)
    }

    return {
        ...instance,
        config: nextConfig,
        instance_token: connectyHubInstanceId || instance.instance_token,
    }
}

async function syncConnectionWebhookStatus(params: {
    supabase: ReturnType<typeof getSupabase>
    instanceName: string
    connectyHubInstanceId?: string
    body: any
}) {
    const { supabase, instanceName, connectyHubInstanceId, body } = params
    const token = webhookText(body?.token)
    const status = normalizeWhatsAppConnectionStatus(body)
    const ownerPhone = String(body?.owner || body?.instance?.owner || '').replace(/\D/g, '') || null
    const lastDisconnect = webhookText(body?.instance?.lastDisconnect)
    const lastDisconnectReason = webhookText(body?.instance?.lastDisconnectReason)

    if (!status) {
        return { synced: false, reason: 'unknown_connection_status', status: null }
    }

    let query = supabase
        .from('whatsapp_instances')
        .select('id, connected_at, config')
        .limit(1)

    if (instanceName) {
        query = query.eq('instance_name', instanceName)
    } else if (connectyHubInstanceId) {
        query = query.eq('instance_token', connectyHubInstanceId)
    } else if (token) {
        query = query.eq('instance_token', token)
    } else {
        return { synced: false, reason: 'missing_instance_identifier', status }
    }

    let { data: rows, error: findError } = await query
    if (!findError && connectyHubInstanceId && !instanceName && (!rows || rows.length === 0)) {
        const fallback = await supabase
            .from('whatsapp_instances')
            .select('id, connected_at, config')
            .contains('config', { connectyhub_instance_id: connectyHubInstanceId })
            .limit(1)
        rows = fallback.data
        findError = fallback.error
    }
    if (findError) throw findError
    const instance = Array.isArray(rows) ? rows[0] : rows
    if (!instance?.id) return { synced: false, reason: 'instance_not_found', status }

    const config = instance.config && typeof instance.config === 'object' ? instance.config : {}
    const nextConfig: Record<string, any> = lastDisconnect || lastDisconnectReason
        ? {
            ...config,
            last_disconnect_at: lastDisconnect || config.last_disconnect_at || null,
            last_disconnect_reason: lastDisconnectReason || config.last_disconnect_reason || null,
        }
        : config
    if (connectyHubInstanceId) {
        nextConfig.connectyhub_instance_id = connectyHubInstanceId
        nextConfig.connectyhub_last_event = 'connection'
        nextConfig.connectyhub_last_webhook_at = new Date().toISOString()
    }

    const updates: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
        config: nextConfig,
    }
    if (ownerPhone) updates.phone_number = ownerPhone
    if (status === 'connected') updates.connected_at = instance.connected_at || new Date().toISOString()
    if (status === 'disconnected') updates.connected_at = null

    const { error: updateError } = await supabase
        .from('whatsapp_instances')
        .update(updates)
        .eq('id', instance.id)
    if (updateError) throw updateError

    return { synced: true, status, instance_id: instance.id }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WEBHOOK DISPATCHER â€” Recebe â†’ Dispara evento Inngest â†’ 200 OK
// Sem processamento pesado. Retorno imediato.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function updateCommandStatusSafe(
    supabase: ReturnType<typeof getSupabase>,
    commandId: string | null | undefined,
    status: string,
    result: Record<string, unknown>,
) {
    if (!commandId) return
    try {
        await supabase
            .from('whatsapp_global_commands')
            .update({
                status,
                result,
                updated_at: new Date().toISOString(),
            })
            .eq('id', commandId)
    } catch (error) {
        console.warn('[Webhook] Failed to update WhatsApp Global command status:', error)
    }
}

export async function POST(request: NextRequest) {
    try {
        const contentLength = Number(request.headers.get('content-length') || 0)
        if (contentLength > MAX_WEBHOOK_BODY_SIZE) {
            console.warn(`[Webhook] Ignored oversized payload: ${contentLength} bytes`)
            return NextResponse.json({ success: true, action: 'ignored_large_payload' }, { status: 202 })
        }

        const body = await request.json()
        const supabase = getSupabase()
        const auditPayload = compactAuditPayload(body)

        // â”€â”€ DEBUG: Log the incoming payload (truncated) â”€â”€
        console.log('[Webhook] ðŸ“© Payload:', JSON.stringify(body).substring(0, 500))

        // â”€â”€ Extract event type â”€â”€
        const eventPayload = body.event && typeof body.event === 'object' && !Array.isArray(body.event)
            ? body.event
            : null
        const event = request.headers.get('x-connectyhub-event') || (typeof body.event === 'string'
            ? body.event
            : (body.EventType || body.action || ''))
        const messageData = extractWebhookMessageData(body, eventPayload, event)
        const connectyHubInstanceId = extractConnectyHubInstanceId(request.headers, body, eventPayload)
        const connectyHubWebhookEventId = webhookText(request.headers.get('x-connectyhub-webhook-event-id'))
            || webhookText(body?.webhookEventId)
            || webhookText(body?.webhook_event_id)
        const instanceName = extractWebhookInstanceName(body, messageData)
        let auditPhone: string | null = null
        let auditSenderName: string | null = null
        let auditLeadId: string | null = null
        let auditMessageType: string | null = null
        let auditIsFromMe = false
        const auditMedia: any[] = []

        const saveAudit = async (params: { action: string; statusCode?: number; error?: string }) => {
            const createdAt = new Date().toISOString()
            const auditRow = {
                instance_name: instanceName || null,
                event_type: event || null,
                message_type: auditMessageType,
                action: params.action,
                status_code: params.statusCode || 200,
                is_from_me: auditIsFromMe,
                from_phone: auditPhone,
                lead_id: auditLeadId,
                sender_name: auditSenderName,
                payload: auditPayload,
                media: auditMedia,
                error: params.error || null,
                created_at: createdAt,
            }
            try {
                const { error: auditError } = await supabase.from('whatsapp_webhook_audit_logs').insert(auditRow)
                if (auditError) throw auditError
            } catch (e) {
                console.warn('[Webhook][Audit] Failed to save audit row:', e)
                try {
                    const key = `_webhooklog_${createdAt.replace(/\D/g, '')}_${Math.random().toString(36).slice(2, 10)}`
                    await supabase.from('app_config').insert({
                        key,
                        value: JSON.stringify({
                            id: key,
                            ...auditRow,
                            fallback_reason: e instanceof Error ? e.message : String(e),
                        }),
                        updated_at: createdAt,
                    })
                } catch (fallbackError) {
                    console.warn('[Webhook][Audit] Failed to save fallback audit row:', fallbackError)
                }
            }
        }

        const eventKey = String(event).toLowerCase()

        if (eventKey === 'presence') {
            const tracked = await savePresenceEvent({ supabase, instanceName, body, messageData })
            auditPhone = (tracked as any)?.phone || null
            await saveAudit({ action: (tracked as any)?.tracked ? 'presence_tracked' : 'presence_ignored' })
            return NextResponse.json({ success: true, action: (tracked as any)?.tracked ? 'presence_tracked' : 'presence_ignored', tracked })
        }

        if (eventKey === 'connection' || eventKey === 'status') {
            const connectionBody = messageData && typeof messageData === 'object' && !Array.isArray(messageData)
                ? { ...body, ...messageData }
                : body
            const synced = await syncConnectionWebhookStatus({ supabase, instanceName, connectyHubInstanceId, body: connectionBody })
            await saveAudit({ action: synced.synced ? 'connection_status_synced' : 'connection_status_ignored' })
            return NextResponse.json({ success: true, action: synced.synced ? 'connection_status_synced' : 'connection_status_ignored', synced })
        }

        if (eventKey === 'history') {
            const history = await saveHistoryWebhookMessages({ supabase, instanceName, payload: body })
            await saveAudit({ action: 'history_messages_saved' })
            return NextResponse.json({ success: true, action: 'history_messages_saved', history })
        }

        const updateKind = String(messageData?.Type || messageData?.type || '').toLowerCase()
        if (eventKey === 'messages_update' && updateKind === 'filedownloaded') {
            const fileUrl = messageData.FileURL
                || messageData.fileURL
                || messageData.fileUrl
                || messageData.url
                || messageData.URL
                || null
            const mime = messageData.MimeType || messageData.mimeType || messageData.mimetype || null
            const idsRaw = messageData.MessageIDs
                || messageData.messageIDs
                || messageData.messageIds
                || messageData.ids
                || messageData.IDs
                || messageData.id
                || null
            const messageIds = (Array.isArray(idsRaw) ? idsRaw : [idsRaw])
                .map((id) => String(id || '').trim())
                .filter(Boolean)
            const rawChat = messageData.Chat || messageData.chat || messageData.Sender || messageData.sender || ''
            const mediaPhone = String(rawChat).replace(/@.+$/, '').replace(/\D/g, '')
            auditPhone = mediaPhone || null
            auditMessageType = mediaKindFromMime(mime)

            if (!fileUrl || messageIds.length === 0) {
                console.warn('[Webhook] FileDownloaded ignored: missing fileUrl or message id')
                await saveAudit({ action: 'media_file_downloaded_incomplete' })
                return NextResponse.json({ success: true, action: 'media_file_downloaded_incomplete' })
            }

            let artifact: any = {
                media_kind: auditMessageType,
                original_url: fileUrl,
                stored_url: fileUrl,
                r2_url: null,
                mime,
                message_ids: messageIds,
            }
            try {
                artifact = await saveInboundMediaArtifact({
                    supabase,
                    instanceName,
                    phone: mediaPhone,
                    fileUrl,
                    mime,
                    mediaKind: auditMessageType,
                    messageIds,
                })
            } catch (e) {
                console.warn('[Webhook] Failed to persist inbound media artifact:', e)
            }

            const storedUrl = artifact?.stored_url || artifact?.r2_url || fileUrl
            const rows = messageIds.map((messageId) => ({
                key: `_wmedia_${messageId}`,
                value: JSON.stringify({
                    url: storedUrl,
                    r2Url: artifact?.r2_url || null,
                    originalUrl: fileUrl,
                    mime,
                    phone: mediaPhone || null,
                    instanceName: instanceName || null,
                    filename: artifact?.filename || null,
                    storage: storedUrl === fileUrl ? 'connectyhub' : 'r2',
                    receivedAt: new Date().toISOString(),
                }),
                updated_at: new Date().toISOString(),
            }))

            await supabase.from('app_config').upsert(rows, { onConflict: 'key' })
            auditMedia.push({ ...artifact, message_ids: messageIds })
            console.log(`[Webhook] Media file ready for ${mediaPhone || 'unknown'} (${messageIds.join(', ')}): ${String(storedUrl).substring(0, 120)}`)
            await saveAudit({ action: 'media_file_ready' })
            return NextResponse.json({ success: true, action: 'media_file_ready', messageIds })
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
        const contentTypeHint = String(
            msgType
            || msgMessageType
            || chatLastMsgType
            || messageData.content?.type
            || messageData.media?.type
            || ''
        ).toLowerCase()
        const genericMediaKind = contentMime.startsWith('image/')
            || ['image', 'imagem', 'photo', 'picture', 'imagemessage'].includes(contentTypeHint)
            ? 'image'
            : contentMime.startsWith('video/')
                || ['video', 'videomessage'].includes(contentTypeHint)
                ? 'video'
                : contentMime.startsWith('application/')
                    || contentMime.includes('pdf')
                    || ['document', 'documentmessage', 'file'].includes(contentTypeHint)
                    ? 'document'
                    : null

        const documentMsg = messageData.message?.documentMessage
            || messageData.message?.documentWithCaptionMessage?.message?.documentMessage
            || messageData.documentMessage
            || (genericMediaKind === 'document' ? messageData.content || messageData.media || null : null)
            || null
        const imageMsg = messageData.message?.imageMessage
            || messageData.imageMessage
            || (genericMediaKind === 'image' ? messageData.content || messageData.media || null : null)
            || null
        const videoMsg = messageData.message?.videoMessage
            || messageData.videoMessage
            || (genericMediaKind === 'video' ? messageData.content || messageData.media || null : null)
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
        const quotedReplyText = extractQuotedReplyText(messageData)

        // â”€â”€ Determine message type â”€â”€
        const messageType = isAudio ? 'audio'
            : isButtonResponse ? 'button_response'
            : isPollResponse ? 'poll_response'
            : isLocation ? 'location'
            : isDocument ? (mediaType || 'document')
            : isReaction ? 'reaction'
            : 'text'
        auditMessageType = messageType

        let storedMessageContent = messageText || ''
        if (!storedMessageContent && isButtonResponse) {
            storedMessageContent = buttonResponseTitle || `[botao: ${buttonResponseId}]`
        } else if (!storedMessageContent && isPollResponse) {
            storedMessageContent = `[enquete: ${Array.isArray(pollVotes) ? pollVotes.join(', ') : pollVotes}]`
        } else if (!storedMessageContent && isLocation) {
            storedMessageContent = `[localizacao: ${receivedLatitude}, ${receivedLongitude}]`
        } else if (!storedMessageContent && isAudio) {
            storedMessageContent = '[audio]'
        } else if (!storedMessageContent && isDocument) {
            storedMessageContent = `[${mediaType || 'midia'}${mediaFilename ? `: ${mediaFilename}` : ''}]`
        } else if (!storedMessageContent && isReaction) {
            storedMessageContent = `[reacao: ${reactionEmoji}]`
        }
        if (storedMessageContent && quotedReplyText) {
            storedMessageContent = `[mensagem citada: ${quotedReplyText}]\n${storedMessageContent}`
        }

        // â”€â”€ Extract media decryption data (WhatsApp E2EE media keys) â”€â”€
        const audioMediaKey = messageData.content?.mediaKey || messageData.message?.audioMessage?.mediaKey || null
        const audioDirectPath = messageData.content?.directPath || messageData.message?.audioMessage?.directPath || null

        // Extract message ID for ConnectyHub media download fallback.
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
                console.log('[Webhook] No direct audioUrl; agent will use ConnectyHub media download with messageId')
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
            if (!senderName && leadByPhone?.name && !isGenericWhatsAppLeadName(leadByPhone.name)) senderName = String(leadByPhone.name)
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
                .select('id, instance_name, instance_token, phone_number, broker_id, admin_user_id, status, config, instance_type')
                .eq('instance_name', instanceName)
                .maybeSingle()
            instance = data
        }

        if (!instance && connectyHubInstanceId) {
            const { data } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_name, instance_token, phone_number, broker_id, admin_user_id, status, config, instance_type')
                .eq('instance_token', connectyHubInstanceId)
                .maybeSingle()
            instance = data
        }

        if (!instance && connectyHubInstanceId) {
            const { data } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_name, instance_token, phone_number, broker_id, admin_user_id, status, config, instance_type')
                .contains('config', { connectyhub_instance_id: connectyHubInstanceId })
                .maybeSingle()
            instance = data
        }

        if (!instance) {
            const { data } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_name, instance_token, phone_number, broker_id, admin_user_id, status, config, instance_type')
                .eq('status', 'connected')
                .limit(1)
                .maybeSingle()
            instance = data
        }

        if (!instance) {
            console.error(`[Webhook] âŒ No instance found. instanceName: ${instanceName}`)
            await saveAudit({ action: 'instance_not_found', statusCode: 404 })
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        if (connectyHubInstanceId) {
            instance = await rememberConnectyHubInstanceId({
                supabase,
                instance,
                connectyHubInstanceId,
                event,
                webhookEventId: connectyHubWebhookEventId,
            })
        }

        console.log(`[Webhook] âœ… Instance: ${instance.instance_name} (broker: ${instance.broker_id || 'none'})`)

        // Anti-loop: ignore inbound messages coming from another connected instance number.
        try {
            const allowInternalInstanceMessages =
                instance?.config?.allow_internal_instance_messages === true ||
                instance?.config?.allow_internal_instance_messages === 'true'
            const senderDigits = normalizePhoneDigits(finalPhone)
            if (senderDigits) {
                const { data: connectedInstances } = await supabase
                    .from('whatsapp_instances')
                    .select('id, phone_number')
                    .eq('status', 'connected')
                const internalSender = (connectedInstances || []).find((row: any) => {
                    const rowDigits = normalizePhoneDigits(row?.phone_number)
                    return row.id !== instance.id && rowDigits && phonesLookSame(rowDigits, senderDigits)
                })
                if (internalSender && !allowInternalInstanceMessages) {
                    console.log(`[Webhook] â›” Ignored internal instance-to-instance message from ${senderDigits}`)
                    await saveAudit({ action: 'ignored_internal_instance_message' })
                    return NextResponse.json({ success: true, action: 'ignored_internal_instance_message' })
                }
                if (internalSender) {
                    console.warn(`[Webhook] Internal instance-to-instance message allowed by config from ${senderDigits}`)
                }
            }
        } catch (e) {
            console.warn('[Webhook] Anti-loop check failed (non-fatal):', e)
        }

        if (!isFromMe && (isButtonResponse || isPollResponse)) {
            try {
                await trackEventInteractionFromWhatsApp(supabase, {
                    phone: finalPhone,
                    messageType,
                    buttonResponseId: buttonResponseId || null,
                    buttonResponseTitle: buttonResponseTitle || null,
                    pollVotes: pollVotes || null,
                    messageId: messageId || null,
                    instanceId: instance.id,
                    instanceName: instance.instance_name,
                })
            } catch (e) {
                console.warn('[Webhook] Event interaction tracking failed:', e)
            }
        }

        let registeredWhatsappIdentity: Awaited<ReturnType<typeof resolveWhatsAppGlobalIdentity>> | null = null
        let registeredWhatsappIntent: ReturnType<typeof detectWhatsAppGlobalCommandIntent> | null = null

        if (!isFromMe) {
            try {
                const hasGlobalMedia = Boolean(
                    isAudio ||
                    isDocument ||
                    isLocation ||
                    mediaUrl ||
                    audioUrl ||
                    auditMedia.length > 0
                )
                const globalIdentity = await resolveWhatsAppGlobalIdentity({
                    supabase,
                    phone: finalPhone,
                    senderName,
                })
                registeredWhatsappIdentity = globalIdentity
                const isGlobalEntrypoint = isWhatsAppGlobalInstance(instance)
                const globalMessageText = storedMessageContent || messageText || ''
                let globalIntent = detectWhatsAppGlobalCommandIntent(globalMessageText, hasGlobalMedia)
                let globalFinanceContext: Awaited<ReturnType<typeof resolveGlobalFinanceContext>> | null = null
                let globalInternalConfigs: Record<string, string> | null = null
                const loadGlobalInternalConfigs = async () => {
                    if (!globalInternalConfigs) {
                        globalInternalConfigs = await loadAIConfigs(supabase, instance?.id).catch(() => ({} as Record<string, string>))
                    }
                    return globalInternalConfigs
                }

                if (globalIdentity.type !== 'lead' && isGlobalEntrypoint && globalIntent.commandType !== 'identity_check') {
                    const sessionForContext = await getOrCreateWhatsAppGlobalSession({
                        supabase,
                        phone: finalPhone,
                        identity: globalIdentity,
                    })
                    globalFinanceContext = await resolveGlobalFinanceContext({
                        text: globalMessageText,
                        hasMedia: hasGlobalMedia,
                        media: auditMedia,
                        session: sessionForContext,
                        identityLabel: globalIdentity.label,
                        configs: await loadGlobalInternalConfigs(),
                    })
                    if (globalFinanceContext.isFinance) {
                        globalIntent = {
                            commandType: 'finance_request',
                            targetAgent: 'finance-ops-agent',
                            requiredPermission: 'finance',
                            label: 'Financeiro',
                        }
                    }
                }

                registeredWhatsappIntent = globalIntent
                const isActionableGlobalIntent = !['general', 'media_received'].includes(globalIntent.commandType)
                const isRecognizedOperatorMessage = globalIdentity.type !== 'lead' &&
                    isWhatsAppGlobalOperatorMessage(globalMessageText, hasGlobalMedia)

                const canHandleProfileAssessmentGate = globalIdentity.type === 'lead'

                if (isGlobalEntrypoint && canHandleProfileAssessmentGate) {
                    const profileAssessmentGate = await maybeHandleProfileAssessmentToolGate({
                        supabase,
                        instance,
                        phone: finalPhone,
                        text: globalMessageText,
                        messageType,
                        mediaUrl: mediaUrl || null,
                        mediaMimetype: mediaMimetype || null,
                        messageId: messageId || null,
                        origin: request.nextUrl.origin,
                        isGlobalLead: globalIdentity.type === 'lead',
                        allowGlobalProfileAssessment: globalIdentity.type !== 'lead',
                        identityType: globalIdentity.type,
                        senderName,
                        saveAudit,
                    })
                    if (profileAssessmentGate.handled) {
                        return NextResponse.json({ success: true, action: profileAssessmentGate.action })
                    }
                }

                if (
                    globalIdentity.type !== 'lead'
                    && isGlobalEntrypoint
                    && hasGlobalMedia
                    && instance.broker_id
                ) {
                    await inngest.send({
                        name: 'whatsapp/message-received',
                        data: {
                            cleanPhone: finalPhone,
                            messageText: globalMessageText,
                            messageType,
                            isAudio,
                            audioUrl,
                            audioMediaKey,
                            audioDirectPath,
                            messageId,
                            buttonResponseId: buttonResponseId || null,
                            buttonResponseTitle: buttonResponseTitle || null,
                            pollVotes: pollVotes || null,
                            mediaUrl: mediaUrl || null,
                            mediaMimetype: mediaMimetype || null,
                            mediaFilename: mediaFilename || null,
                            mediaType: mediaType || null,
                            instanceId: instance.id,
                            instanceToken: instance.instance_token,
                            instanceName: instance.instance_name,
                            brokerId: instance.broker_id || null,
                            senderName,
                            globalIdentity: {
                                type: globalIdentity.type,
                                phone: globalIdentity.phone,
                                label: globalIdentity.label,
                                identityId: globalIdentity.identityId || null,
                                permissions: globalIdentity.permissions,
                                source: globalIdentity.source,
                                confidence: globalIdentity.confidence,
                            },
                            globalMedia: auditMedia,
                        },
                    })

                    await getOrCreateWhatsAppGlobalSession({
                        supabase,
                        phone: finalPhone,
                        identity: globalIdentity,
                        message: {
                            role: 'user',
                            content: globalMessageText || (isAudio ? '[audio]' : `[${mediaType || 'midia'}]`),
                            has_media: true,
                            command_type: globalIntent.commandType,
                            timestamp: new Date().toISOString(),
                        },
                    })

                    await saveAudit({ action: 'whatsapp_global_internal_media_dispatched' })
                    return NextResponse.json({
                        success: true,
                        action: 'whatsapp_global_internal_media_dispatched',
                        identity_type: globalIdentity.type,
                        command_type: globalIntent.commandType,
                    })
                }

                if (globalIdentity.type !== 'lead' && isGlobalEntrypoint && !isActionableGlobalIntent) {
                    const inputForGlobalAgent = globalMessageText || (hasGlobalMedia ? 'Midia recebida sem texto.' : 'Mensagem recebida sem texto.')
                    const session = await getOrCreateWhatsAppGlobalSession({
                        supabase,
                        phone: finalPhone,
                        identity: globalIdentity,
                    })
                    const configs = await loadGlobalInternalConfigs()
                    if (configs['whatsapp_global_agent_enabled'] === 'false') {
                        await saveAudit({ action: 'whatsapp_global_agent_disabled' })
                        return NextResponse.json({ success: true, action: 'whatsapp_global_agent_disabled' })
                    }
                    const outgoingText = await buildGlobalInternalPartnerReply({
                        identityLabel: globalIdentity.label,
                        messageText: inputForGlobalAgent,
                        requestedArea: globalIntent.label,
                        history: buildWhatsAppGlobalConversationHistory(session),
                        configs,
                    })

                    await getOrCreateWhatsAppGlobalSession({
                        supabase,
                        phone: finalPhone,
                        identity: globalIdentity,
                        message: {
                            role: 'user',
                            content: inputForGlobalAgent,
                            has_media: hasGlobalMedia,
                            command_type: globalIntent.commandType,
                            timestamp: new Date().toISOString(),
                        },
                    })

                    if (instance.instance_token && outgoingText) {
                        await sendWhatsAppMessage({
                            phone: finalPhone,
                            message: outgoingText,
                            instanceToken: instance.instance_token,
                        })
                        await getOrCreateWhatsAppGlobalSession({
                            supabase,
                            phone: finalPhone,
                            identity: globalIdentity,
                            message: {
                                role: 'assistant',
                                content: outgoingText,
                                timestamp: new Date().toISOString(),
                            },
                        })
                    }

                    await recordEcosystemEvent({
                        supabase,
                        eventType: 'whatsapp_global_internal_conversation_updated',
                        actorType: 'human',
                        entityType: 'whatsapp_global_session',
                        entityId: session?.id || finalPhone,
                        source: 'whatsapp-global',
                        label: `${globalIdentity.label} conversou com o WhatsApp Global`,
                        importanceScore: globalIdentity.permissions.includes('master_all') ? 78 : 62,
                        metadata: {
                            phone: finalPhone,
                            identity_type: globalIdentity.type,
                            identity_id: globalIdentity.identityId || null,
                            identity_source: globalIdentity.source,
                            permissions: globalIdentity.permissions,
                            command_type: globalIntent.commandType,
                            finance_context: globalFinanceContext,
                            has_media: hasGlobalMedia,
                            instance_id: instance.id || null,
                            instance_name: instance.instance_name || null,
                            replied: Boolean(instance.instance_token && outgoingText),
                        },
                    }).catch(error => {
                        console.warn('[Webhook] WhatsApp Global internal ecosystem event failed:', error?.message || error)
                    })

                    await saveAudit({ action: 'whatsapp_global_internal_identity_handled' })
                    return NextResponse.json({
                        success: true,
                        action: 'whatsapp_global_internal_partner_replied',
                        identity_type: globalIdentity.type,
                        command_type: globalIntent.commandType,
                        replied: Boolean(instance.instance_token && outgoingText),
                    })
                }

                if (globalIdentity.type !== 'lead' && (isRecognizedOperatorMessage || (isGlobalEntrypoint && isActionableGlobalIntent))) {
                    const commandResult = await recordWhatsAppGlobalCommand({
                        supabase,
                        instance,
                        phone: finalPhone,
                        identity: globalIdentity,
                        text: globalMessageText,
                        hasMedia: hasGlobalMedia,
                        intentOverride: globalIntent,
                        payload: {
                            message_type: messageType || null,
                            message_id: messageId || null,
                            sender_name: senderName || null,
                            media: auditMedia,
                            finance_context: globalFinanceContext,
                            entrypoint: isGlobalEntrypoint
                                ? 'whatsapp_global'
                                : 'recognized_operator_message',
                            source_instance_type: instance.instance_type || null,
                            source_instance_name: instance.instance_name || null,
                        },
                    })

                    const isEnabledInternalGlobalCommand = ['finance_request', 'identity_check'].includes(commandResult.intent.commandType)
                    if (!isEnabledInternalGlobalCommand) {
                        const session = await getOrCreateWhatsAppGlobalSession({
                            supabase,
                            phone: finalPhone,
                            identity: globalIdentity,
                        })
                        const configs = await loadGlobalInternalConfigs()
                        const outgoingText = await buildGlobalInternalPartnerReply({
                            identityLabel: globalIdentity.label,
                            messageText: globalMessageText,
                            requestedArea: commandResult.intent.label,
                            history: buildWhatsAppGlobalConversationHistory(session),
                            configs,
                        })
                        await updateCommandStatusSafe(supabase, commandResult.command?.id, 'cancelled', {
                            stage: 'global_internal_sector_disabled',
                            disabled_except: ['finance_request', 'identity_check'],
                            intent: commandResult.intent,
                            cancelled_at: new Date().toISOString(),
                        })
                        await getOrCreateWhatsAppGlobalSession({
                            supabase,
                            phone: finalPhone,
                            identity: globalIdentity,
                            message: {
                                role: 'user',
                                content: globalMessageText || 'Mensagem interna sem texto.',
                                has_media: hasGlobalMedia,
                                command_type: commandResult.intent.commandType,
                                timestamp: new Date().toISOString(),
                            },
                        })
                        if (instance.instance_token && outgoingText) {
                            await sendWhatsAppMessage({
                                phone: finalPhone,
                                message: outgoingText,
                                instanceToken: instance.instance_token,
                            })
                            await getOrCreateWhatsAppGlobalSession({
                                supabase,
                                phone: finalPhone,
                                identity: globalIdentity,
                                message: {
                                    role: 'assistant',
                                    content: outgoingText,
                                    timestamp: new Date().toISOString(),
                                },
                            })
                        }
                        await saveAudit({ action: 'whatsapp_global_internal_sector_disabled' })
                        return NextResponse.json({
                            success: true,
                            action: 'whatsapp_global_internal_sector_disabled',
                            identity_type: globalIdentity.type,
                            command_type: commandResult.intent.commandType,
                            allowed: false,
                        })
                    }

                    const pilgerRoute = resolvePilgerAgentRoute({
                        identity: globalIdentity,
                        intent: commandResult.intent,
                        allowed: commandResult.allowed,
                    })

                    await recordPilgerAgentRoute({
                        supabase,
                        route: pilgerRoute,
                        identity: globalIdentity,
                        command: commandResult.command,
                        instance,
                        text: globalMessageText,
                        hasMedia: hasGlobalMedia,
                        payload: {
                            entrypoint: isGlobalEntrypoint
                                ? 'whatsapp_global'
                                : 'recognized_operator_message',
                            message_type: messageType || null,
                            message_id: messageId || null,
                        },
                    }).catch(error => {
                        console.warn('[Webhook] Pilger agent router handoff failed:', error?.message || error)
                    })

                    let vitorResult: Awaited<ReturnType<typeof processVitorPaidTrafficCommand>> | null = null
                    let editorialResult: Awaited<ReturnType<typeof processPilgerEditorialCommand>> | null = null
                    let financeResult: Awaited<ReturnType<typeof processPilgerFinanceCommand>> | null = null
                    let propertyResult: Awaited<ReturnType<typeof processPilgerPropertyCommand>> | null = null
                    let reportResult: Awaited<ReturnType<typeof processPilgerReportCommand>> | null = null
                    if (
                        commandResult.allowed
                        && commandResult.command?.id
                        && pilgerRoute.executionMode === 'sync_executor'
                        && pilgerRoute.targetAgentId === 'ads-analyst'
                    ) {
                        vitorResult = await processVitorPaidTrafficCommand({
                            supabase,
                            command: commandResult.command,
                            instance,
                            instanceToken: instance.instance_token,
                            sendResponse: false,
                        })
                    }

                    if (
                        commandResult.allowed
                        && commandResult.command?.id
                        && pilgerRoute.executionMode === 'sync_executor'
                        && ['blog-intelligence', 'news-intelligence'].includes(pilgerRoute.targetAgentId)
                    ) {
                        editorialResult = await processPilgerEditorialCommand({
                            supabase,
                            command: {
                                ...commandResult.command,
                                target_agent: pilgerRoute.targetAgentId,
                                required_permission: pilgerRoute.requiredPermission,
                            },
                            instance,
                            instanceToken: instance.instance_token,
                            origin: request.nextUrl.origin,
                        })
                    }

                    if (
                        commandResult.allowed
                        && commandResult.command?.id
                        && pilgerRoute.executionMode === 'sync_executor'
                        && pilgerRoute.targetAgentId === 'finance-ops-agent'
                    ) {
                        financeResult = await processPilgerFinanceCommand({
                            supabase,
                            command: {
                                ...commandResult.command,
                                target_agent: pilgerRoute.targetAgentId,
                                required_permission: pilgerRoute.requiredPermission,
                            },
                            instance,
                            instanceToken: instance.instance_token,
                        })
                    }

                    if (
                        commandResult.allowed
                        && commandResult.command?.id
                        && pilgerRoute.executionMode === 'sync_executor'
                        && pilgerRoute.targetAgentId === 'property-register'
                    ) {
                        propertyResult = await processPilgerPropertyCommand({
                            supabase,
                            command: {
                                ...commandResult.command,
                                target_agent: pilgerRoute.targetAgentId,
                                required_permission: pilgerRoute.requiredPermission,
                            },
                            instance,
                            instanceToken: instance.instance_token,
                            origin: request.nextUrl.origin,
                        })
                    }

                    if (
                        commandResult.allowed
                        && commandResult.command?.id
                        && pilgerRoute.executionMode === 'sync_executor'
                        && pilgerRoute.targetAgentId === 'ceo-agent'
                    ) {
                        reportResult = await processPilgerReportCommand({
                            supabase,
                            command: {
                                ...commandResult.command,
                                target_agent: pilgerRoute.targetAgentId,
                                required_permission: pilgerRoute.requiredPermission,
                            },
                            instance,
                            instanceToken: instance.instance_token,
                        })
                    }

                    if (
                        instance.instance_token
                        && !vitorResult?.whatsappSent
                        && !editorialResult?.whatsappSent
                        && !financeResult?.whatsappSent
                        && !propertyResult?.whatsappSent
                        && !reportResult?.whatsappSent
                    ) {
                        const acknowledgement = vitorResult?.handled
                            ? buildPilgerAgentResultMessage({
                                identity: globalIdentity,
                                route: pilgerRoute,
                                agentReply: vitorResult.responseText,
                            })
                            : financeResult?.handled && financeResult.responseText
                            ? financeResult.responseText
                            : commandResult.intent.commandType === 'identity_check'
                            ? buildWhatsAppGlobalAcknowledgement({
                                identity: globalIdentity,
                                intent: commandResult.intent,
                                allowed: commandResult.allowed,
                            })
                            : buildPilgerAgentRouterAcknowledgement({
                                identity: globalIdentity,
                                route: pilgerRoute,
                            })

                        await sendWhatsAppMessage({
                            phone: finalPhone,
                            message: acknowledgement,
                            instanceToken: instance.instance_token,
                        })
                    }

                    await saveAudit({
                        action: commandResult.allowed
                            ? 'whatsapp_global_command_recorded'
                            : 'whatsapp_global_command_blocked',
                    })
                    return NextResponse.json({
                        success: true,
                        action: vitorResult?.handled
                            ? 'whatsapp_global_paid_traffic_processed'
                            : editorialResult?.handled
                                ? 'whatsapp_global_editorial_processed'
                                : financeResult?.handled
                                    ? 'whatsapp_global_finance_processed'
                                    : propertyResult?.handled
                                        ? 'whatsapp_global_property_processed'
                                        : reportResult?.handled
                                            ? 'whatsapp_global_report_processed'
                            : 'whatsapp_global_command_recorded',
                        identity_type: globalIdentity.type,
                        target_agent: pilgerRoute.targetAgentId,
                        target_agent_name: pilgerRoute.targetAgent.name,
                        execution_mode: pilgerRoute.executionMode,
                        allowed: commandResult.allowed,
                        vitor: vitorResult ? {
                            handled: vitorResult.handled,
                            whatsapp_sent: vitorResult.whatsappSent,
                            creative_id: vitorResult.creativeId || null,
                            review_id: vitorResult.reviewId || null,
                            campaign_plan_id: vitorResult.campaignPlanId || null,
                            decision_action: vitorResult.decisionAction || null,
                            score: vitorResult.score || null,
                            monitoring_health: vitorResult.monitoringHealth || null,
                            monitoring_alerts: vitorResult.monitoringAlerts || null,
                            fallback: Boolean(vitorResult.fallback),
                            error: vitorResult.error || null,
                        } : null,
                        editorial: editorialResult ? {
                            handled: editorialResult.handled,
                            whatsapp_sent: editorialResult.whatsappSent,
                            action: editorialResult.action || null,
                            kind: editorialResult.kind || null,
                            post_id: editorialResult.postId || null,
                            post_title: editorialResult.postTitle || null,
                            status: editorialResult.status || null,
                            error: editorialResult.error || null,
                        } : null,
                        finance: financeResult ? {
                            handled: financeResult.handled,
                            whatsapp_sent: financeResult.whatsappSent,
                            action: financeResult.action || null,
                            counterparty_type: financeResult.counterpartyType || null,
                            pending_command_id: financeResult.pendingCommandId || null,
                            finance_action_id: financeResult.financeActionId || null,
                            error: financeResult.error || null,
                        } : null,
                        property: propertyResult ? {
                            handled: propertyResult.handled,
                            whatsapp_sent: propertyResult.whatsappSent,
                            matched_count: propertyResult.matchedCount || null,
                            selected_count: propertyResult.selectedCount || null,
                            error: propertyResult.error || null,
                        } : null,
                        report: reportResult ? {
                            handled: reportResult.handled,
                            whatsapp_sent: reportResult.whatsappSent,
                            snapshot_count: reportResult.snapshotCount || null,
                            event_count: reportResult.eventCount || null,
                            error: reportResult.error || null,
                        } : null,
                    })
                }
            } catch (e) {
                console.warn('[Webhook] WhatsApp Global identity routing failed, falling back to lead flow:', e)
            }
        }

        if (!isFromMe && instance.broker_id && storedMessageContent?.trim()) {
            try {
                const assistantResult = await handleBrokerAssistantMessage({
                    supabase,
                    instance,
                    brokerId: instance.broker_id,
                    phone: finalPhone,
                    text: storedMessageContent,
                    senderName,
                })
                if (assistantResult.handled) {
                    console.log(`[Webhook] Broker assistant handled ${finalPhone}: ${assistantResult.reason}`)
                    await saveAudit({ action: 'broker_assistant_handled' })
                    return NextResponse.json({ success: true, action: 'broker_assistant_handled' })
                }
            } catch (e) {
                console.warn('[Webhook] Broker assistant mode failed, falling back to lead flow:', e)
            }
        }

        if (!isFromMe && registeredWhatsappIdentity && registeredWhatsappIdentity.type !== 'lead') {
            await saveAudit({ action: 'ignored_registered_internal_message' })
            return NextResponse.json({
                success: true,
                action: 'ignored_registered_internal_message',
                identity_type: registeredWhatsappIdentity.type,
                command_type: registeredWhatsappIntent?.commandType || null,
            })
        }

        let syncedLead: any = null
        if (!isFromMe) {
            try {
                syncedLead = await ensureWhatsAppLead(supabase, {
                    phone: finalPhone,
                    senderName,
                    instanceId: instance.id,
                    instanceName: instance.instance_name,
                    instanceToken: instance.instance_token,
                    brokerId: instance.broker_id || null,
                    acquiredVia: 'whatsapp',
                })
                if (syncedLead?.id) {
                    auditLeadId = syncedLead.id
                    await appendLeadConversationLog(supabase, syncedLead.id, {
                        role: 'user',
                        content: storedMessageContent,
                        type: messageType,
                        source: 'lead',
                        message_id: messageId,
                        instance_id: instance.id,
                        broker_id: instance.broker_id || null,
                    })
                }
            } catch (e) {
                console.warn('[Webhook] Lead sync failed:', e)
            }
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

            try {
                const outboundLead = await ensureWhatsAppLead(supabase, {
                    phone: recipientPhone || finalPhone,
                    senderName: null,
                    instanceId: instance.id,
                    instanceName: instance.instance_name,
                    brokerId: instance.broker_id || null,
                    acquiredVia: 'whatsapp',
                })
                if (outboundLead?.id && storedMessageContent) {
                    auditLeadId = outboundLead.id
                    await appendLeadConversationLog(supabase, outboundLead.id, {
                        role: 'assistant',
                        content: storedMessageContent,
                        type: messageType,
                        source: botMsgId ? 'from_me_pending' : 'human',
                        message_id: botMsgId || messageId,
                        instance_id: instance.id,
                        broker_id: instance.broker_id || null,
                    })
                }
            } catch (e) {
                console.warn('[Webhook] Outbound lead sync failed:', e)
            }

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

        try {
            const botLoop = await enforceBotLoopProtection({
                supabase,
                leadId: syncedLead?.id || auditLeadId,
                instance,
                phone: finalPhone,
            })
            if (botLoop.blocked) {
                console.warn(`[Webhook] Bot/loop protection blocked ${finalPhone}: ${botLoop.reason}`)
                await saveAudit({ action: 'ignored_bot_loop_protection', error: botLoop.reason })
                return NextResponse.json({
                    success: true,
                    action: 'ignored_bot_loop_protection',
                    reason: botLoop.reason,
                })
            }
        } catch (e) {
            console.warn('[Webhook] Bot/loop protection check failed (non-fatal):', e)
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

                await Promise.allSettled(
                    readTargets.map((target) => markAsRead(target, instance.instance_token, messageId))
                )

                // Reliability fallback in background: retries over a few seconds
                // (helps when provider hasn't indexed the inbound message yet).
                await inngest.send({
                    name: 'whatsapp/mark-read',
                    data: {
                        instanceToken: instance.instance_token,
                        remotePhone: remotePhone || null,
                        cleanPhone: finalPhone,
                        messageId: messageId || null,
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

        const isSimpleTextForFastPath = !!storedMessageContent?.trim()
            && !isAudio
            && !isButtonResponse
            && !isPollResponse
            && !isLocation
            && !isDocument
            && !isReaction

        const shouldAnswerGlobalLeadRealtime = isWhatsAppGlobalInstance(instance)
            && registeredWhatsappIdentity?.type === 'lead'
            && Boolean(storedMessageContent?.trim())

        const profileAssessmentGate = await maybeHandleProfileAssessmentToolGate({
            supabase,
            instance,
            phone: finalPhone,
            text: storedMessageContent || messageText || '',
            messageType,
            mediaUrl: mediaUrl || null,
            mediaMimetype: mediaMimetype || null,
            messageId: messageId || null,
            origin: request.nextUrl.origin,
            isGlobalLead: isWhatsAppGlobalInstance(instance) && registeredWhatsappIdentity?.type === 'lead',
            senderName,
            saveAudit,
        })
        if (profileAssessmentGate.handled) {
            return NextResponse.json({ success: true, action: profileAssessmentGate.action })
        }

        if (instance.broker_id && isSimpleTextForFastPath) {
            try {
                const fastResult = await tryFastTextBrokerResponse({
                    supabase,
                    instance,
                    phone: finalPhone,
                    text: storedMessageContent,
                    messageId,
                    messageType,
                    senderName,
                    bypassTimingGuards: shouldAnswerGlobalLeadRealtime,
                })
                if (fastResult.handled) {
                    const action = shouldAnswerGlobalLeadRealtime
                        ? 'responded_global_lead_webhook'
                        : 'responded_fast_webhook'
                    console.log(`[Webhook] ⚡ Fast text response sent for ${finalPhone} (${fastResult.responseLength || 0} chars, action=${action})`)
                    await saveAudit({ action })
                    return NextResponse.json({ success: true, action })
                }
                console.log(`[Webhook] Fast path skipped for ${finalPhone}: ${fastResult.reason}`)
            } catch (e) {
                console.warn('[Webhook] Fast path failed, falling back to Inngest:', e)
            }
        }

        // 2) Queue message for debounce batching (atomic INSERT, no race condition)
        let queuedMessageKey: string | null = null
        try {
            // Build content from various message types
            const msgContent = storedMessageContent

            if (msgContent && !isAudio) {
                await supabase
                    .from('app_config')
                    .delete()
                    .like('key', `_pmq_${finalPhone}_%`)
                    .lt('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

                const queuedPayload = {
                    text: msgContent,
                    type: messageType,
                    mediaType,
                    hasMedia: Boolean(isDocument),
                    hasCaption: Boolean(messageText?.trim() && isDocument),
                    messageId: messageId || null,
                    mediaUrl: mediaUrl || null,
                    mediaMimetype: mediaMimetype || null,
                    mediaFilename: mediaFilename || null,
                    createdAt: new Date().toISOString(),
                }
                const pendingKey = `_pmq_${finalPhone}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
                const { error: queueError } = await supabase.from('app_config').insert({
                    key: pendingKey,
                    value: JSON.stringify(queuedPayload),
                    updated_at: new Date().toISOString()
                })
                if (queueError) {
                    console.warn('[Webhook] Failed to queue pending message:', queueError)
                } else {
                    queuedMessageKey = pendingKey
                    console.log(`[Webhook] ðŸ“ Queued pending message for ${finalPhone} (type: ${messageType})`)
                }
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
                    queuedMessageKey,
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
        const createdAt = new Date().toISOString()
        try {
            const supabase = getSupabase()
            const errorRow = {
                action: 'error',
                status_code: 500,
                payload: {},
                media: [],
                error: String(error),
                created_at: createdAt,
            }
            const { error: auditError } = await supabase.from('whatsapp_webhook_audit_logs').insert(errorRow)
            if (auditError) throw auditError
        } catch (auditError) {
            try {
                const supabase = getSupabase()
                const key = `_webhooklog_${createdAt.replace(/\D/g, '')}_${Math.random().toString(36).slice(2, 10)}`
                await supabase.from('app_config').insert({
                    key,
                    value: JSON.stringify({
                        id: key,
                        event_type: 'webhook_error',
                        action: 'error',
                        status_code: 500,
                        payload: {},
                        media: [],
                        error: String(error),
                        fallback_reason: auditError instanceof Error ? auditError.message : String(auditError),
                        created_at: createdAt,
                    }),
                    updated_at: createdAt,
                })
            } catch {
                // best effort
            }
        }
        return NextResponse.json({ success: false, message: 'Erro no webhook' }, { status: 500 })
    }
}
