import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    createInstance,
    deleteInstance,
    getInstanceStatus,
    getWebhook,
    getContactAvatar,
    listAllInstances,
} from '@/lib/connectyhub/whatsapp'
import {
    extractProviderInstanceName,
    extractProviderInstanceToken,
    extractPhoneFromWhatsAppStatus,
    normalizeProviderInstances,
    normalizeWhatsAppAddress,
    normalizeWhatsAppConnectionStatus,
} from '@/lib/whatsapp/connection-status'
import {
    DEFAULT_NEW_WHATSAPP_INSTANCE_CONFIG,
    DEFAULT_WHATSAPP_INSTANCE_CONFIG,
    normalizeWhatsAppInstanceConfig,
} from '@/lib/whatsapp/instance-config'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function extractPhoneLoose(raw: any): string | null {
    if (!raw) return null
    const digits = normalizeWhatsAppAddress(raw)
    return digits || null
}

function inferInstanceType(inst: any): 'global' | 'broker' | 'sector' | 'admin' {
    const explicit = String(inst?.instance_type || '').toLowerCase()
    if (explicit === 'global' || explicit === 'broker' || explicit === 'sector' || explicit === 'admin') {
        return explicit
    }
    const name = String(inst?.instance_name || '').toLowerCase()
    if (name === 'agente global' || name === 'whatsapp global') return 'global'
    if (inst?.broker_id) return 'broker'
    if (inst?.admin_user_id && inst.admin_user_id !== '00000000-0000-0000-0000-000000000000') return 'admin'
    return 'broker'
}

function isGlobalInstanceRecord(inst: any): boolean {
    return inferInstanceType(inst) === 'global'
}

function firstString(...values: unknown[]): string | null {
    for (const value of values) {
        const text = String(value || '').trim()
        if (text) return text
    }
    return null
}

function getStoredConnectyHubInstanceId(instance: any): string | null {
    const config = instance?.config && typeof instance.config === 'object' ? instance.config : null
    return firstString(
        config?.connectyhub_instance_id,
        config?.instanceId,
        config?.instance_id,
        instance?.connectyhub_instance_id,
        instance?.instance_token
    )
}

function isRemoteInstanceAlreadyMissing(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '')
    const normalized = message.toLowerCase()
    return normalized.includes('(404)') ||
        (normalized.includes('404') && normalized.includes('instancia')) ||
        normalized.includes('instance not found') ||
        normalized.includes('instancia nao encontrada') ||
        normalized.includes('instância não encontrada')
}

function summarizeRemoteDeleteError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
    return message
        .replace(/\{[\s\S]*\}$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300) || 'Erro desconhecido'
}

async function isConnectyHubInstanceStillListed(instanceId: string, instanceName?: string | null) {
    const providerRows = normalizeProviderInstances(await listAllInstances())
    const expectedId = String(instanceId || '').trim()
    const expectedName = String(instanceName || '').trim()

    return providerRows.some((row: any) => {
        const remoteId = extractProviderInstanceToken(row)
        const remoteName = extractProviderInstanceName(row)
        return (expectedId && remoteId === expectedId) ||
            (expectedName && remoteName === expectedName)
    })
}

function extractConnectyHubProfileImage(payload: any): string | null {
    const instance = payload?.instance || payload?.data?.instance || null
    const data = payload?.data || null
    const me = payload?.me || instance?.me || null

    return firstString(
        payload?.profileImageUrl,
        payload?.profile_image_url,
        payload?.profilePicUrl,
        payload?.profilePictureUrl,
        payload?.picture,
        payload?.avatar,
        data?.profileImageUrl,
        data?.profile_image_url,
        data?.profilePicUrl,
        data?.profilePictureUrl,
        data?.picture,
        data?.avatar,
        instance?.profileImageUrl,
        instance?.profile_image_url,
        instance?.profilePicUrl,
        instance?.profilePictureUrl,
        instance?.picture,
        instance?.avatar,
        me?.profileImageUrl,
        me?.profilePicUrl,
        me?.profilePictureUrl,
        me?.picture,
        me?.avatar
    )
}

