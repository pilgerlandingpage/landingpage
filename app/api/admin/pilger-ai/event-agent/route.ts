import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import { buildEventAgentReport, generateEventAgentAiSummary } from '@/lib/events/agent-report'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const eventId = request.nextUrl.searchParams.get('event_id')
        const report = await buildEventAgentReport(ctx.admin, { eventId })
        return NextResponse.json({ success: true, report })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Erro ao carregar relatorio do Agente de Eventos.' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const body = await request.json().catch(() => ({}))
        const eventId = body?.event_id ? String(body.event_id) : request.nextUrl.searchParams.get('event_id')
        const report = await buildEventAgentReport(ctx.admin, { eventId })
        const aiSummary = await generateEventAgentAiSummary(ctx.admin, report)

        await ctx.admin.from('event_agent_logs').insert({
            event_id: report.event.id,
            action: 'event_agent_ai_report_generated',
            message: 'Relatorio de potencial gerado pelo Agente de Eventos.',
            metadata: {
                hot: report.totals.hot,
                warm: report.totals.warm,
                cold: report.totals.cold,
                top_leads: report.top_leads.slice(0, 5).map(lead => ({
                    id: lead.id,
                    name: lead.name,
                    score: lead.score,
                    level: lead.level,
                })),
            },
        })

        return NextResponse.json({
            success: true,
            report: {
                ...report,
                ai_summary: aiSummary,
            },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Erro ao gerar relatorio IA do Agente de Eventos.' }, { status: 500 })
    }
}
