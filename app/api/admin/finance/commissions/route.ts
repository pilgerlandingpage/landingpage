import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import { ensureUnlockedDates, normalizeDateForLock } from '../_lib/period-lock'

type CommissionRuleCalcType = 'percentage' | 'fixed'
type CommissionRuleBasisType = 'sale_value' | 'net_revenue'
type CommissionStatus = 'calculated' | 'approved' | 'released' | 'paid' | 'contested' | 'reversed'
type BrokerSource = 'admin_user' | 'virtual_broker'
const SALE_REFERENCE_TYPES = new Set(['sale', 'venda', 'deal', 'negocio', 'contract', 'contrato'])

function toNullableText(value: any): string | null {
    const text = String(value || '').trim()
    return text || null
}

function toNullableNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return Number.isFinite(num) ? num : null
}

function toCommissionStatus(raw: any): CommissionStatus {
    const value = String(raw || '').trim().toLowerCase()
    if (value === 'approved') return 'approved'
    if (value === 'released') return 'released'
    if (value === 'paid') return 'paid'
    if (value === 'contested') return 'contested'
    if (value === 'reversed') return 'reversed'
    return 'calculated'
}

function toCalcType(raw: any): CommissionRuleCalcType {
    return String(raw || '').trim().toLowerCase() === 'fixed' ? 'fixed' : 'percentage'
}

function toBasisType(raw: any): CommissionRuleBasisType {
    return String(raw || '').trim().toLowerCase() === 'net_revenue' ? 'net_revenue' : 'sale_value'
}

