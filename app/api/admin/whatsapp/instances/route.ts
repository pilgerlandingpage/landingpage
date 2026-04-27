import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    createInstance,
    deleteInstance,
    getInstanceStatus,
    getWebhook,
    getContactAvatar,
    listAllInstances,
} from '@/lib/uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function normalizeInstanceStatus(result: any): 'disconnected' | 'connecting' | 'connected' {
    const isConnected = result?.status?.connected === true || result?.connected === true
    const isLoggedIn = result?.status?.loggedIn === true || result?.loggedIn === true
    const isConnecting = result?.response?.includes?.('Connecting') || result?.instance?.qrcode || result?.qrcode
    if (isConnected && isLoggedIn) return 'connected'
    if (isConnected || isConnecting) return 'connecting'
    return 'disconnected'
}

function normalizeWhatsAppAddress(raw: unknown): string {
    const text = String(raw || '').trim()
    if (!text) return ''
    const beforeAt = text.split('@')[0] || ''
    const beforeDevice = beforeAt.split(':')[0] || ''
    return beforeDevice.replace(/\D/g, '')
}

function extractPhoneFromStatus(result: any, fallback?: string | null): string | null {
    const raw =
        result?.instance?.phone ||
        result?.phone ||
        result?.number ||
        result?.jid ||
        result?.status?.jid ||
        result?.me?.id ||
        result?.instance?.me?.id ||
        fallback ||
        null

    if (!raw) return null
    const digits = normalizeWhatsAppAddress(raw)
    return digits || null
}

