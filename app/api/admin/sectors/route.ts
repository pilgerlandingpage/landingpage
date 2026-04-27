import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminClient } from '@/lib/supabase/server'

const SECTORS_SETTINGS_PERMISSION_KEYS = new Set([
    'settings_sectors',
    'gestao_de_setores',
    'setores',
    'sectors',
])
const PERMISSION_CANONICAL_KEY_MAP: Record<string, string> = {
    settings_users: 'settings_users',
    gestao_de_usuarios: 'settings_users',
    usuarios: 'settings_users',
    users: 'settings_users',
    settings_sectors: 'settings_sectors',
    gestao_de_setores: 'settings_sectors',
    setores: 'settings_sectors',
    sectors: 'settings_sectors',
}
const CANONICAL_PERMISSION_LABELS: Record<string, string> = {
    settings_users: 'Usuarios',
    settings_sectors: 'Setores',
}

function canonicalPermissionKey(moduleKey: string | null | undefined) {
    if (!moduleKey) return ''
    return PERMISSION_CANONICAL_KEY_MAP[moduleKey] || moduleKey
}

const ADMIN_MENU_PERMISSIONS = [
    {
        module_key: 'dashboard',
        label: 'Dashboards',
        description: 'Acessar Dashboard Geral e Dashboard Marketing',
        category: 'principal',
    },
    {
        module_key: 'funnel',
        label: 'Funil de Conversao',
        description: 'Acessar funil de conversao dos leads',
        category: 'marketing',
    },
    {
        module_key: 'finance',
        label: 'Financeiro',
        description: 'Acessar gestao financeira da empresa',
        category: 'financeiro',
    },
    {
        module_key: 'leads',
        label: 'Leads',
        description: 'Acessar leads e CRM do agente',
        category: 'marketing',
    },
    {
        module_key: 'landing_pages',
        label: 'Landing Pages',
        description: 'Gerenciar landing pages',
        category: 'marketing',
    },
    {
        module_key: 'properties',
        label: 'Imoveis',
        description: 'Gerenciar catalogo de imoveis',
        category: 'marketing',
    },
    {
        module_key: 'brokers',
        label: 'Corretores IA',
        description: 'Gerenciar corretores IA',
        category: 'automacao',
    },
    {
        module_key: 'automation',
        label: 'Automacoes',
        description: 'Acessar automacoes do sistema',
        category: 'automacao',
    },
    {
        module_key: 'push',
        label: 'Notificacoes',
        description: 'Gerenciar notificacoes push',
        category: 'automacao',
    },
    {
        module_key: 'ads',
        label: 'Trafego IA',
        description: 'Acessar Meta Ads, Google Ads e diagnosticos de IA',
        category: 'marketing',
    },
    {
        module_key: 'radar',
        label: 'Radar de Mercado',
        description: 'Acessar radar de mercado',
        category: 'marketing',
    },
    {
        module_key: 'whatsapp',
        label: 'WhatsApp Web',
        description: 'Gerenciar WhatsApp Web, campanhas, agenda e etiquetas',
        category: 'comunicacao',
    },
    {
        module_key: 'feedback',
        label: 'Feedback',
        description: 'Acessar feedbacks do sistema',
        category: 'sistema',
    },
    {
        module_key: 'maintenance',
        label: 'Sala de Manutencao',
        description: 'Acessar sala de manutencao e diagnosticos tecnicos',
        category: 'sistema',
    },
    {
        module_key: 'settings_sectors',
        label: 'Setores',
        description: 'Gerenciar setores e suas permissoes de acesso',
        category: 'sistema',
    },
    {
        module_key: 'settings_users',
        label: 'Usuarios',
        description: 'Gerenciar usuarios administrativos e vinculacao de setores',
        category: 'sistema',
    },
    {
        module_key: 'user_access',
        label: 'Auditoria de Acessos',
        description: 'Acessar monitoramento de logins, navegacao, IP e dispositivos',
        category: 'sistema',
    },
]

async function ensureSettingsPermissions(admin: any) {
    await admin.from('admin_permissions').upsert(
        ADMIN_MENU_PERMISSIONS,
        { onConflict: 'module_key' }
    )
}

async function verifySectorManagerAccess() {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return null

    const admin = createAdminClient()
    const { data: adminUser } = await admin
        .from('admin_users')
        .select('id, is_master, is_active')
        .eq('auth_user_id', user.id)
        .single()

    if (!adminUser?.is_active) return null

    if (adminUser.is_master) {
        return {
            ...adminUser,
            can_grant_master: true,
        }
    }

    const { data: userSectors } = await admin
        .from('admin_user_sectors')
        .select('sector_id')
        .eq('user_id', adminUser.id)

    const sectorIds = (userSectors || []).map((row: any) => row.sector_id)
    if (sectorIds.length === 0) return null

    const { data: sectorPerms } = await admin
        .from('admin_sector_permissions')
        .select('admin_permissions(module_key)')
        .in('sector_id', sectorIds)

    const hasSectorsPermission = (sectorPerms || []).some((row: any) =>
        SECTORS_SETTINGS_PERMISSION_KEYS.has(row.admin_permissions?.module_key)
    )

    if (!hasSectorsPermission) return null

    return {
        ...adminUser,
        can_grant_master: false,
    }
}

