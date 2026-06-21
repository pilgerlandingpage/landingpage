import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_URL } from '@/lib/seo/json-ld'
import { cleanPropertyText, compactPropertyText } from '@/lib/properties/text'

type PropertyForStructuredData = Record<string, any>

function normalizeText(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function propertyEntityType(property: PropertyForStructuredData) {
  const text = normalizeText(`${property.property_type || ''} ${property.title || ''}`)

  if (text.includes('casa') || text.includes('mansao') || text.includes('sobrado')) return 'House'
  if (text.includes('terreno') || text.includes('lote')) return 'Landform'
  if (text.includes('sala') || text.includes('comercial') || text.includes('galpao')) return 'Place'
  return 'Apartment'
}

function galleryFrom(property: PropertyForStructuredData, fallbackImage?: string) {
  return Array.from(new Set([
    property.featured_image,
    ...(Array.isArray(property.images) ? property.images : []),
    fallbackImage,
  ].filter(Boolean) as string[]))
}

function imageObjects(urls: string[], title: string) {
  return urls.slice(0, 20).map((url, index) => ({
    '@type': 'ImageObject',
    url: absoluteUrl(url),
    name: `${title} - foto ${index + 1}`,
    position: index + 1,
  }))
}

export function realEstateListingJsonLd(params: {
  property: PropertyForStructuredData
  path: string
  title: string
  description?: string | null
  city?: string | null
  neighborhood?: string | null
  fallbackImage?: string
}) {
  const { property, path, title } = params
  const url = absoluteUrl(path)
  const gallery = galleryFrom(property, params.fallbackImage || DEFAULT_OG_IMAGE)
  const images = imageObjects(gallery, title)
  const area = Number(property.area_private_m2 || property.area_m2 || 0)
  const bedrooms = Number(property.bedrooms || property.suites || 0)
  const bathrooms = Number(property.bathrooms || 0)
  const parkingSpaces = Number(property.parking_spaces || 0)
  const latitude = Number(property.latitude || 0)
  const longitude = Number(property.longitude || 0)
  const amenities = Array.isArray(property.amenities) ? property.amenities : []
  const description = compactPropertyText(
    params.description || property.seo_description || property.description,
    `${property.property_type || 'Imóvel'} de alto padrão em ${params.city || property.city || 'Santa Catarina'}.`,
    260
  )
  const address = {
    '@type': 'PostalAddress',
    streetAddress: [params.neighborhood || property.neighborhood, property.street].filter(Boolean).join(', ') || undefined,
    addressLocality: params.city || property.city,
    addressRegion: property.state || 'SC',
    addressCountry: 'BR',
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': `${url}#listing`,
    name: title,
    url,
    image: images.length ? images : [DEFAULT_OG_IMAGE],
    description,
    datePosted: property.created_at,
    dateModified: property.updated_at || property.created_at,
    inLanguage: 'pt-BR',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
    },
    mainEntity: {
      '@type': propertyEntityType(property),
      '@id': `${url}#property`,
      name: title,
      description: cleanPropertyText(description),
      image: images.length ? images : [DEFAULT_OG_IMAGE],
      accommodationCategory: property.property_type,
      numberOfBedrooms: bedrooms || undefined,
      numberOfBathroomsTotal: bathrooms || undefined,
      numberOfRooms: bedrooms || undefined,
      numberOfParkingSpaces: parkingSpaces || undefined,
      floorSize: area ? {
        '@type': 'QuantitativeValue',
        value: area,
        unitCode: 'MTK',
      } : undefined,
      address,
      geo: latitude && longitude ? {
        '@type': 'GeoCoordinates',
        latitude,
        longitude,
      } : undefined,
      amenityFeature: amenities.slice(0, 20).map((name: string) => ({
        '@type': 'LocationFeatureSpecification',
        name,
        value: true,
      })),
    },
    about: {
      '@id': `${url}#property`,
    },
    offers: {
      '@type': 'Offer',
      price: property.price || undefined,
      priceCurrency: 'BRL',
      availability: property.status === 'sold'
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      url,
      seller: {
        '@id': `${SITE_URL}/#organization`,
      },
    },
  }
}
