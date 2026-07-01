import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CheckCircle2, HelpCircle, MapPin } from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import PropertyCard from '@/components/marketplace/PropertyCard'
import { createAdminClient } from '@/lib/supabase/server'
import { geoPages, getGeoPage } from '@/lib/seo/geo-pages'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE } from '@/lib/seo/json-ld'
import { displayLocationName, normalizeLocationName } from '@/lib/locations/display'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'

export const revalidate = 300

type PageParams = { params: Promise<{ city: string }> }

const PROPERTY_FIELDS = [
  'id',
  'source_slug',
  'title',
  'seo_title',
  'description',
  'city',
  'state',
  'price',
  'bedrooms',
  'bathrooms',
  'suites',
  'parking_spaces',
  'area_m2',
  'featured_image',
  'images',
  'property_type',
  'exclusive',
  'neighborhood',
  'amenities',
  'source_status',
].join(',')

const GEO_PROPERTY_DESCRIPTION_LIMIT = 360
const GEO_PROPERTY_IMAGE_LIMIT = 6
const GEO_PROPERTY_AMENITY_LIMIT = 8

export function generateStaticParams() {
  return geoPages.map(page => ({ city: page.slug }))
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { city } = await params
  const page = getGeoPage(city)
  if (!page) return { title: 'Página não encontrada' }

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: `/imoveis/${page.slug}`,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `/imoveis/${page.slug}`,
      type: 'website',
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [DEFAULT_OG_IMAGE],
    },
  }
}

function safeSearch(value: string) {
  return value.replace(/[(),{}]/g, ' ').trim()
}

function applyTextTerms(query: any, terms?: string[]) {
  if (!terms?.length) return query

  const orFilter = terms
    .filter(Boolean)
    .flatMap(term => [
      `title.ilike.%${safeSearch(term)}%`,
      `description.ilike.%${safeSearch(term)}%`,
      `property_type.ilike.%${safeSearch(term)}%`,
    ])
    .join(',')

  return orFilter ? query.or(orFilter) : query
}

function applyGeoFilters(query: any, page: NonNullable<ReturnType<typeof getGeoPage>>) {
  if (page.filters.city) {
    const city = normalizeLocationName(page.filters.city)
    if (city === 'balneario camboriu') {
      query = query.or('city.ilike.%Balneario Camboriu%,city.ilike.%Balneário Camboriú%')
    } else if (city === 'itajai' || city === 'praia brava') {
      query = query.or('city.ilike.%Itajai%,city.ilike.%Itajaí%')
    } else {
      query = query.ilike('city', `%${page.filters.city}%`)
    }
  }

  if (page.filters.type === 'casa') {
    query = query.or('property_type.ilike.%Casa%,property_type.ilike.%Sobrado%,property_type.ilike.%Mansao%,property_type.ilike.%Mansão%,title.ilike.%Casa%')
  }

  if (page.filters.type === 'apartamento') {
    query = query.or('property_type.ilike.%Apartamento%,property_type.ilike.%Apto%,title.ilike.%Apartamento%')
  }

  if (page.filters.subtype === 'cobertura') {
    query = query.or('property_type.ilike.%Cobertura%,title.ilike.%Cobertura%')
  }

  if (page.filters.priceMin) query = query.gte('price', page.filters.priceMin)

  return applyTextTerms(query, page.filters.textTerms)
}

function normalizeSearchText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function matchesTextTerms(property: any, terms?: string[]) {
  if (!terms?.length) return true

  const text = normalizeSearchText([
    property.title,
    property.description,
    property.property_type,
    property.neighborhood,
    property.source_status,
  ].filter(Boolean).join(' '))

  return terms.every(term => text.includes(normalizeSearchText(term)))
}

function compactGeoProperty(property: any) {
  const description = String(property.description || '')

  return {
    ...property,
    description: description.length > GEO_PROPERTY_DESCRIPTION_LIMIT
      ? `${description.slice(0, GEO_PROPERTY_DESCRIPTION_LIMIT)}...`
      : description,
    images: Array.isArray(property.images)
      ? property.images.filter(Boolean).slice(0, GEO_PROPERTY_IMAGE_LIMIT)
      : property.images,
    amenities: Array.isArray(property.amenities)
      ? property.amenities.filter(Boolean).slice(0, GEO_PROPERTY_AMENITY_LIMIT)
      : property.amenities,
  }
}

