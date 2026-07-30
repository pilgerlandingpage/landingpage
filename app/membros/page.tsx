import Link from 'next/link'
import { BookOpen, CheckCircle2, LockKeyhole, Play, ShieldCheck, Sparkles, UserCheck } from 'lucide-react'
import { loadMemberLibrary } from '@/lib/members/access'

export const dynamic = 'force-dynamic'

function initials(name?: string | null, email?: string | null) {
  const source = String(name || email || 'Membro').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MP'
}

function productKindLabel(type?: string | null) {
  if (type === 'ebook') return 'Livro online'
  if (type === 'course') return 'Curso'
  if (type === 'mentorship') return 'Mentoria'
  if (type === 'bundle') return 'Coleção'
  return 'Produto digital'
}

export default async function MembersPage() {
  const { user, member, products } = await loadMemberLibrary()
  const activeProducts = products
  const firstProduct = activeProducts[0]
  const memberName = member?.name || user?.user_metadata?.name || user?.email || 'Membro Pilger'

  return (
    <main className="members-shell">
      <header className="members-header">
        <Link href="/" className="members-brand">
          <BookOpen size={21} />
          <span>Pilger Play</span>
        </Link>
        <nav className="members-nav" aria-label="Área de membros">
          <Link href="/checkout/corretor-nota-8">Produtos</Link>
          <Link href="/login?next=/membros" className="members-login-link">
            {user ? initials(memberName, user.email) : 'Entrar'}
          </Link>
        </nav>
      </header>

      <section className="members-hero">
        <div className="members-hero-copy">
          <span className="members-kicker">
            <Sparkles size={15} />
            Área de membros Guilherme Pilger
          </span>
          <h1>{user ? `Bem-vindo, ${String(memberName).split(' ')[0]}.` : 'Sua biblioteca comercial começa aqui.'}</h1>
          <p>
            {user
              ? activeProducts.length
                ? 'Continue estudando seus conteúdos comprados e organize sua rotina de evolução comercial.'
                : 'Seu login está ativo. Assim que uma compra aprovada for vinculada ao seu e-mail, os conteúdos aparecem aqui.'
              : 'Entre com o e-mail usado na compra para acessar seus livros, cursos e materiais digitais em um ambiente simples, direto e premium.'}
          </p>
          <div className="members-actions">
            <Link href={user ? '#biblioteca' : '/login?next=/membros'} className="members-primary">
              {user ? 'Abrir biblioteca' : 'Entrar na área de membros'}
              <Play size={16} fill="currentColor" />
            </Link>
            <Link href="/checkout/corretor-nota-8" className="members-secondary">
              Ver produtos
            </Link>
          </div>
        </div>

        <div className="members-feature">
          <div className="members-feature-media">
            {firstProduct?.cover_image_url || firstProduct?.thumbnail_url ? (
              <img
                src={firstProduct.cover_image_url || firstProduct.thumbnail_url || ''}
                alt={firstProduct.title}
              />
            ) : (
              <div className="members-cover-fallback">
                <BookOpen size={42} />
                <strong>Corretor Nota 8</strong>
                <span>Biblioteca Pilger</span>
              </div>
            )}
          </div>
          <div className="members-feature-meta">
            <span>{activeProducts.length || 0} produto{activeProducts.length === 1 ? '' : 's'} liberado{activeProducts.length === 1 ? '' : 's'}</span>
            <strong>{firstProduct?.title || 'Acesso digital seguro'}</strong>
          </div>
        </div>
      </section>

      <section className="members-trust">
        <div>
          <ShieldCheck size={20} />
          <span>Acesso liberado automaticamente após pagamento aprovado</span>
        </div>
        <div>
          <UserCheck size={20} />
          <span>Conta vinculada ao e-mail da compra</span>
        </div>
        <div>
          <CheckCircle2 size={20} />
          <span>Produtos digitais sem frete, tamanho ou variação</span>
        </div>
      </section>

      <section id="biblioteca" className="members-library">
        <div className="members-section-title">
          <span>Minha biblioteca</span>
          <h2>{user ? 'Conteúdos disponíveis' : 'Entre para ver seus produtos'}</h2>
        </div>

        {!user ? (
          <div className="members-empty">
            <LockKeyhole size={30} />
            <h3>Acesso protegido</h3>
            <p>Use o mesmo e-mail informado no checkout para abrir sua biblioteca.</p>
            <Link href="/login?next=/membros">Entrar agora</Link>
          </div>
        ) : activeProducts.length ? (
          <div className="members-rail">
            {activeProducts.map((product) => (
              <article key={product.id} className="members-product">
                <div className="members-product-media">
                  {product.thumbnail_url || product.cover_image_url ? (
                    <img
                      src={product.thumbnail_url || product.cover_image_url || ''}
                      alt={product.title}
                    />
                  ) : (
                    <BookOpen size={36} />
                  )}
                  <span>{productKindLabel(product.product_type)}</span>
                </div>
                <div className="members-product-copy">
                  <h3>{product.title}</h3>
                  <p>{product.subtitle || product.description || 'Conteúdo disponível na sua biblioteca.'}</p>
                  <Link href={`/membros/${product.slug}`}>
                    Continuar
                    <Play size={14} fill="currentColor" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="members-empty">
            <BookOpen size={30} />
            <h3>Nenhum produto liberado ainda</h3>
            <p>Quando o pagamento for aprovado, a automação cria o acesso e esta biblioteca passa a mostrar seus conteúdos.</p>
            <Link href="/checkout/corretor-nota-8">Conhecer o Corretor Nota 8</Link>
          </div>
        )}
      </section>

      <style>{`
        .members-shell {
          min-height: 100vh;
          background:
            linear-gradient(180deg, rgba(0, 0, 0, 0.12), #020607 42%),
            linear-gradient(120deg, #041417 0%, #020607 52%, #130b05 100%);
          color: #fff;
          font-family: Inter, Arial, sans-serif;
        }

        .members-header {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 18px clamp(20px, 5vw, 72px);
          background: rgba(2, 6, 7, 0.82);
          border-bottom: 1px solid rgba(232, 176, 73, 0.18);
          backdrop-filter: blur(16px);
        }

        .members-brand,
        .members-nav,
        .members-actions,
        .members-kicker,
        .members-primary,
        .members-secondary,
        .members-product-copy a {
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
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .members-nav a {
          color: rgba(255, 255, 255, 0.72);
          text-decoration: none;
        }

        .members-login-link {
          min-width: 42px;
          min-height: 42px;
          justify-content: center;
          border: 1px solid rgba(232, 176, 73, 0.36);
          border-radius: 999px;
          color: #f3c45e !important;
          background: rgba(232, 176, 73, 0.1);
        }

        .members-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.06fr) minmax(280px, 0.72fr);
          align-items: center;
          gap: clamp(28px, 5vw, 72px);
          min-height: 68vh;
          padding: clamp(44px, 8vw, 104px) clamp(20px, 5vw, 72px) 42px;
          overflow: hidden;
        }

        .members-hero-copy {
          max-width: 720px;
        }

        .members-kicker {
          gap: 8px;
          width: fit-content;
          margin-bottom: 18px;
          padding: 7px 10px;
          border: 1px solid rgba(232, 176, 73, 0.5);
          border-radius: 8px;
          color: #f3c45e;
          font-size: 0.76rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .members-hero h1 {
          max-width: 780px;
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(2.45rem, 5vw, 5.4rem);
          line-height: 0.94;
          letter-spacing: 0;
        }

        .members-hero p {
          max-width: 640px;
          margin: 22px 0 0;
          color: rgba(255, 255, 255, 0.74);
          font-size: clamp(1rem, 1.2vw, 1.14rem);
          line-height: 1.7;
        }

        .members-actions {
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 28px;
        }

        .members-primary,
        .members-secondary,
        .members-product-copy a,
        .members-empty a {
          min-height: 44px;
          justify-content: center;
          gap: 9px;
          border-radius: 7px;
          padding: 0 18px;
          font-size: 0.82rem;
          font-weight: 950;
          text-decoration: none;
          text-transform: uppercase;
        }

        .members-primary,
        .members-empty a {
          color: #061014;
          background: #e8b049;
          box-shadow: 0 16px 34px rgba(232, 176, 73, 0.18);
        }

        .members-secondary {
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.04);
        }

        .members-feature {
          justify-self: center;
          width: min(100%, 410px);
        }

        .members-feature-media {
          display: grid;
          place-items: center;
          aspect-ratio: 3 / 4.08;
          border: 1px solid rgba(232, 176, 73, 0.34);
          border-radius: 8px;
          background: linear-gradient(145deg, rgba(232, 176, 73, 0.14), rgba(255, 255, 255, 0.02));
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.46);
          overflow: hidden;
        }

        .members-feature-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .members-cover-fallback {
          display: grid;
          place-items: center;
          gap: 10px;
          min-height: 100%;
          width: 100%;
          color: #f3c45e;
          text-align: center;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(180deg, rgba(255,255,255,0.05) 1px, transparent 1px),
            #071317;
          background-size: 28px 28px;
        }

        .members-cover-fallback strong {
          color: #fff;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.8rem;
        }

        .members-cover-fallback span {
          color: rgba(255,255,255,0.68);
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .members-feature-meta {
          display: grid;
          gap: 5px;
          margin-top: 14px;
        }

        .members-feature-meta span {
          color: #e8b049;
          font-size: 0.74rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .members-feature-meta strong {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.35rem;
        }

        .members-trust {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          border-top: 1px solid rgba(232, 176, 73, 0.14);
          border-bottom: 1px solid rgba(232, 176, 73, 0.14);
          background: rgba(232, 176, 73, 0.18);
        }

        .members-trust div {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 86px;
          padding: 18px clamp(20px, 4vw, 62px);
          color: rgba(255, 255, 255, 0.82);
          background: #03090b;
          font-size: 0.92rem;
          font-weight: 800;
        }

        .members-trust svg {
          flex: 0 0 auto;
          color: #e8b049;
        }

        .members-library {
          padding: clamp(42px, 7vw, 86px) clamp(20px, 5vw, 72px) 86px;
        }

        .members-section-title span {
          color: #e8b049;
          font-size: 0.76rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .members-section-title h2 {
          margin: 8px 0 24px;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(1.8rem, 3vw, 3.1rem);
          letter-spacing: 0;
        }

        .members-rail {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 18px;
        }

        .members-product {
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.045);
        }

        .members-product-media {
          position: relative;
          display: grid;
          place-items: center;
          aspect-ratio: 16 / 10;
          color: #e8b049;
          background: #071317;
          overflow: hidden;
        }

        .members-product-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .members-product-media span {
          position: absolute;
          left: 12px;
          top: 12px;
          padding: 6px 8px;
          border-radius: 6px;
          color: #061014;
          background: #e8b049;
          font-size: 0.68rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .members-product-copy {
          padding: 16px;
        }

        .members-product-copy h3 {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.28rem;
        }

        .members-product-copy p {
          min-height: 48px;
          margin: 9px 0 15px;
          color: rgba(255, 255, 255, 0.68);
          font-size: 0.9rem;
          line-height: 1.55;
        }

        .members-product-copy a {
          width: fit-content;
          min-height: 38px;
          color: #061014;
          background: #e8b049;
        }

        .members-empty {
          display: grid;
          justify-items: center;
          gap: 12px;
          max-width: 620px;
          margin: 18px auto 0;
          padding: 42px 20px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.76);
          text-align: center;
          background: rgba(255, 255, 255, 0.04);
        }

        .members-empty h3 {
          margin: 0;
          color: #fff;
          font-size: 1.35rem;
        }

        .members-empty p {
          max-width: 460px;
          margin: 0;
          line-height: 1.65;
        }

        .members-empty svg {
          color: #e8b049;
        }

        @media (max-width: 760px) {
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

          .members-hero {
            grid-template-columns: 1fr;
            min-height: auto;
            padding: 34px 16px 30px;
          }

          .members-hero h1 {
            font-size: clamp(2.25rem, 12vw, 3.35rem);
          }

          .members-feature {
            justify-self: stretch;
            width: min(82vw, 310px);
            margin: 0 auto;
          }

          .members-trust {
            grid-template-columns: 1fr;
          }

          .members-trust div {
            min-height: 68px;
            padding: 16px;
          }

          .members-library {
            padding: 38px 16px 64px;
          }

          .members-actions {
            display: grid;
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}
