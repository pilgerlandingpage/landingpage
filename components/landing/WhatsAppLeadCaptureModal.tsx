'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Mail, MessageCircle, Phone, Send, User, X } from 'lucide-react'
import { getVisitorId, trackChatOpened } from '@/lib/tracking/client'
import type { WhatsAppCaptureRequest } from '@/lib/tracking/whatsapp-capture'

type ModalState = (WhatsAppCaptureRequest & { open: true }) | { open: false }
const LEAD_CACHE_KEY = 'pilger_lead_capture'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
    const value = metadata?.[key]
    return typeof value === 'string' ? value.trim() : ''
}

function isValidEmail(raw: string) {
    return EMAIL_RE.test(raw.trim().toLowerCase())
}

export default function WhatsAppLeadCaptureModal() {
    const [state, setState] = useState<ModalState>({ open: false })
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
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
                    const cache = JSON.parse(raw) as { name?: string; phone?: string; email?: string }
                    if (cache?.name) setName(cache.name)
                    if (cache?.phone) setPhone(formatPhoneInput(cache.phone))
                    if (cache?.email) setEmail(cache.email)
                }
            } catch {
                // no-op
            }
            setState({ ...payload, open: true })
        }

        window.addEventListener('pilger:open-whatsapp-capture', onOpen as EventListener)
        return () => window.removeEventListener('pilger:open-whatsapp-capture', onOpen as EventListener)
    }, [])

    const propertyUrlFromMetadata = state.open ? metadataString(state.metadata, 'property_url') : ''
    const propertyTitle = state.open ? metadataString(state.metadata, 'title') : ''
    const isPropertyLead = state.open && (
        state.slug === 'imovel'
        || Boolean(propertyUrlFromMetadata)
        || Boolean(state.metadata?.property_id)
    )
    const propertyUrl = isPropertyLead
        ? propertyUrlFromMetadata || (typeof window !== 'undefined' ? window.location.href : '')
        : ''
    const messagePreview = state.open
        ? isPropertyLead
            ? `Ola, tenho interesse no imovel ${propertyUrl}`.trim()
            : state.message || 'Ola! Quero falar com um especialista.'
        : ''
    const requiresEmail = isPropertyLead

    const canSubmit = useMemo(
        () => {
            const emailFilled = email.trim().length > 0
            const emailReady = requiresEmail ? isValidEmail(email) : !emailFilled || isValidEmail(email)
            return name.trim().length >= 2 && normalizePhone(phone).length >= 12 && emailReady
        },
        [name, phone, email, requiresEmail]
    )

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
        const normalizedEmail = email.trim().toLowerCase()

        try {
            const response = await fetch('/api/leads/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    phone: normalizedPhone,
                    email: normalizedEmail,
                    landing_page_slug: state.slug,
                    visitor_cookie_id: getVisitorId(),
                    referrer: document.referrer,
                    search_params: window.location.search,
                    consent_lgpd: true,
                    whatsapp_phone: state.phone,
                    metadata: {
                        ...(state.metadata || {}),
                        whatsapp_prefill_message: messagePreview,
                    },
                }),
            })

            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
                throw new Error(data?.error || 'Não foi possível salvar seus dados.')
            }

            await trackChatOpened(state.slug, {
                template: state.template || 'unknown',
                capture_before_whatsapp: true,
                capture_email: Boolean(normalizedEmail),
                ...(state.metadata || {}),
            })

            try {
                localStorage.setItem(LEAD_CACHE_KEY, JSON.stringify({
                    name: name.trim(),
                    phone: normalizedPhone,
                    email: normalizedEmail,
                }))
            } catch {
                // no-op
            }

            const destinationPhone = normalizePhone(data?.whatsapp_contact?.phone || data?.whatsapp_phone || state.phone)
            const text = encodeURIComponent(messagePreview)
            window.open(`https://wa.me/${destinationPhone}?text=${text}`, '_blank')
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
            <section style={widgetStyle} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Contato via WhatsApp">
                <header style={headerStyle}>
                    <div style={headerTitleStyle}>
                        <MessageCircle size={18} />
                        <span>Imobiliária em Balneário Camboriú</span>
                    </div>
                    <button type="button" onClick={close} disabled={submitting} style={closeButtonStyle} aria-label="Fechar">
                        <X size={16} />
                    </button>
                </header>

                <div style={chatAreaStyle}>
                    <div style={incomingBubbleStyle}>Olá <small style={bubbleTimeStyle}>13:46</small></div>
                    <div style={incomingBubbleStyle}>Quer saber mais sobre este imóvel? <small style={bubbleTimeStyle}>13:46</small></div>
                    <div style={incomingBubbleStyle}>Entre em contato via WhatsApp <small style={bubbleTimeStyle}>13:46</small></div>

                    <div style={previewRowStyle}>
                        <div style={outgoingBubbleStyle}>
                            <span>{messagePreview}</span>
                            {propertyTitle ? <strong style={previewTitleStyle}>{propertyTitle}</strong> : null}
                        </div>
                        <span style={previewSendStyle}><Send size={18} /></span>
                    </div>
                </div>

                <form onSubmit={submit} style={formStyle}>
                    <label style={fieldStyle}>
                        <span>Nome Completo *</span>
                        <div style={inputWrapStyle}>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Seu nome"
                                style={inputStyle}
                                disabled={submitting}
                                autoComplete="name"
                            />
                            <User size={15} />
                        </div>
                    </label>

                    <label style={fieldStyle}>
                        <span>Telefone *</span>
                        <div style={inputWrapStyle}>
                            <input
                                value={phone}
                                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                                placeholder="+55 (47) 99999-9999"
                                style={inputStyle}
                                disabled={submitting}
                                autoComplete="tel"
                                inputMode="tel"
                            />
                            <Phone size={15} />
                        </div>
                    </label>

                    <label style={fieldStyle}>
                        <span>Email {requiresEmail ? '*' : ''}</span>
                        <div style={inputWrapStyle}>
                            <input
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                style={inputStyle}
                                disabled={submitting}
                                autoComplete="email"
                                inputMode="email"
                                type="email"
                            />
                            <Mail size={15} />
                        </div>
                    </label>

                    <p style={privacyStyle}>Ao enviar você está aceitando a política de privacidade.</p>
                    {error ? <div style={errorStyle}>{error}</div> : null}

                    <button type="submit" style={{
                        ...buttonStyle,
                        opacity: canSubmit && !submitting ? 1 : 0.62,
                        cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                    }} disabled={!canSubmit || submitting}>
                        <Send size={15} /> {submitting ? 'enviando...' : 'enviar'}
                    </button>
                </form>
            </section>
        </div>
    )
}

