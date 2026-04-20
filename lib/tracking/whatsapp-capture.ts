'use client'

export type WhatsAppCaptureRequest = {
    phone: string
    message?: string
    slug: string
    template?: string
}

export function openWhatsAppWithLeadCapture(payload: WhatsAppCaptureRequest) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('pilger:open-whatsapp-capture', { detail: payload }))
}

