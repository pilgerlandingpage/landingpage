import { NextRequest, NextResponse } from 'next/server'
import { getOptionalAdminActorContext } from '@/lib/events/admin-auth'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type BriefLevel = 'high' | 'medium' | 'low'

type ExecutiveBriefPayload = {
    level: BriefLevel
    title: string
    summary: string
    risk: string
    nextAction: string
    facts: Array<{ label: string; value: string; color?: string }>
}

function asRecord(value: any): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asString(value: any): string {
    return typeof value === 'string' ? value.trim() : ''
}

function asUuidString(value: any): string {
    const text = asString(value)
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
        ? text
        : ''
}

function sanitizeLevel(value: any): BriefLevel {
    const level = String(value || '').toLowerCase()
    if (level === 'high' || level === 'medium' || level === 'low') return level
    return 'low'
}

function normalizeBrief(value: any): ExecutiveBriefPayload {
    const record = asRecord(value)
    const title = asString(record.title)
    const summary = asString(record.summary)
    const risk = asString(record.risk)
    const nextAction = asString(record.nextAction || record.next_action)

    if (!title || !summary || !risk || !nextAction) {
        throw new Error('brief fields required')
    }

    const facts = Array.isArray(record.facts)
        ? record.facts
            .map((item: any) => {
                const fact = asRecord(item)
                return {
                    label: asString(fact.label),
                    value: asString(fact.value),
                    color: asString(fact.color) || undefined,
                }
            })
            .filter(item => item.label && item.value)
        : []

    return {
        level: sanitizeLevel(record.level),
        title,
        summary,
        risk,
        nextAction,
        facts,
    }
}

function isMissingBriefTable(error: any) {
    return /lead_executive_briefs|schema cache|relation .* does not exist|could not find the table/i.test(String(error?.message || error || ''))
}

function buildMetadataSnapshot(params: {
    id: string | null
    brief: ExecutiveBriefPayload
    source: string
    signals: Record<string, any>
    actor: Awaited<ReturnType<typeof getOptionalAdminActorContext>>
    generatedAt: string
}) {
    return {
        id: params.id,
        level: params.brief.level,
        title: params.brief.title,
        summary: params.brief.summary,
        risk: params.brief.risk,
        next_action: params.brief.nextAction,
        facts: params.brief.facts,
        signals: params.signals,
        source: params.source,
        actor_type: params.actor?.actor_type || null,
        actor_id: params.actor?.actor_id || null,
        actor_name: params.actor?.actor_name || null,
        actor_email: params.actor?.actor_email || null,
        auth_user_id: params.actor?.auth_user_id || null,
        generated_at: params.generatedAt,
    }
}

async function updateLeadMetadata(params: {
    supabase: ReturnType<typeof createAdminClient>
    leadId: string
    snapshot: Record<string, any>
}) {
    const { data: lead, error: leadError } = await params.supabase
        .from('leads')
        .select('id, metadata')
        .eq('id', params.leadId)
        .maybeSingle()

    if (leadError) throw leadError
    if (!lead?.id) throw new Error('lead not found')

    const metadata = asRecord(lead.metadata)
    const history = Array.isArray(metadata.crm_executive_brief_history)
        ? metadata.crm_executive_brief_history
        : []
    const nextMetadata = {
        ...metadata,
        crm_executive_brief: params.snapshot,
        crm_executive_brief_history: [params.snapshot, ...history].slice(0, 8),
    }

    const { error } = await params.supabase
        .from('leads')
        .update({
            metadata: nextMetadata,
            updated_at: params.snapshot.generated_at,
        })
        .eq('id', params.leadId)

    if (error) throw error
}

export async function GET() {
    return NextResponse.json({
        success: true,
        usage: {
            method: 'POST',
            body: {
                lead_id: 'opcional se houver lead persistido',
                lead_phone: 'opcional para snapshots sem lead_id',
                crm_row_id: 'id da linha do CRM',
                broker_id: 'corretor associado',
                brief: 'resumo executivo calculado na UI',
                signals: 'sinais usados no calculo',
            },
        },
    })
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const actor = await getOptionalAdminActorContext()
        const body = await request.json().catch(() => ({}))
        const brief = normalizeBrief(body?.brief)
        const leadId = asString(body?.lead_id)
        const leadPhone = asString(body?.lead_phone)
        const leadName = asString(body?.lead_name)
        const crmRowId = asString(body?.crm_row_id)
        const brokerId = asUuidString(body?.broker_id)
        const source = asString(body?.source) || 'crm_manual_snapshot'
        const generatedAt = new Date().toISOString()
        const signals = asRecord(body?.signals)

        if (!leadId && !leadPhone && !crmRowId) {
            return NextResponse.json({ success: false, error: 'lead_id, lead_phone or crm_row_id required' }, { status: 400 })
        }

        let insertedId: string | null = null
        const insertPayload = {
            lead_id: leadId || null,
            lead_phone: leadPhone || null,
            lead_name: leadName || null,
            crm_row_id: crmRowId || null,
            broker_id: brokerId || null,
            level: brief.level,
            title: brief.title,
            summary: brief.summary,
            risk: brief.risk,
            next_action: brief.nextAction,
            facts: brief.facts,
            signals,
            source,
            actor_type: actor?.actor_type || null,
            actor_id: actor?.actor_id || null,
            actor_name: actor?.actor_name || null,
            actor_email: actor?.actor_email || null,
            auth_user_id: actor?.auth_user_id || null,
            generated_at: generatedAt,
        }

        const { data: inserted, error: insertError } = await supabase
            .from('lead_executive_briefs')
            .insert(insertPayload)
            .select('id')
            .maybeSingle()

        if (insertError) {
            if (!isMissingBriefTable(insertError)) throw insertError
            console.warn('[Lead Executive Briefs] table unavailable, metadata snapshot only:', insertError.message)
        } else {
            insertedId = inserted?.id || null
        }

        const snapshot = buildMetadataSnapshot({
            id: insertedId,
            brief,
            source,
            signals,
            actor,
            generatedAt,
        })

        let persistedInMetadata = false
        if (leadId) {
            await updateLeadMetadata({ supabase, leadId, snapshot })
            persistedInMetadata = true
        }

        if (!insertedId && !persistedInMetadata) {
            return NextResponse.json({
                success: false,
                error: 'no persistence target available for this executive brief',
            }, { status: 503 })
        }

        return NextResponse.json({
            success: true,
            snapshot,
            persisted_in_table: Boolean(insertedId),
            persisted_in_metadata: persistedInMetadata,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const status = /required|not found/i.test(message) ? 400 : 500
        console.error('[Lead Executive Briefs] POST error:', error)
        return NextResponse.json({ success: false, error: message }, { status })
    }
}
