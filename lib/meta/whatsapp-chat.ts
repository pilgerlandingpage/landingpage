import { createAdminClient } from '@/lib/supabase/server'
import {
  loadMetaWhatsAppConfigMap,
  normalizeMetaWhatsAppPhone,
  sendMetaWhatsAppAudioMessage,
  sendMetaWhatsAppTextMessage,
} from '@/lib/meta/whatsapp-cloud'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

type ConversationStatus = 'open' | 'pending' | 'closed' | 'archived'

export interface RecordInboundMetaWhatsAppMessageInput {
  providerMessageId?: string | null
  senderId?: string | null
  phoneNumberId?: string | null
  fromPhone: string
  profileName?: string | null
  messageType?: string | null
  payload?: Record<string, unknown>
  receivedAt?: string
  eventId?: string | null
}

export interface RecordMetaWhatsAppStatusInput {
  providerMessageId?: string | null
  status: string
  receivedAt?: string
  errorCode?: string | null
  errorMessage?: string | null
}

export interface ListMetaWhatsAppConversationsInput {
  status?: string | null
  search?: string | null
  limit?: number
}

export interface SendMetaWhatsAppChatReplyInput {
  conversationId: string
  text: string
  previewUrl?: boolean
}

export interface SendMetaWhatsAppChatAudioReplyInput {
  conversationId: string
  audioUrl: string
  textFallback?: string | null
}

function cleanText(value: unknown, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength)
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function isoNow() {
  return new Date().toISOString()
}

function plusHours(value: string, hours: number) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return isoNow()
  date.setHours(date.getHours() + hours)
  return date.toISOString()
}

