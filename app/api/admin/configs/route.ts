import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    LEAD_EXTRACTION_PROMPT,
    PILGER_AI_PROMPT,
    PILGER_AI_RULES_PROMPT,
    ADS_ANALYSIS_SYSTEM_PROMPT,
    VITOR_CREATIVE_REVIEW_SYSTEM_PROMPT,
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
    GAIA_ANALYTICS_WEB_SYSTEM_PROMPT,
    MAYA_META_CONNECTIONS_SYSTEM_PROMPT,
    OTTO_INTEGRATIONS_SYSTEM_PROMPT,
    IRIS_MEDIA_VOICE_SYSTEM_PROMPT,
    TEO_WEBHOOKS_EVENTS_SYSTEM_PROMPT,
} from '@/lib/ai/prompts'
import { DEFAULT_PROPERTY_REGISTER_AGENT_PROMPT } from '@/lib/properties/ai-registration'
import { DEFAULT_SECTOR_NOTIFICATION_RECIPIENTS } from '@/lib/notifications/sector-recipients'
import { DEFAULT_WHATSAPP_GLOBAL_SYSTEM_PROMPT } from '@/lib/whatsapp/agent-global-prompt'
import {
    DEFAULT_WHATSAPP_FOLLOWUP_SYSTEM_PROMPT,
    DEFAULT_WHATSAPP_RESCUE_SYSTEM_PROMPT,
} from '@/lib/whatsapp/commercial-automation-prompts'
import {
    DEFAULT_WHATSAPP_ATTENDANCE_COACH_PROMPT,
    WHATSAPP_ATTENDANCE_COACH_PROMPT_KEY,
} from '@/lib/whatsapp/attendance-coach-agent'
import { getDefaultResearchPilgerTopicsJson } from '@/lib/research/topics'
import { DEFAULT_EVENT_AGENT_SYSTEM_PROMPT } from '@/lib/events/agent-prompt'
import { getDefaultEmailAgentTemplatesJson, normalizeEmailAgentTemplatesJson } from '@/lib/email/agent-templates'
import { getDefaultWhatsAppEditorialTemplatesJson, normalizeWhatsAppEditorialTemplatesJson } from '@/lib/whatsapp/editorial-templates'
import { getDefaultPushEditorialTemplatesJson, normalizePushEditorialTemplatesJson } from '@/lib/push/editorial-templates'
import { normalizeAgentNamesInConfig } from '@/lib/ai/config'
import { DEFAULT_BENCHMARK_COMPETITORS, DEFAULT_BENCHMARK_KEYWORDS } from '@/lib/benchmark-editorial/defaults'
import { recordAgentCentralSignal } from '@/lib/intelligence/agent-runtime'

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
    connectyhub_api_url: 'CONNECTYHUB_API_URL',
    connectyhub_api_token: 'CONNECTYHUB_API_TOKEN',
    connectyhub_webhook_secret: 'CONNECTYHUB_WEBHOOK_SECRET',
    connectyhub_webhook_url: 'CONNECTYHUB_WEBHOOK_URL',
    mercado_pago_enabled: 'MERCADO_PAGO_ENABLED',
    mercado_pago_environment: 'MERCADO_PAGO_ENVIRONMENT',
    mercado_pago_public_key: 'NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY',
    mercado_pago_access_token: 'MERCADO_PAGO_ACCESS_TOKEN',
    mercado_pago_webhook_secret: 'MERCADO_PAGO_WEBHOOK_SECRET',
    mercado_pago_webhook_url: 'MERCADO_PAGO_WEBHOOK_URL',
    mercado_pago_pix_expiration_minutes: 'MERCADO_PAGO_PIX_EXPIRATION_MINUTES',
    mercado_pago_statement_descriptor: 'MERCADO_PAGO_STATEMENT_DESCRIPTOR',
    commerce_member_area_url: 'COMMERCE_MEMBER_AREA_URL',
    commerce_support_whatsapp: 'COMMERCE_SUPPORT_WHATSAPP',
    commerce_automation_enabled: 'COMMERCE_AUTOMATION_ENABLED',
    commerce_checkout_abandoned_after_minutes: 'COMMERCE_CHECKOUT_ABANDONED_AFTER_MINUTES',
    commerce_pix_pending_after_minutes: 'COMMERCE_PIX_PENDING_AFTER_MINUTES',
    commerce_pix_expiring_before_minutes: 'COMMERCE_PIX_EXPIRING_BEFORE_MINUTES',
    commerce_checkout_lost_after_hours: 'COMMERCE_CHECKOUT_LOST_AFTER_HOURS',
    commerce_whatsapp_notifications_enabled: 'COMMERCE_WHATSAPP_NOTIFICATIONS_ENABLED',
    commerce_email_notifications_enabled: 'COMMERCE_EMAIL_NOTIFICATIONS_ENABLED',
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
    google_image_search_api_key: 'GOOGLE_IMAGE_SEARCH_API_KEY',
    google_image_search_cx: 'GOOGLE_IMAGE_SEARCH_CX',
    pexels_api_key: 'PEXELS_API_KEY',
    pixabay_api_key: 'PIXABAY_API_KEY',
    meta_app_id: 'META_APP_ID',
    meta_app_secret: 'META_APP_SECRET',
    facebook_login_configuration_id: 'FACEBOOK_LOGIN_CONFIGURATION_ID',
    instagram_app_id: 'INSTAGRAM_APP_ID',
    instagram_app_secret: 'INSTAGRAM_APP_SECRET',
    meta_access_token: 'META_ACCESS_TOKEN',
    meta_capi_access_token: 'META_CAPI_ACCESS_TOKEN',
    meta_test_event_code: 'META_TEST_EVENT_CODE',
    meta_business_id: 'META_BUSINESS_ID',
    meta_ad_account_id: 'META_AD_ACCOUNT_ID',
    meta_pixel_id: 'META_PIXEL_ID',
    meta_facebook_page_id: 'META_FACEBOOK_PAGE_ID',
    meta_instagram_account_id: 'META_INSTAGRAM_ACCOUNT_ID',
    facebook_page_access_token: 'FACEBOOK_PAGE_ACCESS_TOKEN',
    instagram_business_account_id: 'INSTAGRAM_BUSINESS_ACCOUNT_ID',
    instagram_business_access_token: 'INSTAGRAM_BUSINESS_ACCESS_TOKEN',
    meta_webhook_verify_token: 'META_WEBHOOK_VERIFY_TOKEN',
    meta_whatsapp_enabled: 'META_WHATSAPP_ENABLED',
    meta_whatsapp_business_account_id: 'META_WHATSAPP_BUSINESS_ACCOUNT_ID',
    meta_whatsapp_default_phone_number_id: 'META_WHATSAPP_DEFAULT_PHONE_NUMBER_ID',
    meta_whatsapp_access_token: 'META_WHATSAPP_ACCESS_TOKEN',
    meta_whatsapp_webhook_verify_token: 'META_WHATSAPP_WEBHOOK_VERIFY_TOKEN',
    meta_whatsapp_app_secret: 'META_WHATSAPP_APP_SECRET',
    meta_whatsapp_api_version: 'META_WHATSAPP_API_VERSION',
    meta_whatsapp_default_language: 'META_WHATSAPP_DEFAULT_LANGUAGE',
    meta_whatsapp_support_redirect_phone: 'META_WHATSAPP_SUPPORT_REDIRECT_PHONE',
    meta_whatsapp_triage_enabled: 'META_WHATSAPP_TRIAGE_ENABLED',
    meta_whatsapp_triage_ai_enabled: 'META_WHATSAPP_TRIAGE_AI_ENABLED',
    meta_whatsapp_triage_ai_min_confidence: 'META_WHATSAPP_TRIAGE_AI_MIN_CONFIDENCE',
    meta_whatsapp_triage_ai_prompt: 'META_WHATSAPP_TRIAGE_AI_PROMPT',
    meta_whatsapp_triage_interest_notify_phone: 'META_WHATSAPP_TRIAGE_INTEREST_NOTIFY_PHONE',
    meta_whatsapp_triage_interest_reply: 'META_WHATSAPP_TRIAGE_INTEREST_REPLY',
    meta_whatsapp_triage_opt_out_reply: 'META_WHATSAPP_TRIAGE_OPT_OUT_REPLY',
    meta_whatsapp_triage_privacy_reply: 'META_WHATSAPP_TRIAGE_PRIVACY_REPLY',
    meta_whatsapp_agent_enabled: 'META_WHATSAPP_AGENT_ENABLED',
    meta_whatsapp_agent_prompt: 'META_WHATSAPP_AGENT_PROMPT',
    meta_whatsapp_agent_history_limit: 'META_WHATSAPP_AGENT_HISTORY_LIMIT',
    meta_whatsapp_agent_unknown_reply: 'META_WHATSAPP_AGENT_UNKNOWN_REPLY',
    meta_whatsapp_send_rate_per_minute: 'META_WHATSAPP_SEND_RATE_PER_MINUTE',
    meta_whatsapp_daily_limit_per_number: 'META_WHATSAPP_DAILY_LIMIT_PER_NUMBER',
    meta_whatsapp_editorial_blog_template_name: 'META_WHATSAPP_EDITORIAL_BLOG_TEMPLATE_NAME',
    meta_whatsapp_editorial_news_template_name: 'META_WHATSAPP_EDITORIAL_NEWS_TEMPLATE_NAME',
    meta_whatsapp_property_followup_template_name: 'META_WHATSAPP_PROPERTY_FOLLOWUP_TEMPLATE_NAME',
    meta_whatsapp_editorial_default_sender_id: 'META_WHATSAPP_EDITORIAL_DEFAULT_SENDER_ID',
}

