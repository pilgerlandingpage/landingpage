'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { createMetaEventId, getMetaBrowserData, getVisitorId, trackChatOpened, trackEvent, trackMetaPixelEvent } from '@/lib/tracking/client'

type PropertySidebarLeadFormProps = {
    phone: string
    message: string
    slug?: string
    template?: string
    metadata?: Record<string, unknown>
}

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

    const countryCode = digits.startsWith('55') ? '55' : ''
    const local = countryCode ? digits.slice(2) : digits
    const areaCode = local.slice(0, 2)
    const firstPart = local.slice(2, 7)
    const secondPart = local.slice(7, 11)

    let output = countryCode ? `+${countryCode}` : ''
    if (areaCode) output += ` (${areaCode}`
    if (areaCode.length === 2) output += ')'
    if (firstPart) output += ` ${firstPart}`
    if (secondPart) output += `-${secondPart}`
    return output.trim()
}

function isValidEmail(value: string) {
    return EMAIL_RE.test(value.trim().toLowerCase())
}

function metadataText(metadata: Record<string, unknown> | undefined, key: string) {
    const value = metadata?.[key]
    return typeof value === 'string' ? value.trim() : ''
}

export default function PropertySidebarLeadForm({
    phone,
    message,
    slug = 'imovel',
    template = 'property-classic-form',
    metadata = {},
}: PropertySidebarLeadFormProps) {
    const [leadMessage, setLeadMessage] = useState(message)
    const [name, setName] = useState('')
    const [leadPhone, setLeadPhone] = useState('')
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [status, setStatus] = useState('')

    const normalizedLeadPhone = normalizePhone(leadPhone)
    const normalizedEmail = email.trim().toLowerCase()
    const canSubmit = useMemo(
        () => name.trim().length >= 2 && normalizedLeadPhone.length >= 12 && isValidEmail(normalizedEmail),
        [name, normalizedLeadPhone, normalizedEmail]
    )

    const buildWhatsAppMessage = () => [
        leadMessage.trim() || message,
        '',
        `Nome: ${name.trim()}`,
        `Telefone: ${leadPhone.trim()}`,
        `Email: ${normalizedEmail}`,
    ].filter(Boolean).join('\n')

    const persistLeadCapture = async (whatsappMessage: string, leadMetaEventId: string) => {
        const pageMetadata = {
            page_path: window.location.pathname,
            page_url: window.location.href,
            page_title: document.title,
        }

        try {
            const response = await fetch('/api/leads/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: JSON.stringify({
                    name: name.trim(),
                    phone: normalizedLeadPhone,
                    email: normalizedEmail,
                    landing_page_slug: slug,
                    visitor_cookie_id: getVisitorId(),
                    referrer: document.referrer,
                    search_params: window.location.search,
                    consent_lgpd: true,
                    whatsapp_marketing_opt_in: false,
                    whatsapp_phone: phone,
                    metadata: {
                        ...pageMetadata,
                        ...metadata,
                        lead_capture_surface: 'sidebar_inline_form',
                        lead_form_name: name.trim(),
                        lead_form_phone: normalizedLeadPhone,
                        lead_form_email: normalizedEmail,
                        whatsapp_prefill_message: whatsappMessage,
                        meta_event_name: 'Lead',
                        meta_event_id: leadMetaEventId,
                        ...getMetaBrowserData(),
                    },
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data?.error || 'Nao foi possivel salvar o lead.')
            }

            trackMetaPixelEvent('Lead', {
                ...pageMetadata,
                ...metadata,
                phone: normalizedLeadPhone,
                email: normalizedEmail,
                title: metadataText(metadata, 'title'),
            }, leadMetaEventId)

            await trackChatOpened(slug, {
                template,
                capture_before_whatsapp: true,
                capture_email: true,
                lead_capture_surface: 'sidebar_inline_form',
                ...metadata,
            })

            localStorage.setItem(LEAD_CACHE_KEY, JSON.stringify({
                name: name.trim(),
                phone: normalizedLeadPhone,
                email: normalizedEmail,
            }))
        } catch (err) {
            console.warn('[PropertySidebarLeadForm] lead capture skipped:', err)
            setError('WhatsApp aberto. Se o cadastro nao salvar automaticamente, o atendimento segue pela conversa.')
        }
    }

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setStatus('')

        if (!canSubmit) {
            setError('Preencha nome, telefone e email para continuar.')
            return
        }

        setError('')
        const whatsappMessage = buildWhatsAppMessage()
        const destinationPhone = normalizePhone(phone)
        const destinationUrl = `https://wa.me/${destinationPhone}?text=${encodeURIComponent(whatsappMessage)}`
        const openedWindow = window.open(destinationUrl, '_blank')
        if (openedWindow) openedWindow.opener = null
        else window.location.assign(destinationUrl)

        const trackingEventType = metadataText(metadata, 'tracking_event_type')
        if (trackingEventType) {
            void trackEvent(trackingEventType, {
                ...metadata,
                template,
                channel: 'whatsapp',
                capture_before_whatsapp: true,
                lead_capture_surface: 'sidebar_inline_form',
                lead_form_name: name.trim(),
                lead_form_phone: normalizedLeadPhone,
                lead_form_email: normalizedEmail,
            })
        }

        setStatus('WhatsApp aberto com seus dados.')
        void persistLeadCapture(whatsappMessage, createMetaEventId('lead'))
    }

    return (
        <form id="whatsapp-form" className="plp-sidebar-lead-form" onSubmit={handleSubmit}>
            <textarea
                className="plp-sidebar-lead-message"
                aria-label="Mensagem para o WhatsApp"
                value={leadMessage}
                onChange={(event) => setLeadMessage(event.target.value)}
                rows={3}
            />
            <input
                aria-label="Nome completo"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome completo *"
                autoComplete="name"
                required
            />
            <input
                aria-label="Telefone"
                value={leadPhone}
                onChange={(event) => setLeadPhone(formatPhoneInput(event.target.value))}
                placeholder="Telefone *"
                autoComplete="tel"
                inputMode="tel"
                required
            />
            <input
                aria-label="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email *"
                autoComplete="email"
                inputMode="email"
                type="email"
                required
            />
            <button type="submit" className="plp-dark-button" disabled={!canSubmit}>
                Enviar interesse
            </button>
            <p className="plp-sidebar-lead-privacy">Ao enviar, voce aceita receber contato sobre este imovel.</p>
            {error && <p className="plp-sidebar-lead-feedback is-error">{error}</p>}
            {status && !error && <p className="plp-sidebar-lead-feedback is-success">{status}</p>}
        </form>
    )
}
