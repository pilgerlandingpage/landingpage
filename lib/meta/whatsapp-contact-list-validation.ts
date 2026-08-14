import { checkWhatsAppNumbers, type ConnectyHubWhatsAppNumberCheck } from '@/lib/connectyhub/whatsapp'
import { normalizeMetaWhatsAppPhone } from '@/lib/meta/whatsapp-cloud'
import { createAdminClient } from '@/lib/supabase/server'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export type MetaContactWhatsAppCheckStatus = 'unchecked' | 'valid' | 'invalid' | 'unknown' | 'error'
export type MetaContactListValidationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stale'

type ContactListRow = {
  id: string
  name?: string | null
  total_contacts?: number | null
  valid_contacts?: number | null
  metadata?: unknown
}

type ContactRow = {
  id: string
  phone_e164: string | null
  metadata?: unknown
}

export interface MetaContactListValidationSummary {
  total_contacts: number
  checked_contacts: number
  valid_contacts: number
  invalid_contacts: number
  unknown_contacts: number
  error_contacts: number
  unchecked_contacts: number
  remaining_contacts: number
}

export interface StartMetaWhatsAppContactListValidationInput {
  listId: string
  runId: string
  force?: boolean
  batchSize?: number
  instanceToken?: string | null
}

export interface ProcessMetaWhatsAppContactListValidationBatchInput extends StartMetaWhatsAppContactListValidationInput {
  batchNumber?: number
}

function asMetadata(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function cleanText(value: unknown, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength)
}

function asPositiveInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Math.floor(Number(value || 0))
  if (!Number.isFinite(parsed) || parsed < min) return fallback
  return Math.min(parsed, max)
}

function normalizeCheckStatus(value: unknown): MetaContactWhatsAppCheckStatus {
  const selected = cleanText(value, 40).toLowerCase()
  if (selected === 'valid' || selected === 'invalid' || selected === 'unknown' || selected === 'error') return selected
  return 'unchecked'
}

function contactWhatsAppCheck(contact: ContactRow) {
  return asMetadata(asMetadata(contact.metadata).whatsapp_check)
}

function contactWhatsAppCheckStatus(contact: ContactRow) {
  return normalizeCheckStatus(contactWhatsAppCheck(contact).status)
}

function shouldValidateContact(contact: ContactRow, input: { force?: boolean; runId?: string }) {
  const check = contactWhatsAppCheck(contact)
  const status = normalizeCheckStatus(check.status)
  const checkedRunId = cleanText(check.run_id, 80)

  if (input.runId && checkedRunId === input.runId) return false

  if (input.force) {
    return true
  }

  if (status === 'unchecked') return true
  if (status === 'unknown' || status === 'error') return true
  return false
}

function resultIndexKeys(result: ConnectyHubWhatsAppNumberCheck, fallbackPhone?: string | null) {
  return Array.from(new Set([
    normalizeMetaWhatsAppPhone(result.query),
    normalizeMetaWhatsAppPhone(result.jid),
    normalizeMetaWhatsAppPhone(result.lid),
    normalizeMetaWhatsAppPhone(fallbackPhone),
  ].filter(Boolean)))
}

function statusFromCheckResult(result?: ConnectyHubWhatsAppNumberCheck | null): MetaContactWhatsAppCheckStatus {
  if (!result) return 'unknown'
  if (result.isInWhatsapp === true) return 'valid'
  if (result.isInWhatsapp === false) return 'invalid'
  return result.error ? 'error' : 'unknown'
}

function buildContactCheckMetadata(input: {
  phone: string
  runId: string
  result?: ConnectyHubWhatsAppNumberCheck | null
}) {
  const result = input.result || null
  return {
    source: 'connectyhub',
    status: statusFromCheckResult(result),
    run_id: input.runId,
    checked_at: new Date().toISOString(),
    query: result?.query || input.phone,
    jid: result?.jid || null,
    lid: result?.lid || null,
    verified_name: result?.verifiedName || null,
    group_name: result?.groupName || null,
    error: result?.error || null,
  }
}

