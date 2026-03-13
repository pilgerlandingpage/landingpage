import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import * as metaAds from '@/lib/ads/meta'
import * as googleAds from '@/lib/ads/google'

function startOfDay(d: Date) { const res = new Date(d); res.setHours(0,0,0,0); return res; }
function endOfDay(d: Date) { const res = new Date(d); res.setHours(23,59,59,999); return res; }
function subDays(d: Date, days: number) { const res = new Date(d); res.setDate(res.getDate() - days); return res; }

// GET — list all campaigns (with optional ?alerts=true to fetch alerts instead)
export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const { searchParams } = new URL(request.url)

        // If ?alerts=true, fetch recent alerts for Meta Ads
        if (searchParams.get('alerts') === 'true') {
            const { data, error } = await supabase
                .from('ai_campaign_alerts')
                .select('*, ad_campaigns!inner(name, platform)')
                .eq('ad_campaigns.platform', 'meta')
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) throw error

            const formatted = (data || []).map((a: any) => ({
                ...a,
                campaign_name: a.ad_campaigns?.name || 'N/A',
                ad_campaigns: undefined,
            }))
            return NextResponse.json(formatted)
        }

        // Default: list campaigns with metrics
        const datePreset = (searchParams.get('date_preset') || 'maximum') as metaAds.DatePreset
        const startDate = searchParams.get('start_date')
        const endDate = searchParams.get('end_date')

        const { data: campaigns, error } = await supabase
            .from('ad_campaigns')
            .select('*, properties(title)')
            .eq('platform', 'meta')
            .order('created_at', { ascending: false })

        if (error) throw error

        // Try to fetch live insights from both Meta and Google grouped by campaign
        let metaInsightsMap: Record<string, any> = {}
        let googleInsightsMap: Record<string, any> = {}
        
        try {
            const metaParams: any[] = [datePreset];
            const googleParams: any[] = [datePreset as any];
            
            if ((datePreset as string) === 'custom' && startDate && endDate) {
                metaParams[1] = { since: startDate, until: endDate };
                googleParams[1] = { startDate, endDate };
            }

            const [metaRes, googleRes] = await Promise.allSettled([
                metaAds.getAccountInsightsByCampaign(metaParams[0], metaParams[1]),
                googleAds.getAllCampaignsWithMetrics(googleParams[0], googleParams[1])
            ])
            if (metaRes.status === 'fulfilled') metaInsightsMap = metaRes.value
            if (googleRes.status === 'fulfilled') googleInsightsMap = googleRes.value
        } catch (err) {
            console.error('Erro ao buscar insights ao vivo:', err)
        }

        // Enrich campaigns with metrics
        const enriched = (campaigns || []).map((camp: any) => {
            if (camp.platform === 'meta') {
                const liveInsights = camp.external_campaign_id ? metaInsightsMap[camp.external_campaign_id] : null
                if (liveInsights) {
                    const parsed = metaAds.parseInsightsToSnapshot(camp.id, liveInsights)
                    return { ...camp, latest_metrics: parsed }
                }
            } else if (camp.platform === 'google') {
                const liveInsights = camp.external_campaign_id ? googleInsightsMap[camp.external_campaign_id] : null
                if (liveInsights) {
                    return { ...camp, latest_metrics: liveInsights.metrics }
                }
            }

            // No live data for this period
            return { ...camp, latest_metrics: null }
        })

        // Fetch internal lead counts and recent leads
        const spNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
        let sinceInternal: string
        let untilInternal: string = spNow.toISOString()

        if (datePreset === 'today') {
            sinceInternal = startOfDay(spNow).toISOString()
        } else if (datePreset === 'yesterday') {
            const yesterday = subDays(spNow, 1)
            sinceInternal = startOfDay(yesterday).toISOString()
            untilInternal = endOfDay(yesterday).toISOString()
        } else if (datePreset === 'last_7d') {
            sinceInternal = startOfDay(subDays(spNow, 7)).toISOString()
        } else if (datePreset === 'last_30d') {
            sinceInternal = startOfDay(subDays(spNow, 30)).toISOString()
        } else if ((datePreset as string) === 'custom' && startDate && endDate) {
            sinceInternal = new Date(startDate).toISOString()
            untilInternal = new Date(endDate).toISOString()
        } else {
            sinceInternal = startOfDay(subDays(spNow, 90)).toISOString() // Fallback to 90d for 'maximum'
        }

        const metaSources = ['Facebook Ads', 'Instagram', 'Facebook']
        const [internalLeadsRes, recentLeadsRes] = await Promise.all([
            supabase.from('leads').select('*', { count: 'exact', head: true })
                .in('detected_source', metaSources)
                .gte('created_at', sinceInternal)
                .lte('created_at', untilInternal),
            supabase.from('leads').select('name, phone, created_at, funnel_stage')
                .in('detected_source', metaSources)
                .order('created_at', { ascending: false })
                .limit(10)
        ])

        return NextResponse.json({
            campaigns: enriched,
            internalStats: {
                totalLeads: internalLeadsRes.count || 0,
                recentLeads: recentLeadsRes.data || []
            }
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST — create a new campaign (draft)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const supabase = createAdminClient()

        const { creatives, ...campaignData } = body

        // Calculate daily budget
        if (campaignData.total_budget && campaignData.duration_days) {
            campaignData.daily_budget = Number(campaignData.total_budget) / Number(campaignData.duration_days)
        }

        // Insert campaign
        const { data: campaign, error } = await supabase
            .from('ad_campaigns')
            .insert({
                ...campaignData,
                status: 'draft',
            })
            .select()
            .single()

        if (error) throw error

        // Insert creatives if provided
        if (creatives && Array.isArray(creatives) && creatives.length > 0) {
            const creativesToInsert = creatives.map((c: any) => ({
                campaign_id: campaign.id,
                type: c.type || 'image',
                file_url: c.file_url,
                headline: c.headline || null,
                description: c.description || null,
                status: 'pending',
            }))

            const { error: cErr } = await supabase.from('ad_creatives').insert(creativesToInsert)
            if (cErr) console.error('Error inserting creatives:', cErr)
        }

        return NextResponse.json(campaign, { status: 201 })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// PUT — update a campaign
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, ...updateData } = body
        if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('ad_campaigns')
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// DELETE — delete a campaign
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

        const supabase = createAdminClient()
        const { error } = await supabase
            .from('ad_campaigns')
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
