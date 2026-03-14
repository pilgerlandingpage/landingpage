import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { connectInstance } from '@/lib/uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// POST — Gerar QR Code para conectar instância
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { instanceId } = await request.json()

        // Buscar token da instância
        const { data: instance, error: fetchError } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('id', instanceId)
            .single()

        if (fetchError || !instance) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        if (!instance.instance_token) {
            return NextResponse.json({ success: false, message: 'Token da instância não encontrado' }, { status: 400 })
        }

        // Conectar na uazapi (retorna QR Code)
        const result = await connectInstance(instance.instance_token)

        // Atualizar status no banco
        await supabase
            .from('whatsapp_instances')
            .update({
                status: 'connecting',
                updated_at: new Date().toISOString(),
            })
            .eq('id', instanceId)

        return NextResponse.json({
            success: true,
            qrcode: result.qrcode || result.qr || result.base64 || result,
            pairingCode: result.pairingCode || result.code || null,
        })
    } catch (error) {
        console.error('Error generating QR code:', error)
        return NextResponse.json({
            success: false,
            message: `Erro ao gerar QR Code: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
