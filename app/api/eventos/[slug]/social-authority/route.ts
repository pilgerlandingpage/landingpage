import { NextResponse } from 'next/server'
import { createAdminClient, summarizeSupabaseError } from '@/lib/supabase/server'
import {
    PROFILE_ASSESSMENT_EVENT_SLUG,
    resolveProfileAssessmentEventSlug,
} from '@/lib/events/profile-assessment'

export const dynamic = 'force-dynamic'

type RouteContext = {
    params: Promise<{ slug: string }>
}

type PlatformKey = 'youtube' | 'instagram' | 'tiktok' | 'facebook'

type PlatformSummary = {
    platform: PlatformKey
    label: string
    handle: string
    followers: number
    videos: number
    views: number
    updated_at: string | null
}

const PLATFORM_LABELS: Record<PlatformKey, { label: string; handle: string }> = {
    youtube: { label: 'YouTube', handle: 'Guilherme Pilger' },
    instagram: { label: 'Instagram', handle: '@guilhermepilger' },
    tiktok: { label: 'TikTok', handle: '@guilhermepilgeroficial' },
    facebook: { label: 'Facebook', handle: 'Guilherme Pilger' },
}

const PRESENTATION_SOCIAL_MINIMUMS: Partial<Record<PlatformKey, Partial<PlatformSummary>>> = {
    youtube: {
        followers: 119000,
        videos: 980,
    },
    instagram: {
        followers: 199000,
        videos: 1858,
    },
    tiktok: {
        followers: 210000,
        views: 10000000,
    },
}

const CONFIG_KEYS = [
    'presentation_social_youtube_followers',
    'presentation_social_youtube_videos',
    'presentation_social_youtube_views',
    'presentation_social_instagram_followers',
    'presentation_social_instagram_videos',
    'presentation_social_instagram_views',
    'presentation_social_tiktok_followers',
    'presentation_social_tiktok_videos',
    'presentation_social_tiktok_views',
    'presentation_social_total_views',
]

function numberValue(value: unknown) {
    const parsed = Number(value || 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function platformKey(value: unknown): PlatformKey | null {
    const normalized = String(value || '').trim().toLowerCase()
    if (normalized === 'youtube') return 'youtube'
    if (normalized === 'instagram') return 'instagram'
    if (normalized === 'tiktok' || normalized === 'tik_tok') return 'tiktok'
    if (normalized === 'facebook') return 'facebook'
    return null
}

function isVideoLike(row: any) {
    const platform = platformKey(row?.platform)
    const mediaType = String(row?.media_type || '').toUpperCase()
    const productType = String(row?.media_product_type || '').toUpperCase()

    if (platform === 'youtube' || platform === 'tiktok') return true
    return mediaType.includes('VIDEO')
        || productType.includes('VIDEO')
        || productType.includes('REEL')
        || productType.includes('SHORT')
}

function configNumber(config: Record<string, string>, key: string) {
    return numberValue(config[key])
}

function applyConfigFallback(summary: PlatformSummary, config: Record<string, string>) {
    const prefix = `presentation_social_${summary.platform}`
    const followers = configNumber(config, `${prefix}_followers`)
    const videos = configNumber(config, `${prefix}_videos`)
    const views = configNumber(config, `${prefix}_views`)

    return {
        ...summary,
        followers: Math.max(summary.followers, followers),
        videos: Math.max(summary.videos, videos),
        views: Math.max(summary.views, views),
    }
}

function applyPresentationMinimums(summary: PlatformSummary) {
    const minimums = PRESENTATION_SOCIAL_MINIMUMS[summary.platform]
    if (!minimums) return summary

    return {
        ...summary,
        followers: Math.max(summary.followers, minimums.followers || 0),
        videos: Math.max(summary.videos, minimums.videos || 0),
        views: Math.max(summary.views, minimums.views || 0),
    }
}

export async function GET(_request: Request, context: RouteContext) {
    const { slug } = await context.params
    const resolvedSlug = resolveProfileAssessmentEventSlug(slug)

    if (resolvedSlug !== PROFILE_ASSESSMENT_EVENT_SLUG) {
        return NextResponse.json({ error: 'Evento nao encontrado.' }, { status: 404 })
    }

    try {
        const supabase = createAdminClient()
        const [profilesRes, mediaRes, configRes] = await Promise.all([
            supabase
                .from('organic_social_profiles')
                .select('platform, followers_count, media_count, last_synced_at'),
            supabase
                .from('organic_social_media')
                .select('platform, media_type, media_product_type, views, published_at, last_synced_at, created_at')
                .order('published_at', { ascending: false, nullsFirst: false })
                .limit(2000),
            supabase
                .from('app_config')
                .select('key, value')
                .in('key', CONFIG_KEYS),
        ])

        if (profilesRes.error) throw profilesRes.error
        if (mediaRes.error) throw mediaRes.error
        if (configRes.error) throw configRes.error

        const configRows = (configRes.data || []) as Array<{ key: string; value: string | null }>
        const config = configRows.reduce((acc: Record<string, string>, row) => {
            acc[String(row.key)] = String(row.value || '')
            return acc
        }, {})

        const summaries = new Map<PlatformKey, PlatformSummary>()
        const platformsWithProfileMediaCount = new Set<PlatformKey>()

        ;(['youtube', 'instagram', 'tiktok', 'facebook'] as PlatformKey[]).forEach(platform => {
            summaries.set(platform, {
                platform,
                label: PLATFORM_LABELS[platform].label,
                handle: PLATFORM_LABELS[platform].handle,
                followers: 0,
                videos: 0,
                views: 0,
                updated_at: null,
            })
        })

        for (const profile of profilesRes.data || []) {
            const platform = platformKey((profile as any).platform)
            if (!platform) continue
            const current = summaries.get(platform)
            if (!current) continue

            current.followers += numberValue((profile as any).followers_count)
            const mediaCount = numberValue((profile as any).media_count)
            if (mediaCount > 0) {
                current.videos = Math.max(current.videos, mediaCount)
                platformsWithProfileMediaCount.add(platform)
            }
            current.updated_at = current.updated_at || (profile as any).last_synced_at || null
        }

        for (const item of mediaRes.data || []) {
            const platform = platformKey((item as any).platform)
            if (!platform) continue
            const current = summaries.get(platform)
            if (!current) continue

            if (isVideoLike(item) && !platformsWithProfileMediaCount.has(platform)) current.videos += 1
            current.views += numberValue((item as any).views)
            current.updated_at = current.updated_at || (item as any).last_synced_at || (item as any).published_at || (item as any).created_at || null
        }

        const platforms = Array.from(summaries.values())
            .map(summary => applyConfigFallback(applyPresentationMinimums(summary), config))
            .filter(summary => ['youtube', 'instagram', 'tiktok'].includes(summary.platform))

        const computedTotalViews = platforms.reduce((sum, item) => sum + item.views, 0)
        const totalViews = configNumber(config, 'presentation_social_total_views') || computedTotalViews

        return NextResponse.json({
            success: true,
            platforms,
            total_views: totalViews,
            updated_at: platforms.find(item => item.updated_at)?.updated_at || null,
        })
    } catch (error) {
        console.error('[Presentation Social Authority] metrics unavailable:', error)
        return NextResponse.json(
            { success: false, error: summarizeSupabaseError(error) },
            { status: 500 },
        )
    }
}