// GET - listar setores com permissoes
export async function GET() {
    try {
        const access = await verifySectorManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const admin = createAdminClient()
        await ensureSettingsPermissions(admin)

        const { data: sectors, error } = await admin
            .from('admin_sectors')
            .select('*')
            .order('name')

        if (error) throw error

        const { data: sectorPerms } = await admin
            .from('admin_sector_permissions')
            .select('sector_id, permission_id, admin_permissions(module_key, label, category)')

        const { data: allPermissions } = await admin
            .from('admin_permissions')
            .select('*')
            .order('category, label')

        const { data: userCounts } = await admin
            .from('admin_user_sectors')
            .select('sector_id')

        const countMap: Record<string, number> = {}
        for (const uc of userCounts || []) {
            countMap[uc.sector_id] = (countMap[uc.sector_id] || 0) + 1
        }

        const canonicalPermissionsMap = new Map<string, any>()
        for (const permission of allPermissions || []) {
            const canonicalKey = canonicalPermissionKey(permission.module_key)
            if (!canonicalKey) continue

            const current = canonicalPermissionsMap.get(canonicalKey)
            const candidate = {
                ...permission,
                module_key: canonicalKey,
                label: CANONICAL_PERMISSION_LABELS[canonicalKey] || permission.label,
            }
            const candidateScore = permission.module_key === canonicalKey ? 2 : 1
            const currentScore = current?._score || 0

            if (!current || candidateScore > currentScore) {
                canonicalPermissionsMap.set(canonicalKey, { ...candidate, _score: candidateScore })
            }
        }

        const canonicalPermissions = Array.from(canonicalPermissionsMap.values())
            .map(({ _score, ...permission }) => permission)
            .sort((a: any, b: any) =>
                `${a.category || ''} ${a.label || ''}`.localeCompare(`${b.category || ''} ${b.label || ''}`)
            )

        const canonicalPermissionByKey = new Map<string, any>()
        for (const permission of canonicalPermissions) {
            canonicalPermissionByKey.set(permission.module_key, permission)
        }

        const enriched = (sectors || []).map((s: any) => {
            const rawPerms = (sectorPerms || []).filter((sp: any) => sp.sector_id === s.id)
            const seen = new Set<string>()
            const perms: any[] = []

            for (const sp of rawPerms) {
                const rawPermission = sp.admin_permissions
                const canonicalKey = canonicalPermissionKey(rawPermission?.module_key)
                if (!canonicalKey || seen.has(canonicalKey)) continue
                seen.add(canonicalKey)

                const canonicalPermission = canonicalPermissionByKey.get(canonicalKey)
                perms.push({
                    id: canonicalPermission?.id || sp.permission_id,
                    module_key: canonicalKey,
                    label: canonicalPermission?.label || CANONICAL_PERMISSION_LABELS[canonicalKey] || rawPermission?.label,
                    category: canonicalPermission?.category || rawPermission?.category || 'principal',
                })
            }

            return {
                ...s,
                permissions: perms,
                user_count: countMap[s.id] || 0,
            }
        })

        return NextResponse.json({
            sectors: enriched,
            all_permissions: canonicalPermissions,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST - criar setor
export async function POST(request: NextRequest) {
    try {
        const access = await verifySectorManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const { name, description, color, icon, permission_ids } = await request.json()

        if (!name) return NextResponse.json({ error: 'Nome e obrigatorio' }, { status: 400 })

        const admin = createAdminClient()
        const { data: sector, error } = await admin
            .from('admin_sectors')
            .insert({ name, description, color, icon })
            .select()
            .single()

        if (error) throw error

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

// PUT - editar setor
export async function PUT(request: NextRequest) {
    try {
        const access = await verifySectorManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const { id, name, description, color, icon, permission_ids } = await request.json()
        if (!id) return NextResponse.json({ error: 'ID e obrigatorio' }, { status: 400 })

        const admin = createAdminClient()

        const { error } = await admin
            .from('admin_sectors')
            .update({ name, description, color, icon })
            .eq('id', id)

        if (error) throw error

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

// DELETE - excluir setor
export async function DELETE(request: NextRequest) {
    try {
        const access = await verifySectorManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID e obrigatorio' }, { status: 400 })

        const admin = createAdminClient()
        const { error } = await admin.from('admin_sectors').delete().eq('id', id)
        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
