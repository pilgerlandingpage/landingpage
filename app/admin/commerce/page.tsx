'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
    Activity,
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    CreditCard,
    ExternalLink,
    FileText,
    FlaskConical,
    Gauge,
    Loader2,
    Mail,
    MessageCircle,
    RefreshCw,
    Search,
    Settings2,
    ShieldCheck,
    ShoppingCart,
    Sparkles,
    TrendingUp,
    UserRound,
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
        id?: string | null
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

type CommerceTab = 'orders' | 'diagnostics' | 'funnel' | 'messages' | 'automation'
type OrderFilter = 'all' | 'paid' | 'pending_payment' | 'abandoned' | 'expired'

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
        not_started: 'Nao iniciado',
        scheduled: 'Agendado',
        active: 'Em recuperacao',
        recovered: 'Recuperado',
        lost: 'Perdido',
        sent: 'Enviado',
        delivered: 'Entregue',
        read: 'Lido',
        failed: 'Falhou',
        skipped: 'Ignorado',
        sending: 'Enviando',
        queued: 'Na fila',
        approved: 'Aprovado',
        pending: 'Pendente',
        rejected: 'Recusado',
        in_process: 'Em analise',
        authorized: 'Autorizado',
        refunded_payment: 'Reembolsado',
        charged_back: 'Chargeback',
    }
    return labels[status] || status || '-'
}

function statusTone(status: string) {
    if (['paid', 'recovered', 'sent', 'delivered', 'read', 'approved'].includes(status)) return 'success'
    if (['pending_payment', 'checkout_started', 'scheduled', 'active', 'queued', 'sending', 'pending', 'in_process', 'authorized'].includes(status)) return 'warning'
    if (['abandoned', 'expired', 'cancelled', 'failed', 'lost', 'chargeback', 'rejected', 'charged_back'].includes(status)) return 'danger'
    return 'neutral'
}

function statusColor(status: string) {
    if (statusTone(status) === 'success') return '#16a34a'
    if (statusTone(status) === 'warning') return '#d97706'
    if (statusTone(status) === 'danger') return '#dc2626'
    return '#64748b'
}

function diagnosticIcon(status: DiagnosticItem['status']) {
    if (status === 'ok') return <ShieldCheck size={16} />
    if (status === 'warn') return <AlertTriangle size={16} />
    return <AlertTriangle size={16} />
}

function channelIcon(channel: string) {
    return channel === 'whatsapp' ? <MessageCircle size={14} /> : <Mail size={14} />
}

