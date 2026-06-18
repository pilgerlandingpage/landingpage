'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
    AlertCircle,
    Bell,
    BellRing,
    CheckCircle2,
    ExternalLink,
    Loader2,
    Pause,
    Play,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-react'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { getVisitorId, trackEvent } from '@/lib/tracking/client'
import { markSearchAlertMatchOpenIfNeeded } from '@/lib/tracking/search-alert-session'

type SearchAlertMatchProperty = {
    id: string
    title?: string | null
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    price?: number | null
    featured_image?: string | null
    images?: string[] | null
    property_type?: string | null
    bedrooms?: number | null
    suites?: number | null
    parking_spaces?: number | null
    area_m2?: number | null
    area_private_m2?: number | null
    status?: string | null
}

type SearchAlertMatch = {
    id: string
    alert_id: string
    property_id: string
    match_score?: number | null
    match_reasons?: string[] | null
    metadata?: Record<string, any> | null
    notification_status?: string | null
    created_at?: string | null
    notified_at?: string | null
    property?: SearchAlertMatchProperty | SearchAlertMatchProperty[] | null
}

type SearchAlert = {
    id: string
    title: string
    status: 'active' | 'paused' | string
    selected_region?: string | null
    result_count?: number | null
    filters?: Array<{ label?: string; key?: string; value?: string }>
    search_params?: Record<string, string | string[]>
    notification_channels?: string[]
    match_count?: number | null
    last_matched_at?: string | null
    last_notified_at?: string | null
    created_at?: string | null
    updated_at?: string | null
    matches?: SearchAlertMatch[]
}

type SearchAlertsPanelProps = {
    buttonClassName?: string
}

function formatDate(value?: string | null) {
    if (!value) return 'Sem atividade'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Sem atividade'
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatCurrency(value?: number | null) {
    if (!value) return 'Sob consulta'
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    })
}

function alertFilterLabels(alert: SearchAlert) {
    const labels = Array.isArray(alert.filters)
        ? alert.filters.map(filter => filter?.label).filter(Boolean) as string[]
        : []
    return labels.slice(0, 4)
}

function getMatchProperty(match: SearchAlertMatch): SearchAlertMatchProperty | null {
    if (Array.isArray(match.property)) return match.property[0] || null
    return match.property || null
}

function getPropertyImage(property: SearchAlertMatchProperty | null) {
    if (!property) return '/images/brava-concetto/20_CL_BC_LIVING_FINAL_01_ANG_02_EF_web.jpg'
    const images = Array.isArray(property.images) ? property.images.filter(Boolean) : []
    return property.featured_image || images[0] || '/images/brava-concetto/20_CL_BC_LIVING_FINAL_01_ANG_02_EF_web.jpg'
}

function propertyLocation(property: SearchAlertMatchProperty | null) {
    if (!property) return ''
    return [property.neighborhood, property.city].filter(Boolean).join(' - ')
}

function asPlainRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function asStringArray(value: unknown) {
    return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : []
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
}