const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 99999,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: '18px',
    background: 'rgba(0,0,0,0.58)',
}

const widgetStyle: CSSProperties = {
    width: 'min(100%, 356px)',
    maxHeight: 'calc(100vh - 36px)',
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, auto) auto',
    overflow: 'hidden',
    border: '1px solid rgba(0,0,0,0.18)',
    borderRadius: 0,
    background: '#f2f2f2',
    boxShadow: '0 18px 50px rgba(0,0,0,0.34)',
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const headerStyle: CSSProperties = {
    minHeight: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '0 9px',
    background: '#0f9f7a',
    color: '#fff',
}

const headerTitleStyle: CSSProperties = {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
}

const closeButtonStyle: CSSProperties = {
    width: 24,
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 0,
    background: 'rgba(255,255,255,0.16)',
    color: '#fff',
    cursor: 'pointer',
}

const chatAreaStyle: CSSProperties = {
    display: 'grid',
    gap: 8,
    padding: '12px 10px',
    background:
        'linear-gradient(rgba(232,229,220,0.92), rgba(232,229,220,0.92)), repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0 1px, transparent 1px 18px)',
}

const incomingBubbleStyle: CSSProperties = {
    width: 'fit-content',
    maxWidth: '86%',
    padding: '8px 10px',
    borderRadius: '0 10px 10px 10px',
    background: '#fff',
    color: '#2f3437',
    fontSize: 12,
    lineHeight: 1.35,
    boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
}

const bubbleTimeStyle: CSSProperties = {
    marginLeft: 8,
    color: '#9aa0a4',
    fontSize: 10,
    fontWeight: 500,
}

const previewRowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 38px',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
}

const outgoingBubbleStyle: CSSProperties = {
    display: 'grid',
    gap: 5,
    padding: '10px 12px',
    borderRadius: '12px 12px 0 12px',
    background: '#fff',
    color: '#30363a',
    fontSize: 12,
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
    boxShadow: '0 1px 1px rgba(0,0,0,0.12)',
}

const previewTitleStyle: CSSProperties = {
    color: '#687078',
    fontSize: 11,
    fontWeight: 700,
}

const previewSendStyle: CSSProperties = {
    width: 38,
    height: 38,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#a2a7aa',
}

const formStyle: CSSProperties = {
    display: 'grid',
    gap: 8,
    padding: '10px',
    background: '#f2f2f2',
}

const fieldStyle: CSSProperties = {
    display: 'grid',
    gap: 3,
    color: '#343a40',
    fontSize: 11,
    fontWeight: 700,
}

const inputWrapStyle: CSSProperties = {
    height: 34,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 34px',
    alignItems: 'center',
    border: '1px solid #cfd4d7',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12) inset',
}

const inputStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    border: 0,
    padding: '0 9px',
    outline: 'none',
    background: 'transparent',
    color: '#1f2428',
    fontSize: 13,
}

const privacyStyle: CSSProperties = {
    margin: '0 0 2px',
    color: '#3f464c',
    fontSize: 10,
    lineHeight: 1.35,
}

const buttonStyle: CSSProperties = {
    justifySelf: 'end',
    minWidth: 82,
    height: 34,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: 0,
    borderRadius: 3,
    background: '#171a1d',
    color: '#fff',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'lowercase',
}

const errorStyle: CSSProperties = {
    color: '#b42318',
    fontSize: 11,
    fontWeight: 700,
}
