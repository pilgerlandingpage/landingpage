import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  Home,
  LibraryBig,
  LockKeyhole,
  LogIn,
  Play,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { isFreeMemberProduct, type MemberCatalogProduct } from '@/lib/members/access'
import MemberLogoutButton from './MemberLogoutButton'

const HERO_PHOTO = '/images/products/corretor-nota-8-guilherme-hero-optimized.jpg'
const HERO_BG = '/images/products/corretor-nota-8-hero-bg-optimized.jpg'

function firstName(name?: string | null, email?: string | null) {
  const source = String(name || email || '').trim()
  return source.split(/\s+/).filter(Boolean)[0] || 'membro'
}

function initials(name?: string | null, email?: string | null) {
  const source = String(name || email || 'Membro').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GP'
}

function productKind(type?: string | null) {
  if (type === 'ebook') return 'Livro digital'
  if (type === 'course') return 'Treinamento'
  if (type === 'mentorship') return 'Mentoria'
  if (type === 'digital_download') return 'Ferramenta digital'
  if (type === 'bundle') return 'Coleção'
  return 'Conteúdo digital'
}

function contentLabel(product: MemberCatalogProduct) {
  if (!product.content_count) return 'Acesso digital'
  return `${product.content_count} conteúdo${product.content_count === 1 ? '' : 's'}`
}

function formatPrice(product: MemberCatalogProduct) {
  if (!product.offer) return ''
  if (Number(product.offer.price_cents || 0) === 0) return 'Gratuito'

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: product.offer.currency || 'BRL',
  }).format(Number(product.offer.price_cents || 0) / 100)
}

