import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export type MemberAccount = {
  id: string
  auth_user_id: string | null
  customer_id: string | null
  email: string | null
  name: string | null
  status: string
  metadata?: Record<string, any> | null
}

export type MemberAdminUser = {
  id: string
  auth_user_id: string | null
  email: string | null
  name: string | null
  is_active: boolean
  is_master: boolean
}

export type MemberProduct = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  product_type: string
  status: string
  access_model?: string | null
  cover_image_url: string | null
  thumbnail_url: string | null
  sales_content?: Record<string, any> | null
  metadata?: Record<string, any> | null
}

export type MemberOfferSummary = {
  id: string
  product_id: string
  slug: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  checkout_path: string | null
  metadata?: Record<string, any> | null
}

export type MemberCatalogProduct = MemberProduct & {
  has_access: boolean
  entitlement: MemberEntitlement | null
  offer: MemberOfferSummary | null
  content_count: number
  progress: MemberProductProgressSummary
}

export type MemberEntitlement = {
  id: string
  member_account_id: string | null
  customer_id: string | null
  product_id: string
  order_id: string | null
  status: string
  access_starts_at: string | null
  access_expires_at: string | null
  granted_at: string | null
  metadata: Record<string, any> | null
}

export type MemberContent = {
  id: string
  product_id: string
  parent_id: string | null
  content_type: string
  title: string
  description: string | null
  body: string | null
  asset_url: string | null
  asset_storage_path: string | null
  duration_seconds: number | null
  position: number
  is_preview: boolean
  is_active: boolean
  metadata: Record<string, any> | null
}

export type MemberProgress = {
  id: string
  member_account_id: string
  product_id: string
  product_content_id: string
  status: 'not_started' | 'in_progress' | 'completed'
  progress_percent: number
  last_position_seconds: number
  completed_at: string | null
  updated_at: string
}

