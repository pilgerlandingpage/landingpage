import { getMostVisitedBlogProperties, type BlogPropertyRecommendation } from '@/lib/blog/properties'
import { searchEditorialImages, persistEditorialImageToR2, type EditorialImageResult } from '@/lib/media/editorial-image-providers'
import { slugifyBlog } from '@/lib/blog/types'

type SupabaseLike = {
  from: (table: string) => any
}

export type EditorialVisualAsset = {
  role: 'cover' | 'inline'
  source: 'property' | 'pexels' | 'pixabay'
  image_url: string
  original_url?: string
  source_url?: string
  author?: string
  license?: string
  alt: string
  caption: string
  credit?: string
  linked_url?: string
  relevance_reason: string
  score: number
}

export type EditorialVisualPlan = {
  coverImageUrl: string | null
  contentMarkdown: string
  assets: EditorialVisualAsset[]
  internalLinks: Array<{ label: string; target: string; reason?: string }>
  imageSearchQuery: string
}

type BuildVisualPlanInput = {
  contentType: 'blog' | 'news'
  title: string
  markdown: string
  keywords: string[]
  existingInternalLinks?: Array<{ label: string; target: string; reason?: string }>
  maxInlineImages?: number
}

function normalize(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
}

function propertyHref(property: BlogPropertyRecommendation) {
  return property.landing_page_slug ? `/${property.landing_page_slug}` : `/imovel/${property.id}`
}

function getPropertyImages(property: BlogPropertyRecommendation) {
  return unique([property.featured_image, ...(property.images || [])])
}

function scoreProperty(property: BlogPropertyRecommendation, keywords: string[]) {
  const haystack = normalize([
    property.title,
    property.city,
    property.neighborhood,
    property.property_type,
  ].filter(Boolean).join(' '))
  const terms = keywords
    .flatMap(keyword => normalize(keyword).split(/\s+/))
    .map(term => term.replace(/[^a-z0-9]+/g, ''))
    .filter(term => term.length > 3)

  const matches = new Set(terms.filter(term => haystack.includes(term)))
  const hasImage = getPropertyImages(property).length > 0
  return (matches.size * 12) + (hasImage ? 10 : 0) + Math.min(Number(property.view_score || 0), 20)
}

function buildImageSearchQuery(input: BuildVisualPlanInput) {
  const cleaned = unique(input.keywords)
    .filter(keyword => !/^noticias$/i.test(keyword))
    .slice(0, 5)
  const local = cleaned.find(keyword => /balneario|camboriu|itajai|itapema|porto belo|praia brava/i.test(keyword))
  const base = cleaned.slice(0, 3).join(' ')
  const suffix = input.contentType === 'news'
    ? 'editorial real estate city beach architecture'
    : 'luxury real estate editorial beach architecture'
  return unique([local, base, suffix]).join(' ').trim() || suffix
}

function externalAssetFromImage(
  image: EditorialImageResult & { r2Url?: string },
  role: EditorialVisualAsset['role'],
  title: string,
): EditorialVisualAsset {
  const providerLabel = image.provider === 'pexels' ? 'Pexels' : 'Pixabay'
  return {
    role,
    source: image.provider,
    image_url: image.r2Url || image.imageUrl,
    original_url: image.imageUrl,
    source_url: image.sourceUrl,
    author: image.author,
    license: image.license,
    alt: image.alt || title,
    caption: role === 'cover'
      ? `Imagem editorial selecionada para ilustrar ${title}.`
      : image.description || `Imagem editorial relacionada a ${title}.`,
    credit: `${providerLabel}: ${image.author}`,
    relevance_reason: `Selecionada automaticamente por aderencia visual ao tema "${title}".`,
    score: image.score,
  }
}

function propertyAssetFromImage(
  property: BlogPropertyRecommendation,
  imageUrl: string,
  role: EditorialVisualAsset['role'],
  score: number,
): EditorialVisualAsset {
  const location = [property.neighborhood, property.city].filter(Boolean).join(' - ')
  return {
    role,
    source: 'property',
    image_url: imageUrl,
    alt: `${property.title}${location ? ` em ${location}` : ''}`,
    caption: `${property.title}${location ? `, ${location}` : ''}.`,
    credit: 'Acervo Imobiliaria Guilherme Pilger',
    linked_url: propertyHref(property),
    relevance_reason: 'Imagem real de imovel do estoque com aderencia ao tema editorial.',
    score,
  }
}

