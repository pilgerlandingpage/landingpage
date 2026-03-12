import { NextResponse } from 'next/server'
import { createServerSupabase, createAdminClient } from '@/lib/supabase/server'

// GET — retorna permissões do usuário logado (para o sidebar)
export async function GET() {
    try {
        const supabase = await createServerSupabase()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = createAdminClient()

        // Buscar admin_user
        const { data: adminUser } = await admin
            .from('admin_users')
            .select('id, is_master, is_active, name, phone')
            .eq('auth_user_id', user.id)
            .single()

        // Se não existe admin_users entry, retornar permissões vazias
        if (!adminUser) {
            return NextResponse.json({
                is_master: false,
                is_active: true,
                permissions: [],
                sectors: [],
                user_name: user.user_metadata?.full_name || user.email,
            })
        }

        if (!adminUser.is_active) {
            return NextResponse.json({ error: 'Usuário desativado' }, { status: 403 })
        }

        // Se é master, retorna todas as permissões
        if (adminUser.is_master) {
            const { data: allPerms } = await admin
                .from('admin_permissions')
                .select('module_key, label, category')
                .order('category')

            return NextResponse.json({
                is_master: true,
                is_active: true,
                permissions: (allPerms || []).map((p: any) => p.module_key),
                permissions_detail: allPerms || [],
                sectors: [],
                user_name: adminUser.name,
                user_phone: adminUser.phone,
            })
        }

        // Buscar setores do usuário
        const { data: userSectors } = await admin
            .from('admin_user_sectors')
            .select('sector_id, admin_sectors(id, name, color, icon)')
            .eq('user_id', adminUser.id)

        const sectorIds = (userSectors || []).map((us: any) => us.sector_id)

        if (sectorIds.length === 0) {
            return NextResponse.json({
                is_master: false,
                is_active: true,
                permissions: [],
                sectors: [],
                user_name: adminUser.name,
                user_phone: adminUser.phone,
            })
        }

        // Buscar permissões dos setores
        const { data: sectorPerms } = await admin
            .from('admin_sector_permissions')
            .select('admin_permissions(module_key, label, category)')
            .in('sector_id', sectorIds)

        const permissions = [...new Set(
            (sectorPerms || []).map((sp: any) => sp.admin_permissions?.module_key).filter(Boolean)
        )]

        const sectors = (userSectors || []).map((us: any) => ({
            id: us.admin_sectors?.id,
            name: us.admin_sectors?.name,
            color: us.admin_sectors?.color,
            icon: us.admin_sectors?.icon,
        }))

        return NextResponse.json({
            is_master: false,
            is_active: true,
            permissions,
            sectors,
            user_name: adminUser.name,
            user_phone: adminUser.phone,
        })
    } catch (err: any) {
        console.error('Error fetching permissions:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
