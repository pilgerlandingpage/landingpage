import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getInstanceStatus, disconnectInstance } from '@/lib/uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET — Verificar status de conexão da instância
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const instanceId = request.nextUrl.searchParams.get('instanceId')

        if (!instanceId) {
            return NextResponse.json({ success: false, message: 'instanceId é obrigatório' }, { status: 400 })
        }

        const { data: instance, error: fetchError } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('id', instanceId)
            .single()

        if (fetchError || !instance) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        if (!instance.instance_token) {
            return NextResponse.json({
                success: true,
                status: 'disconnected',
                phone: null,
            })
        }

        // Consultar status na uazapi
        const result = await getInstanceStatus(instance.instance_token)
        console.log('[Status] Resultado uazapi:', JSON.stringify(result).substring(0, 300))
        
        // uazapi retorna: { status: { connected, loggedIn }, instance: { qrcode, ... } }
        const isConnected = result?.status?.connected === true || result?.connected === true
        const isLoggedIn = result?.status?.loggedIn === true || result?.loggedIn === true
        const phone = result?.instance?.phone || result?.phone || result?.number || instance.phone_number || null

        // Determinar status
        const newStatus = (isConnected && isLoggedIn) ? 'connected' :
                          (isConnected || result?.response?.includes?.('Connecting')) ? 'connecting' : 'disconnected'

        if (newStatus !== instance.status) {
            await supabase
                .from('whatsapp_instances')
                .update({
                    status: newStatus,
                    phone_number: phone,
                    connected_at: newStatus === 'connected' ? new Date().toISOString() : instance.connected_at,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', instanceId)
        }

        return NextResponse.json({
            success: true,
            status: newStatus,
            phone,
        })
    } catch (error) {
        console.error('Error checking status:', error)
        return NextResponse.json({
            success: false,
            message: `Erro ao verificar status: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}

// POST — Desconectar instância
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { instanceId } = await request.json()

        const { data: instance, error: fetchError } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('id', instanceId)
            .single()

        if (fetchError || !instance) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        if (instance.instance_token) {
            await disconnectInstance(instance.instance_token)
        }

        await supabase
            .from('whatsapp_instances')
            .update({
                status: 'disconnected',
                updated_at: new Date().toISOString(),
            })
            .eq('id', instanceId)

        return NextResponse.json({ success: true, message: 'Instância desconectada' })
    } catch (error) {
        console.error('Error disconnecting:', error)
        return NextResponse.json({
            success: false,
            message: `Erro ao desconectar: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
