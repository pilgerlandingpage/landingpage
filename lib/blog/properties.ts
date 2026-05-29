type SupabaseLike = {
  from: (table: string) => any
}

type ScoredProperty = {
  property: any
  score: number
  viewScore: number
}

export type BlogPropertyRecommendation = {
  id: string
  title: string
  city: string | null
  state: string | null
  neighborhood: string | null
  price: number | null
  property_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  suites: number | null
  parking_spaces: number | null
  area_m2: number | null
  featured_image: string | null
  images: string[]
  exclusive: boolean | null
  status: string | null
  landing_page_slug: string | null
  view_score: number
}

const PROPERTY_EVENT_TYPES = [
  'page_view',
  'property_feed_slide_viewed',
  'property_details_clicked',
  'property_feed_whatsapp_clicked',
  'property_feed_message_clicked',
  'property_shared',
  'whatsapp_property_click',
  'whatsapp_link_click',
  'form_submitted',
  'chat_opened',
]

function safeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function eventWeight(eventType: string) {
  if (eventType === 'form_submitted' || eventType === 'whatsapp_property_click') return 6
  if (eventType === 'property_feed_whatsapp_clicked' || eventType === 'property_feed_message_clicked') return 5
  if (eventType === 'property_shared') return 4
  if (eventType === 'property_details_clicked') return 3
  if (eventType === 'chat_opened' || eventType === 'whatsapp_link_click') return 2
  if (eventType === 'property_feed_slide_viewed') return 2
  return 1
}

function demandScore(property: any) {
  const price = Number(property?.price || 0)
  const text = normalizeText([
    property?.title,
    property?.description,
    property?.property_type,
    property?.source_status,
    property?.neighborhood,
    property?.city,
  ].filter(Boolean).join(' '))

  let score = Math.min(price / 100000, 120)
  if (property?.featured_image || safeArray(property?.images).length > 0) score += 12
  if (property?.exclusive) score += 18
  if (price >= 5000000) score += 22
  if (text.includes('frente') && text.includes('mar')) score += 18
  if (text.includes('cobertura')) score += 14
  if (text.includes('lancamento') || text.includes('na planta')) score += 10
  if (['balneario camboriu', 'itajai', 'itapema', 'porto belo'].includes(normalizeText(property?.city))) score += 8

  return score
}

function extractPropertyIdFromEvent(event: any, landingPageToProperty: Map<string, string>) {
  const metadata = event?.metadata && typeof event.metadata === 'object' ? event.metadata : {}
  const directId = metadata.property_id
    || metadata.target_property_id
    || metadata.lead_property_id
    || metadata.from_property_id
    || metadata.to_property_id

  if (directId) return String(directId)

  if (event?.landing_page_id) {
    const propertyId = landingPageToProperty.get(String(event.landing_page_id))
    if (propertyId) return propertyId
  }

  const path = String(metadata.page_path || metadata.pathname || metadata.page_url || '')
  const match = path.match(/\/imovel\/([0-9a-f-]{32,36})/i)
  return match?.[1] || null
}

