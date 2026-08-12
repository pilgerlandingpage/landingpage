'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Save, Eye, EyeOff, Wifi, WifiOff, MessageSquare, Brain, Bell, RefreshCw, Microscope, Type, Bot, Zap, Megaphone, BarChart3, Search, TrendingUp, Database, Mic, Volume2, Clock3, Activity, AlertTriangle, Bug, Mail, Image as ImageIcon, CreditCard } from 'lucide-react'
import Link from 'next/link'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

interface IntegrationCard {
    id: string
    title: string
    description: string
    icon: 'whatsapp' | 'gemini' | 'vapid' | 'openai' | 'meta_ads' | 'google_ads' | 'google_analytics' | 'serpapi' | 'dataforseo' | 'r2' | 'inngest' | 'elevenlabs' | 'email' | 'image_bank' | 'mercado_pago'
    fields: {
        key: string
        label: string
        placeholder: string
        isSecret: boolean
        type?: 'text' | 'password' | 'select' | 'textarea'
        options?: { value: string; label: string }[]
    }[]
}

const INTEGRATIONS: IntegrationCard[] = [
    {
        id: 'connectyhub',
        title: 'ConnectyHub - WhatsApp API',
        description: 'API oficial da ConnectyHub para WhatsApp: instancias, mensagens, webhooks, botoes, menus e automacoes. As credenciais ficam na sala de manutencao ou nas variaveis de ambiente.',
        icon: 'whatsapp',
        fields: [
            { key: 'connectyhub_api_url', label: 'CONNECTYHUB_API_URL', placeholder: 'https://seu-connectyhub/api/v1', isSecret: false },
            { key: 'connectyhub_api_token', label: 'CONNECTYHUB_API_TOKEN', placeholder: 'Bearer token do cliente API', isSecret: true },
            { key: 'connectyhub_webhook_secret', label: 'CONNECTYHUB_WEBHOOK_SECRET', placeholder: 'Segredo HMAC do webhook', isSecret: true },
            { key: 'connectyhub_webhook_url', label: 'CONNECTYHUB_WEBHOOK_URL', placeholder: 'https://seu-dominio/api/webhooks/connectyhub', isSecret: false },
        ],
    },

    {
        id: 'mercado_pago',
        title: 'Mercado Pago - Checkout, Pix e Pós-venda',
        description: 'Credenciais para checkout próprio, Pix, webhooks de pagamento, order bump e liberação automática da área de membros. O Access Token deve ficar somente no backend.',
        icon: 'mercado_pago',
        fields: [
            {
                key: 'mercado_pago_enabled',
                label: 'Status da integração',
                placeholder: 'Ativo',
                isSecret: false,
                type: 'select',
                options: [
                    { value: 'true', label: 'Ativo' },
                    { value: 'false', label: 'Inativo' },
                ],
            },
            {
                key: 'mercado_pago_environment',
                label: 'Ambiente',
                placeholder: 'Sandbox',
                isSecret: false,
                type: 'select',
                options: [
                    { value: 'sandbox', label: 'Sandbox / Testes' },
                    { value: 'production', label: 'Produção' },
                ],
            },
            { key: 'mercado_pago_public_key', label: 'Public Key', placeholder: 'APP_USR-... ou TEST-...', isSecret: false },
            { key: 'mercado_pago_access_token', label: 'Access Token', placeholder: 'APP_USR-... ou TEST-...', isSecret: true },
            { key: 'mercado_pago_webhook_secret', label: 'Webhook Secret', placeholder: 'Segredo para validar x-signature', isSecret: true },
            { key: 'mercado_pago_webhook_url', label: 'Webhook URL', placeholder: 'https://guilhermepilger.ai/api/webhooks/mercadopago', isSecret: false },
            { key: 'mercado_pago_pix_expiration_minutes', label: 'Expiração do Pix (minutos)', placeholder: '60', isSecret: false },
            { key: 'mercado_pago_statement_descriptor', label: 'Nome na fatura', placeholder: 'PILGER', isSecret: false },
            { key: 'commerce_member_area_url', label: 'URL da área de membros', placeholder: 'https://guilhermepilger.ai/membros', isSecret: false },
            { key: 'commerce_support_whatsapp', label: 'WhatsApp de suporte', placeholder: '5547999999999', isSecret: false },
            {
                key: 'commerce_automation_enabled',
                label: 'Automação comercial',
                placeholder: 'Ativo',
                isSecret: false,
                type: 'select',
                options: [
                    { value: 'true', label: 'Ativo' },
                    { value: 'false', label: 'Inativo' },
                ],
            },
            { key: 'commerce_checkout_abandoned_after_minutes', label: 'Carrinho abandonado após (minutos)', placeholder: '30', isSecret: false },
            { key: 'commerce_pix_pending_after_minutes', label: 'Pix pendente após (minutos)', placeholder: '10', isSecret: false },
            { key: 'commerce_pix_expiring_before_minutes', label: 'Avisar Pix vencendo antes de (minutos)', placeholder: '15', isSecret: false },
            { key: 'commerce_checkout_lost_after_hours', label: 'Marcar checkout perdido após (horas)', placeholder: '24', isSecret: false },
            {
                key: 'commerce_whatsapp_notifications_enabled',
                label: 'Mensagens via WhatsApp Global',
                placeholder: 'Ativo',
                isSecret: false,
                type: 'select',
                options: [
                    { value: 'true', label: 'Ativo' },
                    { value: 'false', label: 'Inativo' },
                ],
            },
            {
                key: 'commerce_email_notifications_enabled',
                label: 'E-mails transacionais',
                placeholder: 'Ativo',
                isSecret: false,
                type: 'select',
                options: [
                    { value: 'true', label: 'Ativo' },
                    { value: 'false', label: 'Inativo' },
                ],
            },
        ],
    },

    {
        id: 'meta_ads',
        title: 'Meta Social, Ads & Caixa Meta',
        description: 'Credenciais para Meta Ads, Facebook Messenger, comentarios, Instagram API, webhooks, publicacao e agentes de atendimento social.',
        icon: 'meta_ads',
        fields: [
            { key: 'meta_app_id', label: 'Meta App ID', placeholder: 'App ID do Pilger CRM Ads', isSecret: false },
            { key: 'meta_app_secret', label: 'Meta App Secret', placeholder: 'App Secret da Meta', isSecret: true },
            { key: 'facebook_login_configuration_id', label: 'Facebook Login Configuration ID', placeholder: 'ID da configuracao do Facebook Login for Business', isSecret: false },
            { key: 'instagram_app_id', label: 'Instagram App ID', placeholder: 'ID do aplicativo Instagram', isSecret: false },
            { key: 'instagram_app_secret', label: 'Instagram App Secret', placeholder: 'Secret do aplicativo Instagram', isSecret: true },
            { key: 'meta_access_token', label: 'Business/System User Token', placeholder: 'Token geral do Business Manager', isSecret: true },
            { key: 'meta_capi_access_token', label: 'Conversions API Token', placeholder: 'Token exclusivo da API de Conversoes', isSecret: true },
            { key: 'meta_test_event_code', label: 'Meta Test Event Code', placeholder: 'TEST12345 para testar eventos', isSecret: false },
            { key: 'meta_business_id', label: 'Business ID', placeholder: 'ID do portfolio de negocios', isSecret: false },
            { key: 'meta_ad_account_id', label: 'Ad Account ID', placeholder: 'act_... ou numero da conta', isSecret: false },
            { key: 'meta_pixel_id', label: 'Pixel ID', placeholder: 'ID do pixel Meta', isSecret: false },
            { key: 'meta_facebook_page_id', label: 'Facebook Page ID', placeholder: 'ID da pagina Guilherme Pilger', isSecret: false },
            { key: 'facebook_page_access_token', label: 'Facebook Page Access Token', placeholder: 'Token da pagina para Messenger/publicacao', isSecret: true },
            { key: 'meta_instagram_account_id', label: 'Instagram Business ID legado', placeholder: 'ID IG usado pela Graph API atual', isSecret: false },
            { key: 'instagram_business_account_id', label: 'Instagram Business ID novo', placeholder: 'ID da Instagram API com login Instagram', isSecret: false },
            { key: 'instagram_business_access_token', label: 'Instagram Business Access Token', placeholder: 'Token gerado no API setup with Instagram login', isSecret: true },
            { key: 'meta_webhook_verify_token', label: 'Webhook Verify Token', placeholder: 'pilger-meta-webhook', isSecret: true },
            { key: 'public_site_url', label: 'URL publica do sistema', placeholder: 'https://guilhermepilger.ai', isSecret: false },
        ],
    },

    {
        id: 'meta_whatsapp',
        title: 'Credenciais Meta - WhatsApp Oficial',
        description: 'Credenciais e parametros tecnicos do canal oficial Meta WhatsApp Cloud API. Prompts e comportamento do agente ficam no Escritorio de Agentes.',
        icon: 'whatsapp',
        fields: [
            {
                key: 'meta_whatsapp_enabled',
                label: 'Status da API oficial',
                placeholder: 'Inativo',
                isSecret: false,
                type: 'select',
                options: [
                    { value: 'true', label: 'Ativo' },
                    { value: 'false', label: 'Inativo' },
                ],
            },
            { key: 'meta_whatsapp_business_account_id', label: 'WhatsApp Business Account ID', placeholder: 'WABA ID do WhatsApp Manager', isSecret: false },
            { key: 'meta_whatsapp_default_phone_number_id', label: 'Phone Number ID padrao', placeholder: 'ID do numero oficial de disparo', isSecret: false },
            { key: 'meta_whatsapp_access_token', label: 'System User Access Token', placeholder: 'Token com whatsapp_business_messaging e whatsapp_business_management', isSecret: true },
            { key: 'meta_whatsapp_webhook_verify_token', label: 'Webhook Verify Token', placeholder: 'pilger-meta-whatsapp-webhook', isSecret: true },
            { key: 'meta_whatsapp_app_secret', label: 'App Secret para assinatura', placeholder: 'App Secret usado no app Meta WhatsApp', isSecret: true },
            { key: 'meta_whatsapp_api_version', label: 'Graph API Version', placeholder: 'v21.0', isSecret: false },
            { key: 'meta_whatsapp_default_language', label: 'Idioma padrao dos templates', placeholder: 'pt_BR', isSecret: false },
            { key: 'meta_whatsapp_support_redirect_phone', label: 'Numero ConnectyHub de atendimento', placeholder: '5547999999999', isSecret: false },
            { key: 'meta_whatsapp_editorial_blog_template_name', label: 'Template oficial para blog', placeholder: 'pilger_blog_editorial', isSecret: false },
            { key: 'meta_whatsapp_editorial_news_template_name', label: 'Template oficial para noticia', placeholder: 'pilger_news_editorial', isSecret: false },
            { key: 'meta_whatsapp_property_followup_template_name', label: 'Template oficial para recomendacao', placeholder: 'pilger_property_followup', isSecret: false },
            { key: 'meta_whatsapp_editorial_default_sender_id', label: 'Remetente oficial editorial opcional', placeholder: 'UUID do numero sincronizado (opcional)', isSecret: false },
            { key: 'meta_whatsapp_send_rate_per_minute', label: 'Envios por minuto por numero', placeholder: '40', isSecret: false },
            { key: 'meta_whatsapp_daily_limit_per_number', label: 'Limite diario interno por numero', placeholder: '1000', isSecret: false },
        ],
    },

    {
        id: 'google_analytics',
        title: 'Google Analytics & Search Console',
        description: 'GA4 e Search Console para medir trafego organico, paginas de entrada, buscas, cliques, impressoes e conversoes do site.',
        icon: 'google_analytics',
        fields: [
            { key: 'google_analytics_measurement_id', label: 'Measurement ID GA4', placeholder: 'G-XXXXXXXXXX', isSecret: false },
            { key: 'google_analytics_property_id', label: 'Property ID GA4', placeholder: '123456789', isSecret: false },
            { key: 'google_search_console_site_url', label: 'Site no Search Console', placeholder: 'https://guilhermepilger.ai ou sc-domain:guilhermepilger.ai', isSecret: false },
            { key: 'google_analytics_oauth_client_id', label: 'OAuth Client ID', placeholder: 'Client ID do Google Cloud', isSecret: false },
            { key: 'google_analytics_oauth_client_secret', label: 'OAuth Client Secret', placeholder: 'Client Secret do Google Cloud', isSecret: true },
            { key: 'google_analytics_refresh_token', label: 'OAuth Refresh Token', placeholder: 'Gerado pelo botao Conectar Google Analytics', isSecret: true },
        ],
    },

    {
        id: 'vapid',
        title: 'VAPID - Push Notifications',
        description: 'Chaves VAPID para envio de notificações push para visitantes do site.',
        icon: 'vapid',
        fields: [
            { key: 'vapid_subject', label: 'Subject (mailto:)', placeholder: 'mailto:email@exemplo.com', isSecret: false },
            { key: 'vapid_public_key', label: 'Public Key', placeholder: 'BJDt...', isSecret: false },
            { key: 'vapid_private_key', label: 'Private Key', placeholder: 'am19...', isSecret: true },
        ],
    },

    {
        id: 'brevo',
        title: 'Brevo - Envio de E-mails',
        description: 'API transacional para e-mails do sistema, alertas administrativos, recuperacao de acesso e comunicacoes operacionais.',
        icon: 'email',
        fields: [
            { key: 'brevo_api_key', label: 'API Key', placeholder: 'xkeysib-...', isSecret: true },
            { key: 'brevo_sender_name', label: 'Nome do remetente', placeholder: 'Imobiliaria Guilherme Pilger', isSecret: false },
            { key: 'brevo_sender_email', label: 'E-mail do remetente validado', placeholder: 'contato@seudominio.com', isSecret: false },
            { key: 'brevo_reply_to_email', label: 'Reply-To', placeholder: 'atendimento@seudominio.com', isSecret: false },
            { key: 'brevo_test_recipient', label: 'Destinatario de teste', placeholder: 'voce@seudominio.com', isSecret: false },
        ],
    },

    {
        id: 'wikimedia_commons',
        title: 'Wikimedia Commons - Imagens Licenciadas',
        description: 'Fonte principal para imagens editoriais abertas, com autor, pagina de origem e licenca verificavel. Nao exige chave de API e espelha a imagem aprovada no R2 antes de usar em blog e noticias.',
        icon: 'image_bank',
        fields: [
            {
                key: 'wikimedia_commons_enabled',
                label: 'Uso nos agentes',
                placeholder: 'Ativo',
                isSecret: false,
                options: [
                    { value: 'true', label: 'Ativo' },
                    { value: 'false', label: 'Inativo' },
                ],
            },
            {
                key: 'wikimedia_commons_priority',
                label: 'Prioridade',
                placeholder: '1',
                isSecret: false,
                options: [
                    { value: '1', label: '1 - Principal' },
                    { value: '2', label: '2 - Backup' },
                    { value: '3', label: '3 - Terceiro' },
                    { value: '4', label: '4 - Ultimo recurso' },
                ],
            },
            { key: 'wikimedia_commons_per_page', label: 'Imagens por busca', placeholder: '12', isSecret: false },
        ],
    },

    {
        id: 'google_images',
        title: 'Google Imagens Licenciadas - Editorial',
        description: 'Fonte opcional. Mantida como backup futuro, mas pode ficar inativa quando o projeto Google nao tiver acesso ao Custom Search JSON API.',
        icon: 'image_bank',
        fields: [
            { key: 'google_image_search_api_key', label: 'Google Custom Search API Key', placeholder: 'Chave da API do Google Custom Search', isSecret: true },
            { key: 'google_image_search_cx', label: 'Search Engine ID (CX)', placeholder: 'ID do mecanismo de busca programavel', isSecret: false },
            {
                key: 'google_image_search_enabled',
                label: 'Uso nos agentes',
                placeholder: 'Ativo',
                isSecret: false,
                options: [
                    { value: 'true', label: 'Ativo' },
                    { value: 'false', label: 'Inativo' },
                ],
            },
            {
                key: 'google_image_search_priority',
                label: 'Prioridade',
                placeholder: '1',
                isSecret: false,
                options: [
                    { value: '1', label: '1 - Principal' },
                    { value: '2', label: '2 - Backup' },
                    { value: '3', label: '3 - Terceiro' },
                    { value: '4', label: '4 - Ultimo recurso' },
                ],
            },
            { key: 'google_image_search_per_page', label: 'Imagens por busca', placeholder: '10', isSecret: false },
            {
                key: 'google_image_search_rights',
                label: 'Filtro de licenca',
                placeholder: 'cc_publicdomain|cc_attribute',
                isSecret: false,
                options: [
                    { value: 'cc_publicdomain|cc_attribute', label: 'Public domain + atribuição' },
                    { value: 'cc_publicdomain', label: 'Somente public domain' },
                    { value: 'cc_attribute', label: 'Creative Commons com atribuição' },
                    { value: 'cc_attribute|cc_sharealike', label: 'Atribuição + share alike' },
                ],
            },
            {
                key: 'google_image_search_commercial_only',
                label: 'Uso comercial',
                placeholder: 'Exigir',
                isSecret: false,
                options: [
                    { value: 'true', label: 'Exigir uso comercial' },
                    { value: 'false', label: 'Permitir filtro manual' },
                ],
            },
            {
                key: 'google_image_search_require_license_metadata',
                label: 'Metadado de licenca',
                placeholder: 'Flexivel',
                isSecret: false,
                options: [
                    { value: 'true', label: 'Exigir metadado/fonte confiavel' },
                    { value: 'false', label: 'Aceitar filtro Google' },
                ],
            },
        ],
    },

    {
        id: 'pexels',
        title: 'Pexels - Banco de Imagens Editorial',
        description: 'Biblioteca externa de apoio para os agentes quando acervo real e Wikimedia Commons nao retornarem imagem adequada.',
        icon: 'image_bank',
        fields: [
            { key: 'pexels_api_key', label: 'Pexels API Key', placeholder: 'Sua chave da Pexels API', isSecret: true },
            {
                key: 'pexels_enabled',
                label: 'Uso nos agentes',
                placeholder: 'Ativo',
                isSecret: false,
                options: [
                    { value: 'true', label: 'Ativo' },
                    { value: 'false', label: 'Inativo' },
                ],
            },
            {
                key: 'pexels_priority',
                label: 'Prioridade',
                placeholder: '1',
                isSecret: false,
                options: [
                    { value: '1', label: '1 - Principal' },
                    { value: '2', label: '2 - Backup' },
                    { value: '3', label: '3 - Terceiro' },
                    { value: '4', label: '4 - Ultimo recurso' },
                ],
            },
            { key: 'pexels_per_page', label: 'Imagens por busca', placeholder: '12', isSecret: false },
        ],
    },

    {
        id: 'pixabay',
        title: 'Pixabay - Banco de Imagens Editorial',
        description: 'Fonte complementar para fotos, ilustracoes e imagens editoriais quando Wikimedia Commons e acervo interno nao forem suficientes.',
        icon: 'image_bank',
        fields: [
            { key: 'pixabay_api_key', label: 'Pixabay API Key', placeholder: 'Sua chave da Pixabay API', isSecret: true },
            {
                key: 'pixabay_enabled',
                label: 'Uso nos agentes',
                placeholder: 'Ativo',
                isSecret: false,
                options: [
                    { value: 'true', label: 'Ativo' },
                    { value: 'false', label: 'Inativo' },
                ],
            },
            {
                key: 'pixabay_priority',
                label: 'Prioridade',
                placeholder: '2',
                isSecret: false,
                options: [
                    { value: '1', label: '1 - Principal' },
                    { value: '2', label: '2 - Backup' },
                    { value: '3', label: '3 - Terceiro' },
                    { value: '4', label: '4 - Ultimo recurso' },
                ],
            },
            { key: 'pixabay_per_page', label: 'Imagens por busca', placeholder: '12', isSecret: false },
        ],
    },

    {
        id: 'cloudflare',
        title: 'Cloudflare R2 - Storage',
        description: 'Armazenamento de objetos S3 compatível para imagens da plataforma.',
        icon: 'r2',
        fields: [
            { key: 'r2_account_id', label: 'Account ID', placeholder: 'ID da conta Cloudflare', isSecret: false },
            { key: 'r2_access_key_id', label: 'Access Key ID', placeholder: 'Sua chave de acesso', isSecret: false },
            { key: 'r2_secret_access_key', label: 'Secret Access Key', placeholder: 'Seu secret', isSecret: true },
            { key: 'r2_bucket_name', label: 'Bucket Name', placeholder: 'Nome do bucket', isSecret: false },
            { key: 'r2_public_url', label: 'Public URL', placeholder: 'https://pub-....r2.dev', isSecret: false },
        ],
    },

    {
        id: 'serpapi',
        title: 'SerpApi - Search Engine Results',
        description: 'API para extrair resultados de busca do Google.',
        icon: 'serpapi',
        fields: [
            { key: 'serpapi_api_key', label: 'API Key', placeholder: 'Sua API Key', isSecret: true },
        ],
    },
    {
        id: 'dataforseo',
        title: 'DataForSEO - Market Trends',
        description: 'API de backup para tendências de mercado e palavras-chave.',
        icon: 'dataforseo',
        fields: [
            { key: 'dataforseo_login', label: 'Login (Email)', placeholder: 'seu@email.com', isSecret: false },
            { key: 'dataforseo_password', label: 'API Password (Secret)', placeholder: 'Sua senha API', isSecret: true },
        ],
    },

    {
        id: 'inngest',
        title: 'Inngest - Automação & Cron Jobs',
        description: 'Motor de automação: crons do Radar, relatórios Pilger AI, follow-ups e alertas. Estas chaves também precisam estar nas variáveis de ambiente da Vercel.',
        icon: 'inngest',
        fields: [
            { key: 'inngest_event_key', label: 'Event Key', placeholder: 'nSmu_X6u4f...', isSecret: true },
            { key: 'inngest_signing_key', label: 'Signing Key', placeholder: 'signkey-prod-...', isSecret: true },
        ],
    },

    {
        id: 'elevenlabs',
        title: 'ElevenLabs - Voice AI & Clonagem',
        description: 'Vozes ultra-realistas e clonagem de voz para os agentes WhatsApp. Clone a voz do corretor para atendimento natural.',
        icon: 'elevenlabs',
        fields: [
            { key: 'elevenlabs_api_key', label: 'API Key', placeholder: 'Sua API Key ElevenLabs', isSecret: true },
        ],
    },
]