export default function SearchAlertsPanel({ buttonClassName = '' }: SearchAlertsPanelProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [alerts, setAlerts] = useState<SearchAlert[]>([])
    const [pushActive, setPushActive] = useState(false)
    const [actionId, setActionId] = useState<string | null>(null)
    const [pushState, setPushState] = useState<'idle' | 'saving' | 'active' | 'error'>('idle')
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)

    const activeAlerts = useMemo(() => alerts.filter(alert => alert.status === 'active'), [alerts])
    const totalMatches = useMemo(() => alerts.reduce((sum, alert) => sum + Number(alert.match_count || 0), 0), [alerts])

    useEffect(() => {
        setMounted(true)
    }, [])

    const loadAlerts = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const visitorCookieId = getVisitorId()
            const response = await fetch(`/api/search-alerts?status=visible&visitor_cookie_id=${encodeURIComponent(visitorCookieId)}`, {
                cache: 'no-store',
            })
            const data = await response.json().catch(() => ({}))

            if (!response.ok || !data?.success) {
                throw new Error(data?.error || `Falha ao carregar alertas (${response.status})`)
            }

            setAlerts(Array.isArray(data.alerts) ? data.alerts : [])
            setPushActive(Boolean(data.push_subscription_active))
            if (data.push_subscription_active) setPushState('active')
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : String(loadError))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadAlerts()

        const handleSaved = () => {
            void loadAlerts()
            setOpen(true)
        }

        window.addEventListener('pilger_search_alert_saved', handleSaved)
        return () => window.removeEventListener('pilger_search_alert_saved', handleSaved)
    }, [loadAlerts])

    const toggleOpen = () => {
        const nextOpen = !open
        setOpen(nextOpen)
        if (nextOpen) {
            void loadAlerts()
            void trackEvent('property_search_alerts_panel_opened', {
                active_alert_count: activeAlerts.length,
                total_alert_count: alerts.length,
            })
        }
    }

    const updateAlertStatus = async (alert: SearchAlert, status: 'active' | 'paused') => {
        setActionId(alert.id)
        setError(null)

        try {
            const response = await fetch(`/api/search-alerts/${encodeURIComponent(alert.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitor_cookie_id: getVisitorId(),
                    status,
                    source: 'search_alerts_panel',
                    page_path: window.location.pathname,
                }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok || !data?.success) throw new Error(data?.error || 'Falha ao atualizar alerta')
            await loadAlerts()
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : String(updateError))
        } finally {
            setActionId(null)
        }
    }

    const deleteAlert = async (alert: SearchAlert) => {
        if (!window.confirm('Remover este alerta salvo?')) return
        setActionId(alert.id)
        setError(null)

        try {
            const visitorCookieId = getVisitorId()
            const response = await fetch(`/api/search-alerts/${encodeURIComponent(alert.id)}?visitor_cookie_id=${encodeURIComponent(visitorCookieId)}`, {
                method: 'DELETE',
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok || !data?.success) throw new Error(data?.error || 'Falha ao remover alerta')
            await loadAlerts()
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : String(deleteError))
        } finally {
            setActionId(null)
        }
    }

    const enablePush = async () => {
        if (pushState === 'saving') return
        setPushState('saving')
        setError(null)

        void trackEvent('property_search_alert_push_requested', {
            source: 'search_alerts_panel',
            active_alert_count: activeAlerts.length,
        })

        try {
            if (!('Notification' in window)) throw new Error('Este navegador nao suporta notificacoes.')
            if (!('serviceWorker' in navigator)) throw new Error('Service Worker indisponivel neste navegador.')

            let permission = Notification.permission
            if (permission === 'default') {
                permission = await Notification.requestPermission()
            }

            if (permission !== 'granted') {
                await trackEvent('push_denied', {
                    source: 'search_alerts_panel',
                    permission,
                })
                throw new Error('Permissao de notificacao nao concedida.')
            }

            const visitorCookieId = getVisitorId()
            const trackResponse = await fetch('/api/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitor_cookie_id: visitorCookieId,
                    event_type: 'push_consent',
                    metadata: {
                        granted: true,
                        source: 'search_alerts_panel',
                    },
                }),
            })
            const trackData = await trackResponse.json().catch(() => ({}))
            const vapidPublicKey = trackData?.vapid_public_key || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            const visitorId = trackData?.visitor_id

            if (!visitorId) throw new Error('Visitante nao encontrado para salvar notificacao.')
            if (!vapidPublicKey) throw new Error('Chave publica de push nao configurada.')

            const swRegistration = await navigator.serviceWorker.register('/sw.js')
            await navigator.serviceWorker.ready
            const existingSubscription = await swRegistration.pushManager.getSubscription()
            const subscription = existingSubscription || await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            })

            const saveResponse = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitor_id: visitorId,
                    subscription: subscription.toJSON(),
                }),
            })

            if (!saveResponse.ok) {
                const data = await saveResponse.json().catch(() => ({}))
                throw new Error(data?.error || 'Falha ao salvar notificacao push.')
            }

            setPushActive(true)
            setPushState('active')
            await loadAlerts()
        } catch (pushError) {
            setPushState('error')
            setError(pushError instanceof Error ? pushError.message : String(pushError))
        }
    }

    return (
        <>
            <button
                type="button"
                className={`${buttonClassName} search-alerts-trigger ${open ? 'is-open' : ''}`.trim()}
                onClick={toggleOpen}
                aria-expanded={open}
                aria-label="Abrir meus alertas salvos"
            >
                <Bell size={15} />
                <span>Meus alertas</span>
                {activeAlerts.length > 0 && <strong className="search-alerts-trigger-count">{activeAlerts.length}</strong>}
            </button>

            {open && mounted && createPortal(
                <>
                    <button
                        type="button"
                        className="search-alerts-backdrop"
                        aria-label="Fechar meus alertas"
                        onClick={() => setOpen(false)}
                    />
                    <aside className="search-alerts-panel" aria-label="Meus alertas de busca">
                        <div className="search-alerts-head">
                            <div>
                                <span className="search-alerts-eyebrow">Alertas salvos</span>
                                <h2>Oportunidades monitoradas</h2>
                            </div>
                            <button type="button" className="search-alerts-icon-button" onClick={() => setOpen(false)} aria-label="Fechar">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="search-alerts-stats" aria-label="Resumo dos alertas">
                            <div>
                                <strong>{activeAlerts.length}</strong>
                                <span>ativos</span>
                            </div>
                            <div>
                                <strong>{totalMatches}</strong>
                                <span>matches</span>
                            </div>
                            <div>
                                <strong>{pushActive ? 'on' : 'off'}</strong>
                                <span>push</span>
                            </div>
                        </div>

                        <div className={`search-alerts-push ${pushActive ? 'is-active' : ''}`}>
                            {pushActive ? <CheckCircle2 size={18} /> : <BellRing size={18} />}
                            <div>
                                <strong>{pushActive ? 'Notificacoes ativas' : 'Ative avisos em tempo real'}</strong>
                                <p>{pushActive ? 'Quando um imovel bater com um alerta, o navegador recebe o aviso.' : 'Receba o aviso assim que uma oportunidade bater com seus criterios.'}</p>
                            </div>
                            {!pushActive && (
                                <button type="button" onClick={enablePush} disabled={pushState === 'saving'}>
                                    {pushState === 'saving' ? <Loader2 size={14} className="spin" /> : <Bell size={14} />}
                                    Ativar
                                </button>
                            )}
                        </div>

                        {error && (
                            <div className="search-alerts-error">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="search-alerts-toolbar">
                            <span>{alerts.length ? `${alerts.length} alerta(s) encontrados` : 'Nenhum alerta salvo ainda'}</span>
                            <button type="button" onClick={() => void loadAlerts()} disabled={loading} aria-label="Atualizar alertas">
                                {loading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
                            </button>
                        </div>

                        <div className="search-alerts-list">
                            {loading && alerts.length === 0 ? (
                                <div className="search-alerts-empty">
                                    <Loader2 size={22} className="spin" />
                                    <strong>Carregando alertas</strong>
                                </div>
                            ) : alerts.length === 0 ? (
                                <div className="search-alerts-empty">
                                    <BellRing size={24} />
                                    <strong>Salve uma busca para monitorar o mercado</strong>
                                    <span>Use filtros, mapa ou area desenhada e toque em Salvar alerta.</span>
                                </div>
                            ) : alerts.map(alert => {
                                const filters = alertFilterLabels(alert)
                                const isActionLoading = actionId === alert.id
                                const matches = Array.isArray(alert.matches) ? alert.matches : []

                                return (
                                    <article className={`search-alert-item search-alert-item--${alert.status}`} key={alert.id}>
                                        <div className="search-alert-item-head">
                                            <div>
                                                <h3>{alert.title || 'Alerta de busca'}</h3>
                                                <span>{alert.status === 'active' ? 'Ativo' : 'Pausado'} · atualizado {formatDate(alert.updated_at)}</span>
                                            </div>
                                            <div className="search-alert-item-actions">
                                                {alert.status === 'active' ? (
                                                    <button type="button" onClick={() => void updateAlertStatus(alert, 'paused')} disabled={isActionLoading} title="Pausar alerta" aria-label="Pausar alerta">
                                                        {isActionLoading ? <Loader2 size={15} className="spin" /> : <Pause size={15} />}
                                                    </button>
                                                ) : (
                                                    <button type="button" onClick={() => void updateAlertStatus(alert, 'active')} disabled={isActionLoading} title="Reativar alerta" aria-label="Reativar alerta">
                                                        {isActionLoading ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
                                                    </button>
                                                )}
                                                <button type="button" onClick={() => void deleteAlert(alert)} disabled={isActionLoading} title="Remover alerta" aria-label="Remover alerta">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="search-alert-item-meta">
                                            <span>{Number(alert.result_count || 0)} imoveis na busca</span>
                                            <span>{Number(alert.match_count || 0)} match(es)</span>
                                            {alert.selected_region && <span>{alert.selected_region}</span>}
                                        </div>

                                        {filters.length > 0 && (
                                            <div className="search-alert-filter-row">
                                                {filters.map(filter => <span key={filter}>{filter}</span>)}
                                            </div>
                                        )}

                                        {matches.length > 0 && (
                                            <div className="search-alert-matches">
                                                {matches.map(match => {
                                                    const property = getMatchProperty(match)
                                                    const propertyId = property?.id || match.property_id
                                                    const hrefParams = new URLSearchParams({
                                                        alert_id: alert.id,
                                                        utm_source: 'site',
                                                        utm_medium: 'search_alert_panel',
                                                        utm_campaign: 'property_search_alert',
                                                    })
                                                    if (alert.title) hrefParams.set('alert_title', alert.title.slice(0, 80))
                                                    const href = `${propertyDetailsPath(propertyId)}?${hrefParams.toString()}`
                                                    const matchMetadata = asPlainRecord(match.metadata)
                                                    const suggestedFollowup = asPlainRecord(matchMetadata.suggested_followup)
                                                    const suggestedMessage = String(matchMetadata.suggested_whatsapp_message || suggestedFollowup.message || '').trim()
                                                    const matchReasons = asStringArray(match.match_reasons).length
                                                        ? asStringArray(match.match_reasons)
                                                        : asStringArray(matchMetadata.match_reasons).length
                                                            ? asStringArray(matchMetadata.match_reasons)
                                                            : asStringArray(suggestedFollowup.match_reasons)
                                                    const propertyUrl = String(matchMetadata.property_url || suggestedFollowup.property_url || href).trim()
                                                    const followupPriority = String(matchMetadata.followup_priority || suggestedFollowup.priority || '').trim()
                                                    const followupTitle = String(suggestedFollowup.title || matchMetadata.followup_title || 'Retomar alerta salvo').trim()

                                                    return (
                                                        <Link
                                                            href={href}
                                                            key={match.id}
                                                            className="search-alert-match"
                                                            onClick={() => {
                                                                if (!markSearchAlertMatchOpenIfNeeded(alert.id, propertyId)) return
                                                                void trackEvent('property_search_alert_match_opened', {
                                                                    alert_id: alert.id,
                                                                    alert_title: alert.title,
                                                                    property_id: propertyId,
                                                                    property_title: property?.title || null,
                                                                    property_url: propertyUrl,
                                                                    match_score: match.match_score || null,
                                                                    match_reasons: matchReasons,
                                                                    suggested_message: suggestedMessage || null,
                                                                    suggested_followup: Object.keys(suggestedFollowup).length ? suggestedFollowup : null,
                                                                    followup_priority: followupPriority || null,
                                                                    followup_title: followupTitle,
                                                                    source: 'search_alerts_panel',
                                                                })
                                                            }}
                                                        >
                                                            <img src={getPropertyImage(property)} alt={property?.title || 'Imovel'} loading="lazy" />
                                                            <span>
                                                                <strong>{property?.title || 'Imovel encontrado'}</strong>
                                                                <small>{formatCurrency(property?.price || null)} · {propertyLocation(property) || 'Litoral SC'}</small>
                                                                {matchReasons.length > 0 && (
                                                                    <small className="search-alert-match-reasons">
                                                                        {matchReasons.slice(0, 2).join(' + ')}
                                                                    </small>
                                                                )}
                                                            </span>
                                                            <em>{match.match_score || 0}%</em>
                                                            <ExternalLink size={14} />
                                                        </Link>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </article>
                                )
                            })}
                        </div>
                    </aside>
                </>,
                document.body
            )}

            <style>{`
                .search-alerts-trigger {
                    position: relative;
                }
                .search-alerts-trigger-count {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 18px;
                    height: 18px;
                    padding: 0 5px;
                    border-radius: 999px;
                    background: #111;
                    color: #dfc18e;
                    font-size: 0.62rem;
                    font-weight: 900;
                }
                .search-alerts-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 9995;
                    border: 0;
                    background: rgba(12, 10, 8, 0.26);
                    cursor: pointer;
                }
                .search-alerts-panel {
                    position: fixed;
                    top: 76px;
                    right: 18px;
                    bottom: 18px;
                    z-index: 9996;
                    display: flex;
                    flex-direction: column;
                    width: min(430px, calc(100vw - 32px));
                    overflow: hidden;
                    border: 1px solid rgba(33, 28, 22, 0.12);
                    border-radius: 18px;
                    background: rgba(255, 254, 250, 0.98);
                    box-shadow: 0 24px 70px rgba(19, 15, 10, 0.22);
                    backdrop-filter: blur(18px);
                }
                .search-alerts-head {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 14px;
                    padding: 18px 18px 12px;
                    border-bottom: 1px solid rgba(184, 148, 95, 0.16);
                }
                .search-alerts-eyebrow {
                    display: block;
                    margin-bottom: 5px;
                    color: #a78042;
                    font: 900 0.64rem/1 'Inter', sans-serif;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                }
                .search-alerts-head h2 {
                    margin: 0;
                    color: #211d18;
                    font: 800 1.08rem/1.15 'Inter', sans-serif;
                    letter-spacing: 0;
                }
                .search-alerts-icon-button,
                .search-alert-item-actions button,
                .search-alerts-toolbar button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 34px;
                    height: 34px;
                    border: 1px solid rgba(33, 28, 22, 0.1);
                    border-radius: 50%;
                    background: #fff;
                    color: #2a261f;
                    cursor: pointer;
                }
                .search-alerts-icon-button:hover,
                .search-alert-item-actions button:hover,
                .search-alerts-toolbar button:hover {
                    border-color: rgba(184, 148, 95, 0.34);
                    color: #9a6d2f;
                }
                .search-alerts-stats {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 8px;
                    padding: 12px 18px;
                }
                .search-alerts-stats div {
                    min-width: 0;
                    padding: 10px;
                    border: 1px solid rgba(184, 148, 95, 0.14);
                    border-radius: 12px;
                    background: rgba(248, 246, 241, 0.74);
                }
                .search-alerts-stats strong {
                    display: block;
                    color: #211d18;
                    font: 900 1rem/1 'Inter', sans-serif;
                    text-transform: uppercase;
                }
                .search-alerts-stats span {
                    display: block;
                    margin-top: 4px;
                    color: #81786c;
                    font: 800 0.62rem/1 'Inter', sans-serif;
                    text-transform: uppercase;
                }
                .search-alerts-push {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    align-items: center;
                    gap: 10px;
                    margin: 0 18px 12px;
                    padding: 12px;
                    border: 1px solid rgba(184, 148, 95, 0.18);
                    border-radius: 14px;
                    background: #1c1915;
                    color: #dfc18e;
                }
                .search-alerts-push.is-active {
                    background: #f4fbf5;
                    border-color: rgba(41,126,73,0.22);
                    color: #1f7a45;
                }
                .search-alerts-push strong {
                    display: block;
                    color: inherit;
                    font: 900 0.78rem/1.2 'Inter', sans-serif;
                }
                .search-alerts-push p {
                    margin: 3px 0 0;
                    color: rgba(255,255,255,0.68);
                    font: 650 0.68rem/1.35 'Inter', sans-serif;
                }
                .search-alerts-push.is-active p {
                    color: #4f7b61;
                }
                .search-alerts-push button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    min-height: 32px;
                    padding: 0 10px;
                    border: 0;
                    border-radius: 999px;
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    color: #111;
                    cursor: pointer;
                    font: 900 0.68rem/1 'Inter', sans-serif;
                }
                .search-alerts-error {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0 18px 12px;
                    padding: 10px 12px;
                    border: 1px solid rgba(194,65,12,0.18);
                    border-radius: 12px;
                    background: #fff4f2;
                    color: #9a3412;
                    font: 750 0.72rem/1.35 'Inter', sans-serif;
                }
                .search-alerts-toolbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 0 18px 10px;
                    color: #81786c;
                    font: 800 0.68rem/1 'Inter', sans-serif;
                    text-transform: uppercase;
                }
                .search-alerts-list {
                    display: grid;
                    gap: 10px;
                    min-height: 0;
                    overflow: auto;
                    padding: 0 18px 18px;
                }
                .search-alert-item {
                    display: grid;
                    gap: 10px;
                    padding: 13px;
                    border: 1px solid rgba(184, 148, 95, 0.16);
                    border-radius: 14px;
                    background: #fff;
                    box-shadow: 0 12px 28px rgba(32, 25, 17, 0.06);
                }
                .search-alert-item--paused {
                    opacity: 0.72;
                    background: #f8f6f1;
                }
                .search-alert-item-head {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 10px;
                }
                .search-alert-item h3 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    margin: 0 0 5px;
                    color: #211d18;
                    font: 900 0.86rem/1.2 'Inter', sans-serif;
                    letter-spacing: 0;
                }
                .search-alert-item-head span,
                .search-alert-item-meta span {
                    color: #81786c;
                    font: 750 0.66rem/1.2 'Inter', sans-serif;
                }
                .search-alert-item-actions {
                    display: inline-flex;
                    gap: 6px;
                    flex: 0 0 auto;
                }
                .search-alert-item-meta,
                .search-alert-filter-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }
                .search-alert-item-meta span,
                .search-alert-filter-row span {
                    padding: 5px 8px;
                    border-radius: 999px;
                    background: rgba(248, 246, 241, 0.9);
                    color: #5e5549;
                }
                .search-alert-filter-row span {
                    background: #fbf7ef;
                    color: #8a672e;
                    font: 850 0.64rem/1 'Inter', sans-serif;
                }
                .search-alert-matches {
                    display: grid;
                    gap: 8px;
                }
                .search-alert-match {
                    display: grid;
                    grid-template-columns: 54px 1fr auto auto;
                    align-items: center;
                    gap: 9px;
                    min-width: 0;
                    padding: 7px;
                    border: 1px solid rgba(31,27,21,0.08);
                    border-radius: 12px;
                    background: #faf8f4;
                    color: inherit;
                    text-decoration: none;
                }
                .search-alert-match img {
                    width: 54px;
                    height: 44px;
                    object-fit: cover;
                    border-radius: 8px;
                    background: #e5ded2;
                }
                .search-alert-match span {
                    min-width: 0;
                }
                .search-alert-match strong {
                    display: block;
                    overflow: hidden;
                    color: #211d18;
                    font: 850 0.72rem/1.2 'Inter', sans-serif;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .search-alert-match small {
                    display: block;
                    overflow: hidden;
                    margin-top: 3px;
                    color: #81786c;
                    font: 700 0.62rem/1.2 'Inter', sans-serif;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .search-alert-match small.search-alert-match-reasons {
                    color: #9a6d2f;
                    font-weight: 850;
                }
                .search-alert-match em {
                    min-width: 38px;
                    padding: 5px 7px;
                    border-radius: 999px;
                    background: #1c1915;
                    color: #dfc18e;
                    font: normal 900 0.62rem/1 'Inter', sans-serif;
                    text-align: center;
                }
                .search-alerts-empty {
                    display: grid;
                    justify-items: center;
                    gap: 8px;
                    padding: 28px 18px;
                    border: 1px dashed rgba(184, 148, 95, 0.28);
                    border-radius: 14px;
                    background: rgba(255,255,255,0.7);
                    color: #81786c;
                    text-align: center;
                }
                .search-alerts-empty strong {
                    color: #211d18;
                    font: 900 0.86rem/1.25 'Inter', sans-serif;
                }
                .search-alerts-empty span {
                    font: 700 0.72rem/1.4 'Inter', sans-serif;
                }
                .spin {
                    animation: searchAlertsSpin 0.8s linear infinite;
                }
                @keyframes searchAlertsSpin {
                    to { transform: rotate(360deg); }
                }
                @media (max-width: 649px) {
                    .search-alerts-trigger-count {
                        position: absolute;
                        top: -5px;
                        right: -5px;
                    }
                    .search-alerts-panel {
                        top: auto;
                        right: 0;
                        bottom: 0;
                        left: 0;
                        width: 100%;
                        max-height: 82dvh;
                        border-radius: 20px 20px 0 0;
                    }
                    .search-alerts-head {
                        padding: 16px 16px 10px;
                    }
                    .search-alerts-stats {
                        padding: 10px 16px;
                    }
                    .search-alerts-push,
                    .search-alerts-error {
                        margin-right: 16px;
                        margin-left: 16px;
                    }
                    .search-alerts-toolbar,
                    .search-alerts-list {
                        padding-right: 16px;
                        padding-left: 16px;
                    }
                    .search-alert-match {
                        grid-template-columns: 48px 1fr auto;
                    }
                    .search-alert-match svg {
                        display: none;
                    }
                    .search-alert-match img {
                        width: 48px;
                    }
                }
            `}</style>
        </>
    )
}