function extractConnectyHubDisplayName(payload: any): string | null {
    const instance = payload?.instance || payload?.data?.instance || null
    const data = payload?.data || null
    const me = payload?.me || instance?.me || null

    return firstString(
        payload?.displayName,
        payload?.profileName,
        payload?.pushName,
        payload?.name,
        data?.displayName,
        data?.profileName,
        data?.pushName,
        data?.name,
        instance?.displayName,
        instance?.profileName,
        instance?.pushName,
        instance?.name,
        me?.name,
        me?.pushName
    )
}

function extractConnectyHubPlatform(payload: any): string | null {
    const instance = payload?.instance || payload?.data?.instance || null

    return firstString(
        payload?.platform,
        payload?.plataform,
        payload?.device,
        payload?.systemName,
        instance?.platform,
        instance?.plataform,
        instance?.device,
        instance?.systemName
    )
}

// GET — Lista instâncias (filtra por broker_id ou admin_user_id se fornecido)
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const brokerId = request.nextUrl.searchParams.get('broker_id')
        const adminUserId = request.nextUrl.searchParams.get('admin_user_id')

        // Build query with optional filters
        let query = supabase
            .from('whatsapp_instances')
            .select('*')
        
        if (brokerId) {
            query = query.eq('broker_id', brokerId)
        }
        if (adminUserId) {
            query = query.eq('admin_user_id', adminUserId)
        }

        const { data: instances, error } = await query
            .order('created_at', { ascending: false })

        if (error) {
            console.error('[WhatsApp Instances GET]', error)
            return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        }

        if (!instances || instances.length === 0) {
            return NextResponse.json({ success: true, instances: [] })
        }

        // Fetch broker data separately (safe — won't fail if column doesn't exist)
        let brokersMap: Record<string, any> = {}
        try {
            const brokerIds = instances.map(i => i.broker_id).filter(Boolean)
            if (brokerIds.length > 0) {
                const { data: brokers } = await supabase
                    .from('virtual_brokers')
                    .select('id, name, creci, photo_url, is_active, system_prompt, voice_id, phone')
                    .in('id', brokerIds)
                if (brokers) {
                    brokers.forEach(b => { brokersMap[b.id] = b })
                }
            }
        } catch { /* broker_id column may not exist yet */ }

        // Fetch admin user data separately
        let adminsMap: Record<string, any> = {}
        try {
            const adminIds = instances.map(i => i.admin_user_id).filter(Boolean)
            if (adminIds.length > 0) {
                const { data: admins } = await supabase
                    .from('admin_users')
                    .select('id, name, email')
                    .in('id', adminIds)
                if (admins) {
                    admins.forEach(a => { adminsMap[a.id] = a })
                }
            }
        } catch { /* admin_users table may not exist */ }

        // Fallback map from admin endpoint /instance/all. It is often more reliable than
        // per-token /instance/status during provider reconnect windows.
        const providerByName: Record<string, {
            phone?: string | null
            status?: 'connected' | 'connecting' | 'disconnected' | null
            token?: string | null
            displayName?: string | null
            profileImageUrl?: string | null
        }> = {}
        try {
            const allRaw = await listAllInstances()
            const list = normalizeProviderInstances(allRaw)

            for (const row of list) {
                const name = extractProviderInstanceName(row)
                const phone = extractPhoneLoose(
                    row?.phoneNumber ||
                    row?.phone_number ||
                    row?.phone ||
                    row?.number ||
                    row?.jid ||
                    row?.me?.id ||
                    row?.instance?.phone ||
                        row?.instance?.me?.id
                )
                if (name) {
                    providerByName[String(name)] = {
                        phone,
                        status: normalizeWhatsAppConnectionStatus(row),
                        token: extractProviderInstanceToken(row) || null,
                        displayName: extractConnectyHubDisplayName(row),
                        profileImageUrl: extractConnectyHubProfileImage(row),
                    }
                }
            }
        } catch {
            // ignore provider-all failures
        }

        // Reconcile real-time status from ConnectyHub to avoid stale "connected" states.
        const reconciledInstances = await Promise.all(
            instances.map(async (inst: any) => {
                const providerSnapshot = providerByName[inst.instance_name] || null
                if (!inst.instance_token && !providerSnapshot?.token) return inst
                try {
                    const effectiveToken = providerSnapshot?.token || inst.instance_token
                    const statusResult = await getInstanceStatus(effectiveToken)
                    const endpointStatus = normalizeWhatsAppConnectionStatus(statusResult)
                    const providerStatus = providerSnapshot?.status || null
                    const realtimeStatus = endpointStatus === 'connected' || providerStatus === 'connected'
                        ? 'connected'
                        : (endpointStatus || providerStatus)
                    const resolvedStatus = realtimeStatus || inst.status
                    const phone = extractPhoneFromWhatsAppStatus(statusResult, inst.phone_number)
                    const brokerPhone = inst.broker_id ? brokersMap[inst.broker_id]?.phone || null : null
                    const providerPhone = providerSnapshot?.phone || null
                    const resolvedPhone = phone || providerPhone || brokerPhone

                    if (
                        (realtimeStatus && realtimeStatus !== inst.status) ||
                        resolvedPhone !== inst.phone_number ||
                        (providerSnapshot?.token && providerSnapshot.token !== inst.instance_token)
                    ) {
                        await supabase
                            .from('whatsapp_instances')
                            .update({
                                ...(realtimeStatus ? { status: realtimeStatus } : {}),
                                ...(providerSnapshot?.token ? { instance_token: providerSnapshot.token } : {}),
                                phone_number: resolvedPhone,
                                connected_at: resolvedStatus === 'connected'
                                    ? (inst.connected_at || new Date().toISOString())
                                    : resolvedStatus === 'disconnected'
                                        ? null
                                        : inst.connected_at,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', inst.id)
                    }

                    return {
                        ...inst,
                        instance_token: providerSnapshot?.token || inst.instance_token,
                        status: resolvedStatus,
                        phone_number: resolvedPhone,
                        connected_at: resolvedStatus === 'connected' ? (inst.connected_at || new Date().toISOString()) : inst.connected_at,
                    }
                } catch {
                    return inst
                }
            })
        )

        // Enrich each connected instance with live data from ConnectyHub
        const enrichedInstances = await Promise.all(
            reconciledInstances.map(async (inst: any) => {
                const instanceType = inferInstanceType(inst)
                const providerSnapshot = providerByName[inst.instance_name] || null
                const enriched: any = {
                    ...inst,
                    instance_type: instanceType,
                    config: normalizeWhatsAppInstanceConfig(inst.config || {}),
                    virtual_brokers: inst.broker_id && instanceType !== 'global' ? brokersMap[inst.broker_id] || null : null,
                    admin_users: inst.admin_user_id ? adminsMap[inst.admin_user_id] || null : null,
                }

                if (inst.status === 'connected' && inst.instance_token) {
                    try {
                        // Fetch live status from ConnectyHub
                        const liveStatus = await getInstanceStatus(inst.instance_token)
                        const livePhone = extractPhoneFromWhatsAppStatus(
                            liveStatus,
                            inst.phone_number || (inst.broker_id ? brokersMap[inst.broker_id]?.phone || null : null)
                        )
                        const statusPhotoUrl = extractConnectyHubProfileImage(liveStatus) || providerSnapshot?.profileImageUrl || null
                        enriched.live_data = {
                            phone: livePhone,
                            pushName: extractConnectyHubDisplayName(liveStatus) || providerSnapshot?.displayName || null,
                            platform: extractConnectyHubPlatform(liveStatus),
                            battery: liveStatus?.battery ?? null,
                            plugged: liveStatus?.plugged ?? null,
                            isOnline: liveStatus?.isOnline ?? null,
                            profilePicUrl: statusPhotoUrl,
                        }

                        // Fetch profile picture
                        const phoneNumber = enriched.live_data.phone || inst.phone_number
                        if (!enriched.live_data.profilePicUrl && phoneNumber) {
                            try {
                                const avatarData = await getContactAvatar(phoneNumber, inst.instance_token)
                                enriched.live_data.profilePicUrl =
                                    avatarData?.url ||
                                    avatarData?.profilePictureUrl ||
                                    avatarData?.profilePicUrl ||
                                    avatarData?.imgUrl ||
                                    avatarData?.profileImageUrl ||
                                    avatarData?.imagePreview ||
                                    avatarData?.image ||
                                    avatarData?.avatar ||
                                    avatarData?.data?.url ||
                                    avatarData?.data?.profileImageUrl ||
                                    avatarData?.data?.profilePictureUrl ||
                                    avatarData?.data?.imagePreview ||
                                    avatarData?.data?.image ||
                                    null
                            } catch { /* avatar not critical */ }
                        }

                        // Check webhook status
                        try {
                            const webhookData = await getWebhook(inst.instance_token)
                            enriched.live_data.webhookUrl = webhookData?.url || webhookData?.webhook || null
                        } catch { /* webhook check not critical */ }

                        // Sync broker profile with live WhatsApp data
                        if (inst.broker_id && instanceType !== 'global') {
                            try {
                                const brokerUpdates: Record<string, any> = {
                                    updated_at: new Date().toISOString(),
                                }

                                if (enriched.live_data.profilePicUrl) {
                                    brokerUpdates.photo_url = enriched.live_data.profilePicUrl
                                }
                                if (enriched.live_data.phone) {
                                    brokerUpdates.phone = String(enriched.live_data.phone).replace(/\D/g, '')
                                }
                                if (enriched.live_data.pushName) {
                                    brokerUpdates.name = enriched.live_data.pushName
                                }

                                await supabase
                                    .from('virtual_brokers')
                                    .update(brokerUpdates)
                                    .eq('id', inst.broker_id)
                            } catch {
                                // ignore sync issues to avoid breaking instances list
                            }
                        }

                    } catch (e) {
                        console.warn(`[Instances] Failed to enrich ${inst.instance_name}:`, e)
                        enriched.live_data = null
                    }
                }

                return enriched
            })
        )

        return NextResponse.json({ success: true, instances: enrichedInstances })
    } catch (error) {
        console.error('Error listing instances:', error)
        return NextResponse.json({ success: false, message: 'Erro ao listar instâncias' }, { status: 500 })
    }
}

