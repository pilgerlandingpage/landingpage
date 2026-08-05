import { loadCommerceConfig } from '@/lib/commerce/checkout'
import { loadMemberLibrary, type MemberCatalogProduct } from '@/lib/members/access'
import {
  ContinueLearningCard,
  EmptyLibraryState,
  ExploreProducts,
  LoginGateway,
  MemberFooter,
  MemberHeader,
  MemberHero,
  MemberLibrary,
  MemberMobileNavigation,
  MemberPlatformStyles,
  MemberSupportCard,
} from './member-platform'

export const dynamic = 'force-dynamic'

function displayName(params: {
  memberName?: string | null
  adminName?: string | null
  metadataName?: string | null
  email?: string | null
}) {
  return (
    params.memberName ||
    params.adminName ||
    params.metadataName ||
    params.email ||
    'Membro Guilherme Pilger'
  )
}

function lastAccessTime(product: MemberCatalogProduct) {
  const value = product.progress.last_accessed_at
  return value ? Date.parse(value) || 0 : 0
}

function findContinueProduct(products: MemberCatalogProduct[]) {
  return products
    .filter((product) => product.progress.source === 'backend' && lastAccessTime(product) > 0)
    .sort((a, b) => lastAccessTime(b) - lastAccessTime(a))[0] || null
}

function productExploreHref(product: MemberCatalogProduct | null) {
  if (!product) return '/corretor-nota-8'
  if (product.slug === 'perfil-corretor-ideal') {
    return '/membros/entrar?next=/membros/perfil-corretor-ideal'
  }

  return `/${product.slug}`
}

async function loadSupportHref() {
  try {
    const config = await loadCommerceConfig()
    if (!config.supportWhatsapp) return ''

    const message = encodeURIComponent('Olá! Preciso de ajuda com meu acesso à área de membros.')
    return `https://wa.me/${config.supportWhatsapp}?text=${message}`
  } catch (error) {
    console.error('[Members] Support config unavailable:', error)
    return ''
  }
}

export default async function MembersPage() {
  const [{ user, member, adminUser, adminPreview, products, catalog }, supportHref] = await Promise.all([
    loadMemberLibrary(),
    loadSupportHref(),
  ])

  const signedIn = Boolean(user)
  const memberName = displayName({
    memberName: member?.name,
    adminName: adminUser?.name,
    metadataName: user?.user_metadata?.name,
    email: user?.email,
  })
  const unlockedProducts = products
  const lockedProducts = catalog.filter((product) => !product.has_access)
  const continueProduct = findContinueProduct(unlockedProducts)
  const featuredExploreProduct = lockedProducts[0] || catalog.find((product) => product.slug === 'corretor-nota-8') || catalog[0] || null
  const exploreHref = productExploreHref(featuredExploreProduct)
  const loginHref = '/membros/entrar?next=/membros'
  const compactLibrary = Boolean(continueProduct && unlockedProducts.length === 1)

  return (
    <main className={`member-platform ${signedIn ? 'has-mobile-nav' : ''}`}>
      <MemberHeader
        signedIn={signedIn}
        memberName={memberName}
        memberEmail={user?.email || member?.email || null}
        hasExplore={lockedProducts.length > 0 || (!signedIn && catalog.length > 0)}
        loginHref={loginHref}
        exploreHref={exploreHref}
      />

      {signedIn ? (
        <MemberHero
          memberName={memberName}
          productCount={unlockedProducts.length}
          adminPreview={adminPreview}
        />
      ) : (
        <LoginGateway
          loginHref={loginHref}
          exploreHref={exploreHref}
          featuredProduct={featuredExploreProduct}
        />
      )}

      {signedIn && continueProduct && (
        <ContinueLearningCard product={continueProduct} adminPreview={adminPreview} />
      )}

      {signedIn && unlockedProducts.length > 0 ? (
        <MemberLibrary
          products={unlockedProducts}
          compact={compactLibrary}
          adminPreview={adminPreview}
        />
      ) : signedIn ? (
        <EmptyLibraryState exploreHref={exploreHref} />
      ) : null}

      {signedIn && lockedProducts.length > 0 && (
        <ExploreProducts
          products={lockedProducts}
          title={unlockedProducts.length ? 'Explore outros conteúdos' : 'Conteúdos disponíveis'}
        />
      )}

      <MemberSupportCard
        signedIn={signedIn}
        memberName={memberName}
        memberEmail={user?.email || member?.email || null}
        supportHref={supportHref}
      />

      <MemberFooter supportHref={supportHref} />
      {signedIn && <MemberMobileNavigation />}
      <MemberPlatformStyles />
    </main>
  )
}
