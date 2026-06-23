import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isWhatsAppGlobalInstance } from '@/lib/whatsapp/global-identity'

export const dynamic = 'force-dynamic'

function maskPhone(value: unknown) {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.length <= 6) return `${digits.slice(0, 2)}***`
    return `${digits.slice(0, 2)}***${digits.slice(-4)}`
}

function serializeInstance(instance: any) {
    if (!instance) return null
    return {
        id: instance.id,
        instance_name: instance.instance_name,
        status: instance.status,
        phone_number: instance.phone_number,
        phone_masked: maskPhone(instance.phone_number),
        broker_id: instance.broker_id || null,
        admin_user_id: instance.admin_user_id || null,
        instance_type: isWhatsAppGlobalInstance(instance) ? 'global' : (instance.instance_type || 'broker'),
        connected_at: instance.connected_at || null,
        updated_at: instance.updated_at || null,
        created_at: instance.created_at || null,
    }
}

function isMissingRelation(error: any) {
    const message = String(error?.message || error || '').toLowerCase()
    return message.includes('does not exist') || message.includes('schema cache') || message.includes('relation')
}

async function safeCount(supabase: any, table: string, filter?: (query: any) => any) {
    try {
        let query = supabase.from(table).select('id', { count: 'exact', head: true })
        if (filter) query = filter(query)
        const { count, error } = await query
        if (error) return { count: 0, ready: !isMissingRelation(error), error: error.message }
        return { count: count || 0, ready: true, error: null }
    } catch (error: any) {
        return { count: 0, ready: false, error: error?.message || String(error) }
    }
}

async function getConfigValue(supabase: any, key: string) {
    const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', key)
        .maybeSingle()
    return String(data?.value || '').trim()
}

async function getGlobalInstance(supabase: any) {
    const configuredInstanceId = await getConfigValue(supabase, 'agent_default_instance_id')
    if (configuredInstanceId) {
        const { data } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('id', configuredInstanceId)
            .maybeSingle()
        if (data) return data
    }

    const { data: namedGlobal } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .ilike('instance_name', 'Agente global')
        .limit(1)
        .maybeSingle()

    return namedGlobal || null
}

async function getRecentCommands(supabase: any) {
    try {
        const { data, error } = await supabase
            .from('whatsapp_global_commands')
            .select('id, phone, identity_type, identity_label, command_type, target_agent, required_permission, status, command_text, created_at')
            .order('created_at', { ascending: false })
            .limit(12)

        if (error) return { ready: !isMissingRelation(error), commands: [], error: error.message }

        return {
            ready: true,
            commands: (data || []).map((row: any) => ({
                ...row,
                phone_masked: maskPhone(row.phone),
                command_text: String(row.command_text || '').slice(0, 220),
            })),
            error: null,
        }
    } catch (error: any) {
        return { ready: false, commands: [], error: error?.message || String(error) }
    }
}

export async function GET() {
    try {
        const supabase = createAdminClient()
        const globalInstance = await getGlobalInstance(supabase)

        const [
            commands,
            sessionsCount,
            overridesCount,
            adminUsersCount,
            brokerAuthorizedCount,
            propertyOwnerLegacyCount,
            propertyOwnerPrivateCount,
        ] = await Promise.all([
            getRecentCommands(supabase),
            safeCount(supabase, 'whatsapp_global_sessions'),
            safeCount(supabase, 'whatsapp_global_identity_overrides'),
            safeCount(supabase, 'admin_users', query => query.not('phone', 'is', null).eq('is_active', true)),
            safeCount(supabase, 'broker_assistant_authorized_phones', query => query.eq('is_active', true)),
            safeCount(supabase, 'properties', query => query.not('owner_phone', 'is', null)),
            safeCount(supabase, 'property_private_details', query => query.not('owner_phones', 'is', null)),
        ])

        return NextResponse.json({
            success: true,
            global_instance: serializeInstance(globalInstance),
            migration_ready: Boolean(commands.ready && sessionsCount.ready && overridesCount.ready),
            diagnostics: {
                commands_ready: commands.ready,
                sessions_ready: sessionsCount.ready,
                overrides_ready: overridesCount.ready,
                commands_error: commands.error,
                sessions_error: sessionsCount.error,
                overrides_error: overridesCount.error,
            },
            identity_sources: {
                admin_users_with_phone: adminUsersCount.count,
                broker_authorized_phones: brokerAuthorizedCount.count,
                property_owner_legacy_phones: propertyOwnerLegacyCount.count,
                property_owner_private_phones: propertyOwnerPrivateCount.count,
            },
            metrics: {
                global_sessions: sessionsCount.count,
                global_overrides: overridesCount.count,
            },
            recent_commands: commands.commands,
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const action = String(body?.action || '')
        const instanceId = String(body?.instance_id || '')

        if (action !== 'mark_global') {
            return NextResponse.json({ success: false, error: 'Acao invalida.' }, { status: 400 })
        }
        if (!instanceId) {
            return NextResponse.json({ success: false, error: 'instance_id obrigatorio.' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const update = await supabase
            .from('whatsapp_instances')
            .update({
                instance_type: 'global',
                updated_at: new Date().toISOString(),
            })
            .eq('id', instanceId)
            .select('id, instance_name, status, phone_number, broker_id, admin_user_id, instance_type, connected_at, updated_at, created_at')
            .single()

        if (update.error) {
            if (!isMissingRelation(update.error) && !String(update.error.message || '').includes('instance_type')) {
                return NextResponse.json({ success: false, error: update.error.message }, { status: 500 })
            }

            await supabase
                .from('app_config')
                .upsert([
                    { key: 'agent_default_instance_id', value: instanceId },
                ], { onConflict: 'key' })

            const { data: fallbackInstance } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('id', instanceId)
                .maybeSingle()

            return NextResponse.json({
                success: true,
                migration_ready: false,
                warning: 'A instância foi definida como padrão global, mas a coluna instance_type ainda precisa da migration.',
                global_instance: serializeInstance({ ...(fallbackInstance || {}), instance_type: 'global' }),
            })
        }

        await supabase
            .from('app_config')
            .upsert([
                { key: 'agent_default_instance_id', value: instanceId },
            ], { onConflict: 'key' })

        return NextResponse.json({
            success: true,
            global_instance: serializeInstance(update.data),
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}