type SectorRecipient = {
    key: string
    label: string
    responsible_name: string
    phone: string
    enabled: boolean
    destination_type?: 'phone' | 'instance'
    delivery_mode?: 'all_sector' | 'sector_and_diretoria' | 'primary_only' | 'muted'
    event_types?: string[]
    members?: SectorMember[]
    target_instance_id?: string
    whatsapp_instance_id?: string
}

type SectorMember = {
    id: string
    name: string
    phone: string
    role?: string
    enabled: boolean
    critical_only?: boolean
    event_types?: string[]
}

const SECTOR_NOTIFICATION_EVENTS = [
    { key: 'property_review', label: 'Imovel em analise' },
    { key: 'blog_review', label: 'Blog aguardando aprovacao' },
    { key: 'blog_published', label: 'Blog publicado' },
    { key: 'news_review', label: 'Noticia aguardando aprovacao' },
    { key: 'news_published', label: 'Noticia publicada' },
    { key: 'meta_payment_issue', label: 'Problema pagamento Meta' },
    { key: 'google_payment_issue', label: 'Problema pagamento Google' },
    { key: 'ads_alert', label: 'Alerta trafego' },
    { key: 'ads_daily_report', label: 'Relatorio trafego' },
    { key: 'paid_report_ready', label: 'Relatorio pago IA' },
    { key: 'lead_received', label: 'Novo lead' },
    { key: 'system_integration_error', label: 'Erro integracao' },
]

