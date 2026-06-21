'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin, X } from 'lucide-react'
import { getVisitorId, isTrackingDisabled } from '@/lib/tracking/client'

type GeoCapturePromptProps = {
    visitorId?: string
}

type PromptState = 'idle' | 'prompt' | 'capturing' | 'done' | 'hidden'

const DISMISS_DAYS = 14
const GRANTED_HOURS = 24

function daysAgo(days: number) {
    return Date.now() - days * 24 * 60 * 60 * 1000
}

function hoursAgo(hours: number) {
    return Date.now() - hours * 60 * 60 * 1000
}

function readStoredState(key: string) {
    if (typeof window === 'undefined') return null
    try {
        return JSON.parse(localStorage.getItem(key) || 'null')
    } catch {
        return null
    }
}

function writeStoredState(key: string, value: Record<string, unknown>) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(key, JSON.stringify({ ...value, updated_at: Date.now() }))
    } catch {
        // Ignore storage errors; location capture can still work for this session.
    }
}

function hasLeadSignal(params: URLSearchParams) {
    return Boolean(
        params.get('lead_id')
        || params.get('lead_phone')
        || params.get('wa_phone')
        || params.get('wpp_phone')
    )
}

function hasEditorialOrCrmSignal(params: URLSearchParams) {
    const values = [
        params.get('utm_source'),
        params.get('utm_medium'),
        params.get('utm_campaign'),
        params.get('event_type'),
        params.get('link_type'),
    ].join(' ').toLowerCase()

    return /(whatsapp|wpp|brevo|email|blog|news|noticia|editorial)/i.test(values)
}

