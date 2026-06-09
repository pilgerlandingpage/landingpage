import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowRight,
    Bath,
    BedDouble,
    Camera,
    Car,
    CheckCircle2,
    Eye,
    Home,
    MapPin,
    MessageCircle,
    Ruler,
    Star,
    Tag,
} from 'lucide-react'
import PropertyLandingTracker from '@/components/property/PropertyLandingTracker'
import PropertyLandingUrlTracker from '@/components/property/PropertyLandingUrlTracker'
import PropertyPhotoShowcase from '@/components/property/PropertyPhotoShowcase'
import PropertyLandingShareButton from '@/components/property/PropertyLandingShareButton'
import MobileNav from '@/components/marketplace/MobileNav'
import MapSearch from '@/components/marketplace/MapSearch'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import PropertyLandingStyles from '../PropertyLandingStyles'
import { displayLocationName, replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, DEFAULT_OG_IMAGE, webPageJsonLd } from '@/lib/seo/json-ld'
import { cleanPropertyText, compactPropertyText } from '@/lib/properties/text'
import { buildPropertySeoPath } from '@/lib/properties/seo-url'
import { GLOBAL_PROPERTY_WHATSAPP_PHONE, getResponsibleBrokerForProperty } from '@/lib/properties/responsible-broker'

export const dynamic = 'force-dynamic'

const BROKER_IMAGE = '/images/eventos/guilherme-pilger.png'

async function getPropertyForSeo(id: string) {
    const supabase = await createServerSupabase()
    const { data } = await supabase
        .from('properties')
        .select('id, title, description, seo_title, seo_description, city, state, neighborhood, price, featured_image, images, property_type, bedrooms, bathrooms, suites, parking_spaces, area_m2, area_private_m2, latitude, longitude, amenities, status, created_at, updated_at')
        .eq('id', id)
        .maybeSingle()

    return data
}

function shortText(value?: string | null, fallback = '') {
    return compactPropertyText(value, fallback, 160)
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const property = await getPropertyForSeo(id)
    if (!property) return { title: 'Imóvel não encontrado' }

    const title = replaceItajaiWithPraiaBrava(property.seo_title || property.title || 'Imóvel de luxo')
    const city = displayLocationName(property.city)
    const description = shortText(
        property.seo_description || property.description,
        `${property.property_type || 'Imóvel'} de alto padrão em ${city}. Fale com Guilherme Pilger para receber uma curadoria completa.`
    )
    const image = property.featured_image || property.images?.[0] || DEFAULT_OG_IMAGE
    const canonicalPath = buildPropertySeoPath(property)

    return {
        title,
        description,
        alternates: {
            canonical: canonicalPath,
        },
        openGraph: {
            title,
            description,
            url: canonicalPath,
            type: 'website',
            images: [image],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [image],
        },
    }
}

function formatDescription(raw: string): string[] {
    const text = cleanPropertyText(raw)
    if (!text) return []

    const existingParagraphs = text
        .split('\n')
        .map(paragraph => paragraph.trim())
        .filter(paragraph => paragraph.length >= 40)

    if (existingParagraphs.length >= 2) return existingParagraphs.slice(0, 5)

    const protectedText = text.replace(/\b(Av|Dr|Dra|Ed|Ref|R|Sr|Sra)\./g, '$1<DOT>')

    const sentences = protectedText
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .map(s => s.replace(/<DOT>/g, '.').trim().replace(/^[,;:\s]+/, ''))
        .filter(s => {
            if (s.length < 40) return false
            if (/^\d/.test(s)) return false
            return /[aeiouáéíóúãõ]{2,}/i.test(s)
        })

    if (sentences.length === 0) return []

    const paragraphs: string[] = []
    for (let i = 0; i < sentences.length; i += 2) {
        const chunk = sentences.slice(i, i + 2).join(' ').trim()
        if (chunk.length > 40) paragraphs.push(chunk)
    }
    return paragraphs.slice(0, 5)
}

function formatMoney(value?: number | null, fallback = 'Sob consulta') {
    return value
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
        : fallback
}

function getGallery(property: any) {
    return Array.from(new Set([property.featured_image, ...(property.images || [])].filter(Boolean) as string[]))
}

function extractYouTubeId(url?: string | null) {
    const raw = String(url || '')
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ]
    for (const pattern of patterns) {
        const match = raw.match(pattern)
        if (match) return match[1]
    }
    return null
}

