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

export type MemberProduct = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  product_type: string
  status: string
  cover_image_url: string | null
  thumbnail_url: string | null
  sales_content?: Record<string, any> | null
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

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function isActiveEntitlement(entitlement: Pick<MemberEntitlement, 'status' | 'access_starts_at' | 'access_expires_at'> | null | undefined) {
  if (!entitlement || entitlement.status !== 'active') return false
  const now = Date.now()
  if (entitlement.access_starts_at && Date.parse(entitlement.access_starts_at) > now) return false
  if (entitlement.access_expires_at && Date.parse(entitlement.access_expires_at) < now) return false
  return true
}

async function loadMemberCatalogProducts(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  activeEntitlements: MemberEntitlement[]
): Promise<MemberCatalogProduct[]> {
  const { data: products, error: productError } = await admin
    .from('commerce_products')
    .select('id, slug, title, subtitle, description, product_type, status, cover_image_url, thumbnail_url, sales_content')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (productError) throw productError

  const productRows = (products || []) as MemberProduct[]
  const productIds = productRows.map((product) => product.id)

  const [offersRes, contentsRes] = productIds.length
    ? await Promise.all([
        admin
          .from('commerce_offers')
          .select('id, product_id, slug, name, description, price_cents, currency, checkout_path, metadata')
          .eq('status', 'active')
          .in('product_id', productIds)
          .order('price_cents', { ascending: true }),
        admin
          .from('commerce_product_contents')
          .select('product_id')
          .eq('is_active', true)
          .in('product_id', productIds),
      ])
    : [
        { data: [] as MemberOfferSummary[], error: null },
        { data: [] as Array<{ product_id: string }>, error: null },
      ]

  const error = offersRes.error || contentsRes.error
  if (error) throw error

  const offers = (offersRes.data || []) as MemberOfferSummary[]
  const entitlementByProduct = new Map(
    activeEntitlements.map((entitlement) => [entitlement.product_id, entitlement])
  )
  const contentCountByProduct = new Map<string, number>()

  for (const item of (contentsRes.data || []) as Array<{ product_id: string }>) {
    contentCountByProduct.set(item.product_id, (contentCountByProduct.get(item.product_id) || 0) + 1)
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
    const entitlement = entitlementByProduct.get(product.id) || null

    return {
      ...product,
      has_access: Boolean(entitlement),
      entitlement,
      offer,
      content_count: contentCountByProduct.get(product.id) || 0,
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
      admin: createSupabaseAdminClient(),
    }
  }

  const admin = createSupabaseAdminClient()
  const email = text(user.email).toLowerCase()
  let member: MemberAccount | null = null

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

  return { user, member, admin }
}

export async function loadMemberLibrary() {
  const { user, member, admin } = await resolveMemberSession()
  let activeEntitlements: MemberEntitlement[] = []

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

  const catalog = await loadMemberCatalogProducts(admin, activeEntitlements)

  return {
    user,
    member,
    entitlements: activeEntitlements,
    products: catalog.filter((product) => product.has_access),
    catalog,
  }
}

export async function loadMemberProduct(slug: string) {
  const { user, member, admin } = await resolveMemberSession()
  if (!user || !member || member.status !== 'active') {
    return {
      user,
      member,
      product: null as MemberProduct | null,
      entitlement: null as MemberEntitlement | null,
      contents: [] as MemberContent[],
      progress: [] as MemberProgress[],
    }
  }

  const { data: product, error: productError } = await admin
    .from('commerce_products')
    .select('id, slug, title, subtitle, description, product_type, status, cover_image_url, thumbnail_url, sales_content')
    .eq('slug', slug)
    .in('status', ['active', 'hidden'])
    .maybeSingle()

  if (productError) throw productError
  if (!product) {
    return { user, member, product: null, entitlement: null, contents: [], progress: [] }
  }

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
  const activeEntitlement = isActiveEntitlement(entitlement as MemberEntitlement | null)
    ? entitlement as MemberEntitlement
    : null

  if (!activeEntitlement) {
    return { user, member, product: product as MemberProduct, entitlement: null, contents: [], progress: [] }
  }

  const [contentsRes, progressRes] = await Promise.all([
    admin
      .from('commerce_product_contents')
      .select('*')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
    admin
      .from('member_content_progress')
      .select('*')
      .eq('member_account_id', member.id)
      .eq('product_id', product.id),
  ])

  const error = contentsRes.error || progressRes.error
  if (error) throw error

  return {
    user,
    member,
    product: product as MemberProduct,
    entitlement: activeEntitlement,
    contents: (contentsRes.data || []) as MemberContent[],
    progress: (progressRes.data || []) as MemberProgress[],
  }
}
