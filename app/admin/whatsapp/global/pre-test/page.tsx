'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ClipboardList,
    Copy,
    Database,
    ExternalLink,
    Loader2,
    MessageSquareText,
    RefreshCw,
    Route,
    ShieldCheck,
    Sparkles,
    XCircle,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

type CheckStatus = 'ok' | 'warn' | 'missing'

type CheckItem = {
    key: string
    label: string
    status: CheckStatus
    detail: string
    meta?: Record<string, unknown>
}

type CheckSection = {
    key: string
    label: string
    status: CheckStatus
    score: number
    items: CheckItem[]
}

type PreTestPayload = {
    success: boolean
    generated_at: string
    status: CheckStatus
    score: number
    blockers: number
    warnings: number
    summary: {
        public_url: string
        required_webhook_url: string
        connected_instances: number
        global_instance: {
            id: string
            instance_name: string | null
            instance_type: string | null
            status: string | null
            phone_masked: string
            has_token: boolean
            connected_at: string | null
            updated_at: string | null
        } | null
        counts: Record<string, number>
    }
    identity_matrix?: Array<{
        key: string
        label: string
        detected: number
        ready: boolean
        permissions: string[]
        expected_behavior: string
    }>
    sections: CheckSection[]
    test_plan?: Array<{
        key: string
        label: string
        message: string
        expected: string
    }>
    test_messages: Array<{
        key: string
        label: string
        text: string
        expected?: string
    }>
    links: Array<{
        label: string
        href: string
    }>
}

const statusCopy: Record<CheckStatus, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
    ok: { label: 'Pronto', tone: 'ok', icon: CheckCircle2 },
    warn: { label: 'Atencao', tone: 'warn', icon: AlertTriangle },
    missing: { label: 'Bloqueado', tone: 'risk', icon: XCircle },
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

function statusMeta(status: CheckStatus) {
    return statusCopy[status] || statusCopy.warn
}

function SectionIcon({ keyName }: { keyName: string }) {
    if (keyName === 'webhook') return <Route size={18} />
    if (keyName === 'identity') return <ShieldCheck size={18} />
    if (keyName === 'vitor') return <Sparkles size={18} />
    if (keyName === 'central') return <Database size={18} />
    if (keyName === 'automation') return <RefreshCw size={18} />
    return <MessageSquareText size={18} />
}

function StatusBadge({ status }: { status: CheckStatus }) {
    const meta = statusMeta(status)
    const Icon = meta.icon
    return (
        <span className={`pretest-badge ${meta.tone}`}>
            <Icon size={14} />
            {meta.label}
        </span>
    )
}

function ScoreRing({ score, status }: { score: number; status: CheckStatus }) {
    const meta = statusMeta(status)
    return (
        <div className={`pretest-score-ring ${meta.tone}`} style={{ ['--score' as string]: `${score}%` }}>
            <strong>{score}</strong>
            <span>%</span>
        </div>
    )
}

function ItemRow({ item }: { item: CheckItem }) {
    const meta = statusMeta(item.status)
    const Icon = meta.icon
    return (
        <li className={`pretest-item ${meta.tone}`}>
            <span className="pretest-item-icon"><Icon size={17} /></span>
            <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
            </div>
        </li>
    )
}

function SummaryMetric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
    return (
        <article className="pretest-metric">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
        </article>
    )
}

