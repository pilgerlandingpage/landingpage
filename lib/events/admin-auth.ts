import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

export type AdminActorContext = {
    actor_type: 'admin'
    actor_id: string | null
    actor_name: string | null
    actor_email: string | null
    auth_user_id: string | null
}

export async function requireAdminContext() {
    const authClient = await createServerSupabase()
    const { data: { user }, error } = await authClient.auth.getUser()

    if (error || !user) {
        return { ok: false as const, status: 401, error: 'Unauthorized' }
    }

    const admin = createAdminClient()
    const { data: adminUser } = await admin
        .from('admin_users')
        .select('id, auth_user_id, is_active, is_master, name, email')
        .eq('auth_user_id', user.id)
        .maybeSingle()

    if (adminUser && adminUser.is_active === false) {
        return { ok: false as const, status: 403, error: 'Usuario desativado' }
    }

    return {
        ok: true as const,
        admin,
        user,
        adminUser: adminUser || null,
    }
}

export async function getOptionalAdminActorContext(): Promise<AdminActorContext | null> {
    try {
        const ctx = await requireAdminContext()
        if (!ctx.ok) return null

        const adminUser = ctx.adminUser
        return {
            actor_type: 'admin',
            actor_id: adminUser?.id || null,
            actor_name: adminUser?.name || ctx.user.email || 'Administrador',
            actor_email: adminUser?.email || ctx.user.email || null,
            auth_user_id: ctx.user.id || null,
        }
    } catch (error) {
        console.warn('[Admin Auth] optional actor context unavailable:', error)
        return null
    }
}
