export type WhatsAppEditorialTemplateDefinition = {
    id: string
    name: string
    trigger: string
    audience: string
    message: string
    ctaLabel: string
    status: 'active' | 'draft' | 'paused'
}

export const WHATSAPP_EDITORIAL_TEMPLATE_TRIGGERS = [
    'blog_published',
    'news_published',
    'custom',
] as const

export const WHATSAPP_EDITORIAL_TEMPLATE_AUDIENCES = [
    'all_leads',
    'active_leads',
    'event_leads',
    'property_leads',
    'broker_candidates',
    'custom',
] as const

export const DEFAULT_WHATSAPP_EDITORIAL_TEMPLATES: WhatsAppEditorialTemplateDefinition[] = [
    {
        id: 'whatsapp-blog-editorial',
        name: 'Blog publicado',
        trigger: 'blog_published',
        audience: 'active_leads',
        ctaLabel: 'Ler artigo',
        status: 'active',
        message: [
            'Ola, {nome}.',
            '',
            'Separei uma leitura rapida que pode te ajudar a comprar ou investir com mais contexto:',
            '',
            '*{titulo_blog}*',
            '',
            '{resumo_blog}',
            '',
            'Toque no botao para ler no site.',
            '',
            'Para parar de receber esse tipo de aviso, responda PARAR.',
        ].join('\n'),
    },
    {
        id: 'whatsapp-news-editorial',
        name: 'Noticia publicada',
        trigger: 'news_published',
        audience: 'active_leads',
        ctaLabel: 'Ler noticia',
        status: 'active',
        message: [
            'Ola, {nome}.',
            '',
            'Separei uma noticia rapida para voce acompanhar o mercado imobiliario do litoral:',
            '',
            '*{titulo_noticia}*',
            '',
            '{resumo_noticia}',
            '',
            'Toque no botao para ler a noticia no site.',
            '',
            'Para parar de receber esse tipo de aviso, responda PARAR.',
        ].join('\n'),
    },
]

const TRIGGER_SET = new Set<string>(WHATSAPP_EDITORIAL_TEMPLATE_TRIGGERS)
const AUDIENCE_SET = new Set<string>(WHATSAPP_EDITORIAL_TEMPLATE_AUDIENCES)
const STATUS_SET = new Set<string>(['active', 'draft', 'paused'])

function cleanText(value: unknown, fallback = '', max = 2000) {
    return String(value ?? fallback).trim().slice(0, max)
}

function normalizeTemplateId(value: unknown, fallback: string) {
    const id = cleanText(value, fallback, 80)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')

    return id || fallback
}

function mergeDefaultTemplates(templates: WhatsAppEditorialTemplateDefinition[]) {
    const ids = new Set(templates.map(template => template.id))
    const missingDefaults = DEFAULT_WHATSAPP_EDITORIAL_TEMPLATES.filter(template => !ids.has(template.id))

    return [...templates, ...missingDefaults].slice(0, 30)
}

export function parseWhatsAppEditorialTemplatesJson(value?: string | null): WhatsAppEditorialTemplateDefinition[] {
    try {
        const parsed = JSON.parse(String(value || '[]'))
        if (!Array.isArray(parsed)) return DEFAULT_WHATSAPP_EDITORIAL_TEMPLATES

        const normalized = parsed
            .map((item: any, index: number): WhatsAppEditorialTemplateDefinition => {
                const trigger = cleanText(item?.trigger, 'custom', 60)
                const audience = cleanText(item?.audience, 'active_leads', 60)
                const status = cleanText(item?.status, 'draft', 20)

                return {
                    id: normalizeTemplateId(item?.id, `whatsapp-template-${index + 1}`),
                    name: cleanText(item?.name, `Template ${index + 1}`, 100),
                    trigger: TRIGGER_SET.has(trigger) ? trigger : 'custom',
                    audience: AUDIENCE_SET.has(audience) ? audience : 'custom',
                    message: cleanText(item?.message, 'Ola {nome},', 4000),
                    ctaLabel: cleanText(item?.ctaLabel || item?.cta_label, 'Abrir', 80),
                    status: STATUS_SET.has(status) ? status as WhatsAppEditorialTemplateDefinition['status'] : 'draft',
                }
            })
            .filter(item => item.name && item.message)
            .slice(0, 30)

        return normalized.length ? mergeDefaultTemplates(normalized) : DEFAULT_WHATSAPP_EDITORIAL_TEMPLATES
    } catch {
        return DEFAULT_WHATSAPP_EDITORIAL_TEMPLATES
    }
}

export function getDefaultWhatsAppEditorialTemplatesJson() {
    return JSON.stringify(DEFAULT_WHATSAPP_EDITORIAL_TEMPLATES)
}

export function normalizeWhatsAppEditorialTemplatesJson(value?: string | null) {
    return JSON.stringify(parseWhatsAppEditorialTemplatesJson(value))
}
