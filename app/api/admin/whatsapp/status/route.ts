import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getInstanceStatus, disconnectInstance, configureWebhook, getWebhook, listAllInstances, resolveConnectyHubWebhookUrl } from '@/lib/connectyhub/whatsapp'
import { getPublicAppUrl } from '@/lib/app-url'
import {
    extractProviderInstanceName,
    extractProviderInstanceToken,
    extractPhoneFromWhatsAppStatus,
    normalizeProviderInstances,
    normalizeWhatsAppConnectionStatus,
    REQUIRED_WHATSAPP_WEBHOOK_EVENTS,
    REQUIRED_WHATSAPP_WEBHOOK_EXCLUDES,
    webhookNeedsUpdate,
} from '@/lib/whatsapp/connection-status'

const NULL_ADMIN_USER_ID = '00000000-0000-0000-0000-000000000000'

function isGlobalInstanceRecord(instance: any): boolean {
    const type = String(instance?.instance_type || '').trim().toLowerCase()
    const name = String(instance?.instance_name || '').trim().toLowerCase()
    return type === 'global' || name === 'agente global' || name === 'whatsapp global'
}

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function normalizeDigits(value: unknown): string {
    return String(value || '').replace(/\D/g, '')
}

function phoneCandidates(value: unknown): string[] {
    const digits = normalizeDigits(value)
    if (!digits) return []

    const set = new Set<string>()
    const add = (raw: string) => {
        const v = normalizeDigits(raw)
        if (!v) return
        set.add(v)

        const noLeadingZero = v.replace(/^0+/, '')
        if (noLeadingZero) set.add(noLeadingZero)

        if (v.startsWith('55') && v.length > 2) {
            set.add(v.slice(2))
        }

        if (!v.startsWith('55') && (v.length === 10 || v.length === 11)) {
            set.add(`55${v}`)
        }
    }

    add(digits)

    // Regra BR legada: algumas bases antigas ainda nao tem o 9o digito
    // (logo apos o DDD). Consideramos equivalentes com e sem esse digito.
    for (const candidate of [...set]) {
        if (candidate.startsWith('55')) {
            const local = candidate.slice(2) // DDD + numero
            if (local.length === 11 && local[2] === '9') {
                add(`55${local.slice(0, 2)}${local.slice(3)}`) // remove 9o digito
            }
            if (local.length === 10) {
                add(`55${local.slice(0, 2)}9${local.slice(2)}`) // adiciona 9o digito
            }
        } else {
            if (candidate.length === 11 && candidate[2] === '9') {
                add(`${candidate.slice(0, 2)}${candidate.slice(3)}`) // remove 9o digito
            }
            if (candidate.length === 10) {
                add(`${candidate.slice(0, 2)}9${candidate.slice(2)}`) // adiciona 9o digito
            }
        }
    }

    return [...set]
}

function phonesMatch(left: unknown, right: unknown): boolean {
    const leftSet = new Set(phoneCandidates(left))
    const rightSet = new Set(phoneCandidates(right))
    for (const candidate of leftSet) {
        if (rightSet.has(candidate)) return true
    }
    return false
}

function maskPhone(value: unknown): string {
    const digits = normalizeDigits(value)
    if (!digits) return 'empty'
    return `${digits.slice(0, 4)}...${digits.slice(-4)}`
}