function shortText(value: string | null | undefined, max = 42) {
    const text = String(value || '').trim()
    if (!text) return '-'
    return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function orderCustomerLabel(order: CommerceOrder | null) {
    if (!order) return '-'
    return order.customer.name || order.customer.email || order.customer.phone || 'Cliente sem nome'
}

function initials(value: string | null | undefined) {
    const clean = String(value || '').trim()
    if (!clean) return 'C'
    const parts = clean.split(/\s+/).filter(Boolean)
    return `${parts[0]?.[0] || 'C'}${parts[1]?.[0] || ''}`.toUpperCase()
}

function StatusBadge({ status }: { status: string }) {
    return (
        <span className="commerce-manager-status" style={{ '--commerce-status': statusColor(status) } as CSSProperties}>
            {statusLabel(status)}
        </span>
    )
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
    const [activeTab, setActiveTab] = useState<CommerceTab>('orders')
    const [orderFilter, setOrderFilter] = useState<OrderFilter>('all')
    const [orderSearch, setOrderSearch] = useState('')
    const [messageSearch, setMessageSearch] = useState('')
    const [selectedOrderId, setSelectedOrderId] = useState('')

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
            if (!response.ok || !data.success) throw new Error(data?.error || 'Erro ao carregar diagnostico.')
            setDiagnostics(data)
            return true
        } catch (err: any) {
            setError(err?.message || 'Erro ao carregar diagnostico.')
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
            if (!response.ok || !data.success) throw new Error(data?.error || 'Erro ao rodar automacoes.')
            setNotice(`${data.processed || 0} automacoes processadas. ${data.failed || 0} falhas.`)
            await loadData()
        } catch (err: any) {
            setError(err?.message || 'Erro ao rodar automacoes.')
        } finally {
            setRunning(false)
        }
    }

    const checkMercadoPago = async () => {
        setDiagnosticRunning(true)
        setNotice('')
        try {
            const ok = await loadDiagnostics(true)
            if (ok) setNotice('Diagnostico do Mercado Pago atualizado.')
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
            setActiveTab('diagnostics')
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
            setNotice(`Pedido teste ${data.order?.order_number || ''} criado sem cobranca real.`)
            await Promise.all([loadData(), loadDiagnostics()])
            setActiveTab('diagnostics')
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
    const orders = payload?.orders || []
    const messages = payload?.messages || []
    const canCreateSandboxPix = Boolean(diagnostics?.activation?.ready_for_sandbox_pix)
    const latestDiagnosticOrder = internalDiagnostic?.order || diagnostics?.latest_diagnostic_order || null

    const maxFunnelCount = useMemo(() => {
        return Math.max(1, ...(payload?.funnel || []).map(item => item.count))
    }, [payload?.funnel])

    const filteredOrders = useMemo(() => {
        const term = orderSearch.trim().toLowerCase()
        return orders.filter(order => {
            const statusMatch = orderFilter === 'all' || order.status === orderFilter
            if (!statusMatch) return false
            if (!term) return true
            return [
                order.order_number,
                order.status,
                order.recovery_status,
                order.customer.name,
                order.customer.email,
                order.customer.phone,
                order.items.map(item => item.title).join(' '),
            ].join(' ').toLowerCase().includes(term)
        })
    }, [orderFilter, orderSearch, orders])

    const filteredMessages = useMemo(() => {
        const term = messageSearch.trim().toLowerCase()
        if (!term) return messages
        return messages.filter(message => [
            message.recipient,
            message.template_key,
            message.template_name,
            message.channel,
            message.status,
        ].join(' ').toLowerCase().includes(term))
    }, [messageSearch, messages])

    const selectedOrder = filteredOrders.find(order => order.id === selectedOrderId) || filteredOrders[0] || null
    const diagnosticsReady = diagnostics?.health === 'ok'
    const currentTitle = activeTab === 'orders'
        ? 'Pedidos'
        : activeTab === 'diagnostics'
            ? 'Diagnostico'
            : activeTab === 'funnel'
                ? 'Funil'
                : activeTab === 'messages'
                    ? 'Mensagens'
                    : 'Regua automatica'

    const navItems: Array<{ key: CommerceTab; label: string; count: number; icon: ReactNode }> = [
        { key: 'orders', label: 'Pedidos', count: orders.length, icon: <ShoppingCart size={17} /> },
        { key: 'funnel', label: 'Funil', count: stats?.education_leads || 0, icon: <Gauge size={17} /> },
        { key: 'diagnostics', label: 'Diagnostico', count: diagnostics?.items.length || 0, icon: <FlaskConical size={17} /> },
        { key: 'messages', label: 'Mensagens', count: messages.length, icon: <MessageCircle size={17} /> },
        { key: 'automation', label: 'Regua', count: payload?.automation.enabled ? 1 : 0, icon: <Settings2 size={17} /> },
    ]

    return (
        <div className="commerce-manager-page">
            {(error || notice) && (
                <div className={`commerce-manager-toast ${error ? 'error' : 'success'}`}>
                    {error ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                    {error || notice}
                </div>
            )}

            <header className="commerce-manager-topbar">
                <div className="commerce-manager-brand">
                    <span className="commerce-manager-logo"><ShoppingCart size={20} /></span>
                    <div>
                        <h1>Ecommerce</h1>
                        <p>{orders.length} pedido(s) | {stats?.customers || 0} cliente(s) | {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
                <div className="commerce-manager-actions">
                    <button type="button" onClick={loadData} disabled={loading || running}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        Atualizar
                    </button>
                    <button type="button" onClick={checkMercadoPago} disabled={diagnosticRunning || diagnosticLoading}>
                        {diagnosticRunning ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
                        Token
                    </button>
                    <button type="button" onClick={runAutomations} disabled={running}>
                        {running ? <Loader2 className="spin" size={16} /> : <Activity size={16} />}
                        Automacoes
                    </button>
                    <button type="button" className="primary" onClick={createPixSandbox} disabled={creatingPix || !canCreateSandboxPix}>
                        {creatingPix ? <Loader2 className="spin" size={16} /> : <CreditCard size={16} />}
                        Pix sandbox
                    </button>
                </div>
            </header>

            {loading && !payload ? (
                <div className="commerce-manager-empty page-loader">
                    <Loader2 className="spin" size={32} />
                    <strong>Carregando ecommerce</strong>
                    <span>Pedidos, compradores e pagamentos.</span>
                </div>
            ) : payload && stats ? (
                <section className="commerce-manager-shell">
                    <aside className="commerce-manager-nav">
                        {navItems.map(item => (
                            <button
                                key={item.key}
                                type="button"
                                className={activeTab === item.key ? 'active' : ''}
                                onClick={() => setActiveTab(item.key)}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                                <b>{item.count}</b>
                            </button>
                        ))}
                        <Link href="/admin/maintenance"><ShieldCheck size={17} /><span>Credenciais</span></Link>
                        <div className="commerce-manager-nav-status">
                            <span>Mercado Pago</span>
                            <strong>{diagnosticLoading ? 'Verificando' : diagnosticsReady ? 'Pronto' : diagnostics?.health === 'warn' ? 'Atencao' : 'Revisar'}</strong>
                            <small>{diagnostics?.config.mercado_pago_environment || 'sandbox'}</small>
                        </div>
                    </aside>

                    <main className={`commerce-manager-main ${activeTab === 'orders' || activeTab === 'messages' ? '' : 'is-cards'}`}>
                        <div className="commerce-manager-headerline">
                            <div>
                                <strong>{currentTitle}</strong>
                                <span>{stats.revenue_display} pagos | conversao {stats.conversion_rate}% | hoje {stats.today_revenue_display}</span>
                            </div>
                            <button type="button" onClick={runAutomations} disabled={running}>
                                {running ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
                                Processar
                            </button>
                        </div>

                        <div className="commerce-manager-kpis">
                            <div><span>Receita paga</span><strong>{stats.revenue_display}</strong></div>
                            <div><span>Hoje</span><strong>{stats.today_revenue_display}</strong></div>
                            <div><span>Pedidos</span><strong>{stats.total_orders}</strong></div>
                            <div><span>Conversao</span><strong>{stats.conversion_rate}%</strong></div>
                            <div><span>Pagos</span><strong>{stats.paid_orders}</strong></div>
                            <div><span>Pix pendentes</span><strong>{stats.pending_payment}</strong></div>
                            <div><span>Clientes</span><strong>{stats.customers}</strong></div>
                            <div><span>Mensagens</span><strong>{stats.messages}</strong></div>
                        </div>

                        {activeTab === 'orders' && (
                            <>
                                <div className="commerce-manager-toolbar">
                                    <div className="commerce-manager-search">
                                        <Search size={16} />
                                        <input
                                            value={orderSearch}
                                            onChange={event => setOrderSearch(event.target.value)}
                                            placeholder="Pesquisar pedido ou comprador"
                                        />
                                    </div>
                                    <div className="commerce-manager-segments">
                                        {(['all', 'paid', 'pending_payment', 'abandoned', 'expired'] as const).map(item => (
                                            <button
                                                key={item}
                                                type="button"
                                                className={orderFilter === item ? 'active' : ''}
                                                onClick={() => setOrderFilter(item)}
                                            >
                                                {item === 'all' ? 'Todos' : statusLabel(item)}
                                            </button>
                                        ))}
                                    </div>
                                    <button type="button"><BarChart3 size={15} /> Colunas</button>
                                    <span>{filteredOrders.length} de {orders.length} pedido(s)</span>
                                </div>

                                <div className="commerce-manager-workspace">
                                    <div className="commerce-manager-table-wrap">
                                        {filteredOrders.length === 0 ? (
                                            <div className="commerce-manager-empty">
                                                <ShoppingCart size={34} />
                                                <strong>Nenhum pedido encontrado</strong>
                                                <span>Ajuste busca ou filtro.</span>
                                            </div>
                                        ) : (
                                            <table className="commerce-manager-table">
                                                <thead>
                                                    <tr>
                                                        <th></th>
                                                        <th>Status</th>
                                                        <th>Pedido</th>
                                                        <th>Comprador</th>
                                                        <th>Produto</th>
                                                        <th>Valor</th>
                                                        <th>Pagamento</th>
                                                        <th>Recuperacao</th>
                                                        <th>Criado</th>
                                                        <th>Pago em</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredOrders.map(order => {
                                                        const selected = selectedOrder?.id === order.id
                                                        const itemTitle = order.items[0]?.title || 'Produto digital'
                                                        return (
                                                            <tr
                                                                key={order.id}
                                                                className={selected ? 'selected' : ''}
                                                                onClick={() => setSelectedOrderId(order.id)}
                                                            >
                                                                <td><input type="checkbox" readOnly checked={selected} /></td>
                                                                <td><StatusBadge status={order.status} /></td>
                                                                <td className="commerce-manager-name-cell">
                                                                    <strong>{order.order_number}</strong>
                                                                    <small>{shortText(order.id, 28)}</small>
                                                                </td>
                                                                <td className="commerce-manager-name-cell">
                                                                    <strong>{order.customer.name || 'Sem nome'}</strong>
                                                                    <small>{order.customer.email || order.customer.phone || '-'}</small>
                                                                </td>
                                                                <td className="commerce-manager-name-cell">
                                                                    <strong>{shortText(itemTitle, 36)}</strong>
                                                                    <small>{order.items.length > 1 ? `${order.items.length} itens` : '1 item'}</small>
                                                                </td>
                                                                <td><strong>{order.total_display}</strong></td>
                                                                <td>{statusLabel(order.payment?.status || order.status)}</td>
                                                                <td>{statusLabel(order.recovery_status)}</td>
                                                                <td>{dateTime(order.created_at)}</td>
                                                                <td>{dateTime(order.paid_at)}</td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>

                                    <aside className="commerce-manager-inspector">
                                        {selectedOrder ? (
                                            <>
                                                <section className="commerce-manager-inspector-head">
                                                    <span className="commerce-manager-avatar">{initials(orderCustomerLabel(selectedOrder))}</span>
                                                    <div>
                                                        <strong>{orderCustomerLabel(selectedOrder)}</strong>
                                                        <small>{selectedOrder.order_number}</small>
                                                    </div>
                                                </section>

                                                <div className="commerce-manager-detail-actions">
                                                    {selectedOrder.payment?.pix_ticket_url && (
                                                        <a href={selectedOrder.payment.pix_ticket_url} target="_blank" rel="noreferrer">
                                                            Abrir Pix <ExternalLink size={14} />
                                                        </a>
                                                    )}
                                                    <button type="button" onClick={runAutomations} disabled={running}>Recuperacao</button>
                                                </div>

                                                <section>
                                                    <h3>Status</h3>
                                                    <div className="commerce-manager-status-card">
                                                        <StatusBadge status={selectedOrder.status} />
                                                        <small>{statusLabel(selectedOrder.recovery_status)}</small>
                                                    </div>
                                                </section>

                                                <section>
                                                    <h3>Resumo</h3>
                                                    <div className="commerce-manager-detail-grid">
                                                        <div><span>Valor</span><strong>{selectedOrder.total_display}</strong></div>
                                                        <div><span>Itens</span><strong>{selectedOrder.items.length}</strong></div>
                                                        <div><span>Pagamento</span><strong>{statusLabel(selectedOrder.payment?.status || selectedOrder.status)}</strong></div>
                                                        <div><span>Metodo</span><strong>{selectedOrder.payment?.payment_method || 'pix'}</strong></div>
                                                    </div>
                                                </section>

                                                <section>
                                                    <h3>Comprador</h3>
                                                    <div className="commerce-manager-detail-list">
                                                        <span><b>Nome</b>{selectedOrder.customer.name || '-'}</span>
                                                        <span><b>Email</b>{selectedOrder.customer.email || '-'}</span>
                                                        <span><b>WhatsApp</b>{selectedOrder.customer.phone || '-'}</span>
                                                    </div>
                                                </section>

                                                <section>
                                                    <h3>Itens</h3>
                                                    <div className="commerce-manager-line-list">
                                                        {selectedOrder.items.map(item => (
                                                            <div key={item.id}>
                                                                <strong>{item.title}</strong>
                                                                <span>{item.item_type} | {item.total_display}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>

                                                <section>
                                                    <h3>Datas</h3>
                                                    <div className="commerce-manager-detail-list">
                                                        <span><b>Criado</b>{dateTime(selectedOrder.created_at)}</span>
                                                        <span><b>Atualizado</b>{dateTime(selectedOrder.updated_at)}</span>
                                                        <span><b>Pago</b>{dateTime(selectedOrder.paid_at)}</span>
                                                        <span><b>Pix vence</b>{dateTime(selectedOrder.pix_expires_at || selectedOrder.payment?.expires_at)}</span>
                                                    </div>
                                                </section>
                                            </>
                                        ) : (
                                            <div className="commerce-manager-empty small">
                                                <UserRound size={30} />
                                                <strong>Selecione um pedido</strong>
                                                <span>O comprador aparece aqui.</span>
                                            </div>
                                        )}
                                    </aside>
                                </div>
                            </>
                        )}

                        {activeTab === 'funnel' && (
                            <div className="commerce-manager-cards-view">
                                <section className="commerce-manager-card">
                                    <header>
                                        <div>
                                            <strong>Funil de checkout</strong>
                                            <span>Produtos digitais</span>
                                        </div>
                                        <Gauge size={18} />
                                    </header>
                                    <div className="commerce-manager-funnel">
                                        {payload.funnel.map(item => (
                                            <div key={item.key} className="commerce-manager-funnel-row">
                                                <div>
                                                    <span>{item.label}</span>
                                                    <strong>{item.count}</strong>
                                                </div>
                                                <em style={{ width: `${Math.max(4, (item.count / maxFunnelCount) * 100)}%` }} />
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="commerce-manager-card">
                                    <header>
                                        <div>
                                            <strong>Conversao</strong>
                                            <span>Compradores e acessos</span>
                                        </div>
                                        <TrendingUp size={18} />
                                    </header>
                                    <div className="commerce-manager-detail-grid wide">
                                        <div><span>Leads educacao</span><strong>{stats.education_leads}</strong></div>
                                        <div><span>Compradores</span><strong>{stats.paid_orders}</strong></div>
                                        <div><span>Clientes</span><strong>{stats.customers}</strong></div>
                                        <div><span>Taxa</span><strong>{stats.conversion_rate}%</strong></div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'diagnostics' && (
                            <div className="commerce-manager-cards-view">
                                <section className="commerce-manager-card">
                                    <header>
                                        <div>
                                            <strong>Pagamento</strong>
                                            <span>{diagnostics?.config.mercado_pago_environment || 'sandbox'}</span>
                                        </div>
                                        <div className="commerce-manager-card-actions">
                                            <button type="button" onClick={checkMercadoPago} disabled={diagnosticRunning || diagnosticLoading}>
                                                {diagnosticRunning ? <Loader2 className="spin" size={15} /> : <ShieldCheck size={15} />}
                                                Token
                                            </button>
                                            <button type="button" onClick={createPixSandbox} disabled={creatingPix || !canCreateSandboxPix}>
                                                {creatingPix ? <Loader2 className="spin" size={15} /> : <CreditCard size={15} />}
                                                Pix
                                            </button>
                                        </div>
                                    </header>

                                    {diagnosticLoading && !diagnostics ? (
                                        <div className="commerce-manager-empty compact">
                                            <Loader2 className="spin" size={24} />
                                            <strong>Verificando</strong>
                                        </div>
                                    ) : diagnostics ? (
                                        <>
                                            <div className="commerce-manager-diagnostic-summary">
                                                <StatusBadge status={diagnostics.health === 'ok' ? 'paid' : diagnostics.health === 'warn' ? 'pending_payment' : 'failed'} />
                                                <strong>{diagnostics.health === 'ok' ? 'Pronto' : diagnostics.health === 'warn' ? 'Atencao' : 'Revisar'}</strong>
                                                <small>{diagnostics.config.webhook_url}</small>
                                                {diagnostics.remote_mercado_pago && (
                                                    <small>Conta: {diagnostics.remote_mercado_pago.nickname || diagnostics.remote_mercado_pago.id}</small>
                                                )}
                                            </div>

                                            {diagnostics.activation && (
                                                <div className="commerce-manager-activation">
                                                    <div>
                                                        <strong>Ativacao Mercado Pago</strong>
                                                        <small>
                                                            {diagnostics.activation.ready_for_sandbox_pix
                                                                ? 'Pronto para Pix sandbox real.'
                                                                : diagnostics.activation.ready_for_production
                                                                    ? 'Pronto para producao.'
                                                                    : 'Configuracoes pendentes.'}
                                                        </small>
                                                    </div>
                                                    <StatusBadge status={diagnostics.activation.ready_for_sandbox_pix || diagnostics.activation.ready_for_production ? 'paid' : 'pending_payment'} />
                                                    <div className="commerce-manager-activation-grid">
                                                        <div><span>Public Key</span><strong>{diagnostics.activation.credential_summary.public_key_configured ? diagnostics.activation.credential_summary.public_key_kind : 'ausente'}</strong></div>
                                                        <div><span>Access Token</span><strong>{diagnostics.activation.credential_summary.access_token_configured ? diagnostics.activation.credential_summary.access_token_kind : 'ausente'}</strong></div>
                                                        <div><span>Webhook Secret</span><strong>{diagnostics.activation.credential_summary.webhook_secret_configured ? 'configurado' : 'ausente'}</strong></div>
                                                    </div>
                                                    {diagnostics.activation.next_steps.length > 0 && (
                                                        <div className="commerce-manager-activation-steps">
                                                            {diagnostics.activation.next_steps.slice(0, 4).map(step => <small key={step}>{step}</small>)}
                                                        </div>
                                                    )}
                                                    <Link href="/admin/maintenance">
                                                        <ExternalLink size={15} />
                                                        Credenciais
                                                    </Link>
                                                </div>
                                            )}

                                            <div className="commerce-manager-diagnostic-grid">
                                                {diagnostics.items.map(item => (
                                                    <div key={item.key} className={`commerce-manager-diagnostic-item is-${item.status}`}>
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
                                </section>

                                <section className="commerce-manager-card">
                                    <header>
                                        <div>
                                            <strong>Testes</strong>
                                            <span>Venda interna e Pix sandbox</span>
                                        </div>
                                        <FlaskConical size={18} />
                                    </header>

                                    <div className="commerce-manager-test-row">
                                        <div>
                                            <strong>Venda interna</strong>
                                            <span>Pedido diagnostico sem cobranca real.</span>
                                        </div>
                                        <button type="button" onClick={createInternalTestOrder} disabled={creatingInternalOrder || approvingInternalOrder}>
                                            {creatingInternalOrder ? <Loader2 className="spin" size={15} /> : <ShoppingCart size={15} />}
                                            Criar
                                        </button>
                                        <button type="button" onClick={approveInternalTestOrder} disabled={approvingInternalOrder || creatingInternalOrder || !latestDiagnosticOrder}>
                                            {approvingInternalOrder ? <Loader2 className="spin" size={15} /> : <CheckCircle2 size={15} />}
                                            Aprovar
                                        </button>
                                        {latestDiagnosticOrder && (
                                            <div className="commerce-manager-test-result">
                                                <StatusBadge status={latestDiagnosticOrder.status} />
                                                <strong>{latestDiagnosticOrder.order_number}</strong>
                                                <small>{latestDiagnosticOrder.total_display} | criado {dateTime(latestDiagnosticOrder.created_at || null)}</small>
                                                {internalDiagnostic?.fulfillment && (
                                                    <small>Acesso liberado: {internalDiagnostic.entitlements_count ?? internalDiagnostic.fulfillment.entitlements_count} produto(s).</small>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {sandboxPix && (
                                        <div className="commerce-manager-sandbox">
                                            <div>
                                                <strong>{sandboxPix.order.order_number}</strong>
                                                <small>{sandboxPix.order.total_display} | {statusLabel(sandboxPix.payment.status)} | vence {dateTime(sandboxPix.payment.expires_at)}</small>
                                            </div>
                                            <button type="button" onClick={syncSandboxPayment} disabled={syncingPix}>
                                                {syncingPix ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                                                Consultar
                                            </button>
                                            {sandboxPix.payment.pix_ticket_url && (
                                                <a href={sandboxPix.payment.pix_ticket_url} target="_blank" rel="noreferrer">
                                                    <ExternalLink size={15} />
                                                    Abrir
                                                </a>
                                            )}
                                            {sandboxPix.fulfillment && (
                                                <small className="commerce-manager-sandbox-result">
                                                    Pix aprovado e acesso liberado: {sandboxPix.entitlements_count ?? sandboxPix.fulfillment.entitlements_count} produto(s).
                                                </small>
                                            )}
                                            {sandboxPix.payment.pix_qr_code && (
                                                <textarea readOnly value={sandboxPix.payment.pix_qr_code} aria-label="Pix copia e cola sandbox" />
                                            )}
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {activeTab === 'messages' && (
                            <>
                                <div className="commerce-manager-toolbar">
                                    <div className="commerce-manager-search">
                                        <Search size={16} />
                                        <input
                                            value={messageSearch}
                                            onChange={event => setMessageSearch(event.target.value)}
                                            placeholder="Pesquisar mensagem"
                                        />
                                    </div>
                                    <span>{filteredMessages.length} de {messages.length} mensagem(ns)</span>
                                </div>
                                <div className="commerce-manager-cards-view">
                                    {filteredMessages.length === 0 ? (
                                        <div className="commerce-manager-empty">
                                            <MessageCircle size={34} />
                                            <strong>Nenhuma mensagem encontrada</strong>
                                        </div>
                                    ) : (
                                        <div className="commerce-manager-message-list">
                                            {filteredMessages.map(message => (
                                                <article key={message.id} className="commerce-manager-message">
                                                    <span>{channelIcon(message.channel)}</span>
                                                    <div>
                                                        <strong>{message.template_name || message.template_key}</strong>
                                                        <small>{message.recipient} | {dateTime(message.sent_at || message.created_at)}</small>
                                                        {message.error_message && <em>{message.error_message}</em>}
                                                    </div>
                                                    <StatusBadge status={message.status} />
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {activeTab === 'automation' && (
                            <div className="commerce-manager-cards-view">
                                <section className="commerce-manager-card">
                                    <header>
                                        <div>
                                            <strong>Regua automatica</strong>
                                            <span>{payload.automation.enabled ? 'Ativa' : 'Inativa'}</span>
                                        </div>
                                        <Settings2 size={18} />
                                    </header>
                                    <div className="commerce-manager-automation-grid">
                                        <div><span>Status</span><strong>{payload.automation.enabled ? 'Ativa' : 'Inativa'}</strong></div>
                                        <div><span>Carrinho abandonado</span><strong>{payload.automation.checkout_abandoned_after_minutes} min</strong></div>
                                        <div><span>Pix pendente</span><strong>{payload.automation.pix_pending_after_minutes} min</strong></div>
                                        <div><span>Pix vencendo</span><strong>{payload.automation.pix_expiring_before_minutes} min</strong></div>
                                        <div><span>Checkout perdido</span><strong>{payload.automation.checkout_lost_after_hours} h</strong></div>
                                        <div><span>Canais</span><strong>{payload.automation.whatsapp_enabled ? 'WhatsApp' : ''}{payload.automation.whatsapp_enabled && payload.automation.email_enabled ? ' + ' : ''}{payload.automation.email_enabled ? 'E-mail' : ''}</strong></div>
                                    </div>
                                    <div className="commerce-manager-card-actions">
                                        <button type="button" onClick={runAutomations} disabled={running}>
                                            {running ? <Loader2 className="spin" size={15} /> : <Activity size={15} />}
                                            Rodar agora
                                        </button>
                                        <Link href="/admin/maintenance">
                                            <ExternalLink size={15} />
                                            Configurar
                                        </Link>
                                    </div>
                                </section>

                                <section className="commerce-manager-card">
                                    <header>
                                        <div>
                                            <strong>Auditoria</strong>
                                            <span>Mensagens transacionais</span>
                                        </div>
                                        <FileText size={18} />
                                    </header>
                                    <div className="commerce-manager-detail-grid wide">
                                        <div><span>Total</span><strong>{stats.messages}</strong></div>
                                        <div><span>WhatsApp</span><strong>{payload.automation.whatsapp_enabled ? 'Ativo' : 'Inativo'}</strong></div>
                                        <div><span>Email</span><strong>{payload.automation.email_enabled ? 'Ativo' : 'Inativo'}</strong></div>
                                        <div><span>Leads</span><strong>{stats.education_leads}</strong></div>
                                    </div>
                                </section>
                            </div>
                        )}
                    </main>
                </section>
            ) : null}

            <style jsx>{`
                .commerce-manager-page {
                    min-height: 100vh;
                    color: var(--text-primary);
                    padding-bottom: 32px;
                }

                .commerce-manager-topbar {
                    position: sticky;
                    top: 0;
                    z-index: 20;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(17, 24, 39, .08);
                    background: color-mix(in srgb, var(--bg-primary) 93%, transparent);
                    backdrop-filter: blur(12px);
                }

                .commerce-manager-brand {
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    gap: 11px;
                }

                .commerce-manager-logo {
                    width: 42px;
                    height: 42px;
                    display: grid;
                    place-items: center;
                    border-radius: 10px;
                    background: #fff8e8;
                    color: #9a6a12;
                    border: 1px solid rgba(201, 169, 110, .32);
                    flex: 0 0 auto;
                }

                .commerce-manager-topbar h1 {
                    margin: 0;
                    color: var(--text-primary);
                    font-size: 1.5rem;
                    font-weight: 900;
                }

                .commerce-manager-topbar p {
                    margin: 4px 0 0;
                    color: var(--text-muted);
                    font-size: .78rem;
                    font-weight: 800;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .commerce-manager-actions,
                .commerce-manager-card-actions {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .commerce-manager-actions button,
                .commerce-manager-actions a,
                .commerce-manager-card-actions button,
                .commerce-manager-card-actions a,
                .commerce-manager-test-row button,
                .commerce-manager-sandbox button,
                .commerce-manager-sandbox a {
                    height: 36px;
                    border: 1px solid rgba(148, 163, 184, .42);
                    border-radius: 6px;
                    background: #fff;
                    color: var(--text-primary);
                    padding: 0 10px;
                    font-size: .74rem;
                    font-weight: 900;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    cursor: pointer;
                    white-space: nowrap;
                }

                .commerce-manager-actions button.primary {
                    border-color: rgba(201, 169, 110, .45);
                    background: var(--gold);
                    color: #17120c;
                }

                .commerce-manager-actions button:disabled,
                .commerce-manager-card-actions button:disabled,
                .commerce-manager-test-row button:disabled,
                .commerce-manager-sandbox button:disabled {
                    opacity: .55;
                    cursor: not-allowed;
                }

                .commerce-manager-shell {
                    margin-top: 14px;
                    height: calc(100vh - 142px);
                    min-height: 710px;
                    display: grid;
                    grid-template-columns: 238px minmax(0, 1fr);
                    border: 1px solid rgba(17, 24, 39, .12);
                    border-radius: 8px;
                    background: #fff;
                    overflow: hidden;
                    box-shadow: 0 12px 28px rgba(17, 24, 39, .07);
                }

                .commerce-manager-nav {
                    border-right: 1px solid rgba(17, 24, 39, .1);
                    background: #f8fafd;
                    padding: 12px 10px;
                    display: grid;
                    align-content: start;
                    gap: 4px;
                    overflow-y: auto;
                    scrollbar-width: thin;
                }

                .commerce-manager-nav button,
                .commerce-manager-nav a {
                    min-height: 40px;
                    border: 0;
                    border-radius: 0 20px 20px 0;
                    background: transparent;
                    color: #334155;
                    display: grid;
                    grid-template-columns: 22px minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 10px;
                    padding: 0 12px;
                    text-align: left;
                    text-decoration: none;
                    font-size: .78rem;
                    font-weight: 850;
                    cursor: pointer;
                }

                .commerce-manager-nav button.active {
                    background: #fff4db;
                    color: #9a6a12;
                }

                .commerce-manager-nav button b {
                    min-width: 22px;
                    height: 22px;
                    border-radius: 999px;
                    display: inline-grid;
                    place-items: center;
                    background: rgba(51, 65, 85, .09);
                    padding: 0 6px;
                    font-size: .64rem;
                }

                .commerce-manager-nav-status {
                    margin: 14px 6px 0;
                    border-top: 1px solid rgba(17, 24, 39, .1);
                    padding: 12px 6px;
                    display: grid;
                    gap: 3px;
                }

                .commerce-manager-nav-status span {
                    color: #64748b;
                    font-size: .65rem;
                    font-weight: 950;
                    text-transform: uppercase;
                }

                .commerce-manager-nav-status strong {
                    color: #0f172a;
                    font-size: .76rem;
                }

                .commerce-manager-nav-status small {
                    color: #64748b;
                    font-size: .68rem;
                }

                .commerce-manager-main {
                    min-width: 0;
                    display: grid;
                    grid-template-rows: auto auto auto minmax(0, 1fr);
                    background: #f1f3f4;
                }

                .commerce-manager-main.is-cards {
                    grid-template-rows: auto auto minmax(0, 1fr);
                }

                .commerce-manager-headerline {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 13px 16px;
                    border-bottom: 1px solid rgba(17, 24, 39, .1);
                    background: #fff;
                }

                .commerce-manager-headerline strong {
                    display: block;
                    color: #0f172a;
                    font-size: 1rem;
                    font-weight: 900;
                }

                .commerce-manager-headerline span {
                    display: block;
                    margin-top: 3px;
                    color: #64748b;
                    font-size: .72rem;
                    font-weight: 800;
                }

                .commerce-manager-headerline button,
                .commerce-manager-toolbar button {
                    height: 34px;
                    border: 1px solid rgba(148, 163, 184, .42);
                    border-radius: 17px;
                    background: #fff;
                    color: #9a6a12;
                    padding: 0 11px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    font-size: .72rem;
                    font-weight: 900;
                    cursor: pointer;
                }

                .commerce-manager-headerline button:disabled,
                .commerce-manager-toolbar button:disabled {
                    opacity: .58;
                    cursor: not-allowed;
                }

                .commerce-manager-kpis {
                    display: grid;
                    grid-template-columns: repeat(8, minmax(112px, 1fr));
                    overflow-x: auto;
                    border-bottom: 1px solid rgba(17, 24, 39, .1);
                    background: #fff;
                }

                .commerce-manager-kpis div {
                    min-width: 112px;
                    padding: 11px 13px;
                    border-right: 1px solid rgba(17, 24, 39, .07);
                }

                .commerce-manager-kpis span,
                .commerce-manager-detail-grid span,
                .commerce-manager-automation-grid span,
                .commerce-manager-activation-grid span {
                    display: block;
                    color: #64748b;
                    font-size: .63rem;
                    font-weight: 950;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }

                .commerce-manager-kpis strong {
                    display: block;
                    color: #0f172a;
                    font-size: .93rem;
                    white-space: nowrap;
                }

                .commerce-manager-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                    padding: 10px 12px;
                    border-bottom: 1px solid rgba(17, 24, 39, .1);
                    background: #fff;
                }

                .commerce-manager-toolbar > span {
                    margin-left: auto;
                    color: #64748b;
                    font-size: .72rem;
                    font-weight: 800;
                }

                .commerce-manager-search {
                    height: 38px;
                    min-width: 290px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid rgba(148, 163, 184, .42);
                    border-radius: 4px;
                    background: #fff;
                    padding: 0 10px;
                    color: #64748b;
                }

                .commerce-manager-search input {
                    border: 0;
                    outline: none;
                    width: 100%;
                    color: #0f172a;
                    background: transparent;
                    font-size: .8rem;
                }

                .commerce-manager-segments {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }

                .commerce-manager-segments button {
                    color: #334155;
                    padding: 0 12px;
                }

                .commerce-manager-segments button.active {
                    border-color: rgba(201, 169, 110, .55);
                    background: #fff4db;
                    color: #9a6a12;
                }

                .commerce-manager-workspace {
                    min-height: 0;
                    display: grid;
                    grid-template-columns: minmax(620px, 1fr) 360px;
                    background: #f1f3f4;
                }

                .commerce-manager-table-wrap {
                    min-width: 0;
                    overflow: auto;
                    background: #fff;
                    scrollbar-width: thin;
                }

                .commerce-manager-table {
                    width: 100%;
                    min-width: 1180px;
                    border-collapse: collapse;
                    font-size: .74rem;
                }

                .commerce-manager-table th {
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    background: #fff;
                    color: #64748b;
                    border-bottom: 1px solid rgba(17, 24, 39, .12);
                    padding: 10px 9px;
                    text-align: left;
                    font-size: .64rem;
                    font-weight: 950;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                .commerce-manager-table td {
                    border-bottom: 1px solid rgba(17, 24, 39, .07);
                    padding: 10px 9px;
                    color: #0f172a;
                    white-space: nowrap;
                    vertical-align: middle;
                }

                .commerce-manager-table tr {
                    cursor: pointer;
                }

                .commerce-manager-table tr:hover,
                .commerce-manager-table tr.selected {
                    background: #fffaf0;
                }

                .commerce-manager-table input {
                    width: 15px;
                    height: 15px;
                    accent-color: var(--gold);
                }

                .commerce-manager-status {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    border-radius: 999px;
                    color: var(--commerce-status);
                    background: color-mix(in srgb, var(--commerce-status) 11%, white);
                    padding: 5px 8px;
                    font-size: .68rem;
                    font-weight: 900;
                    white-space: nowrap;
                }

                .commerce-manager-status::before {
                    content: '';
                    width: 7px;
                    height: 7px;
                    border-radius: 999px;
                    background: var(--commerce-status);
                    flex: 0 0 auto;
                }

                .commerce-manager-name-cell {
                    min-width: 220px;
                    max-width: 360px;
                }

                .commerce-manager-name-cell strong {
                    display: block;
                    max-width: 320px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #0f172a;
                    font-weight: 900;
                }

                .commerce-manager-name-cell small,
                .commerce-manager-inspector small,
                .commerce-manager-card span,
                .commerce-manager-line-list span,
                .commerce-manager-message small {
                    display: block;
                    margin-top: 3px;
                    color: #64748b;
                    font-size: .68rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-manager-inspector {
                    min-width: 0;
                    overflow-y: auto;
                    border-left: 1px solid rgba(17, 24, 39, .12);
                    background: #fff;
                    padding: 14px;
                    display: grid;
                    align-content: start;
                    gap: 14px;
                    scrollbar-width: thin;
                }

                .commerce-manager-inspector section {
                    display: grid;
                    gap: 9px;
                    padding-bottom: 13px;
                    border-bottom: 1px solid rgba(17, 24, 39, .08);
                }

                .commerce-manager-inspector h3 {
                    margin: 0;
                    color: #0f172a;
                    font-size: .78rem;
                    font-weight: 950;
                }

                .commerce-manager-inspector-head {
                    display: flex !important;
                    align-items: center;
                    gap: 10px;
                }

                .commerce-manager-avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 999px;
                    display: grid;
                    place-items: center;
                    background: #fff4db;
                    color: #9a6a12;
                    font-weight: 950;
                    flex: 0 0 auto;
                }

                .commerce-manager-inspector-head div {
                    min-width: 0;
                    display: grid;
                    gap: 2px;
                }

                .commerce-manager-inspector-head strong {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: .88rem;
                }

                .commerce-manager-detail-actions {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .commerce-manager-detail-actions a,
                .commerce-manager-detail-actions button {
                    height: 34px;
                    border: 1px solid rgba(201, 169, 110, .35);
                    border-radius: 17px;
                    background: #fffaf0;
                    color: #9a6a12;
                    padding: 0 11px;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    text-decoration: none;
                    font-size: .72rem;
                    font-weight: 900;
                    cursor: pointer;
                }

                .commerce-manager-status-card {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                }

                .commerce-manager-status-card small {
                    color: #64748b;
                    font-size: .68rem;
                    font-weight: 800;
                }

                .commerce-manager-detail-grid,
                .commerce-manager-automation-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }

                .commerce-manager-detail-grid.wide,
                .commerce-manager-automation-grid {
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                }

                .commerce-manager-detail-grid div,
                .commerce-manager-automation-grid div,
                .commerce-manager-activation-grid div {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 6px;
                    background: #f8fafd;
                    padding: 9px;
                    min-width: 0;
                }

                .commerce-manager-detail-grid strong,
                .commerce-manager-automation-grid strong,
                .commerce-manager-activation-grid strong {
                    display: block;
                    color: #0f172a;
                    font-size: .84rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-manager-detail-list,
                .commerce-manager-line-list {
                    display: grid;
                    gap: 7px;
                }

                .commerce-manager-detail-list span {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    color: #0f172a;
                    font-size: .75rem;
                    min-width: 0;
                }

                .commerce-manager-detail-list b {
                    color: #64748b;
                    font-size: .68rem;
                    text-transform: uppercase;
                    flex: 0 0 auto;
                }

                .commerce-manager-line-list div {
                    border-left: 3px solid rgba(201, 169, 110, .55);
                    border-radius: 6px;
                    background: #fffaf0;
                    padding: 9px 10px;
                    min-width: 0;
                }

                .commerce-manager-line-list strong {
                    display: block;
                    color: #0f172a;
                    font-size: .76rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-manager-cards-view {
                    min-height: 0;
                    overflow: auto;
                    padding: 14px;
                    display: grid;
                    align-content: start;
                    gap: 12px;
                    scrollbar-width: thin;
                }

                .commerce-manager-card {
                    border: 1px solid rgba(17, 24, 39, .1);
                    border-radius: 8px;
                    background: #fff;
                    padding: 14px;
                    display: grid;
                    gap: 12px;
                }

                .commerce-manager-card header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    color: #9a6a12;
                }

                .commerce-manager-card header strong {
                    display: block;
                    color: #0f172a;
                    font-size: .9rem;
                    font-weight: 950;
                }

                .commerce-manager-funnel {
                    display: grid;
                    gap: 12px;
                }

                .commerce-manager-funnel-row {
                    display: grid;
                    gap: 7px;
                }

                .commerce-manager-funnel-row div {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    font-size: .82rem;
                }

                .commerce-manager-funnel-row span {
                    color: #334155;
                }

                .commerce-manager-funnel-row em {
                    height: 8px;
                    border-radius: 999px;
                    background: linear-gradient(90deg, #9a6a12, rgba(37, 99, 235, .24));
                }

                .commerce-manager-diagnostic-summary {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    padding: 11px 12px;
                    border: 1px solid rgba(148, 163, 184, .22);
                    border-radius: 7px;
                    background: #f8fafd;
                }

                .commerce-manager-diagnostic-summary small {
                    min-width: 0;
                    color: #64748b;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-manager-diagnostic-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                }

                .commerce-manager-diagnostic-item {
                    min-width: 0;
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr);
                    gap: 9px;
                    padding: 11px 12px;
                    border: 1px solid rgba(148, 163, 184, .2);
                    border-radius: 7px;
                    background: #fff;
                }

                .commerce-manager-diagnostic-item.is-ok {
                    border-color: rgba(22, 163, 74, .24);
                }

                .commerce-manager-diagnostic-item.is-warn {
                    border-color: rgba(217, 119, 6, .28);
                }

                .commerce-manager-diagnostic-item.is-error {
                    border-color: rgba(220, 38, 38, .3);
                }

                .commerce-manager-diagnostic-item > span {
                    color: #9a6a12;
                }

                .commerce-manager-diagnostic-item div {
                    min-width: 0;
                    display: grid;
                    gap: 4px;
                }

                .commerce-manager-diagnostic-item strong,
                .commerce-manager-diagnostic-item small {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-manager-diagnostic-item small {
                    color: #64748b;
                    font-size: .72rem;
                }

                .commerce-manager-activation {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto auto;
                    align-items: start;
                    gap: 12px;
                    padding: 12px;
                    border: 1px solid rgba(201, 169, 110, .34);
                    border-radius: 7px;
                    background: #fffaf0;
                }

                .commerce-manager-activation > div:first-child {
                    min-width: 0;
                    display: grid;
                    gap: 4px;
                }

                .commerce-manager-activation small {
                    color: #64748b;
                    line-height: 1.45;
                }

                .commerce-manager-activation-grid,
                .commerce-manager-activation-steps {
                    grid-column: 1 / -1;
                    display: grid;
                    gap: 8px;
                }

                .commerce-manager-activation-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }

                .commerce-manager-activation-steps {
                    padding-top: 10px;
                    border-top: 1px solid rgba(148, 163, 184, .2);
                }

                .commerce-manager-activation a {
                    height: 34px;
                    border: 1px solid rgba(148, 163, 184, .42);
                    border-radius: 17px;
                    background: #fff;
                    color: #9a6a12;
                    padding: 0 11px;
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    text-decoration: none;
                    font-size: .72rem;
                    font-weight: 900;
                }

                .commerce-manager-test-row,
                .commerce-manager-sandbox {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto auto;
                    align-items: center;
                    gap: 10px;
                    padding: 12px;
                    border: 1px solid rgba(22, 163, 74, .2);
                    border-radius: 7px;
                    background: #f0fdf4;
                }

                .commerce-manager-test-row > div:first-child,
                .commerce-manager-test-result,
                .commerce-manager-sandbox div {
                    min-width: 0;
                    display: grid;
                    gap: 3px;
                }

                .commerce-manager-test-row span,
                .commerce-manager-test-row small,
                .commerce-manager-sandbox small {
                    color: #64748b;
                    font-size: .72rem;
                }

                .commerce-manager-test-result {
                    grid-column: 1 / -1;
                    padding-top: 10px;
                    border-top: 1px solid rgba(148, 163, 184, .2);
                }

                .commerce-manager-sandbox {
                    border-color: rgba(37, 99, 235, .22);
                    background: #eff6ff;
                }

                .commerce-manager-sandbox-result {
                    grid-column: 1 / -1;
                    padding: 9px 10px;
                    border: 1px solid rgba(22, 163, 74, .24);
                    border-radius: 6px;
                    background: #f0fdf4;
                }

                .commerce-manager-sandbox textarea {
                    grid-column: 1 / -1;
                    width: 100%;
                    min-height: 72px;
                    padding: 10px;
                    border: 1px solid rgba(148, 163, 184, .28);
                    border-radius: 6px;
                    background: #fff;
                    color: #334155;
                    font: inherit;
                    resize: vertical;
                    box-sizing: border-box;
                }

                .commerce-manager-message-list {
                    display: grid;
                    gap: 9px;
                }

                .commerce-manager-message {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border: 1px solid rgba(17, 24, 39, .09);
                    border-radius: 7px;
                    background: #fff;
                }

                .commerce-manager-message > span:first-child {
                    color: #9a6a12;
                }

                .commerce-manager-message div {
                    min-width: 0;
                    display: grid;
                    gap: 3px;
                }

                .commerce-manager-message strong,
                .commerce-manager-message small,
                .commerce-manager-message em {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .commerce-manager-message em {
                    color: #dc2626;
                    font-size: .72rem;
                    font-style: normal;
                }

                .commerce-manager-empty {
                    min-height: 260px;
                    display: grid;
                    place-items: center;
                    align-content: center;
                    gap: 8px;
                    color: #64748b;
                    text-align: center;
                    padding: 24px;
                }

                .commerce-manager-empty.page-loader {
                    min-height: 420px;
                }

                .commerce-manager-empty.small {
                    min-height: 320px;
                }

                .commerce-manager-empty.compact {
                    min-height: 120px;
                }

                .commerce-manager-empty strong {
                    color: #0f172a;
                    font-size: .9rem;
                }

                .commerce-manager-empty span {
                    max-width: 360px;
                    font-size: .76rem;
                    line-height: 1.4;
                }

                .commerce-manager-toast {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border-radius: 12px;
                    background: #fff;
                    padding: 14px 20px;
                    box-shadow: 0 8px 30px rgba(0, 0, 0, .18);
                    font-size: .9rem;
                    font-weight: 750;
                    animation: commerceToastIn .35s ease-out;
                }

                .commerce-manager-toast.success {
                    border: 1px solid rgba(22, 163, 74, .28);
                    color: #15803d;
                }

                .commerce-manager-toast.error {
                    border: 1px solid rgba(220, 38, 38, .28);
                    color: #b91c1c;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @keyframes commerceToastIn {
                    from { opacity: 0; transform: translateY(-12px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 1180px) {
                    .commerce-manager-shell {
                        grid-template-columns: 78px minmax(0, 1fr);
                        height: auto;
                    }

                    .commerce-manager-nav {
                        padding-inline: 8px;
                    }

                    .commerce-manager-nav button,
                    .commerce-manager-nav a {
                        grid-template-columns: 1fr;
                        justify-items: center;
                        border-radius: 22px;
                        padding: 0 8px;
                    }

                    .commerce-manager-nav span,
                    .commerce-manager-nav b,
                    .commerce-manager-nav-status {
                        display: none;
                    }

                    .commerce-manager-workspace {
                        grid-template-columns: 1fr;
                    }

                    .commerce-manager-inspector {
                        border-left: 0;
                        border-top: 1px solid rgba(17, 24, 39, .12);
                    }

                    .commerce-manager-diagnostic-grid,
                    .commerce-manager-detail-grid.wide,
                    .commerce-manager-automation-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }

                @media (max-width: 760px) {
                    .commerce-manager-topbar {
                        position: static;
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .commerce-manager-actions {
                        justify-content: stretch;
                        width: 100%;
                    }

                    .commerce-manager-actions button,
                    .commerce-manager-actions a {
                        flex: 1 1 145px;
                    }

                    .commerce-manager-search {
                        flex: 1 1 100%;
                        min-width: 0;
                    }

                    .commerce-manager-kpis {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .commerce-manager-toolbar > span {
                        margin-left: 0;
                        width: 100%;
                    }

                    .commerce-manager-table {
                        min-width: 980px;
                    }

                    .commerce-manager-diagnostic-grid,
                    .commerce-manager-detail-grid.wide,
                    .commerce-manager-automation-grid,
                    .commerce-manager-activation,
                    .commerce-manager-activation-grid,
                    .commerce-manager-test-row,
                    .commerce-manager-sandbox {
                        grid-template-columns: 1fr;
                    }

                    .commerce-manager-message {
                        grid-template-columns: auto minmax(0, 1fr);
                    }

                    .commerce-manager-message .commerce-manager-status {
                        grid-column: 2;
                        justify-self: start;
                    }
                }
            `}</style>
        </div>
    )
}
