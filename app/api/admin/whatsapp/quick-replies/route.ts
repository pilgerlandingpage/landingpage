import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { listQuickReplies, editQuickReply } from '@/lib/connectyhub/whatsapp'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET — Listar respostas rápidas de uma instância
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

        const replies = await listQuickReplies(instance.instance_token)
        return NextResponse.json({ success: true, replies })
    } catch (error) {
        console.error('[QuickReplies GET]', error)
        return NextResponse.json({ success: false, message: 'Erro ao listar respostas rápidas' }, { status: 500 })
    }
}

// POST — Criar, editar ou deletar resposta rápida
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { action, instanceId, shortCut, text, type, file, deleteShortCut } = body

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

        if (action === 'save') {
            if (!shortCut || !text) {
                return NextResponse.json({ success: false, message: 'shortCut e text são obrigatórios' }, { status: 400 })
            }
            const result = await editQuickReply({
                shortCut: shortCut.startsWith('/') ? shortCut : `/${shortCut}`,
                type: type || 'text',
                text,
                file: file || undefined,
            }, instance.instance_token)
            return NextResponse.json({ success: true, result, message: `Resposta rápida "${shortCut}" salva!` })
        }

        if (action === 'delete') {
            if (!deleteShortCut) {
                return NextResponse.json({ success: false, message: 'deleteShortCut obrigatório' }, { status: 400 })
            }
            const result = await editQuickReply({
                shortCut: deleteShortCut,
                type: 'text',
                text: '',
                delete: true,
            }, instance.instance_token)
            return NextResponse.json({ success: true, result, message: 'Resposta rápida removida!' })
        }

        return NextResponse.json({ success: false, message: 'action inválida (use: save, delete)' }, { status: 400 })
    } catch (error) {
        console.error('[QuickReplies POST]', error)
        return NextResponse.json({
            success: false,
            message: `Erro: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
