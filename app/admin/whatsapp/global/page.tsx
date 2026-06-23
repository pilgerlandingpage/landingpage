'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
    AlertTriangle,
    Bot,
    CheckCircle2,
    Database,
    Globe2,
    Loader2,
    MessageSquare,
    QrCode,
    RefreshCw,
    ShieldCheck,
    Smartphone,
    Users,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

type GlobalInstance = {
    id: string
    instance_name: string
    status: string
    phone_number?: string | null
    phone_masked?: string | null
    instance_type?: string | null
    connected_at?: string | null
    updated_at?: string | null
}

type GlobalCommand = {
    id: string
    phone_masked?: string
    identity_type: string
    identity_label?: string | null
    command_type: string
    target_agent: string
    required_permission?: string | null
    status: string
    command_text?: string | null
    created_at?: string | null
}

type GlobalPayload = {
    success: boolean
    global_instance?: GlobalInstance | null
    migration_ready?: boolean
    diagnostics?: Record<string, any>
    identity_sources?: Record<string, number>
    metrics?: Record<string, number>
    recent_commands?: GlobalCommand[]
    error?: string
}

function statusLabel(status?: string | null) {
    if (status === 'connected') return 'Conectado'
    if (status === 'connecting') return 'Conectando'
    return 'Desconectado'
}

function statusColor(status?: string | null) {
    if (status === 'connected') return '#16a34a'
    if (status === 'connecting') return '#ca8a04'
    return '#dc2626'
}

function identityLabel(type: string) {
    const map: Record<string, string> = {
        admin_user: 'Admin',
        broker_user: 'Corretor',
        property_owner: 'Proprietario',
        broker_authorized: 'Autorizado',
        lead: 'Lead',
        blocked: 'Bloqueado',
    }
    return map[type] || type
}

