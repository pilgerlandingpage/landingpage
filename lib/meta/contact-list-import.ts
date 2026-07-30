import { inflateRawSync } from 'zlib'
import { normalizeMetaWhatsAppPhone } from '@/lib/meta/whatsapp-cloud'

export interface ImportedMetaContact {
  phone_e164: string
  name: string | null
  email: string | null
  city: string | null
  tags: string[]
  template_variables: Record<string, string>
  metadata: Record<string, unknown>
}

export interface MetaContactListImportResult {
  contacts: ImportedMetaContact[]
  sourceSheetName: string | null
  totalRows: number
  validContacts: number
  duplicateContacts: number
  invalidContacts: number
}

function cleanText(value: unknown, maxLength = 5000) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeHeader(value: string) {
  return cleanText(value, 160)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9{}]+/g, '')
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (!quoted && char === delimiter) count += 1
  }

  return count
}

function detectDelimiter(line: string) {
  return ['\t', ';', '|', ',']
    .map(delimiter => ({ delimiter, count: countDelimiter(line, delimiter) }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ','
}

function splitDelimitedRow(line: string) {
  const delimiter = detectDelimiter(line)
  const columns: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (!quoted && char === delimiter) {
      columns.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  columns.push(current.trim())
  return columns
}

function parseDelimitedBuffer(buffer: Buffer) {
  return buffer
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => splitDelimitedRow(line))
    .filter(row => row.some(column => column.trim()))
}

function findHeaderIndex(headers: string[], candidates: string[]) {
  const normalizedCandidates = new Set(candidates.map(normalizeHeader))
  return headers.findIndex(header => normalizedCandidates.has(header))
}

function rowLooksLikeHeader(row: string[]) {
  const headers = row.map(normalizeHeader)
  return headers.some(header =>
    ['telefone', 'phone', 'whatsapp', 'celular', 'numero', 'numerodetelefone', 'nome', 'name', 'lead', 'cliente', 'contato'].includes(header)
    || /^var\d+$/.test(header)
    || /^variavel\d+$/.test(header)
    || /^\{\{\d+\}\}$/.test(header)
  )
}

function guessPhoneColumn(rows: string[][]) {
  const columnScores = new Map<number, number>()

  rows.slice(0, 30).forEach(row => {
    row.forEach((cell, index) => {
      const digits = normalizeMetaWhatsAppPhone(cell)
      if (digits.length >= 10) columnScores.set(index, (columnScores.get(index) || 0) + 1)
    })
  })

  return Array.from(columnScores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1
}

function extractVariableKey(header: string) {
  const normalized = normalizeHeader(header)
  const match = normalized.match(/^(?:var|variavel|valor)?(\d+)$/) || normalized.match(/^\{\{(\d+)\}\}$/)
  return match?.[1] || ''
}

function splitTags(value: string) {
  return value
    .split(/[;,|]/)
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 30)
}

function contactsFromRows(rows: string[][], source: { fileName: string; sheetName: string | null }): MetaContactListImportResult {
  const normalizedRows = rows.filter(row => row.some(column => cleanText(column)))
  const hasHeader = normalizedRows.length > 0 && rowLooksLikeHeader(normalizedRows[0])
  const rawHeaders = hasHeader
    ? normalizedRows[0].map((header, index) => cleanText(header) || `coluna_${index + 1}`)
    : []
  const headers = rawHeaders.map(normalizeHeader)
  const dataRows = hasHeader ? normalizedRows.slice(1) : normalizedRows

  const phoneIndex = hasHeader
    ? findHeaderIndex(headers, ['telefone', 'phone', 'whatsapp', 'celular', 'numero', 'numero de telefone', 'numero do telefone'])
    : guessPhoneColumn(dataRows)
  const nameIndex = hasHeader
    ? findHeaderIndex(headers, ['nome', 'name', 'lead', 'cliente', 'contato'])
    : (phoneIndex === 0 ? 1 : 0)
  const emailIndex = hasHeader ? findHeaderIndex(headers, ['email', 'e-mail', 'mail']) : -1
  const cityIndex = hasHeader ? findHeaderIndex(headers, ['cidade', 'city', 'municipio']) : -1
  const tagsIndex = hasHeader ? findHeaderIndex(headers, ['tags', 'tag', 'etiquetas', 'marcadores']) : -1

  if (phoneIndex < 0) {
    throw new Error('Nao encontrei uma coluna de telefone na lista.')
  }

  const contacts: ImportedMetaContact[] = []
  const seenPhones = new Set<string>()
  let duplicateContacts = 0
  let invalidContacts = 0

  dataRows.forEach((row, index) => {
    const phone = normalizeMetaWhatsAppPhone(row[phoneIndex])
    if (phone.length < 10) {
      invalidContacts += 1
      return
    }
    if (seenPhones.has(phone)) {
      duplicateContacts += 1
      return
    }
    seenPhones.add(phone)

    const name = nameIndex >= 0 && nameIndex !== phoneIndex ? cleanText(row[nameIndex], 160) : ''
    const email = emailIndex >= 0 ? cleanText(row[emailIndex], 180) : ''
    const city = cityIndex >= 0 ? cleanText(row[cityIndex], 120) : ''
    const tags = tagsIndex >= 0 ? splitTags(cleanText(row[tagsIndex], 1000)) : []
    const templateVariables: Record<string, string> = {}
    const originalColumns: Record<string, string> = {}

    rawHeaders.forEach((header, columnIndex) => {
      const value = cleanText(row[columnIndex], 2000)
      if (!value) return
      originalColumns[header] = value

      const variableKey = extractVariableKey(header)
      if (variableKey) templateVariables[variableKey] = value
    })

    if (name && !templateVariables['1']) templateVariables['1'] = name

    contacts.push({
      phone_e164: phone,
      name: name || null,
      email: email || null,
      city: city || null,
      tags,
      template_variables: templateVariables,
      metadata: {
        source_file_name: source.fileName,
        source_sheet_name: source.sheetName,
        source_row: hasHeader ? index + 2 : index + 1,
        original_columns: originalColumns,
      },
    })
  })

  return {
    contacts,
    sourceSheetName: source.sheetName,
    totalRows: dataRows.length,
    validContacts: contacts.length,
    duplicateContacts,
    invalidContacts,
  }
}

function readZipEntries(buffer: Buffer) {
  const entries = new Map<string, Buffer>()
  const endOfCentralDirectorySignature = 0x06054b50
  let eocdOffset = -1
  const searchStart = Math.max(0, buffer.length - 66000)

  for (let offset = buffer.length - 22; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endOfCentralDirectorySignature) {
      eocdOffset = offset
      break
    }
  }

  if (eocdOffset < 0) throw new Error('Arquivo XLSX invalido.')

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10)
  let centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16)

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (buffer.readUInt32LE(centralDirectoryOffset) !== 0x02014b50) break

    const compressionMethod = buffer.readUInt16LE(centralDirectoryOffset + 10)
    const compressedSize = buffer.readUInt32LE(centralDirectoryOffset + 20)
    const fileNameLength = buffer.readUInt16LE(centralDirectoryOffset + 28)
    const extraLength = buffer.readUInt16LE(centralDirectoryOffset + 30)
    const commentLength = buffer.readUInt16LE(centralDirectoryOffset + 32)
    const localHeaderOffset = buffer.readUInt32LE(centralDirectoryOffset + 42)
    const fileName = buffer
      .subarray(centralDirectoryOffset + 46, centralDirectoryOffset + 46 + fileNameLength)
      .toString('utf8')
      .replace(/\\/g, '/')

    if (buffer.readUInt32LE(localHeaderOffset) === 0x04034b50) {
      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength
      const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize)

      if (compressionMethod === 0) {
        entries.set(fileName, Buffer.from(compressedData))
      } else if (compressionMethod === 8) {
        entries.set(fileName, inflateRawSync(compressedData))
      }
    }

    centralDirectoryOffset += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
}

