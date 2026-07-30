import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, LockKeyhole, ShoppingCart } from 'lucide-react'
import { loadMemberProduct } from '@/lib/members/access'
import MembersProductClient from './MembersProductClient'

type PageContext = {
  params: Promise<{ slug: string }>
}

function encodedNext(slug: string) {
  return encodeURIComponent(`/membros/${slug}`)
}

export default async function MemberProductPage({ params }: PageContext) {
  const { slug } = await params
  const data = await loadMemberProduct(slug)

  if (!data.user) {
    redirect(`/membros/entrar?next=${encodedNext(slug)}`)
  }

  if (!data.member || data.member.status !== 'active') {
    return (
      <MemberAccessState
        title="Conta de membro não encontrada"
        message="Entre com o mesmo e-mail usado na compra. Se o pagamento já foi aprovado, seu acesso será vinculado automaticamente."
        actionHref="/membros"
        actionLabel="Voltar para a biblioteca"
      />
    )
  }

  if (!data.product) {
    return (
      <MemberAccessState
        title="Produto não encontrado"
        message="Esse conteúdo não está disponível na biblioteca no momento."
        actionHref="/membros"
        actionLabel="Voltar para a biblioteca"
      />
    )
  }

  if (!data.entitlement) {
    return (
      <MemberAccessState
        title="Produto ainda não liberado"
        message="Esta conta não possui acesso ativo a este produto. Se você acabou de comprar, aguarde a confirmação do pagamento."
        actionHref={`/checkout/${slug}`}
        actionLabel="Ver ofertas disponíveis"
        icon="cart"
      />
    )
  }

  return (
    <MembersProductClient
      product={data.product}
      contents={data.contents}
      progress={data.progress}
      memberName={data.member.name || data.user.email || 'Membro Pilger'}
    />
  )
}

function MemberAccessState(props: {
  title: string
  message: string
  actionHref: string
  actionLabel: string
  icon?: 'lock' | 'cart'
}) {
  const Icon = props.icon === 'cart' ? ShoppingCart : props.icon === 'lock' ? LockKeyhole : BookOpen

  return (
    <main className="member-state">
      <section>
        <Icon size={38} />
        <h1>{props.title}</h1>
        <p>{props.message}</p>
        <Link href={props.actionHref}>{props.actionLabel}</Link>
      </section>

      <style>{`
        .member-state {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          color: #fff;
          background:
            radial-gradient(circle at top, rgba(232, 176, 73, 0.13), transparent 36%),
            #020607;
          font-family: Inter, Arial, sans-serif;
        }

        .member-state section {
          display: grid;
          justify-items: center;
          gap: 14px;
          width: min(100%, 560px);
          padding: 38px 20px;
          border: 1px solid rgba(232, 176, 73, 0.18);
          border-radius: 8px;
          text-align: center;
          background: rgba(255, 255, 255, 0.04);
        }

        .member-state svg {
          color: #e8b049;
        }

        .member-state h1 {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(2rem, 8vw, 3.6rem);
          line-height: 1;
        }

        .member-state p {
          max-width: 470px;
          margin: 0;
          color: rgba(255,255,255,0.72);
          line-height: 1.65;
        }

        .member-state a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 16px;
          border-radius: 7px;
          color: #061014;
          background: #e8b049;
          font-size: 0.82rem;
          font-weight: 950;
          text-decoration: none;
          text-transform: uppercase;
        }
      `}</style>
    </main>
  )
}
