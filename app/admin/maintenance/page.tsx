'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, Eye, EyeOff, Wifi, WifiOff, MessageSquare, Brain, Bell, RefreshCw, Microscope } from 'lucide-react'
import Link from 'next/link'

interface IntegrationCard {
    id: string
    title: string
    description: string
    icon: 'whatsapp' | 'gemini' | 'vapid'
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
            { key: 'connectyhub_api_url', label: 'API URL', placeholder: 'https://api.connectyhub.com', isSecret: false },
            { key: 'connectyhub_api_key', label: 'API Key', placeholder: 'Sua API Key', isSecret: true },
            { key: 'connectyhub_instance', label: 'Instance', placeholder: 'ID da instância', isSecret: false },
        ],
    },
    {
        id: 'gemini',
        title: 'Gemini AI — Google',
        description: 'API de inteligência artificial para chat, extração de dados e resumo de leads.',
        icon: 'gemini',
        fields: [
            { key: 'gemini_api_key', label: 'API Key', placeholder: 'AIzaSy...', isSecret: true },
            { key: 'gemini_model', label: 'Modelo', placeholder: 'Selecione o modelo', isSecret: false, type: 'select' },
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
    const [loadingModels, setLoadingModels] = useState(false)

    useEffect(() => {
        const apiKey = configs['gemini_api_key']
        if (!apiKey) return

        const fetchModels = async () => {
            setLoadingModels(true)
            try {
                const res = await fetch('/api/admin/gemini-models', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey }),
                })
                const data = await res.json()
                if (data.success) {
                    setGeminiModels(data.models)
                    // Auto-select first model if none selected
                    if (!configs['gemini_model'] && data.models.length > 0) {
                        setConfigs(prev => ({ ...prev, gemini_model: data.models[0].name }))
                    }
                }
            } catch (error) {
                console.error('Failed to fetch models', error)
            } finally {
                setLoadingModels(false)
            }
        }

        const timer = setTimeout(fetchModels, 1000)
        return () => clearTimeout(timer)
    }, [configs['gemini_api_key']])

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
            const allKeys = INTEGRATIONS.flatMap(i => i.fields.map(f => f.key))
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
            case 'vapid': return <Bell size={22} />
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
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    className="form-input"
                                                    value={configs[field.key] || ''}
                                                    onChange={e => setConfigs({ ...configs, [field.key]: e.target.value })}
                                                    style={{
                                                        appearance: 'none',
                                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                                                        backgroundRepeat: 'no-repeat',
                                                        backgroundPosition: 'right 12px center',
                                                        paddingRight: '32px',
                                                    }}
                                                >
                                                    <option value="">Selecione um modelo...</option>
                                                    {geminiModels.map(model => (
                                                        <option key={model.id} value={model.id}>
                                                            {model.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {loadingModels && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        right: '30px',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                    }}>
                                                        <RefreshCw size={14} className="spin" style={{ color: 'var(--text-muted)' }} />
                                                    </div>
                                                )}
                                            </div>
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
                        <strong>Chaves de infraestrutura</strong> (Supabase, R2, Inngest) são gerenciadas apenas via variáveis de ambiente por segurança.
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
        </div>
    )
}