const DEFAULT_PROMPTS: Record<string, string> = {
    pilger_ai_system_prompt: PILGER_AI_PROMPT,
    pilger_ai_rules_prompt: PILGER_AI_RULES_PROMPT,
    lead_extraction_prompt: LEAD_EXTRACTION_PROMPT,
    ads_analyst_system_prompt: ADS_ANALYSIS_SYSTEM_PROMPT,
    vitor_creative_review_system_prompt: VITOR_CREATIVE_REVIEW_SYSTEM_PROMPT,
    pilger_daily_system_prompt: DAILY_REPORT_PROMPT,
    pilger_weekly_system_prompt: WEEKLY_REPORT_PROMPT,
    ceo_agent_system_prompt: CEO_AGENT_SYSTEM_PROMPT,
    radar_analyst_system_prompt: RADAR_ANALYST_SYSTEM_PROMPT,
    blog_intelligence_system_prompt: BLOG_INTELLIGENCE_SYSTEM_PROMPT,
    news_intelligence_system_prompt: NEWS_INTELLIGENCE_SYSTEM_PROMPT,
    research_pilger_system_prompt: RESEARCH_PILGER_SYSTEM_PROMPT,
    benchmark_editorial_system_prompt: BENCHMARK_EDITORIAL_SYSTEM_PROMPT,
    gaia_analytics_web_system_prompt: GAIA_ANALYTICS_WEB_SYSTEM_PROMPT,
    maya_meta_connections_system_prompt: MAYA_META_CONNECTIONS_SYSTEM_PROMPT,
    otto_integrations_system_prompt: OTTO_INTEGRATIONS_SYSTEM_PROMPT,
    iris_media_voice_system_prompt: IRIS_MEDIA_VOICE_SYSTEM_PROMPT,
    teo_webhooks_events_system_prompt: TEO_WEBHOOKS_EVENTS_SYSTEM_PROMPT,
    internal_notifier_system_prompt: INTERNAL_NOTIFIER_SYSTEM_PROMPT,
    email_orchestrator_system_prompt: EMAIL_ORCHESTRATOR_SYSTEM_PROMPT,
    whatsapp_global_system_prompt: DEFAULT_WHATSAPP_GLOBAL_SYSTEM_PROMPT,
    whatsapp_rescue_system_prompt: DEFAULT_WHATSAPP_RESCUE_SYSTEM_PROMPT,
    whatsapp_followup_system_prompt: DEFAULT_WHATSAPP_FOLLOWUP_SYSTEM_PROMPT,
    [WHATSAPP_ATTENDANCE_COACH_PROMPT_KEY]: DEFAULT_WHATSAPP_ATTENDANCE_COACH_PROMPT,
    event_agent_system_prompt: DEFAULT_EVENT_AGENT_SYSTEM_PROMPT,
}

