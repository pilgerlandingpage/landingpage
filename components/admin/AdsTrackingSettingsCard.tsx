'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Activity, AlertCircle, CheckCircle, ExternalLink, RefreshCw, Save } from 'lucide-react'

type Platform = 'meta' | 'google'

type TrackingField = {
    key: 'meta_pixel_id' | 'google_ads_conversion_id' | 'google_analytics_measurement_id'
    label: string
    placeholder: string
    optional?: boolean
}

type TrackingCardConfig = {
    title: string
    eyebrow: string
    description: string
    fields: TrackingField[]
    primaryKey: TrackingField['key']
    accent: string
    helpUrl: string
}

type Props = {
    platform: Platform
    onNotify?: (message: string, type: 'success' | 'error') => void
}

const TRACKING_CONFIGS: Record<Platform, TrackingCardConfig> = {
    meta: {
        title: 'Rastreamento Meta',
        eyebrow: 'Meta Ads',
        description: 'Pixel usado nas campanhas de Facebook e Instagram.',
        fields: [
            { key: 'meta_pixel_id', label: 'Meta Pixel ID', placeholder: '1909600186425343' },
        ],
        primaryKey: 'meta_pixel_id',
        accent: '#1877f2',
        helpUrl: 'https://business.facebook.com/events_manager2/list/pixel',
    },
    google: {
        title: 'Rastreamento Google',
        eyebrow: 'Google Ads',
        description: 'Tags publicadas para campanhas e leitura de trafego.',
        fields: [
            { key: 'google_ads_conversion_id', label: 'Google Ads Conversion ID', placeholder: 'AW-000000000' },
            { key: 'google_analytics_measurement_id', label: 'GA4 Measurement ID', placeholder: 'G-XXXXXXXXXX', optional: true },
        ],
        primaryKey: 'google_ads_conversion_id',
        accent: '#4285f4',
        helpUrl: 'https://ads.google.com/aw/conversions',
    },
}

function normalizeTrackingValue(key: TrackingField['key'], value: string) {
    const raw = value.trim()
    if (!raw) return ''

    if (key === 'google_ads_conversion_id') {
        const compact = raw.replace(/\s+/g, '').toUpperCase()
        return /^\d{6,20}$/.test(compact) ? `AW-${compact}` : compact
    }

    if (key === 'google_analytics_measurement_id') {
        return raw.replace(/\s+/g, '').toUpperCase()
    }

    return raw.replace(/\s+/g, '')
}

function publicPayloadValue(payload: Record<string, string>, key: TrackingField['key']) {
    if (key === 'meta_pixel_id') return payload.metaPixelId || ''
    if (key === 'google_ads_conversion_id') return payload.googleAdsId || ''
    if (key === 'google_analytics_measurement_id') return payload.googleAnalyticsId || ''
    return ''
}

