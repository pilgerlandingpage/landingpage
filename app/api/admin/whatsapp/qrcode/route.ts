import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createInstance, connectInstance, listAllInstances } from '@/lib/connectyhub/whatsapp'
import {
    extractProviderInstanceName,
    extractProviderInstanceToken,
    normalizeProviderInstances,
    normalizeWhatsAppConnectionStatus,
} from '@/lib/whatsapp/connection-status'
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

function cleanString(value: unknown): string | null {
    const text = String(value || '').trim()
    return text || null
}

function isUsableQrCode(value: unknown): value is string {
    const text = cleanString(value)
    if (!text) return false
    if (text.startsWith('data:image/') || text.startsWith('http')) return true
    return text.length > 100
}

function extractQrCode(payload: any): string | null {
    const candidates = [
        payload?.qrCode,
        payload?.qr_code,
        payload?.qrcode,
        payload?.qr,
        payload?.base64,
        payload?.data?.qrCode,
        payload?.data?.qr_code,
        payload?.data?.qrcode,
        payload?.data?.qr,
        payload?.data?.base64,
        payload?.instance?.qrCode,
        payload?.instance?.qr_code,
        payload?.instance?.qrcode,
        payload?.instance?.qr,
        payload?.instance?.base64,
        payload?.provider?.qrCode,
        payload?.provider?.qr_code,
        payload?.provider?.qrcode,
        payload?.provider?.qr,
        payload?.provider?.instance?.qrCode,
        payload?.provider?.instance?.qr_code,
        payload?.provider?.instance?.qrcode,
        payload?.provider?.instance?.qr,
    ]

    for (const candidate of candidates) {
        if (isUsableQrCode(candidate)) return cleanString(candidate)
    }

    return null
}

function extractPairingCode(payload: any): string | null {
    return cleanString(
        payload?.pairingCode ||
        payload?.pairing_code ||
        payload?.paircode ||
        payload?.code ||
        payload?.data?.pairingCode ||
        payload?.data?.pairing_code ||
        payload?.data?.paircode ||
        payload?.data?.code ||
        payload?.instance?.pairingCode ||
        payload?.instance?.pairing_code ||
        payload?.instance?.paircode ||
        payload?.instance?.code ||
        payload?.provider?.pairingCode ||
        payload?.provider?.pairing_code ||
        payload?.provider?.paircode ||
        payload?.provider?.code ||
        payload?.provider?.instance?.pairingCode ||
        payload?.provider?.instance?.pairing_code ||
        payload?.provider?.instance?.paircode ||
        payload?.provider?.instance?.code
    )
}

function compactLookupText(value: unknown): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '')
}

function withConnectyHubInstanceId(config: Record<string, any> | null | undefined, instanceId: string) {
    return {
        ...DEFAULT_WHATSAPP_INSTANCE_CONFIG,
        ...(config || {}),
        connectyhub_instance_id: instanceId,
    }
}

function localStatusFromProvider(row: any): 'disconnected' | 'connecting' | 'connected' {
    return normalizeWhatsAppConnectionStatus(row) || 'disconnected'
}

async function findReusableConnectyHubInstance(params: {
    instanceName?: string | null
    adminUserId?: string | null
}) {
    const adminKey = compactLookupText(params.adminUserId)
    const requestedNameKey = compactLookupText(params.instanceName)
    if (!adminKey && !requestedNameKey) return null

    try {
        const providerRows = normalizeProviderInstances(await listAllInstances())
        return providerRows.find((row: any) => {
            const providerId = extractProviderInstanceToken(row)
            if (!providerId) return false

            const providerName = extractProviderInstanceName(row)
            const providerNameKey = compactLookupText(providerName)
            const status = localStatusFromProvider(row)

            if (status === 'connected') return false
            if (requestedNameKey && providerNameKey === requestedNameKey) return true
            if (adminKey && providerNameKey.includes(adminKey)) return true
            return false
        }) || null
    } catch (error) {
        console.warn('[QR Code] Falha ao buscar instancias reutilizaveis na ConnectyHub:', error)
        return null
    }
}

