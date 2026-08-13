import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parseMetaContactListImport } from '@/lib/meta/contact-list-import'

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

      return NextResponse.json({
        success: true,
        list,
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
    return NextResponse.json({ success: true, lists: lists || [] })
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
