'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Cpu, CheckCircle2, XCircle, AlertTriangle, MessageSquare, Hash, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ModelResult {
    name: string
    displayName: string
    description: string
    version: string
    inputTokenLimit: number
    outputTokenLimit: number
    supportedGenerationMethods: string[]
    testStatus: 'available' | 'error' | 'not_supported'
    testMessage: string
    isCurrentModel: boolean
}

interface DiagnosticSummary {
    total: number
    available: number
    errors: number
    notSupported: number
    currentModel: string
}

interface DiagnosticResponse {
    success: boolean
    message?: string
    summary: DiagnosticSummary | null
    models: ModelResult[]
}

export default function OpenAIDiagnosticPage() {
    const [data, setData] = useState<DiagnosticResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchDiagnostic = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/openai-diagnostic')
            const json = await res.json()
            if (!json.success) {
                setError(json.message || 'Erro ao carregar diagnóstico da OpenAI')
            }
            setData(json)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchDiagnostic()
    }, [fetchDiagnostic])

    const formatTokens = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
        if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
        return String(n)
    }

    const getStatusBadge = (status: string, isCurrentModel: boolean) => {
        if (isCurrentModel) {
            return (
                <span className="diag-badge diag-badge-current">
                    <MessageSquare size={12} /> Em Uso
                </span>
            )
        }
        switch (status) {
            case 'available':
                return (
                    <span className="diag-badge diag-badge-success">
                        <CheckCircle2 size={12} /> Disponível
                    </span>
                )
            case 'error':
                return (
                    <span className="diag-badge diag-badge-error">
                        <XCircle size={12} /> Erro
                    </span>
                )
            case 'not_supported':
                return (
                    <span className="diag-badge diag-badge-warn">
                        <AlertTriangle size={12} /> Sem suporte chat
                    </span>
                )
            default:
                return null
        }
    }

    // Usaremos a cor #10a37f para elementos focados na OpenAI, mas mantendo o estilo do painel.
    const primaryColor = '#10a37f'

    return (
        <div>
            <div className="admin-header">
                <div>
                    <Link
                        href="/admin/maintenance"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            textDecoration: 'none',
                            marginBottom: '8px',
                        }}
                    >
                        <ArrowLeft size={14} /> Voltar para Manutenção
                    </Link>
                    <h1>🔬 Diagnóstico OpenAI (ChatGPT)</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Modelos disponíveis (GPT-3.5, GPT-4, o1, etc) para a sua API Key configurada.
                    </p>
                </div>
                <div className="admin-header-actions">
                    <button
                        className="btn"
                        onClick={fetchDiagnostic}
                        disabled={loading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            backgroundColor: primaryColor, color: '#fff', border: 'none'
                        }}
                    >
                        <RefreshCw size={16} className={loading ? 'diag-spin' : ''} />
                        {loading ? 'Analisando...' : 'Reanalisar'}
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '80px 20px',
                    gap: '16px',
                }}>
                    <RefreshCw size={36} className="diag-spin" style={{ color: primaryColor }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Consultando API da OpenAI e testando as subversões do GPT...
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.6 }}>
                        Isso pode levar alguns segundos dependendo de quantos modelos estão ativados
                    </p>
                </div>
            )}

            {/* Error State */}
            {!loading && error && (
                <div className="chart-card" style={{
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    textAlign: 'center',
                    padding: '40px',
                }}>
                    <XCircle size={32} style={{ color: '#ef4444', marginBottom: '12px' }} />
                    <p style={{ color: '#ef4444', fontWeight: 600 }}>Erro ao carregar diagnóstico</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                        {error}
                    </p>
                </div>
            )}

            {/* Summary Cards */}
            {!loading && data?.summary && (
                <>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '16px',
                        marginBottom: '24px',
                    }}>
                        <div className="chart-card" style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: primaryColor }}>
                                {data.summary.total}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Total Testados
                            </div>
                        </div>
                        <div className="chart-card" style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#22c55e' }}>
                                {data.summary.available}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Aprovados
                            </div>
                        </div>
                        <div className="chart-card" style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>
                                {data.summary.errors}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Com Erro (Falha / Rate Limit)
                            </div>
                        </div>
                        <div className="chart-card" style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>
                                {data.summary.notSupported}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Pausados
                            </div>
                        </div>
                    </div>

                    {/* Current Model Info */}
                    <div className="chart-card" style={{
                        marginBottom: '24px',
                        background: 'linear-gradient(135deg, rgba(16, 163, 127, 0.08), rgba(16, 163, 127, 0.02))',
                        border: '1px solid rgba(16, 163, 127, 0.2)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <MessageSquare size={20} style={{ color: primaryColor }} />
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                    Modelo Padrão em Uso: <span style={{ color: primaryColor }}>{data.summary.currentModel}</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Este é o modelo da OpenAI (ChatGPT) usado pelo Chat Concierge se configurado para OpenAI.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Models List */}
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {data.models.map((model) => (
                            <div
                                key={model.name}
                                className="chart-card"
                                style={{
                                    border: model.isCurrentModel
                                        ? `1px solid rgba(16, 163, 127, 0.3)`
                                        : model.testStatus === 'available'
                                            ? '1px solid rgba(34, 197, 94, 0.15)'
                                            : model.testStatus === 'error'
                                                ? '1px solid rgba(239, 68, 68, 0.15)'
                                                : undefined,
                                    opacity: model.testStatus === 'not_supported' ? 0.6 : 1,
                                }}
                            >
                                {/* Model Header */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '12px',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '8px',
                                            background: model.isCurrentModel
                                                ? `linear-gradient(135deg, ${primaryColor}, #097358)`
                                                : model.testStatus === 'available'
                                                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                                                    : 'var(--bg-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: model.testStatus === 'available' || model.isCurrentModel ? '#000' : 'var(--text-muted)',
                                            flexShrink: 0,
                                        }}>
                                            <Cpu size={18} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                                {model.displayName}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                {model.name}
                                            </div>
                                        </div>
                                    </div>
                                    {getStatusBadge(model.testStatus, model.isCurrentModel)}
                                </div>

                                {/* Description */}
                                {model.description && (
                                    <p style={{
                                        fontSize: '0.82rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: 1.5,
                                        marginBottom: '14px',
                                    }}>
                                        {model.description}
                                    </p>
                                )}

                                {/* Token Limits + Methods */}
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '10px',
                                    alignItems: 'center',
                                }}>
                                    {/* Supported methods */}
                                    {model.supportedGenerationMethods.map((method) => (
                                        <span
                                            key={method}
                                            className={`diag-method diag-method-gen`}
                                            style={{ background: `rgba(16, 163, 127, 0.08)`, color: primaryColor, borderColor: `rgba(16, 163, 127, 0.2)` }}
                                        >
                                            {method}
                                        </span>
                                    ))}
                                </div>

                                {/* Error Message */}
                                {model.testStatus === 'error' && model.testMessage && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        border: '1px solid rgba(239, 68, 68, 0.15)',
                                        fontSize: '0.78rem',
                                        color: '#f87171',
                                        fontFamily: 'monospace',
                                        wordBreak: 'break-word',
                                    }}>
                                        {model.testMessage}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            <style>{`
                @keyframes diag-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .diag-spin {
                    animation: diag-spin 1s linear infinite;
                }
                .diag-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    white-space: nowrap;
                }
                .diag-badge-success {
                    background: rgba(34, 197, 94, 0.12);
                    color: #22c55e;
                    border: 1px solid rgba(34, 197, 94, 0.2);
                }
                .diag-badge-error {
                    background: rgba(239, 68, 68, 0.12);
                    color: #ef4444;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                }
                .diag-badge-warn {
                    background: rgba(245, 158, 11, 0.12);
                    color: #f59e0b;
                    border: 1px solid rgba(245, 158, 11, 0.2);
                }
                .diag-badge-current {
                    background: linear-gradient(135deg, rgba(16, 163, 127, 0.2), rgba(16, 163, 127, 0.1));
                    color: ${primaryColor};
                    border: 1px solid rgba(16, 163, 127, 0.3);
                }
                .diag-stat {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-size: 0.72rem;
                    color: var(--text-muted);
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                }
                .diag-method {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-family: monospace;
                    background: var(--bg-primary);
                    color: var(--text-muted);
                    border: 1px solid var(--border-color);
                }
            `}</style>
        </div>
    )
}
