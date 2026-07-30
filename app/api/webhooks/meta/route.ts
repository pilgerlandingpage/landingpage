import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { saveMetaWebhookEvent } from '@/lib/social/meta-inbox'
import {
  ingestMetaWebhookMessages,
  ingestMetaWebhookComments,
  processInstagramCommentForDmAutomation,
  processInstagramDirectFlowPostback,
  processInstagramDirectVoteProof,
  shouldAutoprocessWebhook,
} from '@/lib/social/meta-comment-dm-automation'
import { refreshMetaWhatsAppCampaignTotals } from '@/lib/meta/whatsapp-campaigns'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getWebhookConfig() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [
      'meta_webhook_verify_token',
      'meta_whatsapp_webhook_verify_token',
      'meta_app_secret',
      'meta_whatsapp_app_secret',
    ])

  const config: Record<string, string> = {}
  for (const row of data || []) {
    if (row?.key) config[row.key] = String(row.value || '')
  }

  const verifyTokens = [
    config.meta_webhook_verify_token,
    process.env.META_WEBHOOK_VERIFY_TOKEN,
    'pilger-meta-webhook',
    config.meta_whatsapp_webhook_verify_token,
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    'pilger-meta-whatsapp-webhook',
  ].map(value => String(value || '').trim()).filter(Boolean)

  const appSecrets = [
    config.meta_whatsapp_app_secret,
    process.env.META_WHATSAPP_APP_SECRET,
    config.meta_app_secret,
    process.env.META_APP_SECRET,
  ].map(value => String(value || '').trim()).filter(Boolean)

  return {
    verifyTokens: new Set(verifyTokens),
    appSecrets,
  }
}

function parseSignature(value: string | null) {
  const signature = String(value || '').trim()
  if (!signature.toLowerCase().startsWith('sha256=')) return ''
  const digest = signature.slice('sha256='.length)
  return /^[a-f0-9]{64}$/i.test(digest) ? digest.toLowerCase() : ''
}

function isValidMetaSignature(rawBody: string, signatureHeader: string | null, appSecrets: string[]) {
  const provided = parseSignature(signatureHeader)
  if (!provided || appSecrets.length === 0) return false

  const providedBuffer = Buffer.from(provided, 'hex')
  return appSecrets.some(secret => {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const expectedBuffer = Buffer.from(expected, 'hex')
    return providedBuffer.length === expectedBuffer.length
      && timingSafeEqual(providedBuffer, expectedBuffer)
  })
}

function inferPlatformAndType(payload: any) {
  const object = String(payload?.object || '').toLowerCase()
  const firstEntry = payload?.entry?.[0]
  const firstChange = firstEntry?.changes?.[0]
  const firstMessaging = firstEntry?.messaging?.[0]

  const platform = object.includes('instagram')
    ? 'instagram'
    : object.includes('page')
      ? 'facebook'
      : object.includes('whatsapp_business_account')
        ? 'whatsapp'
        : firstChange?.value?.messaging_product === 'whatsapp'
          ? 'whatsapp'
          : firstMessaging?.message?.is_echo
            ? 'facebook'
            : null

  const eventType = firstMessaging
    ? 'message'
    : platform === 'whatsapp'
      ? firstChange?.field || 'messages'
      : firstChange?.field || object || 'unknown'

  const externalId = firstMessaging?.message?.mid
    || firstChange?.value?.statuses?.[0]?.id
    || firstChange?.value?.messages?.[0]?.id
    || firstChange?.value?.comment_id
    || firstChange?.value?.post_id
    || firstEntry?.id
    || null

  return { platform, eventType, externalId }
}

function isWhatsAppPayload(payload: any) {
  const object = String(payload?.object || '').toLowerCase()
  if (object.includes('whatsapp_business_account')) return true
  return Boolean(payload?.entry?.some((entry: any) =>
    entry?.changes?.some((change: any) => change?.value?.messaging_product === 'whatsapp')
  ))
}

function normalizeMetaWhatsAppPhone(value: unknown) {
  return String(value || '').replace(/\D/g, '').slice(0, 20)
}

