import { createAdminClient } from '@/lib/supabase/server'
import {
  loadMetaWhatsAppConfigMap,
  normalizeMetaWhatsAppPhone,
  resolveMetaWhatsAppAccountConfigs,
  resolveMetaWhatsAppConfig,
  resolveMetaWhatsAppConfigForWaba,
  getMetaWhatsAppErrorInfo,
  sendMetaWhatsAppTemplateMessage,
} from '@/lib/meta/whatsapp-cloud'
import {
  getMetaWhatsAppSenderHealth,
  isMetaWhatsAppSenderAvailable,
  isMetaWhatsAppSenderPolicyEligible,
  metaWhatsAppSenderUsage,
} from '@/lib/meta/whatsapp-sender-health'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

type CampaignType = 'marketing' | 'editorial' | 'followup' | 'utility' | 'test'
type CreativeDeduplicationMode = 'skip_previous' | 'track_only' | 'allow_repeat'

export interface MetaWhatsAppRecipientInput {
  phone: string
  name?: string
  leadId?: string
  educationLeadId?: string
  customerId?: string
  optInSource?: string
  optInAt?: string
  templateParameters?: unknown
  metadata?: Record<string, unknown>
}

export interface CreateMetaWhatsAppCampaignInput {
  name: string
  campaignType?: CampaignType
  templateName: string
  templateLanguage?: string
  numbers?: string[]
  recipients?: MetaWhatsAppRecipientInput[]
  scheduledFor?: string | number | null
  confirmOptIn?: boolean
  optInSource?: string
  senderRoutingMode?: 'single' | 'round_robin' | 'weighted_pool'
  defaultSenderId?: string | null
  whatsAppValidationMode?: 'confirmed_only' | 'include_unverified'
  creativeDeduplicationMode?: CreativeDeduplicationMode
  templateParameters?: unknown
  audienceSource?: 'custom_paste' | 'saved_contact_list' | 'lead_filter' | 'commerce_customers' | 'education_leads' | 'editorial_distribution'
  metadata?: Record<string, unknown>
}

export interface ListMetaWhatsAppCampaignsInput {
  status?: string | null
  limit?: number
}

export interface GetMetaWhatsAppDailyReportInput {
  date?: string | null
}

export interface GetMetaWhatsAppDetailedReportInput {
  dateFrom?: string | null
  dateTo?: string | null
  templateName?: string | null
  campaignId?: string | null
  senderId?: string | null
  wabaId?: string | null
  status?: string | null
  intent?: string | null
  search?: string | null
  limit?: number
}

type MetaWhatsAppAnalyticsBucket = {
  date: string
  campaigns: number
  recipients: number
  accepted: number
  delivered: number
  read: number
  failed: number
  skipped: number
}

const DEFAULT_META_WHATSAPP_BATCH_SIZE = 50
const META_SENDER_UNAVAILABLE_ERROR_CODES = new Set(['131031', '131042', '132015', '132016'])
const META_SENDER_CAPACITY_ERROR_CODES = new Set(['131056'])
type MetaSendFailureKind = 'sender_unavailable' | 'sender_capacity' | 'recipient' | ''

export interface GetMetaWhatsAppCampaignDetailInput {
  campaignId: string
  limit?: number
}

function cleanText(value: unknown, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength)
}

function asMetadata(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function isMetaHostedTemplateMediaUrl(value: unknown) {
  const url = cleanText(value, 5000)
  if (!/^https?:\/\//i.test(url)) return false

  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return hostname.includes('whatsapp.net')
      || hostname.endsWith('fbcdn.net')
      || hostname.startsWith('scontent.')
  } catch {
    return false
  }
}

function publicTemplateMediaUrl(value: unknown) {
  const url = cleanText(value, 5000)
  if (!url.startsWith('https://')) return ''
  return isMetaHostedTemplateMediaUrl(url) ? '' : url
}

function templateHeaderMediaUrlFromMetadata(value: unknown) {
  const metadata = asMetadata(value)
  const panelHeaderMedia = asMetadata(metadata.panel_header_media)
  return publicTemplateMediaUrl(panelHeaderMedia.url) || publicTemplateMediaUrl(metadata.header_media_url)
}

function campaignWabaId(campaign: any, fallback = '') {
  const metadata = asMetadata(campaign?.metadata)
  return cleanText(
    campaign?.waba_id ||
    metadata.waba_id ||
    metadata.target_waba_id ||
    fallback,
    120
  )
}

function uniqueCleanText(values: unknown[], maxLength = 120) {
  return Array.from(new Set(
    values
      .map(value => cleanText(value, maxLength))
      .filter(Boolean)
  ))
}

function arrayFromMetadata(value: unknown) {
  return Array.isArray(value) ? value : []
}

function campaignUsesPortfolioRouting(campaign: any) {
  const metadata = asMetadata(campaign?.metadata)
  return cleanText(campaign?.sender_routing_mode, 40) === 'round_robin'
    && metadata.portfolio_routing_enabled === true
}

function campaignRoutingWabaIds(campaign: any, fallback = '') {
  const metadata = asMetadata(campaign?.metadata)
  if (campaignUsesPortfolioRouting(campaign)) {
    const routed = uniqueCleanText(arrayFromMetadata(metadata.routing_waba_ids))
    if (routed.length) return routed
  }

  const wabaId = campaignWabaId(campaign, fallback)
  return wabaId ? [wabaId] : []
}

function visibleWabaIdsFromConfig(configMap: Record<string, string | undefined>) {
  const resolved = resolveMetaWhatsAppConfig(configMap)
  const configuredVisibleWabaIds = resolveMetaWhatsAppAccountConfigs(configMap)
    .filter(account => account.enabled && !account.missing.length)
    .map(account => account.wabaId)
  return uniqueCleanText(configuredVisibleWabaIds.length ? configuredVisibleWabaIds : [resolved.wabaId])
}

function recipientWhatsAppCheckStatus(recipient: MetaWhatsAppRecipientInput) {
  const metadata = asMetadata(recipient.metadata)
  const check = asMetadata(metadata.whatsapp_check)
  return cleanText(check.status, 40).toLowerCase()
}

function isSavedContactListRecipient(recipient: MetaWhatsAppRecipientInput) {
  const metadata = asMetadata(recipient.metadata)
  return Boolean(metadata.contact_list_id || metadata.contact_list_contact_id)
}

function isRecipientNotConfirmedByWhatsAppCheck(
  recipient: MetaWhatsAppRecipientInput,
  mode: 'confirmed_only' | 'include_unverified' = 'confirmed_only'
) {
  const status = recipientWhatsAppCheckStatus(recipient)
  if (status === 'invalid') return true
  if (mode === 'include_unverified') return false
  if (isSavedContactListRecipient(recipient) && status !== 'valid') return true
  return status === 'unknown' || status === 'error'
}

function normalizeRecipientPhone(value: unknown) {
  const digits = normalizeMetaWhatsAppPhone(value)
  if (!digits) return ''
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.startsWith('55') || digits.length > 11) return digits
  return digits
}

