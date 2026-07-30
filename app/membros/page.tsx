import Link from 'next/link'
import {
  BookOpen,
  CheckCircle2,
  LockKeyhole,
  Play,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { loadMemberLibrary, type MemberCatalogProduct } from '@/lib/members/access'

export const dynamic = 'force-dynamic'

function initials(name?: string | null, email?: string | null) {
  const source = String(name || email || 'Membro').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MP'
}

function firstName(name?: string | null, email?: string | null) {
  const source = String(name || email || '').trim()
  return source.split(/\s+/).filter(Boolean)[0] || 'membro'
}

function productKindLabel(type?: string | null) {
  if (type === 'ebook') return 'Livro digital'
  if (type === 'course') return 'Curso'
  if (type === 'mentorship') return 'Mentoria'
  if (type === 'bundle') return 'Coleção'
  return 'Produto digital'
}

function formatPrice(product: MemberCatalogProduct) {
  if (!product.offer) return 'Acesso digital'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: product.offer.currency || 'BRL',
  }).format(Number(product.offer.price_cents || 0) / 100)
}

function productHref(product: MemberCatalogProduct, signedIn: boolean) {
  if (product.has_access) return `/membros/${product.slug}`
  if (!signedIn) return `/membros/entrar?next=${encodeURIComponent(`/membros/${product.slug}`)}`
  return product.offer?.checkout_path || `/checkout/${product.slug}`
}

function productActionLabel(product: MemberCatalogProduct, signedIn: boolean) {
  if (product.has_access) return 'Continuar'
  if (!signedIn) return 'Entrar para acessar'
  return 'Comprar acesso'
}

function contentLabel(product: MemberCatalogProduct) {
  if (!product.content_count) return 'Acesso digital'
  return `${product.content_count} conteúdo${product.content_count === 1 ? '' : 's'}`
}

