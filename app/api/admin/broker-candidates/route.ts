import { NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const [candidatesRes, rulesRes, messagesRes, logsRes] = await Promise.all([
            ctx.admin
                .from('broker_candidates')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(300),
            ctx.admin
                .from('broker_candidate_automation_rules')
                .select('*')
                .order('created_at', { ascending: true }),
            ctx.admin
                .from('broker_candidate_message_queue')
                .select('*, candidate:broker_candidates(id, full_name, phone, potential_score, potential_level, status)')
                .order('scheduled_for', { ascending: false })
                .limit(160),
            ctx.admin
                .from('broker_candidate_agent_logs')
                .select('*, candidate:broker_candidates(id, full_name)')
                .order('created_at', { ascending: false })
                .limit(160),
        ])

        if (candidatesRes.error) throw candidatesRes.error
        if (rulesRes.error) throw rulesRes.error
        if (messagesRes.error) throw messagesRes.error
        if (logsRes.error) throw logsRes.error

        const candidates = candidatesRes.data || []
        const visitorIds = candidates.map((candidate: any) => candidate.visitor_id).filter(Boolean)
        let events: any[] = []
        if (visitorIds.length > 0) {
            const { data, error } = await ctx.admin
                .from('funnel_events')
                .select('id, visitor_id, event_type, metadata, created_at')
                .in('visitor_id', visitorIds)
                .order('created_at', { ascending: false })
                .limit(600)
            if (error) throw error
            events = data || []
        }

        return NextResponse.json({
            candidates,
            rules: rulesRes.data || [],
            messages: messagesRes.data || [],
            logs: logsRes.data || [],
            events,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao carregar candidatos.' }, { status: 500 })
    }
}
