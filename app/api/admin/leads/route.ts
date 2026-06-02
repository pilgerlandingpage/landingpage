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

function conversationKey(brokerId: string | null | undefined, phone: string | null | undefined) {
    const normalizedPhone = phoneCandidates(phone).find(Boolean)
    return brokerId && normalizedPhone ? `${brokerId}:${normalizedPhone}` : ''
}

function uniqueProfiles(profiles: any[]) {
    const seen = new Set<string>()
    const unique: any[] = []
    for (const profile of profiles || []) {
        const key = profile?.broker_id || profile?.id || `${profile?.lead_phone}:${profile?.updated_at}`
        if (!key || seen.has(key)) continue
        seen.add(key)
        unique.push(profile)
    }
    return unique
}

const LEAD_SELECT = `
    *,
    lead_purpose,
    lead_budget,
    lead_timeframe,
    is_partner,
    push_subscribed_lead,
    landing_page:landing_pages (
        title
    ),
    visitor:visitors (
        detected_source,
        browser,
        device_type,
        ip_address,
        os,
        country,
        city,
        region
    )
`

async function getBrokerLeadScope(supabase: ReturnType<typeof getSupabase>, brokerId: string) {
    const leadIds = new Set<string>()
    const phones = new Set<string>()
    const profileByPhone = new Map<string, any[]>()

    const profiles = await supabase
        .from('broker_lead_profiles')
        .select('id, lead_id, lead_phone, broker_id, instance_id, conversation_id, status, qualification_score, lead_classification, updated_at')
        .eq('broker_id', brokerId)

    if (!profiles.error) {
        for (const profile of profiles.data || []) {
            if (profile.lead_id) leadIds.add(profile.lead_id)
            for (const phone of phoneCandidates(profile.lead_phone)) {
                phones.add(phone)
                const list = profileByPhone.get(phone) || []
                list.push(profile)
                profileByPhone.set(phone, list)
            }
        }
        return { leadIds: [...leadIds], phones: [...phones], profileByPhone }
    }

    if (!isMissingBrokerProfilesTable(profiles.error)) throw profiles.error

    const conversations = await supabase
        .from('whatsapp_ai_conversations')
        .select('id, lead_phone, broker_id, instance_id, status, updated_at')
        .eq('broker_id', brokerId)

    if (conversations.error) throw conversations.error

    for (const conversation of conversations.data || []) {
        for (const phone of phoneCandidates(conversation.lead_phone)) {
            phones.add(phone)
            const list = profileByPhone.get(phone) || []
            list.push({
                id: conversation.id,
                lead_phone: conversation.lead_phone,
                broker_id: conversation.broker_id,
                instance_id: conversation.instance_id,
                conversation_id: conversation.id,
                status: conversation.status,
                updated_at: conversation.updated_at,
            })
            profileByPhone.set(phone, list)
        }
    }

    return { leadIds: [...leadIds], phones: [...phones], profileByPhone }
}

