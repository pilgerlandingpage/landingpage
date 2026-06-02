export type WhatsAppInstanceConfig = {
    agent_enabled: boolean
    always_online: boolean
    mark_as_read: boolean
    response_mode: 'text' | 'audio' | 'mirror'
    media_image_enabled: boolean
    media_document_enabled: boolean
    media_video_enabled: boolean
    media_batch_image_limit: number
    media_batch_video_limit: number
    media_batch_document_limit: number
    split_messages: boolean
    adaptive_rapport_enabled: boolean
    adaptive_rapport_mode: 'off' | 'soft' | 'strong'
    mirror_mode: boolean
    audio_response: boolean
    audio_transcription: boolean
    human_intervention: boolean
    bot_loop_protection_enabled: boolean
    allow_internal_instance_messages: boolean
    detect_human_request_enabled: boolean
    detect_reschedule_cancel_enabled: boolean
    detect_property_capture_enabled: boolean
    detect_location_enabled: boolean
    detect_opt_out_enabled: boolean
    analyze_links_enabled: boolean
    quoted_reply_context_enabled: boolean
    lead_file_storage_enabled: boolean
    debounce_seconds: number
    smart_timing_enabled: boolean
    timing_text_seconds: number
    timing_text_burst_seconds: number
    timing_media_caption_seconds: number
    timing_media_then_text_seconds: number
    timing_media_only_seconds: number
    timing_audio_seconds: number
    timing_audio_then_text_seconds: number
    timing_video_caption_seconds: number
    timing_video_only_seconds: number
    timing_document_caption_seconds: number
    timing_document_only_seconds: number
    timing_document_seconds: number
    timing_video_document_seconds: number
    timing_button_delay_seconds: number
    human_intervention_minutes: number
    ai_schedule_enabled: boolean
    ai_schedule_start: string
    ai_schedule_end: string
    ai_schedule_timezone: string
}

const AGENT_DEPENDENT_CONFIG_KEYS: Array<keyof WhatsAppInstanceConfig> = [
    'always_online',
    'mark_as_read',
    'media_image_enabled',
    'media_document_enabled',
    'media_video_enabled',
    'split_messages',
    'adaptive_rapport_enabled',
    'mirror_mode',
    'audio_response',
    'audio_transcription',
    'human_intervention',
    'bot_loop_protection_enabled',
    'allow_internal_instance_messages',
    'detect_human_request_enabled',
    'detect_reschedule_cancel_enabled',
    'detect_property_capture_enabled',
    'detect_location_enabled',
    'detect_opt_out_enabled',
    'analyze_links_enabled',
    'quoted_reply_context_enabled',
    'lead_file_storage_enabled',
    'smart_timing_enabled',
    'ai_schedule_enabled',
]

export const DEFAULT_WHATSAPP_INSTANCE_CONFIG: WhatsAppInstanceConfig = {
    agent_enabled: false,
    always_online: false,
    mark_as_read: false,
    response_mode: 'text',
    media_image_enabled: false,
    media_document_enabled: false,
    media_video_enabled: false,
    media_batch_image_limit: 8,
    media_batch_video_limit: 2,
    media_batch_document_limit: 3,
    split_messages: false,
    adaptive_rapport_enabled: false,
    adaptive_rapport_mode: 'off',
    mirror_mode: false,
    audio_response: false,
    audio_transcription: false,
    human_intervention: false,
    bot_loop_protection_enabled: false,
    allow_internal_instance_messages: false,
    detect_human_request_enabled: false,
    detect_reschedule_cancel_enabled: false,
    detect_property_capture_enabled: false,
    detect_location_enabled: false,
    detect_opt_out_enabled: false,
    analyze_links_enabled: false,
    quoted_reply_context_enabled: false,
    lead_file_storage_enabled: false,
    debounce_seconds: 15,
    smart_timing_enabled: false,
    timing_text_seconds: 6,
    timing_text_burst_seconds: 9,
    timing_media_caption_seconds: 10,
    timing_media_then_text_seconds: 14,
    timing_media_only_seconds: 16,
    timing_audio_seconds: 10,
    timing_audio_then_text_seconds: 14,
    timing_video_caption_seconds: 14,
    timing_video_only_seconds: 18,
    timing_document_caption_seconds: 14,
    timing_document_only_seconds: 18,
    timing_document_seconds: 18,
    timing_video_document_seconds: 18,
    timing_button_delay_seconds: 2,
    human_intervention_minutes: 60,
    ai_schedule_enabled: false,
    ai_schedule_start: '18:00',
    ai_schedule_end: '08:00',
    ai_schedule_timezone: 'America/Sao_Paulo',
}

export function normalizeWhatsAppInstanceConfig(config?: Record<string, unknown> | null): WhatsAppInstanceConfig {
    const merged = {
        ...DEFAULT_WHATSAPP_INSTANCE_CONFIG,
        ...(config || {}),
    } as WhatsAppInstanceConfig

    if (!merged.agent_enabled) {
        const mutableMerged = merged as Record<string, unknown>
        for (const key of AGENT_DEPENDENT_CONFIG_KEYS) {
            if (typeof merged[key] === 'boolean') {
                mutableMerged[key] = false
            }
        }
        merged.response_mode = 'text'
        merged.adaptive_rapport_mode = 'off'
    }

    if (!['text', 'audio', 'mirror'].includes(String(merged.response_mode || ''))) {
        merged.response_mode = merged.mirror_mode ? 'mirror' : (merged.audio_response ? 'audio' : 'text')
    }

    if (merged.response_mode === 'text') {
        merged.audio_response = false
        merged.mirror_mode = false
    } else if (merged.response_mode === 'audio') {
        merged.audio_response = true
        merged.mirror_mode = false
    } else {
        merged.audio_response = true
        merged.mirror_mode = true
    }

    if (!['off', 'soft', 'strong'].includes(String(merged.adaptive_rapport_mode || ''))) {
        merged.adaptive_rapport_mode = merged.adaptive_rapport_enabled ? 'soft' : 'off'
    }
    merged.adaptive_rapport_enabled = merged.adaptive_rapport_mode !== 'off'

    return merged
}
