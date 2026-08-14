import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    sendSimpleCampaign,
    sendAdvancedCampaign,
    manageCampaign,
    listCampaigns,
} from '@/lib/connectyhub/whatsapp'
import { inngest } from '@/lib/inngest/client'
import {
    createMetaWhatsAppCampaign,
    getMetaWhatsAppDailyReport,
    getMetaWhatsAppCampaignDetail,
    listMetaWhatsAppCampaigns,
    manageMetaWhatsAppCampaign,
    retryFailedMetaWhatsAppCampaignRecipients,
} from '@/lib/meta/whatsapp-campaigns'
import { listMetaWhatsAppReplyIntents } from '@/lib/meta/whatsapp-triage'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function asMetadataRecord(value: unknown) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

const DEFAULT_META_WHATSAPP_BATCH_SIZE = 50

function normalizeMetaBatchSize(value: unknown) {
    const parsed = Math.floor(Number(value || 0))
    if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_META_WHATSAPP_BATCH_SIZE
    return Math.min(parsed, 100)
}

// GET — Listar campanhas de uma instância
export async function GET(request: NextRequest) {
    try {
        const provider = request.nextUrl.searchParams.get('provider')
        if (provider === 'meta_whatsapp') {
            const report = request.nextUrl.searchParams.get('report')
            if (report === 'reply_intents') {
                const result = await listMetaWhatsAppReplyIntents({
                    campaignId: request.nextUrl.searchParams.get('campaign_id'),
                    intent: request.nextUrl.searchParams.get('intent'),
                    date: request.nextUrl.searchParams.get('date'),
                    limit: Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') || 200), 1), 500),
                })
                return NextResponse.json({ success: true, provider: 'meta_whatsapp', ...result })
            }
            if (report === 'daily') {
                const result = await getMetaWhatsAppDailyReport({
                    date: request.nextUrl.searchParams.get('date'),
                })
                return NextResponse.json({ success: true, provider: 'meta_whatsapp', report: 'daily', ...result })
            }

            const campaignId = request.nextUrl.searchParams.get('campaign_id')
            if (campaignId) {
                const [detail, replies] = await Promise.all([
                    getMetaWhatsAppCampaignDetail({
                        campaignId,
                        limit: Number(request.nextUrl.searchParams.get('limit') || 80),
                    }),
                    listMetaWhatsAppReplyIntents({ campaignId, limit: 80 }),
                ])
                return NextResponse.json({
                    success: true,
                    provider: 'meta_whatsapp',
                    ...detail,
                    replyIntents: replies.replies || [],
                })
            }

            const result = await listMetaWhatsAppCampaigns({
                status: request.nextUrl.searchParams.get('status'),
                limit: Number(request.nextUrl.searchParams.get('limit') || 40),
            })
            return NextResponse.json({ success: true, provider: 'meta_whatsapp', ...result })
        }

        const instanceId = request.nextUrl.searchParams.get('instance_id')

        if (!instanceId) {
            return NextResponse.json({ success: false, message: 'instance_id obrigatório' }, { status: 400 })
        }

        const supabase = getSupabase()
        const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('instance_token, instance_name')
            .eq('id', instanceId)
            .single()

        if (!instance?.instance_token) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        const campaigns = await listCampaigns(instance.instance_token)
        return NextResponse.json({ success: true, campaigns })
    } catch (error) {
        console.error('[Campaigns GET]', error)
        return NextResponse.json({ success: false, message: 'Erro ao listar campanhas' }, { status: 500 })
    }
}

