import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminClient } from '@/lib/supabase/server'

// Helper: verify master access
async function verifyMaster() {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const admin = createAdminClient()
    const { data: adminUser } = await admin
        .from('admin_users')
        .select('id, is_master')
        .eq('auth_user_id', user.id)
        .single()

    if (!adminUser?.is_master) return null
    return adminUser
}

// GET — listar setores com permissões
export async function GET() {
    try {
        const supabase = await createServerSupabase()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const admin = createAdminClient()

        // Buscar setores
        const { data: sectors, error } = await admin
            .from('admin_sectors')
            .select('*')
            .order('name')

        if (error) throw error

        // Buscar permissões de cada setor
        const { data: sectorPerms } = await admin
            .from('admin_sector_permissions')
            .select('sector_id, permission_id, admin_permissions(module_key, label, category)')

        // Buscar todas as permissões disponíveis
        const { data: allPermissions } = await admin
            .from('admin_permissions')
            .select('*')
            .order('category, label')

        // Contar usuários por setor
        const { data: userCounts } = await admin
            .from('admin_user_sectors')
            .select('sector_id')

        const countMap: Record<string, number> = {}
        for (const uc of (userCounts || [])) {
            countMap[uc.sector_id] = (countMap[uc.sector_id] || 0) + 1
        }

        // Montar resposta
        const enriched = (sectors || []).map((s: any) => {
            const perms = (sectorPerms || [])
                .filter((sp: any) => sp.sector_id === s.id)
                .map((sp: any) => sp.admin_permissions)
                .filter(Boolean)

            return {
                ...s,
                permissions: perms,
                user_count: countMap[s.id] || 0,
            }
        })

        return NextResponse.json({
            sectors: enriched,
            all_permissions: allPermissions || [],
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST — criar setor
export async function POST(request: NextRequest) {
    try {
        const master = await verifyMaster()
        if (!master) return NextResponse.json({ error: 'Acesso negado — apenas Admin Master' }, { status: 403 })

        const { name, description, color, icon, permission_ids } = await request.json()

        if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

        const admin = createAdminClient()

        // Criar setor
        const { data: sector, error } = await admin
            .from('admin_sectors')
            .insert({ name, description, color, icon })
            .select()
            .single()

        if (error) throw error

        // Vincular permissões
        if (permission_ids && permission_ids.length > 0) {
            const links = permission_ids.map((pid: string) => ({
                sector_id: sector.id,
                permission_id: pid,
            }))
            await admin.from('admin_sector_permissions').insert(links)
        }

        return NextResponse.json(sector, { status: 201 })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// PUT — editar setor
export async function PUT(request: NextRequest) {
    try {
        const master = await verifyMaster()
        if (!master) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const { id, name, description, color, icon, permission_ids } = await request.json()
        if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

        const admin = createAdminClient()

        // Atualizar setor
        const { error } = await admin
            .from('admin_sectors')
            .update({ name, description, color, icon })
            .eq('id', id)

        if (error) throw error

        // Atualizar permissões: deletar antigas, inserir novas
        if (permission_ids !== undefined) {
            await admin.from('admin_sector_permissions').delete().eq('sector_id', id)

            if (permission_ids.length > 0) {
                const links = permission_ids.map((pid: string) => ({
                    sector_id: id,
                    permission_id: pid,
                }))
                await admin.from('admin_sector_permissions').insert(links)
            }
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// DELETE — excluir setor
export async function DELETE(request: NextRequest) {
    try {
        const master = await verifyMaster()
        if (!master) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

        const admin = createAdminClient()
        const { error } = await admin.from('admin_sectors').delete().eq('id', id)
        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
