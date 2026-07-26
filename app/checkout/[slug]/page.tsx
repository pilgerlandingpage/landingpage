import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CheckoutClient from './CheckoutClient'
import { centsToMoney, loadCheckoutOffer } from '@/lib/commerce/checkout'

export const revalidate = 120

export function generateStaticParams() {
  return []
}

type PageContext = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageContext): Promise<Metadata> {
  const { slug } = await params
  const checkout = await loadCheckoutOffer(slug).catch(() => null)

  if (!checkout) {
    return {
      title: 'Checkout indisponível | Guilherme Pilger',
    }
  }

  return {
    title: `Checkout ${checkout.product.title} | Guilherme Pilger`,
    description: `Finalize a compra de ${checkout.product.title} por ${centsToMoney(checkout.offer.price_cents)} via Pix.`,
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function CheckoutPage({ params }: PageContext) {
  const { slug } = await params
  const checkout = await loadCheckoutOffer(slug)

  if (!checkout) notFound()

  return (
    <CheckoutClient
      checkoutSlug={slug}
      product={checkout.product}
      offer={checkout.offer}
      bumps={checkout.bumps}
    />
  )
}