function timestampToIso(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return new Date().toISOString()
  return new Date(parsed * 1000).toISOString()
}

function normalizeMetaDeliveryStatus(value: unknown) {
  const status = String(value || '').toLowerCase()
  if (status === 'read') return 'read'
  if (status === 'delivered') return 'delivered'
  if (status === 'sent') return 'sent'
  if (status === 'failed') return 'failed'
  return status || 'unknown'
}

function isOptOutText(value: unknown) {
  const text = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return /\b(sair|cancelar|parar|stop|descadastrar|remover)\b/.test(text)
}

async function findMetaWhatsAppSenderId(supabase: ReturnType<typeof createAdminClient>, phoneNumberId?: string) {
  const selected = String(phoneNumberId || '').trim()
  if (!selected) return null

  const { data } = await supabase
    .from('meta_whatsapp_senders')
    .select('id')
    .eq('phone_number_id', selected)
    .maybeSingle()

  return data?.id || null
}

async function findMetaWhatsAppRecipient(supabase: ReturnType<typeof createAdminClient>, providerMessageId?: string) {
  const selected = String(providerMessageId || '').trim()
  if (!selected) return null

  const { data } = await supabase
    .from('meta_whatsapp_campaign_recipients')
    .select('id, campaign_id, sender_id')
    .eq('provider_message_id', selected)
    .maybeSingle()

  return data || null
}