const CONFIG_AGENT_CENTRAL_MAP: Record<string, string> = {
    ai_token_automation_pause_active: 'pilger-ai-core',
    pilger_ai_system_prompt: 'pilger-ai-core',
    pilger_ai_rules_prompt: 'pilger-ai-rules',
    property_register_triage_prompt: 'property-triage',
    property_register_system_prompt: 'property-register',
    property_register_agent_enabled: 'property-register',
    lead_extraction_prompt: 'whatsapp-lead-extraction',
    whatsapp_agent_enabled: 'whatsapp-lead-extraction',
    whatsapp_global_system_prompt: 'whatsapp-global-agent',
    whatsapp_global_agent_enabled: 'whatsapp-global-agent',
    whatsapp_rescue_system_prompt: 'whatsapp-rescue-agent',
    whatsapp_rescue_agent_enabled: 'whatsapp-rescue-agent',
    whatsapp_followup_system_prompt: 'whatsapp-followup-agent',
    whatsapp_followup_agent_enabled: 'whatsapp-followup-agent',
    [WHATSAPP_ATTENDANCE_COACH_PROMPT_KEY]: 'whatsapp-attendance-coach',
    whatsapp_attendance_coach_enabled: 'whatsapp-attendance-coach',
    whatsapp_attendance_coach_max_conversations: 'whatsapp-attendance-coach',
    whatsapp_attendance_coach_batch_size: 'whatsapp-attendance-coach',
    whatsapp_attendance_coach_min_messages: 'whatsapp-attendance-coach',
    whatsapp_rescue_message_template: 'whatsapp-rescue-agent',
    whatsapp_followup_message_template: 'whatsapp-followup-agent',
    user_first_access_whatsapp_message: 'user-first-access-agent',
    user_password_reset_whatsapp_message: 'user-password-reset-agent',
    ads_analyst_system_prompt: 'ads-analyst',
    ads_ai_analysis_enabled: 'ads-analyst',
    vitor_ai_enabled: 'ads-analyst',
    vitor_ai_monitoring_enabled: 'ads-analyst',
    paid_report_agent_enabled: 'ads-analyst',
    vitor_creative_review_system_prompt: 'ads-analyst',
    finance_ops_agent_enabled: 'finance-ops-agent',
    meta_social_agent_system_prompt: 'social-attendance-agent',
    meta_social_agent_enabled: 'social-attendance-agent',
    meta_social_agent_autopilot: 'social-attendance-agent',
    meta_comment_dm_automation_enabled: 'social-attendance-agent',
    meta_comment_dm_cron_enabled: 'social-attendance-agent',
    meta_comment_dm_webhook_autoprocess: 'social-attendance-agent',
    organic_report_agent_system_prompt: 'organic-report-agent',
    organic_report_agent_enabled: 'organic-report-agent',
    creative_strategy_agent_system_prompt: 'creative-strategy-agent',
    marketing_creative_ai_enabled: 'creative-strategy-agent',
    content_publisher_agent_system_prompt: 'content-publisher-agent',
    marketing_publisher_agent_enabled: 'content-publisher-agent',
    marketing_publisher_autopilot: 'content-publisher-agent',
    event_agent_system_prompt: 'event-agent',
    event_agent_enabled: 'event-agent',
    event_agent_ai_report_enabled: 'event-agent',
    broker_candidate_agent_system_prompt: 'broker-candidate-agent',
    broker_candidate_agent_enabled: 'broker-candidate-agent',
    broker_candidate_hot_score_threshold: 'broker-candidate-agent',
    internal_notifier_system_prompt: 'internal-notifier',
    email_orchestrator_system_prompt: 'email-orchestrator',
    email_agent_enabled: 'email-orchestrator',
    email_agent_autopilot: 'email-orchestrator',
    editorial_distribution_recommendations_enabled: 'email-orchestrator',
    pilger_daily_system_prompt: 'pilger-daily-report',
    pilger_daily_report_enabled: 'pilger-daily-report',
    pilger_weekly_system_prompt: 'pilger-weekly-report',
    pilger_weekly_report_enabled: 'pilger-weekly-report',
    ceo_agent_system_prompt: 'ceo-agent',
    lead_executive_briefs_ai_enabled: 'ceo-agent',
    crm_action_recommendations_ai_enabled: 'ceo-agent',
    property_search_alerts_ai_enabled: 'ceo-agent',
    radar_analyst_system_prompt: 'market-radar',
    radar_ai_enabled: 'market-radar',
    blog_intelligence_system_prompt: 'blog-intelligence',
    blog_agent_enabled: 'blog-intelligence',
    blog_intelligence_auto_enabled: 'blog-intelligence',
    news_intelligence_system_prompt: 'news-intelligence',
    news_agent_enabled: 'news-intelligence',
    research_pilger_system_prompt: 'research-pilger',
    research_pilger_enabled: 'research-pilger',
    research_pilger_schedule_enabled: 'research-pilger',
    benchmark_editorial_system_prompt: 'benchmark-editorial',
    benchmark_editorial_enabled: 'benchmark-editorial',
    benchmark_editorial_auto_handoff_enabled: 'benchmark-editorial',
    benchmark_editorial_schedule_enabled: 'benchmark-editorial',
    ecosystem_intelligence_enabled: 'benchmark-editorial',
    organic_social_sync_enabled: 'organic-report-agent',
    gaia_analytics_web_system_prompt: 'gaia-analytics-web',
    gaia_analytics_web_enabled: 'gaia-analytics-web',
    maya_meta_connections_system_prompt: 'maya-meta-connections',
    maya_meta_connections_enabled: 'maya-meta-connections',
    otto_integrations_system_prompt: 'otto-integrations',
    otto_integrations_enabled: 'otto-integrations',
    iris_media_voice_system_prompt: 'iris-media-voice',
    iris_media_voice_enabled: 'iris-media-voice',
    teo_webhooks_events_system_prompt: 'teo-webhooks-events',
    teo_webhooks_events_enabled: 'teo-webhooks-events',
}

