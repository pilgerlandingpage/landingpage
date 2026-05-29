export type EmailAgentTemplateDefinition = {
    id: string
    name: string
    trigger: string
    audience: string
    subject: string
    preheader: string
    html: string
    text: string
    ctaLabel: string
    status: 'active' | 'draft' | 'paused'
}

export const EMAIL_AGENT_TEMPLATE_TRIGGERS = [
    'blog_published',
    'event_reminder',
    'news_published',
    'lead_nurture',
    'custom',
] as const

export const EMAIL_AGENT_TEMPLATE_AUDIENCES = [
    'all_leads',
    'active_leads',
    'event_leads',
    'property_leads',
    'broker_candidates',
    'custom',
] as const

export const DEFAULT_EMAIL_AGENT_TEMPLATES: EmailAgentTemplateDefinition[] = [
    {
        id: 'blog-editorial',
        name: 'Blog publicado',
        trigger: 'blog_published',
        audience: 'active_leads',
        subject: 'Novo artigo: {titulo_blog}',
        preheader: 'Uma leitura rapida preparada pela equipe Guilherme Pilger.',
        ctaLabel: 'Ler artigo',
        status: 'active',
        html: [
            '<p>Ola {nome},</p>',
            '<p>Acabamos de publicar um novo artigo que pode te ajudar a acompanhar melhor o mercado imobiliario de alto padrao.</p>',
            '<p><strong>{titulo_blog}</strong></p>',
            '<p>{resumo_blog}</p>',
            '<p><a href="{link_artigo}" style="background:#b89153;color:#111;padding:12px 18px;text-decoration:none;border-radius:4px;font-weight:bold;">Ler artigo</a></p>',
            '<p>Equipe Guilherme Pilger</p>',
        ].join('\n'),
        text: [
            'Ola {nome},',
            '',
            'Acabamos de publicar um novo artigo:',
            '{titulo_blog}',
            '',
            '{resumo_blog}',
            '',
            'Leia aqui: {link_artigo}',
            '',
            'Equipe Guilherme Pilger',
        ].join('\n'),
    },
    {
        id: 'news-editorial',
        name: 'Noticia publicada',
        trigger: 'news_published',
        audience: 'active_leads',
        subject: 'Nova noticia: {titulo_noticia}',
        preheader: 'Uma leitura rapida sobre o mercado e o litoral catarinense.',
        ctaLabel: 'Ler noticia',
        status: 'active',
        html: [
            '<p>Ola {nome},</p>',
            '<p>Publicamos uma nova noticia com contexto para quem acompanha o mercado imobiliario de alto padrao.</p>',
            '<p><strong>{titulo_noticia}</strong></p>',
            '<p>{resumo_noticia}</p>',
            '<p><a href="{link_noticia}" style="background:#b89153;color:#111;padding:12px 18px;text-decoration:none;border-radius:4px;font-weight:bold;">Ler noticia</a></p>',
            '<p>Se quiser entender como isso pode se relacionar com seu momento de compra ou investimento, fale com nossa equipe pelo WhatsApp: <a href="{link_whatsapp}">abrir conversa</a>.</p>',
            '<p>Equipe Guilherme Pilger</p>',
        ].join('\n'),
        text: [
            'Ola {nome},',
            '',
            'Publicamos uma nova noticia:',
            '{titulo_noticia}',
            '',
            '{resumo_noticia}',
            '',
            'Leia aqui: {link_noticia}',
            'Duvidas pelo WhatsApp: {link_whatsapp}',
            '',
            'Equipe Guilherme Pilger',
        ].join('\n'),
    },
    {
        id: 'event-reminder',
        name: 'Lembrete de evento',
        trigger: 'event_reminder',
        audience: 'event_leads',
        subject: 'Lembrete: {evento} acontece em breve',
        preheader: 'Confira horario, local e link de acesso.',
        ctaLabel: 'Falar no WhatsApp',
        status: 'active',
        html: [
            '<p>Ola {nome},</p>',
            '<p>Passando para lembrar que o evento <strong>{evento}</strong> acontece em breve.</p>',
            '<p>Data: {data_evento}<br>Horario: {hora_evento}<br>Local: {local_evento}</p>',
            '<p>Se tiver qualquer duvida, fale com nossa equipe pelo WhatsApp.</p>',
            '<p><a href="{link_whatsapp}" style="background:#1a8c3e;color:#fff;padding:12px 18px;text-decoration:none;border-radius:4px;font-weight:bold;">Falar no WhatsApp</a></p>',
            '<p>Equipe Guilherme Pilger</p>',
        ].join('\n'),
        text: [
            'Ola {nome},',
            '',
            'Lembrete do evento {evento}.',
            'Data: {data_evento}',
            'Horario: {hora_evento}',
            'Local: {local_evento}',
            '',
            'Duvidas: {link_whatsapp}',
            '',
            'Equipe Guilherme Pilger',
        ].join('\n'),
    },
]

const TRIGGER_SET = new Set<string>(EMAIL_AGENT_TEMPLATE_TRIGGERS)
const AUDIENCE_SET = new Set<string>(EMAIL_AGENT_TEMPLATE_AUDIENCES)
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

function mergeDefaultTemplates(templates: EmailAgentTemplateDefinition[]) {
    const ids = new Set(templates.map(template => template.id))
    const missingDefaults = DEFAULT_EMAIL_AGENT_TEMPLATES.filter(template => !ids.has(template.id))

    return [...templates, ...missingDefaults].slice(0, 30)
}

export function parseEmailAgentTemplatesJson(value?: string | null): EmailAgentTemplateDefinition[] {
    try {
        const parsed = JSON.parse(String(value || '[]'))
        if (!Array.isArray(parsed)) return DEFAULT_EMAIL_AGENT_TEMPLATES

        const normalized = parsed
            .map((item: any, index: number): EmailAgentTemplateDefinition => {
                const trigger = cleanText(item?.trigger, 'custom', 60)
                const audience = cleanText(item?.audience, 'active_leads', 60)
                const status = cleanText(item?.status, 'draft', 20)

                return {
                    id: normalizeTemplateId(item?.id, `email-template-${index + 1}`),
                    name: cleanText(item?.name, `Template ${index + 1}`, 100),
                    trigger: TRIGGER_SET.has(trigger) ? trigger : 'custom',
                    audience: AUDIENCE_SET.has(audience) ? audience : 'custom',
                    subject: cleanText(item?.subject, 'Assunto do e-mail', 180),
                    preheader: cleanText(item?.preheader, '', 220),
                    html: cleanText(item?.html, '<p>Ola {nome},</p>', 14000),
                    text: cleanText(item?.text, 'Ola {nome},', 7000),
                    ctaLabel: cleanText(item?.ctaLabel || item?.cta_label, 'Abrir', 80),
                    status: STATUS_SET.has(status) ? status as EmailAgentTemplateDefinition['status'] : 'draft',
                }
            })
            .filter(item => item.name && item.subject)
            .slice(0, 30)

        return normalized.length ? mergeDefaultTemplates(normalized) : DEFAULT_EMAIL_AGENT_TEMPLATES
    } catch {
        return DEFAULT_EMAIL_AGENT_TEMPLATES
    }
}

export function getDefaultEmailAgentTemplatesJson() {
    return JSON.stringify(DEFAULT_EMAIL_AGENT_TEMPLATES)
}

export function normalizeEmailAgentTemplatesJson(value?: string | null) {
    return JSON.stringify(parseEmailAgentTemplatesJson(value))
}
