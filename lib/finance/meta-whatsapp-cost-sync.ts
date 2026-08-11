type SupabaseAdminLike = {
  from: (table: string) => any
}

export interface MetaWhatsAppFinanceSyncResult {
  synced: number
  skipped: number
  entries: Array<{
    month: string
    amount: number
    messages: number
    action: 'inserted' | 'updated' | 'skipped'
    entry_id?: string
  }>
  errors: string[]
}

function roundCurrency(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function currentMonthInSaoPaulo() {
  return todayInSaoPaulo().slice(0, 7)
}

function monthStart(month: string) {
  return `${month}-01`
}

function monthEnd(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10)
}

function cappedMonthEnd(month: string) {
  const today = todayInSaoPaulo()
  const end = monthEnd(month)
  return month === today.slice(0, 7) && today < end ? today : end
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-')
  return `${monthNumber}/${year}`
}

function paymentStatusForMonth(month: string) {
  return month === currentMonthInSaoPaulo() ? 'pending' : 'paid'
}

function externalReference(month: string) {
  return `meta_whatsapp_messages_monthly:${month}`
}

function rowMonth(row: Record<string, any>) {
  const raw = String(row.cost_recorded_at || row.delivered_at || row.read_at || row.sent_at || row.updated_at || row.created_at || '')
  return /^\d{4}-\d{2}/.test(raw) ? raw.slice(0, 7) : currentMonthInSaoPaulo()
}

async function getMarketingCostCenterId(admin: SupabaseAdminLike) {
  const { data, error } = await admin
    .from('finance_cost_centers')
    .select('id')
    .ilike('name', 'Marketing')
    .eq('is_active', true)
    .maybeSingle()

  if (error) return null
  return data?.id || null
}

async function findDefaultEntityId(admin: SupabaseAdminLike) {
  const { data, error } = await admin
    .from('finance_entities')
    .select('id')
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle()

  if (error) return null
  return data?.id || null
}

async function ensureFinanceCatalogs(admin: SupabaseAdminLike) {
  const now = new Date().toISOString()
  const { data: category, error: categoryError } = await admin
    .from('finance_categories')
    .upsert({
      name: 'Marketing',
      entry_type: 'expense',
      is_active: true,
      updated_at: now,
    }, { onConflict: 'name' })
    .select('id')
    .maybeSingle()

  if (categoryError) {
    console.warn('[Meta WhatsApp Finance Sync] failed to seed Marketing category:', categoryError.message)
  }

  if (category?.id) {
    const { error } = await admin
      .from('finance_subcategories')
      .upsert({
        category_id: category.id,
        name: 'Meta WhatsApp',
        is_active: true,
        updated_at: now,
      }, { onConflict: 'category_id,name' })

    if (error) {
      console.warn('[Meta WhatsApp Finance Sync] failed to seed Meta WhatsApp subcategory:', error.message)
    }
  }

  const { error: paymentMethodError } = await admin
    .from('finance_payment_methods')
    .upsert({
      name: 'Cartao',
      is_active: true,
      updated_at: now,
    }, { onConflict: 'name' })

  if (paymentMethodError) {
    console.warn('[Meta WhatsApp Finance Sync] failed to seed Cartao payment method:', paymentMethodError.message)
  }

  const { data: costCenter, error: costCenterError } = await admin
    .from('finance_cost_centers')
    .upsert({
      name: 'Marketing',
      code: 'MKT',
      is_active: true,
      updated_at: now,
    }, { onConflict: 'name' })
    .select('id')
    .maybeSingle()

  if (costCenterError) {
    console.warn('[Meta WhatsApp Finance Sync] failed to seed Marketing cost center:', costCenterError.message)
  }

  return {
    costCenterId: costCenter?.id || await getMarketingCostCenterId(admin),
    entityId: await findDefaultEntityId(admin),
  }
}

async function loadCostRows(
  admin: SupabaseAdminLike,
  options?: { campaignId?: string; month?: string },
): Promise<Record<string, any>[]> {
  let query = admin
    .from('meta_whatsapp_campaign_recipients')
    .select('campaign_id,cost_amount,cost_status,cost_recorded_at,delivered_at,read_at,sent_at,created_at,updated_at')
    .not('cost_amount', 'is', null)
    .gt('cost_amount', 0)

  if (options?.campaignId) query = query.eq('campaign_id', options.campaignId)

  const { data, error } = await query.limit(10000)
  if (error) throw error

  const rows = data || []
  if (!options?.month) return rows
  return rows.filter((row: Record<string, any>) => rowMonth(row) === options.month)
}

