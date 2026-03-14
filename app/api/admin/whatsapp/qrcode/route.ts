import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createInstance, connectInstance } from '@/lib/uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * POST — Gerar QR Code para conectar instância WhatsApp
 * 
 * Aceita dois cenários:
 * 1. { instanceId } — reconectar instância existente
 * 2. { instance_name, broker_id?, admin_user_id? } — criar nova instância e conectar
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { instanceId, instance_name, broker_id, admin_user_id } = body

        let instance: any = null

        if (instanceId) {
            // ── Cenário 1: Reconectar instância existente ──
            const { data, error } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('id', instanceId)
                .single()

            if (error || !data) {
                return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
            }
            instance = data
        } else if (instance_name) {
            // ── Cenário 2: Criar nova instância ──
            
            // Verificar se já existe uma instância para este broker/user
            let existingQuery = supabase.from('whatsapp_instances').select('*')
            if (broker_id) {
                existingQuery = existingQuery.eq('broker_id', broker_id)
            } else if (admin_user_id) {
                existingQuery = existingQuery.eq('admin_user_id', admin_user_id)
            }
            const { data: existing } = await existingQuery.limit(1).maybeSingle()

            if (existing?.instance_token) {
                // Já tem instância — reconectar
                instance = existing
            } else {
                // Criar na uazapi
                console.log(`[QR Code] Criando instância: ${instance_name}`)
                const createResult = await createInstance(instance_name)
                console.log('[QR Code] Resultado createInstance:', JSON.stringify(createResult).substring(0, 200))

                const token = createResult.token || createResult.instance?.token || createResult.apikey || ''

                if (!token) {
                    return NextResponse.json({
                        success: false,
                        message: 'Falha ao obter token da instância. Verifique as configurações da uazapi.',
                        debug: createResult
                    }, { status: 500 })
                }

                // Se já existia registro sem token, update. Senão, insert.
                if (existing) {
                    await supabase
                        .from('whatsapp_instances')
                        .update({ instance_token: token, instance_name, updated_at: new Date().toISOString() })
                        .eq('id', existing.id)
                    instance = { ...existing, instance_token: token, instance_name }
                } else {
                    const insertData: any = {
                        instance_name,
                        instance_token: token,
                        status: 'disconnected',
                    }
                    if (broker_id) insertData.broker_id = broker_id
                    if (admin_user_id) insertData.admin_user_id = admin_user_id
                    // admin_user_id é NOT NULL, se for broker sem user, usar UUID nulo
                    if (!admin_user_id && broker_id) insertData.admin_user_id = '00000000-0000-0000-0000-000000000000'

                    const { data: newInst, error: insertErr } = await supabase
                        .from('whatsapp_instances')
                        .insert(insertData)
                        .select()
                        .single()

                    if (insertErr) {
                        console.error('[QR Code] Erro ao salvar instância:', insertErr)
                        return NextResponse.json({ success: false, message: `Erro ao salvar: ${insertErr.message}` }, { status: 500 })
                    }
                    instance = newInst
                }
            }
        } else {
            return NextResponse.json({ success: false, message: 'Parâmetros inválidos. Envie instanceId ou instance_name.' }, { status: 400 })
        }

        if (!instance?.instance_token) {
            return NextResponse.json({ success: false, message: 'Token da instância não encontrado' }, { status: 400 })
        }

        // ── Conectar (gera QR Code) ──
        console.log(`[QR Code] Conectando instância: ${instance.instance_name}`)
        const result = await connectInstance(instance.instance_token)
        console.log('[QR Code] Resultado connectInstance:', JSON.stringify(result).substring(0, 200))

        // Atualizar status no banco
        await supabase
            .from('whatsapp_instances')
            .update({
                status: 'connecting',
                updated_at: new Date().toISOString(),
            })
            .eq('id', instance.id)

        // Extrair QR code do resultado
        let qrcode = result.qrcode || result.qr || result.base64 || null
        
        // Se o resultado inteiro é uma string (pode ser o QR direto)
        if (!qrcode && typeof result === 'string') {
            qrcode = result
        }

        // Normalizar: adicionar prefixo data URI se for base64 puro
        if (qrcode && typeof qrcode === 'string' && !qrcode.startsWith('data:') && !qrcode.startsWith('http')) {
            qrcode = `data:image/png;base64,${qrcode}`
        }

        console.log('[QR Code] QR extraído:', qrcode ? `${String(qrcode).substring(0, 80)}...` : 'null')
        console.log('[QR Code] Chaves do resultado:', Object.keys(result))

        return NextResponse.json({
            success: true,
            qrcode,
            pairingCode: result.pairingCode || result.code || null,
            instanceId: instance.id,
            debug_keys: Object.keys(result),
            debug_result: result,
        })
    } catch (error) {
        console.error('[QR Code Error]', error)
        return NextResponse.json({
            success: false,
            message: `Erro ao gerar QR Code: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
