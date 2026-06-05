'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import AgentOfficeStyles from './AgentOfficeStyles'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
    Bot,
    Bell,
    Camera,
    ChevronRight,
    CircleDot,
    Info,
    Mail,
    Loader2,
    Globe2,
    Maximize2,
    MessageSquareText,
    Minimize2,
    Phone,
    Plus,
    RefreshCw,
    Save,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Volume2,
    UserRoundCog,
} from 'lucide-react'
import type { AgentOfficeItem, AgentOfficeSnapshot } from '@/lib/pilger-ai/agent-office'
import InternalNotifierPanel from './InternalNotifierPanel'
import { EVENT_AGENT_PROMPT_TAGS } from '@/lib/events/agent-prompt'
import { BROKER_CANDIDATE_PROMPT_TAGS } from '@/lib/broker-candidates/agent-prompt'
import { DEFAULT_REMINDER_TEMPLATE, segmentLabel, triggerTypeLabel } from '@/lib/events/utils'
import { parseEmailAgentTemplatesJson, type EmailAgentTemplateDefinition } from '@/lib/email/agent-templates'
import {
    parseWhatsAppEditorialTemplatesJson,
    type WhatsAppEditorialTemplateDefinition,
} from '@/lib/whatsapp/editorial-templates'
import {
    parsePushEditorialTemplatesJson,
    type PushEditorialTemplateDefinition,
} from '@/lib/push/editorial-templates'

const SECTOR_ORDER = ['Todos', 'Diretoria', 'Compliance e Governança', 'Imoveis', 'WhatsApp', 'Marketing', 'Comercial', 'Recrutamento', 'Inteligencia', 'Operacoes']
const MAX_AVATAR_SIZE = 20 * 1024 * 1024
const DATA_ROLE_OPTIONS = [
    { value: 'all', label: 'Todos', description: 'Todos os colaboradores digitais' },
    { value: 'collector', label: 'Coletores', description: 'Buscam ou normalizam dados externos para a Central' },
    { value: 'consumer', label: 'Consumidores', description: 'Usam dados da Central para produzir trabalho' },
    { value: 'hybrid', label: 'Hibridos', description: 'Coletam sinais durante a operacao e tambem produzem entregas' },
] as const
const DATA_ROLE_COLLECTOR_IDS = new Set([
    'gaia-analytics-web',
    'maya-meta-connections',
    'otto-integrations',
    'iris-media-voice',
    'teo-webhooks-events',
    'market-radar',
    'research-pilger',
    'benchmark-editorial',
])
const DATA_ROLE_HYBRID_IDS = new Set([
    'whatsapp-lead-extraction',
    'whatsapp-global-agent',
    'ads-analyst',
    'social-attendance-agent',
    'organic-report-agent',
    'event-agent',
    'broker-candidate-agent',
])

type DataRoleFilter = (typeof DATA_ROLE_OPTIONS)[number]['value']
type AgentDataRole = Exclude<DataRoleFilter, 'all'>

type SaveState = {
    status: 'idle' | 'saving' | 'success' | 'error'
    message: string
}

type ResearchTopic = {
    id: string
    topic: string
    region: string
    intent: string
    priority: string
    frequency: string
    status: string
    lastRun?: string
    nextRun?: string
    lastError?: string
}

type BrokerAssistantPhone = {
    id?: string
    phone: string
    name?: string | null
    role?: string
    can_manage_agenda?: boolean
    can_manage_leads?: boolean
    can_send_messages?: boolean
    can_update_crm?: boolean
    can_manage_finance?: boolean
    can_view_reports?: boolean
    can_view_properties?: boolean
    is_active?: boolean
}

type ConciergeAction = {
    id: string
    action_type: string
    status: string
    requested_at?: string | null
    confirmed_at?: string | null
    executed_at?: string | null
    created_at?: string | null
    updated_at?: string | null
    owner_name?: string | null
    owner_role?: string | null
    owner_phone?: string | null
    conversation_phone?: string | null
    description?: string | null
    amount?: number | null
    entry_date?: string | null
    category?: string | null
    subcategory?: string | null
    payment_method?: string | null
    payment_status?: string | null
    counterparty_name?: string | null
    counterparty_type?: string | null
    appointment_id?: string | null
    appointment_title?: string | null
    appointment_date?: string | null
    appointment_time?: string | null
    appointment_type?: string | null
    attachment_url?: string | null
    media_filename?: string | null
    source_text?: string | null
    receipt_confidence?: number | null
    receipt_summary?: string | null
    receipt_document_number?: string | null
    finance_entry_id?: string | null
}

type OfficeBroker = {
    id: string
    name: string
    creci?: string | null
    photo_url?: string | null
    is_active?: boolean
    assignment_type?: string | null
    assigned_page_slugs?: string[] | null
    phone?: string | null
    summary_to_phone?: string | null
    transfer_to_phone?: string | null
    system_prompt?: string | null
    voice_id?: string | null
    handoff_prompt?: string | null
    concierge_enabled?: boolean | null
    concierge_prompt?: string | null
    concierge_require_confirmation?: boolean | null
    empreendimento_ids?: string[]
    empreendimento_names?: string[]
    assistant_phones?: BrokerAssistantPhone[]
}

type OfficeBrokerDraft = {
    name: string
    creci: string
    is_active: boolean
    phone: string
    transfer_to_phone: string
    handoff_prompt: string
    concierge_enabled: boolean
    concierge_prompt: string
    concierge_require_confirmation: boolean
    voice_id: string
    assignment_type: string
    assigned_page_slugs: string[]
    empreendimento_ids: string[]
    assistant_phones: BrokerAssistantPhone[]
}

type OfficeWhatsAppInstance = {
    id: string
    instance_name: string
    phone_number?: string | null
    status?: string | null
    broker_id?: string | null
    live_data?: { phone?: string | null; pushName?: string | null; profileName?: string | null } | null
    config?: { response_mode?: string | null } | null
    virtual_brokers?: { name?: string | null } | null
}

type OfficeLandingPage = {
    id: string
    slug: string
    title?: string | null
}

type OfficeEmpreendimento = {
    id: string
    nome: string
    slug?: string | null
    ativo?: boolean | null
}

type OfficeVoice = {
    voice_id: string
    name: string
    category: string
    preview_url?: string | null
}

type CustomLinkButtonTag = {
    id?: string
    name?: string
    url?: string
    type?: string
    tag: string
}

type EventAgentLead = {
    id: string
    name: string
    phone: string
    email: string
    city: string
    creci: string
    status: string
    score: number
    level: 'quente' | 'morno' | 'frio'
    challenge: string
    timeline: string
    investment: string
    current_tool: string
    automation_wish?: string
    conversation_matched: boolean
    conversation_signal?: string
    tracking_signal?: string
    reasons: string[]
}

type EventAgentReport = {
    generated_at: string
    event: {
        id: string
        title: string
        slug: string
        event_date: string
        location_name: string
        location_address: string
        maps_url?: string
    }
    thresholds: {
        hot_score: number
        warm_score: number
    }
    totals: {
        registrations: number
        hot: number
        warm: number
        cold: number
        checked_in: number
        creci_verified: number
        pending_messages: number
        sent_messages: number
        failed_messages: number
        conversation_matches: number
    }
    top_leads: EventAgentLead[]
    recommendations: string[]
    ai_summary?: string
}

type EventAgentEvent = {
    id: string
    title: string
    slug: string
    status: string
    event_date: string
    location_name?: string | null
    registrations_count?: number
    pending_messages_count?: number
}

type EventAgentAutomationRule = {
    id: string
    name: string
    trigger_type: string
    offset_minutes: number
    fixed_datetime?: string | null
    segment: string
    message_template: string
    is_active: boolean
    metadata?: Record<string, any> | null
}

type EventAutomationDraft = {
    name: string
    trigger_type: string
    offset_minutes: string
    fixed_datetime: string
    segment: string
    message_template: string
    interaction_type: string
    tracking_tag: string
    button_1_label: string
    button_1_action: string
    button_1_url: string
    button_2_label: string
    button_2_action: string
    button_2_url: string
    button_3_label: string
    button_3_action: string
    button_3_url: string
    poll_question: string
    poll_options: string
}

type EmailTemplateDraft = EmailAgentTemplateDefinition
type WhatsAppTemplateDraft = WhatsAppEditorialTemplateDefinition
type PushTemplateDraft = PushEditorialTemplateDefinition

type EditorialDistributionCampaign = {
    campaign_id: string
    post_id: string
    post_title: string
    post_slug: string
    content_type: 'blog' | 'news' | 'property'
    trigger: string
    audience: string
    approval_status: string
    status: string
    created_at: string
    scheduled_for?: string | null
    channel_counts: {
        email?: number
        whatsapp?: number
        push?: number
    }
    sent: number
    failed: number
    waiting: number
    queued: number
    total: number
}

const EMPTY_EMAIL_TEMPLATE_DRAFT: EmailTemplateDraft = {
    id: '',
    name: '',
    trigger: 'blog_published',
    audience: 'active_leads',
    subject: '',
    preheader: '',
    html: '<p>Ola {nome},</p>\n<p>{conteudo}</p>\n<p><a href="{link_cta}">Abrir</a></p>',
    text: 'Ola {nome},\n\n{conteudo}\n\nAbrir: {link_cta}',
    ctaLabel: 'Abrir',
    status: 'draft',
}

const EMPTY_WHATSAPP_TEMPLATE_DRAFT: WhatsAppTemplateDraft = {
    id: '',
    name: '',
    trigger: 'blog_published',
    audience: 'active_leads',
    message: 'Ola, {nome}.\n\n{conteudo}\n\nToque no botao para abrir no site.\n\nPara parar de receber esse tipo de aviso, responda PARAR.',
    ctaLabel: 'Abrir',
    status: 'draft',
}

const EMPTY_PUSH_TEMPLATE_DRAFT: PushTemplateDraft = {
    id: '',
    name: '',
    trigger: 'blog_published',
    audience: 'active_leads',
    title: 'Novo conteudo para voce',
    body: '{nome}, separei uma atualizacao sobre {conteudo}. Toque para abrir.',
    ctaLabel: 'Abrir',
    status: 'draft',
}

const EMAIL_TEMPLATE_TRIGGER_OPTIONS = [
    { value: 'blog_published', label: 'Blog publicado' },
    { value: 'event_reminder', label: 'Lembrete de evento' },
    { value: 'news_published', label: 'Noticia publicada' },
    { value: 'lead_nurture', label: 'Nutricao de leads' },
    { value: 'custom', label: 'Personalizado' },
]

const EMAIL_TEMPLATE_AUDIENCE_OPTIONS = [
    { value: 'active_leads', label: 'Leads ativos' },
    { value: 'all_leads', label: 'Todos os leads' },
    { value: 'event_leads', label: 'Leads de evento' },
    { value: 'property_leads', label: 'Leads de imoveis' },
    { value: 'broker_candidates', label: 'Candidatos corretores' },
    { value: 'custom', label: 'Personalizado' },
]

const EMAIL_TEMPLATE_STATUS_OPTIONS = [
    { value: 'active', label: 'Ativo' },
    { value: 'draft', label: 'Rascunho' },
    { value: 'paused', label: 'Pausado' },
]

const EMAIL_TEMPLATE_TAGS = [
    '{nome}',
    '{email}',
    '{titulo_blog}',
    '{resumo_blog}',
    '{link_artigo}',
    '{titulo_noticia}',
    '{resumo_noticia}',
    '{link_noticia}',
    '{data_noticia}',
    '{evento}',
    '{data_evento}',
    '{hora_evento}',
    '{local_evento}',
    '{link_whatsapp}',
    '{link_cta}',
]

const WHATSAPP_TEMPLATE_TAGS = [
    '{nome}',
    '{titulo_blog}',
    '{resumo_blog}',
    '{link_artigo}',
    '{titulo_noticia}',
    '{resumo_noticia}',
    '{link_noticia}',
    '{data_noticia}',
    '{link_cta}',
]

const PUSH_TEMPLATE_TAGS = [
    '{nome}',
    '{titulo_blog}',
    '{resumo_blog}',
    '{titulo_noticia}',
    '{resumo_noticia}',
    '{data_noticia}',
    '{conteudo}',
]

const EMAIL_TEMPLATE_PREVIEW_VALUES: Record<string, string> = {
    nome: 'Alvaro Lautert',
    email: 'alvaro@email.com',
    titulo_blog: 'Balneario Camboriu: metro quadrado, luxo e oportunidades',
    resumo_blog: 'Uma leitura objetiva sobre os movimentos do mercado de alto padrao e os sinais que merecem atencao.',
    link_artigo: 'https://guilhermepilger.ai/blog/balneario-camboriu-luxo',
    titulo_noticia: 'Nova movimentacao no mercado de alto padrao em Santa Catarina',
    resumo_noticia: 'Um resumo objetivo do fato, do contexto local e do que merece atencao para compradores e investidores.',
    link_noticia: 'https://guilhermepilger.ai/blog/noticia-mercado-litoral',
    data_noticia: '24 de maio de 2026',
    evento: 'Encontro para corretores que querem operar com mais inteligencia',
    data_evento: '21 de maio de 2026',
    hora_evento: '17h',
    local_evento: 'Guilherme Pilger - Praia Brava',
    link_whatsapp: 'https://wa.me/5547999999999?utm_source=brevo&utm_medium=email&utm_campaign=preview',
    link_cta: 'https://guilhermepilger.ai',
    conteudo: 'Este e um exemplo de conteudo preenchido pelo agente antes do envio.',
}

function renderEmailTemplatePreview(value: string) {
    return String(value || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => EMAIL_TEMPLATE_PREVIEW_VALUES[key] ?? `{${key}}`)
}

function decodeHtmlEntities(value: string) {
    const source = String(value || '')
    if (!source.includes('&lt;') && !source.includes('&gt;')) return source

    if (typeof window !== 'undefined') {
        const textarea = window.document.createElement('textarea')
        textarea.innerHTML = source
        return textarea.value
    }

    return source
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
}

function normalizeEmailHtmlInput(value: string) {
    return decodeHtmlEntities(String(value || '').trim())
}

function buildEmailPreviewDocument(html: string) {
    const renderedHtml = renderEmailTemplatePreview(normalizeEmailHtmlInput(html) || '<p>Ola {nome},</p>')
    const hasFullDocument = /<html[\s>]/i.test(renderedHtml) || /<!doctype/i.test(renderedHtml)

    if (hasFullDocument) return renderedHtml

    return [
        '<!doctype html>',
        '<html lang="pt-BR">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<base target="_blank">',
        '<style>',
        'body{margin:0;background:#f3f0ea;font-family:Arial,sans-serif;color:#1f2933;}',
        '.email-preview-shell{max-width:680px;margin:0 auto;padding:26px 14px;}',
        '.email-preview-card{background:#fff;border:1px solid #e8ded0;border-radius:8px;box-shadow:0 18px 48px rgba(24,18,12,.08);overflow:hidden;padding:28px;}',
        'img{max-width:100%;height:auto;}',
        'a{color:#9b7237;}',
        '@media(max-width:640px){.email-preview-shell{padding:12px}.email-preview-card{padding:18px}}',
        '</style>',
        '</head>',
        '<body>',
        '<div class="email-preview-shell"><div class="email-preview-card">',
        renderedHtml,
        '</div></div>',
        '</body>',
        '</html>',
    ].join('')
}

const BROKER_PROMPT_TAGS = [
    { tag: '{nome_lead}', desc: 'Nome do lead coletado na conversa', color: '#22c55e' },
    { tag: '{nome_corretor}', desc: 'Nome deste corretor IA', color: '#22c55e' },
    { tag: '{agendamento}', desc: 'Botao para agendar visita ou reuniao', color: '#818cf8' },
    { tag: '{regioes}', desc: 'Lista interativa de regioes', color: '#818cf8' },
    { tag: '{transferir}', desc: 'Transferir ao corretor humano', color: '#f59e0b' },
    { tag: '{documentos}', desc: 'Botao para solicitar documentos', color: '#818cf8' },
    { tag: '{horario}', desc: 'Horarios de atendimento', color: '#06b6d4' },
    { tag: '{empresa}', desc: 'Informacoes da Imobiliaria Guilherme Pilger', color: '#06b6d4' },
    { tag: '{localizacao_empresa}', desc: 'Link de localizacao da imobiliaria', color: '#06b6d4' },
    { tag: '{imoveis}', desc: 'Consulta o catalogo e permite enviar Ver imovel', color: '#f59e0b' },
    { tag: '{botao_instagram}', desc: 'Botao rastreavel para Instagram', color: '#0ea5e9' },
    { tag: '{botao_facebook}', desc: 'Botao rastreavel para Facebook', color: '#0ea5e9' },
    { tag: '{botao_tiktok}', desc: 'Botao rastreavel para TikTok', color: '#0ea5e9' },
    { tag: '{botao_youtube}', desc: 'Botao rastreavel para YouTube', color: '#0ea5e9' },
    { tag: '{botao_site}', desc: 'Botao rastreavel para o site', color: '#0ea5e9' },
    { tag: '{botao_localizacao}', desc: 'Botao rastreavel para localizacao da imobiliaria', color: '#0ea5e9' },
]

const CONCIERGE_PROMPT_TAGS = [
    { tag: '{pf_pj}', desc: 'Botoes Pessoa fisica / Pessoa juridica', color: '#22c55e' },
    { tag: '{confirmar}', desc: 'Botoes Confirmar / Cancelar', color: '#22c55e' },
    { tag: '{corrigir}', desc: 'Lista para corrigir valor, data ou categoria', color: '#f59e0b' },
    { tag: '{categoria}', desc: 'Lista de categorias de despesa', color: '#f59e0b' },
    { tag: '{pagamento}', desc: 'Lista de formas de pagamento', color: '#0ea5e9' },
    { tag: '{agenda}', desc: 'Botoes Confirmar agenda / Reagendar / Cancelar', color: '#818cf8' },
    { tag: '{resumo}', desc: 'Botoes Financeiro / Agenda / Leads', color: '#14b8a6' },
    { tag: '{imoveis}', desc: 'Botoes para estoque e oportunidades de imoveis', color: '#a855f7' },
    { tag: '{relatorio}', desc: 'Botoes Hoje / Semana / Mes para relatorios', color: '#14b8a6' },
]

const CONCIERGE_PERMISSION_OPTIONS: Array<{
    key: keyof Pick<
        BrokerAssistantPhone,
        | 'can_manage_agenda'
        | 'can_manage_leads'
        | 'can_send_messages'
        | 'can_update_crm'
        | 'can_manage_finance'
        | 'can_view_reports'
        | 'can_view_properties'
    >
    label: string
    hint: string
    defaultEnabled?: boolean
}> = [
    { key: 'can_manage_agenda', label: 'Agenda', hint: 'Criar compromissos com confirmacao.', defaultEnabled: true },
    { key: 'can_view_properties', label: 'Imoveis', hint: 'Consultar catalogo e estoque.', defaultEnabled: true },
    { key: 'can_manage_leads', label: 'Leads', hint: 'Consultar leads do corretor.' },
    { key: 'can_update_crm', label: 'CRM', hint: 'Atualizar dados de atendimento.' },
    { key: 'can_send_messages', label: 'Mensagens', hint: 'Enviar mensagens por comando.' },
    { key: 'can_view_reports', label: 'Relatorios', hint: 'Gerar resumos e indicadores.' },
    { key: 'can_manage_finance', label: 'Financeiro', hint: 'Criar rascunhos financeiros.' },
]

const EMPTY_RESEARCH_TOPIC: ResearchTopic = {
    id: '',
    topic: '',
    region: '',
    intent: 'blog',
    priority: 'media',
    frequency: 'semanal',
    status: 'ativo',
}

const EMPTY_EVENT_AUTOMATION_DRAFT: EventAutomationDraft = {
    name: 'Lembrete com confirmacao',
    trigger_type: 'before_event',
    offset_minutes: '300',
    fixed_datetime: '',
    segment: 'all',
    message_template: DEFAULT_REMINDER_TEMPLATE,
    interaction_type: 'buttons',
    tracking_tag: 'confirmacao_evento',
    button_1_label: 'Confirmar presenca',
    button_1_action: 'confirmar_presenca',
    button_1_url: '',
    button_2_label: 'Ver mapa',
    button_2_action: 'ver_mapa',
    button_2_url: '',
    button_3_label: 'Falar com equipe',
    button_3_action: 'falar_com_equipe',
    button_3_url: '',
    poll_question: 'Voce vai participar do encontro?',
    poll_options: 'Sim, estarei presente\nAinda estou confirmando\nNao vou conseguir',
}

function eventAutomationDraftFromRule(rule: EventAgentAutomationRule): EventAutomationDraft {
    const metadata = rule.metadata || {}
    const buttons = Array.isArray(metadata.buttons) ? metadata.buttons : []
    const poll = metadata.poll && typeof metadata.poll === 'object' ? metadata.poll : {}

    return {
        name: rule.name || '',
        trigger_type: rule.trigger_type || 'before_event',
        offset_minutes: String(rule.offset_minutes || 0),
        fixed_datetime: toDateTimeLocal(rule.fixed_datetime),
        segment: rule.segment || 'all',
        message_template: rule.message_template || '',
        interaction_type: String(metadata.interaction_type || 'none'),
        tracking_tag: String(metadata.tracking_tag || 'event_agent_interaction'),
        button_1_label: String(buttons[0]?.label || ''),
        button_1_action: String(buttons[0]?.action || buttons[0]?.id || ''),
        button_1_url: String(buttons[0]?.url || ''),
        button_2_label: String(buttons[1]?.label || ''),
        button_2_action: String(buttons[1]?.action || buttons[1]?.id || ''),
        button_2_url: String(buttons[1]?.url || ''),
        button_3_label: String(buttons[2]?.label || ''),
        button_3_action: String(buttons[2]?.action || buttons[2]?.id || ''),
        button_3_url: String(buttons[2]?.url || ''),
        poll_question: String(poll.question || ''),
        poll_options: Array.isArray(poll.options) ? poll.options.join('\n') : '',
    }
}

const BLOG_WEEKDAY_OPTIONS = [
    { label: 'Dom', value: '0' },
    { label: 'Seg', value: '1' },
    { label: 'Ter', value: '2' },
    { label: 'Qua', value: '3' },
    { label: 'Qui', value: '4' },
    { label: 'Sex', value: '5' },
    { label: 'Sab', value: '6' },
]

