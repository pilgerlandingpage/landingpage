import { createHash } from 'crypto'
import { sendWhatsAppMessage } from '@/lib/connectyhub/whatsapp'
import { sendBrevoEmail } from '@/lib/email/brevo'
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
  return text(data.messageId || data.message_id || data.id || data.uuid || data?.data?.id)
}

function stableMessageDispatchId(orderId: string, templateId: string, channel: string) {
  const hash = createHash('sha256')
    .update(`${orderId}:${templateId}:${channel}`)
    .digest('hex')
  const variant = ((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, '0')

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `${variant}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join('-')
}

function isDuplicateKeyError(error: any) {
  return error?.code === '23505'
}

function isAlreadyHandledStatus(value: unknown) {
  return ['queued', 'sending', 'sent', 'delivered', 'read', 'skipped'].includes(String(value || ''))
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
  const dispatchId = orderId ? stableMessageDispatchId(orderId, text(template.id), channel) : ''
  let retryDispatch: Record<string, any> | null = null
  if (orderId) {
    const { data: existing, error: existingError } = await supabase
      .from('message_dispatches')
      .select('*')
      .eq('order_id', orderId)
      .eq('template_id', template.id)
      .eq('channel', channel)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing && isAlreadyHandledStatus(existing.status)) {
      return { skipped: true, reason: 'already_dispatched', dispatch: existing }
    }
    if (existing) retryDispatch = existing
  }

  const config = await loadCommerceConfig()
  const metadata = objectRecord(template.metadata)
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
    provider: channel === 'whatsapp' ? 'connectyhub' : 'brevo',
    scheduled_for: new Date().toISOString(),
    payload: {
      subject,
      body,
      variables,
      provider: metadata.provider || (channel === 'whatsapp' ? 'connectyhub' : 'brevo'),
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
        ...(dispatchId ? { id: dispatchId } : {}),
        ...baseDispatch,
        status: 'skipped',
        error_message: reason,
      }])
      .select()
      .single()
    if (isDuplicateKeyError(error) && dispatchId) {
      const { data: existing, error: existingError } = await supabase
        .from('message_dispatches')
        .select('*')
        .eq('id', dispatchId)
        .maybeSingle()
      if (existingError) throw existingError
      if (existing) return { skipped: true, reason: 'already_dispatched', dispatch: existing }
    }
    if (error) throw error
    return { skipped: true, reason, dispatch: data }
  }

  const dispatchPayload = {
    ...(dispatchId ? { id: dispatchId } : {}),
    ...baseDispatch,
    status: sendNow ? 'sending' : 'queued',
    error_message: null,
  }

  const dispatchResult = retryDispatch
    ? await supabase
        .from('message_dispatches')
        .update({
          ...dispatchPayload,
          id: retryDispatch.id,
          provider_message_id: null,
          sent_at: null,
        })
        .eq('id', retryDispatch.id)
        .select()
        .single()
    : await supabase
        .from('message_dispatches')
        .insert([dispatchPayload])
        .select()
        .single()

  let dispatch = dispatchResult.data
  let dispatchError = dispatchResult.error

  if (isDuplicateKeyError(dispatchError) && dispatchId) {
    const { data: existing, error: existingError } = await supabase
      .from('message_dispatches')
      .select('*')
      .eq('id', dispatchId)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing && isAlreadyHandledStatus(existing.status)) {
      return { skipped: true, reason: 'already_dispatched', dispatch: existing }
    }
    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from('message_dispatches')
        .update({
          ...dispatchPayload,
          id: existing.id,
          provider_message_id: null,
          sent_at: null,
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (updateError) throw updateError
      dispatch = updated
      dispatchError = null
    }
  }

  if (dispatchError) throw dispatchError
  if (!sendNow) return { queued: true, dispatch }

  try {
    const providerResponse = channel === 'whatsapp'
      ? await sendWhatsAppMessage({ phone: recipient, message: body })
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
