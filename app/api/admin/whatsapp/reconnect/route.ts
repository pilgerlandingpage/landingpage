import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { configureWebhook, getInstanceStatus, getWebhook, listAllInstances } from '@/lib/uazapi'
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

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function safeMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error || 'erro desconhecido')
}

async function readProviderSnapshotByName() {
    const rows = normalizeProviderInstances(await listAllInstances())
    const map: Record<string, any> = {}
    for (const row of rows) {
        const name = extractProviderInstanceName(row)
        if (name) map[name] = row
    }
    return map
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const instanceId = String(body?.instanceId || body?.instance_id || '').trim()
        const all = body?.all === true

        if (!instanceId && !all) {
            return NextResponse.json({ success: false, message: 'Informe instanceId ou all=true.' }, { status: 400 })
        }

        const supabase = getSupabase()
        let query = supabase
            .from('whatsapp_instances')
            .select('id, instance_name, instance_token, status, phone_number, connected_at, config')
            .order('updated_at', { ascending: false })

        if (instanceId) query = query.eq('id', instanceId)

        const { data: instances, error } = await query
        if (error) throw error

        const rows = Array.isArray(instances) ? instances : []
        if (!rows.length) {
            return NextResponse.json({ success: false, message: 'Nenhuma instancia encontrada.' }, { status: 404 })
        }

        const providerByName: Record<string, any> = await readProviderSnapshotByName().catch(() => ({}))
        const webhookUrl = `${getPublicAppUrl(request.nextUrl.origin)}/api/webhooks/whatsapp`
        const now = new Date().toISOString()

        const results = await Promise.all(rows.map(async (instance: any) => {
            const providerSnapshot = providerByName[instance.instance_name] || null
            const providerToken = extractProviderInstanceToken(providerSnapshot)
            const effectiveToken = providerToken || instance.instance_token

            if (!effectiveToken) {
                return {
                    instance_id: instance.id,
                    instance_name: instance.instance_name,
                    success: false,
                    skipped: true,
                    reason: 'missing_instance_token',
                    status: instance.status || null,
                }
            }

            try {
                const statusPayload = await getInstanceStatus(effectiveToken)
                const endpointStatus = normalizeWhatsAppConnectionStatus(statusPayload)
                const providerStatus = normalizeWhatsAppConnectionStatus(providerSnapshot)
                const nextStatus = endpointStatus === 'connected' || providerStatus === 'connected'
                    ? 'connected'
                    : (endpointStatus || providerStatus || instance.status || 'disconnected')
                const phone = extractPhoneFromWhatsAppStatus(statusPayload, instance.phone_number)
                    || extractPhoneFromWhatsAppStatus(providerSnapshot, instance.phone_number)

                let webhookConfigured = false
                let webhookUpdated = false
                let webhookError: string | null = null

                if (nextStatus === 'connected') {
                    try {
                        let currentWebhook: any = null
                        try {
                            currentWebhook = await getWebhook(effectiveToken)
                        } catch {
                            // configure below if read fails
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
                            webhookUpdated = true
                        }
                        webhookConfigured = true
                    } catch (error) {
                        webhookError = safeMessage(error)
                    }
                }

                const config = instance.config && typeof instance.config === 'object' ? instance.config : {}
                const updates: Record<string, any> = {
                    status: nextStatus,
                    instance_token: effectiveToken,
                    phone_number: phone || instance.phone_number || null,
                    connected_at: nextStatus === 'connected'
                        ? (instance.connected_at || now)
                        : nextStatus === 'disconnected'
                            ? null
                            : instance.connected_at,
                    updated_at: now,
                    config: {
                        ...config,
                        manual_reconnect_last_run_at: now,
                        manual_reconnect_last_status: nextStatus,
                        manual_reconnect_webhook_url: webhookUrl,
                        manual_reconnect_webhook_ok: webhookConfigured && !webhookError,
                        ...(webhookError ? { manual_reconnect_webhook_error: webhookError } : {}),
                    },
                }

                const { error: updateError } = await supabase
                    .from('whatsapp_instances')
                    .update(updates)
                    .eq('id', instance.id)
                if (updateError) throw updateError

                return {
                    instance_id: instance.id,
                    instance_name: instance.instance_name,
                    success: true,
                    status: nextStatus,
                    token_reconciled: Boolean(providerToken && providerToken !== instance.instance_token),
                    phone_number: phone || instance.phone_number || null,
                    webhook_configured: webhookConfigured,
                    webhook_updated: webhookUpdated,
                    webhook_error: webhookError,
                }
            } catch (error) {
                return {
                    instance_id: instance.id,
                    instance_name: instance.instance_name,
                    success: false,
                    status: instance.status || null,
                    error: safeMessage(error),
                }
            }
        }))

        const repaired = results.filter((item: any) => item.success).length
        const connected = results.filter((item: any) => item.status === 'connected').length
        const disconnected = results.filter((item: any) => item.status === 'disconnected').length
        const failed = results.length - repaired

        return NextResponse.json({
            success: failed === 0,
            message: `Reconexao verificada: ${connected} conectada(s), ${disconnected} desconectada(s), ${failed} falha(s).`,
            webhookUrl,
            results,
        }, { status: failed === results.length ? 502 : 200 })
    } catch (error) {
        console.error('[WhatsApp Reconnect]', error)
        return NextResponse.json({
            success: false,
            message: `Erro ao forcar reconexao: ${safeMessage(error)}`,
        }, { status: 500 })
    }
}
