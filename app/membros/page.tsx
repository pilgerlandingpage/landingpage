import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  LockKeyhole,
  Play,
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
  if (product.has_access) return 'Abrir produto'
  if (!signedIn) return 'Entrar para acessar'
  return 'Comprar acesso'
}

function contentLabel(product: MemberCatalogProduct) {
  if (!product.content_count) return 'Acesso digital'
  return `${product.content_count} conteúdo${product.content_count === 1 ? '' : 's'}`
}

function ProductPoster({
  product,
  signedIn,
}: {
  product: MemberCatalogProduct
  signedIn: boolean
}) {
  const href = productHref(product, signedIn)
  const locked = !product.has_access

  return (
    <article className={`members-poster ${locked ? 'is-locked' : 'is-open'}`}>
      <Link href={href} className="members-poster-cover" aria-label={product.title}>
        {product.thumbnail_url || product.cover_image_url ? (
          <img src={product.thumbnail_url || product.cover_image_url || ''} alt={product.title} />
        ) : (
          <BookOpen size={38} />
        )}
        <span className="members-poster-status">
          {product.has_access ? <CheckCircle2 size={14} /> : <LockKeyhole size={14} />}
          {product.has_access ? 'Liberado' : 'Bloqueado'}
        </span>
      </Link>
      <div className="members-poster-copy">
        <span>{productKindLabel(product.product_type)}</span>
        <h3>{product.title}</h3>
        <p>{product.subtitle || product.description || 'Produto digital Guilherme Pilger.'}</p>
        <div className="members-poster-meta">
          <small>{contentLabel(product)}</small>
          <strong>{formatPrice(product)}</strong>
        </div>
        <Link href={href}>
          {productActionLabel(product, signedIn)}
          {product.has_access ? <Play size={13} fill="currentColor" /> : <ArrowRight size={14} />}
        </Link>
      </div>
    </article>
  )
}

