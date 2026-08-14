import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { parseMetaContactListImport } from '@/lib/meta/contact-list-import'
import { startMetaWhatsAppContactListValidation } from '@/lib/meta/whatsapp-contact-list-validation'

export const runtime = 'nodejs'

function cleanText(value: unknown, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength)
}

function fallbackListName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, 160)
}

type ContactRow = {
  id?: string
  list_id?: string
  phone_e164?: string | null
  name?: string | null
  email?: string | null
  city?: string | null
  tags?: unknown
  template_variables?: unknown
  metadata?: unknown
  created_at?: string | null
}

type ContactListUsageTemplate = {
  template_name: string
  template_language: string
  campaigns: number
  total_recipients: number
  total_queued: number
  total_sent: number
  total_delivered: number
  total_read: number
  total_failed: number
  total_skipped: number
  last_used_at: string | null
  last_campaign_id: string | null
  last_campaign_name: string | null
  last_status: string | null
}

type ContactListUsageSummary = {
  total_campaigns: number
  total_recipients: number
  last_used_at: string | null
  last_campaign_id: string | null
  last_campaign_name: string | null
  last_template_name: string | null
  last_template_language: string | null
  templates: ContactListUsageTemplate[]
}

type ContactListUsageCampaignRow = {
  id: string
  name?: string | null
  status?: string | null
  template_name?: string | null
  template_language?: string | null
  total_recipients?: number | null
  total_queued?: number | null
  total_sent?: number | null
  total_delivered?: number | null
  total_read?: number | null
  total_failed?: number | null
  total_skipped?: number | null
  created_at?: string | null
  metadata?: unknown
}

function normalizeSearchText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(item => cleanText(item, 120)).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value.split(/[;,|]+/).map(item => cleanText(item, 120)).filter(Boolean)
  }

  return []
}

function asVariableRecord(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asNumber(value: unknown) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number : 0
}

function emptyContactListUsageSummary(): ContactListUsageSummary {
  return {
    total_campaigns: 0,
    total_recipients: 0,
    last_used_at: null,
    last_campaign_id: null,
    last_campaign_name: null,
    last_template_name: null,
    last_template_language: null,
    templates: [],
  }
}

function contactListIdFromCampaign(campaign: ContactListUsageCampaignRow) {
  return cleanText(asVariableRecord(campaign.metadata).contact_list_id, 80)
}

function normalizeTemplateUsageKey(templateName?: string | null, templateLanguage?: string | null) {
  return `${cleanText(templateName, 120).toLowerCase()}::${cleanText(templateLanguage || 'pt_BR', 40).toLowerCase()}`
}

function campaignUsedAfter(a?: string | null, b?: string | null) {
  if (!a) return false
  if (!b) return true
  return new Date(a).getTime() > new Date(b).getTime()
}

