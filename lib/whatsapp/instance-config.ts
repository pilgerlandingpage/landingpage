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

export const DEFAULT_WHATSAPP_INSTANCE_CONFIG: WhatsAppInstanceConfig = {
    agent_enabled: true,
    always_online: true,
    mark_as_read: true,
    response_mode: 'mirror',
    media_image_enabled: true,
    media_document_enabled: true,
    media_video_enabled: true,
    media_batch_image_limit: 8,
    media_batch_video_limit: 2,
    media_batch_document_limit: 3,
    split_messages: true,
    adaptive_rapport_enabled: false,
    adaptive_rapport_mode: 'off',
    mirror_mode: true,
    audio_response: true,
    audio_transcription: true,
    human_intervention: true,
    bot_loop_protection_enabled: true,
    allow_internal_instance_messages: false,
    detect_human_request_enabled: true,
    detect_reschedule_cancel_enabled: true,
    detect_property_capture_enabled: true,
    detect_location_enabled: true,
    detect_opt_out_enabled: true,
    analyze_links_enabled: true,
    quoted_reply_context_enabled: true,
    lead_file_storage_enabled: true,
    debounce_seconds: 15,
    smart_timing_enabled: true,
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