// POST — Criar/enviar campanha ou gerenciar campanha existente
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { action, instanceId, ...campaignData } = body

        if (action === 'meta_whatsapp' || action === 'meta_template') {
            let contactListMetadata: Record<string, unknown> = {}
            const contactListId = String(campaignData.contactListId || campaignData.contact_list_id || '').trim()
            if (contactListId) {
                const { data: contactList } = await supabase
                    .from('meta_whatsapp_contact_lists')
                    .select('id, name, valid_contacts, source_file_name, metadata')
                    .eq('id', contactListId)
                    .maybeSingle()

                if (contactList) {
                    const listMetadata = asMetadataRecord(contactList.metadata)
                    contactListMetadata = {
                        contact_list_id: contactList.id,
                        contact_list_name: contactList.name,
                        contact_list_valid_contacts: contactList.valid_contacts,
                        contact_list_source_file_name: contactList.source_file_name,
                        contact_list_whatsapp_validation: asMetadataRecord(listMetadata.whatsapp_validation),
                    }
                }
            }

            const whatsAppValidationMode = campaignData.whatsAppValidationMode === 'include_unverified'
                || campaignData.whatsapp_validation_mode === 'include_unverified'
                || campaignData.allowUnverifiedWhatsApp === true
                || campaignData.allow_unverified_whatsapp === true
                ? 'include_unverified'
                : 'confirmed_only'
            const creativeDeduplicationMode = campaignData.creativeDeduplicationMode === 'allow_repeat'
                || campaignData.creative_deduplication_mode === 'allow_repeat'
                ? 'allow_repeat'
                : 'skip_previous'

            const result = await createMetaWhatsAppCampaign({
                name: campaignData.name || campaignData.folder || `Campanha Meta ${new Date().toLocaleDateString('pt-BR')}`,
                campaignType: campaignData.campaignType || campaignData.campaign_type || 'marketing',
                templateName: campaignData.templateName || campaignData.template_name,
                templateLanguage: campaignData.templateLanguage || campaignData.template_language || campaignData.language,
                numbers: campaignData.numbers,
                recipients: campaignData.recipients,
                scheduledFor: campaignData.scheduled_for || campaignData.scheduledFor,
                confirmOptIn: Boolean(campaignData.confirmOptIn || campaignData.confirm_opt_in),
                optInSource: campaignData.optInSource || campaignData.opt_in_source || 'site_lead_authorized',
                senderRoutingMode: campaignData.senderRoutingMode || campaignData.sender_routing_mode || 'weighted_pool',
                defaultSenderId: campaignData.defaultSenderId || campaignData.default_sender_id || null,
                whatsAppValidationMode,
                creativeDeduplicationMode,
                templateParameters: campaignData.templateParameters || campaignData.template_parameters || {},
                audienceSource: contactListId ? 'saved_contact_list' : campaignData.audienceSource || campaignData.audience_source || 'custom_paste',
                metadata: {
                    ...contactListMetadata,
                    whatsapp_validation_mode: whatsAppValidationMode,
                    creative_deduplication_mode: creativeDeduplicationMode,
                    contact_segment: asMetadataRecord(campaignData.contactSegment || campaignData.contact_segment),
                    created_from: 'admin_whatsapp_campaigns',
                    legacy_instance_id_ignored: instanceId || null,
                },
            })

            if (result.queuedCount > 0) {
                await inngest.send({
                    name: 'meta-whatsapp/campaign-created',
                    data: {
                        campaign_id: result.campaign.id,
                        reason: 'admin_meta_whatsapp_campaign',
                        batch_size: normalizeMetaBatchSize(campaignData.batchSize || campaignData.batch_size),
                    },
                })
            }

            return NextResponse.json({
                success: true,
                campaign: result.campaign,
                queued: result.queuedCount,
                skipped: result.skippedCount,
                message: result.queuedCount > 0
                    ? `Campanha lancada com sucesso. ${result.queuedCount} contato(s) foram 100% liberados para envio em segundo plano pela Meta.${result.skippedCount > 0 ? ` ${result.skippedCount} contato(s) foram bloqueados por opt-out, validacao, regra de lista ou criativo repetido.` : ''}`
                    : `Campanha preparada, mas nenhum contato ficou elegivel para envio.${result.skippedCount > 0 ? ` ${result.skippedCount} contato(s) foram bloqueados por opt-out, validacao, regra de lista ou criativo repetido.` : ''}`,
            })
        }

        if (action === 'meta_manage') {
            const manageAction = campaignData.manageAction || campaignData.manage_action
            let normalizedAction: 'pause' | 'resume' | 'cancel' | 'delete' = 'pause'
            if (manageAction === 'delete' || manageAction === 'hide') normalizedAction = 'delete'
            if (manageAction === 'resume' || manageAction === 'continue') normalizedAction = 'resume'
            if (manageAction === 'cancel') normalizedAction = 'cancel'

            const campaignId = campaignData.campaignId || campaignData.campaign_id
            const result = await manageMetaWhatsAppCampaign({
                campaignId,
                action: normalizedAction,
            })

            if (result.status === 'queued') {
                await inngest.send({
                    name: 'meta-whatsapp/campaign-created',
                    data: {
                        campaign_id: campaignId,
                        reason: 'admin_meta_whatsapp_campaign_resumed',
                        batch_size: normalizeMetaBatchSize(campaignData.batchSize || campaignData.batch_size),
                    },
                })
            }

            return NextResponse.json({
                success: true,
                result,
                message: result.status === 'deleted'
                    ? 'Campanha Meta excluida do painel.'
                    : `Campanha Meta ${result.status}.`,
            })
        }

        if (action === 'meta_retry_failed') {
            const campaignId = campaignData.campaignId || campaignData.campaign_id
            const result = await retryFailedMetaWhatsAppCampaignRecipients({ campaignId })

            if (result.queued > 0) {
                await inngest.send({
                    name: 'meta-whatsapp/campaign-created',
                    data: {
                        campaign_id: campaignId,
                        reason: 'admin_meta_whatsapp_campaign_retry_failed',
                        batch_size: normalizeMetaBatchSize(campaignData.batchSize || campaignData.batch_size),
                    },
                })
            }

            return NextResponse.json({
                success: true,
                result,
                message: result.message,
            })
        }

        if (!instanceId) {
            return NextResponse.json({ success: false, message: 'instanceId obrigatório' }, { status: 400 })
        }

        const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('instance_token, instance_name')
            .eq('id', instanceId)
            .single()

        if (!instance?.instance_token) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        // Manage existing campaign (pause/continue/delete)
        if (action === 'manage') {
            const { folderId, manageAction } = campaignData
            const result = await manageCampaign(folderId, manageAction, instance.instance_token)
            return NextResponse.json({ success: true, result })
        }

        // Create new simple campaign
        if (action === 'simple') {
            const { numbers, type, text, file, folder, delayMin, delayMax, scheduled_for } = campaignData

            if (!numbers || numbers.length === 0) {
                return NextResponse.json({ success: false, message: 'Lista de números é obrigatória' }, { status: 400 })
            }

            // Convert numbers to JID format
            const jids = numbers.map((n: string) => {
                const clean = n.replace(/\D/g, '')
                return clean.includes('@') ? clean : `${clean}@s.whatsapp.net`
            })

            const result = await sendSimpleCampaign({
                numbers: jids,
                type: type || 'text',
                text,
                file,
                folder: folder || `campanha_${Date.now()}`,
                delayMin: delayMin || 10,
                delayMax: delayMax || 30,
                scheduled_for,
            }, instance.instance_token)

            // Log the campaign in Supabase
            await supabase.from('app_config').insert({
                key: `_campaign_${Date.now()}`,
                value: JSON.stringify({
                    instanceId,
                    instanceName: instance.instance_name,
                    type,
                    recipientCount: jids.length,
                    folder: folder || `campanha_${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    status: scheduled_for ? 'scheduled' : 'sending',
                }),
                updated_at: new Date().toISOString(),
            })

            return NextResponse.json({
                success: true,
                result,
                message: `Campanha enviada para ${jids.length} contatos`,
            })
        }

        // Create advanced campaign (per-recipient messages)
        if (action === 'advanced') {
            const { messages, delayMin, delayMax, info, scheduled_for } = campaignData
            const result = await sendAdvancedCampaign({
                messages,
                delayMin: delayMin || 10,
                delayMax: delayMax || 30,
                info,
                scheduled_for,
            }, instance.instance_token)

            return NextResponse.json({ success: true, result })
        }

        return NextResponse.json({ success: false, message: 'action inválida (use: simple, advanced, manage, meta_whatsapp, meta_manage)' }, { status: 400 })
    } catch (error) {
        console.error('[Campaigns POST]', error)
        return NextResponse.json({
            success: false,
            message: `Erro: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
