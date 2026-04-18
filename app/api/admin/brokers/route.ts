import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET - List brokers
export async function GET() {
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('virtual_brokers')
            .select('id, name, creci, photo_url, is_active, assignment_type, assigned_page_slugs, phone, summary_to_phone, system_prompt, voice_id')
            .order('name')

        if (error) {
            console.error('List brokers error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ data: data || [] })
    } catch (err) {
        console.error('API error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}

// POST - Create broker
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json()
        const safeName = String(body?.name || '').trim()

        if (!safeName) {
            return NextResponse.json({ error: 'Nome do corretor é obrigatório' }, { status: 400 })
        }

        // Cadastro rápido (WhatsApp > Instâncias) pode enviar apenas "name".
        // Inserir apenas campos essenciais para evitar erro em colunas opcionais
        // que podem não existir em todos os ambientes.
        const payload: Record<string, any> = {
            name: safeName,
            creci: String(body?.creci || 'N/A'),
            is_active: body?.is_active ?? true,
        }

        if (typeof body?.photo_url === 'string') payload.photo_url = body.photo_url
        if (typeof body?.system_prompt === 'string') payload.system_prompt = body.system_prompt
        if (typeof body?.voice_id === 'string') payload.voice_id = body.voice_id
        if (typeof body?.phone === 'string') payload.phone = body.phone
        if (typeof body?.assignment_type === 'string') payload.assignment_type = body.assignment_type
        if (Array.isArray(body?.assigned_page_slugs)) payload.assigned_page_slugs = body.assigned_page_slugs

        const { data, error } = await supabase
            .from('virtual_brokers')
            .insert([payload])
            .select()
            .single()

        if (error) {
            console.error('Insert broker error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ data })
    } catch (err) {
        console.error('API error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}

// PUT - Update broker
export async function PUT(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json()
        const { id, ...updates } = body

        if (!id) {
            return NextResponse.json({ error: 'Missing broker id' }, { status: 400 })
        }

        // Compatibilidade entre ambientes: algumas colunas opcionais podem não existir
        // (ex.: summary_to_phone). Tentamos salvar tudo e, se a API reclamar de coluna ausente,
        // removemos esse campo e tentamos novamente.
        let payload: Record<string, any> = { ...updates }
        let result = await supabase
            .from('virtual_brokers')
            .update(payload)
            .eq('id', id)
            .select()
            .single()

        if (result.error?.message?.includes("summary_to_phone")) {
            const { summary_to_phone, ...safePayload } = payload
            payload = safePayload
            result = await supabase
                .from('virtual_brokers')
                .update(payload)
                .eq('id', id)
                .select()
                .single()
        }

        if (result.error) {
            console.error('Update broker error:', result.error)
            return NextResponse.json({ error: result.error.message }, { status: 400 })
        }

        return NextResponse.json({ data: result.data })
    } catch (err) {
        console.error('API error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
