import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    LEAD_EXTRACTION_PROMPT,
    PILGER_AI_PROMPT,
    PILGER_AI_RULES_PROMPT,
    ADS_ANALYSIS_SYSTEM_PROMPT,
    BLOG_INTELLIGENCE_SYSTEM_PROMPT,
    DAILY_REPORT_PROMPT,
    EMAIL_ORCHESTRATOR_SYSTEM_PROMPT,
    WEEKLY_REPORT_PROMPT,
    CEO_AGENT_SYSTEM_PROMPT,
    INTERNAL_NOTIFIER_SYSTEM_PROMPT,
    RADAR_ANALYST_SYSTEM_PROMPT,
    RESEARCH_PILGER_SYSTEM_PROMPT,
    BENCHMARK_EDITORIAL_SYSTEM_PROMPT,
    NEWS_INTELLIGENCE_SYSTEM_PROMPT,
} from '@/lib/ai/prompts'
import { DEFAULT_PROPERTY_REGISTER_AGENT_PROMPT } from '@/lib/properties/ai-registration'
import { DEFAULT_SECTOR_NOTIFICATION_RECIPIENTS } from '@/lib/notifications/sector-recipients'
import { DEFAULT_WHATSAPP_GLOBAL_SYSTEM_PROMPT } from '@/lib/whatsapp/agent-global-prompt'
import { getDefaultResearchPilgerTopicsJson } from '@/lib/research/topics'
import { DEFAULT_EVENT_AGENT_SYSTEM_PROMPT } from '@/lib/events/agent-prompt'
import { getDefaultEmailAgentTemplatesJson, normalizeEmailAgentTemplatesJson } from '@/lib/email/agent-templates'
import { getDefaultWhatsAppEditorialTemplatesJson, normalizeWhatsAppEditorialTemplatesJson } from '@/lib/whatsapp/editorial-templates'
import { getDefaultPushEditorialTemplatesJson, normalizePushEditorialTemplatesJson } from '@/lib/push/editorial-templates'
import { normalizeAgentNamesInConfig } from '@/lib/ai/config'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function loadAppConfigRows(supabase: ReturnType<typeof getSupabase>) {
    const rows: Array<{ key: string; value: string }> = []
    const pageSize = 1000

    for (let from = 0; from < 10000; from += pageSize) {
        const { data, error } = await supabase
            .from('app_config')
            .select('key, value')
            .not('key', 'like', '\\_%')
            .range(from, from + pageSize - 1)

        if (error) throw error

        rows.push(...(data || []))
        if (!data || data.length < pageSize) break
    }

    return rows
}