function extractPhoneLoose(raw: any): string | null {
    if (!raw) return null
    const digits = normalizeWhatsAppAddress(raw)
    return digits || null
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

        // Fallback map from admin endpoint /instance/all (some providers expose phone only there)
        const providerPhoneByName: Record<string, string> = {}
        try {
            const allRaw = await listAllInstances()
            const list = Array.isArray(allRaw)
                ? allRaw
                : (Array.isArray(allRaw?.instances) ? allRaw.instances
                    : (Array.isArray(allRaw?.data) ? allRaw.data : []))

            for (const row of list) {
                const name = row?.name || row?.instance_name || row?.instanceName || row?.instance?.name
                const phone = extractPhoneLoose(
                    row?.phone ||
                    row?.number ||
                    row?.jid ||
                    row?.me?.id ||
                    row?.instance?.phone ||
                    row?.instance?.me?.id
                )
                if (name && phone) providerPhoneByName[String(name)] = phone
            }
        } catch {
            // ignore provider-all failures
        }

        // Reconcile real-time status from UAZAPI to avoid stale "connected" states.
        const reconciledInstances = await Promise.all(
            instances.map(async (inst: any) => {
                if (!inst.instance_token) return inst
                try {
                    const statusResult = await getInstanceStatus(inst.instance_token)
                    const realtimeStatus = normalizeInstanceStatus(statusResult)
                    const phone = extractPhoneFromStatus(statusResult, inst.phone_number)
                    const brokerPhone = inst.broker_id ? brokersMap[inst.broker_id]?.phone || null : null
                    const providerPhone = providerPhoneByName[inst.instance_name] || null
                    const resolvedPhone = phone || providerPhone || brokerPhone

                    if (realtimeStatus !== inst.status || resolvedPhone !== inst.phone_number) {
                        await supabase
                            .from('whatsapp_instances')
                            .update({
                                status: realtimeStatus,
                                phone_number: resolvedPhone,
                                connected_at: realtimeStatus === 'connected' ? (inst.connected_at || new Date().toISOString()) : null,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', inst.id)
                    }

                    return {
                        ...inst,
                        status: realtimeStatus,
                        phone_number: resolvedPhone,
                        connected_at: realtimeStatus === 'connected' ? (inst.connected_at || new Date().toISOString()) : null,
                    }
                } catch {
                    return inst
                }
            })
        )

        // Enrich each connected instance with live data from ConnectyHub
        const enrichedInstances = await Promise.all(
            reconciledInstances.map(async (inst: any) => {
                const enriched: any = {
                    ...inst,
                    virtual_brokers: inst.broker_id ? brokersMap[inst.broker_id] || null : null,
                    admin_users: inst.admin_user_id ? adminsMap[inst.admin_user_id] || null : null,
                }

                if (inst.status === 'connected' && inst.instance_token) {
                    try {
                        // Fetch live status from ConnectyHub
                        const liveStatus = await getInstanceStatus(inst.instance_token)
                        const livePhone = extractPhoneFromStatus(
                            liveStatus,
                            inst.phone_number || (inst.broker_id ? brokersMap[inst.broker_id]?.phone || null : null)
                        )
                        const statusPhotoUrl =
                            liveStatus?.profilePicUrl ||
                            liveStatus?.profilePictureUrl ||
                            liveStatus?.picture ||
                            liveStatus?.avatar ||
                            liveStatus?.instance?.profilePicUrl ||
                            liveStatus?.instance?.profilePictureUrl ||
                            liveStatus?.me?.profilePicUrl ||
                            liveStatus?.me?.picture ||
                            null
                        enriched.live_data = {
                            phone: livePhone,
                            pushName: liveStatus?.pushName || liveStatus?.me?.name || liveStatus?.profileName || null,
                            platform: liveStatus?.platform || liveStatus?.device || null,
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
                                    avatarData?.avatar ||
                                    avatarData?.data?.url ||
                                    avatarData?.data?.profilePictureUrl ||
                                    null
                            } catch { /* avatar not critical */ }
                        }

                        // Check webhook status
                        try {
                            const webhookData = await getWebhook(inst.instance_token)
                            enriched.live_data.webhookUrl = webhookData?.url || webhookData?.webhook || null
                        } catch { /* webhook check not critical */ }

                        // Sync broker profile with live WhatsApp data
                        if (inst.broker_id) {
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
            const uazapiResult = await createInstance(instanceName)
            instanceToken = uazapiResult?.token || uazapiResult?.instance?.token || ''
        } catch (apiErr) {
            console.warn('[WhatsApp] API creation failed, saving to DB anyway:', apiErr)
        }

        const insertData: any = {
            instance_name: instanceName,
            instance_token: instanceToken,
            status: 'disconnected',
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
        const { instanceId, forceLocalDelete = false } = await request.json()

        const { data: instance, error: fetchError } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('id', instanceId)
            .single()

        if (fetchError || !instance) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        if (!forceLocalDelete) {
            if (!instance.instance_token) {
                return NextResponse.json({
                    success: false,
                    message: 'Instancia sem token na base local. Nao foi possivel excluir no servidor da API.',
                }, { status: 400 })
            }
            try {
                await deleteInstance(instance.instance_token, instance.instance_name)
            } catch (e) {
                console.warn('Falha ao deletar na uazapi:', e)
                return NextResponse.json({
                    success: false,
                    message: 'Nao foi possivel excluir no servidor da API. A instancia nao foi removida localmente.',
                    details: e instanceof Error ? e.message : String(e),
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
            message: forceLocalDelete
                ? 'Instancia removida localmente (forcado).'
                : 'Instancia removida no servidor da API e no banco local.',
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
        const { error: clearBrokerError } = await supabase
            .from('whatsapp_instances')
            .update({ broker_id: null, updated_at: new Date().toISOString() })
            .eq('broker_id', brokerId)

        if (clearBrokerError) {
            return NextResponse.json({ success: false, message: clearBrokerError.message }, { status: 500 })
        }

        // Se instanceId vazio, apenas desvincula
        if (!instanceId) {
            return NextResponse.json({ success: true, message: 'Instância desvinculada do corretor' })
        }

        // Move a instância selecionada para este corretor
        const { error: assignError } = await supabase
            .from('whatsapp_instances')
            .update({ broker_id: brokerId, updated_at: new Date().toISOString() })
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