function insertInlineImages(markdown: string, assets: EditorialVisualAsset[]) {
  const inlineAssets = assets.filter(asset => asset.role === 'inline')
  if (!inlineAssets.length) return markdown

  const lines = String(markdown || '').split(/\r?\n/)
  let assetIndex = 0
  const output: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    output.push(line)
    const heading = line.trim()
    const hasFollowingContent = lines.slice(index + 1).some(nextLine => nextLine.trim())
    const canReceiveImage = /^#{2,3}\s+/.test(heading) && !/^#{2,3}\s+(leia tambem|fontes|referencias)/i.test(heading)
    const shouldInsert = canReceiveImage && hasFollowingContent && assetIndex < inlineAssets.length
    if (!shouldInsert) continue

    const asset = inlineAssets[assetIndex]
    assetIndex += 1
    output.push('')
    output.push(`![${asset.alt}](${asset.image_url})`)
    output.push('')
    output.push(`Fonte da imagem: ${asset.credit || asset.source}.`)
    output.push('')
  }

  return output.join('\n')
}

function mergeInternalLinks(
  current: Array<{ label: string; target: string; reason?: string }> = [],
  properties: BlogPropertyRecommendation[],
) {
  const links = [...current]
  const seen = new Set(links.map(link => `${link.label}|${link.target}`))

  for (const property of properties.slice(0, 2)) {
    const target = propertyHref(property)
    const label = property.title || 'Imovel relacionado'
    const key = `${label}|${target}`
    if (seen.has(key)) continue
    seen.add(key)
    links.push({
      label,
      target,
      reason: 'Imovel relacionado automaticamente ao tema editorial.',
    })
  }

  return links.slice(0, 14)
}

export async function buildEditorialVisualPlan(
  supabase: SupabaseLike,
  input: BuildVisualPlanInput,
): Promise<EditorialVisualPlan> {
  const keywords = unique(input.keywords)
  const imageSearchQuery = buildImageSearchQuery(input)
  const properties = await getMostVisitedBlogProperties(supabase, {
    limit: 8,
    days: 120,
    keywords,
  }).catch(() => [])

  const scoredProperties = properties
    .map(property => ({ property, score: scoreProperty(property, keywords) }))
    .filter(item => item.score > 10 && getPropertyImages(item.property).length > 0)
    .sort((a, b) => b.score - a.score)

  const usedImages = new Set<string>()
  const assets: EditorialVisualAsset[] = []
  const inlineLimit = input.maxInlineImages || 2
  const externalNeeded = inlineLimit + 1
  const externalImages = await searchEditorialImages({
    query: imageSearchQuery,
    orientation: 'horizontal',
    perPage: Math.max(8, externalNeeded * 4),
  }).catch(() => [])

  for (const externalImage of externalImages.slice(0, externalNeeded + 2)) {
    if (assets.filter(asset => asset.role === 'cover').length && assets.filter(asset => asset.role === 'inline').length >= inlineLimit) break
    const role = assets.some(asset => asset.role === 'cover') ? 'inline' : 'cover'
    const persisted = await persistEditorialImageToR2(externalImage, {
      folder: input.contentType === 'news' ? 'editorial-images/news' : 'editorial-images/blog',
      slug: slugifyBlog(`${input.title}-${externalImage.provider}-${externalImage.id}`),
    })
    const asset = externalAssetFromImage(persisted, role, input.title)
    if (usedImages.has(asset.image_url)) continue
    usedImages.add(asset.image_url)
    assets.push(asset)
  }

  if (!assets.some(asset => asset.role === 'cover')) {
    const coverProperty = scoredProperties[0]
    if (coverProperty) {
      const imageUrl = getPropertyImages(coverProperty.property)[0]
      usedImages.add(imageUrl)
      assets.push(propertyAssetFromImage(coverProperty.property, imageUrl, 'cover', coverProperty.score))
    }
  }

  for (const item of scoredProperties) {
    if (assets.filter(asset => asset.role === 'inline').length >= inlineLimit) break
    const imageUrl = getPropertyImages(item.property).find(url => !usedImages.has(url))
    if (!imageUrl) continue
    usedImages.add(imageUrl)
    assets.push(propertyAssetFromImage(item.property, imageUrl, 'inline', item.score))
  }

  const coverImageUrl = assets.find(asset => asset.role === 'cover')?.image_url || null
  const contentMarkdown = insertInlineImages(input.markdown, assets)
  const internalLinks = mergeInternalLinks(input.existingInternalLinks, scoredProperties.map(item => item.property))

  return {
    coverImageUrl,
    contentMarkdown,
    assets,
    internalLinks,
    imageSearchQuery,
  }
}
