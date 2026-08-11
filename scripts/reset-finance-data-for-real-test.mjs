import fs from 'node:fs/promises'
import path from 'node:path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })

const APPLY = process.argv.includes('--apply')
const BATCH_SIZE = 1000

const FINANCE_TABLES = [
  'finance_entries',
  'finance_payables',
  'finance_receivables',
  'finance_commissions',
  'finance_reconciliations',
  'finance_closing_periods',
  'finance_accounting_exports',
  'finance_audit_logs',
  'finance_migration_snapshots',
  'finance_alert_logs',
  'finance_commission_rules',
  'finance_bank_accounts',
  'finance_cost_centers',
  'finance_categories',
  'finance_subcategories',
  'finance_payment_methods',
  'finance_counterparties',
  'finance_entities',
]

const COMMERCE_TABLES = [
  'commerce_orders',
  'commerce_payments',
  'commerce_customers',
  'commerce_order_items',
]

const DELETE_PLAN = [
  { table: 'finance_reconciliations', mode: 'all' },
  { table: 'finance_commissions', mode: 'all' },
  { table: 'finance_payables', mode: 'all' },
  { table: 'finance_receivables', mode: 'all' },
  { table: 'finance_accounting_exports', mode: 'all' },
  { table: 'finance_closing_periods', mode: 'all' },
  { table: 'finance_alert_logs', mode: 'all' },
  { table: 'finance_migration_snapshots', mode: 'all' },
  { table: 'finance_entries', mode: 'except_commerce_sales' },
  { table: 'finance_commission_rules', mode: 'all' },
  { table: 'finance_counterparties', mode: 'all' },
  { table: 'finance_bank_accounts', mode: 'all' },
  { table: 'finance_subcategories', mode: 'all' },
  { table: 'finance_categories', mode: 'all' },
  { table: 'finance_payment_methods', mode: 'all' },
  { table: 'finance_cost_centers', mode: 'all' },
  { table: 'finance_audit_logs', mode: 'all' },
]

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

function timestampSlug() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z')
}

async function countRows(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (error) {
    return { table, count: null, error: error.message }
  }

  return { table, count: count ?? 0 }
}

async function readAllRows(table) {
  const rows = []
  let from = 0

  while (true) {
    const to = from + BATCH_SIZE - 1
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, to)

    if (error) {
      return { rows, error: error.message }
    }

    rows.push(...(data || []))

    if (!data || data.length < BATCH_SIZE) break
    from += BATCH_SIZE
  }

  return { rows }
}

async function createBackup() {
  const backup = {
    created_at: new Date().toISOString(),
    purpose: 'finance_reset_for_real_environment_test',
    preservation_policy: {
      commerce_tables: 'untouched',
      finance_entries: 'preserve source_module=commerce_sales',
      finance_entities: 'untouched',
      finance_catalogs: 'reset and reseed minimal ecommerce catalogs',
    },
    tables: {},
  }

  for (const table of FINANCE_TABLES) {
    const { rows, error } = await readAllRows(table)
    backup.tables[table] = {
      count: rows.length,
      rows,
      ...(error ? { error } : {}),
    }
  }

  const backupDir = path.join(process.cwd(), 'private', 'finance-backups')
  await fs.mkdir(backupDir, { recursive: true })

  const backupPath = path.join(backupDir, `finance-reset-${timestampSlug()}.json`)
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8')
  return backupPath
}