function normalizeContactGroupText(value: unknown) {
  return cleanText(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function contactGroupKeyFromName(value?: string | null) {
  const normalized = normalizeContactGroupText(value)
  return normalized.length >= 3 ? `name:${normalized}` : ''
}

function enrichRecipientContactGroup(recipient: MetaWhatsAppRecipientInput): MetaWhatsAppRecipientInput {
  const metadata = asMetadata(recipient.metadata)
  const existingKey = cleanText(metadata.contact_group_key, 220)
  const groupName = cleanText(metadata.contact_group_name || recipient.name, 180)
  const groupKey = existingKey || contactGroupKeyFromName(groupName)

  if (!groupKey) {
    return {
      ...recipient,
      metadata,
    }
  }

  return {
    ...recipient,
    metadata: {
      ...metadata,
      contact_group_key: groupKey,
      contact_group_name: groupName || recipient.name || null,
      contact_group_source: cleanText(metadata.contact_group_source, 80) || 'recipient_name',
      contact_group_stop_on_reply: metadata.contact_group_stop_on_reply !== false,
    },
  }
}

function recipientContactGroupKey(recipient: any) {
  return cleanText(asMetadata(recipient?.metadata).contact_group_key, 220)
}

function shouldStopContactGroupOnReply(recipient: any) {
  const metadata = asMetadata(recipient?.metadata)
  return Boolean(metadata.contact_group_key) && metadata.contact_group_stop_on_reply !== false
}

type ContactGroupReplySignal = {
  replyIntentId: string | null
  responderRecipientId: string | null
  responderPhone: string | null
  responderName: string | null
  intent: string | null
  reactedAt: string | null
}

function isLegacySyncedTemplate(template: any) {
  const name = cleanText(template?.name, 160)
  return /^sir\d+_\d+_[a-f0-9]+$/i.test(name)
}

function templateHasImageHeader(template: any) {
  return Array.isArray(template?.components)
    && template.components.some((component: any) => {
      const type = cleanText(component?.type, 30).toUpperCase()
      const format = cleanText(component?.format, 30).toUpperCase()
      return type === 'HEADER' && format === 'IMAGE'
    })
}

function isCampaignTemplateEligible(template: any) {
  const metadata = asMetadata(template?.metadata)
  if (metadata.deleted_from_panel_at) return false
  if (metadata.hidden_from_panel_at) return false
  if (!templateHasImageHeader(template)) return false
  if (metadata.managed_from_panel || metadata.created_from_panel) return true

  const status = cleanText(template?.status, 40).toUpperCase()
  return status === 'APPROVED' && !isLegacySyncedTemplate(template)
}

function isMetaSenderReady(sender: any) {
  return isMetaWhatsAppSenderAvailable(sender)
}

function asNumber(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function metricRate(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function nextSaoPauloMidnightIso(from = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(from)
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const year = Number(byType.year)
  const month = Number(byType.month)
  const day = Number(byType.day)
  return new Date(Date.UTC(year, month - 1, day + 1, 3, 0, 0, 0)).toISOString()
}

function senderResetAt(sender: any) {
  const value = cleanText(sender?.daily_limit_resets_at, 80)
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function isSenderUsageExpired(sender: any, now = new Date()) {
  const resetAt = senderResetAt(sender)
  return Boolean(resetAt && resetAt.getTime() <= now.getTime())
}

function senderDailySentCount(sender: any) {
  return metaWhatsAppSenderUsage(sender).sent
}

function portfolioDailyLimit(senders: any[]) {
  const eligibleSenders = senders.filter(isMetaWhatsAppSenderPolicyEligible)
  return Math.max(...eligibleSenders.map(sender => asNumber(sender?.daily_limit)), 0)
}

function portfolioDailySentCount(senders: any[]) {
  return senders.reduce((total, sender) => total + senderDailySentCount(sender), 0)
}

function portfolioDailyUsage(senders: any[]) {
  const limit = portfolioDailyLimit(senders)
  const sent = portfolioDailySentCount(senders)
  return {
    limit,
    sent,
    remaining: Math.max(limit - sent, 0),
  }
}

function currentSaoPauloDayStartIso(from = new Date()) {
  const nextReset = new Date(nextSaoPauloMidnightIso(from))
  nextReset.setUTCDate(nextReset.getUTCDate() - 1)
  return nextReset.toISOString()
}

async function resetExpiredSenderUsage(supabase: SupabaseAdmin, senders: any[]) {
  const now = new Date()
  const expired = senders.filter(sender => isSenderUsageExpired(sender, now))
  if (!expired.length) return senders

  const nextReset = nextSaoPauloMidnightIso(now)
  await supabase
    .from('meta_whatsapp_senders')
    .update({
      daily_sent_count: 0,
      daily_limit_resets_at: nextReset,
      last_health_check_at: now.toISOString(),
      last_error: null,
    })
    .in('id', expired.map(sender => sender.id).filter(Boolean))

  return senders.map(sender => isSenderUsageExpired(sender, now)
    ? { ...sender, daily_sent_count: 0, daily_limit_resets_at: nextReset }
    : sender)
}

async function syncSenderDailyUsageFromCampaignRecipients(supabase: SupabaseAdmin, senders: any[]) {
  const preparedSenders = await resetExpiredSenderUsage(supabase, senders)
  const senderIds = preparedSenders.map((sender: any) => String(sender.id || '')).filter(Boolean)
  if (!senderIds.length) return preparedSenders

  const now = new Date()
  const usageStart = currentSaoPauloDayStartIso(now)
  const nextReset = nextSaoPauloMidnightIso(now)
  const { data: reservedRecipients, error } = await supabase
    .from('meta_whatsapp_campaign_recipients')
    .select('sender_id, recipient_phone')
    .in('sender_id', senderIds)
    .in('status', ['sending', 'sent', 'delivered', 'read'])
    .gte('updated_at', usageStart)
    .limit(50000)

  if (error) throw error

  const usageBySender = new Map<string, Set<string>>()
  for (const recipient of reservedRecipients || []) {
    const senderId = String((recipient as any).sender_id || '')
    if (!senderId) continue
    const phone = normalizeMetaWhatsAppPhone((recipient as any).recipient_phone)
    const key = phone || `row:${senderId}:${usageBySender.get(senderId)?.size || 0}`
    const usage = usageBySender.get(senderId) || new Set<string>()
    usage.add(key)
    usageBySender.set(senderId, usage)
  }

  const updates = preparedSenders
    .map((sender: any) => ({
      sender,
      count: usageBySender.get(String(sender.id))?.size || 0,
    }))
    .filter(item => senderDailySentCount(item.sender) !== item.count || !item.sender.daily_limit_resets_at)

  if (updates.length) {
    const results = await Promise.all(updates.map(item => supabase
      .from('meta_whatsapp_senders')
      .update({
        daily_sent_count: item.count,
        daily_limit_resets_at: nextReset,
        last_health_check_at: now.toISOString(),
        last_error: null,
      })
      .eq('id', item.sender.id)
    ))
    const updateError = results.find(result => result.error)?.error
    if (updateError) throw updateError
  }

  return preparedSenders.map((sender: any) => ({
    ...sender,
    daily_sent_count: usageBySender.get(String(sender.id))?.size || 0,
    daily_limit_resets_at: sender.daily_limit_resets_at || nextReset,
  }))
}

function describeSenderAvailability(sender: any) {
  if (!sender) return 'numero selecionado nao encontrado.'
  const name = sender.display_name || sender.phone_number || 'Numero Meta'
  const health = getMetaWhatsAppSenderHealth(sender)
  return `${name}: ${health.warning || health.reason}`
}

function describePortfolioAvailability(senders: any[]) {
  const usage = portfolioDailyUsage(senders)
  if (usage.limit <= 0) return 'Limite diario do portfolio Meta nao configurado.'
  if (usage.remaining <= 0) return `Limite diario do portfolio Meta esgotado (${usage.sent}/${usage.limit}).`
  return `Portfolio Meta disponivel (${usage.sent}/${usage.limit}, restam ${usage.remaining}).`
}

function percentage(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function dateKey(value?: string | null) {
  const date = value ? new Date(value) : new Date()
  if (!Number.isFinite(date.getTime())) return new Date().toISOString().slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function getMetaErrorHint(code?: string | null, message?: string | null) {
  const selectedCode = cleanText(code, 40)
  const selectedMessage = cleanText(message, 260).toLowerCase()

  if (selectedCode === '131042' || selectedMessage.includes('payment')) {
    return 'Falha de pagamento/elegibilidade da WABA. Verifique metodo de pagamento, linha de credito e cobranca da conta WhatsApp.'
  }
  if (selectedCode === '131026') {
    return 'O destinatario nao pode receber esta mensagem. Valide se o numero existe no WhatsApp e se nao bloqueou o contato.'
  }
  if (selectedCode === '131047') {
    return 'Janela de atendimento expirada. Para iniciar conversa ativa, use um template aprovado.'
  }
  if (selectedCode === '132000' || selectedCode === '132001') {
    return 'Parametros do template nao batem com o modelo aprovado. Confira variaveis, idioma e componentes.'
  }
  if (selectedCode === '132015' || selectedCode === '132016') {
    return 'Template pausado ou desabilitado pela Meta. Revise a qualidade do template e use outro modelo aprovado.'
  }
  if (selectedCode === '131056') {
    return 'Limite de envio atingido para o numero oficial. Aguarde o reset do limite ou distribua em outro numero Meta.'
  }
  if (selectedMessage.includes('rate limit') || selectedMessage.includes('limit')) {
    return 'Limite operacional atingido. Reduza velocidade, use pool de numeros ou aguarde o limite renovar.'
  }
  return 'Abra o detalhe da campanha e confira o payload/status retornado pela Meta para a causa exata.'
}

function metaSendErrorSummary(error: unknown) {
  const info = getMetaWhatsAppErrorInfo(error)
  const code = cleanText(info.code, 40)
  const subcode = cleanText(info.subcode, 40)
  const message = cleanText(
    info.userMessage ||
    info.details ||
    info.message ||
    (error instanceof Error ? error.message : String(error || 'Erro Meta WhatsApp')),
    500
  )
  const searchable = [
    code,
    subcode,
    info.type,
    info.message,
    info.details,
    info.userTitle,
    info.userMessage,
  ].map(value => cleanText(value, 1000).toLowerCase()).join(' ')

  return { code, subcode, message, searchable }
}

function classifyMetaSendFailure(error: unknown): MetaSendFailureKind {
  const summary = metaSendErrorSummary(error)
  const haystack = summary.searchable

  if (summary.code === '131026') return 'recipient'
  if (META_SENDER_CAPACITY_ERROR_CODES.has(summary.code)) return 'sender_capacity'
  if (META_SENDER_UNAVAILABLE_ERROR_CODES.has(summary.code)) return 'sender_unavailable'
  if (haystack.includes('business account locked')) return 'sender_unavailable'
  if (haystack.includes('account locked')) return 'sender_unavailable'
  if (haystack.includes('conta bloqueada')) return 'sender_unavailable'
  if (haystack.includes('restricted') && (haystack.includes('whatsapp') || haystack.includes('account') || haystack.includes('business'))) return 'sender_unavailable'
  if (haystack.includes('blocked') && (haystack.includes('whatsapp') || haystack.includes('account') || haystack.includes('business'))) return 'sender_unavailable'
  if (haystack.includes('disabled') && (haystack.includes('template') || haystack.includes('whatsapp') || haystack.includes('account'))) return 'sender_unavailable'
  if (haystack.includes('paused') && haystack.includes('template')) return 'sender_unavailable'
  if (haystack.includes('payment') || haystack.includes('pagamento') || haystack.includes('eligibility') || haystack.includes('elegibilidade')) return 'sender_unavailable'
  if (haystack.includes('rate limit') || haystack.includes('limit reached') || haystack.includes('limite atingido')) return 'sender_capacity'

  return ''
}

function canFailoverMetaSendError(error: unknown) {
  const kind = classifyMetaSendFailure(error)
  return kind === 'sender_unavailable' || kind === 'sender_capacity'
}

function extractMetaErrorFromPayload(payload: unknown) {
  const source = typeof payload === 'object' && payload !== null ? payload as Record<string, any> : {}
  const firstError = Array.isArray(source.errors) ? source.errors[0] : null
  const statusError = Array.isArray(source.statuses) && source.statuses[0]?.errors?.length
    ? source.statuses[0].errors[0]
    : null
  const error = firstError || statusError || source.error || null
  if (!error || typeof error !== 'object') return null

  return {
    code: cleanText(error.code || error.error_code || source.code || 'sem_codigo', 40),
    message: cleanText(error.message || error.title || source.message || 'Falha sem mensagem', 260),
    detail: cleanText(error.error_data?.details || error.details || source.details || '', 300),
  }
}

function buildMetaWhatsAppAnalytics(campaigns: any[], senders: any[], recipients: any[], events: any[]) {
  const summary = campaigns.reduce((acc: any, campaign: any) => {
    acc.recipients += asNumber(campaign.total_recipients)
    acc.accepted += asNumber(campaign.total_sent)
    acc.delivered += asNumber(campaign.total_delivered)
    acc.read += asNumber(campaign.total_read)
    acc.failed += asNumber(campaign.total_failed)
    acc.skipped += asNumber(campaign.total_skipped)
    return acc
  }, { recipients: 0, accepted: 0, delivered: 0, read: 0, failed: 0, skipped: 0 })

  const timelineMap = new Map<string, MetaWhatsAppAnalyticsBucket>()
  for (let index = 13; index >= 0; index -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - index)
    const key = date.toISOString().slice(0, 10)
    timelineMap.set(key, {
      date: key,
      campaigns: 0,
      recipients: 0,
      accepted: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      skipped: 0,
    })
  }

  const byTypeMap = new Map<string, any>()
  const templateMap = new Map<string, any>()
  for (const campaign of campaigns) {
    const key = dateKey(campaign.created_at)
    const bucket = timelineMap.get(key) || {
      date: key,
      campaigns: 0,
      recipients: 0,
      accepted: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      skipped: 0,
    }
    bucket.campaigns += 1
    bucket.recipients += asNumber(campaign.total_recipients)
    bucket.accepted += asNumber(campaign.total_sent)
    bucket.delivered += asNumber(campaign.total_delivered)
    bucket.read += asNumber(campaign.total_read)
    bucket.failed += asNumber(campaign.total_failed)
    bucket.skipped += asNumber(campaign.total_skipped)
    timelineMap.set(key, bucket)

    const type = cleanText(campaign.campaign_type || 'campanha', 40)
    const byType = byTypeMap.get(type) || {
      type,
      campaigns: 0,
      recipients: 0,
      accepted: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    }
    byType.campaigns += 1
    byType.recipients += asNumber(campaign.total_recipients)
    byType.accepted += asNumber(campaign.total_sent)
    byType.delivered += asNumber(campaign.total_delivered)
    byType.read += asNumber(campaign.total_read)
    byType.failed += asNumber(campaign.total_failed)
    byTypeMap.set(type, byType)

    const templateKey = `${campaign.template_name || 'sem_template'}:${campaign.template_language || 'pt_BR'}`
    const template = templateMap.get(templateKey) || {
      key: templateKey,
      template_name: campaign.template_name || 'sem_template',
      language: campaign.template_language || 'pt_BR',
      campaigns: 0,
      recipients: 0,
      accepted: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      deliveryRate: 0,
      readRate: 0,
      failureRate: 0,
    }
    template.campaigns += 1
    template.recipients += asNumber(campaign.total_recipients)
    template.accepted += asNumber(campaign.total_sent)
    template.delivered += asNumber(campaign.total_delivered)
    template.read += asNumber(campaign.total_read)
    template.failed += asNumber(campaign.total_failed)
    templateMap.set(templateKey, template)
  }

  const eventErrorByMessageId = new Map<string, any>()
  for (const event of events) {
    const payloadError = extractMetaErrorFromPayload(event.payload)
    if (payloadError && event.provider_message_id) {
      eventErrorByMessageId.set(String(event.provider_message_id), payloadError)
    }
  }

  const errorMap = new Map<string, any>()
  for (const recipient of recipients) {
    if (recipient.status !== 'failed' && !recipient.error_code && !recipient.error_message) continue
    const payloadError = recipient.provider_message_id
      ? eventErrorByMessageId.get(String(recipient.provider_message_id))
      : null
    const code = cleanText(recipient.error_code || payloadError?.code || 'sem_codigo', 40)
    const message = cleanText(recipient.error_message || payloadError?.message || 'Falha sem mensagem', 260)
    const detail = cleanText(payloadError?.detail || '', 300)
    const key = `${code}:${message}`
    const row = errorMap.get(key) || {
      code,
      message,
      detail,
      count: 0,
      campaigns: new Set<string>(),
      lastSeenAt: recipient.failed_at || recipient.created_at || null,
      hint: getMetaErrorHint(code, message),
    }
    row.count += 1
    if (recipient.campaign_id) row.campaigns.add(String(recipient.campaign_id))
    const seenAt = recipient.failed_at || recipient.created_at || null
    if (seenAt && (!row.lastSeenAt || new Date(seenAt).getTime() > new Date(row.lastSeenAt).getTime())) {
      row.lastSeenAt = seenAt
    }
    if (!row.detail && detail) row.detail = detail
    errorMap.set(key, row)
  }

  const senderStatsMap = new Map<string, any>()
  for (const recipient of recipients) {
    if (!recipient.sender_id) continue
    const key = String(recipient.sender_id)
    const row = senderStatsMap.get(key) || {
      recipients: 0,
      accepted: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    }
    row.recipients += 1
    if (['sent', 'delivered', 'read'].includes(String(recipient.status))) row.accepted += 1
    if (['delivered', 'read'].includes(String(recipient.status))) row.delivered += 1
    if (recipient.status === 'read') row.read += 1
    if (recipient.status === 'failed') row.failed += 1
    senderStatsMap.set(key, row)
  }

  const templatePerformance = Array.from(templateMap.values()).map((template: any) => ({
    ...template,
    deliveryRate: percentage(template.delivered, template.accepted || template.recipients),
    readRate: percentage(template.read, template.delivered || template.accepted || template.recipients),
    failureRate: percentage(template.failed, template.recipients),
  }))
  const portfolioUsage = portfolioDailyUsage(senders || [])

  return {
    portfolioUsage: {
      daily_limit: portfolioUsage.limit,
      daily_sent_count: portfolioUsage.sent,
      remaining: portfolioUsage.remaining,
      usageRate: percentage(portfolioUsage.sent, portfolioUsage.limit),
    },
    rates: {
      acceptedRate: percentage(summary.accepted, summary.recipients),
      deliveryRate: percentage(summary.delivered, summary.accepted || summary.recipients),
      readRate: percentage(summary.read, summary.delivered || summary.accepted || summary.recipients),
      failureRate: percentage(summary.failed, summary.recipients),
      optOutRate: percentage(summary.skipped, summary.recipients),
    },
    timeline: Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    byType: Array.from(byTypeMap.values()).sort((a: any, b: any) => b.recipients - a.recipients),
    errorBreakdown: Array.from(errorMap.values())
      .map((row: any) => ({ ...row, campaigns: row.campaigns.size }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 8),
    templatePerformance: templatePerformance
      .sort((a: any, b: any) => b.recipients - a.recipients)
      .slice(0, 8),
    senderHealth: (senders || []).map((sender: any) => {
      const stats = senderStatsMap.get(String(sender.id)) || {
        recipients: 0,
        accepted: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      }
      const dailyLimit = asNumber(sender.daily_limit)
      const dailySent = senderDailySentCount(sender)
      const senderHealth = getMetaWhatsAppSenderHealth(sender)
      return {
        sender_id: sender.id,
        display_name: sender.display_name || sender.phone_number || 'Numero Meta',
        phone_number: sender.phone_number || '',
        meta_status: sender.meta_status || null,
        quality_rating: sender.quality_rating || null,
        daily_limit: dailyLimit,
        daily_sent_count: dailySent,
        available: senderHealth.available,
        policy_eligible: senderHealth.policyEligible,
        health_status: senderHealth.severity,
        health_reason: senderHealth.warning || senderHealth.reason,
        usageRate: percentage(dailySent, dailyLimit),
        recipients: stats.recipients,
        accepted: stats.accepted,
        delivered: stats.delivered,
        read: stats.read,
        failed: stats.failed,
        failureRate: percentage(stats.failed, stats.recipients),
      }
    }),
  }
}

function parseScheduledFor(value: CreateMetaWhatsAppCampaignInput['scheduledFor']) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    const millis = value > 10_000_000_000 ? value : value * 1000
    const date = new Date(millis)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
  }

  const date = new Date(String(value))
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function normalizeLanguage(value?: string) {
  const selected = cleanText(value || 'pt_BR', 12).replace('-', '_')
  return /^[a-z]{2}_[A-Z]{2}$/.test(selected) ? selected : 'pt_BR'
}

function normalizeRecipients(input: CreateMetaWhatsAppCampaignInput) {
  const byPhone = new Map<string, MetaWhatsAppRecipientInput>()

  for (const number of input.numbers || []) {
    const phone = normalizeRecipientPhone(number)
    if (!phone) continue
    byPhone.set(phone, {
      phone,
      optInSource: input.optInSource || 'manual_admin_confirmed',
      templateParameters: input.templateParameters,
    })
  }

  for (const recipient of input.recipients || []) {
    const phone = normalizeRecipientPhone(recipient.phone)
    if (!phone) continue
    byPhone.set(phone, {
      ...recipient,
      phone,
      optInSource: recipient.optInSource || input.optInSource || 'manual_admin_confirmed',
      templateParameters: recipient.templateParameters ?? input.templateParameters,
    })
  }

  return Array.from(byPhone.values()).map(enrichRecipientContactGroup)
}

async function fetchOptOutPhones(supabase: SupabaseAdmin, phones: string[]) {
  if (!phones.length) return new Set<string>()
  const optedOut = new Set<string>()
  const chunkSize = 500

  for (let index = 0; index < phones.length; index += chunkSize) {
    const chunk = phones.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('meta_whatsapp_opt_outs')
      .select('phone_e164')
      .in('phone_e164', chunk)

    if (error) throw error
    for (const row of data || []) optedOut.add(String(row.phone_e164 || ''))
  }

  return optedOut
}

const PRIOR_CREATIVE_RECIPIENT_STATUSES = ['queued', 'sending', 'sent', 'delivered', 'read']

type PriorCreativeDelivery = {
  campaignId: string | null
  campaignName: string | null
  campaignStatus: string | null
  recipientStatus: string | null
  recipientPhone: string | null
  contactGroupKey: string | null
  createdAt: string | null
}

function campaignRelation(row: any) {
  if (Array.isArray(row?.campaign)) return row.campaign[0] || null
  return row?.campaign || null
}

function campaignMatchesCreative(campaign: any, templateName: string, templateLanguage: string) {
  if (!campaign) return false
  return cleanText(campaign.template_name, 120).toLowerCase() === templateName.toLowerCase()
    && normalizeLanguage(cleanText(campaign.template_language, 12) || templateLanguage) === templateLanguage
}

function priorCreativeDeliveryFromRow(
  row: any,
  templateName: string,
  templateLanguage: string
): PriorCreativeDelivery | null {
  const campaign = campaignRelation(row)
  if (!campaignMatchesCreative(campaign, templateName, templateLanguage)) return null

  const recipientStatus = cleanText(row?.status, 40).toLowerCase()
  const campaignStatus = cleanText(campaign?.status, 40).toLowerCase()
  const alreadyReached = recipientStatus === 'sent' || recipientStatus === 'delivered' || recipientStatus === 'read'
  if (campaignStatus === 'cancelled' && !alreadyReached) return null

  const metadata = asMetadata(row?.metadata)
  return {
    campaignId: cleanText(campaign?.id, 80) || null,
    campaignName: cleanText(campaign?.name, 180) || null,
    campaignStatus: campaignStatus || null,
    recipientStatus: recipientStatus || null,
    recipientPhone: normalizeRecipientPhone(row?.recipient_phone) || null,
    contactGroupKey: cleanText(metadata.contact_group_key, 220) || null,
    createdAt: cleanText(row?.created_at, 40) || cleanText(campaign?.created_at, 40) || null,
  }
}

function deliveryHappenedAfter(next?: string | null, current?: string | null) {
  if (!next) return false
  if (!current) return true
  return new Date(next).getTime() > new Date(current).getTime()
}

function rememberPriorDelivery(map: Map<string, PriorCreativeDelivery>, key: string, delivery: PriorCreativeDelivery) {
  if (!key) return
  const current = map.get(key)
  if (!current || deliveryHappenedAfter(delivery.createdAt, current.createdAt)) {
    map.set(key, delivery)
  }
}

function postgrestInList(values: string[]) {
  const quoted = values
    .map(value => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',')
  return `(${quoted})`
}

async function fetchPriorCreativeDeliveries(
  supabase: SupabaseAdmin,
  recipients: MetaWhatsAppRecipientInput[],
  templateName: string,
  templateLanguage: string
) {
  const byPhone = new Map<string, PriorCreativeDelivery>()
  const byGroupKey = new Map<string, PriorCreativeDelivery>()
  const phones = Array.from(new Set(recipients.map(recipient => recipient.phone).filter(Boolean)))
  const groupKeys = Array.from(new Set(recipients.map(recipientContactGroupKey).filter(Boolean)))
  const chunkSize = 500

  for (let index = 0; index < phones.length; index += chunkSize) {
    const chunk = phones.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('meta_whatsapp_campaign_recipients')
      .select('recipient_phone, status, created_at, metadata, campaign:meta_whatsapp_campaigns(id, name, status, template_name, template_language, created_at, metadata)')
      .in('recipient_phone', chunk)
      .in('status', PRIOR_CREATIVE_RECIPIENT_STATUSES)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) throw error

    for (const row of data || []) {
      const delivery = priorCreativeDeliveryFromRow(row, templateName, templateLanguage)
      if (!delivery) continue
      if (delivery.recipientPhone) rememberPriorDelivery(byPhone, delivery.recipientPhone, delivery)
      if (delivery.contactGroupKey) rememberPriorDelivery(byGroupKey, delivery.contactGroupKey, delivery)
    }
  }

  for (let index = 0; index < groupKeys.length; index += chunkSize) {
    const chunk = groupKeys.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('meta_whatsapp_campaign_recipients')
      .select('recipient_phone, status, created_at, metadata, campaign:meta_whatsapp_campaigns(id, name, status, template_name, template_language, created_at, metadata)')
      .filter('metadata->>contact_group_key', 'in', postgrestInList(chunk))
      .in('status', PRIOR_CREATIVE_RECIPIENT_STATUSES)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) throw error

    for (const row of data || []) {
      const delivery = priorCreativeDeliveryFromRow(row, templateName, templateLanguage)
      if (!delivery) continue
      if (delivery.recipientPhone) rememberPriorDelivery(byPhone, delivery.recipientPhone, delivery)
      if (delivery.contactGroupKey) rememberPriorDelivery(byGroupKey, delivery.contactGroupKey, delivery)
    }
  }

  return { byPhone, byGroupKey }
}

export async function createMetaWhatsAppCampaign(input: CreateMetaWhatsAppCampaignInput, supabase = createAdminClient()) {
  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  const resolved = resolveMetaWhatsAppConfig(configMap)
  const configuredAccounts = resolveMetaWhatsAppAccountConfigs(configMap).filter(account => account.enabled)
  const readyAccounts = configuredAccounts.filter(account => !account.missing.length)

  if (!resolved.enabled) {
    throw new Error('Meta WhatsApp Oficial esta inativo na Sala de Manutencao.')
  }
  if (!readyAccounts.length) {
    const missing = Array.from(new Set(
      (configuredAccounts.length ? configuredAccounts : [resolved]).flatMap(account => account.missing)
    )).filter(Boolean)
    throw new Error(`Configuracao Meta WhatsApp incompleta: ${missing.join(', ') || 'ao menos uma WABA confirmada e token valido'}.`)
  }
  if (!input.confirmOptIn) {
    throw new Error('Confirme que todos os contatos deram opt-in antes de criar campanha oficial.')
  }

  const recipients = normalizeRecipients(input)
  if (!recipients.length) throw new Error('Nenhum destinatario valido informado.')

  const templateName = cleanText(input.templateName, 120)
  if (!templateName) throw new Error('Template oficial obrigatorio.')

  const templateLanguage = normalizeLanguage(input.templateLanguage || resolved.defaultLanguage)
  const scheduledFor = parseScheduledFor(input.scheduledFor)
  const campaignType = input.campaignType || 'marketing'
  const whatsAppValidationMode = input.whatsAppValidationMode === 'include_unverified'
    ? 'include_unverified'
    : 'confirmed_only'
  const creativeDeduplicationMode: CreativeDeduplicationMode = input.creativeDeduplicationMode === 'skip_previous'
    ? 'skip_previous'
    : input.creativeDeduplicationMode === 'allow_repeat'
      ? 'allow_repeat'
      : 'track_only'
  const metadata = asMetadata(input.metadata)
  const rawRoutingMode = cleanText(input.senderRoutingMode, 40)
  const requestedRoutingMode = ['single', 'round_robin', 'weighted_pool'].includes(rawRoutingMode)
    ? rawRoutingMode as 'single' | 'round_robin' | 'weighted_pool'
    : 'weighted_pool'
  const hasExplicitDefaultSender = Boolean(cleanText(input.defaultSenderId, 80))
  const automaticPoolAcrossAccounts = requestedRoutingMode === 'weighted_pool' && !hasExplicitDefaultSender
  const portfolioRoutingEnabled = automaticPoolAcrossAccounts
    || (requestedRoutingMode === 'round_robin' && metadata.portfolio_routing_enabled === true)
  const selectedDefaultSenderId = portfolioRoutingEnabled ? null : input.defaultSenderId
  let selectedSenderForWaba: any = null

  if (selectedDefaultSenderId) {
    const { data: senderForWaba, error: senderForWabaError } = await supabase
      .from('meta_whatsapp_senders')
      .select('id, waba_id')
      .eq('id', selectedDefaultSenderId)
      .maybeSingle()
    if (senderForWabaError) throw senderForWabaError
    selectedSenderForWaba = senderForWaba
  }

  const requestedWabaId = portfolioRoutingEnabled
    ? ''
    : cleanText(
      selectedSenderForWaba?.waba_id ||
      metadata.waba_id ||
      metadata.target_waba_id ||
      metadata.template_waba_id,
      120
    )
  const configuredWabaIds = Array.from(new Set(readyAccounts.map(account => account.wabaId).filter(Boolean)))
  let templateQuery = supabase
    .from('meta_whatsapp_templates')
    .select('id, waba_id, name, language, status')
    .eq('name', templateName)
    .eq('language', templateLanguage)
    .order('status', { ascending: true })

  if (requestedWabaId) {
    templateQuery = templateQuery.eq('waba_id', requestedWabaId)
  } else if (configuredWabaIds.length) {
    templateQuery = templateQuery.in('waba_id', configuredWabaIds)
  }

  const { data: templateMatches, error: templateError } = await templateQuery.limit(25)

  if (templateError) throw templateError
  const approvedTemplateMatches = (templateMatches || [])
    .filter((item: any) => String(item.status || '').toUpperCase() === 'APPROVED')
  const routingWabaIds = portfolioRoutingEnabled
    ? uniqueCleanText(approvedTemplateMatches.map((item: any) => item.waba_id))
      .filter(wabaId => configuredWabaIds.includes(wabaId))
    : []

  if (portfolioRoutingEnabled && !routingWabaIds.length) {
    throw new Error(`Template ${templateName} (${templateLanguage}) precisa estar aprovado em ao menos uma WABA configurada para usar distribuicao entre contas.`)
  }

  const template = approvedTemplateMatches[0]
    || templateMatches?.[0]
    || null
  const targetWabaId = cleanText(
    requestedWabaId ||
    routingWabaIds[0] ||
    template?.waba_id ||
    configuredWabaIds[0] ||
    resolved.wabaId,
    120
  )
  const activeRoutingWabaIds = portfolioRoutingEnabled
    ? routingWabaIds
    : uniqueCleanText([targetWabaId])

  for (const wabaId of activeRoutingWabaIds) {
    const routingConfig = resolveMetaWhatsAppConfigForWaba(configMap, wabaId)
    if (routingConfig.missing.length) {
      throw new Error(`Configuracao Meta WhatsApp incompleta para a WABA ${wabaId || 'selecionada'}: ${routingConfig.missing.join(', ')}.`)
    }
  }
  const targetConfig = resolveMetaWhatsAppConfigForWaba(configMap, targetWabaId)
  const targetAccount = readyAccounts.find(account => account.wabaId === targetWabaId)
    || configuredAccounts.find(account => account.wabaId === targetWabaId)
  const routingAccounts = activeRoutingWabaIds
    .map(wabaId => readyAccounts.find(account => account.wabaId === wabaId)
      || configuredAccounts.find(account => account.wabaId === wabaId))
    .filter(Boolean)

  if (!template) {
    throw new Error(`Template ${templateName} (${templateLanguage}) nao foi encontrado nas contas configuradas. Sincronize os templates antes de criar a campanha.`)
  }

  if (template?.status && String(template.status).toUpperCase() !== 'APPROVED') {
    throw new Error(`Template ${templateName} existe na base, mas esta com status ${template.status}. Use apenas templates aprovados.`)
  }

  const portfolioWabaIds = configuredWabaIds.length ? configuredWabaIds : activeRoutingWabaIds
  let sendersQuery = supabase
    .from('meta_whatsapp_senders')
    .select('id, display_name, phone_number, phone_number_id, waba_id, local_status, meta_status, quality_rating, messaging_limit_tier, daily_limit, daily_sent_count, daily_limit_resets_at, use_case, weight, last_error, metadata')
    .eq('local_status', 'active')
    .limit(200)

  if (portfolioWabaIds.length > 1) {
    sendersQuery = sendersQuery.in('waba_id', portfolioWabaIds)
  } else {
    sendersQuery = sendersQuery.eq('waba_id', portfolioWabaIds[0] || targetWabaId)
  }

  const { data: senders, error: sendersError } = await sendersQuery

  if (sendersError) throw sendersError
  const preparedPortfolioSenders = await syncSenderDailyUsageFromCampaignRecipients(supabase, senders || [])
  const preparedSenders = preparedPortfolioSenders
    .filter((sender: any) => activeRoutingWabaIds.includes(cleanText(sender.waba_id, 120)))
  const portfolioUsage = portfolioDailyUsage(preparedPortfolioSenders)
  const selectedSender = selectedDefaultSenderId
    ? preparedSenders.find((sender: any) => sender.id === selectedDefaultSenderId)
    : null
  const readyPoolSenders = preparedSenders.filter(isMetaSenderReady)
  const hasReadySender = selectedDefaultSenderId
    ? Boolean(selectedSender && isMetaSenderReady(selectedSender))
    : readyPoolSenders.length > 0

  if (portfolioUsage.remaining <= 0) {
    throw new Error(`${describePortfolioAvailability(preparedPortfolioSenders)} Aguarde o reset da janela de 24h ou crie a campanha agendada para depois.`)
  }

  if (!hasReadySender) {
    if (selectedDefaultSenderId) {
      throw new Error(`Numero oficial selecionado indisponivel para envio: ${describeSenderAvailability(selectedSender)} Escolha "Pool automatico por capacidade" ou um numero com saldo diario.`)
    }

    const connectedButExhausted = preparedSenders.some((sender: any) => (
      sender.local_status === 'active'
      && cleanText(sender.meta_status, 40).toUpperCase() === 'CONNECTED'
      && asNumber(sender.daily_limit) > 0
      && senderDailySentCount(sender) >= asNumber(sender.daily_limit)
    ))
    if (connectedButExhausted) {
      const knownUsage = preparedSenders
        .filter((sender: any) => sender.local_status === 'active')
        .map(describeSenderAvailability)
        .join(' ')
      throw new Error(`Todos os numeros Meta conectados atingiram o limite diario configurado. ${knownUsage}`)
    }

    const knownStatus = preparedSenders
      .map(describeSenderAvailability)
      .join(', ')
    throw new Error(`Nenhum numero Meta conectado para envio. O Phone Number precisa estar com status CONNECTED na Meta. Status atual: ${knownStatus || 'nenhum numero sincronizado'}.`)
  }

  const priorCreativeDeliveries = creativeDeduplicationMode !== 'allow_repeat'
    ? await fetchPriorCreativeDeliveries(supabase, recipients, templateName, templateLanguage)
    : { byPhone: new Map<string, PriorCreativeDelivery>(), byGroupKey: new Map<string, PriorCreativeDelivery>() }

  const { data: campaign, error: campaignError } = await supabase
    .from('meta_whatsapp_campaigns')
    .insert({
      name: cleanText(input.name, 180) || `Campanha Meta ${new Date().toISOString().slice(0, 10)}`,
      source: 'admin',
      campaign_type: campaignType,
      status: scheduledFor ? 'scheduled' : 'queued',
      template_id: template?.id || null,
      template_name: templateName,
      template_language: templateLanguage,
      sender_routing_mode: requestedRoutingMode,
      default_sender_id: selectedDefaultSenderId || null,
      audience_source: input.audienceSource || 'custom_paste',
      audience_query: {
        count: recipients.length,
        opt_in_source: input.optInSource || 'manual_admin_confirmed',
        whatsapp_validation_mode: whatsAppValidationMode,
        creative_deduplication_mode: creativeDeduplicationMode,
      },
      scheduled_for: scheduledFor,
      total_recipients: recipients.length,
      metadata: {
        ...metadata,
        waba_id: targetWabaId,
        waba_label: targetAccount?.label || targetWabaId,
        portfolio_routing_enabled: portfolioRoutingEnabled,
        routing_waba_ids: activeRoutingWabaIds,
        routing_waba_labels: routingAccounts.map((account: any) => account.label || account.wabaId).filter(Boolean),
        routing_template_ids: portfolioRoutingEnabled
          ? approvedTemplateMatches
            .filter((item: any) => activeRoutingWabaIds.includes(cleanText(item.waba_id, 120)))
            .map((item: any) => item.id)
            .filter(Boolean)
          : template?.id ? [template.id] : [],
        routing_sender_count: readyPoolSenders.length,
        whatsapp_validation_mode: whatsAppValidationMode,
        creative_deduplication_mode: creativeDeduplicationMode,
        template_status_at_creation: template?.status || 'not_synced',
        support_redirect_phone: targetConfig.supportRedirectPhone,
      },
    })
    .select('*')
    .single()

  if (campaignError) throw campaignError

  const optOutPhones = await fetchOptOutPhones(supabase, recipients.map(recipient => recipient.phone))
  const now = new Date().toISOString()
  const rows = recipients.map(recipient => {
    const optedOut = optOutPhones.has(recipient.phone)
    const withoutWhatsApp = isRecipientNotConfirmedByWhatsAppCheck(recipient, whatsAppValidationMode)
    const contactGroupKey = recipientContactGroupKey(recipient)
    const duplicateCreative = creativeDeduplicationMode !== 'allow_repeat'
      ? priorCreativeDeliveries.byPhone.get(recipient.phone) || (contactGroupKey ? priorCreativeDeliveries.byGroupKey.get(contactGroupKey) : null)
      : null
    const skippedByDuplicateCreative = creativeDeduplicationMode === 'skip_previous' && Boolean(duplicateCreative) && !optedOut && !withoutWhatsApp
    const duplicateCreativeMetadata = duplicateCreative ? {
      template_name: templateName,
      template_language: templateLanguage,
      prior_campaign_id: duplicateCreative.campaignId || null,
      prior_campaign_name: duplicateCreative.campaignName || null,
      prior_campaign_status: duplicateCreative.campaignStatus || null,
      prior_recipient_status: duplicateCreative.recipientStatus || null,
      prior_recipient_phone: duplicateCreative.recipientPhone || null,
      prior_contact_group_key: duplicateCreative.contactGroupKey || null,
      prior_created_at: duplicateCreative.createdAt || null,
    } : null
    return {
      campaign_id: campaign.id,
      template_id: template?.id || null,
      lead_id: recipient.leadId || null,
      education_lead_id: recipient.educationLeadId || null,
      customer_id: recipient.customerId || null,
      recipient_phone: recipient.phone,
      recipient_name: cleanText(recipient.name, 160) || null,
      opt_in_source: cleanText(recipient.optInSource || input.optInSource || 'manual_admin_confirmed', 160),
      opt_in_at: recipient.optInAt || now,
      status: optedOut ? 'opted_out' : withoutWhatsApp ? 'skipped' : skippedByDuplicateCreative ? 'skipped' : 'queued',
      error_code: withoutWhatsApp
        ? 'connectyhub_whatsapp_not_confirmed'
        : skippedByDuplicateCreative ? 'duplicate_creative_for_contact' : null,
      error_message: withoutWhatsApp
        ? 'Numero nao confirmado como WhatsApp pela ConnectyHub.'
        : skippedByDuplicateCreative ? 'Contato ja recebeu ou esta na fila para este mesmo criativo.' : null,
      scheduled_for: scheduledFor,
      template_parameters: recipient.templateParameters ?? {},
      metadata: {
        ...(recipient.metadata || {}),
        whatsapp_validation_mode: whatsAppValidationMode,
        creative_deduplication_mode: creativeDeduplicationMode,
        ...(duplicateCreativeMetadata ? {
          repeat_creative_history: {
            action: skippedByDuplicateCreative ? 'blocked' : 'tracked',
            allowed: !skippedByDuplicateCreative,
            ...duplicateCreativeMetadata,
          },
        } : {}),
        ...(withoutWhatsApp ? {
          skipped_reason: 'connectyhub_whatsapp_not_confirmed',
          skipped_at: now,
        } : {}),
        ...(skippedByDuplicateCreative ? {
          skipped_reason: 'duplicate_creative_for_contact',
          skipped_at: now,
          duplicate_creative: duplicateCreativeMetadata,
        } : {}),
      },
    }
  })

  const chunkSize = 500
  for (let index = 0; index < rows.length; index += chunkSize) {
    const { error } = await supabase
      .from('meta_whatsapp_campaign_recipients')
      .insert(rows.slice(index, index + chunkSize))
    if (error) throw error
  }

  const queuedCount = rows.filter(row => row.status === 'queued').length
  const skippedCount = rows.length - queuedCount
  await supabase
    .from('meta_whatsapp_campaigns')
    .update({
      total_queued: queuedCount,
      total_skipped: skippedCount,
      status: queuedCount > 0 ? (scheduledFor ? 'scheduled' : 'queued') : 'completed',
      completed_at: queuedCount > 0 ? null : now,
    })
    .eq('id', campaign.id)

  return {
    campaign: {
      ...campaign,
      total_queued: queuedCount,
      total_skipped: skippedCount,
      status: queuedCount > 0 ? (scheduledFor ? 'scheduled' : 'queued') : 'completed',
    },
    totalRecipients: rows.length,
    queuedCount,
    skippedCount,
    duplicateCreativeSkippedCount: rows.filter(row => row.error_code === 'duplicate_creative_for_contact').length,
    duplicateCreativeTrackedCount: rows.filter(row => (
      row.error_code !== 'duplicate_creative_for_contact'
      && asMetadata(row.metadata).repeat_creative_history
    )).length,
  }
}

function normalizeCampaignStatusFilter(value?: string | null) {
  const selected = cleanText(value, 40).toLowerCase()
  const allowed = new Set(['draft', 'scheduled', 'preparing', 'queued', 'sending', 'paused', 'completed', 'cancelled', 'failed'])
  return allowed.has(selected) ? selected : ''
}

function saoPauloDateParts(from = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(from)
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
  }
}

function normalizeReportDate(value?: string | null) {
  const selected = cleanText(value, 20)
  if (/^\d{4}-\d{2}-\d{2}$/.test(selected)) return selected

  const today = saoPauloDateParts(new Date())
  const yesterday = new Date(Date.UTC(today.year, today.month - 1, today.day - 1, 3, 0, 0, 0))
  const parts = saoPauloDateParts(yesterday)
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-')
}

function saoPauloDateRangeIso(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { startAt: start.toISOString(), endAt: end.toISOString() }
}

function dateInRange(value: unknown, startAt: string, endAt: string) {
  const raw = cleanText(value, 80)
  if (!raw) return false
  const time = new Date(raw).getTime()
  return Number.isFinite(time)
    && time >= new Date(startAt).getTime()
    && time < new Date(endAt).getTime()
}

function saoPauloDateOffset(daysOffset: number) {
  const parts = saoPauloDateParts(new Date())
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + daysOffset, 3, 0, 0, 0))
  return date.toISOString().slice(0, 10)
}

function normalizeDetailedReportDate(value: string | null | undefined, fallback: string) {
  const selected = cleanText(value, 20)
  if (/^\d{4}-\d{2}-\d{2}$/.test(selected)) return selected
  return fallback
}

function normalizeDetailedReportStatus(value?: string | null) {
  const selected = cleanText(value, 40).toLowerCase()
  const allowed = new Set(['queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'skipped', 'opted_out'])
  return allowed.has(selected) ? selected : ''
}

function normalizeDetailedReportIntent(value?: string | null) {
  const selected = cleanText(value, 40).toLowerCase()
  const allowed = new Set(['interested', 'opt_out', 'question', 'unknown'])
  return allowed.has(selected) ? selected : ''
}

function rowHasActivityInRange(row: any, startAt: string, endAt: string) {
  return [
    row?.sent_at,
    row?.delivered_at,
    row?.read_at,
    row?.failed_at,
    row?.cost_recorded_at,
    row?.updated_at,
    row?.created_at,
  ].some(value => dateInRange(value, startAt, endAt))
}

function rowSender(row: any) {
  if (Array.isArray(row?.sender)) return row.sender[0] || null
  return row?.sender || null
}

function rowCampaign(row: any) {
  if (Array.isArray(row?.campaign)) return row.campaign[0] || null
  return row?.campaign || null
}

function dailyCampaignKey(row: any) {
  return cleanText(row?.campaign_id || rowCampaign(row)?.id || 'sem-campanha', 120) || 'sem-campanha'
}

function emptyDailyCampaignRow(row: any) {
  const campaign = rowCampaign(row)
  return {
    campaign_id: cleanText(row?.campaign_id || campaign?.id, 80) || null,
    campaign_name: cleanText(campaign?.name || row?.campaign_name, 180) || 'Sem campanha vinculada',
    template_name: cleanText(campaign?.template_name || row?.template_name, 120) || 'Sem template',
    template_language: cleanText(campaign?.template_language, 40) || null,
    campaign_type: cleanText(campaign?.campaign_type, 60) || null,
    dispatched: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    replies: 0,
    positive_replies: 0,
    cost_amount: 0,
  }
}

function incrementDailyCampaignRow(
  map: Map<string, ReturnType<typeof emptyDailyCampaignRow>>,
  row: any,
  updates: Partial<ReturnType<typeof emptyDailyCampaignRow>>
) {
  const key = dailyCampaignKey(row)
  const current = map.get(key) || emptyDailyCampaignRow(row)
  current.dispatched += Number(updates.dispatched || 0)
  current.delivered += Number(updates.delivered || 0)
  current.read += Number(updates.read || 0)
  current.failed += Number(updates.failed || 0)
  current.replies += Number(updates.replies || 0)
  current.positive_replies += Number(updates.positive_replies || 0)
  current.cost_amount += Number(updates.cost_amount || 0)
  map.set(key, current)
}

export async function getMetaWhatsAppDailyReport(
  input: GetMetaWhatsAppDailyReportInput = {},
  supabase = createAdminClient()
) {
  const date = normalizeReportDate(input.date)
  const { startAt, endAt } = saoPauloDateRangeIso(date)
  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  const visibleWabaIds = visibleWabaIdsFromConfig(configMap)

  const [visibleSendersResult, recipientsResult, repliesResult] = await Promise.all([
    visibleWabaIds.length
      ? supabase
        .from('meta_whatsapp_senders')
        .select('id')
        .in('waba_id', visibleWabaIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('meta_whatsapp_campaign_recipients')
      .select(`
        id,
        campaign_id,
        sender_id,
        recipient_phone,
        recipient_name,
        status,
        sent_at,
        delivered_at,
        read_at,
        failed_at,
        cost_amount,
        currency,
        cost_status,
        cost_recorded_at,
        created_at,
        updated_at,
        campaign:meta_whatsapp_campaigns(id, name, status, campaign_type, template_name, template_language, default_sender_id, metadata)
      `)
      .or(`sent_at.gte.${startAt},delivered_at.gte.${startAt},read_at.gte.${startAt},failed_at.gte.${startAt},cost_recorded_at.gte.${startAt},updated_at.gte.${startAt}`)
      .order('updated_at', { ascending: false })
      .limit(20000),
    supabase
      .from('meta_whatsapp_reply_intents')
      .select(`
        id,
        campaign_id,
        sender_id,
        contact_phone,
        contact_name,
        intent,
        button_text,
        button_payload,
        raw_text,
        campaign_name,
        template_name,
        created_at,
        campaign:meta_whatsapp_campaigns(id, name, status, campaign_type, template_name, template_language, default_sender_id, metadata)
      `)
      .gte('created_at', startAt)
      .lt('created_at', endAt)
      .order('created_at', { ascending: false })
      .limit(20000),
  ])

  if (visibleSendersResult.error) throw visibleSendersResult.error
  if (recipientsResult.error) throw recipientsResult.error
  if (repliesResult.error) throw repliesResult.error

  const visibleSenderIds = new Set((visibleSendersResult.data || [])
    .map((sender: any) => cleanText(sender.id, 80))
    .filter(Boolean))
  const rowIsVisible = (row: any) => {
    const campaign = rowCampaign(row)
    const wabaId = campaignWabaId(campaign)
    if (wabaId) return visibleWabaIds.includes(wabaId)
    const senderId = cleanText(row.sender_id || campaign?.default_sender_id, 80)
    if (senderId) return visibleSenderIds.has(senderId)
    return true
  }

  const campaignRows = new Map<string, ReturnType<typeof emptyDailyCampaignRow>>()
  const recipients = ((recipientsResult.data || []) as any[])
    .filter(row => !asMetadata(rowCampaign(row)?.metadata).deleted_from_panel_at)
    .filter(rowIsVisible)

  let dispatched = 0
  let delivered = 0
  let read = 0
  let failed = 0
  let costAmount = 0
  const currencies = new Set<string>()

  recipients.forEach(row => {
    const sentInRange = dateInRange(row.sent_at, startAt, endAt)
    const deliveredInRange = dateInRange(row.delivered_at, startAt, endAt)
    const readInRange = dateInRange(row.read_at, startAt, endAt)
    const failedInRange = dateInRange(row.failed_at, startAt, endAt)
    const fallbackSentInRange = !row.sent_at
      && ['sent', 'delivered', 'read'].includes(cleanText(row.status, 40).toLowerCase())
      && (deliveredInRange || readInRange || dateInRange(row.updated_at, startAt, endAt))
    const dispatchedInRange = sentInRange || fallbackSentInRange
    const deliveredCounted = deliveredInRange || (!row.delivered_at && readInRange)
    const failedCounted = failedInRange
      || (cleanText(row.status, 40).toLowerCase() === 'failed' && dateInRange(row.updated_at, startAt, endAt))
    const rowCost = dispatchedInRange ? asNumber(row.cost_amount) : 0

    if (dispatchedInRange) dispatched += 1
    if (deliveredCounted) delivered += 1
    if (readInRange) read += 1
    if (failedCounted) failed += 1
    if (rowCost > 0) {
      costAmount += rowCost
      const rowCurrency = cleanText(row.currency || 'BRL', 12)
      if (rowCurrency) currencies.add(rowCurrency)
    }

    if (dispatchedInRange || deliveredCounted || readInRange || failedCounted || rowCost > 0) {
      incrementDailyCampaignRow(campaignRows, row, {
        dispatched: dispatchedInRange ? 1 : 0,
        delivered: deliveredCounted ? 1 : 0,
        read: readInRange ? 1 : 0,
        failed: failedCounted ? 1 : 0,
        cost_amount: rowCost,
      })
    }
  })

  const replies = ((repliesResult.data || []) as any[])
    .filter(row => !asMetadata(rowCampaign(row)?.metadata).deleted_from_panel_at)
    .filter(rowIsVisible)
  let positiveReplies = 0
  let optOutReplies = 0
  let questionReplies = 0
  let unknownReplies = 0

  replies.forEach(row => {
    const intent = cleanText(row.intent, 40).toLowerCase()
    if (intent === 'interested') positiveReplies += 1
    else if (intent === 'opt_out') optOutReplies += 1
    else if (intent === 'question') questionReplies += 1
    else unknownReplies += 1

    incrementDailyCampaignRow(campaignRows, row, {
      replies: 1,
      positive_replies: intent === 'interested' ? 1 : 0,
    })
  })

  const campaigns = Array.from(campaignRows.values())
    .sort((a, b) => b.dispatched - a.dispatched || b.replies - a.replies || a.campaign_name.localeCompare(b.campaign_name))

  return {
    date,
    timezone: 'America/Sao_Paulo',
    start_at: startAt,
    end_at: endAt,
    totals: {
      dispatched,
      delivered,
      read,
      failed,
      replies: replies.length,
      positive_replies: positiveReplies,
      opt_out_replies: optOutReplies,
      question_replies: questionReplies,
      unknown_replies: unknownReplies,
      cost_amount: Number(costAmount.toFixed(4)),
      cost_currency: currencies.size === 1 ? Array.from(currencies)[0] : 'BRL',
      response_rate: metricRate(replies.length, dispatched),
      positive_response_rate: metricRate(positiveReplies, dispatched),
    },
    campaigns,
  }
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function incrementDetailedGroup(
  map: Map<string, any>,
  key: string,
  label: string,
  row: any,
  reply: any | null
) {
  const selectedKey = key || 'sem-identificacao'
  const current = map.get(selectedKey) || {
    key: selectedKey,
    label: label || selectedKey,
    recipients: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    skipped: 0,
    replies: 0,
    positive_replies: 0,
    cost_amount: 0,
  }
  const status = cleanText(row?.status, 40).toLowerCase()
  const wasSent = Boolean(row?.sent_at) || ['sent', 'delivered', 'read'].includes(status)
  const wasDelivered = Boolean(row?.delivered_at || row?.read_at) || ['delivered', 'read'].includes(status)
  const wasRead = Boolean(row?.read_at) || status === 'read'
  const wasFailed = Boolean(row?.failed_at) || status === 'failed'
  const wasSkipped = status === 'skipped' || status === 'cancelled' || status === 'opted_out'
  const intent = cleanText(reply?.intent, 40).toLowerCase()

  current.recipients += 1
  if (wasSent) current.sent += 1
  if (wasDelivered) current.delivered += 1
  if (wasRead) current.read += 1
  if (wasFailed) current.failed += 1
  if (wasSkipped) current.skipped += 1
  if (reply) current.replies += 1
  if (intent === 'interested') current.positive_replies += 1
  current.cost_amount += asNumber(row?.cost_amount)
  map.set(selectedKey, current)
}

export async function getMetaWhatsAppDetailedReport(
  input: GetMetaWhatsAppDetailedReportInput = {},
  supabase = createAdminClient()
) {
  const fallbackFrom = saoPauloDateOffset(-7)
  const fallbackTo = saoPauloDateOffset(0)
  let dateFrom = normalizeDetailedReportDate(input.dateFrom, fallbackFrom)
  let dateTo = normalizeDetailedReportDate(input.dateTo, fallbackTo)
  if (dateFrom > dateTo) {
    const previousFrom = dateFrom
    dateFrom = dateTo
    dateTo = previousFrom
  }

  const startAt = saoPauloDateRangeIso(dateFrom).startAt
  const endAt = saoPauloDateRangeIso(dateTo).endAt
  const limit = Math.min(5000, Math.max(1, Number(input.limit || 1000)))
  const queryLimit = Math.min(25000, Math.max(limit * 4, 1000))
  const templateName = cleanText(input.templateName, 160)
  const campaignId = cleanText(input.campaignId, 80)
  const senderId = cleanText(input.senderId, 80)
  const requestedWabaId = cleanText(input.wabaId, 120)
  const status = normalizeDetailedReportStatus(input.status)
  const intent = normalizeDetailedReportIntent(input.intent)
  const search = cleanText(input.search, 160).toLowerCase()
  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  const accountConfigs = resolveMetaWhatsAppAccountConfigs(configMap)
    .filter(account => account.enabled && !account.missing.length)
  const visibleWabaIds = visibleWabaIdsFromConfig(configMap)
  const wabaLabelById = new Map(accountConfigs.map(account => [account.wabaId, account.label]))

  let sendersQuery = supabase
    .from('meta_whatsapp_senders')
    .select('id, display_name, phone_number, phone_number_id, waba_id, local_status, meta_status, quality_rating, metadata')
  if (visibleWabaIds.length) sendersQuery = sendersQuery.in('waba_id', visibleWabaIds)
  const { data: visibleSenders, error: sendersError } = await sendersQuery
  if (sendersError) throw sendersError

  const senderEntries: Array<[string, any]> = (visibleSenders || [])
    .map((sender: any) => [cleanText(sender?.id, 80), sender])
    .filter((entry: [string, any]) => Boolean(entry[0]))
  const senderById = new Map(senderEntries)
  const visibleSenderIds = new Set(senderById.keys())

  let query = supabase
    .from('meta_whatsapp_campaign_recipients')
    .select(`
      id,
      campaign_id,
      sender_id,
      recipient_phone,
      recipient_name,
      status,
      provider_message_id,
      error_code,
      error_message,
      sent_at,
      delivered_at,
      read_at,
      failed_at,
      cost_amount,
      currency,
      cost_status,
      cost_recorded_at,
      metadata,
      created_at,
      updated_at,
      campaign:meta_whatsapp_campaigns(id, name, status, campaign_type, template_name, template_language, default_sender_id, metadata),
      sender:meta_whatsapp_senders(id, display_name, phone_number, phone_number_id, waba_id, local_status, meta_status, quality_rating, metadata)
    `)
    .or(`sent_at.gte.${startAt},delivered_at.gte.${startAt},read_at.gte.${startAt},failed_at.gte.${startAt},cost_recorded_at.gte.${startAt},updated_at.gte.${startAt},created_at.gte.${startAt}`)
    .order('updated_at', { ascending: false })
    .limit(queryLimit)

  if (campaignId) query = query.eq('campaign_id', campaignId)
  if (senderId) query = query.eq('sender_id', senderId)
  if (status) query = query.eq('status', status)

  const { data: recipientRows, error } = await query
  if (error) throw error

  const rowIsVisible = (row: any) => {
    const campaign = rowCampaign(row)
    const sender = rowSender(row) || senderById.get(cleanText(row?.sender_id || campaign?.default_sender_id, 80))
    const wabaId = cleanText(sender?.waba_id || campaignWabaId(campaign), 120)
    if (requestedWabaId && wabaId !== requestedWabaId) return false
    if (wabaId) return !visibleWabaIds.length || visibleWabaIds.includes(wabaId)
    const resolvedSenderId = cleanText(row?.sender_id || campaign?.default_sender_id, 80)
    if (resolvedSenderId) return visibleSenderIds.has(resolvedSenderId)
    return true
  }

  let recipients = ((recipientRows || []) as any[])
    .filter(row => !asMetadata(rowCampaign(row)?.metadata).deleted_from_panel_at)
    .filter(rowIsVisible)
    .filter(row => rowHasActivityInRange(row, startAt, endAt))

  if (templateName) {
    recipients = recipients.filter(row => cleanText(rowCampaign(row)?.template_name, 160) === templateName)
  }

  if (search) {
    recipients = recipients.filter(row => {
      const campaign = rowCampaign(row)
      const sender = rowSender(row) || senderById.get(cleanText(row?.sender_id || campaign?.default_sender_id, 80))
      return [
        row?.recipient_phone,
        row?.recipient_name,
        row?.status,
        row?.error_code,
        row?.error_message,
        campaign?.name,
        campaign?.template_name,
        campaign?.template_language,
        sender?.display_name,
        sender?.phone_number,
      ].some(value => cleanText(value, 500).toLowerCase().includes(search))
    })
  }

  const recipientIds = recipients.map((row: any) => cleanText(row?.id, 80)).filter(Boolean)
  const latestReplyByRecipient = new Map<string, any>()

  for (const chunk of chunkValues(recipientIds, 500)) {
    let repliesQuery = supabase
      .from('meta_whatsapp_reply_intents')
      .select('id, recipient_id, campaign_id, sender_id, contact_phone, contact_name, intent, button_text, button_payload, raw_text, auto_reply_status, notified_status, created_at')
      .in('recipient_id', chunk)
      .order('created_at', { ascending: false })
      .limit(Math.min(2500, Math.max(chunk.length * 3, 200)))
    if (intent) repliesQuery = repliesQuery.eq('intent', intent)

    const { data: replies, error: repliesError } = await repliesQuery
    if (repliesError) throw repliesError

    for (const reply of replies || []) {
      const recipientId = cleanText((reply as any).recipient_id, 80)
      if (recipientId && !latestReplyByRecipient.has(recipientId)) {
        latestReplyByRecipient.set(recipientId, reply)
      }
    }
  }

  if (intent) {
    recipients = recipients.filter(row => latestReplyByRecipient.has(cleanText(row?.id, 80)))
  }

  const rows = recipients.slice(0, limit).map((row: any) => {
    const campaign = rowCampaign(row)
    const fallbackSenderId = cleanText(row?.sender_id || campaign?.default_sender_id, 80)
    const sender = rowSender(row) || senderById.get(fallbackSenderId) || null
    const wabaId = cleanText(sender?.waba_id || campaignWabaId(campaign), 120) || null
    const reply = latestReplyByRecipient.get(cleanText(row?.id, 80)) || null
    const recipientMetadata = asMetadata(row.metadata)
    const repeatCreativeHistory = asMetadata(recipientMetadata.repeat_creative_history || recipientMetadata.duplicate_creative)

    return {
      recipient_id: row.id,
      campaign_id: row.campaign_id || campaign?.id || null,
      campaign_name: cleanText(campaign?.name, 180) || 'Sem campanha vinculada',
      campaign_type: cleanText(campaign?.campaign_type, 60) || null,
      template_name: cleanText(campaign?.template_name, 160) || 'Sem template',
      template_language: cleanText(campaign?.template_language, 40) || null,
      sender_id: fallbackSenderId || null,
      sender_name: cleanText(sender?.display_name, 180) || null,
      sender_phone: cleanText(sender?.phone_number, 40) || null,
      waba_id: wabaId,
      waba_label: wabaId ? (wabaLabelById.get(wabaId) || wabaId) : null,
      recipient_phone: cleanText(row.recipient_phone, 40),
      recipient_name: cleanText(row.recipient_name, 180) || null,
      status: cleanText(row.status, 40) || 'sem_status',
      sent_at: row.sent_at || null,
      delivered_at: row.delivered_at || null,
      read_at: row.read_at || null,
      failed_at: row.failed_at || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
      error_code: cleanText(row.error_code, 80) || null,
      error_message: cleanText(row.error_message, 500) || null,
      reply_intent: cleanText(reply?.intent, 40) || null,
      reply_text: cleanText(reply?.raw_text, 1000) || null,
      reply_button: cleanText(reply?.button_text || reply?.button_payload, 300) || null,
      reply_at: reply?.created_at || null,
      cost_amount: asNumber(row.cost_amount),
      currency: cleanText(row.currency || 'BRL', 12) || 'BRL',
      repeat_creative_history: Boolean(repeatCreativeHistory.prior_campaign_id || repeatCreativeHistory.prior_created_at),
      repeat_creative_action: cleanText(repeatCreativeHistory.action, 40) || null,
      prior_campaign_id: cleanText(repeatCreativeHistory.prior_campaign_id, 80) || null,
      prior_campaign_name: cleanText(repeatCreativeHistory.prior_campaign_name, 180) || null,
      prior_recipient_status: cleanText(repeatCreativeHistory.prior_recipient_status, 40) || null,
      prior_sent_at: cleanText(repeatCreativeHistory.prior_created_at, 40) || null,
    }
  })

  const byStatus: Record<string, number> = {}
  const byTemplate = new Map<string, any>()
  const byCampaign = new Map<string, any>()
  const bySender = new Map<string, any>()
  const byWaba = new Map<string, any>()
  let sent = 0
  let delivered = 0
  let read = 0
  let failed = 0
  let skipped = 0
  let replies = 0
  let positiveReplies = 0
  let costAmount = 0
  const currencies = new Set<string>()

  rows.forEach(row => {
    const statusValue = cleanText(row.status, 40).toLowerCase()
    const reply = row.reply_intent ? { intent: row.reply_intent } : null
    const wasSent = Boolean(row.sent_at) || ['sent', 'delivered', 'read'].includes(statusValue)
    const wasDelivered = Boolean(row.delivered_at || row.read_at) || ['delivered', 'read'].includes(statusValue)
    const wasRead = Boolean(row.read_at) || statusValue === 'read'
    const wasFailed = Boolean(row.failed_at) || statusValue === 'failed'
    const wasSkipped = statusValue === 'skipped' || statusValue === 'cancelled' || statusValue === 'opted_out'

    byStatus[statusValue || 'sem_status'] = (byStatus[statusValue || 'sem_status'] || 0) + 1
    if (wasSent) sent += 1
    if (wasDelivered) delivered += 1
    if (wasRead) read += 1
    if (wasFailed) failed += 1
    if (wasSkipped) skipped += 1
    if (reply) replies += 1
    if (row.reply_intent === 'interested') positiveReplies += 1
    costAmount += asNumber(row.cost_amount)
    if (row.currency) currencies.add(row.currency)

    incrementDetailedGroup(byTemplate, `${row.template_name}::${row.template_language || ''}`, `${row.template_name}${row.template_language ? ` (${row.template_language})` : ''}`, row, reply)
    incrementDetailedGroup(byCampaign, row.campaign_id || row.campaign_name, row.campaign_name, row, reply)
    incrementDetailedGroup(bySender, row.sender_id || row.sender_phone || 'sem-remetente', row.sender_name || row.sender_phone || 'Sem remetente', row, reply)
    incrementDetailedGroup(byWaba, row.waba_id || 'sem-conta', row.waba_label || row.waba_id || 'Sem conta', row, reply)
  })

  const sortedGroups = (map: Map<string, any>) => Array.from(map.values())
    .map(group => ({
      ...group,
      delivery_rate: metricRate(group.delivered, group.sent || group.recipients),
      read_rate: metricRate(group.read, group.delivered || group.sent || group.recipients),
      reply_rate: metricRate(group.replies, group.sent || group.recipients),
      cost_amount: Number(asNumber(group.cost_amount).toFixed(4)),
    }))
    .sort((a, b) => b.recipients - a.recipients || b.replies - a.replies || a.label.localeCompare(b.label))

  return {
    filters: {
      date_from: dateFrom,
      date_to: dateTo,
      start_at: startAt,
      end_at: endAt,
      template_name: templateName || null,
      campaign_id: campaignId || null,
      sender_id: senderId || null,
      waba_id: requestedWabaId || null,
      status: status || null,
      intent: intent || null,
      search: search || null,
      limit,
    },
    summary: {
      recipients: rows.length,
      sent,
      delivered,
      read,
      failed,
      skipped,
      replies,
      positive_replies: positiveReplies,
      cost_amount: Number(costAmount.toFixed(4)),
      cost_currency: currencies.size === 1 ? Array.from(currencies)[0] : 'BRL',
      delivery_rate: metricRate(delivered, sent || rows.length),
      read_rate: metricRate(read, delivered || sent || rows.length),
      reply_rate: metricRate(replies, sent || rows.length),
      positive_reply_rate: metricRate(positiveReplies, sent || rows.length),
      by_status: byStatus,
      by_template: sortedGroups(byTemplate),
      by_campaign: sortedGroups(byCampaign),
      by_sender: sortedGroups(bySender),
      by_waba: sortedGroups(byWaba),
    },
    rows,
  }
}

export async function listMetaWhatsAppCampaigns(input: ListMetaWhatsAppCampaignsInput = {}, supabase = createAdminClient()) {
  const limit = Math.min(250, Math.max(1, Number(input.limit || 40)))
  const queryLimit = Math.min(500, limit * 3)
  const status = normalizeCampaignStatusFilter(input.status)
  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  const visibleWabaIds = visibleWabaIdsFromConfig(configMap)

  let query = supabase
    .from('meta_whatsapp_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(queryLimit)

  if (status) query = query.eq('status', status)

  const { data: campaigns, error } = await query
  if (error) throw error

  let sendersQuery = supabase
    .from('meta_whatsapp_senders')
    .select('id, display_name, phone_number, phone_number_id, waba_id, local_status, meta_status, quality_rating, messaging_limit_tier, daily_limit, daily_sent_count, daily_limit_resets_at, use_case, weight, last_error, metadata')
    .order('local_status', { ascending: true })
    .order('display_name', { ascending: true })
  if (visibleWabaIds.length) sendersQuery = sendersQuery.in('waba_id', visibleWabaIds)

  const { data: senders, error: sendersError } = await sendersQuery
  if (sendersError) throw sendersError
  const preparedSenders = await syncSenderDailyUsageFromCampaignRecipients(supabase, senders || [])
  const visibleSenderIds = new Set(preparedSenders.map((sender: any) => cleanText(sender.id, 80)).filter(Boolean))
  const visibleCampaigns = (campaigns || [])
    .filter((campaign: any) => !asMetadata(campaign.metadata).deleted_from_panel_at)
    .filter((campaign: any) => {
      const wabaId = campaignWabaId(campaign)
      if (wabaId) return !visibleWabaIds.length || visibleWabaIds.includes(wabaId)
      const defaultSenderId = cleanText(campaign.default_sender_id, 80)
      if (defaultSenderId) return visibleSenderIds.has(defaultSenderId)
      return true
    })
    .slice(0, limit)

  let templatesQuery = supabase
    .from('meta_whatsapp_templates')
    .select('id, waba_id, name, language, category, status, quality_score, components, metadata, last_synced_at')
    .order('status', { ascending: true })
    .order('name', { ascending: true })
    .limit(200)
  if (visibleWabaIds.length) templatesQuery = templatesQuery.in('waba_id', visibleWabaIds)

  const { data: templates, error: templatesError } = await templatesQuery
  if (templatesError) throw templatesError
  const campaignTemplates = (templates || []).filter(isCampaignTemplateEligible)

  const summary = visibleCampaigns.reduce((acc: any, campaign: any) => {
    acc.total += 1
    acc.recipients += Number(campaign.total_recipients || 0)
    acc.queued += Number(campaign.total_queued || 0)
    acc.sent += Number(campaign.total_sent || 0)
    acc.delivered += Number(campaign.total_delivered || 0)
    acc.read += Number(campaign.total_read || 0)
    acc.failed += Number(campaign.total_failed || 0)
    acc.skipped += Number(campaign.total_skipped || 0)
    acc.byStatus[campaign.status] = (acc.byStatus[campaign.status] || 0) + 1
    return acc
  }, {
    total: 0,
    recipients: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    skipped: 0,
    byStatus: {},
  })

  const campaignIds = visibleCampaigns.map((campaign: any) => String(campaign.id)).filter(Boolean)
  let analyticsRecipients: any[] = []
  let analyticsEvents: any[] = []

  if (campaignIds.length) {
    const [recipientsResult, eventsResult] = await Promise.all([
      supabase
        .from('meta_whatsapp_campaign_recipients')
        .select('id, campaign_id, sender_id, recipient_phone, status, provider_message_id, error_code, error_message, sent_at, delivered_at, read_at, failed_at, created_at, updated_at')
        .in('campaign_id', campaignIds)
        .order('created_at', { ascending: false })
        .limit(5000),
      supabase
        .from('meta_whatsapp_events')
        .select('id, campaign_id, provider_message_id, event_type, event_status, recipient_phone, payload, received_at')
        .in('campaign_id', campaignIds)
        .order('received_at', { ascending: false })
        .limit(1500),
    ])

    if (recipientsResult.error) throw recipientsResult.error
    if (eventsResult.error) throw eventsResult.error

    analyticsRecipients = recipientsResult.data || []
    analyticsEvents = eventsResult.data || []
  }

  const analytics = buildMetaWhatsAppAnalytics(
    visibleCampaigns,
    preparedSenders,
    analyticsRecipients,
    analyticsEvents
  )

  return {
    campaigns: visibleCampaigns,
    senders: preparedSenders,
    templates: campaignTemplates,
    summary,
    analytics,
  }
}

export async function getMetaWhatsAppCampaignDetail(input: GetMetaWhatsAppCampaignDetailInput, supabase = createAdminClient()) {
  const campaignId = cleanText(input.campaignId, 80)
  if (!campaignId) throw new Error('campaignId obrigatorio.')

  const limit = Math.min(200, Math.max(1, Number(input.limit || 80)))
  const { data: campaign, error: campaignError } = await supabase
    .from('meta_whatsapp_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()

  if (campaignError) throw campaignError
  if (!campaign) throw new Error('Campanha Meta nao encontrada.')

  const [recipientsResult, eventsResult] = await Promise.all([
    supabase
      .from('meta_whatsapp_campaign_recipients')
      .select('id, campaign_id, recipient_phone, recipient_name, status, provider_message_id, sender_id, error_code, error_message, sent_at, delivered_at, read_at, failed_at, created_at, updated_at, template_parameters, metadata')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('meta_whatsapp_events')
      .select('id, provider_message_id, event_type, event_status, recipient_phone, received_at, payload')
      .eq('campaign_id', campaignId)
      .order('received_at', { ascending: false })
      .limit(limit),
  ])

  if (recipientsResult.error) throw recipientsResult.error
  if (eventsResult.error) throw eventsResult.error

  return {
    campaign,
    recipients: recipientsResult.data || [],
    events: eventsResult.data || [],
  }
}

export async function manageMetaWhatsAppCampaign(params: {
  campaignId: string
  action: 'pause' | 'resume' | 'cancel' | 'delete'
}, supabase = createAdminClient()) {
  const campaignId = cleanText(params.campaignId, 80)
  if (!campaignId) throw new Error('campaignId obrigatorio.')

  const { data: campaign, error } = await supabase
    .from('meta_whatsapp_campaigns')
    .select('id, status, scheduled_for, total_queued, metadata')
    .eq('id', campaignId)
    .maybeSingle()

  if (error) throw error
  if (!campaign) throw new Error('Campanha Meta nao encontrada.')

  const currentStatus = String(campaign.status || '')
  const now = new Date().toISOString()

  if (params.action === 'delete') {
    if (['scheduled', 'preparing', 'queued', 'sending'].includes(currentStatus)) {
      throw new Error('Pause ou cancele a campanha antes de excluir do painel.')
    }

    const { error: recipientsError } = await supabase
      .from('meta_whatsapp_campaign_recipients')
      .update({ status: 'cancelled' })
      .eq('campaign_id', campaignId)
      .in('status', ['queued', 'sending'])
    if (recipientsError) throw recipientsError

    const metadata = asMetadata(campaign.metadata)
    const updatePayload: Record<string, unknown> = {
      metadata: {
        ...metadata,
        deleted_from_panel: true,
        deleted_from_panel_at: now,
      },
    }

    if (['draft', 'paused'].includes(currentStatus)) {
      updatePayload.status = 'cancelled'
      updatePayload.completed_at = now
    }

    const { error: updateError } = await supabase
      .from('meta_whatsapp_campaigns')
      .update(updatePayload)
      .eq('id', campaignId)
    if (updateError) throw updateError

    return { status: 'deleted' }
  }

  if (['completed', 'cancelled', 'failed'].includes(currentStatus)) {
    throw new Error(`Campanha ja esta em estado final: ${currentStatus}.`)
  }

  if (params.action === 'pause') {
    const { error: updateError } = await supabase
      .from('meta_whatsapp_campaigns')
      .update({ status: 'paused', paused_at: now })
      .eq('id', campaignId)
    if (updateError) throw updateError
    return { status: 'paused' }
  }

  if (params.action === 'cancel') {
    const { error: recipientsError } = await supabase
      .from('meta_whatsapp_campaign_recipients')
      .update({ status: 'cancelled' })
      .eq('campaign_id', campaignId)
      .in('status', ['queued', 'sending'])
    if (recipientsError) throw recipientsError

    const { error: updateError } = await supabase
      .from('meta_whatsapp_campaigns')
      .update({ status: 'cancelled', completed_at: now })
      .eq('id', campaignId)
    if (updateError) throw updateError
    return { status: 'cancelled' }
  }

  const scheduledFor = campaign.scheduled_for ? new Date(campaign.scheduled_for).getTime() : 0
  const nextStatus = scheduledFor > Date.now() ? 'scheduled' : 'queued'
  const { error: updateError } = await supabase
    .from('meta_whatsapp_campaigns')
    .update({ status: nextStatus, paused_at: null })
    .eq('id', campaignId)
  if (updateError) throw updateError

  return { status: nextStatus }
}

export async function retryFailedMetaWhatsAppCampaignRecipients(params: {
  campaignId: string
}, supabase = createAdminClient()) {
  const campaignId = cleanText(params.campaignId, 80)
  if (!campaignId) throw new Error('campaignId obrigatorio.')

  const { data: campaign, error: campaignError } = await supabase
    .from('meta_whatsapp_campaigns')
    .select('id, status, template_name, template_language, metadata, total_queued, total_failed')
    .eq('id', campaignId)
    .maybeSingle()

  if (campaignError) throw campaignError
  if (!campaign) throw new Error('Campanha Meta nao encontrada.')

  const currentStatus = String(campaign.status || '')
  if (['queued', 'sending', 'scheduled', 'preparing'].includes(currentStatus)) {
    throw new Error('A campanha ainda esta ativa. Aguarde finalizar ou pause antes de reenviar falhas.')
  }
  if (currentStatus === 'cancelled') {
    throw new Error('Campanha cancelada nao pode ser reenviada.')
  }

  const { data: failedRecipients, error: failedRecipientsError } = await supabase
    .from('meta_whatsapp_campaign_recipients')
    .select('id, sender_id, error_code, error_message, failed_at, metadata')
    .eq('campaign_id', campaignId)
    .eq('status', 'failed')
    .order('failed_at', { ascending: false, nullsFirst: false })
    .limit(20000)

  if (failedRecipientsError) throw failedRecipientsError
  const retryCount = failedRecipients?.length || 0
  if (retryCount <= 0) {
    return {
      status: currentStatus,
      queued: 0,
      message: 'Nenhum destinatario com falha para reenviar.',
    }
  }

  const now = new Date().toISOString()
  const retryChunks = chunkValues(failedRecipients || [], 100)
  for (const chunk of retryChunks) {
    const results = await Promise.all(chunk.map((recipient: any) => {
      const metadata = asMetadata(recipient.metadata)
      const history = Array.isArray(metadata.retry_history)
        ? metadata.retry_history.slice(-9)
        : []

      return supabase
        .from('meta_whatsapp_campaign_recipients')
        .update({
          status: 'queued',
          sender_id: null,
          provider_message_id: null,
          error_code: null,
          error_message: null,
          scheduled_for: null,
          sent_at: null,
          delivered_at: null,
          read_at: null,
          failed_at: null,
          metadata: {
            ...metadata,
            retry_history: [
              ...history,
              {
                retried_at: now,
                previous_sender_id: recipient.sender_id || null,
                previous_error_code: recipient.error_code || null,
                previous_error_message: recipient.error_message || null,
                previous_failed_at: recipient.failed_at || null,
              },
            ],
            retry_failover_requested: true,
            retry_previous_sender_id: recipient.sender_id || null,
          },
        })
        .eq('id', recipient.id)
    }))

    const chunkError = results.find(result => result.error)?.error
    if (chunkError) throw chunkError
  }

  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  const readyAccounts = resolveMetaWhatsAppAccountConfigs(configMap)
    .filter(account => account.enabled && !account.missing.length)
  const approvedWabaIds = await approvedTemplateWabaIdsForCampaign(
    supabase,
    campaign,
    readyAccounts.map(account => account.wabaId)
  )
  const metadata = asMetadata(campaign.metadata)
  const totalQueued = Number(campaign.total_queued || 0)
  const totalFailed = Number(campaign.total_failed || 0)
  const { error: updateError } = await supabase
    .from('meta_whatsapp_campaigns')
    .update({
      status: 'queued',
      sender_routing_mode: approvedWabaIds.length >= 2 ? 'round_robin' : 'weighted_pool',
      default_sender_id: null,
      total_queued: totalQueued + retryCount,
      total_failed: Math.max(0, totalFailed - retryCount),
      completed_at: null,
      paused_at: null,
      metadata: {
        ...metadata,
        portfolio_routing_enabled: approvedWabaIds.length >= 2 || metadata.portfolio_routing_enabled === true,
        routing_waba_ids: approvedWabaIds.length ? approvedWabaIds : arrayFromMetadata(metadata.routing_waba_ids),
        retry_failover_enabled: true,
        retry_failed_count: Number(metadata.retry_failed_count || 0) + 1,
        last_retry_failed_at: now,
        last_retry_failed_recipients: retryCount,
      },
    })
    .eq('id', campaignId)

  if (updateError) throw updateError

  return {
    status: 'queued',
    queued: retryCount,
    message: `${retryCount} destinatario(s) com falha voltaram para a fila. O reenvio vai ignorar contas indisponiveis e usar contas saudaveis onde o template estiver aprovado.`,
  }
}

function bodyParametersFromTemplateParameters(value: unknown) {
  if (!value) return undefined
  if (Array.isArray(value)) {
    return [{
      type: 'body',
      parameters: value.map(item => typeof item === 'object' && item !== null
        ? item
        : { type: 'text', text: String(item) }),
    }]
  }

  if (typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (Array.isArray(record.components)) return record.components

  const body = Array.isArray(record.body)
    ? record.body
    : Array.isArray(record.parameters)
      ? record.parameters
      : []

  if (!body.length) return undefined
  return [{
    type: 'body',
    parameters: body.map(item => typeof item === 'object' && item !== null
      ? item
      : { type: 'text', text: String(item) }),
  }]
}

function templateComponentsContainMetaHostedMedia(components?: unknown[]) {
  if (!components?.length) return false

  return components.some(component => {
    const componentRecord = asMetadata(component)
    if (cleanText(componentRecord.type, 40).toLowerCase() !== 'header') return false

    const parameters = Array.isArray(componentRecord.parameters) ? componentRecord.parameters : []
    return parameters.some(parameter => {
      const parameterRecord = asMetadata(parameter)
      const type = cleanText(parameterRecord.type, 40).toLowerCase()
      if (!['image', 'video', 'document'].includes(type)) return false
      const media = asMetadata(parameterRecord[type])
      return isMetaHostedTemplateMediaUrl(media.link)
    })
  })
}

function replaceMetaHostedTemplateMediaLinks(components: unknown[] | undefined, replacementUrl: string) {
  if (!components?.length) return { components, repaired: false }

  let foundUnsafeMedia = false
  let repaired = false
  const updatedComponents = components.map(component => {
    const componentRecord = asMetadata(component)
    if (cleanText(componentRecord.type, 40).toLowerCase() !== 'header') return component

    const parameters = Array.isArray(componentRecord.parameters) ? componentRecord.parameters : []
    if (!parameters.length) return component

    let componentRepaired = false
    const updatedParameters = parameters.map(parameter => {
      const parameterRecord = asMetadata(parameter)
      const type = cleanText(parameterRecord.type, 40).toLowerCase()
      if (!['image', 'video', 'document'].includes(type)) return parameter

      const media = asMetadata(parameterRecord[type])
      if (!isMetaHostedTemplateMediaUrl(media.link)) return parameter
      foundUnsafeMedia = true

      if (!replacementUrl) return parameter
      componentRepaired = true
      repaired = true
      return {
        ...parameterRecord,
        [type]: {
          ...media,
          link: replacementUrl,
        },
      }
    })

    return componentRepaired
      ? { ...componentRecord, parameters: updatedParameters }
      : component
  })

  if (foundUnsafeMedia && !replacementUrl) {
    throw new Error('A midia do header esta usando um link temporario da Meta/WhatsApp. Salve uma URL publica/R2 para este template antes de reenviar.')
  }

  return {
    components: repaired ? updatedComponents : components,
    repaired,
  }
}

function templateParametersWithComponents(value: unknown, components: unknown[]) {
  return {
    ...asMetadata(value),
    components,
  }
}

async function queryStableTemplateHeaderMediaUrl(
  supabase: SupabaseAdmin,
  templateName: string,
  templateLanguage: string,
  wabaId: string
) {
  const name = cleanText(templateName, 120)
  const language = normalizeLanguage(templateLanguage)
  const targetWabaId = cleanText(wabaId, 120)
  if (!name) return ''

  if (targetWabaId) {
    const { data: sameWabaRows, error: sameWabaError } = await supabase
      .from('meta_whatsapp_templates')
      .select('id, waba_id, metadata')
      .eq('name', name)
      .eq('language', language)
      .eq('waba_id', targetWabaId)
      .limit(5)

    if (sameWabaError) throw sameWabaError
    for (const row of sameWabaRows || []) {
      const url = templateHeaderMediaUrlFromMetadata((row as any).metadata)
      if (url) return url
    }
  }

  const { data: rows, error } = await supabase
    .from('meta_whatsapp_templates')
    .select('id, waba_id, metadata')
    .eq('name', name)
    .eq('language', language)
    .limit(50)

  if (error) throw error
  for (const row of rows || []) {
    const url = templateHeaderMediaUrlFromMetadata((row as any).metadata)
    if (url) return url
  }

  return ''
}

async function stableTemplateHeaderMediaUrl(
  supabase: SupabaseAdmin,
  cache: Map<string, string>,
  templateName: string,
  templateLanguage: string,
  wabaId: string
) {
  const key = `${cleanText(wabaId, 120)}::${cleanText(templateName, 120)}::${normalizeLanguage(templateLanguage)}`
  if (cache.has(key)) return cache.get(key) || ''

  const url = await queryStableTemplateHeaderMediaUrl(supabase, templateName, templateLanguage, wabaId)
  cache.set(key, url)
  return url
}

async function approvedTemplateWabaIdsForCampaign(
  supabase: SupabaseAdmin,
  campaign: any,
  candidateWabaIds: string[] = []
) {
  const templateName = cleanText(campaign?.template_name, 120)
  if (!templateName) return []

  const templateLanguage = normalizeLanguage(cleanText(campaign?.template_language, 12) || 'pt_BR')
  const candidates = uniqueCleanText(candidateWabaIds)
  let query = supabase
    .from('meta_whatsapp_templates')
    .select('waba_id, status')
    .eq('name', templateName)
    .eq('language', templateLanguage)
    .limit(100)

  if (candidates.length) query = query.in('waba_id', candidates)

  const { data, error } = await query
  if (error) throw error

  return uniqueCleanText((data || [])
    .filter((row: any) => cleanText(row.status, 40).toUpperCase() === 'APPROVED')
    .map((row: any) => row.waba_id))
}

async function prepareTemplateComponentsForSend(
  supabase: SupabaseAdmin,
  cache: Map<string, string>,
  campaign: any,
  wabaId: string,
  components: unknown[] | undefined
) {
  if (!templateComponentsContainMetaHostedMedia(components)) {
    return { components, repaired: false }
  }

  const replacementUrl = await stableTemplateHeaderMediaUrl(
    supabase,
    cache,
    campaign.template_name,
    campaign.template_language,
    wabaId
  )
  return replaceMetaHostedTemplateMediaLinks(components, replacementUrl)
}

async function selectSenderForRecipient(
  supabase: SupabaseAdmin,
  campaign: any,
  recipient: any,
  wabaId: string,
  portfolioWabaIds: string[] = [],
  options: {
    approvedTemplateWabaIds?: string[]
    excludedSenderIds?: string[]
  } = {}
) {
  const excludedSenderIds = new Set((options.excludedSenderIds || [])
    .map(value => cleanText(value, 80))
    .filter(Boolean))
  const metadata = asMetadata(campaign?.metadata)
  const storedRoutingWabaIds = uniqueCleanText(arrayFromMetadata(metadata.routing_waba_ids))
  const approvedTemplateWabaIds = uniqueCleanText(options.approvedTemplateWabaIds || [])
  const allowedWabaIds = uniqueCleanText([
    ...campaignRoutingWabaIds(campaign, wabaId),
    ...storedRoutingWabaIds,
    ...approvedTemplateWabaIds,
  ])
  const usageWabaIds = uniqueCleanText([
    ...portfolioWabaIds,
    ...allowedWabaIds,
  ])
  let sendersQuery = supabase
    .from('meta_whatsapp_senders')
    .select('*')
    .eq('local_status', 'active')

  if (usageWabaIds.length > 1) {
    sendersQuery = sendersQuery.in('waba_id', usageWabaIds)
  } else {
    sendersQuery = sendersQuery.eq('waba_id', usageWabaIds[0] || wabaId)
  }

  const { data: portfolioSenders, error: portfolioSendersError } = await sendersQuery

  if (portfolioSendersError) throw portfolioSendersError
  const preparedPortfolioSenders = await syncSenderDailyUsageFromCampaignRecipients(supabase, portfolioSenders || [])
  const preparedAllowedSenders = preparedPortfolioSenders
    .filter((sender: any) => allowedWabaIds.includes(cleanText(sender.waba_id, 120)))
    .filter((sender: any) => !excludedSenderIds.has(cleanText(sender.id, 80)))
  const usage = portfolioDailyUsage(preparedPortfolioSenders)
  if (usage.remaining <= 0) {
    throw new Error(`${describePortfolioAvailability(preparedPortfolioSenders)} Nenhuma nova conversa iniciada pelo negocio pode ser aberta agora.`)
  }

  if (recipient.sender_id) {
    const sender = preparedAllowedSenders.find((item: any) => item.id === recipient.sender_id)
    if (sender && isMetaSenderReady(sender)) return sender
  }

  if (campaign.default_sender_id) {
    const sender = preparedAllowedSenders.find((item: any) => item.id === campaign.default_sender_id)
    if (sender && isMetaSenderReady(sender)) return sender
  }

  const preferredUseCase = campaign.campaign_type === 'editorial'
    ? ['editorial', 'global']
    : campaign.campaign_type === 'followup'
      ? ['followup', 'campaign', 'global']
      : ['campaign', 'global']

  const poolSender = preparedAllowedSenders
    .filter((sender: any) => preferredUseCase.includes(cleanText(sender.use_case, 40)))
    .sort((a: any, b: any) => {
      const sentDiff = senderDailySentCount(a) - senderDailySentCount(b)
      if (sentDiff !== 0) return sentDiff
      return asNumber(b.weight) - asNumber(a.weight)
    })
    .find(isMetaSenderReady) || null

  if (poolSender) return poolSender

  if (campaign.default_sender_id) {
    const sender = preparedPortfolioSenders.find((item: any) => item.id === campaign.default_sender_id)
    throw new Error(`Numero oficial selecionado indisponivel para envio: ${describeSenderAvailability(sender)} Nenhuma outra conta aprovada para este template ficou disponivel.`)
  }

  return null
}

async function markRecipientFailed(supabase: SupabaseAdmin, recipientId: string, error: unknown) {
  const summary = metaSendErrorSummary(error)
  await supabase
    .from('meta_whatsapp_campaign_recipients')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      error_code: summary.code || null,
      error_message: summary.message.slice(0, 500),
    })
    .eq('id', recipientId)
}

async function markSenderAfterMetaSendFailure(supabase: SupabaseAdmin, sender: any, error: unknown) {
  const senderId = cleanText(sender?.id, 80)
  if (!senderId) return

  const kind = classifyMetaSendFailure(error)
  if (kind !== 'sender_unavailable' && kind !== 'sender_capacity') return

  const now = new Date().toISOString()
  const summary = metaSendErrorSummary(error)
  const metadata = asMetadata(sender?.metadata)
  const updatePayload: Record<string, unknown> = {
    last_health_check_at: now,
    last_error: [summary.code, summary.message].filter(Boolean).join(' | ').slice(0, 500),
  }

  if (kind === 'sender_capacity') {
    updatePayload.daily_sent_count = Math.max(asNumber(sender?.daily_limit), senderDailySentCount(sender))
    updatePayload.daily_limit_resets_at = nextSaoPauloMidnightIso(new Date())
  } else {
    updatePayload.metadata = {
      ...metadata,
      restricted: true,
      can_send_new_messages: false,
      can_initiate_conversations: false,
      restriction: {
        ...asMetadata(metadata.restriction),
        active: true,
        source: 'meta_send_failover',
        error_code: summary.code || null,
        error_subcode: summary.subcode || null,
        error_message: summary.message || null,
        detected_at: now,
      },
    }
  }

  await supabase
    .from('meta_whatsapp_senders')
    .update(updatePayload)
    .eq('id', senderId)
}

async function incrementSenderUsage(supabase: SupabaseAdmin, sender: any) {
  const now = new Date()
  const sentCount = senderDailySentCount(sender) + 1
  await supabase
    .from('meta_whatsapp_senders')
    .update({
      daily_sent_count: sentCount,
      daily_limit_resets_at: nextSaoPauloMidnightIso(now),
      last_health_check_at: now.toISOString(),
      last_error: null,
    })
    .eq('id', sender.id)
}

async function decrementSenderUsage(supabase: SupabaseAdmin, senderId: string) {
  const selectedSenderId = cleanText(senderId, 80)
  if (!selectedSenderId) return

  const { data: sender, error } = await supabase
    .from('meta_whatsapp_senders')
    .select('id, daily_sent_count, daily_limit_resets_at')
    .eq('id', selectedSenderId)
    .maybeSingle()

  if (error) throw error
  if (!sender) return

  const now = new Date()
  const sentCount = Math.max(senderDailySentCount(sender) - 1, 0)
  await supabase
    .from('meta_whatsapp_senders')
    .update({
      daily_sent_count: sentCount,
      daily_limit_resets_at: nextSaoPauloMidnightIso(now),
      last_health_check_at: now.toISOString(),
    })
    .eq('id', sender.id)
}

export async function releaseMetaWhatsAppSenderUsageReservation(params: {
  senderId?: string | null
  previousStatus?: string | null
  nextStatus?: string | null
}, supabase = createAdminClient()) {
  const senderId = cleanText(params.senderId, 80)
  const previousStatus = cleanText(params.previousStatus, 40).toLowerCase()
  const nextStatus = cleanText(params.nextStatus, 40).toLowerCase()

  if (!senderId) return { released: false, reason: 'missing_sender' }
  if (nextStatus !== 'failed') return { released: false, reason: 'not_failed' }
  if (previousStatus !== 'sent') return { released: false, reason: `previous_${previousStatus || 'unknown'}` }

  await decrementSenderUsage(supabase, senderId)
  return { released: true }
}

async function findContactGroupReplySignal(
  supabase: SupabaseAdmin,
  campaignId: string,
  recipient: any
): Promise<ContactGroupReplySignal | null> {
  if (!shouldStopContactGroupOnReply(recipient)) return null

  const groupKey = recipientContactGroupKey(recipient)
  if (!groupKey) return null

  const { data: groupRecipients, error: recipientsError } = await supabase
    .from('meta_whatsapp_campaign_recipients')
    .select('id, recipient_phone, recipient_name, metadata')
    .eq('campaign_id', campaignId)
    .neq('id', recipient.id)
    .contains('metadata', { contact_group_key: groupKey })
    .limit(200)

  if (recipientsError) throw recipientsError
  const siblingIds = (groupRecipients || []).map((row: any) => String(row.id || '')).filter(Boolean)
  if (!siblingIds.length) return null

  const { data: replyIntents, error: replyError } = await supabase
    .from('meta_whatsapp_reply_intents')
    .select('id, recipient_id, intent, contact_phone, contact_name, created_at')
    .in('recipient_id', siblingIds)
    .order('created_at', { ascending: false })
    .limit(1)

  if (replyError) throw replyError
  const reply = replyIntents?.[0]
  if (!reply?.id) return null

  return {
    replyIntentId: reply.id || null,
    responderRecipientId: reply.recipient_id || null,
    responderPhone: reply.contact_phone || null,
    responderName: reply.contact_name || null,
    intent: reply.intent || null,
    reactedAt: reply.created_at || null,
  }
}

async function markRecipientSkippedByContactGroup(
  supabase: SupabaseAdmin,
  recipient: any,
  signal: ContactGroupReplySignal
) {
  await supabase
    .from('meta_whatsapp_campaign_recipients')
    .update({
      status: 'skipped',
      metadata: {
        ...(recipient.metadata || {}),
        group_suppression: {
          reason: 'contact_group_already_replied',
          reply_intent_id: signal.replyIntentId,
          responder_recipient_id: signal.responderRecipientId,
          responder_phone: signal.responderPhone,
          responder_name: signal.responderName,
          intent: signal.intent,
          reacted_at: signal.reactedAt,
          skipped_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', recipient.id)
}

async function updateCampaignTotals(supabase: SupabaseAdmin, campaignId: string) {
  const statuses = ['queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped', 'opted_out']
  const counts = new Map<string, number>()

  await Promise.all(statuses.map(async status => {
    const { count } = await supabase
      .from('meta_whatsapp_campaign_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', status)
    counts.set(status, count || 0)
  }))

  const queued = (counts.get('queued') || 0) + (counts.get('sending') || 0)
  const sent = (counts.get('sent') || 0) + (counts.get('delivered') || 0) + (counts.get('read') || 0)
  const delivered = (counts.get('delivered') || 0) + (counts.get('read') || 0)
  const read = counts.get('read') || 0
  const failed = counts.get('failed') || 0
  const skipped = (counts.get('skipped') || 0) + (counts.get('opted_out') || 0)
  const now = new Date().toISOString()

  await supabase
    .from('meta_whatsapp_campaigns')
    .update({
      total_queued: queued,
      total_sent: sent,
      total_delivered: delivered,
      total_read: read,
      total_failed: failed,
      total_skipped: skipped,
      status: queued > 0 ? 'sending' : 'completed',
      completed_at: queued > 0 ? null : now,
    })
    .eq('id', campaignId)

  return { queued, sent, delivered, read, failed, skipped }
}

export async function refreshMetaWhatsAppCampaignTotals(campaignId: string, supabase = createAdminClient()) {
  const selected = cleanText(campaignId, 80)
  if (!selected) throw new Error('campaignId obrigatorio.')
  return updateCampaignTotals(supabase, selected)
}

export async function processMetaWhatsAppCampaignBatch(params: {
  campaignId: string
  batchSize?: number
}) {
  const supabase = createAdminClient()
  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  const resolved = resolveMetaWhatsAppConfig(configMap)
  if (!resolved.enabled) throw new Error('Meta WhatsApp Oficial esta inativo na Sala de Manutencao.')
  const readyAccounts = resolveMetaWhatsAppAccountConfigs(configMap)
    .filter(account => account.enabled && !account.missing.length)
  const portfolioWabaIds = uniqueCleanText(readyAccounts.map(account => account.wabaId))

  const { data: campaign, error: campaignError } = await supabase
    .from('meta_whatsapp_campaigns')
    .select('*')
    .eq('id', params.campaignId)
    .maybeSingle()

  if (campaignError) throw campaignError
  if (!campaign) return { skipped: true, reason: 'campaign_not_found', processed: 0, hasMore: false }
  if (['paused', 'cancelled', 'completed', 'failed'].includes(String(campaign.status))) {
    return { skipped: true, reason: `campaign_${campaign.status}`, processed: 0, hasMore: false }
  }

  const now = new Date()
  if (campaign.scheduled_for && new Date(campaign.scheduled_for).getTime() > now.getTime()) {
    return { skipped: true, reason: 'campaign_not_due', processed: 0, hasMore: true }
  }

  const targetWabaId = campaignWabaId(campaign, readyAccounts[0]?.wabaId || resolved.wabaId)
  const routingWabaIds = campaignRoutingWabaIds(campaign, targetWabaId)
  const approvedTemplateWabaIds = await approvedTemplateWabaIdsForCampaign(supabase, campaign, portfolioWabaIds)
  for (const routingWabaId of routingWabaIds) {
    const targetConfig = resolveMetaWhatsAppConfigForWaba(configMap, routingWabaId)
    if (targetConfig.missing.length) throw new Error(`Meta WhatsApp incompleto para a WABA ${routingWabaId || 'selecionada'}: ${targetConfig.missing.join(', ')}.`)
  }
  const batchSize = Math.min(100, Math.max(1, Number(params.batchSize || DEFAULT_META_WHATSAPP_BATCH_SIZE)))
  await supabase
    .from('meta_whatsapp_campaigns')
    .update({
      status: 'sending',
      started_at: campaign.started_at || now.toISOString(),
    })
    .eq('id', campaign.id)

  const { data: recipients, error: recipientsError } = await supabase
    .from('meta_whatsapp_campaign_recipients')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('status', 'queued')
    .order('scheduled_for', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (recipientsError) throw recipientsError
  if (!recipients?.length) {
    const totals = await updateCampaignTotals(supabase, campaign.id)
    return { skipped: false, reason: 'empty_batch', processed: 0, hasMore: totals.queued > 0, totals }
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  let deferred = 0
  const attemptedGroupKeys = new Set<string>()
  const templateHeaderMediaUrlCache = new Map<string, string>()

  for (const recipient of recipients) {
    try {
      const phone = normalizeMetaWhatsAppPhone(recipient.recipient_phone)
      const groupKey = recipientContactGroupKey(recipient)
      const groupStopsOnReply = shouldStopContactGroupOnReply(recipient)
      const contactGroupSignal = await findContactGroupReplySignal(supabase, campaign.id, recipient)
      if (contactGroupSignal) {
        await markRecipientSkippedByContactGroup(supabase, recipient, contactGroupSignal)
        skipped += 1
        continue
      }

      if (groupStopsOnReply && groupKey && attemptedGroupKeys.has(groupKey)) {
        deferred += 1
        continue
      }

      const { data: optOut } = await supabase
        .from('meta_whatsapp_opt_outs')
        .select('id')
        .eq('phone_e164', phone)
        .maybeSingle()

      if (optOut?.id) {
        await supabase
          .from('meta_whatsapp_campaign_recipients')
          .update({ status: 'opted_out' })
          .eq('id', recipient.id)
        skipped += 1
        continue
      }

      if (groupStopsOnReply && groupKey) attemptedGroupKeys.add(groupKey)

      const recipientMetadata = asMetadata(recipient.metadata)
      const excludedSenderIds = new Set<string>()
      let lastSendError: unknown = null
      let deliveredByFailover = false

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const sender = await selectSenderForRecipient(
          supabase,
          campaign,
          recipient,
          targetWabaId,
          portfolioWabaIds,
          {
            approvedTemplateWabaIds,
            excludedSenderIds: Array.from(excludedSenderIds),
          }
        )
        if (!sender?.phone_number_id) {
          throw lastSendError || new Error('Nenhum numero Meta conectado disponivel para envio. Sincronize os numeros oficiais e confirme que o status Meta do Phone Number esta CONNECTED.')
        }

        const senderWabaId = sender.waba_id || targetWabaId
        const preparedComponents = await prepareTemplateComponentsForSend(
          supabase,
          templateHeaderMediaUrlCache,
          campaign,
          senderWabaId,
          bodyParametersFromTemplateParameters(recipient.template_parameters)
        )
        const mediaRepairMetadata = preparedComponents.repaired
          ? {
            repaired_meta_template_media_link_at: new Date().toISOString(),
            repaired_meta_template_media_link_reason: 'meta_hosted_header_media_forbidden',
          }
          : {}
        const sendingUpdate: Record<string, unknown> = {
          status: 'sending',
          sender_id: sender.id,
          ...(preparedComponents.repaired && preparedComponents.components?.length ? {
            template_parameters: templateParametersWithComponents(recipient.template_parameters, preparedComponents.components),
            metadata: {
              ...recipientMetadata,
              ...mediaRepairMetadata,
            },
          } : {}),
        }

        await supabase
          .from('meta_whatsapp_campaign_recipients')
          .update(sendingUpdate)
          .eq('id', recipient.id)

        try {
          const result = await sendMetaWhatsAppTemplateMessage({
            to: phone,
            templateName: campaign.template_name,
            language: campaign.template_language,
            phoneNumberId: sender.phone_number_id,
            wabaId: senderWabaId,
            components: preparedComponents.components,
            config: configMap,
          })

          await supabase
            .from('meta_whatsapp_campaign_recipients')
            .update({
              status: 'sent',
              sender_id: sender.id,
              provider_message_id: result.providerMessageId || null,
              sent_at: new Date().toISOString(),
              metadata: {
                ...recipientMetadata,
                ...mediaRepairMetadata,
                ...(excludedSenderIds.size ? {
                  failover: {
                    applied: true,
                    skipped_sender_ids: Array.from(excludedSenderIds),
                    routed_sender_id: sender.id,
                    routed_waba_id: senderWabaId,
                    at: new Date().toISOString(),
                  },
                } : {}),
                meta_send_response: result.raw,
              },
            })
            .eq('id', recipient.id)

          await incrementSenderUsage(supabase, sender)
          deliveredByFailover = true
          break
        } catch (sendError) {
          lastSendError = sendError
          if (!canFailoverMetaSendError(sendError)) throw sendError

          await markSenderAfterMetaSendFailure(supabase, sender, sendError)
          excludedSenderIds.add(cleanText(sender.id, 80))
        }
      }

      if (!deliveredByFailover) {
        throw lastSendError || new Error('Nenhuma conta saudavel conseguiu enviar este destinatario.')
      }
      sent += 1
    } catch (error) {
      await markRecipientFailed(supabase, recipient.id, error)
      failed += 1
    }
  }

  const totals = await updateCampaignTotals(supabase, campaign.id)

  return {
    skipped: false,
    processed: recipients.length,
    sent,
    failed,
    optedOut: skipped,
    deferred,
    hasMore: totals.queued > 0,
    totals,
  }
}