// POST — Criar nova instância
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { adminUserId, brokerId } = await request.json()

        if (!adminUserId && !brokerId) {
            return NextResponse.json({ success: false, message: 'ID do usuário ou corretor é obrigatório' }, { status: 400 })
        }

        const prefix = brokerId ? 'broker' : 'user'
        const id = (brokerId || adminUserId).split('-')[0]
        const instanceName = `${prefix}_${id}_${Date.now()}`

        let instanceToken = ''
        try {
            const createResult = await createInstance(instanceName)
            instanceToken = createResult?.token || createResult?.instance?.token || ''
        } catch (apiErr) {
            console.warn('[WhatsApp] API creation failed, saving to DB anyway:', apiErr)
        }

        const insertData: any = {
            instance_name: instanceName,
            instance_token: instanceToken,
            status: 'disconnected',
            config: DEFAULT_NEW_WHATSAPP_INSTANCE_CONFIG,
        }
        if (adminUserId) insertData.admin_user_id = adminUserId
        if (brokerId) insertData.broker_id = brokerId

        const { data, error } = await supabase
            .from('whatsapp_instances')
            .insert(insertData)
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

        const { data: instance, error: fetchError } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('id', instanceId)
            .single()

        if (fetchError || !instance) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        if (isGlobalInstanceRecord(instance)) {
            return NextResponse.json({
                success: false,
                message: 'A instancia do WhatsApp Global e protegida. Para trocar o numero, marque outra instancia como global antes de remover esta.',
            }, { status: 400 })
        }

        const connectyHubInstanceId = getStoredConnectyHubInstanceId(instance)
        if (!connectyHubInstanceId) {
            return NextResponse.json({
                success: false,
                message: 'Instancia sem ID publico da ConnectyHub na base local. Nao foi possivel excluir no painel da ConnectyHub.',
            }, { status: 400 })
        }

        let remoteDeleteSkipped = false
        try {
            await deleteInstance(connectyHubInstanceId, instance.instance_name)
        } catch (e) {
            if (isRemoteInstanceAlreadyMissing(e)) {
                remoteDeleteSkipped = true
                console.warn('Instancia ja nao existe na ConnectyHub; removendo cadastro local:', summarizeRemoteDeleteError(e))
            } else {
                console.warn('Falha ao deletar na ConnectyHub:', e)
                return NextResponse.json({
                    success: false,
                    message: 'Nao foi possivel excluir no painel da ConnectyHub. A instancia nao foi removida localmente.',
                    details: summarizeRemoteDeleteError(e),
                }, { status: 502 })
            }
        }

        if (!remoteDeleteSkipped) {
            let stillListed = true
            try {
                stillListed = await isConnectyHubInstanceStillListed(connectyHubInstanceId, instance.instance_name)
            } catch (verifyError) {
                console.warn('Falha ao verificar se instancia ainda existe na ConnectyHub:', verifyError)
                return NextResponse.json({
                    success: false,
                    message: 'A ConnectyHub recebeu o pedido de exclusao, mas nao foi possivel confirmar que a instancia saiu do painel. A instancia nao foi removida localmente.',
                    details: summarizeRemoteDeleteError(verifyError),
                }, { status: 502 })
            }

            if (stillListed) {
                return NextResponse.json({
                    success: false,
                    message: 'A API atual da ConnectyHub removeu a sessao do provider, mas a instancia ainda aparece no painel/lista da ConnectyHub. A instancia nao foi removida localmente para evitar inconsistencia.',
                }, { status: 502 })
            }
        }

        // Delete linked AI broker as requested (best-effort for schema differences)
        if (instance.broker_id) {
            try {
                await supabase
                    .from('virtual_brokers')
                    .delete()
                    .eq('id', instance.broker_id)
            } catch (brokerDeleteErr) {
                return NextResponse.json({
                    success: false,
                    message: 'Instancia removida na API, mas nao foi possivel remover o corretor IA vinculado.',
                    details: brokerDeleteErr instanceof Error ? brokerDeleteErr.message : String(brokerDeleteErr),
                }, { status: 500 })
            }
        }

        const { error } = await supabase
            .from('whatsapp_instances')
            .delete()
            .eq('id', instanceId)

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: remoteDeleteSkipped
                ? 'Instancia nao existia mais na ConnectyHub e foi removida do banco local.'
                : 'Instancia removida na ConnectyHub e no banco local.',
        })
    } catch (error) {
        console.error('Error deleting instance:', error)
        return NextResponse.json({ success: false, message: 'Erro ao remover instância' }, { status: 500 })
    }
}

