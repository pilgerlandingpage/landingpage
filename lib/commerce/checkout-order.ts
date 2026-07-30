import type { NextRequest } from 'next/server'
import {
  findOrCreateCommerceCustomer,
  loadCheckoutOffer,
  loadCommerceConfig,
  normalizeBrazilPhone,
  normalizeDocument,
  normalizeEmail,
  type CheckoutBumpRow,
  type CheckoutCustomerInput,
} from './checkout'

type SupabaseAdminLike = {
  from: (table: string) => any
}

export type CheckoutPaymentMethod =
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'subscription'

export type CheckoutCustomerBody = {
  name?: string
  email?: string
  phone?: string
  document?: string
  whatsapp_opt_in?: boolean
  email_opt_in?: boolean
}

export type PreparedCheckoutOrder = Awaited<ReturnType<typeof prepareCheckoutOrder>>

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, string>
}

function selectedBumps(allBumps: CheckoutBumpRow[], selectedIds: unknown) {
  const ids = new Set(Array.isArray(selectedIds) ? selectedIds.map(String) : [])
  return allBumps.filter((bump) => ids.has(bump.id))
}

function sumCents(items: Array<{ price_cents: number }>) {
  return items.reduce((total, item) => total + Math.max(0, Number(item.price_cents) || 0), 0)
}

function publicCheckoutUrl(request: NextRequest, path: string) {
  const configuredHost = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (configuredHost) {
    const normalized = configuredHost.startsWith('http') ? configuredHost : `https://${configuredHost}`
    return `${normalized.replace(/\/$/, '')}${path}`
  }
  return new URL(path, request.url).toString()
}

function normalizeCustomer(input?: CheckoutCustomerBody): CheckoutCustomerInput {
  return {
    name: text(input?.name),
    email: normalizeEmail(input?.email),
    phone: text(input?.phone),
    document: normalizeDocument(input?.document),
    whatsappOptIn: input?.whatsapp_opt_in === true,
    emailOptIn: input?.email_opt_in !== false,
  }
}

function offerPaymentMethods(value: unknown) {
  const methods = Array.isArray(value) ? value.map(String) : ['pix']
  return new Set(methods.map((item) => item.trim()).filter(Boolean))
}

function assertOfferAllowsPaymentMethod(params: {
  product: Record<string, any>
  offer: Record<string, any>
  method: CheckoutPaymentMethod
}) {
  const methods = offerPaymentMethods(params.offer.payment_methods)
  if (methods.has(params.method) || methods.has('all')) return
  if ((params.method === 'credit_card' || params.method === 'debit_card') && methods.has('card')) return
  if (params.method === 'subscription' && params.product.access_model === 'subscription') return

  const labels: Record<CheckoutPaymentMethod, string> = {
    pix: 'Pix',
    credit_card: 'cartao de credito',
    debit_card: 'cartao de debito',
    subscription: 'assinatura',
  }
  throw new Error(`Esta oferta ainda nao permite pagamento por ${labels[params.method]}.`)
}

