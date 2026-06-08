import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

async function getCurrentAdminUser() {
    const supabase = await createServerSupabase()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const admin = createAdminClient()
    const { data: adminUser, error: adminError } = await admin
        .from('admin_users')
        .select('id, is_master, is_active')
        .eq('auth_user_id', authData.user.id)
        .single()

    if (adminError || !adminUser) {
        return { error: NextResponse.json({ error: 'Usuario admin nao encontrado' }, { status: 403 }) }
    }
    if (!adminUser.is_active) {
        return { error: NextResponse.json({ error: 'Usuario desativado' }, { status: 403 }) }
    }
    if (adminUser.is_master) return { adminUser }

    const { data: userSectors } = await admin
        .from('admin_user_sectors')
        .select('sector_id')
        .eq('user_id', adminUser.id)

    const sectorIds = (userSectors || []).map((row: any) => row.sector_id)
    if (sectorIds.length === 0) {
        return { error: NextResponse.json({ error: 'Sem acesso' }, { status: 403 }) }
    }

    const { data: sectorPerms } = await admin
        .from('admin_sector_permissions')
        .select('admin_permissions(module_key)')
        .in('sector_id', sectorIds)

    const hasFinance = (sectorPerms || []).some((row: any) => row.admin_permissions?.module_key === 'finance')
    if (!hasFinance) {
        return { error: NextResponse.json({ error: 'Sem acesso ao modulo financeiro' }, { status: 403 }) }
    }
    return { adminUser }
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return { headers: [], rows: [] }

    const parseRow = (line: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false

        for (let i = 0; i < line.length; i++) {
            const char = line[i]
            const next = line[i + 1]

            if (char === '"' && inQuotes && next === '"') {
                current += '"'
                i++
            } else if (char === '"') {
                inQuotes = !inQuotes
            } else if ((char === ',' || char === ';') && !inQuotes) {
                result.push(current.trim())
                current = ''
            } else {
                current += char
            }
        }
        result.push(current.trim())
        return result
    }

    const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'))
    const rows: Record<string, string>[] = []

    for (let i = 1; i < lines.length; i++) {
        const values = parseRow(lines[i])
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = values[idx] || '' })
        rows.push(row)
    }

    return { headers, rows }
}

function parseAmount(raw: string): number | null {
    if (!raw) return null
    const cleaned = raw
        .replace(/R\$\s*/gi, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim()
    const n = Number(cleaned)
    return Number.isFinite(n) && n > 0 ? n : null
}

function parseDate(raw: string): string | null {
    if (!raw) return null
    const trimmed = raw.trim()

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (brMatch) {
        const [, d, m, y] = brMatch
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    return null
}

function normalizeEntryType(raw: string): 'income' | 'expense' | null {
    const v = raw.trim().toLowerCase()
    if (v === 'income' || v === 'receita' || v === 'entrada') return 'income'
    if (v === 'expense' || v === 'despesa' || v === 'saida' || v === 'saída') return 'expense'
    return null
}

async function columnExists(admin: any, col: string): Promise<boolean> {
    const { error } = await admin.from('finance_entries').select(col).limit(1)
    return !error
}

export async function GET() {
    const template = `description,entry_type,amount,entry_date,category,subcategory,counterparty_name,notes,entity_id
Aluguel escritório,despesa,4500.00,2026-06-01,Aluguel,,Proprietário XYZ,,
Comissão recebida,receita,15000.00,2026-06-05,Vendas,Imobiliária,,Venda imóvel Rua A,
`
    return new NextResponse(template, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="template-importacao-pilger.csv"',
        },
    })
}

