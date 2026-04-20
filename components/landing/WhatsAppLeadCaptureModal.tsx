'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getVisitorId, trackChatOpened } from '@/lib/tracking/client'
import type { WhatsAppCaptureRequest } from '@/lib/tracking/whatsapp-capture'

type ModalState = (WhatsAppCaptureRequest & { open: true }) | { open: false }
const LEAD_CACHE_KEY = 'pilger_lead_capture'

function normalizePhone(raw: string): string {
    const digits = String(raw || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('55')) return digits
    return `55${digits}`
}

function formatPhoneInput(raw: string): string {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 13)
    if (!digits) return ''

    const cc = digits.startsWith('55') ? '55' : ''
    const local = cc ? digits.slice(2) : digits
    const ddd = local.slice(0, 2)
    const p1 = local.slice(2, 7)
    const p2 = local.slice(7, 11)

    let out = cc ? `+${cc}` : ''
    if (ddd) out += ` (${ddd}`
    if (ddd.length === 2) out += ')'
    if (p1) out += ` ${p1}`
    if (p2) out += `-${p2}`
    return out.trim()
}

export default function WhatsAppLeadCaptureModal() {
    const [state, setState] = useState<ModalState>({ open: false })
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        const onOpen = (event: Event) => {
            const custom = event as CustomEvent<WhatsAppCaptureRequest>
            const payload = custom.detail
            if (!payload?.phone || !payload?.slug) return
            setError('')
            try {
                const raw = localStorage.getItem(LEAD_CACHE_KEY)
                if (raw) {
                    const cache = JSON.parse(raw) as { name?: string; phone?: string }
                    if (cache?.name) setName(cache.name)
                    if (cache?.phone) setPhone(formatPhoneInput(cache.phone))
                }
            } catch {
                // no-op
            }
            setState({ ...payload, open: true })
        }

        window.addEventListener('pilger:open-whatsapp-capture', onOpen as EventListener)
        return () => window.removeEventListener('pilger:open-whatsapp-capture', onOpen as EventListener)
    }, [])

    const canSubmit = useMemo(() => name.trim().length >= 2 && normalizePhone(phone).length >= 12, [name, phone])

    const close = () => {
        if (submitting) return
        setState({ open: false })
    }

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!state.open || !canSubmit) return
        setSubmitting(true)
        setError('')
        const normalizedPhone = normalizePhone(phone)

        try {
            const response = await fetch('/api/leads/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    phone: normalizedPhone,
                    landing_page_slug: state.slug,
                    visitor_cookie_id: getVisitorId(),
                    referrer: document.referrer,
                    search_params: window.location.search,
                    consent_lgpd: true,
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data?.error || 'Não foi possível salvar seus dados.')
            }

            await trackChatOpened(state.slug, {
                template: state.template || 'unknown',
                capture_before_whatsapp: true,
            })

            try {
                localStorage.setItem(LEAD_CACHE_KEY, JSON.stringify({
                    name: name.trim(),
                    phone: normalizedPhone,
                }))
            } catch {
                // no-op
            }

            const text = encodeURIComponent(state.message || '')
            window.open(`https://wa.me/${state.phone}?text=${text}`, '_blank')
            setState({ open: false })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro inesperado.')
        } finally {
            setSubmitting(false)
        }
    }

    if (!state.open) return null

    return (
        <div style={overlayStyle} onClick={close}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={titleStyle}>Fale com um especialista no WhatsApp</div>
                <p style={subtitleStyle}>Preencha seus dados para iniciarmos o atendimento.</p>

                <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        style={inputStyle}
                        disabled={submitting}
                    />
                    <input
                        value={phone}
                        onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                        placeholder="WhatsApp com DDD"
                        style={inputStyle}
                        disabled={submitting}
                    />

                    {error ? <div style={errorStyle}>{error}</div> : null}

                    <button type="submit" style={buttonStyle} disabled={!canSubmit || submitting}>
                        {submitting ? 'Enviando...' : 'Continuar no WhatsApp'}
                    </button>
                    <button type="button" style={ghostButtonStyle} onClick={close} disabled={submitting}>
                        Cancelar
                    </button>
                </form>
            </div>
        </div>
    )
}

const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
}

const modalStyle: CSSProperties = {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e5e7eb',
    padding: 18,
    boxShadow: '0 10px 28px rgba(0,0,0,0.25)',
}

const titleStyle: CSSProperties = {
    fontSize: 20,
    fontWeight: 700,
    color: '#111827',
}

const subtitleStyle: CSSProperties = {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 14,
    color: '#4b5563',
}

const inputStyle: CSSProperties = {
    height: 42,
    borderRadius: 8,
    border: '1px solid #d1d5db',
    padding: '0 12px',
    outline: 'none',
    fontSize: 14,
}

const buttonStyle: CSSProperties = {
    height: 42,
    borderRadius: 8,
    border: 'none',
    background: '#16a34a',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
}

const ghostButtonStyle: CSSProperties = {
    height: 38,
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    fontWeight: 600,
    cursor: 'pointer',
}

const errorStyle: CSSProperties = {
    color: '#dc2626',
    fontSize: 13,
}
