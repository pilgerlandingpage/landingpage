import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createInstance, connectInstance } from '@/lib/uazapi'
import { DEFAULT_WHATSAPP_INSTANCE_CONFIG } from '@/lib/whatsapp/instance-config'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function normalizePhone(value: unknown): string | null {
    const digits = String(value || '').replace(/\D/g, '')
    return digits || null
}

function buildDefaultBrokerPrompt(name: string) {
    const safeName = String(name || '').trim() || 'Corretor Pilger'
    return `Voce e ${safeName}, corretor da Pilger. Atenda leads de forma profissional, cordial e objetiva. Nao invente informacoes e, quando faltar contexto, faca perguntas curtas para qualificar o cliente.`
}

async function ensureAiBrokerForAdminUser(params: {
    supabase: any
    adminUserId: string
    instance: any
}) {
    const { supabase, adminUserId, instance } = params
    if (!adminUserId || !instance?.id) {
        return { brokerId: null as string | null, brokerCreated: false }
    }

    let brokerId = instance?.broker_id ? String(instance.broker_id) : ''
    let brokerCreated = false

    if (!brokerId) {
        const { data: previousInstance } = await supabase
            .from('whatsapp_instances')
            .select('broker_id')
            .eq('admin_user_id', adminUserId)
            .neq('id', instance.id)
            .not('broker_id', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (previousInstance?.broker_id) brokerId = String(previousInstance.broker_id)
    }

    if (!brokerId) {
        try {
            const { data: brokerByInstance } = await supabase
                .from('virtual_brokers')
                .select('id')
                .eq('whatsapp_instance_id', instance.id)
                .limit(1)
                .maybeSingle()
            if (brokerByInstance?.id) brokerId = String(brokerByInstance.id)
        } catch {
            // ignore envs where whatsapp_instance_id may not exist
        }
    }

    if (!brokerId) {
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('id, name, email, phone')
            .eq('id', adminUserId)
            .maybeSingle()

        if (!adminUser) {
            return { brokerId: null as string | null, brokerCreated: false }
        }

        const brokerName =
            String(adminUser.name || '').trim() ||
            String(adminUser.email || '').trim() ||
            `Corretor ${String(adminUserId).slice(0, 8)}`
        const brokerPhone = normalizePhone(adminUser.phone)

        const brokerPayload: any = {
            name: brokerName,
            creci: 'N/A',
            is_active: true,
            system_prompt: buildDefaultBrokerPrompt(brokerName),
        }
        if (brokerPhone) brokerPayload.phone = brokerPhone

        const { data: createdBroker, error: createBrokerError } = await supabase
            .from('virtual_brokers')
            .insert(brokerPayload)
            .select('id')
            .single()

        if (createBrokerError) throw createBrokerError
        brokerId = String(createdBroker?.id || '')
        brokerCreated = Boolean(brokerId)
    }

    if (!brokerId) {
        return { brokerId: null as string | null, brokerCreated }
    }

    const { error: bindInstanceError } = await supabase
        .from('whatsapp_instances')
        .update({ broker_id: brokerId, updated_at: new Date().toISOString() })
        .eq('id', instance.id)

    if (bindInstanceError) throw bindInstanceError

    try {
        await supabase
            .from('virtual_brokers')
            .update({ whatsapp_instance_id: instance.id, updated_at: new Date().toISOString() })
            .eq('id', brokerId)
    } catch {
        // ignore envs where whatsapp_instance_id may not exist
    }

    try {
        await supabase
            .from('admin_users')
            .update({ whatsapp_instance_id: instance.id, updated_at: new Date().toISOString() })
            .eq('id', adminUserId)
    } catch {
        // ignore envs where admin_users.whatsapp_instance_id may not exist
    }

    return { brokerId, brokerCreated }
}

/**
 * POST - Gerar QR Code para conectar instancia WhatsApp
 *
 * Aceita dois cenarios:
 * 1. { instanceId } - reconectar instancia existente
 * 2. { instance_name, broker_id?, admin_user_id? } - criar nova instancia e conectar
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { instanceId, instance_name, broker_id, admin_user_id } = body

        let instance: any = null
        let autoBrokerId: string | null = null
        let autoBrokerCreated = false
        let brokerSyncWarning: string | null = null

        if (instanceId) {
            // Scenario 1: reconnect existing instance
            const { data, error } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('id', instanceId)
                .single()

            if (error || !data) {
                return NextResponse.json({ success: false, message: 'Instancia nao encontrada' }, { status: 404 })
            }
            instance = data
        } else if (instance_name) {
            // Scenario 2: create new instance

            // Check if there is already an instance for this broker/user
            let existingQuery = supabase.from('whatsapp_instances').select('*')
            if (broker_id) {
                existingQuery = existingQuery.eq('broker_id', broker_id)
            } else if (admin_user_id) {
                existingQuery = existingQuery.eq('admin_user_id', admin_user_id)
            }
            const { data: existing } = await existingQuery.limit(1).maybeSingle()

            if (existing?.instance_token) {
                // Already has instance -> reconnect
                instance = existing
            } else {
                // Create at uazapi
                console.log(`[QR Code] Criando instancia: ${instance_name}`)
                const createResult = await createInstance(instance_name)
                console.log('[QR Code] Resultado createInstance:', JSON.stringify(createResult).substring(0, 200))

                const token = createResult.token || createResult.instance?.token || createResult.apikey || ''

                if (!token) {
                    return NextResponse.json({
                        success: false,
                        message: 'Falha ao obter token da instancia. Verifique as configuracoes da uazapi.',
                        debug: createResult,
                    }, { status: 500 })
                }

                // If there was a row without token, update. Otherwise insert.
                if (existing) {
                    const existingConfig = existing?.config && typeof existing.config === 'object' ? existing.config : null
                    const updates: Record<string, any> = { instance_token: token, instance_name, updated_at: new Date().toISOString() }
                    if (!existingConfig || Object.keys(existingConfig).length === 0) {
                        updates.config = DEFAULT_WHATSAPP_INSTANCE_CONFIG
                    }
                    await supabase
                        .from('whatsapp_instances')
                        .update(updates)
                        .eq('id', existing.id)
                    instance = { ...existing, ...updates }
                } else {
                    const insertData: any = {
                        instance_name,
                        instance_token: token,
                        status: 'disconnected',
                        config: DEFAULT_WHATSAPP_INSTANCE_CONFIG,
                    }
                    if (broker_id) insertData.broker_id = broker_id
                    if (admin_user_id) insertData.admin_user_id = admin_user_id
                    // admin_user_id is NOT NULL, if broker without user use null UUID
                    if (!admin_user_id && broker_id) insertData.admin_user_id = '00000000-0000-0000-0000-000000000000'

                    const { data: newInst, error: insertErr } = await supabase
                        .from('whatsapp_instances')
                        .insert(insertData)
                        .select()
                        .single()

                    if (insertErr) {
                        console.error('[QR Code] Erro ao salvar instancia:', insertErr)
                        return NextResponse.json({ success: false, message: `Erro ao salvar: ${insertErr.message}` }, { status: 500 })
                    }
                    instance = newInst
                }

                if (broker_id && instance?.id) {
                    try {
                        await supabase
                            .from('virtual_brokers')
                            .update({ whatsapp_instance_id: instance.id, updated_at: new Date().toISOString() })
                            .eq('id', broker_id)
                        autoBrokerId = String(broker_id)
                    } catch {
                        // ignore schema/version differences
                    }
                }
            }
        } else {
            return NextResponse.json({ success: false, message: 'Parametros invalidos. Envie instanceId ou instance_name.' }, { status: 400 })
        }

        if (!instance?.instance_token) {
            return NextResponse.json({ success: false, message: 'Token da instancia nao encontrado' }, { status: 400 })
        }

        // If this is a user-owned instance, ensure AI broker is auto-created and linked.
        if (!broker_id && instance?.admin_user_id) {
            try {
                const brokerResult = await ensureAiBrokerForAdminUser({
                    supabase,
                    adminUserId: String(instance.admin_user_id),
                    instance,
                })
                if (brokerResult.brokerId) {
                    autoBrokerId = brokerResult.brokerId
                    autoBrokerCreated = Boolean(brokerResult.brokerCreated)
                    instance = { ...instance, broker_id: brokerResult.brokerId }
                }
            } catch (error) {
                console.error('[QR Code] Falha ao criar/vincular broker automatico:', error)
                brokerSyncWarning = 'A instancia foi criada, mas houve falha ao vincular o Corretor IA automaticamente.'
            }
        }

        // Connect (generate QR code)
        console.log(`[QR Code] Conectando instancia: ${instance.instance_name}`)
        const result = await connectInstance(instance.instance_token)
        console.log('[QR Code] Resultado connectInstance:', JSON.stringify(result).substring(0, 300))

        // Update status in DB
        await supabase
            .from('whatsapp_instances')
            .update({
                status: 'connecting',
                updated_at: new Date().toISOString(),
            })
            .eq('id', instance.id)

        // Extract QR code
        let qrcode = result?.instance?.qrcode
            || result?.instance?.qr
            || result?.qrcode
            || result?.qr
            || result?.base64
            || null

        let pairingCode = result?.instance?.paircode
            || result?.pairingCode
            || result?.code
            || null

        // If connect didn't return QR, poll status endpoint
        if (!qrcode) {
            console.log('[QR Code] QR nao veio no connect, buscando via /instance/status...')
            const { getInstanceStatus } = await import('@/lib/uazapi')

            await new Promise(resolve => setTimeout(resolve, 2000))
            const statusResult = await getInstanceStatus(instance.instance_token)
            console.log('[QR Code] Resultado status:', JSON.stringify(statusResult).substring(0, 300))

            qrcode = statusResult?.instance?.qrcode
                || statusResult?.qrcode
                || null
            pairingCode = pairingCode
                || statusResult?.instance?.paircode
                || statusResult?.pairingCode
                || null
        }

        // Normalize: add data URI prefix if pure base64
        if (qrcode && typeof qrcode === 'string' && !qrcode.startsWith('data:') && !qrcode.startsWith('http')) {
            qrcode = `data:image/png;base64,${qrcode}`
        }

        console.log('[QR Code] QR extraido:', qrcode ? `${String(qrcode).substring(0, 80)}...` : 'null')

        return NextResponse.json({
            success: true,
            qrcode,
            pairingCode,
            instanceId: instance.id,
            brokerId: autoBrokerId,
            brokerCreated: autoBrokerCreated,
            brokerSyncWarning,
        })
    } catch (error) {
        console.error('[QR Code Error]', error)
        return NextResponse.json({
            success: false,
            message: `Erro ao gerar QR Code: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
