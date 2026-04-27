import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminClient } from '@/lib/supabase/server'

const DEFAULT_PERMISSION_CATEGORY = 'principal'
const ADMIN_MENU_PERMISSIONS = [
    { module_key: 'dashboard', label: 'Dashboards', description: 'Acessar Dashboard Geral e Dashboard Marketing', category: 'principal' },
    { module_key: 'funnel', label: 'Funil de Conversao', description: 'Acessar funil de conversao dos leads', category: 'marketing' },
    { module_key: 'finance', label: 'Financeiro', description: 'Acessar gestao financeira da empresa', category: 'financeiro' },
    { module_key: 'leads', label: 'Leads', description: 'Acessar leads e CRM do agente', category: 'marketing' },
    { module_key: 'landing_pages', label: 'Landing Pages', description: 'Gerenciar landing pages', category: 'marketing' },
    { module_key: 'properties', label: 'Imoveis', description: 'Gerenciar catalogo de imoveis', category: 'marketing' },
    { module_key: 'brokers', label: 'Corretores IA', description: 'Gerenciar corretores IA', category: 'automacao' },
    { module_key: 'automation', label: 'Automacoes', description: 'Acessar automacoes do sistema', category: 'automacao' },
    { module_key: 'push', label: 'Notificacoes', description: 'Gerenciar notificacoes push', category: 'automacao' },
    { module_key: 'ads', label: 'Trafego IA', description: 'Acessar Meta Ads, Google Ads e diagnosticos de IA', category: 'marketing' },
    { module_key: 'radar', label: 'Radar de Mercado', description: 'Acessar radar de mercado', category: 'marketing' },
    { module_key: 'whatsapp', label: 'WhatsApp Web', description: 'Gerenciar WhatsApp Web, campanhas, agenda e etiquetas', category: 'comunicacao' },
    { module_key: 'feedback', label: 'Feedback', description: 'Acessar feedbacks do sistema', category: 'sistema' },
    { module_key: 'maintenance', label: 'Sala de Manutencao', description: 'Acessar sala de manutencao e diagnosticos tecnicos', category: 'sistema' },
    { module_key: 'settings_sectors', label: 'Setores', description: 'Gerenciar setores e suas permissoes de acesso', category: 'sistema' },
    { module_key: 'settings_users', label: 'Usuarios', description: 'Gerenciar usuarios administrativos e vinculacao de setores', category: 'sistema' },
    { module_key: 'user_access', label: 'Auditoria de Acessos', description: 'Acessar monitoramento de logins, navegacao, IP e dispositivos', category: 'sistema' },
]
const SECTORS_SETTINGS_PERMISSION_KEYS = new Set([
    'settings_sectors',
    'gestao_de_setores',
    'setores',
    'sectors',
])

function normalizeModuleKey(input: string) {
    return input
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

async function ensureAdminMenuPermissions(admin: any) {
    await admin.from('admin_permissions').upsert(
        ADMIN_MENU_PERMISSIONS,
        { onConflict: 'module_key' }
    )
}

async function verifyPermissionTagManagerAccess() {
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
    if (adminUser.is_master) return adminUser

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

    const canManagePermissionTags = (sectorPerms || []).some((row: any) =>
        SECTORS_SETTINGS_PERMISSION_KEYS.has(row.admin_permissions?.module_key)
    )

    if (!canManagePermissionTags) return null
    return adminUser
}

// GET - retorna permissoes do usuario logado (sidebar)
export async function GET() {
    try {
        const supabase = await createServerSupabase()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = createAdminClient()
        await ensureAdminMenuPermissions(admin)

        // Buscar admin_user
        const { data: adminUser } = await admin
            .from('admin_users')
            .select('id, is_master, is_active, name, phone')
            .eq('auth_user_id', user.id)
            .single()

        // Se nao existe admin_users entry, retornar permissoes vazias
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
            return NextResponse.json({ error: 'Usuario desativado' }, { status: 403 })
        }

        // Se e master, retorna todas as permissoes
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

        // Buscar setores do usuario
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

        // Buscar permissoes dos setores
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

// POST - cria (ou atualiza) uma tag de acesso em admin_permissions
export async function POST(request: NextRequest) {
    try {
        const access = await verifyPermissionTagManagerAccess()
        if (!access) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const body = await request.json()
        const rawLabel = String(body?.label || '').trim()
        const rawModuleKey = String(body?.module_key || '').trim()
        const rawCategory = String(body?.category || '').trim()
        const rawDescription = String(body?.description || '').trim()

        if (!rawLabel) {
            return NextResponse.json({ error: 'Nome da tag e obrigatorio' }, { status: 400 })
        }

        const module_key = normalizeModuleKey(rawModuleKey || rawLabel)
        if (!module_key || module_key.length < 2) {
            return NextResponse.json({ error: 'Chave da tag invalida' }, { status: 400 })
        }

        const category = normalizeModuleKey(rawCategory) || DEFAULT_PERMISSION_CATEGORY
        const description = rawDescription || `Permissao de acesso: ${rawLabel}`

        const admin = createAdminClient()
        const { data, error } = await admin
            .from('admin_permissions')
            .upsert(
                {
                    module_key,
                    label: rawLabel,
                    category,
                    description,
                },
                { onConflict: 'module_key' }
            )
            .select('*')
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, permission: data }, { status: 201 })
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Erro ao salvar tag' }, { status: 500 })
    }
}
