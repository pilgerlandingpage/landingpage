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

export async function GET() {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const admin = createAdminClient()
        const { data, error } = await admin
            .from('finance_entities')
            .select('id, name, entity_type, cpf_cnpj, description, is_active, is_default, created_at, updated_at')
            .order('is_default', { ascending: false })
            .order('name', { ascending: true })

        if (error) throw error
        return NextResponse.json({ success: true, entities: data || [] })
    } catch (err: any) {
        console.error('[admin/finance/entities GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao carregar entidades' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const name = String(body?.name || '').trim()
        const entity_type = String(body?.entity_type || 'pj').trim()
        const cpf_cnpj = String(body?.cpf_cnpj || '').replace(/\D/g, '') || null
        const description = String(body?.description || '').trim() || null
        const is_default = Boolean(body?.is_default)

        if (!name) return NextResponse.json({ success: false, error: 'Nome obrigatorio' }, { status: 400 })
        if (!['pf', 'pj'].includes(entity_type)) {
            return NextResponse.json({ success: false, error: 'Tipo invalido: use pf ou pj' }, { status: 400 })
        }

        if (cpf_cnpj) {
            const isValidCpf = entity_type === 'pf' && cpf_cnpj.length === 11
            const isValidCnpj = entity_type === 'pj' && cpf_cnpj.length === 14
            if (!isValidCpf && !isValidCnpj) {
                return NextResponse.json({
                    success: false,
                    error: entity_type === 'pf' ? 'CPF deve ter 11 digitos' : 'CNPJ deve ter 14 digitos',
                }, { status: 400 })
            }
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from('finance_entities')
            .insert({ name, entity_type, cpf_cnpj, description, is_default, is_active: true, updated_at: new Date().toISOString() })
            .select('id, name, entity_type, cpf_cnpj, description, is_active, is_default, created_at, updated_at')
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, entity: data }, { status: 201 })
    } catch (err: any) {
        console.error('[admin/finance/entities POST]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao criar entidade' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const id = String(body?.id || '').trim()
        if (!id) return NextResponse.json({ success: false, error: 'ID obrigatorio' }, { status: 400 })

        const admin = createAdminClient()
        const updateData: any = { updated_at: new Date().toISOString() }

        if (body?.name !== undefined) updateData.name = String(body.name || '').trim()
        if (body?.entity_type !== undefined) updateData.entity_type = String(body.entity_type || 'pj').trim()
        if (body?.cpf_cnpj !== undefined) updateData.cpf_cnpj = String(body.cpf_cnpj || '').replace(/\D/g, '') || null
        if (body?.description !== undefined) updateData.description = String(body.description || '').trim() || null
        if (body?.is_default !== undefined) updateData.is_default = Boolean(body.is_default)
        if (body?.is_active !== undefined) updateData.is_active = Boolean(body.is_active)

        const { data, error } = await admin
            .from('finance_entities')
            .update(updateData)
            .eq('id', id)
            .select('id, name, entity_type, cpf_cnpj, description, is_active, is_default, created_at, updated_at')
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, entity: data })
    } catch (err: any) {
        console.error('[admin/finance/entities PUT]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao atualizar entidade' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const id = String(searchParams.get('id') || '').trim()
        if (!id) return NextResponse.json({ success: false, error: 'ID obrigatorio' }, { status: 400 })

        const admin = createAdminClient()
        const { error } = await admin
            .from('finance_entities')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[admin/finance/entities DELETE]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao desativar entidade' }, { status: 500 })
    }
}
