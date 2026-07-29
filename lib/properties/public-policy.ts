export const PUBLIC_PRICE_CONSULTATION_THRESHOLD = 4000000
export const PUBLIC_PRICE_ON_REQUEST_LABEL = 'Sob consulta'

type PropertyLike = {
  price?: unknown
  rent?: unknown
  property_type?: string | null
  title?: string | null
  description?: string | null
}

function normalizePolicyText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function parseCurrencyToken(value: string) {
  const token = value.trim()
  if (!token) return 0

  const amount = token.includes(',') && token.includes('.')
    ? Number(token.replace(/\./g, '').replace(',', '.'))
    : token.includes(',')
      ? Number(token.replace(',', '.'))
      : Number(token.replace(/\./g, ''))

  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0
}

export function publicPriceNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0
  if (typeof value !== 'string' || !value.trim()) return 0

  const normalized = normalizePolicyText(value)
  if (/\b(sob consulta|consulte|consultar)\b/.test(normalized)) return 0

  const millionMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:mi|milhao|milhoes)\b/)
  if (millionMatch?.[1]) {
    const amount = Number(millionMatch[1].replace(',', '.'))
    return Number.isFinite(amount) ? Math.round(amount * 1000000) : 0
  }

  const currencyMatch = normalized.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/)
  return currencyMatch?.[0] ? parseCurrencyToken(currencyMatch[0]) : 0
}

export function isPublicPriceVisible(value: unknown) {
  return publicPriceNumber(value) >= PUBLIC_PRICE_CONSULTATION_THRESHOLD
}

export function formatPublicPropertyPrice(value: unknown, fallback = PUBLIC_PRICE_ON_REQUEST_LABEL) {
  const amount = publicPriceNumber(value)
  if (amount < PUBLIC_PRICE_CONSULTATION_THRESHOLD) return fallback

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCompactPublicPropertyPrice(value: unknown, fallback = PUBLIC_PRICE_ON_REQUEST_LABEL) {
  const amount = publicPriceNumber(value)
  if (amount < PUBLIC_PRICE_CONSULTATION_THRESHOLD) return fallback

  if (amount >= 1000000) {
    const millions = amount / 1000000
    const label = millions >= 10
      ? Math.round(millions).toLocaleString('pt-BR')
      : millions.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    return `R$ ${label} mi`
  }

  if (amount >= 1000) return `R$ ${Math.round(amount / 1000).toLocaleString('pt-BR')} mil`
  return `R$ ${Math.round(amount).toLocaleString('pt-BR')}`
}

export function maskPublicPriceText(value: unknown, fallback = PUBLIC_PRICE_ON_REQUEST_LABEL) {
  if (typeof value === 'number') return formatPublicPropertyPrice(value, fallback)

  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return fallback

  const amount = publicPriceNumber(text)
  if (amount > 0 && amount < PUBLIC_PRICE_CONSULTATION_THRESHOLD) return fallback
  return text
}

export function formatPublicPropertyPriceRange(values: unknown[], fallback = PUBLIC_PRICE_ON_REQUEST_LABEL) {
  const publicPrices = values
    .map(publicPriceNumber)
    .filter(value => value >= PUBLIC_PRICE_CONSULTATION_THRESHOLD)
    .sort((a, b) => a - b)

  if (!publicPrices.length) return fallback

  const min = publicPrices[0]
  const max = publicPrices[publicPrices.length - 1]
  if (min === max) return formatPublicPropertyPrice(min, fallback)
  return `${formatPublicPropertyPrice(min, fallback)} a ${formatPublicPropertyPrice(max, fallback)}`
}

export function isLandOrLogisticsProperty(property: PropertyLike) {
  const text = normalizePolicyText([
    property.property_type,
    property.title,
  ].filter(Boolean).join(' '))

  return /terreno|lote|loteamento|galp|depo|dep.sito/.test(text)
}

export function isHighStandardHomeProperty(property: PropertyLike) {
  const amount = publicPriceNumber(property.price ?? property.rent)
  const text = normalizePolicyText([
    property.property_type,
    property.title,
  ].filter(Boolean).join(' '))
  const isCommercialOrStandaloneBuilding = /comercial|sala|loja|predio|pr.dio/.test(text)

  return amount >= PUBLIC_PRICE_CONSULTATION_THRESHOLD && !isLandOrLogisticsProperty(property) && !isCommercialOrStandaloneBuilding
}