export async function prepareCheckoutOrder(params: {
  supabase: SupabaseAdminLike
  request: NextRequest
  checkoutSlug: string
  selectedBumpIds?: unknown
  customer?: CheckoutCustomerBody
  utm?: Record<string, string>
  source?: string
  acquiredVia: string
  paymentMethod: CheckoutPaymentMethod
  pixExpiresAt?: string | null
  recoveryStatus?: 'not_started' | 'scheduled' | 'active' | 'recovered' | 'lost' | 'cancelled'
  subscriptionMetadata?: Record<string, unknown>
}) {
  const checkoutSlug = text(params.checkoutSlug).replace(/^\/?checkout\//, '')
  if (!checkoutSlug) throw new Error('Oferta nao informada.')

  const checkout = await loadCheckoutOffer(checkoutSlug)
  if (!checkout) throw new Error('Oferta indisponivel.')

  assertOfferAllowsPaymentMethod({
    product: checkout.product,
    offer: checkout.offer,
    method: params.paymentMethod,
  })

  const config = await loadCommerceConfig()
  const customerInput = normalizeCustomer(params.customer)
  const customer = await findOrCreateCommerceCustomer(customerInput, 'checkout_corretor_nota_8')
  const selected = selectedBumps(checkout.bumps, params.selectedBumpIds)
  const bumpTotalCents = sumCents(selected)
  const subtotalCents = checkout.offer.price_cents
  const discountCents = 0
  const totalCents = subtotalCents + bumpTotalCents
  const checkoutSessionId = crypto.randomUUID()
  const now = new Date()
  const checkoutUrl = publicCheckoutUrl(params.request, checkout.offer.checkout_path || `/checkout/${checkoutSlug}`)
  const utm = safeMetadata(params.utm)

  const { data: lead, error: leadError } = await params.supabase
    .from('education_leads')
    .insert([{
      customer_id: customer.id,
      landing_page_id: checkout.offer.landing_page_id,
      product_id: checkout.product.id,
      name: customerInput.name,
      email: customerInput.email,
      phone: customerInput.phone,
      phone_e164: normalizeBrazilPhone(customerInput.phone),
      document: customerInput.document || null,
      lead_stage: 'checkout_started',
      source: text(params.source, 'checkout'),
      acquired_via: params.acquiredVia,
      utm,
      consent: {
        whatsapp: customerInput.whatsappOptIn,
        email: customerInput.emailOptIn,
      },
      metadata: {
        checkout_session_id: checkoutSessionId,
        offer_slug: checkout.offer.slug,
        selected_bump_ids: selected.map((bump) => bump.id),
        checkout_url: checkoutUrl,
        payment_method: params.paymentMethod,
        discount_cents: discountCents,
        ...(params.subscriptionMetadata || {}),
      },
      last_activity_at: now.toISOString(),
    }])
    .select()
    .single()

  if (leadError) throw leadError

  const { data: order, error: orderError } = await params.supabase
    .from('commerce_orders')
    .insert([{
      customer_id: customer.id,
      education_lead_id: lead.id,
      offer_id: checkout.offer.id,
      landing_page_id: checkout.offer.landing_page_id,
      status: 'checkout_started',
      currency: checkout.offer.currency,
      subtotal_cents: subtotalCents,
      discount_cents: discountCents,
      bump_total_cents: bumpTotalCents,
      total_cents: totalCents,
      coupon_id: null,
      payment_provider: 'mercado_pago',
      checkout_session_id: checkoutSessionId,
      pix_expires_at: params.pixExpiresAt || null,
      recovery_status: params.recoveryStatus || 'scheduled',
      metadata: {
        checkout_url: checkoutUrl,
        product_slug: checkout.product.slug,
        offer_slug: checkout.offer.slug,
        payment_method: params.paymentMethod,
        discount_cents: discountCents,
        selected_bump_ids: selected.map((bump) => bump.id),
        selected_bump_titles: selected.map((bump) => bump.title),
        payment_environment: config.mercadoPagoEnvironment,
        notification_preferences: {
          whatsapp: config.whatsappNotificationsEnabled && customerInput.whatsappOptIn,
          email: config.emailNotificationsEnabled && customerInput.emailOptIn,
        },
        support_whatsapp: config.supportWhatsapp,
        member_area_url: config.memberAreaUrl,
        utm,
        ...(params.subscriptionMetadata || {}),
      },
    }])
    .select()
    .single()

  if (orderError) throw orderError

  const items = [
    {
      order_id: order.id,
      product_id: checkout.product.id,
      offer_id: checkout.offer.id,
      item_type: 'primary',
      title_snapshot: checkout.product.title,
      quantity: 1,
      unit_amount_cents: checkout.offer.price_cents,
      total_amount_cents: checkout.offer.price_cents,
      metadata: {
        offer_slug: checkout.offer.slug,
        original_unit_amount_cents: checkout.offer.price_cents,
        discount_cents: discountCents,
        payment_method: params.paymentMethod,
      },
    },
    ...selected.map((bump) => ({
      order_id: order.id,
      product_id: bump.bump_product_id,
      offer_id: bump.bump_offer_id,
      item_type: 'order_bump',
      title_snapshot: bump.title,
      quantity: 1,
      unit_amount_cents: bump.price_cents,
      total_amount_cents: bump.price_cents,
      metadata: { order_bump_id: bump.id },
    })),
  ]

  const { error: itemsError } = await params.supabase.from('commerce_order_items').insert(items)
  if (itemsError) throw itemsError

  return {
    config,
    checkout,
    customerInput,
    customer,
    lead,
    order,
    selectedBumps: selected,
    checkoutSlug,
    checkoutSessionId,
    checkoutUrl,
    subtotalCents,
    bumpTotalCents,
    discountCents,
    totalCents,
    utm,
  }
}