const SCHEDULE_AGENT_PREFIX: Record<string, 'blog_agent' | 'news_agent'> = {
    'blog-intelligence': 'blog_agent',
    'news-intelligence': 'news_agent',
}

function getScheduleControlKeys(prefix: 'blog_agent' | 'news_agent') {
    return new Set([
        `${prefix}_schedule_date`,
        ...[1, 2, 3, 4, 5, 6, 7].flatMap(index => [
            `${prefix}_schedule_day_${index}`,
            `${prefix}_schedule_time_${index}`,
        ]),
    ])
}

const BEHAVIOR_GROUPS = [
    {
        title: 'Execucao',
        keys: [
            'research_pilger_enabled',
            'research_pilger_depth',
            'research_pilger_schedule_enabled',
            'research_pilger_daily_limit',
            'blog_agent_enabled',
            'news_agent_enabled',
            'radar_ai_enabled',
            'meta_social_agent_enabled',
            'meta_social_agent_autopilot',
            'organic_report_agent_enabled',
            'marketing_publisher_agent_enabled',
            'marketing_publisher_autopilot',
            'event_agent_enabled',
            'event_agent_ai_report_enabled',
            'event_agent_button_tracking_enabled',
            'email_agent_enabled',
            'email_agent_autopilot',
            'email_agent_require_approval',
            'editorial_distribution_email_enabled',
            'editorial_distribution_whatsapp_enabled',
            'editorial_distribution_push_enabled',
            'editorial_distribution_recommendations_enabled',
        ],
    },
    {
        title: 'Agenda',
        keys: [
            'research_pilger_weekdays',
            'research_pilger_run_times',
            'blog_agent_schedule_day_1',
            'blog_agent_schedule_time_1',
            'blog_agent_schedule_day_2',
            'blog_agent_schedule_time_2',
            'blog_agent_schedule_day_3',
            'blog_agent_schedule_time_3',
            'blog_agent_schedule_day_4',
            'blog_agent_schedule_time_4',
            'blog_agent_schedule_day_5',
            'blog_agent_schedule_time_5',
            'blog_agent_schedule_day_6',
            'blog_agent_schedule_time_6',
            'blog_agent_schedule_day_7',
            'blog_agent_schedule_time_7',
            'news_agent_schedule_day_1',
            'news_agent_schedule_time_1',
            'news_agent_schedule_day_2',
            'news_agent_schedule_time_2',
            'news_agent_schedule_day_3',
            'news_agent_schedule_time_3',
            'news_agent_schedule_day_4',
            'news_agent_schedule_time_4',
            'news_agent_schedule_day_5',
            'news_agent_schedule_time_5',
            'news_agent_schedule_day_6',
            'news_agent_schedule_time_6',
            'news_agent_schedule_day_7',
            'news_agent_schedule_time_7',
            'pilger_daily_days',
            'pilger_daily_time',
            'pilger_weekly_days',
            'pilger_weekly_times',
            'radar_collection_days',
            'radar_collection_times',
            'organic_report_agent_interval_hours',
            'marketing_publisher_interval_minutes',
            'email_agent_send_interval_minutes',
            'email_agent_daily_limit',
            'email_agent_allowed_start_time',
            'email_agent_allowed_end_time',
            'editorial_distribution_whatsapp_interval_minutes',
            'editorial_distribution_whatsapp_daily_limit',
            'editorial_distribution_push_interval_minutes',
            'editorial_distribution_push_daily_limit',
        ],
    },
    {
        title: 'Criterios',
        keys: ['radar_ai_min_opportunity_score', 'radar_ai_max_insights_per_run', 'radar_opportunity_alert_threshold', 'event_agent_hot_score_threshold', 'event_agent_report_limit', 'email_agent_min_hours_between_lead_messages', 'email_agent_default_audience', 'editorial_distribution_recommendation_min_score', 'editorial_distribution_recommendation_batch_limit'],
    },
]

function toneClass(tone: string) {
    return `pilger-ai-tone-${tone || 'muted'}`
}

function avatarClass(agent: AgentOfficeItem) {
    return `agent-office-avatar agent-office-avatar-${agent.avatarTone || 'gold'}`
}

function promptWordCount(prompt: string) {
    return prompt.trim().split(/\s+/).filter(Boolean).length
}

function canEdit(agent: AgentOfficeItem) {
    return Boolean(agent.promptKey || agent.brokerId)
}

function buildBehaviorDraft(agent?: AgentOfficeItem) {
    return Object.fromEntries((agent?.behaviorControls || []).map(control => [control.key, control.value || control.fallback]))
}

function toggleBehaviorListValue(currentValue: string, value: string) {
    const values = new Set(String(currentValue || '').split(',').map(item => item.trim()).filter(Boolean))
    if (values.has(value)) values.delete(value)
    else values.add(value)
    return Array.from(values).join(',')
}

function isValidBlogWeekday(value?: string) {
    return BLOG_WEEKDAY_OPTIONS.some(day => day.value === value)
}

function getBlogWeekdayLabel(value: string) {
    return BLOG_WEEKDAY_OPTIONS.find(day => day.value === value)?.label || value
}

function getAgentScheduleSlots(draft: Record<string, string>, prefix: 'blog_agent' | 'news_agent') {
    const slots = [1, 2, 3, 4, 5, 6, 7]
        .map(index => ({
            day: String(draft[`${prefix}_schedule_day_${index}`] || ''),
            time: String(draft[`${prefix}_schedule_time_${index}`] || (prefix === 'news_agent' ? '10:00' : '09:00')),
        }))
        .filter(slot => isValidBlogWeekday(slot.day))

    const usedDays = new Set<string>()
    return slots
        .filter(slot => {
            if (usedDays.has(slot.day)) return false
            usedDays.add(slot.day)
            return true
        })
        .sort((a, b) => Number(a.day) - Number(b.day))
}

function packAgentScheduleSlots(prefix: 'blog_agent' | 'news_agent', slots: Array<{ day: string; time: string }>) {
    const next: Record<string, string> = {}
    const fallbackTime = prefix === 'news_agent' ? '10:00' : '09:00'
    for (let index = 1; index <= 7; index += 1) {
        const slot = slots[index - 1]
        next[`${prefix}_schedule_day_${index}`] = slot?.day || 'off'
        next[`${prefix}_schedule_time_${index}`] = slot?.time || fallbackTime
    }
    return next
}

function parseResearchTopics(value?: string | null): ResearchTopic[] {
    try {
        const parsed = JSON.parse(String(value || '[]'))
        if (!Array.isArray(parsed)) return []
        return parsed.map((item: any, index: number) => ({
            id: String(item?.id || `tema-${index}`),
            topic: String(item?.topic || ''),
            region: String(item?.region || ''),
            intent: String(item?.intent || 'geral'),
            priority: String(item?.priority || 'media'),
            frequency: String(item?.frequency || 'semanal'),
            status: String(item?.status || 'ativo'),
            lastRun: item?.lastRun ? String(item.lastRun) : '',
            nextRun: item?.nextRun ? String(item.nextRun) : '',
        })).filter(item => item.topic.trim())
    } catch {
        return []
    }
}

