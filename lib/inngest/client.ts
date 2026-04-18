import { EventSchemas, Inngest } from 'inngest'

export const inngest = new Inngest({
    id: 'pilger-landing',
    schemas: new EventSchemas().fromRecord<{
        'lead/created': {
            data: {
                lead_id: string
                phone: string
                name?: string
                property_title?: string
            }
        }
        'lead/schedule-followup': {
            data: {
                phone: string
                name?: string
                delay_minutes: number
                message_template: string
                property_title?: string
            }
        }
        'lead/vip-detected': {
            data: {
                name?: string
                phone: string
                property_title?: string
                ai_summary?: string
            }
        }
        'automation/execute-rule': {
            data: {
                rule_id: string
                lead_id: string
                phone: string
                name?: string
                delay_minutes: number
                message_template: string
                property_title?: string
            }
        }
        // --- Ads / Tráfego ---
        'ads/campaign-created': {
            data: {
                campaign_id: string
            }
        }
        'ads/ai-analyze': {
            data: {
                campaign_id: string
                metrics: Record<string, unknown>
            }
        }
        'ads/execute-action': {
            data: {
                campaign_id: string
                action: string
                alert_message: string
                urgency: string
                budget_adjustment?: { type: string; new_daily_budget: number }
                campaign_name: string
                platform: string
                external_campaign_id?: string
                external_adset_id?: string
            }
        }
        // --- WhatsApp Agent ---
        'whatsapp/message-received': {
            data: {
                cleanPhone: string
                messageText: string
                messageType?: string | null
                isAudio: boolean
                buttonResponseId: string | null
                buttonResponseTitle: string | null
                pollVotes: string[] | string | null
                audioUrl: string | null
                audioMediaKey: string | null
                audioDirectPath: string | null
                messageId: string | null
                mediaUrl?: string | null
                mediaMimetype?: string | null
                mediaFilename?: string | null
                mediaType?: 'image' | 'video' | 'document' | null
                instanceId: string
                instanceToken: string
                instanceName: string
                brokerId: string | null
                senderName: string
            }
        }
        'whatsapp/from-me-message': {
            data: {
                botMsgId: string
                instanceId: string
                recipientPhone: string
            }
        }
        'whatsapp/shadow-agent': {
            data: {
                cleanPhone: string
                messageText: string
                instanceId: string
                instanceToken: string
                adminUserId: string
            }
        }
        'whatsapp/mark-read': {
            data: {
                instanceToken: string
                remotePhone?: string | null
                cleanPhone: string
            }
        }
        'whatsapp/instance-setup': {
            data: {
                instanceId: string
                instanceToken: string
                webhookBaseUrl: string
            }
        }
    }>()
})