export default function WhatsAppGlobalPreTestPage() {
    const [data, setData] = useState<PreTestPayload | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')
    const [toast, setToast] = useState('')

    const loadData = async (silent = false) => {
        if (silent) setRefreshing(true)
        else setLoading(true)
        setError('')
        try {
            const response = await fetch('/api/admin/whatsapp/global/pre-test', { cache: 'no-store' })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Nao foi possivel carregar o pre-teste.')
            setData(payload)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido.')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        loadData(false)
    }, [])

    const orderedSections = useMemo(() => data?.sections || [], [data?.sections])
    const counts = data?.summary?.counts || {}
    const status = data?.status || 'warn'
    const meta = statusMeta(status)
    const HeaderIcon = meta.icon

    const copyText = async (text: string) => {
        if (typeof navigator === 'undefined') return
        await navigator.clipboard.writeText(text)
        setToast('Mensagem copiada.')
        window.setTimeout(() => setToast(''), 2200)
    }

    if (loading) {
        return <AdminLoadingState message="Validando WhatsApp Global, Vitor e Central..." />
    }

    if (error) {
        return (
            <div className="admin-page pretest-page">
                <div className="pretest-error">
                    <XCircle size={28} />
                    <h2>Falha ao carregar pre-teste</h2>
                    <p>{error}</p>
                    <button type="button" className="btn btn-gold" onClick={() => loadData(false)}>
                        <RefreshCw size={16} /> Tentar novamente
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="admin-page pretest-page">
            {toast && <div className="pretest-toast"><CheckCircle2 size={16} /> {toast}</div>}

            <div className="admin-header pretest-header">
                <div>
                    <Link href="/admin/whatsapp/global" className="back-link">
                        <ArrowLeft size={18} /> WhatsApp Global
                    </Link>
                    <h1>Pre-teste Global + Vitor</h1>
                    <p>Checklist operacional antes dos testes ponta a ponta pelo WhatsApp.</p>
                </div>
                <div className="pretest-header-actions">
                    <Link href="/admin/ads/vitor" className="btn btn-outline">
                        <Sparkles size={16} /> Vitor
                    </Link>
                    <button type="button" className="btn btn-gold" disabled={refreshing} onClick={() => loadData(true)}>
                        {refreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                        Atualizar
                    </button>
                </div>
            </div>

            {data && (
                <>
                    <section className={`pretest-hero ${meta.tone}`}>
                        <div className="pretest-hero-main">
                            <ScoreRing score={data.score} status={data.status} />
                            <div>
                                <span className={`pretest-status-line ${meta.tone}`}>
                                    <HeaderIcon size={18} /> {meta.label}
                                </span>
                                <h2>{data.status === 'ok' ? 'Fluxo pronto para bateria de testes.' : data.status === 'warn' ? 'Fluxo utilizavel com pontos de atencao.' : 'Ha bloqueios antes do teste completo.'}</h2>
                                <p>Gerado em {formatDateTime(data.generated_at)}. Instancias conectadas: {data.summary.connected_instances}.</p>
                            </div>
                        </div>
                        <div className="pretest-hero-side">
                            <span>{data.blockers} bloqueio(s)</span>
                            <span>{data.warnings} alerta(s)</span>
                            <small>{data.summary.required_webhook_url}</small>
                        </div>
                    </section>

                    <section className="pretest-metrics">
                        <SummaryMetric label="Global" value={counts.whatsapp_global_commands || 0} hint="comandos registrados" />
                        <SummaryMetric label="Identidade" value={counts.admins_with_phone || 0} hint="admins com telefone" />
                        <SummaryMetric label="Vitor" value={counts.vitor_reviews || 0} hint="reviews de criativo" />
                        <SummaryMetric label="Central" value={counts.ecosystem_events || 0} hint="eventos consolidados" />
                    </section>

                    <section className="pretest-identity-matrix">
                        <div className="pretest-section-title">
                            <ShieldCheck size={18} />
                            <div>
                                <h2>Matriz de reconhecimento</h2>
                                <p>Perfis que o WhatsApp Global deve separar antes de qualquer atendimento como lead.</p>
                            </div>
                        </div>
                        <div className="pretest-identity-grid">
                            {(data.identity_matrix || []).map(row => (
                                <article key={row.key} className={row.ready ? 'ready' : 'attention'}>
                                    <span>{row.ready ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {row.label}</span>
                                    <strong>{row.detected}</strong>
                                    <p>{row.expected_behavior}</p>
                                    <small>{row.permissions.join(', ')}</small>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="pretest-links">
                        {(data.links || []).map(link => (
                            <Link key={link.href} href={link.href}>
                                <ExternalLink size={15} />
                                {link.label}
                            </Link>
                        ))}
                    </section>

                    <section className="pretest-grid">
                        {orderedSections.map(section => (
                            <article key={section.key} className="pretest-section">
                                <div className="pretest-section-head">
                                    <div>
                                        <span><SectionIcon keyName={section.key} /> {section.label}</span>
                                        <strong>{section.score}%</strong>
                                    </div>
                                    <StatusBadge status={section.status} />
                                </div>
                                <ul>
                                    {section.items.map(row => <ItemRow key={row.key} item={row} />)}
                                </ul>
                            </article>
                        ))}
                    </section>

                    <section className="pretest-test-messages">
                        <div className="pretest-section-title">
                            <ClipboardList size={18} />
                            <div>
                                <h2>Bateria final de testes</h2>
                                <p>Execute em ordem quando o checklist estiver verde ou para isolar um ponto especifico.</p>
                            </div>
                        </div>
                        <div className="pretest-message-grid">
                            {data.test_messages.map(message => (
                                <article key={message.key} className="pretest-message">
                                    <span>{message.label}</span>
                                    <p>{message.text}</p>
                                    {message.expected && <small>{message.expected}</small>}
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => copyText(message.text)}>
                                        <Copy size={14} /> Copiar
                                    </button>
                                </article>
                            ))}
                        </div>
                    </section>
                </>
            )}

            <style jsx global>{`
                .pretest-page {
                    color: #17231f;
                }

                .pretest-header,
                .pretest-header-actions,
                .pretest-hero,
                .pretest-hero-main,
                .pretest-hero-side,
                .pretest-links,
                .pretest-section-head,
                .pretest-section-head > div,
                .pretest-item,
                .pretest-badge,
                .pretest-status-line,
                .pretest-section-title,
                .pretest-toast {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .pretest-header {
                    justify-content: space-between;
                    gap: 16px;
                }

                .pretest-header h1 {
                    margin: 6px 0 4px;
                    font-size: 1.9rem;
                    letter-spacing: 0;
                }

                .pretest-header p {
                    margin: 0;
                    color: #64746d;
                }

                .pretest-header-actions {
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }

                .pretest-hero {
                    justify-content: space-between;
                    align-items: stretch;
                    margin: 24px 0;
                    padding: 22px;
                    border: 1px solid #dfe8e2;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #f6faf7 0%, #eef6f2 100%);
                }

                .pretest-hero.warn {
                    background: linear-gradient(135deg, #fffaf0 0%, #f6f8f4 100%);
                    border-color: #f1d69b;
                }

                .pretest-hero.risk {
                    background: linear-gradient(135deg, #fff6f4 0%, #f7f1ef 100%);
                    border-color: #efb5a8;
                }

                .pretest-hero-main {
                    align-items: center;
                    min-width: 0;
                }

                .pretest-hero-main h2 {
                    margin: 8px 0 6px;
                    font-size: 1.35rem;
                    letter-spacing: 0;
                }

                .pretest-hero-main p,
                .pretest-hero-side small,
                .pretest-section-title p {
                    margin: 0;
                    color: #66766f;
                }

                .pretest-hero-side {
                    flex-direction: column;
                    align-items: flex-end;
                    justify-content: center;
                    min-width: 260px;
                    text-align: right;
                }

                .pretest-hero-side span {
                    font-weight: 700;
                }

                .pretest-hero-side small {
                    max-width: 420px;
                    word-break: break-word;
                }

                .pretest-score-ring {
                    width: 96px;
                    height: 96px;
                    flex: 0 0 96px;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    background:
                        radial-gradient(circle at center, #fff 58%, transparent 60%),
                        conic-gradient(#1f8f5f var(--score), #dfe8e2 0);
                    color: #1f8f5f;
                }

                .pretest-score-ring.warn {
                    background:
                        radial-gradient(circle at center, #fff 58%, transparent 60%),
                        conic-gradient(#b7791f var(--score), #eadfcb 0);
                    color: #9b5d0b;
                }

                .pretest-score-ring.risk {
                    background:
                        radial-gradient(circle at center, #fff 58%, transparent 60%),
                        conic-gradient(#c2412f var(--score), #efd1ca 0);
                    color: #a83224;
                }

                .pretest-score-ring strong {
                    font-size: 1.65rem;
                    line-height: 1;
                }

                .pretest-score-ring span {
                    margin-top: -24px;
                    font-size: .75rem;
                    font-weight: 700;
                }

                .pretest-status-line {
                    width: fit-content;
                    font-weight: 800;
                    font-size: .82rem;
                    text-transform: uppercase;
                    color: #1f8f5f;
                }

                .pretest-status-line.warn {
                    color: #a86509;
                }

                .pretest-status-line.risk {
                    color: #b53627;
                }

                .pretest-metrics,
                .pretest-identity-grid,
                .pretest-grid,
                .pretest-message-grid {
                    display: grid;
                    gap: 14px;
                }

                .pretest-metrics {
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    margin-bottom: 16px;
                }

                .pretest-identity-matrix {
                    margin-bottom: 18px;
                }

                .pretest-identity-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    margin-top: 12px;
                }

                .pretest-metric,
                .pretest-identity-grid article,
                .pretest-section,
                .pretest-message {
                    border: 1px solid #dfe8e2;
                    border-radius: 8px;
                    background: #fff;
                }

                .pretest-metric {
                    padding: 16px;
                }

                .pretest-identity-grid article {
                    display: grid;
                    gap: 8px;
                    padding: 14px;
                    border-left: 4px solid #1f8f5f;
                }

                .pretest-identity-grid article.attention {
                    border-left-color: #b7791f;
                }

                .pretest-identity-grid article span {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    color: #244238;
                    font-size: .8rem;
                    font-weight: 800;
                }

                .pretest-identity-grid article strong {
                    font-size: 1.55rem;
                    line-height: 1;
                }

                .pretest-identity-grid article p,
                .pretest-identity-grid article small,
                .pretest-message small {
                    margin: 0;
                    color: #66766f;
                    font-size: .78rem;
                    line-height: 1.35;
                }

                .pretest-metric span,
                .pretest-message span {
                    display: block;
                    color: #66766f;
                    font-size: .82rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .pretest-metric strong {
                    display: block;
                    margin-top: 8px;
                    font-size: 1.65rem;
                }

                .pretest-metric small {
                    color: #66766f;
                }

                .pretest-links {
                    flex-wrap: wrap;
                    margin-bottom: 18px;
                }

                .pretest-links a {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 9px 12px;
                    border: 1px solid #dfe8e2;
                    border-radius: 8px;
                    color: #244238;
                    text-decoration: none;
                    background: #fff;
                    font-weight: 700;
                }

                .pretest-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    align-items: start;
                }

                .pretest-section {
                    overflow: hidden;
                }

                .pretest-section-head {
                    justify-content: space-between;
                    padding: 15px 16px;
                    border-bottom: 1px solid #edf2ee;
                    background: #f8fbf9;
                }

                .pretest-section-head span {
                    font-weight: 800;
                }

                .pretest-section-head strong {
                    color: #60736b;
                }

                .pretest-section ul {
                    list-style: none;
                    margin: 0;
                    padding: 8px 0;
                }

                .pretest-item {
                    align-items: flex-start;
                    padding: 11px 16px;
                }

                .pretest-item + .pretest-item {
                    border-top: 1px solid #f0f4f1;
                }

                .pretest-item-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    display: inline-grid;
                    place-items: center;
                    background: #e7f5ed;
                    color: #1f8f5f;
                    flex: 0 0 28px;
                }

                .pretest-item.warn .pretest-item-icon {
                    background: #fff0d2;
                    color: #a86509;
                }

                .pretest-item.risk .pretest-item-icon {
                    background: #ffe2dc;
                    color: #b53627;
                }

                .pretest-item strong {
                    display: block;
                    margin-bottom: 3px;
                }

                .pretest-item p,
                .pretest-message p {
                    margin: 0;
                    color: #5d6d66;
                    line-height: 1.45;
                }

                .pretest-badge {
                    gap: 6px;
                    padding: 6px 9px;
                    border-radius: 999px;
                    font-size: .78rem;
                    font-weight: 800;
                    background: #e7f5ed;
                    color: #1f7f58;
                    white-space: nowrap;
                }

                .pretest-badge.warn {
                    background: #fff0d2;
                    color: #915705;
                }

                .pretest-badge.risk {
                    background: #ffe2dc;
                    color: #a83224;
                }

                .pretest-test-messages {
                    margin-top: 18px;
                    padding-bottom: 28px;
                }

                .pretest-section-title {
                    align-items: flex-start;
                    margin-bottom: 12px;
                }

                .pretest-section-title h2 {
                    margin: 0 0 3px;
                    font-size: 1.2rem;
                    letter-spacing: 0;
                }

                .pretest-message-grid {
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                }

                .pretest-message {
                    padding: 14px;
                    min-height: 190px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .pretest-message p {
                    flex: 1;
                    font-size: .92rem;
                }

                .pretest-message small {
                    display: block;
                    min-height: 40px;
                }

                .pretest-message button {
                    width: fit-content;
                }

                .pretest-toast {
                    position: fixed;
                    right: 24px;
                    bottom: 24px;
                    z-index: 50;
                    padding: 11px 14px;
                    border-radius: 8px;
                    background: #18362d;
                    color: #fff;
                    font-weight: 700;
                    box-shadow: 0 10px 28px rgba(0, 0, 0, .18);
                }

                .pretest-error {
                    max-width: 620px;
                    margin: 90px auto;
                    padding: 24px;
                    border: 1px solid #efc4bb;
                    border-radius: 8px;
                    background: #fff7f5;
                    text-align: center;
                }

                .pretest-error svg {
                    color: #b53627;
                }

                .pretest-error h2 {
                    margin: 10px 0 8px;
                }

                .spin {
                    animation: pretest-spin 1s linear infinite;
                }

                @keyframes pretest-spin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 1180px) {
                    .pretest-identity-grid,
                    .pretest-message-grid {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                    }
                }

                @media (max-width: 980px) {
                    .pretest-header,
                    .pretest-hero {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .pretest-hero-side {
                        align-items: flex-start;
                        min-width: 0;
                        text-align: left;
                    }

                    .pretest-metrics,
                    .pretest-identity-grid,
                    .pretest-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 720px) {
                    .pretest-hero-main {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .pretest-header-actions {
                        justify-content: flex-start;
                    }

                    .pretest-message-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}