async function getProperties(page: NonNullable<ReturnType<typeof getGeoPage>>) {
  const supabase = createAdminClient()
  let query = supabase
    .from('properties')
    .select(PROPERTY_FIELDS)
    .eq('status', 'active')
    .order('price', { ascending: false, nullsFirst: false })
    .limit(page.filters.textTerms?.length ? 60 : 12)

  query = applyGeoFilters(query, page)

  const [{ data: properties }, { data: landingPages }] = await Promise.all([
    query,
    supabase
      .from('landing_pages')
      .select('slug, property_id')
      .eq('status', 'published'),
  ])

  const lpMap: Record<string, string> = {}
  landingPages?.forEach((lp: any) => {
    if (lp.property_id && lp.slug) lpMap[lp.property_id] = lp.slug
  })

  return {
    properties: (properties || [])
      .filter((property: any) => matchesTextTerms(property, page.filters.textTerms))
      .slice(0, 12)
      .map(compactGeoProperty),
    lpMap,
  }
}

function buildJsonLd(page: NonNullable<ReturnType<typeof getGeoPage>>, properties: any[]) {
  return [
    organizationJsonLd(),
    webPageJsonLd({
      path: `/imoveis/${page.slug}`,
      name: page.title,
      description: page.description,
      type: 'CollectionPage',
    }),
    breadcrumbJsonLd([
      { name: 'Home', url: '/' },
      { name: 'Imóveis', url: '/imoveis' },
      { name: page.h1, url: `/imoveis/${page.slug}` },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: page.title,
      url: absoluteUrl(`/imoveis/${page.slug}`),
      description: page.description,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: properties.slice(0, 12).map((property, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: absoluteUrl(propertyDetailsPath(property)),
          name: property.title,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ]
}

export default async function GeoIntentPage({ params }: PageParams) {
  const { city } = await params
  const page = getGeoPage(city)
  if (!page) notFound()

  const { properties, lpMap } = await getProperties(page)
  const jsonLd = buildJsonLd(page, properties)

  return (
    <>
      <GlobalHeader />
      <JsonLd data={jsonLd} />
      <main className="geo-page">
        <section className="geo-hero">
          <div>
            <span>{page.eyebrow}</span>
            <h1>{page.h1}</h1>
            <p>{page.description}</p>
            <div className="geo-actions">
              <Link href={page.searchHref}>Ver todos os imóveis <ArrowRight size={16} /></Link>
              <WhatsAppCaptureLink
                phone="5547992528080"
                message={`Olá! Quero uma curadoria para ${page.h1}.`}
                slug="imoveis-cidade"
                template="geo-hero-curadoria"
              >
                Pedir curadoria
              </WhatsAppCaptureLink>
            </div>
          </div>
          <aside>
            <MapPin size={20} />
            <strong>{properties.length || 'Curadoria'}</strong>
            <small>{properties.length === 1 ? 'imóvel selecionado' : 'imóveis selecionados'}</small>
          </aside>
        </section>

        <section className="geo-highlights">
          {page.highlights.map(item => (
            <div key={item}>
              <CheckCircle2 size={18} />
              <span>{item}</span>
            </div>
          ))}
        </section>

        <section className="geo-content">
          <div className="geo-copy">
            <span>Leitura de mercado</span>
            <h2>Curadoria com contexto antes da visita.</h2>
            <p>
              A seleção abaixo combina dados do estoque ativo, leitura de localização e sinais de desejo do mercado.
              Para quem compra alto padrão, a decisão certa depende de comparar produto, construtora, vista, liquidez e momento.
            </p>
          </div>
          <div className="geo-faq">
            <div className="geo-faq-title"><HelpCircle size={18} /> Perguntas frequentes</div>
            {page.faqs.map(item => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="geo-properties">
          <div className="geo-section-head">
            <span>Imóveis em destaque</span>
            <h2>{page.h1}</h2>
          </div>
          {properties.length > 0 ? (
            <div className="geo-property-grid">
              {properties.map((property: any, index: number) => (
                <PropertyCard
                  key={property.id}
                  property={{
                    ...property,
                    city: displayLocationName(property.city),
                  }}
                  landingPageSlug={lpMap[property.id]}
                  imagePriority={index < 3}
                />
              ))}
            </div>
          ) : (
            <div className="geo-empty">
              <strong>Curadoria sob consulta</strong>
              <p>Essa página já está pronta para ranquear. Assim que houver imóveis compatíveis no estoque ativo, eles aparecem aqui automaticamente.</p>
              <WhatsAppCaptureLink
                phone="5547992528080"
                message={`Olá! Quero falar com um especialista sobre ${page.h1}.`}
                slug="imoveis-cidade"
                template="geo-empty-especialista"
              >
                Falar com especialista
              </WhatsAppCaptureLink>
            </div>
          )}
        </section>
      </main>
      <Footer />

      <style>{`
        .geo-page { background: #faf7f1; color: #181511; }
        .geo-hero { align-items: end; background: linear-gradient(135deg, #17120d, #352b20); color: #fff8ea; display: grid; gap: 28px; grid-template-columns: minmax(0, 1fr) 260px; padding: 150px 7vw 72px; }
        .geo-hero span, .geo-copy span, .geo-section-head span { color: #d6b677; display: block; font-size: .72rem; font-weight: 950; letter-spacing: .16em; margin-bottom: 12px; text-transform: uppercase; }
        .geo-hero h1 { font-family: var(--font-serif); font-size: clamp(2.4rem, 6vw, 5.4rem); line-height: .93; margin: 0; max-width: 980px; }
        .geo-hero p { color: rgba(255,255,255,.72); font-size: 1.03rem; line-height: 1.68; max-width: 760px; }
        .geo-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
        .geo-actions a { align-items: center; border-radius: 999px; display: inline-flex; font-size: .78rem; font-weight: 950; gap: 8px; min-height: 44px; padding: 0 17px; text-decoration: none; text-transform: uppercase; }
        .geo-actions a:first-child { background: #c9a96e; color: #111; }
        .geo-actions a:last-child { border: 1px solid rgba(255,255,255,.18); color: #fff8ea; }
        .geo-hero aside { background: rgba(255,255,255,.08); border: 1px solid rgba(214,182,119,.28); border-radius: 18px; display: grid; gap: 8px; justify-items: start; padding: 22px; }
        .geo-hero aside strong { font-family: var(--font-serif); font-size: 2.7rem; line-height: .95; }
        .geo-hero aside small { color: rgba(255,255,255,.68); font-weight: 800; text-transform: uppercase; }
        .geo-highlights { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 24px 7vw 0; }
        .geo-highlights div { align-items: center; background: #fff; border: 1px solid rgba(201,169,110,.22); border-radius: 14px; display: flex; gap: 10px; padding: 16px; }
        .geo-highlights svg { color: #b8945f; }
        .geo-content { align-items: start; display: grid; gap: 30px; grid-template-columns: minmax(0, .9fr) minmax(340px, .75fr); padding: 44px 7vw; }
        .geo-copy h2, .geo-section-head h2 { font-family: var(--font-serif); font-size: clamp(2rem, 4vw, 3.4rem); line-height: 1; margin: 0 0 16px; }
        .geo-copy p { color: #665b50; line-height: 1.75; }
        .geo-faq { background: #fff; border: 1px solid rgba(201,169,110,.22); border-radius: 16px; padding: 18px; }
        .geo-faq-title { align-items: center; display: flex; gap: 8px; font-weight: 950; margin-bottom: 6px; }
        .geo-faq details { border-top: 1px solid rgba(31,27,21,.08); padding: 12px 0; }
        .geo-faq details:first-of-type { border-top: 0; }
        .geo-faq summary { cursor: pointer; font-weight: 900; }
        .geo-faq p { color: #665b50; line-height: 1.6; margin-bottom: 0; }
        .geo-properties { padding: 0 7vw 76px; }
        .geo-section-head { margin-bottom: 22px; }
        .geo-property-grid { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .geo-empty { background: #fff; border: 1px solid rgba(201,169,110,.22); border-radius: 16px; padding: 28px; }
        .geo-empty strong { display: block; font-family: var(--font-serif); font-size: 1.8rem; }
        .geo-empty p { color: #665b50; }
        .geo-empty a { color: #9a7135; font-weight: 950; text-decoration: none; text-transform: uppercase; }
        @media (max-width: 940px) {
          .geo-hero, .geo-content, .geo-highlights, .geo-property-grid { grid-template-columns: 1fr; }
          .geo-hero { padding-top: 112px; }
          .geo-actions a { justify-content: center; width: 100%; }
        }
      `}</style>
    </>
  )
}