const DEFAULT_META_WHATSAPP_TRIAGE_AI_PROMPT = [
    'Voce e um agente de triagem de respostas de envios oficiais de WhatsApp da imobiliaria.',
    'Sua tarefa e classificar a intencao do lead sem entregar detalhes do imovel, empreendimento, preco ou oferta.',
    'Retorne somente JSON valido, sem markdown, neste formato:',
    '{"intent":"interested|opt_out|question|unknown","confidence":0-100,"reason":"motivo curto"}',
    '',
    'Regras:',
    '- interested: o lead pede "saiba mais", quer detalhes, pergunta valor, agenda visita, pede atendimento humano ou demonstra interesse claro.',
    '- opt_out: o lead pede para sair, parar, remover, apagar dados, nao receber mais, ou expressa rejeicao clara.',
    '- question: o lead pergunta sobre origem do contato, privacidade, cadastro ou dados, sem pedir remocao e sem demonstrar interesse.',
    '- unknown: cumprimentos simples, sim/ok sem contexto, "vamos conversar", "vamos falar sobre oportunidades", perguntas de identidade, anexos sem texto, emojis soltos ou textos sem decisao operacional.',
    'Quando houver interesse misturado com duvida, prefira interested. Quando houver pedido de remocao, sempre prefira opt_out.',
    'Nao trate "oi", "ola", "bom dia", "boa noite", "ok", "sim", "quem e voce?", "vamos conversar" ou "vamos falar sobre oportunidades" como interested sem outro sinal claro.',
].join('\n')

const DEFAULT_META_WHATSAPP_AGENT_PROMPT = [
    'CAMADA WHATSAPP OFICIAL',
    'Voce atende leads que responderam mensagens enviadas pelo WhatsApp oficial da imobiliaria.',
    'Use o mesmo estilo do agente global: conversa natural, humana, curta, consultiva e progressiva. Nao pareca bot de menu nem formulario.',
    'Responda primeiro o que o lead perguntou, em seguida faca uma pergunta leve. Nunca ignore uma pergunta direta para soltar uma pergunta padrao.',
    'Fale como WhatsApp real: frases curtas, tom educado, sem texto corporativo duro. Pode usar "por aqui", "sem pressa", "pra eu te situar", mas sem repetir bordoes.',
    'Seu trabalho nao e so fazer triagem. Converse normalmente, tire duvidas simples, qualifique aos poucos e entenda se a pessoa quer moradia, investimento ou os dois.',
    'Nao transforme toda resposta em encaminhamento. O encaminhamento e uma consequencia quando o lead demonstra intencao real ou pede continuidade humana.',
    'Quando o lead clicar ou escrever "Saiba mais", reconheca o interesse, marque should_notify true e puxe uma pergunta leve de qualificacao. Exemplo de direcao: perguntar se busca moradia, investimento ou quer entender possibilidades antes de decidir.',
    'Cumprimentos, "quem e voce?", "do que se trata?", "vamos conversar primeiro", "vamos conversar", "vamos falar sobre oportunidades", "ok" ou "sim" sem contexto nao sao handoff. Responda com contexto, converse e marque should_notify false.',
    'Voce nao deve inventar nem entregar detalhes de imovel, empreendimento, produto, preco, disponibilidade, endereco exato, condicao comercial ou negociacao.',
    'Nunca use a palavra "campanha" com o lead e nunca fale que ele respondeu uma campanha. Use linguagem de atendimento normal: "mensagem", "contato", "conversa" ou "por aqui".',
    'Se pedirem detalhes especificos, diga com naturalidade que voce faz o primeiro atendimento por aqui e que os detalhes dos empreendimentos ficam com os especialistas. So diga que ja passou o contato quando houver interesse real.',
    'Se houver interesse real, pedido de detalhes, valor, visita, consultor, corretor, especialista ou continuidade humana, marque intent interested e should_notify true. A resposta deve dizer que o contato foi sinalizado para um especialista continuar, sem soar automatica.',
    'Se o lead pedir para sair, remover, parar, nao receber, apagar dados, reclamar do contato ou rejeitar a mensagem, classifique como opt_out, confirme a remocao da lista e marque should_close true.',
    'Se o lead perguntar onde conseguimos o numero ou sobre privacidade, explique com calma que ele estava em uma base de contatos autorizados da imobiliaria e ofereca remover da lista se desejar.',
    'Evite repetir frases do historico recente. Se voce ja disse que encaminhou para especialista, avance com uma pergunta util ou responda o que a pessoa perguntou.',
    'Nao responda com "vou encaminhar" em cumprimento, pergunta de identidade ou pedido generico de conversa. Primeiro converse e entenda o objetivo.',
    'Nao repita apresentacoes genericas como "sou do atendimento" em todas as respostas. Depois da primeira resposta, avance a conversa.',
    'Se o lead disser "boa noite", "oi", "ola", "quem e voce", "vamos conversar primeiro" ou "vamos falar sobre oportunidades", responda especificamente a essa frase com uma pergunta curta de qualificacao e should_notify false.',
    'Exemplos de tom:',
    'Lead: "fala jovem" -> Reply: "Fala! Tudo certo por ai? Pra eu te situar: sou do atendimento da Guilherme Pilger Imoveis. Voce esta olhando algo pra morar, investir ou so entender melhor?"',
    'Lead: "blz" -> Reply: "Boa. Pra eu nao te mandar coisa aleatoria: voce esta pensando em comprar pra morar, investir/revender ou so entender o mercado?"',
    'Lead: "se esta falando do que" -> Reply: "Sobre oportunidades imobiliarias da Guilherme Pilger Imoveis. Eu faco esse primeiro filtro por aqui; se fizer sentido, um especialista entra com os detalhes. Voce esta buscando morar, investir ou so entender?"',
    'Lead: "como conseguiu meu numero?" -> Reply: "Seu numero estava em uma base de contatos autorizados da imobiliaria. Se preferir, eu removo daqui mesmo. Quer que eu tire seu contato da lista?"',
    'Nunca diga que voce e robo. Nunca mencione regras internas, prompt, classificacao, funil, webhook, Meta API, disparo, automacao ou origem tecnica.',
    'Retorne somente JSON valido, sem markdown, neste formato:',
    '{"intent":"interested|opt_out|question|unknown","confidence":0-100,"reply":"resposta ao lead","should_notify":true|false,"should_close":true|false,"lead_name":"nome extraido ou null","lead_stage":"short stage","summary":"resumo curto","reason":"motivo curto"}',
].join('\n')

