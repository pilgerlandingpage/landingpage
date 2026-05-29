import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function numberValue(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function mediaScore(item: any) {
  return numberValue(item.views)
    + numberValue(item.reach)
    + (numberValue(item.total_interactions) * 2)
    + numberValue(item.like_count)
    + (numberValue(item.comments_count) * 4)
    + (numberValue(item.shares) * 5)
    + (numberValue(item.saved) * 3)
}

export async function GET() {
  try {
    const supabase = createAdminClient()
    const since = new Date()
    since.setDate(since.getDate() - 30)
    const sinceIso = since.toISOString()

    const [
      reportsRes,
      organicProfilesRes,
      organicMediaRes,
      paidSnapshotsRes,
      creativesRes,
      suggestionsRes,
    ] = await Promise.all([
      supabase
        .from('marketing_ai_reports')
        .select('id, report_type, period_start, period_end, title, summary, insights, recommendations, metrics, created_at')
        .in('report_type', ['paid', 'organic'])
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('organic_social_profiles')
        .select('platform, followers_count, media_count, last_synced_at'),
      supabase
        .from('organic_social_media')
        .select('platform, caption, media_product_type, published_at, reach, views, total_interactions, like_count, comments_count, saved, shares')
        .gte('published_at', sinceIso)
        .order('published_at', { ascending: false })
        .limit(80),
      supabase
        .from('ad_metrics_snapshots')
        .select('campaign_id, snapshot_at, impressions, clicks, spend, leads_count, conversions, reach, landing_page_views, ad_campaigns(name, platform, status)')
        .gte('snapshot_at', sinceIso)
        .order('snapshot_at', { ascending: false })
        .limit(500),
      supabase
        .from('marketing_creatives')
        .select('campaign_type, status, content_type, platform_targets, created_at')
        .gte('created_at', sinceIso)
        .limit(120),
      supabase
        .from('meta_social_ai_suggestions')
        .select('platform, priority, lead_score, status, updated_at')
        .gte('updated_at', sinceIso)
        .limit(120),
    ])

    if (reportsRes.error) throw reportsRes.error
    if (organicProfilesRes.error) throw organicProfilesRes.error
    if (organicMediaRes.error) throw organicMediaRes.error
    if (paidSnapshotsRes.error) throw paidSnapshotsRes.error
    if (creativesRes.error) throw creativesRes.error
    if (suggestionsRes.error) throw suggestionsRes.error

    const reports = reportsRes.data || []
    const latestPaidReport = reports.find((report: any) => report.report_type === 'paid') || null
    const latestOrganicReport = reports.find((report: any) => report.report_type === 'organic') || null

    const organicProfiles = organicProfilesRes.data || []
    const organicMedia = organicMediaRes.data || []
    const paidSnapshots = paidSnapshotsRes.data || []
    const creatives = creativesRes.data || []
    const suggestions = suggestionsRes.data || []

    const latestByCampaign = new Map<string, any>()
    for (const snapshot of paidSnapshots) {
      if (!snapshot.campaign_id) continue
      if (!latestByCampaign.has(snapshot.campaign_id)) latestByCampaign.set(snapshot.campaign_id, snapshot)
    }
    const paidLatestRows = Array.from(latestByCampaign.values())

    const paidTotals = paidLatestRows.reduce(
      (acc, item: any) => {
        acc.spend += numberValue(item.spend)
        acc.impressions += numberValue(item.impressions)
        acc.clicks += numberValue(item.clicks)
        acc.reach += numberValue(item.reach)
        acc.leads += numberValue(item.leads_count || item.conversions)
        acc.landingPageViews += numberValue(item.landing_page_views)
        return acc
      },
      { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, landingPageViews: 0 },
    )

    const organicTotals = organicMedia.reduce(
      (acc: any, item: any) => {
        acc.reach += numberValue(item.reach)
        acc.views += numberValue(item.views)
        acc.interactions += numberValue(item.total_interactions)
        acc.comments += numberValue(item.comments_count)
        acc.shares += numberValue(item.shares)
        acc.saved += numberValue(item.saved)
        return acc
      },
      { reach: 0, views: 0, interactions: 0, comments: 0, shares: 0, saved: 0 },
    )

    const organicFollowers = organicProfiles.reduce((sum: number, item: any) => sum + numberValue(item.followers_count), 0)
    const topOrganic = [...organicMedia]
      .sort((a: any, b: any) => mediaScore(b) - mediaScore(a))
      .slice(0, 5)
      .map((item: any) => ({
        platform: item.platform,
        title: String(item.caption || item.media_product_type || 'Conteudo').split('\n').find(Boolean)?.slice(0, 120) || 'Conteudo',
        score: mediaScore(item),
        published_at: item.published_at,
      }))

    const hotSuggestions = suggestions.filter((item: any) => numberValue(item.lead_score) >= 70)
    const pendingSuggestions = suggestions.filter((item: any) => item.status === 'pending')
    const pendingCreatives = creatives.filter((item: any) => ['draft', 'review', 'approved', 'scheduled'].includes(String(item.status || '')))

    const paidHealth = numberValue((latestPaidReport as any)?.metrics?.health_score)
    const organicHealth = numberValue((latestOrganicReport as any)?.metrics?.health_score)
    const blendedScore = paidHealth > 0 && organicHealth > 0
      ? Math.round((paidHealth + organicHealth) / 2)
      : paidHealth || organicHealth || 0

    return NextResponse.json({
      success: true,
      reports: {
        paid: latestPaidReport,
        organic: latestOrganicReport,
      },
      metrics: {
        period_days: 30,
        blended_score: blendedScore,
        paid_health_score: paidHealth,
        organic_health_score: organicHealth,
        paid: {
          ...paidTotals,
          cpl: paidTotals.leads > 0 ? paidTotals.spend / paidTotals.leads : 0,
          ctr: paidTotals.impressions > 0 ? (paidTotals.clicks / paidTotals.impressions) * 100 : 0,
          campaigns_with_metrics: paidLatestRows.length,
        },
        organic: {
          ...organicTotals,
          followers: organicFollowers,
          media: organicMedia.length,
          engagement_rate: organicFollowers > 0 ? (organicTotals.interactions / organicFollowers) * 100 : 0,
        },
        social_ai: {
          suggestions: suggestions.length,
          hot_leads: hotSuggestions.length,
          pending: pendingSuggestions.length,
        },
        creatives: {
          total: creatives.length,
          pending: pendingCreatives.length,
          paid: creatives.filter((item: any) => ['paid', 'both'].includes(String(item.campaign_type || ''))).length,
          organic: creatives.filter((item: any) => ['organic', 'both'].includes(String(item.campaign_type || ''))).length,
        },
      },
      topOrganic,
    })
  } catch (error) {
    console.error('Error loading marketing command center:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar comando de marketing.' },
      { status: 500 },
    )
  }
}