function makeTopicId() {
    return `tema-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseEmailTemplates(value?: string | null): EmailTemplateDraft[] {
    return parseEmailAgentTemplatesJson(value)
}

function parseWhatsAppTemplates(value?: string | null): WhatsAppTemplateDraft[] {
    return parseWhatsAppEditorialTemplatesJson(value)
}

function parsePushTemplates(value?: string | null): PushTemplateDraft[] {
    return parsePushEditorialTemplatesJson(value)
}

function makeEmailTemplateId(name?: string) {
    const slug = String(name || 'email-template')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48)

    return `${slug || 'email-template'}-${Date.now().toString(36)}`
}

function makeWhatsAppTemplateId(name?: string) {
    const slug = String(name || 'whatsapp-template')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48)

    return `${slug || 'whatsapp-template'}-${Date.now().toString(36)}`
}

function makePushTemplateId(name?: string) {
    const slug = String(name || 'push-template')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48)

    return `${slug || 'push-template'}-${Date.now().toString(36)}`
}

function hasEmailTemplateDraftContent(draft: EmailTemplateDraft) {
    return Boolean(
        draft.id ||
        draft.name.trim() ||
        draft.subject.trim() ||
        draft.preheader.trim() ||
        normalizeEmailHtmlInput(draft.html) !== normalizeEmailHtmlInput(EMPTY_EMAIL_TEMPLATE_DRAFT.html) ||
        draft.text.trim() !== EMPTY_EMAIL_TEMPLATE_DRAFT.text.trim() ||
        draft.ctaLabel.trim() !== EMPTY_EMAIL_TEMPLATE_DRAFT.ctaLabel ||
        draft.trigger !== EMPTY_EMAIL_TEMPLATE_DRAFT.trigger ||
        draft.audience !== EMPTY_EMAIL_TEMPLATE_DRAFT.audience ||
        draft.status !== EMPTY_EMAIL_TEMPLATE_DRAFT.status
    )
}

function mergeEmailTemplateList(templates: EmailTemplateDraft[], template: EmailTemplateDraft) {
    const exists = templates.some(item => item.id === template.id)
    return exists
        ? templates.map(item => item.id === template.id ? template : item)
        : [template, ...templates]
}

function hasWhatsAppTemplateDraftContent(draft: WhatsAppTemplateDraft) {
    return Boolean(
        draft.id ||
        draft.name.trim() ||
        draft.message.trim() !== EMPTY_WHATSAPP_TEMPLATE_DRAFT.message.trim() ||
        draft.ctaLabel.trim() !== EMPTY_WHATSAPP_TEMPLATE_DRAFT.ctaLabel ||
        draft.trigger !== EMPTY_WHATSAPP_TEMPLATE_DRAFT.trigger ||
        draft.audience !== EMPTY_WHATSAPP_TEMPLATE_DRAFT.audience ||
        draft.status !== EMPTY_WHATSAPP_TEMPLATE_DRAFT.status
    )
}

function mergeWhatsAppTemplateList(templates: WhatsAppTemplateDraft[], template: WhatsAppTemplateDraft) {
    const exists = templates.some(item => item.id === template.id)
    return exists
        ? templates.map(item => item.id === template.id ? template : item)
        : [template, ...templates]
}

function hasPushTemplateDraftContent(draft: PushTemplateDraft) {
    return Boolean(
        draft.id ||
        draft.name.trim() ||
        draft.title.trim() !== EMPTY_PUSH_TEMPLATE_DRAFT.title.trim() ||
        draft.body.trim() !== EMPTY_PUSH_TEMPLATE_DRAFT.body.trim() ||
        draft.ctaLabel.trim() !== EMPTY_PUSH_TEMPLATE_DRAFT.ctaLabel ||
        draft.trigger !== EMPTY_PUSH_TEMPLATE_DRAFT.trigger ||
        draft.audience !== EMPTY_PUSH_TEMPLATE_DRAFT.audience ||
        draft.status !== EMPTY_PUSH_TEMPLATE_DRAFT.status
    )
}

function mergePushTemplateList(templates: PushTemplateDraft[], template: PushTemplateDraft) {
    const exists = templates.some(item => item.id === template.id)
    return exists
        ? templates.map(item => item.id === template.id ? template : item)
        : [template, ...templates]
}

function buildPushTemplateDraft(
    draft: PushTemplateDraft,
    templates: PushTemplateDraft[],
    editingId: string | null
): { template: PushTemplateDraft | null; error?: string } {
    if (!hasPushTemplateDraftContent(draft)) return { template: null }

    const name = draft.name.trim()
    const title = draft.title.trim()
    const body = draft.body.trim()
    if (!name || !title || !body) {
        return { template: null, error: 'Preencha Nome, Titulo e Mensagem do push, ou clique em Limpar antes de salvar.' }
    }

    const existingWithSameName = templates.find(template =>
        template.name.trim().toLowerCase() === name.toLowerCase()
    )

    return {
        template: {
            ...draft,
            id: editingId || draft.id || existingWithSameName?.id || makePushTemplateId(name),
            name,
            title,
            body,
            ctaLabel: draft.ctaLabel.trim() || EMPTY_PUSH_TEMPLATE_DRAFT.ctaLabel,
        },
    }
}

function buildWhatsAppTemplateDraft(
    draft: WhatsAppTemplateDraft,
    templates: WhatsAppTemplateDraft[],
    editingId: string | null
): { template: WhatsAppTemplateDraft | null; error?: string } {
    if (!hasWhatsAppTemplateDraftContent(draft)) return { template: null }

    const name = draft.name.trim()
    const message = draft.message.trim()
    if (!name || !message) {
        return { template: null, error: 'Preencha Nome e Mensagem do template, ou clique em Limpar antes de salvar.' }
    }

    const existingWithSameName = templates.find(template =>
        template.name.trim().toLowerCase() === name.toLowerCase()
    )

    return {
        template: {
            ...draft,
            id: editingId || draft.id || existingWithSameName?.id || makeWhatsAppTemplateId(name),
            name,
            message,
            ctaLabel: draft.ctaLabel.trim() || EMPTY_WHATSAPP_TEMPLATE_DRAFT.ctaLabel,
        },
    }
}

function buildEmailTemplateDraft(
    draft: EmailTemplateDraft,
    templates: EmailTemplateDraft[],
    editingId: string | null
): { template: EmailTemplateDraft | null; error?: string } {
    if (!hasEmailTemplateDraftContent(draft)) return { template: null }

    const name = draft.name.trim()
    const subject = draft.subject.trim()
    if (!name || !subject) {
        return { template: null, error: 'Preencha Nome e Assunto do template, ou clique em Limpar antes de salvar.' }
    }

    const existingWithSameName = templates.find(template =>
        template.name.trim().toLowerCase() === name.toLowerCase()
    )

    return {
        template: {
            ...draft,
            id: editingId || draft.id || existingWithSameName?.id || makeEmailTemplateId(name),
            name,
            subject,
            preheader: draft.preheader.trim(),
            html: normalizeEmailHtmlInput(draft.html),
            text: draft.text.trim(),
            ctaLabel: draft.ctaLabel.trim() || EMPTY_EMAIL_TEMPLATE_DRAFT.ctaLabel,
        },
    }
}

function normalizePhone(value?: string | null) {
    let digits = String(value || '').replace(/\D/g, '')
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        digits = `55${digits}`
    }
    return digits
}

function getInstancePhone(instance?: OfficeWhatsAppInstance | null) {
    return normalizePhone(instance?.live_data?.phone || instance?.phone_number || '')
}

function formatPhoneLabel(value?: string | null) {
    const digits = normalizePhone(value)
    if (!digits) return ''
    if (digits.length === 13 && digits.startsWith('55')) {
        return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
    }
    if (digits.length === 12 && digits.startsWith('55')) {
        return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
    }
    return `+${digits}`
}

function formatDateTimeLabel(value?: string | null) {
    if (!value) return 'Sem data'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Sem data'
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
    }).format(date)
}

function editorialCampaignStatusLabel(status: string) {
    const labels: Record<string, string> = {
        awaiting_approval: 'Aguardando aprovacao',
        sending: 'Enviando',
        completed: 'Concluida',
        finished_with_errors: 'Concluida com falhas',
        draft: 'Preparada',
    }
    return labels[status] || status || 'Sem status'
}

function editorialContentTypeLabel(type: string) {
    if (type === 'news') return 'Noticia'
    if (type === 'property') return 'Imovel recomendado'
    return 'Blog'
}

function toDateTimeLocal(value?: string | null) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (input: number) => String(input).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatMoneyLabel(value?: number | null) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Valor pendente'
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value)
}

function conciergeStatusLabel(status: string) {
    const labels: Record<string, string> = {
        pending: 'Pendente',
        confirmed: 'Confirmado',
        executed: 'Lancado',
        cancelled: 'Cancelado',
        failed: 'Falhou',
    }
    return labels[status] || status || 'Sem status'
}

function conciergeStatusTone(status: string) {
    if (status === 'pending') return 'pending'
    if (status === 'executed' || status === 'confirmed') return 'success'
    if (status === 'failed') return 'danger'
    return 'muted'
}

function eventLeadLevelLabel(level: string) {
    if (level === 'quente') return 'Quente'
    if (level === 'morno') return 'Morno'
    return 'Frio'
}

function counterpartyTypeLabel(value?: string | null) {
    if (value === 'pessoa_fisica') return 'Pessoa fisica'
    if (value === 'pessoa_juridica') return 'Pessoa juridica'
    return 'PF/PJ pendente'
}

function paymentStatusLabel(value?: string | null) {
    if (value === 'paid') return 'Pago'
    if (value === 'pending') return 'Pendente'
    if (value === 'overdue') return 'Vencido'
    return value || 'Status aberto'
}

function conciergeActionLabel(actionType: string) {
    const labels: Record<string, string> = {
        create_finance_entry: 'Financeiro',
        create_appointment: 'Agenda',
    }
    return labels[actionType] || 'Acao interna'
}

function appointmentTypeLabel(value?: string | null) {
    if (value === 'visita') return 'Visita'
    if (value === 'bloqueio') return 'Bloqueio'
    if (value === 'reuniao') return 'Reuniao'
    return value || 'Compromisso'
}

function formatDateOnlyLabel(value?: string | null) {
    if (!value) return 'Data pendente'
    const date = new Date(`${value}T12:00:00`)
    if (Number.isNaN(date.getTime())) return 'Data pendente'
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo',
    }).format(date)
}

function conciergeActionPrimary(action: ConciergeAction) {
    if (action.action_type === 'create_appointment') {
        return `${formatDateOnlyLabel(action.appointment_date)}${action.appointment_time ? ` as ${action.appointment_time}` : ''}`
    }
    return formatMoneyLabel(action.amount)
}

function conciergeActionDescription(action: ConciergeAction) {
    if (action.action_type === 'create_appointment') {
        return action.appointment_title || 'Compromisso de agenda'
    }
    return action.description || 'Lancamento financeiro'
}

function conciergeActionMetaItems(action: ConciergeAction) {
    const owner = action.owner_name || formatPhoneLabel(action.owner_phone) || 'Dono autorizado'
    if (action.action_type === 'create_appointment') {
        return [
            owner,
            conciergeActionLabel(action.action_type),
            appointmentTypeLabel(action.appointment_type),
            formatDateOnlyLabel(action.appointment_date),
            action.appointment_time || 'Horario pendente',
        ]
    }

    return [
        owner,
        counterpartyTypeLabel(action.counterparty_type),
        paymentStatusLabel(action.payment_status),
        action.category || 'Sem categoria',
        formatDateTimeLabel(action.requested_at || action.created_at),
    ]
}

function makeBrokerDraft(broker: OfficeBroker, fallbackAgent?: AgentOfficeItem): OfficeBrokerDraft {
    return {
        name: broker.name || fallbackAgent?.personaName || '',
        creci: broker.creci || '',
        is_active: broker.is_active !== false,
        phone: normalizePhone(broker.phone || ''),
        transfer_to_phone: normalizePhone(broker.transfer_to_phone || broker.summary_to_phone || ''),
        handoff_prompt: broker.handoff_prompt || '',
        concierge_enabled: broker.concierge_enabled === true,
        concierge_prompt: broker.concierge_prompt || '',
        concierge_require_confirmation: broker.concierge_require_confirmation !== false,
        voice_id: broker.voice_id || '',
        assignment_type: broker.assignment_type || 'all',
        assigned_page_slugs: Array.isArray(broker.assigned_page_slugs) ? broker.assigned_page_slugs : [],
        empreendimento_ids: Array.isArray(broker.empreendimento_ids) ? broker.empreendimento_ids : [],
        assistant_phones: Array.isArray(broker.assistant_phones) ? broker.assistant_phones : [],
    }
}

function makeAssistantPhone(): BrokerAssistantPhone {
    return {
        phone: '',
        name: '',
        role: 'broker',
        can_manage_agenda: true,
        can_manage_leads: false,
        can_send_messages: false,
        can_update_crm: false,
        can_manage_finance: false,
        can_view_reports: false,
        can_view_properties: true,
        is_active: true,
    }
}

function assistantPermissionEnabled(phone: BrokerAssistantPhone, key: (typeof CONCIERGE_PERMISSION_OPTIONS)[number]['key']) {
    const option = CONCIERGE_PERMISSION_OPTIONS.find(item => item.key === key)
    return option?.defaultEnabled ? phone[key] !== false : phone[key] === true
}

function groupBehaviorControls(agent: AgentOfficeItem) {
    const schedulePrefix = SCHEDULE_AGENT_PREFIX[agent.id]
    const scheduleControlKeys = schedulePrefix ? getScheduleControlKeys(schedulePrefix) : null
    const controls = scheduleControlKeys
        ? (agent.behaviorControls || []).filter(control => !scheduleControlKeys.has(control.key))
        : (agent.behaviorControls || [])
    const grouped = BEHAVIOR_GROUPS
        .map(group => ({
            ...group,
            controls: group.keys
                .map(key => controls.find(control => control.key === key))
                .filter(Boolean) as AgentOfficeItem['behaviorControls'],
        }))
        .filter(group => group.controls?.length)
    const groupedKeys = new Set(grouped.flatMap(group => group.controls?.map(control => control.key) || []))
    const others = controls.filter(control => !groupedKeys.has(control.key))
    return others.length ? [...grouped, { title: 'Outros', keys: [], controls: others }] : grouped
}

function getAgentDataRole(agent: AgentOfficeItem): AgentDataRole {
    if (agent.source === 'virtual_brokers') return 'hybrid'
    if (DATA_ROLE_COLLECTOR_IDS.has(agent.id)) return 'collector'
    if (DATA_ROLE_HYBRID_IDS.has(agent.id)) return 'hybrid'
    return 'consumer'
}

function dataRoleLabel(role: AgentDataRole) {
    if (role === 'collector') return 'Coletor'
    if (role === 'hybrid') return 'Hibrido'
    return 'Consumidor'
}

export default function AgentOfficeClient({ snapshot }: { snapshot: AgentOfficeSnapshot }) {
    const searchParams = useSearchParams()
    const initialSector = searchParams.get('setor') || (searchParams.get('tipo') === 'corretores' ? 'Comercial' : 'Todos')
    const initialAgentId = searchParams.get('agent') || ''
    const [activeSector, setActiveSector] = useState(SECTOR_ORDER.includes(initialSector) ? initialSector : 'Todos')
    const [activeDataRole, setActiveDataRole] = useState<DataRoleFilter>('all')
    const [query, setQuery] = useState('')
    const [agents, setAgents] = useState(snapshot.agents)
    const [selectedId, setSelectedId] = useState(
        snapshot.agents.some(agent => agent.id === initialAgentId) ? initialAgentId : (snapshot.agents[0]?.id || '')
    )
    const selectedAgent = agents.find(agent => agent.id === selectedId) || agents[0]
    const [draft, setDraft] = useState(selectedAgent?.promptValue || '')
    const [behaviorDraft, setBehaviorDraft] = useState<Record<string, string>>(buildBehaviorDraft(selectedAgent))
    const [saveState, setSaveState] = useState<SaveState>({ status: 'idle', message: '' })
    const [behaviorSaveState, setBehaviorSaveState] = useState<SaveState>({ status: 'idle', message: '' })
    const [topicSaveState, setTopicSaveState] = useState<SaveState>({ status: 'idle', message: '' })
    const [researchTopics, setResearchTopics] = useState<ResearchTopic[]>(parseResearchTopics(selectedAgent?.researchTopics))
    const [newResearchTopic, setNewResearchTopic] = useState<ResearchTopic>(EMPTY_RESEARCH_TOPIC)
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplateDraft[]>(parseEmailTemplates(selectedAgent?.emailTemplates))
    const [emailTemplateDraft, setEmailTemplateDraft] = useState<EmailTemplateDraft>(EMPTY_EMAIL_TEMPLATE_DRAFT)
    const [editingEmailTemplateId, setEditingEmailTemplateId] = useState<string | null>(null)
    const [emailTemplateSaveState, setEmailTemplateSaveState] = useState<SaveState>({ status: 'idle', message: '' })
    const [emailEditorExpanded, setEmailEditorExpanded] = useState(false)
    const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplateDraft[]>(parseWhatsAppTemplates(selectedAgent?.whatsappTemplates))
    const [whatsappTemplateDraft, setWhatsappTemplateDraft] = useState<WhatsAppTemplateDraft>(EMPTY_WHATSAPP_TEMPLATE_DRAFT)
    const [editingWhatsAppTemplateId, setEditingWhatsAppTemplateId] = useState<string | null>(null)
    const [whatsappTemplateSaveState, setWhatsappTemplateSaveState] = useState<SaveState>({ status: 'idle', message: '' })
    const [pushTemplates, setPushTemplates] = useState<PushTemplateDraft[]>(parsePushTemplates(selectedAgent?.pushTemplates))
    const [pushTemplateDraft, setPushTemplateDraft] = useState<PushTemplateDraft>(EMPTY_PUSH_TEMPLATE_DRAFT)
    const [editingPushTemplateId, setEditingPushTemplateId] = useState<string | null>(null)
    const [pushTemplateSaveState, setPushTemplateSaveState] = useState<SaveState>({ status: 'idle', message: '' })
    const [editorialCampaigns, setEditorialCampaigns] = useState<EditorialDistributionCampaign[]>([])
    const [editorialSummary, setEditorialSummary] = useState<Record<string, number>>({})
    const [editorialLoading, setEditorialLoading] = useState(false)
    const [editorialActionId, setEditorialActionId] = useState<string | null>(null)
    const [editorialSaveState, setEditorialSaveState] = useState<SaveState>({ status: 'idle', message: '' })
    const [syncingAction, setSyncingAction] = useState<string | null>(null)
    const [avatarSaveState, setAvatarSaveState] = useState<SaveState>({ status: 'idle', message: '' })
    const isUploadingAvatar = avatarSaveState.status === 'saving'
    const isBrokerAgent = selectedAgent?.source === 'virtual_brokers' && Boolean(selectedAgent?.brokerId)
    const isEventAgent = selectedAgent?.id === 'event-agent'
    const isCandidateAgent = selectedAgent?.id === 'broker-candidate-agent'
    const [brokerDraft, setBrokerDraft] = useState<OfficeBrokerDraft | null>(null)
    const [brokerLoading, setBrokerLoading] = useState(false)
    const [brokerSaveState, setBrokerSaveState] = useState<SaveState>({ status: 'idle', message: '' })
    const [availableInstances, setAvailableInstances] = useState<OfficeWhatsAppInstance[]>([])
    const [selectedInstanceId, setSelectedInstanceId] = useState('')
    const [linkedInstanceId, setLinkedInstanceId] = useState('')
    const [landingPages, setLandingPages] = useState<OfficeLandingPage[]>([])
    const [empreendimentos, setEmpreendimentos] = useState<OfficeEmpreendimento[]>([])
    const selectedWhatsAppInstance = useMemo(
        () => availableInstances.find(instance => instance.id === selectedInstanceId) || null,
        [availableInstances, selectedInstanceId]
    )
    const isTextOnlyMode = selectedWhatsAppInstance?.config?.response_mode === 'text'
    const [customLinkTags, setCustomLinkTags] = useState<CustomLinkButtonTag[]>([])
    const [elevenLabsVoices, setElevenLabsVoices] = useState<OfficeVoice[]>([])
    const [loadingVoices, setLoadingVoices] = useState(false)
    const [previewText, setPreviewText] = useState('Ola! Esta e uma previa da minha voz para atendimento no WhatsApp.')
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewError, setPreviewError] = useState('')
    const [previewAudioUrl, setPreviewAudioUrl] = useState('')
    const [assistantPhoneDraft, setAssistantPhoneDraft] = useState('')
    const [conciergeActions, setConciergeActions] = useState<ConciergeAction[]>([])
    const [conciergeActionSummary, setConciergeActionSummary] = useState<Record<string, number>>({})
    const [conciergeActionsLoading, setConciergeActionsLoading] = useState(false)
    const [conciergeActionsError, setConciergeActionsError] = useState('')
    const [conciergeActionUpdating, setConciergeActionUpdating] = useState<string | null>(null)
    const [eventReport, setEventReport] = useState<EventAgentReport | null>(null)
    const [eventReportLoading, setEventReportLoading] = useState(false)
    const [eventReportError, setEventReportError] = useState('')
    const [eventAiLoading, setEventAiLoading] = useState(false)
    const [eventList, setEventList] = useState<EventAgentEvent[]>([])
    const [selectedEventId, setSelectedEventId] = useState('')
    const [eventRules, setEventRules] = useState<EventAgentAutomationRule[]>([])
    const [eventAutomationDraft, setEventAutomationDraft] = useState<EventAutomationDraft>(EMPTY_EVENT_AUTOMATION_DRAFT)
    const [editingEventRuleId, setEditingEventRuleId] = useState<string | null>(null)
    const [eventAutomationLoading, setEventAutomationLoading] = useState(false)
    const [eventAutomationSaving, setEventAutomationSaving] = useState(false)

    const selectedSchedulePrefix = selectedAgent ? SCHEDULE_AGENT_PREFIX[selectedAgent.id] : null
    const agentScheduleSlots = useMemo(
        () => selectedSchedulePrefix ? getAgentScheduleSlots(behaviorDraft, selectedSchedulePrefix) : [],
        [behaviorDraft, selectedSchedulePrefix]
    )
    const emailHtmlPreview = useMemo(() => buildEmailPreviewDocument(emailTemplateDraft.html), [emailTemplateDraft.html])
    const emailSubjectPreview = useMemo(() => renderEmailTemplatePreview(emailTemplateDraft.subject), [emailTemplateDraft.subject])
    const emailPreheaderPreview = useMemo(() => renderEmailTemplatePreview(emailTemplateDraft.preheader), [emailTemplateDraft.preheader])
    const whatsappMessagePreview = useMemo(() => renderEmailTemplatePreview(whatsappTemplateDraft.message), [whatsappTemplateDraft.message])
    const pushTitlePreview = useMemo(() => renderEmailTemplatePreview(pushTemplateDraft.title), [pushTemplateDraft.title])
    const pushBodyPreview = useMemo(() => renderEmailTemplatePreview(pushTemplateDraft.body), [pushTemplateDraft.body])

    const updateBehaviorControl = (key: string, value: string) => {
        setBehaviorDraft(current => ({ ...current, [key]: value }))
    }

    const toggleAgentScheduleDay = (day: string) => {
        if (!selectedSchedulePrefix) return
        setBehaviorDraft(current => {
            const slots = getAgentScheduleSlots(current, selectedSchedulePrefix)
            const exists = slots.some(slot => slot.day === day)
            const defaultTime = selectedSchedulePrefix === 'news_agent' ? '10:00' : '09:00'
            const nextSlots = exists
                ? slots.filter(slot => slot.day !== day)
                : [...slots, { day, time: defaultTime }]
            return { ...current, ...packAgentScheduleSlots(selectedSchedulePrefix, nextSlots) }
        })
    }

    const updateAssistantPhone = (index: number, patch: Partial<BrokerAssistantPhone>) => {
        setBrokerDraft(current => {
            if (!current) return current
            return {
                ...current,
                assistant_phones: current.assistant_phones.map((phone, itemIndex) =>
                    itemIndex === index ? { ...phone, ...patch } : phone
                ),
            }
        })
    }

    const updateAgentScheduleTime = (day: string, time: string) => {
        if (!selectedSchedulePrefix) return
        setBehaviorDraft(current => {
            const slots = getAgentScheduleSlots(current, selectedSchedulePrefix)
                .map(slot => slot.day === day ? { ...slot, time } : slot)
            return { ...current, ...packAgentScheduleSlots(selectedSchedulePrefix, slots) }
        })
    }

    const loadEventAgentReport = async (eventId = selectedEventId) => {
        setEventReportLoading(true)
        setEventReportError('')

        try {
            const query = eventId ? `?event_id=${encodeURIComponent(eventId)}` : ''
            const response = await fetch(`/api/admin/pilger-ai/event-agent${query}`, { cache: 'no-store' })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || payload?.message || 'Nao foi possivel carregar o relatorio do agente.')
            }
            setEventReport(payload.report || null)
            if (payload.report?.event?.id) setSelectedEventId(payload.report.event.id)
            return payload.report as EventAgentReport | null
        } catch (error: any) {
            setEventReport(null)
            setEventReportError(error?.message || 'Erro ao carregar relatorio do Agente de Eventos.')
            return null
        } finally {
            setEventReportLoading(false)
        }
    }

    const loadEventAutomationWorkspace = async (eventId = selectedEventId) => {
        setEventAutomationLoading(true)
        setEventReportError('')

        try {
            const eventsResponse = await fetch('/api/admin/eventos', { cache: 'no-store' })
            const eventsPayload = await eventsResponse.json().catch(() => ({}))
            if (!eventsResponse.ok) throw new Error(eventsPayload?.error || 'Nao foi possivel carregar eventos.')

            const events = Array.isArray(eventsPayload?.events) ? eventsPayload.events as EventAgentEvent[] : []
            setEventList(events)
            const targetEventId = eventId || eventReport?.event?.id || events[0]?.id || ''
            setSelectedEventId(targetEventId)

            if (!targetEventId) {
                setEventRules([])
                return
            }

            const detailResponse = await fetch(`/api/admin/eventos/${targetEventId}`, { cache: 'no-store' })
            const detailPayload = await detailResponse.json().catch(() => ({}))
            if (!detailResponse.ok) throw new Error(detailPayload?.error || 'Nao foi possivel carregar automacoes do evento.')
            setEventRules(Array.isArray(detailPayload?.rules) ? detailPayload.rules : [])
        } catch (error: any) {
            setEventRules([])
            setEventReportError(error?.message || 'Erro ao carregar automacoes do Agente de Eventos.')
        } finally {
            setEventAutomationLoading(false)
        }
    }

    const updateEventAutomationDraft = (field: keyof EventAutomationDraft, value: string) => {
        setEventAutomationDraft(current => ({ ...current, [field]: value }))
    }

    const buildEventAutomationMetadata = () => {
        const draft = eventAutomationDraft
        const mapUrl = eventReport?.event?.maps_url || ''
        const buttons = [
            { label: draft.button_1_label, action: draft.button_1_action, url: draft.button_1_url },
            { label: draft.button_2_label, action: draft.button_2_action, url: draft.button_2_url || (draft.button_2_action === 'ver_mapa' ? mapUrl : '') },
            { label: draft.button_3_label, action: draft.button_3_action, url: draft.button_3_url },
        ]
            .map((button, index) => ({
                id: button.action || `evento_botao_${index + 1}`,
                label: button.label,
                action: button.action || `evento_botao_${index + 1}`,
                value: button.action || button.label,
                url: button.url,
            }))
            .filter(button => button.label.trim())

        return {
            source: 'event-agent-office',
            interaction_type: draft.interaction_type,
            tracking_enabled: true,
            tracking_tag: draft.tracking_tag,
            buttons,
            poll: {
                question: draft.poll_question,
                options: draft.poll_options.split(/\r?\n/).map(option => option.trim()).filter(Boolean),
                multi_select: false,
            },
        }
    }

    const createEventAutomationRule = async () => {
        if (!selectedEventId) {
            setEventReportError('Selecione um evento para criar a automacao.')
            return
        }

        setEventAutomationSaving(true)
        setEventReportError('')

        try {
            const currentRule = editingEventRuleId
                ? eventRules.find(rule => rule.id === editingEventRuleId)
                : null
            const body = {
                name: eventAutomationDraft.name,
                trigger_type: eventAutomationDraft.trigger_type,
                offset_minutes: Number(eventAutomationDraft.offset_minutes || 0),
                fixed_datetime: eventAutomationDraft.fixed_datetime || null,
                segment: eventAutomationDraft.segment,
                message_template: eventAutomationDraft.message_template,
                is_active: currentRule ? currentRule.is_active : true,
                metadata: buildEventAutomationMetadata(),
            }
            const response = await fetch(editingEventRuleId
                ? `/api/admin/eventos/automation-rules/${editingEventRuleId}`
                : `/api/admin/eventos/${selectedEventId}/automation-rules`, {
                method: editingEventRuleId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || payload?.message || 'Nao foi possivel salvar automacao.')
            }
            setEventAutomationDraft(EMPTY_EVENT_AUTOMATION_DRAFT)
            setEditingEventRuleId(null)
            await Promise.all([
                loadEventAutomationWorkspace(selectedEventId),
                loadEventAgentReport(selectedEventId),
            ])
        } catch (error: any) {
            setEventReportError(error?.message || 'Erro ao salvar automacao do agente.')
        } finally {
            setEventAutomationSaving(false)
        }
    }

    const editEventAutomationRule = (rule: EventAgentAutomationRule) => {
        setEditingEventRuleId(rule.id)
        setEventAutomationDraft(eventAutomationDraftFromRule(rule))
    }

    const duplicateEventAutomationRule = (rule: EventAgentAutomationRule) => {
        setEditingEventRuleId(null)
        setEventAutomationDraft({
            ...eventAutomationDraftFromRule(rule),
            name: `${rule.name} - copia`,
        })
    }

    const cancelEventAutomationEdit = () => {
        setEditingEventRuleId(null)
        setEventAutomationDraft(EMPTY_EVENT_AUTOMATION_DRAFT)
    }

    const patchEventAutomationRule = async (ruleId: string, patch: Record<string, any>) => {
        setEventAutomationSaving(true)
        setEventReportError('')

        try {
            const response = await fetch(`/api/admin/eventos/automation-rules/${ruleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || payload?.message || 'Nao foi possivel atualizar automacao.')
            }
            await loadEventAutomationWorkspace(selectedEventId)
        } catch (error: any) {
            setEventReportError(error?.message || 'Erro ao atualizar automacao do agente.')
        } finally {
            setEventAutomationSaving(false)
        }
    }

    const deleteEventAutomationRule = async (ruleId: string) => {
        if (!window.confirm('Remover esta automacao do Agente de Eventos?')) return
        setEventAutomationSaving(true)
        setEventReportError('')

        try {
            const response = await fetch(`/api/admin/eventos/automation-rules/${ruleId}`, { method: 'DELETE' })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || payload?.message || 'Nao foi possivel remover automacao.')
            }
            if (editingEventRuleId === ruleId) {
                setEditingEventRuleId(null)
                setEventAutomationDraft(EMPTY_EVENT_AUTOMATION_DRAFT)
            }
            await loadEventAutomationWorkspace(selectedEventId)
        } catch (error: any) {
            setEventReportError(error?.message || 'Erro ao remover automacao do agente.')
        } finally {
            setEventAutomationSaving(false)
        }
    }

    const generateEventAgentAiReport = async () => {
        setEventAiLoading(true)
        setEventReportError('')

        try {
            const response = await fetch('/api/admin/pilger-ai/event-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_id: eventReport?.event?.id || undefined }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || payload?.message || 'Nao foi possivel gerar a leitura IA.')
            }
            setEventReport(payload.report || null)
        } catch (error: any) {
            setEventReportError(error?.message || 'Erro ao gerar leitura IA do Agente de Eventos.')
        } finally {
            setEventAiLoading(false)
        }
    }

    const loadConciergeActions = async (brokerId = selectedAgent?.brokerId || '') => {
        if (!brokerId) {
            setConciergeActions([])
            setConciergeActionSummary({})
            return
        }

        setConciergeActionsLoading(true)
        setConciergeActionsError('')

        try {
            const response = await fetch(`/api/admin/pilger-ai/concierge-actions?broker_id=${encodeURIComponent(brokerId)}&limit=16`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || payload?.message || 'Nao foi possivel carregar a fila do concierge.')
            }
            setConciergeActions(Array.isArray(payload?.actions) ? payload.actions : [])
            setConciergeActionSummary(payload?.summary && typeof payload.summary === 'object' ? payload.summary : {})
        } catch (error: any) {
            setConciergeActions([])
            setConciergeActionSummary({})
            setConciergeActionsError(error?.message || 'Erro ao carregar a fila do concierge.')
        } finally {
            setConciergeActionsLoading(false)
        }
    }

    const cancelConciergeAction = async (actionId: string) => {
        setConciergeActionUpdating(actionId)
        setConciergeActionsError('')

        try {
            const response = await fetch('/api/admin/pilger-ai/concierge-actions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: actionId, status: 'cancelled' }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || payload?.message || 'Nao foi possivel cancelar a acao.')
            }
            await loadConciergeActions(selectedAgent?.brokerId || '')
        } catch (error: any) {
            setConciergeActionsError(error?.message || 'Erro ao cancelar a acao do concierge.')
        } finally {
            setConciergeActionUpdating(null)
        }
    }

    const dataRoleCounts = useMemo(() => {
        const counts = new Map<DataRoleFilter, number>()
        for (const option of DATA_ROLE_OPTIONS) counts.set(option.value, option.value === 'all' ? agents.length : 0)
        for (const agent of agents) {
            const role = getAgentDataRole(agent)
            counts.set(role, (counts.get(role) || 0) + 1)
        }
        return counts
    }, [agents])

    const sectorCounts = useMemo(() => {
        const roleFilteredAgents = activeDataRole === 'all'
            ? agents
            : agents.filter(agent => getAgentDataRole(agent) === activeDataRole)
        const counts = new Map<string, number>()
        for (const sector of SECTOR_ORDER) counts.set(sector, sector === 'Todos' ? roleFilteredAgents.length : 0)
        for (const agent of roleFilteredAgents) counts.set(agent.sector, (counts.get(agent.sector) || 0) + 1)
        return counts
    }, [activeDataRole, agents])

    const filteredAgents = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        return agents.filter(agent => {
            const role = getAgentDataRole(agent)
            const dataRoleMatch = activeDataRole === 'all' || role === activeDataRole
            if (!dataRoleMatch) return false
            const sectorMatch = activeSector === 'Todos' || agent.sector === activeSector
            if (!sectorMatch) return false
            if (!normalizedQuery) return true
            return [agent.name, agent.role, agent.sector, agent.detail]
                .concat([agent.personaName, agent.jobTitle, agent.bio, dataRoleLabel(role)])
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery)
        })
    }, [activeDataRole, activeSector, agents, query])

    const selectDataRole = (role: DataRoleFilter) => {
        setActiveDataRole(role)
        setActiveSector('Todos')
    }

    const selectAgent = (agent: AgentOfficeItem) => {
        setSelectedId(agent.id)
        setDraft(agent.promptValue || '')
        setBehaviorDraft(buildBehaviorDraft(agent))
        setSaveState({ status: 'idle', message: '' })
        setBehaviorSaveState({ status: 'idle', message: '' })
        setTopicSaveState({ status: 'idle', message: '' })
        setResearchTopics(parseResearchTopics(agent.researchTopics))
        setNewResearchTopic(EMPTY_RESEARCH_TOPIC)
        setEmailTemplates(parseEmailTemplates(agent.emailTemplates))
        setEmailTemplateDraft(EMPTY_EMAIL_TEMPLATE_DRAFT)
        setEditingEmailTemplateId(null)
        setEmailTemplateSaveState({ status: 'idle', message: '' })
        setEmailEditorExpanded(false)
        setWhatsappTemplates(parseWhatsAppTemplates(agent.whatsappTemplates))
        setWhatsappTemplateDraft(EMPTY_WHATSAPP_TEMPLATE_DRAFT)
        setEditingWhatsAppTemplateId(null)
        setWhatsappTemplateSaveState({ status: 'idle', message: '' })
        setPushTemplates(parsePushTemplates(agent.pushTemplates))
        setPushTemplateDraft(EMPTY_PUSH_TEMPLATE_DRAFT)
        setEditingPushTemplateId(null)
        setPushTemplateSaveState({ status: 'idle', message: '' })
        setEditorialCampaigns([])
        setEditorialSummary({})
        setEditorialSaveState({ status: 'idle', message: '' })
        setEditorialActionId(null)
        setAvatarSaveState({ status: 'idle', message: '' })
        setBrokerSaveState({ status: 'idle', message: '' })
        setPreviewError('')
        setAssistantPhoneDraft('')
        setConciergeActions([])
        setConciergeActionSummary({})
        setConciergeActionsError('')
        setConciergeActionUpdating(null)
        setEventReport(null)
        setEventReportError('')
        setEventReportLoading(false)
        setEventAiLoading(false)
        setEventList([])
        setSelectedEventId('')
        setEventRules([])
        setEventAutomationDraft(EMPTY_EVENT_AUTOMATION_DRAFT)
        setEditingEventRuleId(null)
        setEventAutomationLoading(false)
        setEventAutomationSaving(false)
    }

    useEffect(() => {
        if (selectedAgent?.id === 'email-orchestrator') {
            void loadEditorialCampaigns()
        }
    }, [selectedAgent?.id])

    useEffect(() => {
        return () => {
            if (previewAudioUrl && previewAudioUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewAudioUrl)
            }
        }
    }, [previewAudioUrl])

    useEffect(() => {
        if (!isBrokerAgent) return
        let cancelled = false

        const loadBrokerTools = async () => {
            try {
                const [agentConfigResponse, configResponse] = await Promise.all([
                    fetch('/api/admin/whatsapp/agent-config'),
                    fetch('/api/admin/configs'),
                ])
                const [agentConfigPayload, configPayload] = await Promise.all([
                    agentConfigResponse.json().catch(() => ({})),
                    configResponse.json().catch(() => ({})),
                ])

                if (cancelled) return

                const rawButtons = agentConfigPayload?.config?.agent_link_buttons
                if (rawButtons) {
                    try {
                        const parsed = JSON.parse(rawButtons)
                        setCustomLinkTags(Array.isArray(parsed)
                            ? parsed.filter((item: any) => typeof item?.tag === 'string' && item.tag.trim())
                            : [])
                    } catch {
                        setCustomLinkTags([])
                    }
                } else {
                    setCustomLinkTags([])
                }

                const apiKey = configPayload?.configs?.elevenlabs_api_key
                if (!apiKey) {
                    setElevenLabsVoices([])
                    return
                }

                setLoadingVoices(true)
                const voicesResponse = await fetch('/api/admin/elevenlabs-voices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey }),
                })
                const voicesPayload = await voicesResponse.json().catch(() => ({}))
                if (!cancelled) {
                    setElevenLabsVoices(Array.isArray(voicesPayload?.voices) ? voicesPayload.voices : [])
                }
            } catch {
                if (!cancelled) {
                    setCustomLinkTags([])
                    setElevenLabsVoices([])
                }
            } finally {
                if (!cancelled) setLoadingVoices(false)
            }
        }

        void loadBrokerTools()

        return () => {
            cancelled = true
        }
    }, [isBrokerAgent])

    useEffect(() => {
        let cancelled = false

        if (!isBrokerAgent || !selectedAgent?.brokerId) {
            setBrokerDraft(null)
            setSelectedInstanceId('')
            setLinkedInstanceId('')
            setConciergeActions([])
            setConciergeActionSummary({})
            setConciergeActionsError('')
            return
        }

        const loadBrokerWorkspace = async () => {
            setBrokerLoading(true)
            setBrokerSaveState({ status: 'idle', message: '' })

            try {
                const [brokerResponse, instancesResponse, landingResponse, empreendimentosResponse] = await Promise.all([
                    fetch('/api/admin/brokers'),
                    fetch('/api/admin/whatsapp/instances'),
                    fetch('/api/admin/landing-pages'),
                    fetch('/api/admin/empreendimentos'),
                ])

                const [brokerPayload, instancesPayload, landingPayload, empreendimentosPayload] = await Promise.all([
                    brokerResponse.json().catch(() => ({})),
                    instancesResponse.json().catch(() => ({})),
                    landingResponse.json().catch(() => ({})),
                    empreendimentosResponse.json().catch(() => ({})),
                ])

                if (cancelled) return

                const brokers = Array.isArray(brokerPayload?.data) ? brokerPayload.data as OfficeBroker[] : []
                const instances = (Array.isArray(instancesPayload?.instances) ? instancesPayload.instances : instancesPayload?.data || []) as OfficeWhatsAppInstance[]
                const pages = (Array.isArray(landingPayload?.data) ? landingPayload.data : []) as OfficeLandingPage[]
                const developments = (Array.isArray(empreendimentosPayload?.data) ? empreendimentosPayload.data : []) as OfficeEmpreendimento[]
                const broker = brokers.find(item => String(item.id) === String(selectedAgent.brokerId))

                setAvailableInstances(instances)
                setLandingPages(pages)
                setEmpreendimentos(developments)

                if (!broker) {
                    setBrokerDraft(null)
                    setBrokerSaveState({ status: 'error', message: 'Cadastro tecnico deste corretor nao foi encontrado.' })
                    return
                }

                const linked = instances.find(instance => {
                    const instancePhone = getInstancePhone(instance)
                    const brokerPhone = normalizePhone(broker.phone || '')
                    return String(instance.broker_id || '') === String(broker.id) ||
                        (!!brokerPhone && instancePhone === brokerPhone)
                })

                setBrokerDraft(makeBrokerDraft(broker, selectedAgent))
                setDraft(broker.system_prompt || selectedAgent.promptValue || '')
                setSelectedInstanceId(linked?.id || '')
                setLinkedInstanceId(linked?.id || '')
            } catch (error: any) {
                if (cancelled) return
                setBrokerDraft(null)
                setBrokerSaveState({ status: 'error', message: error?.message || 'Nao foi possivel carregar as configuracoes do corretor.' })
            } finally {
                if (!cancelled) setBrokerLoading(false)
            }
        }

        void loadBrokerWorkspace()

        return () => {
            cancelled = true
        }
    }, [isBrokerAgent, selectedAgent?.brokerId])

    useEffect(() => {
        if (!isBrokerAgent || !selectedAgent?.brokerId) {
            setConciergeActions([])
            setConciergeActionSummary({})
            setConciergeActionsError('')
            return
        }

        void loadConciergeActions(selectedAgent.brokerId)
    }, [isBrokerAgent, selectedAgent?.brokerId])

    useEffect(() => {
        if (!isEventAgent) {
            setEventReport(null)
            setEventReportError('')
            setEventReportLoading(false)
            setEventAiLoading(false)
            setEventList([])
            setSelectedEventId('')
            setEventRules([])
            setEventAutomationDraft(EMPTY_EVENT_AUTOMATION_DRAFT)
            setEditingEventRuleId(null)
            setEventAutomationLoading(false)
            setEventAutomationSaving(false)
            return
        }

        const bootEventAgent = async () => {
            const report = await loadEventAgentReport()
            await loadEventAutomationWorkspace(report?.event?.id || '')
        }

        void bootEventAgent()
    }, [isEventAgent])

    const saveBrokerSettings = async () => {
        if (!selectedAgent?.brokerId || !brokerDraft) return
        setBrokerSaveState({ status: 'saving', message: 'Salvando configuracoes do corretor IA...' })

        try {
            const selectedInstance = availableInstances.find(instance => instance.id === selectedInstanceId) || null
            const syncedPhone = getInstancePhone(selectedInstance) || brokerDraft.phone || ''
            const transferPhone = normalizePhone(brokerDraft.transfer_to_phone)
            const payload = {
                id: selectedAgent.brokerId,
                name: brokerDraft.name.trim() || selectedAgent.personaName,
                creci: brokerDraft.creci.trim() || 'N/A',
                is_active: brokerDraft.is_active,
                phone: syncedPhone,
                summary_to_phone: transferPhone,
                transfer_to_phone: transferPhone,
                handoff_prompt: brokerDraft.handoff_prompt,
                voice_id: brokerDraft.voice_id,
                concierge_enabled: brokerDraft.concierge_enabled,
                concierge_prompt: brokerDraft.concierge_prompt,
                concierge_require_confirmation: brokerDraft.concierge_require_confirmation,
                system_prompt: draft,
                assignment_type: brokerDraft.assignment_type || 'all',
                assigned_page_slugs: brokerDraft.assignment_type === 'landing_pages' ? brokerDraft.assigned_page_slugs : [],
                empreendimento_ids: brokerDraft.empreendimento_ids,
                assistant_phones: brokerDraft.assistant_phones.map(phone => ({
                    phone: normalizePhone(phone.phone),
                    name: String(phone.name || '').trim(),
                    role: phone.role || 'broker',
                    can_manage_agenda: phone.can_manage_agenda !== false,
                    can_manage_leads: phone.can_manage_leads === true,
                    can_send_messages: phone.can_send_messages === true,
                    can_update_crm: phone.can_update_crm === true,
                    can_manage_finance: phone.can_manage_finance === true,
                    can_view_reports: phone.can_view_reports === true,
                    can_view_properties: phone.can_view_properties !== false,
                    is_active: phone.is_active !== false,
                })).filter(phone => phone.phone),
            }

            const response = await fetch('/api/admin/brokers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const payloadResponse = await response.json().catch(() => ({}))
            if (!response.ok || payloadResponse?.success === false || payloadResponse?.error) {
                throw new Error(payloadResponse?.message || payloadResponse?.error || 'Nao foi possivel salvar o corretor.')
            }

            if (selectedInstanceId !== linkedInstanceId) {
                const linkResponse = await fetch('/api/admin/whatsapp/instances', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        brokerId: selectedAgent.brokerId,
                        instanceId: selectedInstanceId || null,
                    }),
                })
                const linkPayload = await linkResponse.json().catch(() => ({}))
                if (!linkResponse.ok || linkPayload?.success === false) {
                    throw new Error(linkPayload?.message || linkPayload?.error || 'Corretor salvo, mas a instancia nao foi vinculada.')
                }
                setLinkedInstanceId(selectedInstanceId)
            }

            const savedBroker = payloadResponse?.data || {}
            setBrokerDraft(current => current ? {
                ...current,
                phone: normalizePhone(savedBroker.phone || syncedPhone),
                transfer_to_phone: normalizePhone(savedBroker.transfer_to_phone || transferPhone),
                concierge_enabled: typeof savedBroker.concierge_enabled === 'boolean'
                    ? savedBroker.concierge_enabled
                    : current.concierge_enabled,
                concierge_prompt: typeof savedBroker.concierge_prompt === 'string'
                    ? savedBroker.concierge_prompt
                    : current.concierge_prompt,
                concierge_require_confirmation: typeof savedBroker.concierge_require_confirmation === 'boolean'
                    ? savedBroker.concierge_require_confirmation
                    : current.concierge_require_confirmation,
            } : current)
            setAgents(current => current.map(agent => agent.id === selectedAgent.id
                ? {
                    ...agent,
                    personaName: payload.name,
                    avatarInitials: payload.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || agent.avatarInitials,
                    jobTitle: payload.creci ? `Corretor IA - CRECI ${payload.creci}` : 'Corretor IA',
                    role: payload.creci ? `Corretor IA - CRECI ${payload.creci}` : 'Corretor IA',
                    status: payload.is_active ? 'Ativo' : 'Inativo',
                    tone: payload.is_active ? 'success' : 'muted',
                    detail: syncedPhone ? `Instancia WhatsApp vinculada - ${formatPhoneLabel(syncedPhone)}.` : agent.detail,
                    promptValue: draft,
                }
                : agent))
            setBrokerSaveState({ status: 'success', message: 'Configuracoes do corretor salvas no Escritorio do Agente.' })
        } catch (error: any) {
            setBrokerSaveState({ status: 'error', message: error?.message || 'Erro ao salvar configuracoes do corretor.' })
        }
    }

    const insertPromptTag = (tag: string) => {
        const textarea = document.getElementById('agent-office-prompt-textarea') as HTMLTextAreaElement | null
        if (!textarea) {
            setDraft(current => `${current}${current.trim() ? ' ' : ''}${tag}`)
            return
        }

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const next = draft.slice(0, start) + tag + draft.slice(end)
        setDraft(next)
        window.setTimeout(() => {
            textarea.focus()
            textarea.selectionStart = start + tag.length
            textarea.selectionEnd = start + tag.length
        }, 0)
    }

    const insertConciergePromptTag = (tag: string) => {
        const textarea = document.getElementById('agent-office-concierge-prompt-textarea') as HTMLTextAreaElement | null
        if (!textarea) {
            setBrokerDraft(current => current ? {
                ...current,
                concierge_prompt: `${current.concierge_prompt}${current.concierge_prompt.trim() ? ' ' : ''}${tag}`,
            } : current)
            return
        }

        const currentPrompt = brokerDraft?.concierge_prompt || ''
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const next = currentPrompt.slice(0, start) + tag + currentPrompt.slice(end)
        setBrokerDraft(current => current ? { ...current, concierge_prompt: next } : current)
        window.setTimeout(() => {
            textarea.focus()
            textarea.selectionStart = start + tag.length
            textarea.selectionEnd = start + tag.length
        }, 0)
    }

    const handleVoicePreview = async () => {
        if (!brokerDraft) return
        setPreviewError('')
        setPreviewLoading(true)

        try {
            const selectedEleven = !brokerDraft.voice_id.startsWith('openai:')
                ? elevenLabsVoices.find(voice => voice.voice_id === brokerDraft.voice_id)
                : null

            if (selectedEleven?.preview_url) {
                if (previewAudioUrl && previewAudioUrl.startsWith('blob:')) URL.revokeObjectURL(previewAudioUrl)
                setPreviewAudioUrl(selectedEleven.preview_url)
                setPreviewLoading(false)
                return
            }

            const response = await fetch('/api/admin/voice-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voiceId: brokerDraft.voice_id,
                    text: previewText,
                }),
            })

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}))
                throw new Error(payload?.error || 'Falha ao gerar previa de voz.')
            }

            const blob = await response.blob()
            if (previewAudioUrl && previewAudioUrl.startsWith('blob:')) URL.revokeObjectURL(previewAudioUrl)
            setPreviewAudioUrl(URL.createObjectURL(blob))
        } catch (error: any) {
            setPreviewError(error?.message || 'Falha ao gerar previa de voz.')
        } finally {
            setPreviewLoading(false)
        }
    }

    const savePrompt = async () => {
        if (!selectedAgent || !canEdit(selectedAgent)) return
        setSaveState({ status: 'saving', message: 'Salvando prompt do agente...' })

        try {
            const response = selectedAgent.source === 'virtual_brokers'
                ? await fetch('/api/admin/brokers', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: selectedAgent.brokerId, system_prompt: draft }),
                })
                : await fetch('/api/admin/configs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ configs: { [selectedAgent.promptKey as string]: draft } }),
                })

            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.message || payload?.error || 'Nao foi possivel salvar.')
            }

            setAgents(current => current.map(agent => agent.id === selectedAgent.id
                ? {
                    ...agent,
                    promptValue: draft,
                    status: draft.trim() ? (agent.source === 'virtual_brokers' ? agent.status : 'Configurado') : 'Sem prompt',
                    tone: draft.trim() ? 'success' : 'warning',
                }
                : agent))
            setSaveState({ status: 'success', message: 'Prompt salvo no escritorio de agentes.' })
        } catch (error: any) {
            setSaveState({ status: 'error', message: error?.message || 'Erro ao salvar prompt.' })
        }
    }

    const saveBehavior = async () => {
        if (!selectedAgent?.behaviorControls?.length) return
        setBehaviorSaveState({ status: 'saving', message: 'Salvando comportamento do agente...' })

        try {
            const configs = Object.fromEntries(
                selectedAgent.behaviorControls.map(control => [control.key, behaviorDraft[control.key] ?? control.fallback])
            )
            const response = await fetch('/api/admin/configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.message || payload?.error || 'Nao foi possivel salvar comportamento.')
            }

            setAgents(current => current.map(agent => agent.id === selectedAgent.id
                ? {
                    ...agent,
                    behaviorControls: agent.behaviorControls?.map(control => ({
                        ...control,
                        value: behaviorDraft[control.key] ?? control.fallback,
                    })),
                }
                : agent))
            setBehaviorSaveState({ status: 'success', message: 'Comportamento salvo no agente.' })
        } catch (error: any) {
            setBehaviorSaveState({ status: 'error', message: error?.message || 'Erro ao salvar comportamento.' })
        }
    }

    const runBehaviorAction = async (actionId: string) => {
        setSyncingAction(actionId)
        setBehaviorSaveState({ status: 'saving', message: actionId === 'sync_ads_spend' ? 'Sincronizando trafego pago...' : 'Gerando relatorio...' })
        try {
            const response = actionId === 'sync_ads_spend'
                ? await fetch('/api/admin/finance/sync-ads-spend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                })
                : await fetch('/api/admin/trigger-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: actionId === 'generate_weekly_report' ? 'weekly' : 'daily' }),
                })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || payload?.message || 'Nao foi possivel executar a acao.')
            }
            setBehaviorSaveState({ status: 'success', message: payload?.message || 'Acao executada com sucesso.' })
        } catch (error: any) {
            setBehaviorSaveState({ status: 'error', message: error?.message || 'Erro ao executar acao.' })
        } finally {
            setSyncingAction(null)
        }
    }

    const updateEmailTemplateDraft = (field: keyof EmailTemplateDraft, value: string) => {
        setEmailTemplateDraft(current => ({ ...current, [field]: value }))
    }

    const insertEmailTemplateTag = (tag: string, field: 'html' | 'text' | 'subject' = 'html') => {
        setEmailTemplateDraft(current => ({
            ...current,
            [field]: `${current[field]}${current[field].trim() ? ' ' : ''}${tag}`,
        }))
    }

    const resetEmailTemplateDraft = () => {
        setEmailTemplateDraft(EMPTY_EMAIL_TEMPLATE_DRAFT)
        setEditingEmailTemplateId(null)
        setEmailEditorExpanded(false)
    }

    const editEmailTemplate = (template: EmailTemplateDraft) => {
        setEmailTemplateDraft({ ...template })
        setEditingEmailTemplateId(template.id)
        setEmailTemplateSaveState({ status: 'idle', message: '' })
    }

    const upsertEmailTemplate = () => {
        const { template: nextTemplate, error } = buildEmailTemplateDraft(
            emailTemplateDraft,
            emailTemplates,
            editingEmailTemplateId
        )
        if (error || !nextTemplate) {
            setEmailTemplateSaveState({
                status: 'error',
                message: error || 'Preencha Nome e Assunto para adicionar o template.',
            })
            return
        }

        setEmailTemplates(current => mergeEmailTemplateList(current, nextTemplate))
        resetEmailTemplateDraft()
        setEmailTemplateSaveState({ status: 'idle', message: '' })
    }

    const removeEmailTemplate = (id: string) => {
        setEmailTemplates(current => current.filter(template => template.id !== id))
        if (editingEmailTemplateId === id) resetEmailTemplateDraft()
    }

    const updateWhatsAppTemplateDraft = (field: keyof WhatsAppTemplateDraft, value: string) => {
        setWhatsappTemplateDraft(current => ({ ...current, [field]: value }))
    }

    const insertWhatsAppTemplateTag = (tag: string) => {
        setWhatsappTemplateDraft(current => ({
            ...current,
            message: `${current.message}${current.message.trim() ? ' ' : ''}${tag}`,
        }))
    }

    const resetWhatsAppTemplateDraft = () => {
        setWhatsappTemplateDraft(EMPTY_WHATSAPP_TEMPLATE_DRAFT)
        setEditingWhatsAppTemplateId(null)
    }

    const editWhatsAppTemplate = (template: WhatsAppTemplateDraft) => {
        setWhatsappTemplateDraft({ ...template })
        setEditingWhatsAppTemplateId(template.id)
        setWhatsappTemplateSaveState({ status: 'idle', message: '' })
    }

    const upsertWhatsAppTemplate = () => {
        const { template: nextTemplate, error } = buildWhatsAppTemplateDraft(
            whatsappTemplateDraft,
            whatsappTemplates,
            editingWhatsAppTemplateId
        )
        if (error || !nextTemplate) {
            setWhatsappTemplateSaveState({
                status: 'error',
                message: error || 'Preencha Nome e Mensagem para adicionar o template.',
            })
            return
        }

        setWhatsappTemplates(current => mergeWhatsAppTemplateList(current, nextTemplate))
        resetWhatsAppTemplateDraft()
        setWhatsappTemplateSaveState({ status: 'idle', message: '' })
    }

    const removeWhatsAppTemplate = (id: string) => {
        setWhatsappTemplates(current => current.filter(template => template.id !== id))
        if (editingWhatsAppTemplateId === id) resetWhatsAppTemplateDraft()
    }

    const updatePushTemplateDraft = (field: keyof PushTemplateDraft, value: string) => {
        setPushTemplateDraft(current => ({ ...current, [field]: value }))
    }

    const insertPushTemplateTag = (tag: string, field: 'title' | 'body' = 'body') => {
        setPushTemplateDraft(current => ({
            ...current,
            [field]: `${current[field]}${current[field].trim() ? ' ' : ''}${tag}`,
        }))
    }

    const resetPushTemplateDraft = () => {
        setPushTemplateDraft(EMPTY_PUSH_TEMPLATE_DRAFT)
        setEditingPushTemplateId(null)
    }

    const editPushTemplate = (template: PushTemplateDraft) => {
        setPushTemplateDraft({ ...template })
        setEditingPushTemplateId(template.id)
        setPushTemplateSaveState({ status: 'idle', message: '' })
    }

    const upsertPushTemplate = () => {
        const { template: nextTemplate, error } = buildPushTemplateDraft(
            pushTemplateDraft,
            pushTemplates,
            editingPushTemplateId
        )
        if (error || !nextTemplate) {
            setPushTemplateSaveState({
                status: 'error',
                message: error || 'Preencha Nome, Titulo e Mensagem para adicionar o template.',
            })
            return
        }

        setPushTemplates(current => mergePushTemplateList(current, nextTemplate))
        resetPushTemplateDraft()
        setPushTemplateSaveState({ status: 'idle', message: '' })
    }

    const removePushTemplate = (id: string) => {
        setPushTemplates(current => current.filter(template => template.id !== id))
        if (editingPushTemplateId === id) resetPushTemplateDraft()
    }

    const saveEmailTemplates = async () => {
        if (selectedAgent?.id !== 'email-orchestrator') return
        setEmailTemplateSaveState({ status: 'saving', message: 'Salvando templates do Gabriel...' })

        try {
            const { template: draftTemplate, error } = buildEmailTemplateDraft(
                emailTemplateDraft,
                emailTemplates,
                editingEmailTemplateId
            )
            if (error) throw new Error(error)

            const templatesToSave = draftTemplate
                ? mergeEmailTemplateList(emailTemplates, draftTemplate)
                : emailTemplates
            const serialized = JSON.stringify(templatesToSave)
            const response = await fetch('/api/admin/configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs: { email_agent_templates: serialized } }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.message || payload?.error || 'Nao foi possivel salvar templates.')
            }

            setAgents(current => current.map(agent => agent.id === selectedAgent.id
                ? { ...agent, emailTemplates: serialized }
                : agent))
            setEmailTemplates(templatesToSave)
            if (draftTemplate) resetEmailTemplateDraft()
            setEmailTemplateSaveState({
                status: 'success',
                message: draftTemplate
                    ? 'Template salvo na biblioteca e configurações salvas.'
                    : 'Templates salvos no agente de e-mail.',
            })
        } catch (error: any) {
            setEmailTemplateSaveState({ status: 'error', message: error?.message || 'Erro ao salvar templates.' })
        }
    }

    const saveWhatsAppTemplates = async () => {
        if (selectedAgent?.id !== 'email-orchestrator') return
        setWhatsappTemplateSaveState({ status: 'saving', message: 'Salvando templates de WhatsApp do Gabriel...' })

        try {
            const { template: draftTemplate, error } = buildWhatsAppTemplateDraft(
                whatsappTemplateDraft,
                whatsappTemplates,
                editingWhatsAppTemplateId
            )
            if (error) throw new Error(error)

            const templatesToSave = draftTemplate
                ? mergeWhatsAppTemplateList(whatsappTemplates, draftTemplate)
                : whatsappTemplates
            const serialized = JSON.stringify(templatesToSave)
            const response = await fetch('/api/admin/configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs: { editorial_distribution_whatsapp_templates: serialized } }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.message || payload?.error || 'Nao foi possivel salvar templates de WhatsApp.')
            }

            setAgents(current => current.map(agent => agent.id === selectedAgent.id
                ? { ...agent, whatsappTemplates: serialized }
                : agent))
            setWhatsappTemplates(templatesToSave)
            if (draftTemplate) resetWhatsAppTemplateDraft()
            setWhatsappTemplateSaveState({
                status: 'success',
                message: draftTemplate
                    ? 'Template de WhatsApp salvo na biblioteca e configuracoes salvas.'
                    : 'Templates de WhatsApp salvos no Gabriel.',
            })
        } catch (error: any) {
            setWhatsappTemplateSaveState({ status: 'error', message: error?.message || 'Erro ao salvar templates de WhatsApp.' })
        }
    }

    const savePushTemplates = async () => {
        if (selectedAgent?.id !== 'email-orchestrator') return
        setPushTemplateSaveState({ status: 'saving', message: 'Salvando templates de push do Gabriel...' })

        try {
            const { template: draftTemplate, error } = buildPushTemplateDraft(
                pushTemplateDraft,
                pushTemplates,
                editingPushTemplateId
            )
            if (error) throw new Error(error)

            const templatesToSave = draftTemplate
                ? mergePushTemplateList(pushTemplates, draftTemplate)
                : pushTemplates
            const serialized = JSON.stringify(templatesToSave)
            const response = await fetch('/api/admin/configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs: { editorial_distribution_push_templates: serialized } }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.message || payload?.error || 'Nao foi possivel salvar templates de push.')
            }

            setAgents(current => current.map(agent => agent.id === selectedAgent.id
                ? { ...agent, pushTemplates: serialized }
                : agent))
            setPushTemplates(templatesToSave)
            if (draftTemplate) resetPushTemplateDraft()
            setPushTemplateSaveState({
                status: 'success',
                message: draftTemplate
                    ? 'Template de push salvo na biblioteca e configuracoes salvas.'
                    : 'Templates de push salvos no Gabriel.',
            })
        } catch (error: any) {
            setPushTemplateSaveState({ status: 'error', message: error?.message || 'Erro ao salvar templates de push.' })
        }
    }

    const loadEditorialCampaigns = async () => {
        setEditorialLoading(true)
        try {
            const response = await fetch('/api/admin/editorial-distribution', { cache: 'no-store' })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || payload?.message || 'Nao foi possivel carregar campanhas editoriais.')
            }
            setEditorialCampaigns(Array.isArray(payload.campaigns) ? payload.campaigns : [])
            setEditorialSummary(payload.summary || {})
        } catch (error: any) {
            setEditorialCampaigns([])
            setEditorialSaveState({ status: 'error', message: error?.message || 'Erro ao carregar distribuicao editorial.' })
        } finally {
            setEditorialLoading(false)
        }
    }

    const runEditorialAction = async (action: string, campaignId?: string) => {
        setEditorialActionId(campaignId || action)
        setEditorialSaveState({ status: 'saving', message: 'Atualizando fila editorial...' })
        try {
            const response = await fetch('/api/admin/editorial-distribution', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, campaign_id: campaignId }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || payload?.message || 'Nao foi possivel executar a acao.')
            }
            setEditorialCampaigns(Array.isArray(payload.campaigns) ? payload.campaigns : [])
            setEditorialSummary(payload.summary || {})
            const message = action === 'prepare_latest'
                ? 'Ultimos conteudos preparados para aprovacao/envio.'
                : action === 'prepare_archive'
                    ? 'Acervo publicado preparado sem duplicar campanhas existentes.'
                    : action === 'prepare_recommendations'
                        ? 'Recomendacoes comportamentais preparadas para aprovacao/envio.'
                        : action === 'process_due'
                            ? 'Fila processada agora.'
                            : 'Campanha atualizada.'
            setEditorialSaveState({ status: 'success', message })
        } catch (error: any) {
            setEditorialSaveState({ status: 'error', message: error?.message || 'Erro ao atualizar fila editorial.' })
        } finally {
            setEditorialActionId(null)
        }
    }

    const addResearchTopic = () => {
        const topic = newResearchTopic.topic.trim()
        if (!topic) {
            setTopicSaveState({ status: 'error', message: 'Informe um tema para adicionar ao banco do Mateus Pesquisa Externa.' })
            return
        }

        setResearchTopics(current => [
            ...current,
            {
                ...newResearchTopic,
                id: makeTopicId(),
                topic,
                region: newResearchTopic.region.trim(),
            },
        ])
        setNewResearchTopic(EMPTY_RESEARCH_TOPIC)
        setTopicSaveState({ status: 'idle', message: '' })
    }

    const updateResearchTopic = (id: string, patch: Partial<ResearchTopic>) => {
        setResearchTopics(current => current.map(topic => topic.id === id ? { ...topic, ...patch } : topic))
    }

    const removeResearchTopic = (id: string) => {
        setResearchTopics(current => current.filter(topic => topic.id !== id))
    }

    const saveResearchTopics = async () => {
        if (selectedAgent?.id !== 'research-pilger') return
        setTopicSaveState({ status: 'saving', message: 'Salvando banco de temas do Mateus Pesquisa Externa...' })

        try {
            const configs = {
                research_pilger_topics: JSON.stringify(researchTopics.map(topic => ({
                    ...topic,
                    topic: topic.topic.trim(),
                    region: topic.region.trim(),
                })).filter(topic => topic.topic)),
            }
            const response = await fetch('/api/admin/configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.message || payload?.error || 'Nao foi possivel salvar os temas.')
            }

            setAgents(current => current.map(agent => agent.id === selectedAgent.id
                ? { ...agent, researchTopics: configs.research_pilger_topics }
                : agent))
            setTopicSaveState({ status: 'success', message: 'Banco de temas salvo para o Mateus Pesquisa Externa.' })
        } catch (error: any) {
            setTopicSaveState({ status: 'error', message: error?.message || 'Erro ao salvar temas.' })
        }
    }

    const uploadAvatar = async (file?: File | null) => {
        if (!file || !selectedAgent) return

        if (!file.type.startsWith('image/')) {
            setAvatarSaveState({ status: 'error', message: 'Envie uma imagem JPG, PNG ou WEBP.' })
            return
        }

        if (file.size > MAX_AVATAR_SIZE) {
            setAvatarSaveState({ status: 'error', message: 'A foto precisa ter ate 20MB.' })
            return
        }

        setAvatarSaveState({ status: 'saving', message: 'Enviando foto do agente...' })

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('folder', 'agent-avatars')
            formData.append('kind', 'image')

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })
            const uploadPayload = await uploadResponse.json().catch(() => ({}))
            if (!uploadResponse.ok || !uploadPayload?.url) {
                throw new Error(uploadPayload?.error || uploadPayload?.details || 'Nao foi possivel enviar a foto.')
            }

            if (selectedAgent.source === 'virtual_brokers') {
                if (!selectedAgent.brokerId) {
                    throw new Error('Este corretor ainda nao tem cadastro vinculado para salvar a foto.')
                }
                const response = await fetch('/api/admin/brokers', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: selectedAgent.brokerId, photo_url: uploadPayload.url }),
                })
                const payload = await response.json().catch(() => ({}))
                if (!response.ok || payload?.success === false) {
                    throw new Error(payload?.message || payload?.error || 'Nao foi possivel salvar a foto do corretor.')
                }
            } else {
                const key = selectedAgent.avatarConfigKey || `agent_avatar_${selectedAgent.id}`
                const response = await fetch('/api/admin/configs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ configs: { [key]: uploadPayload.url } }),
                })
                const payload = await response.json().catch(() => ({}))
                if (!response.ok || payload?.success === false) {
                    throw new Error(payload?.message || payload?.error || 'Nao foi possivel salvar a foto do agente.')
                }
            }

            setAgents(current => current.map(agent => agent.id === selectedAgent.id
                ? {
                    ...agent,
                    avatarUrl: uploadPayload.url,
                    avatarConfigKey: agent.avatarConfigKey || (agent.source === 'virtual_brokers' ? undefined : `agent_avatar_${agent.id}`),
                }
                : agent))
            setAvatarSaveState({ status: 'success', message: 'Foto do agente atualizada.' })
        } catch (error: any) {
            setAvatarSaveState({ status: 'error', message: error?.message || 'Erro ao enviar foto.' })
        }
    }

    const handleAvatarInput = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.currentTarget.value = ''
        void uploadAvatar(file)
    }

    if (!selectedAgent) {
        return (
            <section className="agent-office-empty">
                <UserRoundCog size={24} />
                Nenhum agente encontrado ainda.
            </section>
        )
    }

    return (
        <div className="agent-office">
            <AgentOfficeStyles />
            <section className="agent-office-roster-panel">
                <div className="agent-office-roster-head">
                    <div className="agent-office-search agent-office-roster-search">
                        <Search size={15} />
                        <input
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="Buscar agente, setor ou funcao"
                        />
                    </div>
                    <div className="agent-office-roster-summary">
                        <strong>{filteredAgents.length}</strong>
                        <span>{filteredAgents.length === 1 ? 'agente na visao' : 'agentes na visao'}</span>
                    </div>
                </div>

                <div className="agent-office-data-roles" role="group" aria-label="Papel dos agentes na Central de Inteligencia">
                    {DATA_ROLE_OPTIONS.map(option => (
                        <button
                            type="button"
                            key={option.value}
                            className={activeDataRole === option.value ? 'active' : ''}
                            onClick={() => selectDataRole(option.value)}
                            title={option.description}
                        >
                            <span>{option.label}</span>
                            <strong>{dataRoleCounts.get(option.value) || 0}</strong>
                        </button>
                    ))}
                </div>

                <div className="agent-office-sectors agent-office-sector-rail">
                    {SECTOR_ORDER.map(sector => (
                        <button
                            type="button"
                            key={sector}
                            className={activeSector === sector ? 'active' : ''}
                            onClick={() => setActiveSector(sector)}
                        >
                            <span>{sector}</span>
                            <strong>{sectorCounts.get(sector) || 0}</strong>
                        </button>
                    ))}
                </div>

                <div className="agent-office-list agent-office-agent-rail">
                    {filteredAgents.map(agent => (
                        <button
                            type="button"
                            key={agent.id}
                            className={selectedAgent.id === agent.id ? 'active' : ''}
                            onClick={() => selectAgent(agent)}
                        >
                            <span className={avatarClass(agent)} data-status={agent.tone}>
                                {agent.avatarUrl ? <img src={agent.avatarUrl} alt="" /> : <span>{agent.avatarInitials}</span>}
                            </span>
                            <div>
                                <strong>{agent.personaName}</strong>
                                <small>{agent.jobTitle}</small>
                                <span className={`agent-office-data-role-badge ${getAgentDataRole(agent)}`}>
                                    {dataRoleLabel(getAgentDataRole(agent))}
                                </span>
                            </div>
                            <ChevronRight size={15} />
                        </button>
                    ))}
                    {filteredAgents.length === 0 && (
                        <div className="agent-office-no-results">Nenhum agente combina com esse filtro.</div>
                    )}
                </div>
            </section>

            <section className="agent-office-shell agent-office-shell-expanded">
                <main className="agent-office-detail">
                    <div className="agent-office-detail-head">
                        <div className="agent-office-person-card">
                            <span className={avatarClass(selectedAgent)} data-status={selectedAgent.tone}>
                                {selectedAgent.avatarUrl ? <img src={selectedAgent.avatarUrl} alt="" /> : <span>{selectedAgent.avatarInitials}</span>}
                            </span>
                            <div>
                                <span className="pilger-ai-eyebrow">{selectedAgent.sector} - {selectedAgent.name}</span>
                                <h2><Bot size={20} /> {selectedAgent.personaName}</h2>
                                <strong>{selectedAgent.jobTitle}</strong>
                                <p>{selectedAgent.bio}</p>
                                <div className="agent-office-avatar-upload">
                                    <label className={isUploadingAvatar ? 'is-disabled' : ''}>
                                        {isUploadingAvatar ? <Loader2 size={14} className="spin" /> : <Camera size={14} />}
                                        {isUploadingAvatar ? 'Enviando...' : 'Trocar foto'}
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            disabled={isUploadingAvatar}
                                            onChange={handleAvatarInput}
                                        />
                                    </label>
                                    {avatarSaveState.message && (
                                        <span className={`agent-office-save-message ${avatarSaveState.status}`}>
                                            {avatarSaveState.message}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className={`agent-office-status ${toneClass(selectedAgent.tone)}`}>
                            <CircleDot size={14} />
                            {selectedAgent.status}
                        </div>
                    </div>

                    {selectedAgent.centralContract && (
                        <div className="agent-office-central-card">
                            <div className="agent-office-prompt-head">
                                <div>
                                    <h3><CircleDot size={17} /> Central de Inteligencia</h3>
                                    <p>
                                        {selectedAgent.centralContract.name} opera como agente de {selectedAgent.centralContract.ecosystemAgent}
                                        {' '}e participa do ciclo de coleta, consumo e handoff de dados.
                                    </p>
                                </div>
                                <span className={`agent-office-central-status ${selectedAgent.centralContract.status}`}>
                                    {selectedAgent.centralContract.status === 'full'
                                        ? 'Ciclo completo'
                                        : selectedAgent.centralContract.status === 'contracted'
                                            ? 'Contrato definido'
                                            : 'Parcial'}
                                </span>
                            </div>
                            <div className="agent-office-central-grid">
                                <div>
                                    <span>Consome da Central</span>
                                    <p>{selectedAgent.centralContract.consumes.join(', ')}</p>
                                </div>
                                <div>
                                    <span>Alimenta a Central</span>
                                    <p>{selectedAgent.centralContract.produces.join(', ')}</p>
                                </div>
                                <div>
                                    <span>Entrega para</span>
                                    <p>{selectedAgent.centralContract.defaultHandoffTargets.join(', ')}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {isEventAgent && (
                        <div className="agent-office-event-card">
                            <div className="agent-office-prompt-head">
                                <div>
                                    <h3><MessageSquareText size={17} /> Relatorio de potencial do evento</h3>
                                    <p>Leitura dos inscritos, respostas do formulario, conversas ligadas ao telefone e sinais de tracking.</p>
                                </div>
                                <div className="agent-office-actions compact">
                                    <button
                                        type="button"
                                        className="agent-office-legacy-link"
                                        onClick={() => {
                                            void loadEventAgentReport(selectedEventId)
                                            void loadEventAutomationWorkspace(selectedEventId)
                                        }}
                                        disabled={eventReportLoading}
                                    >
                                        <RefreshCw size={14} className={eventReportLoading ? 'spin' : ''} />
                                        Atualizar
                                    </button>
                                    <button
                                        type="button"
                                        className="agent-office-save"
                                        onClick={generateEventAgentAiReport}
                                        disabled={eventAiLoading || eventReportLoading}
                                    >
                                        {eventAiLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                                        Gerar leitura IA
                                    </button>
                                </div>
                            </div>

                            {eventReportLoading ? (
                                <div className="agent-office-loading-inline">
                                    <Loader2 size={16} className="spin" />
                                    Carregando inteligencia do evento...
                                </div>
                            ) : eventReportError ? (
                                <div className="agent-office-event-empty danger">{eventReportError}</div>
                            ) : eventReport ? (
                                <div className="agent-office-event-body">
                                    <div className="agent-office-event-summary">
                                        <div>
                                            <span>Evento monitorado</span>
                                            <strong>{eventReport.event.title}</strong>
                                            <small>{formatDateTimeLabel(eventReport.event.event_date)} - {eventReport.event.location_name || 'Local pendente'}</small>
                                        </div>
                                        <Link href={`/admin/eventos/${eventReport.event.id}`} className="agent-office-legacy-link">
                                            Abrir evento
                                        </Link>
                                    </div>

                                    <div className="agent-office-event-metrics">
                                        <div><span>Inscritos</span><strong>{eventReport.totals.registrations}</strong></div>
                                        <div><span>Quentes</span><strong>{eventReport.totals.hot}</strong></div>
                                        <div><span>Mornos</span><strong>{eventReport.totals.warm}</strong></div>
                                        <div><span>Conversas</span><strong>{eventReport.totals.conversation_matches}</strong></div>
                                        <div><span>Pendentes</span><strong>{eventReport.totals.pending_messages}</strong></div>
                                    </div>

                                    <div className="agent-office-event-grid">
                                        <section className="agent-office-event-leads">
                                            <div className="agent-office-event-section-head">
                                                <strong>Leads priorizados</strong>
                                                <span>Score quente a partir de {eventReport.thresholds.hot_score}</span>
                                            </div>
                                            {eventReport.top_leads.length === 0 ? (
                                                <div className="agent-office-event-empty">Nenhum inscrito ainda para classificar.</div>
                                            ) : eventReport.top_leads.slice(0, 6).map(lead => (
                                                <article key={lead.id} className={`agent-office-event-lead ${lead.level}`}>
                                                    <div>
                                                        <strong>{lead.name}</strong>
                                                        <span>{lead.city || 'Cidade pendente'} - {formatPhoneLabel(lead.phone)}</span>
                                                    </div>
                                                    <b>{lead.score}</b>
                                                    <small>{eventLeadLevelLabel(lead.level)}</small>
                                                    <p>{lead.reasons.slice(0, 3).join(' | ') || lead.challenge}</p>
                                                </article>
                                            ))}
                                        </section>

                                        <section className="agent-office-event-recommendations">
                                            <div className="agent-office-event-section-head">
                                                <strong>Proximas acoes</strong>
                                                <span>Botoes, enquetes e prioridade</span>
                                            </div>
                                            {eventReport.recommendations.map((recommendation, index) => (
                                                <div key={`${recommendation}-${index}`}>
                                                    <ShieldCheck size={15} />
                                                    <span>{recommendation}</span>
                                                </div>
                                            ))}
                                        </section>
                                    </div>

                                    {eventReport.ai_summary && (
                                        <section className="agent-office-event-ai">
                                            <strong>Leitura IA do agente</strong>
                                            <p>{eventReport.ai_summary}</p>
                                        </section>
                                    )}
                                </div>
                            ) : (
                                <div className="agent-office-event-empty">O agente ainda nao encontrou um evento para monitorar.</div>
                            )}

                            <div className="agent-office-event-automation">
                                <div className="agent-office-event-section-head">
                                    <div>
                                        <strong>Automacoes, botoes e enquetes</strong>
                                        <span>Agora este fluxo nasce no Escritorio dos Agentes</span>
                                    </div>
                                    <select
                                        value={selectedEventId}
                                        onChange={event => {
                                            const eventId = event.target.value
                                            setSelectedEventId(eventId)
                                            setEditingEventRuleId(null)
                                            setEventAutomationDraft(EMPTY_EVENT_AUTOMATION_DRAFT)
                                            void loadEventAgentReport(eventId)
                                            void loadEventAutomationWorkspace(eventId)
                                        }}
                                    >
                                        <option value="">Selecione um evento</option>
                                        {eventList.map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.title} - {formatDateTimeLabel(item.event_date)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="agent-office-event-automation-grid">
                                    <section className="agent-office-event-rule-builder">
                                        <div className="agent-office-control-grid">
                                            <label className="agent-office-control agent-office-control-wide agent-office-event-message-control">
                                                <span>Nome da automacao</span>
                                                <input
                                                    value={eventAutomationDraft.name}
                                                    onChange={event => updateEventAutomationDraft('name', event.target.value)}
                                                    placeholder="Ex: Lembrete com confirmacao"
                                                />
                                            </label>
                                            <label className="agent-office-control">
                                                <span>Gatilho</span>
                                                <select value={eventAutomationDraft.trigger_type} onChange={event => updateEventAutomationDraft('trigger_type', event.target.value)}>
                                                    <option value="immediate">Apos cadastro</option>
                                                    <option value="before_event">Antes do evento</option>
                                                    <option value="at_event_time">Na hora do evento</option>
                                                    <option value="after_event">Depois do evento</option>
                                                    <option value="fixed_datetime">Data fixa</option>
                                                </select>
                                            </label>
                                            <label className="agent-office-control">
                                                <span>Minutos</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={eventAutomationDraft.offset_minutes}
                                                    onChange={event => updateEventAutomationDraft('offset_minutes', event.target.value)}
                                                />
                                            </label>
                                            <label className="agent-office-control">
                                                <span>Segmento</span>
                                                <select value={eventAutomationDraft.segment} onChange={event => updateEventAutomationDraft('segment', event.target.value)}>
                                                    <option value="all">Todos</option>
                                                    <option value="autonomos">Autonomos</option>
                                                    <option value="imobiliarias">Imobiliarias</option>
                                                    <option value="creci_pending">CRECI pendente</option>
                                                    <option value="creci_verified">CRECI verificado</option>
                                                </select>
                                            </label>
                                            <label className="agent-office-control">
                                                <span>Data fixa</span>
                                                <input
                                                    type="datetime-local"
                                                    value={eventAutomationDraft.fixed_datetime}
                                                    onChange={event => updateEventAutomationDraft('fixed_datetime', event.target.value)}
                                                />
                                            </label>
                                            <label className="agent-office-control agent-office-control-wide">
                                                <span>Mensagem</span>
                                                <textarea
                                                    value={eventAutomationDraft.message_template}
                                                    onChange={event => updateEventAutomationDraft('message_template', event.target.value)}
                                                    placeholder="Use tags como {nome}, {evento}, {data_evento}, {local_evento}"
                                                />
                                            </label>
                                            <label className="agent-office-control">
                                                <span>Interacao WhatsApp</span>
                                                <select value={eventAutomationDraft.interaction_type} onChange={event => updateEventAutomationDraft('interaction_type', event.target.value)}>
                                                    <option value="none">Somente texto</option>
                                                    <option value="buttons">Botoes</option>
                                                    <option value="link_buttons">Botoes com links</option>
                                                    <option value="list">Lista</option>
                                                    <option value="poll">Enquete</option>
                                                    <option value="location_request">Solicitar localizacao</option>
                                                </select>
                                            </label>
                                            <label className="agent-office-control">
                                                <span>Tag de rastreio</span>
                                                <input
                                                    value={eventAutomationDraft.tracking_tag}
                                                    onChange={event => updateEventAutomationDraft('tracking_tag', event.target.value)}
                                                    placeholder="confirmacao_evento"
                                                />
                                            </label>
                                        </div>

                                        {eventAutomationDraft.interaction_type !== 'poll' && eventAutomationDraft.interaction_type !== 'none' && eventAutomationDraft.interaction_type !== 'location_request' && (
                                            <div className="agent-office-event-button-editor">
                                                {[1, 2, 3].map(index => {
                                                    const labelKey = `button_${index}_label` as keyof EventAutomationDraft
                                                    const actionKey = `button_${index}_action` as keyof EventAutomationDraft
                                                    const urlKey = `button_${index}_url` as keyof EventAutomationDraft
                                                    return (
                                                        <div key={index}>
                                                            <input
                                                                value={eventAutomationDraft[labelKey]}
                                                                onChange={event => updateEventAutomationDraft(labelKey, event.target.value)}
                                                                placeholder={eventAutomationDraft.interaction_type === 'list' ? `Item ${index}` : `Texto botao ${index}`}
                                                            />
                                                            <input
                                                                value={eventAutomationDraft[actionKey]}
                                                                onChange={event => updateEventAutomationDraft(actionKey, event.target.value)}
                                                                placeholder="acao_rastreavel"
                                                            />
                                                            <input
                                                                value={eventAutomationDraft[urlKey]}
                                                                onChange={event => updateEventAutomationDraft(urlKey, event.target.value)}
                                                                placeholder="Link opcional"
                                                            />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {eventAutomationDraft.interaction_type === 'poll' && (
                                            <div className="agent-office-control-grid">
                                                <label className="agent-office-control agent-office-control-wide">
                                                    <span>Pergunta da enquete</span>
                                                    <input
                                                        value={eventAutomationDraft.poll_question}
                                                        onChange={event => updateEventAutomationDraft('poll_question', event.target.value)}
                                                        placeholder="Voce vai participar do encontro?"
                                                    />
                                                </label>
                                                <label className="agent-office-control agent-office-control-wide">
                                                    <span>Opcoes, uma por linha</span>
                                                    <textarea
                                                        value={eventAutomationDraft.poll_options}
                                                        onChange={event => updateEventAutomationDraft('poll_options', event.target.value)}
                                                    />
                                                </label>
                                            </div>
                                        )}

                                        <div className="agent-office-actions compact">
                                            <button
                                                type="button"
                                                className="agent-office-save"
                                                onClick={createEventAutomationRule}
                                                disabled={eventAutomationSaving || !selectedEventId}
                                            >
                                                {eventAutomationSaving ? <Loader2 size={15} className="spin" /> : editingEventRuleId ? <Save size={15} /> : <Plus size={15} />}
                                                {editingEventRuleId ? 'Salvar automacao' : 'Criar automacao'}
                                            </button>
                                            {editingEventRuleId && (
                                                <button
                                                    type="button"
                                                    className="agent-office-legacy-link"
                                                    onClick={cancelEventAutomationEdit}
                                                    disabled={eventAutomationSaving}
                                                >
                                                    Cancelar edicao
                                                </button>
                                            )}
                                        </div>
                                    </section>

                                    <section className="agent-office-event-rule-list">
                                        {eventAutomationLoading ? (
                                            <div className="agent-office-event-empty">
                                                <Loader2 size={16} className="spin" />
                                                Carregando automacoes...
                                            </div>
                                        ) : eventRules.length === 0 ? (
                                            <div className="agent-office-event-empty">Nenhuma automacao criada para este evento.</div>
                                        ) : eventRules.map(rule => {
                                            const interactionType = String(rule.metadata?.interaction_type || 'none')
                                            return (
                                                <article key={rule.id} className="agent-office-event-rule">
                                                    <div>
                                                        <strong>{rule.name}</strong>
                                                        <span>{triggerTypeLabel(rule.trigger_type)} - {rule.offset_minutes || 0} min - {segmentLabel(rule.segment)}</span>
                                                        <p>{String(rule.message_template || '').slice(0, 180)}</p>
                                                        <small>{interactionType === 'none' ? 'Somente texto' : interactionType === 'poll' ? 'Enquete WhatsApp' : interactionType === 'list' ? 'Lista WhatsApp' : interactionType === 'location_request' ? 'Solicita localizacao' : 'Botoes WhatsApp'} - {rule.is_active ? 'Ativa' : 'Pausada'}</small>
                                                    </div>
                                                    <div>
                                                        <button
                                                            type="button"
                                                            className="agent-office-legacy-link"
                                                            onClick={() => editEventAutomationRule(rule)}
                                                            disabled={eventAutomationSaving}
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="agent-office-legacy-link"
                                                            onClick={() => duplicateEventAutomationRule(rule)}
                                                            disabled={eventAutomationSaving}
                                                        >
                                                            Duplicar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="agent-office-legacy-link"
                                                            onClick={() => patchEventAutomationRule(rule.id, { is_active: !rule.is_active })}
                                                            disabled={eventAutomationSaving}
                                                        >
                                                            {rule.is_active ? 'Pausar' : 'Ativar'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="agent-office-legacy-link"
                                                            onClick={() => deleteEventAutomationRule(rule.id)}
                                                            disabled={eventAutomationSaving}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </article>
                                            )
                                        })}
                                    </section>
                                </div>
                            </div>
                        </div>
                    )}

                    {isBrokerAgent && (
                        <div className="agent-office-broker-card">
                            <div className="agent-office-prompt-head">
                                <div>
                                    <h3><ShieldCheck size={17} /> Configuracoes do corretor IA</h3>
                                    <p>Cadastro comercial, plantao humano e regras de atendimento agora ficam dentro do escritorio do agente.</p>
                                </div>
                                <div className="agent-office-prompt-meta">
                                    <span>{selectedInstanceId ? 'WhatsApp vinculado' : 'Sem instancia'}</span>
                                    <span>{brokerDraft?.is_active ? 'Ativo' : 'Inativo'}</span>
                                </div>
                            </div>

                            {brokerLoading ? (
                                <div className="agent-office-loading-inline">
                                    <Loader2 size={16} className="spin" />
                                    Carregando configuracoes do corretor...
                                </div>
                            ) : brokerDraft ? (
                                <div className="agent-office-broker-body">
                                    <div className={`agent-office-broker-strip ${selectedWhatsAppInstance ? 'connected' : ''}`}>
                                        <Phone size={15} />
                                        <strong>
                                            {selectedWhatsAppInstance
                                                ? `WhatsApp ${formatPhoneLabel(getInstancePhone(selectedWhatsAppInstance)) || selectedWhatsAppInstance.instance_name}`
                                                : 'WhatsApp ainda nao vinculado'}
                                        </strong>
                                        <span>
                                            {selectedWhatsAppInstance
                                                ? `${selectedWhatsAppInstance.instance_name} - ${selectedWhatsAppInstance.status || 'sem status'}`
                                                : 'Escolha uma instancia conectada para este corretor.'}
                                        </span>
                                    </div>

                                    <section className="agent-office-control-group">
                                        <strong>Base comercial</strong>
                                        <div className="agent-office-control-grid">
                                            <label className="agent-office-control">
                                                <span>Nome do corretor</span>
                                                <input
                                                    value={brokerDraft.name}
                                                    onChange={event => setBrokerDraft(current => current ? { ...current, name: event.target.value } : current)}
                                                    placeholder="Nome que aparece no agente"
                                                />
                                            </label>
                                            <label className="agent-office-control">
                                                <span>CRECI</span>
                                                <input
                                                    value={brokerDraft.creci}
                                                    onChange={event => setBrokerDraft(current => current ? { ...current, creci: event.target.value } : current)}
                                                    placeholder="SC 6772-J"
                                                />
                                            </label>
                                            <label className="agent-office-control">
                                                <span>Status</span>
                                                <button
                                                    type="button"
                                                    className={`agent-office-toggle ${brokerDraft.is_active ? 'active' : ''}`}
                                                    onClick={() => setBrokerDraft(current => current ? { ...current, is_active: !current.is_active } : current)}
                                                >
                                                    <span>{brokerDraft.is_active ? 'Ativo no rodizio' : 'Inativo'}</span>
                                                    <strong>{brokerDraft.is_active ? 'Ligado' : 'Desligado'}</strong>
                                                </button>
                                            </label>
                                            <label className="agent-office-control">
                                                <span>Instancia WhatsApp</span>
                                                <select
                                                    value={selectedInstanceId}
                                                    onChange={event => setSelectedInstanceId(event.target.value)}
                                                >
                                                    <option value="">Sem instancia vinculada</option>
                                                    {availableInstances.map(instance => {
                                                        const occupiedByOther = Boolean(instance.broker_id) && String(instance.broker_id) !== String(selectedAgent.brokerId)
                                                        const phoneLabel = formatPhoneLabel(getInstancePhone(instance))
                                                        const brokerLabel = instance.virtual_brokers?.name ? ` em uso por ${instance.virtual_brokers.name}` : ''
                                                        return (
                                                            <option key={instance.id} value={instance.id} disabled={occupiedByOther}>
                                                                {instance.instance_name} - {instance.status || 'sem status'}{phoneLabel ? ` - ${phoneLabel}` : ''}{occupiedByOther ? brokerLabel : ''}
                                                            </option>
                                                        )
                                                    })}
                                                </select>
                                                <small>O QR Code continua em WhatsApp Web. Aqui voce escolhe a instancia do agente.</small>
                                            </label>
                                            <label className="agent-office-control agent-office-control-wide agent-office-voice-control">
                                                <span>Voz do agente</span>
                                                <select
                                                    value={brokerDraft.voice_id}
                                                    disabled={isTextOnlyMode}
                                                    onChange={event => setBrokerDraft(current => current ? { ...current, voice_id: event.target.value } : current)}
                                                >
                                                    <option value="">Usar voz padrao da Sala de Manutencao</option>
                                                    {elevenLabsVoices.some(voice => voice.category === 'cloned') && (
                                                        <optgroup label="ElevenLabs clonadas">
                                                            {elevenLabsVoices.filter(voice => voice.category === 'cloned').map(voice => (
                                                                <option key={voice.voice_id} value={voice.voice_id}>{voice.name}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {elevenLabsVoices.some(voice => voice.category !== 'cloned') && (
                                                        <optgroup label="ElevenLabs prontas">
                                                            {elevenLabsVoices.filter(voice => voice.category !== 'cloned').map(voice => (
                                                                <option key={voice.voice_id} value={voice.voice_id}>{voice.name} ({voice.category})</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    <optgroup label="OpenAI TTS">
                                                        <option value="openai:alloy">Alloy - neutra</option>
                                                        <option value="openai:echo">Echo - masculina</option>
                                                        <option value="openai:fable">Fable - narrativa</option>
                                                        <option value="openai:onyx">Onyx - masculina grave</option>
                                                        <option value="openai:nova">Nova - feminina</option>
                                                        <option value="openai:shimmer">Shimmer - feminina suave</option>
                                                    </optgroup>
                                                    {brokerDraft.voice_id &&
                                                        !brokerDraft.voice_id.startsWith('openai:') &&
                                                        !elevenLabsVoices.find(voice => voice.voice_id === brokerDraft.voice_id) && (
                                                            <option value={brokerDraft.voice_id}>ID salvo: {brokerDraft.voice_id.slice(0, 24)}...</option>
                                                        )}
                                                </select>
                                                <small>
                                                    {isTextOnlyMode
                                                        ? 'A instancia esta em modo Sempre Texto. Troque o modo da instancia para usar audio.'
                                                        : loadingVoices
                                                            ? 'Carregando vozes do ElevenLabs...'
                                                            : 'Deixe vazio para usar a voz padrao global.'}
                                                </small>
                                                <div className="agent-office-voice-preview">
                                                    <input
                                                        value={previewText}
                                                        onChange={event => setPreviewText(event.target.value)}
                                                        placeholder="Texto para testar a voz"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleVoicePreview}
                                                        disabled={previewLoading || isTextOnlyMode}
                                                    >
                                                        {previewLoading ? <Loader2 size={14} className="spin" /> : <Volume2 size={14} />}
                                                        Ouvir previa
                                                    </button>
                                                    {previewAudioUrl && <audio controls src={previewAudioUrl} />}
                                                </div>
                                                {previewError && <small className="agent-office-error-text">{previewError}</small>}
                                            </label>
                                        </div>
                                    </section>

                                    <section className="agent-office-control-group">
                                        <strong>Transferencia humana</strong>
                                        <div className="agent-office-control-grid">
                                            <label className="agent-office-control">
                                                <span>WhatsApp do plantao humano</span>
                                                <input
                                                    value={brokerDraft.transfer_to_phone}
                                                    onChange={event => setBrokerDraft(current => current ? {
                                                        ...current,
                                                        transfer_to_phone: event.target.value.replace(/\D/g, ''),
                                                    } : current)}
                                                    placeholder="5547999999999"
                                                />
                                                <small>Este numero recebe resumos quando o agente usa transferencia humana.</small>
                                            </label>
                                        </div>
                                        <label className="agent-office-control agent-office-control-wide">
                                            <span>Prompt pos-transferencia</span>
                                            <textarea
                                                value={brokerDraft.handoff_prompt}
                                                onChange={event => setBrokerDraft(current => current ? { ...current, handoff_prompt: event.target.value } : current)}
                                                placeholder={'Oi {nome_lead}, tudo bem?\nSou {nome_corretor}. O time me passou seu atendimento sobre {empreendimento}.'}
                                            />
                                            <small>Variaveis: {'{nome_lead}'} {'{nome_corretor}'} {'{telefone}'} {'{interesse}'} {'{orcamento}'} {'{regiao}'} {'{empreendimento}'}</small>
                                        </label>
                                    </section>

                                    <section className="agent-office-control-group agent-office-assistant-section">
                                        <strong>Concierge do dono</strong>
                                        <div className="agent-office-concierge-grid">
                                            <label className="agent-office-control">
                                                <span>Status do concierge</span>
                                                <button
                                                    type="button"
                                                    className={`agent-office-toggle ${brokerDraft.concierge_enabled ? 'active' : ''}`}
                                                    onClick={() => setBrokerDraft(current => current ? {
                                                        ...current,
                                                        concierge_enabled: !current.concierge_enabled,
                                                    } : current)}
                                                >
                                                    <span>{brokerDraft.concierge_enabled ? 'Atende o dono' : 'Desligado'}</span>
                                                    <strong>{brokerDraft.concierge_enabled ? 'Ativo' : 'Off'}</strong>
                                                </button>
                                                <small>Quando a Fase 3 entrar, somente telefones autorizados usam este modo.</small>
                                            </label>
                                            <label className="agent-office-control">
                                                <span>Confirmacao</span>
                                                <button
                                                    type="button"
                                                    className={`agent-office-toggle ${brokerDraft.concierge_require_confirmation ? 'active' : ''}`}
                                                    onClick={() => setBrokerDraft(current => current ? {
                                                        ...current,
                                                        concierge_require_confirmation: !current.concierge_require_confirmation,
                                                    } : current)}
                                                >
                                                    <span>{brokerDraft.concierge_require_confirmation ? 'Antes de executar' : 'Autonomia maior'}</span>
                                                    <strong>{brokerDraft.concierge_require_confirmation ? 'Exige' : 'Livre'}</strong>
                                                </button>
                                                <small>Use confirmacao para agenda, CRM, mensagens e financeiro.</small>
                                            </label>
                                        </div>
                                        <div className="agent-office-assistant-compact">
                                            <input
                                                value={assistantPhoneDraft}
                                                onChange={event => setAssistantPhoneDraft(event.target.value.replace(/\D/g, ''))}
                                                placeholder="Digite o WhatsApp autorizado"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const phone = normalizePhone(assistantPhoneDraft)
                                                    if (!phone) return
                                                    setBrokerDraft(current => current ? {
                                                        ...current,
                                                        assistant_phones: [
                                                            ...current.assistant_phones,
                                                            { ...makeAssistantPhone(), phone },
                                                        ],
                                                    } : current)
                                                    setAssistantPhoneDraft('')
                                                }}
                                            >
                                                <Plus size={14} />
                                                Adicionar
                                            </button>
                                        </div>

                                        <div className="agent-office-assistant-chips">
                                            {brokerDraft.assistant_phones.length === 0 ? (
                                                <small>Nenhum telefone autorizado ainda.</small>
                                            ) : brokerDraft.assistant_phones.map((phone, index) => (
                                                <span key={`${phone.id || phone.phone || 'novo'}-${index}`}>
                                                    {formatPhoneLabel(phone.phone) || phone.phone}
                                                    <button
                                                        type="button"
                                                        onClick={() => setBrokerDraft(current => current ? {
                                                            ...current,
                                                            assistant_phones: current.assistant_phones.filter((_, itemIndex) => itemIndex !== index),
                                                        } : current)}
                                                        title="Remover telefone"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>

                                        <div className="agent-office-assistant-list">
                                            {brokerDraft.assistant_phones.length === 0 ? (
                                                <div className="agent-office-assistant-empty">Adicione um WhatsApp acima para definir nome, papel e permissoes.</div>
                                            ) : brokerDraft.assistant_phones.map((phone, index) => (
                                                <div className="agent-office-assistant-card" key={`detalhe-${phone.id || phone.phone || 'novo'}-${index}`}>
                                                    <div className="agent-office-assistant-fields">
                                                        <label className="agent-office-control">
                                                            <span>Nome</span>
                                                            <input
                                                                value={phone.name || ''}
                                                                onChange={event => updateAssistantPhone(index, { name: event.target.value })}
                                                                placeholder="Ex: Guilherme"
                                                            />
                                                        </label>
                                                        <label className="agent-office-control">
                                                            <span>WhatsApp autorizado</span>
                                                            <input
                                                                value={phone.phone || ''}
                                                                onChange={event => updateAssistantPhone(index, { phone: event.target.value.replace(/\D/g, '') })}
                                                                placeholder="5547999999999"
                                                            />
                                                        </label>
                                                        <label className="agent-office-control">
                                                            <span>Papel</span>
                                                            <select
                                                                value={phone.role || 'broker'}
                                                                onChange={event => updateAssistantPhone(index, { role: event.target.value })}
                                                            >
                                                                <option value="owner">Dono</option>
                                                                <option value="broker">Corretor</option>
                                                                <option value="admin">Admin</option>
                                                                <option value="finance">Financeiro</option>
                                                            </select>
                                                        </label>
                                                        <label className="agent-office-control">
                                                            <span>Status</span>
                                                            <button
                                                                type="button"
                                                                className={`agent-office-toggle ${phone.is_active !== false ? 'active' : ''}`}
                                                                onClick={() => updateAssistantPhone(index, { is_active: phone.is_active === false })}
                                                            >
                                                                <span>{phone.is_active !== false ? 'Autorizado' : 'Bloqueado'}</span>
                                                                <strong>{phone.is_active !== false ? 'On' : 'Off'}</strong>
                                                            </button>
                                                        </label>
                                                    </div>
                                                    <div className="agent-office-permission-grid">
                                                        {CONCIERGE_PERMISSION_OPTIONS.map(option => {
                                                            const enabled = assistantPermissionEnabled(phone, option.key)
                                                            return (
                                                                <button
                                                                    key={option.key}
                                                                    type="button"
                                                                    className={enabled ? 'active' : ''}
                                                                    onClick={() => updateAssistantPhone(index, { [option.key]: !enabled })}
                                                                    title={option.hint}
                                                                >
                                                                    <span>{option.label}</span>
                                                                    <small>{enabled ? 'Liberado' : 'Bloqueado'}</small>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="agent-office-concierge-queue">
                                            <div className="agent-office-concierge-queue-head">
                                                <div>
                                                    <span>Fila do concierge</span>
                                                    <small>Comprovantes, lancamentos, agenda e acoes internas recebidas pelo WhatsApp.</small>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => void loadConciergeActions(selectedAgent?.brokerId || '')}
                                                    disabled={conciergeActionsLoading}
                                                >
                                                    {conciergeActionsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                    Atualizar
                                                </button>
                                            </div>

                                            <div className="agent-office-concierge-summary">
                                                {['pending', 'executed', 'failed', 'cancelled'].map(status => (
                                                    <span key={status} className={`agent-office-concierge-status ${conciergeStatusTone(status)}`}>
                                                        {conciergeStatusLabel(status)}
                                                        <strong>{conciergeActionSummary[status] || 0}</strong>
                                                    </span>
                                                ))}
                                            </div>

                                            {conciergeActionsError && (
                                                <div className="agent-office-concierge-empty danger">{conciergeActionsError}</div>
                                            )}

                                            {conciergeActionsLoading ? (
                                                <div className="agent-office-concierge-empty">
                                                    <Loader2 size={15} className="animate-spin" />
                                                    Carregando fila do concierge...
                                                </div>
                                            ) : conciergeActions.length === 0 ? (
                                                <div className="agent-office-concierge-empty">Nenhuma acao do concierge registrada ainda.</div>
                                            ) : (
                                                <div className="agent-office-concierge-list">
                                                    {conciergeActions.map(action => (
                                                        <div className="agent-office-concierge-item" key={action.id}>
                                                            <div className="agent-office-concierge-item-main">
                                                                <div>
                                                                    <strong>{conciergeActionPrimary(action)}</strong>
                                                                    <span>{conciergeActionDescription(action)}</span>
                                                                </div>
                                                                <span className={`agent-office-concierge-status ${conciergeStatusTone(action.status)}`}>
                                                                    {conciergeActionLabel(action.action_type)} - {conciergeStatusLabel(action.status)}
                                                                </span>
                                                            </div>

                                                            <div className="agent-office-concierge-item-meta">
                                                                {conciergeActionMetaItems(action).map((item, itemIndex) => (
                                                                    <span key={`${action.id}-meta-${itemIndex}`}>{item}</span>
                                                                ))}
                                                            </div>

                                                            {(action.receipt_summary || action.receipt_document_number || typeof action.receipt_confidence === 'number') && (
                                                                <small className="agent-office-concierge-note">
                                                                    {action.receipt_summary ? `Leitura IA: ${action.receipt_summary}` : 'Leitura IA registrada'}
                                                                    {action.receipt_document_number ? ` | Doc: ${action.receipt_document_number}` : ''}
                                                                    {typeof action.receipt_confidence === 'number' ? ` | Confianca: ${Math.round(action.receipt_confidence * 100)}%` : ''}
                                                                </small>
                                                            )}

                                                            <div className="agent-office-concierge-links">
                                                                {action.finance_entry_id && (
                                                                    <Link href={`/admin/finance/lancamentos?entry_id=${encodeURIComponent(String(action.finance_entry_id))}`}>
                                                                        Ver lancamento
                                                                    </Link>
                                                                )}
                                                                {action.appointment_id && (
                                                                    <Link href="/admin/whatsapp/agenda">
                                                                        Ver agenda
                                                                    </Link>
                                                                )}
                                                                {action.attachment_url && (
                                                                    <a href={action.attachment_url} target="_blank" rel="noreferrer">
                                                                        Abrir comprovante
                                                                    </a>
                                                                )}
                                                                {action.status === 'pending' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void cancelConciergeAction(action.id)}
                                                                        disabled={conciergeActionUpdating === action.id}
                                                                    >
                                                                        {conciergeActionUpdating === action.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                                                        Cancelar
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    <section className="agent-office-control-group">
                                        <strong>Tipo de atendimento</strong>
                                        <div className="agent-office-choice-grid">
                                            <button
                                                type="button"
                                                className={brokerDraft.assignment_type !== 'landing_pages' ? 'active' : ''}
                                                onClick={() => setBrokerDraft(current => current ? {
                                                    ...current,
                                                    assignment_type: 'all',
                                                    assigned_page_slugs: [],
                                                } : current)}
                                            >
                                                <Globe2 size={15} />
                                                <span>Rodizio geral</span>
                                                <small>Home, imoveis e landing pages.</small>
                                            </button>
                                            <button
                                                type="button"
                                                className={brokerDraft.assignment_type === 'landing_pages' ? 'active' : ''}
                                                onClick={() => setBrokerDraft(current => current ? { ...current, assignment_type: 'landing_pages' } : current)}
                                            >
                                                <MessageSquareText size={15} />
                                                <span>Landing pages especificas</span>
                                                <small>Atende apenas paginas selecionadas.</small>
                                            </button>
                                        </div>

                                        {brokerDraft.assignment_type === 'landing_pages' && (
                                            <div className="agent-office-check-list">
                                                {landingPages.length === 0 && (
                                                    <div className="agent-office-topic-empty">Nenhuma landing page cadastrada.</div>
                                                )}
                                                {landingPages.map(page => {
                                                    const checked = brokerDraft.assigned_page_slugs.includes(page.slug)
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={page.id}
                                                            className={checked ? 'active' : ''}
                                                            onClick={() => setBrokerDraft(current => {
                                                                if (!current) return current
                                                                const exists = current.assigned_page_slugs.includes(page.slug)
                                                                return {
                                                                    ...current,
                                                                    assigned_page_slugs: exists
                                                                        ? current.assigned_page_slugs.filter(slug => slug !== page.slug)
                                                                        : [...current.assigned_page_slugs, page.slug],
                                                                }
                                                            })}
                                                        >
                                                            <span>{page.title || page.slug}</span>
                                                            <small>/{page.slug}</small>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </section>

                                    <section className="agent-office-control-group">
                                        <strong>Empreendimentos atendidos</strong>
                                        <div className="agent-office-check-list">
                                            {empreendimentos.length === 0 && (
                                                <div className="agent-office-topic-empty">Nenhum empreendimento cadastrado.</div>
                                            )}
                                            {empreendimentos.map(item => {
                                                const checked = brokerDraft.empreendimento_ids.includes(item.id)
                                                return (
                                                    <button
                                                        type="button"
                                                        key={item.id}
                                                        className={checked ? 'active' : ''}
                                                        onClick={() => setBrokerDraft(current => {
                                                            if (!current) return current
                                                            const exists = current.empreendimento_ids.includes(item.id)
                                                            return {
                                                                ...current,
                                                                empreendimento_ids: exists
                                                                    ? current.empreendimento_ids.filter(id => id !== item.id)
                                                                    : [...current.empreendimento_ids, item.id],
                                                            }
                                                        })}
                                                    >
                                                        <span>{item.nome}</span>
                                                        <small>{item.ativo === false ? 'Inativo' : 'Ativo'}</small>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </section>
                                </div>
                            ) : (
                                <div className="agent-office-loading-inline">
                                    <Phone size={16} />
                                    Selecione um corretor IA com cadastro vinculado para editar.
                                </div>
                            )}

                        </div>
                    )}

                    {!!selectedAgent.behaviorControls?.length && (
                        <div className="agent-office-behavior-card">
                            <div className="agent-office-prompt-head">
                                <div>
                                    <h3><SlidersHorizontal size={17} /> Comportamento operacional</h3>
                                    <p>Limites, gatilhos e rotinas deste agente ficam junto do prompt.</p>
                                </div>
                            </div>

                            {!!selectedAgent.runtimeFacts?.length && (
                                <div className="agent-office-runtime-grid">
                                    {selectedAgent.runtimeFacts.map(fact => (
                                        <div key={fact.label} className={fact.tone ? toneClass(fact.tone) : ''}>
                                            <span>{fact.label}</span>
                                            <strong>{fact.value}</strong>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className={`agent-office-control-groups ${selectedAgent.id === 'blog-intelligence' ? 'agent-office-blog-control-groups' : ''} ${selectedAgent.id === 'email-orchestrator' ? 'agent-office-email-control-groups' : ''}`}>
                                {groupBehaviorControls(selectedAgent).map(group => (
                                    <section key={group.title} className="agent-office-control-group">
                                        <strong>{group.title}</strong>
                                        <div className="agent-office-control-grid">
                                            {group.controls?.map(control => (
                                                <label
                                                    key={control.key}
                                                    className={`agent-office-control ${control.type === 'textarea' ? 'agent-office-control-wide' : ''}`}
                                                >
                                                    <span className="agent-office-control-label">
                                                        <span>{control.label}</span>
                                                        {control.help && (
                                                            <span
                                                                className="agent-office-help"
                                                                tabIndex={0}
                                                                title={control.help}
                                                                data-help={control.help}
                                                            >
                                                                <Info size={12} />
                                                            </span>
                                                        )}
                                                    </span>
                                                    {control.type === 'select' ? (
                                                        <select
                                                            value={behaviorDraft[control.key] ?? control.fallback}
                                                            onChange={event => updateBehaviorControl(control.key, event.target.value)}
                                                        >
                                                            {(control.options || []).map(option => (
                                                                <option key={option.value} value={option.value}>{option.label}</option>
                                                            ))}
                                                        </select>
                                                    ) : control.type === 'multiselect' ? (
                                                        <div className="agent-office-multi-control">
                                                            {(control.options || []).map(option => {
                                                                const selectedValues = new Set(String(behaviorDraft[control.key] ?? control.fallback).split(',').filter(Boolean))
                                                                const active = selectedValues.has(option.value)
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={option.value}
                                                                        className={active ? 'active' : ''}
                                                                        onClick={() => setBehaviorDraft(current => ({
                                                                            ...current,
                                                                            [control.key]: toggleBehaviorListValue(current[control.key] ?? control.fallback, option.value),
                                                                        }))}
                                                                    >
                                                                        {option.label}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : control.type === 'textarea' ? (
                                                        <textarea
                                                            value={behaviorDraft[control.key] ?? control.fallback}
                                                            onChange={event => updateBehaviorControl(control.key, event.target.value)}
                                                            rows={4}
                                                        />
                                                    ) : (
                                                        <input
                                                            type={control.type}
                                                            min={control.min}
                                                            max={control.max}
                                                            step={control.step}
                                                            value={behaviorDraft[control.key] ?? control.fallback}
                                                            onChange={event => updateBehaviorControl(control.key, event.target.value)}
                                                        />
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    </section>
                                ))}
                                {selectedSchedulePrefix && (
                                    <section className="agent-office-control-group agent-office-blog-schedule-group">
                                        <strong>{selectedSchedulePrefix === 'news_agent' ? 'Agenda de noticias' : 'Agenda do blog'}</strong>
                                        <div className="agent-office-blog-schedule">
                                            <div className="agent-office-blog-days" aria-label="Dias da semana">
                                                {BLOG_WEEKDAY_OPTIONS.map(day => {
                                                    const active = agentScheduleSlots.some(slot => slot.day === day.value)
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={day.value}
                                                            className={active ? 'active' : ''}
                                                            onClick={() => toggleAgentScheduleDay(day.value)}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            <div className="agent-office-blog-times">
                                                {agentScheduleSlots.map(slot => (
                                                    <label key={slot.day} className="agent-office-control">
                                                        <span>{getBlogWeekdayLabel(slot.day)}</span>
                                                        <input
                                                            type="time"
                                                            value={slot.time}
                                                            onChange={event => updateAgentScheduleTime(slot.day, event.target.value)}
                                                        />
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </section>
                                )}
                            </div>

                            <div className="agent-office-actions">
                                <button
                                    type="button"
                                    className="agent-office-save"
                                    onClick={saveBehavior}
                                    disabled={behaviorSaveState.status === 'saving'}
                                >
                                    {behaviorSaveState.status === 'saving' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                                    Salvar comportamento
                                </button>
                                {selectedAgent.behaviorActions?.map(action => (
                                    <button
                                        key={action.id}
                                        type="button"
                                        className="agent-office-legacy-link"
                                        onClick={() => runBehaviorAction(action.id)}
                                        disabled={syncingAction === action.id}
                                        title={action.help}
                                    >
                                        <RefreshCw size={14} className={syncingAction === action.id ? 'spin' : ''} />
                                        {action.label}
                                    </button>
                                ))}
                                {behaviorSaveState.message && (
                                    <span className={`agent-office-save-message ${behaviorSaveState.status}`}>
                                        {behaviorSaveState.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedAgent.id === 'email-orchestrator' && (
                        <div className="agent-office-email-bank">
                            <div className="agent-office-email-ownership">
                                <div>
                                    <strong>Gabriel controla a distribuicao editorial</strong>
                                    <p>Blogs da Isadora e noticias da Clara entram aqui para virar campanhas de e-mail, WhatsApp e push, com aprovacao, limite diario e intervalo entre leads.</p>
                                </div>
                                <div>
                                    <span>E-mail</span>
                                    <strong>Brevo</strong>
                                </div>
                                <div>
                                    <span>WhatsApp</span>
                                    <strong>Global do atendimento</strong>
                                </div>
                                <div>
                                    <span>Push</span>
                                    <strong>Notificacao do navegador</strong>
                                </div>
                            </div>

                            <div className="agent-office-prompt-head">
                                <div>
                                    <h3><Mail size={17} /> Templates do agente de e-mail</h3>
                                    <p>Modelos de e-mail usados na distribuicao editorial e nas campanhas para leads.</p>
                                </div>
                                <div className="agent-office-prompt-meta">
                                    <span>{emailTemplates.filter(template => template.status === 'active').length} ativos</span>
                                    <span>{emailTemplates.length} templates</span>
                                </div>
                            </div>

                            <div className="agent-office-email-layout">
                                <section className="agent-office-email-builder">
                                    <strong>{editingEmailTemplateId ? 'Editar template' : 'Novo template'}</strong>
                                    <div className="agent-office-control-grid">
                                        <label className="agent-office-control">
                                            <span>Nome</span>
                                            <input
                                                value={emailTemplateDraft.name}
                                                onChange={event => updateEmailTemplateDraft('name', event.target.value)}
                                                placeholder="Blog publicado"
                                            />
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Gatilho</span>
                                            <select
                                                value={emailTemplateDraft.trigger}
                                                onChange={event => updateEmailTemplateDraft('trigger', event.target.value)}
                                            >
                                                {EMAIL_TEMPLATE_TRIGGER_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Publico</span>
                                            <select
                                                value={emailTemplateDraft.audience}
                                                onChange={event => updateEmailTemplateDraft('audience', event.target.value)}
                                            >
                                                {EMAIL_TEMPLATE_AUDIENCE_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Status</span>
                                            <select
                                                value={emailTemplateDraft.status}
                                                onChange={event => updateEmailTemplateDraft('status', event.target.value)}
                                            >
                                                {EMAIL_TEMPLATE_STATUS_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="agent-office-control agent-office-control-wide">
                                            <span>Assunto</span>
                                            <input
                                                value={emailTemplateDraft.subject}
                                                onChange={event => updateEmailTemplateDraft('subject', event.target.value)}
                                                placeholder="Novo artigo: {titulo_blog}"
                                            />
                                        </label>
                                        <label className="agent-office-control agent-office-control-wide">
                                            <span>Preheader</span>
                                            <input
                                                value={emailTemplateDraft.preheader}
                                                onChange={event => updateEmailTemplateDraft('preheader', event.target.value)}
                                                placeholder="Texto curto que aparece antes de abrir o e-mail"
                                            />
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Texto do CTA</span>
                                            <input
                                                value={emailTemplateDraft.ctaLabel}
                                                onChange={event => updateEmailTemplateDraft('ctaLabel', event.target.value)}
                                                placeholder="Ler artigo"
                                            />
                                        </label>
                                        <div className={`agent-office-email-workbench agent-office-control-wide ${emailEditorExpanded ? 'expanded' : ''}`}>
                                            <section className="agent-office-control agent-office-email-html-control">
                                                <div className="agent-office-email-editor-head">
                                                    <span>HTML do template</span>
                                                    <div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEmailEditorExpanded(current => !current)}
                                                        >
                                                            {emailEditorExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                                            {emailEditorExpanded ? 'Compactar' : 'Ampliar'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    value={emailTemplateDraft.html}
                                                    onChange={event => updateEmailTemplateDraft('html', event.target.value)}
                                                    spellCheck={false}
                                                    rows={16}
                                                />
                                                <small>Edite ou cole o HTML completo. A previa ao lado renderiza o e-mail como ele deve chegar ao lead.</small>
                                            </section>
                                            <section className="agent-office-email-preview">
                                                <div className="agent-office-email-preview-head">
                                                    <div>
                                                        <span>Previa ao vivo - nao editavel</span>
                                                        <strong>{emailSubjectPreview || 'Assunto do e-mail'}</strong>
                                                        {emailPreheaderPreview && <small>{emailPreheaderPreview}</small>}
                                                    </div>
                                                    <div className="agent-office-email-preview-actions">
                                                        <button type="button" onClick={() => setEmailEditorExpanded(current => !current)}>
                                                            {emailEditorExpanded ? 'Ver lado a lado' : 'Ampliar HTML'}
                                                        </button>
                                                        <em>{emailTemplateDraft.ctaLabel || 'CTA'}</em>
                                                    </div>
                                                </div>
                                                <iframe
                                                    title="Previa ao vivo do e-mail"
                                                    sandbox=""
                                                    srcDoc={emailHtmlPreview}
                                                />
                                            </section>
                                        </div>
                                        <label className="agent-office-control agent-office-control-wide">
                                            <span>Texto simples</span>
                                            <textarea
                                                value={emailTemplateDraft.text}
                                                onChange={event => updateEmailTemplateDraft('text', event.target.value)}
                                                spellCheck={false}
                                                rows={6}
                                            />
                                        </label>
                                    </div>

                                    <div className="agent-office-email-tags">
                                        <strong>Tags rapidas</strong>
                                        <div>
                                            {EMAIL_TEMPLATE_TAGS.map(tag => (
                                                <button key={tag} type="button" onClick={() => insertEmailTemplateTag(tag)}>
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="agent-office-actions compact">
                                        <button type="button" className="agent-office-save" onClick={upsertEmailTemplate}>
                                            <Plus size={15} /> {editingEmailTemplateId ? 'Atualizar na biblioteca' : 'Adicionar na biblioteca'}
                                        </button>
                                        <button type="button" className="agent-office-legacy-link" onClick={resetEmailTemplateDraft}>
                                            Limpar
                                        </button>
                                    </div>
                                </section>

                                <section className="agent-office-email-list">
                                    <strong>Biblioteca</strong>
                                    {emailTemplates.length === 0 ? (
                                        <div className="agent-office-topic-empty">Nenhum template de e-mail cadastrado para o Gabriel.</div>
                                    ) : emailTemplates.map(template => (
                                        <article key={template.id} className={`agent-office-email-template status-${template.status}`}>
                                            <div>
                                                <span>{template.status === 'active' ? 'Ativo' : template.status === 'paused' ? 'Pausado' : 'Rascunho'}</span>
                                                <h4>{template.name}</h4>
                                                <p>{template.subject}</p>
                                                <small>{template.trigger} - {template.audience}</small>
                                            </div>
                                            <div>
                                                <button type="button" className="agent-office-legacy-link" onClick={() => editEmailTemplate(template)}>
                                                    Editar
                                                </button>
                                                <button type="button" className="agent-office-topic-remove" onClick={() => removeEmailTemplate(template.id)} title="Remover template">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </article>
                                    ))}
                                </section>
                            </div>

                            <div className="agent-office-actions">
                                <button
                                    type="button"
                                    className="agent-office-save"
                                    onClick={saveEmailTemplates}
                                    disabled={emailTemplateSaveState.status === 'saving'}
                                >
                                    {emailTemplateSaveState.status === 'saving' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                                    Salvar biblioteca
                                </button>
                                {emailTemplateSaveState.message && (
                                    <span className={`agent-office-save-message ${emailTemplateSaveState.status}`}>
                                        {emailTemplateSaveState.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedAgent.id === 'email-orchestrator' && (
                        <div className="agent-office-email-bank">
                            <div className="agent-office-prompt-head">
                                <div>
                                    <h3><MessageSquareText size={17} /> Templates de WhatsApp</h3>
                                    <p>Mensagens curtas que o Gabriel usa na distribuicao editorial. O envio sempre sai pelo WhatsApp global do atendimento.</p>
                                </div>
                                <div className="agent-office-prompt-meta">
                                    <span>{whatsappTemplates.filter(template => template.status === 'active').length} ativos</span>
                                    <span>{whatsappTemplates.length} templates</span>
                                </div>
                            </div>

                            <div className="agent-office-email-layout agent-office-whatsapp-layout">
                                <section className="agent-office-email-builder">
                                    <strong>{editingWhatsAppTemplateId ? 'Editar template' : 'Novo template'}</strong>
                                    <div className="agent-office-control-grid">
                                        <label className="agent-office-control">
                                            <span>Nome</span>
                                            <input
                                                value={whatsappTemplateDraft.name}
                                                onChange={event => updateWhatsAppTemplateDraft('name', event.target.value)}
                                                placeholder="Blog publicado"
                                            />
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Gatilho</span>
                                            <select
                                                value={whatsappTemplateDraft.trigger}
                                                onChange={event => updateWhatsAppTemplateDraft('trigger', event.target.value)}
                                            >
                                                {EMAIL_TEMPLATE_TRIGGER_OPTIONS.filter(option => option.value !== 'event_reminder' && option.value !== 'lead_nurture').map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Publico</span>
                                            <select
                                                value={whatsappTemplateDraft.audience}
                                                onChange={event => updateWhatsAppTemplateDraft('audience', event.target.value)}
                                            >
                                                {EMAIL_TEMPLATE_AUDIENCE_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Status</span>
                                            <select
                                                value={whatsappTemplateDraft.status}
                                                onChange={event => updateWhatsAppTemplateDraft('status', event.target.value)}
                                            >
                                                {EMAIL_TEMPLATE_STATUS_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Texto do botao</span>
                                            <input
                                                value={whatsappTemplateDraft.ctaLabel}
                                                onChange={event => updateWhatsAppTemplateDraft('ctaLabel', event.target.value)}
                                                placeholder="Ler artigo"
                                            />
                                        </label>
                                        <label className="agent-office-control agent-office-control-wide">
                                            <span>Mensagem WhatsApp</span>
                                            <textarea
                                                value={whatsappTemplateDraft.message}
                                                onChange={event => updateWhatsAppTemplateDraft('message', event.target.value)}
                                                spellCheck={false}
                                                rows={10}
                                            />
                                            <small>Use texto curto, personalizado e com PARAR no final. O link do conteudo entra no botao rastreado.</small>
                                        </label>
                                    </div>

                                    <div className="agent-office-email-tags">
                                        <strong>Tags rapidas</strong>
                                        <div>
                                            {WHATSAPP_TEMPLATE_TAGS.map(tag => (
                                                <button key={tag} type="button" onClick={() => insertWhatsAppTemplateTag(tag)}>
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="agent-office-actions compact">
                                        <button type="button" className="agent-office-save" onClick={upsertWhatsAppTemplate}>
                                            <Plus size={15} /> {editingWhatsAppTemplateId ? 'Atualizar na biblioteca' : 'Adicionar na biblioteca'}
                                        </button>
                                        <button type="button" className="agent-office-legacy-link" onClick={resetWhatsAppTemplateDraft}>
                                            Limpar
                                        </button>
                                    </div>
                                </section>

                                <section className="agent-office-whatsapp-preview">
                                    <strong>Previa da mensagem</strong>
                                    <div className="agent-office-whatsapp-phone">
                                        <div>
                                            <span>WhatsApp global</span>
                                            <small>Mensagem enviada pelo atendimento oficial</small>
                                        </div>
                                        <pre>{whatsappMessagePreview || 'Mensagem do WhatsApp'}</pre>
                                        <button type="button">{whatsappTemplateDraft.ctaLabel || 'Abrir'}</button>
                                    </div>
                                </section>

                                <section className="agent-office-email-list">
                                    <strong>Biblioteca WhatsApp</strong>
                                    {whatsappTemplates.length === 0 ? (
                                        <div className="agent-office-topic-empty">Nenhum template de WhatsApp cadastrado.</div>
                                    ) : whatsappTemplates.map(template => (
                                        <article key={template.id} className={`agent-office-email-template status-${template.status}`}>
                                            <div>
                                                <span>{template.status === 'active' ? 'Ativo' : template.status === 'paused' ? 'Pausado' : 'Rascunho'}</span>
                                                <h4>{template.name}</h4>
                                                <p>{template.ctaLabel}</p>
                                                <small>{template.trigger} - {template.audience}</small>
                                            </div>
                                            <div>
                                                <button type="button" className="agent-office-legacy-link" onClick={() => editWhatsAppTemplate(template)}>
                                                    Editar
                                                </button>
                                                <button type="button" className="agent-office-topic-remove" onClick={() => removeWhatsAppTemplate(template.id)} title="Remover template">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </article>
                                    ))}
                                </section>
                            </div>

                            <div className="agent-office-actions">
                                <button
                                    type="button"
                                    className="agent-office-save"
                                    onClick={saveWhatsAppTemplates}
                                    disabled={whatsappTemplateSaveState.status === 'saving'}
                                >
                                    {whatsappTemplateSaveState.status === 'saving' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                                    Salvar templates de WhatsApp
                                </button>
                                {whatsappTemplateSaveState.message && (
                                    <span className={`agent-office-save-message ${whatsappTemplateSaveState.status}`}>
                                        {whatsappTemplateSaveState.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedAgent.id === 'email-orchestrator' && (
                        <div className="agent-office-email-bank">
                            <div className="agent-office-prompt-head">
                                <div>
                                    <h3><Bell size={17} /> Templates de Push</h3>
                                    <p>Alertas curtos que o Gabriel envia para leads que aceitaram notificacoes no navegador.</p>
                                </div>
                                <div className="agent-office-prompt-meta">
                                    <span>{pushTemplates.filter(template => template.status === 'active').length} ativos</span>
                                    <span>{pushTemplates.length} templates</span>
                                </div>
                            </div>

                            <div className="agent-office-email-layout agent-office-whatsapp-layout">
                                <section className="agent-office-email-builder">
                                    <strong>{editingPushTemplateId ? 'Editar template' : 'Novo template'}</strong>
                                    <div className="agent-office-control-grid">
                                        <label className="agent-office-control">
                                            <span>Nome</span>
                                            <input
                                                value={pushTemplateDraft.name}
                                                onChange={event => updatePushTemplateDraft('name', event.target.value)}
                                                placeholder="Blog publicado"
                                            />
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Gatilho</span>
                                            <select
                                                value={pushTemplateDraft.trigger}
                                                onChange={event => updatePushTemplateDraft('trigger', event.target.value)}
                                            >
                                                {EMAIL_TEMPLATE_TRIGGER_OPTIONS.filter(option => option.value !== 'event_reminder' && option.value !== 'lead_nurture').map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Publico</span>
                                            <select
                                                value={pushTemplateDraft.audience}
                                                onChange={event => updatePushTemplateDraft('audience', event.target.value)}
                                            >
                                                {EMAIL_TEMPLATE_AUDIENCE_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Status</span>
                                            <select
                                                value={pushTemplateDraft.status}
                                                onChange={event => updatePushTemplateDraft('status', event.target.value)}
                                            >
                                                {EMAIL_TEMPLATE_STATUS_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="agent-office-control">
                                            <span>Texto do botao</span>
                                            <input
                                                value={pushTemplateDraft.ctaLabel}
                                                onChange={event => updatePushTemplateDraft('ctaLabel', event.target.value)}
                                                placeholder="Ler artigo"
                                            />
                                        </label>
                                        <label className="agent-office-control agent-office-control-wide">
                                            <span>Titulo do push</span>
                                            <input
                                                value={pushTemplateDraft.title}
                                                onChange={event => updatePushTemplateDraft('title', event.target.value)}
                                                placeholder="Novo artigo para voce"
                                            />
                                        </label>
                                        <label className="agent-office-control agent-office-control-wide">
                                            <span>Mensagem push</span>
                                            <textarea
                                                value={pushTemplateDraft.body}
                                                onChange={event => updatePushTemplateDraft('body', event.target.value)}
                                                spellCheck={false}
                                                rows={5}
                                            />
                                            <small>Push funciona melhor com ate 140 caracteres e CTA direto. O clique abre o link rastreado.</small>
                                        </label>
                                    </div>

                                    <div className="agent-office-email-tags">
                                        <strong>Tags rapidas</strong>
                                        <div>
                                            {PUSH_TEMPLATE_TAGS.map(tag => (
                                                <button key={tag} type="button" onClick={() => insertPushTemplateTag(tag)}>
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="agent-office-actions compact">
                                        <button type="button" className="agent-office-save" onClick={upsertPushTemplate}>
                                            <Plus size={15} /> {editingPushTemplateId ? 'Atualizar na biblioteca' : 'Adicionar na biblioteca'}
                                        </button>
                                        <button type="button" className="agent-office-legacy-link" onClick={resetPushTemplateDraft}>
                                            Limpar
                                        </button>
                                    </div>
                                </section>

                                <section className="agent-office-whatsapp-preview">
                                    <strong>Previa do push</strong>
                                    <div className="agent-office-whatsapp-phone">
                                        <div>
                                            <span>{pushTitlePreview || 'Titulo do push'}</span>
                                            <small>Notificacao do navegador</small>
                                        </div>
                                        <pre>{pushBodyPreview || 'Mensagem do push'}</pre>
                                        <button type="button">{pushTemplateDraft.ctaLabel || 'Abrir'}</button>
                                    </div>
                                </section>

                                <section className="agent-office-email-list">
                                    <strong>Biblioteca Push</strong>
                                    {pushTemplates.length === 0 ? (
                                        <div className="agent-office-topic-empty">Nenhum template de push cadastrado.</div>
                                    ) : pushTemplates.map(template => (
                                        <article key={template.id} className={`agent-office-email-template status-${template.status}`}>
                                            <div>
                                                <span>{template.status === 'active' ? 'Ativo' : template.status === 'paused' ? 'Pausado' : 'Rascunho'}</span>
                                                <h4>{template.name}</h4>
                                                <p>{template.title}</p>
                                                <small>{template.trigger} - {template.audience}</small>
                                            </div>
                                            <div>
                                                <button type="button" className="agent-office-legacy-link" onClick={() => editPushTemplate(template)}>
                                                    Editar
                                                </button>
                                                <button type="button" className="agent-office-topic-remove" onClick={() => removePushTemplate(template.id)} title="Remover template">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </article>
                                    ))}
                                </section>
                            </div>

                            <div className="agent-office-actions">
                                <button
                                    type="button"
                                    className="agent-office-save"
                                    onClick={savePushTemplates}
                                    disabled={pushTemplateSaveState.status === 'saving'}
                                >
                                    {pushTemplateSaveState.status === 'saving' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                                    Salvar templates de Push
                                </button>
                                {pushTemplateSaveState.message && (
                                    <span className={`agent-office-save-message ${pushTemplateSaveState.status}`}>
                                        {pushTemplateSaveState.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedAgent.id === 'email-orchestrator' && (
                        <div className="agent-office-editorial-distribution">
                            <div className="agent-office-prompt-head">
                                <div>
                                    <h3><MessageSquareText size={17} /> Distribuicao e recomendacoes</h3>
                                    <p>Fila usada por Gabriel para levar conteudos publicados e recomendacoes personalizadas aos leads por e-mail, WhatsApp global e push.</p>
                                </div>
                                <div className="agent-office-prompt-meta">
                                    <span>{editorialSummary.awaiting_approval || 0} aguardando</span>
                                    <span>{editorialSummary.queued_items || 0} na fila</span>
                                </div>
                            </div>

                            <div className="agent-office-editorial-actions">
                                <button
                                    type="button"
                                    className="agent-office-save"
                                    onClick={() => void runEditorialAction('prepare_latest')}
                                    disabled={Boolean(editorialActionId)}
                                >
                                    {editorialActionId === 'prepare_latest' ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
                                    Preparar ultimos publicados
                                </button>
                                <button
                                    type="button"
                                    className="agent-office-legacy-link"
                                    onClick={() => void runEditorialAction('prepare_archive')}
                                    disabled={Boolean(editorialActionId)}
                                >
                                    {editorialActionId === 'prepare_archive' ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
                                    Preparar acervo publicado
                                </button>
                                <button
                                    type="button"
                                    className="agent-office-legacy-link"
                                    onClick={() => void runEditorialAction('prepare_recommendations')}
                                    disabled={Boolean(editorialActionId)}
                                >
                                    {editorialActionId === 'prepare_recommendations' ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                                    Preparar recomendacoes
                                </button>
                                <button
                                    type="button"
                                    className="agent-office-legacy-link"
                                    onClick={() => void runEditorialAction('process_due')}
                                    disabled={Boolean(editorialActionId)}
                                >
                                    {editorialActionId === 'process_due' ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
                                    Processar agora
                                </button>
                                <button
                                    type="button"
                                    className="agent-office-legacy-link"
                                    onClick={() => void loadEditorialCampaigns()}
                                    disabled={editorialLoading}
                                >
                                    {editorialLoading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
                                    Atualizar
                                </button>
                                {editorialSaveState.message && (
                                    <span className={`agent-office-save-message ${editorialSaveState.status}`}>
                                        {editorialSaveState.message}
                                    </span>
                                )}
                            </div>

                            <div className="agent-office-editorial-list">
                                {editorialLoading ? (
                                    <div className="agent-office-topic-empty">
                                        <Loader2 size={16} className="spin" /> Carregando campanhas editoriais...
                                    </div>
                                ) : editorialCampaigns.length === 0 ? (
                                    <div className="agent-office-topic-empty">
                                        Nenhuma campanha preparada ainda. Publique um blog/noticia, use Preparar acervo publicado ou gere recomendacoes.
                                    </div>
                                ) : editorialCampaigns.slice(0, 8).map(campaign => (
                                    <article key={campaign.campaign_id} className={`agent-office-editorial-campaign status-${campaign.status}`}>
                                        <div>
                                            <span>{editorialContentTypeLabel(campaign.content_type)} - {editorialCampaignStatusLabel(campaign.status)}</span>
                                            <h4>{campaign.post_title}</h4>
                                            <p>
                                                {campaign.sent}/{campaign.total} enviados
                                                {' '}• e-mail {campaign.channel_counts.email || 0}
                                                {' '}• WhatsApp {campaign.channel_counts.whatsapp || 0}
                                                {' '}• Push {campaign.channel_counts.push || 0}
                                                {campaign.failed ? ` • ${campaign.failed} falha(s)` : ''}
                                            </p>
                                            <small>
                                                Criada em {formatDateTimeLabel(campaign.created_at)}
                                                {campaign.scheduled_for ? ` • proximo envio ${formatDateTimeLabel(campaign.scheduled_for)}` : ''}
                                            </small>
                                        </div>
                                        <div>
                                            {campaign.waiting > 0 && (
                                                <button
                                                    type="button"
                                                    className="agent-office-save"
                                                    onClick={() => void runEditorialAction('approve_campaign', campaign.campaign_id)}
                                                    disabled={Boolean(editorialActionId)}
                                                >
                                                    {editorialActionId === campaign.campaign_id ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}
                                                    Aprovar
                                                </button>
                                            )}
                                            {campaign.queued > 0 && (
                                                <button
                                                    type="button"
                                                    className="agent-office-legacy-link"
                                                    onClick={() => void runEditorialAction('pause_campaign', campaign.campaign_id)}
                                                    disabled={Boolean(editorialActionId)}
                                                >
                                                    Pausar
                                                </button>
                                            )}
                                            {(campaign.waiting > 0 || campaign.queued > 0 || campaign.failed > 0) && (
                                                <button
                                                    type="button"
                                                    className="agent-office-topic-remove"
                                                    onClick={() => void runEditorialAction('cancel_campaign', campaign.campaign_id)}
                                                    disabled={Boolean(editorialActionId)}
                                                    title="Cancelar campanha"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedAgent.id === 'research-pilger' && (
                        <div className="agent-office-topic-bank">
                            <div className="agent-office-prompt-head">
                                <div>
                                    <h3><Search size={17} /> Banco de temas de pesquisa</h3>
                                    <p>Termos estrategicos que o Mateus Pesquisa Externa prioriza antes de criar pautas sozinho pelo ecossistema.</p>
                                </div>
                                <div className="agent-office-prompt-meta">
                                    <span>{researchTopics.filter(topic => topic.status === 'ativo').length} ativos</span>
                                    <span>{researchTopics.length} temas</span>
                                </div>
                            </div>

                            <div className="agent-office-topic-create">
                                <input
                                    value={newResearchTopic.topic}
                                    onChange={event => setNewResearchTopic(current => ({ ...current, topic: event.target.value }))}
                                    placeholder="Tema ou termo de pesquisa"
                                />
                                <input
                                    value={newResearchTopic.region}
                                    onChange={event => setNewResearchTopic(current => ({ ...current, region: event.target.value }))}
                                    placeholder="Cidade, bairro ou regiao"
                                />
                                <select
                                    value={newResearchTopic.intent}
                                    onChange={event => setNewResearchTopic(current => ({ ...current, intent: event.target.value }))}
                                >
                                    <option value="blog">Blog</option>
                                    <option value="mercado">Mercado</option>
                                    <option value="trafego">Trafego</option>
                                    <option value="ceo">CEO</option>
                                    <option value="estoque">Estoque</option>
                                    <option value="noticias">Noticias</option>
                                    <option value="prefeitura">Prefeitura</option>
                                    <option value="economia">Economia</option>
                                    <option value="empreendimentos">Empreendimentos</option>
                                    <option value="geral">Geral</option>
                                </select>
                                <button type="button" className="agent-office-save" onClick={addResearchTopic}>
                                    <Plus size={15} /> Adicionar
                                </button>
                            </div>

                            <div className="agent-office-topic-list">
                                {researchTopics.map(topic => (
                                    <div key={topic.id} className="agent-office-topic-row">
                                        <input
                                            value={topic.topic}
                                            onChange={event => updateResearchTopic(topic.id, { topic: event.target.value })}
                                            placeholder="Tema"
                                        />
                                        <input
                                            value={topic.region}
                                            onChange={event => updateResearchTopic(topic.id, { region: event.target.value })}
                                            placeholder="Regiao"
                                        />
                                        <select value={topic.intent} onChange={event => updateResearchTopic(topic.id, { intent: event.target.value })}>
                                            <option value="blog">Blog</option>
                                            <option value="mercado">Mercado</option>
                                            <option value="trafego">Trafego</option>
                                            <option value="ceo">CEO</option>
                                            <option value="estoque">Estoque</option>
                                            <option value="noticias">Noticias</option>
                                            <option value="prefeitura">Prefeitura</option>
                                            <option value="economia">Economia</option>
                                            <option value="empreendimentos">Empreendimentos</option>
                                            <option value="geral">Geral</option>
                                        </select>
                                        <select value={topic.priority} onChange={event => updateResearchTopic(topic.id, { priority: event.target.value })}>
                                            <option value="alta">Alta</option>
                                            <option value="media">Media</option>
                                            <option value="baixa">Baixa</option>
                                        </select>
                                        <select value={topic.frequency} onChange={event => updateResearchTopic(topic.id, { frequency: event.target.value })}>
                                            <option value="uma_vez">Uma vez</option>
                                            <option value="semanal">Semanal</option>
                                            <option value="quinzenal">Quinzenal</option>
                                            <option value="mensal">Mensal</option>
                                        </select>
                                        <select value={topic.status} onChange={event => updateResearchTopic(topic.id, { status: event.target.value })}>
                                            <option value="ativo">Ativo</option>
                                            <option value="inativo">Inativo</option>
                                        </select>
                                        <button type="button" className="agent-office-topic-remove" onClick={() => removeResearchTopic(topic.id)} title="Remover tema">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))}
                                {researchTopics.length === 0 && (
                                    <div className="agent-office-topic-empty">Nenhum tema cadastrado. O Mateus Pesquisa Externa usara apenas sinais automaticos do ecossistema.</div>
                                )}
                            </div>

                            <div className="agent-office-actions">
                                <button
                                    type="button"
                                    className="agent-office-save"
                                    onClick={saveResearchTopics}
                                    disabled={topicSaveState.status === 'saving'}
                                >
                                    {topicSaveState.status === 'saving' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                                    Salvar banco de temas
                                </button>
                                {topicSaveState.message && (
                                    <span className={`agent-office-save-message ${topicSaveState.status}`}>
                                        {topicSaveState.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedAgent.id === 'internal-notifier' && (
                        <InternalNotifierPanel />
                    )}

                    <div className={`agent-office-prompt-card ${isBrokerAgent || isEventAgent || isCandidateAgent ? 'has-tags' : ''}`}>
                        <div className="agent-office-prompt-head">
                            <div>
                                <h3><Sparkles size={17} /> {isBrokerAgent ? 'Prompt do agente comercial' : 'Prompt do agente'}</h3>
                                <p>
                                    {selectedAgent.promptKey ? `Chave: ${selectedAgent.promptKey}` : 'Prompt individual do corretor IA'}
                                </p>
                            </div>
                            <div className="agent-office-prompt-meta">
                                <span>{promptWordCount(draft)} palavras</span>
                                <span>{draft.length.toLocaleString('pt-BR')} caracteres</span>
                            </div>
                        </div>

                        {(isBrokerAgent || isEventAgent || isCandidateAgent) && (
                            <div className="agent-office-tag-panel">
                                <strong>Tags disponiveis - clique para inserir no prompt</strong>
                                <div>
                                    {(isEventAgent
                                        ? EVENT_AGENT_PROMPT_TAGS
                                        : isCandidateAgent
                                            ? BROKER_CANDIDATE_PROMPT_TAGS
                                            : [...BROKER_PROMPT_TAGS, ...customLinkTags.map(button => ({
                                            tag: button.tag,
                                            desc: `Acao dinamica ${button.type || 'URL'}: ${button.name || button.tag}`,
                                            color: '#0ea5e9',
                                        }))]).map(item => (
                                        <button
                                            key={item.tag}
                                            type="button"
                                            title={item.desc}
                                            onClick={() => insertPromptTag(item.tag)}
                                            style={{
                                                borderColor: `${item.color}33`,
                                                background: `${item.color}15`,
                                                color: item.color,
                                            }}
                                        >
                                            {item.tag}
                                        </button>
                                    ))}
                                </div>
                                <small>
                                    {isEventAgent
                                        ? 'As tags sao contexto para mensagens e relatorios. Botoes, listas, enquetes e links sao criados no construtor de automacoes acima.'
                                        : isCandidateAgent
                                            ? 'Essas tags representam os dados do cadastro e tambem aparecem no construtor de mensagens do Trabalhe Conosco.'
                                            : <>As tags liberam ferramentas do agente. A tag {'{imoveis}'} consulta o catalogo ativo e permite recomendar opcoes com botao Ver imovel.</>}
                                </small>
                            </div>
                        )}

                        <div className="agent-office-prompt-editor">
                            <textarea
                                id="agent-office-prompt-textarea"
                                value={draft}
                                onChange={event => setDraft(event.target.value)}
                                spellCheck={false}
                                placeholder="Escreva o prompt deste funcionario digital..."
                            />
                        </div>

                        <div className="agent-office-actions">
                            {isBrokerAgent ? (
                                <button
                                    type="button"
                                    className="agent-office-save"
                                    onClick={saveBrokerSettings}
                                    disabled={!brokerDraft || brokerSaveState.status === 'saving'}
                                >
                                    {brokerSaveState.status === 'saving' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                                    Salvar tudo
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="agent-office-save"
                                    onClick={savePrompt}
                                    disabled={!canEdit(selectedAgent) || saveState.status === 'saving'}
                                >
                                    {saveState.status === 'saving' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                                    Salvar prompt
                                </button>
                            )}
                            {selectedAgent.editHref && selectedAgent.source !== 'virtual_brokers' && (
                                <Link href={selectedAgent.editHref} className="agent-office-legacy-link">
                                    Abrir origem tecnica
                                </Link>
                            )}
                            {isBrokerAgent && brokerSaveState.message && (
                                <span className={`agent-office-save-message ${brokerSaveState.status}`}>
                                    {brokerSaveState.message}
                                </span>
                            )}
                            {!isBrokerAgent && saveState.message && (
                                <span className={`agent-office-save-message ${saveState.status}`}>
                                    {saveState.message}
                                </span>
                            )}
                        </div>
                    </div>

                    {isBrokerAgent && brokerDraft && (
                        <div className="agent-office-prompt-card agent-office-concierge-prompt-card has-tags">
                            <div className="agent-office-prompt-head">
                                <div>
                                    <h3><UserRoundCog size={17} /> Prompt do concierge</h3>
                                    <p>Atendimento privado para o dono ou telefones autorizados deste agente.</p>
                                </div>
                                <div className="agent-office-prompt-meta">
                                    <span>{promptWordCount(brokerDraft.concierge_prompt)} palavras</span>
                                    <span>{brokerDraft.concierge_prompt.length.toLocaleString('pt-BR')} caracteres</span>
                                </div>
                            </div>

                            <div className="agent-office-tag-panel agent-office-concierge-tag-panel">
                                <strong>Tags disponiveis - clique para inserir no prompt</strong>
                                <div>
                                    {CONCIERGE_PROMPT_TAGS.map(item => (
                                        <button
                                            key={item.tag}
                                            type="button"
                                            title={item.desc}
                                            onClick={() => insertConciergePromptTag(item.tag)}
                                            style={{
                                                borderColor: `${item.color}33`,
                                                background: `${item.color}15`,
                                                color: item.color,
                                            }}
                                        >
                                            {item.tag}
                                        </button>
                                    ))}
                                </div>
                                <small>
                                    As tags liberam botoes do concierge no WhatsApp do dono autorizado.
                                </small>
                            </div>

                            <div className="agent-office-prompt-editor">
                                <textarea
                                    id="agent-office-concierge-prompt-textarea"
                                    value={brokerDraft.concierge_prompt}
                                    onChange={event => setBrokerDraft(current => current ? {
                                        ...current,
                                        concierge_prompt: event.target.value,
                                    } : current)}
                                    spellCheck={false}
                                    placeholder={'Voce e o concierge particular deste corretor. Atenda apenas os telefones autorizados, seja objetivo e execute somente as ferramentas liberadas nas permissoes.\n\nExemplo: para comprovantes, perguntar PF ou PJ antes de preparar o rascunho financeiro.'}
                                />
                            </div>

                            <div className="agent-office-actions">
                                <button
                                    type="button"
                                    className="agent-office-save"
                                    onClick={saveBrokerSettings}
                                    disabled={brokerSaveState.status === 'saving'}
                                >
                                    {brokerSaveState.status === 'saving' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                                    Salvar tudo
                                </button>
                                {brokerSaveState.message && (
                                    <span className={`agent-office-save-message ${brokerSaveState.status}`}>
                                        {brokerSaveState.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </section>

        </div>
    )
}
