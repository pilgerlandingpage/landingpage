import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { absoluteUrl, SITE_URL } from '@/lib/seo/json-ld'
import { getGeoPages } from '@/lib/seo/geo-pages'
import { buildPropertySeoPath } from '@/lib/properties/seo-url'

type SitemapEntry = MetadataRoute.Sitemap[number]

const staticRoutes: Array<{ path: string; priority: number; changeFrequency: SitemapEntry['changeFrequency'] }> = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/busca', priority: 0.95, changeFrequency: 'daily' },
  { path: '/imoveis', priority: 0.92, changeFrequency: 'daily' },
  { path: '/blog', priority: 0.75, changeFrequency: 'weekly' },
  { path: '/noticias', priority: 0.8, changeFrequency: 'daily' },
  { path: '/contato', priority: 0.65, changeFrequency: 'monthly' },
  { path: '/trabalhe-conosco', priority: 0.62, changeFrequency: 'monthly' },
  { path: '/politica-de-privacidade', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/termos-de-servico', priority: 0.2, changeFrequency: 'yearly' },
]

function entry(path: string, options: Partial<SitemapEntry> = {}): SitemapEntry {
  return {
    url: absoluteUrl(path),
    lastModified: options.lastModified || new Date(),
    changeFrequency: options.changeFrequency || 'weekly',
    priority: options.priority || 0.5,
  }
}

function normalizePostClassifier(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function isNewsPost(post: { category?: string | null; tags?: string[] | null; generated_by?: string | null }) {
  const category = normalizePostClassifier(post.category)
  const generatedBy = normalizePostClassifier(post.generated_by)
  const tags = Array.isArray(post.tags) ? post.tags.map(normalizePostClassifier) : []
  return generatedBy.includes('news') || category.includes('noticia') || tags.some(tag => tag.includes('noticia'))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const items: SitemapEntry[] = staticRoutes.map(route => entry(route.path, route))

  for (const page of getGeoPages()) {
    items.push(entry(`/imoveis/${page.slug}`, {
      changeFrequency: 'daily',
      priority: 0.88,
    }))
  }

  try {
    const supabase = createAdminClient()

    const [{ data: properties }, { data: posts }, { data: landingPages }] = await Promise.all([
      supabase
        .from('properties')
        .select('id, title, seo_title, city, neighborhood, property_type, updated_at, created_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(900),
      supabase
        .from('blog_posts')
        .select('slug, category, tags, generated_by, updated_at, published_at, created_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(400),
      supabase
        .from('landing_pages')
        .select('slug, updated_at, created_at')
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(300),
    ])

    for (const property of properties || []) {
      items.push(entry(buildPropertySeoPath(property), {
        lastModified: property.updated_at || property.created_at || new Date(),
        changeFrequency: 'weekly',
        priority: 0.92,
      }))
    }

    for (const post of posts || []) {
      items.push(entry(`${isNewsPost(post) ? '/noticias' : '/blog'}/${post.slug}`, {
        lastModified: post.updated_at || post.published_at || post.created_at || new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      }))
    }

    for (const page of landingPages || []) {
      if (!page.slug) continue
      items.push(entry(`/${page.slug}`, {
        lastModified: page.updated_at || page.created_at || new Date(),
        changeFrequency: 'weekly',
        priority: 0.72,
      }))
    }
  } catch (error) {
    console.warn('[sitemap] dynamic routes unavailable:', error instanceof Error ? error.message : error)
  }

  const seen = new Set<string>()
  return items
    .map(item => ({ ...item, url: item.url.replace(SITE_URL.replace(/\/$/, ''), SITE_URL.replace(/\/$/, '')) }))
    .filter(item => {
      if (seen.has(item.url)) return false
      seen.add(item.url)
      return true
    })
}