function chunkList<T>(items: T[], columns = 2) {
    const size = Math.ceil(items.length / columns)
    return Array.from({ length: columns }, (_, index) => items.slice(index * size, (index + 1) * size)).filter(group => group.length)
}

function statLabel(value: number, singular: string, plural: string) {
    return value === 1 ? singular : plural
}

function referenceLabel(property: any) {
    return String(property.source_reference || property.source_slug || property.id || '').slice(0, 8).toUpperCase()
}

function formatViewCount(value: number) {
    return `${value.toLocaleString('pt-BR')} ${value === 1 ? 'visualização' : 'visualizações'}`
}

function hasUsableCoordinate(value: unknown) {
    const coordinate = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
    return Number.isFinite(coordinate)
}

function hasMapCoordinates(property: any) {
    return hasUsableCoordinate(property.latitude) && hasUsableCoordinate(property.longitude)
}

function buildDetailItems(property: any, locationLabel: string, area: number) {
    return [
        property.property_type ? `Tipo: ${property.property_type}` : null,
        locationLabel ? `Localização: ${locationLabel}` : null,
        area > 0 ? `Área privativa: ${area.toLocaleString('pt-BR')} m²` : null,
        property.area_total_m2 ? `Área total: ${Number(property.area_total_m2).toLocaleString('pt-BR')} m²` : null,
        property.bedrooms ? `${property.bedrooms} dormitórios` : null,
        property.suites ? `${property.suites} suítes` : null,
        property.bathrooms ? `${property.bathrooms} banheiros` : null,
        property.parking_spaces ? `${property.parking_spaces} vagas de garagem` : null,
        property.condo_fee ? `Condomínio: ${formatMoney(Number(property.condo_fee))}` : null,
        property.iptu ? `IPTU: ${formatMoney(Number(property.iptu))}` : null,
        property.exclusive ? 'Exclusivo Guilherme Pilger' : null,
        property.source_status ? `Condição: ${property.source_status}` : null,
    ].filter(Boolean) as string[]
}