export default async function MembersPage() {
  const { user, member, products, catalog } = await loadMemberLibrary()
  const memberName = member?.name || user?.user_metadata?.name || user?.email || 'Membro Pilger'
  const signedIn = Boolean(user)
  const loginHref = '/membros/entrar?next=/membros'
  const featuredProduct = catalog.find((product) => product.slug === 'corretor-nota-8') || products[0] || catalog[0] || null
  const unlockedProducts = catalog.filter((product) => product.has_access)
  const lockedProducts = catalog.filter((product) => !product.has_access)
  const heroTitle = signedIn ? `Olá, ${firstName(memberName, user?.email)}.` : featuredProduct?.title || 'Área de membros'
  const heroSubtitle = signedIn
    ? `${products.length} produto${products.length === 1 ? '' : 's'} liberado${products.length === 1 ? '' : 's'} na sua biblioteca.`
    : featuredProduct?.subtitle || 'Acesse seus livros, cursos e materiais digitais em uma biblioteca privada.'

  return (
    <main className="members-shell">
      <header className="members-header">
        <Link href="/membros" className="members-brand">
          <BookOpen size={18} />
          <span>Corretor Nota 8</span>
        </Link>
        <nav className="members-nav" aria-label="Área de membros">
          <Link href="#biblioteca">Biblioteca</Link>
          <Link href="#produtos">Produtos</Link>
          {signedIn ? (
            <Link href="#biblioteca" className="members-account-link" aria-label="Minha conta">
              {initials(memberName, user?.email)}
            </Link>
          ) : (
            <Link href={loginHref} className="members-login-link">
              Entrar
            </Link>
          )}
        </nav>
      </header>

      <section className="members-hero">
        <div className="members-hero-copy">
          <span className="members-kicker">
            <Sparkles size={14} />
            Área de membros
          </span>
          <h1>{heroTitle}</h1>
          <strong>{heroSubtitle}</strong>
          <p>
            {signedIn
              ? 'Continue seus estudos ou explore os próximos produtos disponíveis na prateleira digital.'
              : 'Entre com o e-mail usado na compra. Quem ainda não comprou consegue ver os produtos, mas o acesso fica bloqueado até a aprovação do pagamento.'}
          </p>
          <div className="members-actions">
            <Link href={signedIn ? '#biblioteca' : loginHref} className="members-primary">
              {signedIn ? 'Abrir minha biblioteca' : 'Entrar na minha conta'}
              <ArrowRight size={16} />
            </Link>
            {featuredProduct && (
              <Link href={productHref(featuredProduct, signedIn)} className="members-secondary">
                {featuredProduct.has_access ? 'Continuar produto' : 'Ver produto'}
                <Play size={15} fill="currentColor" />
              </Link>
            )}
          </div>
        </div>

        {featuredProduct && (
          <Link href={productHref(featuredProduct, signedIn)} className="members-hero-book">
            <div className="members-hero-cover">
              {featuredProduct.cover_image_url || featuredProduct.thumbnail_url ? (
                <img
                  src={featuredProduct.cover_image_url || featuredProduct.thumbnail_url || ''}
                  alt={featuredProduct.title}
                />
              ) : (
                <BookOpen size={44} />
              )}
            </div>
            <span>{featuredProduct.has_access ? 'Acesso liberado' : 'Produto bloqueado'}</span>
            <strong>{featuredProduct.has_access ? 'Pronto para continuar' : 'Entre ou compre para acessar'}</strong>
          </Link>
        )}
      </section>

      <section className="members-proof">
        <div>
          <CheckCircle2 size={16} />
          <span>Mesmo visual da landing</span>
        </div>
        <div>
          <ShieldCheck size={16} />
          <span>Acesso após pagamento aprovado</span>
        </div>
        <div>
          <UserRound size={16} />
          <span>Conta vinculada ao e-mail da compra</span>
        </div>
      </section>

      <section id="biblioteca" className="members-rails">
        <div className="members-rail-head">
          <span>Biblioteca</span>
          <h2>{signedIn && unlockedProducts.length ? 'Continue de onde parou' : 'Produtos disponíveis'}</h2>
        </div>

        <div className="members-rail">
          {(signedIn && unlockedProducts.length ? unlockedProducts : catalog).map((product) => (
            <ProductPoster key={product.id} product={product} signedIn={signedIn} />
          ))}
        </div>
      </section>

      <section id="produtos" className="members-rails is-secondary">
        <div className="members-rail-head">
          <span>Prateleira digital</span>
          <h2>{lockedProducts.length ? 'Outros produtos para desbloquear' : 'Todos os produtos'}</h2>
        </div>

        {catalog.length ? (
          <div className="members-rail">
            {(lockedProducts.length ? lockedProducts : catalog).map((product) => (
              <ProductPoster key={product.id} product={product} signedIn={signedIn} />
            ))}
          </div>
        ) : (
          <div className="members-empty">
            <BookOpen size={34} />
            <h3>Nenhum produto publicado</h3>
            <p>Assim que um produto digital estiver ativo, ele aparece nesta área.</p>
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
          color: #fff;
          background:
            linear-gradient(180deg, rgba(2, 6, 7, 0.02), #020607 35%),
            linear-gradient(120deg, #03100f 0%, #020607 58%, #171006 100%);
          font-family: Inter, Arial, sans-serif;
        }

        .members-header {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          min-height: 54px;
          padding: 0 clamp(18px, 5vw, 72px);
          border-bottom: 1px solid rgba(232, 176, 73, 0.16);
          background: rgba(2, 6, 7, 0.9);
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
        .members-hero-book,
        .members-proof div,
        .members-poster-status,
        .members-poster-copy a,
        .members-trust div {
          display: inline-flex;
          align-items: center;
        }

        .members-brand {
          gap: 8px;
          color: #d8aa48;
          text-decoration: none;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1rem;
          font-weight: 800;
        }

        .members-nav {
          gap: 18px;
          font-size: 0.7rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .members-nav a {
          color: rgba(255, 255, 255, 0.74);
          text-decoration: none;
        }

        .members-login-link {
          min-height: 32px;
          justify-content: center;
          border-radius: 7px;
          padding: 0 14px;
          color: #061014 !important;
          background: #e8b049;
        }

        .members-account-link {
          width: 36px;
          height: 36px;
          justify-content: center;
          border: 1px solid rgba(232, 176, 73, 0.44);
          border-radius: 999px;
          color: #061014 !important;
          background: #e8b049;
        }

        .members-hero {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 430px);
          align-items: center;
          gap: clamp(34px, 7vw, 92px);
          min-height: 67vh;
          padding: clamp(58px, 8vw, 96px) clamp(18px, 5vw, 72px) 54px;
          overflow: hidden;
        }

        .members-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            linear-gradient(90deg, rgba(2, 6, 7, 0.98) 0%, rgba(2, 6, 7, 0.85) 42%, rgba(2, 6, 7, 0.72) 100%),
            url("/images/products/corretor-nota-8-hero-bg-optimized.jpg") center / cover no-repeat;
          opacity: 0.98;
        }

        .members-hero-copy,
        .members-hero-book {
          position: relative;
          z-index: 1;
        }

        .members-hero-copy {
          max-width: 650px;
        }

        .members-kicker {
          gap: 8px;
          width: fit-content;
          margin-bottom: 12px;
          padding: 7px 9px;
          border: 1px solid rgba(232, 176, 73, 0.48);
          border-radius: 7px;
          color: #e8b049;
          background: rgba(232, 176, 73, 0.08);
          font-size: 0.68rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .members-hero h1 {
          max-width: 650px;
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(3.1rem, 6.6vw, 6.4rem);
          line-height: 0.91;
          letter-spacing: 0;
        }

        .members-hero-copy > strong {
          display: block;
          max-width: 560px;
          margin-top: 18px;
          color: #e8b049;
          font-size: clamp(1.02rem, 1.45vw, 1.28rem);
          line-height: 1.45;
        }

        .members-hero p {
          max-width: 590px;
          margin: 14px 0 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 0.96rem;
          line-height: 1.68;
        }

        .members-actions {
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 24px;
        }

        .members-primary,
        .members-secondary,
        .members-poster-copy a {
          min-height: 42px;
          justify-content: center;
          gap: 8px;
          border-radius: 7px;
          padding: 0 16px;
          font-size: 0.75rem;
          font-weight: 950;
          text-decoration: none;
          text-transform: uppercase;
        }

        .members-primary {
          color: #061014;
          background: #e8b049;
          box-shadow: 0 16px 34px rgba(232, 176, 73, 0.18);
        }

        .members-secondary,
        .members-poster-copy a {
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.05);
        }

        .members-hero-book {
          justify-self: center;
          flex-direction: column;
          align-items: flex-start;
          width: min(100%, 330px);
          color: #fff;
          text-decoration: none;
        }

        .members-hero-cover {
          width: 100%;
          aspect-ratio: 3 / 4.08;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(232, 176, 73, 0.42);
          border-radius: 8px;
          color: #e8b049;
          background: rgba(232, 176, 73, 0.08);
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.48);
        }

        .members-hero-cover img,
        .members-poster-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .members-hero-book span {
          margin-top: 12px;
          color: #e8b049;
          font-size: 0.68rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .members-hero-book strong {
          margin-top: 4px;
          font-size: 0.84rem;
          line-height: 1.35;
        }

        .members-proof {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          border-top: 1px solid rgba(232, 176, 73, 0.16);
          border-bottom: 1px solid rgba(232, 176, 73, 0.16);
          background: rgba(232, 176, 73, 0.18);
        }

        .members-proof div {
          justify-content: center;
          gap: 8px;
          min-height: 52px;
          color: rgba(255, 255, 255, 0.82);
          background: #031012;
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .members-proof svg {
          color: #e8b049;
        }

        .members-rails {
          padding: clamp(34px, 5vw, 58px) clamp(18px, 5vw, 72px) 14px;
          background: #031012;
        }

        .members-rails.is-secondary {
          padding-top: 26px;
          padding-bottom: clamp(42px, 6vw, 72px);
          background: linear-gradient(180deg, #031012, #020607);
        }

        .members-rail-head {
          margin-bottom: 18px;
        }

        .members-rail-head span,
        .members-poster-copy > span {
          color: #e8b049;
          font-size: 0.7rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .members-rail-head h2 {
          margin: 6px 0 0;
          font-family: Inter, Arial, sans-serif;
          font-size: clamp(1.28rem, 2.1vw, 1.95rem);
          font-weight: 950;
          letter-spacing: 0;
          line-height: 1.1;
        }

        .members-rail {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: minmax(190px, 224px);
          gap: 16px;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 2px 2px 18px;
          scroll-snap-type: x proximity;
        }

        .members-rail::-webkit-scrollbar {
          height: 8px;
        }

        .members-rail::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(232, 176, 73, 0.38);
        }

        .members-poster {
          min-width: 0;
          scroll-snap-align: start;
        }

        .members-poster-cover {
          position: relative;
          display: grid;
          place-items: center;
          aspect-ratio: 3 / 4;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #e8b049;
          background: rgba(255, 255, 255, 0.04);
          transition: transform 180ms ease, border-color 180ms ease;
        }

        .members-poster:hover .members-poster-cover {
          transform: translateY(-4px);
          border-color: rgba(232, 176, 73, 0.52);
        }

        .members-poster.is-locked .members-poster-cover img {
          filter: saturate(0.76) brightness(0.7);
        }

        .members-poster-status {
          position: absolute;
          right: 10px;
          bottom: 10px;
          gap: 5px;
          min-height: 26px;
          border-radius: 999px;
          padding: 0 8px;
          color: #fff;
          background: rgba(0, 0, 0, 0.74);
          font-size: 0.61rem;
          font-weight: 950;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
        }

        .members-poster.is-open .members-poster-status {
          color: #052314;
          background: #79e0a6;
        }

        .members-poster-copy {
          display: grid;
          gap: 8px;
          padding-top: 12px;
        }

        .members-poster-copy h3 {
          margin: 0;
          overflow-wrap: anywhere;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.08rem;
          line-height: 1.1;
        }

        .members-poster-copy p {
          display: -webkit-box;
          min-height: 42px;
          margin: 0;
          overflow: hidden;
          color: rgba(255, 255, 255, 0.62);
          font-size: 0.78rem;
          line-height: 1.45;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .members-poster-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .members-poster-meta small {
          color: #e8b049;
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .members-poster-meta strong {
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.78rem;
        }

        .members-poster-copy a {
          width: 100%;
          min-height: 36px;
          font-size: 0.68rem;
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
          justify-content: center;
          gap: 11px;
          min-height: 72px;
          color: rgba(255, 255, 255, 0.82);
          background: #020607;
          font-size: 0.86rem;
          font-weight: 850;
        }

        .members-trust svg {
          flex: 0 0 auto;
          color: #e8b049;
        }

        @media (max-width: 820px) {
          .members-header {
            padding: 0 16px;
          }

          .members-brand {
            font-size: 0.95rem;
          }

          .members-nav {
            gap: 10px;
          }

          .members-nav a:nth-child(2) {
            display: none;
          }

          .members-hero {
            grid-template-columns: 1fr;
            min-height: auto;
            padding: 36px 16px 30px;
          }

          .members-hero h1 {
            font-size: clamp(3rem, 16vw, 4.2rem);
          }

          .members-hero-book {
            width: min(74vw, 250px);
            justify-self: start;
          }

          .members-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .members-proof,
          .members-trust {
            grid-template-columns: 1fr;
          }

          .members-proof div {
            justify-content: flex-start;
            padding: 0 16px;
          }

          .members-rails,
          .members-rails.is-secondary {
            padding-left: 16px;
            padding-right: 16px;
          }

          .members-rail {
            grid-auto-columns: minmax(166px, 190px);
          }

          .members-trust div {
            justify-content: flex-start;
            padding: 0 16px;
          }
        }
      `}</style>
    </main>
  )
}
