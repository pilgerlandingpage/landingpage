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
        'chat/handover': {
            data: {
                leadPhone: string
                leadName: string
                brokerPhone?: string
                brokerName: string
                brokerMsg: string // The message for the broker (with transcript)
                leadMsg: string // The message for the lead
                brokerConnectyhubInstance?: string
                brokerConnectyhubApiKey?: string
                brokerConnectyhubApiUrl?: string
            }
        }
        'cloner/process-url': {
            data: {
                pageId: string
                url: string
                customPrompt?: string
                userId?: string
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
    }>()
})