const DEFAULT_SECTOR_EVENT_TYPES: Record<string, string[]> = {
    comercial: ['lead_received', 'system_integration_error'],
    diretoria: ['blog_published', 'news_published', 'meta_payment_issue', 'google_payment_issue', 'ads_alert', 'ads_daily_report', 'paid_report_ready', 'system_integration_error'],
    marketing: ['property_review', 'blog_review', 'blog_published', 'news_review', 'news_published', 'paid_report_ready', 'system_integration_error'],
    trafego_pago: ['meta_payment_issue', 'google_payment_issue', 'ads_alert', 'ads_daily_report', 'paid_report_ready', 'system_integration_error'],
}

const DEFAULT_SECTOR_RECIPIENTS: SectorRecipient[] = [
    { key: 'comercial', label: 'Comercial', responsible_name: '', phone: '', enabled: true, destination_type: 'phone', delivery_mode: 'all_sector', event_types: DEFAULT_SECTOR_EVENT_TYPES.comercial, members: [], target_instance_id: '', whatsapp_instance_id: '' },
    { key: 'diretoria', label: 'Diretoria', responsible_name: '', phone: '', enabled: true, destination_type: 'phone', delivery_mode: 'all_sector', event_types: DEFAULT_SECTOR_EVENT_TYPES.diretoria, members: [], target_instance_id: '', whatsapp_instance_id: '' },
    { key: 'marketing', label: 'Marketing', responsible_name: '', phone: '', enabled: true, destination_type: 'phone', delivery_mode: 'all_sector', event_types: DEFAULT_SECTOR_EVENT_TYPES.marketing, members: [], target_instance_id: '', whatsapp_instance_id: '' },
    { key: 'trafego_pago', label: 'Trafego Pago', responsible_name: '', phone: '', enabled: true, destination_type: 'phone', delivery_mode: 'all_sector', event_types: DEFAULT_SECTOR_EVENT_TYPES.trafego_pago, members: [], target_instance_id: '', whatsapp_instance_id: '' },
]

type WhatsAppInstanceOption = {
    id: string
    instance_name: string
    phone_number?: string | null
    status: string
    live_data?: { phone?: string | null; pushName?: string | null } | null
    virtual_brokers?: { name?: string | null } | null
    admin_users?: { name?: string | null } | null
}

function parseSectorRecipients(raw?: string): SectorRecipient[] {
    if (!raw) return DEFAULT_SECTOR_RECIPIENTS

    try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return DEFAULT_SECTOR_RECIPIENTS

        const byKey = new Map(DEFAULT_SECTOR_RECIPIENTS.map(item => [item.key, { ...item }]))
        for (const item of parsed) {
            const key = String(item?.key || '').trim()
            if (!key) continue
            const fallback = byKey.get(key)
            const sectorEvents = normalizeEventTypes(item?.event_types, fallback?.event_types, key)
            const rawMembers = Array.isArray(item?.members) ? item.members : []
            const members: SectorMember[] = rawMembers.length
                ? rawMembers.map((member: any, index: number) => normalizeSectorMember(member, index, sectorEvents))
                : normalizeLegacyMembers(item, fallback, sectorEvents)
            const primaryMember = members.find(member => member.enabled !== false && member.phone)
                || members.find(member => member.phone)
                || members[0]
            byKey.set(key, {
                key,
                label: String(item?.label || fallback?.label || key),
                responsible_name: String(item?.responsible_name || primaryMember?.name || fallback?.responsible_name || ''),
                phone: String(item?.phone || primaryMember?.phone || fallback?.phone || ''),
                enabled: item?.enabled !== false && item?.enabled !== 'false',
                destination_type: item?.destination_type === 'instance' ? 'instance' : (fallback?.destination_type || 'phone'),
                delivery_mode: normalizeDeliveryMode(item?.delivery_mode || fallback?.delivery_mode),
                event_types: sectorEvents,
                members,
                target_instance_id: String(item?.target_instance_id || fallback?.target_instance_id || ''),
                whatsapp_instance_id: String(item?.whatsapp_instance_id || fallback?.whatsapp_instance_id || ''),
            })
        }
        return Array.from(byKey.values())
    } catch {
        return DEFAULT_SECTOR_RECIPIENTS
    }
}

function normalizeDeliveryMode(value: unknown): SectorRecipient['delivery_mode'] {
    const mode = String(value || 'all_sector')
    if (mode === 'sector_and_diretoria' || mode === 'primary_only' || mode === 'muted') return mode
    return 'all_sector'
}

function normalizeEventTypes(value: unknown, fallback: string[] | undefined, sectorKey: string) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean)
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
        } catch {
            return value.split(',').map(item => item.trim()).filter(Boolean)
        }
    }
    return [...(fallback || DEFAULT_SECTOR_EVENT_TYPES[sectorKey] || [])]
}

function normalizeSectorMemberEventTypes(value: unknown, fallback?: string[]) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean)
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
        } catch {
            return value.split(',').map(item => item.trim()).filter(Boolean)
        }
    }
    return Array.isArray(fallback) ? [...fallback] : []
}

function normalizeSectorMember(member: any, index: number, fallbackEvents?: string[]): SectorMember {
    const phone = String(member?.phone || member?.whatsapp || '')
    const name = String(member?.name || member?.responsible_name || member?.responsibleName || '')
    const stableId = phone.replace(/\D/g, '') || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return {
        id: String(member?.id || `member-${index + 1}${stableId ? `-${stableId}` : ''}`),
        name,
        phone,
        role: String(member?.role || member?.cargo || ''),
        enabled: member?.enabled !== false && member?.enabled !== 'false',
        critical_only: member?.critical_only === true || member?.criticalOnly === true || member?.critical_only === 'true',
        event_types: normalizeSectorMemberEventTypes(member?.event_types ?? member?.eventTypes, fallbackEvents),
    }
}

function normalizeLegacyMembers(item: any, fallback?: SectorRecipient, fallbackEvents?: string[]) {
    const name = String(item?.responsible_name || item?.responsibleName || fallback?.responsible_name || '')
    const phone = String(item?.phone || item?.whatsapp || fallback?.phone || '')
    if (!name && !phone) return [...(fallback?.members || [])]
    return [normalizeSectorMember({ id: 'primary', name, phone, role: 'Responsavel', enabled: true, event_types: fallbackEvents }, 0, fallbackEvents)]
}

function syncSectorPrimary(recipient: SectorRecipient): SectorRecipient {
    const members = Array.isArray(recipient.members) ? recipient.members : []
    const primaryMember = members.find(member => member.enabled !== false && member.phone)
        || members.find(member => member.phone)
        || members[0]
    return {
        ...recipient,
        responsible_name: recipient.destination_type === 'instance'
            ? recipient.responsible_name
            : primaryMember?.name || recipient.responsible_name || '',
        phone: recipient.destination_type === 'instance'
            ? recipient.phone
            : primaryMember?.phone || recipient.phone || '',
        delivery_mode: normalizeDeliveryMode(recipient.delivery_mode),
        event_types: normalizeEventTypes(recipient.event_types, undefined, recipient.key),
        members,
    }
}

function simplifySectorRecipient(recipient: SectorRecipient): SectorRecipient {
    const eventTypes = SECTOR_NOTIFICATION_EVENTS.map(event => event.key)
    return syncSectorPrimary({
        ...recipient,
        destination_type: 'phone',
        delivery_mode: 'all_sector',
        event_types: eventTypes,
        members: (recipient.members || []).map((member, index) => normalizeSectorMember(member, index, eventTypes)),
        target_instance_id: '',
    })
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface TestResult {
    status: TestStatus
    message: string
}

type LLMProviderStatus = 'ok' | 'no_credits' | 'invalid_key' | 'missing_key' | 'error'

interface LLMCreditCheck {
    success: boolean
    checked_at?: string
    active_provider?: string
    openai?: { configured: boolean; status: LLMProviderStatus; message: string }
    gemini?: { configured: boolean; status: LLMProviderStatus; message: string }
}

type AgentLogSeverity = 'info' | 'success' | 'warning' | 'error'

interface AgentLogEntry {
    id: string
    created_at: string
    instance_name?: string | null
    event_type?: string | null
    message_type?: string | null
    action: string
    status_code?: number | null
    from_phone?: string | null
    sender_name?: string | null
    payload?: Record<string, unknown> | null
    error?: string | null
    severity: AgentLogSeverity
    summary?: string
}

type AgentLogSummary = Record<AgentLogSeverity | 'total', number>

function toDisplayText(value: unknown, fallback = ''): string {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'string') return value || fallback
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) {
        const parts = value.map(item => toDisplayText(item)).filter(Boolean)
        return parts.join(', ') || fallback
    }
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>
        const preferred = record.name
            || record.pushName
            || record.phone
            || record.message
            || record.status_message
            || record.status
            || record.error
        const preferredText = toDisplayText(preferred)
        const statusText = preferred !== record.status ? toDisplayText(record.status) : ''
        if (preferredText && statusText && !preferredText.includes(statusText)) return `${preferredText} (${statusText})`
        if (preferredText) return preferredText
        try {
            return JSON.stringify(value).slice(0, 220)
        } catch {
            return fallback
        }
    }
    return fallback
}

interface GeminiUsageTotals {
    calls: number
    prompt_tokens: number
    output_tokens: number
    total_tokens: number
    estimated_usd: number
    estimated_brl: number
}

interface GeminiOfficialBillingRow {
    service: string
    sku: string
    project_id: string
    project_name: string
    currency: string
    month_cost: number
    today_cost: number
    last_24h_cost: number
    month_cost_brl: number
    today_cost_brl: number
    last_24h_cost_brl: number
    latest_usage_end_time?: string | null
}

interface GeminiOfficialBillingSummary {
    configured: boolean
    status: 'ok' | 'not_configured' | 'error'
    source: 'cloud_billing_bigquery' | 'not_configured'
    message: string
    month: string
    generated_at: string
    cache_updated_at?: string | null
    billing_project_id?: string | null
    gemini_project_id?: string | null
    table?: string | null
    currency?: string
    month_cost: number
    today_cost: number
    last_24h_cost: number
    month_cost_brl: number
    today_cost_brl: number
    last_24h_cost_brl: number
    latest_usage_end_time?: string | null
    rows: GeminiOfficialBillingRow[]
}

interface GeminiCostSummary {
    month: string
    generated_at: string
    usd_to_brl: number
    month_total: GeminiUsageTotals
    today_total: GeminiUsageTotals
    last_24h_total: GeminiUsageTotals
    by_model: Array<GeminiUsageTotals & { model: string }>
    by_feature: Array<GeminiUsageTotals & { feature: string }>
    official_billing?: GeminiOfficialBillingSummary
}

type MetaConnectionLogEntry = {
    at: string
    provider?: 'meta' | 'facebook' | 'instagram'
    action: string
    status: 'info' | 'success' | 'warning' | 'error'
    message: string
}

function parseMetaConnectionLogs(value?: string): MetaConnectionLogEntry[] {
    try {
        const parsed = JSON.parse(String(value || '[]'))
        return Array.isArray(parsed) ? parsed.slice(0, 12) : []
    } catch {
        return []
    }
}