export default async function MembersPage() {
  const { user, member, products, catalog } = await loadMemberLibrary()
  const memberName = member?.name || user?.user_metadata?.name || user?.email || 'Membro Pilger'
  const featuredProduct = products[0] || catalog[0] || null
  const signedIn = Boolean(user)
  const loginHref = '/membros/entrar?next=/membros'

  return (
    <main className="members-shell">
      <header className="members-header">
        <Link href="/membros" className="members-brand">
          <BookOpen size={21} />
          <span>Pilger Play</span>
        </Link>
        <nav className="members-nav" aria-label="Área de membros">
          <Link href="#catalogo">Produtos</Link>
          {signedIn ? (
            <Link href="#catalogo" className="members-account-link" aria-label="Minha conta">
              {initials(memberName, user?.email)}
            </Link>
          ) : (
            <Link href={loginHref} className="members-login-link">
              Entrar na minha conta
            </Link>
          )}
        </nav>
      </header>

      <section className="members-stage">
        <div className="members-stage-copy">
          <span className="members-kicker">
            <Sparkles size={15} />
            Área de membros
          </span>
          <h1>{signedIn ? `Olá, ${firstName(memberName, user?.email)}.` : 'Pilger Play'}</h1>
          <p>
            {signedIn
              ? `${products.length} produto${products.length === 1 ? '' : 's'} liberado${products.length === 1 ? '' : 's'} na sua biblioteca.`
              : 'Sua biblioteca digital de livros, cursos e materiais comerciais do Guilherme Pilger.'}
          </p>
          <div className="members-actions">
            <Link href={signedIn ? '#catalogo' : loginHref} className="members-primary">
              {signedIn ? 'Abrir biblioteca' : 'Entrar na minha conta'}
              <Play size={16} fill="currentColor" />
            </Link>
            <Link href="#catalogo" className="members-secondary">
              Ver catálogo
            </Link>
          </div>
        </div>

        {featuredProduct && (
          <Link href={productHref(featuredProduct, signedIn)} className="members-feature">
            <div className="members-feature-cover">
              {featuredProduct.cover_image_url || featuredProduct.thumbnail_url ? (
                <img
                  src={featuredProduct.cover_image_url || featuredProduct.thumbnail_url || ''}
                  alt={featuredProduct.title}
                />
              ) : (
                <BookOpen size={42} />
              )}
            </div>
            <div className="members-feature-copy">
              <span>{featuredProduct.has_access ? 'Continuar assistindo' : 'Em destaque'}</span>
              <strong>{featuredProduct.title}</strong>
            </div>
          </Link>
        )}
      </section>

      <section id="catalogo" className="members-catalog">
        <div className="members-section-head">
          <div>
            <span>Produtos</span>
            <h2>Catálogo Pilger</h2>
          </div>
          <div className="members-filter-pill">
            <Search size={16} />
            Todos
          </div>
        </div>

        {catalog.length ? (
          <div className="members-product-grid">
            {catalog.map((product) => {
              const href = productHref(product, signedIn)
              const locked = !product.has_access

              return (
                <article key={product.id} className={`members-product ${locked ? 'is-locked' : 'is-open'}`}>
                  <Link href={href} className="members-product-media" aria-label={product.title}>
                    {product.thumbnail_url || product.cover_image_url ? (
                      <img
                        src={product.thumbnail_url || product.cover_image_url || ''}
                        alt={product.title}
                      />
                    ) : (
                      <BookOpen size={38} />
                    )}
                    <span className="members-product-type">{productKindLabel(product.product_type)}</span>
                    <span className="members-product-status">
                      {product.has_access ? <CheckCircle2 size={14} /> : <LockKeyhole size={14} />}
                      {product.has_access ? 'Liberado' : 'Bloqueado'}
                    </span>
                  </Link>

                  <div className="members-product-copy">
                    <h3>{product.title}</h3>
                    <p>{product.subtitle || product.description || 'Produto digital Guilherme Pilger.'}</p>
                    <div className="members-product-meta">
                      <span>{contentLabel(product)}</span>
                      <strong>{formatPrice(product)}</strong>
                    </div>
                    <Link href={href} className={product.has_access ? 'is-primary' : ''}>
                      {productActionLabel(product, signedIn)}
                      {product.has_access ? <Play size={14} fill="currentColor" /> : <LockKeyhole size={14} />}
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="members-empty">
            <BookOpen size={34} />
            <h3>Nenhum produto publicado</h3>
            <p>Assim que um produto digital estiver ativo, ele aparece neste catálogo.</p>
          </div>
        )}
      </section>

      <section className="members-trust">
        <div>
          <ShieldCheck size={20} />
          <span>Acesso seguro</span>
        </div>
        <div>
          <UserRound size={20} />
          <span>Conta pelo e-mail da compra</span>
        </div>
        <div>
          <ShoppingBag size={20} />
          <span>Produtos digitais</span>
        </div>
      </section>

      <style>{`
        .members-shell {
          min-height: 100vh;
          background:
            linear-gradient(180deg, rgba(0, 0, 0, 0.1), #020607 38%),
            linear-gradient(120deg, #03100f 0%, #020607 52%, #180f08 100%);
          color: #fff;
          font-family: Inter, Arial, sans-serif;
        }

        .members-header {
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 16px clamp(18px, 5vw, 70px);
          border-bottom: 1px solid rgba(232, 176, 73, 0.16);
          background: rgba(2, 6, 7, 0.88);
          backdrop-filter: blur(16px);
        }

        .members-brand,
        .members-nav,
        .members-login-link,
        .members-account-link,
        .members-kicker,
        .members-actions,
        .members-primary,
        .members-secondary,
        .members-feature,
        .members-filter-pill,
        .members-product-copy a,
        .members-product-status,
        .members-trust div {
          display: inline-flex;
          align-items: center;
        }

        .members-brand {
          gap: 10px;
          color: #f3c45e;
          text-decoration: none;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.18rem;
          font-weight: 800;
        }

        .members-nav {
          gap: 14px;
          font-size: 0.8rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .members-nav a {
          color: rgba(255, 255, 255, 0.72);
          text-decoration: none;
        }

        .members-login-link {
          min-height: 40px;
          justify-content: center;
          border: 1px solid rgba(232, 176, 73, 0.36);
          border-radius: 999px;
          padding: 0 15px;
          color: #f3c45e !important;
          background: rgba(232, 176, 73, 0.1);
        }

        .members-account-link {
          width: 42px;
          height: 42px;
          justify-content: center;
          border: 1px solid rgba(232, 176, 73, 0.42);
          border-radius: 999px;
          color: #061014 !important;
          background: #e8b049;
        }

        .members-stage {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 390px);
          align-items: end;
          gap: clamp(28px, 5vw, 68px);
          min-height: 52vh;
          padding: clamp(42px, 7vw, 82px) clamp(18px, 5vw, 70px) 46px;
          overflow: hidden;
        }

        .members-stage::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            linear-gradient(90deg, rgba(2, 6, 7, 0.96) 0%, rgba(2, 6, 7, 0.78) 46%, rgba(2, 6, 7, 0.96) 100%),
            url("/images/products/corretor-nota-8-hero-bg-optimized.jpg") center / cover no-repeat;
          opacity: 0.72;
        }

        .members-stage-copy,
        .members-feature {
          position: relative;
          z-index: 1;
        }

        .members-stage-copy {
          max-width: 760px;
        }

        .members-kicker {
          gap: 8px;
          width: fit-content;
          margin-bottom: 16px;
          padding: 7px 10px;
          border: 1px solid rgba(232, 176, 73, 0.5);
          border-radius: 8px;
          color: #f3c45e;
          font-size: 0.74rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .members-stage h1 {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(3rem, 6vw, 6.2rem);
          line-height: 0.92;
          letter-spacing: 0;
        }

        .members-stage p {
          max-width: 610px;
          margin: 18px 0 0;
          color: rgba(255, 255, 255, 0.78);
          font-size: clamp(1rem, 1.3vw, 1.18rem);
          line-height: 1.68;
        }

        .members-actions {
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 26px;
        }

        .members-primary,
        .members-secondary,
        .members-product-copy a {
          min-height: 44px;
          justify-content: center;
          gap: 9px;
          border-radius: 7px;
          padding: 0 17px;
          font-size: 0.8rem;
          font-weight: 950;
          text-decoration: none;
          text-transform: uppercase;
        }

        .members-primary,
        .members-product-copy a.is-primary {
          color: #061014;
          background: #e8b049;
          box-shadow: 0 16px 34px rgba(232, 176, 73, 0.18);
        }

        .members-secondary,
        .members-product-copy a {
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.05);
        }

        .members-feature {
          align-self: center;
          gap: 14px;
          width: min(100%, 390px);
          padding: 12px;
          border: 1px solid rgba(232, 176, 73, 0.24);
          border-radius: 8px;
          color: #fff;
          text-decoration: none;
          background: rgba(3, 13, 14, 0.72);
          box-shadow: 0 28px 70px rgba(0, 0, 0, 0.42);
          backdrop-filter: blur(18px);
        }

        .members-feature-cover {
          width: 94px;
          aspect-ratio: 3 / 4;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(232, 176, 73, 0.28);
          border-radius: 7px;
          color: #e8b049;
          background: rgba(232, 176, 73, 0.08);
        }

        .members-feature-cover img,
        .members-product-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .members-feature-copy {
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .members-feature-copy span,
        .members-section-head span,
        .members-product-meta span {
          color: #e8b049;
          font-size: 0.72rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .members-feature-copy strong {
          overflow-wrap: anywhere;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.35rem;
          line-height: 1.1;
        }

        .members-catalog {
          padding: 38px clamp(18px, 5vw, 70px) clamp(42px, 6vw, 78px);
          border-top: 1px solid rgba(232, 176, 73, 0.14);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0));
        }

        .members-section-head {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .members-section-head h2 {
          margin: 6px 0 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(1.9rem, 3.4vw, 3.2rem);
          line-height: 1;
          letter-spacing: 0;
        }

        .members-filter-pill {
          gap: 8px;
          min-height: 38px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          padding: 0 13px;
          color: rgba(255, 255, 255, 0.72);
          background: rgba(255, 255, 255, 0.04);
          font-size: 0.78rem;
          font-weight: 850;
        }

        .members-product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(245px, 1fr));
          gap: 18px;
        }

        .members-product {
          min-width: 0;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.045);
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }

        .members-product:hover {
          transform: translateY(-3px);
          border-color: rgba(232, 176, 73, 0.48);
          background: rgba(255, 255, 255, 0.065);
        }

        .members-product-media {
          position: relative;
          display: grid;
          place-items: center;
          aspect-ratio: 16 / 10;
          overflow: hidden;
          color: #e8b049;
          background:
            linear-gradient(135deg, rgba(232, 176, 73, 0.12), rgba(15, 118, 110, 0.14)),
            #071317;
        }

        .members-product.is-locked .members-product-media img {
          filter: saturate(0.72) brightness(0.72);
        }

        .members-product-type,
        .members-product-status {
          position: absolute;
          z-index: 1;
          border-radius: 999px;
          font-size: 0.66rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .members-product-type {
          left: 11px;
          top: 11px;
          padding: 6px 8px;
          color: #061014;
          background: #e8b049;
        }

        .members-product-status {
          right: 11px;
          bottom: 11px;
          gap: 5px;
          padding: 7px 9px;
          color: #fff;
          background: rgba(0, 0, 0, 0.68);
          backdrop-filter: blur(10px);
        }

        .members-product.is-open .members-product-status {
          color: #052314;
          background: #79e0a6;
        }

        .members-product-copy {
          display: grid;
          gap: 12px;
          padding: 16px;
        }

        .members-product-copy h3 {
          margin: 0;
          overflow-wrap: anywhere;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.3rem;
          line-height: 1.1;
        }

        .members-product-copy p {
          display: -webkit-box;
          min-height: 48px;
          margin: 0;
          overflow: hidden;
          color: rgba(255, 255, 255, 0.68);
          font-size: 0.9rem;
          line-height: 1.55;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .members-product-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .members-product-meta strong {
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.9rem;
        }

        .members-product-copy a {
          width: 100%;
        }

        .members-empty {
          display: grid;
          justify-items: center;
          gap: 12px;
          padding: 42px 20px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.76);
          text-align: center;
          background: rgba(255, 255, 255, 0.04);
        }

        .members-empty svg {
          color: #e8b049;
        }

        .members-empty h3,
        .members-empty p {
          margin: 0;
        }

        .members-trust {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          border-top: 1px solid rgba(232, 176, 73, 0.14);
          background: rgba(232, 176, 73, 0.18);
        }

        .members-trust div {
          gap: 11px;
          min-height: 76px;
          padding: 18px clamp(18px, 4vw, 58px);
          color: rgba(255, 255, 255, 0.82);
          background: #03090b;
          font-size: 0.9rem;
          font-weight: 850;
        }

        .members-trust svg {
          flex: 0 0 auto;
          color: #e8b049;
        }

        @media (max-width: 820px) {
          .members-header {
            padding: 14px 16px;
          }

          .members-brand {
            font-size: 1rem;
          }

          .members-nav {
            gap: 10px;
          }

          .members-nav a:first-child {
            display: none;
          }

          .members-login-link {
            max-width: 162px;
            padding: 0 12px;
            font-size: 0.72rem;
            text-align: center;
          }

          .members-stage {
            grid-template-columns: 1fr;
            min-height: auto;
            padding: 34px 16px 28px;
          }

          .members-stage h1 {
            font-size: clamp(3rem, 16vw, 4.2rem);
          }

          .members-feature {
            width: 100%;
          }

          .members-catalog {
            padding: 32px 16px 56px;
          }

          .members-section-head {
            align-items: start;
          }

          .members-filter-pill {
            display: none;
          }

          .members-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .members-trust {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .members-product-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}
