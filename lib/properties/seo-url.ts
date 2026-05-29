type SeoProperty = {
  id?: string | null
  title?: string | null
  seo_title?: string | null
  city?: string | null
  neighborhood?: string | null
  property_type?: string | null
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

export function slugifyPropertySegment(value?: string | null, fallback = 'imovel') {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

  return slug || fallback
}

export function buildPropertySeoPath(property: SeoProperty) {
  const id = String(property.id || '').trim()
  if (!id) return '/imoveis'

  const city = slugifyPropertySegment(property.city, 'litoral-catarinense')
  const neighborhood = slugifyPropertySegment(property.neighborhood, 'imoveis-de-luxo')
  const title = slugifyPropertySegment(
    property.seo_title || property.title || property.property_type,
    'imovel-de-luxo'
  )

  return `/imoveis/${city}/${neighborhood}/${title}-${id}`
}

export function extractPropertyIdFromSeoSlug(slug?: string | null) {
  const decoded = decodeURIComponent(String(slug || ''))
  const uuid = decoded.match(UUID_PATTERN)?.[0]
  return uuid || null
}
