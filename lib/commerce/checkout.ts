import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type CheckoutCustomerInput = {
  name: string
  email: string
  phone: string
  document?: string
  whatsappOptIn?: boolean
  emailOptIn?: boolean
}

export type CheckoutUtm = Record<string, string>

export type CommerceConfig = {
  mercadoPagoEnabled: boolean
  mercadoPagoEnvironment: 'sandbox' | 'production'
  mercadoPagoPublicKey: string
  mercadoPagoAccessToken: string
  mercadoPagoWebhookSecret: string
  mercadoPagoWebhookUrl: string
  mercadoPagoPixExpirationMinutes: number
  mercadoPagoStatementDescriptor: string
  memberAreaUrl: string
  supportWhatsapp: string
  automationEnabled: boolean
  checkoutAbandonedAfterMinutes: number
  pixPendingAfterMinutes: number
  pixExpiringBeforeMinutes: number
  checkoutLostAfterHours: number
  whatsappNotificationsEnabled: boolean
  emailNotificationsEnabled: boolean
}

export type CheckoutOfferRow = {
  id: string
  product_id: string
  landing_page_id: string | null
  slug: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  checkout_path: string | null
  metadata: Record<string, unknown>
}

export type CheckoutProductRow = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  cover_image_url: string | null
  thumbnail_url: string | null
  sales_content: Record<string, unknown>
}

export type CheckoutBumpRow = {
  id: string
  offer_id: string
  bump_product_id: string
  bump_offer_id: string | null
  title: string
  description: string | null
  price_cents: number
  position: number
  metadata: Record<string, unknown>
}

const COMMERCE_CONFIG_KEYS = [
  'mercado_pago_enabled',
  'mercado_pago_environment',
  'mercado_pago_public_key',
  'mercado_pago_access_token',
  'mercado_pago_webhook_secret',
  'mercado_pago_webhook_url',
  'mercado_pago_pix_expiration_minutes',
  'mercado_pago_statement_descriptor',
  'commerce_member_area_url',
  'commerce_support_whatsapp',
  'commerce_automation_enabled',
  'commerce_checkout_abandoned_after_minutes',
  'commerce_pix_pending_after_minutes',
  'commerce_pix_expiring_before_minutes',
  'commerce_checkout_lost_after_hours',
  'commerce_whatsapp_notifications_enabled',
  'commerce_email_notifications_enabled',
]

export function centsToMoney(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((Number.isFinite(cents) ? cents : 0) / 100)
}

export function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

export function normalizeDocument(value: unknown) {
  return String(value || '').replace(/\D/g, '').slice(0, 14)
}