function normalizeReferenceType(raw: any): string {
    return String(raw || '').trim().toLowerCase()
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function percentageToRatio(rawPercentage: number): number {
    if (!Number.isFinite(rawPercentage) || rawPercentage <= 0) return 0
    return rawPercentage > 1 ? rawPercentage / 100 : rawPercentage
}

type SplitMode = 'percentage' | 'amount'
type SplitParticipant = {
    broker_user_id: string | null
    broker_name: string | null
    broker_source: BrokerSource | null
    participant_type: string | null
    notes: string | null
    percentage: number | null
    amount: number | null
}

function parseSplitPayload(raw: any): { participants: SplitParticipant[]; mode: SplitMode | null } | { error: string } {
    if (raw === null || raw === undefined || raw === '') return { participants: [], mode: null }

    let source = raw
    if (typeof source === 'string') {
        try {
            source = JSON.parse(source)
        } catch {
            return { error: 'Split da regra invalido: JSON malformado.' }
        }
    }

    if (!Array.isArray(source)) {
        return { error: 'Split da regra invalido: use uma lista de participantes.' }
    }

    const participants: SplitParticipant[] = []
    for (let idx = 0; idx < source.length; idx += 1) {
        const item = source[idx]
        if (!item || typeof item !== 'object') {
            return { error: `Split da regra invalido no participante ${idx + 1}.` }
        }

        const brokerUserId = toNullableText(item.broker_user_id ?? item.user_id ?? item.admin_user_id)
        const brokerName = toNullableText(item.broker_name ?? item.name ?? item.label)
        const brokerSourceRaw = String(item.broker_source || '').trim().toLowerCase()
        const brokerSource: BrokerSource | null = brokerSourceRaw === 'virtual_broker'
            ? 'virtual_broker'
            : (brokerSourceRaw === 'admin_user' ? 'admin_user' : null)

        if (!brokerUserId && !brokerName) {
            return { error: `Split da regra: informe corretor no participante ${idx + 1}.` }
        }

        const percentage = toNullableNumber(item.share_percent ?? item.percentage ?? item.percent)
        const amount = toNullableNumber(item.share_amount ?? item.amount)
        participants.push({
            broker_user_id: brokerUserId,
            broker_name: brokerName,
            broker_source: brokerSource,
            participant_type: toNullableText(item.participant_type ?? item.role ?? item.type),
            notes: toNullableText(item.notes),
            percentage: Number.isFinite(percentage as number) && (percentage as number) > 0 ? Number(percentage) : null,
            amount: Number.isFinite(amount as number) && (amount as number) > 0 ? Number(amount) : null,
        })
    }

    if (participants.length === 0) return { participants: [], mode: null }

    const hasPercentage = participants.some(item => Number.isFinite(item.percentage as number) && (item.percentage as number) > 0)
    const hasAmount = participants.some(item => Number.isFinite(item.amount as number) && (item.amount as number) > 0)

    if (hasPercentage && hasAmount) {
        return { error: 'Split da regra invalido: nao misture percentual com valor fixo.' }
    }

    if (!hasPercentage && !hasAmount) {
        return { error: 'Split da regra invalido: informe percentual ou valor para cada participante.' }
    }

    if (hasPercentage && participants.some(item => !Number.isFinite(item.percentage as number) || (item.percentage as number) <= 0)) {
        return { error: 'Split da regra invalido: todos os participantes devem ter percentual > 0.' }
    }

    if (hasAmount && participants.some(item => !Number.isFinite(item.amount as number) || (item.amount as number) <= 0)) {
        return { error: 'Split da regra invalido: todos os participantes devem ter valor > 0.' }
    }

    return { participants, mode: hasPercentage ? 'percentage' : 'amount' }
}

function splitCommissionAmount(
    totalCommission: number,
    participants: SplitParticipant[],
    mode: SplitMode,
): number[] {
    const sourceValues = participants.map(item => mode === 'percentage' ? Number(item.percentage || 0) : Number(item.amount || 0))
    const sourceTotal = sourceValues.reduce((sum, value) => sum + value, 0)
    if (!Number.isFinite(sourceTotal) || sourceTotal <= 0) {
        return participants.map(() => 0)
    }

    const provisional = sourceValues.map(value => Number((totalCommission * (value / sourceTotal)).toFixed(2)))
    const sumProvisional = provisional.reduce((sum, value) => sum + value, 0)
    const diff = Number((totalCommission - sumProvisional).toFixed(2))
    if (Math.abs(diff) >= 0.01 && provisional.length > 0) {
        const lastIndex = provisional.length - 1
        provisional[lastIndex] = Number((provisional[lastIndex] + diff).toFixed(2))
    }

    return provisional.map(value => Number(Math.max(0, value).toFixed(2)))
}

async function columnExistsOnTable(admin: any, tableName: string, columnName: string): Promise<boolean> {
    const { error } = await admin.from(tableName).select(columnName).limit(1)
    return !error
}

async function resolveFinanceEntriesDateField(admin: any): Promise<'entry_date' | 'date' | 'occurred_at' | 'created_at' | null> {
    const [hasEntryDate, hasDate, hasOccurredAt, hasCreatedAt] = await Promise.all([
        columnExistsOnTable(admin, 'finance_entries', 'entry_date'),
        columnExistsOnTable(admin, 'finance_entries', 'date'),
        columnExistsOnTable(admin, 'finance_entries', 'occurred_at'),
        columnExistsOnTable(admin, 'finance_entries', 'created_at'),
    ])
    if (hasEntryDate) return 'entry_date'
    if (hasDate) return 'date'
    if (hasOccurredAt) return 'occurred_at'
    if (hasCreatedAt) return 'created_at'
    return null
}

async function validateClosedSaleReference(
    admin: any,
    sourceRefTypeRaw: any,
    sourceRefIdRaw: any,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const sourceRefType = normalizeReferenceType(sourceRefTypeRaw)
    if (!SALE_REFERENCE_TYPES.has(sourceRefType)) {
        return { ok: true }
    }

    const sourceRefId = String(sourceRefIdRaw || '').trim()
    if (!sourceRefId) {
        return { ok: false, error: 'Para comissão de venda, informe o ID da venda (lead) fechado.' }
    }

    if (!isUuid(sourceRefId)) {
        return { ok: false, error: 'Para venda, o ID de referência deve ser um UUID válido de lead fechado.' }
    }

    const [hasLeadsTable, hasLeadFunnelStage] = await Promise.all([
        columnExistsOnTable(admin, 'leads', 'id'),
        columnExistsOnTable(admin, 'leads', 'funnel_stage'),
    ])

    if (!hasLeadsTable || !hasLeadFunnelStage) {
        return { ok: false, error: 'Nao foi possivel validar a venda fechada no CRM (leads).' }
    }

    const { data: lead, error: leadError } = await admin
        .from('leads')
        .select('id, funnel_stage')
        .eq('id', sourceRefId)
        .maybeSingle()

    if (leadError) {
        console.warn('[admin/finance/commissions] sale reference validation warning:', leadError.message)
        return { ok: false, error: 'Falha ao validar venda fechada no CRM.' }
    }

    if (!lead) {
        return { ok: false, error: 'Venda (lead) nao encontrada para o ID informado.' }
    }

    const stage = String(lead.funnel_stage || '').trim().toLowerCase()
    if (stage !== 'closed' && stage !== 'converted') {
        return { ok: false, error: 'Comissao de venda permitida apenas para lead fechado/convertido.' }
    }

    return { ok: true }
}

async function createPaymentLedgerForCommission(
    admin: any,
    params: {
        commissionId: string
        brokerName: string | null
        amount: number
        dueDate: string | null
        costCenterId: string | null
        sourceRefType: string | null
        sourceRefId: string | null
        notes: string | null
        createdBy: string | null
    },
): Promise<string | null> {
    const dateField = await resolveFinanceEntriesDateField(admin)
    if (!dateField) return null

    const [
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
        hasSourceModule,
        hasExternalReference,
        hasNotes,
        hasCreatedBy,
        hasUpdatedAt,
    ] = await Promise.all([
        columnExistsOnTable(admin, 'finance_entries', 'category'),
        columnExistsOnTable(admin, 'finance_entries', 'subcategory'),
        columnExistsOnTable(admin, 'finance_entries', 'payment_method'),
        columnExistsOnTable(admin, 'finance_entries', 'payment_status'),
        columnExistsOnTable(admin, 'finance_entries', 'counterparty_name'),
        columnExistsOnTable(admin, 'finance_entries', 'counterparty_type'),
        columnExistsOnTable(admin, 'finance_entries', 'reference_company'),
        columnExistsOnTable(admin, 'finance_entries', 'due_date'),
        columnExistsOnTable(admin, 'finance_entries', 'competence_date'),
        columnExistsOnTable(admin, 'finance_entries', 'cost_center_id'),
        columnExistsOnTable(admin, 'finance_entries', 'source_module'),
        columnExistsOnTable(admin, 'finance_entries', 'external_reference'),
        columnExistsOnTable(admin, 'finance_entries', 'notes'),
        columnExistsOnTable(admin, 'finance_entries', 'created_by'),
        columnExistsOnTable(admin, 'finance_entries', 'updated_at'),
    ])

    const safeDueDate = toNullableText(params.dueDate) || new Date().toISOString().slice(0, 10)
    const nowIso = new Date().toISOString()
    const brokerLabel = toNullableText(params.brokerName) || 'Corretor'
    const description = `Pagamento comissao - ${brokerLabel}`

    const insertData: any = {
        description,
        entry_type: 'expense',
        amount: Number(params.amount),
    }

    if (dateField === 'entry_date' || dateField === 'date') {
        insertData[dateField] = safeDueDate
    } else {
        insertData[dateField] = `${safeDueDate}T12:00:00.000Z`
    }

    if (hasCategory) insertData.category = 'Comissoes'
    if (hasSubcategory) insertData.subcategory = 'Corretagem'
    if (hasPaymentMethod) insertData.payment_method = 'Transferencia'
    if (hasPaymentStatus) insertData.payment_status = 'paid'
    if (hasCounterpartyName) insertData.counterparty_name = brokerLabel
    if (hasCounterpartyType) insertData.counterparty_type = 'pessoa_fisica'
    if (hasReferenceCompany) insertData.reference_company = 'Comissoes'
    if (hasDueDate) insertData.due_date = safeDueDate
    if (hasCompetenceDate) insertData.competence_date = safeDueDate
    if (hasCostCenterId) insertData.cost_center_id = toNullableText(params.costCenterId)
    if (hasSourceModule) insertData.source_module = 'finance_commissions'
    if (hasExternalReference) insertData.external_reference = params.commissionId
    if (hasNotes) insertData.notes = toNullableText(params.notes) || description
    if (hasCreatedBy) insertData.created_by = params.createdBy
    if (hasUpdatedAt) insertData.updated_at = nowIso

    const { data: createdEntry, error: createEntryError } = await admin
        .from('finance_entries')
        .insert(insertData)
        .select('id')
        .single()

    if (createEntryError || !createdEntry?.id) {
        throw createEntryError || new Error('Nao foi possivel criar o lancamento financeiro da comissao')
    }

    const hasPayablesTable = await columnExistsOnTable(admin, 'finance_payables', 'id')
    if (hasPayablesTable) {
        const [payablesHasDueDate, payablesHasDescription, payablesHasAmount] = await Promise.all([
            columnExistsOnTable(admin, 'finance_payables', 'due_date'),
            columnExistsOnTable(admin, 'finance_payables', 'description'),
            columnExistsOnTable(admin, 'finance_payables', 'amount'),
        ])

        if (payablesHasDueDate && payablesHasDescription && payablesHasAmount) {
            const payablesData: any = {
                source_entry_id: createdEntry.id,
                description,
                amount: Number(params.amount),
                paid_amount: Number(params.amount),
                due_date: safeDueDate,
                competence_date: safeDueDate,
                status: 'paid',
                category: 'Comissoes',
                subcategory: 'Corretagem',
                counterparty_name: brokerLabel,
                counterparty_type: 'pessoa_fisica',
                payment_method: 'Transferencia',
                cost_center_id: toNullableText(params.costCenterId),
                paid_at: nowIso,
                notes: toNullableText(params.notes),
                created_by: params.createdBy,
                updated_at: nowIso,
            }

            await admin.from('finance_payables').insert(payablesData)
        }
    }

    return createdEntry.id
}

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
        return { error: NextResponse.json({ error: 'Sem acesso ao modulo financeiro' }, { status: 403 }) }
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

async function loadBrokerOptions(admin: any) {
    const [adminUsersRes, virtualBrokersRes] = await Promise.all([
        admin
            .from('admin_users')
            .select('id, name, is_active')
            .eq('is_active', true)
            .order('name', { ascending: true }),
        admin
            .from('virtual_brokers')
            .select('id, name, is_active')
            .eq('is_active', true)
            .order('name', { ascending: true }),
    ])

    const options: Array<{ id: string; name: string; source: BrokerSource }> = []
    ;(adminUsersRes.data || []).forEach((row: any) => {
        if (!row?.id || !row?.name) return
        options.push({ id: row.id, name: row.name, source: 'admin_user' })
    })
    ;(virtualBrokersRes.data || []).forEach((row: any) => {
        if (!row?.id || !row?.name) return
        options.push({ id: row.id, name: row.name, source: 'virtual_broker' })
    })

    return options
}

function mapRule(row: any) {
    return {
        id: row.id,
        name: row.name,
        is_active: row.is_active,
        applies_to: row.applies_to,
        basis_type: row.basis_type,
        calc_type: row.calc_type,
        percentage: row.percentage,
        fixed_amount: row.fixed_amount,
        min_sale_amount: row.min_sale_amount,
        max_sale_amount: row.max_sale_amount,
        split_payload: row.split_payload,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

function mapCommission(row: any) {
    return {
        id: row.id,
        rule_id: row.rule_id,
        source_ref_type: row.source_ref_type,
        source_ref_id: row.source_ref_id,
        broker_user_id: row.broker_user_id,
        broker_name: row.broker_name,
        sale_amount: row.sale_amount,
        commission_base: row.commission_base,
        commission_amount: row.commission_amount,
        status: row.status,
        due_date: row.due_date,
        paid_at: row.paid_at,
        payment_entry_id: row.payment_entry_id,
        cost_center_id: row.cost_center_id,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        rule: row.rule || null,
        broker: row.broker || null,
        cost_center: row.cost_center || null,
    }
}

async function attachBrokersToCommissionRows(admin: any, rows: any[]): Promise<any[]> {
    if (!Array.isArray(rows) || rows.length === 0) return []

    const brokerIds = Array.from(
        new Set(
            rows
                .map((row: any) => toNullableText(row?.broker_user_id))
                .filter((id: string | null): id is string => !!id),
        ),
    )

    if (brokerIds.length === 0) return rows.map((row: any) => ({ ...row, broker: null }))

    const { data: usersData, error: usersError } = await admin
        .from('admin_users')
        .select('id, name, email')
        .in('id', brokerIds)

    if (usersError) {
        console.warn('[admin/finance/commissions] broker attach warning:', usersError.message)
        return rows.map((row: any) => ({ ...row, broker: null }))
    }

    const usersMap = new Map<string, any>()
    ;(usersData || []).forEach((user: any) => {
        if (user?.id) usersMap.set(user.id, user)
    })

    return rows.map((row: any) => {
        const brokerId = toNullableText(row?.broker_user_id)
        return {
            ...row,
            broker: brokerId ? (usersMap.get(brokerId) || null) : null,
        }
    })
}

async function attachBrokerToCommissionRow(admin: any, row: any): Promise<any> {
    if (!row) return row
    const [enriched] = await attachBrokersToCommissionRows(admin, [row])
    return enriched || row
}

async function calculateCommissionFromRule(admin: any, payload: any) {
    const ruleId = String(payload?.rule_id || '').trim()
    const saleAmount = toNullableNumber(payload?.sale_amount)
    const commissionBaseInput = toNullableNumber(payload?.commission_base)

    if (!ruleId) {
        return { error: 'Selecione uma regra de comissao' }
    }
    if (!Number.isFinite(saleAmount as number) || (saleAmount as number) <= 0) {
        return { error: 'Informe um valor de venda valido' }
    }

    const { data: rule, error: ruleError } = await admin
        .from('finance_commission_rules')
        .select('*')
        .eq('id', ruleId)
        .single()

    if (ruleError || !rule) {
        return { error: 'Regra de comissao nao encontrada' }
    }
    if (!rule.is_active) {
        return { error: 'Regra de comissao inativa' }
    }

    const minSale = toNullableNumber(rule.min_sale_amount)
    const maxSale = toNullableNumber(rule.max_sale_amount)
    if (Number.isFinite(minSale as number) && (saleAmount as number) < (minSale as number)) {
        return { error: `Venda abaixo do minimo da regra (${minSale})` }
    }
    if (Number.isFinite(maxSale as number) && (saleAmount as number) > (maxSale as number)) {
        return { error: `Venda acima do maximo da regra (${maxSale})` }
    }

    const basisType = toBasisType(rule.basis_type)
    const calcType = toCalcType(rule.calc_type)
    const commissionBase = basisType === 'net_revenue'
        ? (Number.isFinite(commissionBaseInput as number) ? (commissionBaseInput as number) : (saleAmount as number))
        : (saleAmount as number)

    if (!Number.isFinite(commissionBase) || commissionBase <= 0) {
        return { error: 'Base de comissao invalida' }
    }

    let commissionAmount = 0
    let effectivePercentage: number | null = null
    if (calcType === 'percentage') {
        const rawPercentage = Number(rule.percentage || 0)
        const ratio = percentageToRatio(rawPercentage)
        if (!Number.isFinite(ratio) || ratio <= 0) {
            return { error: 'Percentual da regra invalido' }
        }
        effectivePercentage = ratio * 100
        commissionAmount = commissionBase * ratio
    } else {
        const fixed = Number(rule.fixed_amount || 0)
        if (!Number.isFinite(fixed) || fixed <= 0) {
            return { error: 'Valor fixo da regra invalido' }
        }
        commissionAmount = fixed
    }

    commissionAmount = Number(commissionAmount.toFixed(2))

    return {
        rule: mapRule(rule),
        sale_amount: saleAmount,
        commission_base: commissionBase,
        commission_amount: commissionAmount,
        effective_percentage: effectivePercentage,
    }
}

export async function GET(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const statusFilter = String(searchParams.get('status') || '').trim().toLowerCase()
        const brokerFilter = String(searchParams.get('broker_name') || '').trim()
        const limitRaw = Number(searchParams.get('limit') || 500)
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 2000)) : 500

        const admin = createAdminClient()

        const rulesQuery = admin
            .from('finance_commission_rules')
            .select('*')
            .order('is_active', { ascending: false })
            .order('name', { ascending: true })

        let commissionsQuery = admin
            .from('finance_commissions')
            .select(`
                *,
                rule:finance_commission_rules(id, name, calc_type, basis_type, percentage, fixed_amount),
                cost_center:finance_cost_centers(id, name, code)
            `)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (statusFilter) commissionsQuery = commissionsQuery.eq('status', toCommissionStatus(statusFilter))
        if (brokerFilter) commissionsQuery = commissionsQuery.ilike('broker_name', `%${brokerFilter}%`)

        const [rulesRes, commissionsRes, brokerOptions] = await Promise.all([
            rulesQuery,
            commissionsQuery,
            loadBrokerOptions(admin),
        ])

        if (rulesRes.error) throw rulesRes.error
        if (commissionsRes.error) throw commissionsRes.error
        const enrichedCommissions = await attachBrokersToCommissionRows(admin, commissionsRes.data || [])

        return NextResponse.json({
            success: true,
            rules: (rulesRes.data || []).map((row: any) => mapRule(row)),
            commissions: enrichedCommissions.map((row: any) => mapCommission(row)),
            brokers: brokerOptions,
        })
    } catch (err: any) {
        console.error('[admin/finance/commissions GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao carregar comissoes' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const entity = String(body?.entity || '').trim().toLowerCase()
        const admin = createAdminClient()

        if (entity === 'rule') {
            const name = String(body?.name || '').trim()
            if (!name) {
                return NextResponse.json({ success: false, error: 'Nome da regra obrigatorio' }, { status: 400 })
            }

            const calcType = toCalcType(body?.calc_type)
            const basisType = toBasisType(body?.basis_type)
            const percentage = calcType === 'percentage' ? toNullableNumber(body?.percentage) : null
            const fixedAmount = calcType === 'fixed' ? toNullableNumber(body?.fixed_amount) : null

            if (calcType === 'percentage' && (!Number.isFinite(percentage as number) || (percentage as number) <= 0)) {
                return NextResponse.json({ success: false, error: 'Percentual invalido para regra percentual' }, { status: 400 })
            }
            if (calcType === 'fixed' && (!Number.isFinite(fixedAmount as number) || (fixedAmount as number) <= 0)) {
                return NextResponse.json({ success: false, error: 'Valor fixo invalido para regra fixa' }, { status: 400 })
            }

            const insertData = {
                name,
                is_active: body?.is_active !== false,
                applies_to: toNullableText(body?.applies_to),
                basis_type: basisType,
                calc_type: calcType,
                percentage,
                fixed_amount: fixedAmount,
                min_sale_amount: toNullableNumber(body?.min_sale_amount),
                max_sale_amount: toNullableNumber(body?.max_sale_amount),
                split_payload: body?.split_payload ?? null,
                starts_at: toNullableText(body?.starts_at),
                ends_at: toNullableText(body?.ends_at),
                notes: toNullableText(body?.notes),
                created_by: access.adminUser?.id || null,
                updated_at: new Date().toISOString(),
            }

            const { data, error } = await admin
                .from('finance_commission_rules')
                .insert(insertData)
                .select('*')
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, rule: mapRule(data) }, { status: 201 })
        }

        if (entity === 'calculate') {
            const calculated = await calculateCommissionFromRule(admin, body)
            if ((calculated as any).error) {
                return NextResponse.json({ success: false, error: (calculated as any).error }, { status: 400 })
            }

            const preview = calculated as any
            const splitParsed = parseSplitPayload(preview?.rule?.split_payload)
            if ((splitParsed as any).error) {
                return NextResponse.json({ success: false, error: (splitParsed as any).error }, { status: 400 })
            }

            const splitInfo = splitParsed as { participants: SplitParticipant[]; mode: SplitMode | null }
            const splitParticipants = splitInfo.participants || []
            const splitMode = splitInfo.mode
            const splitAmounts = splitParticipants.length > 0 && splitMode
                ? splitCommissionAmount(Number(preview.commission_amount || 0), splitParticipants, splitMode)
                : []
            const splitBreakdown = splitParticipants.map((participant, idx) => ({
                index: idx + 1,
                broker_user_id: participant.broker_user_id,
                broker_name: participant.broker_name,
                broker_source: participant.broker_source,
                participant_type: participant.participant_type,
                mode: splitMode,
                amount: splitAmounts[idx] || 0,
                percentage: participant.percentage,
            }))

            const previewWithSplit = {
                ...preview,
                split_breakdown: splitBreakdown,
            }

            const shouldCreate = !!body?.create_record
            if (!shouldCreate) {
                return NextResponse.json({ success: true, preview: previewWithSplit })
            }

            const saleReferenceValidation = await validateClosedSaleReference(admin, body?.source_ref_type, body?.source_ref_id)
            if (!saleReferenceValidation.ok) {
                return NextResponse.json({ success: false, error: saleReferenceValidation.error }, { status: 400 })
            }

            const dueDate = toNullableText(body?.due_date) || new Date().toISOString().slice(0, 10)
            const createLockError = await ensureUnlockedDates(admin, [dueDate], 'Comissao')
            if (createLockError) {
                return NextResponse.json({ success: false, error: createLockError }, { status: 409 })
            }

            const nowIso = new Date().toISOString()
            const baseBrokerUserId = toNullableText(body?.broker_user_id)
            const baseBrokerName = toNullableText(body?.broker_name)
            const baseNotes = toNullableText(body?.notes)

            if (splitParticipants.length > 0) {
                const splitRows = splitParticipants.map((participant, idx) => {
                    const brokerUserId = participant.broker_user_id || baseBrokerUserId
                    const brokerName = participant.broker_name || baseBrokerName
                    const splitLabel = `Split ${idx + 1}/${splitParticipants.length}${participant.participant_type ? ` (${participant.participant_type})` : ''}`
                    const mergedNotes = [baseNotes, participant.notes, splitLabel].filter(Boolean).join(' | ') || null

                    return {
                        rule_id: preview.rule.id,
                        source_ref_type: toNullableText(body?.source_ref_type),
                        source_ref_id: toNullableText(body?.source_ref_id),
                        broker_user_id: brokerUserId,
                        broker_name: brokerName,
                        sale_amount: preview.sale_amount,
                        commission_base: preview.commission_base,
                        commission_amount: Number(splitAmounts[idx] || 0),
                        status: 'calculated' as CommissionStatus,
                        due_date: dueDate,
                        cost_center_id: toNullableText(body?.cost_center_id),
                        notes: mergedNotes,
                        created_by: access.adminUser?.id || null,
                        updated_at: nowIso,
                    }
                })

                const hasMissingBroker = splitRows.some(row => !row.broker_user_id && !row.broker_name)
                if (hasMissingBroker) {
                    return NextResponse.json({ success: false, error: 'Split invalido: todos os participantes precisam de corretor (nome ou usuario admin).' }, { status: 400 })
                }

                const { data: insertedRows, error: insertError } = await admin
                    .from('finance_commissions')
                    .insert(splitRows)
                    .select(`
                        *,
                        rule:finance_commission_rules(id, name, calc_type, basis_type, percentage, fixed_amount),
                        cost_center:finance_cost_centers(id, name, code)
                    `)

                if (insertError) throw insertError
                const enrichedRows = await attachBrokersToCommissionRows(admin, insertedRows || [])
                const mappedRows = enrichedRows.map((row: any) => mapCommission(row))

                return NextResponse.json({
                    success: true,
                    preview: previewWithSplit,
                    commissions: mappedRows,
                    commission: mappedRows[0] || null,
                }, { status: 201 })
            }

            const commissionInsertData = {
                rule_id: preview.rule.id,
                source_ref_type: toNullableText(body?.source_ref_type),
                source_ref_id: toNullableText(body?.source_ref_id),
                broker_user_id: baseBrokerUserId,
                broker_name: baseBrokerName,
                sale_amount: preview.sale_amount,
                commission_base: preview.commission_base,
                commission_amount: preview.commission_amount,
                status: 'calculated' as CommissionStatus,
                due_date: dueDate,
                cost_center_id: toNullableText(body?.cost_center_id),
                notes: baseNotes,
                created_by: access.adminUser?.id || null,
                updated_at: nowIso,
            }

            if (!commissionInsertData.broker_name && !commissionInsertData.broker_user_id) {
                return NextResponse.json({ success: false, error: 'Informe um corretor (nome ou usuario admin)' }, { status: 400 })
            }

            const { data, error } = await admin
                .from('finance_commissions')
                .insert(commissionInsertData)
                .select(`
                    *,
                    rule:finance_commission_rules(id, name, calc_type, basis_type, percentage, fixed_amount),
                    cost_center:finance_cost_centers(id, name, code)
                `)
                .single()

            if (error) throw error
            const enrichedData = await attachBrokerToCommissionRow(admin, data)

            return NextResponse.json({
                success: true,
                preview: previewWithSplit,
                commission: mapCommission(enrichedData),
            }, { status: 201 })
        }

        if (entity === 'commission') {
            const commissionAmount = toNullableNumber(body?.commission_amount)
            if (!Number.isFinite(commissionAmount as number) || (commissionAmount as number) < 0) {
                return NextResponse.json({ success: false, error: 'Valor da comissao invalido' }, { status: 400 })
            }

            const saleReferenceValidation = await validateClosedSaleReference(admin, body?.source_ref_type, body?.source_ref_id)
            if (!saleReferenceValidation.ok) {
                return NextResponse.json({ success: false, error: saleReferenceValidation.error }, { status: 400 })
            }

            const createDateForLock = toNullableText(body?.due_date)
                || toNullableText(body?.paid_at)
                || new Date().toISOString().slice(0, 10)
            const createLockError = await ensureUnlockedDates(admin, [createDateForLock], 'Comissao')
            if (createLockError) {
                return NextResponse.json({ success: false, error: createLockError }, { status: 409 })
            }

            const insertData = {
                rule_id: toNullableText(body?.rule_id),
                source_ref_type: toNullableText(body?.source_ref_type),
                source_ref_id: toNullableText(body?.source_ref_id),
                broker_user_id: toNullableText(body?.broker_user_id),
                broker_name: toNullableText(body?.broker_name),
                sale_amount: toNullableNumber(body?.sale_amount),
                commission_base: toNullableNumber(body?.commission_base),
                commission_amount: commissionAmount,
                status: toCommissionStatus(body?.status),
                due_date: toNullableText(body?.due_date),
                paid_at: toNullableText(body?.paid_at),
                payment_entry_id: toNullableText(body?.payment_entry_id),
                cost_center_id: toNullableText(body?.cost_center_id),
                notes: toNullableText(body?.notes),
                created_by: access.adminUser?.id || null,
                updated_at: new Date().toISOString(),
            }

            if (!insertData.broker_name && !insertData.broker_user_id) {
                return NextResponse.json({ success: false, error: 'Informe um corretor (nome ou usuario admin)' }, { status: 400 })
            }

            const { data, error } = await admin
                .from('finance_commissions')
                .insert(insertData)
                .select(`
                    *,
                    rule:finance_commission_rules(id, name, calc_type, basis_type, percentage, fixed_amount),
                    cost_center:finance_cost_centers(id, name, code)
                `)
                .single()

            if (error) throw error

            let finalCommissionRow = data
            if (insertData.status === 'paid' && !insertData.payment_entry_id) {
                const generatedPaymentEntryId = await createPaymentLedgerForCommission(admin, {
                    commissionId: data.id,
                    brokerName: insertData.broker_name,
                    amount: Number(insertData.commission_amount || 0),
                    dueDate: insertData.due_date || null,
                    costCenterId: insertData.cost_center_id || null,
                    sourceRefType: insertData.source_ref_type || null,
                    sourceRefId: insertData.source_ref_id || null,
                    notes: insertData.notes || null,
                    createdBy: access.adminUser?.id || null,
                })

                const paidAt = insertData.paid_at || new Date().toISOString()
                const { data: updatedData, error: updateError } = await admin
                    .from('finance_commissions')
                    .update({
                        payment_entry_id: generatedPaymentEntryId,
                        paid_at: paidAt,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', data.id)
                    .select(`
                        *,
                        rule:finance_commission_rules(id, name, calc_type, basis_type, percentage, fixed_amount),
                        cost_center:finance_cost_centers(id, name, code)
                    `)
                    .single()

                if (updateError) throw updateError
                if (updatedData) finalCommissionRow = updatedData
            }

            const enrichedFinalRow = await attachBrokerToCommissionRow(admin, finalCommissionRow)
            return NextResponse.json({ success: true, commission: mapCommission(enrichedFinalRow) }, { status: 201 })
        }

        return NextResponse.json({ success: false, error: 'Entidade invalida para POST' }, { status: 400 })
    } catch (err: any) {
        console.error('[admin/finance/commissions POST]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao salvar comissao' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const entity = String(body?.entity || '').trim().toLowerCase()
        const id = String(body?.id || '').trim()
        if (!id) {
            return NextResponse.json({ success: false, error: 'ID obrigatorio' }, { status: 400 })
        }

        const admin = createAdminClient()

        if (entity === 'rule') {
            const calcType = toCalcType(body?.calc_type)
            const basisType = toBasisType(body?.basis_type)
            const percentage = calcType === 'percentage' ? toNullableNumber(body?.percentage) : null
            const fixedAmount = calcType === 'fixed' ? toNullableNumber(body?.fixed_amount) : null

            if (calcType === 'percentage' && (!Number.isFinite(percentage as number) || (percentage as number) <= 0)) {
                return NextResponse.json({ success: false, error: 'Percentual invalido para regra percentual' }, { status: 400 })
            }
            if (calcType === 'fixed' && (!Number.isFinite(fixedAmount as number) || (fixedAmount as number) <= 0)) {
                return NextResponse.json({ success: false, error: 'Valor fixo invalido para regra fixa' }, { status: 400 })
            }

            const updateData = {
                name: String(body?.name || '').trim(),
                is_active: body?.is_active !== false,
                applies_to: toNullableText(body?.applies_to),
                basis_type: basisType,
                calc_type: calcType,
                percentage,
                fixed_amount: fixedAmount,
                min_sale_amount: toNullableNumber(body?.min_sale_amount),
                max_sale_amount: toNullableNumber(body?.max_sale_amount),
                split_payload: body?.split_payload ?? null,
                starts_at: toNullableText(body?.starts_at),
                ends_at: toNullableText(body?.ends_at),
                notes: toNullableText(body?.notes),
                updated_at: new Date().toISOString(),
            }

            if (!updateData.name) {
                return NextResponse.json({ success: false, error: 'Nome da regra obrigatorio' }, { status: 400 })
            }

            const { data, error } = await admin
                .from('finance_commission_rules')
                .update(updateData)
                .eq('id', id)
                .select('*')
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, rule: mapRule(data) })
        }

        if (entity === 'commission') {
            const { data: currentCommission, error: currentCommissionError } = await admin
                .from('finance_commissions')
                .select('*')
                .eq('id', id)
                .single()

            if (currentCommissionError || !currentCommission) {
                return NextResponse.json({ success: false, error: 'Comissao nao encontrada' }, { status: 404 })
            }

            const hasPaidAtInBody = Object.prototype.hasOwnProperty.call(body, 'paid_at')
            const hasPaymentEntryIdInBody = Object.prototype.hasOwnProperty.call(body, 'payment_entry_id')
            const hasDueDateInBody = Object.prototype.hasOwnProperty.call(body, 'due_date')
            const nextDueDate = hasDueDateInBody
                ? toNullableText(body?.due_date)
                : toNullableText(currentCommission.due_date)

            const updateData: any = {
                rule_id: toNullableText(body?.rule_id),
                source_ref_type: toNullableText(body?.source_ref_type),
                source_ref_id: toNullableText(body?.source_ref_id),
                broker_user_id: toNullableText(body?.broker_user_id),
                broker_name: toNullableText(body?.broker_name),
                sale_amount: toNullableNumber(body?.sale_amount),
                commission_base: toNullableNumber(body?.commission_base),
                commission_amount: toNullableNumber(body?.commission_amount),
                status: toCommissionStatus(body?.status),
                due_date: nextDueDate,
                paid_at: hasPaidAtInBody ? toNullableText(body?.paid_at) : currentCommission.paid_at,
                payment_entry_id: hasPaymentEntryIdInBody ? toNullableText(body?.payment_entry_id) : currentCommission.payment_entry_id,
                cost_center_id: toNullableText(body?.cost_center_id),
                notes: toNullableText(body?.notes),
                updated_at: new Date().toISOString(),
            }

            if (!Number.isFinite(updateData.commission_amount) || updateData.commission_amount < 0) {
                return NextResponse.json({ success: false, error: 'Valor da comissao invalido' }, { status: 400 })
            }
            if (!updateData.broker_name && !updateData.broker_user_id) {
                return NextResponse.json({ success: false, error: 'Informe um corretor (nome ou usuario admin)' }, { status: 400 })
            }

            const effectiveSourceRefType = updateData.source_ref_type || currentCommission.source_ref_type || null
            const effectiveSourceRefId = updateData.source_ref_id || currentCommission.source_ref_id || null
            const saleReferenceValidation = await validateClosedSaleReference(admin, effectiveSourceRefType, effectiveSourceRefId)
            if (!saleReferenceValidation.ok) {
                return NextResponse.json({ success: false, error: saleReferenceValidation.error }, { status: 400 })
            }

            const currentDateForLock = normalizeDateForLock(
                currentCommission.due_date || currentCommission.paid_at || currentCommission.created_at,
            )
            const nextDateForLock = normalizeDateForLock(
                updateData.due_date || updateData.paid_at || currentCommission.due_date || currentCommission.paid_at || currentCommission.created_at,
            )
            const updateLockError = await ensureUnlockedDates(
                admin,
                [currentDateForLock, nextDateForLock],
                'Comissao',
            )
            if (updateLockError) {
                return NextResponse.json({ success: false, error: updateLockError }, { status: 409 })
            }

            if (updateData.status === 'paid') {
                if (!updateData.payment_entry_id) {
                    const generatedPaymentEntryId = await createPaymentLedgerForCommission(admin, {
                        commissionId: id,
                        brokerName: updateData.broker_name || currentCommission.broker_name || null,
                        amount: Number(updateData.commission_amount || currentCommission.commission_amount || 0),
                        dueDate: updateData.due_date || currentCommission.due_date || null,
                        costCenterId: updateData.cost_center_id || currentCommission.cost_center_id || null,
                        sourceRefType: updateData.source_ref_type || currentCommission.source_ref_type || null,
                        sourceRefId: updateData.source_ref_id || currentCommission.source_ref_id || null,
                        notes: updateData.notes || currentCommission.notes || null,
                        createdBy: access.adminUser?.id || null,
                    })
                    updateData.payment_entry_id = generatedPaymentEntryId
                }
                if (!updateData.paid_at) updateData.paid_at = new Date().toISOString()
            }

            const { data, error } = await admin
                .from('finance_commissions')
                .update(updateData)
                .eq('id', id)
                .select(`
                    *,
                    rule:finance_commission_rules(id, name, calc_type, basis_type, percentage, fixed_amount),
                    cost_center:finance_cost_centers(id, name, code)
                `)
                .single()

            if (error) throw error
            const enrichedData = await attachBrokerToCommissionRow(admin, data)
            return NextResponse.json({ success: true, commission: mapCommission(enrichedData) })
        }

        return NextResponse.json({ success: false, error: 'Entidade invalida para PUT' }, { status: 400 })
    } catch (err: any) {
        console.error('[admin/finance/commissions PUT]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao atualizar comissao' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const entity = String(searchParams.get('entity') || '').trim().toLowerCase()
        const id = String(searchParams.get('id') || '').trim()
        if (!id) {
            return NextResponse.json({ success: false, error: 'ID obrigatorio' }, { status: 400 })
        }

        const admin = createAdminClient()

        if (entity === 'rule') {
            const { error } = await admin.from('finance_commission_rules').delete().eq('id', id)
            if (error) throw error
            return NextResponse.json({ success: true })
        }

        if (entity === 'commission') {
            const { data: currentCommission, error: currentCommissionError } = await admin
                .from('finance_commissions')
                .select('id, due_date, paid_at, created_at')
                .eq('id', id)
                .single()

            if (currentCommissionError || !currentCommission) {
                return NextResponse.json({ success: false, error: 'Comissao nao encontrada' }, { status: 404 })
            }

            const deleteDateForLock = normalizeDateForLock(
                currentCommission.due_date || currentCommission.paid_at || currentCommission.created_at,
            )
            const deleteLockError = await ensureUnlockedDates(admin, [deleteDateForLock], 'Comissao')
            if (deleteLockError) {
                return NextResponse.json({ success: false, error: deleteLockError }, { status: 409 })
            }

            const { error } = await admin.from('finance_commissions').delete().eq('id', id)
            if (error) throw error
            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ success: false, error: 'Entidade invalida para DELETE' }, { status: 400 })
    } catch (err: any) {
        console.error('[admin/finance/commissions DELETE]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao excluir comissao' }, { status: 500 })
    }
}