const ENV_FALLBACKS: Record<string, string> = {
    uazapi_base_url: 'UAZAPI_BASE_URL',
    uazapi_admin_token: 'UAZAPI_ADMIN_TOKEN',
    gemini_api_key: 'GEMINI_API_KEY',
    gemini_model: '',
    openai_model: '',
    vapid_subject: 'VAPID_SUBJECT',
    vapid_public_key: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    vapid_private_key: 'VAPID_PRIVATE_KEY',
    google_ads_manager_id: 'GOOGLE_ADS_MANAGER_ID',
    google_ads_customer_id: 'GOOGLE_ADS_CUSTOMER_ID',
    google_ads_conversion_id: 'GOOGLE_ADS_CONVERSION_ID',
    google_analytics_measurement_id: 'GOOGLE_ANALYTICS_MEASUREMENT_ID',
    google_analytics_property_id: 'GOOGLE_ANALYTICS_PROPERTY_ID',
    google_analytics_service_account_json: 'GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON',
    google_analytics_client_email: 'GOOGLE_ANALYTICS_CLIENT_EMAIL',
    google_analytics_private_key: 'GOOGLE_ANALYTICS_PRIVATE_KEY',
    google_analytics_oauth_client_id: 'GOOGLE_ANALYTICS_OAUTH_CLIENT_ID',
    google_analytics_oauth_client_secret: 'GOOGLE_ANALYTICS_OAUTH_CLIENT_SECRET',
    google_analytics_refresh_token: 'GOOGLE_ANALYTICS_REFRESH_TOKEN',
    google_search_console_site_url: 'GOOGLE_SEARCH_CONSOLE_SITE_URL',
    gemini_billing_bigquery_project_id: 'GEMINI_BILLING_BIGQUERY_PROJECT_ID',
    gemini_billing_bigquery_dataset: 'GEMINI_BILLING_BIGQUERY_DATASET',
    gemini_billing_bigquery_table: 'GEMINI_BILLING_BIGQUERY_TABLE',
    gemini_billing_google_project_id: 'GEMINI_BILLING_GOOGLE_PROJECT_ID',
    gemini_billing_service_account_json: 'GEMINI_BILLING_SERVICE_ACCOUNT_JSON',
    gemini_billing_client_email: 'GEMINI_BILLING_CLIENT_EMAIL',
    gemini_billing_private_key: 'GEMINI_BILLING_PRIVATE_KEY',
    serpapi_api_key: 'SERPAPI_API_KEY',
    dataforseo_login: 'DATAFORSEO_LOGIN',
    dataforseo_password: 'DATAFORSEO_PASSWORD',
    brevo_api_key: 'BREVO_API_KEY',
    brevo_sender_name: 'BREVO_SENDER_NAME',
    brevo_sender_email: 'BREVO_SENDER_EMAIL',
    brevo_reply_to_email: 'BREVO_REPLY_TO_EMAIL',
    brevo_test_recipient: 'BREVO_TEST_RECIPIENT',
    pexels_api_key: 'PEXELS_API_KEY',
    pixabay_api_key: 'PIXABAY_API_KEY',
    meta_app_id: 'META_APP_ID',
    meta_app_secret: 'META_APP_SECRET',
    facebook_login_configuration_id: 'FACEBOOK_LOGIN_CONFIGURATION_ID',
    instagram_app_id: 'INSTAGRAM_APP_ID',
    instagram_app_secret: 'INSTAGRAM_APP_SECRET',
    meta_access_token: 'META_ACCESS_TOKEN',
    meta_business_id: 'META_BUSINESS_ID',
    meta_ad_account_id: 'META_AD_ACCOUNT_ID',
    meta_pixel_id: 'META_PIXEL_ID',
    meta_facebook_page_id: 'META_FACEBOOK_PAGE_ID',
    meta_instagram_account_id: 'META_INSTAGRAM_ACCOUNT_ID',
    facebook_page_access_token: 'FACEBOOK_PAGE_ACCESS_TOKEN',
    instagram_business_account_id: 'INSTAGRAM_BUSINESS_ACCOUNT_ID',
    instagram_business_access_token: 'INSTAGRAM_BUSINESS_ACCESS_TOKEN',
    meta_webhook_verify_token: 'META_WEBHOOK_VERIFY_TOKEN',
}

const DEFAULT_PROMPTS: Record<string, string> = {
    pilger_ai_system_prompt: PILGER_AI_PROMPT,
    pilger_ai_rules_prompt: PILGER_AI_RULES_PROMPT,
    lead_extraction_prompt: LEAD_EXTRACTION_PROMPT,
    ads_analyst_system_prompt: ADS_ANALYSIS_SYSTEM_PROMPT,
    pilger_daily_system_prompt: DAILY_REPORT_PROMPT,
    pilger_weekly_system_prompt: WEEKLY_REPORT_PROMPT,
    ceo_agent_system_prompt: CEO_AGENT_SYSTEM_PROMPT,
    radar_analyst_system_prompt: RADAR_ANALYST_SYSTEM_PROMPT,
    blog_intelligence_system_prompt: BLOG_INTELLIGENCE_SYSTEM_PROMPT,
    news_intelligence_system_prompt: NEWS_INTELLIGENCE_SYSTEM_PROMPT,
    research_pilger_system_prompt: RESEARCH_PILGER_SYSTEM_PROMPT,
    benchmark_editorial_system_prompt: BENCHMARK_EDITORIAL_SYSTEM_PROMPT,
    internal_notifier_system_prompt: INTERNAL_NOTIFIER_SYSTEM_PROMPT,
    email_orchestrator_system_prompt: EMAIL_ORCHESTRATOR_SYSTEM_PROMPT,
    whatsapp_global_system_prompt: DEFAULT_WHATSAPP_GLOBAL_SYSTEM_PROMPT,
    event_agent_system_prompt: DEFAULT_EVENT_AGENT_SYSTEM_PROMPT,
}

