import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

type RequireAdminResult =
  | { ok: true; admin: ReturnType<typeof createAdminClient>; adminUser: Record<string, any> }
  | { ok: false; response: NextResponse }

export async function requireAdminModules(moduleKeys: string[]): Promise<RequireAdminResult> {
  const supabase = await createServerSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const admin = createAdminClient()
  const { data: adminUser, error: adminUserError } = await admin
    .from('admin_users')
    .select('id, is_master, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (adminUserError || !adminUser?.is_active) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 }),
    }
  }

  if (adminUser.is_master) return { ok: true, admin, adminUser }

  const { data: userSectors, error: sectorsError } = await admin
    .from('admin_user_sectors')
    .select('sector_id')
    .eq('user_id', adminUser.id)

  if (sectorsError) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: sectorsError.message }, { status: 500 }),
    }
  }

  const sectorIds = (userSectors || []).map((row: any) => row.sector_id).filter(Boolean)
  if (!sectorIds.length) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 }),
    }
  }

  const { data: sectorPerms, error: permsError } = await admin
    .from('admin_sector_permissions')
    .select('admin_permissions(module_key)')
    .in('sector_id', sectorIds)

  if (permsError) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: permsError.message }, { status: 500 }),
    }
  }

  const allowed = new Set(moduleKeys)
  const hasAccess = (sectorPerms || []).some((row: any) => allowed.has(row.admin_permissions?.module_key))
  if (!hasAccess) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 }),
    }
  }

  return { ok: true, admin, adminUser }
}