async function ensureAiBrokerForAdminUser(params: {
    supabase: any
    adminUserId: string
    instanceId: string
    currentBrokerId?: string | null
}) {
    const { supabase, adminUserId, instanceId, currentBrokerId } = params
    if (!adminUserId || !instanceId || adminUserId === NULL_ADMIN_USER_ID) {
        return { brokerId: null as string | null, brokerCreated: false }
    }

    let brokerId = String(currentBrokerId || '').trim()
    let brokerCreated = false

    if (!brokerId) {
        const { data: previousInstance } = await supabase
            .from('whatsapp_instances')
            .select('broker_id')
            .eq('admin_user_id', adminUserId)
            .neq('id', instanceId)
            .not('broker_id', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (previousInstance?.broker_id) {
            brokerId = String(previousInstance.broker_id)
        }
    }

    if (!brokerId) {
        try {
            const { data: brokerByInstance } = await supabase
                .from('virtual_brokers')
                .select('id')
                .eq('whatsapp_instance_id', instanceId)
                .limit(1)
                .maybeSingle()

            if (brokerByInstance?.id) {
                brokerId = String(brokerByInstance.id)
            }
        } catch {
            // ignore schema/version differences
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

        const brokerPayload: any = {
            name: brokerName,
            creci: 'N/A',
            is_active: false,
            system_prompt: '',
        }

        const brokerPhone = normalizeDigits(adminUser.phone)
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

    await supabase
        .from('whatsapp_instances')
        .update({ broker_id: brokerId, updated_at: new Date().toISOString() })
        .eq('id', instanceId)

    try {
        await supabase
            .from('virtual_brokers')
            .update({ whatsapp_instance_id: instanceId, updated_at: new Date().toISOString() })
            .eq('id', brokerId)
    } catch {
        // ignore schema/version differences
    }

    try {
        await supabase
            .from('admin_users')
            .update({ whatsapp_instance_id: instanceId, updated_at: new Date().toISOString() })
            .eq('id', adminUserId)
    } catch {
        // ignore schema/version differences
    }

    return { brokerId, brokerCreated }
}

// GET - Verificar status de conexao da instancia
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const instanceId = request.nextUrl.searchParams.get('instanceId')
        const instanceName =
            request.nextUrl.searchParams.get('instance_name') ||
            request.nextUrl.searchParams.get('instanceName')

        if (!instanceId && !instanceName) {
            return NextResponse.json({ success: false, message: 'instanceId ou instance_name e obrigatorio' }, { status: 400 })
        }

        let query = supabase.from('whatsapp_instances').select('*')
        if (instanceId) {
            query = query.eq('id', instanceId)
        } else if (instanceName) {
            query = query.eq('instance_name', instanceName)
        }

        const { data: instance, error: fetchError } = await query.single()

        if (fetchError || !instance) {
            return NextResponse.json({ success: false, message: 'Instancia nao encontrada' }, { status: 404 })
        }

        if (!instance.instance_token) {
            return NextResponse.json({
                success: true,
                status: 'disconnected',
                phone: null,
                phone_number: null,
            })
        }

        let providerSnapshot: any = null
        try {
            const providerInstances = normalizeProviderInstances(await listAllInstances())
            providerSnapshot = providerInstances.find((row) => extractProviderInstanceName(row) === instance.instance_name) || null
        } catch {
            // admin snapshot is a fallback only
        }

        const effectiveToken = extractProviderInstanceToken(providerSnapshot) || instance.instance_token

        // Consultar status na ConnectyHub
        const result = await getInstanceStatus(effectiveToken)
        console.log('[Status] Resultado ConnectyHub:', JSON.stringify(result).substring(0, 300))

        const endpointStatus = normalizeWhatsAppConnectionStatus(result)
        const providerStatus = normalizeWhatsAppConnectionStatus(providerSnapshot)
        const newStatus = endpointStatus === 'connected' || providerStatus === 'connected'
            ? 'connected'
            : (endpointStatus || providerStatus || instance.status || 'disconnected')
        const phone = extractPhoneFromWhatsAppStatus(result, instance.phone_number)
            || extractPhoneFromWhatsAppStatus(providerSnapshot, instance.phone_number)

        let syncedBrokerId = instance.broker_id ? String(instance.broker_id) : null
        let brokerCreated = false
        let brokerSyncWarning: string | null = null
        let phoneValidationWarning: string | null = null

        const isGlobalInstance = isGlobalInstanceRecord(instance)
        const isRealAdminUser = Boolean(instance.admin_user_id && instance.admin_user_id !== NULL_ADMIN_USER_ID)

        if (newStatus === 'connected' && isRealAdminUser && !isGlobalInstance) {
            const { data: adminUser } = await supabase
                .from('admin_users')
                .select('id, phone')
                .eq('id', instance.admin_user_id)
                .maybeSingle()

            const expectedPhone = normalizeDigits(adminUser?.phone)

            if (!expectedPhone) {
                phoneValidationWarning = 'Este usuario nao possui telefone cadastrado para validacao. Atualize o telefone em Minha Conta.'
                console.warn('[Status] Instancia conectada sem telefone esperado cadastrado:', {
                    instanceId: instance.id,
                    adminUserId: instance.admin_user_id,
                    providerPhone: maskPhone(phone),
                })
            }

            if (!phone) {
                phoneValidationWarning = 'WhatsApp conectou, mas a API ainda nao retornou o numero. Se persistir, verifique o telefone em Minha Conta.'
                console.warn('[Status] Instancia conectada sem telefone retornado pela ConnectyHub:', {
                    instanceId: instance.id,
                    adminUserId: instance.admin_user_id,
                })
            } else if (expectedPhone && !phonesMatch(phone, expectedPhone)) {
                phoneValidationWarning = 'O numero conectado nao confere exatamente com o telefone cadastrado. A conexao foi mantida; confira o telefone em Minha Conta.'
                console.warn('[Status] Divergencia entre telefone cadastrado e telefone conectado; mantendo a sessao ativa:', {
                    instanceId: instance.id,
                    adminUserId: instance.admin_user_id,
                    providerPhone: maskPhone(phone),
                    expectedPhone: maskPhone(expectedPhone),
                })
            }

            if (!syncedBrokerId) {
                try {
                    const brokerResult = await ensureAiBrokerForAdminUser({
                        supabase,
                        adminUserId: String(instance.admin_user_id),
                        instanceId: String(instance.id),
                        currentBrokerId: instance.broker_id || null,
                    })
                    if (brokerResult.brokerId) {
                        syncedBrokerId = brokerResult.brokerId
                        brokerCreated = Boolean(brokerResult.brokerCreated)
                    }
                } catch (error) {
                    console.error('[Status] Falha ao vincular broker automatico:', error)
                    brokerSyncWarning = 'Instancia conectada, mas houve falha ao vincular o Corretor IA automaticamente.'
                }
            }
        }

        const resolvedPhoneNumber = phone || instance.phone_number || null
        const phoneChanged = Boolean(phone) && String(phone) !== String(instance.phone_number || '')
        if (newStatus !== instance.status || phoneChanged) {
            await supabase
                .from('whatsapp_instances')
                .update({
                    status: newStatus,
                    instance_token: effectiveToken,
                    phone_number: resolvedPhoneNumber,
                    connected_at: newStatus === 'connected'
                        ? (instance.connected_at || new Date().toISOString())
                        : newStatus === 'disconnected'
                            ? null
                            : instance.connected_at,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', instance.id)
        }

        // Auto-configure webhook whenever connected
        if (newStatus === 'connected' && effectiveToken) {
            try {
                const webhookUrl = await resolveConnectyHubWebhookUrl(getPublicAppUrl(request.nextUrl.origin))

                let currentWebhook: any = null
                try {
                    currentWebhook = await getWebhook(effectiveToken)
                } catch {
                    // ignore webhook read failures
                }

                if (webhookNeedsUpdate(currentWebhook, webhookUrl)) {
                    await configureWebhook({
                        enabled: true,
                        url: webhookUrl,
                        events: REQUIRED_WHATSAPP_WEBHOOK_EVENTS,
                        excludeMessages: REQUIRED_WHATSAPP_WEBHOOK_EXCLUDES,
                        addUrlEvents: false,
                        addUrlTypesMessages: false,
                    }, effectiveToken)
                    console.log(`[Status] Webhook configurado: ${webhookUrl}`)
                }
            } catch (e) {
                console.error('[Status] Erro ao configurar webhook:', e)
            }
        }

        return NextResponse.json({
            success: true,
            status: newStatus,
            phone: resolvedPhoneNumber,
            phone_number: resolvedPhoneNumber,
            broker_id: syncedBrokerId,
            broker_created: brokerCreated,
            broker_sync_warning: brokerSyncWarning,
            phone_validation_warning: phoneValidationWarning,
        })
    } catch (error) {
        console.error('Error checking status:', error)
        return NextResponse.json({
            success: false,
            message: `Erro ao verificar status: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}

// POST - Desconectar instancia
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
            return NextResponse.json({ success: false, message: 'Instancia nao encontrada' }, { status: 404 })
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

        return NextResponse.json({ success: true, message: 'Instancia desconectada' })
    } catch (error) {
        console.error('Error disconnecting:', error)
        return NextResponse.json({
            success: false,
            message: `Erro ao desconectar: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