function normalizeInstanceType(value: unknown): 'global' | 'broker' | 'sector' | 'admin' {
    const type = String(value || '').toLowerCase()
    if (type === 'global' || type === 'sector' || type === 'admin') return type
    return 'broker'
}

function isGlobalInstanceRecord(instance: any): boolean {
    const type = String(instance?.instance_type || '').trim().toLowerCase()
    const name = String(instance?.instance_name || '').trim().toLowerCase()
    return type === 'global' || name === 'agente global' || name === 'whatsapp global'
}

function isMissingColumnError(error: any, column: string) {
    const message = String(error?.message || error || '')
    return message.includes(column) || message.includes(`'${column}'`) || message.includes(`"${column}"`)
}

async function updateInstanceWithCompatibility(supabase: any, id: string, updates: Record<string, any>) {
    const result = await supabase
        .from('whatsapp_instances')
        .update(updates)
        .eq('id', id)

    if (!result.error || !Object.prototype.hasOwnProperty.call(updates, 'instance_type')) return result
    if (!isMissingColumnError(result.error, 'instance_type')) return result

    const { instance_type: _instanceType, ...fallbackUpdates } = updates
    return supabase
        .from('whatsapp_instances')
        .update(fallbackUpdates)
        .eq('id', id)
}

async function insertInstanceWithCompatibility(supabase: any, insertData: Record<string, any>) {
    const result = await supabase
        .from('whatsapp_instances')
        .insert(insertData)
        .select()
        .single()

    if (!result.error || !Object.prototype.hasOwnProperty.call(insertData, 'instance_type')) return result
    if (!isMissingColumnError(result.error, 'instance_type')) return result

    const { instance_type: _instanceType, ...fallbackInsert } = insertData
    return supabase
        .from('whatsapp_instances')
        .insert(fallbackInsert)
        .select()
        .single()
}

