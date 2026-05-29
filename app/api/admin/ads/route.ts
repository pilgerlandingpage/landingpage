import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import * as metaAds from '@/lib/ads/meta'
import * as googleAds from '@/lib/ads/google'
import { sendMetaPaymentIssueAlert } from '@/lib/ads/whatsapp-alerts'

function startOfDay(d: Date) { const res = new Date(d); res.setHours(0,0,0,0); return res; }
function endOfDay(d: Date) { const res = new Date(d); res.setHours(23,59,59,999); return res; }
function subDays(d: Date, days: number) { const res = new Date(d); res.setDate(res.getDate() - days); return res; }

function firstRelation<T>(value: T | T[] | null | undefined) {
    return Array.isArray(value) ? value[0] || null : value || null
}

function isMetaLead(row: any) {
    const visitor = firstRelation(row?.visitors)
    const sourceText = [
        row?.acquired_via,
        visitor?.detected_source,
        visitor?.utm_source,
        visitor?.utm_medium,
        visitor?.utm_campaign,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

    return sourceText.includes('facebook')
        || sourceText.includes('instagram')
        || sourceText.includes('meta')
        || sourceText.includes('fbclid')
}

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
        let campaignRows = campaigns || []

        // Try to fetch live insights from both Meta and Google grouped by campaign
        let metaInsightsMap: Record<string, any> = {}
        let googleInsightsMap: Record<string, any> = {}
        let accountHealth: Awaited<ReturnType<typeof metaAds.getAdAccountHealth>> | null = null
        
        try {
            const metaParams: any[] = [datePreset];
            const googleParams: any[] = [datePreset as any];
            
            if ((datePreset as string) === 'custom' && startDate && endDate) {
                metaParams[1] = { since: startDate, until: endDate };
                googleParams[1] = { startDate, endDate };
            }

            const [metaRes, googleRes, accountHealthRes] = await Promise.allSettled([
                metaAds.getAccountInsightsByCampaign(metaParams[0], metaParams[1]),
                googleAds.getAllCampaignsWithMetrics(googleParams[0], googleParams[1]),
                metaAds.getAdAccountHealth(),
            ])
            if (metaRes.status === 'fulfilled') metaInsightsMap = metaRes.value
            if (googleRes.status === 'fulfilled') googleInsightsMap = googleRes.value
            if (accountHealthRes.status === 'fulfilled') accountHealth = accountHealthRes.value
        } catch (err) {
            console.error('Erro ao buscar insights ao vivo:', err)
        }

        const existingExternalIds = new Set(campaignRows.map((camp: any) => String(camp.external_campaign_id || '')).filter(Boolean))
        const missingLiveCampaigns = Object.values(metaInsightsMap)
            .filter((row: any) => row?.campaign_id && Number.parseFloat(String(row?.spend || '0')) > 0)
            .filter((row: any) => !existingExternalIds.has(String(row.campaign_id)))

        if (missingLiveCampaigns.length > 0) {
            const inserts = missingLiveCampaigns.map((row: any) => ({
                name: row.campaign_name || `Meta Ads ${row.campaign_id}`,
                platform: 'meta',
                status: 'active',
                total_budget: 0,
                duration_days: 30,
                external_campaign_id: String(row.campaign_id),
                ai_auto_manage: false,
                start_date: new Date().toISOString().split('T')[0],
            }))

            const { data: insertedCampaigns, error: insertMissingError } = await supabase
                .from('ad_campaigns')
                .insert(inserts)
                .select('*')

            if (insertMissingError) {
                console.error('Erro ao importar campanhas Meta com gasto ao vivo:', insertMissingError)
            } else {
                campaignRows = [...(insertedCampaigns || []), ...campaignRows]
            }
        }

        // Enrich campaigns with metrics
        const enriched = campaignRows.map((camp: any) => {
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

        let liveAccountStats: Awaited<ReturnType<typeof metaAds.getTodayAccountSpendEstimate>> | null = null
        if (datePreset === 'today') {
            try {
                const currentInsightsSpend = Object.values(metaInsightsMap).reduce((sum: number, row: any) => {
                    const spend = Number.parseFloat(String(row?.spend || '0'))
                    return sum + (Number.isFinite(spend) ? spend : 0)
                }, 0)
                liveAccountStats = await metaAds.getTodayAccountSpendEstimate(currentInsightsSpend)
            } catch (err) {
                console.error('Erro ao buscar gasto diario ao vivo Meta:', err)
            }
        }

        if (accountHealth?.is_payment_issue) {
            try {
                await sendMetaPaymentIssueAlert(supabase, accountHealth, request.nextUrl.origin)
            } catch (alertError) {
                console.error('Erro ao avisar envolvidos sobre pendencia de pagamento Meta:', alertError)
            }
        }

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

        const { data: leadRows, error: leadRowsError } = await supabase
            .from('leads')
            .select('name, phone, created_at, funnel_stage, acquired_via, visitors(detected_source, utm_source, utm_medium, utm_campaign)')
            .gte('created_at', sinceInternal)
            .lte('created_at', untilInternal)
            .order('created_at', { ascending: false })
            .limit(500)

        if (leadRowsError) {
            console.error('Erro ao buscar leads internos Meta:', leadRowsError)
        }

        const metaLeads = ((leadRows || []) as any[]).filter(isMetaLead)

        return NextResponse.json({
            campaigns: enriched,
            liveAccountStats,
            accountHealth,
            internalStats: {
                totalLeads: metaLeads.length,
                recentLeads: metaLeads.slice(0, 10)
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
