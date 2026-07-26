'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock3,
    CreditCard,
    ExternalLink,
    FlaskConical,
    Loader2,
    Mail,
    MessageCircle,
    RefreshCw,
    ShieldCheck,
    ShoppingCart,
    TrendingUp,
    UserRound,
    WalletCards,
} from 'lucide-react'

type Stats = {
    total_orders: number
    paid_orders: number
    pending_payment: number
    abandoned: number
    expired: number
    customers: number
    education_leads: number
    messages: number
    revenue_display: string
    today_revenue_display: string
    conversion_rate: number
}

type FunnelItem = {
    key: string
    label: string
    count: number
}

type CommerceOrder = {
    id: string
    order_number: string
    status: string
    recovery_status: string
    total_display: string
    created_at: string
    updated_at: string
    paid_at: string | null
    pix_expires_at: string | null
    customer: {
        name: string
        email: string
        phone: string
    }
    items: Array<{ id: string; title: string; item_type: string; total_display: string }>
    payment: null | {
        id: string
        status: string
        payment_method: string
        pix_ticket_url: string | null
        expires_at: string | null
    }
}

type CommerceMessage = {
    id: string
    channel: 'whatsapp' | 'email'
    status: string
    recipient: string
    template_key: string
    template_name: string
    created_at: string
    sent_at: string | null
    error_message: string | null
}

type AutomationConfig = {
    enabled: boolean
    checkout_abandoned_after_minutes: number
    pix_pending_after_minutes: number
    pix_expiring_before_minutes: number
    checkout_lost_after_hours: number
    whatsapp_enabled: boolean
    email_enabled: boolean
}

type CommercePayload = {
    stats: Stats
    funnel: FunnelItem[]
    orders: CommerceOrder[]
    messages: CommerceMessage[]
    automation: AutomationConfig
}

type DiagnosticItem = {
    key: string
    label: string
    status: 'ok' | 'warn' | 'error'
    detail: string
}

type DiagnosticsPayload = {
    success: boolean
    health: 'ok' | 'warn' | 'error'
    checked_at: string
    items: DiagnosticItem[]
    config: {
        mercado_pago_environment: 'sandbox' | 'production'
        webhook_url: string
        mercado_pago_public_key_configured: boolean
        mercado_pago_public_key_kind: 'missing' | 'test' | 'production' | 'unknown'
        mercado_pago_access_token_kind: 'missing' | 'test' | 'production' | 'unknown'
        whatsapp_enabled: boolean
        email_enabled: boolean
        automation_enabled: boolean
    }
    activation?: {
        ready_for_sandbox_pix: boolean
        ready_for_production: boolean
        missing: string[]
        next_steps: string[]
        credential_summary: {
            public_key_configured: boolean
            public_key_kind: 'missing' | 'test' | 'production' | 'unknown'
            access_token_configured: boolean
            access_token_kind: 'missing' | 'test' | 'production' | 'unknown'
            webhook_secret_configured: boolean
        }
    }
    latest_diagnostic_order?: null | {
        id: string
        order_number: string
        status: string
        total_display: string
        paid_at: string | null
        created_at: string
        updated_at: string
    }
    remote_mercado_pago?: null | {
        id: string | number | null
        nickname: string
        site_id: string
        country_id: string
    }
}

type SandboxPix = {
    success: boolean
    order: {
        id: string
        order_number: string
        status: string
        total_display: string
        checkout_url: string
        pix_expires_at: string
    }
    payment: {
        id: string
        provider_payment_id: string
        status: string
        pix_qr_code: string
        pix_qr_code_base64?: string
        pix_ticket_url: string | null
        expires_at: string
        paid_at?: string | null
    }
    fulfillment?: InternalDiagnosticResult['fulfillment'] | null
    entitlements_count?: number
}

type InternalDiagnosticResult = {
    success: boolean
    diagnostic_test: boolean
    order: {
        id: string
        order_number: string
        status: string
        total_display: string
        checkout_url?: string
        pix_expires_at?: string
        paid_at?: string | null
        created_at?: string
    }
    payment?: {
        id: string
        provider_payment_id?: string
        status: string
        expires_at?: string
        paid_at?: string | null
    }
    fulfillment?: {
        order_id: string
        member_account_id: string
        auth_user_id: string | null
        auth_access_link_generated: boolean
        entitlements_count: number
        whatsapp: Record<string, unknown>
        email: Record<string, unknown>
    }
    entitlements_count?: number
    notifications_suppressed?: boolean
    auth_access_suppressed?: boolean
}

function dateTime(value: string | null | undefined) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date)
}

