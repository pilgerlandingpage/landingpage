import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

type FinanceType = 'income' | 'expense' | 'both'
type PartyType = 'pessoa_fisica' | 'pessoa_juridica'
type LookupEntity = 'category' | 'subcategory' | 'payment_method' | 'counterparty' | 'cost_center' | 'bank_account'

async function columnExists(admin: any, table: string, column: string): Promise<boolean> {
    const { error } = await admin.from(table).select(column).limit(1)
    return !error
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

function normalizeType(raw: any): FinanceType {
    const value = String(raw || '').trim().toLowerCase()
    if (value === 'income' || value === 'expense') return value
    return 'both'
}

function normalizePartyType(raw: any): PartyType {
    const value = String(raw || '').trim().toLowerCase()
    if (value === 'pessoa_fisica') return 'pessoa_fisica'
    return 'pessoa_juridica'
}

export async function GET() {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const admin = createAdminClient()

        const hasCpfCnpj = await columnExists(admin, 'finance_counterparties', 'cpf_cnpj')
        const counterpartySelect = hasCpfCnpj
            ? 'id, name, party_type, cpf_cnpj, email, phone, is_active'
            : 'id, name, party_type, is_active'

        const [categoriesRes, subcategoriesRes, paymentMethodsRes, counterpartiesRes, costCentersRes, bankAccountsRes, entitiesRes] = await Promise.all([
            admin.from('finance_categories').select('id, name, entry_type, is_active').eq('is_active', true).order('name', { ascending: true }),
            admin.from('finance_subcategories').select('id, category_id, name, is_active').eq('is_active', true).order('name', { ascending: true }),
            admin.from('finance_payment_methods').select('id, name, is_active').eq('is_active', true).order('name', { ascending: true }),
            admin.from('finance_counterparties').select(counterpartySelect).eq('is_active', true).order('name', { ascending: true }),
            admin.from('finance_cost_centers').select('id, name, code, is_active').eq('is_active', true).order('name', { ascending: true }),
            admin.from('finance_bank_accounts').select('id, name, bank_name, is_active').eq('is_active', true).order('name', { ascending: true }),
            admin.from('finance_entities').select('id, name, entity_type, cpf_cnpj, is_active, is_default').eq('is_active', true).order('is_default', { ascending: false }).order('name', { ascending: true }),
        ])

        if (categoriesRes.error) throw categoriesRes.error
        if (subcategoriesRes.error) throw subcategoriesRes.error
        if (paymentMethodsRes.error) throw paymentMethodsRes.error
        if (counterpartiesRes.error) throw counterpartiesRes.error
        if (costCentersRes.error) throw costCentersRes.error
        if (bankAccountsRes.error) throw bankAccountsRes.error

        return NextResponse.json({
            success: true,
            categories: categoriesRes.data || [],
            subcategories: subcategoriesRes.data || [],
            payment_methods: paymentMethodsRes.data || [],
            counterparties: counterpartiesRes.data || [],
            cost_centers: costCentersRes.data || [],
            bank_accounts: bankAccountsRes.data || [],
            entities: (entitiesRes.error ? [] : entitiesRes.data) || [],
        })
    } catch (err: any) {
        console.error('[admin/finance/lookups GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao carregar cadastros financeiros' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const entity = String(body?.entity || '').trim() as LookupEntity
        const name = String(body?.name || '').trim()

        if (!entity) return NextResponse.json({ success: false, error: 'Entidade obrigatoria' }, { status: 400 })
        if (!name) return NextResponse.json({ success: false, error: 'Nome obrigatorio' }, { status: 400 })

        const admin = createAdminClient()

        if (entity === 'category') {
            const { data, error } = await admin
                .from('finance_categories')
                .insert({
                    name,
                    entry_type: normalizeType(body?.entry_type),
                    is_active: true,
                    updated_at: new Date().toISOString(),
                })
                .select('id, name, entry_type, is_active')
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, entity, item: data }, { status: 201 })
        }

        if (entity === 'subcategory') {
            const categoryId = String(body?.category_id || '').trim()
            if (!categoryId) return NextResponse.json({ success: false, error: 'Categoria obrigatoria para subcategoria' }, { status: 400 })

            const { data, error } = await admin
                .from('finance_subcategories')
                .insert({
                    name,
                    category_id: categoryId,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                })
                .select('id, name, category_id, is_active')
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, entity, item: data }, { status: 201 })
        }

        if (entity === 'payment_method') {
            const { data, error } = await admin
                .from('finance_payment_methods')
                .insert({
                    name,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                })
                .select('id, name, is_active')
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, entity, item: data }, { status: 201 })
        }

        if (entity === 'counterparty') {
            const cpfCnpj = String(body?.cpf_cnpj || '').replace(/\D/g, '') || null
            const email = String(body?.email || '').trim() || null
            const phone = String(body?.phone || '').trim() || null
            const hasCpfCnpjCol = await columnExists(admin, 'finance_counterparties', 'cpf_cnpj')

            const insertPayload: any = {
                name,
                party_type: normalizePartyType(body?.party_type),
                is_active: true,
                updated_at: new Date().toISOString(),
            }
            if (hasCpfCnpjCol) {
                insertPayload.cpf_cnpj = cpfCnpj
                insertPayload.email = email
                insertPayload.phone = phone
            }

            const selectCols = hasCpfCnpjCol
                ? 'id, name, party_type, cpf_cnpj, email, phone, is_active'
                : 'id, name, party_type, is_active'

            const { data, error } = await admin
                .from('finance_counterparties')
                .insert(insertPayload)
                .select(selectCols)
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, entity, item: data }, { status: 201 })
        }

        if (entity === 'cost_center') {
            const code = String(body?.code || '').trim() || null
            const { data, error } = await admin
                .from('finance_cost_centers')
                .insert({
                    name,
                    code,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                })
                .select('id, name, code, is_active')
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, entity, item: data }, { status: 201 })
        }

        if (entity === 'bank_account') {
            const bankName = String(body?.bank_name || '').trim() || null
            const { data, error } = await admin
                .from('finance_bank_accounts')
                .insert({
                    name,
                    bank_name: bankName,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                })
                .select('id, name, bank_name, is_active')
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, entity, item: data }, { status: 201 })
        }

        return NextResponse.json({ success: false, error: 'Entidade invalida' }, { status: 400 })
    } catch (err: any) {
        console.error('[admin/finance/lookups POST]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao cadastrar item financeiro' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const entity = String(searchParams.get('entity') || '').trim() as LookupEntity
        const id = String(searchParams.get('id') || '').trim()

        if (!entity || !id) return NextResponse.json({ success: false, error: 'Entity e id sao obrigatorios' }, { status: 400 })

        const admin = createAdminClient()

        if (entity === 'category') {
            const { error } = await admin.from('finance_categories').delete().eq('id', id)
            if (error) throw error
            return NextResponse.json({ success: true })
        }

        if (entity === 'subcategory') {
            const { error } = await admin.from('finance_subcategories').delete().eq('id', id)
            if (error) throw error
            return NextResponse.json({ success: true })
        }

        if (entity === 'payment_method') {
            const { error } = await admin.from('finance_payment_methods').delete().eq('id', id)
            if (error) throw error
            return NextResponse.json({ success: true })
        }

        if (entity === 'counterparty') {
            const { error } = await admin.from('finance_counterparties').delete().eq('id', id)
            if (error) throw error
            return NextResponse.json({ success: true })
        }

        if (entity === 'cost_center') {
            const { error } = await admin.from('finance_cost_centers').delete().eq('id', id)
            if (error) throw error
            return NextResponse.json({ success: true })
        }

        if (entity === 'bank_account') {
            const { error } = await admin.from('finance_bank_accounts').delete().eq('id', id)
            if (error) throw error
            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ success: false, error: 'Entidade invalida' }, { status: 400 })
    } catch (err: any) {
        console.error('[admin/finance/lookups DELETE]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao remover item financeiro' }, { status: 500 })
    }
}