async function resolveMonthsToSync(
  admin: SupabaseAdminLike,
  options?: { campaignId?: string; month?: string },
): Promise<string[]> {
  if (options?.month) return [options.month]

  if (options?.campaignId) {
    const rows = await loadCostRows(admin, { campaignId: options.campaignId })
    return Array.from(new Set(rows.map((row: Record<string, any>) => rowMonth(row))))
  }

  const rows = await loadCostRows(admin)
  return Array.from(new Set(rows.map((row: Record<string, any>) => rowMonth(row))))
}

async function upsertMonthlyFinanceEntry(
  admin: SupabaseAdminLike,
  month: string,
  amount: number,
  messages: number,
  costCenterId: string | null,
  entityId: string | null,
) {
  const roundedAmount = roundCurrency(amount)
  if (roundedAmount <= 0 || messages <= 0) {
    return { month, amount: roundedAmount, messages, action: 'skipped' as const }
  }

  const entryDate = cappedMonthEnd(month)
  const paymentStatus = paymentStatusForMonth(month)
  const reference = externalReference(month)
  const payload: Record<string, any> = {
    description: `Disparos WhatsApp Meta - ${monthLabel(month)}`,
    entry_type: 'expense',
    amount: roundedAmount,
    category: 'Marketing',
    subcategory: 'Meta WhatsApp',
    entry_date: entryDate,
    occurred_at: `${entryDate}T12:00:00.000Z`,
    payment_method: 'Cartao',
    payment_status: paymentStatus,
    counterparty_name: 'Meta WhatsApp',
    counterparty_type: 'pessoa_juridica',
    reference_company: 'Meta',
    due_date: entryDate,
    competence_date: monthStart(month),
    cost_center_id: costCenterId,
    entity_id: entityId,
    notes: [
      `Sincronizado automaticamente dos disparos oficiais Meta WhatsApp.`,
      `Competencia ${monthLabel(month)}.`,
      `${messages} mensagem(ns) cobrada(s).`,
      `Status: ${paymentStatus === 'paid' ? 'pago' : 'pendente ate fechamento do cartao'}.`,
    ].join(' '),
    source_module: 'meta_whatsapp_messages_monthly',
    external_reference: reference,
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: existingError } = await admin
    .from('finance_entries')
    .select('id')
    .eq('source_module', 'meta_whatsapp_messages_monthly')
    .eq('external_reference', reference)
    .maybeSingle()

  if (existingError) throw existingError

  if (existing?.id) {
    const { error } = await admin
      .from('finance_entries')
      .update(payload)
      .eq('id', existing.id)

    if (error) throw error
    return { month, amount: roundedAmount, messages, action: 'updated' as const, entry_id: existing.id }
  }

  const { data: inserted, error } = await admin
    .from('finance_entries')
    .insert({
      ...payload,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw error
  return { month, amount: roundedAmount, messages, action: 'inserted' as const, entry_id: inserted?.id }
}

export async function syncMetaWhatsAppCostsToFinance(
  admin: SupabaseAdminLike,
  options?: { campaignId?: string; month?: string },
): Promise<MetaWhatsAppFinanceSyncResult> {
  const result: MetaWhatsAppFinanceSyncResult = {
    synced: 0,
    skipped: 0,
    entries: [],
    errors: [],
  }

  try {
    const months = await resolveMonthsToSync(admin, options)
    const monthly = new Map<string, { amount: number; messages: number }>()

    for (const month of months) {
      const rows = await loadCostRows(admin, { month })
      const item = monthly.get(month) || { amount: 0, messages: 0 }

      for (const row of rows) {
        item.amount += Number(row.cost_amount || 0)
        item.messages += 1
      }

      monthly.set(month, item)
    }

    if (monthly.size === 0) {
      result.skipped += 1
      return result
    }

    const { costCenterId, entityId } = await ensureFinanceCatalogs(admin)

    for (const [month, item] of monthly.entries()) {
      try {
        const entry = await upsertMonthlyFinanceEntry(
          admin,
          month,
          item.amount,
          item.messages,
          costCenterId,
          entityId,
        )
        result.entries.push(entry)
        if (entry.action === 'skipped') result.skipped += 1
        else result.synced += 1
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error))
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
  }

  return result
}
