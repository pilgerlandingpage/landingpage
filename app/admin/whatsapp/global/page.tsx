'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ClipboardList,
    Clock3,
    Database,
    ExternalLink,
    Filter,
    Loader2,
    MessageSquareText,
    RefreshCw,
    Route,
    Send,
    ShieldCheck,
    UserRound,
    XCircle,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

type GlobalCommand = {
    id: string
    session_id: string | null
    phone_masked: string
    identity_type: string
    identity_label: string
    command_type: string
    command_label: string
    target_agent: string
    target_label: string
    required_permission: string | null
    status: string
    command_text: string
    payload: Record<string, any>
    result: Record<string, any>
    created_at: string
    updated_at: string
    session: GlobalSession | null
}

type GlobalSession = {
    id: string
    phone_masked: string
    identity_type: string
    identity_label: string
    permission_keys: string[]
    message_count: number
    last_user_message: string
    last_assistant_message: string
    last_message_at: string
    messages: Array<{
        role: string
        content: string
        timestamp: string | null
        has_media: boolean
        command_type: string | null
    }>
}

type GlobalPayload = {
    success: boolean
    ready: boolean
    error?: string
    global_instance: {
        id: string
        instance_name: string
        status: string
        phone_masked: string
        instance_type: string
        connected_at: string | null
    } | null
    diagnostics: Record<string, any>
    identity_sources: Record<string, number>
    metrics: {
        total_commands: number
        received: number
        blocked: number
        queued: number
        processing: number
        completed: number
        failed: number
        cancelled: number
        open: number
        global_sessions: number
        global_overrides: number
        last_24h: number
    }
    recent_commands: GlobalCommand[]
    recent_sessions: GlobalSession[]
    options: {
        statuses: string[]
        targets: Array<{ value: string; label: string }>
    }
}

const statusLabels: Record<string, string> = {
    all: 'Todos',
    received: 'Recebido',
    blocked: 'Bloqueado',
    queued: 'Na fila',
    processing: 'Processando',
    completed: 'Concluido',
    failed: 'Falhou',
    cancelled: 'Cancelado',
}

const identityLabels: Record<string, string> = {
    admin_user: 'Admin',
    broker_user: 'Corretor',
    broker_authorized: 'Autorizado',
    property_owner: 'Proprietario',
    lead: 'Lead',
    blocked: 'Bloqueado',
}

