
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
    try {
        // Parallelize queries for performance
        const [
            { count: visitorsCount },
            { count: leadsCount },
            { count: vipCount },
            { count: whatsappCount },
            { data: chatData },
            { data: sourceRaw },
            { data: dailyVisitors },
            { data: dailyLeads },
            { count: pushCount },
            { data: recentVisitorsRaw },
            { count: cookieConsentCount }
        ] = await Promise.all([
            // 1. Total Visitors
            supabase.from('visitors').select('*', { count: 'exact', head: true }),

            // 2. Total Leads
            supabase.from('leads').select('*', { count: 'exact', head: true }),

            // 3. VIP Leads
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('is_vip', true),

            // 4. WhatsApp Sent
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('whatsapp_sent', true),

            // 5. Chat Sessions (fetch visitor_ids to count unique)
            supabase.from('chat_history').select('visitor_id'),

            // 6. Source Distribution
            supabase.from('visitors').select('detected_source'),

            // 7. Last 7 Days Visitors
            supabase.from('visitors')
                .select('first_visit_at')
                .gte('first_visit_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

            // 8. Last 7 Days Leads
            supabase.from('leads')
                .select('created_at')
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

            // 9. Push Subscribers
            supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('active', true),

            // 10. Recent Visitors
            supabase.from('visitors').select('*').order('last_visit_at', { ascending: false }).limit(6),

            // 11. Cookie Consent
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'cookie_consent')
        ])

        // Process Chat Sessions
        const uniqueChatSessions = new Set(chatData?.map(c => c.visitor_id)).size

        // Process Source Distribution
        const sourceCounts: Record<string, number> = {}
        sourceRaw?.forEach(v => {
            const source = v.detected_source || 'Direct'
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
            const leads = dailyLeads?.filter(l => l.created_at?.startsWith(dateStr)).length || 0

            dailyData.push({
                date: dayLabel,
                visitors,
                leads
            })
        }

        // ... (keep existing processing)

        // Process Recent Visitors
        const recentVisitorIds = recentVisitorsRaw?.map(v => v.id) || []
        const { data: recentLeads } = await supabase
            .from('leads')
            .select('visitor_id, funnel_stage, push_subscribed')
            .in('visitor_id', recentVisitorIds)

        const recentVisitors = recentVisitorsRaw?.map(visitor => {
            const lead = recentLeads?.find(l => l.visitor_id === visitor.id)
            return {
                ...visitor,
                is_lead: !!lead,
                funnel_stage: lead?.funnel_stage || 'visitor',
                push_subscribed: lead?.push_subscribed || false
            }
        }) || []

        const stats = {
            totalVisitors: visitorsCount || 0,
            totalLeads: leadsCount || 0,
            conversionRate: visitorsCount ? parseFloat(((leadsCount! / visitorsCount!) * 100).toFixed(1)) : 0,
            vipLeads: vipCount || 0,
            chatSessions: uniqueChatSessions,
            whatsappSent: whatsappCount || 0,
            pushSubscribers: pushCount || 0,
            cookieConsent: cookieConsentCount || 0,
        }

        return NextResponse.json({
            stats,
            sourceData: sourceChartData,
            dailyData,
            recentVisitors
        })

    } catch (error) {
        console.error('Analytics API Error:', error)
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }
}