async function fetchContactListUsageSummaries(
  supabase: ReturnType<typeof createAdminClient>,
  listIds: string[]
) {
  const ids = Array.from(new Set(listIds.map(id => cleanText(id, 80)).filter(Boolean)))
  const usageByListId = new Map<string, ContactListUsageSummary>()
  ids.forEach(id => usageByListId.set(id, emptyContactListUsageSummary()))
  if (!ids.length) return usageByListId

  const { data, error } = await supabase
    .from('meta_whatsapp_campaigns')
    .select('id, name, status, template_name, template_language, total_recipients, total_queued, total_sent, total_delivered, total_read, total_failed, total_skipped, created_at, metadata')
    .eq('audience_source', 'saved_contact_list')
    .in('metadata->>contact_list_id', ids)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) throw error

  const templateMaps = new Map<string, Map<string, ContactListUsageTemplate>>()
  ;((data || []) as ContactListUsageCampaignRow[]).forEach(campaign => {
    const metadata = asVariableRecord(campaign.metadata)
    if (metadata.deleted_from_panel_at) return

    const listId = contactListIdFromCampaign(campaign)
    if (!listId || !usageByListId.has(listId)) return

    const summary = usageByListId.get(listId) || emptyContactListUsageSummary()
    const campaignDate = cleanText(campaign.created_at, 40) || null
    const templateName = cleanText(campaign.template_name, 120) || 'Sem template'
    const templateLanguage = cleanText(campaign.template_language || 'pt_BR', 40)
    summary.total_campaigns += 1
    summary.total_recipients += asNumber(campaign.total_recipients)

    if (campaignUsedAfter(campaignDate, summary.last_used_at)) {
      summary.last_used_at = campaignDate
      summary.last_campaign_id = campaign.id
      summary.last_campaign_name = cleanText(campaign.name, 180) || null
      summary.last_template_name = templateName
      summary.last_template_language = templateLanguage
    }

    const byTemplate = templateMaps.get(listId) || new Map<string, ContactListUsageTemplate>()
    const templateKey = normalizeTemplateUsageKey(templateName, templateLanguage)
    const templateUsage = byTemplate.get(templateKey) || {
      template_name: templateName,
      template_language: templateLanguage,
      campaigns: 0,
      total_recipients: 0,
      total_queued: 0,
      total_sent: 0,
      total_delivered: 0,
      total_read: 0,
      total_failed: 0,
      total_skipped: 0,
      last_used_at: null,
      last_campaign_id: null,
      last_campaign_name: null,
      last_status: null,
    }

    templateUsage.campaigns += 1
    templateUsage.total_recipients += asNumber(campaign.total_recipients)
    templateUsage.total_queued += asNumber(campaign.total_queued)
    templateUsage.total_sent += asNumber(campaign.total_sent)
    templateUsage.total_delivered += asNumber(campaign.total_delivered)
    templateUsage.total_read += asNumber(campaign.total_read)
    templateUsage.total_failed += asNumber(campaign.total_failed)
    templateUsage.total_skipped += asNumber(campaign.total_skipped)

    if (campaignUsedAfter(campaignDate, templateUsage.last_used_at)) {
      templateUsage.last_used_at = campaignDate
      templateUsage.last_campaign_id = campaign.id
      templateUsage.last_campaign_name = cleanText(campaign.name, 180) || null
      templateUsage.last_status = cleanText(campaign.status, 40) || null
    }

    byTemplate.set(templateKey, templateUsage)
    templateMaps.set(listId, byTemplate)
    usageByListId.set(listId, summary)
  })

  usageByListId.forEach((summary, listId) => {
    const byTemplate = templateMaps.get(listId)
    summary.templates = Array.from(byTemplate?.values() || [])
      .sort((a, b) => new Date(b.last_used_at || 0).getTime() - new Date(a.last_used_at || 0).getTime())
  })

  return usageByListId
}

function contactWhatsAppCheckStatus(contact: ContactRow) {
  const metadata = asVariableRecord(contact.metadata)
  const check = asVariableRecord(metadata.whatsapp_check)
  const status = cleanText(check.status, 40).toLowerCase()
  if (status === 'valid' || status === 'invalid' || status === 'unknown' || status === 'error') return status
  return 'unchecked'
}

function contactSearchIndex(contact: ContactRow) {
  const variables = Object.values(asVariableRecord(contact.template_variables))
  return normalizeSearchText([
    contact.phone_e164,
    contact.name,
    contact.email,
    contact.city,
    ...asStringArray(contact.tags),
    ...variables,
  ].join(' '))
}

function contactMatchesFilters(contact: ContactRow, filters: { city: string; tag: string; search: string }) {
  const city = normalizeSearchText(filters.city)
  const tag = normalizeSearchText(filters.tag)
  const search = normalizeSearchText(filters.search)

  if (city && !normalizeSearchText(contact.city).includes(city)) return false
  if (tag && !asStringArray(contact.tags).some(item => normalizeSearchText(item) === tag)) return false
  if (search && !contactSearchIndex(contact).includes(search)) return false

  return true
}

function addCount(map: Map<string, number>, value: string) {
  const key = cleanText(value, 120)
  if (!key) return
  map.set(key, (map.get(key) || 0) + 1)
}

function toCountList(map: Map<string, number>, limit = 80) {
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit)
}