function xmlAttr(attrs: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = attrs.match(new RegExp(`${escaped}="([^"]*)"`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

function parseSharedStrings(xml: string) {
  return Array.from(xml.matchAll(/<si\b[\s\S]*?<\/si>/g)).map(match => {
    const item = match[0]
    const textParts = Array.from(item.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map(textMatch => decodeXml(textMatch[1]))
    if (textParts.length) return textParts.join('')
    return decodeXml(item.replace(/<[^>]+>/g, ''))
  })
}

function columnIndexFromCellRef(ref: string) {
  const letters = cleanText(ref).match(/[A-Z]+/i)?.[0]?.toUpperCase() || ''
  if (!letters) return 0

  let index = 0
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64)
  }
  return Math.max(0, index - 1)
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows: string[][] = []

  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = []
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1]
      const body = cellMatch[2]
      const cellRef = xmlAttr(attrs, 'r')
      const cellIndex = columnIndexFromCellRef(cellRef)
      const type = xmlAttr(attrs, 't')
      const rawValue = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1] || ''
      const inlineValue = Array.from(body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
        .map(match => decodeXml(match[1]))
        .join('')

      let value = ''
      if (type === 's') {
        value = sharedStrings[Number(rawValue)] || ''
      } else if (type === 'inlineStr') {
        value = inlineValue
      } else {
        value = decodeXml(rawValue || inlineValue)
      }
      cells[cellIndex] = cleanText(value, 5000)
    }
    rows.push(cells.map(value => value || ''))
  }

  return rows
}

