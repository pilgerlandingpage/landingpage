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

export interface GetMetaWhatsAppCampaignDetailInput {
  campaignId: string
  limit?: number
}

function cleanText(value: unknown, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength)
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

  return {
    campaigns: campaigns || [],
    senders: senders || [],
    templates: templates || [],
    summary,
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
      .select('id, recipient_phone, recipient_name, status, provider_message_id, sender_id, error_code, error_message, sent_at, delivered_at, read_at, failed_at, created_at')
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
    if (data) return data
  }

  if (campaign.default_sender_id) {
    const { data } = await supabase
      .from('meta_whatsapp_senders')
      .select('*')
      .eq('id', campaign.default_sender_id)
      .eq('local_status', 'active')
      .maybeSingle()
    if (data && Number(data.daily_sent_count || 0) < Number(data.daily_limit || 0)) return data
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

  return (data || []).find((sender: any) => Number(sender.daily_sent_count || 0) < Number(sender.daily_limit || 0))
    || null
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
      if (!sender?.phone_number_id) throw new Error('Nenhum numero Meta ativo disponivel para envio.')

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
