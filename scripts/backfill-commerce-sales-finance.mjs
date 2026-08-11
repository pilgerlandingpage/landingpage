import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })

const APPLY = process.argv.includes('--apply')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

function text(value, fallback = '') {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'bigint') return value.toString()
  return fallback
}

function centsToAmount(value) {
  const cents = Number(value || 0)
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return Number((cents / 100).toFixed(2))
}

function dateOnly(value) {
  const raw = text(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = raw ? new Date(raw) : new Date()
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

function partyTypeFromCustomer(customer) {
  const documentType = text(customer?.document_type).toLowerCase()
  const document = text(customer?.document).replace(/\D/g, '')
  if (documentType === 'cnpj' || document.length === 14) return 'pessoa_juridica'
  if (documentType === 'cpf' || document.length === 11) return 'pessoa_fisica'
  return null
}

function productLabel(items) {
  const labels = (items || [])
    .map((item) => text(item.title_snapshot))
    .filter(Boolean)

  if (labels.length === 0) return 'Venda online'
  if (labels.length === 1) return labels[0]
  return `${labels[0]} + ${labels.length - 1} item(ns)`
}

function groupBy(rows, key) {
  const grouped = new Map()
  for (const row of rows || []) {
    const groupKey = row[key]
    if (!grouped.has(groupKey)) grouped.set(groupKey, [])
    grouped.get(groupKey).push(row)
  }
  return grouped
}

async function selectByIds(table, ids, columns) {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .in('id', ids)

  if (error) throw new Error(`${table}: ${error.message}`)
  return data || []
}

async function resolveDefaultEntityId() {
  const { data, error } = await supabase
    .from('finance_entities')
    .select('id')
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle()

  if (error) throw new Error(`finance_entities: ${error.message}`)
  return data?.id || null
}

async function resolveDigitalCostCenterId() {
  const { data, error } = await supabase
    .from('finance_cost_centers')
    .select('id')
    .eq('name', 'Produtos Digitais')
    .maybeSingle()

  if (error) throw new Error(`finance_cost_centers: ${error.message}`)
  return data?.id || null
}

function chooseCanonicalPayment(payments) {
  const approved = (payments || [])
    .filter((payment) => payment.provider === 'mercado_pago' && payment.status === 'approved')
    .sort((a, b) => text(a.created_at).localeCompare(text(b.created_at)))

  if (!approved.length) return null

  const providerPaymentId =
    approved.find((payment) => text(payment.provider_payment_id))?.provider_payment_id
    || (payments || []).find((payment) => payment.provider === 'mercado_pago' && text(payment.provider_payment_id))?.provider_payment_id
    || null

  return {
    ...approved[0],
    provider_payment_id: providerPaymentId,
  }
}

async function buildBackfillRows() {
  const { data: orders, error: ordersError } = await supabase
    .from('commerce_orders')
    .select('id,order_number,status,total_cents,paid_at,customer_id,payment_provider,created_at')
    .eq('status', 'paid')
    .order('created_at', { ascending: true })

  if (ordersError) throw new Error(`commerce_orders: ${ordersError.message}`)

  const orderIds = (orders || []).map((order) => order.id)
  const customerIds = [...new Set((orders || []).map((order) => order.customer_id).filter(Boolean))]

  const { data: payments, error: paymentsError } = orderIds.length
    ? await supabase
      .from('commerce_payments')
      .select('id,order_id,customer_id,provider,status,amount_cents,provider_payment_id,status_detail,paid_at,created_at')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true })
    : { data: [], error: null }

  if (paymentsError) throw new Error(`commerce_payments: ${paymentsError.message}`)

  const { data: items, error: itemsError } = orderIds.length
    ? await supabase
      .from('commerce_order_items')
      .select('id,order_id,title_snapshot,total_amount_cents,created_at')
      .in('order_id', orderIds)
    : { data: [], error: null }

  if (itemsError) throw new Error(`commerce_order_items: ${itemsError.message}`)

  const customers = await selectByIds(
    'commerce_customers',
    customerIds,
    'id,name,email,phone,document,document_type',
  )

  const paymentsByOrder = groupBy(payments, 'order_id')
  const itemsByOrder = groupBy(items, 'order_id')
  const customersById = new Map(customers.map((customer) => [customer.id, customer]))
  const defaultEntityId = await resolveDefaultEntityId()
  const costCenterId = await resolveDigitalCostCenterId()
  const rows = []

  for (const order of orders || []) {
    const payment = chooseCanonicalPayment(paymentsByOrder.get(order.id) || [])
    if (!payment) continue

    const amount = centsToAmount(order.total_cents || payment.amount_cents)
    if (amount <= 0) continue

    const providerPaymentId = text(payment.provider_payment_id)
    const externalReference = providerPaymentId
      ? `mercado_pago:${providerPaymentId}`
      : `commerce_order:${order.id}`

    const { data: existing, error: existingError } = await supabase
      .from('finance_entries')
      .select('id')
      .eq('source_module', 'commerce_sales')
      .eq('external_reference', externalReference)
      .maybeSingle()

    if (existingError) throw new Error(`finance_entries check: ${existingError.message}`)
    if (existing?.id) continue

    const customer = customersById.get(order.customer_id) || null
    const orderItems = itemsByOrder.get(order.id) || []
    const entryDate = dateOnly(payment.paid_at || order.paid_at || order.created_at)
    const productName = productLabel(orderItems)
    const orderNumber = text(order.order_number, text(order.id).slice(0, 8))
    const customerName = text(customer?.name) || text(customer?.email) || text(customer?.phone) || 'Cliente Mercado Pago'
    const now = new Date().toISOString()

    rows.push({
      description: `Venda Mercado Pago - ${productName} - ${orderNumber}`,
      entry_type: 'income',
      amount,
      entry_date: entryDate,
      occurred_at: `${entryDate}T12:00:00.000Z`,
      category: 'Produtos Digitais',
      subcategory: 'Vendas Online',
      payment_method: 'Mercado Pago Pix',
      payment_status: 'paid',
      counterparty_name: customerName,
      counterparty_type: partyTypeFromCustomer(customer),
      reference_company: 'Commerce Mercado Pago',
      due_date: entryDate,
      competence_date: entryDate,
      cost_center_id: costCenterId,
      entity_id: defaultEntityId,
      source_module: 'commerce_sales',
      external_reference: externalReference,
      notes: [
        `Pedido: ${order.id}`,
        `Pagamento interno: ${payment.id}`,
        providerPaymentId ? `Pagamento Mercado Pago: ${providerPaymentId}` : 'Pagamento Mercado Pago sem id local; deduplicado por pedido',
        'Origem: backfill_commerce_sales_finance',
      ].join(' | '),
      updated_at: now,
    })
  }

  return rows
}

async function main() {
  console.log(APPLY ? 'Modo: APLICAR backfill commerce -> financeiro' : 'Modo: DRY RUN, nada sera inserido')

  const rows = await buildBackfillRows()
  console.log(JSON.stringify({
    finance_entries_to_create: rows.length,
    total_amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    external_references: rows.map((row) => row.external_reference),
  }, null, 2))

  if (!APPLY) {
    console.log('\nRode com --apply para inserir as vendas reais no financeiro.')
    return
  }

  if (!rows.length) {
    console.log('Nenhuma venda nova para inserir.')
    return
  }

  const { data, error } = await supabase
    .from('finance_entries')
    .insert(rows)
    .select('id,external_reference,amount')

  if (error) throw new Error(`finance_entries insert: ${error.message}`)

  console.log(JSON.stringify({ created: data || [] }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