function formatDate(value?: string | null) {
    if (!value) return 'Sem registro'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Sem registro'
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function WhatsAppGlobalPage() {
    const [payload, setPayload] = useState<GlobalPayload | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [qrInstanceId, setQrInstanceId] = useState<string | null>(null)
    const [connecting, setConnecting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const globalInstance = payload?.global_instance || null
    const identitySources = payload?.identity_sources || {}
    const recentCommands = payload?.recent_commands || []

    const loadData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true)
        setRefreshing(silent)
        setMessage(null)
        try {
            const res = await fetch('/api/admin/whatsapp/global', { cache: 'no-store' })
            const data = await res.json()
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Falha ao carregar WhatsApp Global.')
            setPayload(data)
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar WhatsApp Global.' })
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    async function connectGlobal() {
        setConnecting(true)
        setMessage(null)
        setQrCode(null)
        try {
            const body = globalInstance?.id
                ? { instanceId: globalInstance.id, instance_type: 'global' }
                : { instance_name: 'Agente global', instance_type: 'global' }
            const res = await fetch('/api/admin/whatsapp/qrcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok || !data?.success) throw new Error(data?.message || 'Falha ao gerar QR Code do Global.')
            setQrCode(data.qrcode || null)
            setQrInstanceId(data.instanceId || globalInstance?.id || null)
            setMessage({ type: 'success', text: data.qrcode ? 'QR Code gerado. Escaneie no WhatsApp principal da empresa.' : 'Instância global preparada.' })
            await loadData(true)
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao conectar WhatsApp Global.' })
        } finally {
            setConnecting(false)
        }
    }

    const checkQrStatus = useCallback(async () => {
        if (!qrInstanceId) return
        try {
            const res = await fetch(`/api/admin/whatsapp/status?instanceId=${qrInstanceId}`, { cache: 'no-store' })
            const data = await res.json()
            if (data?.status === 'connected') {
                setQrCode(null)
                setQrInstanceId(null)
                setMessage({ type: 'success', text: 'WhatsApp Global conectado.' })
                await loadData(true)
            }
        } catch {
            // polling resiliente
        }
    }, [loadData, qrInstanceId])

    useEffect(() => {
        void loadData()
    }, [loadData])

    useEffect(() => {
        if (!qrCode || !qrInstanceId) return
        const interval = setInterval(() => void checkQrStatus(), 4000)
        return () => clearInterval(interval)
    }, [checkQrStatus, qrCode, qrInstanceId])

    if (loading) return <AdminLoadingState message="Carregando WhatsApp Global..." minHeight="400px" />

    return (
        <div className="whatsapp-global-page">
            <header className="wg-header">
                <div>
                    <span className="wg-eyebrow"><Globe2 size={15} /> WhatsApp Global</span>
                    <h1>Porta central da empresa</h1>
                    <p>Identifica admins, corretores, proprietários e leads antes de acionar os agentes do ecossistema.</p>
                </div>
                <div className="wg-actions">
                    <button type="button" onClick={() => void loadData(true)} disabled={refreshing}>
                        {refreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                        Atualizar
                    </button>
                    <button type="button" className="primary" onClick={connectGlobal} disabled={connecting}>
                        {connecting ? <Loader2 size={16} className="spin" /> : <QrCode size={16} />}
                        {globalInstance ? 'Reconectar Global' : 'Conectar Global'}
                    </button>
                </div>
            </header>

            {message && (
                <div className={`wg-alert ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    {message.text}
                </div>
            )}

            {!payload?.migration_ready && (
                <div className="wg-alert warning">
                    <AlertTriangle size={16} />
                    A página já está preparada, mas a migration do WhatsApp Global ainda precisa estar aplicada no banco para gravar sessões e comandos.
                </div>
            )}

            <section className="wg-grid">
                <article className="wg-panel status">
                    <span>Status da instância</span>
                    <strong>{globalInstance?.instance_name || 'Agente global'}</strong>
                    <div className="wg-status-row">
                        <span style={{ background: statusColor(globalInstance?.status) }} />
                        {statusLabel(globalInstance?.status)}
                    </div>
                    <small>{globalInstance?.phone_masked ? `Número: ${globalInstance.phone_masked}` : 'Número ainda não sincronizado'}</small>
                    <small>Atualizado: {formatDate(globalInstance?.updated_at)}</small>
                </article>

                <MetricCard icon={<Users size={18} />} label="Usuários internos" value={identitySources.admin_users_with_phone || 0} hint="admin_users.phone ativo" />
                <MetricCard icon={<ShieldCheck size={18} />} label="Autorizados broker" value={identitySources.broker_authorized_phones || 0} hint="concierge por corretor" />
                <MetricCard icon={<Smartphone size={18} />} label="Proprietários" value={(identitySources.property_owner_legacy_phones || 0) + (identitySources.property_owner_private_phones || 0)} hint="cadastro de imóveis" />
                <MetricCard icon={<Database size={18} />} label="Sessões globais" value={payload?.metrics?.global_sessions || 0} hint="histórico administrativo" />
            </section>

            {qrCode && (
                <section className="wg-qr">
                    <div>
                        <span>QR Code ativo</span>
                        <strong>Escaneie com o WhatsApp principal da empresa</strong>
                        <small>Depois de conectar, esta tela atualiza automaticamente.</small>
                    </div>
                    <div className="wg-qr-box">
                        <img src={qrCode} alt="QR Code WhatsApp Global" />
                    </div>
                </section>
            )}

            <section className="wg-panel">
                <div className="wg-section-head">
                    <div>
                        <span>Roteamento inicial</span>
                        <strong>Como o Global decide quem está falando</strong>
                    </div>
                    <Bot size={18} />
                </div>
                <div className="wg-flow">
                    <FlowStep title="1. Usuário interno" text="Consulta admin_users.phone e aplica as permissões reais do painel." />
                    <FlowStep title="2. Concierge autorizado" text="Reaproveita broker_assistant_authorized_phones quando existir." />
                    <FlowStep title="3. Proprietário" text="Cruza properties.owner_phone e property_private_details.owner_phones." />
                    <FlowStep title="4. Lead" text="Quem não estiver nas bases internas segue para o atendimento comercial normal." />
                </div>
            </section>

            <section className="wg-panel">
                <div className="wg-section-head">
                    <div>
                        <span>Últimos comandos</span>
                        <strong>Entradas administrativas capturadas pelo Global</strong>
                    </div>
                    <MessageSquare size={18} />
                </div>
                {recentCommands.length === 0 ? (
                    <div className="wg-empty">Nenhum comando global registrado ainda.</div>
                ) : (
                    <div className="wg-command-list">
                        {recentCommands.map(command => (
                            <div className="wg-command" key={command.id}>
                                <div>
                                    <strong>{command.identity_label || command.phone_masked || 'Contato'}</strong>
                                    <span>{identityLabel(command.identity_type)} • {command.command_type} • {command.target_agent}</span>
                                </div>
                                <p>{command.command_text || 'Sem texto capturado.'}</p>
                                <small>{command.status} • {formatDate(command.created_at)}</small>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <style jsx>{`
                .whatsapp-global-page { display: grid; gap: 18px; }
                .wg-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
                .wg-eyebrow { display: inline-flex; align-items: center; gap: 7px; color: var(--gold); font-size: 0.78rem; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
                .wg-header h1 { margin: 6px 0 4px; font-size: 1.6rem; line-height: 1.1; }
                .wg-header p { color: var(--text-muted); margin: 0; font-size: 0.92rem; max-width: 760px; }
                .wg-actions { display: flex; gap: 8px; flex-wrap: wrap; }
                .wg-actions button { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); border-radius: 8px; padding: 10px 13px; font-weight: 800; cursor: pointer; }
                .wg-actions button.primary { background: var(--gold); border-color: var(--gold); color: #111; }
                .wg-actions button:disabled { opacity: 0.65; cursor: wait; }
                .wg-alert { display: flex; align-items: center; gap: 8px; border-radius: 8px; padding: 11px 13px; font-weight: 700; font-size: 0.86rem; }
                .wg-alert.success { background: #ecfdf3; color: #15803d; border: 1px solid #bbf7d0; }
                .wg-alert.error, .wg-alert.warning { background: #fff7ed; color: #b45309; border: 1px solid #fed7aa; }
                .wg-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
                .wg-panel, .wg-card, .wg-qr { border: 1px solid var(--border); background: var(--bg-secondary); border-radius: 8px; padding: 15px; }
                .wg-panel.status { display: grid; gap: 6px; }
                .wg-panel span, .wg-card span, .wg-qr span, .wg-section-head span { color: var(--text-muted); font-size: 0.74rem; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; }
                .wg-panel strong, .wg-card strong, .wg-qr strong, .wg-section-head strong { color: var(--text-primary); font-size: 1rem; }
                .wg-panel small, .wg-card small, .wg-qr small, .wg-command small { color: var(--text-muted); font-size: 0.78rem; }
                .wg-status-row { display: flex; align-items: center; gap: 8px; font-weight: 900; }
                .wg-status-row span { width: 9px; height: 9px; border-radius: 999px; display: inline-block; }
                .wg-card { display: grid; gap: 8px; min-height: 112px; }
                .wg-card svg { color: var(--gold); }
                .wg-card strong { font-size: 1.35rem; }
                .wg-qr { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
                .wg-qr > div:first-child { display: grid; gap: 5px; }
                .wg-qr-box { background: #fff; border-radius: 8px; padding: 8px; width: 220px; height: 220px; display: grid; place-items: center; }
                .wg-qr-box img { width: 200px; height: 200px; display: block; }
                .wg-section-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 12px; }
                .wg-section-head > div { display: grid; gap: 4px; }
                .wg-flow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
                .wg-flow-step { border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: grid; gap: 6px; min-height: 112px; }
                .wg-flow-step strong { font-size: 0.92rem; }
                .wg-flow-step p { margin: 0; color: var(--text-muted); font-size: 0.82rem; line-height: 1.45; }
                .wg-empty { border: 1px dashed var(--border); border-radius: 8px; padding: 18px; color: var(--text-muted); font-weight: 700; }
                .wg-command-list { display: grid; gap: 8px; }
                .wg-command { border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: grid; gap: 7px; }
                .wg-command div { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
                .wg-command div span { color: var(--text-muted); font-size: 0.78rem; font-weight: 800; text-transform: none; letter-spacing: 0; }
                .wg-command p { margin: 0; color: var(--text-primary); font-size: 0.86rem; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media (max-width: 1180px) {
                    .wg-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .wg-flow { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
                @media (max-width: 700px) {
                    .wg-header { display: grid; }
                    .wg-actions { width: 100%; }
                    .wg-actions button { flex: 1; justify-content: center; }
                    .wg-grid, .wg-flow { grid-template-columns: 1fr; }
                    .wg-qr-box { width: 100%; max-width: 260px; }
                }
            `}</style>
        </div>
    )
}

function MetricCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number; hint: string }) {
    return (
        <article className="wg-card">
            {icon}
            <span>{label}</span>
            <strong>{Number(value || 0).toLocaleString('pt-BR')}</strong>
            <small>{hint}</small>
        </article>
    )
}

function FlowStep({ title, text }: { title: string; text: string }) {
    return (
        <div className="wg-flow-step">
            <strong>{title}</strong>
            <p>{text}</p>
        </div>
    )
}
