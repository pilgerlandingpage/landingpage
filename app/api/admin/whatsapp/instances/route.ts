import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    createInstance,
    deleteInstance,
} from '@/lib/uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET — Lista todas as instâncias (admin via service role)
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()

        const { data, error } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('[WhatsApp Instances GET]', error)
            return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, instances: data || [] })
    } catch (error) {
        console.error('Error listing instances:', error)
        return NextResponse.json({ success: false, message: 'Erro ao listar instâncias' }, { status: 500 })
    }
}

// POST — Criar nova instância
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { adminUserId } = await request.json()

        if (!adminUserId) {
            return NextResponse.json({ success: false, message: 'ID do usuário é obrigatório' }, { status: 400 })
        }

        // Gerar nome único para a instância
        const instanceName = `pilger_${adminUserId.split('-')[0]}_${Date.now()}`

        // Criar na uazapi
        let instanceToken = ''
        try {
            const uazapiResult = await createInstance(instanceName)
            instanceToken = uazapiResult?.token || uazapiResult?.instance?.token || ''
        } catch (apiErr) {
            console.warn('[WhatsApp] Criação na API remota falhou, salvando no banco mesmo assim:', apiErr)
        }

        // Salvar no banco
        const { data, error } = await supabase
            .from('whatsapp_instances')
            .insert({
                admin_user_id: adminUserId,
                instance_name: instanceName,
                instance_token: instanceToken,
                status: 'disconnected',
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            instance: data,
            message: 'Instância criada! Agora escaneie o QR Code para conectar.',
        })
    } catch (error) {
        console.error('Error creating instance:', error)
        return NextResponse.json({
            success: false,
            message: `Erro ao criar instância: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}

// DELETE — Remover instância
export async function DELETE(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { instanceId } = await request.json()

        // Buscar dados da instância
        const { data: instance, error: fetchError } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('id', instanceId)
            .single()

        if (fetchError || !instance) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        // Tentar deletar na uazapi (não bloqueia em caso de falha)
        try {
            await deleteInstance(instance.instance_name)
        } catch (e) {
            console.warn('Falha ao deletar na uazapi (pode já não existir):', e)
        }

        // Deletar do banco
        const { error } = await supabase
            .from('whatsapp_instances')
            .delete()
            .eq('id', instanceId)

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Instância removida com sucesso' })
    } catch (error) {
        console.error('Error deleting instance:', error)
        return NextResponse.json({ success: false, message: 'Erro ao remover instância' }, { status: 500 })
    }
}
