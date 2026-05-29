import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createResearchReport } from '@/lib/research/pilger'
import { buildAgentContextBrief, getAgentEcosystemContext } from '@/lib/intelligence/ecosystem'

function researchErrorResponse(error: any) {
    const message = String(error?.message || error || '')

    if (message.includes('ai_research_reports')) {
        return NextResponse.json({
            code: 'research_table_missing',
            error: 'Tabela ai_research_reports nao encontrada. Aplique a migration supabase/migrations/20260510100000_research_pilger.sql no Supabase.',
        }, { status: 500 })
    }

    if (message.includes('Gemini API Key nao configurada')) {
        return NextResponse.json({
            code: 'gemini_key_missing',
            error: 'Gemini API Key nao configurada. Configure gemini_api_key no app_config ou GEMINI_API_KEY no ambiente.',
        }, { status: 500 })
    }

    if (message.includes('OpenAI API Key nao configurada')) {
        return NextResponse.json({
            code: 'openai_key_missing',
            error: 'OpenAI API Key nao configurada. Configure openai_api_key no app_config ou OPENAI_API_KEY no ambiente.',
        }, { status: 500 })
    }

    if (message.includes('Research Pilger esta desativado')) {
        return NextResponse.json({
            code: 'research_disabled',
            error: 'Research Pilger esta desativado nas configuracoes.',
        }, { status: 409 })
    }

    return NextResponse.json({
        code: 'research_error',
        error: message || 'Erro inesperado na Pesquisa Profunda IA.',
    }, { status: 500 })
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const id = request.nextUrl.searchParams.get('id')

        let query = supabase
            .from('ai_research_reports')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(80)

        if (id) query = query.eq('id', id)

        const { data, error } = await query
        if (error) {
            const response = researchErrorResponse(error)
            if (response) return response
            throw error
        }

        return NextResponse.json({ reports: data || [] })
    } catch (error: any) {
        return researchErrorResponse(error)
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const topic = String(body?.topic || '').trim()
        if (!topic) return NextResponse.json({ error: 'Tema obrigatorio.' }, { status: 400 })

        const supabase = createAdminClient()
        const ecosystemContext = await getAgentEcosystemContext({ supabase, agent: 'news', days: 30, limit: 100 })

        const report = await createResearchReport({
            topic,
            requester: body?.requester || 'manual',
            depth: body?.depth || undefined,
            context: {
                ...(body?.context && typeof body.context === 'object' ? body.context : {}),
                ecosystem_brief: buildAgentContextBrief(ecosystemContext),
                ecosystem_signals: ecosystemContext.signals,
                ecosystem_source_counts: ecosystemContext.source_counts,
            },
        })

        return NextResponse.json({ report }, { status: 201 })
    } catch (error: any) {
        return researchErrorResponse(error)
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID obrigatorio.' }, { status: 400 })

        const supabase = createAdminClient()
        const { error } = await supabase.from('ai_research_reports').delete().eq('id', id)
        if (error) {
            const response = researchErrorResponse(error)
            if (response) return response
            throw error
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return researchErrorResponse(error)
    }
}