async function ingestMetaWhatsAppWebhook(payload: any) {
  const supabase = createAdminClient()
  let eventsIngested = 0
  let statusesIngested = 0
  let inboundMessagesIngested = 0
  let warning: string | null = null
  const touchedCampaignIds = new Set<string>()

  try {
    for (const entry of payload?.entry || []) {
      for (const change of entry?.changes || []) {
        const value = change?.value || {}
        if (value?.messaging_product !== 'whatsapp' && change?.field !== 'messages') continue

        const senderId = await findMetaWhatsAppSenderId(supabase, value?.metadata?.phone_number_id)

        for (const statusEvent of value?.statuses || []) {
          const providerMessageId = String(statusEvent?.id || '')
          const recipient = await findMetaWhatsAppRecipient(supabase, providerMessageId)
          const status = normalizeMetaDeliveryStatus(statusEvent?.status)
          const receivedAt = timestampToIso(statusEvent?.timestamp)

          if (recipient?.id && ['sent', 'delivered', 'read', 'failed'].includes(status)) {
            const updatePayload: Record<string, unknown> = { status }
            if (status === 'sent') updatePayload.sent_at = receivedAt
            if (status === 'delivered') updatePayload.delivered_at = receivedAt
            if (status === 'read') updatePayload.read_at = receivedAt
            if (status === 'failed') {
              updatePayload.failed_at = receivedAt
              updatePayload.error_code = statusEvent?.errors?.[0]?.code ? String(statusEvent.errors[0].code) : null
              updatePayload.error_message = statusEvent?.errors?.[0]?.message || statusEvent?.errors?.[0]?.title || null
            }

            await supabase
              .from('meta_whatsapp_campaign_recipients')
              .update(updatePayload)
              .eq('id', recipient.id)

            if (recipient.campaign_id) touchedCampaignIds.add(recipient.campaign_id)
          }

          const { error } = await supabase
            .from('meta_whatsapp_events')
            .insert({
              provider_message_id: providerMessageId || null,
              recipient_id: recipient?.id || null,
              campaign_id: recipient?.campaign_id || null,
              sender_id: recipient?.sender_id || senderId,
              event_type: 'status',
              event_status: status,
              recipient_phone: normalizeMetaWhatsAppPhone(statusEvent?.recipient_id),
              payload: statusEvent,
              received_at: receivedAt,
            })

          if (error) throw error
          statusesIngested += 1
          eventsIngested += 1
        }

        for (const message of value?.messages || []) {
          const providerMessageId = String(message?.id || '')
          const fromPhone = normalizeMetaWhatsAppPhone(message?.from)
          const receivedAt = timestampToIso(message?.timestamp)
          const textBody = message?.text?.body || message?.button?.text || message?.interactive?.button_reply?.title || ''

          const { error } = await supabase
            .from('meta_whatsapp_events')
            .insert({
              provider_message_id: providerMessageId || null,
              sender_id: senderId,
              event_type: 'inbound_message',
              event_status: message?.type || 'message',
              recipient_phone: fromPhone,
              payload: message,
              received_at: receivedAt,
            })

          if (error) throw error

          if (fromPhone && isOptOutText(textBody)) {
            await supabase
              .from('meta_whatsapp_opt_outs')
              .upsert({
                phone_e164: fromPhone,
                source: 'meta_whatsapp_webhook',
                reason: 'user_requested_opt_out',
                raw_payload: message,
                requested_at: receivedAt,
              }, { onConflict: 'phone_e164' })
          }

          inboundMessagesIngested += 1
          eventsIngested += 1
        }
      }
    }

    for (const campaignId of touchedCampaignIds) {
      await refreshMetaWhatsAppCampaignTotals(campaignId, supabase)
    }
  } catch (error) {
    warning = error instanceof Error ? error.message : 'Falha ao salvar webhook WhatsApp oficial.'
    console.warn('[Meta WhatsApp Webhook] ingestion warning:', warning)
  }

  return {
    eventsIngested,
    statusesIngested,
    inboundMessagesIngested,
    warning,
  }
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  const webhookConfig = await getWebhookConfig()

  if (mode === 'subscribe' && token && webhookConfig.verifyTokens.has(token) && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
  }

  return NextResponse.json({ success: false, error: 'Webhook Meta nao autorizado.' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const webhookConfig = await getWebhookConfig()
    const signature = request.headers.get('x-hub-signature-256')

    if (signature && webhookConfig.appSecrets.length > 0 && !isValidMetaSignature(rawBody, signature, webhookConfig.appSecrets)) {
      return NextResponse.json({ success: false, error: 'Assinatura Meta invalida.' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody || '{}')
    const { platform, eventType, externalId } = inferPlatformAndType(payload)
    const whatsappPayload = isWhatsAppPayload(payload)

    if (!whatsappPayload) {
      await saveMetaWebhookEvent(payload, platform || undefined, eventType || undefined, externalId || undefined)
    }

    const automation: Array<unknown> = []
    let commentsIngested = 0
    let messagesIngested = 0
    let automationWarning: string | null = null
    const whatsapp = whatsappPayload
      ? await ingestMetaWhatsAppWebhook(payload)
      : null

    if (!whatsappPayload) {
      try {
        const comments = await ingestMetaWebhookComments(payload)
        const messages = await ingestMetaWebhookMessages(payload)
        commentsIngested = comments.length
        messagesIngested = messages.length

        if ((comments.length > 0 || messages.length > 0) && await shouldAutoprocessWebhook()) {
          for (const comment of comments.filter(item => ['instagram', 'facebook'].includes(item.platform)).slice(0, 8)) {
            automation.push(await processInstagramCommentForDmAutomation({
              commentId: comment.id,
              source: 'meta_webhook',
            }))
          }
          for (const message of messages.filter(item => item.platform === 'instagram').slice(0, 8)) {
            const flowPostback = await processInstagramDirectFlowPostback(message)
            automation.push(flowPostback)
            if (!flowPostback.processed) {
              automation.push(await processInstagramDirectVoteProof(message))
            }
          }
        }
      } catch (automationError) {
        automationWarning = automationError instanceof Error ? automationError.message : 'Falha ao processar automacao Meta.'
        console.warn('[Meta Webhook] Comment DM automation warning:', automationWarning)
      }
    }

    return NextResponse.json({
      success: true,
      platform,
      comments_ingested: commentsIngested,
      messages_ingested: messagesIngested,
      whatsapp,
      automation,
      automation_warning: automationWarning,
    })
  } catch (error) {
    console.error('Error processing Meta webhook:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro no webhook Meta.',
      },
      { status: 500 },
    )
  }
}
