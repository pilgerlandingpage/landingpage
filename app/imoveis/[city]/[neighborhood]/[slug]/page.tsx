import { notFound } from 'next/navigation'
import PropertyDetailPage, { generateMetadata as generatePropertyDetailMetadata } from '@/app/imovel/[id]/detalhes/page'
import { extractPropertyIdFromSeoSlug } from '@/lib/properties/seo-url'

export const revalidate = 300

export function generateStaticParams() {
  return []
}

type PageParams = {
  params: Promise<{
    city: string
    neighborhood: string
    slug: string
  }>
}

async function resolvePropertyId(params: PageParams['params']) {
  const { slug } = await params
  return extractPropertyIdFromSeoSlug(slug)
}

export async function generateMetadata({ params }: PageParams) {
  const id = await resolvePropertyId(params)
  if (!id) return {}

  return generatePropertyDetailMetadata({
    params: Promise.resolve({ id }),
  })
}

export default async function SeoPropertyPage({ params }: PageParams) {
  const id = await resolvePropertyId(params)
  if (!id) notFound()

  return PropertyDetailPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({ canonicalize: 'false' }),
  })
}