function toTimestamp(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function messagePreview(value: unknown) {
  const text = cleanText(value, 180).replace(/\s+/g, ' ')
  return text || 'Mensagem recebida'
}

function normalizeStatus(value: unknown) {
  const selected = cleanText(value, 40).toLowerCase()
  if (selected === 'read') return 'read'
  if (selected === 'delivered') return 'delivered'
  if (selected === 'sent') return 'sent'
  if (selected === 'failed') return 'failed'
  return selected || 'received'
}

function normalizeConversationStatus(value?: string | null): ConversationStatus | '' {
  const selected = cleanText(value, 20).toLowerCase()
  return ['open', 'pending', 'closed', 'archived'].includes(selected)
    ? selected as ConversationStatus
    : ''
}

function extractInboundText(payload?: Record<string, unknown>, fallbackType?: string | null) {
  const source = asRecord(payload)
  const text = asRecord(source.text)
  const button = asRecord(source.button)
  const interactive = asRecord(source.interactive)
  const buttonReply = asRecord(interactive.button_reply)
  const listReply = asRecord(interactive.list_reply)
  const image = asRecord(source.image)
  const video = asRecord(source.video)
  const document = asRecord(source.document)

  return cleanText(text.body, 4096)
    || cleanText(button.text, 4096)
    || cleanText(buttonReply.title, 4096)
    || cleanText(listReply.title, 4096)
    || cleanText(image.caption, 4096)
    || cleanText(video.caption, 4096)
    || cleanText(document.caption, 4096)
    || (cleanText(fallbackType, 80) ? `[${cleanText(fallbackType, 80)}]` : 'Mensagem recebida')
}

async function findSender(
  supabase: SupabaseAdmin,
  senderId?: string | null,
  phoneNumberId?: string | null
) {
  if (senderId) {
    const { data, error } = await supabase
      .from('meta_whatsapp_senders')
      .select('id, display_name, phone_number, phone_number_id, waba_id, meta_status, local_status')
      .eq('id', senderId)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  const selectedPhoneNumberId = cleanText(phoneNumberId, 120)
  if (!selectedPhoneNumberId) return null

  const { data, error } = await supabase
    .from('meta_whatsapp_senders')
    .select('id, display_name, phone_number, phone_number_id, waba_id, meta_status, local_status')
    .eq('phone_number_id', selectedPhoneNumberId)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function findLatestCampaignRecipient(
  supabase: SupabaseAdmin,
  phone: string,
  senderId?: string | null
) {
  let query = supabase
    .from('meta_whatsapp_campaign_recipients')
    .select(`
      id,
      campaign_id,
      sender_id,
      lead_id,
      recipient_name,
      recipient_phone,
      provider_message_id,
      status,
      error_code,
      error_message,
      sent_at,
      delivered_at,
      read_at,
      failed_at,
      created_at,
      template_parameters,
      campaign:meta_whatsapp_campaigns(id, name, template_name, template_language, campaign_type)
    `)
    .eq('recipient_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)

  if (senderId) query = query.eq('sender_id', senderId)

  const { data, error } = await query
  if (error) throw error
  return data?.[0] || null
}

async function ensureCampaignOutboundMessage(
  supabase: SupabaseAdmin,
  conversationId: string,
  recipient: any,
  leadId?: string | null
) {
  const providerMessageId = cleanText(recipient?.provider_message_id, 200)
  if (!providerMessageId) return

  const { data: existingMessage, error: existingMessageError } = await supabase
    .from('meta_whatsapp_messages')
    .select('id')
    .eq('provider_message_id', providerMessageId)
    .maybeSingle()
  if (existingMessageError) throw existingMessageError
  if (existingMessage?.id) return

  const campaign = Array.isArray(recipient?.campaign) ? recipient.campaign[0] : recipient?.campaign
  const createdAt = recipient?.sent_at || recipient?.created_at || isoNow()
  const status = normalizeStatus(recipient?.status || 'sent')

  const { error } = await supabase
    .from('meta_whatsapp_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: recipient.sender_id || null,
      campaign_id: recipient.campaign_id || null,
      recipient_id: recipient.id || null,
      lead_id: leadId || recipient.lead_id || null,
      provider_message_id: providerMessageId,
      direction: 'outbound',
      message_type: 'template',
      text_body: campaign?.template_name
        ? `Template ${campaign.template_name}`
        : 'Mensagem de campanha Meta WhatsApp',
      status,
      error_code: recipient.error_code || null,
      error_message: recipient.error_message || null,
      payload: {
        source: 'campaign_recipient',
        campaign_name: campaign?.name || null,
        template_name: campaign?.template_name || null,
        template_language: campaign?.template_language || null,
        template_parameters: recipient.template_parameters || null,
      },
      sent_at: recipient.sent_at || null,
      delivered_at: recipient.delivered_at || null,
      read_at: recipient.read_at || null,
      failed_at: recipient.failed_at || null,
      created_at: createdAt,
    })
  if (error) throw error
}

async function findLeadByPhone(supabase: SupabaseAdmin, phone: string) {
  if (!phone) return null
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, email, phone, phone_e164, funnel_stage, lead_classification, lead_purpose, lead_budget, avatar_url, avatar_source, avatar_updated_at, created_at, updated_at')
    .or(`phone.eq.${phone},phone_e164.eq.${phone}`)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) return null
  return data?.[0] || null
}

function isPublicImageUrl(value: unknown) {
  const text = cleanText(value, 1200)
  return /^https?:\/\/.+\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(text)
    || /^https?:\/\/.+(profile|avatar|image|photo|pic|picture)/i.test(text)
}

function isHttpUrl(value: unknown) {
  return /^https?:\/\//i.test(cleanText(value, 1200))
}

function extractCachedAvatarUrl(value: unknown, depth = 0): string | null {
  if (depth > 4) return null
  if (isPublicImageUrl(value)) return cleanText(value, 1200)

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractCachedAvatarUrl(item, depth + 1)
      if (nested) return nested
    }
    return null
  }

  const record = asRecord(value)
  if (!Object.keys(record).length) return null

  const priorityKeys = [
    'imagePreview',
    'profilePicUrl',
    'profile_pic_url',
    'profilePictureUrl',
    'profile_picture_url',
    'profileImageUrl',
    'profile_image_url',
    'avatarUrl',
    'avatar_url',
    'picture',
    'photo',
    'image',
    'avatar',
    'url',
  ]

  for (const key of priorityKeys) {
    const candidate = record[key]
    if (isHttpUrl(candidate)) return cleanText(candidate, 1200)
  }

  for (const key of priorityKeys) {
    const nested = extractCachedAvatarUrl(record[key], depth + 1)
    if (nested) return nested
  }

  for (const nested of Object.values(record)) {
    const found = extractCachedAvatarUrl(nested, depth + 1)
    if (found) return found
  }

  return null
}

