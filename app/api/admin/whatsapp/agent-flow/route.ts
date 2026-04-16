import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_FLOW_CONFIG } from '@/lib/ai/prompt-builder'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET — Carregar configuração do fluxo
export async function GET() {
    try {
        const supabase = getSupabase()
        const { data } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'agent_flow_config')
            .single()

        if (data?.value) {
            try {
                const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
                return NextResponse.json({ success: true, config })
            } catch {
                return NextResponse.json({ success: true, config: DEFAULT_FLOW_CONFIG })
            }
        }

        return NextResponse.json({ success: true, config: DEFAULT_FLOW_CONFIG })
    } catch (error) {
        console.error('[AgentFlow GET]', error)
        return NextResponse.json({ success: true, config: DEFAULT_FLOW_CONFIG })
    }
}

// POST — Salvar configuração do fluxo
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { config } = await request.json()

        if (!config) {
            return NextResponse.json({ success: false, message: 'config obrigatório' }, { status: 400 })
        }

        // Upsert into app_config
        const { error } = await supabase
            .from('app_config')
            .upsert(
                { key: 'agent_flow_config', value: JSON.stringify(config) },
                { onConflict: 'key' }
            )

        if (error) {
            console.error('[AgentFlow POST] DB Error:', error)
            return NextResponse.json({ success: false, message: 'Erro ao salvar' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Fluxo salvo com sucesso!' })
    } catch (error) {
        console.error('[AgentFlow POST]', error)
        return NextResponse.json({
            success: false,
            message: `Erro: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
