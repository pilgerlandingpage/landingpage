import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

const PILGER_GLOBAL_MANAGER_PERMISSION_KEYS = new Set([
  'whatsapp',
  'pilger_ai',
  'settings_users',
  'settings_sectors',
])

export async function verifyPilgerGlobalManagerAccess() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: adminUser } = await admin
    .from('admin_users')
    .select('id, is_master, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!adminUser?.is_active) return null
  if (adminUser.is_master) return adminUser

  const { data: userSectors } = await admin
    .from('admin_user_sectors')
    .select('sector_id')
    .eq('user_id', adminUser.id)

  const sectorIds = (userSectors || []).map((row: any) => row.sector_id).filter(Boolean)
  if (!sectorIds.length) return null

  const { data: sectorPerms } = await admin
    .from('admin_sector_permissions')
    .select('admin_permissions(module_key)')
    .in('sector_id', sectorIds)

  const canManage = (sectorPerms || []).some((row: any) =>
    PILGER_GLOBAL_MANAGER_PERMISSION_KEYS.has(row.admin_permissions?.module_key),
  )

  return canManage ? adminUser : null
}