export default function MaintenancePage() {
    const [configs, setConfigs] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [configsDirty, setConfigsDirty] = useState(false)
    const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})
    const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

    const [elevenLabsVoices, setElevenLabsVoices] = useState<{ voice_id: string; name: string; category: string }[]>([])
    const [loadingVoices, setLoadingVoices] = useState(false)
    const [llmCreditLoading, setLlmCreditLoading] = useState(false)
    const [llmCreditCheck, setLlmCreditCheck] = useState<LLMCreditCheck | null>(null)
    const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([])
    const [agentLogSummary, setAgentLogSummary] = useState<AgentLogSummary>({ total: 0, info: 0, success: 0, warning: 0, error: 0 })
    const [agentLogsLoading, setAgentLogsLoading] = useState(false)
    const [agentLogsError, setAgentLogsError] = useState<string | null>(null)
    const [agentLogHours, setAgentLogHours] = useState(24)
    const [geminiCostSummary, setGeminiCostSummary] = useState<GeminiCostSummary | null>(null)
    const [geminiCostsLoading, setGeminiCostsLoading] = useState(false)
    const [geminiCostsError, setGeminiCostsError] = useState<string | null>(null)
    const [syncingGeminiFinance, setSyncingGeminiFinance] = useState(false)
    const [selectedNotificationSector, setSelectedNotificationSector] = useState('marketing')
    const [whatsappInstances, setWhatsappInstances] = useState<WhatsAppInstanceOption[]>([])
    const sectorRecipientsRef = useRef<SectorRecipient[]>(DEFAULT_SECTOR_RECIPIENTS)

    const getSectorRecipientsFromConfig = (source: Record<string, string>) => {
        return parseSectorRecipients(source['sector_notification_recipients']).map(recipient => {
            const baseRecipient = {
                ...recipient,
                destination_type: 'phone' as const,
                delivery_mode: 'all_sector' as const,
                event_types: [...(DEFAULT_SECTOR_EVENT_TYPES[recipient.key] || [])],
                members: recipient.members || [],
                target_instance_id: '',
                whatsapp_instance_id: recipient.whatsapp_instance_id || '',
            }

            if (recipient.key !== 'marketing') return simplifySectorRecipient(baseRecipient)

            const marketingRecipient = {
                ...baseRecipient,
                label: recipient.label || source['property_review_sector_name'] || 'Marketing',
                responsible_name: recipient.responsible_name || source['property_review_responsible_name'] || '',
                phone: recipient.phone || source['property_review_responsible_phone'] || '',
                whatsapp_instance_id: recipient.whatsapp_instance_id || source['property_review_whatsapp_instance_id'] || '',
            }
            if (!marketingRecipient.members?.length && (marketingRecipient.responsible_name || marketingRecipient.phone)) {
                marketingRecipient.members = normalizeLegacyMembers(marketingRecipient, undefined, DEFAULT_SECTOR_EVENT_TYPES.marketing)
            }
            return simplifySectorRecipient(marketingRecipient)
        })
    }

    const sectorRecipients = getSectorRecipientsFromConfig(configs)
    const metaConnectionLogs = parseMetaConnectionLogs(configs.meta_connection_logs)
    const instagramTokenExpiresAt = configs.instagram_token_expires_at || ''
    const instagramTokenExpired = Boolean(
        instagramTokenExpiresAt
        && Number.isFinite(new Date(instagramTokenExpiresAt).getTime())
        && new Date(instagramTokenExpiresAt).getTime() <= Date.now()
    )
    const instagramTokenNeedsReconnect = Boolean(
        configs.instagram_business_access_token
        && (
            instagramTokenExpired
            || configs.instagram_token_kind === 'short_lived'
            || !instagramTokenExpiresAt
        )
    )
    const instagramMetaGraphConnected = Boolean(configs.meta_access_token && configs.meta_instagram_account_id)
    const instagramLoginConnected = Boolean(
        configs.instagram_business_access_token
        && configs.instagram_business_account_id
        && !instagramTokenNeedsReconnect
    )
    const instagramConnected = instagramMetaGraphConnected || instagramLoginConnected
    sectorRecipientsRef.current = sectorRecipients
    const selectedSectorRecipient = sectorRecipients.find(recipient => recipient.key === selectedNotificationSector)
        || sectorRecipients[0]
    const connectedWhatsappInstances = whatsappInstances.filter(instance => instance.status === 'connected')

    const updateConfigField = useCallback((key: string, value: string) => {
        setConfigs(prev => ({ ...prev, [key]: value }))
        setConfigsDirty(true)
    }, [])

    const updateSectorRecipient = (sectorKey: string, patch: Partial<SectorRecipient>) => {
        setConfigsDirty(true)
        setConfigs(prev => {
            const currentRecipients = getSectorRecipientsFromConfig(prev)
            const nextRecipients = currentRecipients.map(recipient =>
                recipient.key === sectorKey ? simplifySectorRecipient({ ...recipient, ...patch }) : simplifySectorRecipient(recipient)
            )
            sectorRecipientsRef.current = nextRecipients
            const nextConfigs: Record<string, string> = {
                ...prev,
                sector_notification_recipients: JSON.stringify(nextRecipients),
            }
            const marketing = nextRecipients.find(recipient => recipient.key === 'marketing')
            if (marketing) {
                nextConfigs.property_review_sector_name = marketing.label
                nextConfigs.property_review_responsible_name = marketing.responsible_name
                nextConfigs.property_review_responsible_phone = marketing.phone
                nextConfigs.property_review_whatsapp_instance_id = marketing.whatsapp_instance_id || ''
            }
            return nextConfigs
        })
    }

    const updateSectorMember = (sectorKey: string, memberId: string, patch: Partial<SectorMember>) => {
        const recipient = sectorRecipients.find(item => item.key === sectorKey)
        if (!recipient) return
        const members = (recipient.members || []).map(member =>
            member.id === memberId ? { ...member, ...patch } : member
        )
        updateSectorRecipient(sectorKey, { members })
    }

    const addSectorMember = (sectorKey: string) => {
        const recipient = sectorRecipients.find(item => item.key === sectorKey)
        if (!recipient) return
        const members = [
            ...(recipient.members || []),
            {
                id: `member-${Date.now()}`,
                name: '',
                phone: '',
                role: '',
                enabled: true,
                critical_only: false,
                event_types: [...(DEFAULT_SECTOR_EVENT_TYPES[sectorKey] || [])],
            },
        ]
        updateSectorRecipient(sectorKey, { members })
    }

    const removeSectorMember = (sectorKey: string, memberId: string) => {
        const recipient = sectorRecipients.find(item => item.key === sectorKey)
        if (!recipient) return
        const members = (recipient.members || []).filter(member => member.id !== memberId)
        updateSectorRecipient(sectorKey, { members })
    }

    const toggleSectorMemberEvent = (sectorKey: string, memberId: string, eventKey: string) => {
        const recipient = sectorRecipients.find(item => item.key === sectorKey)
        if (!recipient) return
        const member = (recipient.members || []).find(item => item.id === memberId)
        if (!member) return
        const currentEvents = new Set(member.event_types || DEFAULT_SECTOR_EVENT_TYPES[sectorKey] || [])
        if (currentEvents.has(eventKey)) {
            currentEvents.delete(eventKey)
        } else {
            currentEvents.add(eventKey)
        }
        updateSectorMember(sectorKey, memberId, { event_types: Array.from(currentEvents) })
    }

    const getInstanceDisplayName = (instance: WhatsAppInstanceOption) => {
        return toDisplayText(instance.virtual_brokers?.name)
            || toDisplayText(instance.admin_users?.name)
            || toDisplayText(instance.live_data?.pushName)
            || toDisplayText(instance.instance_name, 'Instancia')
    }

    const getInstancePhone = (instance: WhatsAppInstanceOption) => {
        return toDisplayText(instance.live_data?.phone) || toDisplayText(instance.phone_number)
    }

    const formatConfigDateTime = (value?: string) => {
        if (!value) return 'Ainda nao executou'
        const date = new Date(value)
        if (!Number.isFinite(date.getTime())) return 'Data invalida'

        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date)
    }
    const formatCurrency = (value: number, currency = 'BRL') => {
        return Number(value || 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency,
            minimumFractionDigits: currency === 'BRL' ? 2 : 4,
            maximumFractionDigits: currency === 'BRL' ? 2 : 6,
        })
    }
    const formatCompactNumber = (value: number) => {
        return Number(value || 0).toLocaleString('pt-BR')
    }

    const formatTokenBreakdown = (total?: GeminiUsageTotals) => {
        const prompt = formatCompactNumber(total?.prompt_tokens || 0)
        const output = formatCompactNumber(total?.output_tokens || 0)
        const all = formatCompactNumber(total?.total_tokens || 0)
        return `Entrada ${prompt} | Saida ${output} | Total ${all}`
    }

    const getOfficialBillingColor = (status?: GeminiOfficialBillingSummary['status']) => {
        if (status === 'ok') return '#22c55e'
        if (status === 'error') return '#ef4444'
        return '#f59e0b'
    }
    // Auto-fetch ElevenLabs voices when API key is available
    useEffect(() => {
        const apiKey = configs['elevenlabs_api_key']
        if (!apiKey || elevenLabsVoices.length > 0) return

        const fetchVoices = async () => {
            setLoadingVoices(true)
            try {
                const res = await fetch('/api/admin/elevenlabs-voices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey })
                })
                const data = await res.json()
                if (data.success) setElevenLabsVoices(data.voices)
            } catch (e) { console.error(e) }
            setLoadingVoices(false)
        }
        const timer = setTimeout(fetchVoices, 1500)
        return () => clearTimeout(timer)
    }, [configs['elevenlabs_api_key']])


    const fetchConfigs = useCallback(async (force = false) => {
        if (configsDirty && !force) {
            setLoading(false)
            return
        }
        try {
            const res = await fetch('/api/admin/configs', { cache: 'no-store' })
            const json = await res.json()
            if (json.success) {
                setConfigs(json.configs)
            }
        } catch (err) {
            console.error('Error loading configs:', err)
        } finally {
            setLoading(false)
        }
    }, [configsDirty])

    useEffect(() => {
        fetchConfigs(true)
        const timer = setInterval(() => fetchConfigs(false), 60000)
        return () => clearInterval(timer)
    }, [fetchConfigs])

    const fetchAgentLogs = useCallback(async () => {
        setAgentLogsLoading(true)
        setAgentLogsError(null)
        try {
            const res = await fetch(`/api/admin/whatsapp/agent-logs?hours=${agentLogHours}&limit=120`)
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Erro ao carregar logs')
            }
            setAgentLogs(data.logs || [])
            setAgentLogSummary(data.summary || { total: 0, info: 0, success: 0, warning: 0, error: 0 })
        } catch (err) {
            console.error('Error loading agent logs:', err)
            setAgentLogsError('Nao foi possivel carregar os logs dos agentes.')
        } finally {
            setAgentLogsLoading(false)
        }
    }, [agentLogHours])

    useEffect(() => {
        fetchAgentLogs()
        const timer = setInterval(fetchAgentLogs, 30000)
        return () => clearInterval(timer)
    }, [fetchAgentLogs])

    const fetchGeminiCosts = useCallback(async (refreshOfficial = false) => {
        setGeminiCostsLoading(true)
        setGeminiCostsError(null)
        try {
            const res = await fetch(`/api/admin/ai-costs/gemini${refreshOfficial ? '?refresh_official=1' : ''}`)
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao carregar custos Gemini')
            }
            setGeminiCostSummary(data.summary || null)
        } catch (err) {
            console.error('Error loading Gemini costs:', err)
            setGeminiCostsError('Nao foi possivel carregar o consumo Gemini.')
        } finally {
            setGeminiCostsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchGeminiCosts()
        const timer = setInterval(fetchGeminiCosts, 30000)
        return () => clearInterval(timer)
    }, [fetchGeminiCosts])

    const syncGeminiCostsToFinance = useCallback(async () => {
        setSyncingGeminiFinance(true)
        setGeminiCostsError(null)
        try {
            const res = await fetch('/api/admin/ai-costs/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month: geminiCostSummary?.month }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao lancar Gemini no financeiro')
            }
            await fetchGeminiCosts()
        } catch (err) {
            console.error('Error syncing Gemini costs:', err)
            setGeminiCostsError('Nao foi possivel lancar o custo Gemini no financeiro.')
        } finally {
            setSyncingGeminiFinance(false)
        }
    }, [fetchGeminiCosts, geminiCostSummary?.month])

    const runLLMCreditCheck = useCallback(async () => {
        setLlmCreditLoading(true)
        try {
            const res = await fetch('/api/admin/llm-credits')
            const data = await res.json()
            setLlmCreditCheck(data)
        } catch {
            setLlmCreditCheck({ success: false })
        } finally {
            setLlmCreditLoading(false)
        }
    }, [])

    useEffect(() => {
        runLLMCreditCheck()
    }, [runLLMCreditCheck])

    const getStatusColor = (status?: LLMProviderStatus) => {
        if (status === 'ok') return '#22c55e'
        if (status === 'no_credits') return '#ef4444'
        if (status === 'invalid_key') return '#f97316'
        if (status === 'missing_key') return '#6b7280'
        return '#f59e0b'
    }

    const getStatusLabel = (status?: LLMProviderStatus) => {
        if (status === 'ok') return 'OK'
        if (status === 'no_credits') return 'Sem Créditos/Quota'
        if (status === 'invalid_key') return 'Chave Inválida'
        if (status === 'missing_key') return 'Chave Ausente'
        return 'Erro'
    }

    const getAgentSeverityColor = (severity: AgentLogSeverity) => {
        if (severity === 'error') return '#ef4444'
        if (severity === 'warning') return '#f59e0b'
        if (severity === 'success') return '#22c55e'
        return '#60a5fa'
    }

    const getAgentSeverityLabel = (severity: AgentLogSeverity) => {
        if (severity === 'error') return 'Erro'
        if (severity === 'warning') return 'Alerta'
        if (severity === 'success') return 'OK'
        return 'Info'
    }

    const getAgentActionLabel = (action: string) => {
        const actionText = toDisplayText(action, 'Evento')
        const labels: Record<string, string> = {
            agent_skip_stale_queue: 'Fila antiga ignorada',
            agent_no_queue_work: 'Fila vazia',
            agent_batch_read: 'Lote lido',
            agent_no_pending_after_debounce: 'Sem fila apos espera',
            agent_empty_input: 'Entrada vazia',
            agent_response_sent: 'Resposta enviada',
            dispatched: 'Webhook despachado',
            responded_fast_webhook: 'Resposta rapida',
            ignored_empty: 'Evento vazio',
            ignored_no_phone: 'Sem telefone',
            error: 'Erro no webhook',
        }
        return labels[actionText] || actionText.replace(/_/g, ' ')
    }

    const getPayloadString = (payload: AgentLogEntry['payload'], key: string) => {
        const value = payload?.[key]
        return toDisplayText(value)
    }

    const getAgentLogDetail = (log: AgentLogEntry) => {
        if (log.error) return toDisplayText(log.error)
        const reason = getPayloadString(log.payload, 'reason') || getPayloadString(log.payload, 'queueReason')
        if (reason) return reason
        return toDisplayText(log.summary)
    }

    const getGeminiFeatureLabel = (feature: string) => {
        const labels: Record<string, string> = {
            whatsapp_agent_response: 'WhatsApp - resposta',
            whatsapp_audio_transcription: 'WhatsApp - audio',
            whatsapp_image_analysis: 'WhatsApp - imagem',
            whatsapp_video_analysis: 'WhatsApp - video',
            whatsapp_document_analysis: 'WhatsApp - documento',
            whatsapp_shadow_agent: 'WhatsApp - co-piloto',
            ads_campaign_analysis: 'Trafego - analise',
            ads_daily_report: 'Relatorio diario',
            lead_extraction: 'Extracao de lead',
            gemini_chat: 'Chat Gemini',
            gemini_chat_rest: 'Chat Gemini',
        }
        return labels[feature] || feature.replace(/_/g, ' ')
    }

    const buildConfigsToSave = useCallback(() => {
        const allKeys = [
            ...INTEGRATIONS.flatMap(i => i.fields.map(f => f.key)),
            'ai_provider',
            'gemini_model',
            'openai_model',
            'gemini_api_key',
            'openai_api_key',
            'vapid_subject',
            'vapid_public_key',
            'vapid_private_key',
            'r2_account_id',
            'r2_access_key_id',
            'r2_secret_access_key',
            'r2_bucket_name',
            'r2_public_url',
            'meta_app_id',
            'meta_app_secret',
            'meta_access_token',
            'meta_ad_account_id',
            'meta_pixel_id',
            'google_ads_developer_token',
            'google_ads_client_id',
            'google_ads_client_secret',
            'google_ads_refresh_token',
            'google_ads_manager_id',
            'google_ads_customer_id',
            'google_analytics_measurement_id',
            'google_analytics_property_id',
            'google_analytics_oauth_client_id',
            'google_analytics_oauth_client_secret',
            'google_analytics_refresh_token',
            'google_search_console_site_url',
            'gemini_billing_bigquery_project_id',
            'gemini_billing_bigquery_dataset',
            'gemini_billing_bigquery_table',
            'gemini_billing_google_project_id',
            'gemini_billing_service_account_json',
            'gemini_billing_client_email',
            'gemini_billing_private_key',
            'serpapi_api_key',
            'dataforseo_login',
            'dataforseo_password',
            'inngest_event_key',
            'inngest_signing_key',
            'meta_social_inbox_enabled',
            'meta_social_agent_enabled',
            'meta_social_agent_autopilot',
            'organic_report_agent_enabled',
            'organic_report_agent_interval_hours',
            'paid_report_agent_enabled',
            'paid_report_agent_interval_hours',
            'marketing_publisher_agent_enabled',
            'marketing_publisher_autopilot',
            'marketing_publisher_interval_minutes',
            'elevenlabs_api_key',
        ]
        const configsToSave: Record<string, string> = {}
        for (const key of allKeys) {
            if (configs[key] !== undefined) {
                configsToSave[key] = configs[key]
            }
        }
        return configsToSave
    }, [configs])

    const saveConfigs = useCallback(async ({ showSuccess = true }: { showSuccess?: boolean } = {}) => {
        setSaving(true)
        setSaveError('')
        setSaved(false)
        try {
            const configsToSave = buildConfigsToSave()
            const res = await fetch('/api/admin/configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs: configsToSave }),
            })
            const json = await res.json().catch(() => ({ success: false, message: 'Resposta invalida ao salvar configuracoes' }))
            if (!res.ok || !json.success) {
                const failedKeys = Array.isArray(json.results)
                    ? json.results.filter((item: { success?: boolean }) => !item.success).map((item: { key?: string }) => item.key).filter(Boolean)
                    : []
                const failedSuffix = failedKeys.length ? ` (${failedKeys.slice(0, 4).join(', ')})` : ''
                setSaveError(`${json.message || 'Erro ao salvar configuracoes'}${failedSuffix}`)
                console.error('Save error:', json.message)
                return false
            } else {
                setConfigsDirty(false)
                await fetchConfigs(true)
                if (showSuccess) {
                    setSaved(true)
                    setTimeout(() => setSaved(false), 3000)
                }
                return true
            }
        } catch (err) {
            console.error('Error saving configs:', err)
            setSaveError('Erro ao salvar configuracoes. Verifique a conexao e tente novamente.')
            return false
        } finally {
            setSaving(false)
        }
    }, [buildConfigsToSave, fetchConfigs])

    const handleSave = async () => {
        await saveConfigs({ showSuccess: true })
    }

    const toggleVisibility = (key: string) => {
        setVisibleFields(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const testConnection = async (integrationId: string) => {
        setTestResults(prev => ({
            ...prev,
            [integrationId]: { status: 'testing', message: 'Testando conexão...' },
        }))

        try {
            if (configsDirty) {
                const savedBeforeTest = await saveConfigs({ showSuccess: false })
                if (!savedBeforeTest) {
                    setTestResults(prev => ({
                        ...prev,
                        [integrationId]: { status: 'error', message: 'Não foi possível salvar antes de testar.' },
                    }))
                    return
                }
            }

            const res = await fetch('/api/admin/test-integration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: integrationId,
                    config: configs,
                }),
            })
            const data = await res.json()
            setTestResults(prev => ({
                ...prev,
                [integrationId]: {
                    status: data.success ? 'success' : 'error',
                    message: toDisplayText(data.message, data.success ? 'Conexão testada.' : 'Erro ao testar conexão'),
                },
            }))
            if (integrationId === 'meta_ads' || integrationId === 'meta_whatsapp') await fetchConfigs(true)
        } catch {
            setTestResults(prev => ({
                ...prev,
                [integrationId]: { status: 'error', message: 'Erro ao testar conexão' },
            }))
        }
    }

    const getIcon = (icon: string) => {
        switch (icon) {
            case 'whatsapp': return <MessageSquare size={22} />
            case 'gemini': return <Brain size={22} />
            case 'openai': return <Bot size={22} />
            case 'vapid': return <Bell size={22} />
            case 'meta_ads': return <Megaphone size={22} />
            case 'google_ads': return <BarChart3 size={22} />
            case 'google_analytics': return <Activity size={22} />
            case 'serpapi': return <Search size={22} />
            case 'dataforseo': return <TrendingUp size={22} />
            case 'r2': return <Database size={22} />
            case 'inngest': return <Zap size={22} />
            case 'elevenlabs': return <Mic size={22} />
            case 'email': return <Mail size={22} />
            case 'image_bank': return <ImageIcon size={22} />
            case 'mercado_pago': return <CreditCard size={22} />
            default: return null
        }
    }

    const getStatusIndicator = (integrationId: string) => {
        const result = testResults[integrationId]
        if (!result || result.status === 'idle') {
            const integration = INTEGRATIONS.find(i => i.id === integrationId)
            const hasConfig = integrationId === 'brevo'
                ? Boolean(configs.brevo_api_key && configs.brevo_sender_email)
                : integrationId === 'mercado_pago'
                    ? Boolean(configs.mercado_pago_public_key && configs.mercado_pago_access_token)
                : integrationId === 'meta_whatsapp'
                    ? Boolean(configs.meta_whatsapp_business_account_id && (configs.meta_whatsapp_access_token || configs.meta_access_token))
                : integration?.fields.some(f => configs[f.key])
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: hasConfig ? 'var(--text-muted)' : '#ef4444',
                }}>
                    {hasConfig ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {hasConfig ? 'Configurado' : 'Não configurado'}
                </span>
            )
        }
        if (result.status === 'testing') {
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--gold)',
                }}>
                    <RefreshCw size={14} className="spin" /> Testando...
                </span>
            )
        }
        if (result.status === 'success') {
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: '#22c55e',
                }}>
                    <Wifi size={14} /> Conectado
                </span>
            )
        }
        return (
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                color: '#ef4444',
            }}>
                <WifiOff size={14} /> Falha
            </span>
        )
    }

    if (loading) {
        return <AdminLoadingState message="Carregando configurações..." />
    }

    return (
        <div>
            <div className="admin-header">
                <div>
                    <h1>Sala de Manutenção</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Gerencie as chaves de API e integrações externas do sistema.
                    </p>
                </div>
                <div className="admin-header-actions">
                    {saved && <span style={{ color: 'var(--success)', fontSize: '0.9rem' }}>Salvo com sucesso!</span>}
                    {saveError && <span style={{ color: '#ef4444', fontSize: '0.9rem', maxWidth: '420px', textAlign: 'right' }}>{saveError}</span>}
                    <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
                        <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Tudo'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gap: '24px' }}>
                {INTEGRATIONS.map(integration => (
                    <div
                        key={integration.id}
                        className="chart-card"
                        style={{
                            border: testResults[integration.id]?.status === 'success'
                                ? '1px solid rgba(34, 197, 94, 0.3)'
                                : testResults[integration.id]?.status === 'error'
                                    ? '1px solid rgba(239, 68, 68, 0.3)'
                                    : undefined,
                        }}
                    >
                        {/* Card Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#000',
                                }}>
                                    {getIcon(integration.icon)}
                                </div>
                                <div>
                                    <div className="chart-title" style={{ marginBottom: '2px' }}>
                                        {integration.title}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {integration.description}
                                    </div>
                                </div>
                            </div>
                            {getStatusIndicator(integration.id)}
                        </div>

                        {/* Fields */}
                        <div style={{ display: 'grid', gap: '14px' }}>
                            {integration.fields.map(field => (
                                <div key={field.key} className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.85rem' }}>
                                        {field.label}
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        {field.type === 'select' ? (
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    className="form-input"
                                                    value={configs[field.key] || field.options?.[0]?.value || ''}
                                                    onChange={e => updateConfigField(field.key, e.target.value)}
                                                    style={{ appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px' }}
                                                >
                                                    {(field.options || []).map(option => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : field.type === 'textarea' ? (
                                            <textarea
                                                className="form-input"
                                                rows={3}
                                                value={configs[field.key] || ''}
                                                onChange={e => updateConfigField(field.key, e.target.value)}
                                                placeholder={field.placeholder}
                                                style={{
                                                    fontFamily: 'inherit',
                                                    fontSize: '0.9rem',
                                                    minHeight: '88px',
                                                    resize: 'vertical',
                                                }}
                                            />
                                        ) : (
                                            <input
                                                className="form-input"
                                                type={field.isSecret && !visibleFields[field.key] ? 'password' : 'text'}
                                                value={configs[field.key] || ''}
                                                onChange={e => updateConfigField(field.key, e.target.value)}
                                                placeholder={field.placeholder}
                                                style={{
                                                    paddingRight: field.isSecret ? '44px' : undefined,
                                                    fontFamily: field.isSecret && !visibleFields[field.key] ? 'inherit' : 'monospace',
                                                    fontSize: '0.9rem',
                                                }}
                                            />
                                        )}
                                        {field.isSecret && (
                                            <button
                                                type="button"
                                                onClick={() => toggleVisibility(field.key)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '8px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                }}
                                                title={visibleFields[field.key] ? 'Esconder' : 'Mostrar'}
                                            >
                                                {visibleFields[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Test Connection Button + Result */}
                        <div style={{
                            marginTop: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <button
                                className="btn"
                                onClick={() => testConnection(integration.id)}
                                disabled={testResults[integration.id]?.status === 'testing'}
                                style={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.85rem',
                                    padding: '8px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                }}
                            >
                                <RefreshCw size={14} /> Testar Conexão
                            </button>
                            {testResults[integration.id]?.message && testResults[integration.id]?.status !== 'testing' && (
                                <span style={{
                                    fontSize: '0.8rem',
                                    color: testResults[integration.id]?.status === 'success' ? '#22c55e' : '#ef4444',
                                }}>
                                    {testResults[integration.id].message}
                                </span>
                            )}
                        </div>

                        {integration.id === 'meta_ads' && (
                            <div style={{
                                marginTop: '18px',
                                paddingTop: '18px',
                                borderTop: '1px solid var(--border-color)',
                                display: 'grid',
                                gap: '16px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '44px',
                                            height: '44px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #E1306C, #1877F2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                        }}>
                                            <Wifi size={22} />
                                        </div>
                                        <div>
                                            <div className="chart-title" style={{ marginBottom: '2px', fontSize: '1.05rem' }}>Conexao assistida Meta</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Use estes botoes para autorizar Facebook, Instagram, Direct, Messenger e publicacao.
                                            </div>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        color: 'var(--gold)',
                                        border: '1px solid rgba(201, 169, 110, .35)',
                                        borderRadius: '999px',
                                        padding: '7px 10px',
                                        background: 'rgba(201, 169, 110, .08)',
                                    }}>
                                        Callback: {(configs.public_site_url || 'https://guilhermepilger.ai').replace(/\/$/, '')}/api/auth/meta
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {[
                                        {
                                            title: 'Instagram do Guilherme',
                                            description: 'Usa automaticamente Meta Graph quando Business Token e Instagram Business ID estao validos. O Instagram Login direto fica como reforco para recursos que exigem esse app.',
                                            href: '/api/auth/meta/instagram/start',
                                            connected: instagramConnected,
                                            warning: !instagramMetaGraphConnected && instagramTokenNeedsReconnect,
                                            detail: instagramMetaGraphConnected
                                                ? `Operacional via Meta Graph. @${configs.meta_instagram_username || 'guilhermepilger'} | ID: ${configs.meta_instagram_account_id}${instagramTokenNeedsReconnect ? ' | Login Instagram direto expirado/opcional.' : ''}`
                                                : configs.instagram_business_account_id
                                                ? `${instagramTokenNeedsReconnect ? 'Reconexao recomendada. ' : ''}ID: ${configs.instagram_business_account_id}${instagramTokenExpiresAt ? ` | expira em ${formatConfigDateTime(instagramTokenExpiresAt)}` : ' | validade nao registrada'}`
                                                : 'Aguardando autorizacao do dono da conta.',
                                        },
                                        {
                                            title: 'Facebook Page',
                                            description: 'Conecta a pagina do Facebook para Messenger, comentarios, publicacao e Page Access Token.',
                                            href: '/api/auth/meta/facebook/start',
                                            connected: Boolean(configs.facebook_page_access_token && configs.meta_facebook_page_id),
                                            warning: false,
                                            detail: configs.meta_facebook_page_name || (configs.meta_facebook_page_id ? `Pagina: ${configs.meta_facebook_page_id}` : 'Aguardando autorizacao da pagina.'),
                                        },
                                    ].map(item => (
                                        <div key={item.title} style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            background: 'rgba(250, 248, 244, .65)',
                                            display: 'grid',
                                            gap: '10px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                                <div>
                                                    <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '5px' }}>{item.title}</strong>
                                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }}>{item.description}</p>
                                                </div>
                                                <span style={{
                                                    whiteSpace: 'nowrap',
                                                    fontSize: '0.68rem',
                                                    fontWeight: 900,
                                                    color: item.connected ? '#22c55e' : item.warning ? '#f59e0b' : '#f59e0b',
                                                    background: item.connected ? 'rgba(34, 197, 94, .1)' : 'rgba(245, 158, 11, .12)',
                                                    borderRadius: '999px',
                                                    padding: '5px 8px',
                                                }}>
                                                    {item.connected ? 'Conectado' : item.warning ? 'Reconectar' : 'Pendente'}
                                                </span>
                                            </div>
                                            <small style={{ color: 'var(--text-muted)' }}>{item.detail}</small>
                                            <a
                                                href={item.href}
                                                className="btn btn-gold"
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    textDecoration: 'none',
                                                    width: 'fit-content',
                                                }}
                                            >
                                                <Wifi size={15} />
                                                {item.connected ? 'Reconectar' : 'Conectar'}
                                            </a>
                                        </div>
                                    ))}
                                </div>

                                <div style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '10px',
                                    padding: '14px',
                                    background: 'var(--bg-primary)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                                        <strong style={{ fontSize: '0.9rem' }}>Log da conexao Meta</strong>
                                        <button
                                            type="button"
                                            onClick={() => fetchConfigs(true)}
                                            style={{
                                                border: '1px solid var(--border-color)',
                                                background: 'transparent',
                                                borderRadius: '8px',
                                                padding: '6px 10px',
                                                color: 'var(--text-muted)',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                            }}
                                        >
                                            Atualizar log
                                        </button>
                                    </div>
                                    {metaConnectionLogs.length === 0 ? (
                                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                            Nenhum evento registrado ainda. Ao testar conexao ou autorizar Facebook/Instagram, erros e sucessos aparecem aqui.
                                        </p>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                            {metaConnectionLogs.map((log, index) => (
                                                <div key={`${log.at}-${index}`} style={{
                                                    display: 'grid',
                                                    gap: '3px',
                                                    padding: '9px 10px',
                                                    borderRadius: '8px',
                                                    background: log.status === 'error' ? 'rgba(239,68,68,.08)' : log.status === 'success' ? 'rgba(34,197,94,.08)' : log.status === 'warning' ? 'rgba(245,158,11,.1)' : 'rgba(59,130,246,.07)',
                                                    border: `1px solid ${log.status === 'error' ? 'rgba(239,68,68,.18)' : log.status === 'success' ? 'rgba(34,197,94,.18)' : log.status === 'warning' ? 'rgba(245,158,11,.2)' : 'rgba(59,130,246,.16)'}`,
                                                }}>
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                        {formatConfigDateTime(log.at)} | {log.provider || 'meta'} | {log.action}
                                                    </span>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>{log.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.5 }}>
                                    Antes de enviar o link, salve as credenciais acima. No Meta Developers, use os callbacks
                                    {' '}
                                    <code>{(configs.public_site_url || 'https://guilhermepilger.ai').replace(/\/$/, '')}/api/auth/meta/instagram/callback</code>
                                    {' '}
                                    e
                                    {' '}
                                    <code>{(configs.public_site_url || 'https://guilhermepilger.ai').replace(/\/$/, '')}/api/auth/meta/facebook/callback</code>.
                                </div>
                            </div>
                        )}

                        {integration.id === 'meta_whatsapp' && (
                            <div style={{
                                marginTop: '18px',
                                paddingTop: '18px',
                                borderTop: '1px solid var(--border-color)',
                                display: 'grid',
                                gap: '14px',
                            }}>
                                <div style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '10px',
                                    padding: '14px',
                                    background: 'rgba(34, 197, 94, .06)',
                                    display: 'grid',
                                    gap: '10px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Checklist Meta WhatsApp</strong>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            color: configs.meta_whatsapp_enabled === 'true' ? '#22c55e' : '#f59e0b',
                                            background: configs.meta_whatsapp_enabled === 'true' ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.12)',
                                            borderRadius: '999px',
                                            padding: '6px 9px',
                                        }}>
                                            {configs.meta_whatsapp_enabled === 'true' ? 'Envio oficial ativo' : 'Aguardando ativacao'}
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5, display: 'grid', gap: '6px' }}>
                                        <span>1. No Meta Developers, abra o app usado para WhatsApp e entre em WhatsApp &gt; API Setup para copiar o WABA ID e o Phone Number ID.</span>
                                        <span>2. No Business Manager, gere um token de usuario de sistema com permissoes de WhatsApp e atribua o WABA/numeros a esse usuario.</span>
                                        <span>3. No WhatsApp Manager, crie/aprove templates de Marketing para campanhas e templates Utility para follow-ups operacionais.</span>
                                        <span>4. Configure o webhook do app para receber mensagens e status em <code>{(configs.public_site_url || 'https://guilhermepilger.ai').replace(/\/$/, '')}/api/webhooks/meta</code>.</span>
                                    </div>
                                </div>

                                <div style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '10px',
                                    padding: '14px',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.76rem',
                                    lineHeight: 1.5,
                                    display: 'grid',
                                    gap: '6px',
                                }}>
                                    <span><strong style={{ color: 'var(--text-primary)' }}>Uso combinado:</strong> campanhas saem pelos numeros oficiais Meta; atendimento, IA e handoff seguem pela ConnectyHub.</span>
                                    <span><strong style={{ color: 'var(--text-primary)' }}>CTA recomendado:</strong> os templates de campanha devem ter botao ou link para o numero ConnectyHub de atendimento.</span>
                                    <span><strong style={{ color: 'var(--text-primary)' }}>Opt-out:</strong> contatos que pedirem SAIR entram na lista de bloqueio antes de novos disparos.</span>
                                </div>
                            </div>
                        )}

                        {integration.id === 'google_analytics' && (
                            <div style={{
                                marginTop: '18px',
                                paddingTop: '18px',
                                borderTop: '1px solid var(--border-color)',
                                display: 'grid',
                                gap: '14px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '44px',
                                            height: '44px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #4285F4, #34A853)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                        }}>
                                            <Activity size={22} />
                                        </div>
                                        <div>
                                            <div className="chart-title" style={{ marginBottom: '2px', fontSize: '1.05rem' }}>Conexao assistida Google</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                                                Use OAuth quando o Analytics nao aceitar service account. Salve Client ID e Client Secret antes de conectar.
                                            </div>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        color: 'var(--gold)',
                                        border: '1px solid rgba(201, 169, 110, .35)',
                                        borderRadius: '999px',
                                        padding: '7px 10px',
                                        background: 'rgba(201, 169, 110, .08)',
                                    }}>
                                        Callback: {(configs.public_site_url || 'https://guilhermepilger.ai').replace(/\/$/, '')}/api/auth/google-analytics/callback
                                    </span>
                                </div>

                                <div style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '10px',
                                    padding: '14px',
                                    background: 'rgba(250, 248, 244, .65)',
                                    display: 'grid',
                                    gap: '10px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                        <div>
                                            <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '5px' }}>
                                                Google Analytics e Search Console
                                            </strong>
                                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                                                Autoriza o sistema a ler relatorios do GA4 e buscas organicas com o usuario administrador do Google.
                                            </p>
                                        </div>
                                        <span style={{
                                            whiteSpace: 'nowrap',
                                            fontSize: '0.68rem',
                                            fontWeight: 900,
                                            color: configs.google_analytics_refresh_token ? '#22c55e' : '#f59e0b',
                                            background: configs.google_analytics_refresh_token ? 'rgba(34, 197, 94, .1)' : 'rgba(245, 158, 11, .12)',
                                            borderRadius: '999px',
                                            padding: '5px 8px',
                                        }}>
                                            {configs.google_analytics_refresh_token ? 'OAuth conectado' : 'OAuth pendente'}
                                        </span>
                                    </div>

                                    <Link
                                        href="/api/auth/google-analytics/start"
                                        className="btn btn-gold"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            textDecoration: 'none',
                                            width: 'fit-content',
                                        }}
                                    >
                                        <Wifi size={15} />
                                        {configs.google_analytics_refresh_token ? 'Reconectar Google' : 'Conectar Google Analytics'}
                                    </Link>

                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.5 }}>
                                        No Google Cloud, cadastre este callback no OAuth Client ID:
                                        {' '}
                                        <code>{(configs.public_site_url || 'https://guilhermepilger.ai').replace(/\/$/, '')}/api/auth/google-analytics/callback</code>.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ............................................... */}
            {/* CENTRAL DE CONTROLE AI                         */}
            {/* ............................................... */}
            <div className="chart-card" style={{ marginTop: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{
                        width: '48px', height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, var(--gold), #b8860b)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.4rem'
                    }}>
                        Y-
                    </div>
                    <div>
                        <div className="chart-title" style={{ marginBottom: '2px', fontSize: '1.1rem' }}>Central de Controle AI (Multi-Provedor)</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Gerencie o combustivel global usado por todos os agentes do ecossistema.
                        </div>
                    </div>
                </div>

                {/* Global Default Provider */}
                <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                        <Zap size={18} style={{ color: 'var(--gold)' }} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>LLM Global do Ecossistema</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Todos os agentes usam este provedor e modelo. Os prompts ficam em Pilger AI &gt; Agentes.</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 16px', borderRadius: '8px', border: configs['ai_provider'] === 'gemini' ? '1px solid var(--gold)' : '1px solid var(--border-color)', background: configs['ai_provider'] === 'gemini' ? 'rgba(201, 169, 110, 0.1)' : 'transparent' }}>
                            <input
                                type="radio"
                                name="ai_provider"
                                value="gemini"
                                checked={(!configs['ai_provider'] || configs['ai_provider'] === 'gemini')}
                                onChange={() => setConfigs({ ...configs, ai_provider: 'gemini' })}
                                style={{ accentColor: 'var(--gold)' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Brain size={16} /> <span>Google Gemini</span>
                            </div>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 16px', borderRadius: '8px', border: configs['ai_provider'] === 'openai' ? '1px solid var(--gold)' : '1px solid var(--border-color)', background: configs['ai_provider'] === 'openai' ? 'rgba(201, 169, 110, 0.1)' : 'transparent' }}>
                            <input
                                type="radio"
                                name="ai_provider"
                                value="openai"
                                checked={configs['ai_provider'] === 'openai'}
                                onChange={() => setConfigs({ ...configs, ai_provider: 'openai' })}
                                style={{ accentColor: 'var(--gold)' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Bot size={16} /> <span>OpenAI</span>
                            </div>
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '16px' }}>
                        {configs['ai_provider'] === 'openai' ? (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Modelo OpenAI global</label>
                                <input
                                    className="form-input"
                                    value={configs['openai_model'] || 'gpt-4o-mini'}
                                    onChange={e => setConfigs({ ...configs, openai_model: e.target.value })}
                                    placeholder="gpt-4o-mini"
                                />
                            </div>
                        ) : (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Modelo Gemini global</label>
                                <input
                                    className="form-input"
                                    value={configs['gemini_model'] || 'gemini-2.5-flash'}
                                    onChange={e => setConfigs({ ...configs, gemini_model: e.target.value })}
                                    placeholder="gemini-2.5-flash"
                                />
                            </div>
                        )}
                    </div>

                    {/* API Keys (Conditional) */}
                    {/* API Keys (Conditional) */}
                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                        {/* Gemini Key */}
                        {(configs['ai_provider'] !== 'openai') && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Brain size={16} style={{ color: 'var(--gold)' }} />
                                    Google Gemini API Key
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="form-input"
                                        type={!visibleFields['gemini_api_key'] ? 'password' : 'text'}
                                        value={configs['gemini_api_key'] || ''}
                                        onChange={e => setConfigs({ ...configs, gemini_api_key: e.target.value })}
                                        placeholder="AIzaSy..."
                                        style={{ fontFamily: 'monospace', paddingRight: '40px', fontSize: '0.9rem' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleVisibility('gemini_api_key')}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                    >
                                        {visibleFields['gemini_api_key'] ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => testConnection('gemini')}
                                        disabled={testResults['gemini']?.status === 'testing'}
                                        style={{
                                            fontSize: '0.75rem',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        {testResults['gemini']?.status === 'testing' ? <RefreshCw size={12} className="spin" /> : <Wifi size={12} />}
                                        Testar Conexão
                                    </button>
                                    {testResults['gemini']?.message && (
                                        <span style={{ fontSize: '0.8rem', color: testResults['gemini']?.status === 'success' ? '#22c55e' : '#ef4444' }}>
                                            {testResults['gemini'].message}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {(configs['ai_provider'] !== 'openai') && (
                            <details style={{ marginTop: '18px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--bg-primary)' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                                    Faturamento oficial Gemini / Google Billing
                                </summary>
                                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                    Use estes campos quando a exportacao do Cloud Billing para BigQuery estiver ativa. O painel usa essa fonte para mostrar o valor oficial ja apurado pelo Google.
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '14px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Projeto BigQuery</label>
                                        <input
                                            className="form-input"
                                            value={configs['gemini_billing_bigquery_project_id'] || ''}
                                            onChange={e => setConfigs({ ...configs, gemini_billing_bigquery_project_id: e.target.value })}
                                            placeholder="pilger-billing"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Dataset</label>
                                        <input
                                            className="form-input"
                                            value={configs['gemini_billing_bigquery_dataset'] || ''}
                                            onChange={e => setConfigs({ ...configs, gemini_billing_bigquery_dataset: e.target.value })}
                                            placeholder="billing_export"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Tabela</label>
                                        <input
                                            className="form-input"
                                            value={configs['gemini_billing_bigquery_table'] || ''}
                                            onChange={e => setConfigs({ ...configs, gemini_billing_bigquery_table: e.target.value })}
                                            placeholder="gcp_billing_export_v1_..."
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Projeto Gemini</label>
                                        <input
                                            className="form-input"
                                            value={configs['gemini_billing_google_project_id'] || ''}
                                            onChange={e => setConfigs({ ...configs, gemini_billing_google_project_id: e.target.value })}
                                            placeholder="gen-lang-client-..."
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '12px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Client email da service account</label>
                                        <input
                                            className="form-input"
                                            value={configs['gemini_billing_client_email'] || ''}
                                            onChange={e => setConfigs({ ...configs, gemini_billing_client_email: e.target.value })}
                                            placeholder="billing-reader@projeto.iam.gserviceaccount.com"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Private key</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                className="form-input"
                                                type={!visibleFields['gemini_billing_private_key'] ? 'password' : 'text'}
                                                value={configs['gemini_billing_private_key'] || ''}
                                                onChange={e => setConfigs({ ...configs, gemini_billing_private_key: e.target.value })}
                                                placeholder="-----BEGIN PRIVATE KEY-----"
                                                style={{ fontFamily: 'monospace', paddingRight: '40px', fontSize: '0.82rem' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => toggleVisibility('gemini_billing_private_key')}
                                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                            >
                                                {visibleFields['gemini_billing_private_key'] ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </details>
                        )}

                        {/* OpenAI Key */}
                        {(configs['ai_provider'] === 'openai') && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Bot size={16} style={{ color: 'var(--gold)' }} />
                                    OpenAI API Key
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="form-input"
                                        type={!visibleFields['openai_api_key'] ? 'password' : 'text'}
                                        value={configs['openai_api_key'] || ''}
                                        onChange={e => setConfigs({ ...configs, openai_api_key: e.target.value })}
                                        placeholder="sk-..."
                                        style={{ fontFamily: 'monospace', paddingRight: '40px', fontSize: '0.9rem' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleVisibility('openai_api_key')}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                    >
                                        {visibleFields['openai_api_key'] ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => testConnection('openai')}
                                        disabled={testResults['openai']?.status === 'testing'}
                                        style={{
                                            fontSize: '0.75rem',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        {testResults['openai']?.status === 'testing' ? <RefreshCw size={12} className="spin" /> : <Wifi size={12} />}
                                        Testar Conexão
                                    </button>
                                    {testResults['openai']?.message && (
                                        <span style={{ fontSize: '0.8rem', color: testResults['openai']?.status === 'success' ? '#22c55e' : '#ef4444' }}>
                                            {testResults['openai'].message}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Agent Logs */}
            <div className="chart-card" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 0 }}>
                        <Activity size={20} style={{ color: 'var(--gold)' }} />
                        Logs dos Agentes WhatsApp
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <select
                            className="form-input"
                            value={agentLogHours}
                            onChange={e => setAgentLogHours(Number(e.target.value))}
                            style={{ width: '130px', height: '36px', fontSize: '0.8rem' }}
                        >
                            <option value={1}>1 hora</option>
                            <option value={6}>6 horas</option>
                            <option value={24}>24 horas</option>
                            <option value={72}>72 horas</option>
                        </select>
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={fetchAgentLogs}
                            disabled={agentLogsLoading}
                            style={{ minWidth: '110px' }}
                        >
                            <RefreshCw size={15} className={agentLogsLoading ? 'spin' : ''} />
                            Atualizar
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                    {[
                        { label: 'Erros', value: agentLogSummary.error || 0, severity: 'error' as AgentLogSeverity, icon: <Bug size={16} /> },
                        { label: 'Alertas', value: agentLogSummary.warning || 0, severity: 'warning' as AgentLogSeverity, icon: <AlertTriangle size={16} /> },
                        { label: 'Respondidos', value: agentLogSummary.success || 0, severity: 'success' as AgentLogSeverity, icon: <MessageSquare size={16} /> },
                        { label: 'Total', value: agentLogSummary.total || 0, severity: 'info' as AgentLogSeverity, icon: <Clock3 size={16} /> },
                    ].map(item => {
                        const color = getAgentSeverityColor(item.severity)
                        return (
                            <div key={item.label} style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                background: 'var(--bg-primary)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', color }}>
                                    {item.icon}
                                    <strong style={{ fontSize: '1.15rem' }}>{item.value}</strong>
                                </div>
                                <div style={{ marginTop: '5px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.label}</div>
                            </div>
                        )
                    })}
                </div>

                {agentLogsError && (
                    <div style={{ marginBottom: '12px', color: '#ef4444', fontSize: '0.82rem' }}>
                        {agentLogsError}
                    </div>
                )}

                <div style={{ display: 'grid', gap: '8px', maxHeight: '430px', overflowY: 'auto', paddingRight: '4px' }}>
                    {agentLogs.length === 0 && !agentLogsLoading ? (
                        <div style={{ border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '14px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                            Nenhum evento de agente encontrado nesse periodo.
                        </div>
                    ) : agentLogs.slice(0, 18).map(log => {
                        const color = getAgentSeverityColor(log.severity)
                        const detail = getAgentLogDetail(log)
                        return (
                            <div key={log.id} style={{
                                display: 'grid',
                                gridTemplateColumns: '130px 1fr',
                                gap: '10px',
                                border: '1px solid var(--border-color)',
                                borderLeft: `3px solid ${color}`,
                                borderRadius: '8px',
                                padding: '10px 12px',
                                background: 'var(--bg-primary)',
                            }}>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                    <div>{formatConfigDateTime(log.created_at)}</div>
                                    <span style={{
                                        display: 'inline-flex',
                                        marginTop: '6px',
                                        padding: '3px 8px',
                                        borderRadius: '999px',
                                        color,
                                        background: `${color}22`,
                                        border: `1px solid ${color}55`,
                                        fontWeight: 700,
                                    }}>
                                        {getAgentSeverityLabel(log.severity)}
                                    </span>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                        <strong style={{ fontSize: '0.86rem' }}>{getAgentActionLabel(log.action)}</strong>
                                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                            {toDisplayText(log.from_phone, 'sem telefone')} {toDisplayText(log.message_type) ? `- ${toDisplayText(log.message_type)}` : ''}
                                        </span>
                                    </div>
                                    {detail && (
                                        <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                                            {detail}
                                        </div>
                                    )}
                                    {(log.instance_name || log.sender_name) && (
                                        <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {toDisplayText(log.instance_name, 'Instancia')} {toDisplayText(log.sender_name) ? `- ${toDisplayText(log.sender_name)}` : ''}
                                        </div>
                                    )}
                                    <details style={{ marginTop: '6px' }}>
                                        <summary style={{ cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Detalhes</summary>
                                        <pre style={{
                                            marginTop: '6px',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            background: 'rgba(0,0,0,0.16)',
                                            borderRadius: '6px',
                                            padding: '8px',
                                            maxHeight: '180px',
                                            overflow: 'auto',
                                        }}>
                                            {JSON.stringify(log.payload || {}, null, 2).slice(0, 1400)}
                                        </pre>
                                    </details>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Diagnostic Tools */}
            <div className="chart-card" style={{ marginTop: '24px' }}>
                <div className="chart-title" style={{ marginBottom: '12px' }}>Ferramentas de Diagnóstico</div>
                <div style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                            Status de Créditos / Quota (LLMs)
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Provider ativo: <strong>{llmCreditCheck?.active_provider || 'não informado'}</strong>
                            </div>
                        </div>
                        <button
                            onClick={runLLMCreditCheck}
                            disabled={llmCreditLoading}
                            className="btn btn-outline btn-sm"
                            style={{ minWidth: 170 }}
                        >
                            {llmCreditLoading ? 'Verificando...' : 'Verificar Créditos Agora'}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px', marginTop: '12px' }}>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <strong>OpenAI</strong>
                                <span style={{
                                    fontSize: '0.72rem',
                                    padding: '3px 8px',
                                    borderRadius: '999px',
                                    background: `${getStatusColor(llmCreditCheck?.openai?.status)}22`,
                                    color: getStatusColor(llmCreditCheck?.openai?.status),
                                    border: `1px solid ${getStatusColor(llmCreditCheck?.openai?.status)}55`,
                                    fontWeight: 700,
                                }}>
                                    {getStatusLabel(llmCreditCheck?.openai?.status)}
                                </span>
                            </div>
                            <div style={{ marginTop: '6px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                {llmCreditCheck?.openai?.message || 'Sem verificação ainda.'}
                            </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <strong>Gemini</strong>
                                <span style={{
                                    fontSize: '0.72rem',
                                    padding: '3px 8px',
                                    borderRadius: '999px',
                                    background: `${getStatusColor(llmCreditCheck?.gemini?.status)}22`,
                                    color: getStatusColor(llmCreditCheck?.gemini?.status),
                                    border: `1px solid ${getStatusColor(llmCreditCheck?.gemini?.status)}55`,
                                    fontWeight: 700,
                                }}>
                                    {getStatusLabel(llmCreditCheck?.gemini?.status)}
                                </span>
                            </div>
                            <div style={{ marginTop: '6px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                {llmCreditCheck?.gemini?.message || 'Sem verificação ainda.'}
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                            Gasto Gemini em Tempo Real
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Estimativa por tokens do nosso sistema. Cambio USD/BRL: <strong>{geminiCostSummary?.usd_to_brl || 5}</strong>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => fetchGeminiCosts(true)}
                                disabled={geminiCostsLoading}
                            >
                                <RefreshCw size={15} className={geminiCostsLoading ? 'spin' : ''} />
                                Atualizar gasto
                            </button>
                            <button
                                type="button"
                                className="btn btn-gold btn-sm"
                                onClick={syncGeminiCostsToFinance}
                                disabled={syncingGeminiFinance || !geminiCostSummary || geminiCostSummary.month_total.estimated_brl <= 0}
                            >
                                {syncingGeminiFinance ? 'Lancando...' : 'Lancar no financeiro'}
                            </button>
                        </div>
                    </div>

                    {geminiCostsError && (
                        <div style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '10px' }}>{geminiCostsError}</div>
                    )}

                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>Google Billing oficial</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {geminiCostSummary?.official_billing?.message || 'Aguardando leitura do faturamento oficial.'}
                                </div>
                            </div>
                            <span style={{
                                fontSize: '0.72rem',
                                padding: '3px 8px',
                                borderRadius: '999px',
                                background: `${getOfficialBillingColor(geminiCostSummary?.official_billing?.status)}22`,
                                color: getOfficialBillingColor(geminiCostSummary?.official_billing?.status),
                                border: `1px solid ${getOfficialBillingColor(geminiCostSummary?.official_billing?.status)}55`,
                                fontWeight: 700,
                            }}>
                                {geminiCostSummary?.official_billing?.status === 'ok'
                                    ? 'Conectado'
                                    : geminiCostSummary?.official_billing?.status === 'error'
                                        ? 'Erro'
                                        : 'Nao configurado'}
                            </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hoje apurado</div>
                                <strong>{formatCurrency(geminiCostSummary?.official_billing?.today_cost_brl || 0)}</strong>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ultimas 24h apuradas</div>
                                <strong>{formatCurrency(geminiCostSummary?.official_billing?.last_24h_cost_brl || 0)}</strong>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mes a pagar</div>
                                <strong>{formatCurrency(geminiCostSummary?.official_billing?.month_cost_brl || 0)}</strong>
                            </div>
                        </div>
                        {geminiCostSummary?.official_billing?.latest_usage_end_time && (
                            <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Ultimo uso no Billing: {formatConfigDateTime(geminiCostSummary.official_billing.latest_usage_end_time)}
                            </div>
                        )}
                        {(geminiCostSummary?.official_billing?.rows || []).length > 0 && (
                            <div style={{ marginTop: '8px', display: 'grid', gap: '5px' }}>
                                {(geminiCostSummary?.official_billing?.rows || []).slice(0, 3).map((row, index) => (
                                    <div key={`${row.project_id}-${row.sku}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.72rem' }}>
                                        <span style={{ color: 'var(--text-muted)', wordBreak: 'break-word' }}>{row.sku || row.service || row.project_id}</span>
                                        <strong>{formatCurrency(row.month_cost_brl)}</strong>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: '8px' }}>Uso em tempo real capturado pelo sistema</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                        {[
                            { label: 'Hoje', total: geminiCostSummary?.today_total },
                            { label: 'Ultimas 24h', total: geminiCostSummary?.last_24h_total },
                            { label: `Mes ${geminiCostSummary?.month || ''}`.trim(), total: geminiCostSummary?.month_total },
                        ].map(item => (
                            <div key={item.label} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.label}</div>
                                <div style={{ marginTop: '4px', fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                                    {formatCurrency(item.total?.estimated_brl || 0)}
                                </div>
                                <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {formatTokenBreakdown(item.total)}
                                </div>
                                <div style={{ marginTop: '3px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {item.total?.calls || 0} chamadas
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px', marginTop: '10px' }}>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px' }}>Por modelo</div>
                            {(geminiCostSummary?.by_model || []).slice(0, 4).map(row => (
                                <div key={row.model} style={{ display: 'grid', gap: '2px', fontSize: '0.74rem', marginTop: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                        <span style={{ color: 'var(--text-muted)', wordBreak: 'break-word' }}>{row.model}</span>
                                        <strong>{formatCurrency(row.estimated_brl)}</strong>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{formatTokenBreakdown(row)}</div>
                                </div>
                            ))}
                            {(!geminiCostSummary?.by_model || geminiCostSummary.by_model.length === 0) && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Sem consumo registrado apos o deploy.</div>
                            )}
                        </div>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px' }}>Por uso</div>
                            {(geminiCostSummary?.by_feature || []).slice(0, 4).map(row => (
                                <div key={row.feature} style={{ display: 'grid', gap: '2px', fontSize: '0.74rem', marginTop: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{getGeminiFeatureLabel(row.feature)}</span>
                                        <strong>{formatCurrency(row.estimated_brl)}</strong>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{formatTokenBreakdown(row)}</div>
                                </div>
                            ))}
                            {(!geminiCostSummary?.by_feature || geminiCostSummary.by_feature.length === 0) && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>As proximas chamadas Gemini ja entram aqui.</div>
                            )}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                    <Link
                        href="/admin/gemini-diagnostic"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '14px 16px',
                            borderRadius: '10px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            textDecoration: 'none',
                            color: 'var(--text-primary)',
                            transition: 'border-color 0.2s',
                        }}
                    >
                        <Microscope size={20} style={{ color: 'var(--gold)' }} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Diagnóstico Gemini API</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Verificar modelos disponíveis para sua API Key
                            </div>
                        </div>
                    </Link>
                    <Link
                        href="/admin/openai-diagnostic"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '14px 16px',
                            borderRadius: '10px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            textDecoration: 'none',
                            color: 'var(--text-primary)',
                            transition: 'border-color 0.2s',
                        }}
                    >
                        <Bot size={20} style={{ color: '#10a37f' }} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Diagnóstico OpenAI API</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Verificar modelos disponíveis para sua API Key
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Info Card */}
            <div className="chart-card" style={{ marginTop: '24px' }}>
                <div className="chart-title">Sobre a Sala de Manutenção</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <p>As chaves de API configuradas aqui têm <strong>prioridade</strong> sobre as variáveis de ambiente do servidor (<code>.env</code>).</p>
                    <p style={{ marginTop: '8px' }}>
                        Se uma chave for removida daqui, o sistema automaticamente usar a varivel de ambiente como fallback.
                    </p>
                    <p style={{ marginTop: '8px' }}>
                        <strong>Chaves de infraestrutura</strong> (Supabase) são gerenciadas apenas via variáveis de ambiente. O <strong>Inngest</strong> precisa estar configurado tanto aqui quanto nas variáveis de ambiente da Vercel.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div >
    )
}
