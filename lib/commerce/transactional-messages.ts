import { sendWhatsAppMessage } from '@/lib/connectyhub/whatsapp'
import { sendBrevoEmail } from '@/lib/email/brevo'
import {
  loadMetaWhatsAppConfigMap,
  resolveMetaWhatsAppConfig,
  sendMetaWhatsAppTemplateMessage,
} from '@/lib/meta/whatsapp-cloud'
import { centsToMoney, loadCommerceConfig, normalizeBrazilPhone } from './checkout'

type SupabaseAdminLike = {
  from: (table: string) => any
}

type CommerceMessageParams = {
  supabase: SupabaseAdminLike
  templateKey: string
  channel: 'whatsapp' | 'email'
  customer: Record<string, any>
  order?: Record<string, any> | null
  payment?: Record<string, any> | null
  educationLeadId?: string | null
  variables: Record<string, string | number | null | undefined>
  sendNow?: boolean
  dedupe?: boolean
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

function renderTemplate(template: string, variables: Record<string, string | number | null | undefined>) {
  return String(template || '').replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g, (match, key) => {
    const value = variables[key]
    return value === null || value === undefined ? match : String(value)
  })
}

function htmlFromText(body: string) {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2933">
      ${escaped.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`).join('')}
    </div>
  `
}

function providerMessageId(response: unknown) {
  const data = objectRecord(response)
  return text(data.providerMessageId || data.messageId || data.message_id || data.id || data.uuid || data?.data?.id)
}

function formatDateTimePtBr(value: unknown) {
  const date = value ? new Date(String(value)) : null
  if (!date || Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}

function renderValue(value: unknown, variables: Record<string, string | number | null | undefined>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g, (match, key) => {
      const selected = variables[key]
      return selected === null || selected === undefined ? match : String(selected)
    })
  }

  if (Array.isArray(value)) return value.map(item => renderValue(item, variables))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, renderValue(item, variables)])
    )
  }

  return value
}

function metaTemplateComponents(metadata: Record<string, any>, variables: Record<string, string | number | null | undefined>) {
  const meta = objectRecord(metadata.meta_whatsapp || metadata.metaWhatsApp)

  if (Array.isArray(meta.components)) {
    return renderValue(meta.components, variables) as unknown[]
  }

  const bodyVariables = Array.isArray(meta.body_variables)
    ? meta.body_variables
    : Array.isArray(meta.bodyVariables)
      ? meta.bodyVariables
      : []

  if (!bodyVariables.length) return undefined

  return [{
    type: 'body',
    parameters: bodyVariables.map((key: unknown) => ({
      type: 'text',
      text: String(variables[String(key)] ?? ''),
    })),
  }]
}

async function assertDefaultMetaSenderReady(supabase: SupabaseAdminLike, phoneNumberId: string) {
  const { data, error } = await supabase
    .from('meta_whatsapp_senders')
    .select('display_name, phone_number, meta_status, local_status')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle()

  if (error) throw error

  const metaStatus = text(data?.meta_status).toUpperCase()
  if (!data || data.local_status !== 'active' || metaStatus !== 'CONNECTED') {
    const label = data?.display_name || data?.phone_number || phoneNumberId || 'numero Meta'
    throw new Error(`Numero Meta ${label} nao esta CONNECTED para envio oficial. Status atual: ${data?.meta_status || 'nao sincronizado'}.`)
  }
}

async function sendOfficialWhatsAppTemplate(params: {
  supabase: SupabaseAdminLike
  template: Record<string, any>
  recipient: string
  variables: Record<string, string | number | null | undefined>
}) {
  const metadata = objectRecord(params.template.metadata)
  const meta = objectRecord(metadata.meta_whatsapp || metadata.metaWhatsApp)
  const templateName = text(
    meta.template_name ||
    meta.templateName ||
    metadata.meta_whatsapp_template_name ||
    metadata.metaTemplateName
  )

  if (!templateName) {
    throw new Error(`Template Meta oficial nao configurado para ${text(params.template.template_key, 'template interno')}.`)
  }

  const configMap = await loadMetaWhatsAppConfigMap(params.supabase as any)
  const resolved = resolveMetaWhatsAppConfig(configMap)
  if (!resolved.enabled) throw new Error('Meta WhatsApp Oficial esta inativo.')
  if (resolved.missing.length) throw new Error(`Meta WhatsApp Oficial incompleto: ${resolved.missing.join(', ')}.`)
  if (!resolved.defaultPhoneNumberId) throw new Error('Phone Number ID padrao da Meta ausente.')

  const language = text(meta.language || meta.template_language || meta.templateLanguage || metadata.meta_whatsapp_template_language, resolved.defaultLanguage)
  const { data: officialTemplate, error: officialTemplateError } = await params.supabase
    .from('meta_whatsapp_templates')
    .select('status')
    .eq('waba_id', resolved.wabaId)
    .eq('name', templateName)
    .eq('language', language)
    .maybeSingle()

  if (officialTemplateError) throw officialTemplateError
  if (String(officialTemplate?.status || '').toUpperCase() !== 'APPROVED') {
    throw new Error(`Template Meta ${templateName}/${language} nao esta aprovado ou sincronizado.`)
  }

  await assertDefaultMetaSenderReady(params.supabase, resolved.defaultPhoneNumberId)

  return sendMetaWhatsAppTemplateMessage({
    to: params.recipient,
    templateName,
    language,
    phoneNumberId: resolved.defaultPhoneNumberId,
    components: metaTemplateComponents(metadata, params.variables),
    config: configMap,
  })
}

