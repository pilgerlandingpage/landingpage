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
        'lead/schedule-whatsapp-rescue': {
            data: {
                lead_id: string
                phone: string
                name?: string
                delay_minutes: number
            }
        }
        'lead/schedule-whatsapp-followup-flow': {
            data: {
                lead_id: string
                phone: string
                name?: string
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
        'automation/run-agent-workflow': {
            data: {
                workflow_id: string
                lead_id?: string
                phone?: string
                name?: string
                trigger_type?: string
                context?: Record<string, unknown>
            }
        }
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
        // --- Eventos ---
        'event/registration-created': {
            data: {
                event_id: string
                registration_id: string
                reason?: string
                lead_initiated_first?: boolean
            }
        }
        'event/process-message-queue': {
            data: {
                event_id?: string
                reason?: string
            }
        }
        // --- Trabalhe Conosco / Corretores ---
        'broker-candidate/created': {
            data: {
                candidate_id: string
                reason?: string
            }
        }
        'broker-candidate/process-message-queue': {
            data: {
                candidate_id?: string
                reason?: string
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
                queuedMessageKey?: string | null
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
                messageText?: string | null
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
                messageId?: string | null
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