export async function POST(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const contentType = request.headers.get('content-type') || ''
        let csvText = ''

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData()
            const file = formData.get('file')
            if (!file || typeof file === 'string') {
                return NextResponse.json({ success: false, error: 'Arquivo CSV obrigatorio' }, { status: 400 })
            }
            csvText = await (file as File).text()
        } else {
            const body = await request.json()
            csvText = String(body?.csv || '')
        }

        if (!csvText.trim()) {
            return NextResponse.json({ success: false, error: 'Arquivo vazio' }, { status: 400 })
        }

        const { rows } = parseCSV(csvText)
        if (rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Nenhuma linha de dados encontrada no CSV' }, { status: 400 })
        }
        if (rows.length > 500) {
            return NextResponse.json({ success: false, error: 'Maximo de 500 linhas por importacao' }, { status: 400 })
        }

        const admin = createAdminClient()
        const [hasCategory, hasSubcategory, hasPaymentStatus, hasCounterpartyName, hasNotes, hasEntityId, hasUpdatedAt, hasCreatedBy] = await Promise.all([
            columnExists(admin, 'category'),
            columnExists(admin, 'subcategory'),
            columnExists(admin, 'payment_status'),
            columnExists(admin, 'counterparty_name'),
            columnExists(admin, 'notes'),
            columnExists(admin, 'entity_id'),
            columnExists(admin, 'updated_at'),
            columnExists(admin, 'created_by'),
        ])

        const errors: { row: number; error: string }[] = []
        const toInsert: any[] = []

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const rowNum = i + 2

            const description = (row.description || row.descricao || row.descrição || '').trim()
            if (!description) { errors.push({ row: rowNum, error: 'Descrição obrigatória' }); continue }

            const entryTypeRaw = row.entry_type || row.tipo || row.type || ''
            const entryType = normalizeEntryType(entryTypeRaw)
            if (!entryType) { errors.push({ row: rowNum, error: `Tipo inválido: "${entryTypeRaw}" — use receita ou despesa` }); continue }

            const amountRaw = row.amount || row.valor || row.value || ''
            const amount = parseAmount(amountRaw)
            if (!amount) { errors.push({ row: rowNum, error: `Valor inválido: "${amountRaw}"` }); continue }

            const dateRaw = row.entry_date || row.data || row.date || ''
            const entryDate = parseDate(dateRaw)
            if (!entryDate) { errors.push({ row: rowNum, error: `Data inválida: "${dateRaw}" — use DD/MM/AAAA ou AAAA-MM-DD` }); continue }

            const record: any = {
                description,
                entry_type: entryType,
                amount,
                entry_date: entryDate,
            }

            if (hasCategory) record.category = (row.category || row.categoria || '').trim() || null
            if (hasSubcategory) record.subcategory = (row.subcategory || row.subcategoria || '').trim() || null
            if (hasPaymentStatus) record.payment_status = 'paid'
            if (hasCounterpartyName) record.counterparty_name = (row.counterparty_name || row.favorecido || '').trim() || null
            if (hasNotes) record.notes = (row.notes || row.observacoes || row.observações || '').trim() || null
            if (hasEntityId) record.entity_id = (row.entity_id || '').trim() || null
            if (hasUpdatedAt) record.updated_at = new Date().toISOString()
            if (hasCreatedBy) record.created_by = access.adminUser.id

            toInsert.push(record)
        }

        if (toInsert.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Nenhum registro válido para importar',
                errors,
            }, { status: 400 })
        }

        const BATCH = 50
        let imported = 0
        for (let i = 0; i < toInsert.length; i += BATCH) {
            const batch = toInsert.slice(i, i + BATCH)
            const { error } = await admin.from('finance_entries').insert(batch)
            if (error) throw error
            imported += batch.length
        }

        return NextResponse.json({
            success: true,
            imported,
            skipped: errors.length,
            errors,
            message: `${imported} lançamento(s) importado(s) com sucesso${errors.length > 0 ? `, ${errors.length} linha(s) ignorada(s)` : ''}`,
        }, { status: 201 })
    } catch (err: any) {
        console.error('[admin/finance/import POST]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao importar CSV' }, { status: 500 })
    }
}
