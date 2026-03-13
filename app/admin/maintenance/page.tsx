'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, Eye, EyeOff, Wifi, WifiOff, MessageSquare, Brain, Bell, RefreshCw, Microscope, Clock, Type, Bot, Zap, Megaphone, BarChart3, Search, TrendingUp, Database } from 'lucide-react'
import Link from 'next/link'
import { LEAD_EXTRACTION_PROMPT, CONCIERGE_BASE_PROMPT, CONCIERGE_SAFEGUARD_RULES, PILGER_AI_PROMPT, ADS_ANALYSIS_SYSTEM_PROMPT, DAILY_REPORT_PROMPT, WEEKLY_REPORT_PROMPT } from '@/lib/ai/prompts'

interface IntegrationCard {
    id: string
    title: string
    description: string
    icon: 'whatsapp' | 'gemini' | 'vapid' | 'openai' | 'meta_ads' | 'google_ads' | 'serpapi' | 'dataforseo' | 'r2' | 'inngest'
    fields: {
        key: string
        label: string
        placeholder: string
        isSecret: boolean
        type?: 'text' | 'password' | 'select'
    }[]
}

const INTEGRATIONS: IntegrationCard[] = [
    {
        id: 'connectyhub',
        title: 'ConnectyHub — WhatsApp',
        description: 'Integração com a API ConnectyHub para envio de mensagens WhatsApp automáticas.',
        icon: 'whatsapp',
        fields: [
            { key: 'connectyhub_api_url', label: 'API URL', placeholder: 'https://api.connectyhub.com.br', isSecret: false },
            { key: 'connectyhub_api_key', label: 'API Key', placeholder: 'Sua API Key', isSecret: true },
            { key: 'connectyhub_instance', label: 'Instance', placeholder: 'ID da instância', isSecret: false },
        ],
    },

    {
        id: 'vapid',
        title: 'VAPID — Push Notifications',
        description: 'Chaves VAPID para envio de notificações push para visitantes do site.',
        icon: 'vapid',
        fields: [
            { key: 'vapid_subject', label: 'Subject (mailto:)', placeholder: 'mailto:email@exemplo.com', isSecret: false },
            { key: 'vapid_public_key', label: 'Public Key', placeholder: 'BJDt...', isSecret: false },
            { key: 'vapid_private_key', label: 'Private Key', placeholder: 'am19...', isSecret: true },
        ],
    },

    {
        id: 'cloudflare',
        title: 'Cloudflare R2 — Storage',
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
        title: 'SerpApi — Search Engine Results',
        description: 'API para extrair resultados de busca do Google.',
        icon: 'serpapi',
        fields: [
            { key: 'serpapi_api_key', label: 'API Key', placeholder: 'Sua API Key', isSecret: true },
        ],
    },
    {
        id: 'dataforseo',
        title: 'DataForSEO — Market Trends',
        description: 'API de backup para tendências de mercado e palavras-chave.',
        icon: 'dataforseo',
        fields: [
            { key: 'dataforseo_login', label: 'Login (Email)', placeholder: 'seu@email.com', isSecret: false },
            { key: 'dataforseo_password', label: 'API Password (Secret)', placeholder: 'Sua senha API', isSecret: true },
        ],
    },

    {
        id: 'inngest',
        title: 'Inngest — Automação & Cron Jobs',
        description: 'Motor de automação: crons do Radar, relatórios Pilger AI, follow-ups e alertas. ⚠️ Estas chaves também precisam estar nas variáveis de ambiente da Vercel.',
        icon: 'inngest',
        fields: [
            { key: 'inngest_event_key', label: 'Event Key', placeholder: 'nSmu_X6u4f...', isSecret: true },
            { key: 'inngest_signing_key', label: 'Signing Key', placeholder: 'signkey-prod-...', isSecret: true },
        ],
    },
]

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface TestResult {
    status: TestStatus
    message: string
}

