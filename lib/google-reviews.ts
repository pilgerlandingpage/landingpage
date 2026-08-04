import { getPublicAppUrl } from '@/lib/app-url'

export type HomepageGoogleReview = {
  id: string
  authorName: string
  authorUri?: string
  authorPhotoUri?: string
  rating: number
  text: string
  publishedLabel?: string
  publishedAt?: string
  reviewUri?: string
  flagContentUri?: string
}

export type HomepageGooglePlacePhoto = {
  id: string
  name: string
  imageUri: string
  googleMapsUri?: string
  authorName?: string
  widthPx?: number
  heightPx?: number
}

export type HomepageGoogleReviews = {
  placeName: string
  formattedAddress?: string
  shortFormattedAddress?: string
  latitude?: number
  longitude?: number
  rating: number
  userRatingCount: number
  googleMapsUri?: string
  reviewUrl?: string
  photos: HomepageGooglePlacePhoto[]
  reviews: HomepageGoogleReview[]
}

const GOOGLE_PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places'
export const GOOGLE_REVIEWS_REVALIDATE_SECONDS = 60 * 60 * 6
const GOOGLE_REVIEWS_TIMEOUT_MS = 4500
const REVIEW_TEXT_LIMIT = 360
const DEFAULT_PILGER_GOOGLE_PLACE_ID = 'ChIJ7Y5_0DW32JQRatagLzFhcJc'
const GOOGLE_REVIEWS_CACHE_PREFIX = '_cache_homepage_google_reviews_'
const GOOGLE_REVIEWS_CACHE_VERSION = 2

const GOOGLE_PLACE_DETAILS_FIELDS = [
  'googleMapsUri',
  'googleMapsLinks.placeUri',
  'googleMapsLinks.writeAReviewUri',
  'rating',
  'userRatingCount',
  'reviews.authorAttribution',
  'reviews.flagContentUri',
  'reviews.googleMapsUri',
  'reviews.name',
  'reviews.originalText',
  'reviews.publishTime',
  'reviews.rating',
  'reviews.relativePublishTimeDescription',
  'reviews.text',
].join(',')

type GoogleLocalizedText = {
  text?: string
  languageCode?: string
}

type GoogleReviewPayload = {
  name?: string
  rating?: number
  text?: GoogleLocalizedText
  originalText?: GoogleLocalizedText
  relativePublishTimeDescription?: string
  publishTime?: string
  googleMapsUri?: string
  flagContentUri?: string
  authorAttribution?: {
    displayName?: string
    uri?: string
    photoUri?: string
  }
}

type GooglePlacePayload = {
  googleMapsUri?: string
  googleMapsLinks?: {
    placeUri?: string
    writeAReviewUri?: string
  }
  rating?: number
  userRatingCount?: number
  reviews?: GoogleReviewPayload[]
  error?: {
    message?: string
    status?: string
  }
}

