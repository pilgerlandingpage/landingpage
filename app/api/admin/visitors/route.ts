import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { phoneCandidates } from '@/lib/whatsapp/lead-sync'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function isMissingBrokerProfilesTable(error: any) {
    return /broker_lead_profiles|schema cache|relation .* does not exist|could not find the table/i.test(String(error?.message || error || ''))
}

function buildPhoneOrFilter(candidates: string[]): string {
    const safe = candidates
        .map(candidate => candidate.replace(/[^0-9]/g, ''))
        .filter(Boolean)
    return `phone.in.(${safe.join(',')}),phone_e164.in.(${safe.join(',')})`
}

async function resolveBrokerVisitorIds(supabase: ReturnType<typeof getSupabase>, brokerId: string) {
    const leadIds = new Set<string>()
    const phones = new Set<string>()

    const profiles = await supabase
        .from('broker_lead_profiles')
        .select('lead_id, lead_phone')
        .eq('broker_id', brokerId)

    if (!profiles.error) {
        for (const profile of profiles.data || []) {
            if (profile.lead_id) leadIds.add(profile.lead_id)
            for (const phone of phoneCandidates(profile.lead_phone)) phones.add(phone)
        }
    } else if (isMissingBrokerProfilesTable(profiles.error)) {
        const conversations = await supabase
            .from('whatsapp_ai_conversations')
            .select('lead_phone')
            .eq('broker_id', brokerId)
        if (conversations.error) throw conversations.error
        for (const conversation of conversations.data || []) {
            for (const phone of phoneCandidates(conversation.lead_phone)) phones.add(phone)
        }
    } else {
        throw profiles.error
    }

    let leads: any[] = []

    if (leadIds.size > 0) {
        const { data, error } = await supabase
            .from('leads')
            .select('id, visitor_id, phone, phone_e164, funnel_stage, push_subscribed')
            .in('id', [...leadIds])
        if (error) throw error
        leads = [...leads, ...(data || [])]
    }

    if (phones.size > 0) {
        const { data, error } = await supabase
            .from('leads')
            .select('id, visitor_id, phone, phone_e164, funnel_stage, push_subscribed')
            .or(buildPhoneOrFilter([...phones]))
        if (error) throw error
        leads = [...leads, ...(data || [])]
    }

    const uniqueLeads = new Map<string, any>()
    for (const lead of leads) uniqueLeads.set(lead.id, lead)

    return {
        visitorIds: [...new Set([...uniqueLeads.values()].map((lead: any) => lead.visitor_id).filter(Boolean))],
        leads: [...uniqueLeads.values()],
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const brokerId = String(request.nextUrl.searchParams.get('broker_id') || '').trim()
        const brokerScope = brokerId ? await resolveBrokerVisitorIds(supabase, brokerId) : null

        if (brokerScope && brokerScope.visitorIds.length === 0) {
            return NextResponse.json([])
        }

        let visitorsQuery = supabase
            .from('visitors')
            .select('*')
            .order('last_visit_at', { ascending: false })
            .limit(100)

        if (brokerScope) {
            visitorsQuery = visitorsQuery.in('id', brokerScope.visitorIds)
        }

        const { data: visitors, error } = await visitorsQuery
        if (error) throw error

        if (!visitors || visitors.length === 0) {
            return NextResponse.json([])
        }

        const visitorUUIDs = visitors.map(v => v.id)

        const [leadsResponse, scrollResponse] = await Promise.all([
            brokerScope
                ? Promise.resolve({ data: brokerScope.leads, error: null })
                : supabase
                    .from('leads')
                    .select('visitor_id, funnel_stage, push_subscribed')
                    .in('visitor_id', visitorUUIDs),
            supabase
                .from('funnel_events')
                .select('visitor_id, event_type, metadata')
                .in('visitor_id', visitorUUIDs)
                .eq('event_type', 'scroll_depth')
        ])

        if (leadsResponse.error) throw leadsResponse.error
        if (scrollResponse.error) throw scrollResponse.error

        const leads = leadsResponse.data || []
        const scrollEvents = scrollResponse.data || []

        const enhancedVisitors = visitors.map(visitor => {
            const lead = leads?.find((l: any) => l.visitor_id === visitor.id)
            const visitorScrolls = scrollEvents?.filter((e: any) => e.visitor_id === visitor.id) || []
            const maxScroll = visitorScrolls.reduce((max: number, curr: any) => {
                const val = curr?.metadata?.percentage || 0
                return val > max ? val : max
            }, 0)

            return {
                ...visitor,
                is_lead: !!lead,
                funnel_stage: lead?.funnel_stage || 'visitor',
                push_subscribed: lead?.push_subscribed || false,
                max_scroll: maxScroll
            }
        })

        return NextResponse.json(enhancedVisitors)
    } catch (error) {
        console.error('Visitor API Error:', error)
        return NextResponse.json({ error: 'Failed to fetch visitors' }, { status: 500 })
    }
}
