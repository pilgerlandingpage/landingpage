
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, any>
        : {}
}

function summarizeGpsLocation(leads: any[] = []) {
    const summary = {
        granted: 0,
        denied: 0,
        unavailable: 0,
        dismissed: 0,
        requested: 0,
        acceptanceRate: 0,
    }

    for (const lead of leads) {
        const metadata = asRecord(lead?.metadata)
        const preciseLocation = asRecord(metadata.precise_location || metadata.gps_location)
        const permission = asRecord(metadata.gps_permission)
        const latitude = Number(preciseLocation.latitude)
        const longitude = Number(preciseLocation.longitude)
        const hasPreciseLocation = Number.isFinite(latitude) && Number.isFinite(longitude)
        const status = String(permission.status || (hasPreciseLocation ? 'granted' : '')).toLowerCase()

        if (hasPreciseLocation || status === 'granted') summary.granted += 1
        else if (status === 'denied') summary.denied += 1
        else if (status === 'unavailable') summary.unavailable += 1
        else if (status === 'dismissed') summary.dismissed += 1
    }

    summary.requested = summary.granted + summary.denied + summary.unavailable + summary.dismissed
    summary.acceptanceRate = summary.requested > 0
        ? parseFloat(((summary.granted / summary.requested) * 100).toFixed(1))
        : 0

    return summary
}

export async function GET() {
    try {
        // Parallelize queries for performance
        const [
            { count: visitorsCount },
            { count: leadsCount },
            { count: partialLeadsCount },
            { count: vipCount },
            { count: whatsappCount },
            { count: formSubmittedCount },
            { count: whatsappStartedCount },
            { data: sourceRaw },
            { data: dailyVisitors },
            { data: dailyLeads },
            { count: pushCount },
            { data: recentVisitorsRaw },
            { count: cookieConsentCount },
            { count: investCount },
            { count: housingCount },
            { data: topPagesRaw },
            { data: lpTitlesRaw },
            { data: leadGpsRaw }
        ] = await Promise.all([
            // 1. Total Visitors
            supabase.from('visitors').select('*', { count: 'exact', head: true }),

            // 2. Complete Leads (Nome + Telefone)
            supabase.from('leads').select('*', { count: 'exact', head: true }).not('phone', 'is', null),

            // 2b. Partial Leads (Iniciou o chat, mas não deixou contato)
            supabase.from('leads').select('*', { count: 'exact', head: true }).is('phone', null),

            // 3. VIP Leads
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('is_vip', true),

            // 4. WhatsApp Enviados
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('whatsapp_sent', true),

            // 4b. Formulário enviado
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'form_submitted'),

            // 4c. Conversa WhatsApp iniciada
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'whatsapp_conversation_started'),

            // 6. Source Distribution
            supabase.from('visitors').select('detected_source'),

            // 7. Last 7 Days Visitors
            supabase.from('visitors')
                .select('first_visit_at')
                .gte('first_visit_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

            // 8. Last 7 Days Leads
            supabase.from('leads')
                .select('created_at, phone')
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

            // 9. Push Subscribers
            supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('active', true),

            // 10. Recent Visitors
            supabase.from('visitors').select('*').order('last_visit_at', { ascending: false }).limit(6),

            // 11. Cookie Consent
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'cookie_consent'),

            // 12. Investors
            supabase.from('leads').select('*', { count: 'exact', head: true }).ilike('lead_purpose', '%investimento%'),

            // 13. Housing
            supabase.from('leads').select('*', { count: 'exact', head: true }).ilike('lead_purpose', '%moradia%'),

            // 14. Top Pages
            supabase.from('visitors').select('landing_page_id'),

            // 15. Titles
            supabase.from('landing_pages').select('id, title, slug'),

            // 16. GPS consent and precise location saved in the lead file
            supabase.from('leads').select('id, metadata')
        ])



        // Process Source Distribution
        const sourceCounts: Record<string, number> = {}
        sourceRaw?.forEach(v => {
            const source = v.detected_source || 'Direto'
            sourceCounts[source] = (sourceCounts[source] || 0) + 1
        })
        const sourceChartData = Object.entries(sourceCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)

        // Process Daily Data (Last 7 Days)
        const dailyData = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const dateStr = d.toISOString().split('T')[0]
            const dayLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

            const visitors = dailyVisitors?.filter(v => v.first_visit_at?.startsWith(dateStr)).length || 0
            const leads = dailyLeads?.filter(l => l.created_at?.startsWith(dateStr) && l.phone != null).length || 0

            dailyData.push({
                date: dayLabel,
                visitors,
                leads
            })
        }

        // Process Top Pages Ranking
        const lpCounts: Record<string, number> = {}
        topPagesRaw?.forEach(v => {
            const id = v.landing_page_id || 'home'
            lpCounts[id] = (lpCounts[id] || 0) + 1
        })

        const topPages = Object.entries(lpCounts).map(([id, value]) => {
            const lp = lpTitlesRaw?.find(l => l.id === id)
            return {
                id,
                name: lp?.title || (id === 'home' ? 'Home / Geral' : 'Página Excluída'),
                slug: lp?.slug || '',
                value
            }
        }).sort((a, b) => b.value - a.value).slice(0, 10)

        // Process Recent Visitors
        const recentVisitorIds = recentVisitorsRaw?.map(v => v.id) || []
        const { data: recentLeads } = await supabase
            .from('leads')
            .select('visitor_id, funnel_stage, push_subscribed_lead, phone')
            .in('visitor_id', recentVisitorIds)

        const recentVisitors = recentVisitorsRaw?.map(visitor => {
            const lead = recentLeads?.find(l => l.visitor_id === visitor.id)
            return {
                ...visitor,
                is_lead: !!lead,
                is_complete_lead: lead?.phone != null,
                funnel_stage: lead?.funnel_stage || 'visitor',
                push_subscribed: lead?.push_subscribed_lead || false
            }
        }) || []

        const gpsLocation = summarizeGpsLocation(leadGpsRaw || [])

        const stats = {
            totalVisitors: visitorsCount || 0,
            completeLeads: leadsCount || 0,
            partialLeads: partialLeadsCount || 0,
            totalLeads: (leadsCount || 0) + (partialLeadsCount || 0),
            conversionRate: visitorsCount ? parseFloat(((leadsCount! / visitorsCount!) * 100).toFixed(1)) : 0,
            vipLeads: vipCount || 0,
            whatsappConversations: whatsappStartedCount || 0,
            formSubmissions: formSubmittedCount || 0,
            whatsappSent: whatsappCount || 0,
            pushSubscribers: pushCount || 0,
            cookieConsent: cookieConsentCount || 0,
            investors: investCount || 0,
            housingLeads: housingCount || 0,
            gpsLocation,
            gpsLocationGranted: gpsLocation.granted,
            gpsLocationDenied: gpsLocation.denied,
            gpsLocationUnavailable: gpsLocation.unavailable,
            gpsLocationDismissed: gpsLocation.dismissed,
            gpsLocationRequested: gpsLocation.requested,
            gpsLocationAcceptanceRate: gpsLocation.acceptanceRate,
        }

        return NextResponse.json({
            stats,
            sourceData: sourceChartData,
            dailyData,
            recentVisitors,
            topPages
        })

    } catch (error) {
        console.error('Analytics API Error:', error)
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }
}
