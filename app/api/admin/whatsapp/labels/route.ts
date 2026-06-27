import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { listLabels, editLabel, refreshLabels } from '@/lib/connectyhub/whatsapp'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET — Listar etiquetas de uma instância
export async function GET(request: NextRequest) {
    try {
        const instanceId = request.nextUrl.searchParams.get('instance_id')
        if (!instanceId) {
            return NextResponse.json({ success: false, message: 'instance_id obrigatório' }, { status: 400 })
        }

        const supabase = getSupabase()
        const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('instance_token')
            .eq('id', instanceId)
            .single()

        if (!instance?.instance_token) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        const labels = await listLabels(instance.instance_token)
        return NextResponse.json({ success: true, labels })
    } catch (error) {
        console.error('[Labels GET]', error)
        return NextResponse.json({ success: false, message: 'Erro ao listar etiquetas' }, { status: 500 })
    }
}

// POST — Criar, editar, deletar ou recarregar etiquetas
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { action, instanceId, labelId, name, color, forceRefresh } = body

        if (!instanceId) {
            return NextResponse.json({ success: false, message: 'instanceId obrigatório' }, { status: 400 })
        }

        const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('instance_token')
            .eq('id', instanceId)
            .single()

        if (!instance?.instance_token) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        if (action === 'refresh') {
            const result = await refreshLabels(instance.instance_token, forceRefresh ?? false)
            return NextResponse.json({ success: true, result })
        }

        if (action === 'create') {
            const result = await editLabel('new', name, color ?? 0, false, instance.instance_token)
            return NextResponse.json({ success: true, result, message: `Etiqueta "${name}" criada!` })
        }

        if (action === 'edit') {
            if (!labelId) return NextResponse.json({ success: false, message: 'labelId obrigatório' }, { status: 400 })
            const result = await editLabel(labelId, name, color ?? 0, false, instance.instance_token)
            return NextResponse.json({ success: true, result, message: `Etiqueta "${name}" atualizada!` })
        }

        if (action === 'delete') {
            if (!labelId) return NextResponse.json({ success: false, message: 'labelId obrigatório' }, { status: 400 })
            const result = await editLabel(labelId, '', 0, true, instance.instance_token)
            return NextResponse.json({ success: true, result, message: 'Etiqueta removida!' })
        }

        return NextResponse.json({ success: false, message: 'action inválida (use: create, edit, delete, refresh)' }, { status: 400 })
    } catch (error) {
        console.error('[Labels POST]', error)
        return NextResponse.json({
            success: false,
            message: `Erro: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