function buildContactListSegments(contacts: ContactRow[]) {
  const cities = new Map<string, number>()
  const tags = new Map<string, number>()
  let withName = 0
  let withCity = 0
  let withTags = 0
  let withVariables = 0
  let whatsappValid = 0
  let whatsappInvalid = 0
  let whatsappUnknown = 0
  let whatsappError = 0
  let whatsappUnchecked = 0

  contacts.forEach(contact => {
    if (cleanText(contact.name, 160)) withName += 1
    if (cleanText(contact.city, 160)) {
      withCity += 1
      addCount(cities, String(contact.city))
    }

    const contactTags = asStringArray(contact.tags)
    if (contactTags.length) withTags += 1
    contactTags.forEach(tag => addCount(tags, tag))

    if (Object.keys(asVariableRecord(contact.template_variables)).length) withVariables += 1

    const whatsappStatus = contactWhatsAppCheckStatus(contact)
    if (whatsappStatus === 'valid') whatsappValid += 1
    if (whatsappStatus === 'invalid') whatsappInvalid += 1
    if (whatsappStatus === 'unknown') whatsappUnknown += 1
    if (whatsappStatus === 'error') whatsappError += 1
    if (whatsappStatus === 'unchecked') whatsappUnchecked += 1
  })

  return {
    cities: toCountList(cities),
    tags: toCountList(tags),
    stats: {
      total: contacts.length,
      with_name: withName,
      with_city: withCity,
      with_tags: withTags,
      with_variables: withVariables,
      whatsapp_valid: whatsappValid,
      whatsapp_invalid: whatsappInvalid,
      whatsapp_unknown: whatsappUnknown,
      whatsapp_error: whatsappError,
      whatsapp_unchecked: whatsappUnchecked,
      whatsapp_checked: contacts.length - whatsappUnchecked,
    },
  }
}

