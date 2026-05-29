import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

export async function requireAdminContext() {
    const authClient = await createServerSupabase()
    const { data: { user }, error } = await authClient.auth.getUser()

    if (error || !user) {
        return { ok: false as const, status: 401, error: 'Unauthorized' }
    }

    const admin = createAdminClient()
    const { data: adminUser } = await admin
        .from('admin_users')
        .select('id, is_active, is_master, name')
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
