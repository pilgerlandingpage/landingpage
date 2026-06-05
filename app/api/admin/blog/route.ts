import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { BLOG_AUTHOR_NAME } from '@/lib/blog/author'
import { notifyBlogPublished, notifyBlogReviewReady } from '@/lib/blog/review-notifications'
import { runBlogAgentDraft } from '@/lib/blog/runner'
import { runNewsAgentDraft } from '@/lib/news/runner'
import { slugifyBlog } from '@/lib/blog/types'
import { enqueueEditorialCampaignForPost } from '@/lib/editorial-distribution'

const BLOG_SELECT = '*'
const BLOG_STATUSES = new Set(['draft', 'under_review', 'published', 'archived'])

function normalizeBlogStatus(value: unknown) {
    const status = String(value || '').trim()
    return BLOG_STATUSES.has(status) ? status : 'draft'
}

function parseJsonArray(value: unknown) {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
        return value.split(',').map(item => item.trim()).filter(Boolean)
    }
    return []
}

function normalizePostPayload(body: any) {
    const title = String(body?.title || '').trim()
    return {
        title,
        slug: slugifyBlog(body?.slug || title),
        excerpt: String(body?.excerpt || '').trim() || null,
        content_markdown: String(body?.content_markdown || body?.article_markdown || '').trim(),
        status: normalizeBlogStatus(body?.status),
        cover_image_url: String(body?.cover_image_url || '').trim() || null,
        author_name: String(body?.author_name || BLOG_AUTHOR_NAME).trim(),
        category: String(body?.category || 'Mercado Imobiliario').trim(),
        tags: parseJsonArray(body?.tags).map(String),
        seo_title: String(body?.seo_title || title).trim() || null,
        meta_description: String(body?.meta_description || '').trim() || null,
        primary_keyword: String(body?.primary_keyword || '').trim() || null,
        secondary_keywords: parseJsonArray(body?.secondary_keywords).map(String),
        local_entities: parseJsonArray(body?.local_entities).map(String),
        aeo_questions: parseJsonArray(body?.aeo_questions),
        internal_links: parseJsonArray(body?.internal_links),
        source_summary: body?.source_summary || null,
        approval_notes: parseJsonArray(body?.approval_notes).map(String),
        generated_by: body?.generated_by || null,
    }
}

function isLegacyBenchmarkBriefing(post: any) {
    return String(post?.generated_by || '') === 'benchmark-editorial'
        || /^pauta de blog a partir de benchmark:/i.test(String(post?.title || ''))
        || /^material lara para (isadora|clara):/i.test(String(post?.title || ''))
}

function tableMissingResponse(error: any) {
    if (!error?.message?.includes('blog_posts')) return null
    return NextResponse.json({
        error: 'Tabela blog_posts nao encontrada. Aplique a migration supabase/migrations/20260509120000_blog_system.sql no Supabase.',
    }, { status: 500 })
}