export type MemberProductProgressSummary = {
  status: 'not_started' | 'in_progress' | 'completed'
  progress_percent: number | null
  completed_count: number
  tracked_count: number
  content_count: number
  last_accessed_at: string | null
  last_content_title: string | null
  source: 'backend' | null
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

const MEMBER_PRODUCT_SELECT = 'id, slug, title, subtitle, description, product_type, status, access_model, cover_image_url, thumbnail_url, sales_content, metadata'

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

export function isFreeMemberProduct(product: Pick<MemberProduct, 'sales_content' | 'metadata'> | null | undefined) {
  const salesContent = objectRecord(product?.sales_content)
  const metadata = objectRecord(product?.metadata)

  return (
    salesContent.member_access === 'free' ||
    salesContent.member_access === 'free_for_members' ||
    salesContent.access === 'free' ||
    metadata.member_access === 'free' ||
    metadata.free_member_access === true ||
    metadata.is_free_member_product === true
  )
}

export function isActiveEntitlement(entitlement: Pick<MemberEntitlement, 'status' | 'access_starts_at' | 'access_expires_at'> | null | undefined) {
  if (!entitlement || entitlement.status !== 'active') return false
  const now = Date.now()
  if (entitlement.access_starts_at && Date.parse(entitlement.access_starts_at) > now) return false
  if (entitlement.access_expires_at && Date.parse(entitlement.access_expires_at) < now) return false
  return true
}

function freeMemberEntitlement(productId: string, memberAccountId?: string | null): MemberEntitlement {
  return {
    id: `free-member-access-${productId}`,
    member_account_id: memberAccountId || null,
    customer_id: null,
    product_id: productId,
    order_id: null,
    status: 'active',
    access_starts_at: null,
    access_expires_at: null,
    granted_at: null,
    metadata: { source: 'free_member_access' },
  }
}

async function loadMemberCatalogProducts(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  activeEntitlements: MemberEntitlement[],
  grantAllAccess = false,
  memberAccountId?: string | null
): Promise<MemberCatalogProduct[]> {
  const { data: products, error: productError } = await admin
    .from('commerce_products')
    .select(MEMBER_PRODUCT_SELECT)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (productError) throw productError

  const productRows = (products || []) as MemberProduct[]
  const productIds = productRows.map((product) => product.id)

  const [offersRes, contentsRes, progressRes] = productIds.length
    ? await Promise.all([
        admin
          .from('commerce_offers')
          .select('id, product_id, slug, name, description, price_cents, currency, checkout_path, metadata')
          .eq('status', 'active')
          .in('product_id', productIds)
          .order('price_cents', { ascending: true }),
        admin
          .from('commerce_product_contents')
          .select('id, product_id, content_type, title')
          .eq('is_active', true)
          .in('product_id', productIds),
        memberAccountId
          ? admin
            .from('member_content_progress')
            .select('product_id, product_content_id, status, progress_percent, updated_at')
            .eq('member_account_id', memberAccountId)
            .in('product_id', productIds)
          : Promise.resolve({ data: [] as Array<Pick<MemberProgress, 'product_id' | 'product_content_id' | 'status' | 'progress_percent' | 'updated_at'>>, error: null }),
      ])
    : [
        { data: [] as MemberOfferSummary[], error: null },
        { data: [] as Array<{ id: string; product_id: string; content_type: string; title: string }>, error: null },
        { data: [] as Array<Pick<MemberProgress, 'product_id' | 'product_content_id' | 'status' | 'progress_percent' | 'updated_at'>>, error: null },
      ]

  const error = offersRes.error || contentsRes.error || progressRes.error
  if (error) throw error

  const offers = (offersRes.data || []) as MemberOfferSummary[]
  const entitlementByProduct = new Map(
    activeEntitlements.map((entitlement) => [entitlement.product_id, entitlement])
  )
  const contentCountByProduct = new Map<string, number>()
  const contentTitleById = new Map<string, string>()
  const progressRowsByProduct = new Map<string, Array<Pick<MemberProgress, 'product_id' | 'product_content_id' | 'status' | 'progress_percent' | 'updated_at'>>>()

  for (const item of (contentsRes.data || []) as Array<{ id: string; product_id: string; content_type: string; title: string }>) {
    contentCountByProduct.set(item.product_id, (contentCountByProduct.get(item.product_id) || 0) + 1)
    contentTitleById.set(item.id, item.title)
  }

  for (const item of (progressRes.data || []) as Array<Pick<MemberProgress, 'product_id' | 'product_content_id' | 'status' | 'progress_percent' | 'updated_at'>>) {
    const rows = progressRowsByProduct.get(item.product_id) || []
    rows.push(item)
    progressRowsByProduct.set(item.product_id, rows)
  }

  function progressSummary(productId: string): MemberProductProgressSummary {
    const contentCount = contentCountByProduct.get(productId) || 0
    const rows = progressRowsByProduct.get(productId) || []
    const completedCount = rows.filter((row) => row.status === 'completed').length
    const latest = rows
      .filter((row) => row.updated_at)
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] || null
    const rawPercent = contentCount
      ? rows.reduce((total, row) => total + Number(row.progress_percent || 0), 0) / contentCount
      : rows.reduce((max, row) => Math.max(max, Number(row.progress_percent || 0)), 0)
    const percent = rows.length ? Math.max(0, Math.min(100, Math.round(rawPercent))) : null
    const status = !rows.length
      ? 'not_started'
      : contentCount > 0 && completedCount >= contentCount
        ? 'completed'
        : 'in_progress'

    return {
      status,
      progress_percent: percent,
      completed_count: completedCount,
      tracked_count: rows.length,
      content_count: contentCount,
      last_accessed_at: latest?.updated_at || null,
      last_content_title: latest ? contentTitleById.get(latest.product_content_id) || null : null,
      source: rows.length ? 'backend' : null,
    }
  }

  return productRows.map((product) => {
    const offer = offers
      .filter((item) => item.product_id === product.id)
      .sort((a, b) => {
        const aPrimary = a.checkout_path === `/checkout/${product.slug}` ? 1 : 0
        const bPrimary = b.checkout_path === `/checkout/${product.slug}` ? 1 : 0
        if (aPrimary !== bPrimary) return bPrimary - aPrimary
        return Number(a.price_cents || 0) - Number(b.price_cents || 0)
      })[0] || null
    const freeAccess = isFreeMemberProduct(product)
    const entitlement = entitlementByProduct.get(product.id) || (freeAccess ? freeMemberEntitlement(product.id, memberAccountId) : null)

    return {
      ...product,
      has_access: grantAllAccess || freeAccess || Boolean(entitlement),
      entitlement,
      offer,
      content_count: contentCountByProduct.get(product.id) || 0,
      progress: progressSummary(product.id),
    }
  })
}

