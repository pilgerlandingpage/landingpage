import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { configureWebhook, getWebhook, getWebhookErrors } from '@/lib/uazapi'
import { getPublicAppUrl } from '@/lib/app-url'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// POST — Configurar webhook automaticamente em uma instância
export async function POST(request: NextRequest) {
    try {
        const { instanceId } = await request.json()
        if (!instanceId) {
            return NextResponse.json({ success: false, message: 'instanceId obrigatório' }, { status: 400 })
        }

        const supabase = getSupabase()
        const { data: instance, error } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, instance_token, status')
            .eq('id', instanceId)
            .single()

        if (error || !instance) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        if (!instance.instance_token) {
            return NextResponse.json({ success: false, message: 'Instância sem token — conecte primeiro via QR Code' }, { status: 400 })
        }

        const baseUrl = getPublicAppUrl(request.nextUrl.origin)
        const webhookUrl = `${baseUrl}/api/webhooks/whatsapp`

        // Configure webhook with optimal settings for Pilger
        const result = await configureWebhook({
            enabled: true,
            url: webhookUrl,
            events: [
                'messages',             // Mensagens recebidas/enviadas
                'messages_update',      // Atualizações (lido, entregue)
                'connection',           // Conexão/desconexão
                'chats',                // Mudanças de chat
                'labels',               // Mudanças de etiquetas
            ],
            excludeMessages: [
                'wasSentByApi',         // 🔒 CRÍTICO: Previne loops infinitos
                'isGroupYes',           // Ignora mensagens de grupos (foco em leads 1:1)
            ],
            addUrlEvents: false,        // Todos os eventos vão para a mesma URL
            addUrlTypesMessages: false,
        }, instance.instance_token)

        // Verify it was set correctly
        let verifyResult = null
        try {
            verifyResult = await getWebhook(instance.instance_token)
        } catch { /* non-critical */ }

        console.log(`[Webhook Setup] ✅ Webhook configurado para ${instance.instance_name}: ${webhookUrl}`)

        return NextResponse.json({
            success: true,
            message: `Webhook configurado com sucesso!`,
            webhookUrl,
            setupResult: result,
            verification: verifyResult,
            filters: {
                antiLoop: '✅ wasSentByApi excluído (prevenção de loop)',
                groups: '✅ Grupos excluídos (foco em leads 1:1)',
                events: 'messages, messages_update, connection, chats, labels',
            }
        })
    } catch (error) {
        console.error('[Webhook Setup Error]', error)
        return NextResponse.json({
            success: false,
            message: `Erro ao configurar webhook: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}

// GET — Verificar status e erros do webhook de uma instância
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

        // Get current webhook config
        let webhookConfig = null
        try {
            webhookConfig = await getWebhook(instance.instance_token)
        } catch (e) {
            console.warn('[Webhook Status] Failed to get config:', e)
        }

        // Get recent errors
        let recentErrors = null
        try {
            recentErrors = await getWebhookErrors(instance.instance_token)
        } catch (e) {
            console.warn('[Webhook Status] Failed to get errors:', e)
        }

        return NextResponse.json({
            success: true,
            webhook: webhookConfig,
            errors: recentErrors,
        })
    } catch (error) {
        console.error('[Webhook Status Error]', error)
        return NextResponse.json({ success: false, message: 'Erro ao verificar webhook' }, { status: 500 })
    }
}
