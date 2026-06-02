import { NextRequest, NextResponse } from 'next/server'
import {
    getAgentEcosystemContext,
    getLatestEcosystemSnapshots,
    runEcosystemSnapshotCycle,
    saveEcosystemSnapshot,
    type EcosystemAgent,
} from '@/lib/intelligence/ecosystem'
import { createAdminClient } from '@/lib/supabase/server'

function normalizeAgent(value: string | null): EcosystemAgent {
    const allowed = new Set(['global', 'blog', 'news', 'whatsapp', 'radar', 'traffic', 'ceo', 'recruiting', 'events', 'social', 'distribution', 'publisher', 'property', 'research', 'benchmark', 'creative'])
    return allowed.has(String(value || '')) ? value as EcosystemAgent : 'global'
}

function intelligenceError(error: any) {
    const message = String(error?.message || error || 'Erro na Central de Inteligencia.')
    if (message.includes('ecosystem_context_snapshots')) {
        return NextResponse.json({
            code: 'ecosystem_table_missing',
            error: 'Tabela ecosystem_context_snapshots nao encontrada. Aplique a migration supabase/migrations/20260516153000_ecosystem_intelligence.sql no Supabase.',
        }, { status: 500 })
    }
    return NextResponse.json({ code: 'ecosystem_error', error: message }, { status: 500 })
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const agent = normalizeAgent(request.nextUrl.searchParams.get('agent'))
        const days = Number.parseInt(request.nextUrl.searchParams.get('days') || '30', 10)
        const limit = Number.parseInt(request.nextUrl.searchParams.get('limit') || '100', 10)
        const context = await getAgentEcosystemContext({
            supabase,
            agent,
            days: Number.isFinite(days) ? days : 30,
            limit: Number.isFinite(limit) ? limit : 100,
        })
        const snapshots = await getLatestEcosystemSnapshots({ supabase, limit: 12 })

        return NextResponse.json({ context, snapshots })
    } catch (error: any) {
        return intelligenceError(error)
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const supabase = createAdminClient()

        if (body?.action === 'run_cycle') {
            const result = await runEcosystemSnapshotCycle({
                supabase,
                days: Number.parseInt(String(body?.days || '30'), 10) || 30,
                createdBy: 'admin-intelligence',
            })
            return NextResponse.json({ result }, { status: 201 })
        }

        const agent = normalizeAgent(body?.agent || 'global')
        const context = await getAgentEcosystemContext({
            supabase,
            agent,
            days: Number.parseInt(String(body?.days || '30'), 10) || 30,
            limit: Number.parseInt(String(body?.limit || '100'), 10) || 100,
        })
        const saved = await saveEcosystemSnapshot({
            supabase,
            context,
            agent,
            scope: 'global',
            createdBy: 'admin-intelligence',
        })

        return NextResponse.json({ context, saved }, { status: 201 })
    } catch (error: any) {
        return intelligenceError(error)
    }
}