function statusLabel(status: string) {
    const labels: Record<string, string> = {
        checkout_started: 'Checkout iniciado',
        pending_payment: 'Pix pendente',
        paid: 'Pago',
        abandoned: 'Abandonado',
        cancelled: 'Cancelado',
        expired: 'Pix vencido',
        refunded: 'Reembolsado',
        chargeback: 'Chargeback',
        not_started: 'Não iniciado',
        scheduled: 'Agendado',
        active: 'Em recuperação',
        recovered: 'Recuperado',
        lost: 'Perdido',
        sent: 'Enviado',
        delivered: 'Entregue',
        read: 'Lido',
        failed: 'Falhou',
        skipped: 'Ignorado',
        sending: 'Enviando',
        queued: 'Na fila',
    }
    return labels[status] || status
}

function statusTone(status: string) {
    if (['paid', 'recovered', 'sent', 'delivered', 'read'].includes(status)) return 'success'
    if (['pending_payment', 'checkout_started', 'scheduled', 'active', 'queued', 'sending'].includes(status)) return 'warning'
    if (['abandoned', 'expired', 'cancelled', 'failed', 'lost', 'chargeback'].includes(status)) return 'danger'
    return 'neutral'
}

function channelIcon(channel: string) {
    return channel === 'whatsapp' ? <MessageCircle size={14} /> : <Mail size={14} />
}

function diagnosticIcon(status: DiagnosticItem['status']) {
    if (status === 'ok') return <ShieldCheck size={16} />
    if (status === 'warn') return <AlertTriangle size={16} />
    return <AlertTriangle size={16} />
}

