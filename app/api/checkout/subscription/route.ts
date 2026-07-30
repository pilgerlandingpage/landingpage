import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { centsToMoney } from '@/lib/commerce/checkout'
import { prepareCheckoutOrder } from '@/lib/commerce/checkout-order'
import {
  assertMercadoPagoCredentialEnvironment,
  createMercadoPagoPreapproval,
} from '@/lib/commerce/mercado-pago'
import {
  normalizeSubscriptionStatus,
  subscriptionInitPoint,
  subscriptionPaymentMethod,
  syncSubscriptionAccess,
  upsertSubscriptionFromRemote,
} from '@/lib/commerce/subscriptions'
import { emitPaymentStatusEvent, publicPaymentStatusPayload } from '@/lib/commerce/payment-status'

type CheckoutSubscriptionBody = {
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
  subscription?: {
    payment_method?: 'pix' | 'credit_card' | 'debit_card'
    card_token?: string
    frequency?: number
    frequency_type?: 'days' | 'weeks' | 'months' | 'years'
  }
  utm?: Record<string, string>
  source?: string
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function positiveInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback
}

function frequencyType(value: unknown, fallback: 'days' | 'weeks' | 'months' | 'years') {
  const normalized = text(value)
  return normalized === 'days' || normalized === 'weeks' || normalized === 'years' || normalized === 'months'
    ? normalized
    : fallback
}

function offerMetadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdminClient()

  try {
    const body = await request.json() as CheckoutSubscriptionBody
    const checkoutSlug = text(body.checkout_slug ?? body.offer_slug)
    if (!checkoutSlug) {
      return NextResponse.json({ success: false, message: 'Oferta nao informada.' }, { status: 400 })
    }

    const requestedMethod = body.subscription?.payment_method === 'credit_card' || body.subscription?.payment_method === 'debit_card'
      ? body.subscription.payment_method
      : 'pix'
    const cardToken = text(body.subscription?.card_token)
    if ((requestedMethod === 'credit_card' || requestedMethod === 'debit_card') && !cardToken) {
      return NextResponse.json({ success: false, message: 'Token do cartao invalido para assinatura.' }, { status: 400 })
    }

    const prepared = await prepareCheckoutOrder({
      supabase,
      request,
      checkoutSlug,
      selectedBumpIds: body.selected_bump_ids,
      customer: body.customer,
      utm: body.utm,
      source: body.source,
      acquiredVia: `checkout_subscription_${requestedMethod}`,
      paymentMethod: 'subscription',
      subscriptionMetadata: {
        subscription_payment_method: requestedMethod,
      },
    })

    const { config, checkout, customerInput, order, totalCents, checkoutSessionId, checkoutUrl } = prepared
    if (!config.mercadoPagoEnabled || !config.mercadoPagoAccessToken || !config.subscriptionPaymentsEnabled) {
      return NextResponse.json({
        success: false,
        message: 'Assinaturas ainda nao estao ativas na Sala de Manutencao.',
        order_id: order.id,
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
        message: error instanceof Error ? error.message : 'Credencial Mercado Pago incompativel com o ambiente configurado.',
        order_id: order.id,
      }, { status: 503 })
    }

    const metadata = offerMetadata(checkout.offer.metadata)
    const frequency = positiveInt(
      body.subscription?.frequency ?? metadata.subscription_frequency,
      config.subscriptionDefaultFrequency,
      1,
      365
    )
    const recurringType = frequencyType(
      body.subscription?.frequency_type ?? metadata.subscription_frequency_type,
      config.subscriptionDefaultFrequencyType
    )
    const preapprovalStatus = cardToken ? 'authorized' : 'pending'

    let remoteSubscription
    try {
      remoteSubscription = await createMercadoPagoPreapproval({
        accessToken: config.mercadoPagoAccessToken,
        idempotencyKey: `${order.id}:subscription`,
        reason: `${checkout.product.title} - ${order.order_number}`,
        payerEmail: customerInput.email,
        externalReference: order.id,
        amountCents: totalCents,
        currency: checkout.offer.currency,
        frequency,
        frequencyType: recurringType,
        status: preapprovalStatus,
        cardTokenId: cardToken || null,
        backUrl: checkoutUrl,
        notificationUrl: config.mercadoPagoWebhookUrl,
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          product_slug: checkout.product.slug,
          offer_slug: checkout.offer.slug,
          checkout_session_id: checkoutSessionId,
          subscription_payment_method: requestedMethod,
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
        message: error instanceof Error ? error.message : 'Nao foi possivel criar assinatura.',
        order_id: order.id,
      }, { status: 502 })
    }

    const normalizedStatus = normalizeSubscriptionStatus(remoteSubscription.status)
    const subscription = await upsertSubscriptionFromRemote({
      supabase,
      order,
      customerId: prepared.customer.id,
      productId: checkout.product.id,
      offerId: checkout.offer.id,
      remoteSubscription,
      paymentMethod: requestedMethod,
      environment: config.mercadoPagoEnvironment,
      metadata: {
        checkout_session_id: checkoutSessionId,
        checkout_url: checkoutUrl,
      },
    })

    const paymentStatus = normalizedStatus === 'authorized' || normalizedStatus === 'active' ? 'approved' : 'pending'
    const { data: payment, error: paymentError } = await supabase
      .from('commerce_payments')
      .insert([{
        order_id: order.id,
        subscription_id: subscription.id,
        customer_id: prepared.customer.id,
        provider: 'mercado_pago',
        provider_order_id: text(remoteSubscription.id),
        status: paymentStatus,
        status_detail: `subscription_${normalizedStatus}`,
        payment_method: 'subscription',
        installments: null,
        amount_cents: totalCents,
        currency: checkout.offer.currency,
        paid_at: paymentStatus === 'approved' ? new Date().toISOString() : null,
        raw_payload: remoteSubscription,
      }])
      .select()
      .single()

    if (paymentError) throw paymentError

    const sync = await syncSubscriptionAccess({
      supabase,
      subscription,
      order,
      paymentId: payment.id,
      source: 'checkout_subscription',
      remoteSubscription,
    })

    if (paymentStatus !== 'approved') {
      await emitPaymentStatusEvent({
        supabase,
        orderId: order.id,
        paymentId: payment.id,
        status: 'waiting_payment',
        source: 'checkout_subscription_pending',
        channels: ['whatsapp'],
        metadata: {
          subscription_id: subscription.id,
          provider_subscription_id: subscription.provider_subscription_id || null,
          checkout_url: checkoutUrl,
          init_point: subscriptionInitPoint(remoteSubscription, config.mercadoPagoEnvironment),
        },
      }).catch((error) => {
        console.warn('[Checkout Subscription] pending event failed:', error instanceof Error ? error.message : error)
      })
    }

    const { data: updatedOrder } = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('id', order.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      order: {
        id: (updatedOrder || order).id,
        order_number: (updatedOrder || order).order_number,
        status: (updatedOrder || order).status,
        subtotal_cents: prepared.subtotalCents,
        bump_total_cents: prepared.bumpTotalCents,
        discount_cents: prepared.discountCents,
        total_cents: totalCents,
        total_display: centsToMoney(totalCents),
        paid_at: (updatedOrder || order).paid_at,
      },
      payment: {
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        payment_method: subscriptionPaymentMethod(requestedMethod),
      },
      subscription: {
        id: subscription.id,
        provider_subscription_id: subscription.provider_subscription_id,
        status: subscription.status,
        payment_method: subscription.payment_method,
        frequency: subscription.billing_frequency,
        frequency_type: subscription.billing_frequency_type,
        init_point: subscriptionInitPoint(remoteSubscription, config.mercadoPagoEnvironment),
      },
      status: publicPaymentStatusPayload(updatedOrder || order, payment),
      sync,
      customer: {
        id: prepared.customer.id,
        name: customerInput.name,
        email: customerInput.email,
      },
    })
  } catch (error) {
    console.error('[Checkout Subscription] failed:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao criar assinatura.',
    }, { status: 500 })
  }
}