async function safeEnqueueEditorialDistribution(supabase: ReturnType<typeof createAdminClient>, post: any, origin: string, source: string) {
    try {
        return await enqueueEditorialCampaignForPost(supabase, { post, origin, source })
    } catch (error: any) {
        console.error('[Blog Admin] editorial distribution enqueue failed:', error)
        return { queued: false, error: error?.message || String(error) }
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const status = request.nextUrl.searchParams.get('status')
        const id = request.nextUrl.searchParams.get('id')

        let query = supabase
            .from('blog_posts')
            .select(BLOG_SELECT)
            .order('created_at', { ascending: false })

        if (id) query = query.eq('id', id)
        if (status && status !== 'all') query = query.eq('status', status)

        const { data, error } = await query
        if (error) {
            const missing = tableMissingResponse(error)
            if (missing) return missing
            throw error
        }

        const posts = request.nextUrl.searchParams.get('include_benchmark_briefings') === 'true'
            ? data || []
            : (data || []).filter((post: any) => !isLegacyBenchmarkBriefing(post))

        return NextResponse.json({ posts })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const supabase = createAdminClient()
        const action = body?.action || 'create'

        if (action === 'generate') {
            const result = await runBlogAgentDraft({
                topic: String(body?.topic || '').trim() || undefined,
                origin: request.nextUrl.origin,
                source: 'manual_blog_api',
            })
            return NextResponse.json(result, { status: 201 })
        }

        if (action === 'generate_news') {
            const result = await runNewsAgentDraft({
                topic: String(body?.topic || '').trim() || undefined,
                origin: request.nextUrl.origin,
                source: 'manual_news_api',
            })
            return NextResponse.json(result, { status: 201 })
        }

        const payload = normalizePostPayload(body)
        const publishedAt = payload.status === 'published' ? new Date().toISOString() : null

        if (!payload.title || !payload.content_markdown) {
            return NextResponse.json({ error: 'Titulo e conteudo sao obrigatorios.' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('blog_posts')
            .insert({
                ...payload,
                published_at: publishedAt,
            })
            .select(BLOG_SELECT)
            .single()

        if (error) {
            const missing = tableMissingResponse(error)
            if (missing) return missing
            throw error
        }

        const actorName = body?.published_by || body?.updated_by || body?.actor_name || body?.actorName
        const notification = data?.status === 'under_review'
            ? await notifyBlogReviewReady({ supabase, post: data, origin: request.nextUrl.origin })
            : data?.status === 'published'
                ? await notifyBlogPublished({ supabase, post: data, origin: request.nextUrl.origin, actorName })
                : { sent: false, skipped: true, reason: 'Artigo nao esta em analise ou publicado.' }
        const distribution = data?.status === 'published'
            ? await safeEnqueueEditorialDistribution(supabase, data, request.nextUrl.origin, 'admin_blog_post')
            : { queued: false, skipped: true, reason: 'post_not_published' }

        return NextResponse.json({ post: data, notification, distribution }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const id = body?.id
        if (!id) return NextResponse.json({ error: 'ID obrigatorio.' }, { status: 400 })

        const supabase = createAdminClient()
        const payload = normalizePostPayload(body)
        const status = normalizeBlogStatus(body?.status || payload.status)
        const publishedAt = status === 'published'
            ? (body?.published_at || new Date().toISOString())
            : null

        const { data: currentPost, error: currentPostError } = await supabase
            .from('blog_posts')
            .select('status')
            .eq('id', id)
            .maybeSingle()

        if (currentPostError) {
            const missing = tableMissingResponse(currentPostError)
            if (missing) return missing
            throw currentPostError
        }

        const { data, error } = await supabase
            .from('blog_posts')
            .update({
                ...payload,
                status,
                published_at: publishedAt,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select(BLOG_SELECT)
            .single()

        if (error) {
            const missing = tableMissingResponse(error)
            if (missing) return missing
            throw error
        }

        const actorName = body?.published_by || body?.updated_by || body?.actor_name || body?.actorName
        const notification = status === 'published' && currentPost?.status !== 'published'
            ? await notifyBlogPublished({ supabase, post: data, origin: request.nextUrl.origin, actorName })
            : status === 'under_review' && currentPost?.status !== 'under_review'
                ? await notifyBlogReviewReady({ supabase, post: data, origin: request.nextUrl.origin })
                : { sent: false, skipped: true, reason: 'Status sem nova notificacao de setor.' }
        const distribution = status === 'published' && currentPost?.status !== 'published'
            ? await safeEnqueueEditorialDistribution(supabase, data, request.nextUrl.origin, 'admin_blog_patch')
            : { queued: false, skipped: true, reason: 'status_without_new_publish' }

        return NextResponse.json({ post: data, notification, distribution })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID obrigatorio.' }, { status: 400 })

        const supabase = createAdminClient()
        const { error } = await supabase.from('blog_posts').delete().eq('id', id)
        if (error) {
            const missing = tableMissingResponse(error)
            if (missing) return missing
            throw error
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
    }
}