async function fetchLeadsByScope(
    supabase: ReturnType<typeof getSupabase>,
    scope: { leadIds: string[]; phones: string[] } | null
) {
    if (!scope) {
        const { data, error } = await supabase
            .from('leads')
            .select(LEAD_SELECT)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data || []
    }

    if (scope.leadIds.length === 0 && scope.phones.length === 0) return []

    const byId = new Map<string, any>()

    if (scope.leadIds.length > 0) {
        const { data, error } = await supabase
            .from('leads')
            .select(LEAD_SELECT)
            .in('id', scope.leadIds)

        if (error) throw error
        for (const lead of data || []) byId.set(lead.id, lead)
    }

    if (scope.phones.length > 0) {
        const { data, error } = await supabase
            .from('leads')
            .select(LEAD_SELECT)
            .or(buildPhoneOrFilter(scope.phones))

        if (error) throw error
        for (const lead of data || []) byId.set(lead.id, lead)
    }

    return [...byId.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

async function fetchProfilesForLeads(
    supabase: ReturnType<typeof getSupabase>,
    leads: any[],
    brokerId?: string
) {
    const candidates = Array.from(new Set(
        leads.flatMap((lead: any) => phoneCandidates(lead.phone_e164 || lead.phone))
    ))
    const profileByPhone = new Map<string, any[]>()
    if (candidates.length === 0) return profileByPhone

    let query = supabase
        .from('broker_lead_profiles')
        .select('id, lead_id, lead_phone, broker_id, instance_id, conversation_id, status, qualification_score, lead_classification, updated_at')
        .in('lead_phone', candidates)

    if (brokerId) query = query.eq('broker_id', brokerId)

    const { data, error } = await query
    if (error) {
        if (!isMissingBrokerProfilesTable(error)) console.warn('[Leads API] profile enrichment failed:', error.message)
        return profileByPhone
    }

    for (const profile of data || []) {
        for (const phone of phoneCandidates(profile.lead_phone)) {
            const list = profileByPhone.get(phone) || []
            list.push(profile)
            profileByPhone.set(phone, list)
        }
    }

    return profileByPhone
}

async function fetchConversationsForProfiles(supabase: ReturnType<typeof getSupabase>, profiles: any[]) {
    const byId = new Map<string, any>()
    const byBrokerPhone = new Map<string, any>()
    const conversationIds = Array.from(new Set(
        profiles.map((profile: any) => String(profile?.conversation_id || '').trim()).filter(Boolean)
    ))
    const brokerIds = Array.from(new Set(profiles.map((profile: any) => profile?.broker_id).filter(Boolean)))
    const phones = Array.from(new Set(profiles.flatMap((profile: any) => phoneCandidates(profile?.lead_phone))))

    if (conversationIds.length > 0) {
        const { data, error } = await supabase
            .from('whatsapp_ai_conversations')
            .select('id, broker_id, instance_id, lead_phone, messages, status, summary, created_at, updated_at')
            .in('id', conversationIds)

        if (error) {
            console.warn('[Leads API] conversation enrichment by id failed:', error.message)
        } else {
            for (const conversation of data || []) {
                byId.set(conversation.id, conversation)
                const key = conversationKey(conversation.broker_id, conversation.lead_phone)
                if (key) byBrokerPhone.set(key, conversation)
            }
        }
    }

    if (brokerIds.length > 0 && phones.length > 0) {
        const { data, error } = await supabase
            .from('whatsapp_ai_conversations')
            .select('id, broker_id, instance_id, lead_phone, messages, status, summary, created_at, updated_at')
            .in('broker_id', brokerIds)
            .in('lead_phone', phones)
            .order('updated_at', { ascending: false })

        if (error) {
            console.warn('[Leads API] conversation enrichment by phone failed:', error.message)
        } else {
            for (const conversation of data || []) {
                byId.set(conversation.id, conversation)
                const key = conversationKey(conversation.broker_id, conversation.lead_phone)
                if (key && !byBrokerPhone.has(key)) byBrokerPhone.set(key, conversation)
            }
        }
    }

    return { byId, byBrokerPhone }
}

async function fetchBrokerMapForProfiles(supabase: ReturnType<typeof getSupabase>, profiles: any[]) {
    const brokerIds = Array.from(new Set(profiles.map((profile: any) => profile?.broker_id).filter(Boolean)))
    const brokerMap = new Map<string, any>()
    if (brokerIds.length === 0) return brokerMap

    const { data, error } = await supabase
        .from('virtual_brokers')
        .select('id, name, is_active')
        .in('id', brokerIds)

    if (error) {
        console.warn('[Leads API] broker profile names failed:', error.message)
        return brokerMap
    }

    for (const broker of data || []) brokerMap.set(broker.id, broker)
    return brokerMap
}

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const brokerId = String(request.nextUrl.searchParams.get('broker_id') || '').trim()
        const scope = brokerId ? await getBrokerLeadScope(supabase, brokerId) : null
        const leads = await fetchLeadsByScope(supabase, scope)
        const profileByPhone = scope?.profileByPhone || await fetchProfilesForLeads(supabase, leads)

        const leadProfiles = leads.map((lead: any) => phoneCandidates(lead.phone_e164 || lead.phone)
            .flatMap(candidate => profileByPhone.get(candidate) || [])
        )
        const allProfiles = leadProfiles.flat()
        const [conversations, brokerMap] = await Promise.all([
            fetchConversationsForProfiles(supabase, allProfiles),
            fetchBrokerMapForProfiles(supabase, allProfiles),
        ])

        const enriched = leads.map((lead: any, index: number) => {
            const profiles = uniqueProfiles(leadProfiles[index] || [])
                .map((profile: any) => {
                    const broker = profile?.broker_id ? brokerMap.get(profile.broker_id) : null
                    return {
                        ...profile,
                        broker_name: broker?.name || null,
                        broker_is_active: broker?.is_active ?? null,
                    }
                })
            const activeProfile = brokerId
                ? profiles.find((profile: any) => profile.broker_id === brokerId) || null
                : profiles[0] || null
            const activeConversation = activeProfile?.conversation_id
                ? conversations.byId.get(activeProfile.conversation_id)
                : conversations.byBrokerPhone.get(conversationKey(activeProfile?.broker_id, activeProfile?.lead_phone))

            return {
                ...lead,
                broker_profiles: profiles,
                active_broker_profile: activeProfile,
                active_broker_id: activeProfile?.broker_id || null,
                active_broker_conversation: activeConversation || null,
                broker_conversation_log: Array.isArray(activeConversation?.messages) ? activeConversation.messages : [],
            }
        })

        return NextResponse.json(enriched)
    } catch (error) {
        console.error('Error fetching leads:', error)
        return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
    }
}