function buildOpeningBullets(property: any, highlights: ReturnType<typeof buildOpportunityHighlights>) {
    const amenities = Array.isArray(property.amenities) ? property.amenities : []
    return [
        highlights[0]?.text,
        highlights[1]?.text,
        property.video_url ? 'Vídeo cadastrado para uma leitura mais completa antes da visita.' : null,
        amenities[0],
        amenities[1],
    ].filter(Boolean).slice(0, 5) as string[]
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createServerSupabase()
    const { id } = await params

    const { data: property } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

    if (!property) return notFound()

    const adminSupabase = createAdminClient()
    const responsibleBroker = await getResponsibleBrokerForProperty(adminSupabase, property.id)
    const { count: propertyViewCountRaw, error: propertyViewCountError } = await adminSupabase
        .from('funnel_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'property_details_landing_viewed')
        .contains('metadata', { property_id: property.id })

    if (propertyViewCountError) {
        console.warn('[Property Detail] view count unavailable:', propertyViewCountError.message)
    }

    const propertyViewCount = propertyViewCountRaw || 0
    const contactPhone = responsibleBroker.phone || GLOBAL_PROPERTY_WHATSAPP_PHONE
    const brokerCardName = responsibleBroker.is_connected
        ? responsibleBroker.name
        : responsibleBroker.legacy_name || 'Comercial Guilherme Pilger'
    const brokerCardImage = responsibleBroker.is_connected && responsibleBroker.photo_url
        ? responsibleBroker.photo_url
        : BROKER_IMAGE
    const gallery = getGallery(property)
    const amenities: string[] = property.amenities || []
    const displayTitle = replaceItajaiWithPraiaBrava(property.title)
    const displayCity = displayLocationName(property.city)
    const displayNeighborhood = replaceItajaiWithPraiaBrava(property.neighborhood)
    const mapLocation = [property.neighborhood, property.city, property.state].filter(Boolean).join(', ')
    const opportunityHighlights = buildOpportunityHighlights(property)
    const brokerInsight = buildBrokerInsight(property)
    const primaryImage = gallery[0] || DEFAULT_OG_IMAGE
    const area = Number(property.area_private_m2 || property.area_m2 || 0)
    const suiteCount = Number(property.suites || property.bedrooms || 0)
    const parkingCount = Number(property.parking_spaces || 0)
    const bathroomsCount = Number(property.bathrooms || 0)
    const bedroomCount = Number(property.bedrooms || 0)
    const narrativeParagraphs = property.description ? formatDescription(property.description) : []
    const locationLabel = [displayNeighborhood, displayCity, property.state].filter(Boolean).join(' - ')
    const youtubeId = extractYouTubeId(property.video_url)
    const detailItems = buildDetailItems(property, locationLabel, area)
    const featureItems = amenities.slice(0, 24)
    const projectItems = amenities.slice(24, 48)
    const openingBullets = buildOpeningBullets(property, opportunityHighlights)
    const propertyPath = buildPropertySeoPath(property)
    const propertyUrl = absoluteUrl(propertyPath)
    const propertyTrackingMetadata = {
        property_id: property.id,
        property_url: propertyUrl,
        title: displayTitle,
        price: property.price || null,
        city: displayCity || null,
        neighborhood: displayNeighborhood || null,
        property_type: property.property_type || null,
        responsible_broker: responsibleBroker.name,
        responsible_broker_connected: responsibleBroker.is_connected,
        source: 'property_details_classic_premium',
    }
    const mapProperties = hasMapCoordinates(property)
        ? [{
            id: property.id,
            title: displayTitle,
            price: property.price || null,
            latitude: property.latitude,
            longitude: property.longitude,
            featured_image: property.featured_image || primaryImage,
            bedrooms: property.bedrooms || null,
            bathrooms: property.bathrooms || null,
            suites: property.suites || null,
            parking_spaces: property.parking_spaces || null,
            area_m2: area || property.area_m2 || null,
            property_type: property.property_type || null,
            neighborhood: displayNeighborhood || property.neighborhood || null,
            description: property.description || null,
            source_status: property.source_status || null,
            exclusive: property.exclusive || null,
        }]
        : []

    const { data: relatedProps } = await supabase
        .from('properties')
        .select('id, title, seo_title, city, state, neighborhood, price, bedrooms, suites, parking_spaces, area_m2, area_private_m2, featured_image, images, property_type, exclusive')
        .eq('status', 'active')
        .neq('id', id)
        .limit(4)

    const related = relatedProps || []
    const propertyJsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: propertyPath,
            name: displayTitle,
            description: shortText(property.seo_description || property.description, `${property.property_type || 'Imóvel'} de alto padrão em ${displayCity}.`),
            type: 'WebPage',
            image: primaryImage,
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Busca', url: '/busca' },
            { name: displayTitle, url: propertyPath },
        ]),
        {
            '@context': 'https://schema.org',
            '@type': 'RealEstateListing',
            '@id': `${propertyUrl}#listing`,
            name: displayTitle,
            url: propertyUrl,
            image: gallery,
            description: shortText(property.seo_description || property.description, `${property.property_type || 'Imóvel'} de alto padrão em ${displayCity}.`),
            mainEntityOfPage: {
                '@id': `${propertyUrl}#webpage`,
            },
            dateModified: property.updated_at || property.created_at,
            address: {
                '@type': 'PostalAddress',
                addressLocality: displayCity,
                addressRegion: property.state || 'SC',
                addressCountry: 'BR',
                streetAddress: [displayNeighborhood, property.street].filter(Boolean).join(', ') || undefined,
            },
            mainEntity: {
                '@type': 'Apartment',
                '@id': `${propertyUrl}#property`,
                name: displayTitle,
                image: gallery,
                accommodationCategory: property.property_type,
                numberOfBedrooms: property.bedrooms || property.suites || undefined,
                numberOfBathroomsTotal: property.bathrooms || undefined,
                numberOfParkingSpaces: property.parking_spaces || undefined,
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: displayCity,
                    addressRegion: property.state || 'SC',
                    addressCountry: 'BR',
                    streetAddress: [displayNeighborhood, property.street].filter(Boolean).join(', ') || undefined,
                },
                geo: property.latitude && property.longitude ? {
                    '@type': 'GeoCoordinates',
                    latitude: property.latitude,
                    longitude: property.longitude,
                } : undefined,
                amenityFeature: amenities.slice(0, 20).map((name) => ({
                    '@type': 'LocationFeatureSpecification',
                    name,
                    value: true,
                })),
            },
            floorSize: area ? {
                '@type': 'QuantitativeValue',
                value: area,
                unitCode: 'MTK',
            } : undefined,
            numberOfRooms: property.bedrooms || property.suites || undefined,
            offers: {
                '@type': 'Offer',
                price: property.price || undefined,
                priceCurrency: 'BRL',
                availability: 'https://schema.org/InStock',
                url: propertyUrl,
                seller: {
                    '@id': `${absoluteUrl('/')}#organization`,
                },
            },
        },
    ]

    return (
        <>
            <PropertyLandingStyles />
            <JsonLd data={propertyJsonLd} />
            <PropertyLandingUrlTracker propertyId={property.id} />
            <PropertyLandingTracker
                propertyId={property.id}
                title={displayTitle}
                price={property.price}
                city={displayCity}
                neighborhood={displayNeighborhood}
                propertyType={property.property_type}
            />
            <GlobalHeader />

            <main className="plp-page" data-property-landing-root="true">
            <div className="plp-shell">
                <section className="plp-title-band">
                    <div className="plp-breadcrumbs">
                        <Link href="/">Início</Link>
                        <span>/</span>
                        <Link href="/busca">Imóveis à venda</Link>
                        <span>/</span>
                        <span>{displayCity || 'Litoral catarinense'}</span>
                        <span>/</span>
                        <strong>Ref. {referenceLabel(property)}</strong>
                    </div>

                    <div className="plp-title-row">
                        <div>
                            <span className="plp-kicker">{property.exclusive ? 'Exclusivo Guilherme Pilger' : property.property_type || 'Imóvel à venda'}</span>
                            <h1>{displayTitle}</h1>
                            <div className="plp-rating-row" aria-label="Avaliação editorial">
                                <span><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /></span>
                                <strong>4,8</strong>
                                <small className="plp-view-count"><Eye size={14} /> {formatViewCount(propertyViewCount)}</small>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="visao" className="plp-detail-layout">
                    <div className="plp-gallery-column">
                        <PropertyPhotoShowcase images={gallery.length ? gallery : [primaryImage]} title={displayTitle} metadata={propertyTrackingMetadata} />
                        {false && <div className={`plp-gallery-composer ${gallery.length <= 1 ? 'single' : ''}`}>
                            <a href="#galeria" className="plp-main-photo" aria-label="Abrir galeria completa">
                                <img src={primaryImage} alt={displayTitle} />
                                <span className="plp-photo-badge"><Camera size={16} /> {gallery.length || 1} fotos</span>
                            </a>
                            <div className="plp-thumb-rail" aria-label="Prévia de fotos">
                                {gallery.slice(1, 6).map((image, index) => (
                                    <a href="#galeria" key={`${image}-${index}`} className="plp-thumb-item">
                                        <img src={image} alt={`${displayTitle} - prévia ${index + 2}`} loading="lazy" />
                                    </a>
                                ))}
                            </div>
                        </div>}

                    </div>

                    <div className="plp-main-column plp-content-column">
                        <section id="experiencia" className="plp-section plp-copy-section">
                            <span className="plp-kicker">Visão geral</span>
                            <h2>{displayTitle}</h2>
                            <p className="plp-intro-line">Viva no topo do luxo e sofisticação com uma leitura clara de localização, produto e momento de mercado.</p>
                            {openingBullets.length > 0 && (
                                <ul className="plp-highlight-list">
                                    {openingBullets.map((item, index) => (
                                        <li key={`${item}-${index}`}><CheckCircle2 size={17} /> {item}</li>
                                    ))}
                                </ul>
                            )}
                            <div className="plp-narrative">
                                {(narrativeParagraphs.length ? narrativeParagraphs : [brokerInsight.text]).map((paragraph, index) => (
                                    <p key={index}>{paragraph}</p>
                                ))}
                            </div>
                        </section>

                        <section id="ficha" className="plp-section">
                            <div className="plp-section-head">
                                <span className="plp-kicker">Ficha rápida</span>
                                <h2>Dados principais do imóvel.</h2>
                            </div>
                            <div className="plp-spec-grid">
                                {area > 0 && <SpecCard icon={<Ruler size={21} />} label="Área" value={`${area.toLocaleString('pt-BR')} m²`} />}
                                {suiteCount > 0 && <SpecCard icon={<BedDouble size={21} />} label="Configuração" value={`${suiteCount} ${statLabel(suiteCount, 'suíte', 'suítes')}`} />}
                                {bathroomsCount > 0 && <SpecCard icon={<Bath size={21} />} label="Banheiros" value={String(bathroomsCount)} />}
                                {parkingCount > 0 && <SpecCard icon={<Car size={21} />} label="Garagem" value={`${parkingCount} ${statLabel(parkingCount, 'vaga', 'vagas')}`} />}
                                <SpecCard icon={<MapPin size={21} />} label="Localização" value={locationLabel || displayCity || 'Litoral SC'} />
                            </div>
                        </section>

                        <section className="plp-section plp-classic-lists">
                            <InfoList title="Detalhes do imóvel" items={detailItems} />
                            {featureItems.length > 0 && <InfoList title="Características do imóvel" items={featureItems} />}
                            {projectItems.length > 0 && <InfoList title="Características do empreendimento" items={projectItems} />}
                        </section>
                    </div>

                    <aside className="plp-sidebar" aria-label="Atendimento e resumo comercial">
                        <div className="plp-side-card plp-price-card">
                            <div className="plp-side-location">
                                <MapPin size={18} />
                                <div>
                                    <h2>{displayNeighborhood || displayCity || 'Litoral catarinense'}</h2>
                                    <p>{[displayCity, property.state].filter(Boolean).join(' - ') || 'Endereço sob curadoria'}</p>
                                </div>
                            </div>

                            <div className="plp-side-facts">
                                <SideFact icon={<Tag size={17} />} value={formatMoney(property.price)} label="valor anunciado" variant="price" />
                                {bedroomCount > 0 && <SideFact icon={<BedDouble size={17} />} value={String(bedroomCount)} label={statLabel(bedroomCount, 'dormitório', 'dormitórios')} />}
                                {suiteCount > 0 && <SideFact icon={<Home size={17} />} value={String(suiteCount)} label={statLabel(suiteCount, 'suíte', 'suítes')} />}
                                {parkingCount > 0 && <SideFact icon={<Car size={17} />} value={String(parkingCount)} label={statLabel(parkingCount, 'vaga', 'vagas')} />}
                                {area > 0 && <SideFact icon={<Ruler size={17} />} value={`${area.toLocaleString('pt-BR')} m²`} label="área privativa" />}
                            </div>

                            {(property.condo_fee || property.iptu) && (
                                <div className="plp-price-extras">
                                    {property.condo_fee && <small>Condomínio: {formatMoney(Number(property.condo_fee))}</small>}
                                    {property.iptu && <small>IPTU: {formatMoney(Number(property.iptu))}</small>}
                                </div>
                            )}

                            <p className="plp-payment-note">Preço, disponibilidade e condições podem ser alterados sem aviso prévio.</p>

                            <div className="plp-action-list">
                                <PropertyLandingShareButton propertyId={property.id} title={displayTitle} />
                            </div>
                        </div>

                        <div className="plp-side-card plp-lead-card">
                            <h3><MessageCircle size={18} /> Mais informações sobre este imóvel</h3>
                            <p>Envie seus dados para receber disponibilidade, condições e atendimento direto pelo WhatsApp.</p>
                            <div className="plp-form-preview" aria-hidden="true">
                                <span className="plp-form-message">Ola, tenho interesse no imovel {propertyUrl}</span>
                                <span>Nome completo *</span>
                                <span>Telefone *</span>
                                <span>Email *</span>
                            </div>
                            <WhatsAppCaptureLink
                                phone={contactPhone}
                                message={`Ola, tenho interesse no imovel ${propertyUrl}`}
                                slug="imovel"
                                template="property-classic-form"
                                metadata={propertyTrackingMetadata}
                                className="plp-dark-button"
                            >
                                Enviar interesse
                            </WhatsAppCaptureLink>
                        </div>

                        <div className="plp-side-card plp-broker-card">
                            <img src={brokerCardImage} alt={brokerCardName} />
                            <div>
                                <h3>{brokerCardName}</h3>
                            </div>
                        </div>
                    </aside>
                </section>

                {youtubeId && (
                    <section className="plp-video-card">
                        <div className="plp-section-head compact">
                            <span className="plp-kicker">Vídeo do imóvel</span>
                            <h2>Assista antes de avançar para a visita.</h2>
                        </div>
                        <iframe
                            src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
                            title={`${displayTitle} - vídeo`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </section>
                )}

                <section id="localizacao" className="plp-location-band">
                    <div className="plp-location-head">
                        <span>Imediações</span>
                        <strong>{displayNeighborhood || displayCity || 'Localização estratégica'}</strong>
                    </div>
                    <div className="plp-map-frame">
                        {mapProperties.length > 0 ? (
                            <MapSearch properties={mapProperties} refitKey={`property-detail-${property.id}`} />
                        ) : (
                            <div className="plp-map-empty">
                                <MapPin size={22} />
                                <strong>{locationLabel || mapLocation || 'Localizacao sob curadoria'}</strong>
                                <span>Endereco exato apresentado pelo agente durante o atendimento.</span>
                            </div>
                        )}
                    </div>
                </section>

                {related.length > 0 && (
                    <section className="plp-related-band">
                        <div className="plp-related-head">
                            <div>
                                <span>Imóveis semelhantes</span>
                                <h2>Compare com outras oportunidades.</h2>
                            </div>
                            <Link href="/busca">Ver busca completa <ArrowRight size={16} /></Link>
                        </div>
                        <div className="plp-related-grid">
                            {related.map((item: any) => {
                                const image = item.featured_image || item.images?.[0] || DEFAULT_OG_IMAGE
                                const itemArea = Number(item.area_private_m2 || item.area_m2 || 0)
                                const itemSuites = Number(item.suites || item.bedrooms || 0)
                                return (
                                    <Link key={item.id} href={buildPropertySeoPath(item)} className="plp-related-card">
                                        <img src={image} alt={replaceItajaiWithPraiaBrava(item.title)} loading="lazy" />
                                        {item.exclusive && <span className="plp-card-ribbon">Exclusivo</span>}
                                        <div>
                                            <small><MapPin size={13} /> {[replaceItajaiWithPraiaBrava(item.neighborhood), displayLocationName(item.city)].filter(Boolean).join(' - ')}</small>
                                            <h3>{replaceItajaiWithPraiaBrava(item.title)}</h3>
                                            <div className="plp-related-meta">
                                                <span>{itemArea ? `${itemArea.toLocaleString('pt-BR')} m²` : 'Área sob consulta'}</span>
                                                <span>{itemSuites ? `${itemSuites} suítes` : item.property_type || 'Imóvel'}</span>
                                                <strong>{formatMoney(item.price)}</strong>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </section>
                )}

            </div>

            <Footer />

            <div className="plp-mobile-sticky-cta">
                <WhatsAppCaptureLink
                    phone={contactPhone}
                    message={`Ola, tenho interesse no imovel ${propertyUrl}`}
                    slug="imovel"
                    template="property-classic-sticky"
                    metadata={propertyTrackingMetadata}
                    className="plp-mobile-cta-button"
                >
                    <span className="plp-mobile-cta-prompt" aria-hidden="true">
                        Receba as <strong>condições de pagamento</strong> deste imóvel em seu WhatsApp.
                        <CheckCircle2 size={16} />
                    </span>
                    <span className="plp-mobile-cta-icon">
                        <WhatsAppIcon />
                    </span>
                    <span className="plp-mobile-cta-label">Receba as condições de pagamento deste imóvel em seu WhatsApp apos o cadastro</span>
                </WhatsAppCaptureLink>
            </div>

            <MobileNav />
        </main>
        </>
    )
}

function WhatsAppIcon({ size = 28 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <path
                fill="currentColor"
                d="M16 3.2c-6.86 0-12.43 5.48-12.43 12.23 0 2.3.66 4.55 1.91 6.49l-1.31 4.82 4.98-1.28A12.59 12.59 0 0 0 16 27.66c6.86 0 12.43-5.49 12.43-12.23S22.86 3.2 16 3.2Zm0 22.39c-2.1 0-4.05-.62-5.68-1.69l-.4-.26-2.95.76.78-2.85-.27-.43a10.03 10.03 0 0 1-1.84-5.69c0-5.6 4.64-10.16 10.36-10.16s10.36 4.56 10.36 10.16S21.72 25.59 16 25.59Zm5.79-7.6c-.31-.15-1.85-.9-2.14-1-.29-.11-.5-.15-.71.15-.21.31-.81 1-.99 1.2-.18.21-.36.23-.67.08-.31-.15-1.31-.47-2.5-1.51-.92-.81-1.55-1.81-1.73-2.12-.18-.31-.02-.47.14-.62.14-.14.31-.36.47-.54.16-.18.21-.31.31-.52.1-.21.05-.39-.03-.54-.08-.15-.71-1.68-.97-2.3-.26-.6-.51-.52-.71-.53h-.6c-.21 0-.55.08-.84.39-.29.31-1.1 1.06-1.1 2.59s1.13 3 1.28 3.21c.16.21 2.23 3.35 5.4 4.69.75.32 1.34.51 1.8.65.76.24 1.45.2 1.99.12.61-.09 1.85-.75 2.11-1.47.26-.72.26-1.34.18-1.47-.08-.13-.29-.21-.6-.36Z"
            />
        </svg>
    )
}

function SpecCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="plp-spec-card">
            <span>{icon}</span>
            <div>
                <small>{label}</small>
                <strong>{value}</strong>
            </div>
        </div>
    )
}

function SideFact({ icon, value, label, variant }: { icon: ReactNode; value: string; label: string; variant?: 'price' }) {
    return (
        <div className={variant === 'price' ? 'plp-side-fact-price' : undefined}>
            {icon}
            <strong>{value}</strong>
            <span>{label}</span>
        </div>
    )
}

function InfoList({ title, items }: { title: string; items: string[] }) {
    if (!items.length) return null

    return (
        <article className="plp-info-list">
            <h3>{title}</h3>
            <div>
                {chunkList(items, 2).map((group, groupIndex) => (
                    <ul key={groupIndex}>
                        {group.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                        ))}
                    </ul>
                ))}
            </div>
        </article>
    )
}