function cleanString(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizePlaceId(value: unknown) {
  return cleanString(value).replace(/^places\//i, '')
}

function readLocalizedText(value: unknown) {
  if (!value) return ''
  if (typeof value === 'string') return cleanString(value)
  if (typeof value === 'object' && 'text' in value) {
    return cleanString((value as GoogleLocalizedText).text)
  }
  return ''
}

function clampReviewText(value: string) {
  if (value.length <= REVIEW_TEXT_LIMIT) return value
  return `${value.slice(0, REVIEW_TEXT_LIMIT).trim()}...`
}

function numberOrZero(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function resolveApiKey() {
  return cleanString(
    process.env.GOOGLE_PLACES_API_KEY
    || process.env.GOOGLE_MAPS_API_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  )
}

function googleApiHeaders(): HeadersInit {
  const referer = cleanString(
    process.env.GOOGLE_PLACES_HTTP_REFERER
    || process.env.GOOGLE_API_HTTP_REFERER
    || getPublicAppUrl()
  )

  return referer ? { Referer: `${referer.replace(/\/+$/, '')}/` } : {}
}

function resolveReviewUrl(
  configMap: Record<string, string>,
  placeId: string,
  writeAReviewUri?: string,
  googleMapsUri?: string
) {
  const explicitUrl = cleanString(
    configMap.homepage_google_reviews_url
    || configMap.homepage_google_review_url
    || process.env.GOOGLE_BUSINESS_REVIEW_URL
    || process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL
  )

  if (explicitUrl) return explicitUrl
  if (writeAReviewUri) return writeAReviewUri
  if (placeId) return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
  return googleMapsUri || ''
}

function normalizeReview(review: GoogleReviewPayload, index: number): HomepageGoogleReview | null {
  const authorName = cleanString(review.authorAttribution?.displayName)
  const rating = numberOrZero(review.rating)
  const text = clampReviewText(readLocalizedText(review.text) || readLocalizedText(review.originalText))

  if (!authorName || !rating || !text) return null

  return {
    id: cleanString(review.name) || `${authorName}-${index}`,
    authorName,
    authorUri: cleanString(review.authorAttribution?.uri) || undefined,
    authorPhotoUri: cleanString(review.authorAttribution?.photoUri) || undefined,
    rating,
    text,
    publishedLabel: cleanString(review.relativePublishTimeDescription) || undefined,
    publishedAt: cleanString(review.publishTime) || undefined,
    reviewUri: cleanString(review.googleMapsUri) || cleanString(review.authorAttribution?.uri) || undefined,
    flagContentUri: cleanString(review.flagContentUri) || undefined,
  }
}

function getGoogleReviewsSettings(configMap: Record<string, string>) {
  return {
    enabled: cleanString(configMap.homepage_google_reviews_enabled || 'true') !== 'false',
    placeId: normalizePlaceId(
      configMap.homepage_google_reviews_place_id
      || process.env.GOOGLE_MAPS_PLACE_ID
      || process.env.NEXT_PUBLIC_GOOGLE_MAPS_PLACE_ID
      || DEFAULT_PILGER_GOOGLE_PLACE_ID
    ),
    apiKey: resolveApiKey(),
  }
}

function googleReviewsCacheKey(placeId: string) {
  return `${GOOGLE_REVIEWS_CACHE_PREFIX}${placeId.replace(/[^A-Za-z0-9_-]/g, '_')}`
}

type SupabaseConfigStore = {
  from: (table: string) => any
}

async function readCachedGoogleReviews(admin: SupabaseConfigStore | undefined, placeId: string) {
  if (!admin) return { hit: false as const }

  try {
    const { data } = await admin
      .from('app_config')
      .select('value, updated_at')
      .eq('key', googleReviewsCacheKey(placeId))
      .maybeSingle()

    if (!data?.value || !data?.updated_at) return { hit: false as const }

    const ageMs = Date.now() - new Date(data.updated_at).getTime()
    if (ageMs > GOOGLE_REVIEWS_REVALIDATE_SECONDS * 1000) return { hit: false as const }

    const parsed = JSON.parse(String(data.value))
    if (parsed?.version !== GOOGLE_REVIEWS_CACHE_VERSION || parsed?.placeId !== placeId) {
      return { hit: false as const }
    }

    return { hit: true as const, data: (parsed.data || null) as HomepageGoogleReviews | null }
  } catch {
    return { hit: false as const }
  }
}

async function writeCachedGoogleReviews(admin: SupabaseConfigStore | undefined, placeId: string, data: HomepageGoogleReviews | null) {
  if (!admin) return

  try {
    await admin.from('app_config').upsert({
      key: googleReviewsCacheKey(placeId),
      value: JSON.stringify({
        version: GOOGLE_REVIEWS_CACHE_VERSION,
        placeId,
        cachedAt: new Date().toISOString(),
        data,
      }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
  } catch {
    // Reviews are decorative; cache write failures should not break public pages.
  }
}

export async function getCachedHomepageGoogleReviews(
  configMap: Record<string, string>,
  admin?: SupabaseConfigStore
): Promise<HomepageGoogleReviews | null> {
  const { enabled, placeId, apiKey } = getGoogleReviewsSettings(configMap)
  if (!enabled || !placeId || !apiKey) return null

  const cached = await readCachedGoogleReviews(admin, placeId)
  if (cached.hit) return cached.data

  const reviews = await getHomepageGoogleReviews(configMap)
  await writeCachedGoogleReviews(admin, placeId, reviews)
  return reviews
}

export async function getHomepageGoogleReviews(configMap: Record<string, string>): Promise<HomepageGoogleReviews | null> {
  const { enabled, placeId, apiKey } = getGoogleReviewsSettings(configMap)

  if (!enabled || !placeId || !apiKey) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GOOGLE_REVIEWS_TIMEOUT_MS)

  try {
    const url = new URL(`${GOOGLE_PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}`)
    url.searchParams.set('fields', GOOGLE_PLACE_DETAILS_FIELDS)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('languageCode', 'pt-BR')

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: googleApiHeaders(),
      next: { revalidate: GOOGLE_REVIEWS_REVALIDATE_SECONDS },
    })

    if (!response.ok) {
      console.warn('[Home][Google Reviews] Place Details unavailable:', response.status, await response.text())
      return null
    }

    const payload = await response.json() as GooglePlacePayload
    if (payload.error?.message) {
      console.warn('[Home][Google Reviews] Place Details error:', payload.error.message)
      return null
    }

    const reviews = (payload.reviews || [])
      .map(normalizeReview)
      .filter((review): review is HomepageGoogleReview => Boolean(review))
      .slice(0, 5)

    if (!reviews.length) return null

    const googleMapsUri = cleanString(
      configMap.homepage_google_maps_url
      || payload.googleMapsLinks?.placeUri
      || payload.googleMapsUri
    ) || undefined

    return {
      placeName: 'Guilherme Pilger',
      rating: numberOrZero(payload.rating),
      userRatingCount: Math.trunc(numberOrZero(payload.userRatingCount)),
      googleMapsUri,
      reviewUrl: resolveReviewUrl(configMap, placeId, payload.googleMapsLinks?.writeAReviewUri, googleMapsUri),
      photos: [],
      reviews,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('[Home][Google Reviews] Failed to load reviews:', message)
    return null
  } finally {
    clearTimeout(timeout)
  }
}
