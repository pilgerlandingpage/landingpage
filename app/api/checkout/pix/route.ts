import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  centsToMoney,
  findOrCreateCommerceCustomer,
  loadCheckoutOffer,
  loadCommerceConfig,
  normalizeBrazilPhone,
  normalizeDocument,
  normalizeEmail,
  type CheckoutBumpRow,
} from '@/lib/commerce/checkout'
import {
  assertMercadoPagoCredentialEnvironment,
  createMercadoPagoPixPayment,
  extractMercadoPagoPixData,
  getMercadoPagoPaymentMethod,
  mercadoPagoAmountToCents,
  normalizeMercadoPagoPaymentStatus,
} from '@/lib/commerce/mercado-pago'
import { commerceMessageVariables, dispatchCommerceMessage } from '@/lib/commerce/transactional-messages'

type CheckoutPixBody = {
  checkout_slug?: string
  offer_slug?: string
  selected_bump_ids?: string[]
  customer?: {
    name?: string
    email?: string
    phone?: string
    document?: string
    whatsapp_opt_in?: boolean
    email_opt_in?: boolean
  }
  utm?: Record<string, string>
  source?: string
}

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

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdminClient()

  try {
    const body = await request.json() as CheckoutPixBody
    const checkoutSlug = text(body.checkout_slug ?? body.offer_slug)
    if (!checkoutSlug) {
      return NextResponse.json({ success: false, message: 'Oferta não informada.' }, { status: 400 })
    }

    const checkout = await loadCheckoutOffer(checkoutSlug.replace(/^\/?checkout\//, ''))
    if (!checkout) {
      return NextResponse.json({ success: false, message: 'Oferta indisponível.' }, { status: 404 })
    }

    const config = await loadCommerceConfig()
    if (!config.mercadoPagoEnabled || !config.mercadoPagoAccessToken) {
      return NextResponse.json({
        success: false,
        message: 'Mercado Pago ainda não está ativo na Sala de Manutenção.',
      }, { status: 503 })
    }

    try {
      assertMercadoPagoCredentialEnvironment({
        environment: config.mercadoPagoEnvironment,
        accessToken: config.mercadoPagoAccessToken,
      })
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Credencial Mercado Pago incompatível com o ambiente configurado.',
      }, { status: 503 })
    }

    const customerInput = {
      name: text(body.customer?.name),
      email: normalizeEmail(body.customer?.email),
      phone: text(body.customer?.phone),
      document: normalizeDocument(body.customer?.document),
      whatsappOptIn: body.customer?.whatsapp_opt_in === true,
      emailOptIn: body.customer?.email_opt_in !== false,
    }

    const customer = await findOrCreateCommerceCustomer(customerInput, 'checkout_corretor_nota_8')
    const selected = selectedBumps(checkout.bumps, body.selected_bump_ids)
    const bumpTotalCents = sumCents(selected)
    const subtotalCents = checkout.offer.price_cents
    const discountCents = 0
    const totalCents = subtotalCents + bumpTotalCents
    const checkoutSessionId = crypto.randomUUID()
    const now = new Date()
    const pixExpiresAt = new Date(now.getTime() + config.mercadoPagoPixExpirationMinutes * 60 * 1000).toISOString()
    const checkoutUrl = publicCheckoutUrl(request, checkout.offer.checkout_path || `/checkout/${checkoutSlug}`)
    const utm = safeMetadata(body.utm)

    const { data: lead, error: leadError } = await supabase
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
        source: text(body.source, 'checkout'),
        acquired_via: 'checkout_pix',
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
          discount_cents: discountCents,
        },
        last_activity_at: now.toISOString(),
      }])
      .select()
      .single()

    if (leadError) throw leadError

    const { data: order, error: orderError } = await supabase
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
        pix_expires_at: pixExpiresAt,
        recovery_status: 'scheduled',
        metadata: {
          checkout_url: checkoutUrl,
          product_slug: checkout.product.slug,
          offer_slug: checkout.offer.slug,
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

    const { error: itemsError } = await supabase.from('commerce_order_items').insert(items)
    if (itemsError) throw itemsError

    let mercadoPagoPayment
    try {
      mercadoPagoPayment = await createMercadoPagoPixPayment({
        accessToken: config.mercadoPagoAccessToken,
        idempotencyKey: order.id,
        amountCents: totalCents,
        description: `${checkout.product.title} - ${order.order_number}`,
        payer: {
          name: customerInput.name,
          email: customerInput.email,
          document: customerInput.document,
        },
        externalReference: order.id,
        notificationUrl: config.mercadoPagoWebhookUrl,
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          product_slug: checkout.product.slug,
          offer_slug: checkout.offer.slug,
          checkout_session_id: checkoutSessionId,
        },
      })
    } catch (error) {
      await supabase
        .from('commerce_orders')
        .update({
          metadata: {
            ...(order.metadata || {}),
            mercado_pago_error: error instanceof Error ? error.message : String(error),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Não foi possível gerar o Pix.',
        order_id: order.id,
      }, { status: 502 })
    }

    const pix = extractMercadoPagoPixData(mercadoPagoPayment)
    const paymentStatus = normalizeMercadoPagoPaymentStatus(mercadoPagoPayment.status)
    const providerPaymentId = String(mercadoPagoPayment.id || '')

    const { data: payment, error: paymentError } = await supabase
      .from('commerce_payments')
      .insert([{
        order_id: order.id,
        customer_id: customer.id,
        provider: 'mercado_pago',
        provider_payment_id: providerPaymentId || null,
        provider_order_id: mercadoPagoPayment.order?.id ? String(mercadoPagoPayment.order.id) : null,
        status: paymentStatus,
        status_detail: text(mercadoPagoPayment.status_detail),
        payment_method: getMercadoPagoPaymentMethod(mercadoPagoPayment.payment_method_id),
        installments: Number.isFinite(Number(mercadoPagoPayment.installments)) ? Number(mercadoPagoPayment.installments) : null,
        amount_cents: mercadoPagoAmountToCents(mercadoPagoPayment.transaction_amount) || totalCents,
        currency: checkout.offer.currency,
        pix_qr_code: pix.qrCode || null,
        pix_qr_code_base64: pix.qrCodeBase64 || null,
        pix_ticket_url: pix.ticketUrl || null,
        paid_at: mercadoPagoPayment.date_approved || null,
        expires_at: pixExpiresAt,
        raw_payload: mercadoPagoPayment,
      }])
      .select()
      .single()

    if (paymentError) throw paymentError

    await Promise.all([
      supabase
        .from('commerce_orders')
        .update({
          status: paymentStatus === 'approved' ? 'paid' : 'pending_payment',
          provider_order_id: providerPaymentId || null,
          pix_expires_at: pixExpiresAt,
          paid_at: paymentStatus === 'approved' ? (mercadoPagoPayment.date_approved || new Date().toISOString()) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id),
      supabase
        .from('education_leads')
        .update({
          lead_stage: paymentStatus === 'approved' ? 'purchased' : 'pix_generated',
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id),
    ])

    await dispatchCommerceMessage({
      supabase,
      templateKey: 'checkout_pix_generated',
      channel: 'whatsapp',
      customer,
      order: {
        ...order,
        status: paymentStatus === 'approved' ? 'paid' : 'pending_payment',
        total_cents: totalCents,
      },
      payment,
      educationLeadId: lead.id,
      variables: commerceMessageVariables({
        customer,
        productName: checkout.product.title,
        order: {
          ...order,
          total_cents: totalCents,
        },
        payment: {
          ...payment,
          pix_qr_code: pix.qrCode,
        },
        checkoutUrl,
      }),
    }).catch((error) => {
      console.warn('[Checkout Pix] transactional WhatsApp failed:', error instanceof Error ? error.message : error)
    })

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        status: paymentStatus === 'approved' ? 'paid' : 'pending_payment',
        subtotal_cents: subtotalCents,
        bump_total_cents: bumpTotalCents,
        discount_cents: discountCents,
        total_cents: totalCents,
        total_display: centsToMoney(totalCents),
        pix_expires_at: pixExpiresAt,
      },
      payment: {
        id: payment.id,
        provider_payment_id: providerPaymentId,
        status: paymentStatus,
        status_detail: text(mercadoPagoPayment.status_detail),
        pix_qr_code: pix.qrCode,
        pix_qr_code_base64: pix.qrCodeBase64,
        pix_ticket_url: pix.ticketUrl,
        expires_at: pixExpiresAt,
      },
      customer: {
        id: customer.id,
        name: customerInput.name,
        email: customerInput.email,
      },
    })
  } catch (error) {
    console.error('[Checkout Pix] failed:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao iniciar checkout.',
    }, { status: 500 })
  }
}