function isUsefulPath(pathname: string) {
    return [
        '/blog',
        '/noticias',
        '/imovel',
        '/imoveis',
        '/busca',
        '/eventos',
    ].some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function leadStorageKey(params: URLSearchParams) {
    const leadId = params.get('lead_id')
    if (leadId) return `lead_${leadId}`

    const phone = params.get('lead_phone') || params.get('wa_phone') || params.get('wpp_phone')
    if (phone) return `phone_${phone.replace(/\D/g, '')}`

    return 'site'
}

export default function GeoCapturePrompt({ visitorId }: GeoCapturePromptProps) {
    const [state, setState] = useState<PromptState>('idle')

    const context = useMemo(() => {
        if (typeof window === 'undefined') return null
        const params = new URLSearchParams(window.location.search)
        const pathname = window.location.pathname

        if (pathname.startsWith('/admin')) return null
        if (isTrackingDisabled()) return null
        if (!('geolocation' in navigator)) return null
        if (!hasLeadSignal(params) && !hasEditorialOrCrmSignal(params)) return null
        if (!hasLeadSignal(params) && !isUsefulPath(pathname)) return null

        return {
            params,
            pathname,
            storageKey: `pilger_geo_capture_${leadStorageKey(params)}`,
        }
    }, [])

    const postLocation = async (payload: Record<string, unknown>) => {
        if (!context) return

        await fetch('/api/leads/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                visitor_cookie_id: visitorId || getVisitorId(),
                lead_id: context.params.get('lead_id'),
                lead_phone: context.params.get('lead_phone') || context.params.get('wa_phone') || context.params.get('wpp_phone'),
                source: 'browser_geolocation_prompt',
                page_url: window.location.href,
                page_path: context.pathname,
                search_params: window.location.search,
                ...payload,
            }),
        })
    }

    const captureLocation = async () => {
        if (!context || state === 'capturing') return
        setState('capturing')

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    await postLocation({
                        permission_status: 'granted',
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        altitude_accuracy: position.coords.altitudeAccuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                    })
                    writeStoredState(context.storageKey, { status: 'granted' })
                    setState('done')
                    window.setTimeout(() => setState('hidden'), 1200)
                } catch (error) {
                    console.warn('[GeoCapture] save failed:', error)
                    setState('hidden')
                }
            },
            async (error) => {
                const permissionStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'
                try {
                    await postLocation({ permission_status: permissionStatus })
                } catch {
                    // The lead may not exist yet; do not block the user experience.
                }
                writeStoredState(context.storageKey, { status: permissionStatus })
                setState('hidden')
            },
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 300000,
            }
        )
    }

    useEffect(() => {
        if (!context) {
            setState('hidden')
            return
        }

        const stored = readStoredState(context.storageKey)
        if (stored?.status === 'dismissed' && Number(stored.updated_at) > daysAgo(DISMISS_DAYS)) {
            setState('hidden')
            return
        }
        if (stored?.status === 'granted' && Number(stored.updated_at) > hoursAgo(GRANTED_HOURS)) {
            setState('hidden')
            return
        }

        let cancelled = false
        let timer: number | null = null

        const prepare = async () => {
            const permissionsApi = navigator.permissions
            if (permissionsApi?.query) {
                try {
                    const result = await permissionsApi.query({ name: 'geolocation' as PermissionName })
                    if (cancelled) return
                    if (result.state === 'granted') {
                        timer = window.setTimeout(() => captureLocation(), 1200)
                        return
                    }
                    if (result.state === 'denied') {
                        try {
                            await postLocation({ permission_status: 'denied' })
                        } catch {
                            // The lead may not exist yet; keep the prompt quiet.
                        }
                        writeStoredState(context.storageKey, { status: 'denied' })
                        setState('hidden')
                        return
                    }
                } catch {
                    // Some browsers throw here; fall back to showing the prompt.
                }
            }

            timer = window.setTimeout(() => {
                if (!cancelled) setState('prompt')
            }, 2200)
        }

        prepare()

        return () => {
            cancelled = true
            if (timer) window.clearTimeout(timer)
        }
    }, [context])

    const dismiss = () => {
        if (context) {
            postLocation({ permission_status: 'dismissed' }).catch(() => {
                // Dismissal tracking is best effort.
            })
        }
        if (context) writeStoredState(context.storageKey, { status: 'dismissed' })
        setState('hidden')
    }

    if (state !== 'prompt' && state !== 'capturing' && state !== 'done') return null

    return (
        <div
            style={{
                position: 'fixed',
                left: 'max(16px, env(safe-area-inset-left))',
                bottom: 'calc(92px + env(safe-area-inset-bottom))',
                width: 'min(360px, calc(100vw - 32px))',
                zIndex: 9998,
                background: '#fffaf0',
                border: '1px solid rgba(201, 169, 110, 0.42)',
                borderRadius: 14,
                boxShadow: '0 18px 48px rgba(17, 24, 39, 0.18)',
                padding: 14,
                color: '#1f2933',
                fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            }}
        >
            <button
                type="button"
                onClick={dismiss}
                aria-label="Fechar pedido de localização"
                style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#7a6a52',
                    padding: 4,
                }}
            >
                <X size={16} />
            </button>
            <div style={{ display: 'flex', gap: 12, paddingRight: 22 }}>
                <div
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 999,
                        background: '#c9a96e',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        color: '#111',
                    }}
                >
                    <MapPin size={19} />
                </div>
                <div>
                    <strong style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>
                        Encontrar oportunidades perto de você
                    </strong>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: 12.5, lineHeight: 1.45 }}>
                        Autorize sua localização para registrarmos sua região exata no atendimento e
                        sugerirmos imóveis mais alinhados.
                    </p>
                </div>
            </div>
            <button
                type="button"
                onClick={captureLocation}
                disabled={state === 'capturing'}
                style={{
                    marginTop: 12,
                    width: '100%',
                    border: 'none',
                    borderRadius: 999,
                    padding: '10px 14px',
                    background: state === 'done' ? '#16a34a' : '#111111',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 12,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    cursor: state === 'capturing' ? 'wait' : 'pointer',
                }}
            >
                {state === 'capturing' ? 'Salvando localização...' : state === 'done' ? 'Localização salva' : 'Usar minha localização'}
            </button>
        </div>
    )
}
