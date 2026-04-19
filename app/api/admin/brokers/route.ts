import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET - List brokers
export async function GET() {
    try {
        const supabase = createAdminClient()
        // Tenta seleção completa primeiro; se alguma coluna opcional não existir no ambiente,
        // cai para seleções progressivamente mais simples para não "sumir" com os corretores.
        let data: any[] | null = null
        let error: any = null

        const fullQuery = await supabase
            .from('virtual_brokers')
            .select('id, name, creci, photo_url, is_active, assignment_type, assigned_page_slugs, phone, summary_to_phone, system_prompt, voice_id, handoff_prompt')
            .order('name')
        data = fullQuery.data
        error = fullQuery.error

        if (error) {
            const midQuery = await supabase
                .from('virtual_brokers')
                .select('id, name, creci, photo_url, is_active, assignment_type, assigned_page_slugs, phone, system_prompt, voice_id')
                .order('name')
            data = midQuery.data
            error = midQuery.error
        }

        if (error) {
            const safeQuery = await supabase
                .from('virtual_brokers')
                .select('*')
                .order('name')
            data = safeQuery.data
            error = safeQuery.error
        }

        if (error) {
            console.error('List brokers error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        const brokers = data || []
        if (brokers.length === 0) return NextResponse.json({ data: [] })

        const brokerIds = brokers.map((b: any) => b.id)
        let links: any[] = []
        try {
            const { data: linksData, error: linksError } = await supabase
                .from('broker_empreendimentos')
                .select('broker_id, empreendimento_id, prioridade, empreendimentos(id, nome, slug)')
                .in('broker_id', brokerIds)
                .eq('ativo', true)
            if (!linksError && Array.isArray(linksData)) {
                links = linksData
            } else if (linksError) {
                console.warn('List broker_empreendimentos warning:', linksError.message)
            }
        } catch (err) {
            console.warn('List broker_empreendimentos exception:', err)
        }

        const byBroker: Record<string, any[]> = {}
        for (const l of links) {
            const bid = (l as any).broker_id
            if (!byBroker[bid]) byBroker[bid] = []
            byBroker[bid].push(l)
        }

        const enriched = brokers.map((b: any) => {
            const rows = byBroker[b.id] || []
            const empreendimento_ids = rows.map((r: any) => r.empreendimento_id)
            const empreendimento_names = rows
                .map((r: any) => r?.empreendimentos?.nome)
                .filter(Boolean)
            return { ...b, empreendimento_ids, empreendimento_names }
        })

        return NextResponse.json({ data: enriched })
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
        const empreendimento_ids: string[] = Array.isArray(body?.empreendimento_ids) ? body.empreendimento_ids : []

        const payload: Record<string, any> = {
            name: safeName,
            creci: String(body?.creci || 'N/A'),
            is_active: body?.is_active ?? true,
        }

        if (typeof body?.photo_url === 'string') payload.photo_url = body.photo_url
        if (typeof body?.system_prompt === 'string') payload.system_prompt = body.system_prompt
        if (typeof body?.voice_id === 'string') payload.voice_id = body.voice_id
        if (typeof body?.handoff_prompt === 'string') payload.handoff_prompt = body.handoff_prompt
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

        if (empreendimento_ids.length > 0 && data?.id) {
            const links = empreendimento_ids.map((eid: string, idx: number) => ({
                broker_id: data.id,
                empreendimento_id: eid,
                ativo: true,
                prioridade: idx + 1,
            }))
            await supabase.from('broker_empreendimentos').upsert(links, { onConflict: 'broker_id,empreendimento_id' })
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
        const { id, empreendimento_ids, ...updates } = body

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

        if (Array.isArray(empreendimento_ids)) {
            await supabase
                .from('broker_empreendimentos')
                .delete()
                .eq('broker_id', id)

            if (empreendimento_ids.length > 0) {
                const links = empreendimento_ids.map((eid: string, idx: number) => ({
                    broker_id: id,
                    empreendimento_id: eid,
                    ativo: true,
                    prioridade: idx + 1,
                }))
                await supabase
                    .from('broker_empreendimentos')
                    .upsert(links, { onConflict: 'broker_id,empreendimento_id' })
            }
        }

        return NextResponse.json({ data: result.data })
    } catch (err) {
        console.error('API error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
