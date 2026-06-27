import { getPublicAppUrl } from '@/lib/app-url'
import {
    getSectorNotificationDeliveries,
    resolveSectorWhatsappInstance,
} from '@/lib/notifications/sector-recipients'
import { sendMenuMessage, sendWhatsAppMessage } from '@/lib/connectyhub/whatsapp'
import { recordAgentCentralSignal } from '@/lib/intelligence/agent-runtime'

type SupabaseAdmin = {
    from: (table: string) => any
}

type PropertyReviewNotificationResult = {
    sent: boolean
    sent_count?: number
    error_count?: number
    skipped?: boolean
    reason?: string
    error?: string
}

type PropertyReviewNotificationParams = {
    supabase: SupabaseAdmin
    property: Record<string, any>
    origin?: string | null
}

const CONFIG_KEYS = [
    'property_review_whatsapp_enabled',
    'property_review_sector_name',
    'property_review_responsible_name',
    'property_review_responsible_phone',
    'property_review_whatsapp_instance_id',
    'property_review_message_template',
    'sector_notification_recipients',
]

const DEFAULT_REVIEW_TEMPLATE = [
    '*Novo imovel aguardando analise*',
    '',
    'Setor: {setor}',
    'Responsavel: {responsavel}',
    '',
    'Imovel: {titulo}',
    'Local: {cidade}',
    'Valor: {valor}',
    'Status: Em analise',
    '',
    'Entre na sala de manutencao/admin para revisar, ajustar e publicar.',
].join('\n')

function formatCurrency(value: unknown) {
    const number = Number(value || 0)
    if (!Number.isFinite(number) || number <= 0) return 'Nao informado'
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function interpolate(template: string, variables: Record<string, string>) {
    return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? '')
}

async function getConfigMap(supabase: SupabaseAdmin) {
    const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', CONFIG_KEYS)

    if (error) throw error

    return Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')])) as Record<string, string>
}

export async function notifyPropertyReviewReady({
    supabase,
    property,
    origin,
}: PropertyReviewNotificationParams): Promise<PropertyReviewNotificationResult> {
    try {
        const configs = await getConfigMap(supabase)

        if (configs.property_review_whatsapp_enabled === 'false') {
            return { sent: false, skipped: true, reason: 'Notificacao de revisao desativada.' }
        }

        const deliveries = await getSectorNotificationDeliveries(supabase, 'marketing', { eventType: 'property_review' })
        const fallbackPhone = String(configs.property_review_responsible_phone || '').replace(/\D/g, '')
        if (!deliveries.length && fallbackPhone) {
            deliveries.push({
                phone: fallbackPhone,
                recipient: {
                    key: 'marketing',
                    label: configs.property_review_sector_name || 'Marketing',
                    responsible_name: configs.property_review_responsible_name || 'Marketing',
                    phone: fallbackPhone,
                    enabled: true,
                },
            })
        }

        if (!deliveries.length) {
            return { sent: false, skipped: true, reason: 'Telefone do responsavel pelo setor nao configurado.' }
        }

        const reviewUrl = `${getPublicAppUrl(origin)}/admin/properties?review=${encodeURIComponent(String(property.id || ''))}`
        const instanceToken = await resolveSectorWhatsappInstance(supabase)
        if (!instanceToken) {
            return { sent: false, skipped: true, reason: 'Nenhuma instancia WhatsApp conectada para envio.' }
        }

        let sentCount = 0
        let errorCount = 0

        for (const delivery of deliveries) {
            const marketingRecipient = delivery.recipient
            const variables = {
                setor: marketingRecipient?.label || configs.property_review_sector_name || 'Marketing',
                responsavel: delivery.member?.name || marketingRecipient?.responsible_name || configs.property_review_responsible_name || 'Marketing',
                titulo: String(property.title || 'Imovel sem titulo'),
                cidade: [property.city, property.state].filter(Boolean).join(', ') || 'Nao informada',
                valor: formatCurrency(property.price),
                link: reviewUrl,
            }

            const message = interpolate(
                configs.property_review_message_template || DEFAULT_REVIEW_TEMPLATE,
                variables
            )

            try {
                await sendMenuMessage({
                    phone: delivery.phone,
                    text: message,
                    type: 'button',
                    choices: [`Revisar cadastro|url:${reviewUrl}`],
                    footerText: 'Pilger Admin',
                    instanceToken,
                })
                sentCount += 1
            } catch (buttonError) {
                console.warn('[Property Review Notification] button send failed, falling back to text:', buttonError)
                try {
                    await sendWhatsAppMessage({
                        phone: delivery.phone,
                        message: `${message}\n\nRevisar cadastro: ${reviewUrl}`,
                        instanceToken,
                    })
                    sentCount += 1
                } catch (textError) {
                    errorCount += 1
                    console.error('[Property Review Notification] text fallback failed:', textError)
                }
            }
        }

        await recordAgentCentralSignal({
            supabase,
            agentId: 'internal-notifier',
            eventType: 'internal_property_review_notification_sent',
            entityType: 'property',
            entityId: property.id || null,
            source: 'internal-notifier',
            label: `Nina avisou Marketing sobre imovel em analise: ${property.title || 'sem titulo'}`,
            importanceScore: sentCount > 0 ? 60 : 44,
            metadata: {
                property_id: property.id || null,
                title: property.title || null,
                city: property.city || null,
                state: property.state || null,
                price: property.price || null,
                sent_count: sentCount,
                error_count: errorCount,
            },
            handoffTargets: ['property-register', 'creative-strategy-agent', 'ceo-agent'],
        }).catch((error: any) => {
            console.warn('[Property Review Notification] central signal failed:', error?.message || error)
        })

        return { sent: sentCount > 0, sent_count: sentCount, error_count: errorCount }
    } catch (error: any) {
        console.error('[Property Review Notification] failed:', error)
        return { sent: false, error: error?.message || String(error) }
    }
}