function uniqueTextValues(values: unknown[]) {
  return Array.from(new Set(values.map(value => cleanText(value, 120)).filter(Boolean)))
}

function contactLookupPhones(phone: unknown) {
  const digits = normalizeMetaWhatsAppPhone(phone)
  if (!digits) return []
  const candidates = [digits]
  if (digits.startsWith('55') && digits.length > 11) candidates.push(digits.slice(2))
  if (!digits.startsWith('55') && digits.length >= 10) candidates.push(`55${digits}`)
  return uniqueTextValues(candidates)
}

function contactLookupJids(phone: unknown) {
  return contactLookupPhones(phone).flatMap(value => [`${value}@s.whatsapp.net`, `${value}@c.us`])
}

function mapContactAvatar(map: Map<string, string>, key: unknown, avatarUrl: string) {
  const phones = contactLookupPhones(key)
  phones.forEach(phone => map.set(phone, avatarUrl))
}

async function loadConnectyHubContactAvatarMap(
  supabase: SupabaseAdmin,
  phones: unknown[]
) {
  const phoneKeys = uniqueTextValues(phones.flatMap(phone => contactLookupPhones(phone)))
  const jidKeys = uniqueTextValues(phones.flatMap(phone => contactLookupJids(phone)))
  const avatarMap = new Map<string, string>()

  async function loadContactRows(column: 'phone' | 'jid', values: string[]) {
    if (!values.length) return []
    const { data, error } = await supabase
      .from('whatsapp_instance_contacts')
      .select('phone,jid,raw,last_synced_at')
      .in(column, values)
      .order('last_synced_at', { ascending: false })
      .limit(300)

    if (error) {
      console.warn('[Meta WhatsApp Chat] contact avatar lookup failed:', error.message)
      return []
    }
    return data || []
  }

  async function loadChatRows(column: 'phone' | 'chat_id', values: string[]) {
    if (!values.length) return []
    const { data, error } = await supabase
      .from('whatsapp_instance_chats')
      .select('phone,chat_id,raw,last_synced_at')
      .in(column, values)
      .order('last_synced_at', { ascending: false })
      .limit(300)

    if (error) {
      console.warn('[Meta WhatsApp Chat] chat avatar lookup failed:', error.message)
      return []
    }
    return data || []
  }

  const contactRows = [
    ...await loadContactRows('phone', phoneKeys),
    ...await loadContactRows('jid', jidKeys),
  ]

  const chatRows = [
    ...await loadChatRows('phone', phoneKeys),
    ...await loadChatRows('chat_id', jidKeys),
  ]

  for (const row of contactRows) {
    const raw = asRecord(row?.raw)
    const avatarUrl = extractCachedAvatarUrl(raw) || extractCachedAvatarUrl(row)
    if (!avatarUrl) continue

    mapContactAvatar(avatarMap, row?.phone, avatarUrl)
    mapContactAvatar(avatarMap, String(row?.jid || '').split('@')[0], avatarUrl)
  }

  for (const row of chatRows) {
    const raw = asRecord(row?.raw)
    const avatarUrl = extractCachedAvatarUrl(raw) || extractCachedAvatarUrl(row)
    if (!avatarUrl) continue

    mapContactAvatar(avatarMap, row?.phone, avatarUrl)
    mapContactAvatar(avatarMap, String(row?.chat_id || '').split('@')[0], avatarUrl)
  }

  return avatarMap
}

function firstRelation(value: unknown) {
  return Array.isArray(value) ? value[0] : value
}

function enrichConversationWithAvatar(conversation: any, avatarMap: Map<string, string>) {
  const lead = firstRelation(conversation?.lead) as Record<string, unknown> | null
  if (lead?.avatar_url) return conversation

  const avatarUrl = contactLookupPhones(conversation?.contact_phone)
    .map(phone => avatarMap.get(phone))
    .find(Boolean)

  if (!avatarUrl) return conversation

  const enrichedLead = {
    ...(lead || {}),
    avatar_url: avatarUrl,
    avatar_source: lead?.avatar_source || 'connectyhub_contact_cache',
    avatar_updated_at: lead?.avatar_updated_at || null,
  }

  return {
    ...conversation,
    lead: Array.isArray(conversation?.lead) ? [enrichedLead] : enrichedLead,
  }
}

