import { centsToMoney, loadCommerceConfig } from './checkout'
import { ensureMemberAuthAccess } from './member-auth-access'
import { commerceMessageVariables, dispatchCommerceMessage } from './transactional-messages'

type SupabaseAdminLike = {
  from: (table: string) => any
}

type FulfillmentParams = {
  supabase: SupabaseAdminLike
  orderId: string
  paymentId?: string | null
  source?: string
  remotePayment?: Record<string, any> | null
  suppressNotifications?: boolean
  suppressAuthAccess?: boolean
}

type ProductAccessSnapshot = {
  id: string
  slug: string | null
  title: string | null
  access_model?: string | null
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

async function getOrderBundle(supabase: SupabaseAdminLike, orderId: string) {
  const { data: order, error: orderError } = await supabase
    .from('commerce_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) throw orderError
  if (!order) throw new Error('Pedido não encontrado para fulfillment.')

  const [customerRes, itemsRes, paymentRes, leadRes] = await Promise.all([
    order.customer_id
      ? supabase.from('commerce_customers').select('*').eq('id', order.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('commerce_order_items').select('*').eq('order_id', orderId),
    supabase
      .from('commerce_payments')
      .select('*')
      .eq('order_id', orderId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    order.education_lead_id
      ? supabase.from('education_leads').select('*').eq('id', order.education_lead_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const error = customerRes.error || itemsRes.error || paymentRes.error || leadRes.error
  if (error) throw error
  if (!customerRes.data) throw new Error('Cliente não encontrado para fulfillment.')

  return {
    order,
    customer: customerRes.data,
    items: itemsRes.data || [],
    payment: paymentRes.data || null,
    lead: leadRes.data || null,
  }
}

async function getOrCreateMemberAccount(supabase: SupabaseAdminLike, customer: Record<string, any>, orderId: string) {
  let member = null

  if (customer.id) {
    const { data, error } = await supabase
      .from('member_accounts')
      .select('*')
      .eq('customer_id', customer.id)
      .maybeSingle()
    if (error) throw error
    if (data) member = data
  }

  if (!member && customer.email) {
    const { data, error } = await supabase
      .from('member_accounts')
      .select('*')
      .eq('email', String(customer.email).toLowerCase())
      .maybeSingle()
    if (error) throw error
    if (data) member = data
  }

  const payload = {
    customer_id: customer.id || null,
    email: text(customer.email).toLowerCase() || null,
    name: text(customer.name),
    status: 'active',
    metadata: {
      ...(member?.metadata && typeof member.metadata === 'object' ? member.metadata : {}),
      last_order_id: orderId,
      last_access_granted_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }

  if (member) {
    const { data, error } = await supabase
      .from('member_accounts')
      .update(payload)
      .eq('id', member.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('member_accounts')
    .insert([{ ...payload, created_at: new Date().toISOString() }])
    .select()
    .single()

  if (error) throw error
  return data
}

async function grantEntitlements(params: {
  supabase: SupabaseAdminLike
  member: Record<string, any>
  customer: Record<string, any>
  order: Record<string, any>
  items: Record<string, any>[]
  source: string
}) {
  const { supabase, member, customer, order, items, source } = params
  const granted: Record<string, any>[] = []
  const productIds = Array.from(new Set(items.map((item) => text(item.product_id)).filter(Boolean)))
  const { data: products, error: productsError } = productIds.length
    ? await supabase.from('commerce_products').select('id, slug, title, access_model').in('id', productIds)
    : { data: [], error: null }

  if (productsError) throw productsError
  const productsById = new Map<string, ProductAccessSnapshot>(
    (products || []).map((product: ProductAccessSnapshot) => [product.id, product])
  )

  for (const item of items) {
    const productId = text(item.product_id)
    if (!productId) continue

    const { data: existing, error: existingError } = await supabase
      .from('member_entitlements')
      .select('*')
      .eq('order_id', order.id)
      .eq('product_id', productId)
      .eq('customer_id', customer.id)
      .limit(1)
      .maybeSingle()

    if (existingError) throw existingError
    if (existing) {
      granted.push(existing)
      continue
    }

    const product = productsById.get(productId)
    const { data, error } = await supabase
      .from('member_entitlements')
      .insert([{
        member_account_id: member.id,
        customer_id: customer.id,
        product_id: productId,
        order_id: order.id,
        order_item_id: item.id || null,
        status: 'active',
        access_starts_at: new Date().toISOString(),
        access_expires_at: null,
        granted_at: new Date().toISOString(),
        metadata: {
          source,
          item_type: item.item_type,
          title_snapshot: item.title_snapshot,
          product_slug: product?.slug || null,
          product_title: product?.title || item.title_snapshot || null,
        },
      }])
      .select()
      .single()

    if (error) throw error
    granted.push(data)
  }

  return granted
}

async function insertAuditLog(supabase: SupabaseAdminLike, params: {
  entityType: string
  entityId: string
  action: string
  message: string
  metadata?: Record<string, unknown>
}) {
  await supabase
    .from('commerce_audit_logs')
    .insert([{
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      actor_type: 'system',
      actor_id: 'commerce-fulfillment',
      message: params.message,
      metadata: params.metadata || {},
    }])
}

export async function fulfillApprovedOrder(params: FulfillmentParams) {
  const source = params.source || 'payment_webhook'
  const bundle = await getOrderBundle(params.supabase, params.orderId)
  const { supabase } = params
  const { order, customer, items, lead } = bundle
  const payment = params.paymentId
    ? await supabase.from('commerce_payments').select('*').eq('id', params.paymentId).maybeSingle().then((result: any) => {
        if (result.error) throw result.error
        return result.data || bundle.payment
      })
    : bundle.payment

  if (!items.length) throw new Error('Pedido aprovado sem itens para liberar.')

  const now = new Date().toISOString()
  const member = await getOrCreateMemberAccount(supabase, customer, order.id)
  const entitlements = await grantEntitlements({
    supabase,
    member,
    customer,
    order,
    items,
    source,
  })

  await Promise.all([
    supabase
      .from('commerce_orders')
      .update({
        status: 'paid',
        paid_at: order.paid_at || payment?.paid_at || now,
        updated_at: now,
        metadata: {
          ...objectRecord(order.metadata),
          fulfillment_status: 'access_granted',
          member_account_id: member.id,
          entitlements_count: entitlements.length,
          fulfilled_at: now,
        },
      })
      .eq('id', order.id),
    order.education_lead_id
      ? supabase
          .from('education_leads')
          .update({
            lead_stage: 'access_granted',
            last_activity_at: now,
            updated_at: now,
            metadata: {
              ...objectRecord(lead?.metadata),
              member_account_id: member.id,
              last_order_id: order.id,
            },
          })
          .eq('id', order.education_lead_id)
      : Promise.resolve(),
    insertAuditLog(supabase, {
      entityType: 'commerce_orders',
      entityId: order.id,
      action: 'access_granted',
      message: `Acesso liberado para ${customer.email || customer.phone_e164 || customer.id}.`,
      metadata: {
        source,
        member_account_id: member.id,
        entitlements: entitlements.map((item) => item.id),
        total: centsToMoney(Number(order.total_cents || 0)),
      },
    }),
  ])

  const productName = (items as Record<string, any>[])
    .map((item) => text(item.title_snapshot))
    .filter(Boolean)
    .join(' + ')
  const authAccess = params.suppressAuthAccess
    ? {
        created: false,
        access_link: '',
        auth_user_id: member.auth_user_id || '',
        reason: 'suppressed',
      }
    : await ensureMemberAuthAccess({ member, customer }).catch((error: any) => ({
        created: false,
        access_link: '',
        auth_user_id: member.auth_user_id || '',
        reason: error?.message || String(error),
      }))

  if (params.suppressNotifications) {
    return {
      order_id: order.id,
      member_account_id: member.id,
      auth_user_id: authAccess.auth_user_id || null,
      auth_access_link_generated: false,
      entitlements_count: entitlements.length,
      whatsapp: { skipped: true, reason: 'suppressed_notifications' },
      email: { skipped: true, reason: 'suppressed_notifications' },
    }
  }

  const config = await loadCommerceConfig()
  const variables = commerceMessageVariables({
    customer,
    productName: productName || 'Produto digital Guilherme Pilger',
    order,
    payment,
    memberAreaUrl: config.memberAreaUrl,
    accessLink: authAccess.access_link,
  })
  const whatsappTemplate = authAccess.access_link
    ? 'member_first_access_whatsapp'
    : 'purchase_approved_access_released'
  const emailTemplate = authAccess.access_link
    ? 'member_first_access_email'
    : 'purchase_approved_email'

  const [whatsappResult, emailResult] = await Promise.all([
    dispatchCommerceMessage({
      supabase,
      templateKey: whatsappTemplate,
      channel: 'whatsapp',
      customer,
      order,
      payment,
      educationLeadId: order.education_lead_id,
      variables,
    }).then((result: any) => {
      if (result?.skipped && result.reason === 'template_not_found' && whatsappTemplate !== 'purchase_approved_access_released') {
        return dispatchCommerceMessage({
          supabase,
          templateKey: 'purchase_approved_access_released',
          channel: 'whatsapp',
          customer,
          order,
          payment,
          educationLeadId: order.education_lead_id,
          variables,
        })
      }
      return result
    }).catch((error: any) => ({ sent: false, error: error?.message || String(error) })),
    dispatchCommerceMessage({
      supabase,
      templateKey: emailTemplate,
      channel: 'email',
      customer,
      order,
      payment,
      educationLeadId: order.education_lead_id,
      variables,
    }).then((result: any) => {
      if (result?.skipped && result.reason === 'template_not_found' && emailTemplate !== 'purchase_approved_email') {
        return dispatchCommerceMessage({
          supabase,
          templateKey: 'purchase_approved_email',
          channel: 'email',
          customer,
          order,
          payment,
          educationLeadId: order.education_lead_id,
          variables,
        })
      }
      return result
    }).catch((error: any) => ({ sent: false, error: error?.message || String(error) })),
  ])

  return {
    order_id: order.id,
    member_account_id: member.id,
    auth_user_id: authAccess.auth_user_id || null,
    auth_access_link_generated: Boolean(authAccess.access_link),
    entitlements_count: entitlements.length,
    whatsapp: whatsappResult,
    email: emailResult,
  }
}

export function mapPaymentStatusToOrderStatus(status: string, statusDetail?: string | null) {
  if (status === 'approved') return 'paid'
  if (status === 'refunded') return 'refunded'
  if (status === 'charged_back') return 'chargeback'
  if (status === 'cancelled' && String(statusDetail || '').toLowerCase().includes('expired')) return 'expired'
  if (status === 'cancelled' || status === 'rejected') return 'cancelled'
  return 'pending_payment'
}
