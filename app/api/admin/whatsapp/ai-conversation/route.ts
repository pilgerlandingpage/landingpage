import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET — Listar conversas IA (por broker_id, lead_phone ou status)
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { searchParams } = new URL(request.url)
        const brokerId = searchParams.get('broker_id')
        const leadPhone = searchParams.get('lead_phone')
        const status = searchParams.get('status')

        let query = supabase
            .from('whatsapp_ai_conversations')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(50)

        if (brokerId) query = query.eq('broker_id', brokerId)
        if (leadPhone) query = query.eq('lead_phone', leadPhone)
        if (status) query = query.eq('status', status)

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ success: true, conversations: data || [] })
    } catch (error) {
        console.error('[AI Conversation GET]', error)
        return NextResponse.json({ success: false, message: 'Erro ao listar conversas' }, { status: 500 })
    }
}

// POST — Criar nova conversa ou adicionar mensagem
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { conversation_id, broker_id, lead_phone, instance_id, message, lead_data_extracted } = body

        // Se conversation_id existe, adicionar mensagem à conversa existente
        if (conversation_id) {
            const { data: existing, error: fetchErr } = await supabase
                .from('whatsapp_ai_conversations')
                .select('messages')
                .eq('id', conversation_id)
                .single()

            if (fetchErr || !existing) {
                return NextResponse.json({ success: false, message: 'Conversa não encontrada' }, { status: 404 })
            }

            const messages = [...(existing.messages || []), {
                role: message.role, // 'assistant' | 'user'
                content: message.content,
                timestamp: new Date().toISOString()
            }]

            const updateData: any = { messages, updated_at: new Date().toISOString() }
            if (lead_data_extracted) updateData.lead_data_extracted = lead_data_extracted

            const { data, error } = await supabase
                .from('whatsapp_ai_conversations')
                .update(updateData)
                .eq('id', conversation_id)
                .select()
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, conversation: data })
        }

        // Criar nova conversa
        if (!broker_id || !lead_phone) {
            return NextResponse.json({ success: false, message: 'broker_id e lead_phone são obrigatórios' }, { status: 400 })
        }

        const initialMessages = message ? [{
            role: message.role,
            content: message.content,
            timestamp: new Date().toISOString()
        }] : []

        const { data, error } = await supabase
            .from('whatsapp_ai_conversations')
            .insert({
                broker_id,
                lead_phone,
                instance_id: instance_id || null,
                messages: initialMessages,
                status: 'active'
            })
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, conversation: data })
    } catch (error) {
        console.error('[AI Conversation POST]', error)
        return NextResponse.json({ success: false, message: 'Erro ao processar conversa' }, { status: 500 })
    }
}

// PUT — Atualizar status (transferir, fechar) e gerar resumo
export async function PUT(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { conversation_id, status, summary, transferred_to_user_id } = await request.json()

        if (!conversation_id) {
            return NextResponse.json({ success: false, message: 'conversation_id é obrigatório' }, { status: 400 })
        }

        const updateData: any = { updated_at: new Date().toISOString() }
        if (status) updateData.status = status
        if (summary) updateData.summary = summary
        if (transferred_to_user_id) {
            updateData.transferred_to_user_id = transferred_to_user_id
            updateData.transferred_at = new Date().toISOString()
        }

        const { data, error } = await supabase
            .from('whatsapp_ai_conversations')
            .update(updateData)
            .eq('id', conversation_id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, conversation: data })
    } catch (error) {
        console.error('[AI Conversation PUT]', error)
        return NextResponse.json({ success: false, message: 'Erro ao atualizar conversa' }, { status: 500 })
    }
}