function formatDateTime(value?: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function compact(value: unknown, max = 160) {
    const text = String(value || '').trim()
    return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function statusLabel(value?: string | null) {
    return statusLabels[String(value || '')] || String(value || '-')
}

function statusTone(value?: string | null) {
    const status = String(value || '')
    if (status === 'completed') return 'ok'
    if (status === 'failed' || status === 'blocked' || status === 'cancelled') return 'risk'
    if (status === 'processing' || status === 'queued') return 'warn'
    return 'neutral'
}

function identityLabel(value?: string | null) {
    return identityLabels[String(value || '')] || String(value || '-')
}

function JsonBlock({ value }: { value: unknown }) {
    const text = JSON.stringify(value || {}, null, 2)
    if (!text || text === '{}') return <span className="global-muted">Sem dados.</span>
    return <pre>{text}</pre>
}

function MetricCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number | string; hint: string }) {
    return (
        <article className="global-metric-card">
            <span>{icon}{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
        </article>
    )
}

export default function WhatsAppGlobalPage() {
    const [data, setData] = useState<GlobalPayload | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const [targetFilter, setTargetFilter] = useState('all')
    const [activeId, setActiveId] = useState<string | null>(null)
    const [updating, setUpdating] = useState<string | null>(null)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const commands = data?.recent_commands || []
    const activeCommand = useMemo(() => {
        if (!commands.length) return null
        return commands.find(command => command.id === activeId) || commands[0]
    }, [commands, activeId])

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true)
        setRefreshing(silent)
        setError(null)
        try {
            const params = new URLSearchParams()
            params.set('limit', '120')
            params.set('status', statusFilter)
            params.set('target', targetFilter)
            const response = await fetch(`/api/admin/whatsapp/global?${params.toString()}`, { cache: 'no-store' })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Nao foi possivel carregar o WhatsApp Global.')
            setData(payload)
            setActiveId(current => current || payload.recent_commands?.[0]?.id || null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido.')
        } finally {
            if (!silent) setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        loadData(false)
    }, [statusFilter, targetFilter])

    const updateStatus = async (commandId: string, status: string) => {
        setUpdating(`${commandId}:${status}`)
        setToast(null)
        try {
            const response = await fetch('/api/admin/whatsapp/global', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command_id: commandId, status }),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Falha ao atualizar status.')
            setToast({ type: 'success', text: `Comando marcado como ${statusLabel(status).toLowerCase()}.` })
            await loadData(true)
        } catch (err) {
            setToast({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao atualizar status.' })
        } finally {
            setUpdating(null)
        }
    }

    const processWithVitor = async (commandId: string) => {
        setUpdating(`${commandId}:process_vitor`)
        setToast(null)
        try {
            const response = await fetch('/api/admin/whatsapp/global', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command_id: commandId, action: 'process_vitor' }),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Falha ao processar com o Vitor.')
            const vitor = payload.vitor || {}
            const detail = vitor.score ? ` Score: ${vitor.score}/100.` : ''
            setToast({ type: 'success', text: `Comando processado pelo Vitor.${detail}` })
            await loadData(true)
        } catch (err) {
            setToast({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao processar com o Vitor.' })
        } finally {
            setUpdating(null)
        }
    }

    const copyCommand = (text: string) => {
        if (!text || typeof navigator === 'undefined') return
        void navigator.clipboard.writeText(text)
        setToast({ type: 'success', text: 'Texto copiado.' })
    }

    const canProcessActiveCommand = Boolean(
        activeCommand
        && activeCommand.target_agent === 'ads-analyst'
        && activeCommand.command_type.startsWith('paid_traffic')
        && !['blocked', 'cancelled', 'processing', 'completed'].includes(activeCommand.status),
    )

    if (loading) return <AdminLoadingState message="Carregando WhatsApp Global..." />

    return (
        <div className="admin-dashboard whatsapp-global-page">
            {toast && (
                <div className={`global-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                    {toast.text}
                </div>
            )}

            <div className="admin-header global-header">
                <div>
                    <Link href="/admin/whatsapp" className="back-link">
                        <ArrowLeft size={18} /> WhatsApp
                    </Link>
                    <h1>WhatsApp Global</h1>
                    <p>Fila operacional de comandos, conversas internas e roteamento por perfil.</p>
                </div>
                <div className="global-header-actions">
                    <Link href="/admin/pilger-ai/agentes?agent=whatsapp-global-agent&setor=Diretoria" className="btn btn-outline">
                        <ShieldCheck size={16} /> Agente
                    </Link>
                    <Link href="/admin/ads/vitor" className="btn btn-outline">
                        <ExternalLink size={16} /> Vitor
                    </Link>
                    <button type="button" className="btn btn-gold" onClick={() => loadData(true)} disabled={refreshing}>
                        {refreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Atualizar
                    </button>
                </div>
            </div>

            {error && (
                <section className="chart-card global-alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                </section>
            )}

            {!data?.ready && (
                <section className="chart-card global-alert warn">
                    <Database size={18} />
                    <span>Banco do WhatsApp Global ainda nao respondeu completamente. Confira migrations e permissoes.</span>
                </section>
            )}

            <section className="global-instance-strip">
                <div className="chart-card global-instance-card">
                    <span><ShieldCheck size={16} /> Instancia Global</span>
                    <strong>{data?.global_instance?.instance_name || 'Nao localizada'}</strong>
                    <small>{data?.global_instance?.status || 'sem status'} {data?.global_instance?.phone_masked ? `| ${data.global_instance.phone_masked}` : ''}</small>
                </div>
                <div className="chart-card global-identity-card">
                    <span><UserRound size={16} /> Identidades reconhecidas</span>
                    <div className="global-identity-grid">
                        <strong>{data?.identity_sources.admin_users_with_phone || 0}<small>admins</small></strong>
                        <strong>{data?.identity_sources.virtual_brokers_with_phone || 0}<small>corretores</small></strong>
                        <strong>{data?.identity_sources.broker_authorized_phones || 0}<small>autorizados</small></strong>
                        <strong>{(data?.identity_sources.property_owner_legacy_phones || 0) + (data?.identity_sources.property_owner_private_phones || 0)}<small>proprietarios</small></strong>
                    </div>
                </div>
            </section>

            <section className="global-metrics-grid">
                <MetricCard icon={<ClipboardList size={16} />} label="Comandos" value={data?.metrics.total_commands || 0} hint={`${data?.metrics.last_24h || 0} nas ultimas 24h`} />
                <MetricCard icon={<Clock3 size={16} />} label="Abertos" value={data?.metrics.open || 0} hint={`${data?.metrics.processing || 0} em processamento`} />
                <MetricCard icon={<MessageSquareText size={16} />} label="Sessoes" value={data?.metrics.global_sessions || 0} hint="Conversas registradas" />
                <MetricCard icon={<CheckCircle2 size={16} />} label="Concluidos" value={data?.metrics.completed || 0} hint={`${data?.metrics.failed || 0} falha(s)`} />
            </section>

            <section className="chart-card global-toolbar">
                <div>
                    <Filter size={16} />
                    <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                        <option value="all">Todos os status</option>
                        {(data?.options.statuses || []).map(status => (
                            <option key={status} value={status}>{statusLabel(status)}</option>
                        ))}
                    </select>
                    <select value={targetFilter} onChange={event => setTargetFilter(event.target.value)}>
                        <option value="all">Todos os destinos</option>
                        {(data?.options.targets || []).map(target => (
                            <option key={target.value} value={target.value}>{target.label}</option>
                        ))}
                    </select>
                </div>
                <span>{commands.length} item(ns) na visao atual</span>
            </section>

            <div className="global-layout">
                <section className="chart-card global-command-list">
                    <div className="global-section-title">
                        <span>Fila de comandos</span>
                        <strong>{commands.length}</strong>
                    </div>
                    <div className="global-list-scroll">
                        {commands.map(command => (
                            <button
                                key={command.id}
                                type="button"
                                className={`global-command-item ${activeCommand?.id === command.id ? 'active' : ''}`}
                                onClick={() => setActiveId(command.id)}
                            >
                                <div className={`global-status-dot ${statusTone(command.status)}`} />
                                <div>
                                    <strong>{command.identity_label || command.phone_masked}</strong>
                                    <p>{compact(command.command_text || command.session?.last_user_message || command.command_label, 140)}</p>
                                    <span>{command.command_label} | {command.target_label} | {formatDateTime(command.created_at)}</span>
                                </div>
                                <em className={statusTone(command.status)}>{statusLabel(command.status)}</em>
                            </button>
                        ))}
                        {commands.length === 0 && (
                            <div className="global-empty">
                                <MessageSquareText size={28} />
                                <span>Nenhum comando neste filtro.</span>
                            </div>
                        )}
                    </div>
                </section>

                <main className="global-detail">
                    {!activeCommand ? (
                        <section className="chart-card global-empty-detail">
                            <Route size={32} />
                            <h2>Aguardando comandos</h2>
                            <p>Quando o WhatsApp Global receber mensagens internas ou ordens operacionais, elas aparecem aqui.</p>
                        </section>
                    ) : (
                        <>
                            <section className="chart-card global-detail-hero">
                                <div className={`global-hero-status ${statusTone(activeCommand.status)}`}>
                                    <span>Status</span>
                                    <strong>{statusLabel(activeCommand.status)}</strong>
                                </div>
                                <div className="global-detail-main">
                                    <div className="global-chips">
                                        <span>{identityLabel(activeCommand.identity_type)}</span>
                                        <span>{activeCommand.command_label}</span>
                                        <span>{activeCommand.target_label}</span>
                                    </div>
                                    <h2>{activeCommand.identity_label || activeCommand.phone_masked}</h2>
                                    <p>{activeCommand.command_text || activeCommand.session?.last_user_message || 'Sem texto registrado.'}</p>
                                    <div className="global-action-row">
                                        {canProcessActiveCommand && (
                                            <button
                                                type="button"
                                                className="btn btn-gold"
                                                onClick={() => processWithVitor(activeCommand.id)}
                                                disabled={Boolean(updating)}
                                            >
                                                {updating === `${activeCommand.id}:process_vitor` ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                                                Processar Vitor
                                            </button>
                                        )}
                                        {['queued', 'processing', 'completed', 'failed', 'cancelled'].map(status => (
                                            <button
                                                key={status}
                                                type="button"
                                                className={`btn ${status === 'completed' ? 'btn-gold' : 'btn-outline'} ${status === 'failed' || status === 'cancelled' ? 'danger' : ''}`}
                                                onClick={() => updateStatus(activeCommand.id, status)}
                                                disabled={Boolean(updating)}
                                            >
                                                {updating === `${activeCommand.id}:${status}` ? <Loader2 size={15} className="spin" /> : status === 'completed' ? <CheckCircle2 size={15} /> : status === 'failed' || status === 'cancelled' ? <XCircle size={15} /> : <Clock3 size={15} />}
                                                {statusLabel(status)}
                                            </button>
                                        ))}
                                        <button type="button" className="btn btn-outline" onClick={() => copyCommand(activeCommand.command_text)}>
                                            <ClipboardList size={15} /> Copiar
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <section className="global-info-grid">
                                <article className="chart-card global-info-card">
                                    <span>Origem</span>
                                    <strong>{activeCommand.phone_masked}</strong>
                                    <p>{identityLabel(activeCommand.identity_type)} | Permissao: {activeCommand.required_permission || 'sem exigencia'}</p>
                                </article>
                                <article className="chart-card global-info-card">
                                    <span>Destino</span>
                                    <strong>{activeCommand.target_label}</strong>
                                    <p>{activeCommand.command_type} | {formatDateTime(activeCommand.created_at)}</p>
                                </article>
                                <article className="chart-card global-info-card">
                                    <span>Sessao</span>
                                    <strong>{activeCommand.session?.message_count || 0} mensagens</strong>
                                    <p>{activeCommand.session_id || 'sem sessao vinculada'}</p>
                                </article>
                            </section>

                            <section className="global-bottom-grid">
                                <article className="chart-card global-history-card">
                                    <div className="global-section-title">
                                        <span>Historico da sessao</span>
                                        <strong>{activeCommand.session?.message_count || 0}</strong>
                                    </div>
                                    <div className="global-message-list">
                                        {(activeCommand.session?.messages || []).map((message, index) => (
                                            <div key={`${message.timestamp || index}-${index}`} className={`global-message ${message.role === 'assistant' ? 'assistant' : 'user'}`}>
                                                <span>{message.role === 'assistant' ? 'Global' : 'Contato'} {message.has_media ? '| midia' : ''}</span>
                                                <p>{message.content}</p>
                                                <small>{formatDateTime(message.timestamp)}</small>
                                            </div>
                                        ))}
                                        {!activeCommand.session?.messages?.length && (
                                            <span className="global-muted">Sem historico carregado para esta sessao.</span>
                                        )}
                                    </div>
                                </article>

                                <article className="chart-card global-json-card">
                                    <div className="global-section-title">
                                        <span>Dados operacionais</span>
                                        <strong>JSON</strong>
                                    </div>
                                    <h3>Payload</h3>
                                    <JsonBlock value={activeCommand.payload} />
                                    <h3>Resultado</h3>
                                    <JsonBlock value={activeCommand.result} />
                                </article>
                            </section>
                        </>
                    )}
                </main>
            </div>

            <style jsx global>{`
                .global-header,
                .global-header-actions,
                .global-action-row,
                .global-toolbar,
                .global-toolbar > div,
                .global-chips {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .global-header {
                    justify-content: space-between;
                }

                .global-instance-strip,
                .global-metrics-grid,
                .global-info-grid,
                .global-bottom-grid {
                    display: grid;
                    gap: 14px;
                }

                .global-instance-strip {
                    grid-template-columns: minmax(280px, .8fr) minmax(0, 1.2fr);
                    margin-bottom: 16px;
                }

                .global-metrics-grid {
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    margin-bottom: 16px;
                }

                .global-info-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }

                .global-bottom-grid {
                    grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr);
                }

                .global-instance-card,
                .global-identity-card,
                .global-metric-card,
                .global-info-card {
                    padding: 16px;
                }

                .global-instance-card > span,
                .global-identity-card > span,
                .global-metric-card > span,
                .global-info-card > span {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    color: var(--text-muted);
                    font-size: .7rem;
                    font-weight: 900;
                    letter-spacing: .08em;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                }

                .global-instance-card svg,
                .global-identity-card svg,
                .global-metric-card svg {
                    color: var(--gold);
                }

                .global-instance-card strong,
                .global-info-card strong {
                    display: block;
                    color: var(--text-primary);
                    font-size: 1.08rem;
                    margin-bottom: 5px;
                }

                .global-instance-card small,
                .global-info-card p,
                .global-metric-card small,
                .global-toolbar > span,
                .global-muted {
                    color: var(--text-muted);
                    font-size: .78rem;
                    line-height: 1.4;
                }

                .global-identity-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 8px;
                }

                .global-identity-grid strong {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 10px;
                    background: rgba(255,255,255,.72);
                    color: var(--text-primary);
                    display: grid;
                    gap: 3px;
                    padding: 10px;
                }

                .global-identity-grid small {
                    color: var(--text-muted);
                    font-size: .66rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                .global-metric-card {
                    border: 1px solid var(--border-color);
                    border-radius: 10px;
                    background: #fff;
                    min-height: 126px;
                    display: grid;
                    gap: 6px;
                }

                .global-metric-card strong {
                    color: var(--text-primary);
                    font-size: 2rem;
                    line-height: 1;
                }

                .global-alert {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border-color: rgba(185, 28, 28, .24);
                    color: #b91c1c;
                    font-weight: 800;
                    margin-bottom: 16px;
                    padding: 13px 16px;
                }

                .global-alert.warn {
                    border-color: rgba(180, 83, 9, .24);
                    color: #92400e;
                }

                .global-toolbar {
                    justify-content: space-between;
                    margin-bottom: 16px;
                    padding: 12px 14px;
                }

                .global-toolbar select {
                    border: 1px solid var(--border-color);
                    border-radius: 10px;
                    background: #fff;
                    color: var(--text-primary);
                    font: inherit;
                    font-size: .82rem;
                    padding: 9px 10px;
                    outline: none;
                }

                .global-layout {
                    display: grid;
                    grid-template-columns: minmax(320px, .88fr) minmax(0, 1.55fr);
                    gap: 16px;
                    align-items: start;
                }

                .global-command-list {
                    padding: 14px;
                    position: sticky;
                    top: 86px;
                }

                .global-section-title {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-bottom: 12px;
                }

                .global-section-title span {
                    color: var(--text-primary);
                    font-size: .9rem;
                    font-weight: 900;
                }

                .global-section-title strong {
                    color: var(--gold);
                    font-size: .8rem;
                }

                .global-list-scroll {
                    display: grid;
                    gap: 9px;
                    max-height: 760px;
                    overflow: auto;
                    padding-right: 4px;
                }

                .global-command-item {
                    width: 100%;
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 10px;
                    background: #fff;
                    display: grid;
                    grid-template-columns: 10px minmax(0, 1fr) auto;
                    gap: 10px;
                    align-items: start;
                    padding: 11px;
                    text-align: left;
                    cursor: pointer;
                }

                .global-command-item.active {
                    border-color: rgba(201, 169, 110, .62);
                    box-shadow: 0 0 0 3px rgba(201, 169, 110, .12);
                }

                .global-command-item strong {
                    display: block;
                    color: var(--text-primary);
                    font-size: .86rem;
                    margin-bottom: 4px;
                }

                .global-command-item p {
                    color: var(--text-muted);
                    font-size: .78rem;
                    line-height: 1.35;
                    margin: 0 0 5px;
                }

                .global-command-item span {
                    color: var(--text-muted);
                    font-size: .68rem;
                    font-weight: 800;
                }

                .global-command-item em {
                    border-radius: 999px;
                    font-size: .64rem;
                    font-style: normal;
                    font-weight: 900;
                    padding: 5px 7px;
                    text-transform: uppercase;
                }

                .global-status-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    margin-top: 5px;
                }

                .global-status-dot.ok,
                .global-command-item em.ok,
                .global-hero-status.ok {
                    background: #047857;
                    color: #fff;
                }

                .global-status-dot.warn,
                .global-command-item em.warn,
                .global-hero-status.warn {
                    background: #b45309;
                    color: #fff;
                }

                .global-status-dot.risk,
                .global-command-item em.risk,
                .global-hero-status.risk {
                    background: #b91c1c;
                    color: #fff;
                }

                .global-status-dot.neutral,
                .global-command-item em.neutral,
                .global-hero-status.neutral {
                    background: rgba(201, 169, 110, .16);
                    color: #92400e;
                }

                .global-detail {
                    display: grid;
                    gap: 16px;
                    min-width: 0;
                }

                .global-detail-hero {
                    display: grid;
                    grid-template-columns: 132px minmax(0, 1fr);
                    gap: 16px;
                    padding: 16px;
                }

                .global-hero-status {
                    border-radius: 12px;
                    display: grid;
                    place-items: center;
                    align-content: center;
                    min-height: 132px;
                    padding: 12px;
                    text-align: center;
                }

                .global-hero-status span {
                    font-size: .68rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .global-hero-status strong {
                    font-size: 1rem;
                }

                .global-detail-main h2 {
                    color: var(--text-primary);
                    font-size: 1.4rem;
                    line-height: 1.16;
                    margin: 0 0 8px;
                }

                .global-detail-main p {
                    color: var(--text-muted);
                    font-size: .88rem;
                    line-height: 1.48;
                    margin: 0 0 14px;
                    overflow-wrap: anywhere;
                }

                .global-chips span {
                    border: 1px solid rgba(201, 169, 110, .28);
                    border-radius: 999px;
                    background: rgba(201, 169, 110, .1);
                    color: #92400e;
                    padding: 4px 8px;
                    font-size: .66rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .global-action-row .btn.danger {
                    border-color: rgba(185, 28, 28, .28);
                    color: #b91c1c;
                }

                .global-history-card,
                .global-json-card {
                    padding: 16px;
                }

                .global-message-list {
                    display: grid;
                    gap: 9px;
                }

                .global-message {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 10px;
                    padding: 10px;
                    background: rgba(255,255,255,.72);
                }

                .global-message.assistant {
                    border-color: rgba(201, 169, 110, .28);
                    background: rgba(201, 169, 110, .08);
                }

                .global-message span,
                .global-message small {
                    color: var(--text-muted);
                    font-size: .68rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .global-message p {
                    color: var(--text-primary);
                    font-size: .82rem;
                    line-height: 1.42;
                    margin: 5px 0;
                    overflow-wrap: anywhere;
                }

                .global-json-card h3 {
                    color: var(--text-primary);
                    font-size: .82rem;
                    margin: 14px 0 8px;
                }

                .global-json-card pre {
                    max-height: 280px;
                    overflow: auto;
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 10px;
                    background: #111827;
                    color: #e5e7eb;
                    font-size: .72rem;
                    line-height: 1.45;
                    margin: 0;
                    padding: 12px;
                }

                .global-empty,
                .global-empty-detail {
                    border: 1px dashed var(--border-color);
                    border-radius: 12px;
                    color: var(--text-muted);
                    display: grid;
                    gap: 10px;
                    justify-items: center;
                    padding: 28px;
                    text-align: center;
                }

                .global-empty svg,
                .global-empty-detail svg {
                    color: var(--gold);
                }

                .global-empty-detail h2 {
                    color: var(--text-primary);
                    margin: 0;
                }

                .global-empty-detail p {
                    margin: 0;
                    max-width: 520px;
                }

                .global-toast {
                    position: fixed;
                    right: 24px;
                    top: 24px;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border-radius: 12px;
                    padding: 13px 18px;
                    font-weight: 800;
                    box-shadow: 0 8px 30px rgba(0,0,0,.18);
                }

                .global-toast.success {
                    border: 1px solid rgba(34, 197, 94, .28);
                    background: rgba(34, 197, 94, .12);
                    color: #047857;
                }

                .global-toast.error {
                    border: 1px solid rgba(239, 68, 68, .28);
                    background: rgba(239, 68, 68, .1);
                    color: #b91c1c;
                }

                .spin {
                    animation: global-spin 1s linear infinite;
                }

                @keyframes global-spin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 1180px) {
                    .global-metrics-grid,
                    .global-info-grid,
                    .global-bottom-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .global-layout,
                    .global-instance-strip {
                        grid-template-columns: 1fr;
                    }

                    .global-command-list {
                        position: static;
                    }
                }

                @media (max-width: 760px) {
                    .global-metrics-grid,
                    .global-info-grid,
                    .global-bottom-grid,
                    .global-detail-hero,
                    .global-identity-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}