export function normalizeBrazilPhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return digits.slice(0, 13)
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`
  return digits.slice(0, 15)
}

export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || fullName.trim(),
    lastName: parts.slice(1).join(' '),
  }
}

export function parsePositiveInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export async function loadCommerceConfig(): Promise<CommerceConfig> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', COMMERCE_CONFIG_KEYS)

  if (error) throw error

  const map = new Map<string, string>()
  for (const row of data || []) {
    map.set(String(row.key), String(row.value || ''))
  }

  const env = (key: string) => process.env[key] || ''
  const value = (key: string, envKey?: string, fallback = '') => {
    const saved = map.get(key)
    return saved && saved.trim() ? saved.trim() : (envKey ? env(envKey) : '') || fallback
  }

  return {
    mercadoPagoEnabled: value('mercado_pago_enabled', 'MERCADO_PAGO_ENABLED', 'false') === 'true',
    mercadoPagoEnvironment: value('mercado_pago_environment', 'MERCADO_PAGO_ENVIRONMENT', 'sandbox') === 'production'
      ? 'production'
      : 'sandbox',
    mercadoPagoPublicKey: value('mercado_pago_public_key', 'NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY'),
    mercadoPagoAccessToken: value('mercado_pago_access_token', 'MERCADO_PAGO_ACCESS_TOKEN'),
    mercadoPagoWebhookSecret: value('mercado_pago_webhook_secret', 'MERCADO_PAGO_WEBHOOK_SECRET'),
    mercadoPagoWebhookUrl: value('mercado_pago_webhook_url', 'MERCADO_PAGO_WEBHOOK_URL', 'https://guilhermepilger.ai/api/webhooks/mercadopago'),
    mercadoPagoPixExpirationMinutes: parsePositiveInt(value('mercado_pago_pix_expiration_minutes', 'MERCADO_PAGO_PIX_EXPIRATION_MINUTES', '60'), 60, 5, 1440),
    mercadoPagoStatementDescriptor: value('mercado_pago_statement_descriptor', 'MERCADO_PAGO_STATEMENT_DESCRIPTOR', 'PILGER'),
    memberAreaUrl: value('commerce_member_area_url', 'COMMERCE_MEMBER_AREA_URL', 'https://guilhermepilger.ai/membros'),
    supportWhatsapp: normalizeBrazilPhone(value('commerce_support_whatsapp', 'COMMERCE_SUPPORT_WHATSAPP')),
    automationEnabled: value('commerce_automation_enabled', 'COMMERCE_AUTOMATION_ENABLED', 'true') !== 'false',
    checkoutAbandonedAfterMinutes: parsePositiveInt(value('commerce_checkout_abandoned_after_minutes', 'COMMERCE_CHECKOUT_ABANDONED_AFTER_MINUTES', '30'), 30, 5, 10080),
    pixPendingAfterMinutes: parsePositiveInt(value('commerce_pix_pending_after_minutes', 'COMMERCE_PIX_PENDING_AFTER_MINUTES', '10'), 10, 3, 1440),
    pixExpiringBeforeMinutes: parsePositiveInt(value('commerce_pix_expiring_before_minutes', 'COMMERCE_PIX_EXPIRING_BEFORE_MINUTES', '15'), 15, 3, 1440),
    checkoutLostAfterHours: parsePositiveInt(value('commerce_checkout_lost_after_hours', 'COMMERCE_CHECKOUT_LOST_AFTER_HOURS', '24'), 24, 1, 720),
    whatsappNotificationsEnabled: value('commerce_whatsapp_notifications_enabled', 'COMMERCE_WHATSAPP_NOTIFICATIONS_ENABLED', 'true') !== 'false',
    emailNotificationsEnabled: value('commerce_email_notifications_enabled', 'COMMERCE_EMAIL_NOTIFICATIONS_ENABLED', 'true') !== 'false',
  }
}

export async function loadCheckoutOffer(slug: string) {
  const supabase = createSupabaseAdminClient()
  const checkoutPath = `/checkout/${slug}`

  const { data: offer, error: offerError } = await supabase
    .from('commerce_offers')
    .select('*')
    .eq('status', 'active')
    .eq('checkout_path', checkoutPath)
    .maybeSingle()

  if (offerError) throw offerError
  if (!offer) return null

  const [productRes, bumpsRes] = await Promise.all([
    supabase
      .from('commerce_products')
      .select('id, slug, title, subtitle, description, cover_image_url, thumbnail_url, sales_content')
      .eq('id', offer.product_id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('commerce_order_bumps')
      .select('*')
      .eq('offer_id', offer.id)
      .eq('is_active', true)
      .order('position')
      .order('created_at'),
  ])

  if (productRes.error) throw productRes.error
  if (bumpsRes.error) throw bumpsRes.error
  if (!productRes.data) return null

  return {
    offer: offer as CheckoutOfferRow,
    product: productRes.data as CheckoutProductRow,
    bumps: (bumpsRes.data || []) as CheckoutBumpRow[],
  }
}

export async function findOrCreateCommerceCustomer(input: CheckoutCustomerInput, source: string) {
  const supabase = createSupabaseAdminClient()
  const email = normalizeEmail(input.email)
  const phoneE164 = normalizeBrazilPhone(input.phone)
  const document = normalizeDocument(input.document)
  const documentType = document.length === 11 ? 'cpf' : document.length === 14 ? 'cnpj' : document ? 'other' : null

  if (!input.name.trim()) throw new Error('Informe seu nome.')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.')
  if (phoneE164.length < 12) throw new Error('Informe um WhatsApp válido com DDD.')

  const selectors = [
    email ? { key: 'email', value: email } : null,
    phoneE164 ? { key: 'phone_e164', value: phoneE164 } : null,
    document ? { key: 'document', value: document } : null,
  ].filter(Boolean) as Array<{ key: string; value: string }>

  let existing: any = null
  for (const selector of selectors) {
    const { data, error } = await supabase
      .from('commerce_customers')
      .select('*')
      .eq(selector.key, selector.value)
      .maybeSingle()
    if (error) throw error
    if (data) {
      existing = data
      break
    }
  }

  const payload = {
    name: input.name.trim(),
    email,
    phone: input.phone.trim(),
    phone_e164: phoneE164,
    document: document || null,
    document_type: documentType,
    whatsapp_opt_in: input.whatsappOptIn === true,
    email_opt_in: input.emailOptIn !== false,
    source,
    metadata: {
      ...(existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
      last_checkout_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { data, error } = await supabase
      .from('commerce_customers')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('commerce_customers')
    .insert([{ ...payload, created_at: new Date().toISOString() }])
    .select()
    .single()

  if (error) throw error
  return data
}