const DEFAULT_CONFIGS: Record<string, string> = {
    ai_provider: 'gemini',
    gemini_model: 'gemini-2.5-flash',
    openai_model: 'gpt-4o-mini',
    whatsapp_legacy_property_catalog_enabled: 'false',
    ads_sync_interval_minutes: '60',
    pilger_daily_days: '0,1,2,3,4,5,6',
    pilger_daily_time: '23',
    pilger_weekly_days: '1',
    pilger_weekly_times: '23',
    radar_collection_days: '0,1,2,3,4,5,6',
    radar_collection_times: '06,12,18',
    radar_ai_enabled: 'true',
    radar_ai_min_opportunity_score: '70',
    radar_ai_max_insights_per_run: '6',
    radar_opportunity_alert_threshold: '75',
    blog_agent_enabled: 'true',
    blog_agent_schedule_day: '1',
    blog_agent_schedule_date: '',
    blog_agent_schedule_time: '09:00',
    blog_agent_schedule_day_1: '1',
    blog_agent_schedule_time_1: '09:00',
    blog_agent_schedule_day_2: '3',
    blog_agent_schedule_time_2: '09:00',
    blog_agent_schedule_day_3: '5',
    blog_agent_schedule_time_3: '09:00',
    blog_agent_schedule_day_4: 'off',
    blog_agent_schedule_time_4: '09:00',
    blog_agent_schedule_day_5: 'off',
    blog_agent_schedule_time_5: '09:00',
    blog_agent_schedule_day_6: 'off',
    blog_agent_schedule_time_6: '09:00',
    blog_agent_schedule_day_7: 'off',
    blog_agent_schedule_time_7: '09:00',
    blog_intelligence_auto_enabled: 'true',
    blog_intelligence_weekly_frequency: '3',
    blog_intelligence_weekdays: 'mon,wed,fri',
    news_agent_enabled: 'true',
    news_agent_schedule_day: '2',
    news_agent_schedule_date: '',
    news_agent_schedule_time: '10:00',
    news_agent_schedule_day_1: '2',
    news_agent_schedule_time_1: '10:00',
    news_agent_schedule_day_2: '4',
    news_agent_schedule_time_2: '10:00',
    news_agent_schedule_day_3: 'off',
    news_agent_schedule_time_3: '10:00',
    news_agent_schedule_day_4: 'off',
    news_agent_schedule_time_4: '10:00',
    news_agent_schedule_day_5: 'off',
    news_agent_schedule_time_5: '10:00',
    news_agent_schedule_day_6: 'off',
    news_agent_schedule_time_6: '10:00',
    news_agent_schedule_day_7: 'off',
    news_agent_schedule_time_7: '10:00',
    research_pilger_enabled: 'true',
    research_pilger_schedule_enabled: 'true',
    research_pilger_weekdays: 'mon,wed,fri',
    research_pilger_run_times: '09,15',
    research_pilger_daily_limit: '8',
    research_pilger_depth: 'media',
    research_pilger_topics: getDefaultResearchPilgerTopicsJson(),
    benchmark_editorial_enabled: 'true',
    benchmark_editorial_schedule_enabled: 'true',
    benchmark_editorial_weekdays: 'tue,thu',
    benchmark_editorial_run_times: '10,16',
    benchmark_editorial_daily_limit: '6',
    benchmark_editorial_depth: 'media',
    benchmark_editorial_min_score: '70',
    benchmark_editorial_competitors: '[]',
    benchmark_editorial_keywords: '[]',
    benchmark_editorial_opportunities: '[]',
    benchmark_editorial_runs: '[]',
    meta_webhook_verify_token: 'pilger-meta-webhook',
    meta_connection_logs: '[]',
    public_site_url: 'https://guilhermepilger.ai',
    meta_social_inbox_enabled: 'true',
    meta_social_agent_enabled: 'false',
    meta_social_agent_autopilot: 'false',
    brevo_sender_name: 'Guilherme Pilger',
    brevo_sender_email: 'contato@guilhermepilger.ai',
    brevo_reply_to_email: 'contato@guilhermepilger.ai',
    brevo_test_recipient: '',
    pexels_enabled: 'true',
    pexels_priority: '1',
    pexels_per_page: '12',
    pixabay_enabled: 'true',
    pixabay_priority: '2',
    pixabay_per_page: '12',
    editorial_image_default_orientation: 'horizontal',
    editorial_image_safe_search: 'true',
    editorial_image_lang: 'pt',
    email_agent_enabled: 'true',
    email_agent_autopilot: 'false',
    email_agent_require_approval: 'true',
    email_agent_send_interval_minutes: '5',
    email_agent_daily_limit: '150',
    email_agent_min_hours_between_lead_messages: '24',
    email_agent_allowed_start_time: '09:00',
    email_agent_allowed_end_time: '18:00',
    email_agent_default_audience: 'active_leads',
    email_agent_templates: getDefaultEmailAgentTemplatesJson(),
    editorial_distribution_email_enabled: 'true',
    editorial_distribution_whatsapp_enabled: 'true',
    editorial_distribution_push_enabled: 'false',
    editorial_distribution_recommendations_enabled: 'true',
    editorial_distribution_recommendation_min_score: '45',
    editorial_distribution_recommendation_batch_limit: '25',
    editorial_distribution_whatsapp_interval_minutes: '5',
    editorial_distribution_whatsapp_daily_limit: '120',
    editorial_distribution_whatsapp_templates: getDefaultWhatsAppEditorialTemplatesJson(),
    editorial_distribution_push_interval_minutes: '5',
    editorial_distribution_push_daily_limit: '300',
    editorial_distribution_push_templates: getDefaultPushEditorialTemplatesJson(),
    organic_report_agent_enabled: 'true',
    organic_report_agent_interval_hours: '24',
    paid_report_agent_enabled: 'true',
    paid_report_agent_interval_hours: '24',
    marketing_publisher_agent_enabled: 'true',
    marketing_publisher_autopilot: 'false',
    marketing_publisher_interval_minutes: '10',
    event_agent_enabled: 'true',
    event_agent_ai_report_enabled: 'true',
    event_agent_hot_score_threshold: '72',
    event_agent_report_limit: '12',
    event_agent_button_tracking_enabled: 'true',
    property_review_whatsapp_enabled: 'true',
    property_review_sector_name: 'Marketing',
    property_review_responsible_name: 'Responsavel Marketing',
    property_review_responsible_phone: '',
    property_review_whatsapp_instance_id: '',
    sector_notification_recipients: JSON.stringify(DEFAULT_SECTOR_NOTIFICATION_RECIPIENTS),
    property_review_message_template: [
        '*Novo imovel aguardando analise*',
        '',
        'Setor: {setor}',
        'Responsavel: {responsavel}',
        '',
        'Imovel: {titulo}',
        'Local: {cidade}',
        'Valor: {valor}',
        'Status: Em analise',
        '',
        'Entre na sala de manutencao/admin para revisar, ajustar e publicar.',
    ].join('\n'),
    property_register_triage_prompt: [
        'Voce e o Agente de Triagem do Cadastro de Imoveis.',
        '',
        'Sua funcao e revisar o briefing antes do Agente de Cadastro iniciar o trabalho.',
        '',
        'Libere o cadastro somente quando houver informacoes minimas para criar um anuncio premium sem inventar dados:',
        '- tipo do imovel',
        '- endereco completo ou o maximo disponivel: rua, numero/complemento se houver, bairro/regiao, cidade e estado',
        '- finalidade: venda, aluguel ou ambos',
        '- preco exato, faixa de preco ou sob consulta',
        '- metragem/area aproximada',
        '- dados internos do proprietario/consignante: nome e telefone/WhatsApp',
        '- pelo menos 3 fotos ou um briefing realmente detalhado',
        '',
        'Se faltar algo, notifique o admin com uma lista objetiva do que precisa ser informado antes de acionar o Agente de Cadastro.',
        '',
        'Exemplo bom de briefing:',
        'Apartamento para venda na Rua 3700, numero 500, apartamento 2801, Barra Sul, Balneario Camboriu, SC. 220m2 privativos, 4 suites, 3 vagas, vista mar, mobiliado, R$ 8.500.000. Proprietario: Joao da Silva, WhatsApp (47) 99999-9999, e-mail joao@email.com. Ideal para familia e investimento.',
    ].join('\n'),
    property_register_system_prompt: DEFAULT_PROPERTY_REGISTER_AGENT_PROMPT,
}

