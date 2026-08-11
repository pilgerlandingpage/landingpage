type SupabaseAdminLike = {
  from: (table: string) => any
}

type SyncCommerceSaleParams = {
  supabase: SupabaseAdminLike
  order: Record<string, any>
  payment: Record<string, any> | null
  customer?: Record<string, any> | null
  items?: Record<string, any>[]
  source?: string
}

type DateField = 'entry_date' | 'date' | 'occurred_at' | 'created_at'

export type SyncCommerceSaleResult =
  | { status: 'created'; entry_id: string; external_reference: string }
  | { status: 'exists'; entry_id: string; external_reference: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: string }

function text(value: unknown, fallback = '') {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'bigint') return value.toString()
  return fallback
}

function centsToAmount(value: unknown) {
  const cents = Number(value || 0)
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return Number((cents / 100).toFixed(2))
}

function dateOnly(value: unknown) {
  const raw = text(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = raw ? new Date(raw) : new Date()
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

function partyTypeFromCustomer(customer?: Record<string, any> | null) {
  const documentType = text(customer?.document_type).toLowerCase()
  const document = text(customer?.document).replace(/\D/g, '')
  if (documentType === 'cnpj' || document.length === 14) return 'pessoa_juridica'
  if (documentType === 'cpf' || document.length === 11) return 'pessoa_fisica'
  return null
}

function productLabel(items?: Record<string, any>[]) {
  const labels = (items || [])
    .map((item) => text(item.title_snapshot))
    .filter(Boolean)

  if (labels.length === 0) return 'Venda online'
  if (labels.length === 1) return labels[0]
  return `${labels[0]} + ${labels.length - 1} item(ns)`
}

async function columnExists(admin: SupabaseAdminLike, tableName: string, columnName: string): Promise<boolean> {
  const { error } = await admin.from(tableName).select(columnName).limit(1)
  return !error
}

async function resolveFinanceEntriesDateField(admin: SupabaseAdminLike): Promise<DateField | null> {
  const [hasEntryDate, hasDate, hasOccurredAt, hasCreatedAt] = await Promise.all([
    columnExists(admin, 'finance_entries', 'entry_date'),
    columnExists(admin, 'finance_entries', 'date'),
    columnExists(admin, 'finance_entries', 'occurred_at'),
    columnExists(admin, 'finance_entries', 'created_at'),
  ])

  if (hasEntryDate) return 'entry_date'
  if (hasDate) return 'date'
  if (hasOccurredAt) return 'occurred_at'
  if (hasCreatedAt) return 'created_at'
  return null
}

async function findDefaultEntityId(admin: SupabaseAdminLike) {
  const hasEntityTable = await columnExists(admin, 'finance_entities', 'id')
  if (!hasEntityTable) return null

  const { data } = await admin
    .from('finance_entities')
    .select('id')
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle()

  return text(data?.id) || null
}

async function findDigitalCostCenterId(admin: SupabaseAdminLike) {
  const hasCostCenterTable = await columnExists(admin, 'finance_cost_centers', 'id')
  if (!hasCostCenterTable) return null

  const preferredNames = ['Produtos Digitais', 'Comercial']
  for (const name of preferredNames) {
    const { data } = await admin
      .from('finance_cost_centers')
      .select('id')
      .eq('name', name)
      .maybeSingle()

    if (data?.id) return text(data.id)
  }

  return null
}

export async function syncApprovedCommerceSaleToFinance(
  params: SyncCommerceSaleParams,
): Promise<SyncCommerceSaleResult> {
  const { supabase, order, payment, customer, items } = params

  try {
    if (!order?.id) return { status: 'skipped', reason: 'missing_order' }
    if (!payment?.id) return { status: 'skipped', reason: 'missing_payment' }

    const paymentProvider = text(payment.provider || order.payment_provider).toLowerCase()
    if (paymentProvider !== 'mercado_pago') return { status: 'skipped', reason: 'non_mercado_pago_payment' }

    if (text(payment.status).toLowerCase() !== 'approved') {
      return { status: 'skipped', reason: 'payment_not_approved' }
    }

    const amount = centsToAmount(payment.amount_cents || order.total_cents)
    if (amount <= 0) return { status: 'skipped', reason: 'invalid_amount' }

    const dateField = await resolveFinanceEntriesDateField(supabase)
    if (!dateField) return { status: 'error', reason: 'finance_entries_date_field_missing' }

    const [hasSourceModule, hasExternalReference] = await Promise.all([
      columnExists(supabase, 'finance_entries', 'source_module'),
      columnExists(supabase, 'finance_entries', 'external_reference'),
    ])

    if (!hasSourceModule || !hasExternalReference) {
      return { status: 'error', reason: 'finance_entries_source_tracking_missing' }
    }

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

    if (existingError) throw existingError
    if (existing?.id) {
      return { status: 'exists', entry_id: existing.id, external_reference: externalReference }
    }

    const [
      hasOccurredAt,
      hasCategory,
      hasSubcategory,
      hasPaymentMethod,
      hasPaymentStatus,
      hasCounterpartyName,
      hasCounterpartyType,
      hasReferenceCompany,
      hasDueDate,
      hasCompetenceDate,
      hasCostCenterId,
      hasEntityId,
      hasNotes,
      hasUpdatedAt,
    ] = await Promise.all([
      columnExists(supabase, 'finance_entries', 'occurred_at'),
      columnExists(supabase, 'finance_entries', 'category'),
      columnExists(supabase, 'finance_entries', 'subcategory'),
      columnExists(supabase, 'finance_entries', 'payment_method'),
      columnExists(supabase, 'finance_entries', 'payment_status'),
      columnExists(supabase, 'finance_entries', 'counterparty_name'),
      columnExists(supabase, 'finance_entries', 'counterparty_type'),
      columnExists(supabase, 'finance_entries', 'reference_company'),
      columnExists(supabase, 'finance_entries', 'due_date'),
      columnExists(supabase, 'finance_entries', 'competence_date'),
      columnExists(supabase, 'finance_entries', 'cost_center_id'),
      columnExists(supabase, 'finance_entries', 'entity_id'),
      columnExists(supabase, 'finance_entries', 'notes'),
      columnExists(supabase, 'finance_entries', 'updated_at'),
    ])

    const entryDate = dateOnly(payment.paid_at || order.paid_at || new Date().toISOString())
    const productName = productLabel(items)
    const orderNumber = text(order.order_number, text(order.id).slice(0, 8))
    const customerName = text(customer?.name) || text(customer?.email) || text(customer?.phone) || 'Cliente Mercado Pago'
    const counterpartyType = partyTypeFromCustomer(customer)
    const now = new Date().toISOString()

    const insertData: Record<string, any> = {
      description: `Venda Mercado Pago - ${productName} - ${orderNumber}`,
      entry_type: 'income',
      amount,
      source_module: 'commerce_sales',
      external_reference: externalReference,
    }

    if (dateField === 'created_at' || dateField === 'occurred_at') insertData[dateField] = `${entryDate}T12:00:00.000Z`
    else insertData[dateField] = entryDate
    if (hasOccurredAt && !insertData.occurred_at) insertData.occurred_at = `${entryDate}T12:00:00.000Z`

    if (hasCategory) insertData.category = 'Produtos Digitais'
    if (hasSubcategory) insertData.subcategory = 'Vendas Online'
    if (hasPaymentMethod) insertData.payment_method = 'Mercado Pago Pix'
    if (hasPaymentStatus) insertData.payment_status = 'paid'
    if (hasCounterpartyName) insertData.counterparty_name = customerName
    if (hasCounterpartyType) insertData.counterparty_type = counterpartyType
    if (hasReferenceCompany) insertData.reference_company = 'Commerce Mercado Pago'
    if (hasDueDate) insertData.due_date = entryDate
    if (hasCompetenceDate) insertData.competence_date = entryDate
    if (hasCostCenterId) insertData.cost_center_id = await findDigitalCostCenterId(supabase)
    if (hasEntityId) insertData.entity_id = await findDefaultEntityId(supabase)
    if (hasNotes) {
      insertData.notes = [
        `Pedido: ${order.id}`,
        `Pagamento interno: ${payment.id}`,
        providerPaymentId ? `Pagamento Mercado Pago: ${providerPaymentId}` : null,
        text(payment.status_detail) ? `Detalhe: ${text(payment.status_detail)}` : null,
        params.source ? `Origem: ${params.source}` : null,
      ].filter(Boolean).join(' | ')
    }
    if (hasUpdatedAt) insertData.updated_at = now

    const { data: created, error: createError } = await supabase
      .from('finance_entries')
      .insert(insertData)
      .select('id')
      .single()

    if (createError) throw createError
    return {
      status: 'created',
      entry_id: created.id,
      external_reference: externalReference,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.warn('[Commerce Finance Sync] failed:', reason)
    return { status: 'error', reason }
  }
}