async function enrichConversationsWithContactAvatars(supabase: SupabaseAdmin, conversations: any[]) {
  if (!conversations.length) return conversations
  const needsAvatar = conversations.filter(conversation => {
    const lead = firstRelation(conversation?.lead) as Record<string, unknown> | null
    return !lead?.avatar_url
  })
  if (!needsAvatar.length) return conversations

  const avatarMap = await loadConnectyHubContactAvatarMap(
    supabase,
    needsAvatar.map(conversation => conversation.contact_phone)
  )
  if (!avatarMap.size) return conversations

  return conversations.map(conversation => enrichConversationWithAvatar(conversation, avatarMap))
}

async function findConversation(
  supabase: SupabaseAdmin,
  senderId: string,
  contactPhone: string
) {
  const { data, error } = await supabase
    .from('meta_whatsapp_conversations')
    .select('*')
    .eq('sender_id', senderId)
    .eq('contact_phone', contactPhone)
    .maybeSingle()

  if (error) throw error
  return data || null
}

export async function recordInboundMetaWhatsAppMessage(
  input: RecordInboundMetaWhatsAppMessageInput,
  supabase = createAdminClient()
) {
  const contactPhone = normalizeMetaWhatsAppPhone(input.fromPhone)
  const sender = await findSender(supabase, input.senderId, input.phoneNumberId)
  if (!sender?.id || !contactPhone) return null

  const receivedAt = input.receivedAt || isoNow()
  const textBody = extractInboundText(input.payload, input.messageType)
  const latestRecipient = await findLatestCampaignRecipient(supabase, contactPhone, sender.id)
  const lead = latestRecipient?.lead_id ? null : await findLeadByPhone(supabase, contactPhone)
  const leadId = latestRecipient?.lead_id || lead?.id || null
  const contactName = cleanText(input.profileName || latestRecipient?.recipient_name || lead?.name, 160) || null
  const customerWindowExpiresAt = plusHours(receivedAt, 24)
  const existing = await findConversation(supabase, sender.id, contactPhone)
  const providerMessageId = cleanText(input.providerMessageId, 200) || null

  if (providerMessageId) {
    const { data: existingMessage, error: existingMessageError } = await supabase
      .from('meta_whatsapp_messages')
      .select('id')
      .eq('provider_message_id', providerMessageId)
      .maybeSingle()
    if (existingMessageError) throw existingMessageError
    if (existingMessage?.id) return existing
  }

  let conversation = existing
  if (!conversation) {
    const { data, error } = await supabase
      .from('meta_whatsapp_conversations')
      .insert({
        sender_id: sender.id,
        waba_id: sender.waba_id,
        phone_number_id: sender.phone_number_id,
        contact_phone: contactPhone,
        contact_name: contactName,
        lead_id: leadId,
        last_campaign_id: latestRecipient?.campaign_id || null,
        last_recipient_id: latestRecipient?.id || null,
        status: 'open',
        unread_count: 1,
        last_message_preview: messagePreview(textBody),
        last_message_at: receivedAt,
        last_inbound_at: receivedAt,
        customer_window_expires_at: customerWindowExpiresAt,
        metadata: {
          first_source: 'meta_whatsapp_webhook',
          first_event_id: input.eventId || null,
        },
      })
      .select('*')
      .single()
    if (error) throw error
    conversation = data
  } else {
    const unreadCount = Number(existing.unread_count || 0) + 1
    const { data, error } = await supabase
      .from('meta_whatsapp_conversations')
      .update({
        contact_name: contactName || existing.contact_name,
        lead_id: leadId || existing.lead_id,
        last_campaign_id: latestRecipient?.campaign_id || existing.last_campaign_id,
        last_recipient_id: latestRecipient?.id || existing.last_recipient_id,
        status: existing.status === 'closed' || existing.status === 'archived' ? 'open' : existing.status,
        unread_count: unreadCount,
        last_message_preview: messagePreview(textBody),
        last_message_at: receivedAt,
        last_inbound_at: receivedAt,
        customer_window_expires_at: customerWindowExpiresAt,
        metadata: {
          ...(existing.metadata || {}),
          last_inbound_event_id: input.eventId || null,
        },
      })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    conversation = data
  }

  await ensureCampaignOutboundMessage(supabase, conversation.id, latestRecipient, leadId)

  const { error: messageError } = await supabase
    .from('meta_whatsapp_messages')
    .insert({
      conversation_id: conversation.id,
      sender_id: sender.id,
      campaign_id: latestRecipient?.campaign_id || null,
      recipient_id: latestRecipient?.id || null,
      lead_id: leadId,
      provider_message_id: providerMessageId,
      direction: 'inbound',
      message_type: cleanText(input.messageType || asRecord(input.payload).type || 'message', 80),
      text_body: textBody,
      status: 'received',
      payload: input.payload || {},
      received_at: receivedAt,
      created_at: receivedAt,
    })

  if (messageError) throw messageError

  if (input.eventId) {
    await supabase
      .from('meta_whatsapp_events')
      .update({
        campaign_id: latestRecipient?.campaign_id || null,
        recipient_id: latestRecipient?.id || null,
      })
      .eq('id', input.eventId)
  }

  return conversation
}