export async function dispatchCommerceMessage(params: CommerceMessageParams) {
  const {
    supabase,
    templateKey,
    channel,
    customer,
    order,
    payment,
    educationLeadId,
    variables,
    sendNow = true,
    dedupe = true,
  } = params

  const { data: template, error: templateError } = await supabase
    .from('message_templates')
    .select('*')
    .eq('business_unit', 'education')
    .eq('channel', channel)
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .maybeSingle()

  if (templateError) throw templateError
  if (!template) return { skipped: true, reason: 'template_not_found' }

  const orderId = text(order?.id)
  if (dedupe && orderId) {
    const { data: existing, error: existingError } = await supabase
      .from('message_dispatches')
      .select('id, status')
      .eq('order_id', orderId)
      .eq('template_id', template.id)
      .eq('channel', channel)
      .in('status', ['queued', 'sending', 'sent', 'delivered', 'read', 'skipped'])
      .limit(1)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) return { skipped: true, reason: 'already_dispatched', dispatch: existing }
  }

  const config = await loadCommerceConfig()
  const metadata = objectRecord(template.metadata)
  const whatsappProvider = config.whatsappOutboundProvider === 'meta_whatsapp' ? 'meta_whatsapp' : 'connectyhub'
  const body = renderTemplate(template.body, variables)
  const subject = renderTemplate(text(template.subject, 'Atualização da sua compra'), variables)
  const recipient = channel === 'whatsapp'
    ? normalizeBrazilPhone(customer.phone_e164 || customer.phone)
    : text(customer.email).toLowerCase()

  const notificationsEnabled = channel === 'whatsapp'
    ? config.whatsappNotificationsEnabled
    : config.emailNotificationsEnabled
  const hasOptIn = channel === 'whatsapp'
    ? customer.whatsapp_opt_in === true || template.requires_opt_in === false
    : customer.email_opt_in !== false || template.requires_opt_in === false

  const baseDispatch = {
    template_id: template.id,
    business_unit: 'education',
    channel,
    sender_agent: text(metadata.sender_agent, channel === 'whatsapp' ? 'whatsapp-global-agent' : 'brevo-email'),
    customer_id: text(customer.id) || null,
    education_lead_id: educationLeadId || order?.education_lead_id || null,
    order_id: orderId || null,
    payment_id: payment?.id || null,
    recipient: recipient || 'missing-recipient',
    provider: channel === 'whatsapp' ? whatsappProvider : 'brevo',
    scheduled_for: new Date().toISOString(),
    payload: {
      subject,
      body,
      variables,
      provider: metadata.provider || (channel === 'whatsapp' ? whatsappProvider : 'brevo'),
    },
    metadata: {
      template_key: templateKey,
      event_type: template.event_type,
      order_number: order?.order_number || null,
    },
  }

  if (!recipient || !notificationsEnabled || !hasOptIn) {
    const reason = !recipient
      ? 'missing_recipient'
      : !notificationsEnabled
        ? 'channel_disabled'
        : 'opt_in_missing'
    const { data, error } = await supabase
      .from('message_dispatches')
      .insert([{
        ...baseDispatch,
        status: 'skipped',
        error_message: reason,
      }])
      .select()
      .single()
    if (error) throw error
    return { skipped: true, reason, dispatch: data }
  }

  const { data: dispatch, error: dispatchError } = await supabase
    .from('message_dispatches')
    .insert([{ ...baseDispatch, status: sendNow ? 'sending' : 'queued' }])
    .select()
    .single()

  if (dispatchError) throw dispatchError
  if (!sendNow) return { queued: true, dispatch }

  try {
    const providerResponse = channel === 'whatsapp'
      ? whatsappProvider === 'meta_whatsapp'
        ? await sendOfficialWhatsAppTemplate({ supabase, template, recipient, variables })
        : await sendWhatsAppMessage({ phone: recipient, message: body })
      : await sendBrevoEmail({
          to: [{ email: recipient, name: text(customer.name) || undefined }],
          subject,
          htmlContent: htmlFromText(body),
          textContent: body,
        })

    const { data: updated, error: updateError } = await supabase
      .from('message_dispatches')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_message_id: providerMessageId(providerResponse) || null,
        payload: {
          ...baseDispatch.payload,
          provider_response: providerResponse,
        },
      })
      .eq('id', dispatch.id)
      .select()
      .single()

    if (updateError) throw updateError
    return { sent: true, dispatch: updated }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const { data: updated } = await supabase
      .from('message_dispatches')
      .update({
        status: 'failed',
        error_message: message.slice(0, 500),
      })
      .eq('id', dispatch.id)
      .select()
      .single()

    return { sent: false, error: message, dispatch: updated || dispatch }
  }
}

export function commerceMessageVariables(params: {
  customer: Record<string, any>
  productName: string
  order?: Record<string, any> | null
  payment?: Record<string, any> | null
  checkoutUrl?: string
  memberAreaUrl?: string
  accessLink?: string
}) {
  const { customer, productName, order, payment, checkoutUrl, memberAreaUrl, accessLink } = params
  return {
    nome: text(customer.name, 'Cliente'),
    produto: productName,
    numero_pedido: text(order?.order_number),
    valor: centsToMoney(Number(order?.total_cents || payment?.amount_cents || 0)),
    pix_copia_cola: text(payment?.pix_qr_code),
    pix_expira_em: formatDateTimePtBr(payment?.expires_at || order?.pix_expires_at),
    checkout_url: text(checkoutUrl),
    member_area_url: text(memberAreaUrl),
    access_link: text(accessLink),
  }
}