function buildOpportunityHighlights(property: any) {
    const price = Number(property.price || 0)
    const type = property.property_type || 'Imóvel premium'
    const location = [replaceItajaiWithPraiaBrava(property.neighborhood), displayLocationName(property.city)].filter(Boolean).join(' - ') || 'localização estratégica'
    const text = `${property.title || ''} ${property.description || ''} ${property.property_type || ''} ${property.source_status || ''}`.toLowerCase()
    const isLaunch = text.includes('lançamento') || text.includes('lancamento') || text.includes('na planta') || text.includes('construção') || text.includes('construcao')
    const hasSea = text.includes('frente') && text.includes('mar')

    return [
        {
            index: '01',
            title: 'Endereço com desejo',
            text: `${location} concentra procura qualificada e reduz comparação por preço puro.`,
        },
        {
            index: '02',
            title: price >= 5000000 ? 'Ativo de alto padrão' : 'Entrada estratégica',
            text: price >= 5000000
                ? 'Ticket, metragem e posicionamento reforçam o perfil de ativo para comprador exigente.'
                : 'Uma oportunidade para entrar em um mercado de liquidez com curadoria profissional.',
        },
        {
            index: '03',
            title: hasSea ? 'Vista como diferencial' : 'Produto escasso',
            text: hasSea
                ? 'Vista e proximidade do mar elevam percepção de valor e experiência de uso.'
                : `${type} com leitura de escassez, bom para quem busca algo difícil de substituir.`,
        },
        {
            index: '04',
            title: isLaunch ? 'Momento de mercado' : 'Pronto para decisão',
            text: isLaunch
                ? 'Lançamentos bem posicionados permitem leitura antecipada de valorização e escolha de unidade.'
                : 'Ideal para avançar rápido em visita, negociação e validação documental.',
        },
    ]
}

function buildBrokerInsight(property: any) {
    const city = displayLocationName(property.city) || 'região'
    const type = property.property_type || 'imóvel'
    const price = Number(property.price || 0)

    if (price >= 10000000) {
        return {
            title: 'Este é um imóvel para comprar com estratégia, não por impulso.',
            text: `Quando o ativo passa desse patamar em ${city}, a decisão precisa considerar liquidez, escassez e negociação. Meu papel é mostrar onde existe valor real e onde existe apenas aparência.`,
        }
    }

    return {
        title: `O ponto forte deste ${type} está na combinação entre localização e timing.`,
        text: `Antes de visitar, vale entender o contexto de ${city}, comparar opções parecidas e enxergar se este imóvel faz sentido para moradia, investimento ou proteção patrimonial.`,
    }
}