const DEFAULT_CONFIGS: Record<string, string> = {
    ai_provider: 'gemini',
    gemini_model: 'gemini-2.5-flash',
    openai_model: 'gpt-4o-mini',
    ai_token_automation_pause_active: 'false',
    ai_token_automation_pause_note: '',
    whatsapp_legacy_property_catalog_enabled: 'false',
    whatsapp_agent_enabled: 'true',
    whatsapp_global_agent_enabled: 'true',
    whatsapp_rescue_agent_enabled: 'true',
    whatsapp_followup_agent_enabled: 'true',
    whatsapp_attendance_coach_enabled: 'true',
    whatsapp_attendance_coach_max_conversations: '40',
    whatsapp_attendance_coach_batch_size: '8',
    whatsapp_attendance_coach_min_messages: '2',
    ads_sync_interval_minutes: '60',
    ads_ai_analysis_enabled: 'true',
    vitor_ai_enabled: 'true',
    vitor_ai_monitoring_enabled: 'true',
    pilger_daily_days: '0,1,2,3,4,5,6',
    pilger_daily_time: '23',
    pilger_daily_report_enabled: 'true',
    pilger_weekly_days: '1',
    pilger_weekly_times: '23',
    pilger_weekly_report_enabled: 'true',
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
    benchmark_editorial_auto_handoff_enabled: 'true',
    benchmark_editorial_schedule_enabled: 'true',
    benchmark_editorial_weekdays: 'mon,tue,wed,thu,fri',
    benchmark_editorial_run_times: '09,15',
    benchmark_editorial_daily_limit: '6',
    benchmark_editorial_depth: 'media',
    benchmark_editorial_min_score: '70',
    benchmark_editorial_competitors: JSON.stringify(DEFAULT_BENCHMARK_COMPETITORS),
    benchmark_editorial_keywords: JSON.stringify(DEFAULT_BENCHMARK_KEYWORDS),
    benchmark_editorial_opportunities: '[]',
    benchmark_editorial_runs: '[]',
    ecosystem_intelligence_enabled: 'true',
    ecosystem_intelligence_interval_hours: '6',
    ecosystem_intelligence_snapshot_days: '30',
    organic_social_sync_enabled: 'true',
    organic_social_sync_interval_minutes: '120',
    organic_social_sync_limit: '12',
    gaia_analytics_web_enabled: 'true',
    maya_meta_connections_enabled: 'true',
    otto_integrations_enabled: 'true',
    iris_media_voice_enabled: 'true',
    teo_webhooks_events_enabled: 'true',
    meta_webhook_verify_token: 'pilger-meta-webhook',
    meta_whatsapp_enabled: 'false',
    meta_whatsapp_business_account_id: '',
    meta_whatsapp_default_phone_number_id: '',
    meta_whatsapp_access_token: '',
    meta_whatsapp_webhook_verify_token: 'pilger-meta-whatsapp-webhook',
    meta_whatsapp_app_secret: '',
    meta_whatsapp_api_version: 'v21.0',
    meta_whatsapp_default_language: 'pt_BR',
    meta_whatsapp_support_redirect_phone: '',
    meta_whatsapp_triage_enabled: 'true',
    meta_whatsapp_triage_ai_enabled: 'true',
    meta_whatsapp_triage_ai_min_confidence: '70',
    meta_whatsapp_triage_ai_prompt: DEFAULT_META_WHATSAPP_TRIAGE_AI_PROMPT,
    meta_whatsapp_triage_interest_notify_phone: '',
    meta_whatsapp_triage_interest_reply: 'Perfeito. Eu faco esse primeiro filtro por aqui; detalhes de empreendimento, valor e disponibilidade ficam com os especialistas. Ja deixei seu contato sinalizado para continuarem. Pra te direcionar melhor: voce busca morar, investir ou ainda esta avaliando?',
    meta_whatsapp_triage_opt_out_reply: 'Pronto. Vou remover seu contato da nossa lista. Voce nao recebera novas mensagens por este canal.',
    meta_whatsapp_triage_privacy_reply: 'Seu numero estava em uma base de contatos autorizados da imobiliaria. Se nao fizer sentido pra voce, eu removo seu contato por aqui mesmo.',
    meta_whatsapp_agent_enabled: 'true',
    meta_whatsapp_agent_history_limit: '12',
    meta_whatsapp_agent_prompt: DEFAULT_META_WHATSAPP_AGENT_PROMPT,
    meta_whatsapp_agent_unknown_reply: 'Boa. Pra eu te situar: esse contato e sobre oportunidades imobiliarias da Guilherme Pilger Imoveis. Voce esta olhando algo pra morar, investir ou so entender melhor?',
    meta_whatsapp_send_rate_per_minute: '40',
    meta_whatsapp_daily_limit_per_number: '1000',
    meta_whatsapp_editorial_blog_template_name: '',
    meta_whatsapp_editorial_news_template_name: '',
    meta_whatsapp_property_followup_template_name: '',
    meta_whatsapp_editorial_default_sender_id: '',
    meta_connection_logs: '[]',
    public_site_url: 'https://guilhermepilger.ai',
    meta_social_inbox_enabled: 'true',
    meta_social_agent_enabled: 'false',
    meta_social_agent_autopilot: 'false',
    meta_comment_dm_automation_enabled: 'true',
    meta_comment_dm_cron_enabled: 'true',
    meta_comment_dm_webhook_autoprocess: 'true',
    mercado_pago_enabled: 'false',
    mercado_pago_environment: 'sandbox',
    mercado_pago_public_key: '',
    mercado_pago_access_token: '',
    mercado_pago_webhook_secret: '',
    mercado_pago_webhook_url: 'https://guilhermepilger.ai/api/webhooks/mercadopago',
    mercado_pago_pix_expiration_minutes: '60',
    mercado_pago_statement_descriptor: 'PILGER',
    commerce_member_area_url: 'https://guilhermepilger.ai/membros',
    commerce_support_whatsapp: '',
    commerce_automation_enabled: 'true',
    commerce_checkout_abandoned_after_minutes: '30',
    commerce_pix_pending_after_minutes: '10',
    commerce_pix_expiring_before_minutes: '15',
    commerce_checkout_lost_after_hours: '24',
    commerce_whatsapp_notifications_enabled: 'true',
    commerce_email_notifications_enabled: 'true',
    brevo_sender_name: 'Guilherme Pilger',
    brevo_sender_email: 'contato@guilhermepilger.ai',
    brevo_reply_to_email: 'contato@guilhermepilger.ai',
    brevo_test_recipient: '',
    wikimedia_commons_enabled: 'true',
    wikimedia_commons_priority: '1',
    wikimedia_commons_per_page: '12',
    google_image_search_enabled: 'false',
    google_image_search_priority: '3',
    google_image_search_per_page: '10',
    google_image_search_rights: 'cc_publicdomain|cc_attribute',
    google_image_search_require_license_metadata: 'true',
    google_image_search_commercial_only: 'true',
    pexels_enabled: 'true',
    pexels_priority: '2',
    pexels_per_page: '12',
    pixabay_enabled: 'true',
    pixabay_priority: '4',
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
    editorial_distribution_push_enabled: 'true',
    editorial_distribution_message_review_required: 'true',
    editorial_distribution_recommendations_enabled: 'true',
    editorial_distribution_recommendation_min_score: '50',
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
    broker_candidate_agent_enabled: 'true',
    broker_candidate_hot_score_threshold: '80',
    lead_executive_briefs_ai_enabled: 'true',
    crm_action_recommendations_ai_enabled: 'true',
    property_search_alerts_ai_enabled: 'true',
    property_register_agent_enabled: 'true',
    marketing_creative_ai_enabled: 'true',
    finance_ops_agent_enabled: 'true',
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
        ecosystem_intelligence_interval_hours: { fallback: DEFAULT_CONFIGS.ecosystem_intelligence_interval_hours, min: 1, max: 168 },
        ecosystem_intelligence_snapshot_days: { fallback: DEFAULT_CONFIGS.ecosystem_intelligence_snapshot_days, min: 7, max: 180 },
        organic_social_sync_interval_minutes: { fallback: DEFAULT_CONFIGS.organic_social_sync_interval_minutes, min: 30, max: 1440 },
        organic_social_sync_limit: { fallback: DEFAULT_CONFIGS.organic_social_sync_limit, min: 3, max: 50 },
        research_pilger_daily_limit: { fallback: DEFAULT_CONFIGS.research_pilger_daily_limit, min: 0, max: 50 },
        benchmark_editorial_daily_limit: { fallback: DEFAULT_CONFIGS.benchmark_editorial_daily_limit, min: 0, max: 50 },
        benchmark_editorial_min_score: { fallback: DEFAULT_CONFIGS.benchmark_editorial_min_score, min: 0, max: 100 },
        organic_report_agent_interval_hours: { fallback: DEFAULT_CONFIGS.organic_report_agent_interval_hours, min: 6, max: 168 },
        paid_report_agent_interval_hours: { fallback: DEFAULT_CONFIGS.paid_report_agent_interval_hours, min: 6, max: 168 },
        marketing_publisher_interval_minutes: { fallback: DEFAULT_CONFIGS.marketing_publisher_interval_minutes, min: 5, max: 1440 },
        event_agent_hot_score_threshold: { fallback: DEFAULT_CONFIGS.event_agent_hot_score_threshold, min: 40, max: 95 },
        event_agent_report_limit: { fallback: DEFAULT_CONFIGS.event_agent_report_limit, min: 3, max: 40 },
        broker_candidate_hot_score_threshold: { fallback: DEFAULT_CONFIGS.broker_candidate_hot_score_threshold, min: 40, max: 100 },
        email_agent_send_interval_minutes: { fallback: DEFAULT_CONFIGS.email_agent_send_interval_minutes, min: 1, max: 1440 },
        email_agent_daily_limit: { fallback: DEFAULT_CONFIGS.email_agent_daily_limit, min: 1, max: 5000 },
        email_agent_min_hours_between_lead_messages: { fallback: DEFAULT_CONFIGS.email_agent_min_hours_between_lead_messages, min: 1, max: 720 },
        editorial_distribution_whatsapp_interval_minutes: { fallback: DEFAULT_CONFIGS.editorial_distribution_whatsapp_interval_minutes, min: 1, max: 1440 },
        editorial_distribution_whatsapp_daily_limit: { fallback: DEFAULT_CONFIGS.editorial_distribution_whatsapp_daily_limit, min: 1, max: 5000 },
        editorial_distribution_push_interval_minutes: { fallback: DEFAULT_CONFIGS.editorial_distribution_push_interval_minutes, min: 1, max: 1440 },
        editorial_distribution_push_daily_limit: { fallback: DEFAULT_CONFIGS.editorial_distribution_push_daily_limit, min: 1, max: 10000 },
        editorial_distribution_recommendation_min_score: { fallback: DEFAULT_CONFIGS.editorial_distribution_recommendation_min_score, min: 1, max: 100 },
        editorial_distribution_recommendation_batch_limit: { fallback: DEFAULT_CONFIGS.editorial_distribution_recommendation_batch_limit, min: 1, max: 500 },
        mercado_pago_pix_expiration_minutes: { fallback: DEFAULT_CONFIGS.mercado_pago_pix_expiration_minutes, min: 5, max: 1440 },
        commerce_checkout_abandoned_after_minutes: { fallback: DEFAULT_CONFIGS.commerce_checkout_abandoned_after_minutes, min: 5, max: 10080 },
        commerce_pix_pending_after_minutes: { fallback: DEFAULT_CONFIGS.commerce_pix_pending_after_minutes, min: 3, max: 1440 },
        commerce_pix_expiring_before_minutes: { fallback: DEFAULT_CONFIGS.commerce_pix_expiring_before_minutes, min: 3, max: 1440 },
        commerce_checkout_lost_after_hours: { fallback: DEFAULT_CONFIGS.commerce_checkout_lost_after_hours, min: 1, max: 720 },
        meta_whatsapp_triage_ai_min_confidence: { fallback: DEFAULT_CONFIGS.meta_whatsapp_triage_ai_min_confidence, min: 0, max: 100 },
        meta_whatsapp_agent_history_limit: { fallback: DEFAULT_CONFIGS.meta_whatsapp_agent_history_limit, min: 4, max: 30 },
        meta_whatsapp_send_rate_per_minute: { fallback: DEFAULT_CONFIGS.meta_whatsapp_send_rate_per_minute, min: 1, max: 1000 },
        meta_whatsapp_daily_limit_per_number: { fallback: DEFAULT_CONFIGS.meta_whatsapp_daily_limit_per_number, min: 1, max: 1000000 },
        wikimedia_commons_priority: { fallback: DEFAULT_CONFIGS.wikimedia_commons_priority, min: 1, max: 4 },
        wikimedia_commons_per_page: { fallback: DEFAULT_CONFIGS.wikimedia_commons_per_page, min: 3, max: 30 },
        google_image_search_priority: { fallback: DEFAULT_CONFIGS.google_image_search_priority, min: 1, max: 4 },
        google_image_search_per_page: { fallback: DEFAULT_CONFIGS.google_image_search_per_page, min: 3, max: 10 },
        pexels_priority: { fallback: DEFAULT_CONFIGS.pexels_priority, min: 1, max: 4 },
        pexels_per_page: { fallback: DEFAULT_CONFIGS.pexels_per_page, min: 3, max: 40 },
        pixabay_priority: { fallback: DEFAULT_CONFIGS.pixabay_priority, min: 1, max: 4 },
        pixabay_per_page: { fallback: DEFAULT_CONFIGS.pixabay_per_page, min: 3, max: 40 },
    }

    const defaultOnBooleanConfigs = new Set([
        'whatsapp_agent_enabled',
        'whatsapp_global_agent_enabled',
        'whatsapp_rescue_agent_enabled',
        'whatsapp_followup_agent_enabled',
        'whatsapp_attendance_coach_enabled',
        'ads_ai_analysis_enabled',
        'vitor_ai_enabled',
        'vitor_ai_monitoring_enabled',
        'pilger_daily_report_enabled',
        'pilger_weekly_report_enabled',
        'radar_ai_enabled',
        'blog_agent_enabled',
        'blog_intelligence_auto_enabled',
        'news_agent_enabled',
        'research_pilger_enabled',
        'research_pilger_schedule_enabled',
        'benchmark_editorial_enabled',
        'benchmark_editorial_auto_handoff_enabled',
        'benchmark_editorial_schedule_enabled',
        'ecosystem_intelligence_enabled',
        'organic_social_sync_enabled',
        'gaia_analytics_web_enabled',
        'maya_meta_connections_enabled',
        'otto_integrations_enabled',
        'iris_media_voice_enabled',
        'teo_webhooks_events_enabled',
        'meta_social_inbox_enabled',
        'meta_whatsapp_agent_enabled',
        'meta_comment_dm_automation_enabled',
        'meta_comment_dm_cron_enabled',
        'meta_comment_dm_webhook_autoprocess',
        'commerce_automation_enabled',
        'commerce_whatsapp_notifications_enabled',
        'commerce_email_notifications_enabled',
        'organic_report_agent_enabled',
        'paid_report_agent_enabled',
        'marketing_publisher_agent_enabled',
        'event_agent_enabled',
        'event_agent_ai_report_enabled',
        'event_agent_button_tracking_enabled',
        'broker_candidate_agent_enabled',
        'lead_executive_briefs_ai_enabled',
        'crm_action_recommendations_ai_enabled',
        'property_search_alerts_ai_enabled',
        'property_register_agent_enabled',
        'marketing_creative_ai_enabled',
        'finance_ops_agent_enabled',
        'email_agent_enabled',
        'email_agent_require_approval',
        'editorial_distribution_email_enabled',
        'editorial_distribution_whatsapp_enabled',
        'editorial_distribution_message_review_required',
        'editorial_distribution_recommendations_enabled',
        'wikimedia_commons_enabled',
        'google_image_search_commercial_only',
        'pexels_enabled',
        'pixabay_enabled',
        'editorial_image_safe_search',
    ])
    const defaultOffBooleanConfigs = new Set([
        'ai_token_automation_pause_active',
        'meta_social_agent_enabled',
        'meta_social_agent_autopilot',
        'meta_whatsapp_enabled',
        'mercado_pago_enabled',
        'marketing_publisher_autopilot',
        'email_agent_autopilot',
        'editorial_distribution_push_enabled',
        'google_image_search_enabled',
        'google_image_search_require_license_metadata',
    ])

    if (key === 'ai_token_automation_pause_note') {
        return String(value || '').trim().slice(0, 500)
    }
    if (defaultOnBooleanConfigs.has(key)) return value === 'false' ? 'false' : 'true'
    if (defaultOffBooleanConfigs.has(key)) return value === 'true' ? 'true' : 'false'

    if (key === 'radar_ai_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'blog_agent_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'blog_intelligence_auto_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'news_agent_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'research_pilger_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'research_pilger_schedule_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'benchmark_editorial_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'benchmark_editorial_auto_handoff_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'benchmark_editorial_schedule_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'gaia_analytics_web_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'maya_meta_connections_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'otto_integrations_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'iris_media_voice_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'teo_webhooks_events_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'meta_social_inbox_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'meta_social_agent_enabled') return value === 'true' ? 'true' : 'false'
    if (key === 'meta_social_agent_autopilot') return value === 'true' ? 'true' : 'false'
    if (key === 'meta_whatsapp_enabled') return value === 'true' ? 'true' : 'false'
    if (key === 'meta_whatsapp_triage_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'meta_whatsapp_triage_ai_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'mercado_pago_enabled') return value === 'true' ? 'true' : 'false'
    if (key === 'commerce_automation_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'commerce_whatsapp_notifications_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'commerce_email_notifications_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'mercado_pago_environment') return value === 'production' ? 'production' : 'sandbox'
    if (key === 'mercado_pago_statement_descriptor') {
        const descriptor = String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Z0-9 ]/gi, '')
            .toUpperCase()
            .trim()
            .slice(0, 22)
        return descriptor || DEFAULT_CONFIGS.mercado_pago_statement_descriptor
    }
    if (key === 'commerce_support_whatsapp') {
        return String(value || '').replace(/\D/g, '').slice(0, 20)
    }
    if (key === 'meta_whatsapp_support_redirect_phone' || key === 'meta_whatsapp_triage_interest_notify_phone') {
        return String(value || '').replace(/\D/g, '').slice(0, 20)
    }
    if (
        key === 'meta_whatsapp_triage_interest_reply' ||
        key === 'meta_whatsapp_triage_opt_out_reply' ||
        key === 'meta_whatsapp_triage_privacy_reply' ||
        key === 'meta_whatsapp_agent_unknown_reply'
    ) {
        return String(value || '').trim().slice(0, 600)
    }
    if (key === 'meta_whatsapp_triage_ai_prompt') {
        return String(value || '').trim().slice(0, 4000) || DEFAULT_CONFIGS.meta_whatsapp_triage_ai_prompt
    }
    if (key === 'meta_whatsapp_agent_prompt') {
        return String(value || '').trim().slice(0, 10000) || DEFAULT_CONFIGS.meta_whatsapp_agent_prompt
    }
    if (key === 'meta_whatsapp_api_version') {
        const selected = String(value || '').trim().toLowerCase()
        return /^v\d+\.\d+$/.test(selected) ? selected : DEFAULT_CONFIGS.meta_whatsapp_api_version
    }
    if (key === 'meta_whatsapp_default_language') {
        const selected = String(value || '').trim().replace('-', '_')
        return /^[a-z]{2}_[A-Z]{2}$/.test(selected) ? selected : DEFAULT_CONFIGS.meta_whatsapp_default_language
    }
    if (
        key === 'meta_whatsapp_editorial_blog_template_name' ||
        key === 'meta_whatsapp_editorial_news_template_name' ||
        key === 'meta_whatsapp_property_followup_template_name'
    ) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 120)
    }
    if (key === 'meta_whatsapp_editorial_default_sender_id') {
        return String(value || '').trim().slice(0, 80)
    }
    if (key === 'mercado_pago_webhook_url' || key === 'commerce_member_area_url') {
        const selected = String(value || '').trim().slice(0, 300)
        if (!selected) return DEFAULT_CONFIGS[key] || ''
        try {
            const url = new URL(selected)
            return ['http:', 'https:'].includes(url.protocol) ? url.toString() : (DEFAULT_CONFIGS[key] || '')
        } catch {
            return DEFAULT_CONFIGS[key] || ''
        }
    }
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
    if (key === 'editorial_distribution_message_review_required') return value === 'false' ? 'false' : 'true'
    if (key === 'editorial_distribution_recommendations_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'wikimedia_commons_enabled') return value === 'false' ? 'false' : 'true'
    if (key === 'google_image_search_enabled') return value === 'true' ? 'true' : 'false'
    if (key === 'google_image_search_require_license_metadata') return value === 'true' ? 'true' : 'false'
    if (key === 'google_image_search_commercial_only') return value === 'false' ? 'false' : 'true'
    if (key === 'google_image_search_rights') {
        const selected = String(value || '').trim()
        const allowed = new Set([
            'cc_publicdomain|cc_attribute',
            'cc_publicdomain',
            'cc_attribute',
            'cc_attribute|cc_sharealike',
            'cc_sharealike',
        ])
        return allowed.has(selected) ? selected : DEFAULT_CONFIGS.google_image_search_rights
    }
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

        await Promise.all(results
            .filter(result => result.success && CONFIG_AGENT_CENTRAL_MAP[result.key])
            .map(result => recordAgentCentralSignal({
                supabase: supabase as any,
                agentId: CONFIG_AGENT_CENTRAL_MAP[result.key],
                eventType: 'agent_configuration_updated',
                entityType: 'app_config',
                entityId: result.key,
                source: 'agent-office-config',
                label: `Configuracao de agente atualizada: ${result.key}`,
                importanceScore: 50,
                metadata: {
                    config_key: result.key,
                    value_length: String(configs[result.key] || '').length,
                },
            }).catch((error: any) => {
                console.warn('[Configs] central signal failed:', result.key, error?.message || error)
                return null
            })))

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