function resolveSheetPath(target: string) {
  const selected = target.replace(/\\/g, '/').replace(/^\/+/, '')
  return selected.startsWith('xl/') ? selected : `xl/${selected}`
}

function parseXlsxBuffer(buffer: Buffer, fileName: string) {
  const entries = readZipEntries(buffer)
  const workbookXml = entries.get('xl/workbook.xml')?.toString('utf8') || ''
  const relationshipsXml = entries.get('xl/_rels/workbook.xml.rels')?.toString('utf8') || ''
  const sharedStringsXml = entries.get('xl/sharedStrings.xml')?.toString('utf8') || ''

  if (!workbookXml) throw new Error('Workbook XLSX sem definicao de abas.')

  const relationships = new Map<string, string>()
  for (const relationshipMatch of relationshipsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = relationshipMatch[1]
    relationships.set(xmlAttr(attrs, 'Id'), xmlAttr(attrs, 'Target'))
  }

  const sheets = Array.from(workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)).map(sheetMatch => {
    const attrs = sheetMatch[1]
    const name = xmlAttr(attrs, 'name')
    const relationshipId = xmlAttr(attrs, 'r:id') || xmlAttr(attrs, 'id')
    return {
      name,
      relationshipId,
      path: resolveSheetPath(relationships.get(relationshipId) || ''),
    }
  }).filter(sheet => sheet.path && entries.has(sheet.path))

  if (!sheets.length) throw new Error('Nao encontrei abas legiveis no XLSX.')

  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : []
  const preferredSheets = [
    ...sheets.filter(sheet => /manychat|import|contato|lead/i.test(sheet.name)),
    ...sheets,
  ]

  for (const sheet of preferredSheets) {
    const sheetXml = entries.get(sheet.path)?.toString('utf8') || ''
    const rows = parseWorksheetRows(sheetXml, sharedStrings)
    try {
      return contactsFromRows(rows, { fileName, sheetName: sheet.name || null })
    } catch {
      continue
    }
  }

  throw new Error('Nao encontrei uma aba com coluna de telefone no XLSX.')
}

export function parseMetaContactListImport(input: {
  fileName: string
  contentType?: string
  buffer: Buffer
}): MetaContactListImportResult {
  const fileName = cleanText(input.fileName, 255)
  const lowerName = fileName.toLowerCase()

  if (lowerName.endsWith('.xlsx') || input.contentType?.includes('spreadsheetml')) {
    return parseXlsxBuffer(input.buffer, fileName)
  }

  if (lowerName.endsWith('.xls')) {
    throw new Error('Formato .xls antigo nao e suportado. Salve como .xlsx ou CSV.')
  }

  return contactsFromRows(parseDelimitedBuffer(input.buffer), { fileName, sheetName: null })
}