export default function MaintenancePage() {
    const [configs, setConfigs] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})
    const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

    const [geminiModels, setGeminiModels] = useState<{ id: string; name: string }[]>([])
    const [openaiModels, setOpenaiModels] = useState<{ id: string; name: string }[]>([])
    const [loadingGeminiModels, setLoadingGeminiModels] = useState(false)
    const [loadingOpenAIModels, setLoadingOpenAIModels] = useState(false)

    // Fetch Gemini Models
    useEffect(() => {
        const apiKey = configs['gemini_api_key']
        if (!apiKey) return

        const fetchGemini = async () => {
            setLoadingGeminiModels(true)
            try {
                const res = await fetch('/api/admin/gemini-models', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey }),
                })
                const data = await res.json()
                if (data.success) {
                    setGeminiModels(data.models)
                    // Set defaults if empty
                    setConfigs(prev => {
                        const next = { ...prev }
                        if (!next['gemini_concierge_model'] && data.models.length > 0) next['gemini_concierge_model'] = 'gemini-1.5-flash'
                        if (!next['gemini_pilger_model'] && data.models.length > 0) next['gemini_pilger_model'] = 'gemini-1.5-flash'
                        return next
                    })
                }
            } catch (e) {
                console.error(e)
            } finally {
                setLoadingGeminiModels(false)
            }
        }
        const timer = setTimeout(fetchGemini, 1000)
        return () => clearTimeout(timer)
    }, [configs['gemini_api_key']])

    // Fetch OpenAI Models
    useEffect(() => {
        const apiKey = configs['openai_api_key']
        if (!apiKey) return

        const fetchOpenAI = async () => {
            setLoadingOpenAIModels(true)
            try {
                const res = await fetch('/api/admin/openai-models', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey }),
                })
                const data = await res.json()
                if (data.success) {
                    setOpenaiModels(data.models)
                    // Set defaults if empty
                    setConfigs(prev => {
                        const next = { ...prev }
                        if (!next['openai_concierge_model'] && data.models.length > 0) next['openai_concierge_model'] = 'gpt-3.5-turbo'
                        if (!next['openai_pilger_model'] && data.models.length > 0) next['openai_pilger_model'] = 'gpt-3.5-turbo'
                        return next
                    })
                }
            } catch (e) {
                console.error(e)
            } finally {
                setLoadingOpenAIModels(false)
            }
        }
        const timer = setTimeout(fetchOpenAI, 1000)
        return () => clearTimeout(timer)
    }, [configs['openai_api_key']])


    const fetchConfigs = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/configs')
            const json = await res.json()
            if (json.success) {
                setConfigs(json.configs)
            }
        } catch (err) {
            console.error('Error loading configs:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchConfigs()
    }, [fetchConfigs])

    const handleSave = async () => {
        setSaving(true)
        try {
            const allKeys = [
                ...INTEGRATIONS.flatMap(i => i.fields.map(f => f.key)),
                'ai_provider',
                'gemini_api_key',
                'openai_api_key',
                'concierge_system_prompt',
                'concierge_rules_prompt',
                'pilger_ai_system_prompt',
                'pilger_ai_rules_prompt',
                'chat_delay_before_typing',
                'chat_typing_min_duration',
                'chat_typing_max_duration',
                'chat_max_response_length',
                'concierge_delay_home',
                'concierge_delay_property',
                'concierge_delay_landing_page',
                'concierge_connection_search_delay',
                'concierge_connection_found_delay',
                'concierge_connection_connecting_delay',
                'gemini_concierge_model',
                'gemini_pilger_model',
                'openai_concierge_model',
                'openai_pilger_model',
                'concierge_provider',
                'pilger_provider',
                'lead_extraction_prompt',
                'ads_provider',
                'gemini_ads_model',
                'openai_ads_model',
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
                'serpapi_api_key',
                'dataforseo_login',
                'dataforseo_password',
                'inngest_event_key',
                'inngest_signing_key',
                'pilger_daily_days',
                'pilger_daily_time',
                'pilger_weekly_day',
                'pilger_weekly_time',
                'radar_collection_times',
                'ads_analyst_system_prompt',
                'pilger_daily_system_prompt',
                'pilger_weekly_system_prompt'
            ]
            const configsToSave: Record<string, string> = {}
            for (const key of allKeys) {
                if (configs[key] !== undefined && configs[key] !== '') {
                    configsToSave[key] = configs[key]
                }
            }
            const res = await fetch('/api/admin/configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs: configsToSave }),
            })
            const json = await res.json()
            if (!json.success) {
                console.error('Save error:', json.message)
            }
        } catch (err) {
            console.error('Error saving configs:', err)
        }
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
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
                    message: data.message,
                },
            }))
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
            case 'serpapi': return <Search size={22} />
            case 'dataforseo': return <TrendingUp size={22} />
            case 'r2': return <Database size={22} />
            case 'inngest': return <Zap size={22} />
            default: return null
        }
    }

    const getStatusIndicator = (integrationId: string) => {
        const result = testResults[integrationId]
        if (!result || result.status === 'idle') {
            const hasConfig = INTEGRATIONS
                .find(i => i.id === integrationId)
                ?.fields.some(f => configs[f.key])
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
        return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Carregando...</div>
    }

    return (
        <div>
            <div className="admin-header">
                <div>
                    <h1>🔧 Sala de Manutenção</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Gerencie as chaves de API e integrações externas do sistema.
                    </p>
                </div>
                <div className="admin-header-actions">
                    {saved && <span style={{ color: 'var(--success)', fontSize: '0.9rem' }}>✓ Salvo com sucesso!</span>}
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
                                        {field.type !== 'select' ? (
                                            <input
                                                className="form-input"
                                                type={field.isSecret && !visibleFields[field.key] ? 'password' : 'text'}
                                                value={configs[field.key] || ''}
                                                onChange={e => setConfigs({ ...configs, [field.key]: e.target.value })}
                                                placeholder={field.placeholder}
                                                style={{
                                                    paddingRight: field.isSecret ? '44px' : undefined,
                                                    fontFamily: field.isSecret && !visibleFields[field.key] ? 'inherit' : 'monospace',
                                                    fontSize: '0.9rem',
                                                }}
                                            />
                                        ) : field.key === 'openai_model' ? (
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    className="form-input"
                                                    value={configs[field.key] || 'gpt-3.5-turbo'}
                                                    onChange={e => setConfigs({ ...configs, [field.key]: e.target.value })}
                                                    style={{ appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px' }}
                                                >
                                                    <option value="gpt-4o">GPT-4o (Mais inteligente e rápido)</option>
                                                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Mais rápido e barato)</option>
                                                </select>
                                            </div>
                                        ) : (
                                            <input
                                                className="form-input"
                                                type={field.isSecret && !visibleFields[field.key] ? 'password' : 'text'}
                                                value={configs[field.key] || ''}
                                                onChange={e => setConfigs({ ...configs, [field.key]: e.target.value })}
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
                    </div>
                ))}
            </div>

            {/* ═══════════════════════════════════════════════ */}
            {/* CENTRAL DE CONTROLE AI                         */}
            {/* ═══════════════════════════════════════════════ */}
            <div className="chart-card" style={{ marginTop: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{
                        width: '48px', height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, var(--gold), #b8860b)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.4rem'
                    }}>
                        🤖
                    </div>
                    <div>
                        <div className="chart-title" style={{ marginBottom: '2px', fontSize: '1.1rem' }}>Central de Controle AI (Multi-Provedor)</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Gerencie provedores e modelos específicos para cada função (Concierge e Pilger AI).
                        </div>
                    </div>
                </div>

                {/* ── Global Default Provider ── */}
                <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                        <Zap size={18} style={{ color: 'var(--gold)' }} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Provedor Padrão (Global)</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Usado quando uma função não tem provedor específico selecionado.</div>
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

                    {/* API Keys (Conditional) */}
                    {/* API Keys (Conditional) */}
                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                        {/* Gemini Key */}
                        {(configs['ai_provider'] !== 'openai' || [configs['concierge_provider'], configs['pilger_provider']].includes('gemini')) && (
                            <div className="form-group" style={{ marginBottom: (configs['ai_provider'] === 'openai' || [configs['concierge_provider'], configs['cloner_provider'], configs['pilger_provider']].includes('openai')) ? '20px' : '0' }}>
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

                        {/* OpenAI Key */}
                        {(configs['ai_provider'] === 'openai' || [configs['concierge_provider'], configs['pilger_provider']].includes('openai')) && (
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

                {/* ── 1. CONCIERGE (CHAT) ── */}
                <div style={{ marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px dashed var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--gold)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>💬</span> 1. Concierge (Chat do Site)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        {/* Provider Select */}
                        <div className="form-group">
                            <label className="form-label">Provedor do Concierge</label>
                            <select
                                className="form-input"
                                value={configs['concierge_provider'] || ''}
                                onChange={e => setConfigs({ ...configs, concierge_provider: e.target.value })}
                            >
                                <option value="">Usar Padrão Global ({configs['ai_provider'] === 'openai' ? 'OpenAI' : 'Gemini'})</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>

                        {/* Model Select */}
                        <div className="form-group">
                            <label className="form-label">Modelo do Concierge</label>
                            {(configs['concierge_provider'] === 'openai' || (!configs['concierge_provider'] && configs['ai_provider'] === 'openai')) ? (
                                <div style={{ position: 'relative' }}>
                                    <select
                                        className="form-input"
                                        value={configs['openai_concierge_model'] || ''}
                                        onChange={e => setConfigs({ ...configs, openai_concierge_model: e.target.value })}
                                    >
                                        <option value="">Selecione...</option>
                                        {openaiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                    {loadingOpenAIModels && <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}><RefreshCw size={14} className="spin" /></div>}
                                </div>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <select
                                        className="form-input"
                                        value={configs['gemini_concierge_model'] || ''}
                                        onChange={e => setConfigs({ ...configs, gemini_concierge_model: e.target.value })}
                                    >
                                        <option value="">Selecione...</option>
                                        {geminiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                    {loadingGeminiModels && <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}><RefreshCw size={14} className="spin" /></div>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Prompts for Concierge */}
                    <div className="form-group">
                        <label className="form-label">Prompt do Sistema (Personalidade)</label>
                        <textarea
                            className="form-textarea"
                            rows={6}
                            value={configs['concierge_system_prompt'] || ''}
                            onChange={e => setConfigs({ ...configs, concierge_system_prompt: e.target.value })}
                            placeholder={CONCIERGE_BASE_PROMPT}
                            style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Personalidade base do agente. Deixe em branco para usar o padrão (exibido acima).
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Regras de Segurança (Concierge)</label>
                        <textarea
                            className="form-textarea"
                            rows={8}
                            value={configs['concierge_rules_prompt'] || ''}
                            onChange={e => setConfigs({ ...configs, concierge_rules_prompt: e.target.value })}
                            placeholder={CONCIERGE_SAFEGUARD_RULES}
                            style={{ fontFamily: 'monospace', fontSize: '0.85rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Regras invioláveis que o agente deve seguir. Deixe em branco para usar as regras de segurança padrão.
                        </div>
                    </div>

                    {/* Chat Behaviour (Humanization + Length) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Tempo Espera (s)</label>
                            <input className="form-input" type="number" step="0.5" value={configs['chat_delay_before_typing'] || '2'} onChange={e => setConfigs({ ...configs, chat_delay_before_typing: e.target.value })} />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Tempo que o agente espera antes de mostrar "digitando..." após receber uma mensagem.</div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Digitando Min (s)</label>
                            <input className="form-input" type="number" step="0.5" value={configs['chat_typing_min_duration'] || '5'} onChange={e => setConfigs({ ...configs, chat_typing_min_duration: e.target.value })} />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Duração mínima do indicador "digitando..." para simular uma resposta humana natural.</div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Tamanho Resposta</label>
                            <select className="form-input" value={configs['chat_max_response_length'] || 'Curta (2-3 frases)'} onChange={e => setConfigs({ ...configs, chat_max_response_length: e.target.value })}>
                                <option value="Muito curta (1 frase, máximo 20 palavras)">Muito Curta</option>
                                <option value="Curta (2-3 frases, máximo 50 palavras)">Curta (Padrão)</option>
                                <option value="Média (3-5 frases, máximo 100 palavras)">Média</option>
                                <option value="Longa (parágrafos completos sem limite)">Longa</option>
                            </select>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Controla o tamanho máximo das respostas do agente. Respostas curtas parecem mais naturais.</div>
                        </div>
                    </div>

                    {/* Auto-Open Delay per Page Type */}
                    <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                            <Clock size={16} style={{ color: 'var(--gold)' }} />
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Tempo para Abrir Chat Automaticamente</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Defina em segundos quanto tempo o agente espera antes de chamar o visitante em cada tipo de página.</div>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>🏠 Home (s)</label>
                                <input className="form-input" type="number" min="0" step="1" value={configs['concierge_delay_home'] || '15'} onChange={e => setConfigs({ ...configs, concierge_delay_home: e.target.value })} />
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Tempo na página inicial antes do chat aparecer. Ideal dar mais tempo pois o visitante está explorando.</div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>🏢 Página Imóvel (s)</label>
                                <input className="form-input" type="number" min="0" step="1" value={configs['concierge_delay_property'] || '5'} onChange={e => setConfigs({ ...configs, concierge_delay_property: e.target.value })} />
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Tempo na página de um imóvel específico. O visitante já demonstrou interesse, aborde rapidamente.</div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>📄 Landing Page (s)</label>
                                <input className="form-input" type="number" min="0" step="1" value={configs['concierge_delay_landing_page'] || '10'} onChange={e => setConfigs({ ...configs, concierge_delay_landing_page: e.target.value })} />
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Tempo nas landing pages personalizadas. Espere o visitante absorver o conteúdo antes de abordar.</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configuração do Pipeline de Conexão (Novo) */}
                <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Zap size={16} style={{ color: 'var(--gold)' }} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Velocidade da Animação de Conexão</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Defina em segundos o tempo que cada etapa da animação de conexão leva.</div>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>1. Procurando Corretor (s)</label>
                            <input className="form-input" type="number" min="0" step="0.5" value={configs['concierge_connection_search_delay'] || '1.5'} onChange={e => setConfigs({ ...configs, concierge_connection_search_delay: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>2. Corretor Encontrado (s)</label>
                            <input className="form-input" type="number" min="0" step="0.5" value={configs['concierge_connection_found_delay'] || '1'} onChange={e => setConfigs({ ...configs, concierge_connection_found_delay: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>3. Conectando (s)</label>
                            <input className="form-input" type="number" min="0" step="0.5" value={configs['concierge_connection_connecting_delay'] || '1.2'} onChange={e => setConfigs({ ...configs, concierge_connection_connecting_delay: e.target.value })} />
                        </div>
                    </div>
                </div>

                {/* ── 2. PILGER AI (ADMIN) ── */}
                <div style={{ marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px dashed var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#818cf8', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>🧠</span> 2. Pilger AI (Assistente Admin)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Provedor do Pilger AI</label>
                            <select
                                className="form-input"
                                value={configs['pilger_provider'] || ''}
                                onChange={e => setConfigs({ ...configs, pilger_provider: e.target.value })}
                            >
                                <option value="">Usar Padrão Global ({configs['ai_provider'] === 'openai' ? 'OpenAI' : 'Gemini'})</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Modelo do Pilger AI</label>
                            {(configs['pilger_provider'] === 'openai' || (!configs['pilger_provider'] && configs['ai_provider'] === 'openai')) ? (
                                <div style={{ position: 'relative' }}>
                                    <select className="form-input" value={configs['openai_pilger_model'] || ''} onChange={e => setConfigs({ ...configs, openai_pilger_model: e.target.value })}>
                                        <option value="">Selecione...</option>
                                        {openaiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <select className="form-input" value={configs['gemini_pilger_model'] || ''} onChange={e => setConfigs({ ...configs, gemini_pilger_model: e.target.value })}>
                                        <option value="">Selecione...</option>
                                        {geminiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Prompt do Sistema (Pilger AI)</label>
                        <textarea
                            className="form-textarea"
                            rows={10}
                            value={configs['pilger_ai_system_prompt'] || ''}
                            onChange={e => setConfigs({ ...configs, pilger_ai_system_prompt: e.target.value })}
                            placeholder={PILGER_AI_PROMPT}
                            style={{ fontFamily: 'monospace', fontSize: '0.85rem', borderColor: 'rgba(129, 140, 248, 0.3)' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Prompt principal do assistente administrativo. Deixe em branco para usar o padrão.
                        </div>
                    </div>
                </div>

                {/* ── 3. EXTRAÇÃO DE LEADS ── */}
                <div style={{ paddingBottom: '30px' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#34d399', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>🕵️</span> 3. Extração de Leads (Chat)
                    </h3>

                    <div className="form-group">
                        <label className="form-label">Prompt de Extração de Dados</label>
                        <textarea
                            className="form-textarea"
                            rows={6}
                            value={configs['lead_extraction_prompt'] || ''}
                            onChange={e => setConfigs({ ...configs, lead_extraction_prompt: e.target.value })}
                            placeholder={LEAD_EXTRACTION_PROMPT}
                            style={{ fontFamily: 'monospace', fontSize: '0.85rem', borderColor: 'rgba(52, 211, 153, 0.3)' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Controla como a IA identifica e extrai leads da conversa. Deixe em branco para usar o padrão (exibido acima como placeholder).
                        </div>
                    </div>
                </div>

                {/* ── 4. TRÁFEGO (GESTOR IA) ── */}
                <div style={{ paddingBottom: '30px', borderBottom: '1px dashed var(--border-color)', marginBottom: '40px' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#ec4899', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📈</span> 4. Gestor de Tráfego (Análise Autônoma)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Provedor do Gestor de Tráfego</label>
                            <select className="form-input" value={configs['ads_provider'] || ''} onChange={e => setConfigs({ ...configs, ads_provider: e.target.value })}>
                                <option value="">Usar Padrão Global</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Modelo do Gestor de Tráfego</label>
                            <select className="form-input" value={configs['gemini_ads_model'] || configs['openai_ads_model'] || ''} onChange={e => {
                                if (configs['ads_provider'] === 'openai') {
                                    setConfigs({ ...configs, openai_ads_model: e.target.value })
                                } else {
                                    setConfigs({ ...configs, gemini_ads_model: e.target.value })
                                }
                            }}>
                                <option value="">Selecione...</option>
                                {configs['ads_provider'] === 'openai' ? openaiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>) : geminiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Prompt do Sistema (Gestor de Tráfego)</label>
                        <textarea
                            className="form-textarea"
                            rows={8}
                            value={configs['ads_analyst_system_prompt'] || ''}
                            onChange={e => setConfigs({ ...configs, ads_analyst_system_prompt: e.target.value })}
                            placeholder={ADS_ANALYSIS_SYSTEM_PROMPT}
                            style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                        />
                    </div>
                </div>

                {/* ── 6. AGENDAMENTOS E RELATÓRIOS ── */}
                <div style={{ paddingBottom: '30px' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#8b5cf6', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>⏰</span> 5. Agendamento de Relatórios Pilger CEO
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Diário */}
                        <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Relatório Diário</div>
                            <div className="form-group">
                                <label className="form-label">Dias de Execução</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {[
                                        { v: '0', l: 'Dom' }, { v: '1', l: 'Seg' }, { v: '2', l: 'Ter' },
                                        { v: '3', l: 'Qua' }, { v: '4', l: 'Qui' }, { v: '5', l: 'Sex' }, { v: '6', l: 'Sáb' }
                                    ].map(day => {
                                        const currentDays = (configs['pilger_daily_days'] || '1,2,3,4,5').split(',');
                                        const isSelected = currentDays.includes(day.v);
                                        return (
                                            <label
                                                key={day.v}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem',
                                                    cursor: 'pointer', userSelect: 'none',
                                                    border: isSelected ? '1px solid var(--gold)' : '1px solid var(--border-color)',
                                                    background: isSelected ? 'rgba(201, 169, 110, 0.1)' : 'var(--bg-primary)',
                                                    color: isSelected ? 'var(--gold)' : 'var(--text-secondary)',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        let newDays = [...currentDays];
                                                        if (isSelected) {
                                                            newDays = newDays.filter(d => d !== day.v);
                                                        } else {
                                                            newDays.push(day.v);
                                                        }
                                                        setConfigs({ ...configs, pilger_daily_days: newDays.sort().join(',') });
                                                    }}
                                                    style={{ display: 'none' }}
                                                />
                                                {day.l}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Horário de Execução</label>
                                <select 
                                    className="form-input" 
                                    value={configs['pilger_daily_time'] || '23'} 
                                    onChange={e => setConfigs({ ...configs, pilger_daily_time: e.target.value })}
                                >
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Semanal */}
                        <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Diretriz Semanal</div>
                            <div className="form-group">
                                <label className="form-label">Dia da Semana</label>
                                <select 
                                    className="form-input" 
                                    value={configs['pilger_weekly_day'] || '1'} 
                                    onChange={e => setConfigs({ ...configs, pilger_weekly_day: e.target.value })}
                                >
                                    <option value="0">Domingo</option>
                                    <option value="1">Segunda-feira</option>
                                    <option value="2">Terça-feira</option>
                                    <option value="3">Quarta-feira</option>
                                    <option value="4">Quinta-feira</option>
                                    <option value="5">Sexta-feira</option>
                                    <option value="6">Sábado</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Horário de Execução</label>
                                <select 
                                    className="form-input" 
                                    value={configs['pilger_weekly_time'] || '8'} 
                                    onChange={e => setConfigs({ ...configs, pilger_weekly_time: e.target.value })}
                                >
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                        {/* Radar de Mercado */}
                        <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <TrendingUp size={18} style={{ color: 'var(--gold)' }} />
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Radar de Mercado</div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Horários de Coleta (Horas: 0-23, separados por vírgula)</label>
                                <input 
                                    type="text"
                                    className="form-input" 
                                    placeholder="Ex: 06,12,18"
                                    value={configs['radar_collection_times'] || '06,12,18'} 
                                    onChange={e => setConfigs({ ...configs, radar_collection_times: e.target.value })}
                                />
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '8px', lineHeight: '1.4' }}>
                                    Determine os horários (dia de São Paulo) para o rastreio automático. 
                                    Padrão recomendado: <b>06,12,18</b> para cobrir picos de interesse.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Prompts dos Relatórios */}
                    <div className="form-group" style={{ marginTop: '20px' }}>
                        <label className="form-label">Prompt do Relatório Diário</label>
                        <textarea className="form-textarea" rows={6} value={configs['pilger_daily_system_prompt'] || ''} onChange={e => setConfigs({ ...configs, pilger_daily_system_prompt: e.target.value })} placeholder={DAILY_REPORT_PROMPT} style={{ fontFamily: 'monospace', fontSize: '0.85rem' }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Prompt da Diretriz Semanal</label>
                        <textarea className="form-textarea" rows={6} value={configs['pilger_weekly_system_prompt'] || ''} onChange={e => setConfigs({ ...configs, pilger_weekly_system_prompt: e.target.value })} placeholder={WEEKLY_REPORT_PROMPT} style={{ fontFamily: 'monospace', fontSize: '0.85rem' }} />
                    </div>
                </div>
            </div>

            {/* Diagnostic Tools */}
            <div className="chart-card" style={{ marginTop: '24px' }}>
                <div className="chart-title" style={{ marginBottom: '12px' }}>🔬 Ferramentas de Diagnóstico</div>
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
            </div>

            {/* Info Card */}
            <div className="chart-card" style={{ marginTop: '24px' }}>
                <div className="chart-title">ℹ️ Sobre a Sala de Manutenção</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <p>As chaves de API configuradas aqui têm <strong>prioridade</strong> sobre as variáveis de ambiente do servidor (<code>.env</code>).</p>
                    <p style={{ marginTop: '8px' }}>
                        Se uma chave for removida daqui, o sistema automaticamente usará a variável de ambiente como fallback.
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
