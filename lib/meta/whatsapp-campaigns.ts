import { createAdminClient } from '@/lib/supabase/server'
import {
  loadMetaWhatsAppConfigMap,
  normalizeMetaWhatsAppPhone,
  resolveMetaWhatsAppConfig,
  sendMetaWhatsAppTemplateMessage,
} from '@/lib/meta/whatsapp-cloud'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

type CampaignType = 'marketing' | 'editorial' | 'followup' | 'utility' | 'test'

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
  templateParameters?: unknown
  audienceSource?: 'custom_paste' | 'lead_filter' | 'commerce_customers' | 'education_leads' | 'editorial_distribution'
  metadata?: Record<string, unknown>
}

export interface ListMetaWhatsAppCampaignsInput {
  status?: string | null
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

export interface GetMetaWhatsAppCampaignDetailInput {
  campaignId: string
  limit?: number
}

function cleanText(value: unknown, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength)
}

function isMetaSenderReady(sender: any) {
  const metaStatus = cleanText(sender?.meta_status, 40).toUpperCase()
  return sender?.local_status === 'active'
    && metaStatus === 'CONNECTED'
    && Number(sender.daily_sent_count || 0) < Number(sender.daily_limit || 0)
}

function asNumber(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
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

  return {
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
      const dailySent = asNumber(sender.daily_sent_count)
      return {
        sender_id: sender.id,
        display_name: sender.display_name || sender.phone_number || 'Numero Meta',
        phone_number: sender.phone_number || '',
        meta_status: sender.meta_status || null,
        quality_rating: sender.quality_rating || null,
        daily_limit: dailyLimit,
        daily_sent_count: dailySent,
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
    const phone = normalizeMetaWhatsAppPhone(number)
    if (!phone) continue
    byPhone.set(phone, {
      phone,
      optInSource: input.optInSource || 'manual_admin_confirmed',
      templateParameters: input.templateParameters,
    })
  }

  for (const recipient of input.recipients || []) {
    const phone = normalizeMetaWhatsAppPhone(recipient.phone)
    if (!phone) continue
    byPhone.set(phone, {
      ...recipient,
      phone,
      optInSource: recipient.optInSource || input.optInSource || 'manual_admin_confirmed',
      templateParameters: recipient.templateParameters ?? input.templateParameters,
    })
  }

  return Array.from(byPhone.values())
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

export async function createMetaWhatsAppCampaign(input: CreateMetaWhatsAppCampaignInput, supabase = createAdminClient()) {
  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  const resolved = resolveMetaWhatsAppConfig(configMap)

  if (!resolved.enabled) {
    throw new Error('Meta WhatsApp Oficial esta inativo na Sala de Manutencao.')
  }
  if (resolved.missing.length) {
    throw new Error(`Configuracao Meta WhatsApp incompleta: ${resolved.missing.join(', ')}.`)
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

  const { data: template } = await supabase
    .from('meta_whatsapp_templates')
    .select('id, name, language, status')
    .eq('waba_id', resolved.wabaId)
    .eq('name', templateName)
    .eq('language', templateLanguage)
    .maybeSingle()

  if (template?.status && String(template.status).toUpperCase() !== 'APPROVED') {
    throw new Error(`Template ${templateName} existe na base, mas esta com status ${template.status}. Use apenas templates aprovados.`)
  }

  const { data: senders, error: sendersError } = await supabase
    .from('meta_whatsapp_senders')
    .select('id, display_name, phone_number, phone_number_id, local_status, meta_status, daily_limit, daily_sent_count, use_case')
    .eq('waba_id', resolved.wabaId)
    .eq('local_status', 'active')
    .limit(50)

  if (sendersError) throw sendersError
  const hasReadySender = (senders || []).some((sender: any) => {
    if (input.defaultSenderId && sender.id !== input.defaultSenderId) return false
    return isMetaSenderReady(sender)
  })

  if (!hasReadySender) {
    const knownStatus = (senders || [])
      .map((sender: any) => `${sender.display_name || sender.phone_number}: ${sender.meta_status || 'sem status'}`)
      .join(', ')
    throw new Error(`Nenhum numero Meta conectado para envio. O Phone Number precisa estar com status CONNECTED na Meta. Status atual: ${knownStatus || 'nenhum numero sincronizado'}.`)
  }

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
      sender_routing_mode: input.senderRoutingMode || 'weighted_pool',
      default_sender_id: input.defaultSenderId || null,
      audience_source: input.audienceSource || 'custom_paste',
      audience_query: {
        count: recipients.length,
        opt_in_source: input.optInSource || 'manual_admin_confirmed',
      },
      scheduled_for: scheduledFor,
      total_recipients: recipients.length,
      metadata: {
        ...(input.metadata || {}),
        template_status_at_creation: template?.status || 'not_synced',
        support_redirect_phone: resolved.supportRedirectPhone,
      },
    })
    .select('*')
    .single()

  if (campaignError) throw campaignError

  const optOutPhones = await fetchOptOutPhones(supabase, recipients.map(recipient => recipient.phone))
  const now = new Date().toISOString()
  const rows = recipients.map(recipient => {
    const optedOut = optOutPhones.has(recipient.phone)
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
      status: optedOut ? 'opted_out' : 'queued',
      scheduled_for: scheduledFor,
      template_parameters: recipient.templateParameters ?? {},
      metadata: recipient.metadata || {},
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
  }
}

function normalizeCampaignStatusFilter(value?: string | null) {
  const selected = cleanText(value, 40).toLowerCase()
  const allowed = new Set(['draft', 'scheduled', 'preparing', 'queued', 'sending', 'paused', 'completed', 'cancelled', 'failed'])
  return allowed.has(selected) ? selected : ''
}

export async function listMetaWhatsAppCampaigns(input: ListMetaWhatsAppCampaignsInput = {}, supabase = createAdminClient()) {
  const limit = Math.min(100, Math.max(1, Number(input.limit || 40)))
  const status = normalizeCampaignStatusFilter(input.status)

  let query = supabase
    .from('meta_whatsapp_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data: campaigns, error } = await query
  if (error) throw error

  const { data: senders, error: sendersError } = await supabase
    .from('meta_whatsapp_senders')
    .select('id, display_name, phone_number, phone_number_id, local_status, meta_status, quality_rating, messaging_limit_tier, daily_limit, daily_sent_count, use_case, weight')
    .order('local_status', { ascending: true })
    .order('display_name', { ascending: true })

  if (sendersError) throw sendersError

  const { data: templates, error: templatesError } = await supabase
    .from('meta_whatsapp_templates')
    .select('id, name, language, category, status, quality_score, components, last_synced_at')
    .order('status', { ascending: true })
    .order('name', { ascending: true })
    .limit(200)

  if (templatesError) throw templatesError

  const summary = (campaigns || []).reduce((acc: any, campaign: any) => {
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

  const campaignIds = (campaigns || []).map((campaign: any) => String(campaign.id)).filter(Boolean)
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
    campaigns || [],
    senders || [],
    analyticsRecipients,
    analyticsEvents
  )

  return {
    campaigns: campaigns || [],
    senders: senders || [],
    templates: templates || [],
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
  action: 'pause' | 'resume' | 'cancel'
}, supabase = createAdminClient()) {
  const campaignId = cleanText(params.campaignId, 80)
  if (!campaignId) throw new Error('campaignId obrigatorio.')

  const { data: campaign, error } = await supabase
    .from('meta_whatsapp_campaigns')
    .select('id, status, scheduled_for, total_queued')
    .eq('id', campaignId)
    .maybeSingle()

  if (error) throw error
  if (!campaign) throw new Error('Campanha Meta nao encontrada.')

  const currentStatus = String(campaign.status || '')
  if (['completed', 'cancelled', 'failed'].includes(currentStatus)) {
    throw new Error(`Campanha ja esta em estado final: ${currentStatus}.`)
  }

  const now = new Date().toISOString()
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

async function selectSenderForRecipient(supabase: SupabaseAdmin, campaign: any, recipient: any) {
  if (recipient.sender_id) {
    const { data } = await supabase
      .from('meta_whatsapp_senders')
      .select('*')
      .eq('id', recipient.sender_id)
      .maybeSingle()
    if (data && isMetaSenderReady(data)) return data
  }

  if (campaign.default_sender_id) {
    const { data } = await supabase
      .from('meta_whatsapp_senders')
      .select('*')
      .eq('id', campaign.default_sender_id)
      .eq('local_status', 'active')
      .maybeSingle()
    if (data && isMetaSenderReady(data)) return data
  }

  const preferredUseCase = campaign.campaign_type === 'editorial'
    ? ['editorial', 'global']
    : campaign.campaign_type === 'followup'
      ? ['followup', 'campaign', 'global']
      : ['campaign', 'global']

  const { data, error } = await supabase
    .from('meta_whatsapp_senders')
    .select('*')
    .eq('local_status', 'active')
    .in('use_case', preferredUseCase)
    .order('daily_sent_count', { ascending: true })
    .order('weight', { ascending: false })
    .limit(20)

  if (error) throw error

  return (data || []).find(isMetaSenderReady) || null
}

async function markRecipientFailed(supabase: SupabaseAdmin, recipientId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  await supabase
    .from('meta_whatsapp_campaign_recipients')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      error_message: message.slice(0, 500),
    })
    .eq('id', recipientId)
}

async function incrementSenderUsage(supabase: SupabaseAdmin, sender: any) {
  const sentCount = Number(sender.daily_sent_count || 0) + 1
  await supabase
    .from('meta_whatsapp_senders')
    .update({
      daily_sent_count: sentCount,
      last_health_check_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', sender.id)
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
  if (resolved.missing.length) throw new Error(`Meta WhatsApp incompleto: ${resolved.missing.join(', ')}.`)

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

  const batchSize = Math.min(100, Math.max(1, Number(params.batchSize || 25)))
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

  for (const recipient of recipients) {
    try {
      const phone = normalizeMetaWhatsAppPhone(recipient.recipient_phone)
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

      const sender = await selectSenderForRecipient(supabase, campaign, recipient)
      if (!sender?.phone_number_id) {
        throw new Error('Nenhum numero Meta conectado disponivel para envio. Sincronize os numeros oficiais e confirme que o status Meta do Phone Number esta CONNECTED.')
      }

      await supabase
        .from('meta_whatsapp_campaign_recipients')
        .update({ status: 'sending', sender_id: sender.id })
        .eq('id', recipient.id)

      const result = await sendMetaWhatsAppTemplateMessage({
        to: phone,
        templateName: campaign.template_name,
        language: campaign.template_language,
        phoneNumberId: sender.phone_number_id,
        components: bodyParametersFromTemplateParameters(recipient.template_parameters),
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
            ...(recipient.metadata || {}),
            meta_send_response: result.raw,
          },
        })
        .eq('id', recipient.id)

      await incrementSenderUsage(supabase, sender)
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
    hasMore: totals.queued > 0,
    totals,
  }
}