// PATCH — Vincular/desvincular instância a um corretor
export async function PATCH(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { brokerId, instanceId } = await request.json()

        if (!brokerId) {
            return NextResponse.json({ success: false, message: 'brokerId é obrigatório' }, { status: 400 })
        }

        // Sempre libera qualquer vínculo atual deste corretor
        const { data: currentLinkedInstances, error: linkedError } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, instance_type, broker_id')
            .eq('broker_id', brokerId)

        if (linkedError) {
            return NextResponse.json({ success: false, message: linkedError.message }, { status: 500 })
        }

        const nonGlobalLinkedIds = (currentLinkedInstances || [])
            .filter((inst: any) => !isGlobalInstanceRecord(inst))
            .map((inst: any) => inst.id)
            .filter(Boolean)

        if (nonGlobalLinkedIds.length > 0) {
            const { error: clearBrokerError } = await supabase
                .from('whatsapp_instances')
                .update({ broker_id: null, updated_at: new Date().toISOString() })
                .in('id', nonGlobalLinkedIds)

            if (clearBrokerError) {
                return NextResponse.json({ success: false, message: clearBrokerError.message }, { status: 500 })
            }
        }

        // Se instanceId vazio, apenas desvincula
        if (!instanceId) {
            return NextResponse.json({ success: true, message: 'Instância desvinculada do corretor' })
        }

        // Move a instância selecionada para este corretor
        const { data: selectedInstance } = await supabase
            .from('whatsapp_instances')
            .select('config, instance_name, instance_type')
            .eq('id', instanceId)
            .maybeSingle()
        if (isGlobalInstanceRecord(selectedInstance)) {
            return NextResponse.json({
                success: false,
                message: 'Esta instancia e o WhatsApp Global e nao pode ser vinculada como corretor IA.',
            }, { status: 400 })
        }
        const currentConfig = selectedInstance?.config && typeof selectedInstance.config === 'object'
            ? selectedInstance.config
            : null
        const updates: Record<string, any> = {
            broker_id: brokerId,
            updated_at: new Date().toISOString(),
        }
        if (!currentConfig || Object.keys(currentConfig).length === 0) {
            updates.config = DEFAULT_NEW_WHATSAPP_INSTANCE_CONFIG
        }

        const { error: assignError } = await supabase
            .from('whatsapp_instances')
            .update(updates)
            .eq('id', instanceId)

        if (assignError) {
            return NextResponse.json({ success: false, message: assignError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Instância vinculada com sucesso' })
    } catch (error) {
        console.error('Error assigning instance:', error)
        return NextResponse.json({ success: false, message: 'Erro ao vincular instância' }, { status: 500 })
    }
}
