import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { centsToMoney } from '@/lib/commerce/checkout'
import { prepareCheckoutOrder, type CheckoutPaymentMethod } from '@/lib/commerce/checkout-order'
import { fulfillApprovedOrder, mapPaymentStatusToOrderStatus } from '@/lib/commerce/fulfillment'
import {
  assertMercadoPagoCredentialEnvironment,
  createMercadoPagoCardPayment,
  getMercadoPagoPaymentMethod,
  mercadoPagoAmountToCents,
  normalizeMercadoPagoPaymentStatus,
} from '@/lib/commerce/mercado-pago'
import { emitPaymentStatusEvent, paymentLifecycleFromProviderStatus, publicPaymentStatusPayload } from '@/lib/commerce/payment-status'

type CheckoutCardBody = {
  checkout_slug?: string
  offer_slug?: string
  selected_bump_ids?: string[]
  device_session_id?: string
  customer?: {
    name?: string
    email?: string
    phone?: string
    document?: string
    whatsapp_opt_in?: boolean
    email_opt_in?: boolean
  }
  card?: {
    token?: string
    payment_method_id?: string
    payment_type_id?: string
    issuer_id?: string | number | null
    installments?: number
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

function cardPaymentMethod(paymentTypeId: unknown): CheckoutPaymentMethod {
  return String(paymentTypeId || '').toLowerCase() === 'debit_card' ? 'debit_card' : 'credit_card'
}

function mercadoPagoCheckoutItems(prepared: Awaited<ReturnType<typeof prepareCheckoutOrder>>) {
  return [
    {
      id: prepared.checkout.product.id,
      title: prepared.checkout.product.title,
      description: prepared.checkout.product.subtitle || prepared.checkout.offer.description,
      quantity: 1,
      unitAmountCents: prepared.checkout.offer.price_cents,
      pictureUrl: prepared.checkout.product.thumbnail_url || prepared.checkout.product.cover_image_url,
    },
    ...prepared.selectedBumps.map((bump) => ({
      id: bump.id,
      title: bump.title,
      description: bump.description,
      quantity: 1,
      unitAmountCents: bump.price_cents,
      pictureUrl: null,
    })),
  ]
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdminClient()

  try {
    const body = await request.json() as CheckoutCardBody
    const checkoutSlug = text(body.checkout_slug ?? body.offer_slug)
    const token = text(body.card?.token)
    const paymentMethodId = text(body.card?.payment_method_id)
    const paymentTypeId = text(body.card?.payment_type_id, 'credit_card')
    const paymentMethod = cardPaymentMethod(paymentTypeId)

    if (!checkoutSlug) {
      return NextResponse.json({ success: false, message: 'Oferta nao informada.' }, { status: 400 })
    }
    if (!token || !paymentMethodId) {
      return NextResponse.json({ success: false, message: 'Token do cartao invalido.' }, { status: 400 })
    }

    const prepared = await prepareCheckoutOrder({
      supabase,
      request,
      checkoutSlug,
      selectedBumpIds: body.selected_bump_ids,
      customer: body.customer,
      utm: body.utm,
      source: body.source,
      acquiredVia: `checkout_${paymentMethod}`,
      paymentMethod,
    })

    const { config, checkout, customerInput, order, totalCents, checkoutSessionId, checkoutUrl } = prepared
    if (!config.mercadoPagoEnabled || !config.mercadoPagoAccessToken || !config.cardPaymentsEnabled) {
      return NextResponse.json({
        success: false,
        message: 'Pagamento por cartao ainda nao esta ativo na Sala de Manutencao.',
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

    const maxInstallments = Math.max(1, Number(checkout.offer.max_installments || 1))
    const installments = positiveInt(body.card?.installments, 1, 1, maxInstallments)

    let mercadoPagoPayment
    try {
      mercadoPagoPayment = await createMercadoPagoCardPayment({
        accessToken: config.mercadoPagoAccessToken,
        idempotencyKey: `${order.id}:card`,
        amountCents: totalCents,
        description: `${checkout.product.title} - ${order.order_number}`,
        token,
        paymentMethodId,
        issuerId: body.card?.issuer_id ? String(body.card.issuer_id) : null,
        installments,
        deviceSessionId: text(body.device_session_id),
        payer: {
          name: customerInput.name,
          email: customerInput.email,
          document: customerInput.document,
          phone: customerInput.phone,
          registrationDate: prepared.customer.created_at || prepared.customer.updated_at || null,
        },
        items: mercadoPagoCheckoutItems(prepared),
        externalReference: order.id,
        notificationUrl: config.mercadoPagoWebhookUrl,
        statementDescriptor: config.mercadoPagoStatementDescriptor,
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          product_slug: checkout.product.slug,
          offer_slug: checkout.offer.slug,
          checkout_session_id: checkoutSessionId,
          mercado_pago_device_session_id_present: Boolean(text(body.device_session_id)),
          three_d_secure_mode: 'optional',
          payment_method: paymentMethod,
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
        message: error instanceof Error ? error.message : 'Nao foi possivel processar o cartao.',
        order_id: order.id,
      }, { status: 502 })
    }

    const paymentStatus = normalizeMercadoPagoPaymentStatus(mercadoPagoPayment.status)
    const orderStatus = mapPaymentStatusToOrderStatus(paymentStatus, text(mercadoPagoPayment.status_detail))
    const paidAt = paymentStatus === 'approved'
      ? (mercadoPagoPayment.date_approved || new Date().toISOString())
      : null
    const providerPaymentId = String(mercadoPagoPayment.id || '')
    const remotePaymentMethod = getMercadoPagoPaymentMethod(mercadoPagoPayment.payment_method_id, mercadoPagoPayment.payment_type_id)

    const { data: payment, error: paymentError } = await supabase
      .from('commerce_payments')
      .insert([{
        order_id: order.id,
        customer_id: prepared.customer.id,
        provider: 'mercado_pago',
        provider_payment_id: providerPaymentId || null,
        provider_order_id: mercadoPagoPayment.order?.id ? String(mercadoPagoPayment.order.id) : null,
        status: paymentStatus,
        status_detail: text(mercadoPagoPayment.status_detail),
        payment_method: remotePaymentMethod,
        installments: Number.isFinite(Number(mercadoPagoPayment.installments)) ? Number(mercadoPagoPayment.installments) : installments,
        amount_cents: mercadoPagoAmountToCents(mercadoPagoPayment.transaction_amount) || totalCents,
        currency: checkout.offer.currency,
        paid_at: paidAt,
        raw_payload: mercadoPagoPayment,
      }])
      .select()
      .single()

    if (paymentError) throw paymentError

    const { data: updatedOrder, error: updateOrderError } = await supabase
      .from('commerce_orders')
      .update({
        status: orderStatus,
        provider_order_id: providerPaymentId || null,
        paid_at: paidAt,
        cancelled_at: orderStatus === 'cancelled' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select('*')
      .single()

    if (updateOrderError) throw updateOrderError

    let fulfillment = null
    if (paymentStatus === 'approved') {
      fulfillment = await fulfillApprovedOrder({
        supabase,
        orderId: order.id,
        paymentId: payment.id,
        source: `checkout_${paymentMethod}`,
        remotePayment: mercadoPagoPayment,
      }).catch((error) => {
        console.warn('[Checkout Card] fulfillment failed:', error instanceof Error ? error.message : error)
        return null
      })
    }

    const event = await emitPaymentStatusEvent({
      supabase,
      orderId: order.id,
      paymentId: payment.id,
      status: paymentStatus === 'approved'
        ? 'access_granted'
        : paymentLifecycleFromProviderStatus(paymentStatus, mercadoPagoPayment.status_detail),
      source: `checkout_${paymentMethod}`,
      remotePayment: mercadoPagoPayment,
      sendNotifications: paymentStatus !== 'approved',
      metadata: {
        checkout_session_id: checkoutSessionId,
        checkout_url: checkoutUrl,
        payment_method: paymentMethod,
      },
    }).catch((error) => {
      console.warn('[Checkout Card] payment status event failed:', error instanceof Error ? error.message : error)
      return null
    })

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        order_number: updatedOrder.order_number,
        status: updatedOrder.status,
        subtotal_cents: prepared.subtotalCents,
        bump_total_cents: prepared.bumpTotalCents,
        discount_cents: prepared.discountCents,
        total_cents: totalCents,
        total_display: centsToMoney(totalCents),
        paid_at: updatedOrder.paid_at,
      },
      payment: {
        id: payment.id,
        provider_payment_id: providerPaymentId,
        status: paymentStatus,
        status_detail: text(mercadoPagoPayment.status_detail),
        payment_method: remotePaymentMethod,
        installments: payment.installments,
        card_last_four: text(mercadoPagoPayment.card?.last_four_digits),
        three_ds_info: mercadoPagoPayment.three_ds_info || null,
      },
      status: publicPaymentStatusPayload(updatedOrder, payment),
      fulfillment,
      event,
      customer: {
        id: prepared.customer.id,
        name: customerInput.name,
        email: customerInput.email,
      },
    })
  } catch (error) {
    console.error('[Checkout Card] failed:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao processar cartao.',
    }, { status: 500 })
  }
}