async function deleteAllRows(table) {
  const { count, error } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .not('id', 'is', null)

  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

async function deleteFinanceEntriesExceptCommerceSales() {
  const { count, error } = await supabase
    .from('finance_entries')
    .delete({ count: 'exact' })
    .or('source_module.is.null,source_module.neq.commerce_sales')

  if (error) throw new Error(`finance_entries: ${error.message}`)
  return count ?? 0
}

async function seedMinimalEcommerceCatalogs() {
  const { data: categoryRows, error: categoryError } = await supabase
    .from('finance_categories')
    .upsert(
      [{ name: 'Produtos Digitais', entry_type: 'income', is_active: true, updated_at: new Date().toISOString() }],
      { onConflict: 'name' },
    )
    .select('id')
    .limit(1)

  if (categoryError) throw new Error(`finance_categories seed: ${categoryError.message}`)

  const categoryId = categoryRows?.[0]?.id
  if (!categoryId) throw new Error('finance_categories seed: categoria Produtos Digitais sem id.')

  const { error: subcategoryError } = await supabase
    .from('finance_subcategories')
    .upsert(
      [{ category_id: categoryId, name: 'Vendas Online', is_active: true, updated_at: new Date().toISOString() }],
      { onConflict: 'category_id,name' },
    )

  if (subcategoryError) throw new Error(`finance_subcategories seed: ${subcategoryError.message}`)

  const { error: paymentMethodError } = await supabase
    .from('finance_payment_methods')
    .upsert(
      [{ name: 'Mercado Pago Pix', is_active: true, updated_at: new Date().toISOString() }],
      { onConflict: 'name' },
    )

  if (paymentMethodError) throw new Error(`finance_payment_methods seed: ${paymentMethodError.message}`)

  const { error: costCenterError } = await supabase
    .from('finance_cost_centers')
    .upsert(
      [{ name: 'Produtos Digitais', code: 'DIGITAL', is_active: true, updated_at: new Date().toISOString() }],
      { onConflict: 'name' },
    )

  if (costCenterError) throw new Error(`finance_cost_centers seed: ${costCenterError.message}`)

  const { count: defaultEntitiesCount, error: defaultEntityError } = await supabase
    .from('finance_entities')
    .select('*', { count: 'exact', head: true })
    .eq('is_default', true)

  if (defaultEntityError) throw new Error(`finance_entities check: ${defaultEntityError.message}`)

  if (!defaultEntitiesCount) {
    const { error: entityError } = await supabase
      .from('finance_entities')
      .insert({
        name: 'Guilherme Pilger',
        entity_type: 'pf',
        description: 'Entidade financeira padrao',
        is_default: true,
        is_active: true,
      })

    if (entityError) throw new Error(`finance_entities seed: ${entityError.message}`)
  }
}

async function financeEntrySources() {
  const { data, error } = await supabase
    .from('finance_entries')
    .select('source_module,entry_type,amount')
    .limit(1000)

  if (error) return [{ source: 'erro', error: error.message }]

  const sources = new Map()
  for (const row of data || []) {
    const source = row.source_module || '(sem origem)'
    const current = sources.get(source) || { count: 0, income: 0, expense: 0 }
    current.count += 1
    if (row.entry_type === 'income') current.income += Number(row.amount || 0)
    if (row.entry_type === 'expense') current.expense += Number(row.amount || 0)
    sources.set(source, current)
  }

  return [...sources.entries()]
    .map(([source, totals]) => ({ source, ...totals }))
    .sort((a, b) => b.count - a.count)
}

async function printCounts(title, tables) {
  console.log(`\n${title}`)
  for (const table of tables) {
    console.log(JSON.stringify(await countRows(table)))
  }
}

async function main() {
  console.log(APPLY ? 'Modo: APLICAR limpeza financeira' : 'Modo: DRY RUN, nada sera apagado')

  await printCounts('Contagens financeiras antes', FINANCE_TABLES)
  await printCounts('Contagens commerce preservadas', COMMERCE_TABLES)
  console.log('\nOrigens atuais de finance_entries')
  for (const source of await financeEntrySources()) console.log(JSON.stringify(source))

  if (!APPLY) {
    console.log('\nPlano de limpeza')
    for (const step of DELETE_PLAN) console.log(JSON.stringify(step))
    console.log('\nRode com --apply para fazer backup e aplicar a limpeza.')
    return
  }

  const backupPath = await createBackup()
  console.log(`\nBackup criado: ${backupPath}`)

  console.log('\nAplicando limpeza')
  for (const step of DELETE_PLAN) {
    const deleted = step.mode === 'except_commerce_sales'
      ? await deleteFinanceEntriesExceptCommerceSales()
      : await deleteAllRows(step.table)
    console.log(JSON.stringify({ table: step.table, mode: step.mode, deleted }))
  }

  await seedMinimalEcommerceCatalogs()
  console.log('\nCadastros minimos do e-commerce recriados.')

  await printCounts('Contagens financeiras depois', FINANCE_TABLES)
  await printCounts('Contagens commerce depois', COMMERCE_TABLES)
  console.log('\nOrigens finais de finance_entries')
  for (const source of await financeEntrySources()) console.log(JSON.stringify(source))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