export async function getMostVisitedBlogProperties(
  supabase: SupabaseLike,
  options: { limit?: number; days?: number; keywords?: string[] } = {},
): Promise<BlogPropertyRecommendation[]> {
  const limit = Math.max(1, Math.min(12, options.limit || 4))
  const days = Math.max(7, Math.min(180, options.days || 90))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [propertiesResult, landingPagesResult] = await Promise.all([
    supabase
      .from('properties')
      .select('id,title,city,state,neighborhood,price,property_type,bedrooms,bathrooms,suites,parking_spaces,area_m2,featured_image,exclusive,status,source_status,created_at')
      .eq('status', 'active')
      .limit(400),
    supabase
      .from('landing_pages')
      .select('id,slug,property_id,status')
      .eq('status', 'published')
      .limit(600),
  ])

  if (propertiesResult.error) throw new Error(propertiesResult.error.message)
  if (landingPagesResult.error) throw new Error(landingPagesResult.error.message)

  const landingPages = landingPagesResult.data || []
  const landingPageToProperty = new Map<string, string>()
  const propertyToLandingSlug = new Map<string, string>()
  for (const page of landingPages) {
    if (page?.id && page?.property_id) landingPageToProperty.set(String(page.id), String(page.property_id))
    if (page?.property_id && page?.slug) propertyToLandingSlug.set(String(page.property_id), String(page.slug))
  }

  const { data: events } = await supabase
    .from('funnel_events')
    .select('landing_page_id,event_type,metadata,created_at')
    .gte('created_at', since)
    .in('event_type', PROPERTY_EVENT_TYPES)
    .order('created_at', { ascending: false })
    .limit(4000)

  const viewScores = new Map<string, number>()
  for (const event of events || []) {
    const propertyId = extractPropertyIdFromEvent(event, landingPageToProperty)
    if (!propertyId) continue
    viewScores.set(propertyId, (viewScores.get(propertyId) || 0) + eventWeight(String(event.event_type || 'page_view')))
  }

  const keywords = (options.keywords || []).map(normalizeText).filter(Boolean)
  const hasRealViews = Array.from(viewScores.values()).some(value => value > 0)

  const scored: ScoredProperty[] = (propertiesResult.data || [])
    .map((property: any) => {
      const text = normalizeText([
        property.title,
        property.city,
        property.neighborhood,
        property.property_type,
        property.source_status,
      ].filter(Boolean).join(' '))
      const keywordBoost = keywords.some(keyword => text.includes(keyword) || keyword.includes(text))
        ? 500000
        : 0
      const realScore = viewScores.get(String(property.id)) || 0
      const score = (hasRealViews ? realScore * 1000000 : 0) + keywordBoost + demandScore(property)

      return {
        property,
        score,
        viewScore: realScore,
      }
    })

  return scored
    .sort((a, b) => b.score - a.score || Number(b.property.price || 0) - Number(a.property.price || 0))
    .slice(0, limit)
    .map(({ property, viewScore }: any) => ({
      id: property.id,
      title: property.title,
      city: property.city,
      state: property.state,
      neighborhood: property.neighborhood,
      price: property.price,
      property_type: property.property_type,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      suites: property.suites,
      parking_spaces: property.parking_spaces,
      area_m2: property.area_m2,
      featured_image: property.featured_image || null,
      images: [],
      exclusive: property.exclusive,
      status: property.status,
      landing_page_slug: propertyToLandingSlug.get(String(property.id)) || null,
      view_score: viewScore,
    }))
}

export async function chooseBlogCoverImage(
  supabase: SupabaseLike,
  keywords: string[] = [],
) {
  const [{ data: usedCovers }, properties] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('cover_image_url')
      .not('cover_image_url', 'is', null)
      .limit(500),
    getMostVisitedBlogProperties(supabase, {
      limit: 12,
      days: 90,
      keywords,
    }).catch(() => []),
  ])

  const used = new Set(
    (usedCovers || [])
      .map((row: { cover_image_url?: string | null }) => String(row.cover_image_url || '').trim())
      .filter(Boolean),
  )
  const candidates = properties.flatMap(property => [
    property.featured_image,
    ...property.images,
  ])
    .map(url => String(url || '').trim())
    .filter(Boolean)
  const uniqueCandidates = Array.from(new Set(candidates))

  return uniqueCandidates.find(url => !used.has(url)) || uniqueCandidates[0] || null
}

export async function listBlogCoverImageCandidates(
  supabase: SupabaseLike,
  keywords: string[] = [],
) {
  const properties = await getMostVisitedBlogProperties(supabase, {
    limit: 12,
    days: 90,
    keywords,
  }).catch(() => [])

  return Array.from(new Set(
    properties.flatMap(property => [
      property.featured_image,
      ...property.images,
    ])
      .map(url => String(url || '').trim())
      .filter(Boolean),
  ))
}
