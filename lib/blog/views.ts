export type BlogPostViewTarget = {
    id: string
    slug?: string | null
}

const EDITORIAL_VIEW_EVENTS = ['blog_post_viewed', 'news_post_viewed']
const BLOG_VIEW_COUNT_TIMEOUT_MS = 4000

type SupabaseLike = {
    from: (table: string) => any
}

function createBlogViewAbortSignal(timeoutMs = BLOG_VIEW_COUNT_TIMEOUT_MS) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(timeoutMs)
    }

    const controller = new AbortController()
    setTimeout(() => controller.abort(), timeoutMs)
    return controller.signal
}

function summarizeBlogViewError(error: unknown) {
    const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message || '')
        : String(error || '')

    const cleaned = message
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    if (!cleaned) return 'Erro desconhecido'
    return cleaned.length > 260 ? `${cleaned.slice(0, 260).trim()}...` : cleaned
}

function uniqueValues(values: string[]) {
    return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}

function metadataRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

function postgrestInList(values: string[]) {
    return `(${values.map(value => `"${value.replace(/"/g, '')}"`).join(',')})`
}

export function formatBlogViewCount(value?: number | null) {
    const count = Number(value)
    if (!Number.isFinite(count) || count <= 0) return '0'

    return Math.trunc(count).toLocaleString('pt-BR', {
        maximumFractionDigits: 0,
    })
}

export function blogViewLabel(value?: number | null) {
    const count = Number(value)
    const safeCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0
    return `${formatBlogViewCount(safeCount)} ${safeCount === 1 ? 'visualização' : 'visualizações'}`
}

export async function getBlogPostViewCount(supabase: SupabaseLike, postId: string) {
    if (!postId) return 0

    const { count, error } = await supabase
        .from('funnel_events')
        .select('id', { count: 'exact', head: true })
        .in('event_type', EDITORIAL_VIEW_EVENTS)
        .contains('metadata', { post_id: postId })
        .abortSignal(createBlogViewAbortSignal())

    if (error) {
        console.warn('[Blog views] view count unavailable:', summarizeBlogViewError(error))
        return 0
    }

    return count || 0
}

export async function getBlogPostViewCounts<T extends BlogPostViewTarget>(supabase: SupabaseLike, posts: T[]) {
    const ids = uniqueValues(posts.map(post => post.id))
    const counts = new Map<string, number>()
    ids.forEach(id => counts.set(id, 0))

    if (!ids.length) return counts

    try {
        const { data, error } = await supabase
            .from('funnel_events')
            .select('metadata')
            .in('event_type', EDITORIAL_VIEW_EVENTS)
            .filter('metadata->>post_id', 'in', postgrestInList(ids))
            .limit(50000)
            .abortSignal(createBlogViewAbortSignal())

        if (error) throw error

        for (const row of data || []) {
            const metadata = metadataRecord((row as any).metadata)
            const postId = String(metadata.post_id || '')
            if (!counts.has(postId)) continue
            counts.set(postId, (counts.get(postId) || 0) + 1)
        }

        return counts
    } catch (error: any) {
        console.warn('[Blog views] batch view counts unavailable:', summarizeBlogViewError(error))
        return counts
    }
}

export function attachBlogPostViewCounts<T extends BlogPostViewTarget>(posts: T[], counts: Map<string, number>) {
    return posts.map(post => ({
        ...post,
        view_count: counts.get(post.id) || 0,
    }))
}