function formatUpdatedAt(value?: string) {
    if (!value) return 'Sem registro'
    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export default function AdsTrackingSettingsCard({ platform, onNotify }: Props) {
    const config = TRACKING_CONFIGS[platform]
    const [values, setValues] = useState<Record<string, string>>({})
    const [updatedAt, setUpdatedAt] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [publicStatus, setPublicStatus] = useState<'idle' | 'ok' | 'missing' | 'error'>('idle')

    const primaryValue = values[config.primaryKey] || ''
    const isConfigured = Boolean(primaryValue)
    const lastUpdated = useMemo(() => {
        const dates = config.fields
            .map(field => updatedAt[field.key])
            .filter(Boolean)
            .sort()
        return dates.at(-1)
    }, [config.fields, updatedAt])

    const notify = (message: string, type: 'success' | 'error') => {
        onNotify?.(message, type)
    }

    const loadTracking = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/admin/ads/tracking', { cache: 'no-store' })
            const payload = await response.json()
            if (!response.ok || !payload.success) throw new Error(payload.message || 'Erro ao carregar tracking.')
            setValues(payload.configs || {})
            setUpdatedAt(payload.updatedAt || {})
        } catch (error) {
            notify(error instanceof Error ? error.message : 'Erro ao carregar tracking.', 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setPublicStatus('idle')
        try {
            const normalized = Object.fromEntries(
                config.fields.map(field => [field.key, normalizeTrackingValue(field.key, values[field.key] || '')])
            )
            const response = await fetch('/api/admin/ads/tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs: normalized }),
            })
            const payload = await response.json()
            if (!response.ok || !payload.success) throw new Error(payload.message || 'Erro ao salvar tracking.')
            setValues(current => ({ ...current, ...(payload.configs || normalized) }))
            await loadTracking()
            notify('Tracking salvo com sucesso.', 'success')
        } catch (error) {
            notify(error instanceof Error ? error.message : 'Erro ao salvar tracking.', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleTest = async () => {
        setTesting(true)
        try {
            const response = await fetch('/api/public/tracking-config', { cache: 'no-store' })
            const payload = await response.json()
            const expected = config.fields
                .filter(field => !field.optional || values[field.key])
                .every(field => {
                    const currentValue = normalizeTrackingValue(field.key, values[field.key] || '')
                    return !currentValue || publicPayloadValue(payload, field.key) === currentValue
                })

            if (!response.ok || !expected || !primaryValue) {
                setPublicStatus('missing')
                notify('Tracking ainda nao esta publicado para o site.', 'error')
                return
            }

            setPublicStatus('ok')
            notify('Tracking publicado para o site.', 'success')
        } catch {
            setPublicStatus('error')
            notify('Nao foi possivel testar o tracking.', 'error')
        } finally {
            setTesting(false)
        }
    }

    useEffect(() => {
        void loadTracking()
    }, [])

    return (
        <section className="ads-tracking-card" style={{ '--tracking-accent': config.accent } as CSSProperties}>
            <div className="ads-tracking-head">
                <div>
                    <span>{config.eyebrow}</span>
                    <h2><Activity size={19} /> {config.title}</h2>
                    <p>{config.description}</p>
                </div>
                <div className={`ads-tracking-status ${isConfigured ? 'ready' : 'empty'}`}>
                    {isConfigured ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                    {isConfigured ? 'Configurado' : 'Pendente'}
                </div>
            </div>

            <div className="ads-tracking-fields">
                {config.fields.map(field => (
                    <label key={field.key}>
                        <span>{field.label}{field.optional ? ' opcional' : ''}</span>
                        <input
                            value={values[field.key] || ''}
                            onChange={event => {
                                setValues(current => ({ ...current, [field.key]: event.target.value }))
                                setPublicStatus('idle')
                            }}
                            placeholder={field.placeholder}
                            disabled={loading || saving}
                            inputMode={field.key === 'meta_pixel_id' ? 'numeric' : 'text'}
                        />
                    </label>
                ))}
            </div>

            <div className="ads-tracking-footer">
                <div>
                    <small>Ultima atualizacao</small>
                    <strong>{formatUpdatedAt(lastUpdated)}</strong>
                    {publicStatus === 'ok' && <em className="ok">Publicado no site</em>}
                    {publicStatus === 'missing' && <em className="warn">Nao publicado</em>}
                    {publicStatus === 'error' && <em className="warn">Teste indisponivel</em>}
                </div>
                <div className="ads-tracking-actions">
                    <a href={config.helpUrl} target="_blank" rel="noopener noreferrer" className="ads-tracking-icon-link" aria-label="Abrir gerenciador da plataforma">
                        <ExternalLink size={16} />
                    </a>
                    <button type="button" onClick={handleTest} disabled={loading || testing || !isConfigured}>
                        <RefreshCw size={16} className={testing ? 'spin' : ''} />
                        Testar
                    </button>
                    <button type="button" onClick={handleSave} disabled={loading || saving}>
                        <Save size={16} />
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            <style jsx>{`
                .ads-tracking-card {
                    margin-bottom: 24px;
                    padding: 18px;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015));
                    box-shadow: 0 16px 34px rgba(0,0,0,.16);
                }
                .ads-tracking-head {
                    display: flex;
                    justify-content: space-between;
                    gap: 18px;
                    margin-bottom: 16px;
                }
                .ads-tracking-head span {
                    display: block;
                    margin-bottom: 5px;
                    color: var(--tracking-accent);
                    font-size: .72rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .ads-tracking-head h2 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0;
                    color: var(--text-primary);
                    font-size: 1.05rem;
                }
                .ads-tracking-head p {
                    margin: 6px 0 0;
                    color: var(--text-muted);
                    font-size: .82rem;
                    line-height: 1.45;
                }
                .ads-tracking-status {
                    display: inline-flex;
                    align-items: center;
                    align-self: flex-start;
                    gap: 7px;
                    padding: 7px 10px;
                    border-radius: 999px;
                    font-size: .73rem;
                    font-weight: 800;
                    white-space: nowrap;
                }
                .ads-tracking-status.ready {
                    color: #22c55e;
                    background: rgba(34,197,94,.1);
                    border: 1px solid rgba(34,197,94,.22);
                }
                .ads-tracking-status.empty {
                    color: #f59e0b;
                    background: rgba(245,158,11,.1);
                    border: 1px solid rgba(245,158,11,.22);
                }
                .ads-tracking-fields {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
                    gap: 12px;
                }
                .ads-tracking-fields label {
                    display: grid;
                    gap: 7px;
                    color: var(--text-secondary);
                    font-size: .75rem;
                    font-weight: 700;
                }
                .ads-tracking-fields input {
                    width: 100%;
                    min-height: 42px;
                    padding: 0 12px;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background: rgba(0,0,0,.18);
                    color: var(--text-primary);
                    font-size: .88rem;
                    outline: none;
                }
                .ads-tracking-fields input:focus {
                    border-color: var(--tracking-accent);
                    box-shadow: 0 0 0 3px color-mix(in srgb, var(--tracking-accent) 18%, transparent);
                }
                .ads-tracking-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    margin-top: 16px;
                    padding-top: 14px;
                    border-top: 1px solid var(--border-color);
                }
                .ads-tracking-footer small {
                    display: block;
                    margin-bottom: 3px;
                    color: var(--text-muted);
                    font-size: .68rem;
                    text-transform: uppercase;
                    font-weight: 800;
                }
                .ads-tracking-footer strong {
                    color: var(--text-primary);
                    font-size: .82rem;
                }
                .ads-tracking-footer em {
                    margin-left: 10px;
                    font-size: .75rem;
                    font-style: normal;
                    font-weight: 800;
                }
                .ads-tracking-footer em.ok { color: #22c55e; }
                .ads-tracking-footer em.warn { color: #f59e0b; }
                .ads-tracking-actions {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }
                .ads-tracking-actions button,
                .ads-tracking-icon-link {
                    min-height: 38px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 0 13px;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    font-size: .8rem;
                    font-weight: 800;
                    text-decoration: none;
                    cursor: pointer;
                }
                .ads-tracking-actions button:last-child {
                    border-color: color-mix(in srgb, var(--tracking-accent) 48%, transparent);
                    background: color-mix(in srgb, var(--tracking-accent) 15%, transparent);
                }
                .ads-tracking-actions button:disabled {
                    opacity: .55;
                    cursor: not-allowed;
                }
                @media (max-width: 760px) {
                    .ads-tracking-head,
                    .ads-tracking-footer {
                        display: grid;
                    }
                    .ads-tracking-actions {
                        justify-content: stretch;
                    }
                    .ads-tracking-actions button,
                    .ads-tracking-icon-link {
                        flex: 1;
                    }
                }
            `}</style>
        </section>
    )
}