export default function CommerceAdminPage() {
    const [payload, setPayload] = useState<CommercePayload | null>(null)
    const [diagnostics, setDiagnostics] = useState<DiagnosticsPayload | null>(null)
    const [sandboxPix, setSandboxPix] = useState<SandboxPix | null>(null)
    const [internalDiagnostic, setInternalDiagnostic] = useState<InternalDiagnosticResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [diagnosticLoading, setDiagnosticLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [diagnosticRunning, setDiagnosticRunning] = useState(false)
    const [creatingPix, setCreatingPix] = useState(false)
    const [syncingPix, setSyncingPix] = useState(false)
    const [creatingInternalOrder, setCreatingInternalOrder] = useState(false)
    const [approvingInternalOrder, setApprovingInternalOrder] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const maxFunnelCount = useMemo(() => {
        return Math.max(1, ...(payload?.funnel || []).map(item => item.count))
    }, [payload?.funnel])

    const loadData = async () => {
        setError('')
        try {
            const response = await fetch('/api/admin/commerce', { cache: 'no-store' })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data?.error || 'Erro ao carregar ecommerce.')
            setPayload(data)
        } catch (err: any) {
            setError(err?.message || 'Erro ao carregar ecommerce.')
        } finally {
            setLoading(false)
        }
    }

    const loadDiagnostics = async (remoteCheck = false) => {
        setError('')
        setDiagnosticLoading(true)
        try {
            const response = remoteCheck
                ? await fetch('/api/admin/commerce/diagnostics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'check_connection' }),
                })
                : await fetch('/api/admin/commerce/diagnostics', { cache: 'no-store' })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data?.error || 'Erro ao carregar diagnóstico.')
            setDiagnostics(data)
            return true
        } catch (err: any) {
            setError(err?.message || 'Erro ao carregar diagnóstico.')
            return false
        } finally {
            setDiagnosticLoading(false)
        }
    }

    useEffect(() => {
        loadData()
        loadDiagnostics()
    }, [])

    const runAutomations = async () => {
        setRunning(true)
        setNotice('')
        setError('')
        try {
            const response = await fetch('/api/admin/commerce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'run_automations', force: true, limit: 40 }),
            })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data?.error || 'Erro ao rodar automações.')
            setNotice(`${data.processed || 0} automações processadas. ${data.failed || 0} falhas.`)
            await loadData()
        } catch (err: any) {
            setError(err?.message || 'Erro ao rodar automações.')
        } finally {
            setRunning(false)
        }
    }

    const checkMercadoPago = async () => {
        setDiagnosticRunning(true)
        setNotice('')
        try {
            const ok = await loadDiagnostics(true)
            if (ok) setNotice('Diagnóstico do Mercado Pago atualizado.')
        } finally {
            setDiagnosticRunning(false)
        }
    }

    const createPixSandbox = async () => {
        setCreatingPix(true)
        setNotice('')
        setError('')
        try {
            const response = await fetch('/api/admin/commerce/diagnostics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_sandbox_pix' }),
            })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data?.error || 'Erro ao gerar Pix sandbox.')
            setSandboxPix(data)
            setNotice(`Pix sandbox gerado para o pedido ${data.order?.order_number || ''}.`)
            await Promise.all([loadData(), loadDiagnostics()])
        } catch (err: any) {
            setError(err?.message || 'Erro ao gerar Pix sandbox.')
        } finally {
            setCreatingPix(false)
        }
    }

    const syncSandboxPayment = async () => {
        if (!sandboxPix?.order?.id) {
            setError('Gere um Pix sandbox antes de consultar o pagamento.')
            return
        }

        setSyncingPix(true)
        setNotice('')
        setError('')
        try {
            const response = await fetch('/api/admin/commerce/diagnostics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sync_sandbox_payment',
                    order_id: sandboxPix.order.id,
                    payment_id: sandboxPix.payment?.id,
                }),
            })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data?.error || 'Erro ao consultar Pix sandbox.')
            setSandboxPix(data)
            if (data.order?.status === 'paid') {
                setNotice(`Pix sandbox aprovado. ${data.entitlements_count || 0} acesso(s) liberado(s) no teste.`)
            } else {
                setNotice(`Pix sandbox consultado: ${statusLabel(data.payment?.status || data.order?.status || 'pending_payment')}.`)
            }
            await Promise.all([loadData(), loadDiagnostics()])
        } catch (err: any) {
            setError(err?.message || 'Erro ao consultar Pix sandbox.')
        } finally {
            setSyncingPix(false)
        }
    }

    const createInternalTestOrder = async () => {
        setCreatingInternalOrder(true)
        setNotice('')
        setError('')
        try {
            const response = await fetch('/api/admin/commerce/diagnostics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_internal_diagnostic_order' }),
            })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data?.error || 'Erro ao criar pedido teste interno.')
            setInternalDiagnostic(data)
            setNotice(`Pedido teste ${data.order?.order_number || ''} criado sem cobrança real.`)
            await Promise.all([loadData(), loadDiagnostics()])
        } catch (err: any) {
            setError(err?.message || 'Erro ao criar pedido teste interno.')
        } finally {
            setCreatingInternalOrder(false)
        }
    }

    const approveInternalTestOrder = async () => {
        const orderId = internalDiagnostic?.order?.id || diagnostics?.latest_diagnostic_order?.id
        if (!orderId) {
            setError('Crie um pedido teste interno antes de simular o pagamento aprovado.')
            return
        }

        setApprovingInternalOrder(true)
        setNotice('')
        setError('')
        try {
            const response = await fetch('/api/admin/commerce/diagnostics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'approve_internal_diagnostic_order', order_id: orderId }),
            })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data?.error || 'Erro ao simular pagamento aprovado.')
            setInternalDiagnostic(data)
            setNotice(`Pagamento teste aprovado. ${data.entitlements_count ?? data.fulfillment?.entitlements_count ?? 0} acesso(s) liberado(s).`)
            await Promise.all([loadData(), loadDiagnostics()])
        } catch (err: any) {
            setError(err?.message || 'Erro ao simular pagamento aprovado.')
        } finally {
            setApprovingInternalOrder(false)
        }
    }

    const stats = payload?.stats
    const canCreateSandboxPix = Boolean(diagnostics?.activation?.ready_for_sandbox_pix)
    const latestDiagnosticOrder = internalDiagnostic?.order || diagnostics?.latest_diagnostic_order || null

    return (
        <div className="commerce-admin-page">
            <div className="admin-header commerce-admin-header">
                <div>
                    <h1><ShoppingCart className="text-gold" size={28} /> Ecommerce</h1>
                    <p>Pedidos, clientes, mensagens e recuperação de checkout dos produtos digitais Pilger.</p>
                </div>
                <div className="commerce-admin-actions">
                    <button type="button" className="btn btn-outline" onClick={loadData} disabled={loading || running}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        Atualizar
                    </button>
                    <button type="button" className="btn btn-primary" onClick={runAutomations} disabled={running}>
                        {running ? <Loader2 className="spin" size={16} /> : <Activity size={16} />}
                        Rodar automações
                    </button>
                </div>
            </div>

            {error && <div className="commerce-admin-alert is-error">{error}</div>}
            {notice && <div className="commerce-admin-alert is-success">{notice}</div>}

            {loading && !payload ? (
                <div className="commerce-admin-empty">
                    <Loader2 className="spin" size={28} />
                    <span>Carregando dados de vendas...</span>
                </div>
            ) : payload && stats ? (
                <>
                    <section className="commerce-admin-kpis">
                        <div><WalletCards size={18} /><span>Receita paga</span><strong>{stats.revenue_display}</strong></div>
                        <div><TrendingUp size={18} /><span>Hoje</span><strong>{stats.today_revenue_display}</strong></div>
                        <div><CreditCard size={18} /><span>Pedidos</span><strong>{stats.total_orders}</strong></div>
                        <div><CheckCircle2 size={18} /><span>Conversão</span><strong>{stats.conversion_rate}%</strong></div>
                        <div><Clock3 size={18} /><span>Pix pendentes</span><strong>{stats.pending_payment}</strong></div>
                        <div><ShoppingCart size={18} /><span>Abandonados</span><strong>{stats.abandoned}</strong></div>
                        <div><UserRound size={18} /><span>Clientes</span><strong>{stats.customers}</strong></div>
                        <div><MessageCircle size={18} /><span>Mensagens</span><strong>{stats.messages}</strong></div>
                    </section>

                    <section className="commerce-admin-panel commerce-admin-diagnostics">
                        <div className="commerce-admin-panel-head">
                            <div>
                                <h2><FlaskConical size={18} /> Diagnóstico de pagamento</h2>
                                <p>Checklist de segurança, Mercado Pago, webhook, templates e teste de Pix sandbox.</p>
                            </div>
                            <div className="commerce-admin-actions">
                                <button type="button" className="btn btn-outline" onClick={checkMercadoPago} disabled={diagnosticRunning || diagnosticLoading}>
                                    {diagnosticRunning ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
                                    Testar token
                                </button>
                                <button type="button" className="btn btn-primary" onClick={createPixSandbox} disabled={creatingPix || !canCreateSandboxPix}>
                                    {creatingPix ? <Loader2 className="spin" size={16} /> : <CreditCard size={16} />}
                                    Gerar Pix sandbox
                                </button>
                            </div>
                        </div>

                        {diagnosticLoading && !diagnostics ? (
                            <div className="commerce-admin-empty is-small">
                                <Loader2 className="spin" size={22} />
                                <span>Verificando pagamento...</span>
                            </div>
                        ) : diagnostics ? (
                            <>
                                <div className="commerce-admin-diagnostic-summary">
                                    <span className={`commerce-admin-badge is-${statusTone(diagnostics.health === 'ok' ? 'paid' : diagnostics.health === 'warn' ? 'pending_payment' : 'failed')}`}>
                                        {diagnostics.health === 'ok' ? 'Pronto' : diagnostics.health === 'warn' ? 'Atenção' : 'Revisar'}
                                    </span>
                                    <strong>{diagnostics.config.mercado_pago_environment === 'sandbox' ? 'Ambiente sandbox' : 'Ambiente produção'}</strong>
                                    <small>{diagnostics.config.webhook_url}</small>
                                    {diagnostics.remote_mercado_pago && (
                                        <small>Conta Mercado Pago: {diagnostics.remote_mercado_pago.nickname || diagnostics.remote_mercado_pago.id}</small>
                                    )}
                                </div>

                                {diagnostics.activation && (
                                    <div className="commerce-admin-activation">
                                        <div>
                                            <strong>Ativação Mercado Pago</strong>
                                            <small>
                                                {diagnostics.activation.ready_for_sandbox_pix
                                                    ? 'Pronto para gerar Pix sandbox real.'
                                                    : diagnostics.activation.ready_for_production
                                                        ? 'Pronto para venda em produção.'
                                                        : 'Ainda faltam configurações para o teste real.'}
                                            </small>
                                        </div>
                                        <span className={`commerce-admin-badge is-${diagnostics.activation.ready_for_sandbox_pix || diagnostics.activation.ready_for_production ? 'success' : 'warning'}`}>
                                            {diagnostics.activation.ready_for_sandbox_pix || diagnostics.activation.ready_for_production ? 'Ativável' : 'Pendente'}
                                        </span>
                                        <div className="commerce-admin-activation-grid">
                                            <div><span>Public Key</span><strong>{diagnostics.activation.credential_summary.public_key_configured ? diagnostics.activation.credential_summary.public_key_kind : 'ausente'}</strong></div>
                                            <div><span>Access Token</span><strong>{diagnostics.activation.credential_summary.access_token_configured ? diagnostics.activation.credential_summary.access_token_kind : 'ausente'}</strong></div>
                                            <div><span>Webhook Secret</span><strong>{diagnostics.activation.credential_summary.webhook_secret_configured ? 'configurado' : 'ausente'}</strong></div>
                                        </div>
                                        {diagnostics.activation.next_steps.length > 0 && (
                                            <div className="commerce-admin-activation-steps">
                                                {diagnostics.activation.next_steps.slice(0, 4).map(step => <small key={step}>{step}</small>)}
                                            </div>
                                        )}
                                        <Link href="/admin/maintenance" className="btn btn-outline">
                                            <ExternalLink size={15} />
                                            Abrir credenciais
                                        </Link>
                                    </div>
                                )}

                                <div className="commerce-admin-diagnostic-grid">
                                    {diagnostics.items.map(item => (
                                        <div key={item.key} className={`commerce-admin-diagnostic-item is-${item.status}`}>
                                            <span>{diagnosticIcon(item.status)}</span>
                                            <div>
                                                <strong>{item.label}</strong>
                                                <small>{item.detail}</small>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : null}

                        <div className="commerce-admin-internal-test">
                            <div>
                                <strong>Teste interno de venda</strong>
                                <small>Cria um pedido diagnóstico, simula pagamento aprovado e valida a liberação da área de membros sem cobrança real e sem envio de WhatsApp ou e-mail.</small>
                            </div>
                            <div className="commerce-admin-actions">
                                <button type="button" className="btn btn-outline" onClick={createInternalTestOrder} disabled={creatingInternalOrder || approvingInternalOrder}>
                                    {creatingInternalOrder ? <Loader2 className="spin" size={16} /> : <ShoppingCart size={16} />}
                                    Criar pedido teste
                                </button>
                                <button type="button" className="btn btn-primary" onClick={approveInternalTestOrder} disabled={approvingInternalOrder || creatingInternalOrder || !latestDiagnosticOrder}>
                                    {approvingInternalOrder ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
                                    Simular aprovado
                                </button>
                            </div>
                            {latestDiagnosticOrder && (
                                <div className="commerce-admin-internal-test-result">
                                    <span className={`commerce-admin-badge is-${statusTone(latestDiagnosticOrder.status)}`}>
                                        {statusLabel(latestDiagnosticOrder.status)}
                                    </span>
                                    <strong>{latestDiagnosticOrder.order_number}</strong>
                                    <small>{latestDiagnosticOrder.total_display} | criado {dateTime(latestDiagnosticOrder.created_at || null)}</small>
                                    {internalDiagnostic?.fulfillment && (
                                        <small>
                                            Acesso liberado: {internalDiagnostic.entitlements_count ?? internalDiagnostic.fulfillment.entitlements_count} produto(s). Mensagens e link de acesso suprimidos neste teste.
                                        </small>
                                    )}
                                </div>
                            )}
                        </div>

                        {sandboxPix && (
                            <div className="commerce-admin-sandbox-pix">
                                <div>
                                    <strong>Pix sandbox: {sandboxPix.order.order_number}</strong>
                                    <small>{sandboxPix.order.total_display} | {statusLabel(sandboxPix.payment.status)} | vence {dateTime(sandboxPix.payment.expires_at)}</small>
                                </div>
                                <button type="button" className="btn btn-outline" onClick={syncSandboxPayment} disabled={syncingPix}>
                                    {syncingPix ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                                    Consultar Pix
                                </button>
                                {sandboxPix.payment.pix_ticket_url && (
                                    <a href={sandboxPix.payment.pix_ticket_url} target="_blank" rel="noreferrer">
                                        <ExternalLink size={15} />
                                        Abrir Pix
                                    </a>
                                )}
                                {sandboxPix.fulfillment && (
                                    <small className="commerce-admin-sandbox-result">
                                        Pix aprovado e acesso liberado no teste: {sandboxPix.entitlements_count ?? sandboxPix.fulfillment.entitlements_count} produto(s).
                                    </small>
                                )}
                                {sandboxPix.payment.pix_qr_code && (
                                    <textarea readOnly value={sandboxPix.payment.pix_qr_code} aria-label="Pix copia e cola sandbox" />
                                )}
                            </div>
                        )}
                    </section>

                    <section className="commerce-admin-grid">
                        <div className="commerce-admin-panel">
                            <div className="commerce-admin-panel-head">
                                <div>
                                    <h2>Funil de checkout</h2>
                                    <p>Separado do CRM de imóveis: aqui entram leads e compradores dos produtos digitais.</p>
                                </div>
                            </div>
                            <div className="commerce-admin-funnel">
                                {payload.funnel.map(item => (
                                    <div key={item.key} className="commerce-admin-funnel-row">
                                        <div>
                                            <span>{item.label}</span>
                                            <strong>{item.count}</strong>
                                        </div>
                                        <em style={{ width: `${Math.max(4, (item.count / maxFunnelCount) * 100)}%` }} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="commerce-admin-panel">
                            <div className="commerce-admin-panel-head">
                                <div>
                                    <h2>Régua automática</h2>
                                    <p>Envios saem pelo WhatsApp Global e pelo e-mail transacional.</p>
                                </div>
                            </div>
                            <div className="commerce-admin-automation">
                                <div><span>Status</span><strong>{payload.automation.enabled ? 'Ativa' : 'Inativa'}</strong></div>
                                <div><span>Carrinho abandonado</span><strong>{payload.automation.checkout_abandoned_after_minutes} min</strong></div>
                                <div><span>Pix pendente</span><strong>{payload.automation.pix_pending_after_minutes} min</strong></div>
                                <div><span>Pix vencendo</span><strong>{payload.automation.pix_expiring_before_minutes} min</strong></div>
                                <div><span>Checkout perdido</span><strong>{payload.automation.checkout_lost_after_hours} h</strong></div>
                                <div><span>Canais</span><strong>{payload.automation.whatsapp_enabled ? 'WhatsApp' : ''}{payload.automation.whatsapp_enabled && payload.automation.email_enabled ? ' + ' : ''}{payload.automation.email_enabled ? 'E-mail' : ''}</strong></div>
                            </div>
                        </div>
                    </section>

                    <section className="commerce-admin-panel commerce-admin-orders">
                        <div className="commerce-admin-panel-head">
                            <div>
                                <h2>Pedidos recentes</h2>
                                <p>Visão rápida de compradores, status do Pix, valor e recuperação.</p>
                            </div>
                        </div>
                        <div className="commerce-admin-table-wrap">
                            <table className="commerce-admin-table">
                                <thead>
                                    <tr>
                                        <th>Pedido</th>
                                        <th>Cliente</th>
                                        <th>Produto</th>
                                        <th>Status</th>
                                        <th>Valor</th>
                                        <th>Pix vence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payload.orders.slice(0, 35).map(order => (
                                        <tr key={order.id}>
                                            <td>
                                                <strong>{order.order_number}</strong>
                                                <small>{dateTime(order.created_at)}</small>
                                            </td>
                                            <td>
                                                <strong>{order.customer.name || 'Sem nome'}</strong>
                                                <small>{order.customer.email || order.customer.phone || '-'}</small>
                                            </td>
                                            <td>
                                                <strong>{order.items[0]?.title || 'Produto digital'}</strong>
                                                <small>{order.items.length > 1 ? `${order.items.length} itens` : '1 item'}</small>
                                            </td>
                                            <td>
                                                <span className={`commerce-admin-badge is-${statusTone(order.status)}`}>{statusLabel(order.status)}</span>
                                                <small>{statusLabel(order.recovery_status)}</small>
                                            </td>
                                            <td><strong>{order.total_display}</strong></td>
                                            <td><small>{dateTime(order.pix_expires_at || order.payment?.expires_at)}</small></td>
                                        </tr>
                                    ))}
                                    {payload.orders.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="commerce-admin-table-empty">Nenhum pedido encontrado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="commerce-admin-panel">
                        <div className="commerce-admin-panel-head">
                            <div>
                                <h2>Mensagens recentes</h2>
                                <p>Auditoria dos disparos transacionais e de recuperação.</p>
                            </div>
                        </div>
                        <div className="commerce-admin-message-list">
                            {payload.messages.slice(0, 20).map(message => (
                                <div key={message.id} className="commerce-admin-message">
                                    <span>{channelIcon(message.channel)}</span>
                                    <div>
                                        <strong>{message.template_name || message.template_key}</strong>
                                        <small>{message.recipient} | {dateTime(message.sent_at || message.created_at)}</small>
                                        {message.error_message && <em>{message.error_message}</em>}
                                    </div>
                                    <span className={`commerce-admin-badge is-${statusTone(message.status)}`}>{statusLabel(message.status)}</span>
                                </div>
                            ))}
                            {payload.messages.length === 0 && (
                                <div className="commerce-admin-empty is-small">Nenhuma mensagem registrada ainda.</div>
                            )}
                        </div>
                    </section>
                </>
            ) : null}

            <style jsx>{`
                .commerce-admin-page {
                    width: min(100%, 1400px);
                    margin: 0 auto;
                    padding: 0 8px 48px;
                    box-sizing: border-box;
                }

                .commerce-admin-header,
                .commerce-admin-actions,
                .commerce-admin-panel-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                }

                .commerce-admin-header h1 {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 0;
                }

                .commerce-admin-header p,
                .commerce-admin-panel-head p {
                    margin: 7px 0 0;
                    color: var(--text-secondary);
                }

                .commerce-admin-kpis {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 12px;
                    margin: 8px 0 18px;
                }

                .commerce-admin-kpis div,
                .commerce-admin-panel {
                    border: 1px solid var(--border-color, var(--border));
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.025);
                }

                .commerce-admin-kpis div {
                    min-width: 0;
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 8px 10px;
                    align-items: center;
                    padding: 14px;
                }

                .commerce-admin-kpis span {
                    color: var(--text-secondary);
                    font-size: 0.78rem;
                    font-weight: 700;
                }

                .commerce-admin-kpis strong {
                    grid-column: 1 / -1;
                    font-size: 1.15rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-admin-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
                    gap: 16px;
                    margin-bottom: 16px;
                }

                .commerce-admin-panel {
                    padding: 18px;
                    min-width: 0;
                }

                .commerce-admin-panel h2 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0;
                    font-size: 1rem;
                }

                .commerce-admin-diagnostics {
                    margin-bottom: 16px;
                }

                .commerce-admin-diagnostic-summary {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-top: 16px;
                    padding: 11px 12px;
                    border: 1px solid rgba(148, 163, 184, 0.16);
                    border-radius: 7px;
                    background: rgba(255, 255, 255, 0.018);
                }

                .commerce-admin-diagnostic-summary small {
                    min-width: 0;
                    color: var(--text-muted);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-admin-diagnostic-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                    margin-top: 12px;
                }

                .commerce-admin-diagnostic-item {
                    min-width: 0;
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr);
                    gap: 9px;
                    padding: 11px 12px;
                    border: 1px solid rgba(148, 163, 184, 0.16);
                    border-radius: 7px;
                    background: rgba(255, 255, 255, 0.018);
                }

                .commerce-admin-diagnostic-item.is-ok {
                    border-color: rgba(34, 197, 94, 0.24);
                }

                .commerce-admin-diagnostic-item.is-warn {
                    border-color: rgba(245, 158, 11, 0.28);
                }

                .commerce-admin-diagnostic-item.is-error {
                    border-color: rgba(239, 68, 68, 0.3);
                }

                .commerce-admin-diagnostic-item span {
                    color: var(--gold);
                }

                .commerce-admin-diagnostic-item div {
                    min-width: 0;
                    display: grid;
                    gap: 4px;
                }

                .commerce-admin-diagnostic-item strong,
                .commerce-admin-diagnostic-item small {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-admin-diagnostic-item small {
                    color: var(--text-muted);
                    font-size: 0.74rem;
                }

                .commerce-admin-activation {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto auto;
                    align-items: start;
                    gap: 12px;
                    margin-top: 12px;
                    padding: 12px;
                    border: 1px solid rgba(224, 176, 82, 0.28);
                    border-radius: 7px;
                    background: linear-gradient(135deg, rgba(224, 176, 82, 0.1), rgba(255, 255, 255, 0.018));
                }

                .commerce-admin-activation > div:first-child {
                    min-width: 0;
                    display: grid;
                    gap: 4px;
                }

                .commerce-admin-activation small,
                .commerce-admin-activation span {
                    color: var(--text-muted);
                    line-height: 1.45;
                }

                .commerce-admin-activation-grid,
                .commerce-admin-activation-steps {
                    grid-column: 1 / -1;
                    display: grid;
                    gap: 8px;
                }

                .commerce-admin-activation-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }

                .commerce-admin-activation-grid div {
                    display: grid;
                    gap: 3px;
                    padding: 9px 10px;
                    border: 1px solid rgba(148, 163, 184, 0.14);
                    border-radius: 6px;
                    background: rgba(0, 0, 0, 0.12);
                }

                .commerce-admin-activation-grid strong {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-admin-activation-steps {
                    padding-top: 10px;
                    border-top: 1px solid rgba(148, 163, 184, 0.16);
                }

                .commerce-admin-internal-test {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 12px;
                    margin-top: 12px;
                    padding: 12px;
                    border: 1px solid rgba(34, 197, 94, 0.2);
                    border-radius: 7px;
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(255, 255, 255, 0.018));
                }

                .commerce-admin-internal-test > div:first-child,
                .commerce-admin-internal-test-result {
                    min-width: 0;
                    display: grid;
                    gap: 4px;
                }

                .commerce-admin-internal-test strong,
                .commerce-admin-internal-test small {
                    min-width: 0;
                }

                .commerce-admin-internal-test small {
                    color: var(--text-muted);
                    line-height: 1.45;
                }

                .commerce-admin-internal-test-result {
                    grid-column: 1 / -1;
                    padding-top: 10px;
                    border-top: 1px solid rgba(148, 163, 184, 0.16);
                }

                .commerce-admin-internal-test-result .commerce-admin-badge {
                    width: fit-content;
                }

                .commerce-admin-sandbox-pix {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    align-items: start;
                    gap: 10px;
                    margin-top: 12px;
                    padding: 12px;
                    border: 1px solid rgba(148, 131, 105, 0.3);
                    border-radius: 7px;
                    background: rgba(148, 131, 105, 0.08);
                }

                .commerce-admin-sandbox-pix div {
                    min-width: 0;
                    display: grid;
                    gap: 4px;
                }

                .commerce-admin-sandbox-pix small {
                    color: var(--text-muted);
                }

                .commerce-admin-sandbox-pix a,
                .commerce-admin-sandbox-pix button {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    min-height: 34px;
                    padding: 0 11px;
                    border: 1px solid var(--border-color, var(--border));
                    border-radius: 6px;
                    color: var(--text-primary);
                    text-decoration: none;
                }

                .commerce-admin-sandbox-result {
                    grid-column: 1 / -1;
                    padding: 9px 10px;
                    border: 1px solid rgba(34, 197, 94, 0.22);
                    border-radius: 6px;
                    background: rgba(34, 197, 94, 0.08);
                }

                .commerce-admin-sandbox-pix textarea {
                    grid-column: 1 / -1;
                    width: 100%;
                    min-height: 72px;
                    padding: 10px;
                    border: 1px solid rgba(148, 163, 184, 0.18);
                    border-radius: 6px;
                    background: rgba(0, 0, 0, 0.18);
                    color: var(--text-secondary);
                    font: inherit;
                    resize: vertical;
                    box-sizing: border-box;
                }

                .commerce-admin-funnel {
                    display: grid;
                    gap: 12px;
                    margin-top: 18px;
                }

                .commerce-admin-funnel-row {
                    display: grid;
                    gap: 7px;
                }

                .commerce-admin-funnel-row div {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    font-size: 0.84rem;
                }

                .commerce-admin-funnel-row span {
                    color: var(--text-secondary);
                }

                .commerce-admin-funnel-row em {
                    height: 8px;
                    border-radius: 999px;
                    background: linear-gradient(90deg, var(--gold), rgba(148, 131, 105, 0.24));
                }

                .commerce-admin-automation {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                    margin-top: 16px;
                }

                .commerce-admin-automation div {
                    display: grid;
                    gap: 5px;
                    padding: 11px 12px;
                    border: 1px solid rgba(148, 163, 184, 0.18);
                    border-radius: 7px;
                    background: rgba(255, 255, 255, 0.02);
                }

                .commerce-admin-automation span,
                .commerce-admin-table small,
                .commerce-admin-message small {
                    color: var(--text-muted);
                    font-size: 0.74rem;
                }

                .commerce-admin-table-wrap {
                    overflow-x: auto;
                    margin-top: 14px;
                }

                .commerce-admin-table {
                    width: 100%;
                    border-collapse: collapse;
                    min-width: 820px;
                }

                .commerce-admin-table th,
                .commerce-admin-table td {
                    padding: 12px 10px;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.16);
                    text-align: left;
                    vertical-align: top;
                }

                .commerce-admin-table th {
                    color: var(--text-secondary);
                    font-size: 0.73rem;
                    text-transform: uppercase;
                }

                .commerce-admin-table td {
                    font-size: 0.85rem;
                }

                .commerce-admin-table td > strong,
                .commerce-admin-table td > small {
                    display: block;
                    max-width: 260px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-admin-badge {
                    display: inline-flex;
                    align-items: center;
                    min-height: 24px;
                    padding: 0 8px;
                    border-radius: 999px;
                    font-size: 0.72rem;
                    font-weight: 800;
                    white-space: nowrap;
                }

                .commerce-admin-badge.is-success {
                    background: rgba(34, 197, 94, 0.12);
                    color: #86efac;
                }

                .commerce-admin-badge.is-warning {
                    background: rgba(245, 158, 11, 0.12);
                    color: #fcd34d;
                }

                .commerce-admin-badge.is-danger {
                    background: rgba(239, 68, 68, 0.12);
                    color: #fca5a5;
                }

                .commerce-admin-badge.is-neutral {
                    background: rgba(148, 163, 184, 0.12);
                    color: var(--text-secondary);
                }

                .commerce-admin-message-list {
                    display: grid;
                    gap: 9px;
                    margin-top: 14px;
                }

                .commerce-admin-message {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border: 1px solid rgba(148, 163, 184, 0.16);
                    border-radius: 7px;
                    background: rgba(255, 255, 255, 0.018);
                }

                .commerce-admin-message div {
                    min-width: 0;
                    display: grid;
                    gap: 3px;
                }

                .commerce-admin-message strong,
                .commerce-admin-message small,
                .commerce-admin-message em {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-admin-message em {
                    color: #fca5a5;
                    font-size: 0.72rem;
                    font-style: normal;
                }

                .commerce-admin-alert {
                    margin: 0 0 14px;
                    padding: 11px 14px;
                    border-radius: 7px;
                    font-size: 0.88rem;
                }

                .commerce-admin-alert.is-error {
                    border: 1px solid rgba(239, 68, 68, 0.28);
                    background: rgba(239, 68, 68, 0.08);
                    color: #fecaca;
                }

                .commerce-admin-alert.is-success {
                    border: 1px solid rgba(34, 197, 94, 0.26);
                    background: rgba(34, 197, 94, 0.08);
                    color: #bbf7d0;
                }

                .commerce-admin-empty {
                    min-height: 220px;
                    display: grid;
                    place-items: center;
                    gap: 8px;
                    color: var(--text-muted);
                    text-align: center;
                }

                .commerce-admin-empty.is-small,
                .commerce-admin-table-empty {
                    min-height: 80px;
                    padding: 24px;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 1080px) {
                    .commerce-admin-kpis {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .commerce-admin-diagnostic-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .commerce-admin-activation {
                        grid-template-columns: minmax(0, 1fr) auto;
                    }

                    .commerce-admin-activation > a {
                        grid-column: 1 / -1;
                        width: fit-content;
                    }

                    .commerce-admin-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 720px) {
                    .commerce-admin-header,
                    .commerce-admin-actions,
                    .commerce-admin-panel-head {
                        align-items: stretch;
                        flex-direction: column;
                    }

                    .commerce-admin-kpis,
                    .commerce-admin-diagnostic-grid,
                    .commerce-admin-activation,
                    .commerce-admin-activation-grid,
                    .commerce-admin-automation {
                        grid-template-columns: 1fr;
                    }

                    .commerce-admin-activation > a {
                        width: auto;
                    }

                    .commerce-admin-sandbox-pix {
                        grid-template-columns: 1fr;
                    }

                    .commerce-admin-internal-test {
                        grid-template-columns: 1fr;
                    }

                    .commerce-admin-message {
                        grid-template-columns: auto minmax(0, 1fr);
                    }

                    .commerce-admin-message .commerce-admin-badge {
                        grid-column: 2;
                        justify-self: start;
                    }
                }
            `}</style>
        </div>
    )
}