export async function recordMetaWhatsAppMessageStatus(
  input: RecordMetaWhatsAppStatusInput,
  supabase = createAdminClient()
) {
  const providerMessageId = cleanText(input.providerMessageId, 200)
  if (!providerMessageId) return null

  const status = normalizeStatus(input.status)
  const receivedAt = input.receivedAt || isoNow()
  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: isoNow(),
  }
  if (status === 'sent') updatePayload.sent_at = receivedAt
  if (status === 'delivered') updatePayload.delivered_at = receivedAt
  if (status === 'read') updatePayload.read_at = receivedAt
  if (status === 'failed') {
    updatePayload.failed_at = receivedAt
    updatePayload.error_code = input.errorCode || null
    updatePayload.error_message = input.errorMessage || null
  }

  const { data, error } = await supabase
    .from('meta_whatsapp_messages')
    .update(updatePayload)
    .eq('provider_message_id', providerMessageId)
    .select('conversation_id')
    .maybeSingle()

  if (error) throw error
  return data || null
}

export async function listMetaWhatsAppConversations(
  input: ListMetaWhatsAppConversationsInput = {},
  supabase = createAdminClient()
) {
  const limit = Math.min(100, Math.max(1, Number(input.limit || 50)))
  const status = normalizeConversationStatus(input.status)
  const search = cleanText(input.search, 80)

  let query = supabase
    .from('meta_whatsapp_conversations')
    .select(`
      *,
      sender:meta_whatsapp_senders(display_name, phone_number, phone_number_id, meta_status, quality_rating),
      campaign:meta_whatsapp_campaigns(id, name, campaign_type, template_name),
      lead:leads(id, name, email, phone, phone_e164, funnel_stage, lead_classification, lead_purpose, avatar_url, avatar_source, avatar_updated_at)
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (search) {
    const pattern = `%${search.replace(/[%_]/g, '')}%`
    query = query.or(`contact_phone.ilike.${pattern},contact_name.ilike.${pattern},last_message_preview.ilike.${pattern}`)
  }

  const { data: conversations, error } = await query
  if (error) throw error

  const enrichedConversations = await enrichConversationsWithContactAvatars(supabase, conversations || [])

  const summary = enrichedConversations.reduce((acc: Record<string, number>, conversation: any) => {
    acc.total += 1
    acc.unread += Number(conversation.unread_count || 0) > 0 ? 1 : 0
    acc.open += conversation.status === 'open' ? 1 : 0
    acc.pending += conversation.status === 'pending' ? 1 : 0
    acc.closed += conversation.status === 'closed' ? 1 : 0
    if (toTimestamp(conversation.customer_window_expires_at) > Date.now()) acc.windowActive += 1
    return acc
  }, { total: 0, unread: 0, open: 0, pending: 0, closed: 0, windowActive: 0 })

  return {
    conversations: enrichedConversations,
    summary,
  }
}

export async function getMetaWhatsAppConversationDetail(
  conversationId: string,
  supabase = createAdminClient()
) {
  const selected = cleanText(conversationId, 80)
  if (!selected) throw new Error('conversation_id obrigatorio.')

  const [conversationResult, messagesResult, replyIntentResult] = await Promise.all([
    supabase
      .from('meta_whatsapp_conversations')
      .select(`
        *,
        sender:meta_whatsapp_senders(display_name, phone_number, phone_number_id, meta_status, quality_rating),
        campaign:meta_whatsapp_campaigns(id, name, campaign_type, template_name),
        lead:leads(id, name, email, phone, phone_e164, funnel_stage, lead_classification, lead_purpose, lead_budget, avatar_url, avatar_source, avatar_updated_at, created_at)
      `)
      .eq('id', selected)
      .maybeSingle(),
    supabase
      .from('meta_whatsapp_messages')
      .select('*')
      .eq('conversation_id', selected)
      .order('created_at', { ascending: true })
      .limit(300),
    supabase
      .from('meta_whatsapp_reply_intents')
      .select('id, intent, confidence, source, raw_text, campaign_name, template_name, notified_status, notified_phone, notified_at, auto_reply_status, created_at, updated_at')
      .eq('conversation_id', selected)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (conversationResult.error) throw conversationResult.error
  if (messagesResult.error) throw messagesResult.error
  if (replyIntentResult.error) throw replyIntentResult.error
  if (!conversationResult.data) throw new Error('Conversa Meta WhatsApp nao encontrada.')

  const [conversation] = await enrichConversationsWithContactAvatars(supabase, [conversationResult.data])

  return {
    conversation: conversation || conversationResult.data,
    messages: messagesResult.data || [],
    replyIntent: replyIntentResult.data?.[0] || null,
  }
}

export async function sendMetaWhatsAppChatReply(
  input: SendMetaWhatsAppChatReplyInput,
  supabase = createAdminClient()
) {
  const text = cleanText(input.text, 4096)
  if (!text) throw new Error('Digite uma mensagem antes de enviar.')

  const { conversation } = await getMetaWhatsAppConversationDetail(input.conversationId, supabase)
  const windowExpiresAt = toTimestamp(conversation.customer_window_expires_at)
  if (!windowExpiresAt || windowExpiresAt <= Date.now()) {
    throw new Error('A janela de atendimento desta conversa expirou. Use um template aprovado para reabrir contato.')
  }

  const sender = Array.isArray(conversation.sender) ? conversation.sender[0] : conversation.sender
  const phoneNumberId = cleanText(sender?.phone_number_id || conversation.phone_number_id, 120)
  if (!phoneNumberId) throw new Error('Numero oficial da conversa sem Phone Number ID.')

  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  const now = isoNow()

  try {
    const result = await sendMetaWhatsAppTextMessage({
      to: conversation.contact_phone,
      text,
      phoneNumberId,
      config: configMap,
      previewUrl: input.previewUrl,
    })

    const { data: message, error: messageError } = await supabase
      .from('meta_whatsapp_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: conversation.sender_id,
        campaign_id: conversation.last_campaign_id || null,
        recipient_id: conversation.last_recipient_id || null,
        lead_id: conversation.lead_id || null,
        provider_message_id: result.providerMessageId || null,
        direction: 'outbound',
        message_type: 'text',
        text_body: text,
        status: 'sent',
        payload: result.raw || {},
        sent_at: now,
        created_at: now,
      })
      .select('*')
      .single()

    if (messageError) throw messageError

    const { data: updatedConversation, error: conversationError } = await supabase
      .from('meta_whatsapp_conversations')
      .update({
        status: 'pending',
        unread_count: 0,
        last_message_preview: messagePreview(text),
        last_message_at: now,
        last_outbound_at: now,
      })
      .eq('id', conversation.id)
      .select('*')
      .single()

    if (conversationError) throw conversationError

    return {
      conversation: updatedConversation,
      message,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await supabase
      .from('meta_whatsapp_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: conversation.sender_id,
        campaign_id: conversation.last_campaign_id || null,
        recipient_id: conversation.last_recipient_id || null,
        lead_id: conversation.lead_id || null,
        direction: 'outbound',
        message_type: 'text',
        text_body: text,
        status: 'failed',
        error_message: message.slice(0, 500),
        payload: { error: message },
        failed_at: now,
        created_at: now,
      })
    throw error
  }
}

export async function sendMetaWhatsAppChatAudioReply(
  input: SendMetaWhatsAppChatAudioReplyInput,
  supabase = createAdminClient()
) {
  const audioUrl = cleanText(input.audioUrl, 2000)
  if (!audioUrl) throw new Error('URL do audio ausente.')

  const { conversation } = await getMetaWhatsAppConversationDetail(input.conversationId, supabase)
  const windowExpiresAt = toTimestamp(conversation.customer_window_expires_at)
  if (!windowExpiresAt || windowExpiresAt <= Date.now()) {
    throw new Error('A janela de atendimento desta conversa expirou. Use um template aprovado para reabrir contato.')
  }

  const sender = Array.isArray(conversation.sender) ? conversation.sender[0] : conversation.sender
  const phoneNumberId = cleanText(sender?.phone_number_id || conversation.phone_number_id, 120)
  if (!phoneNumberId) throw new Error('Numero oficial da conversa sem Phone Number ID.')

  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  const now = isoNow()
  const textFallback = cleanText(input.textFallback, 1200)

  try {
    const result = await sendMetaWhatsAppAudioMessage({
      to: conversation.contact_phone,
      audioUrl,
      phoneNumberId,
      config: configMap,
    })

    const { data: message, error: messageError } = await supabase
      .from('meta_whatsapp_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: conversation.sender_id,
        campaign_id: conversation.last_campaign_id || null,
        recipient_id: conversation.last_recipient_id || null,
        lead_id: conversation.lead_id || null,
        provider_message_id: result.providerMessageId || null,
        direction: 'outbound',
        message_type: 'audio',
        text_body: textFallback || null,
        status: 'sent',
        payload: {
          ...(result.raw || {}),
          audio_url: audioUrl,
        },
        sent_at: now,
        created_at: now,
      })
      .select('*')
      .single()

    if (messageError) throw messageError

    const { data: updatedConversation, error: conversationError } = await supabase
      .from('meta_whatsapp_conversations')
      .update({
        status: 'pending',
        unread_count: 0,
        last_message_preview: textFallback ? messagePreview(textFallback) : 'Audio enviado',
        last_message_at: now,
        last_outbound_at: now,
      })
      .eq('id', conversation.id)
      .select('*')
      .single()

    if (conversationError) throw conversationError

    return {
      conversation: updatedConversation,
      message,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await supabase
      .from('meta_whatsapp_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: conversation.sender_id,
        campaign_id: conversation.last_campaign_id || null,
        recipient_id: conversation.last_recipient_id || null,
        lead_id: conversation.lead_id || null,
        direction: 'outbound',
        message_type: 'audio',
        text_body: textFallback || null,
        status: 'failed',
        error_message: message.slice(0, 500),
        payload: { error: message, audio_url: audioUrl },
        failed_at: now,
        created_at: now,
      })
    throw error
  }
}

export async function updateMetaWhatsAppConversation(
  conversationId: string,
  updates: { status?: string | null; assignedToId?: string | null; markRead?: boolean },
  supabase = createAdminClient()
) {
  const selected = cleanText(conversationId, 80)
  if (!selected) throw new Error('conversation_id obrigatorio.')

  const updatePayload: Record<string, unknown> = {}
  const status = normalizeConversationStatus(updates.status)
  if (status) updatePayload.status = status
  if (updates.assignedToId !== undefined) updatePayload.assigned_to_id = cleanText(updates.assignedToId, 80) || null
  if (updates.markRead) updatePayload.unread_count = 0
  if (!Object.keys(updatePayload).length) throw new Error('Nenhuma alteracao informada.')

  const { data, error } = await supabase
    .from('meta_whatsapp_conversations')
    .update(updatePayload)
    .eq('id', selected)
    .select('*')
    .single()

  if (error) throw error
  return data
}
