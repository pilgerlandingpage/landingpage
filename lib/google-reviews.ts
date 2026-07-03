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

export type HomepageGoogleReviews = {
  placeName: string
  rating: number
  userRatingCount: number
  googleMapsUri?: string
  reviewUrl?: string
  reviews: HomepageGoogleReview[]
}

const GOOGLE_PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places'
const GOOGLE_REVIEWS_REVALIDATE_SECONDS = 60 * 60 * 6
const GOOGLE_REVIEWS_TIMEOUT_MS = 4500
const REVIEW_TEXT_LIMIT = 360
const DEFAULT_PILGER_GOOGLE_PLACE_ID = 'ChIJ7Y5_0DW32JQRatagLzFhcJc'

const GOOGLE_PLACE_DETAILS_FIELDS = [
  'displayName',
  'googleMapsUri',
  'googleMapsLinks.placeUri',
  'googleMapsLinks.reviewsUri',
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
  displayName?: GoogleLocalizedText
  googleMapsUri?: string
  googleMapsLinks?: {
    placeUri?: string
    reviewsUri?: string
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

export async function getHomepageGoogleReviews(configMap: Record<string, string>): Promise<HomepageGoogleReviews | null> {
  const enabled = cleanString(configMap.homepage_google_reviews_enabled || 'true') !== 'false'
  const placeId = normalizePlaceId(
    configMap.homepage_google_reviews_place_id
    || process.env.GOOGLE_MAPS_PLACE_ID
    || process.env.NEXT_PUBLIC_GOOGLE_MAPS_PLACE_ID
    || DEFAULT_PILGER_GOOGLE_PLACE_ID
  )
  const apiKey = resolveApiKey()

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
      placeName: readLocalizedText(payload.displayName) || 'Guilherme Pilger',
      rating: numberOrZero(payload.rating),
      userRatingCount: Math.trunc(numberOrZero(payload.userRatingCount)),
      googleMapsUri,
      reviewUrl: resolveReviewUrl(configMap, placeId, payload.googleMapsLinks?.writeAReviewUri, googleMapsUri),
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