export async function resolveMemberSession() {
  const authClient = await createServerSupabase()
  const { data: { user }, error: userError } = await authClient.auth.getUser()
  if (userError || !user) {
    return {
      user: null,
      member: null as MemberAccount | null,
      adminUser: null as MemberAdminUser | null,
      admin: createSupabaseAdminClient(),
    }
  }

  const admin = createSupabaseAdminClient()
  const email = text(user.email).toLowerCase()
  let member: MemberAccount | null = null
  let adminUser: MemberAdminUser | null = null

  const { data: activeAdminUser, error: adminUserError } = await admin
    .from('admin_users')
    .select('id, auth_user_id, email, name, is_active, is_master')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (adminUserError) throw adminUserError
  adminUser = activeAdminUser as MemberAdminUser | null

  const { data: memberByAuth, error: authError } = await admin
    .from('member_accounts')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (authError) throw authError
  member = memberByAuth as MemberAccount | null

  if (!member && email) {
    const { data: memberByEmail, error: emailError } = await admin
      .from('member_accounts')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (emailError) throw emailError
    member = memberByEmail as MemberAccount | null
  }

  if (member && !member.auth_user_id) {
    const { data: linked, error: linkError } = await admin
      .from('member_accounts')
      .update({
        auth_user_id: user.id,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.id)
      .select('*')
      .single()

    if (linkError) throw linkError
    member = linked as MemberAccount
  } else if (member) {
    await admin
      .from('member_accounts')
      .update({
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.id)
  }

  return { user, member, adminUser, admin }
}

export async function loadMemberLibrary() {
  const { user, member, adminUser, admin } = await resolveMemberSession()
  let activeEntitlements: MemberEntitlement[] = []
  const adminPreview = Boolean(user && adminUser?.is_active)

  if (user && member && member.status === 'active') {
    const { data: entitlements, error: entitlementError } = await admin
      .from('member_entitlements')
      .select('*')
      .eq('member_account_id', member.id)
      .eq('status', 'active')
      .order('granted_at', { ascending: false })

    if (entitlementError) throw entitlementError
    activeEntitlements = ((entitlements || []) as MemberEntitlement[]).filter(isActiveEntitlement)
  }

  const catalog = await loadMemberCatalogProducts(admin, activeEntitlements, adminPreview, member?.id || null)

  return {
    user,
    member,
    adminUser,
    adminPreview,
    entitlements: activeEntitlements,
    products: catalog.filter((product) => product.has_access),
    catalog,
  }
}

export async function loadMemberProduct(slug: string) {
  const { user, member, adminUser, admin } = await resolveMemberSession()
  const adminPreview = Boolean(user && adminUser?.is_active)

  if (!user) {
    return {
      user,
      member,
      adminUser,
      adminPreview,
      product: null as MemberProduct | null,
      entitlement: null as MemberEntitlement | null,
      contents: [] as MemberContent[],
      progress: [] as MemberProgress[],
    }
  }

  const { data: product, error: productError } = await admin
    .from('commerce_products')
    .select(MEMBER_PRODUCT_SELECT)
    .eq('slug', slug)
    .in('status', ['active', 'hidden'])
    .maybeSingle()

  if (productError) throw productError
  if (!product) {
    return { user, member, adminUser, adminPreview, product: null, entitlement: null, contents: [], progress: [] }
  }

  let activeEntitlement: MemberEntitlement | null = null
  const memberProduct = product as MemberProduct
  const freeAccess = isFreeMemberProduct(memberProduct)

  if (member?.id) {
    const { data: entitlement, error: entitlementError } = await admin
      .from('member_entitlements')
      .select('*')
      .eq('member_account_id', member.id)
      .eq('product_id', product.id)
      .eq('status', 'active')
      .order('granted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (entitlementError) throw entitlementError
    activeEntitlement = isActiveEntitlement(entitlement as MemberEntitlement | null)
      ? entitlement as MemberEntitlement
      : null
  }

  if (!activeEntitlement && freeAccess) {
    activeEntitlement = freeMemberEntitlement(product.id, member?.id || null)
  }

  if (!activeEntitlement && adminPreview) {
    activeEntitlement = {
      id: `admin-preview-${product.id}`,
      member_account_id: member?.id || null,
      customer_id: null,
      product_id: product.id,
      order_id: null,
      status: 'active',
      access_starts_at: null,
      access_expires_at: null,
      granted_at: null,
      metadata: {
        source: 'admin_preview',
        admin_user_id: adminUser?.id || null,
      },
    }
  }

  if (!activeEntitlement) {
    return { user, member, adminUser, adminPreview, product: memberProduct, entitlement: null, contents: [], progress: [] }
  }

  const contentsPromise = admin
    .from('commerce_product_contents')
    .select('*')
    .eq('product_id', product.id)
    .eq('is_active', true)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  const progressPromise = member?.id
    ? admin
      .from('member_content_progress')
      .select('*')
      .eq('member_account_id', member.id)
      .eq('product_id', product.id)
    : Promise.resolve({ data: [] as MemberProgress[], error: null })

  const [contentsRes, progressRes] = await Promise.all([contentsPromise, progressPromise])

  const error = contentsRes.error || progressRes.error
  if (error) throw error

  return {
    user,
    member,
    adminUser,
    adminPreview,
    product: memberProduct,
    entitlement: activeEntitlement,
    contents: (contentsRes.data || []) as MemberContent[],
    progress: (progressRes.data || []) as MemberProgress[],
  }
}
