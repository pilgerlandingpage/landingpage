import { buildTrackedWhatsAppLink } from '@/lib/tracking/whatsapp-links'
import { formatPhoneDisplay } from './utils'

export type EventWhatsAppCta = {
    phone: string
    display_phone: string
    text: string
    url: string
}

function normalizeCtaPhone(value: unknown) {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.length === 10 || digits.length === 11) return `55${digits}`
    return digits
}

export async function resolveEventWhatsAppCtaPhone(supabase: any) {
    const { data: ctaConfig } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'event_whatsapp_cta_phone')
        .maybeSingle()

    const configuredCtaPhone = normalizeCtaPhone(ctaConfig?.value)
    if (configuredCtaPhone) return configuredCtaPhone

    const { data: config } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'agent_default_instance_id')
        .maybeSingle()

    const configuredInstanceId = String(config?.value || '').trim()
    if (configuredInstanceId) {
        const { data: configured } = await supabase
            .from('whatsapp_instances')
            .select('instance_name, phone_number, status')
            .eq('id', configuredInstanceId)
            .maybeSingle()

        if (configured?.status === 'connected') {
            const phone = normalizeCtaPhone(configured.phone_number)
            if (phone) return phone
        }
    }

    const { data: connected } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, phone_number, status, connected_at, created_at')
        .eq('status', 'connected')
        .order('connected_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

    const instances = Array.isArray(connected) ? connected : []
    const preferred =
        instances.find((instance: any) => String(instance?.instance_name || '').toLowerCase().includes('agente global') && normalizeCtaPhone(instance?.phone_number)) ||
        instances.find((instance: any) => normalizeCtaPhone(instance?.phone_number))

    return preferred ? normalizeCtaPhone(preferred.phone_number) : ''
}

export function buildEventWhatsAppCta(params: {
    phone: string
    event: any
    registration: any
}): EventWhatsAppCta | null {
    const phone = normalizeCtaPhone(params.phone)
    if (!phone) return null

    const eventTitle = String(params.event?.title || 'encontro para corretores').trim()
    const leadName = String(params.registration?.full_name || '').trim()
    const text = [
        'Oi, acabei de me cadastrar no encontro para corretores.',
        leadName ? `Meu nome e ${leadName}.` : '',
        'Quero confirmar minha presenca e tirar uma duvida.',
    ].filter(Boolean).join(' ')
    const directUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`

    return {
        phone,
        display_phone: formatPhoneDisplay(phone),
        text,
        url: buildTrackedWhatsAppLink({
            url: directUrl,
            leadPhone: params.registration?.phone || null,
            label: 'Falar no WhatsApp',
            title: eventTitle,
            type: 'whatsapp',
            campaign: 'event_lead_initiated_first_contact',
            content: String(params.event?.slug || params.event?.id || 'evento'),
            source: 'event_page',
            medium: 'whatsapp_cta',
        }),
    }
}