function summarizeValidation(
  contacts: ContactRow[],
  input: { force?: boolean; runId?: string } = {}
): MetaContactListValidationSummary {
  const summary: MetaContactListValidationSummary = {
    total_contacts: contacts.length,
    checked_contacts: 0,
    valid_contacts: 0,
    invalid_contacts: 0,
    unknown_contacts: 0,
    error_contacts: 0,
    unchecked_contacts: 0,
    remaining_contacts: 0,
  }

  for (const contact of contacts) {
    const status = contactWhatsAppCheckStatus(contact)
    if (status === 'valid') summary.valid_contacts += 1
    if (status === 'invalid') summary.invalid_contacts += 1
    if (status === 'unknown') summary.unknown_contacts += 1
    if (status === 'error') summary.error_contacts += 1
    if (status === 'unchecked') summary.unchecked_contacts += 1
    if (status !== 'unchecked') summary.checked_contacts += 1
    if (shouldValidateContact(contact, input)) summary.remaining_contacts += 1
  }

  return summary
}

async function fetchContactList(supabase: SupabaseAdmin, listId: string) {
  const { data, error } = await supabase
    .from('meta_whatsapp_contact_lists')
    .select('id, name, total_contacts, valid_contacts, metadata')
    .eq('id', listId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Lista de contatos nao encontrada.')
  return data as ContactListRow
}

async function fetchAllContacts(supabase: SupabaseAdmin, listId: string) {
  const contacts: ContactRow[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('meta_whatsapp_contact_list_contacts')
      .select('id, phone_e164, metadata')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    const page = (data || []) as ContactRow[]
    contacts.push(...page)
    if (page.length < pageSize) break
  }

  return contacts
}

async function updateContactListValidationMetadata(
  supabase: SupabaseAdmin,
  list: ContactListRow,
  patch: Record<string, unknown>
) {
  const metadata = asMetadata(list.metadata)
  const previousValidation = asMetadata(metadata.whatsapp_validation)
  const nextMetadata = {
    ...metadata,
    whatsapp_validation: {
      ...previousValidation,
      ...patch,
    },
  }

  const { data, error } = await supabase
    .from('meta_whatsapp_contact_lists')
    .update({
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', list.id)
    .select('id, name, total_contacts, valid_contacts, metadata')
    .maybeSingle()

  if (error) throw error
  return (data || { ...list, metadata: nextMetadata }) as ContactListRow
}

export async function startMetaWhatsAppContactListValidation(
  input: StartMetaWhatsAppContactListValidationInput,
  supabase: SupabaseAdmin = createAdminClient()
) {
  const listId = cleanText(input.listId, 80)
  const runId = cleanText(input.runId, 80)
  if (!listId) throw new Error('Informe a lista para validar.')
  if (!runId) throw new Error('Run id da validacao obrigatorio.')

  const list = await fetchContactList(supabase, listId)
  const contacts = await fetchAllContacts(supabase, listId)
  const summary = summarizeValidation(contacts, { force: input.force, runId })
  const now = new Date().toISOString()

  return updateContactListValidationMetadata(supabase, list, {
    ...summary,
    source: 'connectyhub',
    status: summary.remaining_contacts > 0 ? 'queued' : 'completed',
    run_id: runId,
    force: Boolean(input.force),
    batch_size: asPositiveInteger(input.batchSize, 100, 10, 250),
    started_at: now,
    queued_at: now,
    completed_at: summary.remaining_contacts > 0 ? null : now,
    last_error: null,
    instance_token_hint: input.instanceToken ? 'custom' : 'default',
  })
}

export async function processMetaWhatsAppContactListValidationBatch(
  input: ProcessMetaWhatsAppContactListValidationBatchInput,
  supabase: SupabaseAdmin = createAdminClient()
) {
  const listId = cleanText(input.listId, 80)
  const runId = cleanText(input.runId, 80)
  const batchNumber = asPositiveInteger(input.batchNumber, 1, 1, 100000)
  const batchSize = asPositiveInteger(input.batchSize, 100, 10, 250)
  if (!listId) throw new Error('Informe a lista para validar.')
  if (!runId) throw new Error('Run id da validacao obrigatorio.')

  const list = await fetchContactList(supabase, listId)
  const currentValidation = asMetadata(asMetadata(list.metadata).whatsapp_validation)
  const currentRunId = cleanText(currentValidation.run_id, 80)
  if (currentRunId && currentRunId !== runId) {
    return {
      status: 'stale' as MetaContactListValidationStatus,
      hasMore: false,
      listId,
      runId,
      checkedThisBatch: 0,
      summary: null,
    }
  }

  await updateContactListValidationMetadata(supabase, list, {
    status: 'running',
    run_id: runId,
    force: Boolean(input.force),
    batch_size: batchSize,
    current_batch: batchNumber,
    last_batch_started_at: new Date().toISOString(),
    last_error: null,
  })

  const contacts = await fetchAllContacts(supabase, listId)
  const pending = contacts
    .filter(contact => shouldValidateContact(contact, { force: input.force, runId }))
    .slice(0, batchSize)

  if (!pending.length) {
    const summary = summarizeValidation(contacts, { force: input.force, runId })
    const completedList = await updateContactListValidationMetadata(supabase, list, {
      ...summary,
      status: 'completed',
      run_id: runId,
      completed_at: new Date().toISOString(),
      last_error: null,
    })

    return {
      status: 'completed' as MetaContactListValidationStatus,
      hasMore: false,
      listId,
      runId,
      checkedThisBatch: 0,
      summary,
      list: completedList,
    }
  }

  try {
    const phones = pending.map(contact => cleanText(contact.phone_e164, 40)).filter(Boolean)
    const results = await checkWhatsAppNumbers(phones, input.instanceToken || undefined)
    const resultsByPhone = new Map<string, ConnectyHubWhatsAppNumberCheck>()

    results.forEach((result, index) => {
      resultIndexKeys(result, phones[index]).forEach(key => {
        if (!resultsByPhone.has(key)) resultsByPhone.set(key, result)
      })
    })

    const now = new Date().toISOString()
    const updatedMetadataByContact = new Map<string, Record<string, unknown>>()
    const updates = pending.map(contact => {
      const phone = normalizeMetaWhatsAppPhone(contact.phone_e164)
      const result = resultsByPhone.get(phone) || null
      const metadata = asMetadata(contact.metadata)
      const nextMetadata = {
        ...metadata,
        whatsapp_check: buildContactCheckMetadata({ phone, runId, result }),
      }
      updatedMetadataByContact.set(contact.id, nextMetadata)

      return supabase
        .from('meta_whatsapp_contact_list_contacts')
        .update({
          metadata: nextMetadata,
          updated_at: now,
        })
        .eq('id', contact.id)
    })

    const updateResults = await Promise.all(updates)
    const updateError = updateResults.find(result => result.error)?.error
    if (updateError) throw updateError

    const updatedContacts = contacts.map(contact => (
      updatedMetadataByContact.has(contact.id)
        ? { ...contact, metadata: updatedMetadataByContact.get(contact.id) }
        : contact
    ))
    const summary = summarizeValidation(updatedContacts, { force: input.force, runId })
    const hasMore = summary.remaining_contacts > 0
    const updatedList = await updateContactListValidationMetadata(supabase, list, {
      ...summary,
      source: 'connectyhub',
      status: hasMore ? 'running' : 'completed',
      run_id: runId,
      current_batch: batchNumber,
      last_batch_finished_at: now,
      completed_at: hasMore ? null : now,
      last_error: null,
    })

    return {
      status: hasMore ? 'running' as MetaContactListValidationStatus : 'completed' as MetaContactListValidationStatus,
      hasMore,
      listId,
      runId,
      checkedThisBatch: pending.length,
      summary,
      list: updatedList,
    }
  } catch (error) {
    await updateContactListValidationMetadata(supabase, list, {
      status: 'failed',
      run_id: runId,
      current_batch: batchNumber,
      failed_at: new Date().toISOString(),
      last_error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
