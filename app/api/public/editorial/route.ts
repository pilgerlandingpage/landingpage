import { NextRequest, NextResponse } from 'next/server'
import { attachBlogPostViewCounts, getBlogPostViewCounts } from '@/lib/blog/views'
import { createAdminClient, createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PUBLIC_EDITORIAL_FIELDS = [
    'id',
    'title',
    'slug',
    'excerpt',
    'cover_image_url',
    'category',
    'tags',
    'meta_description',
    'generated_by',
    'created_at',
    'published_at',
].join(',')

type PublicEditorialPost = {
    id: string
    title: string
    slug: string
    excerpt?: string | null
    cover_image_url?: string | null
    category?: string | null
    meta_description?: string | null
    generated_by?: string | null
    created_at?: string | null
    published_at?: string | null
    tags?: string[] | null
    view_count?: number | null
}

function normalizeClassifier(value?: string | null) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function isNewsPost(post: PublicEditorialPost) {
    const category = normalizeClassifier(post.category)
    const generatedBy = normalizeClassifier(post.generated_by)
    const tags = Array.isArray(post.tags) ? post.tags.map(normalizeClassifier) : []
    return generatedBy.includes('news') || category.includes('noticia') || tags.some(tag => tag.includes('noticia'))
}

function editorialDateMs(post: PublicEditorialPost) {
    const value = post.published_at || post.created_at
    const time = value ? new Date(value).getTime() : 0
    return Number.isFinite(time) ? time : 0
}

function sortEditorialPosts(posts: PublicEditorialPost[]) {
    return [...posts].sort((a, b) => {
        const viewDiff = Number(b.view_count || 0) - Number(a.view_count || 0)
        if (viewDiff !== 0) return viewDiff
        return editorialDateMs(b) - editorialDateMs(a)
    })
}

function mixEditorialPosts(posts: PublicEditorialPost[], limit: number) {
    const available = posts.filter(post => post?.id && post?.slug && post?.title)
    if (available.length <= limit) return available

    const news = available.filter(isNewsPost)
    const blog = available.filter(post => !isNewsPost(post))
    if (!news.length || !blog.length) return available.slice(0, limit)

    const first = available[0]
    const used = new Set<string>([first.id])
    const mixed = [first]
    let nextPool = isNewsPost(first) ? blog : news
    let alternatePool = isNewsPost(first) ? news : blog

    while (mixed.length < limit) {
        const candidate =
            nextPool.find(post => !used.has(post.id))
            || alternatePool.find(post => !used.has(post.id))
            || available.find(post => !used.has(post.id))

        if (!candidate) break
        mixed.push(candidate)
        used.add(candidate.id)
        const previousPool = nextPool
        nextPool = alternatePool
        alternatePool = previousPool
    }

    return mixed
}

export async function GET(request: NextRequest) {
    const limitParam = Number(request.nextUrl.searchParams.get('limit') || 4)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 8) : 4

    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('blog_posts')
            .select(PUBLIC_EDITORIAL_FIELDS)
            .eq('status', 'published')
            .order('published_at', { ascending: false })
            .limit(16)
            .abortSignal(createSupabaseAbortSignal(8000))

        if (error) {
            return NextResponse.json(
                { posts: [], error: `Nao foi possivel carregar blog e noticias: ${summarizeSupabaseError(error)}` },
                { status: 500 }
            )
        }

        const posts = (data || []) as PublicEditorialPost[]
        const viewCounts = await getBlogPostViewCounts(supabase, posts)
        const postsWithViews = attachBlogPostViewCounts(posts, viewCounts)
        return NextResponse.json({ posts: mixEditorialPosts(sortEditorialPosts(postsWithViews), limit) })
    } catch (error) {
        return NextResponse.json(
            { posts: [], error: `Nao foi possivel carregar blog e noticias: ${summarizeSupabaseError(error)}` },
            { status: 500 }
        )
    }
}