async function fetchAllContactListContacts(supabase: ReturnType<typeof createAdminClient>, listId: string) {
  const contacts: ContactRow[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('meta_whatsapp_contact_list_contacts')
      .select('id, list_id, phone_e164, name, email, city, tags, template_variables, metadata, created_at')
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

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const listId = cleanText(request.nextUrl.searchParams.get('list_id'), 80)
    const filters = {
      city: cleanText(request.nextUrl.searchParams.get('city'), 120),
      tag: cleanText(request.nextUrl.searchParams.get('tag'), 120),
      search: cleanText(request.nextUrl.searchParams.get('search'), 160),
    }

    if (listId) {
      const { data: list, error: listError } = await supabase
        .from('meta_whatsapp_contact_lists')
        .select('*')
        .eq('id', listId)
        .maybeSingle()

      if (listError) throw listError
      if (!list) return NextResponse.json({ success: false, message: 'Lista nao encontrada.' }, { status: 404 })

      const allContacts = await fetchAllContactListContacts(supabase, listId)
      const filteredContacts = allContacts.filter(contact => contactMatchesFilters(contact, filters))
      const usageByListId = await fetchContactListUsageSummaries(supabase, [listId])

      return NextResponse.json({
        success: true,
        list: {
          ...list,
          usage: usageByListId.get(listId) || emptyContactListUsageSummary(),
        },
        contacts: filteredContacts,
        allContactsCount: allContacts.length,
        filteredContactsCount: filteredContacts.length,
        filters,
        segments: buildContactListSegments(allContacts),
      })
    }

    const { data: lists, error } = await supabase
      .from('meta_whatsapp_contact_lists')
      .select('*')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(200)

    if (error) throw error
    const activeLists = (lists || []) as Array<{ id: string } & Record<string, unknown>>
    const usageByListId = await fetchContactListUsageSummaries(supabase, activeLists.map(list => list.id))
    return NextResponse.json({
      success: true,
      lists: activeLists.map(list => ({
        ...list,
        usage: usageByListId.get(list.id) || emptyContactListUsageSummary(),
      })),
    })
  } catch (error) {
    console.error('[Meta Contact Lists GET]', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao carregar listas de contatos Meta',
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const contentType = request.headers.get('content-type') || ''

    if (!contentType.includes('multipart/form-data')) {
      const body = await request.json().catch(() => ({}))
      const action = cleanText(body.action, 40)
      const listId = cleanText(body.listId || body.list_id, 80)

      if (!listId) {
        return NextResponse.json({ success: false, message: 'Informe a lista.' }, { status: 400 })
      }

      if (action === 'archive' || action === 'delete') {
        const { error } = await supabase
          .from('meta_whatsapp_contact_lists')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', listId)

        if (error) throw error
        return NextResponse.json({ success: true, message: 'Lista arquivada.' })
      }

      if (action === 'validate_whatsapp') {
        const runId = crypto.randomUUID()
        const force = Boolean(body.force)
        const batchSize = Math.min(Math.max(Number(body.batchSize || body.batch_size || 100), 10), 250)
        const list = await startMetaWhatsAppContactListValidation({
          listId,
          runId,
          force,
          batchSize,
          instanceToken: cleanText(body.instanceToken || body.instance_token, 120) || null,
        }, supabase)

        const validation = asVariableRecord(asVariableRecord(list.metadata).whatsapp_validation)
        const remainingContacts = Number(validation.remaining_contacts || 0)
        if (remainingContacts > 0) {
          await inngest.send({
            name: 'meta-whatsapp/contact-list-validate',
            data: {
              list_id: listId,
              run_id: runId,
              batch_number: 1,
              batch_size: batchSize,
              force,
              instance_token: cleanText(body.instanceToken || body.instance_token, 120) || null,
              reason: 'admin_contact_list_validate_whatsapp',
            },
          })
        }

        return NextResponse.json({
          success: true,
          list,
          runId,
          remainingContacts,
          message: remainingContacts > 0
            ? `Validacao WhatsApp iniciada para ${remainingContacts} contato(s). Atualize a lista em alguns instantes para acompanhar.`
            : 'Lista ja esta validada para WhatsApp.',
        })
      }

      return NextResponse.json({ success: false, message: 'Acao invalida.' }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get('file')
    const rawName = cleanText(form.get('name'), 160)
    const description = cleanText(form.get('description'), 500)

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'Selecione um arquivo CSV, TXT ou XLSX.' }, { status: 400 })
    }

    const fileName = cleanText(file.name, 255)
    const listName = rawName || fallbackListName(fileName)
    if (!listName) {
      return NextResponse.json({ success: false, message: 'Nome da lista obrigatorio.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!buffer.byteLength) {
      return NextResponse.json({ success: false, message: 'Arquivo vazio.' }, { status: 400 })
    }

    const parsed = parseMetaContactListImport({
      fileName,
      contentType: file.type,
      buffer,
    })

    if (!parsed.validContacts) {
      return NextResponse.json({ success: false, message: 'Nenhum contato valido foi encontrado.' }, { status: 400 })
    }

    const { data: list, error: listError } = await supabase
      .from('meta_whatsapp_contact_lists')
      .insert({
        name: listName,
        description: description || null,
        source_file_name: fileName || null,
        source_sheet_name: parsed.sourceSheetName || null,
        total_contacts: parsed.totalRows,
        valid_contacts: parsed.validContacts,
        duplicate_contacts: parsed.duplicateContacts,
        invalid_contacts: parsed.invalidContacts,
        metadata: {
          imported_from: 'admin_meta_whatsapp_campaigns',
          content_type: file.type || null,
        },
      })
      .select('*')
      .single()

    if (listError) throw listError

    const rows = parsed.contacts.map(contact => ({
      list_id: list.id,
      phone_e164: contact.phone_e164,
      name: contact.name,
      email: contact.email,
      city: contact.city,
      tags: contact.tags,
      template_variables: contact.template_variables,
      metadata: contact.metadata,
    }))

    const chunkSize = 500
    for (let index = 0; index < rows.length; index += chunkSize) {
      const { error } = await supabase
        .from('meta_whatsapp_contact_list_contacts')
        .insert(rows.slice(index, index + chunkSize))
      if (error) {
        await supabase.from('meta_whatsapp_contact_lists').delete().eq('id', list.id)
        throw error
      }
    }

    return NextResponse.json({
      success: true,
      message: `Lista salva com ${parsed.validContacts} contato(s) valido(s).`,
      list,
      contacts: parsed.contacts.slice(0, 500),
      summary: {
        totalRows: parsed.totalRows,
        validContacts: parsed.validContacts,
        duplicateContacts: parsed.duplicateContacts,
        invalidContacts: parsed.invalidContacts,
      },
    })
  } catch (error) {
    console.error('[Meta Contact Lists POST]', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao importar lista de contatos Meta',
    }, { status: 500 })
  }
}
