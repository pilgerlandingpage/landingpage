export type PushEditorialTemplateDefinition = {
    id: string
    name: string
    trigger: string
    audience: string
    title: string
    body: string
    ctaLabel: string
    status: 'active' | 'draft' | 'paused'
}

export const PUSH_EDITORIAL_TEMPLATE_TRIGGERS = [
    'blog_published',
    'news_published',
    'custom',
] as const

export const PUSH_EDITORIAL_TEMPLATE_AUDIENCES = [
    'all_leads',
    'active_leads',
    'event_leads',
    'property_leads',
    'broker_candidates',
    'custom',
] as const

export const DEFAULT_PUSH_EDITORIAL_TEMPLATES: PushEditorialTemplateDefinition[] = [
    {
        id: 'push-blog-editorial',
        name: 'Blog publicado',
        trigger: 'blog_published',
        audience: 'active_leads',
        title: 'Novo artigo para voce',
        body: '{nome}, separei uma leitura sobre {titulo_blog}. Toque para abrir.',
        ctaLabel: 'Ler artigo',
        status: 'active',
    },
    {
        id: 'push-news-editorial',
        name: 'Noticia publicada',
        trigger: 'news_published',
        audience: 'active_leads',
        title: 'Nova noticia no radar',
        body: '{nome}, saiu uma noticia sobre {titulo_noticia}. Toque para acompanhar.',
        ctaLabel: 'Ler noticia',
        status: 'active',
    },
]

const TRIGGER_SET = new Set<string>(PUSH_EDITORIAL_TEMPLATE_TRIGGERS)
const AUDIENCE_SET = new Set<string>(PUSH_EDITORIAL_TEMPLATE_AUDIENCES)
const STATUS_SET = new Set<string>(['active', 'draft', 'paused'])

function cleanText(value: unknown, fallback = '', max = 500) {
    return String(value ?? fallback).trim().slice(0, max)
}

function normalizeTemplateId(value: unknown, fallback: string) {
    const id = cleanText(value, fallback, 80)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')

    return id || fallback
}

function mergeDefaultTemplates(templates: PushEditorialTemplateDefinition[]) {
    const ids = new Set(templates.map(template => template.id))
    const missingDefaults = DEFAULT_PUSH_EDITORIAL_TEMPLATES.filter(template => !ids.has(template.id))

    return [...templates, ...missingDefaults].slice(0, 30)
}

export function parsePushEditorialTemplatesJson(value?: string | null): PushEditorialTemplateDefinition[] {
    try {
        const parsed = JSON.parse(String(value || '[]'))
        if (!Array.isArray(parsed)) return DEFAULT_PUSH_EDITORIAL_TEMPLATES

        const normalized = parsed
            .map((item: any, index: number): PushEditorialTemplateDefinition => {
                const trigger = cleanText(item?.trigger, 'custom', 60)
                const audience = cleanText(item?.audience, 'active_leads', 60)
                const status = cleanText(item?.status, 'draft', 20)

                return {
                    id: normalizeTemplateId(item?.id, `push-template-${index + 1}`),
                    name: cleanText(item?.name, `Template ${index + 1}`, 100),
                    trigger: TRIGGER_SET.has(trigger) ? trigger : 'custom',
                    audience: AUDIENCE_SET.has(audience) ? audience : 'custom',
                    title: cleanText(item?.title, 'Guilherme Pilger', 90),
                    body: cleanText(item?.body, '{conteudo}', 220),
                    ctaLabel: cleanText(item?.ctaLabel || item?.cta_label, 'Abrir', 80),
                    status: STATUS_SET.has(status) ? status as PushEditorialTemplateDefinition['status'] : 'draft',
                }
            })
            .filter(item => item.name && item.title && item.body)
            .slice(0, 30)

        return normalized.length ? mergeDefaultTemplates(normalized) : DEFAULT_PUSH_EDITORIAL_TEMPLATES
    } catch {
        return DEFAULT_PUSH_EDITORIAL_TEMPLATES
    }
}

export function getDefaultPushEditorialTemplatesJson() {
    return JSON.stringify(DEFAULT_PUSH_EDITORIAL_TEMPLATES)
}

export function normalizePushEditorialTemplatesJson(value?: string | null) {
    return JSON.stringify(parsePushEditorialTemplatesJson(value))
}
