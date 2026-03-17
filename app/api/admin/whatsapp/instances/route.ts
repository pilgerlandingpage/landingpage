import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    createInstance,
    deleteInstance,
    getInstanceStatus,
    getWebhook,
    getContactAvatar,
} from '@/lib/uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
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
                    .select('id, name, creci, photo_url, is_active, system_prompt, voice_id')
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

        // Enrich each connected instance with live data from ConnectyHub
        const enrichedInstances = await Promise.all(
            instances.map(async (inst: any) => {
                const enriched: any = {
                    ...inst,
                    virtual_brokers: inst.broker_id ? brokersMap[inst.broker_id] || null : null,
                    admin_users: inst.admin_user_id ? adminsMap[inst.admin_user_id] || null : null,
                }

                if (inst.status === 'connected' && inst.instance_token) {
                    try {
                        // Fetch live status from ConnectyHub
                        const liveStatus = await getInstanceStatus(inst.instance_token)
                        enriched.live_data = {
                            phone: liveStatus?.phone || liveStatus?.me?.id?.split(':')[0] || inst.phone_number,
                            pushName: liveStatus?.pushName || liveStatus?.me?.name || liveStatus?.profileName || null,
                            platform: liveStatus?.platform || liveStatus?.device || null,
                            battery: liveStatus?.battery ?? null,
                            plugged: liveStatus?.plugged ?? null,
                            isOnline: liveStatus?.isOnline ?? null,
                        }

                        // Fetch profile picture
                        const phoneNumber = enriched.live_data.phone || inst.phone_number
                        if (phoneNumber) {
                            try {
                                const avatarData = await getContactAvatar(phoneNumber, inst.instance_token)
                                enriched.live_data.profilePicUrl = avatarData?.url || avatarData?.profilePictureUrl || avatarData?.imgUrl || null
                            } catch { /* avatar not critical */ }
                        }

                        // Check webhook status
                        try {
                            const webhookData = await getWebhook(inst.instance_token)
                            enriched.live_data.webhookUrl = webhookData?.url || webhookData?.webhook || null
                        } catch { /* webhook check not critical */ }

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
        const { instanceId } = await request.json()

        const { data: instance, error: fetchError } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('id', instanceId)
            .single()

        if (fetchError || !instance) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        try {
            await deleteInstance(instance.instance_name)
        } catch (e) {
            console.warn('Falha ao deletar na uazapi:', e)
        }

        const { error } = await supabase
            .from('whatsapp_instances')
            .delete()
            .eq('id', instanceId)

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Instância removida com sucesso' })
    } catch (error) {
        console.error('Error deleting instance:', error)
        return NextResponse.json({ success: false, message: 'Erro ao remover instância' }, { status: 500 })
    }
}
