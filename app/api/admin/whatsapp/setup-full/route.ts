import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/lib/inngest/client'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// POST — Disparar setup completo da instância via Inngest (sem timeout)
export async function POST(request: NextRequest) {
    try {
        const { instanceId } = await request.json()

        if (!instanceId) {
            return NextResponse.json({ success: false, message: 'instanceId obrigatório' }, { status: 400 })
        }

        const supabase = getSupabase()
        const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, instance_token')
            .eq('id', instanceId)
            .single()

        if (!instance?.instance_token) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada ou sem token' }, { status: 404 })
        }

        // Detect base URL from request
        const host = request.headers.get('host') || ''
        const proto = request.headers.get('x-forwarded-proto') || 'https'
        const webhookBaseUrl = `${proto}://${host}`

        // Dispatch to Inngest — runs in background, no timeout
        await inngest.send({
            name: 'whatsapp/instance-setup',
            data: {
                instanceId: instance.id,
                instanceToken: instance.instance_token,
                webhookBaseUrl,
            },
        })

        return NextResponse.json({
            success: true,
            message: 'Setup iniciado em background! Webhook, privacidade, etiquetas e respostas rápidas serão configurados automaticamente.',
        })
    } catch (error) {
        console.error('[Setup Full POST]', error)
        return NextResponse.json({
            success: false,
            message: `Erro: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
