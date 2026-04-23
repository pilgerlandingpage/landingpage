import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminClient } from '@/lib/supabase/server'

const USERS_SETTINGS_PERMISSION_KEYS = new Set([
    'settings_users',
    'gestao_de_usuarios',
    'usuarios',
    'users',
])

// Helper: verify if logged user can manage users
async function verifyUserManagerAccess() {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

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

    const hasUsersPermission = (sectorPerms || []).some((row: any) =>
        USERS_SETTINGS_PERMISSION_KEYS.has(row.admin_permissions?.module_key)
    )

    if (!hasUsersPermission) return null

    return {
        ...adminUser,
        can_grant_master: false,
    }
}

// Helper: sync admin_alert_contacts based on sector assignments
async function syncAlertContacts(admin: any, userId: string, name: string, phone: string | null) {
    if (!phone) return

    // Check if user has 'ads' permission through any sector
    const { data: userSectors } = await admin
        .from('admin_user_sectors')
        .select('sector_id')
        .eq('user_id', userId)

    const sectorIds = (userSectors || []).map((us: any) => us.sector_id)

    let hasAdsPermission = false
    if (sectorIds.length > 0) {
        const { data: perms } = await admin
            .from('admin_sector_permissions')
            .select('admin_permissions(module_key)')
            .in('sector_id', sectorIds)

        hasAdsPermission = (perms || []).some(
            (p: any) => p.admin_permissions?.module_key === 'ads'
        )
    }

    if (hasAdsPermission) {
        // Upsert into admin_alert_contacts
        const { data: existing } = await admin
            .from('admin_alert_contacts')
            .select('id')
            .eq('phone', phone)
            .single()

        if (existing) {
            await admin.from('admin_alert_contacts')
                .update({ name, is_active: true })
                .eq('id', existing.id)
        } else {
            await admin.from('admin_alert_contacts').insert({
                name,
                phone,
                receive_traffic_alerts: true,
                receive_budget_alerts: true,
                receive_ai_actions: true,
                min_urgency: 'medium',
                is_active: true,
            })
        }
    } else {
        // Deactivate if exists
        await admin.from('admin_alert_contacts')
            .update({ is_active: false })
            .eq('phone', phone)
    }
}

// GET - list all admin users with sectors
export async function GET() {
    try {
        const access = await verifyUserManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const admin = createAdminClient()

        const { data: users, error } = await admin
            .from('admin_users')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error

        // Fetch sector assignments for all users
        const { data: userSectors } = await admin
            .from('admin_user_sectors')
            .select('user_id, sector_id, admin_sectors(id, name, color, icon)')

        // Map sectors to users
        const enriched = (users || []).map((u: any) => ({
            ...u,
            sectors: (userSectors || [])
                .filter((us: any) => us.user_id === u.id)
                .map((us: any) => us.admin_sectors)
                .filter(Boolean),
        }))

        return NextResponse.json(enriched)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST - create a new user
export async function POST(request: NextRequest) {
    try {
        const access = await verifyUserManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const { email, password, name, phone, sector_ids, is_master: newIsMaster } = await request.json()

        if (!access.can_grant_master && Boolean(newIsMaster)) {
            return NextResponse.json({ error: 'Somente super admin pode criar usuario master.' }, { status: 403 })
        }

        if (!email || !password) {
            return NextResponse.json({ error: 'Email e senha sao obrigatorios.' }, { status: 400 })
        }
        if (password.length < 6) {
            return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
        }

        const admin = createAdminClient()

        // 1. Create auth user
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: name || '',
                phone: phone || null,
            },
        })

        if (authError) throw authError

        // 2. Create admin_users record
        const { data: adminUser, error: insertErr } = await admin
            .from('admin_users')
            .insert({
                auth_user_id: authData.user.id,
                name: name || email,
                email,
                phone: phone || null,
                is_master: access.can_grant_master ? Boolean(newIsMaster) : false,
            })
            .select()
            .single()

        if (insertErr) throw insertErr

        // 3. Assign sectors
        if (sector_ids && sector_ids.length > 0) {
            const links = sector_ids.map((sid: string) => ({
                user_id: adminUser.id,
                sector_id: sid,
            }))
            await admin.from('admin_user_sectors').insert(links)

            // 4. Sync alert contacts
            await syncAlertContacts(admin, adminUser.id, adminUser.name, adminUser.phone)
        }

        return NextResponse.json(
            {
                message: 'Usuario criado com sucesso',
                user: adminUser,
            },
            { status: 201 }
        )
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// PUT - update an existing user
export async function PUT(request: NextRequest) {
    try {
        const access = await verifyUserManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const {
            id,
            name,
            phone,
            is_active,
            is_master: newIsMaster,
            sector_ids,
            shadow_agent_prompt,
            shadow_agent_enabled,
            available_from,
            available_until,
            transfer_message,
        } = await request.json()

        if (!id) return NextResponse.json({ error: 'ID e obrigatorio' }, { status: 400 })

        const admin = createAdminClient()
        const { data: targetUser, error: targetUserError } = await admin
            .from('admin_users')
            .select('id, is_master, is_active')
            .eq('id', id)
            .single()

        if (targetUserError || !targetUser) {
            return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 })
        }

        if (!access.can_grant_master) {
            if (newIsMaster !== undefined) {
                return NextResponse.json({ error: 'Somente super admin pode alterar perfil master.' }, { status: 403 })
            }

            // Perfis sem privilegio master nao podem desativar super admin.
            if (targetUser.is_master && is_active === false) {
                return NextResponse.json({ error: 'Somente super admin pode desativar outro super admin.' }, { status: 403 })
            }
        }

        // Update admin_users
        const updateData: any = { updated_at: new Date().toISOString() }
        if (name !== undefined) updateData.name = name
        if (phone !== undefined) updateData.phone = phone
        if (is_active !== undefined) updateData.is_active = is_active
        if (newIsMaster !== undefined && access.can_grant_master) updateData.is_master = newIsMaster
        if (shadow_agent_prompt !== undefined) updateData.shadow_agent_prompt = shadow_agent_prompt
        if (shadow_agent_enabled !== undefined) updateData.shadow_agent_enabled = shadow_agent_enabled
        if (available_from !== undefined) updateData.available_from = available_from
        if (available_until !== undefined) updateData.available_until = available_until
        if (transfer_message !== undefined) updateData.transfer_message = transfer_message

        const { error } = await admin.from('admin_users').update(updateData).eq('id', id)
        if (error) throw error

        // Update sectors
        if (sector_ids !== undefined) {
            await admin.from('admin_user_sectors').delete().eq('user_id', id)

            if (sector_ids.length > 0) {
                const links = sector_ids.map((sid: string) => ({
                    user_id: id,
                    sector_id: sid,
                }))
                await admin.from('admin_user_sectors').insert(links)
            }
        }

        // Fetch updated user to sync alerts
        const { data: updatedUser } = await admin.from('admin_users').select('*').eq('id', id).single()
        if (updatedUser) {
            await syncAlertContacts(admin, id, updatedUser.name, updatedUser.phone)
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
