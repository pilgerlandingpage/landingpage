export type BlogPostStatus = 'draft' | 'under_review' | 'published' | 'archived'

export type BlogPost = {
    id: string
    title: string
    slug: string
    excerpt: string | null
    content_markdown: string
    status: BlogPostStatus
    cover_image_url: string | null
    author_name: string | null
    category: string | null
    tags: string[]
    seo_title: string | null
    meta_description: string | null
    primary_keyword: string | null
    secondary_keywords: string[]
    local_entities: string[]
    aeo_questions: Array<{ question: string; answer: string }>
    internal_links: Array<{ label: string; target: string; reason?: string }>
    source_summary: Record<string, unknown> | null
    approval_notes: string[]
    generated_by: string | null
    created_at: string
    updated_at: string
    published_at: string | null
}

function normalizeSummaryCheck(value?: string | null) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

export function isTechnicalBlogSummary(value?: string | null) {
    const text = normalizeSummaryCheck(value)
    if (!text) return false

    return [
        'json valido',
        'ia nao retornou',
        'fallback',
        'rascunho criado',
        'rascunho de noticia criado',
        'revisar fontes e atualidade antes de publicar',
    ].some(marker => text.includes(marker))
}

function cleanMarkdownSummary(value?: string | null) {
    return String(value || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^[-*]\s+/gm, '')
        .replace(/<[^>]+>/g, ' ')
        .split(/\n{2,}/)
        .map(part => part.replace(/\s+/g, ' ').trim())
        .find(Boolean) || ''
}

function clampSummary(value: string, maxLength = 320) {
    const text = value.replace(/\s+/g, ' ').trim()
    if (text.length <= maxLength) return text
    const clipped = text.slice(0, maxLength)
    return `${clipped.slice(0, Math.max(0, clipped.lastIndexOf(' '))).trim()}...`
}

export function pickPublicBlogSummary(post: {
    excerpt?: string | null
    meta_description?: string | null
    content_markdown?: string | null
}) {
    const candidates = [
        post.meta_description,
        post.excerpt,
        cleanMarkdownSummary(post.content_markdown),
    ]

    for (const candidate of candidates) {
        const text = String(candidate || '').trim()
        if (text && !isTechnicalBlogSummary(text)) return clampSummary(text)
    }

    return ''
}

export function slugifyBlog(value: string) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 110) || `artigo-${Date.now()}`
}

type BlogSlugLookup = {
    from: (table: string) => any
}

const MAX_BLOG_SLUG_LENGTH = 110
const MAX_BLOG_SLUG_ATTEMPTS = 500

function slugWithSuffix(base: string, index: number) {
    const suffix = `-${index}`
    return `${base.slice(0, Math.max(1, MAX_BLOG_SLUG_LENGTH - suffix.length)).replace(/-+$/g, '')}${suffix}`
}

export async function getAvailableBlogSlug(supabase: BlogSlugLookup, value: string) {
    const baseSlug = slugifyBlog(value)
    const longestCheckedSuffix = `-${MAX_BLOG_SLUG_ATTEMPTS - 1}`
    const lookupPrefixLength = Math.max(1, MAX_BLOG_SLUG_LENGTH - longestCheckedSuffix.length)
    const lookupPrefix = baseSlug.slice(0, Math.min(baseSlug.length, lookupPrefixLength))
    const { data, error } = await supabase
        .from('blog_posts')
        .select('slug')
        .like('slug', `${lookupPrefix}%`)
        .limit(1000)

    if (error) throw error

    const used = new Set<string>(
        (data || [])
            .map((row: any) => String(row.slug || ''))
            .filter(Boolean)
    )

    if (!used.has(baseSlug)) return baseSlug

    for (let index = 2; index < MAX_BLOG_SLUG_ATTEMPTS; index += 1) {
        const candidate = slugWithSuffix(baseSlug, index)
        if (!used.has(candidate)) return candidate
    }

    return slugWithSuffix(baseSlug, Date.now())
}