function formatDate(value?: string | null) {
  if (!value) return ''

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

function productImage(product: MemberCatalogProduct) {
  return product.thumbnail_url || product.cover_image_url || ''
}

function memberProductHref(product: MemberCatalogProduct) {
  return product.has_access ? `/membros/${product.slug}` : `/${product.slug}`
}

function accessBadge(product: MemberCatalogProduct, adminPreview?: boolean) {
  if (adminPreview && product.has_access) return 'Preview admin'
  if (!product.has_access) return 'Disponível para adquirir'
  if (isFreeMemberProduct(product)) return 'Gratuito liberado'
  if (product.progress.status === 'completed') return 'Concluído'
  if (product.progress.source === 'backend' && Number(product.progress.progress_percent || 0) > 0) return 'Em andamento'
  return 'Disponível'
}

function actionLabel(product: MemberCatalogProduct, adminPreview?: boolean) {
  if (!product.has_access) return 'Conhecer conteúdo'
  if (product.slug === 'perfil-corretor-ideal') return 'Abrir diagnóstico'
  if (adminPreview) return 'Abrir preview'
  if (product.progress.source === 'backend' && Number(product.progress.progress_percent || 0) > 0) return 'Continuar'
  return 'Começar'
}

function progressPercent(product: MemberCatalogProduct) {
  return Math.max(0, Math.min(100, Number(product.progress.progress_percent || 0)))
}

function hasBackendProgress(product: MemberCatalogProduct) {
  return product.progress.source === 'backend' && product.progress.progress_percent !== null
}

export function MemberHeader({
  signedIn,
  memberName,
  memberEmail,
  hasExplore,
  loginHref,
  exploreHref,
}: {
  signedIn: boolean
  memberName: string
  memberEmail?: string | null
  hasExplore: boolean
  loginHref: string
  exploreHref: string
}) {
  return (
    <header className="member-header">
      <Link href="/membros" className="member-brand" aria-label="Guilherme Pilger, área de membros">
        <span className="member-brand-mark" aria-hidden="true">GP</span>
        <span className="member-brand-copy">
          <strong>Guilherme Pilger</strong>
          <small>Área de membros</small>
        </span>
      </Link>

      <nav className="member-nav" aria-label="Navegação da área de membros">
        <Link href="#inicio">Início</Link>
        {signedIn && <Link href="#biblioteca">Minha biblioteca</Link>}
        {hasExplore && <Link href={signedIn ? '#explorar' : exploreHref}>Explorar</Link>}
        <Link href="#suporte">Ajuda</Link>
      </nav>

      <div className="member-header-actions">
        {signedIn ? (
          <details className="member-account-menu">
            <summary aria-label="Abrir menu da conta">
              <span>{initials(memberName, memberEmail)}</span>
              <strong>{firstName(memberName, memberEmail)}</strong>
            </summary>
            <div className="member-account-popover">
              <Link href="#biblioteca">Meus acessos</Link>
              <Link href="#suporte">Suporte</Link>
              <MemberLogoutButton />
            </div>
          </details>
        ) : (
          <>
            {hasExplore && <Link href={exploreHref} className="member-header-link">Conhecer conteúdos</Link>}
            <Link href={loginHref} className="member-login-button">
              Entrar
            </Link>
          </>
        )}
      </div>
    </header>
  )
}

export function LoginGateway({
  loginHref,
  exploreHref,
  featuredProduct,
}: {
  loginHref: string
  exploreHref: string
  featuredProduct: MemberCatalogProduct | null
}) {
  return (
    <section id="inicio" className="member-login-gateway" aria-labelledby="member-login-title">
      <div className="member-login-copy">
        <span className="member-badge">
          <Sparkles size={15} />
          Área de membros
        </span>
        <h1 id="member-login-title">Acesse seus conteúdos.</h1>
        <p>
          Entre com a conta vinculada ao e-mail utilizado na compra para acessar seus livros,
          métodos e treinamentos de Guilherme Pilger.
        </p>
      </div>

      <div className="member-login-visual">
        <img src={HERO_PHOTO} alt="Guilherme Pilger" width={460} height={520} />
      </div>

      <aside className="member-auth-panel" aria-label="Entrada da área de membros">
        <span>Entrada segura</span>
        <h2>Conta vinculada à compra</h2>
        <p>Use o mesmo e-mail informado no checkout. A liberação acontece pelas regras de acesso já cadastradas.</p>
        <Link href={loginHref} className="member-primary-action">
          Entrar na minha conta
          <LogIn size={17} />
        </Link>
        <Link href={exploreHref} className="member-inline-link">
          Ainda não possui um conteúdo? Conheça os produtos.
        </Link>
      </aside>

      {featuredProduct && (
        <Link href={exploreHref} className="member-login-product">
          <span>{productKind(featuredProduct.product_type)}</span>
          <strong>{featuredProduct.title}</strong>
          <small>{featuredProduct.subtitle || featuredProduct.description}</small>
          <em>{formatPrice(featuredProduct) || 'Conhecer conteúdo'}</em>
        </Link>
      )}
    </section>
  )
}

export function MemberHero({
  memberName,
  productCount,
  adminPreview,
}: {
  memberName: string
  productCount: number
  adminPreview: boolean
}) {
  const hasProducts = productCount > 0
  const greeting = hasProducts ? `Olá, ${firstName(memberName)}` : 'Área de membros'
  const title = hasProducts
    ? 'Sua biblioteca'
    : 'Conteúdos Pilger'
  const copy = hasProducts
    ? 'Livros, métodos e ferramentas de Guilherme Pilger em um só lugar.'
    : 'Livros, métodos e conteúdos para atuar no mercado imobiliário de alto padrão.'

  return (
    <section id="inicio" className="member-hero" aria-labelledby="member-hero-title">
      <div className="member-hero-copy">
        <span className="member-badge">
          <Sparkles size={15} />
          {hasProducts ? 'Área de membros' : 'Conteúdos de Guilherme Pilger'}
        </span>
        <span className="member-greeting">{greeting}</span>
        <h1 id="member-hero-title">{title}</h1>
        <p>{copy}</p>
        <div id="acessos" className="member-hero-facts" aria-label="Resumo da conta">
          <div>
            <strong>{productCount}</strong>
            <span>{productCount === 1 ? 'conteúdo liberado' : 'conteúdos liberados'}</span>
          </div>
          <div>
            <strong>{adminPreview ? 'Admin' : hasProducts ? 'Verificado' : 'Aguardando'}</strong>
            <span>{adminPreview ? 'modo de revisão' : hasProducts ? 'acesso ativo' : 'liberação de compra'}</span>
          </div>
        </div>
      </div>

      <div className="member-hero-panel">
        <img src={HERO_PHOTO} alt="Guilherme Pilger" width={500} height={560} />
        <div className="member-hero-panel-copy">
          <span>Guilherme Pilger</span>
          <strong>Biblioteca digital privada</strong>
        </div>
      </div>
    </section>
  )
}

export function ContinueLearningCard({
  product,
  adminPreview,
}: {
  product: MemberCatalogProduct
  adminPreview: boolean
}) {
  const percent = progressPercent(product)
  const lastAccess = formatDate(product.progress.last_accessed_at)

  return (
    <section className="member-section" aria-labelledby="continue-title">
      <div className="member-section-head">
        <span>Atividade recente</span>
        <h2 id="continue-title">Continue de onde parou</h2>
      </div>

      <article className="member-continue-card">
        <ProductCover product={product} />
        <div className="member-continue-copy">
          <span>{productKind(product.product_type)}</span>
          <h3>{product.title}</h3>
          <p>{product.subtitle || product.description}</p>
          <div className="member-product-meta">
            <small>{contentLabel(product)}</small>
            {product.progress.last_content_title && <small>Último conteúdo: {product.progress.last_content_title}</small>}
            {lastAccess && <small>Último acesso: {lastAccess}</small>}
          </div>
          {!adminPreview && (
            <div className="member-progress" aria-label={`Progresso ${percent}%`}>
              <span style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
        <div className="member-continue-action">
          {!adminPreview && <strong>{percent}%</strong>}
          <Link href={`/membros/${product.slug}`} className="member-primary-action">
            Continuar leitura
            <Play size={16} fill="currentColor" />
          </Link>
        </div>
      </article>
    </section>
  )
}

export function EmptyLibraryState({ exploreHref }: { exploreHref: string }) {
  return (
    <section id="biblioteca" className="member-section" aria-labelledby="empty-library-title">
      <div className="member-empty-state">
        <BookOpen size={34} />
        <span>Minha biblioteca</span>
        <h2 id="empty-library-title">Sua biblioteca ainda está vazia.</h2>
        <p>Quando um conteúdo for liberado para esta conta, ele aparecerá aqui.</p>
        <Link href={exploreHref} className="member-primary-action">
          Conhecer conteúdos
          <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  )
}

export function MemberLibrary({
  products,
  compact,
  adminPreview,
}: {
  products: MemberCatalogProduct[]
  compact: boolean
  adminPreview: boolean
}) {
  if (!products.length) return null

  if (compact) {
    const product = products[0]

    return (
      <section id="biblioteca" className="member-section" aria-labelledby="library-title">
        <div className="member-section-head">
          <span>Minha biblioteca</span>
          <h2 id="library-title">Conteúdo liberado</h2>
          <p>O item principal já aparece acima como continuidade de estudo.</p>
        </div>
        <div className="member-library-compact">
          <div>
            <CheckCircle2 size={20} />
            <span>{contentLabel(product)}</span>
            <strong>{product.title}</strong>
          </div>
          <Link href={`/membros/${product.slug}`}>
            Abrir conteúdo
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section id="biblioteca" className="member-section" aria-labelledby="library-title">
      <div className="member-section-head">
        <span>Minha biblioteca</span>
        <h2 id="library-title">Conteúdos liberados</h2>
      </div>
      <div className={`member-library-grid ${products.length === 1 ? 'is-single' : ''}`}>
        {products.map((product) => (
          <MemberProductCard key={product.id} product={product} adminPreview={adminPreview} />
        ))}
      </div>
    </section>
  )
}

export function ExploreProducts({
  products,
  title,
}: {
  products: MemberCatalogProduct[]
  title: string
}) {
  if (!products.length) return null

  return (
    <section id="explorar" className="member-section is-explore" aria-labelledby="explore-title">
      <div className="member-section-head">
        <span>Prateleira digital</span>
        <h2 id="explore-title">{title}</h2>
      </div>
      <div className={`member-library-grid ${products.length === 1 ? 'is-single' : ''}`}>
        {products.map((product) => (
          <MemberProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}

function MemberProductCard({
  product,
  adminPreview = false,
}: {
  product: MemberCatalogProduct
  adminPreview?: boolean
}) {
  const percent = progressPercent(product)
  const showProgress = product.has_access && hasBackendProgress(product) && !adminPreview
  const lastAccess = formatDate(product.progress.last_accessed_at)

  return (
    <Link href={memberProductHref(product)} className={`member-product-card ${product.has_access ? 'is-open' : 'is-locked'}`}>
      <ProductCover product={product} />
      <div className="member-product-copy">
        <span className="member-product-badge">
          {product.has_access ? <CheckCircle2 size={14} /> : <LockKeyhole size={14} />}
          {accessBadge(product, adminPreview)}
        </span>
        <small>{productKind(product.product_type)}</small>
        <h3>{product.title}</h3>
        <p>{product.subtitle || product.description || 'Conteúdo digital de Guilherme Pilger.'}</p>
        <div className="member-product-meta">
          <small>{contentLabel(product)}</small>
          {!product.has_access && formatPrice(product) && <strong>{formatPrice(product)}</strong>}
          {showProgress && lastAccess && <small>Último acesso: {lastAccess}</small>}
        </div>
        {showProgress && (
          <div className="member-progress" aria-label={`Progresso ${percent}%`}>
            <span style={{ width: `${percent}%` }} />
          </div>
        )}
        <span className="member-card-action">
          {actionLabel(product, adminPreview)}
          {product.has_access ? <Play size={15} fill="currentColor" /> : <ArrowRight size={16} />}
        </span>
      </div>
    </Link>
  )
}

function ProductCover({ product }: { product: MemberCatalogProduct }) {
  const image = productImage(product)

  if (product.slug === 'perfil-corretor-ideal') {
    return (
      <div className="member-product-cover is-profile-assessment-cover">
        <img src="/images/eventos/guilherme-pilger.png" alt="" width={240} height={320} loading="lazy" aria-hidden="true" />
        <div className="profile-assessment-cover-mark">GP</div>
        <div className="profile-assessment-cover-copy">
          <span>Diagnóstico gratuito</span>
          <strong>Perfil do Corretor Ideal</strong>
          <small>36 perguntas</small>
        </div>
      </div>
    )
  }

  return (
    <div className="member-product-cover">
      {image ? (
        <img src={image} alt={product.title} width={240} height={320} loading="lazy" />
      ) : (
        <BookOpen size={38} />
      )}
    </div>
  )
}

export function MemberSupportCard({
  signedIn,
  memberName,
  memberEmail,
  supportHref,
}: {
  signedIn: boolean
  memberName: string
  memberEmail?: string | null
  supportHref: string
}) {
  return (
    <section id="suporte" className="member-support-section" aria-labelledby="support-title">
      <div className="member-support-card">
        <CircleHelp size={28} />
        <span>Suporte</span>
        <h2 id="support-title">Precisa de ajuda?</h2>
        <p>Fale com o suporte para resolver problemas de acesso ou vínculo da compra.</p>
        {supportHref && (
          <a href={supportHref} target="_blank" rel="noreferrer">
            Falar com o suporte
            <ArrowRight size={16} />
          </a>
        )}
      </div>

      {signedIn && (
        <div id="conta" className="member-account-summary">
          <UserRound size={28} />
          <span>Conta</span>
          <h2>{firstName(memberName, memberEmail)}</h2>
          {memberEmail && <p>{memberEmail}</p>}
          <MemberLogoutButton />
        </div>
      )}
    </section>
  )
}

export function MemberFooter({ supportHref }: { supportHref: string }) {
  return (
    <footer className="member-footer">
      <div>
        <strong>Guilherme Pilger</strong>
        <span>Área de membros</span>
      </div>
      <nav aria-label="Links finais da área de membros">
        <Link href="/politica-de-privacidade">Política de privacidade</Link>
        <Link href="/termos-de-servico">Termos de uso</Link>
        {supportHref ? <a href={supportHref} target="_blank" rel="noreferrer">Suporte</a> : <Link href="#suporte">Suporte</Link>}
      </nav>
    </footer>
  )
}

export function MemberMobileNavigation() {
  return (
    <nav className="member-mobile-nav" aria-label="Navegação mobile da área de membros">
      <a href="#inicio" aria-current="page">
        <Home size={18} />
        <span>Início</span>
      </a>
      <a href="#biblioteca">
        <LibraryBig size={18} />
        <span>Biblioteca</span>
      </a>
      <a href="#conta">
        <UserRound size={18} />
        <span>Conta</span>
      </a>
    </nav>
  )
}

export function MemberPlatformStyles() {
  return (
    <style>{`
      .member-platform {
        min-height: 100vh;
        color: #f8f3e8;
        background:
          radial-gradient(circle at 18% 8%, rgba(214, 164, 74, 0.12), transparent 28%),
          linear-gradient(180deg, #020607 0%, #031111 42%, #020607 100%);
        font-family: Inter, Arial, sans-serif;
      }

      html,
      body {
        height: auto;
        min-height: 100%;
        background: #020607;
        overflow-x: hidden;
        overflow-y: auto;
      }

      .member-platform * {
        box-sizing: border-box;
      }

      .member-header {
        position: sticky;
        top: 0;
        z-index: 50;
        display: grid;
        grid-template-columns: minmax(230px, 1fr) auto minmax(230px, 1fr);
        align-items: center;
        gap: 22px;
        min-height: 64px;
        padding: 0 max(24px, calc((100vw - 1280px) / 2));
        border-bottom: 1px solid rgba(214, 164, 74, 0.14);
        background: rgba(2, 6, 7, 0.88);
        backdrop-filter: blur(18px);
      }

      .member-brand,
      .member-nav,
      .member-header-actions,
      .member-login-button,
      .member-header-link,
      .member-badge,
      .member-primary-action,
      .member-card-action,
      .member-library-compact a,
      .member-support-card a,
      .member-footer nav,
      .member-mobile-nav a {
        display: inline-flex;
        align-items: center;
      }

      .member-brand {
        gap: 10px;
        width: fit-content;
        color: #f8f3e8;
        text-decoration: none;
      }

      .member-brand-mark {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border: 1px solid rgba(214, 164, 74, 0.42);
        border-radius: 8px;
        color: #d6a44a;
        background: rgba(214, 164, 74, 0.08);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 0.92rem;
        font-weight: 800;
      }

      .member-brand-copy {
        display: grid;
        gap: 2px;
      }

      .member-brand-copy strong {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 1.05rem;
        line-height: 1;
      }

      .member-brand-copy small {
        color: rgba(248, 243, 232, 0.58);
        font-size: 0.78rem;
        line-height: 1.15;
      }

      .member-nav {
        justify-self: center;
        gap: 22px;
        font-size: 0.78rem;
        font-weight: 850;
      }

      .member-nav a,
      .member-header-link,
      .member-footer a {
        color: rgba(248, 243, 232, 0.68);
        text-decoration: none;
      }

      .member-nav a:hover,
      .member-header-link:hover,
      .member-footer a:hover {
        color: #d6a44a;
      }

      .member-header-actions {
        justify-self: end;
        justify-content: flex-end;
        gap: 10px;
      }

      .member-login-button,
      .member-header-link {
        min-height: 48px;
        justify-content: center;
        border-radius: 8px;
        font-size: 0.78rem;
        font-weight: 900;
        text-decoration: none;
      }

      .member-login-button {
        padding: 0 18px;
        color: #061014;
        background: #d6a44a;
      }

      .member-header-link {
        padding: 0 8px;
      }

      .member-account-menu {
        position: relative;
      }

      .member-account-menu summary {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        min-height: 42px;
        border: 1px solid rgba(255, 255, 255, 0.13);
        border-radius: 999px;
        padding: 4px 13px 4px 5px;
        color: #fff;
        background: rgba(255, 255, 255, 0.05);
        cursor: pointer;
        list-style: none;
      }

      .member-account-menu summary::-webkit-details-marker {
        display: none;
      }

      .member-account-menu summary span {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 999px;
        color: #061014;
        background: #d6a44a;
        font-size: 0.75rem;
        font-weight: 950;
      }

      .member-account-menu summary strong {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.82rem;
      }

      .member-account-popover {
        position: absolute;
        top: calc(100% + 10px);
        right: 0;
        display: grid;
        gap: 6px;
        width: 210px;
        padding: 10px;
        border: 1px solid rgba(214, 164, 74, 0.22);
        border-radius: 8px;
        background: #061112;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.38);
      }

      .member-account-popover a,
      .member-account-popover .members-logout-link {
        width: 100%;
        min-height: 38px;
        justify-content: flex-start;
        border-radius: 7px;
        padding: 0 10px;
        color: rgba(248, 243, 232, 0.78);
        text-decoration: none;
        font-size: 0.82rem;
        font-weight: 800;
        text-transform: none;
      }

      .member-account-popover a:hover {
        color: #d6a44a;
        background: rgba(255, 255, 255, 0.04);
      }

      .member-login-gateway,
      .member-hero,
      .member-section,
      .member-support-section,
      .member-footer {
        width: min(100% - 48px, 1280px);
        margin: 0 auto;
      }

      .member-hero,
      .member-section,
      .member-support-section,
      .member-account-summary {
        scroll-margin-top: 78px;
      }

      .member-login-gateway {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        grid-template-rows: auto 280px;
        grid-template-areas:
          "copy auth"
          "visual product";
        gap: 24px;
        min-height: 620px;
        padding: 76px 0 56px;
      }

      .member-login-gateway::before,
      .member-hero::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 0;
        border-radius: 8px;
        background:
          linear-gradient(90deg, rgba(2, 6, 7, 0.96), rgba(2, 6, 7, 0.75)),
          url("${HERO_BG}") center / cover no-repeat;
        opacity: 0.55;
        pointer-events: none;
      }

      .member-login-copy,
      .member-login-visual,
      .member-auth-panel,
      .member-login-product,
      .member-hero-copy,
      .member-hero-panel {
        position: relative;
        z-index: 1;
      }

      .member-login-copy {
        grid-area: copy;
        align-self: end;
        max-width: 660px;
        padding-top: 42px;
      }

      .member-badge {
        gap: 8px;
        width: fit-content;
        margin-bottom: 16px;
        color: #d6a44a;
        font-size: 0.78rem;
        font-weight: 900;
      }

      .member-greeting {
        display: block;
        margin-bottom: 10px;
        color: #d6a44a;
        font-size: 0.88rem;
        font-weight: 950;
      }

      .member-login-copy h1,
      .member-hero h1 {
        margin: 0;
        max-width: 760px;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 4.7rem;
        line-height: 0.95;
        letter-spacing: 0;
      }

      .member-login-copy p,
      .member-hero-copy p {
        max-width: 610px;
        margin: 20px 0 0;
        color: rgba(248, 243, 232, 0.72);
        font-size: 1.04rem;
        line-height: 1.68;
      }

      .member-login-visual {
        grid-area: visual;
        height: 280px;
        overflow: hidden;
        border-radius: 8px;
        background:
          radial-gradient(circle at 52% 16%, rgba(214, 164, 74, 0.12), transparent 34%),
          rgba(255, 255, 255, 0.04);
      }

      .member-login-visual img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center bottom;
        opacity: 0.86;
      }

      .member-auth-panel,
      .member-login-product,
      .member-empty-state,
      .member-library-compact,
      .member-support-card,
      .member-account-summary {
        border: 1px solid rgba(214, 164, 74, 0.16);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.045);
      }

      .member-auth-panel {
        grid-area: auth;
        align-self: end;
        display: grid;
        gap: 14px;
        padding: 24px;
      }

      .member-auth-panel span,
      .member-login-product span,
      .member-section-head span,
      .member-empty-state span,
      .member-support-card span,
      .member-account-summary span,
      .member-product-copy > small,
      .member-continue-copy > span {
        color: #d6a44a;
        font-size: 0.78rem;
        font-weight: 900;
      }

      .member-auth-panel h2,
      .member-empty-state h2,
      .member-support-card h2,
      .member-account-summary h2 {
        margin: 0;
        color: #fff;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 2rem;
        line-height: 1.05;
      }

      .member-auth-panel p,
      .member-empty-state p,
      .member-support-card p,
      .member-account-summary p,
      .member-section-head p {
        margin: 0;
        color: rgba(248, 243, 232, 0.68);
        font-size: 0.98rem;
        line-height: 1.62;
      }

      .member-primary-action,
      .member-library-compact a,
      .member-support-card a {
        min-height: 48px;
        justify-content: center;
        gap: 9px;
        border-radius: 8px;
        padding: 0 18px;
        color: #061014;
        background: #d6a44a;
        font-size: 0.82rem;
        font-weight: 950;
        text-decoration: none;
      }

      .member-inline-link {
        color: rgba(248, 243, 232, 0.7);
        font-size: 0.92rem;
        line-height: 1.4;
        text-decoration: none;
      }

      .member-inline-link:hover {
        color: #d6a44a;
      }

      .member-login-product {
        grid-area: product;
        display: grid;
        gap: 8px;
        align-self: start;
        padding: 18px;
        color: #fff;
        text-decoration: none;
      }

      .member-login-product strong {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 1.3rem;
      }

      .member-login-product small {
        color: rgba(248, 243, 232, 0.64);
        font-size: 0.92rem;
        line-height: 1.42;
      }

      .member-login-product em {
        color: #d6a44a;
        font-style: normal;
        font-weight: 900;
      }

      .member-hero {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 430px;
        align-items: center;
        gap: 56px;
        min-height: 430px;
        padding: 58px 0 44px;
      }

      .member-hero-copy {
        padding-left: 0;
      }

      .member-hero-copy .member-primary-action {
        margin-top: 26px;
      }

      .member-hero-facts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }

      .member-hero-facts div {
        display: flex;
        min-width: 0;
        min-height: 44px;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
      }

      .member-hero-facts strong {
        flex: 0 0 auto;
        color: #fff;
        font-size: 0.98rem;
      }

      .member-hero-facts span {
        color: rgba(248, 243, 232, 0.58);
        font-size: 0.75rem;
        line-height: 1.16;
      }

      .member-hero-panel {
        justify-self: end;
        width: min(100%, 390px);
        height: 360px;
        overflow: hidden;
        border-radius: 8px;
        background: #071315;
      }

      .member-hero-panel img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center top;
        opacity: 0.86;
      }

      .member-hero-panel-copy {
        position: absolute;
        right: 18px;
        bottom: 18px;
        left: 18px;
        display: grid;
        gap: 4px;
        padding-top: 70px;
        background: linear-gradient(180deg, transparent, rgba(2, 6, 7, 0.9));
      }

      .member-hero-panel-copy span {
        color: #d6a44a;
        font-size: 0.78rem;
        font-weight: 900;
      }

      .member-hero-panel-copy strong {
        color: #fff;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 1.35rem;
      }

      .member-section {
        padding: 34px 0;
      }

      .member-section.is-explore {
        border-top: 1px solid rgba(214, 164, 74, 0.1);
      }

      .member-section-head {
        display: grid;
        gap: 8px;
        margin-bottom: 18px;
      }

      .member-section-head h2 {
        margin: 0;
        max-width: 760px;
        color: #fff;
        font-family: Inter, Arial, sans-serif;
        font-size: 2rem;
        line-height: 1.16;
        letter-spacing: 0;
      }

      .member-continue-card,
      .member-product-card {
        display: grid;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        background: rgba(5, 19, 20, 0.92);
      }

      .member-continue-card {
        grid-template-columns: 150px minmax(0, 1fr) auto;
        align-items: center;
        gap: 22px;
        padding: 18px;
      }

      .member-product-card {
        grid-template-columns: 1fr;
        align-content: start;
        gap: 11px;
        padding: 12px;
        color: inherit;
        text-decoration: none;
      }

      .member-product-cover {
        aspect-ratio: 3 / 4;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid rgba(214, 164, 74, 0.2);
        border-radius: 8px;
        color: #d6a44a;
        background: rgba(214, 164, 74, 0.08);
      }

      .member-product-cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .member-product-cover.is-profile-assessment-cover {
        position: relative;
        align-content: end;
        isolation: isolate;
        background: #071315;
      }

      .member-product-cover.is-profile-assessment-cover::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 1;
        background:
          linear-gradient(180deg, rgba(2, 6, 7, 0.04) 0%, rgba(2, 6, 7, 0.7) 56%, rgba(2, 6, 7, 0.96) 100%),
          radial-gradient(circle at 18% 18%, rgba(214, 164, 74, 0.38), transparent 30%);
      }

      .member-product-cover.is-profile-assessment-cover > img {
        position: absolute;
        inset: 0;
        opacity: 0.62;
        object-position: center;
      }

      .profile-assessment-cover-mark {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 2;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border: 1px solid rgba(214, 164, 74, 0.72);
        border-radius: 8px;
        color: #061014;
        background: #d6a44a;
        font-size: 0.75rem;
        font-weight: 950;
      }

      .profile-assessment-cover-copy {
        position: relative;
        z-index: 2;
        display: grid;
        gap: 6px;
        align-self: end;
        width: 100%;
        padding: 12px;
      }

      .profile-assessment-cover-copy span,
      .profile-assessment-cover-copy small {
        color: #d6a44a;
        font-size: 0.62rem;
        font-weight: 950;
        line-height: 1.1;
        text-transform: uppercase;
      }

      .profile-assessment-cover-copy strong {
        color: #fff;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 1.2rem;
        line-height: 0.95;
        letter-spacing: 0;
      }

      .member-continue-copy,
      .member-product-copy {
        min-width: 0;
        display: grid;
        align-content: start;
        gap: 7px;
      }

      .member-continue-copy h3,
      .member-product-copy h3 {
        margin: 0;
        color: #fff;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 1.7rem;
        line-height: 1.08;
      }

      .member-continue-copy p,
      .member-product-copy p {
        margin: 0;
        max-width: 620px;
        color: rgba(248, 243, 232, 0.67);
        font-size: 0.98rem;
        line-height: 1.52;
      }

      .member-product-copy p {
        display: -webkit-box;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }

      .member-product-badge {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        width: fit-content;
        min-height: 28px;
        border-radius: 999px;
        padding: 0 10px;
        color: #d6a44a;
        background: rgba(214, 164, 74, 0.08);
        font-size: 0.76rem;
        font-weight: 900;
      }

      .member-product-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 5px 10px;
        color: rgba(248, 243, 232, 0.62);
      }

      .member-product-meta small,
      .member-product-meta strong {
        font-size: 0.86rem;
      }

      .member-product-meta strong {
        color: #d6a44a;
      }

      .member-progress {
        width: min(100%, 420px);
        height: 6px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
      }

      .member-progress span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #d6a44a, #f4d083);
      }

      .member-continue-action {
        display: grid;
        justify-items: end;
        gap: 12px;
      }

      .member-continue-action strong {
        color: #d6a44a;
        font-size: 1.45rem;
      }

      .member-library-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 220px));
        gap: 14px;
      }

      .member-library-grid.is-single {
        grid-template-columns: minmax(0, 220px);
      }

      .member-library-grid.is-single .member-product-card {
        grid-template-columns: 1fr;
      }

      .member-card-action {
        width: fit-content;
        min-height: 30px;
        justify-content: flex-start;
        gap: 6px;
        padding: 0;
        color: #d6a44a;
        background: transparent;
        font-size: 0.76rem;
        font-weight: 950;
      }

      .member-product-card:hover .member-card-action {
        color: #f4d083;
      }

      .member-library-compact {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 18px;
      }

      .member-library-compact div {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        min-width: 0;
      }

      .member-library-compact svg {
        color: #d6a44a;
      }

      .member-library-compact span {
        color: rgba(248, 243, 232, 0.62);
      }

      .member-library-compact strong {
        color: #fff;
      }

      .member-empty-state {
        display: grid;
        justify-items: center;
        gap: 12px;
        min-height: 280px;
        padding: 42px 22px;
        text-align: center;
      }

      .member-empty-state svg,
      .member-support-card svg,
      .member-account-summary svg {
        color: #d6a44a;
      }

      .member-support-section {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
        gap: 16px;
        padding: 34px 0 48px;
      }

      .member-support-card,
      .member-account-summary {
        display: grid;
        gap: 12px;
        align-content: start;
        padding: 24px;
      }

      .member-support-card a {
        width: fit-content;
      }

      .member-account-summary .members-logout-link {
        width: fit-content;
        min-height: 40px;
      }

      .member-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 22px 0 28px;
        border-top: 1px solid rgba(214, 164, 74, 0.12);
      }

      .member-footer div {
        display: grid;
        gap: 3px;
      }

      .member-footer strong {
        color: #fff;
        font-family: Georgia, 'Times New Roman', serif;
      }

      .member-footer span {
        color: rgba(248, 243, 232, 0.52);
        font-size: 0.86rem;
      }

      .member-footer nav {
        gap: 16px;
        flex-wrap: wrap;
        justify-content: flex-end;
        font-size: 0.86rem;
      }

      .member-mobile-nav {
        display: none;
      }

      .member-primary-action:hover,
      .member-library-compact a:hover,
      .member-support-card a:hover,
      .member-login-button:hover {
        background: #edc166;
      }

      .member-product-card:hover,
      .member-continue-card:hover,
      .member-login-product:hover {
        border-color: rgba(214, 164, 74, 0.32);
        transform: translateY(-1px);
        transition: transform 160ms ease, border-color 160ms ease;
      }

      a:focus-visible,
      button:focus-visible,
      summary:focus-visible {
        outline: 2px solid #f4d083;
        outline-offset: 3px;
      }

      @media (prefers-reduced-motion: reduce) {
        .member-product-card:hover,
        .member-continue-card:hover,
        .member-login-product:hover {
          transform: none;
          transition: none;
        }
      }

      @media (max-width: 1100px) {
        .member-header {
          grid-template-columns: auto 1fr auto;
          padding-inline: 22px;
        }

        .member-nav {
          gap: 14px;
        }

        .member-hero {
          grid-template-columns: minmax(0, 1fr) 330px;
          gap: 32px;
        }

        .member-hero-panel {
          height: 330px;
        }

        .member-login-copy h1,
        .member-hero h1 {
          font-size: 3.8rem;
        }
      }

      @media (max-width: 860px) {
        .member-platform.has-mobile-nav {
          padding-bottom: calc(70px + env(safe-area-inset-bottom));
        }

        .member-header {
          grid-template-columns: 1fr auto;
          min-height: 58px;
          gap: 12px;
          padding-inline: 16px;
        }

        .member-brand-mark {
          width: 34px;
          height: 34px;
        }

        .member-brand-copy strong {
          font-size: 0.98rem;
        }

        .member-brand-copy small,
        .member-nav,
        .member-header-link,
        .member-account-menu summary strong {
          display: none;
        }

        .member-login-button {
          min-height: 48px;
          padding: 0 14px;
        }

        .member-account-menu summary {
          padding: 4px;
        }

        .member-account-popover {
          right: 0;
        }

        .member-login-gateway,
        .member-hero,
        .member-section,
        .member-support-section,
        .member-footer {
          width: min(100% - 36px, 1280px);
        }

        .member-hero,
        .member-section,
        .member-support-section,
        .member-account-summary {
          scroll-margin-top: 68px;
        }

        .member-login-gateway {
          grid-template-columns: 1fr;
          grid-template-rows: auto;
          grid-template-areas:
            "copy"
            "auth"
            "visual"
            "product";
          min-height: auto;
          gap: 16px;
          padding: 36px 0 28px;
        }

        .member-login-copy {
          align-self: start;
          padding-top: 6px;
        }

        .member-login-copy h1,
        .member-hero h1 {
          font-size: 2.9rem;
          line-height: 0.98;
        }

        .member-login-copy p,
        .member-hero-copy p {
          font-size: 1rem;
        }

        .member-login-visual {
          height: 190px;
        }

        .member-auth-panel {
          padding: 20px;
        }

        .member-hero {
          grid-template-columns: 1fr;
          gap: 12px;
          min-height: auto;
          padding: 12px 0 16px;
        }

        .member-hero-panel {
          order: -1;
          justify-self: stretch;
          width: 100%;
          height: 174px;
        }

        .member-hero-panel img {
          object-position: center 18%;
        }

        .member-hero-panel-copy {
          right: 14px;
          bottom: 14px;
          left: 14px;
          padding-top: 58px;
        }

        .member-hero-panel-copy strong {
          font-size: 1.12rem;
        }

        .member-hero-copy {
          display: grid;
        }

        .member-hero .member-badge {
          margin-bottom: 8px;
          font-size: 0.72rem;
        }

        .member-greeting {
          margin-bottom: 6px;
          font-size: 0.78rem;
        }

        .member-hero h1 {
          font-family: Inter, Arial, sans-serif;
          font-size: 1.62rem;
          line-height: 1.04;
          font-weight: 950;
        }

        .member-hero-copy p {
          max-width: 32rem;
          margin-top: 6px;
          font-size: 0.86rem;
          line-height: 1.36;
        }

        .member-hero-facts {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-top: 10px;
        }

        .member-hero-facts div {
          min-width: 0;
          min-height: 38px;
          padding: 7px 9px;
        }

        .member-hero-facts strong {
          font-size: 0.88rem;
        }

        .member-hero-facts span {
          font-size: 0.68rem;
          line-height: 1.12;
        }

        .member-section {
          padding: 16px 0;
        }

        .member-section-head h2 {
          font-size: 1.18rem;
          line-height: 1.15;
        }

        .member-section-head {
          gap: 6px;
          margin-bottom: 12px;
        }

        .member-continue-card {
          grid-template-columns: 96px minmax(0, 1fr);
          gap: 14px;
        }

        .member-continue-action {
          grid-column: 1 / -1;
          justify-items: stretch;
        }

        .member-continue-action .member-primary-action {
          width: 100%;
        }

        .member-library-grid,
        .member-library-grid.is-single {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: minmax(122px, 34%);
          grid-template-columns: none;
          gap: 9px;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          scroll-padding-inline: 2px;
          scroll-snap-type: x proximity;
          padding: 0 2px 8px;
          scrollbar-width: none;
        }

        .member-library-grid::-webkit-scrollbar {
          display: none;
        }

        .member-product-card,
        .member-library-grid.is-single .member-product-card {
          grid-template-columns: 1fr;
          gap: 6px;
          padding: 7px;
          scroll-snap-align: start;
        }

        .member-product-card .member-product-cover {
          aspect-ratio: 1 / 1.2;
        }

        .member-continue-copy h3 {
          font-size: 1.2rem;
        }

        .member-product-copy h3 {
          display: -webkit-box;
          overflow: hidden;
          font-family: Inter, Arial, sans-serif;
          font-size: 0.76rem;
          line-height: 1.16;
          font-weight: 900;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .member-product-copy,
        .member-continue-copy {
          gap: 4px;
        }

        .member-continue-copy p {
          font-size: 0.9rem;
          line-height: 1.42;
        }

        .member-product-card .member-product-badge,
        .member-product-card .member-product-copy > small,
        .member-product-card .member-product-copy p {
          display: none;
        }

        .member-product-card .member-product-meta,
        .member-product-card .member-card-action {
          display: none;
        }

        .member-library-compact,
        .member-support-section,
        .member-footer {
          grid-template-columns: 1fr;
        }

        .member-library-compact,
        .member-footer {
          align-items: flex-start;
        }

        .member-library-compact {
          display: grid;
        }

        .member-library-compact a,
        .member-support-card a {
          width: 100%;
        }

        .member-support-section {
          display: grid;
          gap: 8px;
          padding: 14px 0 22px;
        }

        .member-support-card,
        .member-account-summary {
          grid-template-columns: 30px minmax(0, 1fr) auto;
          grid-template-rows: auto auto;
          align-items: center;
          gap: 2px 10px;
          padding: 11px 12px;
        }

        .member-support-card > svg,
        .member-account-summary > svg {
          grid-column: 1;
          grid-row: 1 / span 2;
          width: 20px;
          height: 20px;
        }

        .member-support-card > span,
        .member-account-summary > span {
          grid-column: 2;
          grid-row: 1;
          font-size: 0.68rem;
          line-height: 1;
        }

        .member-support-card h2,
        .member-account-summary h2 {
          grid-column: 2;
          grid-row: 2;
          font-family: Inter, Arial, sans-serif;
          font-size: 0.96rem;
          line-height: 1.1;
        }

        .member-support-card p {
          display: none;
        }

        .member-account-summary p {
          grid-column: 2;
          grid-row: 3;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.75rem;
          line-height: 1.25;
        }

        .member-support-card a {
          grid-column: 3;
          grid-row: 1 / span 2;
          width: 34px;
          min-height: 34px;
          padding: 0;
          border: 1px solid rgba(214, 164, 74, 0.34);
          border-radius: 7px;
          color: #d6a44a;
          background: rgba(214, 164, 74, 0.08);
          font-size: 0;
        }

        .member-account-summary .members-logout-link {
          grid-column: 3;
          grid-row: 1 / span 2;
          width: 34px;
          min-height: 34px;
        }

        .member-footer {
          display: grid;
        }

        .member-footer nav {
          justify-content: flex-start;
        }

        .member-mobile-nav {
          position: fixed;
          right: 12px;
          bottom: calc(8px + env(safe-area-inset-bottom));
          left: 12px;
          z-index: 60;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 3px;
          padding: 6px;
          border: 1px solid rgba(214, 164, 74, 0.18);
          border-radius: 8px;
          background: rgba(3, 17, 18, 0.94);
          backdrop-filter: blur(16px);
          box-shadow: 0 14px 38px rgba(0, 0, 0, 0.42);
        }

        .member-mobile-nav a {
          justify-content: center;
          gap: 4px;
          min-height: 38px;
          border-radius: 7px;
          color: rgba(248, 243, 232, 0.68);
          font-size: 0.68rem;
          font-weight: 850;
          text-decoration: none;
        }

        .member-mobile-nav svg {
          width: 16px;
          height: 16px;
        }

        .member-mobile-nav a[aria-current="page"] {
          color: #061014;
          background: #d6a44a;
        }
      }

      @media (max-width: 460px) {
        .member-login-gateway,
        .member-hero,
        .member-section,
        .member-support-section,
        .member-footer {
          width: min(100% - 32px, 1280px);
        }

        .member-login-copy h1 {
          font-size: 2.35rem;
        }

        .member-hero h1 {
          font-size: 1.42rem;
          line-height: 1.06;
        }

        .member-hero-panel {
          height: 152px;
        }

        .member-hero-copy p {
          font-size: 0.82rem;
        }

        .member-badge {
          margin-bottom: 12px;
          font-size: 0.74rem;
        }

        .member-auth-panel h2,
        .member-empty-state h2,
        .member-support-card h2,
        .member-account-summary h2 {
          font-size: 1.65rem;
        }

        .member-support-card h2,
        .member-account-summary h2 {
          font-size: 0.96rem;
        }

        .member-hero-facts {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .member-library-grid,
        .member-library-grid.is-single {
          grid-auto-columns: minmax(112px, 32%);
        }

        .member-product-card,
        .member-library-grid.is-single .member-product-card {
          grid-template-columns: 1fr;
          padding: 7px;
        }

        .profile-assessment-cover-mark {
          width: 26px;
          height: 26px;
          border-radius: 7px;
          font-size: 0.62rem;
        }

        .profile-assessment-cover-copy {
          gap: 4px;
          padding: 8px;
        }

        .profile-assessment-cover-copy span {
          display: none;
        }

        .profile-assessment-cover-copy strong {
          font-size: 0.82rem;
        }

        .member-continue-card {
          grid-template-columns: 82px minmax(0, 1fr);
          padding: 12px;
        }

        .member-product-badge {
          min-height: 26px;
          font-size: 0.72rem;
        }

        .member-continue-copy h3 {
          font-size: 1.05rem;
        }

        .member-product-copy h3 {
          font-size: 0.72rem;
        }

        .member-primary-action {
          width: 100%;
        }
      }
    `}</style>
  )
}