async function saveGlobalInstanceConfig(supabase: any, instanceId: string) {
    await supabase
        .from('app_config')
        .upsert([
            { key: 'agent_default_instance_id', value: instanceId },
        ], { onConflict: 'key' })
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
            is_active: false,
            system_prompt: '',
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
        const requestedInstanceType = normalizeInstanceType(body?.instance_type)
        let isGlobalInstance = requestedInstanceType === 'global'

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
            if (isGlobalInstanceRecord(instance)) {
                isGlobalInstance = true
            }
            if (isGlobalInstance) {
                await updateInstanceWithCompatibility(supabase, instance.id, {
                    instance_type: 'global',
                    updated_at: new Date().toISOString(),
                })
                await saveGlobalInstanceConfig(supabase, instance.id)
                instance = { ...instance, instance_type: 'global' }
            }
        } else if (instance_name) {
            // Scenario 2: create new instance

            // Check if there is already an instance for this broker/user
            let existing: any = null
            if (isGlobalInstance) {
                const { data: configRow } = await supabase
                    .from('app_config')
                    .select('value')
                    .eq('key', 'agent_default_instance_id')
                    .maybeSingle()
                const defaultInstanceId = String(configRow?.value || '').trim()
                if (defaultInstanceId) {
                    const { data } = await supabase
                        .from('whatsapp_instances')
                        .select('*')
                        .eq('id', defaultInstanceId)
                        .maybeSingle()
                    existing = data || null
                }
                if (!existing) {
                    const { data } = await supabase
                        .from('whatsapp_instances')
                        .select('*')
                        .eq('instance_name', instance_name)
                        .maybeSingle()
                    existing = data || null
                }
            } else {
                if (!broker_id && !admin_user_id) {
                    return NextResponse.json({ success: false, message: 'Informe broker_id, admin_user_id ou instance_type=global.' }, { status: 400 })
                }
                let existingQuery = supabase.from('whatsapp_instances').select('*')
                if (broker_id) {
                    existingQuery = existingQuery.eq('broker_id', broker_id)
                } else if (admin_user_id) {
                    existingQuery = existingQuery.eq('admin_user_id', admin_user_id)
                }
                const { data } = await existingQuery.limit(1).maybeSingle()
                existing = data || null
            }

            if (existing?.instance_token) {
                // Already has instance -> reconnect
                instance = existing
                if (isGlobalInstance) {
                    await updateInstanceWithCompatibility(supabase, existing.id, {
                        instance_type: 'global',
                        updated_at: new Date().toISOString(),
                    })
                    await saveGlobalInstanceConfig(supabase, existing.id)
                    instance = { ...instance, instance_type: 'global' }
                }
            } else {
                const reusableProviderInstance = await findReusableConnectyHubInstance({
                    instanceName: instance_name,
                    adminUserId: admin_user_id,
                })

                let token = ''
                let providerStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected'

                if (reusableProviderInstance) {
                    token = extractProviderInstanceToken(reusableProviderInstance)
                    providerStatus = localStatusFromProvider(reusableProviderInstance)
                    console.log('[QR Code] Reutilizando instancia pendente da ConnectyHub')
                } else {
                    // Create at ConnectyHub
                    console.log(`[QR Code] Criando instancia: ${instance_name}`)
                    const createResult = await createInstance(instance_name)
                    console.log('[QR Code] Resultado createInstance:', JSON.stringify(createResult).substring(0, 200))
                    token = createResult.token || createResult.instance?.token || createResult.apikey || ''
                }

                if (!token) {
                    return NextResponse.json({
                        success: false,
                        message: 'Falha ao obter instanceId da ConnectyHub. Verifique as configuracoes da ConnectyHub.',
                    }, { status: 500 })
                }

                // If there was a row without token, update. Otherwise insert.
                if (existing) {
                    const existingConfig = existing?.config && typeof existing.config === 'object' ? existing.config : null
                    const updates: Record<string, any> = {
                        instance_token: token,
                        instance_name,
                        instance_type: requestedInstanceType,
                        config: withConnectyHubInstanceId(existingConfig, token),
                        updated_at: new Date().toISOString(),
                    }
                    await updateInstanceWithCompatibility(supabase, existing.id, updates)
                    instance = { ...existing, ...updates }
                } else {
                    const insertData: any = {
                        instance_name,
                        instance_token: token,
                        status: providerStatus,
                        instance_type: requestedInstanceType,
                        config: withConnectyHubInstanceId(null, token),
                    }
                    if (broker_id) insertData.broker_id = broker_id
                    if (admin_user_id) insertData.admin_user_id = admin_user_id
                    // admin_user_id is NOT NULL, if broker without user use null UUID
                    if (!admin_user_id && broker_id) insertData.admin_user_id = '00000000-0000-0000-0000-000000000000'
                    if (isGlobalInstance && !admin_user_id && !broker_id) insertData.admin_user_id = '00000000-0000-0000-0000-000000000000'

                    const { data: newInst, error: insertErr } = await insertInstanceWithCompatibility(supabase, insertData)

                    if (insertErr) {
                        console.error('[QR Code] Erro ao salvar instancia:', insertErr)
                        return NextResponse.json({ success: false, message: `Erro ao salvar: ${insertErr.message}` }, { status: 500 })
                    }
                    instance = newInst
                }

                if (isGlobalInstance && instance?.id) {
                    await saveGlobalInstanceConfig(supabase, instance.id)
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
        if (!isGlobalInstance && !broker_id && instance?.admin_user_id) {
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

        // Extract QR code from ConnectyHub response variants.
        let qrcode = extractQrCode(result)
        let pairingCode = extractPairingCode(result)

        // If connect didn't return QR, poll status endpoint
        if (!qrcode) {
            console.log('[QR Code] QR nao veio no connect, buscando via /instance/status...')
            const { getInstanceStatus } = await import('@/lib/connectyhub/whatsapp')

            await new Promise(resolve => setTimeout(resolve, 2000))
            const statusResult = await getInstanceStatus(instance.instance_token)
            console.log('[QR Code] Resultado status:', JSON.stringify(statusResult).substring(0, 300))

            qrcode = extractQrCode(statusResult)
            pairingCode = pairingCode || extractPairingCode(statusResult)
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