function normalizeConfigValue(key: string, value: string) {
    const boundedNumberConfigs: Record<string, { fallback: string; min: number; max: number }> = {
        ads_sync_interval_minutes: { fallback: DEFAULT_CONFIGS.ads_sync_interval_minutes, min: 1, max: 1440 },
        radar_ai_min_opportunity_score: { fallback: DEFAULT_CONFIGS.radar_ai_min_opportunity_score, min: 0, max: 100 },
        radar_ai_max_insights_per_run: { fallback: DEFAULT_CONFIGS.radar_ai_max_insights_per_run, min: 0, max: 50 },
        radar_opportunity_alert_threshold: { fallback: DEFAULT_CONFIGS.radar_opportunity_alert_threshold, min: 0, max: 100 },
        blog_intelligence_weekly_frequency: { fallback: DEFAULT_CONFIGS.blog_intelligence_weekly_frequency, min: 1, max: 3 },
        research_pilger_daily_limit: { fallback: DEFAULT_CONFIGS.research_pilger_daily_limit, min: 0, max: 50 },
        benchmark_editorial_daily_limit: { fallback: DEFAULT_CONFIGS.benchmark_editorial_daily_limit, min: 0, max: 50 },
        benchmark_editorial_min_score: { fallback: DEFAULT_CONFIGS.benchmark_editorial_min_score, min: 0, max: 100 },
        organic_report_agent_interval_hours: { fallback: DEFAULT_CONFIGS.organic_report_agent_interval_hours, min: 6, max: 168 },
        paid_report_agent_interval_hours: { fallback: DEFAULT_CONFIGS.paid_report_agent_interval_hours, min: 6, max: 168 },
        marketing_publisher_interval_minutes: { fallback: DEFAULT_CONFIGS.marketing_publisher_interval_minutes, min: 5, max: 1440 },
        event_agent_hot_score_threshold: { fallback: DEFAULT_CONFIGS.event_agent_hot_score_threshold, min: 40, max: 95 },
        event_agent_report_limit: { fallback: DEFAULT_CONFIGS.event_agent_report_limit, min: 3, max: 40 },
        email_agent_send_interval_minutes: { fallback: DEFAULT_CONFIGS.email_agent_send_interval_minutes, min: 1, max: 1440 },
        email_agent_daily_limit: { fallback: DEFAULT_CONFIGS.email_agent_daily_limit, min: 1, max: 5000 },
        email_agent_min_hours_between_lead_messages: { fallback: DEFAULT_CONFIGS.email_agent_min_hours_between_lead_messages, min: 1, max: 720 },
        editorial_distribution_whatsapp_interval_minutes: { fallback: DEFAULT_CONFIGS.editorial_distribution_whatsapp_interval_minutes, min: 1, max: 1440 },
        editorial_distribution_whatsapp_daily_limit: { fallback: DEFAULT_CONFIGS.editorial_distribution_whatsapp_daily_limit, min: 1, max: 5000 },
        editorial_distribution_push_interval_minutes: { fallback: DEFAULT_CONFIGS.editorial_distribution_push_interval_minutes, min: 1, max: 1440 },
        editorial_distribution_push_daily_limit: { fallback: DEFAULT_CONFIGS.editorial_distribution_push_daily_limit, min: 1, max: 10000 },
        editorial_distribution_recommendation_min_score: { fallback: DEFAULT_CONFIGS.editorial_distribution_recommendation_min_score, min: 1, max: 100 },
        editorial_distribution_recommendation_batch_limit: { fallback: DEFAULT_CONFIGS.editorial_distribution_recommendation_batch_limit, min: 1, max: 500 },
        pexels_priority: { fallback: DEFAULT_CONFIGS.pexels_priority, min: 1, max: 3 },
        pexels_per_page: { fallback: DEFAULT_CONFIGS.pexels_per_page, min: 3, max: 40 },
        pixabay_priority: { fallback: DEFAULT_CONFIGS.pixabay_priority, min: 1, max: 3 },
        pixabay_per_page: { fallback: DEFAULT_CONFIGS.pixabay_per_page, min: 3, max: 40 },
    }

    if (key === 'radar_ai_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'blog_agent_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'blog_intelligence_auto_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'news_agent_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'research_pilger_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'research_pilger_schedule_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'benchmark_editorial_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'benchmark_editorial_schedule_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'meta_social_inbox_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'meta_social_agent_enabled') return value === 'true' ? 'true' : 'false'
    if (key === 'meta_social_agent_autopilot') return value === 'true' ? 'true' : 'false'
    if (key === 'organic_report_agent_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'paid_report_agent_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'marketing_publisher_agent_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'marketing_publisher_autopilot') return value === 'true' ? 'true' : 'false'
    if (key === 'event_agent_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'event_agent_ai_report_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'event_agent_button_tracking_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'email_agent_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'email_agent_autopilot') return value === 'true' ? 'true' : 'false'
    if (key === 'email_agent_require_approval') return value === 'false' ? 'false' : 'true'
    if (key === 'editorial_distribution_email_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'editorial_distribution_whatsapp_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'editorial_distribution_push_enabled') return value === 'true' ? 'true' : 'false'
    if (key === 'editorial_distribution_recommendations_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'pexels_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'pixabay_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'editorial_image_safe_search') return value === 'false' ? 'false' : 'true'
    if (key === 'editorial_image_default_orientation') {
        return ['horizontal', 'vertical', 'all'].includes(value) ? value : DEFAULT_CONFIGS.editorial_image_default_orientation
    }
    if (key === 'editorial_image_lang') {
        const selected = String(value || '').trim().toLowerCase().slice(0, 5)
        return /^[a-z]{2}(-[a-z]{2})?$/.test(selected) ? selected : DEFAULT_CONFIGS.editorial_image_lang
    }
    if (key === 'email_agent_default_audience') {
        const allowed = new Set(['all_leads', 'active_leads', 'event_leads', 'property_leads', 'broker_candidates', 'custom'])
        return allowed.has(value) ? value : DEFAULT_CONFIGS.email_agent_default_audience
    }
    if (key === 'email_agent_templates') return normalizeEmailAgentTemplatesJson(value)
    if (key === 'editorial_distribution_whatsapp_templates') return normalizeWhatsAppEditorialTemplatesJson(value)
    if (key === 'editorial_distribution_push_templates') return normalizePushEditorialTemplatesJson(value)
    if (key === 'email_agent_allowed_start_time' || key === 'email_agent_allowed_end_time') {
        const selected = String(value || '').trim()
        const match = selected.match(/^(\d{1,2})(?::(\d{2}))?$/)
        const fallback = DEFAULT_CONFIGS[key]
        if (!match) return fallback
        const hour = Number.parseInt(match[1], 10)
        const minute = Number.parseInt(match[2] || '0', 10)
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
    if (key === 'research_pilger_depth') return ['leve', 'media', 'profunda'].includes(value) ? value : DEFAULT_CONFIGS.research_pilger_depth
    if (key === 'benchmark_editorial_depth') return ['leve', 'media', 'profunda'].includes(value) ? value : DEFAULT_CONFIGS.benchmark_editorial_depth
    if (key === 'blog_agent_schedule_day' || key === 'news_agent_schedule_day' || /^(blog|news)_agent_schedule_day_[1-7]$/.test(key)) {
        const selected = String(value || '').trim()
        if (/^(blog|news)_agent_schedule_day_[1-7]$/.test(key) && selected === 'off') return 'off'
        return ['0', '1', '2', '3', '4', '5', '6'].includes(selected)
            ? selected
            : (DEFAULT_CONFIGS[key] || (key.startsWith('news_agent') ? DEFAULT_CONFIGS.news_agent_schedule_day : DEFAULT_CONFIGS.blog_agent_schedule_day))
    }
    if (key === 'blog_agent_schedule_date' || key === 'news_agent_schedule_date') {
        const selected = String(value || '').trim().slice(0, 10)
        return /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : ''
    }
    if (key === 'blog_agent_schedule_time' || key === 'news_agent_schedule_time' || /^(blog|news)_agent_schedule_time_[1-7]$/.test(key)) {
        const selected = String(value || '').trim()
        const match = selected.match(/^(\d{1,2})(?::(\d{2}))?$/)
        const fallback = DEFAULT_CONFIGS[key] || (key.startsWith('news_agent') ? DEFAULT_CONFIGS.news_agent_schedule_time : DEFAULT_CONFIGS.blog_agent_schedule_time)
        if (!match) return fallback
        const hour = Number.parseInt(match[1], 10)
        const minute = Number.parseInt(match[2] || '0', 10)
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
    if (key === 'blog_intelligence_weekdays' || key === 'research_pilger_weekdays') {
        const allowed = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
        const selected = String(value || '')
            .split(',')
            .map(day => day.trim())
            .filter(day => allowed.has(day))
        return [...new Set(selected)].join(',') || DEFAULT_CONFIGS[key]
    }
    if (key === 'research_pilger_run_times') {
        const allowed = new Set(['07', '09', '11', '15', '18', '21'])
        const selected = String(value || '')
            .split(',')
            .map(hour => hour.trim().padStart(2, '0'))
            .filter(hour => allowed.has(hour))
        return [...new Set(selected)].join(',') || DEFAULT_CONFIGS.research_pilger_run_times
    }
    if (key === 'pilger_daily_days' || key === 'pilger_weekly_days' || key === 'radar_collection_days') {
        const allowed = new Set(['0', '1', '2', '3', '4', '5', '6'])
        const selected = String(value || '')
            .split(',')
            .map(day => day.trim())
            .filter(day => allowed.has(day))
        return [...new Set(selected)].join(',') || DEFAULT_CONFIGS[key]
    }
    if (key === 'pilger_daily_time' || key === 'pilger_weekly_times' || key === 'radar_collection_times') {
        const allowed = new Set(Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')))
        const selected = String(value || '')
            .split(',')
            .map(hour => hour.trim().padStart(2, '0'))
            .filter(hour => allowed.has(hour))
        return [...new Set(selected)].join(',') || DEFAULT_CONFIGS[key]
    }
    if (key === 'research_pilger_topics') {
        try {
            const allowedIntent = new Set(['blog', 'mercado', 'trafego', 'ceo', 'estoque', 'noticias', 'prefeitura', 'economia', 'empreendimentos', 'geral'])
            const allowedPriority = new Set(['alta', 'media', 'baixa'])
            const allowedFrequency = new Set(['uma_vez', 'semanal', 'quinzenal', 'mensal'])
            const allowedStatus = new Set(['ativo', 'inativo'])
            const parsed = JSON.parse(String(value || '[]'))
            if (!Array.isArray(parsed)) return DEFAULT_CONFIGS.research_pilger_topics
            const normalized = parsed
                .map((item: any, index: number) => ({
                    id: String(item?.id || `tema-${Date.now()}-${index}`).slice(0, 80),
                    topic: String(item?.topic || '').trim().slice(0, 180),
                    region: String(item?.region || '').trim().slice(0, 120),
                    intent: allowedIntent.has(String(item?.intent)) ? String(item.intent) : 'geral',
                    priority: allowedPriority.has(String(item?.priority)) ? String(item.priority) : 'media',
                    frequency: allowedFrequency.has(String(item?.frequency)) ? String(item.frequency) : 'semanal',
                    status: allowedStatus.has(String(item?.status)) ? String(item.status) : 'ativo',
                    lastRun: item?.lastRun ? String(item.lastRun).slice(0, 40) : '',
                    nextRun: item?.nextRun ? String(item.nextRun).slice(0, 40) : '',
                    lastError: item?.lastError ? String(item.lastError).slice(0, 220) : '',
                }))
                .filter(item => item.topic)
                .slice(0, 40)
            return JSON.stringify(normalized)
        } catch {
            return DEFAULT_CONFIGS.research_pilger_topics
        }
    }
    if (!boundedNumberConfigs[key]) return value

    const parsed = Number.parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return boundedNumberConfigs[key].fallback

    return String(Math.min(boundedNumberConfigs[key].max, Math.max(boundedNumberConfigs[key].min, parsed)))
}

export async function GET() {
    try {
        const supabase = getSupabase()
        const data = await loadAppConfigRows(supabase)

        const existingKeys = new Set((data || []).map((item: { key: string }) => item.key))
        const missingPromptEntries = Object.entries(DEFAULT_PROMPTS)
            .filter(([key]) => !existingKeys.has(key))
            .map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))
        const missingConfigEntries = Object.entries(DEFAULT_CONFIGS)
            .filter(([key]) => !existingKeys.has(key))
            .map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))

        if (missingPromptEntries.length > 0 || missingConfigEntries.length > 0) {
            await supabase
                .from('app_config')
                .upsert([...missingPromptEntries, ...missingConfigEntries], { onConflict: 'key' })
        }

        const finalData = await loadAppConfigRows(supabase)

        const configMap: Record<string, string> = {}
        for (const [configKey, envName] of Object.entries(ENV_FALLBACKS)) {
            const envVal = process.env[envName]
            if (envVal) configMap[configKey] = normalizeAgentNamesInConfig(configKey, envVal.trim())
        }

        finalData?.forEach((item: { key: string; value: string }) => {
            if (item.value) configMap[item.key] = normalizeAgentNamesInConfig(item.key, String(item.value).trim())
        })

        return NextResponse.json({ success: true, configs: configMap })
    } catch (error) {
        console.error('Config load error:', error)
        return NextResponse.json({ success: false, message: 'Erro ao carregar configurações' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { configs } = await request.json() as { configs: Record<string, string> }
        const supabase = getSupabase()

        const results: { key: string; success: boolean; error?: string }[] = []

        for (const [key, value] of Object.entries(configs)) {
            const normalizedValue = normalizeAgentNamesInConfig(key, normalizeConfigValue(key, value))
            const { error } = await supabase
                .from('app_config')
                .upsert(
                    { key, value: normalizedValue, updated_at: new Date().toISOString() },
                    { onConflict: 'key' }
                )

            results.push({
                key,
                success: !error,
                error: error?.message,
            })
        }

        const allSuccess = results.every(r => r.success)
        return NextResponse.json({
            success: allSuccess,
            message: allSuccess ? 'Configurações salvas!' : 'Alguns itens falharam',
            results,
        })
    } catch (error) {
        console.error('Config save error:', error)
        return NextResponse.json({ success: false, message: 'Erro ao salvar configurações' }, { status: 500 })
    }
}
